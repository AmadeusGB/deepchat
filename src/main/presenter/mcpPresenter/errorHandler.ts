/**
 * MCP错误处理器
 * 提供统一的错误处理、分类和重试机制
 */

import { EventEmitter } from 'events'

// 错误类型枚举
export enum MCPErrorType {
  // 连接相关错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',

  // 认证相关错误
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',

  // 协议相关错误
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_RESPONSE = 'INVALID_RESPONSE',

  // 工具相关错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',

  // 服务器相关错误
  SERVER_ERROR = 'SERVER_ERROR',
  SERVER_UNAVAILABLE = 'SERVER_UNAVAILABLE',
  SERVER_OVERLOADED = 'SERVER_OVERLOADED',

  // 资源相关错误
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // 配置相关错误
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误严重级别
export enum MCPErrorSeverity {
  LOW = 'low',        // 轻微错误，可以忽略或简单重试
  MEDIUM = 'medium',  // 中等错误，需要处理但不影响整体功能
  HIGH = 'high',      // 严重错误，影响功能但系统可继续运行
  CRITICAL = 'critical' // 致命错误，可能导致系统不可用
}

// 错误信息接口
export interface MCPError {
  type: MCPErrorType
  severity: MCPErrorSeverity
  message: string
  details?: Record<string, unknown>
  timestamp: number
  serverId?: string
  toolName?: string
  retryable: boolean
  originalError?: Error
}

// 重试配置接口
export interface RetryConfig {
  maxAttempts: number        // 最大重试次数
  baseDelay: number         // 基础延迟时间（毫秒）
  maxDelay: number          // 最大延迟时间（毫秒）
  backoffFactor: number     // 退避因子
  jitter: boolean           // 是否添加随机抖动
  retryableErrors: MCPErrorType[] // 可重试的错误类型
}

// 重试结果接口
export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: MCPError
  attempts: number
  totalTime: number
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: [
    MCPErrorType.CONNECTION_TIMEOUT,
    MCPErrorType.CONNECTION_FAILED,
    MCPErrorType.SERVER_UNAVAILABLE,
    MCPErrorType.SERVER_OVERLOADED,
    MCPErrorType.TOOL_TIMEOUT
  ]
}

/**
 * MCP错误处理器类
 */
export class MCPErrorHandler extends EventEmitter {
  private errorStats = new Map<MCPErrorType, number>()
  private retryConfig: RetryConfig

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    super()
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  /**
   * 分类和包装错误
   */
  classifyError(error: Error | unknown, context?: {
    serverId?: string
    toolName?: string
    operation?: string
  }): MCPError {
    const timestamp = Date.now()

    let mcpError: MCPError

    if (error instanceof Error) {
      // 根据错误信息和类型进行分类
      const errorMessage = error.message.toLowerCase()

      if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
        if (errorMessage.includes('timeout')) {
          mcpError = {
            type: MCPErrorType.CONNECTION_TIMEOUT,
            severity: MCPErrorSeverity.MEDIUM,
            message: `Connection timeout: ${error.message}`,
            retryable: true,
            originalError: error,
            timestamp
          }
        } else if (errorMessage.includes('refused') || errorMessage.includes('econnrefused')) {
          mcpError = {
            type: MCPErrorType.CONNECTION_REFUSED,
            severity: MCPErrorSeverity.HIGH,
            message: `Connection refused: ${error.message}`,
            retryable: true,
            originalError: error,
            timestamp
          }
        } else {
          mcpError = {
            type: MCPErrorType.CONNECTION_FAILED,
            severity: MCPErrorSeverity.HIGH,
            message: `Connection failed: ${error.message}`,
            retryable: true,
            originalError: error,
            timestamp
          }
        }
      } else if (errorMessage.includes('timeout')) {
        mcpError = {
          type: context?.toolName ? MCPErrorType.TOOL_TIMEOUT : MCPErrorType.CONNECTION_TIMEOUT,
          severity: MCPErrorSeverity.MEDIUM,
          message: `Operation timeout: ${error.message}`,
          retryable: true,
          originalError: error,
          timestamp
        }
      } else if (errorMessage.includes('not found')) {
        mcpError = {
          type: context?.toolName ? MCPErrorType.TOOL_NOT_FOUND : MCPErrorType.RESOURCE_NOT_FOUND,
          severity: MCPErrorSeverity.LOW,
          message: error.message,
          retryable: false,
          originalError: error,
          timestamp
        }
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
        mcpError = {
          type: MCPErrorType.AUTHORIZATION_FAILED,
          severity: MCPErrorSeverity.HIGH,
          message: `Authorization failed: ${error.message}`,
          retryable: false,
          originalError: error,
          timestamp
        }
      } else if (errorMessage.includes('server error') || errorMessage.includes('internal error')) {
        mcpError = {
          type: MCPErrorType.SERVER_ERROR,
          severity: MCPErrorSeverity.HIGH,
          message: `Server error: ${error.message}`,
          retryable: true,
          originalError: error,
          timestamp
        }
      } else {
        // 默认分类
        mcpError = {
          type: MCPErrorType.UNKNOWN_ERROR,
          severity: MCPErrorSeverity.MEDIUM,
          message: error.message,
          retryable: false,
          originalError: error,
          timestamp
        }
      }
    } else {
      // 非Error对象
      mcpError = {
        type: MCPErrorType.UNKNOWN_ERROR,
        severity: MCPErrorSeverity.MEDIUM,
        message: String(error),
        retryable: false,
        timestamp
      }
    }

    // 添加上下文信息
    if (context) {
      mcpError.serverId = context.serverId
      mcpError.toolName = context.toolName
      mcpError.details = { operation: context.operation }
    }

    // 更新错误统计
    this.updateErrorStats(mcpError.type)

    // 发出错误事件
    this.emit('error', mcpError)

    return mcpError
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: {
      serverId?: string
      toolName?: string
      operation?: string
    },
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.retryConfig, ...customConfig }
    const startTime = Date.now()
    let lastError: MCPError | undefined

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation()

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        }
      } catch (error) {
        const mcpError = this.classifyError(error, context)
        lastError = mcpError

        // 检查是否可重试
        if (!this.shouldRetry(mcpError, attempt, config)) {
          break
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config)
          await this.sleep(delay)
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
      totalTime: Date.now() - startTime
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: MCPError, attempt: number, config: RetryConfig): boolean {
    // 检查是否超过最大尝试次数
    if (attempt >= config.maxAttempts) {
      return false
    }

    // 检查错误是否可重试
    if (!error.retryable) {
      return false
    }

    // 检查错误类型是否在可重试列表中
    if (!config.retryableErrors.includes(error.type)) {
      return false
    }

    return true
  }

  /**
   * 计算重试延迟时间（指数退避 + 随机抖动）
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // 指数退避计算
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)

    // 应用最大延迟限制
    delay = Math.min(delay, config.maxDelay)

    // 添加随机抖动以避免雷群效应
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.floor(delay)
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 更新错误统计
   */
  private updateErrorStats(errorType: MCPErrorType): void {
    const current = this.errorStats.get(errorType) || 0
    this.errorStats.set(errorType, current + 1)
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): Map<MCPErrorType, number> {
    return new Map(this.errorStats)
  }

  /**
   * 重置错误统计
   */
  resetErrorStats(): void {
    this.errorStats.clear()
  }

  /**
   * 更新重试配置
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }

  /**
   * 获取当前重试配置
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig }
  }
}