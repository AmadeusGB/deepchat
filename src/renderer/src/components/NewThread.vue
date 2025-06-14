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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
import { useToast } from '@/components/ui/toast/use-toast'

const configPresenter = usePresenter('configPresenter')
const themeStore = useThemeStore()

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
  isVoiceMode.value = true
  voiceInputText.value = ''
  
  // 开始静态波动动画
  startWaveAnimation()
  
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
}

// 退出语音模式
const exitVoiceMode = () => {
  isVoiceMode.value = false
  voiceInputText.value = ''
  
  // 停止录音
  if (isRecording.value) {
    stopRecording()
  }
  
  // 停止TTS播放
  if (isTTSPlaying.value) {
    ttsService.stop()
    isTTSPlaying.value = false
  }
  
  // 重置所有状态
  isTranscribing.value = false
  isWaitingResponse.value = false
  lastVoiceResponse.value = ''
  voiceResponseText.value = '' // 清除字幕文本
  
  // 停止正弦波动画
  stopWaveAnimation()
  
  // 移除键盘事件监听
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
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

  isTranscribing.value = true
  try {
    // 创建音频文件
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
    
    // 调用语音转文字
    const transcription = await transcribeAudio(audioBlob)
    
    if (transcription.trim()) {
      // 在语音模式下，直接自动提交消息，不填入输入框
      if (isVoiceMode.value) {
        await autoSubmitVoiceMessage(transcription.trim())
      } else {
        // 非语音模式下，将转录结果添加到语音输入框
        voiceInputText.value = transcription.trim()
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
    audioChunks = []
  }
}

// 语音转文字API调用
const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // 创建FormData
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('language', 'zh') // 默认中文，也可以让模型自动检测

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
    return result.text || ''
  } catch (error) {
    console.error('语音转文字API调用失败:', error)
    throw error
  }
}

// 自动提交语音消息并等待回复（语音模式专用，使用传统聊天流程但不显示UI）
const autoSubmitVoiceMessage = async (text: string) => {
  try {
    // 添加用户消息到语音对话历史
    voiceConversationHistory.value.push({
      type: 'user',
      text: text,
      timestamp: Date.now(),
      summary: text.length > 50 ? text.substring(0, 50) + '...' : text
    })

    // 设置等待回复状态
    isWaitingResponse.value = true
    
    // 语音模式下使用传统聊天流程（支持MCP工具调用），但不显示UI
    await sendVoiceMessageWithMCP(text)
    
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

// 从内容中提取纯文本
const extractPlainTextFromContent = (content: string): string => {
  if (!content) return ''
  
  // 移除各种标签
  let cleanText = content
    // 移除antThinking标签
    .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, '')
    // 移除antArtifact标签
    .replace(/<antArtifact[^>]*>[\s\S]*?<\/antArtifact>/g, '')
    // 移除tool_call相关标签
    .replace(/<tool_call[^>]*>/g, '')
    .replace(/<tool_response[^>]*>/g, '')
    .replace(/<tool_call_end[^>]*>/g, '')
    .replace(/<tool_call_error[^>]*>/g, '')
    .replace(/<maximum_tool_calls_reached[^>]*>/g, '')
    // 移除其他HTML标签
    .replace(/<[^>]*>/g, '')
    // 移除markdown代码块标记
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    // 移除markdown链接格式 [text](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 移除markdown粗体和斜体
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    .trim()
  
  return cleanText
}

// 智能分割文本，优先按句子分割，确保完整句子播放
const smartSplitText = (text: string, minLength: number = 80): string => {
  if (!text || text.length < minLength) return text
  
  console.log(`[智能分割] 处理文本长度: ${text.length}，最小长度: ${minLength}`)
  
  // 按句子分割，保留标点符号
  const sentences = text.split(/([。！？；.!?;])/)
  let result = ''
  let currentLength = 0
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] || ''
    const punctuation = sentences[i + 1] || ''
    const fullSentence = sentence + punctuation
    
    console.log(`[智能分割] 检查句子: "${fullSentence.substring(0, 20)}..." (${fullSentence.length}字符)`)
    
    // 如果已经有内容且加上新句子会超过合理长度，就停止
    if (result && currentLength + fullSentence.length > minLength * 2) {
      console.log(`[智能分割] 达到合理长度，停止添加`)
      break
    }
    
    result += fullSentence
    currentLength += fullSentence.length
    
    console.log(`[智能分割] 添加句子，当前长度: ${currentLength}`)
    
    // 如果遇到强结束符且长度足够，可以结束
    if (/[。！？；.!?;]/
        .test(punctuation) && currentLength >= minLength) {
      console.log(`[智能分割] 遇到强结束符且长度足够，结束分割`)
      break
    }
  }
  
  // 如果没有找到合适的句子分割点，但有内容，就返回
  if (result.trim()) {
    console.log(`[智能分割] 返回完整句子组合: ${result.length}字符`)
    return result.trim()
  }
  
  // 如果还是没有内容，按字符截取，但尽量在标点处截断
  if (text.length >= minLength) {
    const substring = text.substring(0, minLength * 1.5)
    // 尝试在最后一个标点符号处截断
    const lastPunctuation = Math.max(
      substring.lastIndexOf('。'),
      substring.lastIndexOf('！'),
      substring.lastIndexOf('？'),
      substring.lastIndexOf('；'),
      substring.lastIndexOf('.'),
      substring.lastIndexOf('!'),
      substring.lastIndexOf('?'),
      substring.lastIndexOf(';'),
      substring.lastIndexOf('，'),
      substring.lastIndexOf(',')
    )
    
    if (lastPunctuation > minLength * 0.8) {
      const result = substring.substring(0, lastPunctuation + 1)
      console.log(`[智能分割] 在标点处截断: ${result.length}字符`)
      return result
    } else {
      console.log(`[智能分割] 按字符截断: ${substring.length}字符`)
      return substring
    }
  }
  
  return text
}

// 语音模式专用：使用传统聊天流程发送消息（支持MCP工具调用）
const sendVoiceMessageWithMCP = async (text: string) => {
  try {
    // 创建临时聊天线程（用于MCP工具调用）
    const threadId = await chatStore.createThread(text, {
      providerId: activeModel.value.providerId,
      modelId: activeModel.value.id,
      systemPrompt: systemPrompt.value,
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
    
    // 实时监听AI回复并播放TTS
    const checkForStreamingResponse = async () => {
      let attempts = 0
      const maxAttempts = 120 // 增加到120秒，因为需要处理流式输出
      
      while (attempts < maxAttempts && !isStreamCompleted) {
        await new Promise(resolve => setTimeout(resolve, 300)) // 减少到300ms，更快响应
        attempts++
        
        const messages = chatStore.getMessages()
        const lastMessage = messages[messages.length - 1]
        const workingStatus = chatStore.getThreadWorkingStatus(threadId)
        
        if (lastMessage && lastMessage.role === 'assistant') {
          const assistantContent = lastMessage.content
          console.log(`[实时语音] 🔍 检查 ${attempts}/${maxAttempts}:`, {
            messagesCount: messages.length,
            workingStatus,
            contentBlocks: Array.isArray(assistantContent) ? assistantContent.length : 0,
            queueLength: ttsQueue.value.length,
            isProcessing: isProcessingTTS.value,
            isPlaying: isTTSPlaying.value
          })
          
          // 检查新的内容块
          if (assistantContent && Array.isArray(assistantContent)) {
            console.log('[实时语音] 🧩 检查内容块数组，长度:', assistantContent.length)
            
            for (let i = 0; i < assistantContent.length; i++) {
              const block = assistantContent[i]
              const blockKey = `${lastMessage.id}-${i}`
              
              console.log(`[实时语音] 🧩 检查块 ${i}:`, {
                blockType: block.type,
                blockStatus: block.status,
                hasContent: !!block.content,
                contentLength: block.content?.length || 0,
                blockKey,
                playedPosition: playedContentBlocks.get(blockKey) || 0
              })
              
              // 处理content类型的块，不再等待success状态
              if (block.type === 'content' && block.content) {
                const currentPlayedPosition = playedContentBlocks.get(blockKey) || 0
                const cleanText = extractPlainTextFromContent(block.content)
                
                if (cleanText.length > currentPlayedPosition) {
                  // 获取未播放的部分
                  const unplayedText = cleanText.substring(currentPlayedPosition)
                  console.log(`[实时语音] 📝 未播放文本长度: ${unplayedText.length}`)
                  
                  // 检查是否有足够的文本可以播放（至少80个字符或遇到强结束符）
                  const shouldPlay = unplayedText.length >= 80 || 
                                   /[。！？.!?]/.test(unplayedText) ||
                                   block.status === 'success' // 如果块已完成，播放剩余内容
                  
                  if (shouldPlay) {
                    // 使用智能分割函数获取要播放的文本
                    const textToPlay = smartSplitText(unplayedText, 80)
                    
                    if (textToPlay.trim()) {
                      console.log(`[实时语音] ✨ 准备播放片段 (${textToPlay.length}字符):`, textToPlay.substring(0, 50) + '...')
                      
                      // 更新已播放位置
                      playedContentBlocks.set(blockKey, currentPlayedPosition + textToPlay.length)
                      
                      // 立即播放这段内容
                      await playTTSResponse(textToPlay.trim())
                    }
                  }
                }
              } else {
                // 只在调试模式下显示跳过信息，减少日志冗余
                if (block.type !== 'tool_call') {
                  console.log(`[实时语音] ⏭️ 跳过块 ${i}:`, {
                    reason: block.type !== 'content' ? '类型不匹配' : '无内容',
                    blockType: block.type
                  })
                }
              }
            }
          } else {
            console.log('[实时语音] 🚫 无内容块或不是数组')
          }
          
          // 检查是否完成
          if (!workingStatus) {
            console.log('[实时语音] 🏁 AI回复完成，等待TTS队列播放完成')
            console.log('[实时语音] 📊 完成时状态:', {
              queueLength: ttsQueue.value.length,
              isProcessing: isProcessingTTS.value,
              isPlaying: isTTSPlaying.value,
              playedBlocks: playedContentBlocks.size
            })
            isStreamCompleted = true
            
            // 等待TTS队列播放完成
            let waitCount = 0
            while (ttsQueue.value.length > 0 || isProcessingTTS.value || isTTSPlaying.value) {
              waitCount++
              await new Promise(resolve => setTimeout(resolve, 500))
              console.log(`[实时语音] ⏳ 等待TTS队列完成 (${waitCount}):`, {
                剩余: ttsQueue.value.length,
                处理中: isProcessingTTS.value,
                播放中: isTTSPlaying.value,
                等待时间: waitCount * 0.5 + 's'
              })
              
              // 防止无限等待
              if (waitCount > 240) { // 2分钟超时
                console.error('[实时语音] ⚠️ 等待TTS队列超时，强制结束')
                break
              }
            }
            
            console.log('[实时语音] ✅ 所有语音播放完成，总等待次数:', waitCount)
            isWaitingResponse.value = false
            return
          }
        }
      }
      
      // 超时处理
      console.warn('[实时语音] 等待超时')
      isWaitingResponse.value = false
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

// TTS播放队列
const ttsQueue = ref<string[]>([])
const isProcessingTTS = ref(false)

// 添加到TTS队列
const playTTSResponse = async (responseText: string) => {
  if (!responseText.trim()) return
  
  const textPreview = responseText.substring(0, 50) + (responseText.length > 50 ? '...' : '')
  console.log('[TTS队列] 📝 添加到队列:', textPreview)
  console.log('[TTS队列] 📊 队列状态 - 当前长度:', ttsQueue.value.length, '处理中:', isProcessingTTS.value, '播放中:', isTTSPlaying.value)
  
  ttsQueue.value.push(responseText)
  console.log('[TTS队列] 📝 添加完成，新长度:', ttsQueue.value.length)
  
  // 开始处理队列
  processTTSQueue()
}

// 处理TTS队列
const processTTSQueue = async () => {
  if (isProcessingTTS.value || ttsQueue.value.length === 0) {
    return
  }
  
  isProcessingTTS.value = true
  console.log('[TTS队列] 开始处理队列，剩余:', ttsQueue.value.length)
  
  while (ttsQueue.value.length > 0) {
    const text = ttsQueue.value.shift()!
    const textPreview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
    console.log('[TTS队列] 处理下一个项目:', textPreview)
    
    try {
      await playTTSResponseDirect(text)
      console.log('[TTS队列] 项目处理完成，剩余:', ttsQueue.value.length)
    } catch (error) {
      console.error('[TTS队列] 项目处理失败:', error)
      // 继续处理下一个项目
    }
  }
  
  console.log('[TTS队列] 所有项目处理完成')
  isProcessingTTS.value = false
  
  console.log('[TTS队列] 队列处理结束')
}

// 分割长文本为较短的段落
function splitLongText(text: string, minLength: number = 100, maxLength: number = 400): string[] {
  if (text.length <= maxLength) {
    return [text]
  }
  
  console.log(`[智能分段] 开始分段，文本长度: ${text.length}，最小: ${minLength}，最大: ${maxLength}`)
  
  const segments: string[] = []
  
  // 定义句子结束标点符号（中英文）
  const sentenceEnders = /[。！？；.!?;]/
  const strongEnders = /[。！？.!?]/  // 强结束符
  
  // 按句子分割，保留标点符号
  const sentences = text.split(/(。|！|？|；|\.|!|\?|;)/).filter(part => part.trim())
  
  let currentSegment = ''
  let i = 0
  
  while (i < sentences.length) {
    const sentence = sentences[i]
    const punctuation = sentences[i + 1] || ''
    
    // 构建完整句子
    let fullSentence = sentence
    if (punctuation && sentenceEnders.test(punctuation)) {
      fullSentence += punctuation
      i += 2 // 跳过标点符号
    } else {
      i += 1
    }
    
    // 检查添加这个句子后的长度
    const potentialSegment = currentSegment + fullSentence
    
    console.log(`[智能分段] 处理句子: "${fullSentence.substring(0, 30)}..." (${fullSentence.length}字符)`)
    console.log(`[智能分段] 当前段落: ${currentSegment.length}字符，潜在长度: ${potentialSegment.length}字符`)
    
    if (potentialSegment.length <= maxLength) {
      // 可以添加到当前段落
      currentSegment = potentialSegment
      console.log(`[智能分段] 添加到当前段落，新长度: ${currentSegment.length}`)
      
      // 如果遇到强结束符且长度足够，可以考虑分段
      if (strongEnders.test(punctuation) && currentSegment.length >= minLength) {
        // 检查下一个句子，如果加上会超长，就在这里分段
        const nextSentence = sentences[i] || ''
        const nextPunctuation = sentences[i + 1] || ''
        const nextFullSentence = nextSentence + (sentenceEnders.test(nextPunctuation) ? nextPunctuation : '')
        
        if (currentSegment.length + nextFullSentence.length > maxLength) {
          console.log(`[智能分段] 在强结束符处分段，段落长度: ${currentSegment.length}`)
          segments.push(currentSegment.trim())
          currentSegment = ''
        }
      }
    } else {
      // 添加会超长
      if (currentSegment.length >= minLength) {
        // 当前段落已经足够长，保存并开始新段落
        console.log(`[智能分段] 段落已满，保存段落: ${currentSegment.length}字符`)
        segments.push(currentSegment.trim())
        currentSegment = fullSentence
      } else if (fullSentence.length > maxLength) {
        // 单个句子太长，需要特殊处理
        console.log(`[智能分段] 单句过长(${fullSentence.length}字符)，需要特殊分割`)
        
        // 先保存当前段落（如果有）
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim())
        }
        
        // 对超长句子进行智能分割
        const longSentenceParts = splitLongSentence(fullSentence, maxLength)
        segments.push(...longSentenceParts)
        currentSegment = ''
      } else {
        // 当前段落太短，但加上新句子会超长，强制添加
        currentSegment = potentialSegment
        console.log(`[智能分段] 强制添加句子，段落长度: ${currentSegment.length}`)
      }
    }
  }
  
  // 添加最后的段落
  if (currentSegment.trim()) {
    console.log(`[智能分段] 添加最后段落: ${currentSegment.length}字符`)
    segments.push(currentSegment.trim())
  }
  
  // 过滤空段落并记录结果
  const finalSegments = segments.filter(seg => seg.trim().length > 0)
  console.log(`[智能分段] 分段完成，共${finalSegments.length}段:`)
  finalSegments.forEach((seg, idx) => {
    console.log(`[智能分段] 段落${idx + 1}: ${seg.length}字符 - "${seg.substring(0, 50)}..."`)
  })
  
  return finalSegments
}

// 分割超长单句
function splitLongSentence(sentence: string, maxLength: number): string[] {
  console.log(`[超长句子分割] 处理长度: ${sentence.length}，最大: ${maxLength}`)
  
  const parts: string[] = []
  
  // 尝试按逗号、分号等弱标点分割
  const weakPunctuations = /[，,、；;：:]/
  const weakParts = sentence.split(/(，|,|、|；|;|：|:)/).filter(part => part.trim())
  
  let currentPart = ''
  let i = 0
  
  while (i < weakParts.length) {
    const part = weakParts[i]
    const punctuation = weakParts[i + 1] || ''
    
    const fullPart = part + (weakPunctuations.test(punctuation) ? punctuation : '')
    const potentialPart = currentPart + fullPart
    
    if (potentialPart.length <= maxLength) {
      currentPart = potentialPart
      i += weakPunctuations.test(punctuation) ? 2 : 1
    } else {
      if (currentPart) {
        parts.push(currentPart.trim())
        currentPart = fullPart
      } else {
        // 连一个小部分都太长，按字符强制分割
        const charParts = splitByCharacters(fullPart, maxLength)
        parts.push(...charParts)
        currentPart = ''
      }
      i += weakPunctuations.test(punctuation) ? 2 : 1
    }
  }
  
  if (currentPart.trim()) {
    parts.push(currentPart.trim())
  }
  
  console.log(`[超长句子分割] 分割为${parts.length}部分`)
  return parts.filter(part => part.trim().length > 0)
}

// 按字符强制分割（最后手段）
function splitByCharacters(text: string, maxLength: number): string[] {
  console.log(`[字符分割] 强制分割，长度: ${text.length}`)
  const parts: string[] = []
  
  for (let i = 0; i < text.length; i += maxLength) {
    const part = text.substring(i, i + maxLength)
    parts.push(part)
  }
  
  return parts
}

// 播放TTS响应（直接播放）
async function playTTSResponseDirect(text: string) {
  console.log(`[TTS播放] 开始播放: ${text}`)
  
  try {
    // 设置播放状态
    isTTSPlaying.value = true
    lastVoiceResponse.value = text
    voiceResponseText.value = text // 设置字幕文本
    
    console.log(`[TTS播放] 设置状态完成，开始添加到历史记录`)
    
    // 添加AI回复到语音对话历史
    voiceConversationHistory.value.push({
      type: 'assistant',
      text: text,
      timestamp: Date.now(),
      summary: text.length > 50 ? text.substring(0, 50) + '...' : text
    })
    
    console.log(`[TTS播放] 开始调用TTS服务`)
    
    // 检查文本长度，如果太长则分段处理
    if (text.length > 400) {
      console.log(`[TTS播放] 文本较长(${text.length}字符)，进行分段处理`)
      const segments = splitLongText(text, 120, 400) // 最小120字符，最大400字符
      console.log(`[TTS播放] 分割为${segments.length}段`)
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        console.log(`[TTS播放] 播放第${i + 1}/${segments.length}段: ${segment.substring(0, 50)}...`)
        
        try {
          // 增加超时时间，适应更大的分段
          await Promise.race([
            ttsService.playWithGPTTTS(segment),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('TTS播放超时')), 45000) // 增加到45秒
            )
          ])
          console.log(`[TTS播放] 第${i + 1}段播放完成`)
        } catch (error) {
          console.error(`[TTS播放] 第${i + 1}段播放失败:`, error)
          // 继续播放下一段，不中断整个流程
        }
      }
    } else {
      // 短文本直接播放
      try {
        await Promise.race([
          ttsService.playWithGPTTTS(text),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TTS播放超时')), 30000) // 增加到30秒
          )
        ])
      } catch (error) {
        console.error(`[TTS播放] 短文本播放失败:`, error)
        // 静默失败，不显示错误提示
      }
    }
    
    console.log(`[TTS播放] TTS播放完成`)
  } catch (error) {
    console.error(`[TTS播放] TTS播放失败:`, error)
    
    // 停止TTS播放
    try {
      ttsService.stop()
    } catch (stopError) {
      console.error(`[TTS播放] 停止TTS失败:`, stopError)
    }
    
    // 移除错误提示，静默失败
    console.log(`[TTS播放] TTS失败，静默处理`)
  } finally {
    // 清理状态
    isTTSPlaying.value = false
    
    console.log(`[TTS播放] 清理状态完成`)
    
    // TTS播放完成后，延迟清除字幕
    setTimeout(() => {
      if (!isTTSPlaying.value) { // 只有在没有其他播放时才清除
        voiceResponseText.value = ''
      }
    }, 1000)
  }
}

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
