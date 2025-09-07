<template>
  <div v-if="showMonitor" class="parallel-tts-monitor">
    <div class="monitor-header">
      <h3>🎵 并行TTS监控</h3>
      <button class="close-btn" @click="toggleMonitor">×</button>
    </div>

    <div class="monitor-content">
      <!-- 状态概览 -->
      <div class="status-overview">
        <div class="status-item">
          <span class="label">总块数:</span>
          <span class="value">{{ status.totalChunks }}</span>
        </div>
        <div class="status-item">
          <span class="label">处理中:</span>
          <span class="value processing">{{ status.processingChunks }}</span>
        </div>
        <div class="status-item">
          <span class="label">就绪:</span>
          <span class="value ready">{{ status.readyChunks }}</span>
        </div>
        <div class="status-item">
          <span class="label">错误:</span>
          <span class="value error">{{ status.errorChunks }}</span>
        </div>
        <div class="status-item">
          <span class="label">队列长度:</span>
          <span class="value">{{ status.queueLength }}</span>
        </div>
        <div class="status-item">
          <span class="label">失败率:</span>
          <span :class="['value', failureRateClass]">{{ status.failureRate.recent }}%</span>
        </div>
      </div>

      <!-- 并发状态 -->
      <div class="concurrency-status">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: concurrencyPercentage + '%' }"></div>
          <span class="progress-text"
            >并发: {{ status.activeRequests }}/{{ status.config?.maxConcurrent || 8 }}</span
          >
        </div>
      </div>

      <!-- 播放状态 -->
      <div class="playback-status">
        <div :class="['status-indicator', { active: status.isPlaying }]">
          {{ status.isPlaying ? '🔊 播放中' : '⏸️ 暂停' }}
        </div>
      </div>

      <!-- 性能指标 -->
      <div class="performance-metrics">
        <div class="metric">
          <span class="metric-label">平均延迟:</span>
          <span class="metric-value">{{ averageLatency }}ms/字符</span>
        </div>
        <div class="metric">
          <span class="metric-label">总处理时间:</span>
          <span class="metric-value">{{ totalProcessingTime }}s</span>
        </div>
        <div class="metric">
          <span class="metric-label">效率评分:</span>
          <span :class="['metric-value', efficiencyClass]">{{ efficiencyScore }}/100</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 浮动按钮 -->
  <button v-if="!showMonitor" class="monitor-toggle-btn" @click="toggleMonitor">📊 TTS监控</button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { parallelTtsService } from '@/lib/parallelTtsService'

// 监控状态
const showMonitor = ref(false)
const status = ref({
  totalChunks: 0,
  readyChunks: 0,
  processingChunks: 0,
  errorChunks: 0,
  queueLength: 0,
  isPlaying: false,
  activeRequests: 0,
  failureRate: { recent: 0, overall: 0 },
  config: { maxConcurrent: 3, timeoutMs: 15000, maxRetries: 3 },
  stats: { totalAttempts: 0, totalFailures: 0 }
})

// 性能数据
const performanceData = ref({
  totalLatency: 0,
  totalCharacters: 0,
  totalTime: 0,
  requestCount: 0
})

// 更新状态
const updateStatus = () => {
  status.value = parallelTtsService.getStatus()
}

// 计算属性
const concurrencyPercentage = computed(() => {
  const maxConcurrent = status.value.config?.maxConcurrent || 8
  return (status.value.activeRequests / maxConcurrent) * 100
})

const averageLatency = computed(() => {
  if (performanceData.value.totalCharacters === 0) return 0
  return Math.round(performanceData.value.totalLatency / performanceData.value.totalCharacters)
})

const totalProcessingTime = computed(() => {
  return Math.round(performanceData.value.totalTime / 1000)
})

const efficiencyScore = computed(() => {
  const latency = averageLatency.value
  if (latency === 0) return 100

  // 根据延迟计算效率分数
  // 50ms/字符 = 100分，200ms/字符 = 0分
  const score = Math.max(0, Math.min(100, 100 - ((latency - 50) / 150) * 100))
  return Math.round(score)
})

const efficiencyClass = computed(() => {
  const score = efficiencyScore.value
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
})

// 🔧 失败率样式类
const failureRateClass = computed(() => {
  const rate = status.value.failureRate.recent
  if (rate <= 5) return 'excellent'
  if (rate <= 15) return 'good'
  if (rate <= 30) return 'fair'
  return 'poor'
})

// 切换监控显示
const toggleMonitor = () => {
  showMonitor.value = !showMonitor.value
}

// 模拟性能数据更新（实际应该从TTS服务获取）
const simulatePerformanceUpdate = () => {
  // 这里应该从实际的TTS服务获取性能数据
  // 暂时使用模拟数据
  performanceData.value = {
    totalLatency: 15000, // 模拟总延迟
    totalCharacters: 500, // 模拟总字符数
    totalTime: 25000, // 模拟总时间
    requestCount: 5 // 模拟请求数
  }
}

// 定时器
let updateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 每500ms更新一次状态
  updateInterval = setInterval(() => {
    updateStatus()
    simulatePerformanceUpdate()
  }, 500)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
.parallel-tts-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #333;
  border-radius: 8px;
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  background: rgba(255, 255, 255, 0.1);
}

.monitor-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: bold;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.monitor-content {
  padding: 12px;
}

.status-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
  /* 🔧 自动适应行数以容纳更多状态项 */
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.label {
  color: #ccc;
}

.value {
  font-weight: bold;
}

.value.processing {
  color: #ffa500;
}

.value.ready {
  color: #00ff00;
}

.value.error {
  color: #ff4444;
}

.concurrency-status {
  margin-bottom: 12px;
}

.progress-bar {
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00ff00, #ffa500);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
}

.playback-status {
  margin-bottom: 12px;
  text-align: center;
}

.status-indicator {
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: rgba(0, 255, 0, 0.2);
  border: 1px solid #00ff00;
}

.performance-metrics {
  border-top: 1px solid #333;
  padding-top: 12px;
}

.metric {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.metric-label {
  color: #ccc;
}

.metric-value {
  font-weight: bold;
}

.metric-value.excellent {
  color: #00ff00;
}

.metric-value.good {
  color: #90ee90;
}

.metric-value.fair {
  color: #ffa500;
}

.metric-value.poor {
  color: #ff4444;
}

.monitor-toggle-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  border-radius: 6px;
  color: white;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.monitor-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: #555;
}
</style>
