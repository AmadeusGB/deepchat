import { McpClient } from './mcpClient'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'
import { mcpEventOptimizer } from './eventOptimizer'
import { MCPErrorHandler, MCPErrorType } from './errorHandler'

interface PooledConnection {
  client: McpClient
  lastUsed: Date
  createdAt: Date
  isActive: boolean
  useCount: number
  serverConfig: Record<string, unknown>
  connectionHash: string
  healthCheckFailures: number
}

interface ConnectionPoolConfig {
  maxConnections: number
  maxIdleTime: number // ms
  cleanupInterval: number // ms
  maxUseCount: number
  healthCheckInterval: number // ms
  maxHealthCheckFailures: number
  connectionShareEnabled: boolean
  cacheTTL: number // ms
  connectionTimeoutMs: number
  memoryMonitoringEnabled: boolean
}

export class MCPConnectionPool {
  private pools: Map<string, PooledConnection[]> = new Map()
  private config: ConnectionPoolConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private healthCheckTimer: NodeJS.Timeout | null = null
  private errorHandler: MCPErrorHandler
  private connectionHashes: Map<string, PooledConnection> = new Map()

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxConnections: 5,
      maxIdleTime: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 2 * 60 * 1000, // 2分钟
      maxUseCount: 100,
      healthCheckInterval: 30 * 1000, // 30秒
      maxHealthCheckFailures: 3,
      connectionShareEnabled: true,
      cacheTTL: 10 * 60 * 1000, // 10分钟
      connectionTimeoutMs: 30 * 1000, // 30秒
      memoryMonitoringEnabled: true,
      ...config
    }

    this.errorHandler = new MCPErrorHandler({
      maxAttempts: 2,
      baseDelay: 1000,
      retryableErrors: [MCPErrorType.CONNECTION_TIMEOUT, MCPErrorType.CONNECTION_FAILED]
    })

    this.startCleanupTimer()
    this.startHealthCheckTimer()
  }

  /**
   * 获取或创建连接
   */
  async getConnection(serverName: string, serverConfig: Record<string, unknown>, npmRegistry?: string | null): Promise<McpClient> {
    const connectionHash = this.generateConnectionHash(serverName, serverConfig)

    // 如果启用连接共享，尝试查找相同配置的连接
    if (this.config.connectionShareEnabled) {
      const sharedConnection = this.connectionHashes.get(connectionHash)
      if (sharedConnection && !sharedConnection.isActive && this.isConnectionValid(sharedConnection)) {
        sharedConnection.isActive = true
        sharedConnection.lastUsed = new Date()
        sharedConnection.useCount++
        console.log(`🔗 [连接池] 共享连接: ${serverName}, 使用次数: ${sharedConnection.useCount}`)
        return sharedConnection.client
      }
    }

    const poolKey = this.getPoolKey(serverName)
    let pool = this.pools.get(poolKey)

    if (!pool) {
      pool = []
      this.pools.set(poolKey, pool)
    }

    // 查找可用的连接
    const availableConnection = pool.find(conn =>
      !conn.isActive &&
      conn.useCount < this.config.maxUseCount &&
      conn.healthCheckFailures < this.config.maxHealthCheckFailures &&
      this.isConnectionValid(conn)
    )

    if (availableConnection) {
      availableConnection.isActive = true
      availableConnection.lastUsed = new Date()
      availableConnection.useCount++
      console.log(`🔗 [连接池] 复用连接: ${serverName}, 使用次数: ${availableConnection.useCount}`)
      return availableConnection.client
    }

    // 如果连接池已满，清理最旧的连接
    if (pool.length >= this.config.maxConnections) {
      await this.cleanupOldestConnection(pool)
    }

    // 使用错误处理器创建新连接
    const result = await this.errorHandler.executeWithRetry(
      async () => {
        const newClient = new McpClient(serverName, serverConfig, npmRegistry)
        await newClient.connect()
        return newClient
      },
      { serverId: serverName, operation: 'createConnection' }
    )

    if (!result.success) {
      throw result.error?.originalError || new Error(`Failed to create connection for ${serverName}`)
    }

    const newClient = result.result!
    const now = new Date()
    const pooledConnection: PooledConnection = {
      client: newClient,
      lastUsed: now,
      createdAt: now,
      isActive: true,
      useCount: 1,
      serverConfig,
      connectionHash,
      healthCheckFailures: 0
    }

    pool.push(pooledConnection)
    this.connectionHashes.set(connectionHash, pooledConnection)

    console.log(`🔗 [连接池] 创建新连接: ${serverName}, 池大小: ${pool.length}`)

    const poolStats = {
      serverName,
      poolSize: pool.length,
      activeConnections: pool.filter(c => c.isActive).length,
      memoryUsage: this.config.memoryMonitoringEnabled ? this.getMemoryUsage() : undefined
    }

    // 使用优化的事件发送
    mcpEventOptimizer.optimizedEmit(MCP_EVENTS.CONNECTION_POOL_STATS, poolStats)
    eventBus.emit(MCP_EVENTS.CONNECTION_POOL_STATS, poolStats)

    return newClient
  }

  /**
   * 释放连接
   */
  releaseConnection(serverName: string, client: McpClient): void {
    const poolKey = this.getPoolKey(serverName)
    const pool = this.pools.get(poolKey)

    if (pool) {
      const connection = pool.find(conn => conn.client === client)
      if (connection) {
        connection.isActive = false
        connection.lastUsed = new Date()
        console.log(`🔗 [连接池] 释放连接: ${serverName}`)
      }
    }
  }

  /**
   * 关闭服务器的所有连接
   */
  async closeServerConnections(serverName: string): Promise<void> {
    const poolKey = this.getPoolKey(serverName)
    const pool = this.pools.get(poolKey)

    if (pool) {
      console.log(`🔗 [连接池] 关闭服务器所有连接: ${serverName}, 数量: ${pool.length}`)

      await Promise.all(
        pool.map(async (conn) => {
          try {
            await conn.client.disconnect()
          } catch (error) {
            console.error(`🔗 [连接池] 关闭连接失败: ${serverName}`, error)
          }
        })
      )

      this.pools.delete(poolKey)
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStats(): Record<string, { poolSize: number; activeConnections: number; totalUseCount: number }> {
    const stats: Record<string, any> = {}

    for (const [poolKey, pool] of this.pools.entries()) {
      stats[poolKey] = {
        poolSize: pool.length,
        activeConnections: pool.filter(c => c.isActive).length,
        totalUseCount: pool.reduce((sum, c) => sum + c.useCount, 0)
      }
    }

    return stats
  }

  /**
   * 清理过期连接
   */
  private async cleanupExpiredConnections(): Promise<void> {
    const now = new Date()
    const expiredConnections: Array<{ poolKey: string; connection: PooledConnection }> = []

    for (const [poolKey, pool] of this.pools.entries()) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const connection = pool[i]
        const timeSinceLastUse = now.getTime() - connection.lastUsed.getTime()

        if (
          !connection.isActive &&
          (timeSinceLastUse > this.config.maxIdleTime ||
           connection.useCount >= this.config.maxUseCount)
        ) {
          expiredConnections.push({ poolKey, connection })
          pool.splice(i, 1)
        }
      }

      // 如果池为空，删除池
      if (pool.length === 0) {
        this.pools.delete(poolKey)
      }
    }

    // 关闭过期连接
    await Promise.all(
      expiredConnections.map(async ({ connection }) => {
        try {
          await connection.client.disconnect()
          console.log(`🔗 [连接池] 清理过期连接: 使用次数 ${connection.useCount}`)
        } catch (error) {
          console.error('🔗 [连接池] 清理连接失败:', error)
        }
      })
    )

    if (expiredConnections.length > 0) {
      console.log(`🔗 [连接池] 清理了 ${expiredConnections.length} 个过期连接`)
    }
  }

  private async cleanupOldestConnection(pool: PooledConnection[]): Promise<void> {
    const inactiveConnections = pool.filter(c => !c.isActive)
    if (inactiveConnections.length === 0) return

    // 找到最旧的非活跃连接
    const oldestConnection = inactiveConnections.reduce((oldest, current) =>
      current.lastUsed < oldest.lastUsed ? current : oldest
    )

    const index = pool.indexOf(oldestConnection)
    if (index !== -1) {
      pool.splice(index, 1)
      try {
        await oldestConnection.client.disconnect()
        console.log('🔗 [连接池] 清理最旧连接以腾出空间')
      } catch (error) {
        console.error('🔗 [连接池] 清理最旧连接失败:', error)
      }
    }
  }

  private isConnectionValid(connection: PooledConnection): boolean {
    // 检查连接是否仍然有效
    const timeSinceLastUse = new Date().getTime() - connection.lastUsed.getTime()
    return timeSinceLastUse < this.config.maxIdleTime
  }

  private getPoolKey(serverName: string): string {
    return `pool_${serverName}`
  }

  /**
   * 生成连接哈希用于连接共享
   */
  private generateConnectionHash(serverName: string, serverConfig: Record<string, unknown>): string {
    const configKey = JSON.stringify({
      type: serverConfig.type,
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env
    })

    return Buffer.from(`${serverName}:${configKey}`).toString('base64').slice(0, 32)
  }

  /**
   * 健康检查定时器
   */
  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks()
    }, this.config.healthCheckInterval)
  }

  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = []

    for (const pool of this.pools.values()) {
      for (const connection of pool) {
        if (!connection.isActive) {
          healthCheckPromises.push(this.checkConnectionHealth(connection))
        }
      }
    }

    await Promise.allSettled(healthCheckPromises)
  }

  /**
   * 检查单个连接的健康状态
   */
  private async checkConnectionHealth(connection: PooledConnection): Promise<void> {
    try {
      // 简单的健康检查 - 验证客户端是否仍然运行
      const isHealthy = connection.client.isServerRunning()

      if (!isHealthy) {
        connection.healthCheckFailures++
        console.log(`🔗 [连接池] 健康检查失败: ${connection.client.serverName}, 失败次数: ${connection.healthCheckFailures}`)

        if (connection.healthCheckFailures >= this.config.maxHealthCheckFailures) {
          await this.removeUnhealthyConnection(connection)
        }
      } else {
        // 重置失败计数
        connection.healthCheckFailures = 0
      }
    } catch (error) {
      connection.healthCheckFailures++
      console.warn(`🔗 [连接池] 健康检查异常: ${connection.client.serverName}`, error)
    }
  }

  /**
   * 移除不健康的连接
   */
  private async removeUnhealthyConnection(connection: PooledConnection): Promise<void> {
    // 从池中移除
    for (const [poolKey, pool] of this.pools.entries()) {
      const index = pool.indexOf(connection)
      if (index !== -1) {
        pool.splice(index, 1)
        if (pool.length === 0) {
          this.pools.delete(poolKey)
        }
        break
      }
    }

    // 从共享连接映射中移除
    this.connectionHashes.delete(connection.connectionHash)

    // 断开连接
    try {
      await connection.client.disconnect()
      console.log(`🔗 [连接池] 移除不健康连接: ${connection.client.serverName}`)
    } catch (error) {
      console.error(`🔗 [连接池] 断开不健康连接失败:`, error)
    }
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage()
    const used = memUsage.heapUsed
    const total = memUsage.heapTotal

    return {
      used: Math.round(used / 1024 / 1024), // MB
      total: Math.round(total / 1024 / 1024), // MB
      percentage: Math.round((used / total) * 100)
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredConnections()
    }, this.config.cleanupInterval)
  }

  /**
   * 销毁连接池
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // 关闭所有连接
    for (const [poolKey] of this.pools.entries()) {
      const serverName = poolKey.replace('pool_', '')
      await this.closeServerConnections(serverName)
    }

    this.pools.clear()
    this.connectionHashes.clear()
    this.errorHandler.removeAllListeners()

    console.log('🔗 [连接池] 连接池已销毁')
  }
}

// 单例连接池实例
export const mcpConnectionPool = new MCPConnectionPool()