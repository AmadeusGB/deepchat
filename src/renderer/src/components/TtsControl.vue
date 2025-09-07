<template>
  <div class="tts-control">
    <!-- TTS状态指示器 -->
    <div v-if="tts.isActive" class="tts-status">
      <div class="status-indicator" :class="statusClass">
        <div v-if="tts.state.isPlaying" class="pulse"></div>
      </div>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- TTS控制按钮 -->
    <div v-if="tts.isActive" class="tts-controls">
      <!-- 播放/暂停按钮 -->
      <button
        :disabled="!tts.canControl"
        class="control-btn primary"
        :title="tts.state.isPlaying ? '暂停' : '恢复'"
        @click="togglePlayback"
      >
        <PlayIcon v-if="!tts.state.isPlaying" />
        <PauseIcon v-else />
      </button>

      <!-- 停止按钮 -->
      <button :disabled="!tts.canControl" class="control-btn" title="停止" @click="tts.stop">
        <StopIcon />
      </button>

      <!-- 跳过按钮 -->
      <button :disabled="!tts.canControl" class="control-btn" title="跳过当前" @click="tts.skip">
        <SkipIcon />
      </button>

      <!-- 音量控制 -->
      <div class="volume-control">
        <VolumeIcon />
        <input
          type="range"
          min="0"
          max="100"
          :value="volumePercent"
          class="volume-slider"
          @input="updateVolume"
        />
        <span class="volume-text">{{ volumePercent }}%</span>
      </div>
    </div>

    <!-- 策略选择 -->
    <div v-if="tts.isActive && showAdvanced" class="strategy-control">
      <label>播放策略：</label>
      <select :value="tts.state.strategy" class="strategy-select" @change="updateStrategy">
        <option value="realtime">实时模式（最低延迟）</option>
        <option value="balanced">平衡模式（推荐）</option>
        <option value="precise">精确模式（完整句子）</option>
      </select>
    </div>

    <!-- 队列状态 -->
    <div v-if="tts.isActive && tts.state.queueLength > 0" class="queue-status">
      <span>队列：{{ tts.state.queueLength }} 个音频块</span>
      <div class="queue-progress">
        <div class="progress-bar" :style="{ width: progressWidth }"></div>
      </div>
    </div>

    <!-- 当前播放文本 -->
    <div v-if="tts.state.currentText" class="current-text">
      <span class="text-label">正在播放：</span>
      <span class="text-content">{{ truncatedCurrentText }}</span>
    </div>

    <!-- 高级选项切换 -->
    <button v-if="tts.isActive" class="advanced-toggle" @click="showAdvanced = !showAdvanced">
      {{ showAdvanced ? '隐藏高级选项' : '显示高级选项' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatStore } from '@/stores/chat'

// 图标组件（简化版，实际应该使用图标库）
const PlayIcon = () => '▶️'
const PauseIcon = () => '⏸️'
const StopIcon = () => '⏹️'
const SkipIcon = () => '⏭️'
const VolumeIcon = () => '🔊'

const chatStore = useChatStore()
const { tts } = chatStore

const showAdvanced = ref(false)

// 计算属性
const statusClass = computed(() => {
  const status = tts.state.status
  return {
    'status-idle': status === 'idle',
    'status-processing': status === 'processing',
    'status-playing': status === 'playing',
    'status-paused': status === 'paused',
    'status-error': status === 'error'
  }
})

const statusText = computed(() => {
  const state = tts.state
  if (state.isPlaying) return '正在播放'
  if (state.isPaused) return '已暂停'
  if (state.status === 'processing') return '处理中'
  if (state.status === 'error') return '错误'
  return '就绪'
})

const volumePercent = computed(() => Math.round(tts.state.volume * 100))

const progressWidth = computed(() => {
  // 简化的进度计算，实际可能需要更复杂的逻辑
  const queueLength = tts.state.queueLength
  if (queueLength === 0) return '0%'
  return `${Math.max(10, 100 - queueLength * 10)}%`
})

const truncatedCurrentText = computed(() => {
  const text = tts.state.currentText
  return text.length > 50 ? text.substring(0, 50) + '...' : text
})

// 方法
const togglePlayback = () => {
  if (tts.state.isPlaying) {
    tts.pause()
  } else {
    tts.resume()
  }
}

const updateVolume = (event: Event) => {
  const target = event.target as HTMLInputElement
  const volume = parseInt(target.value) / 100
  tts.setVolume(volume)
}

const updateStrategy = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const strategy = target.value as 'realtime' | 'balanced' | 'precise'
  tts.setStrategy(strategy)
}
</script>

<style scoped>
.tts-control {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  font-size: 14px;
}

.tts-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-indicator {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.status-indicator.status-idle {
  background: #6b7280;
}

.status-indicator.status-processing {
  background: #f59e0b;
}

.status-indicator.status-playing {
  background: #10b981;
}

.status-indicator.status-paused {
  background: #f97316;
}

.status-indicator.status-error {
  background: #ef4444;
}

.pulse {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: inherit;
  opacity: 0.6;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.3;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.status-text {
  color: var(--color-text);
  font-weight: 500;
}

.tts-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 32px;
}

.control-btn:hover:not(:disabled) {
  background: var(--color-background-soft);
  border-color: var(--color-border-hover);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.control-btn.primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.volume-slider {
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  outline: none;
  cursor: pointer;
}

.volume-text {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 30px;
}

.strategy-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.strategy-control label {
  color: var(--color-text);
  font-weight: 500;
}

.strategy-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 12px;
}

.queue-status {
  margin-bottom: 12px;
}

.queue-status span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.queue-progress {
  width: 100%;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.current-text {
  margin-bottom: 12px;
  padding: 8px;
  background: var(--color-background-mute);
  border-radius: 4px;
  font-size: 12px;
}

.text-label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.text-content {
  color: var(--color-text);
  margin-left: 8px;
  font-style: italic;
}

.advanced-toggle {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.advanced-toggle:hover {
  background: var(--color-background-soft);
  color: var(--color-text);
}
</style>
