import { ref, reactive, computed } from 'vue'

interface TtsMetrics {
  totalChunks: number
  totalCharacters: number
  totalPlayTime: number
  averageLatencyPerChar: number
  queueLength: number
  smallChunksCount: number // 小于100字符的块数量
}

interface OptimizationSuggestion {
  type: 'chunk_size' | 'strategy' | 'concurrency'
  message: string
  priority: 'high' | 'medium' | 'low'
  action?: () => void
}

export function useTtsOptimizer() {
  const metrics = reactive<TtsMetrics>({
    totalChunks: 0,
    totalCharacters: 0,
    totalPlayTime: 0,
    averageLatencyPerChar: 0,
    queueLength: 0,
    smallChunksCount: 0
  })

  const isOptimizing = ref(false)
  const suggestions = ref<OptimizationSuggestion[]>([])

  // 记录TTS性能数据
  const recordTtsPerformance = (chunkSize: number, playTime: number) => {
    metrics.totalChunks++
    metrics.totalCharacters += chunkSize
    metrics.totalPlayTime += playTime
    metrics.averageLatencyPerChar = metrics.totalPlayTime / metrics.totalCharacters

    if (chunkSize < 100) {
      metrics.smallChunksCount++
    }

    console.log(
      `[TTS优化器] 记录性能: ${chunkSize}字符, ${playTime}ms, 平均延迟: ${metrics.averageLatencyPerChar.toFixed(2)}ms/字符`
    )

    // 触发性能分析
    analyzePerformance()
  }

  // 更新队列长度
  const updateQueueLength = (length: number) => {
    metrics.queueLength = length
  }

  // 性能分析和建议生成
  const analyzePerformance = () => {
    suggestions.value = []

    // 检查小块比例
    const smallChunkRatio = metrics.smallChunksCount / metrics.totalChunks
    if (smallChunkRatio > 0.3) {
      suggestions.value.push({
        type: 'chunk_size',
        message: `小文本块过多 (${(smallChunkRatio * 100).toFixed(1)}%)，建议增加分块大小`,
        priority: 'high'
      })
    }

    // 检查平均延迟
    if (metrics.averageLatencyPerChar > 150) {
      suggestions.value.push({
        type: 'strategy',
        message: `TTS延迟过高 (${metrics.averageLatencyPerChar.toFixed(0)}ms/字符)，建议优化网络或切换TTS服务`,
        priority: 'high'
      })
    }

    // 检查队列长度
    if (metrics.queueLength > 10) {
      suggestions.value.push({
        type: 'chunk_size',
        message: `队列过长 (${metrics.queueLength}项)，建议增加分块大小减少队列项目`,
        priority: 'medium'
      })
    }

    // 检查并发性能
    if (metrics.averageLatencyPerChar > 100 && metrics.queueLength > 5) {
      suggestions.value.push({
        type: 'concurrency',
        message: '可考虑增加并发处理数量以提高效率',
        priority: 'medium'
      })
    }
  }

  // 自动优化建议
  const getOptimalChunkSize = computed(() => {
    if (metrics.averageLatencyPerChar < 80) {
      return 150 // 低延迟环境，可以使用较小块
    } else if (metrics.averageLatencyPerChar < 120) {
      return 250 // 中等延迟，使用中等块
    } else {
      return 400 // 高延迟环境，使用大块
    }
  })

  // 性能评分
  const performanceScore = computed(() => {
    let score = 100

    // 延迟惩罚
    if (metrics.averageLatencyPerChar > 100) {
      score -= Math.min(50, (metrics.averageLatencyPerChar - 100) / 2)
    }

    // 小块惩罚
    const smallChunkRatio = metrics.smallChunksCount / (metrics.totalChunks || 1)
    score -= smallChunkRatio * 30

    // 队列长度惩罚
    if (metrics.queueLength > 8) {
      score -= Math.min(20, (metrics.queueLength - 8) * 2)
    }

    return Math.max(0, Math.round(score))
  })

  // 重置统计
  const resetMetrics = () => {
    Object.assign(metrics, {
      totalChunks: 0,
      totalCharacters: 0,
      totalPlayTime: 0,
      averageLatencyPerChar: 0,
      queueLength: 0,
      smallChunksCount: 0
    })
    suggestions.value = []
  }

  // 获取性能报告
  const getPerformanceReport = () => {
    return {
      metrics: { ...metrics },
      suggestions: [...suggestions.value],
      score: performanceScore.value,
      optimalChunkSize: getOptimalChunkSize.value
    }
  }

  return {
    metrics,
    suggestions,
    performanceScore,
    getOptimalChunkSize,
    isOptimizing,
    recordTtsPerformance,
    updateQueueLength,
    analyzePerformance,
    resetMetrics,
    getPerformanceReport
  }
}
