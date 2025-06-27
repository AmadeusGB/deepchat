<template>
  <div class="flex flex-col h-0 flex-1 gap-2.5" style="padding: 20px 30px 20px 60px;">
    <!-- 消息列表区域 - 对话历史玻璃形态 -->
    <div class="figma-chat-history relative flex-1 overflow-hidden" style="margin-top: 0px; padding: 32px 48px 32px 48px;">
      <MessageList
        :key="chatStore.getActiveThreadId() ?? 'default'"
        ref="messageList"
        :messages="chatStore.getMessages()"
        @scroll-bottom="scrollToBottom"
        class="h-full"
      />
    </div>

    <!-- 输入框区域 - 直接占据父容器宽度匹配聊天历史框 -->
    <div class="figma-input-container w-full relative">
      <ChatInput
        :disabled="!chatStore.getActiveThreadId() || isGenerating"
        @send="handleSend"
        @file-upload="handleFileUpload"
        class="figma-input-wrapper"
        @toolbar-toggle="handleToolbarToggle"
      >
        <template #addon-buttons>
          <!-- 模型信息显示 (在对话中显示当前使用的模型) -->
          <div
            v-if="showToolbar"
            key="chatView-model-info"
            class="overflow-hidden flex items-center h-7 rounded-lg shadow-sm border border-input transition-all duration-300"
          >
            <div
              class="flex border-none rounded-none shadow-none items-center gap-1.5 px-2 h-full bg-muted/30"
            >
              <ModelIcon
                class="w-4 h-4"
                :model-id="chatStore.chatConfig.providerId"
                :is-dark="themeStore.isDark"
              ></ModelIcon>
              <h2 class="text-xs font-medium max-w-[120px] truncate text-muted-foreground">{{ modelName }}</h2>
            </div>
          </div>
        </template>
      </ChatInput>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import MessageList from './message/MessageList.vue'
import ChatInput from './ChatInput.vue'
import ModelIcon from './icons/ModelIcon.vue'
import { useRoute } from 'vue-router'
import { UserMessageContent } from '@shared/chat'
import { STREAM_EVENTS } from '@/events'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const themeStore = useThemeStore()

const messageList = ref()
const showToolbar = ref(true)

// 确保工具栏初始状态正确
const initToolbar = async () => {
  showToolbar.value = true
}

const scrollToBottom = (smooth = true) => {
  messageList.value?.scrollToBottom(smooth)
}
const isGenerating = computed(() => {
  if (!chatStore.getActiveThreadId()) return false
  return chatStore.generatingThreadIds.has(chatStore.getActiveThreadId()!)
})
const handleSend = async (msg: UserMessageContent) => {
  if (messageList.value) {
    // 在发送消息前将aboveThreshold设置为false，确保消息发送过程中总是滚动到底部
    messageList.value.aboveThreshold = false
  }
  scrollToBottom()
  await chatStore.sendMessage(msg)
  // 只有当用户在底部时才自动滚动
  if (!messageList.value?.aboveThreshold) {
    scrollToBottom()
  }
}

const handleFileUpload = () => {
  scrollToBottom()
}

const handleToolbarToggle = (visible: boolean) => {
  showToolbar.value = visible
}

const modelName = computed(() => {
  const config = chatStore.chatConfig
  if (config.modelId) {
    return config.modelId.split('/').pop() || config.modelId
  }
  return 'Default Model'
})

// 监听流式响应
onMounted(async () => {
  // 初始化工具栏状态
  await initToolbar()
  
  window.electron.ipcRenderer.on(STREAM_EVENTS.RESPONSE, (_, msg) => {
    // console.log('stream-response', msg)
    chatStore.handleStreamResponse(msg)
  })

  window.electron.ipcRenderer.on(STREAM_EVENTS.END, (_, msg) => {
    chatStore.handleStreamEnd(msg)
  })

  window.electron.ipcRenderer.on(STREAM_EVENTS.ERROR, (_, msg) => {
    chatStore.handleStreamError(msg)
  })

  if (route.query.modelId && route.query.providerId) {
    const threadId = await chatStore.createThread('新会话', {
      modelId: route.query.modelId as string,
      providerId: route.query.providerId as string,
      artifacts: settingsStore.artifactsEffectEnabled ? 1 : 0
    })
    chatStore.setActiveThread(threadId)
  }
})

// 监听路由变化，创建新线程
watch(
  () => route.query,
  async () => {
    if (route.query.modelId && route.query.providerId) {
      const threadId = await chatStore.createThread('新会话', {
        modelId: route.query.modelId as string,
        providerId: route.query.providerId as string,
        artifacts: settingsStore.artifactsEffectEnabled ? 1 : 0
      })
      chatStore.setActiveThread(threadId)
    }
  }
)

// 清理事件监听
onUnmounted(async () => {
  window.electron.ipcRenderer.removeAllListeners(STREAM_EVENTS.RESPONSE)
  window.electron.ipcRenderer.removeAllListeners(STREAM_EVENTS.END)
  window.electron.ipcRenderer.removeAllListeners(STREAM_EVENTS.ERROR)
})
</script>

<style scoped>
/* CRITICAL FIX: Override ChatInput styles to match NewThread Figma design exactly */
.figma-input-wrapper :deep(.bg-card) {
  background: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(156, 156, 156, 0.4) !important;
  border-radius: 20px !important;
  box-shadow: 
    -2px 4px 10px 0px rgba(145, 145, 145, 0.05), 
    -7px 17px 18px 0px rgba(145, 145, 145, 0.04), 
    -15px 37px 24px 0px rgba(145, 145, 145, 0.03), 
    -27px 66px 29px 0px rgba(145, 145, 145, 0.01), 
    -42px 103px 31px 0px rgba(145, 145, 145, 0),
    inset 0px 4px 4px 0px rgba(255, 255, 255, 0.25), 
    inset 0px -5px 4px 0px rgba(255, 255, 255, 0.25) !important;
}

/* 深色模式下也保持半透明白色背景，与NewThread一致 */
.dark .figma-input-wrapper :deep(.bg-card) {
  background: rgba(255, 255, 255, 0.3) !important;
  border: 1px solid rgba(156, 156, 156, 0.4) !important;
}
</style>
