<template>
  <div v-if="showMonitor" class="tts-performance-monitor">
    <div class="monitor-header">
      <Icon icon="lucide:activity" class="w-4 h-4" />
      <span class="text-sm font-medium">TTS 性能监控</span>
      <button class="ml-auto" @click="toggleMonitor">
        <Icon icon="lucide:x" class="w-3 h-3" />
      </button>
    </div>

    <div class="metrics-grid">
      <div class="metric-item">
        <span class="metric-label">平均延迟</span>
        <span class="metric-value">{{ averageLatency }}ms</span>
      </div>

      <div class="metric-item">
        <span class="metric-label">字符效率</span>
        <span class="metric-value">{{ characterEfficiency }}ms/字符</span>
      </div>

      <div class="metric-item">
        <span class="metric-label">队列长度</span>
        <span class="metric-value">{{ queueLength }}</span>
      </div>

      <div class="metric-item">
        <span class="metric-label">处理策略</span>
        <span class="metric-value">{{ currentStrategy }}</span>
      </div>
    </div>

    <div v-if="recommendations.length > 0" class="recommendations">
      <div class="recommendations-header">
        <Icon icon="lucide:lightbulb" class="w-4 h-4" />
        <span class="text-sm font-medium">优化建议</span>
      </div>
      <ul class="recommendation-list">
        <li v-for="(rec, index) in recommendations" :key="index" class="recommendation-item">
          {{ rec }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'

interface PerformanceMetrics {
  latency: number
  textLength: number
  timestamp: number
}

const props = defineProps<{
  visible?: boolean
  metrics?: PerformanceMetrics[]
  queueLength?: number
  strategy?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const showMonitor = ref(props.visible ?? false)
const performanceHistory = ref<PerformanceMetrics[]>(props.metrics ?? [])

const averageLatency = computed(() => {
  if (performanceHistory.value.length === 0) return 0
  const total = performanceHistory.value.reduce((sum, m) => sum + m.latency, 0)
  return Math.round(total / performanceHistory.value.length)
})

const characterEfficiency = computed(() => {
  if (performanceHistory.value.length === 0) return 0
  const totalLatency = performanceHistory.value.reduce((sum, m) => sum + m.latency, 0)
  const totalChars = performanceHistory.value.reduce((sum, m) => sum + m.textLength, 0)
  return totalChars > 0 ? Math.round(totalLatency / totalChars) : 0
})

const queueLength = computed(() => props.queueLength ?? 0)
const currentStrategy = computed(() => props.strategy ?? 'balanced')

const recommendations = computed(() => {
  const recs: string[] = []

  if (characterEfficiency.value > 200) {
    recs.push('建议增加文本块大小以减少API开销')
  }

  if (queueLength.value > 5) {
    recs.push('队列过长，建议优化分块策略')
  }

  if (averageLatency.value > 10000) {
    recs.push('延迟过高，建议检查网络连接或切换到更快的策略')
  }

  if (performanceHistory.value.length > 0) {
    const recentMetrics = performanceHistory.value.slice(-5)
    const avgRecentLatency =
      recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length

    if (avgRecentLatency > averageLatency.value * 1.5) {
      recs.push('最近性能下降，建议重启TTS服务')
    }
  }

  return recs
})

const toggleMonitor = () => {
  showMonitor.value = !showMonitor.value
  if (!showMonitor.value) {
    emit('close')
  }
}

// 监听外部传入的metrics变化
watch(
  () => props.metrics,
  (newMetrics) => {
    if (newMetrics) {
      performanceHistory.value = newMetrics
    }
  },
  { deep: true }
)

// 监听visible属性变化
watch(
  () => props.visible,
  (newVisible) => {
    showMonitor.value = newVisible ?? false
  }
)
</script>

<style scoped>
.tts-performance-monitor {
  @apply fixed top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-80 z-50;
}

.monitor-header {
  @apply flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700;
}

.metrics-grid {
  @apply grid grid-cols-2 gap-3 mb-4;
}

.metric-item {
  @apply flex flex-col;
}

.metric-label {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.metric-value {
  @apply text-sm font-semibold text-gray-900 dark:text-gray-100;
}

.recommendations {
  @apply border-t border-gray-200 dark:border-gray-700 pt-3;
}

.recommendations-header {
  @apply flex items-center gap-2 mb-2;
}

.recommendation-list {
  @apply space-y-1;
}

.recommendation-item {
  @apply text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1;
}
</style>
