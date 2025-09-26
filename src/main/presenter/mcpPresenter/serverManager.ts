import { IConfigPresenter } from '@shared/presenter'
import { McpClient } from './mcpClient'
import axios from 'axios'
import { proxyConfig } from '@/presenter/proxyConfig'
import { eventBus, SendTarget } from '@/eventbus'
import { NOTIFICATION_EVENTS } from '@/events'
import { MCP_EVENTS } from '@/events'
import { getErrorMessageLabels } from '@shared/i18n'
import { MCPErrorHandler, MCPErrorType, MCPErrorSeverity } from './errorHandler'
import { mcpConnectionPool } from './connectionPool'

const NPM_REGISTRY_LIST = [
  'https://registry.npmjs.org/',
  'https://r.cnpmjs.org/',
  'https://registry.npmmirror.com/'
]

export class ServerManager {
  private clients: Map<string, McpClient> = new Map()
  private configPresenter: IConfigPresenter
  private npmRegistry: string | null = null
  private errorHandler: MCPErrorHandler

  // 添加防抖机制
  private updateDebounceTimer: NodeJS.Timeout | null = null
  private readonly DEBOUNCE_DELAY = 100 // 100ms防抖延迟

  constructor(configPresenter: IConfigPresenter) {
    this.configPresenter = configPresenter
    this.errorHandler = new MCPErrorHandler({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    })

    // 监听错误事件
    this.errorHandler.on('error', (error) => {
      console.warn(`[MCP] Error occurred:`, error)
    })
  }

  // 防抖发送CLIENT_LIST_UPDATED事件
  private debouncedClientListUpdate(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
    }

    this.updateDebounceTimer = setTimeout(() => {
      eventBus.send(MCP_EVENTS.CLIENT_LIST_UPDATED, SendTarget.ALL_WINDOWS)
      this.updateDebounceTimer = null
    }, this.DEBOUNCE_DELAY)
  }

  // 测试npm registry速度并返回最佳选择
  async testNpmRegistrySpeed(): Promise<string> {
    const timeout = 5000
    const testPackage = 'tiny-runtime-injector'

    // 获取代理配置
    const proxyUrl = proxyConfig.getProxyUrl()
    const proxyOptions = proxyUrl
      ? { proxy: { host: new URL(proxyUrl).hostname, port: parseInt(new URL(proxyUrl).port) } }
      : {}

    const results = await Promise.all(
      NPM_REGISTRY_LIST.map(async (registry) => {
        const start = Date.now()
        let success = false
        let isTimeout = false
        let time = 0

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)

          const response = await axios.get(`${registry}${testPackage}`, {
            ...proxyOptions,
            signal: controller.signal
          })

          clearTimeout(timeoutId)
          success = response.status >= 200 && response.status < 300
          time = Date.now() - start
        } catch (error) {
          time = Date.now() - start
          isTimeout = (error instanceof Error && error.name === 'AbortError') || time >= timeout
        }

        return {
          registry,
          success,
          time,
          isTimeout
        }
      })
    )

    // 过滤出成功的请求，并按响应时间排序
    const successfulResults = results
      .filter((result) => result.success)
      .sort((a, b) => a.time - b.time)
    console.log('npm registry check results', successfulResults)

    // 如果所有请求都失败，返回默认的registry
    if (successfulResults.length === 0) {
      console.log('All npm registry tests failed, using default registry')
      return NPM_REGISTRY_LIST[0]
    }

    // 返回响应最快的registry
    this.npmRegistry = successfulResults[0].registry
    return this.npmRegistry
  }

  // 获取npm registry
  getNpmRegistry(): string | null {
    return this.npmRegistry
  }

  // 获取默认服务器名称列表
  async getDefaultServerNames(): Promise<string[]> {
    return this.configPresenter.getMcpDefaultServers()
  }

  // 获取默认服务器名称（兼容旧版本，返回第一个默认服务器）
  async getDefaultServerName(): Promise<string | null> {
    const defaultServers = await this.configPresenter.getMcpDefaultServers()
    const servers = await this.configPresenter.getMcpServers()

    // 如果没有默认服务器或者默认服务器不存在，返回 null
    if (defaultServers.length === 0 || !servers[defaultServers[0]]) {
      return null
    }

    return defaultServers[0]
  }

  // 获取默认客户端（不自动启动服务，仅返回第一个默认服务器客户端）
  async getDefaultClient(): Promise<McpClient | null> {
    const defaultServerName = await this.getDefaultServerName()

    if (!defaultServerName) {
      return null
    }

    // 返回已存在的客户端实例，无论是否运行
    return this.getClient(defaultServerName) || null
  }

  // 获取所有默认客户端
  async getDefaultClients(): Promise<McpClient[]> {
    const defaultServerNames = await this.getDefaultServerNames()
    const clients: McpClient[] = []

    for (const serverName of defaultServerNames) {
      const client = this.getClient(serverName)
      if (client) {
        clients.push(client)
      }
    }

    return clients
  }

  // 获取正在运行的客户端
  async getRunningClients(): Promise<McpClient[]> {
    const clients: McpClient[] = []
    for (const [name, client] of this.clients.entries()) {
      if (this.isServerRunning(name)) {
        clients.push(client)
      }
    }
    return clients
  }

  async startServer(name: string): Promise<void> {
    // 如果服务器已经在运行，则不需要再次启动
    if (this.clients.has(name)) {
      if (this.isServerRunning(name)) {
        console.info(`MCP server ${name} is already running`)
      } else {
        console.info(`MCP server ${name} is starting...`)
      }
      return
    }

    const servers = await this.configPresenter.getMcpServers()
    const serverConfig = servers[name]

    if (!serverConfig) {
      const error = this.errorHandler.classifyError(
        new Error(`MCP server ${name} not found`),
        { serverId: name, operation: 'startServer' }
      )
      throw error.originalError || new Error(error.message)
    }

    // 使用连接池获取或创建连接
    const result = await this.errorHandler.executeWithRetry(
      async () => {
        console.info(`Starting MCP server ${name} through connection pool...`)
        const npmRegistry = serverConfig.customNpmRegistry || this.npmRegistry

        // 通过连接池获取客户端
        const client = await mcpConnectionPool.getConnection(
          name,
          serverConfig as unknown as Record<string, unknown>,
          npmRegistry
        )

        // 保存客户端引用以兼容现有代码
        this.clients.set(name, client)

        console.info(`MCP server ${name} started successfully via connection pool`)
        return client
      },
      { serverId: name, operation: 'startServer' },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: [
          MCPErrorType.CONNECTION_FAILED,
          MCPErrorType.CONNECTION_TIMEOUT,
          MCPErrorType.SERVER_UNAVAILABLE
        ]
      }
    )

    if (!result.success) {
      // 移除客户端引用
      this.clients.delete(name)

      // 发送改进的错误通知
      this.sendMcpConnectionError(name, result.error!)

      throw result.error?.originalError || new Error(result.error?.message || 'Unknown error')
    } else {
      // 成功启动，发送客户端列表更新事件
      this.debouncedClientListUpdate()
    }
  }

  // 处理并发送MCP连接错误通知
  private sendMcpConnectionError(serverName: string, error: unknown): void {
    try {
      // 获取当前语言
      const locale = this.configPresenter.getLanguage?.() || 'zh-CN'
      const errorMessages = getErrorMessageLabels(locale)

      let errorMsg: string
      let errorType: string = 'error'

      // 处理新的MCPError类型或传统错误
      if (error && typeof error === 'object' && 'type' in error && 'severity' in error) {
        const mcpError = error as any // MCPError type
        errorMsg = mcpError.message

        // 根据错误严重级别设置通知类型
        switch (mcpError.severity) {
          case MCPErrorSeverity.LOW:
            errorType = 'warning'
            break
          case MCPErrorSeverity.CRITICAL:
            errorType = 'critical'
            break
          default:
            errorType = 'error'
        }
      } else {
        errorMsg = error instanceof Error ? error.message : '未知错误'
      }

      const formattedMessage = `${serverName}: ${errorMsg}`

      // 发送全局错误通知
      eventBus.sendToRenderer(NOTIFICATION_EVENTS.SHOW_ERROR, SendTarget.ALL_WINDOWS, {
        title: errorMessages.mcpConnectionErrorTitle,
        message: formattedMessage,
        id: `mcp-error-${serverName}-${Date.now()}`,
        type: errorType
      })
    } catch (notifyError) {
      console.error('Failed to send MCP error notification:', notifyError)
    }
  }

  async stopServer(name: string): Promise<void> {
    const client = this.clients.get(name)

    if (!client) {
      return
    }

    try {
      // 获取服务器配置用于连接池操作
      const servers = await this.configPresenter.getMcpServers()
      const serverConfig = servers[name]

      if (serverConfig) {
        // 释放连接回连接池而不是直接断开
        mcpConnectionPool.releaseConnection(name, client)
        console.info(`MCP server ${name} connection released to pool`)
      } else {
        // 如果没有配置，直接断开连接
        await client.disconnect()
        console.info(`MCP server ${name} has been stopped (direct disconnect)`)
      }

      // 从客户端列表中移除
      this.clients.delete(name)

      this.debouncedClientListUpdate()
    } catch (error) {
      console.error(`Failed to stop MCP server ${name}:`, error)
      throw error
    }
  }

  isServerRunning(name: string): boolean {
    const client = this.clients.get(name)
    if (!client) {
      return false
    }
    return client.isServerRunning()
  }

  /**
   * 获取客户端实例
   */
  getClient(name: string): McpClient | undefined {
    return this.clients.get(name)
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): Map<string, number> {
    const stats = this.errorHandler.getErrorStats()
    const result = new Map<string, number>()
    stats.forEach((count, errorType) => {
      result.set(errorType, count)
    })
    return result
  }

  /**
   * 重置错误统计
   */
  resetErrorStats(): void {
    this.errorHandler.resetErrorStats()
  }

  /**
   * 获取错误处理器实例（用于测试或高级配置）
   */
  getErrorHandler(): MCPErrorHandler {
    return this.errorHandler
  }

  /**
   * 获取连接池统计信息
   */
  getConnectionPoolStats(): any {
    return mcpConnectionPool.getStats()
  }


  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    // 清理防抖定时器
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
      this.updateDebounceTimer = null
    }

    // 清理连接池
    try {
      await mcpConnectionPool.destroy()
      console.info('Connection pool destroyed')
    } catch (error) {
      console.error('Failed to destroy connection pool:', error)
    }

    // 清理错误处理器
    this.errorHandler.removeAllListeners()
    this.errorHandler.resetErrorStats()

    // 清理客户端引用
    this.clients.clear()
  }
}
