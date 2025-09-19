// MCP工具使用统计追踪器
// 收集和分析工具使用数据，提供使用洞察

import { EventEmitter } from 'events'
import { MCP_EVENTS } from '../../events'

export interface ToolUsageEvent {
  toolName: string
  serverName: string
  timestamp: number
  success: boolean
  responseTime: number
  inputSize: number
  outputSize: number
  error?: string
  userId?: string
  sessionId?: string
}

export interface ToolUsageStats {
  toolName: string
  serverName: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageResponseTime: number
  totalInputSize: number
  totalOutputSize: number
  lastUsed: number
  errorRate: number
  popularityScore: number
  usageFrequency: {
    daily: number
    weekly: number
    monthly: number
  }
}

export interface ServerUsageStats {
  serverName: string
  totalCalls: number
  uniqueTools: number
  averageResponseTime: number
  errorRate: number
  uptime: number
  lastActivity: number
  toolsRanking: Array<{
    toolName: string
    callCount: number
    successRate: number
  }>
}

export interface UsageAnalytics {
  totalCalls: number
  totalServers: number
  totalTools: number
  averageResponseTime: number
  overallErrorRate: number
  topTools: Array<{
    toolName: string
    serverName: string
    callCount: number
    successRate: number
    popularityScore: number
  }>
  topServers: Array<{
    serverName: string
    callCount: number
    toolCount: number
    errorRate: number
  }>
  timeSeriesData: Array<{
    timestamp: number
    callCount: number
    errorCount: number
    averageResponseTime: number
  }>
}

export class MCPUsageTracker extends EventEmitter {
  private usageEvents: ToolUsageEvent[] = []
  private toolStats = new Map<string, ToolUsageStats>()
  private serverStats = new Map<string, ServerUsageStats>()
  private maxEventHistory = 10000 // 最大保存事件数量
  private analyticsUpdateInterval = 60000 // 1分钟更新一次分析数据
  private cleanupInterval = 24 * 60 * 60 * 1000 // 24小时清理一次旧数据
  private updateTimer?: NodeJS.Timeout
  private cleanupTimer?: NodeJS.Timeout

  constructor() {
    super()
    this.startPeriodicUpdates()
  }

  /**
   * 记录工具使用事件
   */
  recordToolUsage(event: ToolUsageEvent): void {
    // 添加到事件历史
    this.usageEvents.push(event)

    // 限制历史记录大小
    if (this.usageEvents.length > this.maxEventHistory) {
      this.usageEvents = this.usageEvents.slice(-this.maxEventHistory)
    }

    // 更新统计数据
    this.updateToolStats(event)
    this.updateServerStats(event)

    // 发出使用事件
    this.emit(MCP_EVENTS.TOOL_CALL_RESULT, event)
  }

  /**
   * 更新工具统计数据
   */
  private updateToolStats(event: ToolUsageEvent): void {
    const key = `${event.serverName}:${event.toolName}`
    let stats = this.toolStats.get(key)

    if (!stats) {
      stats = {
        toolName: event.toolName,
        serverName: event.serverName,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        totalInputSize: 0,
        totalOutputSize: 0,
        lastUsed: 0,
        errorRate: 0,
        popularityScore: 0,
        usageFrequency: {
          daily: 0,
          weekly: 0,
          monthly: 0
        }
      }
      this.toolStats.set(key, stats)
    }

    // 更新基本统计
    stats.totalCalls++
    stats.lastUsed = event.timestamp
    stats.totalInputSize += event.inputSize
    stats.totalOutputSize += event.outputSize

    if (event.success) {
      stats.successfulCalls++
    } else {
      stats.failedCalls++
    }

    // 更新平均响应时间
    stats.averageResponseTime = (
      (stats.averageResponseTime * (stats.totalCalls - 1) + event.responseTime) /
      stats.totalCalls
    )

    // 更新错误率
    stats.errorRate = stats.failedCalls / stats.totalCalls

    // 更新使用频率
    this.updateUsageFrequency(stats)

    // 计算流行度分数（基于使用频率、成功率、响应时间）
    stats.popularityScore = this.calculatePopularityScore(stats)
  }

  /**
   * 更新服务器统计数据
   */
  private updateServerStats(event: ToolUsageEvent): void {
    let stats = this.serverStats.get(event.serverName)

    if (!stats) {
      stats = {
        serverName: event.serverName,
        totalCalls: 0,
        uniqueTools: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: 0,
        lastActivity: 0,
        toolsRanking: []
      }
      this.serverStats.set(event.serverName, stats)
    }

    stats.totalCalls++
    stats.lastActivity = event.timestamp

    // 更新平均响应时间
    stats.averageResponseTime = (
      (stats.averageResponseTime * (stats.totalCalls - 1) + event.responseTime) /
      stats.totalCalls
    )

    // 更新工具排名
    this.updateToolsRanking(stats, event)

    // 计算错误率
    const errorCount = this.usageEvents
      .filter(e => e.serverName === event.serverName && !e.success)
      .length
    stats.errorRate = errorCount / stats.totalCalls

    // 更新唯一工具数量
    const uniqueTools = new Set(
      this.usageEvents
        .filter(e => e.serverName === event.serverName)
        .map(e => e.toolName)
    )
    stats.uniqueTools = uniqueTools.size
  }

  /**
   * 更新使用频率统计
   */
  private updateUsageFrequency(stats: ToolUsageStats): void {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const weekMs = 7 * dayMs
    const monthMs = 30 * dayMs

    const key = `${stats.serverName}:${stats.toolName}`

    stats.usageFrequency.daily = this.usageEvents.filter(
      e => e.serverName === stats.serverName &&
           e.toolName === stats.toolName &&
           now - e.timestamp <= dayMs
    ).length

    stats.usageFrequency.weekly = this.usageEvents.filter(
      e => e.serverName === stats.serverName &&
           e.toolName === stats.toolName &&
           now - e.timestamp <= weekMs
    ).length

    stats.usageFrequency.monthly = this.usageEvents.filter(
      e => e.serverName === stats.serverName &&
           e.toolName === stats.toolName &&
           now - e.timestamp <= monthMs
    ).length
  }

  /**
   * 更新服务器工具排名
   */
  private updateToolsRanking(stats: ServerUsageStats, event: ToolUsageEvent): void {
    let toolRanking = stats.toolsRanking.find(t => t.toolName === event.toolName)

    if (!toolRanking) {
      toolRanking = {
        toolName: event.toolName,
        callCount: 0,
        successRate: 0
      }
      stats.toolsRanking.push(toolRanking)
    }

    toolRanking.callCount++

    // 计算成功率
    const toolEvents = this.usageEvents.filter(
      e => e.serverName === event.serverName && e.toolName === event.toolName
    )
    const successCount = toolEvents.filter(e => e.success).length
    toolRanking.successRate = successCount / toolEvents.length

    // 按调用次数排序
    stats.toolsRanking.sort((a, b) => b.callCount - a.callCount)
  }

  /**
   * 计算工具流行度分数
   */
  private calculatePopularityScore(stats: ToolUsageStats): number {
    const usageWeight = 0.4
    const successWeight = 0.3
    const performanceWeight = 0.3

    // 使用频率分数（基于总调用次数和最近使用频率）
    const usageScore = Math.min(stats.totalCalls / 100, 1) * 0.7 +
                      Math.min(stats.usageFrequency.weekly / 50, 1) * 0.3

    // 成功率分数
    const successScore = 1 - stats.errorRate

    // 性能分数（响应时间越低越好）
    const performanceScore = Math.max(0, 1 - stats.averageResponseTime / 10000)

    return usageWeight * usageScore +
           successWeight * successScore +
           performanceWeight * performanceScore
  }

  /**
   * 获取工具使用统计
   */
  getToolStats(serverName?: string, toolName?: string): ToolUsageStats[] {
    const stats = Array.from(this.toolStats.values())

    if (serverName && toolName) {
      const key = `${serverName}:${toolName}`
      const stat = this.toolStats.get(key)
      return stat ? [stat] : []
    }

    if (serverName) {
      return stats.filter(s => s.serverName === serverName)
    }

    return stats
  }

  /**
   * 获取服务器使用统计
   */
  getServerStats(serverName?: string): ServerUsageStats[] {
    const stats = Array.from(this.serverStats.values())

    if (serverName) {
      const stat = this.serverStats.get(serverName)
      return stat ? [stat] : []
    }

    return stats
  }

  /**
   * 获取综合使用分析数据
   */
  getUsageAnalytics(): UsageAnalytics {
    const toolStats = Array.from(this.toolStats.values())
    const serverStats = Array.from(this.serverStats.values())

    const totalCalls = this.usageEvents.length
    const successfulCalls = this.usageEvents.filter(e => e.success).length
    const totalResponseTime = this.usageEvents.reduce((sum, e) => sum + e.responseTime, 0)

    // 计算时间序列数据（按小时分组）
    const timeSeriesData = this.generateTimeSeriesData()

    return {
      totalCalls,
      totalServers: serverStats.length,
      totalTools: toolStats.length,
      averageResponseTime: totalCalls > 0 ? totalResponseTime / totalCalls : 0,
      overallErrorRate: totalCalls > 0 ? (totalCalls - successfulCalls) / totalCalls : 0,
      topTools: toolStats
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, 10)
        .map(s => ({
          toolName: s.toolName,
          serverName: s.serverName,
          callCount: s.totalCalls,
          successRate: 1 - s.errorRate,
          popularityScore: s.popularityScore
        })),
      topServers: serverStats
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 10)
        .map(s => ({
          serverName: s.serverName,
          callCount: s.totalCalls,
          toolCount: s.uniqueTools,
          errorRate: s.errorRate
        })),
      timeSeriesData
    }
  }

  /**
   * 生成时间序列数据
   */
  private generateTimeSeriesData(): Array<{
    timestamp: number
    callCount: number
    errorCount: number
    averageResponseTime: number
  }> {
    const hourMs = 60 * 60 * 1000
    const now = Date.now()
    const last24Hours = now - 24 * hourMs

    const hourlyData: Map<number, {
      callCount: number
      errorCount: number
      totalResponseTime: number
    }> = new Map()

    // 按小时分组统计
    this.usageEvents
      .filter(e => e.timestamp >= last24Hours)
      .forEach(e => {
        const hour = Math.floor(e.timestamp / hourMs) * hourMs
        const data = hourlyData.get(hour) || {
          callCount: 0,
          errorCount: 0,
          totalResponseTime: 0
        }

        data.callCount++
        if (!e.success) data.errorCount++
        data.totalResponseTime += e.responseTime

        hourlyData.set(hour, data)
      })

    // 转换为数组格式
    return Array.from(hourlyData.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        callCount: data.callCount,
        errorCount: data.errorCount,
        averageResponseTime: data.callCount > 0 ? data.totalResponseTime / data.callCount : 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 开始定期更新
   */
  private startPeriodicUpdates(): void {
    // 定期更新分析数据
    this.updateTimer = setInterval(() => {
      this.emit(MCP_EVENTS.USAGE_STATS_UPDATED, this.getUsageAnalytics())
    }, this.analyticsUpdateInterval)

    // 定期清理旧数据
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData()
    }, this.cleanupInterval)
  }

  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    const now = Date.now()
    const retentionPeriod = 30 * 24 * 60 * 60 * 1000 // 30天

    // 清理旧事件
    this.usageEvents = this.usageEvents.filter(
      e => now - e.timestamp <= retentionPeriod
    )

    // 重新计算统计数据
    this.recalculateStats()

    console.log(`Cleaned up old usage data. Remaining events: ${this.usageEvents.length}`)
  }

  /**
   * 重新计算统计数据
   */
  private recalculateStats(): void {
    this.toolStats.clear()
    this.serverStats.clear()

    this.usageEvents.forEach(event => {
      this.updateToolStats(event)
      this.updateServerStats(event)
    })
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.usageEvents = []
    this.toolStats.clear()
    this.serverStats.clear()
    this.removeAllListeners()
  }
}