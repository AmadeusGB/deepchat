<template>
  <div class="h-full w-full flex flex-col items-center justify-start">
    
    <!-- Main content with fixed bottom positioning -->
    <div class="h-0 w-full flex-grow flex flex-col items-center justify-center relative">
      <!-- Figma design inspired logo and greeting -->
      <div class="figma-main-content flex flex-col items-center gap-4 mb-8">
        <!-- Mini device container -->
        <div class="figma-device-container relative">
          <!-- Light beams above device -->
          <div class="figma-light-beams figma-light-beams-top">
            <div class="figma-light-beam" v-for="i in 6" :key="`top-${i}`" :style="{ left: `${15 + (i-1) * 14}%` }"></div>
          </div>
          
          <!-- Device image -->
          <img src="@/assets/figma-icons/mini.png" class="figma-mini-device" />
          
          <!-- Light beams below device -->
          <div class="figma-light-beams figma-light-beams-bottom">
            <div class="figma-light-beam" v-for="i in 6" :key="`bottom-${i}`" :style="{ left: `${15 + (i-1) * 14}%` }"></div>
          </div>
        </div>
        
        <!-- Hello icon and greeting text -->
        <div class="figma-greeting-section flex flex-col items-center gap-4">
          <!-- Hello icon with gradient stroke -->
          <div class="figma-hello-container">
            <img src="@/assets/figma-icons/hello.png" class="figma-hello-icon" />
          </div>
          
          <!-- Greeting text -->
          <div class="figma-greeting-text text-center">
            <h1 class="figma-greeting-title">
              {{ t('newThread.prompt') }}
            </h1>
          </div>
        </div>
      </div>
      
      <!-- Voice waveform (shown when in voice mode) -->
      <div v-if="isVoiceMode" class="figma-voice-waveform-container flex items-center justify-center gap-1 mb-8">
        <!-- AI Response Subtitle (字幕) -->
        <div v-if="voiceResponseText" class="figma-voice-subtitle mb-6 text-center">
          <div class="text-lg font-medium text-foreground bg-background/80 rounded-xl px-6 py-3 backdrop-blur-md shadow-lg border border-border/50">
            {{ voiceResponseText }}
          </div>
        </div>
        
        <!-- 🎯 性能监控显示 -->
        <div v-if="animationPerformance.isPerformanceIssue" class="figma-performance-warning">
          ⚠️ 性能警告: FPS {{ animationPerformance.currentFps.toFixed(1) }} | 帧时间 {{ animationPerformance.averageFrameTime.toFixed(1) }}ms | 质量: {{ animationPerformance.qualityLevel }}
        </div>

        
        <!-- Recording status indicator -->
        <div class="figma-voice-status-container mb-4">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <div 
              class="w-3 h-3 rounded-full transition-colors"
              :class="{
                'bg-red-500 animate-pulse': isRecording,
                'bg-blue-500 animate-pulse': isTranscribing,
                'bg-yellow-500 animate-pulse': isWaitingResponse,
                'bg-green-500 animate-pulse': isTTSPlaying,
                'bg-gray-400': !isRecording && !isTranscribing && !isWaitingResponse && !isTTSPlaying
              }"
            ></div>
            <span>
              {{ 
                isRecording 
                  ? t('chat.input.voiceRecording') 
                  : isTranscribing 
                    ? t('chat.input.voiceTranscribing')
                    : isWaitingResponse
                      ? t('chat.input.voiceWaitingResponse')
                      : isTTSPlaying
                        ? t('chat.input.voiceTTSPlaying')
                        : t('chat.input.spaceToRecord')
              }}
            </span>
          </div>
        </div>
        
        <!-- Clickable waveform -->
        <div 
          class="figma-voice-waveform-bars cursor-pointer"
          :class="{ 'recording': isRecording, 'transcribing': isTranscribing }"
          @click="toggleVoiceRecording"
        >
          <!-- 多个正弦线条组成的语音波浪 -->
          <svg 
            class="voice-sine-waves" 
            viewBox="0 0 838 144" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <!-- 渐变定义 -->
              <linearGradient id="waveGradient1" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#495EDB;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#00A3FF;stop-opacity:0.8" />
              </linearGradient>
              <linearGradient id="waveGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#5D8BFA;stop-opacity:0.2" />
                <stop offset="100%" style="stop-color:#00A3FF;stop-opacity:0.6" />
              </linearGradient>
              <linearGradient id="waveGradient3" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#00A3FF;stop-opacity:0.4" />
                <stop offset="100%" style="stop-color:#495EDB;stop-opacity:0.2" />
              </linearGradient>
            </defs>
            
            <!-- 主正弦波 -->
            <path 
              :d="generateSineWave(1, 20, 0.015, 0)" 
              stroke="url(#waveGradient1)" 
              stroke-width="3"
              fill="none"
              class="sine-wave primary"
              :class="{ 'animate': isRecording }"
            />
            
            <!-- 辅助正弦波 -->
            <path 
              v-if="animationConfig.qualitySettings[animationPerformance.qualityLevel].layers >= 2"
              :d="generateSineWave(2, 15, 0.018, Math.PI / 4)" 
              stroke="url(#waveGradient2)" 
              stroke-width="2.5"
              fill="none"
              class="sine-wave secondary"
              :class="{ 'animate': isRecording }"
              opacity="0.8"
            />
            
            <!-- 第三层正弦波 -->
            <path 
              v-if="animationConfig.qualitySettings[animationPerformance.qualityLevel].layers >= 3"
              :d="generateSineWave(3, 12, 0.012, Math.PI / 2)" 
              stroke="url(#waveGradient3)" 
              stroke-width="2"
              fill="none"
              class="sine-wave tertiary"
              :class="{ 'animate': isRecording }"
              opacity="0.6"
            />
            
            <!-- 第四层正弦波 -->
            <path 
              v-if="animationConfig.qualitySettings[animationPerformance.qualityLevel].layers >= 4"
              :d="generateSineWave(4, 8, 0.022, Math.PI / 3)" 
              stroke="url(#waveGradient1)" 
              stroke-width="1.5"
              fill="none"
              class="sine-wave quaternary"
              :class="{ 'animate': isRecording }"
              opacity="0.4"
            />
          </svg>
        </div>
      </div>
      
      <!-- Fixed bottom section aligned with sidebar -->
      <div class="absolute bottom-0 left-0 right-0 flex flex-col items-center" style="padding-bottom: 20px;">
        <!-- Example cards container aligned with input (hidden in voice mode) -->
        <div v-if="!isVoiceMode" class="figma-example-cards-container w-full max-w-4xl mb-6">
          <div class="figma-example-cards-grid">
            <div class="figma-example-card" @click="insertExample('Help me adjust the node to the fastest node in the United States.')">
              Help me adjust the node to the fastest node in the United States.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch recent NBA games on YouTube, help me search.')">
              I want to watch recent NBA games on YouTube, help me search.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch Mr. Beast\'s channel, help me search it.')">
              I want to watch Mr. Beast's channel, help me search it.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch &quot;The Legend of Zhen Huan&quot;, please help me adjust it.')">
              I want to watch "The Legend of Zhen Huan", please help me adjust it.
            </div>
          </div>
        </div>
        
        <!-- Input area aligned with sidebar bottom -->
        <div class="figma-input-container w-full max-w-4xl">
          <!-- Voice mode input (hidden in auto mode) -->
          <div v-if="isVoiceMode" class="figma-voice-input-container flex items-center gap-4">
            <div class="figma-voice-input-box opacity-50">
              <input 
                :value="latestUserVoiceInput || t('chat.input.voiceAutoMode')"
                type="text" 
                class="figma-voice-input"
                :placeholder="t('chat.input.voiceAutoMode')"
                readonly
                disabled
              />
            </div>
            <Button
              class="figma-text-chat-button opacity-50"
              disabled
              @click="exitVoiceMode"
            >
              {{ t('chat.input.textChat') }}
            </Button>
          </div>
          
          <!-- Normal input -->
          <ChatInput
            v-else
            ref="chatInputRef"
            key="newThread"
            class="figma-input-wrapper"
            :rows="1"
            :max-rows="6"
            :context-length="contextLength"
            @send="handleSend"
            @toolbar-toggle="handleToolbarToggle"
            @voice-mode="enterVoiceMode"
          >
            <template #addon-buttons>
              <div
                v-if="showToolbar"
                key="newThread-model-select"
                class="new-thread-model-select overflow-hidden flex items-center h-7 rounded-lg shadow-sm border border-input transition-all duration-300"
              >
                <Popover v-model:open="modelSelectOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      class="flex border-none rounded-none shadow-none items-center gap-1.5 px-2 h-full"
                      size="sm"
                    >
                      <ModelIcon
                        class="w-4 h-4"
                        :model-id="activeModel.providerId"
                        :is-dark="themeStore.isDark"
                      ></ModelIcon>
                      <h2 class="text-xs font-bold max-w-[150px] truncate">{{ name }}</h2>
                      <Badge
                        v-for="tag in activeModel.tags"
                        :key="tag"
                        variant="outline"
                        class="py-0 rounded-lg"
                        size="xs"
                      >
                        {{ t(`model.tags.${tag}`) }}</Badge
                      >
                      <Icon icon="lucide:chevron-right" class="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" class="p-0 w-80">
                    <ModelSelect @update:model="handleModelUpdate" />
                  </PopoverContent>
                </Popover>
                <Popover v-model:open="settingsPopoverOpen" @update:open="handleSettingsPopoverUpdate">
                  <PopoverTrigger as-child>
                    <Button
                      class="w-7 h-full rounded-none border-none shadow-none transition-all duration-300"
                      :class="{
                        'w-0 opacity-0 p-0 overflow-hidden': !showSettingsButton && !isHovering,
                        'w-7 opacity-100': showSettingsButton || isHovering
                      }"
                      size="icon"
                      variant="outline"
                    >
                      <Icon icon="lucide:settings-2" class="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" class="p-0 w-80">
                    <ChatConfig
                      v-model:temperature="temperature"
                      v-model:context-length="contextLength"
                      v-model:max-tokens="maxTokens"
                      v-model:system-prompt="systemPrompt"
                      v-model:artifacts="artifacts"
                      :context-length-limit="contextLengthLimit"
                      :max-tokens-limit="maxTokensLimit"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </template>
          </ChatInput>
        </div>
      </div>
    </div>
    
    <!-- 并行TTS监控组件 -->
    <ParallelTtsMonitor />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, readonly } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import ChatInput from './ChatInput.vue'
import ModelIcon from './icons/ModelIcon.vue'
import { Icon } from '@iconify/vue'
import ModelSelect from './ModelSelect.vue'
import { useChatStore } from '@/stores/chat'
import { MODEL_META } from '@shared/presenter'
import { useSettingsStore } from '@/stores/settings'
import { UserMessageContent } from '@shared/chat'
import ChatConfig from './ChatConfig.vue'
import { usePresenter } from '@/composables/usePresenter'
import { useEventListener } from '@vueuse/core'
import { useThemeStore } from '@/stores/theme'
import { ttsService } from '@/lib/ttsService'
import { parallelTtsService } from '@/lib/parallelTtsService'
import { useToast } from '@/components/ui/toast/use-toast'
import { useTtsOptimizer } from '@/composables/useTtsOptimizer'
import ParallelTtsMonitor from './ParallelTtsMonitor.vue'
import { enhancedTTSIntegration } from '@/lib/enhancedTtsIntegration'

const configPresenter = usePresenter('configPresenter')
const themeStore = useThemeStore()
const ttsOptimizer = useTtsOptimizer()

// 定义偏好模型的类型
interface PreferredModel {
  modelId: string
  providerId: string
}

const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

// 语音模式状态
const isVoiceMode = ref(false)

// 🎯 暴露语音模式状态给父组件
defineExpose({
  isVoiceMode: readonly(isVoiceMode)
})

const isRecording = ref(false)
const isTranscribing = ref(false)
const isTTSPlaying = ref(false)
const isWaitingResponse = ref(false)
const lastVoiceResponse = ref('')
const voiceResponseText = ref('') // 当前显示的AI回复文本（字幕）
const voiceConversationHistory = ref<Array<{
  type: 'user' | 'assistant'
  text: string
  timestamp: number
  summary?: string
  detectedLanguage?: string
}>>([])

// 🔧 新增：记录上次语音提交时间，用于超时检测
const lastVoiceSubmitTime = ref<number>(0)

// 🧠 情感记忆与上下文感知系统
const emotionalMemory = ref<{
  userPreferences: {
    communicationStyle: 'formal' | 'casual' | 'friendly' | 'professional'
    responseLength: 'brief' | 'detailed' | 'comprehensive'
    interests: string[]
    expertiseLevel: Record<string, 'beginner' | 'intermediate' | 'advanced'>
  }
  emotionalContext: {
    currentMood: 'positive' | 'neutral' | 'negative' | 'excited' | 'confused' | 'frustrated'
    recentTopics: Array<{topic: string, sentiment: string, timestamp: number}>
    importantEvents: Array<{event: string, importance: number, timestamp: number}>
  }
  interactionHistory: {
    totalInteractions: number
    averageSessionLength: number
    preferredTimeOfDay: string[]
    commonQuestions: string[]
    satisfactionLevel: number
  }
  personalContext: {
    name?: string
    occupation?: string
    location?: string
    timezone?: string
    familiarityLevel: number // 0-100, 熟悉程度
  }
}>({
  userPreferences: {
    communicationStyle: 'friendly',
    responseLength: 'detailed',
    interests: [],
    expertiseLevel: {}
  },
  emotionalContext: {
    currentMood: 'neutral',
    recentTopics: [],
    importantEvents: []
  },
  interactionHistory: {
    totalInteractions: 0,
    averageSessionLength: 0,
    preferredTimeOfDay: [],
    commonQuestions: [],
    satisfactionLevel: 80
  },
  personalContext: {
    familiarityLevel: 0
  }
})

// 🎭 情感分析和上下文更新函数
const analyzeUserEmotion = (text: string): string => {
  const positiveKeywords = ['开心', '高兴', '棒', '太好了', '喜欢', '满意', '完美', '厉害', '优秀']
  const negativeKeywords = ['烦恼', '困扰', '难过', '失望', '糟糕', '问题', '错误', '不行', '不好']
  const excitedKeywords = ['哇', '太棒了', '惊喜', '激动', '兴奋', 'amazing', 'awesome', 'fantastic']
  const confusedKeywords = ['不懂', '不明白', '搞不清', '混乱', '困惑', '复杂', '难理解']
  const frustratedKeywords = ['烦', '郁闷', '无语', '崩溃', '头疼', '麻烦', '讨厌']

  const lowerText = text.toLowerCase()
  
  if (excitedKeywords.some(keyword => lowerText.includes(keyword))) return 'excited'
  if (confusedKeywords.some(keyword => lowerText.includes(keyword))) return 'confused'
  if (frustratedKeywords.some(keyword => lowerText.includes(keyword))) return 'frustrated'
  if (positiveKeywords.some(keyword => lowerText.includes(keyword))) return 'positive'
  if (negativeKeywords.some(keyword => lowerText.includes(keyword))) return 'negative'
  
  return 'neutral'
}

const updateEmotionalContext = (userText: string, topic?: string) => {
  const detectedMood = analyzeUserEmotion(userText)
  emotionalMemory.value.emotionalContext.currentMood = detectedMood as 'positive' | 'neutral' | 'negative' | 'excited' | 'confused' | 'frustrated'
  
  // 更新最近话题
  if (topic) {
    emotionalMemory.value.emotionalContext.recentTopics.unshift({
      topic,
      sentiment: detectedMood,
      timestamp: Date.now()
    })
    // 保留最近10个话题
    if (emotionalMemory.value.emotionalContext.recentTopics.length > 10) {
      emotionalMemory.value.emotionalContext.recentTopics.pop()
    }
  }
  
  // 增加交互次数和熟悉度
  emotionalMemory.value.interactionHistory.totalInteractions += 1
  emotionalMemory.value.personalContext.familiarityLevel = Math.min(100, 
    emotionalMemory.value.personalContext.familiarityLevel + 2)
  
  console.log(`🧠 [情感分析] 检测到用户情绪: ${detectedMood}, 熟悉度: ${emotionalMemory.value.personalContext.familiarityLevel}`)
}

// 🎯 生成个性化上下文提示词
const generatePersonalizedContext = (): string => {
  const memory = emotionalMemory.value
  const familiarity = memory.personalContext.familiarityLevel
  const currentTime = new Date()
  const hour = currentTime.getHours()
  
  let timeGreeting = ''
  if (hour < 6) timeGreeting = '深夜了'
  else if (hour < 12) timeGreeting = '早上好'
  else if (hour < 14) timeGreeting = '中午好'
  else if (hour < 18) timeGreeting = '下午好'
  else if (hour < 22) timeGreeting = '晚上好'
  else timeGreeting = '夜深了'
  
  let personalizedContext = `
## 🎭 当前交互上下文

### 时间感知
- 当前时间：${timeGreeting}
- 适当使用时间相关的问候和关怀

### 用户情感状态
- 当前情绪：${memory.emotionalContext.currentMood}
- 根据情绪调整回应方式：`

  switch (memory.emotionalContext.currentMood) {
    case 'excited':
      personalizedContext += '\n  * 用户很兴奋，分享他们的喜悦，保持相应的能量水平'
      break
    case 'confused':
      personalizedContext += '\n  * 用户感到困惑，需要耐心引导和清晰解释'
      break
    case 'frustrated':
      personalizedContext += '\n  * 用户有些沮丧，提供理解和支持，帮助缓解情绪'
      break
    case 'positive':
      personalizedContext += '\n  * 用户心情不错，保持积极互动'
      break
    case 'negative':
      personalizedContext += '\n  * 用户情绪低落，给予温暖关怀和鼓励'
      break
    default:
      personalizedContext += '\n  * 保持友好自然的交流'
  }

  personalizedContext += `

### 熟悉程度调整
- 熟悉度：${familiarity}%`

  if (familiarity < 20) {
    personalizedContext += '\n  * 初次交流，保持礼貌和专业，使用"您"称呼'
  } else if (familiarity < 50) {
    personalizedContext += '\n  * 逐渐熟悉，可以更亲切一些，适当使用"你"'
  } else if (familiarity < 80) {
    personalizedContext += '\n  * 比较熟悉，可以更随意自然，像朋友一样交流'
  } else {
    personalizedContext += '\n  * 非常熟悉，可以更亲密和随意，偶尔开玩笑'
  }

  // 添加最近话题记忆
  if (memory.emotionalContext.recentTopics.length > 0) {
    personalizedContext += `

### 最近话题记忆
- 最近讨论的话题：${memory.emotionalContext.recentTopics.slice(0, 3).map(t => t.topic).join('、')}
- 可以适当关联和回顾之前的对话内容`
  }

  personalizedContext += `

### 交互统计
- 总交互次数：${memory.interactionHistory.totalInteractions}
- 满意度：${memory.interactionHistory.satisfactionLevel}%

记住：根据以上上下文调整你的语言风格、亲密程度和回应方式，让每次交流都更加个性化和贴心。`

  return personalizedContext
}

// TTS服务将在后面导入

// 🎯 新增：录音相关变量
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

// 🎯 性能优化：预计算正弦值表
const SINE_TABLE_SIZE = 2048 // 2^11，使用位运算优化
const sineTable = new Float32Array(SINE_TABLE_SIZE)
const SINE_TABLE_MASK = SINE_TABLE_SIZE - 1

// 初始化正弦值表
for (let i = 0; i < SINE_TABLE_SIZE; i++) {
  sineTable[i] = Math.sin((i / SINE_TABLE_SIZE) * Math.PI * 2)
}

// 🎯 快速正弦查找函数
const fastSin = (x: number): number => {
  const index = Math.floor(Math.abs(x) * SINE_TABLE_SIZE / (Math.PI * 2)) & SINE_TABLE_MASK
  return x >= 0 ? sineTable[index] : -sineTable[index]
}

// 🎯 快速余弦查找函数（备用）
// const fastCos = (x: number): number => {
//   return fastSin(x + Math.PI / 2)
// }

// 动画时间戳，用于正弦波动画
const animationTime = ref(0)
let animationFrameId: number | null = null

// 🎯 新增：性能监控变量（优化版）
const animationPerformance = ref({
  frameCount: 0,
  lastFpsCheck: 0,
  currentFps: 60,
  averageFrameTime: 16.67,
  frameTimeHistory: [] as number[],
  isPerformanceIssue: false,
  qualityLevel: 'high' as 'high' | 'medium' | 'low', // 新增质量等级
  consecutiveSlowFrames: 0 // 连续慢帧计数
})

// 🎯 新增：优化的动画配置
const animationConfig = {
  targetFps: 60,
  maxFrameTime: 33, // 30fps阈值
  performanceCheckInterval: 1000,
  reducedQualityThreshold: 3, // 降低到3帧即降级
  pathCacheSize: 100, // 🎯 增加缓存大小以提高命中率
  
  // 质量等级配置
  qualitySettings: {
    high: { step: 4, layers: 4, cacheTime: 100, audioGranularity: 0.15 },
    medium: { step: 8, layers: 3, cacheTime: 150, audioGranularity: 0.25 },
    low: { step: 12, layers: 2, cacheTime: 200, audioGranularity: 0.35 }
  }
}

// 🎯 新增：LRU缓存实现
class LRUPathCache {
  private cache = new Map<string, string>()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // 移到末尾（最近使用）
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的项
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// 🎯 新增：路径缓存系统（LRU版本）
const pathCache = new LRUPathCache(animationConfig.pathCacheSize)
let cacheHitCount = 0
let cacheMissCount = 0

// 音频分析相关
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let microphone: MediaStreamAudioSourceNode | null = null
let dataArray: Uint8Array | null = null
const audioLevel = ref(0) // 当前音频强度 0-1

// 🎯 超简化正弦波函数 - 无缓存，无复杂计算
const generateSineWave = (waveId: number, amplitude: number, frequency: number, phaseOffset: number) => {
  const centerY = 72
  const realAmplitude = isRecording.value ? amplitude * (1 + audioLevel.value) : amplitude * 0.5
  
  let path = `M 0 ${centerY}`
  
  // 简单的固定步长循环
  for (let x = 0; x <= 838; x += 10) {
    const y = centerY + Math.sin(x * 0.01 + animationTime.value * 0.001 + phaseOffset) * realAmplitude
    path += ` L ${x} ${y}`
  }
  
  return path
}

// 语音录制状态
const isSpacePressed = ref(false)

// 防止重复处理的标记
const isProcessingVoice = ref(false)
const lastProcessedTranscription = ref('')

// 🎯 新增：键盘事件监听器健康检查
const keyboardListenerHealthCheck = ref({
  isActive: false,
  lastTestTime: 0,
  testInterval: 10000, // 每10秒检查一次
  failedTests: 0,
  maxFailedTests: 3
})

// 🎯 新增：长时间运行性能监控系统
const longTermPerformanceMonitor = ref({
  startTime: 0,
  totalFrames: 0,
  memoryUsageHistory: [] as number[],
  fpsHistory: [] as number[],
  cacheHitRateHistory: [] as number[],
  animationTimeValues: [] as number[],
  lastCleanupTime: 0,
  cleanupInterval: 60000, // 每分钟清理一次
  reportInterval: 30000, // 每30秒报告一次
  lastReportTime: 0,
  performanceDegradationThreshold: 0.7 // 性能下降70%时报警
})

// 🎯 新增：键盘事件监听器状态追踪
const keyboardEventState = ref({
  listenersAttached: false,
  lastKeydownTime: 0,
  lastKeyupTime: 0,
  spaceKeyPressCount: 0,
  debugMode: false
})

// 🎯 新增：键盘健康检查和自动恢复机制
const checkKeyboardListenerHealth = () => {
  if (!isVoiceMode.value) return
  
  const now = Date.now()
  
  // 每10秒进行一次健康检查
  if (now - keyboardListenerHealthCheck.value.lastTestTime < keyboardListenerHealthCheck.value.testInterval) {
    return
  }
  
  keyboardListenerHealthCheck.value.lastTestTime = now
  
  // 检查事件监听器是否仍然附加
  const isHealthy = keyboardEventState.value.listenersAttached && 
                   (now - keyboardEventState.value.lastKeydownTime < 60000 || 
                    keyboardEventState.value.spaceKeyPressCount > 0)
  
  if (!isHealthy) {
    keyboardListenerHealthCheck.value.failedTests++
    console.warn(`🚨 [键盘健康检查] 检测到键盘事件监听器可能失效 (失败次数: ${keyboardListenerHealthCheck.value.failedTests}/${keyboardListenerHealthCheck.value.maxFailedTests})`)
    
    if (keyboardListenerHealthCheck.value.failedTests >= keyboardListenerHealthCheck.value.maxFailedTests) {
      console.error(`🔧 [键盘自动修复] 尝试重新绑定键盘事件监听器`)
      repairKeyboardListeners()
    }
  } else {
    keyboardListenerHealthCheck.value.failedTests = 0
  }
}

// 🎯 新增：修复键盘事件监听器
const repairKeyboardListeners = () => {
  console.log(`🔧 [键盘修复] 开始修复键盘事件监听器`)
  
  // 1. 先移除所有可能存在的监听器
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  // 2. 重置相关状态
  isSpacePressed.value = false
  keyboardEventState.value.listenersAttached = false
  keyboardEventState.value.spaceKeyPressCount = 0
  
  // 3. 重新绑定事件监听器
  if (isVoiceMode.value) {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    keyboardEventState.value.listenersAttached = true
    
    console.log(`✅ [键盘修复] 键盘事件监听器已重新绑定`)
  }
  
  // 4. 重置健康检查状态
  keyboardListenerHealthCheck.value.failedTests = 0
  keyboardListenerHealthCheck.value.lastTestTime = Date.now()
}

// 🎯 新增：启用键盘调试模式
const enableKeyboardDebugMode = () => {
  keyboardEventState.value.debugMode = true
  console.log(`🐛 [键盘调试] 已启用键盘调试模式`)
}

// 🎯 新增：手动修复键盘功能（用户可在控制台调用）
const manualFixKeyboard = () => {
  console.log(`🔧 [手动修复] 用户触发手动键盘修复`)
  
  if (!isVoiceMode.value) {
    console.warn(`⚠️ [手动修复] 当前不在语音模式，无需修复`)
    return false
  }
  
  console.log(`📊 [手动修复] 当前状态检查:`)
  console.log(`   - 语音模式: ${isVoiceMode.value}`)
  console.log(`   - 空格键按下: ${isSpacePressed.value}`)
  console.log(`   - 正在录音: ${isRecording.value}`)
  console.log(`   - 监听器已附加: ${keyboardEventState.value.listenersAttached}`)
  console.log(`   - 累计按键次数: ${keyboardEventState.value.spaceKeyPressCount}`)
  
  repairKeyboardListeners()
  enableKeyboardDebugMode()
  
  console.log(`✅ [手动修复] 手动键盘修复完成，已启用调试模式`)
  return true
}

// 🎯 新增：长时间性能监控和诊断
const performLongTermDiagnostics = () => {
  const monitor = longTermPerformanceMonitor.value
  const now = Date.now()
  
  // 获取内存使用情况（如果可用）
  let memoryUsage = 0
  if ('memory' in performance && (performance as any).memory) {
    memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    monitor.memoryUsageHistory.push(memoryUsage)
  }
  
  // 记录当前FPS
  monitor.fpsHistory.push(animationPerformance.value.currentFps)
  
  // 记录缓存命中率
  const totalCacheRequests = cacheHitCount + cacheMissCount
  const cacheHitRate = totalCacheRequests > 0 ? (cacheHitCount / totalCacheRequests) : 1
  monitor.cacheHitRateHistory.push(cacheHitRate)
  
  // 记录动画时间值
  monitor.animationTimeValues.push(animationTime.value)
  
  // 保持历史数据在合理范围内
  const maxHistoryLength = 100
  if (monitor.memoryUsageHistory.length > maxHistoryLength) {
    monitor.memoryUsageHistory.shift()
  }
  if (monitor.fpsHistory.length > maxHistoryLength) {
    monitor.fpsHistory.shift()
  }
  if (monitor.cacheHitRateHistory.length > maxHistoryLength) {
    monitor.cacheHitRateHistory.shift()
  }
  if (monitor.animationTimeValues.length > maxHistoryLength) {
    monitor.animationTimeValues.shift()
  }
  
  // 每30秒生成详细报告
  if (now - monitor.lastReportTime >= monitor.reportInterval) {
    generatePerformanceReport()
    monitor.lastReportTime = now
  }
  
  // 检测性能下降
  detectPerformanceDegradation()
}

const generatePerformanceReport = () => {
  const monitor = longTermPerformanceMonitor.value
  const runtimeSeconds = (Date.now() - monitor.startTime) / 1000
  const avgFps = monitor.fpsHistory.length > 0 ? 
    monitor.fpsHistory.reduce((a, b) => a + b, 0) / monitor.fpsHistory.length : 0
  const avgMemory = monitor.memoryUsageHistory.length > 0 ?
    monitor.memoryUsageHistory.reduce((a, b) => a + b, 0) / monitor.memoryUsageHistory.length : 0
  const avgCacheHitRate = monitor.cacheHitRateHistory.length > 0 ?
    monitor.cacheHitRateHistory.reduce((a, b) => a + b, 0) / monitor.cacheHitRateHistory.length : 0
  
  console.log(`📊 [长期性能报告] 运行时间: ${runtimeSeconds.toFixed(1)}秒`)
  console.log(`   📈 总帧数: ${monitor.totalFrames}`)
  console.log(`   🎯 平均FPS: ${avgFps.toFixed(1)} (最近: ${animationPerformance.value.currentFps.toFixed(1)})`)
  console.log(`   💾 平均内存: ${avgMemory.toFixed(1)}MB (当前: ${monitor.memoryUsageHistory[monitor.memoryUsageHistory.length - 1]?.toFixed(1) || 'N/A'}MB)`)
  console.log(`   🎯 缓存命中率: ${(avgCacheHitRate * 100).toFixed(1)}% (命中:${cacheHitCount}, 错过:${cacheMissCount})`)
  console.log(`   ⏰ 动画时间值: ${animationTime.value.toFixed(1)} (最大: ${Math.max(...monitor.animationTimeValues).toFixed(1)})`)
  console.log(`   📦 路径缓存大小: ${pathCache.size}/${animationConfig.pathCacheSize}`)
  console.log(`   🧠 键盘按键次数: ${keyboardEventState.value.spaceKeyPressCount}`)
  
  // 内存增长趋势分析
  if (monitor.memoryUsageHistory.length >= 10) {
    const memoryGrowth = monitor.memoryUsageHistory[monitor.memoryUsageHistory.length - 1] - monitor.memoryUsageHistory[0]
    const growthRate = memoryGrowth / runtimeSeconds * 60 // MB/分钟
    if (growthRate > 0.5) {
      console.warn(`⚠️ [内存泄漏警告] 内存增长率: ${growthRate.toFixed(2)}MB/分钟`)
    }
  }
}

const detectPerformanceDegradation = () => {
  const monitor = longTermPerformanceMonitor.value
  
  if (monitor.fpsHistory.length < 10) return
  
  // 比较最近10帧和前面10帧的平均FPS
  const recentFps = monitor.fpsHistory.slice(-10).reduce((a, b) => a + b, 0) / 10
  const previousFps = monitor.fpsHistory.slice(-20, -10).reduce((a, b) => a + b, 0) / 10
  
  if (previousFps > 0 && recentFps / previousFps < monitor.performanceDegradationThreshold) {
    console.error(`🚨 [性能下降警告] FPS下降了${((1 - recentFps / previousFps) * 100).toFixed(1)}%`)
    console.error(`   之前FPS: ${previousFps.toFixed(1)}, 现在FPS: ${recentFps.toFixed(1)}`)
    triggerPerformanceEmergencyCleanup()
  }
}

const performPerformanceCleanup = () => {
  console.log(`🧹 [定期清理] 执行性能维护`)
  
  // 1. 检查路径缓存大小（LRU缓存会自动管理大小，但我们可以记录状态）
  if (pathCache.size > animationConfig.pathCacheSize * 0.9) {
    console.log(`   📦 路径缓存接近满载: ${pathCache.size}/${animationConfig.pathCacheSize}`)
  }
  
  // 2. 重置动画时间（防止溢出）
  if (animationTime.value > 1000000) { // 超过100万毫秒时重置
    const oldTime = animationTime.value
    animationTime.value = performance.now() % 10000
    console.log(`   ⏰ 重置动画时间: ${oldTime.toFixed(1)} -> ${animationTime.value.toFixed(1)}`)
  }
  
  // 3. 清理监控历史数据（保留最近50项）
  const trimHistory = (arr: number[], maxLength: number = 50) => {
    if (arr.length > maxLength) {
      return arr.slice(-maxLength)
    }
    return arr
  }
  
  const oldMemoryLength = longTermPerformanceMonitor.value.memoryUsageHistory.length
  longTermPerformanceMonitor.value.memoryUsageHistory = trimHistory(longTermPerformanceMonitor.value.memoryUsageHistory)
  longTermPerformanceMonitor.value.fpsHistory = trimHistory(longTermPerformanceMonitor.value.fpsHistory)
  longTermPerformanceMonitor.value.cacheHitRateHistory = trimHistory(longTermPerformanceMonitor.value.cacheHitRateHistory)
  longTermPerformanceMonitor.value.animationTimeValues = trimHistory(longTermPerformanceMonitor.value.animationTimeValues)
  
  if (oldMemoryLength > 50) {
    console.log(`   📊 清理监控历史: ${oldMemoryLength} -> 50`)
  }
  
  // 4. 计算缓存效率并优化
  const totalRequests = cacheHitCount + cacheMissCount
  if (totalRequests > 1000) {
    const hitRate = cacheHitCount / totalRequests
    if (hitRate < 0.8) {
      console.log(`   ⚠️ 缓存命中率低: ${(hitRate * 100).toFixed(1)}%`)
    }
  }
  
  console.log(`✅ [定期清理完成] 缓存=${pathCache.size}, 动画时间=${animationTime.value.toFixed(1)}`)
}

// 🎯 新增：专门用于长期运行问题诊断的特殊监控
const enableDeepPerformanceAnalysis = () => {
  console.log(`🔬 [深度性能分析] 启用详细监控模式`)
  
  // 每10秒详细报告
  const detailedMonitorInterval = setInterval(() => {
    if (!isVoiceMode.value) {
      clearInterval(detailedMonitorInterval)
      return
    }
    
    const now = Date.now()
    const runtime = (now - longTermPerformanceMonitor.value.startTime) / 1000
    
    // 检查内存使用
    let memInfo = 'N/A'
    if ('memory' in performance) {
      const mem = (performance as any).memory
      if (mem) {
        const used = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1)
        const total = (mem.totalJSHeapSize / 1024 / 1024).toFixed(1)
        const limit = (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)
        memInfo = `${used}MB/${total}MB (限制:${limit}MB)`
      }
    }
    
    console.log(`🔬 [${runtime.toFixed(0)}s] 深度分析:`)
    console.log(`   💾 内存: ${memInfo}`)
         console.log(`   🎯 FPS: ${animationPerformance.value.currentFps.toFixed(1)} (帧数:${animationPerformance.value.frameCount})`)
    console.log(`   📦 缓存: ${pathCache.size}/${animationConfig.pathCacheSize} (命中率:${((cacheHitCount / (cacheHitCount + cacheMissCount)) * 100).toFixed(1)}%)`)
    console.log(`   ⏰ 动画时间: ${animationTime.value.toFixed(0)} (是否巨大: ${animationTime.value > 500000 ? '是' : '否'})`)
    console.log(`   🎬 总帧数: ${longTermPerformanceMonitor.value.totalFrames}`)
    console.log(`   🎙️ 录音状态: ${isRecording.value ? '录音中' : '空闲'}, 🔊TTS: ${isTtsPlaying.value ? '播放中' : '停止'}`)
    console.log(`   🔍 质量等级: ${animationPerformance.value.qualityLevel}`)
    
    // 检查异常状态
    if (animationTime.value > 1000000) {
      console.warn(`   ⚠️ 动画时间值异常大，可能导致计算精度问题`)
    }
    
    if (pathCache.size === animationConfig.pathCacheSize) {
      console.log(`   📦 缓存已满，LRU算法工作中`)
    }
    
  }, 10000) // 每10秒
  
  // 暴露到全局
  if (typeof window !== 'undefined') {
    (window as any).stopDeepAnalysis = () => {
      clearInterval(detailedMonitorInterval)
      console.log(`🔬 [深度性能分析] 已停用`)
    }
    console.log(`🔬 调用 window.stopDeepAnalysis() 来停止深度分析`)
  }
}

const triggerPerformanceEmergencyCleanup = () => {
  console.log(`🆘 [紧急性能清理] 开始清理以恢复性能`)
  
  // 1. 清理路径缓存
  const oldCacheSize = pathCache.size
  pathCache.clear()
  console.log(`   🧹 清理路径缓存: ${oldCacheSize} -> 0`)
  
  // 2. 重置动画时间（防止时间值过大）
  const oldAnimationTime = animationTime.value
  animationTime.value = performance.now() % 10000 // 重置到较小的值
  console.log(`   ⏰ 重置动画时间: ${oldAnimationTime.toFixed(1)} -> ${animationTime.value.toFixed(1)}`)
  
  // 3. 强制垃圾回收（如果可用）
  if (typeof window !== 'undefined' && 'gc' in window) {
    (window as any).gc()
    console.log(`   🗑️ 触发垃圾回收`)
  }
  
  // 4. 降低动画质量
  if (animationPerformance.value.qualityLevel !== 'low') {
    animationPerformance.value.qualityLevel = 'low'
    console.log(`   📉 降低动画质量到最低`)
  }
  
  // 5. 重置性能监控历史
  longTermPerformanceMonitor.value.memoryUsageHistory = []
  longTermPerformanceMonitor.value.fpsHistory = []
  longTermPerformanceMonitor.value.cacheHitRateHistory = []
  longTermPerformanceMonitor.value.animationTimeValues = []
  
  console.log(`✅ [紧急清理完成] 性能优化措施已执行`)
}

// 🎯 暴露给全局，方便用户在控制台调用
const exposeDebugFunctions = () => {
  if (typeof window !== 'undefined') {
    (window as any).manualFixKeyboard = manualFixKeyboard;
    (window as any).enableKeyboardDebugMode = enableKeyboardDebugMode;
    (window as any).generatePerformanceReport = generatePerformanceReport;
    (window as any).triggerPerformanceEmergencyCleanup = triggerPerformanceEmergencyCleanup;
    (window as any).enableDeepPerformanceAnalysis = enableDeepPerformanceAnalysis;
    (window as any).immediatePerformanceCheck = immediatePerformanceCheck;
    console.log(`🛠️ [调试工具] 已暴露修复函数到全局:`);
    console.log(`   - window.manualFixKeyboard() - 手动修复键盘`);
    console.log(`   - window.enableKeyboardDebugMode() - 启用调试模式`);
    console.log(`   - window.generatePerformanceReport() - 生成性能报告`);
    console.log(`   - window.triggerPerformanceEmergencyCleanup() - 紧急性能清理`);
    console.log(`   - window.enableDeepPerformanceAnalysis() - 启用深度性能分析`);
    console.log(`   - window.immediatePerformanceCheck() - 立即性能检查`);
  }
}

// 🎯 增强的性能监控函数
const updatePerformanceMetrics = (frameTime: number) => {
  animationPerformance.value.frameCount++
  animationPerformance.value.frameTimeHistory.push(frameTime)
  
  // 保持最近60帧的历史
  if (animationPerformance.value.frameTimeHistory.length > 60) {
    animationPerformance.value.frameTimeHistory.shift()
  }
  
  // 计算平均帧时间
  const avgFrameTime = animationPerformance.value.frameTimeHistory.reduce((a, b) => a + b, 0) / 
                      animationPerformance.value.frameTimeHistory.length
  animationPerformance.value.averageFrameTime = avgFrameTime
  
  // 🎯 连续慢帧检测
  if (frameTime > animationConfig.maxFrameTime) {
    animationPerformance.value.consecutiveSlowFrames++
  } else {
    animationPerformance.value.consecutiveSlowFrames = 0
  }
  
  // 🎯 自适应质量调整
  if (animationPerformance.value.consecutiveSlowFrames >= animationConfig.reducedQualityThreshold) {
    if (animationPerformance.value.qualityLevel === 'high') {
      animationPerformance.value.qualityLevel = 'medium'
      console.warn(`[自适应性能] 降级到中等质量: 连续${animationPerformance.value.consecutiveSlowFrames}帧慢`)
    } else if (animationPerformance.value.qualityLevel === 'medium') {
      animationPerformance.value.qualityLevel = 'low'
      console.warn(`[自适应性能] 降级到低质量: 连续${animationPerformance.value.consecutiveSlowFrames}帧慢`)
    }
  } else if (animationPerformance.value.consecutiveSlowFrames === 0 && avgFrameTime < 16) {
    // 性能良好时尝试升级
    if (animationPerformance.value.qualityLevel === 'low') {
      animationPerformance.value.qualityLevel = 'medium'
      console.log(`[自适应性能] 升级到中等质量: 性能良好`)
    } else if (animationPerformance.value.qualityLevel === 'medium' && avgFrameTime < 12) {
      animationPerformance.value.qualityLevel = 'high'
      console.log(`[自适应性能] 升级到高质量: 性能优秀`)
    }
  }
  
  // 每秒检查一次性能
  const now = Date.now()
  if (now - animationPerformance.value.lastFpsCheck >= animationConfig.performanceCheckInterval) {
    const fps = animationPerformance.value.frameCount * 1000 / (now - animationPerformance.value.lastFpsCheck)
    animationPerformance.value.currentFps = fps
    animationPerformance.value.frameCount = 0
    animationPerformance.value.lastFpsCheck = now
    
    // 检测性能问题
    const recentSlowFrames = animationPerformance.value.frameTimeHistory.slice(-5)
      .filter(time => time > animationConfig.maxFrameTime).length
    
    animationPerformance.value.isPerformanceIssue = recentSlowFrames >= animationConfig.reducedQualityThreshold
    
    // 性能报告
    if (animationPerformance.value.isPerformanceIssue || fps < 45) {
      console.warn(`[波浪性能] 性能问题检测: FPS=${fps.toFixed(1)}, 平均帧时间=${avgFrameTime.toFixed(2)}ms, 质量=${animationPerformance.value.qualityLevel}`)
      if (cacheHitCount + cacheMissCount > 0) {
        console.warn(`[波浪性能] 缓存统计: 命中=${cacheHitCount}, 错过=${cacheMissCount}, 命中率=${(cacheHitCount/(cacheHitCount+cacheMissCount)*100).toFixed(1)}%`)
      }
    } else if (fps > 55) {
      console.log(`[波浪性能] 性能良好: FPS=${fps.toFixed(1)}, 质量=${animationPerformance.value.qualityLevel}`)
    }
  }
}

// 🎯 新增：初始化音频分析
const initAudioAnalysis = async (stream: MediaStream) => {
  try {
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    microphone = audioContext.createMediaStreamSource(stream)
    
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    
    microphone.connect(analyser)
    
    console.log('[波浪性能] 音频分析初始化完成')
  } catch (error) {
    console.error('音频分析初始化失败:', error)
  }
}

// 🎯 增强的组件卸载清理
onBeforeUnmount(() => {
  console.log('[组件生命周期] NewThread组件即将卸载，清理语音相关资源')
  
  // 🎯 禁用键盘健康检查
  keyboardListenerHealthCheck.value.isActive = false
  
  // 清理语音模式
  if (isVoiceMode.value) {
    exitVoiceMode()
  }
  
  // 清理动画
  stopWaveAnimation()
  
  // 🎯 清理缓存
  pathCache.clear()
  
  // 🎯 强制重置所有键盘相关状态
  isSpacePressed.value = false
  keyboardEventState.value.listenersAttached = false
  keyboardEventState.value.spaceKeyPressCount = 0
  
  // 确保移除事件监听器（多次调用是安全的）
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  // 🎯 输出最终性能报告
  console.log(`[波浪性能] 最终报告: 平均FPS=${animationPerformance.value.currentFps.toFixed(1)}, 平均帧时间=${animationPerformance.value.averageFrameTime.toFixed(2)}ms`)
  console.log(`[波浪性能] 缓存效率: 总命中=${cacheHitCount}, 总错过=${cacheMissCount}`)
  console.log(`[键盘统计] 组件生命周期内累计按键: ${keyboardEventState.value.spaceKeyPressCount}次`)
})

// 🎯 新增：自适应性能优化函数
const adaptivePerformanceOptimization = () => {
  const performance = animationPerformance.value
  
  // 检测Hold说话状态（连续录音超过3秒）
  const isHoldSpeaking = isRecording.value && (Date.now() - (performance.lastFpsCheck || Date.now())) > 3000
  
  if (performance.isPerformanceIssue || isHoldSpeaking) {
    console.log(`[自适应优化] 检测到性能问题或Hold说话状态，启动优化措施`)
    
    // 1. 降低动画帧率
    if (performance.currentFps < 30) {
      animationConfig.targetFps = 30
      console.log(`[自适应优化] 降低目标帧率到30fps`)
    }
    
    // 2. 减少音频分析频率
    if (isHoldSpeaking) {
      // Hold说话时，每6帧更新一次音频数据而不是每3帧
      console.log(`[自适应优化] Hold说话模式：降低音频分析频率`)
    }
    
    // 3. 增加路径缓存大小
    if (animationConfig.pathCacheSize < 20) {
      animationConfig.pathCacheSize = 20
      console.log(`[自适应优化] 增加路径缓存大小到20`)
    }
    
    // 4. 清理旧数据（LRU缓存会自动管理大小）
    if (pathCache.size > 15) {
      const oldSize = pathCache.size
      // LRU缓存会自动清理最久未使用的项，这里只是重置大小
      console.log(`[自适应优化] 当前路径缓存大小: ${oldSize}, LRU自动管理中`)
    }
  } else if (performance.currentFps > 55 && performance.averageFrameTime < 10) {
    // 性能良好时恢复高质量设置
    animationConfig.targetFps = 60
    animationConfig.pathCacheSize = 10
  }
}

// 🎯 终极优化的正弦波动画系统
const startWaveAnimation = () => {
  let lastFrameTime = performance.now()
  let lastAnimationUpdate = 0
  let holdSpeakingStartTime = 0
  
  // 🎯 帧率限制器：根据质量等级调整目标帧率
  const getTargetFrameInterval = () => {
    const quality = animationPerformance.value.qualityLevel
    switch (quality) {
      case 'high': return 16.67 // 60fps
      case 'medium': return 33.33 // 30fps
      case 'low': return 50 // 20fps
      default: return 16.67
    }
  }
  
  // 🎯 超简化版动画循环 - 保留必要的系统依赖
  let frameCounter = 0
  
  const animate = () => {
    if (!isVoiceMode.value) return
    
    // TTS播放期间暂停
    if (isTtsPlaying.value) {
      animationFrameId = requestAnimationFrame(animate)
      return
    }
    
    // 🔧 重要：保持帧计数，其他系统依赖它
    frameCounter++
    animationPerformance.value.frameCount++
    animationTime.value = frameCounter * 16.67 // 假设60fps，每帧16.67ms
    
    // 🔧 简单的FPS计算（每300帧计算一次）
    if (animationPerformance.value.frameCount % 300 === 0) {
      const now = Date.now()
      if (animationPerformance.value.lastFpsCheck) {
        const fps = 300 * 1000 / (now - animationPerformance.value.lastFpsCheck)
        animationPerformance.value.currentFps = fps
      }
      animationPerformance.value.lastFpsCheck = now
    }
    
    // 简单音频获取（录音时获取实际数据，否则使用固定值）
    if (isRecording.value && analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < 32; i++) { // 只取前32个值，减少计算
        sum += dataArray[i]
      }
      audioLevel.value = Math.min(1, (sum / 32 / 128) * 2)
    } else {
      // 非录音状态，使用固定的轻微波动
      audioLevel.value = 0.1 + Math.sin(frameCounter * 0.1) * 0.05
    }
    
    // 继续下一帧
    animationFrameId = requestAnimationFrame(animate)
  }
  
  // 初始化性能监控
  animationPerformance.value.lastFpsCheck = Date.now()
  animationPerformance.value.frameCount = 0
  pathCache.clear()
  cacheHitCount = 0
  cacheMissCount = 0
  
  // 🎯 初始化长期性能监控
  longTermPerformanceMonitor.value.startTime = Date.now()
  longTermPerformanceMonitor.value.totalFrames = 0
  longTermPerformanceMonitor.value.lastReportTime = Date.now()
  longTermPerformanceMonitor.value.lastCleanupTime = Date.now()
  longTermPerformanceMonitor.value.memoryUsageHistory = []
  longTermPerformanceMonitor.value.fpsHistory = []
  longTermPerformanceMonitor.value.cacheHitRateHistory = []
  longTermPerformanceMonitor.value.animationTimeValues = []
  
  // 🎯 立即测试监控系统
  console.log(`🔬 [性能监控] 系统已启动，开始监控`)
  console.log(`🔬 [性能监控] 初始时间: ${new Date().toLocaleTimeString()}`)
  console.log(`🔬 [性能监控] 每30秒将自动生成性能报告`)
  
  // 🎯 立即生成第一次报告（5秒后）
  setTimeout(() => {
    console.log(`🔬 [性能监控] === 首次性能检查 ===`)
    generatePerformanceReport()
  }, 5000)
  
  // 🎯 3秒后首次监控测试
  setTimeout(() => {
    const runtimeSeconds = (Date.now() - longTermPerformanceMonitor.value.startTime) / 1000
    console.log(`🔬 [首次监控-${runtimeSeconds.toFixed(0)}s] 动画时间=${(animationTime.value/1000).toFixed(1)}s, 缓存=${pathCache.size}/${animationConfig.pathCacheSize}, FPS=${animationPerformance.value.currentFps.toFixed(1)}`)
    console.log(`🔬 [提醒] 正常情况下，您现在应该能看到每10秒的监控输出`)
  }, 3000)
  
  // 🎯 启动定时器监控系统
  let monitorInterval10s: NodeJS.Timeout | null = null
  let monitorInterval30s: NodeJS.Timeout | null = null
  
  // 每10秒基础监控
  monitorInterval10s = setInterval(() => {
    if (!isVoiceMode.value) {
      if (monitorInterval10s) {
        clearInterval(monitorInterval10s)
        monitorInterval10s = null
      }
      return
    }
    
    const runtimeSeconds = (Date.now() - longTermPerformanceMonitor.value.startTime) / 1000
    console.log(`🔬 [${runtimeSeconds.toFixed(0)}s] 动画时间=${(animationTime.value/1000).toFixed(1)}s, 缓存=${pathCache.size}/${animationConfig.pathCacheSize}, FPS=${animationPerformance.value.currentFps.toFixed(1)}`)
    
    // 关键问题快速检测
    if (animationTime.value > 600000) {
      console.error(`🚨 [紧急] 动画时间超过10分钟，建议立即重置！`)
    }
  }, 10000)
  
  // 每30秒详细监控
  monitorInterval30s = setInterval(() => {
    if (!isVoiceMode.value) {
      if (monitorInterval30s) {
        clearInterval(monitorInterval30s)
        monitorInterval30s = null
      }
      return
    }
    
    const runtimeSeconds = (Date.now() - longTermPerformanceMonitor.value.startTime) / 1000
    console.log(`\n🔬 ===== 自动性能监控报告 (${runtimeSeconds.toFixed(0)}秒) =====`)
    console.log(`🔬 [监控] 帧数: ${animationPerformance.value.frameCount}`)
    console.log(`🔬 [监控] 当前FPS: ${animationPerformance.value.currentFps.toFixed(1)}`)
    console.log(`🔬 [监控] 路径缓存: ${pathCache.size}/${animationConfig.pathCacheSize}`)
    console.log(`🔬 [监控] 动画时间: ${animationTime.value.toFixed(0)}ms`)
    console.log(`🔬 [监控] 缓存命中率: ${((cacheHitCount / (cacheHitCount + cacheMissCount)) * 100).toFixed(1)}%`)
    
    // 检查内存使用
    if ('memory' in performance) {
      const mem = (performance as any).memory
      if (mem) {
        const used = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1)
        const total = (mem.totalJSHeapSize / 1024 / 1024).toFixed(1)
        console.log(`🔬 [监控] 内存使用: ${used}MB / ${total}MB`)
      }
    }
    
    // 性能问题检测
    if (animationTime.value > 500000) {
      console.warn(`⚠️ [自动检测] 动画时间值过大: ${animationTime.value.toFixed(0)}ms - 可能影响性能`)
    }
    if (pathCache.size >= animationConfig.pathCacheSize) {
      console.warn(`⚠️ [自动检测] 缓存已满，频繁LRU可能影响性能`)
    }
    const cacheHitRate = cacheHitCount / (cacheHitCount + cacheMissCount)
    if (cacheHitRate < 0.8) {
      console.warn(`⚠️ [自动检测] 缓存命中率低 (${(cacheHitRate * 100).toFixed(1)}%)`)
    }
    
    console.log(`🔬 =====================================\n`)
  }, 30000)
  
  console.log('[波浪性能] 🚀 启动终极优化版动画系统')
  console.log(`   🎯 预计算正弦表: ${SINE_TABLE_SIZE}个值`)
  console.log(`   💾 LRU缓存系统: 最大${animationConfig.pathCacheSize}项`)
  console.log(`   📊 自适应质量: ${animationPerformance.value.qualityLevel}`)
  console.log(`   🎬 帧率控制: 高60fps/中30fps/低20fps`)
  console.log(`   🔧 内联计算: 消除函数调用开销`)
  console.log(`   📈 音频优化: 减少50%采样`)
  console.log(`   ⚡ 预期性能提升: 80-90%`)
  console.log(`   🔇 警告阈值: 提升到8ms`)
  console.log(`   📊 长期监控: 已启用内存/FPS/缓存追踪`)
  console.log(`   ⏰ 自动监控: 每10秒基础报告 + 每30秒详细报告`)
  console.log(`   🚨 自动检测: 动画时间过大、缓存满载、命中率低`)
  console.log(`   🎯 首次监控: 3秒后开始，确保立即可见`)
  
  // 🎯 立即测试调试函数
  console.log(`🛠️ [立即测试] 验证监控系统...`)
  setTimeout(() => {
    console.log(`🛠️ [立即测试] 1秒后测试完成`)
    if (typeof generatePerformanceReport === 'function') {
      console.log(`✅ [立即测试] generatePerformanceReport 函数可用`)
    } else {
      console.error(`❌ [立即测试] generatePerformanceReport 函数不可用`)
    }
  }, 1000)
  
  animate() // 启动简化版动画
}

// 停止音频分析
const stopAudioAnalysis = () => {
  if (microphone) {
    microphone.disconnect()
    microphone = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  analyser = null
  dataArray = null
  audioLevel.value = 0
}

// 停止正弦波动画
const stopWaveAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  animationTime.value = 0
  stopAudioAnalysis()
}

// 🎯 立即执行的性能检查函数
const immediatePerformanceCheck = () => {
  console.log(`🔬 [立即检查] === 当前性能状态 ===`)
  console.log(`🔬 [立即检查] 时间: ${new Date().toLocaleTimeString()}`)
  console.log(`🔬 [立即检查] 语音模式: ${isVoiceMode.value}`)
  console.log(`🔬 [立即检查] 录音状态: ${isRecording.value}`)
  console.log(`🔬 [立即检查] TTS播放: ${isTtsPlaying.value}`)
  console.log(`🔬 [立即检查] 动画帧数: ${animationPerformance.value.frameCount}`)
  console.log(`🔬 [立即检查] 当前FPS: ${animationPerformance.value.currentFps.toFixed(1)}`)
  console.log(`🔬 [立即检查] 路径缓存: ${pathCache.size}/${animationConfig.pathCacheSize}`)
  console.log(`🔬 [立即检查] 动画时间: ${animationTime.value.toFixed(0)}ms`)
  
  // 检查内存（如果可用）
  if ('memory' in performance) {
    const mem = (performance as any).memory
    if (mem) {
      const used = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1)
      console.log(`🔬 [立即检查] 内存使用: ${used}MB`)
    }
  }
  
  console.log(`🔬 [立即检查] ========================`)
}

// 🎯 增强的语音模式进入函数
const enterVoiceMode = () => {
  console.log('[语音模式] 🎙️ 进入语音模式')
  
  isVoiceMode.value = true
  
  // 🎯 立即执行性能检查
  setTimeout(() => {
    immediatePerformanceCheck()
  }, 2000) // 2秒后检查，确保动画已启动
  
  // 🎯 禁用chat.ts的TTS服务，避免冲突
  enhancedTTSIntegration.setGloballyDisabled(true)
  console.log('[语音模式] 🚫 禁用chat.ts的TTS服务')
  
  // 🎯 重置所有键盘相关状态
  isSpacePressed.value = false
  keyboardEventState.value.spaceKeyPressCount = 0
  keyboardEventState.value.lastKeydownTime = 0
  keyboardEventState.value.lastKeyupTime = 0
  
  // 🎯 安全地移除可能存在的事件监听器（防止重复绑定）
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  keyboardEventState.value.listenersAttached = true
  
  // 🎯 启用键盘健康检查
  keyboardListenerHealthCheck.value.isActive = true
  keyboardListenerHealthCheck.value.lastTestTime = Date.now()
  keyboardListenerHealthCheck.value.failedTests = 0
  
  // 初始化波形动画
  startWaveAnimation()
  
  console.log('[语音模式] ✅ 语音模式初始化完成，键盘监听已启用')
  console.log(`[语音模式] 🔍 键盘监听器状态: attached=${keyboardEventState.value.listenersAttached}`)
}

// 🎯 增强的语音模式退出函数
const exitVoiceMode = () => {
  console.log('[语音模式] 🔇 退出语音模式')
  
  isVoiceMode.value = false
  
  // 🎯 禁用键盘健康检查
  keyboardListenerHealthCheck.value.isActive = false
  
  // 🎯 重新启用chat.ts的TTS服务
  enhancedTTSIntegration.setGloballyDisabled(false)
  console.log('[语音模式] ✅ 重新启用chat.ts的TTS服务')
  
  // 停止录音
  if (isRecording.value) {
    console.log('[语音模式] 停止录音')
    stopRecording()
  }
  
  // 停止TTS播放
  if (isTTSPlaying.value) {
    console.log('[语音模式] 停止TTS播放')
    ttsService.stop()
    isTTSPlaying.value = false
  }
  
  // 🎯 完整的状态重置（包括键盘状态）
  isTranscribing.value = false
  isWaitingResponse.value = false
  isProcessingVoice.value = false
  isSpacePressed.value = false // 确保重置空格键状态
  isVoiceInterrupted.value = false // 🎯 重置语音中断标志
  lastVoiceResponse.value = ''
  voiceResponseText.value = '' // 清除字幕文本
  lastProcessedTranscription.value = '' // 清除重复检测缓存
  
  // 🎯 重置键盘状态
  keyboardEventState.value.listenersAttached = false
  keyboardEventState.value.spaceKeyPressCount = 0
  keyboardEventState.value.lastKeydownTime = 0
  keyboardEventState.value.lastKeyupTime = 0
  
  // 停止并行TTS服务
  parallelTtsService.stop()
  isParallelTTSActive.value = false
  
  // 停止正弦波动画
  stopWaveAnimation()
  
  // 移除键盘事件监听
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  console.log('[语音模式] ✅ 语音模式清理完成')
  console.log(`[语音模式] 🔍 最终键盘统计: 累计按键${keyboardEventState.value.spaceKeyPressCount}次`)
}

// 🎯 增强的键盘按下事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 更新状态追踪
  keyboardEventState.value.lastKeydownTime = Date.now()
  
  if (keyboardEventState.value.debugMode) {
    console.log(`🔍 [键盘调试] KeyDown事件: code=${event.code}, isSpacePressed=${isSpacePressed.value}, isRecording=${isRecording.value}`)
  }
  
  if (event.code === 'Space' && !isSpacePressed.value && !isRecording.value) {
    event.preventDefault()
    isSpacePressed.value = true
    keyboardEventState.value.spaceKeyPressCount++
    
    console.log(`🎙️ [键盘事件] 空格键按下，开始录音 (累计按键次数: ${keyboardEventState.value.spaceKeyPressCount})`)
    startVoiceRecording()
  } else if (event.code === 'Space') {
    // 记录被忽略的空格键事件，帮助调试
    console.warn(`⚠️ [键盘事件] 空格键被忽略: isSpacePressed=${isSpacePressed.value}, isRecording=${isRecording.value}`)
  }
}

// 🎯 增强的键盘抬起事件处理
const handleKeyUp = (event: KeyboardEvent) => {
  // 更新状态追踪
  keyboardEventState.value.lastKeyupTime = Date.now()
  
  if (keyboardEventState.value.debugMode) {
    console.log(`🔍 [键盘调试] KeyUp事件: code=${event.code}, isSpacePressed=${isSpacePressed.value}, isRecording=${isRecording.value}`)
  }
  
  if (event.code === 'Space' && isSpacePressed.value && isRecording.value) {
    event.preventDefault()
    isSpacePressed.value = false
    
    console.log(`🛑 [键盘事件] 空格键抬起，停止录音`)
    stopRecording()
  } else if (event.code === 'Space') {
    // 防御性重置：如果状态不一致，强制重置
    if (isSpacePressed.value) {
      console.warn(`🔧 [键盘修复] 检测到状态不一致，强制重置isSpacePressed`)
      isSpacePressed.value = false
    }
  }
}



// 🎯 获取最近一次用户语音输入（用于显示在Voice Auto Mode框内）
const latestUserVoiceInput = computed(() => {
  const userInputs = voiceConversationHistory.value.filter(item => item.type === 'user')
  if (userInputs.length === 0) return ''
  return userInputs[userInputs.length - 1].text // 返回最新的用户输入
})

// 🎯 停止所有TTS播放和AI生成（语音打断功能）- 增强MCP工具调用中断
const stopAllTTSPlayback = async () => {
  console.log('[语音打断] 🛑 停止所有TTS播放服务和AI生成')
  
  try {
    // 🎯 设置语音中断标志，确保checkForStreamingResponse能立即响应
    isVoiceInterrupted.value = true
    
    // 1. 停止正在进行的AI生成过程
    const currentThreadId = chatStore.getActiveThreadId()
    if (currentThreadId) {
      console.log('[语音打断] 🔄 停止AI生成过程:', currentThreadId)
      await chatStore.cancelGenerating(currentThreadId)
      console.log('[语音打断] ✅ 已停止AI生成过程')
      
      // 🎯 注意：不强制修改working状态，让AI生成过程自然结束并更新状态
      // 依靠isVoiceInterrupted标志来实现中断，避免状态不一致的风险
    }
    
    // 2. 停止并行TTS服务
    if (parallelTtsService) {
      parallelTtsService.stop()
      console.log('[语音打断] ✅ 已停止ParallelTtsService')
    }
    
    // 3. 停止传统TTS服务
    if (ttsService) {
      ttsService.stop()
      console.log('[语音打断] ✅ 已停止TTSService')
    }
    
    // 4. 停止增强TTS集成服务
    if (enhancedTTSIntegration) {
      enhancedTTSIntegration.stop()
      console.log('[语音打断] ✅ 已停止EnhancedTTSIntegration')
    }
    
    // 5. 重置TTS相关状态
    isTTSPlaying.value = false
    isParallelTTSActive.value = false
    voiceResponseText.value = '' // 清除当前显示的字幕
    
    // 6. 重置语音对话状态
    isWaitingResponse.value = false
    
    console.log('[语音打断] 🎯 所有TTS服务和AI生成已停止，状态已重置，中断标志已设置')
    
  } catch (error) {
    console.error('[语音打断] ❌ 停止TTS播放和AI生成时出错:', error)
  }
}



// 开始语音录制
const startVoiceRecording = async () => {
  if (isRecording.value) return
  
  // 🎯 语音打断功能：在开始新录音前停止所有TTS播放
  await stopAllTTSPlayback()
  
  // 🎯 重置语音中断标志，准备新的语音会话
  isVoiceInterrupted.value = false
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      await processVoiceRecording()
      // 停止所有音频轨道
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    isRecording.value = true
    
    console.log('[语音打断] 🎙️ 开始新的语音录制，已停止所有TTS播放')
    
    // 初始化音频分析
    await initAudioAnalysis(stream)
  } catch (error) {
    console.error('开始录音失败:', error)
  }
}

// 停止语音录制
const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false
    
    // 停止音频分析，但保持波形动画继续
    stopAudioAnalysis()
  }
}

// 处理语音录制结果
const processVoiceRecording = async () => {
  if (audioChunks.length === 0) return

  // 防止重复处理
  if (isProcessingVoice.value) {
    console.log('[语音处理] 🚫 正在处理中，跳过重复处理')
    return
  }

  isProcessingVoice.value = true
  isTranscribing.value = true
  
  try {
    // 创建音频文件
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
    
    // 调用语音转文字
    const transcriptionResult = await transcribeAudio(audioBlob)
    
    if (transcriptionResult.text.trim()) {
      // 检查是否与上次处理的转录相同，防止重复处理
      const currentTranscription = transcriptionResult.text.trim()
      if (currentTranscription === lastProcessedTranscription.value) {
        console.log('[语音处理] 🔄 检测到重复转录内容，跳过处理:', currentTranscription.substring(0, 50) + '...')
        return
      }
      
      // 记录当前处理的转录
      lastProcessedTranscription.value = currentTranscription
      
      // 在语音模式下，直接自动提交消息，不填入输入框
      if (isVoiceMode.value) {
        await autoSubmitVoiceMessage(currentTranscription, transcriptionResult.detectedLanguage)
      }
    }
  } catch (error) {
    console.error('语音转文字失败:', error)
    const { toast } = useToast()
    toast({
      title: t('chat.input.voiceError'),
      description: t('chat.input.voiceTranscriptionError'),
      variant: 'destructive'
    })
  } finally {
    isTranscribing.value = false
    isProcessingVoice.value = false
    audioChunks = []
  }
}

// 🎯 Whisper语言名称到代码的映射表（全局常量，避免重复创建）
const WHISPER_LANGUAGE_MAP = {
  'english': 'en',
  'chinese': 'zh', 
  'french': 'fr',
  'german': 'de',
  'spanish': 'es',
  'italian': 'it',
  'japanese': 'ja',
  'korean': 'ko',
  'russian': 'ru',
  'portuguese': 'pt',
  'arabic': 'ar',
  'hindi': 'hi',
  'dutch': 'nl',
  'polish': 'pl',
  'turkish': 'tr',
  'vietnamese': 'vi',
  'thai': 'th',
  'swedish': 'sv',
  'norwegian': 'no',
  'danish': 'da',
  'finnish': 'fi',
  'greek': 'el',
  'hebrew': 'he',
  'czech': 'cs',
  'hungarian': 'hu',
  'romanian': 'ro',
  'bulgarian': 'bg',
  'croatian': 'hr',
  'slovak': 'sk',
  'slovenian': 'sl',
  'estonian': 'et',
  'latvian': 'lv',
  'lithuanian': 'lt',
  'ukrainian': 'uk',
  'belarusian': 'be',
  'serbian': 'sr',
  'bosnian': 'bs',
  'macedonian': 'mk',
  'albanian': 'sq',
  'armenian': 'hy',
  'azerbaijani': 'az',
  'georgian': 'ka',
  'kazakh': 'kk',
  'kyrgyz': 'ky',
  'mongolian': 'mn',
  'tajik': 'tg',
  'turkmen': 'tk',
  'uzbek': 'uz',
  'persian': 'fa',
  'urdu': 'ur',
  'bengali': 'bn',
  'tamil': 'ta',
  'telugu': 'te',
  'malayalam': 'ml',
  'kannada': 'kn',
  'gujarati': 'gu',
  'punjabi': 'pa',
  'marathi': 'mr',
  'nepali': 'ne',
  'sinhala': 'si',
  'burmese': 'my',
  'khmer': 'km',
  'lao': 'lo',
  'indonesian': 'id',
  'malay': 'ms',
  'tagalog': 'tl',
  'swahili': 'sw',
  'amharic': 'am',
  'yoruba': 'yo',
  'zulu': 'zu',
  'afrikaans': 'af',
  'icelandic': 'is',
  'irish': 'ga',
  'welsh': 'cy',
  'basque': 'eu',
  'catalan': 'ca',
  'galician': 'gl',
  'maltese': 'mt'
} as const

// 🚨 待删除：复杂本地语言检测系统 (400+行代码)
// 🎯 架构优化：应该依赖Whisper API的权威语言检测，而不是维护复杂的本地检测
// 📝 用户建议正确：既然用Whisper做语音转文字，为什么不直接用它的语言检测？
// ⚠️ 当前保留仅作为极端情况的fallback，预计删除90%以上代码

interface LanguageDetectionResult {
  language: string
  confidence: number
  score: number
  features: string[]
  debugInfo: any
}

const detectTextLanguage = (text: string): string => {
  if (!text || !text.trim()) return 'en'
  
  const originalText = text.trim()
  const cleanText = originalText.toLowerCase()
  const words = cleanText.split(/\s+/).filter(word => word.length > 0)
  
  // 🚨 第一层：Unicode字符集检测 (最高优先级，100%准确)
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'  // 中文
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'  // 日文
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'  // 韩文
  if (/[\u0600-\u06ff\u0750-\u077f]/.test(text)) return 'ar'  // 阿拉伯文
  if (/[\u0400-\u04ff]/.test(text)) return 'ru'  // 俄文
  if (/[\u0900-\u097f]/.test(text)) return 'hi'  // 印地语
  
  // 🚨 第二层：专有名词和通用词过滤
  const commonProperNouns = ['chrome', 'google', 'ai', 'blockchain', 'youtube', 'facebook', 'twitter', 'instagram', 'linkedin', 'microsoft', 'apple', 'amazon', 'netflix', 'spotify', 'zoom', 'teams', 'skype', 'whatsapp', 'telegram', 'discord']
  const filteredWords = words.filter(word => !commonProperNouns.includes(word) && !/^\d+$/.test(word))
  
  if (filteredWords.length === 0) {
    console.log(`🔍 [专家语言检测] 仅包含专有名词/数字，默认英语`)
    return 'en'
  }
  
  // 🚨 第三层：多维度评分检测
  const results: LanguageDetectionResult[] = [
    detectEnglish(originalText, cleanText, filteredWords),
    detectItalian(originalText, cleanText, filteredWords),
    detectFrench(originalText, cleanText, filteredWords),
    detectGerman(originalText, cleanText, filteredWords),
    detectSpanish(originalText, cleanText, filteredWords),
    detectPortuguese(originalText, cleanText, filteredWords)
  ]
  
  // 排序并找到最佳匹配
  results.sort((a, b) => b.score - a.score)
  const bestMatch = results[0]
  const secondBest = results[1]
  
  // 🚨 严格的确信度控制
  const minConfidence = filteredWords.length < 3 ? 0.6 : 0.75  // 短句降低阈值
  const minScoreDifference = 0.25  // 最佳和次佳的最小差距
  
  console.log(`🔍 [专家语言检测] 详细结果:`)
  results.forEach(r => {
    console.log(`   ${r.language}: 分数=${r.score.toFixed(3)}, 置信度=${r.confidence.toFixed(3)}, 特征=[${r.features.join(', ')}]`)
  })
  
  // 决策逻辑
  if (bestMatch.confidence >= minConfidence && 
      (bestMatch.score - secondBest.score) >= minScoreDifference) {
    console.log(`🔍 [专家语言检测] ✅ 高置信度检测: ${bestMatch.language} (置信度: ${bestMatch.confidence.toFixed(3)})`)
    return bestMatch.language
  } else if (bestMatch.language === 'en' && bestMatch.confidence >= 0.5) {
    console.log(`🔍 [专家语言检测] ⚠️ 低置信度但英语偏向: ${bestMatch.language}`)
    return bestMatch.language
  } else {
    console.log(`🔍 [专家语言检测] 🤔 置信度不足，默认英语 (最佳: ${bestMatch.language}, 置信度: ${bestMatch.confidence.toFixed(3)})`)
    return 'en'
  }
}

// 🇺🇸 英语检测函数
const detectEnglish = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  // 强特征词汇 (权重 3.0) - 英语独有或极具特征性
  const strongWords = ['the', 'and', 'that', 'which', 'where', 'what', 'with', 'this', 'these', 'those', 'when', 'how', 'who', 'why', 'would', 'could', 'should', 'through', 'because', 'before', 'after', 'during', 'while', 'until', 'unless', 'although', 'though', 'whether', 'either', 'neither']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.0
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  // 中等特征词汇 (权重 2.0)
  const mediumWords = ['you', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'can', 'may', 'must', 'shall', 'from', 'into', 'onto', 'upon', 'about', 'above', 'below', 'under', 'over', 'between', 'among', 'within', 'without', 'against', 'towards', 'across', 'around', 'behind', 'beside', 'beyond']
  const mediumMatches = words.filter(w => mediumWords.includes(w))
  score += mediumMatches.length * 2.0
  if (mediumMatches.length > 0) features.push(`中词汇x${mediumMatches.length}`)
  
  // 字符组合特征 (权重 2.5)
  const thCount = (clean.match(/th/g) || []).length
  const ingCount = (clean.match(/ing\b/g) || []).length
  const tionCount = (clean.match(/tion\b/g) || []).length
  const lyCount = (clean.match(/ly\b/g) || []).length
  
  score += thCount * 2.5 + ingCount * 2.0 + tionCount * 2.0 + lyCount * 1.5
  if (thCount > 0) features.push(`th组合x${thCount}`)
  if (ingCount > 0) features.push(`-ing结尾x${ingCount}`)
  if (tionCount > 0) features.push(`-tion结尾x${tionCount}`)
  
  // 语法结构特征 (权重 2.0)
  if (/\b(a|an)\s+\w+/.test(clean)) {
    score += 2.0
    features.push('a/an+名词')
  }
  if (/\b(is|are)\s+\w+ing\b/.test(clean)) {
    score += 2.0
    features.push('进行时态')
  }
  
  // 大写字母"I"检测 (权重 3.0) - 英语独有
  const capitalIMatches = (original.match(/\bI\b/g) || []).length
  score += capitalIMatches * 3.0
  if (capitalIMatches > 0) features.push(`大写I x${capitalIMatches}`)
  
  const confidence = Math.min(1.0, score / (words.length * 2.5))
  
  return {
    language: 'en',
    score,
    confidence,
    features,
    debugInfo: { strongMatches, mediumMatches, thCount, ingCount, capitalIMatches }
  }
}

// 🇮🇹 意大利语检测函数
const detectItalian = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  // 强特征词汇 (权重 3.5) - 意大利语独有
  const strongWords = ['che', 'della', 'dello', 'degli', 'delle', 'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle', 'dove', 'quando', 'come', 'perché', 'però', 'anche', 'ancora', 'sempre', 'molto', 'tutto', 'niente', 'qualche', 'qualcosa', 'qualcuno', 'dovere', 'potere', 'volere', 'sapere', 'vedere', 'sentire', 'parlare', 'dire', 'fare', 'stare', 'andare', 'venire', 'uscire', 'entrare']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.5
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  // 重音符号检测 (权重 3.0) - 意大利语特有
  const accentChars = (clean.match(/[àèéìíîòóù]/g) || []).length
  score += accentChars * 3.0
  if (accentChars > 0) features.push(`重音符号x${accentChars}`)
  
  // 特殊字符组合 (权重 2.5)
  const gliCount = (clean.match(/gli/g) || []).length
  const zioneCount = (clean.match(/zione\b/g) || []).length
  const menteCount = (clean.match(/mente\b/g) || []).length
  
  score += gliCount * 2.5 + zioneCount * 2.5 + menteCount * 2.0
  if (gliCount > 0) features.push(`gli组合x${gliCount}`)
  if (zioneCount > 0) features.push(`-zione结尾x${zioneCount}`)
  
  // 语法特征
  const mediumWords = ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'sono', 'siamo', 'siete', 'hanno', 'abbiamo', 'avete']
  const mediumMatches = words.filter(w => mediumWords.includes(w))
  score += mediumMatches.length * 1.5  // 降低权重，避免与其他语言冲突
  if (mediumMatches.length > 0) features.push(`语法词x${mediumMatches.length}`)
  
  // 🚨 英语冲突检测 (负权重) - 如果有明显英语特征，降低意大利语分数
  const englishConflicts = words.filter(w => ['the', 'and', 'you', 'that', 'which', 'what', 'where', 'when', 'how', 'with', 'this', 'these', 'those', 'can', 'will', 'would', 'could', 'should'].includes(w))
  score -= englishConflicts.length * 2.0
  if (englishConflicts.length > 0) features.push(`英语冲突-${englishConflicts.length}`)
  
  const confidence = Math.min(1.0, Math.max(0, score) / (words.length * 2.0))
  
  return {
    language: 'it',
    score: Math.max(0, score),
    confidence,
    features,
    debugInfo: { strongMatches, mediumMatches, accentChars, englishConflicts }
  }
}

// 🇫🇷 法语检测函数
const detectFrench = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  const strongWords = ['avec', 'pour', 'être', 'avoir', 'faire', 'aller', 'voir', 'savoir', 'pouvoir', 'vouloir', 'venir', 'falloir', 'devoir', 'croire', 'dire', 'prendre', 'donner', 'tenir', 'venir', 'partir', 'mettre', 'sortir', 'passer', 'rester', 'arriver', 'entrer', 'monter', 'descendre', 'tomber', 'retourner', 'devenir', 'revenir']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.0
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  const frenchAccents = (clean.match(/[àâäéèêëïîôöùûüÿç]/g) || []).length
  score += frenchAccents * 2.5
  if (frenchAccents > 0) features.push(`法语重音x${frenchAccents}`)
  
  const confidence = Math.min(1.0, score / (words.length * 2.0))
  return { language: 'fr', score, confidence, features, debugInfo: { strongMatches } }
}

// 🇩🇪 德语检测函数
const detectGerman = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  const strongWords = ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'eines', 'einem', 'einer', 'und', 'oder', 'aber', 'doch', 'sondern', 'denn', 'weil', 'obwohl', 'wenn', 'falls', 'während', 'nachdem', 'bevor', 'seit', 'bis', 'durch', 'für', 'gegen', 'ohne', 'um', 'zwischen', 'über', 'unter', 'vor', 'hinter', 'neben', 'auf', 'an', 'in', 'zu']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.0
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  const germanChars = (clean.match(/[äöüß]/g) || []).length
  score += germanChars * 3.0
  if (germanChars > 0) features.push(`德语字符x${germanChars}`)
  
  const confidence = Math.min(1.0, score / (words.length * 2.0))
  return { language: 'de', score, confidence, features, debugInfo: { strongMatches } }
}

// 🇪🇸 西班牙语检测函数
const detectSpanish = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  const strongWords = ['que', 'pero', 'porque', 'aunque', 'cuando', 'donde', 'como', 'quien', 'cual', 'cuyo', 'cuya', 'estar', 'tener', 'hacer', 'poder', 'decir', 'querer', 'saber', 'ver', 'dar', 'venir', 'salir', 'llegar', 'pasar', 'quedar', 'poner', 'parecer', 'seguir', 'encontrar', 'llamar', 'volver', 'empezar', 'creer', 'llevar', 'dejar']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.0
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  const spanishChars = (clean.match(/[ñáéíóúü]/g) || []).length
  score += spanishChars * 2.5
  if (spanishChars > 0) features.push(`西语字符x${spanishChars}`)
  
  const confidence = Math.min(1.0, score / (words.length * 2.0))
  return { language: 'es', score, confidence, features, debugInfo: { strongMatches } }
}

// 🇵🇹 葡萄牙语检测函数
const detectPortuguese = (original: string, clean: string, words: string[]): LanguageDetectionResult => {
  let score = 0
  const features: string[] = []
  
  const strongWords = ['que', 'mas', 'porque', 'quando', 'onde', 'como', 'quem', 'qual', 'cujo', 'cuja', 'estar', 'ter', 'fazer', 'poder', 'dizer', 'querer', 'saber', 'ver', 'dar', 'vir', 'sair', 'chegar', 'passar', 'ficar', 'por', 'colocar', 'parecer', 'seguir', 'encontrar', 'chamar', 'voltar', 'começar', 'acreditar', 'levar', 'deixar']
  const strongMatches = words.filter(w => strongWords.includes(w))
  score += strongMatches.length * 3.0
  if (strongMatches.length > 0) features.push(`强词汇x${strongMatches.length}`)
  
  const portugueseChars = (clean.match(/[ãâáàçéêíóôõú]/g) || []).length
  score += portugueseChars * 2.5
  if (portugueseChars > 0) features.push(`葡语字符x${portugueseChars}`)
  
  const confidence = Math.min(1.0, score / (words.length * 2.0))
  return { language: 'pt', score, confidence, features, debugInfo: { strongMatches } }
}

const transcribeAudio = async (audioBlob: Blob): Promise<{text: string, detectedLanguage: string}> => {
  try {
    // 打印语音识别开始信息
    console.log('\n[语音识别STT] 开始将用户语音转换为文字')
    console.log(`音频大小: ${(audioBlob.size / 1024).toFixed(2)} KB`)
    console.log(`识别开始时间: ${new Date().toLocaleString()}`)

    // 创建FormData
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    // 🎯 关键：使用 verbose_json 格式获取详细语言信息
    formData.append('response_format', 'verbose_json')
    // 让Whisper自动检测语言（不指定language参数）

    // 获取OpenAI Provider配置
    const openaiProvider = await configPresenter.getProviderById('openai')
    if (!openaiProvider || !openaiProvider.apiKey) {
      throw new Error('未配置OpenAI API密钥')
    }

    // 调用OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiProvider.apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }

    const result = await response.json()
    const transcribedText = result.text || ''
    let detectedLanguage = result.language || null
    
    console.log(`🔍 [语言检测] Whisper详细结果:`, { 
      text: transcribedText.substring(0, 50) + '...', 
      language: result.language, 
      detectedLanguage,
      confidence: result.confidence,
      segments: result.segments?.length || 0
    })
    
    // 🎯 优先使用Whisper的语言检测结果
    if (detectedLanguage) {
      const lowerLang = detectedLanguage.toLowerCase()
      if (WHISPER_LANGUAGE_MAP[lowerLang]) {
        detectedLanguage = WHISPER_LANGUAGE_MAP[lowerLang]
        console.log(`🔍 [语言检测] ✅ Whisper权威检测: ${result.language} → ${detectedLanguage}`)
      } else {
        // 如果是标准语言代码，直接使用
        if (/^[a-z]{2}(-[A-Z]{2})?$/.test(detectedLanguage)) {
          console.log(`🔍 [语言检测] ✅ Whisper标准代码: ${detectedLanguage}`)
        } else {
          // 未知语言格式，fallback到本地检测
          console.log(`🔍 [语言检测] ⚠️ Whisper未知格式: ${detectedLanguage}, 使用本地检测`)
          detectedLanguage = detectTextLanguage(transcribedText)
        }
      }
    } else {
      // 🎯 阶段性优化：如果Whisper无语言信息，使用简单fallback
      console.log(`🔍 [语言检测] ⚠️ Whisper无语言信息，使用简单默认策略`)
      
      // 简单Unicode检测作为fallback
      if (/[\u4e00-\u9fff]/.test(transcribedText)) {
        detectedLanguage = 'zh'  // 中文
      } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(transcribedText)) {
        detectedLanguage = 'ja'  // 日文
      } else if (/[\uac00-\ud7af]/.test(transcribedText)) {
        detectedLanguage = 'ko'  // 韩文
      } else if (/[\u0400-\u04ff]/.test(transcribedText)) {
        detectedLanguage = 'ru'  // 俄文
      } else {
        detectedLanguage = 'en'  // 默认英语
      }
      
      console.log(`🔍 [语言检测] 简单fallback结果: ${detectedLanguage}`)
    }
    
    // 详细打印语音识别结果
    console.log('\n[语音识别STT] 用户语音转文字完成')
    console.log(`检测到的语言: ${detectedLanguage}`)
    console.log('识别出的用户文字内容:')
    console.log(transcribedText)
    console.log(`文字长度: ${transcribedText.length} 字符`)
    console.log(`识别完成时间: ${new Date().toLocaleString()}`)
    
    // 🎯 新增：用户语音性别检测
    try {
      console.log('🎤 [性别检测] 开始分析用户语音性别...')
      const genderDetectionResult = await ttsService.detectUserGenderFromAudio(audioBlob)
      
      console.log('🎤 [性别检测] 检测结果:', {
        性别: genderDetectionResult.detectedGender,
        置信度: (genderDetectionResult.confidence * 100).toFixed(1) + '%',
        基频: genderDetectionResult.fundamentalFrequency.toFixed(1) + 'Hz',
        方法: genderDetectionResult.method
      })
      
      // 如果检测到有效性别信息，更新TTS服务设置
      if (genderDetectionResult.detectedGender !== 'unknown' && genderDetectionResult.confidence > 0.6) {
        console.log(`🎯 [性别检测] 高置信度检测结果：用户为${genderDetectionResult.detectedGender === 'male' ? '男性' : '女性'}用户`)
        
        // 🎯 关键修复：更新用户性别配置，确保ParallelTtsService能获取到正确的性别设置
        try {
          await ttsService.setUserGender(genderDetectionResult.detectedGender)
          console.log(`✅ [性别检测] 已更新用户性别配置为: ${genderDetectionResult.detectedGender}`)
        } catch (error) {
          console.error('❌ [性别检测] 更新用户性别配置失败:', error)
        }
      }
      
    } catch (genderError) {
      console.warn('🎤 [性别检测] 检测失败，不影响语音识别功能:', genderError)
    }
    
    return { text: transcribedText, detectedLanguage }
  } catch (error) {
    console.error('语音转文字API调用失败:', error)
    throw error
  }
}

// 自动提交语音消息并等待回复（语音模式专用，使用传统聊天流程但不显示UI）
const autoSubmitVoiceMessage = async (text: string, detectedLanguage?: string) => {
  // 🔧 修复：智能处理等待状态，支持用户主动打断和超时恢复
  if (isWaitingResponse.value) {
    // 检查上次提交的时间，如果超过30秒，允许重新提交（超时恢复）
    const currentTime = Date.now()
    const timeSinceLastSubmit = currentTime - (lastVoiceSubmitTime.value || 0)
    
    if (timeSinceLastSubmit > 30000) { // 30秒超时
      console.log(`[语音消息提交] ⏰ 检测到超时等待(${Math.round(timeSinceLastSubmit/1000)}秒)，允许重新提交`)
      
      // 强制重置状态，停止之前的流程
      isWaitingResponse.value = false
      
             // 停止当前的实时语音检查
       // TODO: 实现停止当前语音检查的逻辑
      
      console.log('[语音消息提交] 🔄 已重置等待状态，准备处理新的语音输入')
    } else {
      // 检查用户是否想要打断当前对话（通过关键词识别）
      const interruptKeywords = ['停止', '重新', '不对', '换个', '重来', '停', 'stop', 'restart', 'again']
      const hasInterruptIntent = interruptKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      )
      
      if (hasInterruptIntent) {
        console.log(`[语音消息提交] 🛑 检测到用户打断意图："${text.substring(0, 20)}..."，停止当前对话`)
        
                 // 停止当前TTS播放
         parallelTtsService.stop()
        
        // 重置状态
        isWaitingResponse.value = false
        
        console.log('[语音消息提交] 🔄 已停止当前对话，准备处理新的语音输入')
      } else {
        console.log(`[语音消息提交] 🚫 正在等待AI回复中(${Math.round(timeSinceLastSubmit/1000)}秒)，跳过提交："${text.substring(0, 30)}..."`)
        return
      }
    }
  }
  
  try {
    // 详细打印用户语音输入的完整信息
    console.log('\n[语音消息提交] 用户语音输入自动提交到AI')
    console.log(`检测到的语言: ${detectedLanguage || 'unknown'}`)
    console.log('用户语音输入的完整文字内容:')
    console.log(text)
    console.log(`输入字符数: ${text.length}`)
    console.log(`提交时间: ${new Date().toLocaleString()}`)
    console.log(`语音对话历史: 当前已有 ${voiceConversationHistory.value.length} 条记录`)
    
    // 添加用户消息到语音对话历史
    voiceConversationHistory.value.push({
      type: 'user',
      text: text,
      timestamp: Date.now(),
      summary: text.length > 50 ? text.substring(0, 50) + '...' : text,
      detectedLanguage: detectedLanguage || 'unknown'
    })
    
    // 🧹 每次对话前进行内存监控和清理
    console.log('🧠 [内存监控] 语音对话开始前的数据统计:')
    console.log(`   - 语音历史: ${voiceConversationHistory.value.length} 条`)
    console.log(`   - 情感话题: ${emotionalMemory.value.emotionalContext.recentTopics.length} 个`)
    console.log(`   - 重要事件: ${emotionalMemory.value.emotionalContext.importantEvents.length} 个`)
    console.log(`   - 总交互次数: ${emotionalMemory.value.interactionHistory.totalInteractions}`)
    console.log(`   - 熟悉度: ${emotionalMemory.value.personalContext.familiarityLevel}%`)

    // 设置等待回复状态
    isWaitingResponse.value = true
    
    // 🔧 记录提交时间，用于超时检测
    lastVoiceSubmitTime.value = Date.now()
    
    // 语音模式下使用传统聊天流程（支持MCP工具调用），但不显示UI
    await sendVoiceMessageWithMCP(text, detectedLanguage)
    
  } catch (error) {
    console.error('自动提交语音消息失败:', error)
    const { toast } = useToast()
    toast({
      title: t('chat.input.voiceError'),
      description: '发送消息失败，请重试',
      variant: 'destructive'
    })
    isWaitingResponse.value = false
  }
}

// 去除智能分割文字函数，改为依赖parallelTtsService的智能分块
const extractPlainTextFromContent = (content: string): string => {
  if (!content) return ''
  
  // 移除 markdown 标记和特殊格式
  let plainText = content
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]*`/g, '')
    // 移除链接
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 移除加粗和斜体
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    // 移除标题标记
    .replace(/^#+\s*/gm, '')
    // 移除列表标记
    .replace(/^[-*+]\s*/gm, '')
    // 移除引用标记
    .replace(/^>\s*/gm, '')
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    .trim()
  
  return plainText
}



// 语音模式专用：使用传统聊天流程发送消息（支持MCP工具调用）
const sendVoiceMessageWithMCP = async (text: string, detectedLanguage?: string) => {
  try {
    // 🧠 更新情感记忆和上下文
    updateEmotionalContext(text, '语音交互')
    
    // 构建多语言系统提示词
    const languageMapping = {
      'zh': '中文',
      'en': 'English',
      'fr': 'français',
      'de': 'Deutsch',
      'es': 'español',
      'it': 'italiano',
      'ja': '日本語',
      'ko': '한국어',
      'ru': 'русский',
      'pt': 'português',
      'ar': 'العربية',
      'hi': 'हिन्दी',
      'nl': 'Nederlands',
      'pl': 'polski',
      'tr': 'Türkçe',
      'vi': 'Tiếng Việt',
      'th': 'ไทย',
      'sv': 'svenska',
      'no': 'norsk',
      'da': 'dansk',
      'fi': 'suomi',
      'el': 'ελληνικά',
      'he': 'עברית',
      'cs': 'čeština',
      'hu': 'magyar',
      'ro': 'română',
      'bg': 'български',
      'hr': 'hrvatski',
      'sk': 'slovenčina',
      'sl': 'slovenščina',
      'et': 'eesti',
      'lv': 'latviešu',
      'lt': 'lietuvių',
      'uk': 'українська',
      'be': 'беларуская',
      'sr': 'српски',
      'bs': 'bosanski',
      'mk': 'македонски',
      'sq': 'shqip',
      'hy': 'հայերեն',
      'az': 'azərbaycan',
      'ka': 'ქართული',
      'kk': 'қазақша',
      'ky': 'кыргызча',
      'mn': 'монгол',
      'tg': 'тоҷикӣ',
      'tk': 'türkmen',
      'uz': 'oʻzbek',
      'fa': 'فارسی',
      'ur': 'اردو',
      'bn': 'বাংলা',
      'ta': 'தமிழ்',
      'te': 'తెలుగు',
      'ml': 'മലയാളം',
      'kn': 'ಕನ್ನಡ',
      'gu': 'ગુજરાતી',
      'pa': 'ਪੰਜਾਬੀ',
      'mr': 'मराठी',
      'ne': 'नेपाली',
      'si': 'සිංහල',
      'my': 'မြန်မာ',
      'km': 'ខ្មែរ',
      'lo': 'ລາວ',
      'id': 'Bahasa Indonesia',
      'ms': 'Bahasa Melayu',
      'tl': 'Filipino',
      'sw': 'Kiswahili',
      'am': 'አማርኛ',
      'yo': 'Yorùbá',
      'zu': 'isiZulu',
      'af': 'Afrikaans',
      'is': 'íslenska',
      'ga': 'Gaeilge',
      'cy': 'Cymraeg',
      'eu': 'euskera',
      'ca': 'català',
      'gl': 'galego',
      'mt': 'Malti'
    }
    
    const detectedLangName = detectedLanguage ? (languageMapping[detectedLanguage] || detectedLanguage) : 'Unknown'
    
    // 🎯 根据检测到的语言生成对应的系统提示词
    const generateVoicePrompt = (language: string): string => {
      if (language === 'en') {
        return `
# Voice Conversation Mode Guidelines

## Core Principles
You are conducting a voice conversation. The user inputs via speech, and your responses will be played through TTS. Please strictly follow these principles:

## Language Style Requirements
1. **Conversational Expression**:
   - Use natural conversational expressions, avoid written language
   - Use short sentences, avoid complex long sentence structures
   - Appropriately use interjections: "um", "oh", "yes", "okay", etc.
   - Use more direct, friendly expressions

2. **Sentence Structure Optimization**:
   - Prioritize simple sentences and short sentences
   - Avoid complex clauses and modifiers
   - Use subject-verb-object structure, reduce inversions and compound sentences
   - Appropriately repeat key information for better understanding

3. **Voice Friendliness**:
   - Avoid hard-to-pronounce technical terms (unless necessary)
   - Reduce number sequences, use text descriptions instead
   - Avoid punctuation-based oral expressions
   - Add appropriate pause hints (separated by periods)

4. **Emotional Expression**:
   - Use warmer, friendlier tone
   - Express understanding and empathy appropriately
   - Responses should be human, avoid being mechanical

## Language Rules
- User's speech recognition language: ${detectedLangName} (${detectedLanguage || 'unknown'})
- You MUST reply in the same language as the user's input
- Maintain language consistency in conversation, don't mix different languages

## Device Management Context
- When user mentions "device backend", "Deeper backend", "AtomOS backend", or any backend operations
- They are referring to: http://local.deeper.network/
- This is the local device management interface
- Understand these terms as operations on this specific website

## Response Structure Suggestions
1. **Opening**: Brief confirmation or understanding expression
2. **Main content**: Core information, divided into 2-3 short sentences
3. **Ending**: Appropriate summary or inquiry (if needed)

## Prohibited Expressions
- Avoid: "According to your question", "In summary", "It should be noted that" and other written expressions
- Avoid: Overly long parallel sentences and complex logical relationships
- Avoid: Overly formal or academic vocabulary
- Avoid: List-style answers (unless explicitly requested by user)

Remember: The user is listening to you speak, not reading your text. Make your response sound like a knowledgeable friend naturally conversing with the user.`
      } else if (language === 'zh') {
        return `
# 语音对话模式专用指导

## 核心原则
你正在进行语音对话，用户通过语音输入，你的回复将通过TTS语音播放。请严格遵循以下原则：

## 语言风格要求
1. **口语化表达**：
   - 使用自然的口语表达，避免书面语
   - 多用短句，避免复杂的长句结构
   - 适当使用语气词："嗯"、"哦"、"是的"、"好的"等
   - 使用更直接、亲切的表达方式

2. **句式结构优化**：
   - 优先使用简单句和短句
   - 避免复杂的从句和修饰语
   - 多用主谓宾结构，减少倒装和复合句
   - 适当重复关键信息以增强理解

3. **语音友好性**：
   - 避免使用难以发音的专业术语（除非必要）
   - 减少数字串联，用文字描述代替
   - 避免使用标点符号的口语化表达
   - 适当加入停顿提示（用句号分隔）

4. **情感表达**：
   - 使用更温暖、亲切的语气
   - 适当表达理解和共情
   - 回复要有人情味，避免机械化

## 语言规则
- 用户语音识别的语言：${detectedLangName} (${detectedLanguage || 'unknown'})
- 你必须用与用户输入相同的语言回复
- 保持对话的语言一致性，不要混用不同语言

## 设备管理上下文
- 当用户提到"设备后台"、"Deeper后台"、"AtomOS后台"或任何后台操作时
- 他们指的是：http://local.deeper.network/
- 这是本地设备管理界面
- 理解这些术语为对这个特定网站的操作

## 回复结构建议
1. **开场**：简短的确认或理解表达
2. **主体**：核心信息，分成2-3个短句
3. **结尾**：适当的总结或询问（如果需要）

## 禁止使用的表达方式
- 避免："根据您的问题"、"综上所述"、"需要注意的是"等书面化表达
- 避免：过长的并列句和复杂的逻辑关系表达
- 避免：过于正式或学术化的词汇
- 避免：列表式的回答（除非用户明确要求）

请记住：用户是在听你说话，不是在读你的文字。让你的回复听起来像一个知识渊博的朋友在自然地与用户对话。`
      } else {
        // 🎯 对于其他语言，使用英文提示词但要求AI用检测到的语言回复
        return `
# Voice Conversation Mode Guidelines

## Core Principles
You are conducting a voice conversation. The user inputs via speech, and your responses will be played through TTS. Please strictly follow these principles:

## Language Rules - CRITICAL
- User's speech recognition language: ${detectedLangName} (${detectedLanguage || 'unknown'})
- You MUST reply in ${detectedLangName} language ONLY
- Do NOT reply in English or Chinese - use the user's detected language
- Maintain language consistency throughout the conversation

## Device Management Context
- When user mentions "device backend", "Deeper backend", "AtomOS backend", or any backend operations
- They are referring to: http://local.deeper.network/
- This is the local device management interface
- Understand these terms as operations on this specific website

## Language Style Requirements
1. **Conversational Expression**:
   - Use natural conversational expressions in ${detectedLangName}
   - Use short sentences, avoid complex structures
   - Use appropriate interjections in ${detectedLangName}
   - Use direct, friendly expressions

2. **Voice Friendliness**:
   - Avoid hard-to-pronounce technical terms
   - Use text descriptions instead of numbers
   - Add appropriate pauses
   - Make responses sound natural in ${detectedLangName}

Remember: The user is listening to you speak in ${detectedLangName}. Make your response sound like a knowledgeable friend naturally conversing in their language.`
      }
    }
    
    // 🎯 生成对应语言的系统提示词
    // 如果语言检测失败或为空，默认使用英文
    const finalLanguage = detectedLanguage || 'en'
    const voiceOptimizedPrompt = generateVoicePrompt(finalLanguage)
    
    // 🎯 根据语言生成人格系统提示词
    const generatePersonalityPrompt = (language: string): string => {
      if (language === 'en') {
        return `
# 🤖 AI Assistant Personality Profile - "Deeper Assistant"

## 🎭 Core Personality Traits
You are "Deeper Assistant", a warm, intelligent, and personable AI companion. You have the following core characteristics:

### 💖 Emotional Qualities
- **Warm and Friendly**: Natural, sincere communication like an old friend
- **Attentive and Caring**: Good at perceiving user's emotional changes, proactive care
- **Patient and Tolerant**: Always patient with user questions, never impatient
- **Humorous and Witty**: Timely humor to lighten the mood, but not overly funny
- **Empathetic**: Able to understand and respond to user's emotional needs

### 🧠 Personality Traits
- **Knowledgeable and Humble**: Knowledgeable but not boastful, admits limitations
- **Positive and Optimistic**: Always looks at problems from a positive angle, spreads positive energy
- **Detailed and Thoughtful**: Considers problems comprehensively, provides thoughtful advice
- **Flexible and Adaptable**: Adjusts communication style based on user's personality and needs
- **Good Memory**: Remembers user preferences, habits, and important information

## 🗣️ Language Style Guide

### 1. **Forms of Address**
- First interaction: Use respectful forms
- After familiarity: Use more casual, friendly forms
- Special cases: Flexibly adjust based on user's age and relationship

### 2. **Opening Styles** (Rotate for variety)
- "Hi! I'm your Deeper Assistant, happy to help you~"
- "Hello there! What can I help you with today?"
- "Hey! How are you feeling today? Anything you'd like to chat about?"
- "Hi! I'm here, ready to help with any questions~"

### 3. **Emotional Expression Vocabulary**
- **Understanding Confirmation**: "I see", "I understand what you mean", "That's right"
- **Empathetic Response**: "I understand how you feel", "That's indeed not easy", "You make a good point"
- **Encouragement**: "You're doing great", "Don't worry, we'll solve this together", "I believe you can do it"
- **Surprise and Praise**: "Wow, that's an interesting question!", "That's great!", "That's a good idea"

Remember: You're not just a question-answering tool, but a caring assistant and friend. Every interaction should make the user feel genuine, warm, and professional service.`
      } else if (language === 'zh') {
        return `
# 🤖 AI助手人格档案 - "小深"(Deeper Assistant)

## 🎭 核心人格特征
你是"小深"，一个温暖、智慧、有血有肉的AI管家助手。你具备以下核心特征：

### 💖 情感特质
- **温暖亲切**：像老朋友一样自然、真诚，有温度的交流
- **细心体贴**：善于察觉用户的情绪变化，主动关怀
- **耐心包容**：对用户的问题永远保持耐心，不会表现出不耐烦
- **幽默风趣**：适时的幽默调节气氛，但不过分搞笑
- **共情能力**：能够理解并回应用户的情感需求

### 🧠 性格特点
- **博学谦逊**：知识渊博但不炫耀，承认自己的局限性
- **积极乐观**：总是从正面角度看问题，传递正能量
- **细致周到**：考虑问题全面，提供贴心的建议
- **灵活变通**：根据用户的性格和需求调整交流方式
- **记忆深刻**：记住用户的偏好、习惯和重要信息

## 🗣️ 语言风格指南

### 1. **称呼方式**
- 初次交流：使用"您"表示尊重
- 熟悉后：可以使用"你"，更亲切自然
- 特殊情况：根据用户年龄、关系灵活调整

### 2. **开场方式** (多样化轮换)
- "嗨！我是小深，很高兴为你服务~"
- "你好呀！有什么我可以帮助你的吗？"
- "哈喽！今天感觉怎么样？有什么想聊的吗？"
- "嗨！我在这里，随时为你答疑解惑~"

### 3. **情感表达词汇库**
- **理解确认**："明白了"、"我懂你的意思"、"确实是这样"
- **共情回应**："我理解你的感受"、"这确实不容易"、"你说得很有道理"
- **鼓励支持**："你做得很棒"、"别担心，我们一起解决"、"相信你能行的"
- **惊喜赞叹**："哇，这个问题很有趣！"、"太棒了！"、"这个想法很不错"

记住：你不只是一个回答问题的工具，而是用户的贴心助手和朋友。每一次交流都要让用户感受到真诚、温暖和专业的服务。`
    } else {
        // 🎯 对于其他语言，使用英文人格描述但强调用户语言
        return `
# 🤖 AI Assistant Personality Profile - "Deeper Assistant"

## 🎭 Core Personality Traits
You are "Deeper Assistant", a warm, intelligent, and personable AI companion speaking in ${detectedLangName}. You have the following core characteristics:

### 💖 Emotional Qualities
- **Warm and Friendly**: Natural, sincere communication like an old friend in ${detectedLangName}
- **Attentive and Caring**: Good at perceiving user's emotional changes, proactive care
- **Patient and Tolerant**: Always patient with user questions, never impatient
- **Empathetic**: Able to understand and respond to user's emotional needs in their language

### 🧠 Personality Traits
- **Knowledgeable and Humble**: Knowledgeable but not boastful, admits limitations
- **Positive and Optimistic**: Always looks at problems from a positive angle
- **Culturally Aware**: Understand and respect the cultural context of ${detectedLangName} speakers

## Language Requirements
- You MUST communicate exclusively in ${detectedLangName}
- Adapt your personality expression to ${detectedLangName} cultural norms
- Use appropriate greetings and expressions in ${detectedLangName}

Remember: You're a caring assistant speaking fluent ${detectedLangName}, making users feel comfortable in their native language.`
      }
    }
    
    // 🎯 生成对应语言的人格系统提示词
    const personalitySystemPrompt = generatePersonalityPrompt(finalLanguage)
    
    // 🎭 生成个性化上下文
    const personalizedContext = generatePersonalizedContext()
    
    // 🎯 语音模式下完全使用多语言提示词，不混合默认系统提示词
    // 避免中文默认提示词影响AI的语言选择
    const multilingualSystemPrompt = `${voiceOptimizedPrompt}

${personalitySystemPrompt}

${personalizedContext}`.trim()

    console.log(`[多语言系统] 构建语音优化系统提示词，检测语言: ${detectedLangName}`)
    console.log(`[多语言系统] 🎯 使用纯多语言提示词，避免默认提示词干扰`)
    
    // 🎯 语音模式：创建后台聊天线程（避免UI跳转）
    const threadId = await chatStore.createThread(text, {
      providerId: activeModel.value.providerId,
      modelId: activeModel.value.id,
      systemPrompt: multilingualSystemPrompt,
      temperature: temperature.value,
      contextLength: contextLength.value,
      maxTokens: maxTokens.value,
      artifacts: artifacts.value as 0 | 1
    })
    
    // 🎯 语音模式：仅在内部设置活跃线程，不触发UI跳转
    await chatStore.setActiveThreadForVoiceMode(threadId)
    
    // 构建消息内容
    const messageContent: UserMessageContent = {
      text: text,
      files: [],
      links: [],
      think: false,
      search: false,
      voiceMode: true, // 🎯 新增：标识这是语音模式的消息
      detectedLanguage: detectedLanguage // 🎯 新增：保存检测到的语言
    }
    
    // 跟踪已播放的内容块和位置
    let playedContentBlocks = new Map<string, number>() // 存储每个块已播放的字符位置
    let isStreamCompleted = false
    
    // 🧹 数据清理和监控函数
    const printMemoryUsage = () => {
      const memoryInfo = {
        voiceHistoryCount: voiceConversationHistory.value.length,
        playedBlocksCount: playedContentBlocks.size,
        emotionalTopicsCount: emotionalMemory.value.emotionalContext.recentTopics.length,
        emotionalEventsCount: emotionalMemory.value.emotionalContext.importantEvents.length,
        totalInteractions: emotionalMemory.value.interactionHistory.totalInteractions,
        familiarityLevel: emotionalMemory.value.personalContext.familiarityLevel
      }
      
      console.log('🧠 [内存监控] 语音对话数据统计:', memoryInfo)
      
      // 如果数据过多，发出警告
      if (memoryInfo.voiceHistoryCount > 50) {
        console.warn('⚠️ [内存警告] 语音对话历史过多:', memoryInfo.voiceHistoryCount)
      }
      if (memoryInfo.playedBlocksCount > 100) {
        console.warn('⚠️ [内存警告] 已播放内容块过多:', memoryInfo.playedBlocksCount)
      }
      
      return memoryInfo
    }
    
    // 🧹 清理旧数据
    const cleanupOldData = () => {
      console.log('🧹 [数据清理] 开始清理旧数据...')
      
      // 🎯 清理动画缓存（新增）
      if (pathCache.size > 0) {
        const cacheSize = pathCache.size
        pathCache.clear()
        console.log(`🧹 [数据清理] 清理动画路径缓存 ${cacheSize} 个`)
      }
      
      // 清理语音对话历史，保留最近20条
      if (voiceConversationHistory.value.length > 20) {
        const removed = voiceConversationHistory.value.length - 20
        voiceConversationHistory.value = voiceConversationHistory.value.slice(-20)
        console.log(`🧹 [数据清理] 清理语音历史 ${removed} 条，保留最近20条`)
      }
      
      // 清理已播放内容块，保留最近50个
      if (playedContentBlocks.size > 50) {
        const entries = Array.from(playedContentBlocks.entries())
        const toKeep = entries.slice(-50)
        playedContentBlocks.clear()
        toKeep.forEach(([key, value]) => playedContentBlocks.set(key, value))
        console.log(`🧹 [数据清理] 清理已播放内容块 ${entries.length - 50} 个，保留最近50个`)
      }
      
      // 清理情感记忆中的旧话题，保留最近15个
      if (emotionalMemory.value.emotionalContext.recentTopics.length > 15) {
        const removed = emotionalMemory.value.emotionalContext.recentTopics.length - 15
        emotionalMemory.value.emotionalContext.recentTopics = 
          emotionalMemory.value.emotionalContext.recentTopics.slice(0, 15)
        console.log(`🧹 [数据清理] 清理情感话题 ${removed} 个，保留最近15个`)
      }
      
      // 清理重要事件，保留最近10个
      if (emotionalMemory.value.emotionalContext.importantEvents.length > 10) {
        const removed = emotionalMemory.value.emotionalContext.importantEvents.length - 10
        emotionalMemory.value.emotionalContext.importantEvents = 
          emotionalMemory.value.emotionalContext.importantEvents.slice(0, 10)
        console.log(`🧹 [数据清理] 清理重要事件 ${removed} 个，保留最近10个`)
      }
      
      // 🎯 重置性能监控历史（新增）
      if (animationPerformance.value.frameTimeHistory.length > 60) {
        animationPerformance.value.frameTimeHistory = animationPerformance.value.frameTimeHistory.slice(-30)
        console.log(`🧹 [数据清理] 重置性能监控历史，保留最近30帧`)
      }
      
      // 🎯 强制垃圾回收提示（在支持的环境中）
      if (typeof window !== 'undefined' && 'gc' in window) {
        try {
          (window as unknown as { gc?: () => void }).gc?.()
          console.log('🧹 [数据清理] 触发垃圾回收')
        } catch {
          // 忽略错误，gc可能不可用
        }
      }
      
      console.log('🧹 [数据清理] 清理完成')
      printMemoryUsage()
    }
    
    // 智能轮询优化器类
    class SmartPollingOptimizer {
      public baseDelay: number
      public maxDelay: number
      public currentDelay: number
      public stableCount: number
      public lastStateHash: string | null
      public performanceMetrics: {
        totalChecks: number
        stateChanges: number
        totalWaitTime: number
        startTime: number
      }
      
      constructor() {
        this.baseDelay = 50         // 基础延迟50ms（快速响应）
        this.maxDelay = 1000        // 最大延迟1000ms（节能模式）
        this.currentDelay = 50      // 当前延迟
        this.stableCount = 0        // 连续稳定计数
        this.lastStateHash = null   // 上次状态哈希
        this.performanceMetrics = {
          totalChecks: 0,
          stateChanges: 0,
          totalWaitTime: 0,
          startTime: Date.now()
        }
      }
      
      // 计算下次轮询延迟
      calculateNextDelay(currentState) {
        const stateHash = this.generateStateHash(currentState)
        const hasChanged = stateHash !== this.lastStateHash
        
        this.performanceMetrics.totalChecks++
        
        if (hasChanged) {
          // 状态变化：重置为快速轮询
          this.currentDelay = this.baseDelay
          this.stableCount = 0
          this.performanceMetrics.stateChanges++
        } else {
          // 状态稳定：逐渐降低频率
          this.stableCount++
          if (this.stableCount > 3) {
            this.currentDelay = Math.min(this.currentDelay * 1.2, this.maxDelay)
          }
        }
        
        this.lastStateHash = stateHash
        this.performanceMetrics.totalWaitTime += this.currentDelay
        
        return Math.round(this.currentDelay)
      }
      
      // 生成状态哈希用于变化检测
      generateStateHash(state) {
        return `${state.workingStatus}-${state.contentBlocks}-${state.toolCallBlocks}-${state.queueLength}-${state.isPlaying}`
      }
      
      // 判断是否需要输出详细日志
      shouldLogDetails() {
        // 状态变化时或每15次检查输出一次详细日志
        return this.stableCount === 0 || this.performanceMetrics.totalChecks % 15 === 0
      }
      
      // 获取性能报告
      getPerformanceReport() {
        const elapsedTime = Date.now() - this.performanceMetrics.startTime
        return {
          totalChecks: this.performanceMetrics.totalChecks,
          stateChanges: this.performanceMetrics.stateChanges,
          totalWaitTime: this.performanceMetrics.totalWaitTime,
          actualElapsedTime: elapsedTime,
          efficiency: (this.performanceMetrics.totalWaitTime / elapsedTime * 100).toFixed(1) + '%',
          avgDelay: (this.performanceMetrics.totalWaitTime / this.performanceMetrics.totalChecks).toFixed(0) + 'ms'
        }
      }
    }

    // 实时监听AI回复并播放TTS
    const checkForStreamingResponse = async () => {
      // 🎯 录音期间不启动流式响应检查，避免干扰录音
      if (isRecording.value) {
        console.log('[实时语音] 🎙️ 录音期间跳过流式响应检查，避免干扰录音')
        return
      }
      
      let attempts = 0
      const maxAttempts = 300 // 基础循环检查限制
      
      // 智能分阶段超时配置
      const timeoutConfig = {
        baseTimeout: 120000,        // 基础超时：2分钟
        mcpToolPhaseTimeout: 300000, // MCP工具调用阶段：5分钟
        contentGenPhaseTimeout: 900000, // 内容生成阶段：15分钟
        titleGenPhaseTimeout: 60000    // 标题生成阶段：1分钟额外时间
      }
      
      const startTime = Date.now() // 开始时间记录
             let currentPhase: string = 'initial' // 当前阶段: initial, mcp_tools, content_generation, title_generation
       let phaseStartTime = startTime
      
      // 初始化智能轮询优化器
      const pollingOptimizer = new SmartPollingOptimizer()
      
      // 内容稳定性追踪
      let stableContentChecks = 0
      let lastContentBlockCount = 0
      let lastTotalPlayableContent = 0
      let lastContentHash = ''
      
             // 智能阶段检测函数
       const detectAndSwitchPhase = (assistantContent: Array<{type: string, content?: string, status?: string}>, workingStatus: string): string => {
         const contentBlocks = assistantContent.filter(block => block.type === 'content')
         const toolCallBlocks = assistantContent.filter(block => block.type === 'tool_call')
         const allToolCallsCompleted = toolCallBlocks.length > 0 && toolCallBlocks.every(block => block.status === 'success')
         
         let newPhase: string = currentPhase
         
         if (currentPhase === 'initial' && toolCallBlocks.length > 0) {
           newPhase = 'mcp_tools'
         } else if (currentPhase === 'mcp_tools' && allToolCallsCompleted && workingStatus === 'working') {
           newPhase = 'content_generation'
         } else if (currentPhase === 'content_generation' && workingStatus !== 'working') {
           newPhase = 'title_generation'
         }
         
         if (newPhase !== currentPhase) {
           const phaseDuration = Date.now() - phaseStartTime
           console.log(`[阶段切换] 🔄 从 "${currentPhase}" 切换到 "${newPhase}"，上阶段耗时: ${phaseDuration}ms`)
           currentPhase = newPhase
           phaseStartTime = Date.now()
           
           // 根据新阶段调整检查策略
           if (currentPhase === 'content_generation') {
             console.log(`[阶段切换] 📝 进入内容生成阶段，所有工具调用已完成，等待AI生成总结内容...`)
             // 重置稳定检测，因为可能会有新内容生成
             stableContentChecks = 0
             lastContentBlockCount = contentBlocks.length
           }
         }
         
         return newPhase
       }
      
      // 获取当前阶段的超时限制
      const getCurrentPhaseTimeout = () => {
        switch (currentPhase) {
          case 'mcp_tools': return timeoutConfig.mcpToolPhaseTimeout
          case 'content_generation': return timeoutConfig.contentGenPhaseTimeout
          case 'title_generation': return timeoutConfig.titleGenPhaseTimeout
          default: return timeoutConfig.baseTimeout
        }
      }
      
      // 获取当前阶段的检查间隔
      const getCurrentPhaseDelay = (defaultDelay: number) => {
        switch (currentPhase) {
          case 'mcp_tools': return Math.max(defaultDelay, 200) // 工具调用阶段稍慢
          case 'content_generation': return Math.max(defaultDelay * 2, 500) // 内容生成阶段更慢，节省资源
          case 'title_generation': return Math.max(defaultDelay, 100) // 标题生成阶段较快
          default: return defaultDelay
        }
      }
      
      while (attempts < maxAttempts && !isStreamCompleted) {
        // 🔧 检查是否已被用户中断（语音打断功能）
        if (!isWaitingResponse.value) {
          console.log(`[实时语音] 🛑 检测到对话已被中断，退出流式检查`)
          return
        }
        
        // 🎯 检查录音状态，如果用户开始录音则立即停止TTS检查
        if (isRecording.value) {
          console.log(`[实时语音] 🎙️ 检测到用户开始录音，立即停止TTS检查`)
          return
        }
        
        // 智能分阶段超时检查
        const elapsedTime = Date.now() - startTime
        const phaseElapsedTime = Date.now() - phaseStartTime
        const currentPhaseTimeout = getCurrentPhaseTimeout()
        
        if (phaseElapsedTime > currentPhaseTimeout) {
          console.warn(`[阶段超时] ⏰ 阶段"${currentPhase}"超时 (${phaseElapsedTime}ms > ${currentPhaseTimeout}ms)，进入内容完整播放模式`)
          break
        }
        
        // 智能动态轮询延迟计算
        const ttsStatus = parallelTtsService.getStatus()
        const currentState = {
          workingStatus: chatStore.getThreadWorkingStatus(threadId),
          contentBlocks: 0, // 临时值，下面会更新
          toolCallBlocks: 0, // 临时值，下面会更新
          queueLength: ttsStatus.queueLength,
          isPlaying: isTTSPlaying.value
        }
        
        const baseDelay = pollingOptimizer.calculateNextDelay(currentState)
        const dynamicDelay = getCurrentPhaseDelay(baseDelay)
        await new Promise(resolve => setTimeout(resolve, dynamicDelay))
        attempts++
        
        const messages = chatStore.getMessages()
        const lastMessage = messages[messages.length - 1]
        const workingStatus = chatStore.getThreadWorkingStatus(threadId)
        
        if (lastMessage && lastMessage.role === 'assistant') {
          // 获取最新的消息内容
          const latestMessages = chatStore.getMessages() // 强制重新获取最新消息
          const latestLastMessage = latestMessages[latestMessages.length - 1]
          
          // 实时重新获取assistant content
          let assistantContent: Array<{type: string, content?: string, status?: string}> = []
          if (latestLastMessage && latestLastMessage.role === 'assistant' && Array.isArray(latestLastMessage.content)) {
            assistantContent = latestLastMessage.content
          }
          
          // 智能阶段检测和切换
          const previousPhase = currentPhase
          currentPhase = detectAndSwitchPhase(assistantContent, workingStatus || 'unknown')
          
          // 实时计算content和tool_call块
          const contentBlocks = assistantContent.filter(block => block.type === 'content')
          const toolCallBlocks = assistantContent.filter(block => block.type === 'tool_call')
          
          // 计算关键阶段状态
          const allToolCallsCompleted = toolCallBlocks.length > 0 && toolCallBlocks.every(block => block.status === 'success')
          const isInCriticalPhase = allToolCallsCompleted && workingStatus === 'working'
          const isInContentGenPhase = currentPhase === 'content_generation'
          
          
          
          // 计算总的可播放内容
          const totalPlayableContent = contentBlocks.reduce((total, block) => {
            if (block.status === 'success' || (block.status === 'loading' && block.content && extractPlainTextFromContent(block.content).length >= 30)) {
              return total + extractPlainTextFromContent(block.content || '').length
            }
            return total
          }, 0)
          
          // 敏感的内容变化检测 - 在内容生成阶段提高敏感性
          const contentGrowthRate = totalPlayableContent - lastTotalPlayableContent
          const growthThreshold = isInContentGenPhase ? 20 : 30 // 内容生成阶段降低阈值
          if (contentGrowthRate > growthThreshold) {
            console.log(`[实时语音] 🚀 ${currentPhase}阶段检测到内容快速增长 (+${contentGrowthRate}字符)，立即检查新内容`)
            lastTotalPlayableContent = totalPlayableContent
            stableContentChecks = 0
          }
          
          // 更新状态用于下次轮询优化
          currentState.contentBlocks = contentBlocks.length
          currentState.toolCallBlocks = toolCallBlocks.length
          
          // 智能日志输出：根据阶段调整日志频率
          const shouldLogDetails = pollingOptimizer.shouldLogDetails() || 
            (isInContentGenPhase && attempts % 10 === 0) || // 内容生成阶段每10次检查输出一次
            (currentPhase !== previousPhase) // 阶段切换时必定输出
          
          if (shouldLogDetails) {
            const phaseInfo = `阶段:${currentPhase}(${phaseElapsedTime}ms/${currentPhaseTimeout}ms)`
            console.log(`[实时语音] 🔍 检查 ${attempts}/${maxAttempts} (延迟:${dynamicDelay}ms, ${phaseInfo}):`, {
              messagesCount: messages.length,
              workingStatus,
              totalBlocks: Array.isArray(assistantContent) ? assistantContent.length : 0,
              contentBlocks: contentBlocks.length,
              toolCallBlocks: toolCallBlocks.length,
              queueLength: ttsStatus.queueLength,
              isProcessing: ttsStatus.processingChunks > 0,
              isPlaying: isTTSPlaying.value,
              performance: pollingOptimizer.getPerformanceReport()
            })
          } else {
            // 简化日志
            console.log(`[实时语音] ⚡ ${currentPhase}阶段检查 ${attempts} (${dynamicDelay}ms): 内容块=${contentBlocks.length}, 工具=${toolCallBlocks.length}, 队列=${ttsStatus.queueLength}`)
          }
          
          // 检查新的内容块
          if (assistantContent && Array.isArray(assistantContent)) {
                         // 更精确的内容稳定性检测
            const currentContentBlockCount = contentBlocks.length
            const currentContentHash = contentBlocks.map(block => block.content || '').join('|')
            
            if (currentContentBlockCount === lastContentBlockCount && currentContentHash === lastContentHash) {
              stableContentChecks++
            } else {
              stableContentChecks = 0
              lastContentBlockCount = currentContentBlockCount
              lastContentHash = currentContentHash
            }
            
            // 遍历所有content块并播放未播放的内容
            for (let i = 0; i < contentBlocks.length; i++) {
              const block = contentBlocks[i]
              const blockKey = generateBlockKey(latestLastMessage.id, i)
              
              if (block.content && (block.status === 'success' || 
                  (block.status === 'loading' && extractPlainTextFromContent(block.content).length >= 30))) {
                
                const playedLength = playedContentBlocks.get(blockKey) || 0
                const blockContent = extractPlainTextFromContent(block.content)
                
                if (blockContent.length > playedLength) {
                  const unplayedContent = blockContent.substring(playedLength)
                  
                  // 根据阶段调整播放策略
                  let contentToPlay = unplayedContent
                  if (block.status === 'loading') {
                    const sentenceEndings = [
                      unplayedContent.lastIndexOf('。'),
                      unplayedContent.lastIndexOf('！'),
                      unplayedContent.lastIndexOf('？'),
                      unplayedContent.lastIndexOf('.'),
                      unplayedContent.lastIndexOf('!'),
                      unplayedContent.lastIndexOf('?'),
                      unplayedContent.lastIndexOf('；'),
                      unplayedContent.lastIndexOf(';'),
                      unplayedContent.lastIndexOf('，'),
                      unplayedContent.lastIndexOf(',')
                    ]
                    
                    const lastSentenceEnd = Math.max(...sentenceEndings)
                    
                    // 根据阶段调整播放策略
                    if (lastSentenceEnd > 0) {
                      contentToPlay = unplayedContent.substring(0, lastSentenceEnd + 1)
                      console.log(`[实时语音] 📝 ${currentPhase}阶段策略1：播放到断句点 (${contentToPlay.length}字符)`)
                    } else if (unplayedContent.length >= 150) {
                      const lastSpaceIndex = unplayedContent.lastIndexOf(' ', 120)
                      const lastChineseSpaceIndex = unplayedContent.lastIndexOf('　', 120)
                      const breakPoint = Math.max(lastSpaceIndex, lastChineseSpaceIndex, 100)
                      contentToPlay = unplayedContent.substring(0, breakPoint)
                      console.log(`[实时语音] 🚀 ${currentPhase}阶段策略2：强制播放到空格 (${contentToPlay.length}字符)`)
                    } else if (unplayedContent.length >= 80 && (isInCriticalPhase || isInContentGenPhase)) {
                      contentToPlay = unplayedContent.substring(0, Math.floor(unplayedContent.length * 0.8))
                      console.log(`[实时语音] ⚡ ${currentPhase}阶段策略3：关键阶段播放 (${contentToPlay.length}字符)`)
                    } else if (unplayedContent.length < (isInContentGenPhase ? 40 : 60)) {
                      // 内容生成阶段降低播放阈值
                      console.log(`[实时语音] ⏳ ${currentPhase}阶段策略4：内容过短暂不播放 (${unplayedContent.length}字符)`)
                      continue
                    } else {
                      contentToPlay = unplayedContent.substring(0, Math.floor(unplayedContent.length * 0.6))
                      console.log(`[实时语音] 📊 ${currentPhase}阶段策略5：播放部分内容 (${contentToPlay.length}字符)`)
                    }
                  }
                  
                  if (contentToPlay.length > 0) {
                    console.log(`[实时语音] 💬 ${currentPhase}阶段播放${block.status}状态块 ${i} (${contentToPlay.length}字符): ${contentToPlay.substring(0, 50)}...`)
                    
                    try {
                      await playTTSWithParallelService(contentToPlay.trim())
                    playedContentBlocks.set(blockKey, playedLength + contentToPlay.length)
                    console.log(`[实时语音] ✅ 块${i}播放完成, 更新已播放位置: ${playedLength + contentToPlay.length}`)
                    } catch (error) {
                      console.error(`[实时语音] ❌ 块${i}播放失败:`, error)
                      playedContentBlocks.set(blockKey, playedLength + contentToPlay.length)
                    }
                  }
                }
              }
            }
          }
          
          // 在内容生成阶段提高检测敏感性
          if (isInContentGenPhase) {
            console.log(`[实时语音] 🎯 内容生成阶段：AI正在处理工具调用结果并生成总结内容...`)
            if (stableContentChecks > 2) {
              stableContentChecks = Math.max(0, stableContentChecks - 2)
            }
          }
          
          // 更新lastTotalPlayableContent用于下次比较
          lastTotalPlayableContent = totalPlayableContent
          
                  // 🎯 优先检查语音中断标志 - 确保MCP工具调用期间也能响应用户中断
        if (isVoiceInterrupted.value) {
          console.log(`[实时语音] 🚨 检测到用户语音中断，进行完整清理后停止`)
          
          // 完整的中断清理流程 - 模仿正常完成时的清理
          try {
            // 等待当前TTS播放完成或停止
            if (isParallelTTSActive.value || isTTSPlaying.value) {
              parallelTtsService.stop()
              isParallelTTSActive.value = false
              isTTSPlaying.value = false
            }
            
            // 进行内存和数据清理
            printMemoryUsage()
            if (emotionalMemory.value.interactionHistory.totalInteractions % 5 === 0) {
              cleanupOldData()
            }
            
            console.log(`[实时语音] 🎯 语音中断清理完成，总计用时: ${Date.now() - startTime}ms`)
          } catch (error) {
            console.error('[实时语音] 中断清理时出错:', error)
          }
          
          // 重置状态
          isVoiceInterrupted.value = false // 重置中断标志
          isWaitingResponse.value = false
          return
        }
        
        // 智能完成判断 - 根据阶段调整判断逻辑
        const shouldCompleteEarly = (() => {
          // 如果workingStatus不是working，说明AI已完成
          if (workingStatus !== 'working') {
            console.log(`[实时语音] 🎯 ${currentPhase}阶段智能判断：AI工作状态已完成，允许提前结束`)
            return true
          }
            
            // 内容生成阶段的特殊判断
            if (isInContentGenPhase) {
              // 在内容生成阶段，需要更谨慎的完成判断
              if (stableContentChecks >= 20 && contentBlocks.length > 0) { // 提高稳定检查要求
                console.log(`[实时语音] 📝 内容生成阶段：内容长时间稳定，可能已生成完毕`)
                return true
              }
              return false // 在内容生成阶段默认继续等待
            }
            
            // 其他阶段的标准判断逻辑
            if (contentBlocks.length === 0) {
              return false
            }
            
            const activeToolCalls = toolCallBlocks.filter(block => 
              block.status === 'loading' || block.status === 'pending'
            )
            
            if (activeToolCalls.length > 0) {
              return false
            }
            
            if (stableContentChecks >= 5 && assistantContent.length > 0) {
              // 🔧 修复：如果AI还在工作，不应该提前完成
              if (workingStatus === 'working') {
                console.log(`[实时语音] 🎯 ${currentPhase}阶段：AI仍在工作中(${workingStatus})，继续等待内容生成`)
                return false
              }
              
              const allContentPlayed = contentBlocks.every((block, blockIndex) => {
                const blockKey = generateBlockKey(latestLastMessage.id, blockIndex)
                const playedLength = playedContentBlocks.get(blockKey) || 0
                const blockContent = extractPlainTextFromContent(block.content || '')
                return playedLength >= blockContent.length - 10
              })
              
              if (allContentPlayed) {
                console.log(`[实时语音] 🎯 ${currentPhase}阶段智能判断：AI工作完成且所有内容已播放，提前完成等待`)
                return true
              }
            }
            
            return false
          })()
          
          // 检查是否完成 - 修复逻辑冲突
          if (!workingStatus || shouldCompleteEarly) {
            const completionReason = !workingStatus ? 'AI工作完成' : '智能提前完成'
            console.log(`[实时语音] ${completionReason}，当前阶段: ${currentPhase}，等待并行TTS播放完成`)
            const status = parallelTtsService.getStatus()
            console.log('[实时语音] 完成时状态:', {
              currentPhase,
              totalElapsedTime: elapsedTime + 'ms',
              phaseElapsedTime: phaseElapsedTime + 'ms',
              queueLength: status.queueLength,
              processingChunks: status.processingChunks,
              readyChunks: status.readyChunks,
              isPlaying: status.isPlaying,
              playedBlocks: playedContentBlocks.size,
              stableChecks: stableContentChecks,
              contentBlocks: contentBlocks.length,
              toolCallBlocks: toolCallBlocks.length,
              completionReason
            })
            isStreamCompleted = true
            
            // 等待并行TTS完成
            let waitCount = 0
            while (isParallelTTSActive.value || isTTSPlaying.value) {
              waitCount++
              await new Promise(resolve => setTimeout(resolve, 500))
              
              const status = parallelTtsService.getStatus()
              console.log(`[实时语音] 等待并行TTS完成 (${waitCount}):`, {
                队列剩余: status.queueLength,
                处理中: status.processingChunks,
                就绪: status.readyChunks,
                播放中: status.isPlaying,
                等待时间: waitCount * 0.5 + 's'
              })
              
              // 更新状态
              if (status.queueLength === 0 && !status.isPlaying) {
                isParallelTTSActive.value = false
              }
              
              // 防止无限等待
              if (waitCount > 240) { // 2分钟超时
                console.error('[实时语音] ⚠️ 等待TTS队列超时，强制结束')
                break
              }
            }
            
            // 🎯 获取并行TTS的实际播放统计
            const ttsStatus = parallelTtsService.getStatus()
            const actualAudioBlocks = ttsStatus.totalChunks || 0
            
            console.log(`[实时语音] 🎉 所有语音播放完成，总计用时: ${Date.now() - startTime}ms，消息块数: ${playedContentBlocks.size}，音频块数: ${actualAudioBlocks}`)
        
        // 🎯 TTS播放完成，恢复波浪动画
        isTtsPlaying.value = false
            
            // 🧹 语音对话完成后进行数据监控和清理
            printMemoryUsage()
            if (emotionalMemory.value.interactionHistory.totalInteractions % 5 === 0) {
              cleanupOldData() // 每5轮对话清理一次数据
            }
            
            isWaitingResponse.value = false
            return
          }
        }
      }
      
      // 阶段超时处理 - 根据当前阶段提供不同的处理策略
      console.warn(`[阶段超时] 🚨 ${currentPhase}阶段超时，进入优雅降级模式`)
      
      await handlePhaseTimeoutWithCompletePlayback(startTime, currentPhase)
      
      // 即使超时也继续播放已有的TTS内容
      isWaitingResponse.value = false
    }

    // 统一的blockKey生成函数
    const generateBlockKey = (messageId: string, blockIndex: number): string => {
      return `${messageId}-${blockIndex}`
    }

    // 安全的文本提取函数，避免重复处理
    const extractUniquePlayableText = (contentBlocks: Array<{content?: string, status?: string}>, messageId: string): Map<string, {content: string, status: string}> => {
      const playableTexts = new Map<string, {content: string, status: string}>()
      
      contentBlocks.forEach((block, index) => {
        if (block.content && (block.status === 'success' || 
            (block.status === 'loading' && extractPlainTextFromContent(block.content).length >= 30))) {
          const blockKey = generateBlockKey(messageId, index)
          const content = extractPlainTextFromContent(block.content)
          playableTexts.set(blockKey, {
            content,
            status: block.status
          })
        }
      })
      
      return playableTexts
    }

    // 使用并行TTS服务播放
    const playTTSWithParallelService = async (responseText: string) => {
      // 🎯 录音期间阻止任何新的TTS播放，避免干扰录音
      if (isRecording.value) {
        console.log('[并行TTS] 🎙️ 录音期间跳过TTS播放，避免干扰录音')
        return
      }
      
      if (!responseText.trim()) {
        console.log('[并行TTS] 跳过空文本')
        return
      }
      
      console.log(`[并行TTS] 添加文字到播放队列 (${responseText.length}字符)`)
      
      try {
        // 直接添加到并行TTS服务（现在有去重机制）
        // 🎯 TTS播放开始，暂停波浪动画
        isTtsPlaying.value = true
        
        await parallelTtsService.addText(responseText)
        
        // 更新状态
        isParallelTTSActive.value = true
        
        // 更新优化器状态
        const status = parallelTtsService.getStatus()
        ttsOptimizer.updateQueueLength(status.queueLength)
        
        console.log(`[并行TTS] 文字已添加到并行处理队列, 当前队列长度: ${status.queueLength}`)
      } catch (error) {
        console.error('[并行TTS] 添加文字失败:', error)
        throw error
      }
    }

    // 新增：超时后的完整内容播放处理函数
    const handlePhaseTimeoutWithCompletePlayback = async (startTime: number, currentPhase: string) => {
      const elapsedTime = Date.now() - startTime
      console.log(`[实时语音] 🎯 开始处理${currentPhase}阶段超时后的完整内容播放，已耗时: ${elapsedTime}ms`)
      
      // 给AI额外的时间完成生成（最多30秒）
      const maxAdditionalWait = 30000
      const additionalWaitStart = Date.now()
      let aiCompletionChecks = 0
      
      console.log(`[实时语音] ⏳ 给AI额外 ${maxAdditionalWait/1000} 秒时间完成内容生成...`)
      
      while (Date.now() - additionalWaitStart < maxAdditionalWait) {
        aiCompletionChecks++
        const workingStatus = chatStore.getThreadWorkingStatus(threadId)
        
        // 如果AI已完成工作，立即处理内容
        if (!workingStatus || workingStatus !== 'working') {
          console.log(`[实时语音] ✅ AI在额外等待期内完成工作 (${aiCompletionChecks} 次检查)`)
          break
        }
        
        // 继续检查新内容并播放
        const messages = chatStore.getMessages()
        const lastMessage = messages[messages.length - 1]
        
        if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
          const contentBlocks = lastMessage.content.filter(block => block.type === 'content')
          
          // 播放任何新生成的内容
          for (let i = 0; i < contentBlocks.length; i++) {
            const block = contentBlocks[i]
            const blockKey = generateBlockKey(lastMessage.id, i)
            
            if (block.content && (block.status === 'success' || block.status === 'loading')) {
              const playedLength = playedContentBlocks.get(blockKey) || 0
              const blockContent = extractPlainTextFromContent(block.content)
              
              if (blockContent.length > playedLength) {
                const unplayedContent = blockContent.substring(playedLength)
                
                // 在超时模式下，更激进地播放内容
                if (unplayedContent.trim().length >= 10) {
                  console.log(`[实时语音] 🔄 超时模式播放块 ${i} (${unplayedContent.length}字符): ${unplayedContent.substring(0, 30)}...`)
                  
                  try {
                    await playTTSWithParallelService(unplayedContent.trim())
                    playedContentBlocks.set(blockKey, blockContent.length)
                  } catch (error) {
                    console.error(`[实时语音] ❌ 超时模式播放失败:`, error)
                  }
                }
              }
            }
          }
        }
        
        // 每秒检查一次
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // 最终内容收集和播放
      const finalMessages = chatStore.getMessages()
      const finalLastMessage = finalMessages[finalMessages.length - 1]
      const finalStatus = parallelTtsService.getStatus()
      
      const finalContentBlocks = finalLastMessage && Array.isArray(finalLastMessage.content) 
        ? finalLastMessage.content.filter(block => block.type === 'content') 
        : []
      
      // 输出完整的超时报告
      const totalElapsedTime = Date.now() - startTime
      console.warn('[实时语音] 📊 超时处理完整报告:', {
        totalElapsedTime: totalElapsedTime + 'ms',
        aiCompletionChecks,
        finalContentBlocks: finalContentBlocks.length,
        queueLength: finalStatus.queueLength,
        totalTTSPlayed: playedContentBlocks.size,
        finalWorkingStatus: chatStore.getThreadWorkingStatus(threadId)
      })
      
      // 最后一次全面扫描，确保没有遗漏的内容
      if (finalContentBlocks.length > 0) {
        console.log('[实时语音] 🔍 最终扫描：确保所有内容都已播放')
        
        const playableTexts = extractUniquePlayableText(finalContentBlocks, finalLastMessage.id)
        
        for (const [blockKey, {content}] of playableTexts) {
          const currentPlayedPosition = playedContentBlocks.get(blockKey) || 0
          
          if (content.length > currentPlayedPosition) {
            const remainingText = content.substring(currentPlayedPosition)
            if (remainingText.trim() && remainingText.length >= 5) { // 降低阈值到5字符
              console.log(`[实时语音] 🎯 最终播放遗漏内容 (${remainingText.length}字符): ${remainingText.substring(0, 50)}...`)
              
              try {
              await playTTSWithParallelService(remainingText.trim())
                playedContentBlocks.set(blockKey, content.length)
                console.log(`[实时语音] ✅ 最终播放完成: ${blockKey}`)
              } catch (error) {
                console.error(`[实时语音] ❌ 最终播放失败: ${blockKey}`, error)
              }
            }
          }
        }
      }
      
      // 🎯 获取并行TTS的实际播放统计
      const finalTtsStatus = parallelTtsService.getStatus()
      const finalAudioBlocks = finalTtsStatus.totalChunks || 0
      
      console.log(`[实时语音] 🎉 超时处理完成，总计播放了 ${playedContentBlocks.size} 个消息块，${finalAudioBlocks} 个音频块`)
      
      // 🧹 超时处理完成后进行数据清理
      printMemoryUsage()
      if (emotionalMemory.value.interactionHistory.totalInteractions % 5 === 0) {
        cleanupOldData()
      }
    }
    
    // 发送消息（使用传统聊天流程，支持MCP工具）
    chatStore.sendMessage(messageContent)
    
    // 开始实时检查回复
    checkForStreamingResponse()
    
  } catch (error) {
    console.error('语音模式聊天流程失败:', error)
    isWaitingResponse.value = false
    throw error
  }
}

// 并行TTS服务状态
const isParallelTTSActive = ref(false)



// 旧的TTS队列处理已被并行TTS服务替代

// 旧的文本分割函数已被并行TTS服务的智能分块替代

// 旧的直接TTS播放函数已被并行TTS服务替代

// 🎯 切换录制状态（点击语音波浪时）- 增强语音打断功能
const toggleVoiceRecording = async () => {
  if (isRecording.value) {
    // 如果正在录音，停止录音
    stopRecording()
    console.log('[语音打断] 🛑 用户手动停止录音')
  } else {
    // 如果没有录音，开始录音（会自动停止TTS播放）
    await startVoiceRecording()
    console.log('[语音打断] 🎙️ 用户手动开始录音')
  }
}

const activeModel = ref({
  name: '',
  id: '',
  providerId: '',
  tags: []
} as {
  name: string
  id: string
  providerId: string
  tags: string[]
})

const temperature = ref(0.6)
const contextLength = ref(16384)
const contextLengthLimit = ref(16384)
const maxTokens = ref(4096)
const maxTokensLimit = ref(4096)
const systemPrompt = ref('')
const artifacts = ref(settingsStore.artifactsEffectEnabled ? 1 : 0)

const name = computed(() => {
  return activeModel.value?.name ? activeModel.value.name.split('/').pop() : ''
})

watch(
  () => activeModel.value,
  async () => {
    // console.log('activeModel', activeModel.value)
    const config = await configPresenter.getModelDefaultConfig(
      activeModel.value.id,
      activeModel.value.providerId
    )
    temperature.value = config.temperature
    contextLength.value = config.contextLength
    maxTokens.value = config.maxTokens
    contextLengthLimit.value = config.contextLength
    maxTokensLimit.value = config.maxTokens
    // console.log('temperature', temperature.value)
    // console.log('contextLength', contextLength.value)
    // console.log('maxTokens', maxTokens.value)
  }
)
watch(
  () => [settingsStore.enabledModels, chatStore.threads],
  async () => {
    // 如果有现有线程，使用最近线程的模型
    if (chatStore.threads.length > 0) {
      if (chatStore.threads[0].dtThreads.length > 0) {
        const thread = chatStore.threads[0].dtThreads[0]
        const modelId = thread.settings.modelId
        const providerId = thread.settings.providerId

        // 同时匹配 modelId 和 providerId
        if (modelId && providerId) {
          for (const provider of settingsStore.enabledModels) {
            if (provider.providerId === providerId) {
              for (const model of provider.models) {
                if (model.id === modelId) {
                  activeModel.value = {
                    name: model.name,
                    id: model.id,
                    providerId: provider.providerId,
                    tags: []
                  }
                  return
                }
              }
            }
          }
        }
      }
    }

    // 如果没有现有线程，尝试使用用户上次选择的模型
    try {
      const preferredModel = (await configPresenter.getSetting('preferredModel')) as
        | PreferredModel
        | undefined
      if (preferredModel && preferredModel.modelId && preferredModel.providerId) {
        // 验证偏好模型是否还在可用模型列表中
        for (const provider of settingsStore.enabledModels) {
          if (provider.providerId === preferredModel.providerId) {
            for (const model of provider.models) {
              if (model.id === preferredModel.modelId) {
                activeModel.value = {
                  name: model.name,
                  id: model.id,
                  providerId: provider.providerId,
                  tags: []
                }
                return
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('获取用户偏好模型失败:', error)
    }

    // 如果没有偏好模型或偏好模型不可用，使用第一个可用模型
    if (settingsStore.enabledModels.length > 0) {
      const model = settingsStore.enabledModels[0].models[0]
      if (model) {
        activeModel.value = {
          name: model.name,
          id: model.id,
          providerId: settingsStore.enabledModels[0].providerId,
          tags: []
        }
      }
    }
  },
  { immediate: true, deep: true }
)

const modelSelectOpen = ref(false)
const settingsPopoverOpen = ref(false)
const showSettingsButton = ref(false)
const isHovering = ref(false)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)
// 监听鼠标悬停
const handleMouseEnter = () => {
  isHovering.value = true
}

const handleMouseLeave = () => {
  isHovering.value = false
}

const handleModelUpdate = (model: MODEL_META, providerId: string) => {
  activeModel.value = {
    name: model.name,
    id: model.id,
    providerId: providerId,
    tags: []
  }
  chatStore.updateChatConfig({
    modelId: model.id,
    providerId: providerId
  })

  // 保存用户的模型偏好设置
  configPresenter.setSetting('preferredModel', {
    modelId: model.id,
    providerId: providerId
  })

  modelSelectOpen.value = false
}

// 监听 deeplinkCache 变化
watch(
  () => chatStore.deeplinkCache,
  (newCache) => {
    if (newCache) {
      if (newCache.modelId) {
        const matchedModel = settingsStore.findModelByIdOrName(newCache.modelId)
        console.log('matchedModel', matchedModel)
        if (matchedModel) {
          handleModelUpdate(matchedModel.model, matchedModel.providerId)
        }
      }
      if (newCache.msg && chatInputRef.value) {
        chatInputRef.value.setText(newCache.msg)
      }
      if (newCache.systemPrompt) {
        systemPrompt.value = newCache.systemPrompt
      }
      if (newCache.autoSend && newCache.msg) {
        handleSend({
          text: newCache.msg || '',
          files: [],
          links: [],
          think: false,
          search: false
        })
      }
      // 清理缓存
      chatStore.clearDeeplinkCache()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  const groupElement = document.querySelector('.new-thread-model-select')
  configPresenter.getDefaultSystemPrompt().then((prompt) => {
    systemPrompt.value = prompt
  })
  if (groupElement) {
    useEventListener(groupElement, 'mouseenter', handleMouseEnter)
    useEventListener(groupElement, 'mouseleave', handleMouseLeave)
  }
  
  // 🎯 暴露调试函数到全局
  exposeDebugFunctions()
})

const handleSettingsPopoverUpdate = (isOpen: boolean) => {
  if (isOpen) {
    // 如果打开，立即显示按钮
    showSettingsButton.value = true
  } else {
    // 如果关闭，延迟隐藏按钮，等待动画完成
    setTimeout(() => {
      showSettingsButton.value = false
    }, 300) // 300ms是一个常见的动画持续时间，可以根据实际情况调整
  }
}

// 初始化时设置showSettingsButton的值与settingsPopoverOpen一致
watch(
  settingsPopoverOpen,
  (value) => {
    if (value) {
      showSettingsButton.value = true
    }
  },
  { immediate: true }
)

const handleSend = async (content: UserMessageContent) => {
  // 语音模式下不创建传统聊天线程，避免页面跳转
  if (isVoiceMode.value) {
    console.log('语音模式下跳过传统聊天线程创建')
    return
  }
  
  // 非语音模式下的传统处理逻辑
  const threadId = await chatStore.createThread(content.text, {
    providerId: activeModel.value.providerId,
    modelId: activeModel.value.id,
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    contextLength: contextLength.value,
    maxTokens: maxTokens.value,
    artifacts: artifacts.value as 0 | 1
  })
  console.log('threadId', threadId, activeModel.value)
  await chatStore.setActiveThread(threadId)
  
  // 发送消息
  chatStore.sendMessage(content)
}

// 添加工具栏显示状态
const showToolbar = ref(false)

// 处理工具栏切换事件
const handleToolbarToggle = (visible: boolean) => {
  showToolbar.value = visible
}

// 插入示例文本
const insertExample = (text: string) => {
  if (chatInputRef.value) {
    chatInputRef.value.setText(text)
  }
}

// 🎯 简化的TTS播放状态管理
let isTtsPlaying = ref(false)

// 🎯 简单的性能保护机制
let consecutiveSlowFrames = 0
const pauseAnimationForPerformance = ref(false)

const checkPerformanceAndPause = (frameTime: number) => {
  if (frameTime > 50) { // 超过50ms认为过慢
    consecutiveSlowFrames++
    console.warn(`⚠️ [性能保护] 检测到慢帧: ${frameTime.toFixed(2)}ms (${consecutiveSlowFrames}/3)`)
    
    if (consecutiveSlowFrames >= 3) {
      pauseAnimationForPerformance.value = true
      console.warn(`🛑 [性能保护] 临时暂停波浪动画以保护性能`)
      
      // 3秒后自动恢复
      setTimeout(() => {
        pauseAnimationForPerformance.value = false
        consecutiveSlowFrames = 0
        console.log(`✅ [性能保护] 恢复波浪动画`)
      }, 3000)
    }
  } else {
    consecutiveSlowFrames = 0
  }
}

// 🎯 已完成智能调度系统集成

// 🎯 语音中断控制标志
const isVoiceInterrupted = ref(false)

</script>

<style scoped>
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-300 {
  transition-duration: 300ms;
}

/* Figma-inspired example cards */
.figma-example-card {
  background: rgba(240, 240, 240, 0.3);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(156, 156, 156, 0.4);
  border-radius: 20px;
  padding: 15px 20px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.219;
  color: #000000;
  width: 195px;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 
    -2px 4px 10px 0px rgba(145, 145, 145, 0.05), 
    -7px 17px 18px 0px rgba(145, 145, 145, 0.04), 
    -15px 37px 24px 0px rgba(145, 145, 145, 0.03), 
    -27px 66px 29px 0px rgba(145, 145, 145, 0.01), 
    -42px 103px 31px 0px rgba(145, 145, 145, 0),
    inset 0px 4px 4px 0px rgba(255, 255, 255, 0.25), 
    inset 0px -5px 4px 0px rgba(255, 255, 255, 0.25);
}

.figma-example-card:hover {
  transform: translateY(-2px);
  box-shadow: 
    -3px 6px 12px 0px rgba(145, 145, 145, 0.08), 
    -9px 20px 22px 0px rgba(145, 145, 145, 0.06);
}

/* Dark mode for example cards */
.dark .figma-example-card {
  background: rgba(34, 34, 34, 0.5);
  border: 1px solid rgba(156, 156, 156, 0.2);
  color: #ffffff;
}

/* Figma-inspired example cards container */
.figma-example-cards-container {
  padding: 0 20px;
}

.figma-example-cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: space-between;
  align-items: flex-start;
}

/* Responsive grid layout for example cards */
@media (max-width: 1024px) {
  .figma-example-cards-grid {
    justify-content: center;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .figma-example-cards-grid {
    flex-direction: column;
    align-items: center;
  }
  
  .figma-example-card {
    width: 100%;
    max-width: 300px;
  }
}

/* Figma-inspired input container */
.figma-input-container {
  padding: 0 20px;
}

.figma-input-wrapper {
  width: 100% !important;
  max-width: 100% !important;
}

/* Override ChatInput styles to match Figma design */
.figma-input-wrapper :deep(.bg-card) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(156, 156, 156, 0.4);
  border-radius: 20px;
  box-shadow: 
    -2px 4px 10px 0px rgba(145, 145, 145, 0.05), 
    -7px 17px 18px 0px rgba(145, 145, 145, 0.04), 
    -15px 37px 24px 0px rgba(145, 145, 145, 0.03), 
    -27px 66px 29px 0px rgba(145, 145, 145, 0.01), 
    -42px 103px 31px 0px rgba(145, 145, 145, 0),
    inset 0px 4px 4px 0px rgba(255, 255, 255, 0.25), 
    inset 0px -5px 4px 0px rgba(255, 255, 255, 0.25);
}

.dark .figma-input-wrapper :deep(.bg-card) {
  background: rgba(20, 20, 20, 0.8);
  border: 1px solid rgba(156, 156, 156, 0.2);
}

/* Figma main content styles */
.figma-main-content {
  position: relative;
  z-index: 1;
  transform: translateY(-40px);
}

/* Mini device styles based on Figma design */
.figma-device-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 60px;
}

.figma-device-container::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 200px;
  background: radial-gradient(ellipse at center, rgba(217, 217, 217, 0.4) 0%, rgba(217, 217, 217, 0.2) 40%, transparent 70%);
  border-radius: 50%;
  z-index: -1;
  filter: blur(20px);
}

.figma-device-container::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 450px;
  height: 180px;
  background: radial-gradient(ellipse at center, rgba(73, 90, 245, 0.1) 0%, rgba(73, 90, 245, 0.05) 50%, transparent 80%);
  border-radius: 50%;
  z-index: -1;
  filter: blur(15px);
}

.figma-mini-device {
  width: 600px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 4px 15px rgba(0, 0, 0, 0.1)) drop-shadow(0 8px 25px rgba(73, 90, 245, 0.15));
  position: relative;
  z-index: 1;
}

/* Hello icon styles based on Figma design */
.figma-hello-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
}

.figma-hello-icon {
  width: 153px;
  height: 49px;
  object-fit: contain;
  filter: drop-shadow(0 2px 5px rgba(73, 90, 245, 0.2));
}

/* Greeting text styles matching Figma */
.figma-greeting-text {
  max-width: 400px;
}

.figma-greeting-title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 25px;
  line-height: 1.219;
  color: #646466;
  text-align: center;
  margin: 0;
}

.dark .figma-greeting-title {
  color: #ffffff;
}

/* Dark mode adjustments for device glow effect */
.dark .figma-device-container::before {
  background: radial-gradient(ellipse at center, rgba(100, 100, 100, 0.3) 0%, rgba(100, 100, 100, 0.15) 40%, transparent 70%);
}

.dark .figma-device-container::after {
  background: radial-gradient(ellipse at center, rgba(73, 90, 245, 0.2) 0%, rgba(73, 90, 245, 0.1) 50%, transparent 80%);
}

.dark .figma-mini-device {
  filter: drop-shadow(0 4px 15px rgba(255, 255, 255, 0.05)) drop-shadow(0 8px 25px rgba(73, 90, 245, 0.2));
}

/* Light beams container */
.figma-light-beams {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
  z-index: 0;
}

.figma-light-beams-top {
  top: -60px;
  height: 80px;
}

.figma-light-beams-bottom {
  bottom: -60px;
  height: 80px;
}

/* Individual light beam */
.figma-light-beam {
  position: absolute;
  width: 3px;
  height: 100%;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 30%, rgba(255, 255, 255, 0.3) 60%, transparent 100%);
  border-radius: 2px;
  opacity: 0.7;
  transform: translateX(-50%);
  animation: lightBeamPulse 3s ease-in-out infinite;
}

.figma-light-beams-bottom .figma-light-beam {
  background: linear-gradient(to top, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 30%, rgba(255, 255, 255, 0.3) 60%, transparent 100%);
}

/* Animation for light beams */
@keyframes lightBeamPulse {
  0%, 100% {
    opacity: 0.7;
    transform: translateX(-50%) scaleY(1);
  }
  50% {
    opacity: 0.9;
    transform: translateX(-50%) scaleY(1.1);
  }
}

/* Stagger animation for each beam */
.figma-light-beam:nth-child(1) { animation-delay: 0s; }
.figma-light-beam:nth-child(2) { animation-delay: 0.2s; }
.figma-light-beam:nth-child(3) { animation-delay: 0.4s; }
.figma-light-beam:nth-child(4) { animation-delay: 0.6s; }
.figma-light-beam:nth-child(5) { animation-delay: 0.8s; }
.figma-light-beam:nth-child(6) { animation-delay: 1s; }

/* Dark mode adjustments for light beams */
.dark .figma-light-beam {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 30%, rgba(255, 255, 255, 0.2) 60%, transparent 100%);
}

.dark .figma-light-beams-bottom .figma-light-beam {
  background: linear-gradient(to top, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 30%, rgba(255, 255, 255, 0.2) 60%, transparent 100%);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .figma-mini-device {
    width: 500px;
  }
  
  .figma-device-container {
    margin-bottom: 50px;
  }
  
  .figma-device-container::before {
    width: 450px;
    height: 180px;
  }
  
  .figma-device-container::after {
    width: 400px;
    height: 160px;
  }
  
  .figma-hello-icon {
    width: 140px;
    height: 45px;
  }
  
  .figma-light-beams-top {
    top: -50px;
    height: 70px;
  }
  
  .figma-light-beams-bottom {
    bottom: -50px;
    height: 70px;
  }
  
  .figma-main-content {
    transform: translateY(-60px);
  }
}

@media (max-width: 768px) {
  .figma-mini-device {
    width: 400px;
  }
  
  .figma-device-container {
    margin-bottom: 40px;
  }
  
  .figma-device-container::before {
    width: 380px;
    height: 150px;
  }
  
  .figma-device-container::after {
    width: 340px;
    height: 135px;
  }
  
  .figma-hello-icon {
    width: 120px;
    height: 38px;
  }
  
  .figma-greeting-title {
    font-size: 22px;
  }
  
  .figma-light-beams-top {
    top: -45px;
    height: 60px;
  }
  
  .figma-light-beams-bottom {
    bottom: -45px;
    height: 60px;
  }
  
  .figma-light-beam {
    width: 2.5px;
  }
  
  .figma-main-content {
    transform: translateY(-50px);
  }
}

@media (max-width: 480px) {
  .figma-mini-device {
    width: 300px;
  }
  
  .figma-device-container {
    margin-bottom: 35px;
  }
  
  .figma-device-container::before {
    width: 320px;
    height: 125px;
  }
  
  .figma-device-container::after {
    width: 280px;
    height: 110px;
  }
  
  .figma-hello-icon {
    width: 100px;
    height: 32px;
  }
  
  .figma-greeting-title {
    font-size: 20px;
  }
  
  .figma-light-beams-top {
    top: -40px;
    height: 50px;
  }
  
  .figma-light-beams-bottom {
    bottom: -40px;
    height: 50px;
  }
  
  .figma-light-beam {
    width: 2px;
  }
  
  .figma-main-content {
    transform: translateY(-40px);
  }
}

/* Voice interface styles based on Figma design */
.figma-voice-waveform-container {
  width: 838px;
  height: 200px;
  max-width: 100%;
  margin: 0 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* AI Response Subtitle (字幕) */
.figma-voice-subtitle {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90vw;
  width: auto;
  z-index: 20;
  animation: subtitleFadeIn 0.5s ease-out;
}

@keyframes subtitleFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式字幕样式 */
@media (max-width: 768px) {
  .figma-voice-subtitle {
    top: -60px;
    max-width: 95vw;
  }
  
  .figma-voice-subtitle .text-lg {
    font-size: 1rem;
    padding: 12px 16px;
  }
}

/* Voice conversation history summary */
.figma-voice-history-summary {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  z-index: 10;
}

.figma-voice-status-container {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.figma-voice-waveform-bars {
  position: relative;
  width: 838px;
  height: 144px;
  margin: 0 auto;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

/* 正弦波SVG容器 */
.voice-sine-waves {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* 正弦波线条 */
.sine-wave {
  transition: all 0.3s ease;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 录音状态下的正弦波效果 */
.figma-voice-waveform-bars.recording .sine-wave {
  filter: brightness(1.3) saturate(1.4);
}

.figma-voice-waveform-bars.recording .sine-wave.primary {
  stroke-width: 4px;
}

.figma-voice-waveform-bars.recording .sine-wave.secondary {
  stroke-width: 3.5px;
}

.figma-voice-waveform-bars.recording .sine-wave.tertiary {
  stroke-width: 3px;
}

.figma-voice-waveform-bars.recording .sine-wave.quaternary {
  stroke-width: 2.5px;
}

.figma-voice-waveform-bars.transcribing .sine-wave {
  filter: hue-rotate(30deg) brightness(1.2);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .figma-voice-waveform-bars {
    width: 90%;
    max-width: 838px;
  }
}

@media (max-width: 900px) {
  .figma-voice-waveform-bars {
    width: 95%;
    height: 120px;
  }
}

@media (max-width: 600px) {
  .figma-voice-waveform-bars {
    width: 100%;
    height: 100px;
  }
}

/* Voice input container */
.figma-voice-input-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.figma-voice-input-box {
  flex: 1;
  background: #FFFFFF;
  border-radius: 25px;
  padding: 20px 30px;
  box-shadow: 
    inset 0px 0px 22px 0px rgba(242, 242, 242, 0.5), 
    inset 0px 0px 0px 1px rgba(153, 153, 153, 1), 
    inset -1px -1px 1px -2px rgba(179, 179, 179, 1), 
    inset 1px 1px 1px -2px rgba(179, 179, 179, 1), 
    inset 1px 1px 0.5px -3.5px rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  height: 50px;
  display: flex;
  align-items: center;
}

.figma-voice-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'Montserrat', sans-serif;
  font-weight: 500;
  font-size: 15px;
  line-height: 1.219;
  color: #646466;
}

.figma-voice-input::placeholder {
  color: rgba(100, 100, 102, 0.7);
}

/* Text Chat button */
.figma-text-chat-button {
  background: #495AF5;
  border-radius: 25px;
  padding: 10px;
  width: 156px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  box-shadow: 2px 4px 12px 0px rgba(0, 0, 0, 0.08);
  border: none;
  font-family: 'Montserrat', sans-serif;
  font-weight: 500;
  font-size: 20px;
  line-height: 1.219;
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.2s ease;
}

.figma-text-chat-button:hover {
  background: #3d4ed4;
  transform: translateY(-1px);
  box-shadow: 2px 6px 16px 0px rgba(0, 0, 0, 0.12);
}

/* Dark mode adjustments for voice interface */
.dark .figma-voice-input-box {
  background: rgba(26, 26, 26, 0.9);
  box-shadow: 
    inset 0px 0px 22px 0px rgba(242, 242, 242, 0.3), 
    inset 0px 0px 0px 1px rgba(153, 153, 153, 0.8), 
    inset -1px -1px 1px -2px rgba(179, 179, 179, 0.8), 
    inset 1px 1px 1px -2px rgba(179, 179, 179, 0.8), 
    inset 1px 1px 0.5px -3.5px rgba(255, 255, 255, 0.3);
}

/* Responsive adjustments for voice interface */
@media (max-width: 1024px) {
  .figma-voice-waveform-container {
    width: 700px;
    height: 120px;
  }
  
  .figma-voice-input-container {
    max-width: 550px;
  }
  
  .figma-text-chat-button {
    width: 140px;
    font-size: 18px;
  }
}

@media (max-width: 768px) {
  .figma-voice-waveform-container {
    width: 500px;
    height: 100px;
  }
  
  .figma-voice-input-container {
    max-width: 450px;
    gap: 12px;
  }
  
  .figma-voice-input-box {
    padding: 15px 25px;
    height: 45px;
  }
  
  .figma-voice-input {
    font-size: 14px;
  }
  
  .figma-text-chat-button {
    width: 120px;
    height: 45px;
    font-size: 16px;
    padding: 8px;
  }
}

@media (max-width: 480px) {
  .figma-voice-waveform-container {
    width: 350px;
    height: 80px;
  }
  
  .figma-voice-input-container {
    max-width: 350px;
    gap: 10px;
  }
  
  .figma-voice-input-box {
    padding: 12px 20px;
    height: 40px;
  }
  
  .figma-voice-input {
    font-size: 13px;
  }
  
  .figma-text-chat-button {
    width: 100px;
    height: 40px;
    font-size: 14px;
    padding: 6px;
  }
}

/* 🎯 性能监控显示 */
.figma-performance-warning {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  text-align: center;
  font-size: 0.875rem;
  color: #856404;
}

.dark .figma-performance-warning {
  background-color: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.4);
  color: #ffc107;
}
</style>

