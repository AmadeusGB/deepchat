import { MCPToolDefinition, MCPToolResponse } from '@shared/presenter'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hitCount: number
  serverName?: string
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
}

export class MCPToolCache {
  private toolDefinitionsCache = new Map<string, CacheEntry<MCPToolDefinition[]>>()
  private toolResultsCache = new Map<string, CacheEntry<MCPToolResponse>>()
  private cacheStats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 }

  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5分钟
  private readonly RESULTS_TTL = 2 * 60 * 1000 // 2分钟
  private readonly MAX_CACHE_SIZE = 1000
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanupTimer()
  }

  /**
   * 缓存工具定义
   */
  cacheToolDefinitions(serverName: string, tools: MCPToolDefinition[]): void {
    const key = `tools_${serverName}`
    this.toolDefinitionsCache.set(key, {
      data: tools,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL,
      hitCount: 0,
      serverName
    })
    this.updateCacheSize()
    console.log(`🗄️ [工具缓存] 缓存工具定义: ${serverName}, 数量: ${tools.length}`)
  }

  /**
   * 获取缓存的工具定义
   */
  getCachedToolDefinitions(serverName: string): MCPToolDefinition[] | null {
    const key = `tools_${serverName}`
    const entry = this.toolDefinitionsCache.get(key)

    if (!entry) {
      this.cacheStats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.toolDefinitionsCache.delete(key)
      this.cacheStats.misses++
      return null
    }

    entry.hitCount++
    this.cacheStats.hits++
    console.log(`🗄️ [工具缓存] 命中工具定义缓存: ${serverName}`)
    return entry.data
  }

  /**
   * 缓存工具执行结果
   */
  cacheToolResult(toolName: string, params: Record<string, unknown>, result: MCPToolResponse): void {
    const key = this.generateResultKey(toolName, params)

    // 只缓存成功的结果，且参数相对简单的调用
    if (this.shouldCacheResult(params, result)) {
      this.toolResultsCache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttl: this.RESULTS_TTL,
        hitCount: 0
      })
      this.updateCacheSize()
      console.log(`🗄️ [工具缓存] 缓存工具结果: ${toolName}`)
    }
  }

  /**
   * 获取缓存的工具结果
   */
  getCachedToolResult(toolName: string, params: Record<string, unknown>): MCPToolResponse | null {
    const key = this.generateResultKey(toolName, params)
    const entry = this.toolResultsCache.get(key)

    if (!entry) {
      this.cacheStats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.toolResultsCache.delete(key)
      this.cacheStats.misses++
      return null
    }

    entry.hitCount++
    this.cacheStats.hits++
    console.log(`🗄️ [工具缓存] 命中工具结果缓存: ${toolName}`)
    return entry.data
  }

  /**
   * 清理指定服务器的缓存
   */
  clearServerCache(serverName: string): void {
    const toolsKey = `tools_${serverName}`
    this.toolDefinitionsCache.delete(toolsKey)

    // 清理与该服务器相关的工具结果缓存
    for (const [key, entry] of this.toolResultsCache.entries()) {
      if (entry.serverName === serverName) {
        this.toolResultsCache.delete(key)
      }
    }

    this.updateCacheSize()
    console.log(`🗄️ [工具缓存] 清理服务器缓存: ${serverName}`)
  }

  /**
   * 清理所有缓存
   */
  clearAll(): void {
    this.toolDefinitionsCache.clear()
    this.toolResultsCache.clear()
    this.cacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 }
    console.log('🗄️ [工具缓存] 清理所有缓存')
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & {
    toolDefinitionsCount: number
    toolResultsCount: number
    topTools: Array<{ key: string; hits: number }>
  } {
    this.updateHitRate()

    // 获取最常用的工具
    const topTools = Array.from(this.toolResultsCache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hitCount }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5)

    return {
      ...this.cacheStats,
      toolDefinitionsCount: this.toolDefinitionsCache.size,
      toolResultsCount: this.toolResultsCache.size,
      topTools
    }
  }

  /**
   * 预热缓存 - 为常用工具预加载结果
   */
  async warmupCache(commonTools: Array<{ name: string; params: Record<string, unknown> }>): Promise<void> {
    console.log(`🗄️ [工具缓存] 开始预热缓存，工具数量: ${commonTools.length}`)
    // 预热逻辑可以在这里实现
    // 例如预加载一些常用的工具调用结果
  }

  /**
   * 优化缓存 - 清理低价值的缓存项
   */
  optimizeCache(): void {
    const currentTime = Date.now()
    let removedCount = 0

    // 清理工具结果缓存中命中率低的项目
    for (const [key, entry] of this.toolResultsCache.entries()) {
      const age = currentTime - entry.timestamp
      const hitRate = entry.hitCount / Math.max(1, age / (60 * 1000)) // 每分钟命中率

      // 如果命中率很低且存在时间较长，则删除
      if (hitRate < 0.1 && age > this.RESULTS_TTL / 2) {
        this.toolResultsCache.delete(key)
        removedCount++
      }
    }

    this.updateCacheSize()

    if (removedCount > 0) {
      console.log(`🗄️ [工具缓存] 优化缓存，删除 ${removedCount} 个低价值项`)
    }
  }

  private generateResultKey(toolName: string, params: Record<string, unknown>): string {
    // 生成参数的稳定哈希
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = params[key]
        return sorted
      }, {} as Record<string, unknown>)

    const paramsStr = JSON.stringify(sortedParams)
    return `result_${toolName}_${this.simpleHash(paramsStr)}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private shouldCacheResult(params: Record<string, unknown>, result: MCPToolResponse): boolean {
    // 检查参数复杂度
    const paramsStr = JSON.stringify(params)
    if (paramsStr.length > 1000) {
      return false // 参数太复杂，不缓存
    }

    // 检查结果大小
    const resultStr = JSON.stringify(result)
    if (resultStr.length > 10000) {
      return false // 结果太大，不缓存
    }

    // 检查是否包含时间敏感的参数
    const timeKeywords = ['time', 'date', 'timestamp', 'now', 'current']
    const hasTimeKeywords = timeKeywords.some(keyword =>
      paramsStr.toLowerCase().includes(keyword)
    )

    return !hasTimeKeywords
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private updateCacheSize(): void {
    this.cacheStats.size = this.toolDefinitionsCache.size + this.toolResultsCache.size

    // 如果缓存过大，执行清理
    if (this.cacheStats.size > this.MAX_CACHE_SIZE) {
      this.evictLeastUsed()
    }
  }

  private updateHitRate(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses
    this.cacheStats.hitRate = total > 0 ? this.cacheStats.hits / total : 0
  }

  private evictLeastUsed(): void {
    // 从工具结果缓存中删除最少使用的项
    const entries = Array.from(this.toolResultsCache.entries())
    entries.sort((a, b) => a[1].hitCount - b[1].hitCount)

    const toRemove = Math.min(50, entries.length)
    for (let i = 0; i < toRemove; i++) {
      this.toolResultsCache.delete(entries[i][0])
    }

    console.log(`🗄️ [工具缓存] 淘汰 ${toRemove} 个最少使用的缓存项`)
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
      this.optimizeCache()
    }, 2 * 60 * 1000) // 每2分钟清理一次
  }

  private cleanupExpiredEntries(): void {
    let removedCount = 0

    // 清理过期的工具定义
    for (const [key, entry] of this.toolDefinitionsCache.entries()) {
      if (this.isExpired(entry)) {
        this.toolDefinitionsCache.delete(key)
        removedCount++
      }
    }

    // 清理过期的工具结果
    for (const [key, entry] of this.toolResultsCache.entries()) {
      if (this.isExpired(entry)) {
        this.toolResultsCache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.updateCacheSize()
      console.log(`🗄️ [工具缓存] 清理 ${removedCount} 个过期缓存项`)
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clearAll()
    console.log('🗄️ [工具缓存] 缓存已销毁')
  }
}

// 单例工具缓存实例
export const mcpToolCache = new MCPToolCache()