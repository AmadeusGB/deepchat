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
        <!-- Recording status indicator -->
        <div class="figma-voice-status-container mb-4">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <div 
              class="w-3 h-3 rounded-full transition-colors"
              :class="isRecording ? 'bg-red-500 animate-pulse' : isTranscribing ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'"
            ></div>
            <span>
              {{ 
                isRecording 
                  ? t('chat.input.voiceRecording') 
                  : isTranscribing 
                    ? t('chat.input.voiceTranscribing')
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
          <div 
            v-for="(bar, i) in figmaWaveformBars" 
            :key="i"
            class="figma-voice-bar"
            :class="`figma-voice-bar-${bar.gradient}`"
            :style="{
              position: 'absolute',
              left: `${(bar.x / 838) * 100}%`,
              bottom: `${(bar.y / 144.2) * 100}%`,
              width: `${(bar.width / 838) * 100}%`,
              height: `${Math.max(waveformHeights[i] || bar.height, 4)}px`,
              borderRadius: '50px'
            }"
          ></div>
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
          <!-- Voice mode input (smaller) -->
          <div v-if="isVoiceMode" class="figma-voice-input-container flex items-center gap-4">
            <div class="figma-voice-input-box">
              <input 
                v-model="voiceInputText"
                type="text" 
                class="figma-voice-input"
                :placeholder="t('chat.input.placeholder')"
                @keydown.enter="handleVoiceInputSend"
              />
            </div>
            <Button
              class="figma-text-chat-button"
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
import { useI18n } from 'vue-i18n'
import ChatInput from './ChatInput.vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import ModelIcon from './icons/ModelIcon.vue'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@iconify/vue'
import ModelSelect from './ModelSelect.vue'
import { useChatStore } from '@/stores/chat'
import { MODEL_META } from '@shared/presenter'
import { useSettingsStore } from '@/stores/settings'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { UserMessageContent } from '@shared/chat'
import ChatConfig from './ChatConfig.vue'
import { usePresenter } from '@/composables/usePresenter'
import { useEventListener } from '@vueuse/core'
import { useThemeStore } from '@/stores/theme'

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

// 根据Figma设计的波浪数据
const figmaWaveformBars = ref([
  { x: 63.25, y: 90.43, width: 212.46, height: 48.29, gradient: 'gradient1' },
  { x: 615.65, y: 90.43, width: 156.14, height: 48.29, gradient: 'gradient2' },
  { x: 305.1, y: 29.74, width: 310.66, height: 60.6, gradient: 'gradient3' },
  { x: 615.65, y: 37.75, width: 222.35, height: 52.68, gradient: 'gradient3' },
  { x: 500.45, y: 90.34, width: 133.71, height: 53.87, gradient: 'gradient2' },
  { x: 276.13, y: 0, width: 213.33, height: 90.34, gradient: 'gradient3' },
  { x: 334.44, y: 90.34, width: 208.2, height: 30.69, gradient: 'gradient2' },
  { x: 541.54, y: 73.5, width: 209.3, height: 16.84, gradient: 'gradient3' },
  { x: 126.25, y: 41.01, width: 208.2, height: 49.32, gradient: 'gradient3' },
  { x: 549.17, y: 53.04, width: 93.68, height: 37.3, gradient: 'gradient3' },
  { x: 396.61, y: 90.34, width: 168.74, height: 24.06, gradient: 'gradient2' },
  { x: 230.35, y: 19.88, width: 166.26, height: 70.46, gradient: 'gradient3' },
  { x: 0, y: 41.27, width: 207.52, height: 49.17, gradient: 'gradient4' },
  { x: 549.44, y: 90.43, width: 173.92, height: 28.1, gradient: 'gradient2' }
])

// 动态高度调整（用于动画）
const waveformHeights = ref<number[]>(figmaWaveformBars.value.map(bar => bar.height))

// 音频相关状态
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let microphone: MediaStreamAudioSourceNode | null = null
let dataArray: Uint8Array | null = null
let animationFrameId: number | null = null

// 语音录制状态
const isRecording = ref(false)
const isTranscribing = ref(false)
const isSpacePressed = ref(false)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

// 进入语音模式
const enterVoiceMode = () => {
  isVoiceMode.value = true
  initAudioAnalysis()
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
}

// 退出语音模式
const exitVoiceMode = () => {
  isVoiceMode.value = false
  voiceInputText.value = ''
  stopAudioAnalysis()
  stopRecording()
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

// 处理语音输入发送
const handleVoiceInputSend = () => {
  if (voiceInputText.value.trim()) {
    handleSend({
      text: voiceInputText.value.trim(),
      files: [],
      links: [],
      think: false,
      search: false
    })
  }
}

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
  } catch (error) {
    console.error('开始录音失败:', error)
  }
}

// 停止语音录制
const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false
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
      // 将转录结果添加到语音输入框
      voiceInputText.value = transcription.trim()
    }
  } catch (error) {
    console.error('语音转文字失败:', error)
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

// 切换录制状态（点击语音波浪时）
const toggleVoiceRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    startVoiceRecording()
  }
}

// 初始化音频分析
const initAudioAnalysis = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
    
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    microphone = audioContext.createMediaStreamSource(stream)
    
    // 提高分析精度和灵敏度
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.3
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    
    const bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
    
    microphone.connect(analyser)
    
    startWaveformAnimation()
  } catch (error) {
    console.error('Error accessing microphone:', error)
    // 如果无法访问麦克风，使用默认动画
    startFallbackAnimation()
  }
}

// 真实音频波形动画
const startWaveformAnimation = () => {
  const updateWaveform = () => {
    if (!analyser || !dataArray) return
    
    analyser.getByteFrequencyData(dataArray)
    
    // 专注于语音频率范围 (85Hz - 3400Hz)
    const speechStartIndex = Math.floor((85 / (audioContext!.sampleRate / 2)) * dataArray.length)
    const speechEndIndex = Math.floor((3400 / (audioContext!.sampleRate / 2)) * dataArray.length)
    
    // 提取语音频段数据
    const speechData = dataArray.slice(speechStartIndex, speechEndIndex)
    
    // 计算语音能量
    const speechEnergy = speechData.reduce((sum, value) => sum + value * value, 0) / speechData.length
    const normalizedEnergy = Math.sqrt(speechEnergy) / 255
    
    // 更新波形高度
    waveformHeights.value = figmaWaveformBars.value.map((bar, i) => {
      // 基础高度来自Figma设计
      const baseHeight = bar.height
      
      // 计算当前条对应的频率索引
      const frequencyIndex = speechStartIndex + Math.floor((i / figmaWaveformBars.value.length) * speechData.length)
      const frequencyValue = dataArray![frequencyIndex] || 0
      
      // 增强灵敏度的计算
      const localIntensity = (frequencyValue / 255) * (frequencyValue / 255) // 平方增强对比度
      const energyBoost = normalizedEnergy * 2 // 增强整体能量影响
      
      // 添加一些随机变化模拟真实语音的复杂性
      const randomVariation = (Math.random() - 0.5) * 0.2 * normalizedEnergy
      
      // 计算最终高度
      const dynamicHeight = baseHeight + 
                           localIntensity * 30 + 
                           energyBoost * 20 + 
                           randomVariation * 10
      
      // 限制高度范围并添加平滑过渡
      const targetHeight = Math.max(baseHeight * 0.5, Math.min(dynamicHeight, baseHeight * 2))
      const currentHeight = waveformHeights.value[i] || baseHeight
      
      // 平滑过渡
      return currentHeight + (targetHeight - currentHeight) * 0.4
    })
    
    animationFrameId = requestAnimationFrame(updateWaveform)
  }
  
  updateWaveform()
}

// 备用动画（麦克风不可用时）
const startFallbackAnimation = () => {
  let time = 0
  const animate = () => {
    time += 0.05
    waveformHeights.value = figmaWaveformBars.value.map((bar, i) => {
      // 基础高度来自Figma设计
      const baseHeight = bar.height
      
      // 创建更自然的波形模拟
      const wave1 = Math.sin(time * 2 + i * 0.4) * (baseHeight * 0.2)
      const wave2 = Math.sin(time * 3.2 + i * 0.6) * (baseHeight * 0.15)
      const wave3 = Math.sin(time * 1.8 + i * 0.2) * (baseHeight * 0.1)
      const randomNoise = (Math.random() - 0.5) * (baseHeight * 0.05)
      
      const height = baseHeight + wave1 + wave2 + wave3 + randomNoise
      return Math.max(baseHeight * 0.5, Math.min(height, baseHeight * 1.5))
    })
    animationFrameId = requestAnimationFrame(animate)
  }
  animate()
}

// 停止音频分析
const stopAudioAnalysis = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
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
  
  // 重置波形高度为Figma设计的原始值
  waveformHeights.value = figmaWaveformBars.value.map(bar => bar.height)
}

// 组件销毁时清理音频资源
onUnmounted(() => {
  stopAudioAnalysis()
})

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
  max-width: 100%;
  margin: 0 auto;
  transition: all 0.3s ease;
  padding: 20px;
  border-radius: 20px;
}

.figma-voice-waveform-bars:hover {
  background: rgba(73, 90, 245, 0.1);
}

.figma-voice-waveform-bars.recording {
  background: rgba(239, 68, 68, 0.1);
}

.figma-voice-waveform-bars.transcribing {
  background: rgba(59, 130, 246, 0.1);
}

.figma-voice-bar {
  transition: all 0.1s ease-in-out;
  min-height: 4px;
}

/* Figma gradient styles */
.figma-voice-bar-gradient1 {
  background: linear-gradient(180deg, 
    rgba(73, 94, 219, 0.05) 0%, 
    rgba(0, 163, 255, 0.5) 100%);
}

.figma-voice-bar-gradient2 {
  background: linear-gradient(180deg, 
    rgba(93, 139, 250, 0) 0%, 
    rgba(0, 163, 255, 0.5) 100%);
}

.figma-voice-bar-gradient3 {
  background: linear-gradient(180deg, 
    rgba(0, 163, 255, 0.5) 0%, 
    rgba(73, 94, 219, 0.05) 100%);
}

.figma-voice-bar-gradient4 {
  background: linear-gradient(180deg, 
    rgba(73, 94, 219, 0.05) 0%, 
    rgba(0, 163, 255, 0.5) 100%);
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
