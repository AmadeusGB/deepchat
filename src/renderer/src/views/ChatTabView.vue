<template>
  <div class="w-full h-full flex-row flex">

    
    <div
      :class="[
        'flex-1 w-0 h-full transition-all duration-200 max-lg:!mr-0',
        artifactStore.isOpen && route.name === 'chat' ? 'mr-[calc(60%_-_104px)]' : ''
      ]"
    >
      <div class="flex h-full">
        <!-- 左侧会话列表 -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          leave-active-class="transition-all duration-300 ease-in"
          enter-from-class="-translate-x-full opacity-0"
          leave-to-class="-translate-x-full opacity-0"
        >
          <div
            v-show="chatStore.isSidebarOpen"
            class="w-60 max-w-60 fixed left-0 z-20 lg:relative"
            style="height: calc(100vh - 40px); top: 20px;"
          >
            <ThreadsView class="transform h-full" />
          </div>
        </Transition>

        <!-- 主聊天区域 -->
        <div class="flex-1 flex flex-col w-0">
          <!-- 新会话 - 🎯 强化语音模式渲染条件 -->
          <NewThread 
            v-if="!chatStore.getActiveThreadId() || isVoiceModeActive || (newThreadRef?.isVoiceMode)" 
            ref="newThreadRef" 
            @exit-voice-mode="handleExitVoiceMode"
          />
          <template v-else>
            <!-- 聊天内容区域 -->
            <ChatView @enter-voice-mode="handleEnterVoiceMode" />
          </template>
        </div>
      </div>
    </div>
    <!-- Artifacts 预览区域 -->
    <ArtifactDialog />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { watch } from 'vue'
import { useArtifactStore } from '@/stores/artifact'
import ArtifactDialog from '@/components/artifacts/ArtifactDialog.vue'
import { useRoute } from 'vue-router'
import { useTitle } from '@vueuse/core'
const ThreadsView = defineAsyncComponent(() => import('@/components/ThreadsView.vue'))
const ChatView = defineAsyncComponent(() => import('@/components/ChatView.vue'))
const NewThread = defineAsyncComponent(() => import('@/components/NewThread.vue'))
const artifactStore = useArtifactStore()
const route = useRoute()
const chatStore = useChatStore()
const title = useTitle()

// 🎯 NewThread组件引用，用于访问语音模式状态
const newThreadRef = ref()

// 🎯 独立的语音模式状态（ChatTabView层面维护）
const isVoiceModeActive = ref(false)

// 🎯 处理退出语音模式事件
const handleExitVoiceMode = () => {
  console.log('[ChatTabView] 📱 收到退出语音模式事件')
  // 🔧 更新独立的语音模式状态
  isVoiceModeActive.value = false
  console.log('[ChatTabView] ✅ 已更新语音模式状态为false')
}

// 🎯 新增：处理进入语音模式事件
const handleEnterVoiceMode = async () => {
  console.log('[ChatTabView] 🎙️ 收到进入语音模式事件')
  console.log('[ChatTabView] 🎙️ 当前活跃线程ID:', chatStore.getActiveThreadId())
  console.log('[ChatTabView] 🎙️ 正在生成的线程:', Array.from(chatStore.generatingThreadIds))
  console.log('[ChatTabView] 🎙️ 当前语音模式状态:', isVoiceModeActive.value)
  
  const activeThreadId = chatStore.getActiveThreadId()
  
  // 🔧 关键修复1：如果有正在生成的线程，先停止生成
  if (activeThreadId && chatStore.generatingThreadIds.has(activeThreadId)) {
    console.log('[ChatTabView] 🛑 检测到活跃线程正在生成，停止生成状态')
    try {
      await chatStore.cancelGenerating(activeThreadId)
      console.log('[ChatTabView] ✅ 已停止线程生成状态')
    } catch (error) {
      console.warn('[ChatTabView] ⚠️ 停止生成状态失败:', error)
    }
  }
  
  // 🔧 关键修复2：立即设置语音模式状态（锁定状态）
  console.log('[ChatTabView] 🔒 锁定语音模式状态为true，防止组件卸载')
  isVoiceModeActive.value = true
  
  // 🔧 强化：在下一个事件循环中再次确认状态
  await nextTick()
  if (!isVoiceModeActive.value) {
    console.error('[ChatTabView] ❌ 语音模式状态被意外重置，重新设置')
    isVoiceModeActive.value = true
  }
  
  // 等待NewThread组件渲染
  await nextTick()
  
  // 🔧 关键修复3：调用NewThread的enterVoiceMode，传递现有线程信息
  if (newThreadRef.value) {
    console.log('[ChatTabView] 🎙️ NewThread已渲染，调用enterVoiceMode，现有线程ID:', activeThreadId)
    
    try {
      // 调用NewThread的enterVoiceMode，并告知要继续使用现有线程
      newThreadRef.value.enterVoiceMode(activeThreadId)
      console.log('[ChatTabView] 🎙️ 已成功调用enterVoiceMode并传递现有线程')
    } catch (error) {
      console.error('[ChatTabView] ❌ 调用enterVoiceMode失败:', error)
    }
  } else {
    console.error('[ChatTabView] ❌ NewThread组件未能渲染')
    // 如果NewThread渲染失败，暂时不重置语音模式状态，等待用户操作
    console.warn('[ChatTabView] ⚠️ 保持语音模式状态，等待用户操作')
  }
}

// 添加标题更新逻辑
const updateTitle = () => {
  const activeThread = chatStore.activeThread
  if (activeThread) {
    title.value = activeThread.title
  } else {
    title.value = 'New Chat'
  }
}

// 监听活动会话变化
watch(
  () => chatStore.activeThread,
  () => {
    updateTitle()
  },
  { immediate: true }
)

// 监听会话标题变化
watch(
  () => chatStore.threads,
  () => {
    if (chatStore.activeThread) {
      updateTitle()
    }
  },
  { deep: true }
)

// 🔧 添加状态变化监听器，追踪问题
watch(isVoiceModeActive, (newValue, oldValue) => {
  console.log('[ChatTabView] 🔍 isVoiceModeActive状态变化:', {
    从: oldValue,
    到: newValue,
    时间: new Date().toLocaleTimeString(),
    activeThreadId: chatStore.getActiveThreadId(),
    渲染条件: !chatStore.getActiveThreadId() || newValue
  })
}, { immediate: true })

// 🔧 添加activeThreadId变化监听器
watch(() => chatStore.getActiveThreadId(), (newThreadId, oldThreadId) => {
  console.log('[ChatTabView] 🔍 activeThreadId状态变化:', {
    从: oldThreadId,
    到: newThreadId,
    时间: new Date().toLocaleTimeString(),
    语音模式: isVoiceModeActive.value,
    渲染条件: !newThreadId || isVoiceModeActive.value
  })
})

</script>

<style>
.bg-grid-pattern {
  background-image:
    linear-gradient(to right, #000 1px, transparent 1px),
    linear-gradient(to bottom, #000 1px, transparent 1px);
  background-size: 20px 20px;
}

/* 添加全局样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db80;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af80;
}
</style>
