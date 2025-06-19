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
        <div v-if="voiceResponseText || isWaitingResponse" class="figma-voice-subtitle mb-6 text-center">
          <div class="text-lg font-medium text-foreground bg-background/80 rounded-xl px-6 py-3 backdrop-blur-md shadow-lg border border-border/50">
            <div v-if="isWaitingResponse && !voiceResponseText" class="flex items-center justify-center gap-2">
              <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span>{{ t('chat.input.voiceThinking') }}</span>
            </div>
            <div v-else>{{ voiceResponseText }}</div>
          </div>
        </div>
        
        <!-- Voice conversation history summary -->
        <div v-if="voiceHistorySummary && !voiceResponseText" class="figma-voice-history-summary mb-4 text-center">
          <div class="text-xs text-muted-foreground bg-background/50 rounded-lg px-3 py-2 backdrop-blur-sm">
            {{ voiceHistorySummary }}
          </div>
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
                v-model="voiceInputText"
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
const voiceInputText = ref('')
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

// TTS服务将在后面导入

// 录音相关变量
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

// 动画时间戳，用于正弦波动画
const animationTime = ref(0)
let animationFrameId: number | null = null

// 音频分析相关
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let microphone: MediaStreamAudioSourceNode | null = null
let dataArray: Uint8Array | null = null
const audioLevel = ref(0) // 当前音频强度 0-1

// 生成正弦波路径
const generateSineWave = (waveId: number, amplitude: number, frequency: number, phaseOffset: number) => {
  const centerY = 72 // 144/2，波浪中心线
  
  // 静态状态下也有一定的波动
  const staticAmplitude = amplitude * 0.8
  
  // 根据音频强度动态调整振幅
  const dynamicAmplitude = isRecording.value 
    ? staticAmplitude + (amplitude * audioLevel.value * 2) // 说话时根据音量调整
    : staticAmplitude
  
  const phase = animationTime.value * 0.003 * waveId + phaseOffset
  
  let path = `M 0 ${centerY}`
  
  for (let x = 0; x <= 838; x += 6) {
    // 添加音频驱动的随机跳跃效果
    const jumpEffect = isRecording.value ? audioLevel.value * Math.sin(x * 0.1 + phase * 3) * 5 : 0
    const baseWave = Math.sin(x * frequency + phase) * dynamicAmplitude
    const complexWave = baseWave * (1 + Math.sin(x * frequency * 2 + phase) * 0.3)
    const y = centerY + complexWave + jumpEffect
    path += ` L ${x} ${y}`
  }
  
  return path
}

// 语音录制状态
const isSpacePressed = ref(false)

// 防止重复处理的标记
const isProcessingVoice = ref(false)
const lastProcessedTranscription = ref('')

// 组件卸载时清理
onBeforeUnmount(() => {
  console.log('[组件生命周期] NewThread组件即将卸载，清理语音相关资源')
  
  // 清理语音模式
  if (isVoiceMode.value) {
    exitVoiceMode()
  }
  
  // 清理动画
  stopWaveAnimation()
  
  // 确保移除事件监听器
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
})

// 开始正弦波动画
const startWaveAnimation = () => {
  const animate = () => {
    // 静态和录音状态都有动画
    if (isVoiceMode.value) {
      animationTime.value = Date.now()
      
      // 分析音频数据（仅在录音时）
      if (isRecording.value && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray)
        
        // 计算平均音量
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        
        // 将音量转换为0-1的范围，并增加灵敏度
        audioLevel.value = Math.min(1, (average / 128) * 2)
      } else if (!isRecording.value) {
        // 非录音状态下音频强度为0
        audioLevel.value = 0
      }
      
      animationFrameId = requestAnimationFrame(animate)
    }
  }
  animate()
}

// 初始化音频分析
const initAudioAnalysis = async (stream: MediaStream) => {
  try {
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    microphone = audioContext.createMediaStreamSource(stream)
    
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    
    microphone.connect(analyser)
  } catch (error) {
    console.error('音频分析初始化失败:', error)
  }
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

// 进入语音模式
const enterVoiceMode = () => {
  console.log('[语音模式] 🎤 进入语音模式')
  
  // 如果已经在语音模式，先退出清理
  if (isVoiceMode.value) {
    console.log('[语音模式] ⚠️ 重复进入语音模式，先清理现有状态')
    exitVoiceMode()
  }
  
  isVoiceMode.value = true
  voiceInputText.value = ''
  
  // 重置处理标记
  isProcessingVoice.value = false
  lastProcessedTranscription.value = ''
  
  // 开始静态波动动画
  startWaveAnimation()
  
  // 移除可能存在的事件监听器（防止重复）
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  
  console.log('[语音模式] ✅ 语音模式初始化完成')
}

// 退出语音模式
const exitVoiceMode = () => {
  console.log('[语音模式] 🔇 退出语音模式')
  
  isVoiceMode.value = false
  voiceInputText.value = ''
  
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
  
  // 重置所有状态
  isTranscribing.value = false
  isWaitingResponse.value = false
  isProcessingVoice.value = false
  lastVoiceResponse.value = ''
  voiceResponseText.value = '' // 清除字幕文本
  lastProcessedTranscription.value = '' // 清除重复检测缓存
  
      // 停止并行TTS服务
    parallelTtsService.stop()
    isParallelTTSActive.value = false
  
  // 停止正弦波动画
  stopWaveAnimation()
  
  // 移除键盘事件监听
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  
  console.log('[语音模式] ✅ 语音模式清理完成')
}

// 键盘按下事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Space' && !isSpacePressed.value && !isRecording.value) {
    event.preventDefault()
    isSpacePressed.value = true
    startVoiceRecording()
  }
}

// 键盘抬起事件
const handleKeyUp = (event: KeyboardEvent) => {
  if (event.code === 'Space' && isSpacePressed.value && isRecording.value) {
    event.preventDefault()
    isSpacePressed.value = false
    stopRecording()
  }
}

// 语音对话历史摘要显示
const voiceHistorySummary = computed(() => {
  if (voiceConversationHistory.value.length === 0) return ''
  const recent = voiceConversationHistory.value.slice(-3) // 显示最近3条
  return recent.map(item => `${item.type === 'user' ? '👤' : '🤖'} ${item.summary || item.text}`).join(' • ')
})

// 开始语音录制
const startVoiceRecording = async () => {
  if (isRecording.value) return
  
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
      } else {
        // 非语音模式下，将转录结果添加到语音输入框
        voiceInputText.value = currentTranscription
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

// 语音转文字API调用
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
    // 移除硬编码的语言设置，让Whisper自动检测语言
    // formData.append('language', 'zh') // 删除此行，改为自动检测

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
    const detectedLanguage = result.language || 'unknown'
    
    // 详细打印语音识别结果
    console.log('\n[语音识别STT] 用户语音转文字完成')
    console.log(`检测到的语言: ${detectedLanguage}`)
    console.log('识别出的用户文字内容:')
    console.log(transcribedText)
    console.log(`文字长度: ${transcribedText.length} 字符`)
    console.log(`识别完成时间: ${new Date().toLocaleString()}`)
    
    return { text: transcribedText, detectedLanguage }
  } catch (error) {
    console.error('语音转文字API调用失败:', error)
    throw error
  }
}

// 自动提交语音消息并等待回复（语音模式专用，使用传统聊天流程但不显示UI）
const autoSubmitVoiceMessage = async (text: string, detectedLanguage?: string) => {
  // 防止重复提交相同消息
  if (isWaitingResponse.value) {
    console.log('[语音消息提交] 🚫 正在等待AI回复中，跳过重复提交')
    return
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

    // 设置等待回复状态
    isWaitingResponse.value = true
    
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
      'hi': 'हिन्दी'
    }
    
    const detectedLangName = detectedLanguage ? (languageMapping[detectedLanguage] || detectedLanguage) : '未知语言'
    const multilingualSystemPrompt = `${systemPrompt.value || ''}

重要语言规则：
- 用户语音识别的语言：${detectedLangName} (${detectedLanguage || 'unknown'})
- 你必须用与用户输入相同的语言回复
- 如果用户说中文，你必须用中文回复
- 如果用户说英文，你必须用英文回复
- 如果用户说法文，你必须用法文回复
- 如果用户说任何其他语言，你必须用该语言回复
- 保持对话的语言一致性，不要混用不同语言
- 这是语音对话模式，回复要自然流畅，适合语音播放`.trim()

    console.log(`[多语言系统] 构建系统提示词，检测语言: ${detectedLangName}`)
    
    // 创建临时聊天线程（用于MCP工具调用）
    const threadId = await chatStore.createThread(text, {
      providerId: activeModel.value.providerId,
      modelId: activeModel.value.id,
      systemPrompt: multilingualSystemPrompt,
      temperature: temperature.value,
      contextLength: contextLength.value,
      maxTokens: maxTokens.value,
      artifacts: artifacts.value as 0 | 1
    })
    
    // 设置为活跃线程（但不跳转UI）
    await chatStore.setActiveThread(threadId)
    
    // 构建消息内容
    const messageContent: UserMessageContent = {
      text: text,
      files: [],
      links: [],
      think: false,
      search: false
    }
    
    // 跟踪已播放的内容块和位置
    let playedContentBlocks = new Map<string, number>() // 存储每个块已播放的字符位置
    let isStreamCompleted = false
    
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
              const allContentPlayed = contentBlocks.every((block, blockIndex) => {
                const blockKey = generateBlockKey(latestLastMessage.id, blockIndex)
                const playedLength = playedContentBlocks.get(blockKey) || 0
                const blockContent = extractPlainTextFromContent(block.content || '')
                return playedLength >= blockContent.length - 10
              })
              
              if (allContentPlayed) {
                console.log(`[实时语音] 🎯 ${currentPhase}阶段智能判断：所有内容已播放，提前完成等待`)
                return true
              }
            }
            
            return false
          })()
          
          // 检查是否完成
          if (!workingStatus && (contentBlocks.length === 0 || shouldCompleteEarly)) {
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
            
            console.log(`[实时语音] 🎉 所有语音播放完成，总计用时: ${Date.now() - startTime}ms，播放块数: ${playedContentBlocks.size}`)
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
      if (!responseText.trim()) {
        console.log('[并行TTS] 跳过空文本')
        return
      }
      
      console.log(`[并行TTS] 添加文字到播放队列 (${responseText.length}字符)`)
      
      try {
        // 直接添加到并行TTS服务（现在有去重机制）
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
      
      console.log(`[实时语音] 🎉 超时处理完成，总计播放了 ${playedContentBlocks.size} 个内容块`)
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

// 切换录制状态（点击语音波浪时）
const toggleVoiceRecording = () => {
  // 如果正在播放TTS，先停止
  if (isTTSPlaying.value) {
    ttsService.stop()
    isTTSPlaying.value = false
  }
  
  if (isRecording.value) {
    stopRecording()
  } else {
    startVoiceRecording()
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
</style>

