// MCP服务器健康检查系统
// 提供定期健康检查、错误恢复和状态监控功能

import { EventEmitter } from 'events'
import { MCP_EVENTS } from '../../events'
import type { MCPClient } from '@modelcontextprotocol/sdk/client/index.js'

export interface HealthCheckResult {
  serverId: string
  healthy: boolean
  timestamp: number
  responseTime: number
  error?: string
  metadata?: {
    toolsCount?: number
    resourcesCount?: number
    promptsCount?: number
    lastSuccessfulCheck?: number
  }
}

export interface HealthCheckConfig {
  interval: number // 检查间隔（毫秒）
  timeout: number // 超时时间（毫秒）
  retryAttempts: number // 重试次数
  retryDelay: number // 重试延迟（毫秒）
  enabled: boolean // 是否启用健康检查
  thresholds: {
    responseTime: number // 响应时间阈值（毫秒）
    successRate: number // 成功率阈值（0-1）
  }
}

export interface ServerHealthState {
  serverId: string
  isHealthy: boolean
  lastCheck: number
  successCount: number
  failureCount: number
  totalChecks: number
  averageResponseTime: number
  lastError?: string
  consecutiveFailures: number
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
}

export class MCPHealthChecker extends EventEmitter {
  private clients = new Map<string, MCPClient>()
  private healthStates = new Map<string, ServerHealthState>()
  private checkIntervals = new Map<string, NodeJS.Timeout>()
  private config: HealthCheckConfig

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super()

    this.config = {
      interval: 30000, // 30秒
      timeout: 5000, // 5秒
      retryAttempts: 3,
      retryDelay: 1000, // 1秒
      enabled: true,
      thresholds: {
        responseTime: 3000, // 3秒
        successRate: 0.8 // 80%
      },
      ...config
    }
  }

  /**
   * 注册MCP客户端进行健康检查
   */
  registerClient(serverId: string, client: MCPClient): void {
    this.clients.set(serverId, client)

    // 初始化健康状态
    this.healthStates.set(serverId, {
      serverId,
      isHealthy: true,
      lastCheck: 0,
      successCount: 0,
      failureCount: 0,
      totalChecks: 0,
      averageResponseTime: 0,
      consecutiveFailures: 0,
      status: 'unknown'
    })

    if (this.config.enabled) {
      this.startHealthCheck(serverId)
    }

    console.log(`MCP Health Checker: Registered client ${serverId}`)
  }

  /**
   * 注销MCP客户端
   */
  unregisterClient(serverId: string): void {
    this.stopHealthCheck(serverId)
    this.clients.delete(serverId)
    this.healthStates.delete(serverId)

    console.log(`MCP Health Checker: Unregistered client ${serverId}`)
  }

  /**
   * 启动指定服务器的健康检查
   */
  private startHealthCheck(serverId: string): void {
    this.stopHealthCheck(serverId) // 先停止现有的检查

    const interval = setInterval(async () => {
      await this.performHealthCheck(serverId)
    }, this.config.interval)

    this.checkIntervals.set(serverId, interval)

    // 立即执行一次健康检查
    this.performHealthCheck(serverId)
  }

  /**
   * 停止指定服务器的健康检查
   */
  private stopHealthCheck(serverId: string): void {
    const interval = this.checkIntervals.get(serverId)
    if (interval) {
      clearInterval(interval)
      this.checkIntervals.delete(serverId)
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(serverId: string): Promise<HealthCheckResult> {
    const client = this.clients.get(serverId)
    const healthState = this.healthStates.get(serverId)

    if (!client || !healthState) {
      throw new Error(`Client or health state not found for server: ${serverId}`)
    }

    const startTime = Date.now()
    let result: HealthCheckResult

    try {
      // 执行健康检查（带重试机制）
      const checkResult = await this.executeHealthCheckWithRetry(serverId, client)
      const responseTime = Date.now() - startTime

      result = {
        serverId,
        healthy: true,
        timestamp: Date.now(),
        responseTime,
        metadata: checkResult
      }

      // 更新健康状态
      this.updateHealthState(serverId, true, responseTime)

    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      result = {
        serverId,
        healthy: false,
        timestamp: Date.now(),
        responseTime,
        error: errorMessage
      }

      // 更新健康状态
      this.updateHealthState(serverId, false, responseTime, errorMessage)
    }

    // 发出健康检查事件
    this.emit(MCP_EVENTS.SERVER_HEALTH_CHECK, result)

    return result
  }

  /**
   * 带重试机制的健康检查执行
   */
  private async executeHealthCheckWithRetry(
    serverId: string,
    client: MCPClient,
    attempt = 1
  ): Promise<any> {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
      })

      // 执行基本健康检查：获取工具列表
      const healthCheckPromise = this.performBasicHealthCheck(client)

      const result = await Promise.race([healthCheckPromise, timeoutPromise])
      return result

    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        console.warn(`Health check failed for ${serverId}, attempt ${attempt}/${this.config.retryAttempts}:`, error)

        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))

        return this.executeHealthCheckWithRetry(serverId, client, attempt + 1)
      } else {
        throw error
      }
    }
  }

  /**
   * 执行基本健康检查
   */
  private async performBasicHealthCheck(client: MCPClient): Promise<any> {
    try {
      // 尝试获取工具列表作为健康检查
      const toolsResult = await client.listTools()

      // 可选：获取其他信息
      const [resourcesResult, promptsResult] = await Promise.allSettled([
        client.listResources?.() || Promise.resolve({ resources: [] }),
        client.listPrompts?.() || Promise.resolve({ prompts: [] })
      ])

      return {
        toolsCount: toolsResult.tools?.length || 0,
        resourcesCount: resourcesResult.status === 'fulfilled'
          ? (resourcesResult.value as any)?.resources?.length || 0
          : 0,
        promptsCount: promptsResult.status === 'fulfilled'
          ? (promptsResult.value as any)?.prompts?.length || 0
          : 0
      }
    } catch (error) {
      // 如果listTools失败，尝试更基本的检查
      throw new Error(`Basic health check failed: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 更新服务器健康状态
   */
  private updateHealthState(
    serverId: string,
    isHealthy: boolean,
    responseTime: number,
    error?: string
  ): void {
    const state = this.healthStates.get(serverId)
    if (!state) return

    // 更新统计信息
    state.totalChecks++
    state.lastCheck = Date.now()

    if (isHealthy) {
      state.successCount++
      state.consecutiveFailures = 0
      delete state.lastError
    } else {
      state.failureCount++
      state.consecutiveFailures++
      state.lastError = error
    }

    // 更新平均响应时间
    state.averageResponseTime = (state.averageResponseTime * (state.totalChecks - 1) + responseTime) / state.totalChecks

    // 计算成功率
    const successRate = state.successCount / state.totalChecks

    // 确定健康状态
    if (isHealthy && responseTime <= this.config.thresholds.responseTime) {
      state.status = 'healthy'
      state.isHealthy = true
    } else if (successRate >= this.config.thresholds.successRate) {
      state.status = 'degraded'
      state.isHealthy = true
    } else {
      state.status = 'unhealthy'
      state.isHealthy = false
    }

    // 如果健康状态发生变化，发出事件
    const previouslyHealthy = state.isHealthy
    if (previouslyHealthy !== isHealthy) {
      this.emit(MCP_EVENTS.SERVER_STATUS_CHANGED, {
        serverId,
        status: state.status,
        isHealthy: state.isHealthy,
        previousStatus: previouslyHealthy ? 'healthy' : 'unhealthy'
      })
    }
  }

  /**
   * 手动触发健康检查
   */
  async checkHealth(serverId: string): Promise<HealthCheckResult> {
    return this.performHealthCheck(serverId)
  }

  /**
   * 获取服务器健康状态
   */
  getHealthState(serverId: string): ServerHealthState | undefined {
    return this.healthStates.get(serverId)
  }

  /**
   * 获取所有服务器健康状态
   */
  getAllHealthStates(): Map<string, ServerHealthState> {
    return new Map(this.healthStates)
  }

  /**
   * 启用/禁用健康检查
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled

    if (enabled) {
      // 启动所有注册的客户端健康检查
      for (const serverId of this.clients.keys()) {
        this.startHealthCheck(serverId)
      }
    } else {
      // 停止所有健康检查
      for (const serverId of this.clients.keys()) {
        this.stopHealthCheck(serverId)
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // 如果启用且间隔时间改变，重启健康检查
    if (this.config.enabled && newConfig.interval) {
      for (const serverId of this.clients.keys()) {
        this.startHealthCheck(serverId)
      }
    }
  }

  /**
   * 获取健康检查统计信息
   */
  getHealthStats(): {
    totalServers: number
    healthyServers: number
    unhealthyServers: number
    averageResponseTime: number
    overallSuccessRate: number
  } {
    const states = Array.from(this.healthStates.values())
    const totalServers = states.length
    const healthyServers = states.filter(s => s.isHealthy).length
    const unhealthyServers = totalServers - healthyServers

    const totalChecks = states.reduce((sum, s) => sum + s.totalChecks, 0)
    const totalSuccesses = states.reduce((sum, s) => sum + s.successCount, 0)
    const totalResponseTime = states.reduce((sum, s) => sum + (s.averageResponseTime * s.totalChecks), 0)

    return {
      totalServers,
      healthyServers,
      unhealthyServers,
      averageResponseTime: totalChecks > 0 ? totalResponseTime / totalChecks : 0,
      overallSuccessRate: totalChecks > 0 ? totalSuccesses / totalChecks : 0
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 停止所有健康检查
    for (const serverId of this.clients.keys()) {
      this.stopHealthCheck(serverId)
    }

    // 清理所有状态
    this.clients.clear()
    this.healthStates.clear()
    this.checkIntervals.clear()

    // 移除所有监听器
    this.removeAllListeners()
  }
}