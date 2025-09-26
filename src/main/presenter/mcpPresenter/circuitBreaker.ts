/**
 * MCP服务熔断器
 * 实现服务降级和故障隔离，防止级联故障
 */

import { EventEmitter } from 'events'
import { MCPErrorType } from './errorHandler'

export enum CircuitBreakerState {
  CLOSED = 'closed',     // 正常状态，允许请求通过
  OPEN = 'open',         // 熔断状态，拒绝请求
  HALF_OPEN = 'half_open' // 半开状态，允许少量请求测试服务
}

export interface CircuitBreakerConfig {
  failureThreshold: number // 失败阈值
  successThreshold: number // 成功阈值（半开状态恢复需要的成功次数）
  timeout: number // 熔断超时时间（ms）
  monitoringWindow: number // 监控窗口时间（ms）
  degradationEnabled: boolean // 是否启用服务降级
  errorTypes: MCPErrorType[] // 触发熔断的错误类型
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
  stateChangeTime: number
}

export interface DegradedResponse {
  isDegraded: true
  message: string
  fallbackData?: any
  reason: string
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // 5次失败后熔断
  successThreshold: 3, // 半开状态需要3次成功恢复
  timeout: 60 * 1000, // 1分钟后尝试恢复
  monitoringWindow: 5 * 60 * 1000, // 5分钟监控窗口
  degradationEnabled: true,
  errorTypes: [
    MCPErrorType.CONNECTION_FAILED,
    MCPErrorType.CONNECTION_TIMEOUT,
    MCPErrorType.SERVER_UNAVAILABLE,
    MCPErrorType.TOOL_EXECUTION_FAILED
  ]
}

/**
 * 单个服务的熔断器
 */
export class ServiceCircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private lastSuccessTime: number | null = null
  private totalRequests = 0
  private totalFailures = 0
  private totalSuccesses = 0
  private stateChangeTime = Date.now()
  private config: CircuitBreakerConfig
  private recentRequests: Array<{ timestamp: number; success: boolean }> = []

  constructor(
    private readonly serviceName: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 执行请求（带熔断保护）
   */
  async execute<T>(operation: () => Promise<T>): Promise<T | DegradedResponse> {
    // 检查是否应该拒绝请求
    if (this.shouldRejectRequest()) {
      return this.createDegradedResponse('服务熔断中')
    }

    this.totalRequests++
    const startTime = Date.now()

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)

      // 如果启用了服务降级，返回降级响应而不是抛出错误
      if (this.config.degradationEnabled && this.shouldDegrade(error)) {
        return this.createDegradedResponse('服务暂时不可用', error)
      }

      throw error
    } finally {
      this.recordRequest(Date.now() - startTime)
    }
  }

  /**
   * 检查是否应该拒绝请求
   */
  private shouldRejectRequest(): boolean {
    switch (this.state) {
      case CircuitBreakerState.OPEN:
        // 检查是否可以转换到半开状态
        if (this.canTransitionToHalfOpen()) {
          this.transitionToHalfOpen()
          return false
        }
        return true

      case CircuitBreakerState.HALF_OPEN:
        // 半开状态只允许有限的请求通过
        return false

      case CircuitBreakerState.CLOSED:
      default:
        return false
    }
  }

  /**
   * 处理成功的请求
   */
  private onSuccess(): void {
    this.totalSuccesses++
    this.lastSuccessTime = Date.now()
    this.cleanupOldRequests()

    switch (this.state) {
      case CircuitBreakerState.HALF_OPEN:
        this.successCount++
        if (this.successCount >= this.config.successThreshold) {
          this.transitionToClosed()
        }
        break

      case CircuitBreakerState.CLOSED:
        // 重置失败计数
        this.failureCount = 0
        break
    }

    this.emit('success', {
      serviceName: this.serviceName,
      state: this.state,
      stats: this.getStats()
    })
  }

  /**
   * 处理失败的请求
   */
  private onFailure(error: unknown): void {
    this.totalFailures++
    this.lastFailureTime = Date.now()
    this.cleanupOldRequests()

    // 只有特定类型的错误才触发熔断
    if (!this.isCircuitBreakerError(error)) {
      return
    }

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        this.failureCount++
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionToOpen()
        }
        break

      case CircuitBreakerState.HALF_OPEN:
        this.transitionToOpen()
        break
    }

    this.emit('failure', {
      serviceName: this.serviceName,
      state: this.state,
      error,
      stats: this.getStats()
    })
  }

  /**
   * 判断错误是否触发熔断
   */
  private isCircuitBreakerError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'type' in error) {
      const errorType = (error as any).type as MCPErrorType
      return this.config.errorTypes.includes(errorType)
    }
    return false
  }

  /**
   * 判断是否应该降级
   */
  private shouldDegrade(error: unknown): boolean {
    return this.state === CircuitBreakerState.OPEN || this.isCircuitBreakerError(error)
  }

  /**
   * 创建降级响应
   */
  private createDegradedResponse(message: string, error?: unknown): DegradedResponse {
    return {
      isDegraded: true,
      message,
      fallbackData: this.getFallbackData(),
      reason: error ? `${message}: ${error}` : message
    }
  }

  /**
   * 获取降级数据
   */
  private getFallbackData(): any {
    switch (this.serviceName) {
      case 'tools':
        return [] // 空工具列表
      case 'prompts':
        return [] // 空提示列表
      case 'resources':
        return [] // 空资源列表
      default:
        return null
    }
  }

  /**
   * 状态转换方法
   */
  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.stateChangeTime = Date.now()

    console.log(`🔧 [熔断器] ${this.serviceName} 恢复正常状态`)
    this.emit('stateChange', {
      serviceName: this.serviceName,
      newState: this.state,
      oldState: CircuitBreakerState.HALF_OPEN
    })
  }

  private transitionToOpen(): void {
    const oldState = this.state
    this.state = CircuitBreakerState.OPEN
    this.stateChangeTime = Date.now()

    console.warn(`🔧 [熔断器] ${this.serviceName} 进入熔断状态`)
    this.emit('stateChange', {
      serviceName: this.serviceName,
      newState: this.state,
      oldState
    })
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN
    this.successCount = 0
    this.stateChangeTime = Date.now()

    console.log(`🔧 [熔断器] ${this.serviceName} 进入半开状态`)
    this.emit('stateChange', {
      serviceName: this.serviceName,
      newState: this.state,
      oldState: CircuitBreakerState.OPEN
    })
  }

  /**
   * 检查是否可以转换到半开状态
   */
  private canTransitionToHalfOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN &&
           Date.now() - this.stateChangeTime >= this.config.timeout
  }

  /**
   * 记录请求
   */
  private recordRequest(responseTime: number): void {
    this.recentRequests.push({
      timestamp: Date.now(),
      success: responseTime >= 0 // 简化的成功判断
    })
  }

  /**
   * 清理过期的请求记录
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.monitoringWindow
    this.recentRequests = this.recentRequests.filter(req => req.timestamp > cutoff)
  }

  /**
   * 获取统计信息
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      stateChangeTime: this.stateChangeTime
    }
  }

  /**
   * 手动重置熔断器
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.totalRequests = 0
    this.totalFailures = 0
    this.totalSuccesses = 0
    this.lastFailureTime = null
    this.lastSuccessTime = null
    this.stateChangeTime = Date.now()
    this.recentRequests = []

    console.log(`🔧 [熔断器] ${this.serviceName} 已重置`)
    this.emit('reset', { serviceName: this.serviceName })
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', {
      serviceName: this.serviceName,
      config: this.config
    })
  }
}

/**
 * MCP熔断器管理器
 */
export class MCPCircuitBreakerManager extends EventEmitter {
  private circuitBreakers = new Map<string, ServiceCircuitBreaker>()
  private globalConfig: Partial<CircuitBreakerConfig>

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super()
    this.globalConfig = config
  }

  /**
   * 获取或创建服务熔断器
   */
  getCircuitBreaker(serviceName: string): ServiceCircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new ServiceCircuitBreaker(serviceName, this.globalConfig)

      // 转发事件
      circuitBreaker.on('stateChange', (event) => this.emit('stateChange', event))
      circuitBreaker.on('failure', (event) => this.emit('failure', event))
      circuitBreaker.on('success', (event) => this.emit('success', event))

      this.circuitBreakers.set(serviceName, circuitBreaker)
    }

    return this.circuitBreakers.get(serviceName)!
  }

  /**
   * 执行带熔断保护的操作
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T | DegradedResponse> {
    const circuitBreaker = this.getCircuitBreaker(serviceName)
    return circuitBreaker.execute(operation)
  }

  /**
   * 获取所有熔断器统计
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>()

    for (const [serviceName, circuitBreaker] of this.circuitBreakers.entries()) {
      stats.set(serviceName, circuitBreaker.getStats())
    }

    return stats
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset()
    }
    console.log('🔧 [熔断器管理器] 所有熔断器已重置')
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(config: Partial<CircuitBreakerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config }

    // 更新所有现有熔断器的配置
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.updateConfig(config)
    }

    this.emit('globalConfigUpdated', this.globalConfig)
  }

  /**
   * 检查是否有熔断的服务
   */
  hasCircuitBreakerOpen(): boolean {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      if (circuitBreaker.getStats().state === CircuitBreakerState.OPEN) {
        return true
      }
    }
    return false
  }

  /**
   * 获取熔断的服务列表
   */
  getOpenCircuitBreakers(): string[] {
    const openServices: string[] = []

    for (const [serviceName, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.getStats().state === CircuitBreakerState.OPEN) {
        openServices.push(serviceName)
      }
    }

    return openServices
  }

  /**
   * 销毁所有熔断器
   */
  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.removeAllListeners()
    }

    this.circuitBreakers.clear()
    this.removeAllListeners()
    console.log('🔧 [熔断器管理器] 已销毁')
  }
}

// 单例熔断器管理器
export const mcpCircuitBreakerManager = new MCPCircuitBreakerManager()