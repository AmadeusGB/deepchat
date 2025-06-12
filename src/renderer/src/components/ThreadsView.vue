<template>
  <div
    class="w-full h-full overflow-hidden flex-shrink-0 flex flex-col figma-sidebar"
  >
    <!-- 顶部区域：Logo + Search histories + New Chat -->
    <div class="flex-none space-y-6 mb-12">
      <!-- DeepChat Logo -->
      <div class="flex justify-center">
        <img src="@/assets/figma-icons/dper.png" alt="DeepChat" class="figma-logo" />
      </div>
      
      <!-- Search histories 按钮 -->
      <div class="figma-search-histories">
        <span>Search histories</span>
      </div>

      <!-- 新会话按钮 -->
      <div class="flex flex-row gap-3">
        <Button
          class="w-0 flex-1 justify-center figma-new-chat-btn"
          @click="createNewThread"
        >
          <span>New Chat</span>
        </Button>
        <Button
          v-if="windowSize.width.value < 1024"
          variant="outline"
          size="icon"
          class="flex-shrink-0 text-xs justify-center h-8 w-8"
          @click="chatStore.isSidebarOpen = false"
        >
          <Icon icon="lucide:x" class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Historical Chats 区域 -->
    <div class="flex-1 flex flex-col">
      <!-- Historical Chats 标题 -->
      <div class="flex-none mb-4">
        <h3 class="figma-historical-title">Historical Chats</h3>
      </div>
      
      <!-- 可滚动的会话列表 -->
      <ScrollArea ref="scrollAreaRef" class="flex-1" @scroll="handleScroll">
        <div v-for="thread in chatStore.threads" :key="thread.dt" class="space-y-2.5 mb-3">
          <div class="text-xs font-semibold text-muted-foreground px-2">{{ thread.dt }}</div>
          <ul class="space-y-2.5">
            <ThreadItem
              v-for="dtThread in thread.dtThreads"
              :key="dtThread.id"
              :thread="dtThread"
              :is-active="dtThread.id === chatStore.getActiveThreadId()"
              :working-status="chatStore.getThreadWorkingStatus(dtThread.id)"
              @select="handleThreadSelect"
              @rename="showRenameDialog(dtThread)"
              @delete="showDeleteDialog(dtThread)"
              @cleanmsgs="showCleanMessagesDialog(dtThread)"
              class="figma-thread-item"
            />
          </ul>
        </div>

        <!-- 加载状态提示 -->
        <div v-if="chatStore.isLoading" class="text-xs text-center text-muted-foreground py-2">
          {{ t('common.loading') }}
        </div>
      </ScrollArea>
    </div>
    <Dialog v-model:open="deleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('dialog.delete.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('dialog.delete.description') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="handleDeleteDialogCancel">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="destructive" @click="handleThreadDelete">{{
            t('dialog.delete.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="renameDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('dialog.rename.title') }}</DialogTitle>
          <DialogDescription>{{ t('dialog.rename.description') }}</DialogDescription>
        </DialogHeader>
        <Input v-if="renameThread" v-model="renameThread.title" />
        <DialogFooter>
          <Button variant="outline" @click="handleRenameDialogCancel">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="default" @click="handleThreadRename">{{ t('dialog.confirm') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="cleanMessagesDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('dialog.cleanMessages.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('dialog.cleanMessages.description') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="handleCleanMessagesDialogCancel">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="destructive" @click="handleThreadCleanMessages">{{
            t('dialog.cleanMessages.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/vue'
import ThreadItem from './ThreadItem.vue'
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { usePresenter } from '@/composables/usePresenter'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useChatStore } from '@/stores/chat'
import { CONVERSATION } from '@shared/presenter'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useEventListener, useWindowSize } from '@vueuse/core'
import { SHORTCUT_EVENTS } from '@/events'

const { t } = useI18n()
const chatStore = useChatStore()
const threadP = usePresenter('threadPresenter')
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null)
const deleteDialog = ref(false)
const deleteThread = ref<CONVERSATION | null>(null)
const renameDialog = ref(false)
const renameThread = ref<CONVERSATION | null>(null)
const cleanMessagesDialog = ref(false)
const cleanMessagesThread = ref<CONVERSATION | null>(null)
const currentPage = ref(1) // 当前页码
// const searchQuery = ref('')

const windowSize = useWindowSize()

// 创建新会话
const createNewThread = async () => {
  try {
    await chatStore.createNewEmptyThread()
  } catch (error) {
    console.error(t('common.error.createChatFailed'), error)
  }
}

// 搜索聊天记录（暂时保留用于将来功能）
// const handleSearch = () => {
//   // TODO: 实现搜索功能
//   console.log('搜索:', searchQuery.value)
// }

// 处理滚动事件
const handleScroll = async () => {
  // 通过event.target获取滚动元素
  // const target = event.target as HTMLElement
  // const { scrollTop, scrollHeight, clientHeight } = target
  // 使用viewportRef直接获取
  const viewportElement = scrollAreaRef.value?.$el?.querySelector('.h-full.w-full') as HTMLElement
  const viewportScrollTop = viewportElement?.scrollTop || 0
  const viewportScrollHeight = viewportElement?.scrollHeight || 0
  const viewportClientHeight = viewportElement?.clientHeight || 0
  // console.log('滚动检测数据:', {
  //   scrollTop, scrollHeight, clientHeight,
  //   viewportScrollTop, viewportScrollHeight, viewportClientHeight,
  //   diff: viewportScrollHeight - viewportScrollTop - viewportClientHeight,
  //   isLoading: chatStore.isLoading,
  //   hasMore: chatStore.hasMore
  // })

  // 使用viewport的滚动位置判断
  if (
    viewportScrollHeight - viewportScrollTop - viewportClientHeight < 30 &&
    !chatStore.isLoading &&
    chatStore.hasMore
  ) {
    currentPage.value++
    console.log('触发加载更多, 下一页:', currentPage.value)
    await chatStore.loadThreads(currentPage.value)
  }
}

// 选择会话
const handleThreadSelect = async (thread: CONVERSATION) => {
  try {
    await chatStore.setActiveThread(thread.id)
    if (windowSize.width.value < 1024) {
      chatStore.isSidebarOpen = false
    }
  } catch (error) {
    console.error(t('common.error.selectChatFailed'), error)
  }
}

// 重命名会话
const handleThreadRename = async () => {
  try {
    if (!renameThread.value) {
      return
    }
    await chatStore.renameThread(renameThread.value.id, renameThread.value.title)
  } catch (error) {
    console.error(t('common.error.renameChatFailed'), error)
  }

  renameDialog.value = false
  renameThread.value = null
}

const showDeleteDialog = (thread: CONVERSATION) => {
  deleteDialog.value = true
  deleteThread.value = thread
}

const handleDeleteDialogCancel = () => {
  deleteDialog.value = false
  deleteThread.value = null
}

// 删除会话
const handleThreadDelete = async () => {
  try {
    if (!deleteThread.value) {
      return
    }
    await threadP.deleteConversation(deleteThread.value.id)

    // 删除后重新加载第一页
    currentPage.value = 1
    await chatStore.loadThreads(1)

    if (chatStore.threads.length > 0 && chatStore.threads[0].dtThreads.length > 0) {
      chatStore.setActiveThread(chatStore.threads[0].dtThreads[0].id)
    } else {
      chatStore.createThread(t('common.newChat'), {
        systemPrompt: '',
        temperature: 0.7,
        contextLength: 1000,
        maxTokens: 2000,
        providerId: '',
        modelId: ''
      })
    }
  } catch (error) {
    console.error(t('common.error.deleteChatFailed'), error)
  }

  deleteDialog.value = false
  deleteThread.value = null
}

// 显示清空消息对话框
const showCleanMessagesDialog = (thread: CONVERSATION) => {
  cleanMessagesDialog.value = true
  cleanMessagesThread.value = thread
}

// 取消清空消息对话框
const handleCleanMessagesDialogCancel = () => {
  cleanMessagesDialog.value = false
  cleanMessagesThread.value = null
}

// 清空会话消息
const handleThreadCleanMessages = async () => {
  try {
    if (!cleanMessagesThread.value) {
      return
    }
    await chatStore.clearAllMessages(cleanMessagesThread.value.id)
  } catch (error) {
    console.error(t('common.error.cleanMessagesFailed'), error)
  }

  cleanMessagesDialog.value = false
  cleanMessagesThread.value = null
}

const showRenameDialog = (thread: CONVERSATION) => {
  renameDialog.value = true
  renameThread.value = thread
}

const handleRenameDialogCancel = () => {
  renameDialog.value = false
  renameThread.value = null
}

// 处理清除聊天历史
const handleCleanChatHistory = () => {
  if (chatStore.activeThread) {
    showCleanMessagesDialog(chatStore.activeThread)
  }
}

// 在组件挂载时加载会话列表
onMounted(async () => {
  currentPage.value = 1 // 重置页码
  await chatStore.loadThreads(1)

  // 使用nextTick确保DOM已更新
  nextTick(() => {
    const viewportElement = scrollAreaRef.value?.$el?.querySelector('.h-full.w-full') as HTMLElement
    if (viewportElement) {
      console.log('设置直接DOM滚动监听')
      useEventListener(viewportElement, 'scroll', handleScroll)
    }
  })

  // 监听清除聊天历史的快捷键事件
  window.electron.ipcRenderer.on(SHORTCUT_EVENTS.CLEAN_CHAT_HISTORY, () => {
    handleCleanChatHistory()
  })

  // 监听删除会话的快捷键事件
  window.electron.ipcRenderer.on(SHORTCUT_EVENTS.DELETE_CONVERSATION, () => {
    if (chatStore.activeThread) {
      showDeleteDialog(chatStore.activeThread)
    }
  })
})

// 在组件卸载前移除事件监听
onBeforeUnmount(() => {
  // 移除清除聊天历史的事件监听
  window.electron.ipcRenderer.removeAllListeners(SHORTCUT_EVENTS.CLEAN_CHAT_HISTORY)
})
</script>

<style scoped>
/* Figma UI-inspired sidebar styling - 基于 node-id=44-315 */
.figma-sidebar {
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid transparent;
  border-radius: 25px;
  padding: 30px;
  margin: 0 26px;
  backdrop-filter: blur(20px);
  /* Figma精确阴影效果 */
  box-shadow: 
    -2px 4px 10px 0px rgba(145, 145, 145, 0.05),
    -7px 17px 18px 0px rgba(145, 145, 145, 0.04),
    -15px 37px 24px 0px rgba(145, 145, 145, 0.03),
    -27px 66px 29px 0px rgba(145, 145, 145, 0.01),
    -42px 103px 31px 0px rgba(145, 145, 145, 0),
    inset 0px 4px 4px 0px rgba(255, 255, 255, 0.25),
    inset 0px -5px 4px 0px rgba(255, 255, 255, 0.25);
}

/* Logo styling - 基于Figma尺寸 91×26.29px */
.figma-logo {
  width: 91px;
  height: 26.29px;
}

/* Search histories styling - 基于Figma设计 */
.figma-search-histories {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 15px;
  padding: 10px 20px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 400;
  font-size: 13px;
  line-height: 1.219;
  color: #898989;
  display: flex;
  align-items: center;
  width: 100%;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* New Chat button styling - 基于Figma设计 */
.figma-new-chat-btn {
  background: #495AF5;
  color: #FFFFFF;
  border: none;
  border-radius: 15px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.219;
  padding: 20px;
  transition: all 0.2s ease;
  height: auto;
  min-height: 50px;
  width: 100%;
}

.figma-new-chat-btn:hover {
  background: #3d4ae8;
  transform: translateY(-1px);
}

/* Historical Chats 标题样式 - 基于Figma设计 */
.figma-historical-title {
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.219;
  color: #646466;
  margin: 0;
}

/* 聊天历史项目样式 - 基于Figma设计 */
.figma-thread-item {
  width: 169px;
  border-radius: 15px;
}

.figma-thread-item li {
  padding: 10px 0px;
  font-family: 'Montserrat', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.219;
  color: #000000;
}

/* Dark mode adjustments */
.dark .figma-sidebar {
  background: rgba(255, 255, 255, 0.1);
}

.dark .figma-search-histories {
  background: rgba(40, 40, 40, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #898989;
}

.dark .figma-historical-title {
  color: #646466;
}

.dark .figma-thread-item li {
  color: #FFFFFF;
}
</style>
