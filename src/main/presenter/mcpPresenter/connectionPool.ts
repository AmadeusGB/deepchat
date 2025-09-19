import { McpClient } from './mcpClient'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'

interface PooledConnection {
  client: McpClient
  lastUsed: Date
  isActive: boolean
  useCount: number
}

interface ConnectionPoolConfig {
  maxConnections: number
  maxIdleTime: number // ms
  cleanupInterval: number // ms
  maxUseCount: number
}

export class MCPConnectionPool {
  private pools: Map<string, PooledConnection[]> = new Map()
  private config: ConnectionPoolConfig
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxConnections: 5,
      maxIdleTime: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 2 * 60 * 1000, // 2分钟
      maxUseCount: 100,
      ...config
    }

    this.startCleanupTimer()
  }

  /**
   * 获取或创建连接
   */
  async getConnection(serverName: string, serverConfig: Record<string, unknown>): Promise<McpClient> {
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

    // 创建新连接
    const newClient = new McpClient(serverName, serverConfig)
    const pooledConnection: PooledConnection = {
      client: newClient,
      lastUsed: new Date(),
      isActive: true,
      useCount: 1
    }

    pool.push(pooledConnection)
    console.log(`🔗 [连接池] 创建新连接: ${serverName}, 池大小: ${pool.length}`)

    eventBus.emit(MCP_EVENTS.CONNECTION_POOL_STATS, {
      serverName,
      poolSize: pool.length,
      activeConnections: pool.filter(c => c.isActive).length
    })

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

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredConnections()
    }, this.config.cleanupInterval)
  }

  /**
   * 销毁连接池
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 关闭所有连接
    for (const [poolKey] of this.pools.entries()) {
      const serverName = poolKey.replace('pool_', '')
      await this.closeServerConnections(serverName)
    }

    this.pools.clear()
    console.log('🔗 [连接池] 连接池已销毁')
  }
}

// 单例连接池实例
export const mcpConnectionPool = new MCPConnectionPool()