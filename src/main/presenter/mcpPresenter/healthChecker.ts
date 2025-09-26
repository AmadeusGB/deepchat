// MCP服务器健康检查系统
// 提供定期健康检查、错误恢复和状态监控功能

import { EventEmitter } from 'events'
import { MCP_EVENTS } from '../../events'
import { McpClient } from './mcpClient'
import { MCPErrorHandler, MCPErrorType } from './errorHandler'
import { eventBus, SendTarget } from '@/eventbus'
import { NOTIFICATION_EVENTS } from '@/events'
import { mcpEventOptimizer } from './eventOptimizer'

export interface SystemMetrics {
  cpuUsage: number // 0-100
  memoryUsage: {
    used: number // MB
    total: number // MB
    percentage: number // 0-100
  }
  processMetrics: {
    uptime: number // seconds
    pid: number
    heapUsed: number // MB
    heapTotal: number // MB
  }
  connectionMetrics: {
    activeConnections: number
    totalConnections: number
    poolUtilization: number // 0-100
  }
}

export interface HealthCheckResult {
  serverId: string
  healthy: boolean
  timestamp: number
  responseTime: number
  error?: string
  systemMetrics?: SystemMetrics
  metadata?: {
    toolsCount?: number
    resourcesCount?: number
    promptsCount?: number
    lastSuccessfulCheck?: number
    errorRate?: number
    memoryLeakIndicators?: boolean
  }
}

export interface HealthCheckConfig {
  interval: number // 检查间隔（毫秒）
  timeout: number // 超时时间（毫秒）
  retryAttempts: number // 重试次数
  retryDelay: number // 重试延迟（毫秒）
  enabled: boolean // 是否启用健康检查
  systemMonitoring: boolean // 是否启用系统监控
  alerting: boolean // 是否启用告警
  thresholds: {
    responseTime: number // 响应时间阈值（毫秒）
    successRate: number // 成功率阈值（0-1）
    memoryUsage: number // 内存使用率阈值（0-100）
    cpuUsage: number // CPU使用率阈值（0-100）
    errorRate: number // 错误率阈值（0-1）
    consecutiveFailures: number // 连续失败阈值
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
  private clients = new Map<string, McpClient>()
  private healthStates = new Map<string, ServerHealthState>()
  private checkIntervals = new Map<string, NodeJS.Timeout>()
  private config: HealthCheckConfig
  private errorHandler: MCPErrorHandler
  private systemMetricsCache: SystemMetrics | null = null
  private lastSystemMetricsUpdate = 0
  private readonly SYSTEM_METRICS_CACHE_TTL = 5000 // 5秒缓存

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super()

    this.config = {
      interval: 30000, // 30秒
      timeout: 5000, // 5秒
      retryAttempts: 3,
      retryDelay: 1000, // 1秒
      enabled: true,
      systemMonitoring: true,
      alerting: true,
      thresholds: {
        responseTime: 3000, // 3秒
        successRate: 0.8, // 80%
        memoryUsage: 85, // 85%
        cpuUsage: 80, // 80%
        errorRate: 0.2, // 20%
        consecutiveFailures: 3
      },
      ...config
    }

    // 初始化错误处理器
    this.errorHandler = new MCPErrorHandler({
      maxAttempts: this.config.retryAttempts,
      baseDelay: this.config.retryDelay,
      retryableErrors: [MCPErrorType.CONNECTION_TIMEOUT, MCPErrorType.CONNECTION_FAILED]
    })

    // 监听错误事件
    this.errorHandler.on('error', (error) => {
      console.warn(`[HealthChecker] Error occurred:`, error)
    })
  }

  /**
   * 注册MCP客户端进行健康检查
   */
  registerClient(serverId: string, client: McpClient): void {
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

    // 使用优化的事件发送
    mcpEventOptimizer.optimizedEmit(MCP_EVENTS.SERVER_HEALTH_CHECK, result)
    this.emit(MCP_EVENTS.SERVER_HEALTH_CHECK, result)

    return result
  }

  /**
   * 带重试机制的健康检查执行
   */
  private async executeHealthCheckWithRetry(
    serverId: string,
    client: McpClient,
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
  private async performBasicHealthCheck(client: McpClient): Promise<any> {
    try {
      // 尝试获取工具列表作为健康检查
      const toolsResult = await client.listTools()

      // 可选：获取其他信息
      const [resourcesResult, promptsResult] = await Promise.allSettled([
        client.listResources?.() || Promise.resolve({ resources: [] }),
        client.listPrompts?.() || Promise.resolve({ prompts: [] })
      ])

      return {
        toolsCount: toolsResult?.length || 0,
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
      const statusData = {
        serverId,
        status: state.status,
        isHealthy: state.isHealthy,
        previousStatus: previouslyHealthy ? 'healthy' : 'unhealthy'
      }

      // 使用优化的事件发送
      mcpEventOptimizer.optimizedEmit(MCP_EVENTS.SERVER_STATUS_CHANGED, statusData)
      this.emit(MCP_EVENTS.SERVER_STATUS_CHANGED, statusData)
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
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const now = Date.now()

    // 使用缓存以避免频繁计算
    if (this.systemMetricsCache && (now - this.lastSystemMetricsUpdate) < this.SYSTEM_METRICS_CACHE_TTL) {
      return this.systemMetricsCache
    }

    const memUsage = process.memoryUsage()
    const cpuUsage = await this.getCPUUsage()

    // 获取连接池统计信息（需要从 connectionPool 模块获取）
    const connectionMetrics = this.getConnectionMetrics()

    const metrics: SystemMetrics = {
      cpuUsage,
      memoryUsage: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      processMetrics: {
        uptime: Math.round(process.uptime()),
        pid: process.pid,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      connectionMetrics
    }

    this.systemMetricsCache = metrics
    this.lastSystemMetricsUpdate = now

    return metrics
  }

  /**
   * 获取CPU使用率（简化版本）
   */
  private async getCPUUsage(): Promise<number> {
    // 简化的CPU使用率计算 - 在生产环境中可能需要更复杂的实现
    const startUsage = process.cpuUsage()

    // 等待一小段时间来计算CPU使用率
    await new Promise(resolve => setTimeout(resolve, 100))

    const endUsage = process.cpuUsage(startUsage)
    const totalUsage = endUsage.user + endUsage.system

    // 转换为百分比（粗略估计）
    return Math.min(Math.round(totalUsage / 1000), 100) // 限制在0-100之间
  }

  /**
   * 获取连接指标
   */
  private getConnectionMetrics(): SystemMetrics['connectionMetrics'] {
    // 这里应该从连接池获取真实数据，暂时使用模拟数据
    const totalConnections = this.clients.size
    const activeConnections = Array.from(this.healthStates.values()).filter(s => s.isHealthy).length

    return {
      activeConnections,
      totalConnections,
      poolUtilization: totalConnections > 0 ? Math.round((activeConnections / totalConnections) * 100) : 0
    }
  }

  /**
   * 检查阈值并发送告警
   */
  private async checkThresholdsAndAlert(serverId: string, result: HealthCheckResult): Promise<void> {
    if (!this.config.alerting) return

    const healthState = this.healthStates.get(serverId)
    if (!healthState) return

    const alerts: string[] = []

    // 检查响应时间阈值
    if (result.responseTime > this.config.thresholds.responseTime) {
      alerts.push(`响应时间过长: ${result.responseTime}ms (阈值: ${this.config.thresholds.responseTime}ms)`)
    }

    // 检查成功率阈值
    const successRate = healthState.totalChecks > 0 ? healthState.successCount / healthState.totalChecks : 1
    if (successRate < this.config.thresholds.successRate) {
      alerts.push(`成功率过低: ${Math.round(successRate * 100)}% (阈值: ${Math.round(this.config.thresholds.successRate * 100)}%)`)
    }

    // 检查连续失败次数
    if (healthState.consecutiveFailures >= this.config.thresholds.consecutiveFailures) {
      alerts.push(`连续失败次数达到阈值: ${healthState.consecutiveFailures}`)
    }

    // 检查系统指标
    if (result.systemMetrics) {
      const { memoryUsage, cpuUsage } = result.systemMetrics

      if (memoryUsage.percentage > this.config.thresholds.memoryUsage) {
        alerts.push(`内存使用率过高: ${memoryUsage.percentage}% (阈值: ${this.config.thresholds.memoryUsage}%)`)
      }

      if (cpuUsage > this.config.thresholds.cpuUsage) {
        alerts.push(`CPU使用率过高: ${cpuUsage}% (阈值: ${this.config.thresholds.cpuUsage}%)`)
      }
    }

    // 发送告警通知
    if (alerts.length > 0) {
      this.sendAlert(serverId, alerts, result.healthy ? 'warning' : 'error')
    }
  }

  /**
   * 发送告警通知
   */
  private sendAlert(serverId: string, alerts: string[], severity: 'warning' | 'error'): void {
    const alertMessage = `MCP服务器 ${serverId} 健康检查告警:\n${alerts.join('\n')}`

    // 发送到事件总线
    eventBus.sendToRenderer(NOTIFICATION_EVENTS.SHOW_ERROR, SendTarget.ALL_WINDOWS, {
      title: `MCP健康检查告警 - ${serverId}`,
      message: alertMessage,
      id: `mcp-health-alert-${serverId}-${Date.now()}`,
      type: severity
    })

    // 发出自定义告警事件
    this.emit('alert', {
      serverId,
      alerts,
      severity,
      timestamp: Date.now()
    })

    console.warn(`[HealthChecker] Alert for ${serverId}:`, alerts)
  }

  /**
   * 增强版的健康检查执行（集成系统监控）
   */
  async performEnhancedHealthCheck(serverId: string): Promise<HealthCheckResult> {
    const baseResult = await this.performHealthCheck(serverId)

    // 如果启用了系统监控，添加系统指标
    if (this.config.systemMonitoring) {
      try {
        const systemMetrics = await this.collectSystemMetrics()
        baseResult.systemMetrics = systemMetrics

        // 检查内存泄漏指标
        if (baseResult.metadata) {
          baseResult.metadata.memoryLeakIndicators = this.detectMemoryLeakIndicators(systemMetrics)
        }
      } catch (error) {
        console.warn(`[HealthChecker] Failed to collect system metrics:`, error)
      }
    }

    // 检查阈值并发送告警
    await this.checkThresholdsAndAlert(serverId, baseResult)

    return baseResult
  }

  /**
   * 检测内存泄漏指标
   */
  private detectMemoryLeakIndicators(metrics: SystemMetrics): boolean {
    // 简单的内存泄漏检测：内存使用率持续增长且超过阈值
    const memoryThreshold = 90 // 90%
    const uptimeThreshold = 3600 // 1小时

    return metrics.memoryUsage.percentage > memoryThreshold &&
           metrics.processMetrics.uptime > uptimeThreshold
  }

  /**
   * 获取详细的健康报告
   */
  getDetailedHealthReport(): {
    summary: {
      totalServers: number
      healthyServers: number
      unhealthyServers: number
      averageResponseTime: number
      overallSuccessRate: number
    }
    systemMetrics?: SystemMetrics
    serverDetails: Array<{
      serverId: string
      status: ServerHealthState['status']
      health: ServerHealthState
      recentAlerts?: number
    }>
  } {
    const summary = this.getHealthStats()
    const serverDetails = Array.from(this.healthStates.entries()).map(([serverId, health]) => ({
      serverId,
      status: health.status,
      health,
      recentAlerts: 0 // 可以扩展以跟踪最近的告警次数
    }))

    const report: any = {
      summary,
      serverDetails
    }

    // 添加系统指标（如果有缓存的话）
    if (this.config.systemMonitoring && this.systemMetricsCache) {
      report.systemMetrics = this.systemMetricsCache
    }

    return report
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

    // 清理错误处理器
    this.errorHandler.removeAllListeners()
    this.errorHandler.resetErrorStats()

    // 清理系统指标缓存
    this.systemMetricsCache = null

    // 移除所有监听器
    this.removeAllListeners()

    console.log('[HealthChecker] Health checker destroyed')
  }
}