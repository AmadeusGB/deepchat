/**
 * MCP事件系统优化器
 * 提供智能防抖、批处理和事件合并功能
 */

import { EventEmitter } from 'events'
import { eventBus, SendTarget } from '@/eventbus'
import { MCP_EVENTS } from '@/events'

export interface EventBatchConfig {
  maxBatchSize: number // 最大批处理大小
  batchTimeout: number // 批处理超时时间（ms）
  debounceDelay: number // 防抖延迟（ms）
  enabled: boolean // 是否启用批处理
}

export interface DebouncedEventConfig {
  delay: number // 防抖延迟（ms）
  maxWait: number // 最大等待时间（ms）
  leading: boolean // 是否在开始时触发
  trailing: boolean // 是否在结束时触发
}

export interface EventStats {
  eventType: string
  totalEvents: number
  batchedEvents: number
  debouncedEvents: number
  lastEventTime: number
  avgBatchSize: number
  reductionRatio: number // 事件减少比例
}

const DEFAULT_BATCH_CONFIG: EventBatchConfig = {
  maxBatchSize: 10,
  batchTimeout: 1000, // 1秒
  debounceDelay: 100, // 100ms
  enabled: true
}

const DEFAULT_DEBOUNCE_CONFIG: DebouncedEventConfig = {
  delay: 100,
  maxWait: 1000,
  leading: false,
  trailing: true
}

/**
 * 事件优化器管理器
 */
export class MCPEventOptimizer extends EventEmitter {
  private batchConfigs = new Map<string, EventBatchConfig>()
  private debounceConfigs = new Map<string, DebouncedEventConfig>()
  private eventBatches = new Map<string, any[]>()
  private batchTimers = new Map<string, NodeJS.Timeout>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private eventStats = new Map<string, EventStats>()
  private isDestroyed = false

  // 预定义的优化配置
  private readonly optimizedEvents = {
    // 健康检查事件 - 高频但可以批处理
    [MCP_EVENTS.SERVER_HEALTH_CHECK]: {
      batch: { ...DEFAULT_BATCH_CONFIG, maxBatchSize: 5, batchTimeout: 2000 },
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 200 }
    },
    // 工具使用统计 - 需要批处理以减少性能影响
    [MCP_EVENTS.TOOL_CALL_RESULT]: {
      batch: { ...DEFAULT_BATCH_CONFIG, maxBatchSize: 20, batchTimeout: 1000 },
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 50 }
    },
    // 客户端列表更新 - 防抖处理
    [MCP_EVENTS.CLIENT_LIST_UPDATED]: {
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 150, maxWait: 500 }
    },
    // 使用统计更新 - 降低频率
    [MCP_EVENTS.USAGE_STATS_UPDATED]: {
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 1000, maxWait: 5000 }
    },
    // 服务器状态变更 - 适度防抖
    [MCP_EVENTS.SERVER_STATUS_CHANGED]: {
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 300, maxWait: 1000 }
    },
    // 连接池统计 - 批处理
    [MCP_EVENTS.CONNECTION_POOL_STATS]: {
      batch: { ...DEFAULT_BATCH_CONFIG, maxBatchSize: 10, batchTimeout: 2000 },
      debounce: { ...DEFAULT_DEBOUNCE_CONFIG, delay: 500 }
    }
  }

  constructor() {
    super()
    this.initializeOptimizedEvents()
  }

  /**
   * 初始化预定义的优化事件配置
   */
  private initializeOptimizedEvents(): void {
    for (const [eventType, config] of Object.entries(this.optimizedEvents)) {
      if (config.batch) {
        this.batchConfigs.set(eventType, config.batch)
      }
      if (config.debounce) {
        this.debounceConfigs.set(eventType, config.debounce)
      }
      this.initEventStats(eventType)
    }
  }

  /**
   * 初始化事件统计
   */
  private initEventStats(eventType: string): void {
    this.eventStats.set(eventType, {
      eventType,
      totalEvents: 0,
      batchedEvents: 0,
      debouncedEvents: 0,
      lastEventTime: 0,
      avgBatchSize: 0,
      reductionRatio: 0
    })
  }

  /**
   * 优化事件发送
   */
  optimizedEmit(eventType: string, data: any, target: SendTarget = SendTarget.ALL_WINDOWS): void {
    if (this.isDestroyed) return

    this.updateEventStats(eventType)

    // 检查是否需要批处理
    if (this.batchConfigs.has(eventType)) {
      this.handleBatchEvent(eventType, data, target)
      return
    }

    // 检查是否需要防抖
    if (this.debounceConfigs.has(eventType)) {
      this.handleDebouncedEvent(eventType, data, target)
      return
    }

    // 直接发送事件
    this.sendEvent(eventType, data, target)
  }

  /**
   * 处理批处理事件
   */
  private handleBatchEvent(eventType: string, data: any, target: SendTarget): void {
    const config = this.batchConfigs.get(eventType)!

    if (!config.enabled) {
      this.sendEvent(eventType, data, target)
      return
    }

    // 初始化批次
    if (!this.eventBatches.has(eventType)) {
      this.eventBatches.set(eventType, [])
    }

    const batch = this.eventBatches.get(eventType)!
    batch.push({ data, target, timestamp: Date.now() })

    // 清除现有的批处理定时器
    const existingTimer = this.batchTimers.get(eventType)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 检查是否达到最大批处理大小
    if (batch.length >= config.maxBatchSize) {
      this.flushBatch(eventType)
    } else {
      // 设置批处理超时
      const timer = setTimeout(() => {
        this.flushBatch(eventType)
      }, config.batchTimeout)
      this.batchTimers.set(eventType, timer)
    }
  }

  /**
   * 处理防抖事件
   */
  private handleDebouncedEvent(eventType: string, data: any, target: SendTarget): void {
    const config = this.debounceConfigs.get(eventType)!
    const stats = this.eventStats.get(eventType)!

    // 如果设置了leading，且这是第一个事件，立即触发
    if (config.leading && !this.debounceTimers.has(eventType)) {
      this.sendEvent(eventType, data, target)
    }

    // 清除现有的防抖定时器
    const existingTimer = this.debounceTimers.get(eventType)
    if (existingTimer) {
      clearTimeout(existingTimer)
      stats.debouncedEvents++
    }

    // 设置新的防抖定时器
    const timer = setTimeout(() => {
      this.debounceTimers.delete(eventType)
      if (config.trailing) {
        this.sendEvent(eventType, data, target)
      }
    }, config.delay)

    this.debounceTimers.set(eventType, timer)

    // 检查最大等待时间
    const now = Date.now()
    if (config.maxWait && now - stats.lastEventTime > config.maxWait) {
      clearTimeout(timer)
      this.debounceTimers.delete(eventType)
      this.sendEvent(eventType, data, target)
    }
  }

  /**
   * 发送批处理事件
   */
  private flushBatch(eventType: string): void {
    const batch = this.eventBatches.get(eventType)
    if (!batch || batch.length === 0) return

    // 清除定时器
    const timer = this.batchTimers.get(eventType)
    if (timer) {
      clearTimeout(timer)
      this.batchTimers.delete(eventType)
    }

    // 合并批处理数据
    const mergedData = this.mergeBatchData(eventType, batch)
    const target = batch[0].target || SendTarget.ALL_WINDOWS

    // 发送合并后的事件
    this.sendEvent(eventType, mergedData, target)

    // 更新统计
    const stats = this.eventStats.get(eventType)!
    stats.batchedEvents += batch.length
    stats.avgBatchSize = stats.batchedEvents / Math.max(1, stats.totalEvents - stats.batchedEvents)

    // 清空批次
    this.eventBatches.set(eventType, [])

    console.log(`[事件优化] 批处理发送 ${eventType}: ${batch.length} 个事件合并`)
  }

  /**
   * 合并批处理数据
   */
  private mergeBatchData(eventType: string, batch: any[]): any {
    switch (eventType) {
      case MCP_EVENTS.SERVER_HEALTH_CHECK:
        return {
          type: 'batch',
          count: batch.length,
          results: batch.map(item => item.data),
          timestamp: Date.now()
        }

      case MCP_EVENTS.TOOL_CALL_RESULT:
        return {
          type: 'batch',
          count: batch.length,
          events: batch.map(item => item.data),
          summary: this.createToolCallSummary(batch.map(item => item.data))
        }

      case MCP_EVENTS.CONNECTION_POOL_STATS:
        return {
          type: 'batch',
          count: batch.length,
          stats: batch[batch.length - 1].data, // 使用最新的统计数据
          updateCount: batch.length
        }

      default:
        // 默认合并策略
        return {
          type: 'batch',
          count: batch.length,
          data: batch.map(item => item.data),
          timestamp: Date.now()
        }
    }
  }

  /**
   * 创建工具调用汇总
   */
  private createToolCallSummary(events: any[]): any {
    const summary = {
      totalCalls: events.length,
      successfulCalls: events.filter(e => e.success).length,
      failedCalls: events.filter(e => !e.success).length,
      avgResponseTime: 0,
      serverStats: new Map<string, number>(),
      toolStats: new Map<string, number>()
    }

    let totalResponseTime = 0
    for (const event of events) {
      if (event.responseTime) {
        totalResponseTime += event.responseTime
      }

      // 服务器统计
      const serverCount = summary.serverStats.get(event.serverName) || 0
      summary.serverStats.set(event.serverName, serverCount + 1)

      // 工具统计
      const toolCount = summary.toolStats.get(event.toolName) || 0
      summary.toolStats.set(event.toolName, toolCount + 1)
    }

    summary.avgResponseTime = totalResponseTime / events.length

    return summary
  }

  /**
   * 发送实际事件
   */
  private sendEvent(eventType: string, data: any, target: SendTarget): void {
    try {
      // 发送到事件总线
      eventBus.send(eventType, target, data)

      // 发出本地事件
      this.emit(eventType, data)

      console.log(`[事件优化] 发送事件 ${eventType}`)
    } catch (error) {
      console.error(`[事件优化] 发送事件失败 ${eventType}:`, error)
    }
  }

  /**
   * 更新事件统计
   */
  private updateEventStats(eventType: string): void {
    if (!this.eventStats.has(eventType)) {
      this.initEventStats(eventType)
    }

    const stats = this.eventStats.get(eventType)!
    stats.totalEvents++
    stats.lastEventTime = Date.now()

    // 计算事件减少比例
    const processedEvents = stats.totalEvents - stats.batchedEvents - stats.debouncedEvents
    stats.reductionRatio = processedEvents > 0 ? 1 - (processedEvents / stats.totalEvents) : 0
  }

  /**
   * 配置事件批处理
   */
  configureBatchEvent(eventType: string, config: Partial<EventBatchConfig>): void {
    const currentConfig = this.batchConfigs.get(eventType) || { ...DEFAULT_BATCH_CONFIG }
    this.batchConfigs.set(eventType, { ...currentConfig, ...config })

    if (!this.eventStats.has(eventType)) {
      this.initEventStats(eventType)
    }
  }

  /**
   * 配置事件防抖
   */
  configureDebounceEvent(eventType: string, config: Partial<DebouncedEventConfig>): void {
    const currentConfig = this.debounceConfigs.get(eventType) || { ...DEFAULT_DEBOUNCE_CONFIG }
    this.debounceConfigs.set(eventType, { ...currentConfig, ...config })

    if (!this.eventStats.has(eventType)) {
      this.initEventStats(eventType)
    }
  }

  /**
   * 强制刷新所有批处理
   */
  flushAllBatches(): void {
    for (const eventType of this.eventBatches.keys()) {
      this.flushBatch(eventType)
    }
  }

  /**
   * 获取事件统计
   */
  getEventStats(): Map<string, EventStats> {
    // 更新减少比例
    for (const stats of this.eventStats.values()) {
      const processedEvents = stats.totalEvents - stats.batchedEvents - stats.debouncedEvents
      stats.reductionRatio = stats.totalEvents > 0 ? 1 - (processedEvents / stats.totalEvents) : 0
    }

    return new Map(this.eventStats)
  }

  /**
   * 获取优化效果汇总
   */
  getOptimizationSummary(): {
    totalEvents: number
    optimizedEvents: number
    reductionRatio: number
    performanceGain: string
  } {
    let totalEvents = 0
    let optimizedEvents = 0

    for (const stats of this.eventStats.values()) {
      totalEvents += stats.totalEvents
      optimizedEvents += stats.batchedEvents + stats.debouncedEvents
    }

    const reductionRatio = totalEvents > 0 ? optimizedEvents / totalEvents : 0

    return {
      totalEvents,
      optimizedEvents,
      reductionRatio,
      performanceGain: `${(reductionRatio * 100).toFixed(1)}% 事件减少`
    }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    for (const stats of this.eventStats.values()) {
      stats.totalEvents = 0
      stats.batchedEvents = 0
      stats.debouncedEvents = 0
      stats.lastEventTime = 0
      stats.avgBatchSize = 0
      stats.reductionRatio = 0
    }
  }

  /**
   * 销毁优化器
   */
  destroy(): void {
    this.isDestroyed = true

    // 刷新所有未完成的批处理
    this.flushAllBatches()

    // 清理所有定时器
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer)
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }

    this.batchTimers.clear()
    this.debounceTimers.clear()
    this.eventBatches.clear()
    this.removeAllListeners()

    console.log('[事件优化] 事件优化器已销毁')
  }
}

// 单例事件优化器
export const mcpEventOptimizer = new MCPEventOptimizer()