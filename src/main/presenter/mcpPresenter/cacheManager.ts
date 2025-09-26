/**
 * MCP缓存管理器
 * 提供智能缓存机制以提升MCP操作性能
 */

import { EventEmitter } from 'events'
import { Tool, PromptListEntry, ResourceListEntry } from '@shared/presenter'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
  accessCount: number
  lastAccessed: number
  size: number // Estimated size in bytes
}

export interface CacheConfig {
  maxMemorySize: number // Maximum cache size in bytes
  defaultTTL: number // Default TTL in milliseconds
  maxEntries: number // Maximum number of cache entries
  enableCompression: boolean // Enable data compression for large entries
  cleanupInterval: number // Cleanup interval in milliseconds
  hitRateReporting: boolean // Enable hit rate reporting
}

export interface CacheStats {
  totalEntries: number
  totalSize: number // Total size in bytes
  hitRate: number // 0-1
  hits: number
  misses: number
  evictions: number
  compressionRatio?: number
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  maxEntries: 1000,
  enableCompression: true,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  hitRateReporting: true
}

/**
 * 智能MCP缓存管理器
 */
export class MCPCacheManager extends EventEmitter {
  private cache = new Map<string, CacheEntry<any>>()
  private config: CacheConfig
  private stats: CacheStats = {
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  }
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<CacheConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.startCleanupTimer()
  }

  /**
   * 缓存工具定义
   */
  async cacheTools(serverId: string, tools: Tool[], ttl?: number): Promise<void> {
    const cacheKey = `tools:${serverId}`
    const entry = this.createCacheEntry(tools, ttl)

    this.setEntry(cacheKey, entry)
    console.log(`[Cache] Cached ${tools.length} tools for server ${serverId}`)
  }

  /**
   * 获取缓存的工具定义
   */
  getCachedTools(serverId: string): Tool[] | null {
    const cacheKey = `tools:${serverId}`
    return this.getEntry(cacheKey)
  }

  /**
   * 缓存资源列表
   */
  async cacheResources(serverId: string, resources: ResourceListEntry[], ttl?: number): Promise<void> {
    const cacheKey = `resources:${serverId}`
    const entry = this.createCacheEntry(resources, ttl)

    this.setEntry(cacheKey, entry)
    console.log(`[Cache] Cached ${resources.length} resources for server ${serverId}`)
  }

  /**
   * 获取缓存的资源列表
   */
  getCachedResources(serverId: string): ResourceListEntry[] | null {
    const cacheKey = `resources:${serverId}`
    return this.getEntry(cacheKey)
  }

  /**
   * 缓存提示列表
   */
  async cachePrompts(serverId: string, prompts: PromptListEntry[], ttl?: number): Promise<void> {
    const cacheKey = `prompts:${serverId}`
    const entry = this.createCacheEntry(prompts, ttl)

    this.setEntry(cacheKey, entry)
    console.log(`[Cache] Cached ${prompts.length} prompts for server ${serverId}`)
  }

  /**
   * 获取缓存的提示列表
   */
  getCachedPrompts(serverId: string): PromptListEntry[] | null {
    const cacheKey = `prompts:${serverId}`
    return this.getEntry(cacheKey)
  }

  /**
   * 缓存工具调用结果（仅对幂等操作）
   */
  async cacheToolResponse(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    response: any,
    ttl?: number
  ): Promise<void> {
    // 只缓存读取操作，避免缓存副作用操作
    if (!this.isIdempotentTool(toolName)) {
      return
    }

    const argsHash = this.hashObject(args)
    const cacheKey = `tool_response:${serverId}:${toolName}:${argsHash}`
    const entry = this.createCacheEntry(response, ttl || this.config.defaultTTL / 2) // 工具响应使用较短TTL

    this.setEntry(cacheKey, entry)
    console.log(`[Cache] Cached tool response for ${serverId}:${toolName}`)
  }

  /**
   * 获取缓存的工具调用结果
   */
  getCachedToolResponse(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): any | null {
    if (!this.isIdempotentTool(toolName)) {
      return null
    }

    const argsHash = this.hashObject(args)
    const cacheKey = `tool_response:${serverId}:${toolName}:${argsHash}`
    return this.getEntry(cacheKey)
  }

  /**
   * 创建缓存条目
   */
  private createCacheEntry<T>(data: T, ttl?: number): CacheEntry<T> {
    const now = Date.now()
    return {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: now,
      size: this.estimateSize(data)
    }
  }

  /**
   * 设置缓存条目
   */
  private setEntry<T>(key: string, entry: CacheEntry<T>): void {
    // 检查是否需要清理空间
    if (this.needsCleanup()) {
      this.performCleanup()
    }

    // 如果条目太大，直接拒绝缓存
    if (entry.size > this.config.maxMemorySize * 0.1) { // 不允许单个条目超过总缓存的10%
      console.warn(`[Cache] Entry too large to cache: ${key} (${entry.size} bytes)`)
      return
    }

    this.cache.set(key, entry)
    this.updateStats()

    this.emit('entryAdded', { key, size: entry.size })
  }

  /**
   * 获取缓存条目
   */
  private getEntry<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    const now = Date.now()

    // 检查TTL
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      this.updateHitRate()
      console.log(`[Cache] Entry expired: ${key}`)
      return null
    }

    // 更新访问统计
    entry.accessCount++
    entry.lastAccessed = now

    this.stats.hits++
    this.updateHitRate()

    return entry.data as T
  }

  /**
   * 判断工具是否为幂等操作
   */
  private isIdempotentTool(toolName: string): boolean {
    // 定义已知的幂等工具（读取操作）
    const idempotentPatterns = [
      'list', 'get', 'read', 'fetch', 'query', 'search', 'find',
      'show', 'view', 'display', 'check', 'validate', 'info'
    ]

    const lowerToolName = toolName.toLowerCase()
    return idempotentPatterns.some(pattern => lowerToolName.includes(pattern))
  }

  /**
   * 计算对象哈希值（简化版）
   */
  private hashObject(obj: Record<string, unknown>): string {
    const jsonStr = JSON.stringify(obj, Object.keys(obj).sort())

    // 简单的字符串哈希函数
    let hash = 0
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return hash.toString(36)
  }

  /**
   * 估算数据大小
   */
  private estimateSize(data: any): number {
    try {
      const jsonStr = JSON.stringify(data)
      return jsonStr.length * 2 // UTF-16 字符大约占用2字节
    } catch {
      return 1024 // 默认1KB
    }
  }

  /**
   * 检查是否需要清理
   */
  private needsCleanup(): boolean {
    return this.cache.size >= this.config.maxEntries ||
           this.stats.totalSize >= this.config.maxMemorySize
  }

  /**
   * 执行缓存清理
   */
  private performCleanup(): void {
    const entries = Array.from(this.cache.entries())
    const now = Date.now()

    // 按优先级排序：过期 > 最少使用 > 最旧
    entries.sort(([, entryA], [, entryB]) => {
      const expiredA = now - entryA.timestamp > entryA.ttl
      const expiredB = now - entryB.timestamp > entryB.ttl

      if (expiredA && !expiredB) return -1
      if (!expiredA && expiredB) return 1
      if (expiredA && expiredB) return entryA.timestamp - entryB.timestamp

      // 按访问频率和最近访问时间排序
      const scoreA = entryA.accessCount / Math.max(1, now - entryA.lastAccessed)
      const scoreB = entryB.accessCount / Math.max(1, now - entryB.lastAccessed)

      return scoreA - scoreB
    })

    // 清理条目直到满足限制
    let cleanedCount = 0
    const targetEntries = Math.floor(this.config.maxEntries * 0.8) // 清理到80%容量
    const targetSize = Math.floor(this.config.maxMemorySize * 0.8)

    for (const [key, entry] of entries) {
      if (this.cache.size <= targetEntries && this.stats.totalSize <= targetSize) {
        break
      }

      this.cache.delete(key)
      cleanedCount++
      this.stats.evictions++

      this.emit('entryEvicted', { key, size: entry.size })
    }

    this.updateStats()

    if (cleanedCount > 0) {
      console.log(`[Cache] Cleaned up ${cleanedCount} cache entries`)
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size
    this.stats.totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0)
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performScheduledCleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * 定期清理
   */
  private performScheduledCleanup(): void {
    const now = Date.now()
    let expiredCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        expiredCount++
      }
    }

    if (expiredCount > 0) {
      this.updateStats()
      console.log(`[Cache] Expired ${expiredCount} cache entries`)
    }

    // 报告缓存状态
    if (this.config.hitRateReporting) {
      this.emit('statsUpdate', this.getStats())
    }
  }

  /**
   * 清除特定服务器的缓存
   */
  clearServerCache(serverId: string): void {
    const keys = Array.from(this.cache.keys())
    let clearedCount = 0

    for (const key of keys) {
      if (key.includes(serverId)) {
        this.cache.delete(key)
        clearedCount++
      }
    }

    this.updateStats()
    console.log(`[Cache] Cleared ${clearedCount} cache entries for server ${serverId}`)
  }

  /**
   * 预热缓存
   */
  async warmupCache(servers: Array<{ id: string; tools: Tool[]; resources: ResourceListEntry[]; prompts: PromptListEntry[] }>): Promise<void> {
    console.log(`[Cache] Starting cache warmup for ${servers.length} servers`)

    for (const server of servers) {
      try {
        await this.cacheTools(server.id, server.tools)
        await this.cacheResources(server.id, server.resources)
        await this.cachePrompts(server.id, server.prompts)
      } catch (error) {
        console.warn(`[Cache] Failed to warmup cache for server ${server.id}:`, error)
      }
    }

    console.log('[Cache] Cache warmup completed')
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    this.updateStats()
    return { ...this.stats }
  }

  /**
   * 获取缓存详情
   */
  getCacheDetails(): Array<{
    key: string
    size: number
    accessCount: number
    age: number
    ttl: number
  }> {
    const now = Date.now()

    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: entry.size,
      accessCount: entry.accessCount,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }))
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // 如果内存限制减少，立即执行清理
    if (newConfig.maxMemorySize && newConfig.maxMemorySize < this.stats.totalSize) {
      this.performCleanup()
    }

    console.log('[Cache] Configuration updated')
  }

  /**
   * 清理所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      hits: 0,
      misses: 0,
      evictions: 0
    }
    console.log('[Cache] All cache cleared')
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.clear()
    this.removeAllListeners()
    console.log('[Cache] Cache manager destroyed')
  }
}

// 单例缓存管理器实例
export const mcpCacheManager = new MCPCacheManager()