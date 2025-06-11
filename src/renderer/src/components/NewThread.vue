<template>
  <div class="h-full w-full flex flex-col items-center justify-start">
    <div class="w-full p-2 flex flex-row gap-2 items-center">
      <Button
        class="w-7 h-7 rounded-md"
        size="icon"
        variant="outline"
        @click="onSidebarButtonClick"
      >
        <Icon v-if="chatStore.isSidebarOpen" icon="lucide:panel-left-close" class="w-4 h-4" />
        <Icon v-else icon="lucide:panel-left-open" class="w-4 h-4" />
      </Button>
    </div>
    
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
      
      <!-- Fixed bottom section aligned with sidebar -->
      <div class="absolute bottom-0 left-0 right-0 flex flex-col items-center" style="padding-bottom: 20px;">
        <!-- Example cards container aligned with input -->
        <div class="figma-example-cards-container w-full max-w-4xl mb-6">
          <div class="figma-example-cards-grid">
            <div class="figma-example-card" @click="insertExample('Help me adjust the node to the fastest node in the United States.')">
              Help me adjust the node to the fastest node in the United States.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch the NBA game this afternoon, help me set it.')">
              I want to watch the NBA game this afternoon, help me set it.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch Mr. Beast\'s channel, help me set it.')">
              I want to watch Mr. Beast's channel, help me set it.
            </div>
            <div class="figma-example-card" @click="insertExample('I want to watch &quot;The Legend of Zhen Huan&quot;, please help me adjust it.')">
              I want to watch "The Legend of Zhen Huan", please help me adjust it.
            </div>
          </div>
        </div>
        
        <!-- Input area aligned with sidebar bottom -->
        <div class="figma-input-container w-full max-w-4xl">
          <ChatInput
            ref="chatInputRef"
            key="newThread"
            class="figma-input-wrapper"
            :rows="1"
            :max-rows="6"
            :context-length="contextLength"
            @send="handleSend"
            @toolbar-toggle="handleToolbarToggle"
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
import { computed, ref, watch, onMounted } from 'vue'
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

const onSidebarButtonClick = () => {
  chatStore.isSidebarOpen = !chatStore.isSidebarOpen
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
  transform: translateY(-80px);
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
</style>
