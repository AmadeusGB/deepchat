<template>
  <div
    class="w-full max-w-4xl mx-auto"
    @mouseenter="isDragging = false"
  >
    <TooltipProvider>
      <!-- 语音界面 -->
      <div v-if="showVoiceInterface" class="flex flex-col items-center justify-center h-64 bg-transparent">
        <!-- 麦克风状态指示 -->
        <div class="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <div 
            class="w-2 h-2 rounded-full transition-colors"
            :class="microphoneEnabled ? 'bg-green-500' : 'bg-red-500'"
          ></div>
          <span>{{ microphoneEnabled ? t('chat.input.micEnabled') : t('chat.input.micDisabled') }}</span>
        </div>
        
        <!-- 语音波形动画 -->
        <div class="flex items-center justify-center gap-1 h-32 mb-8">
          <div 
            v-for="(height, i) in waveformHeights" 
            :key="i"
            class="bg-primary rounded-full transition-all duration-100 ease-in-out"
            :class="{
              'w-1': true
            }"
            :style="{
              height: `${height}px`
            }"
          ></div>
        </div>
        
        <!-- 文字交流按钮 -->
        <Button
          variant="secondary"
          class="px-6 py-2 rounded-xl text-sm hover:bg-accent"
          @click="showVoiceInterface = false"
        >
          {{ t('chat.input.textChat') }}
        </Button>
      </div>
      
      <!-- 正常聊天界面 -->
      <div v-else>
        <!-- 添加建议按钮区域 -->
      <div class="flex gap-2 mb-4 px-2 overflow-x-auto scrollbar-hide">
        <Button
          v-for="(suggestion, index) in suggestions"
          :key="index"
          variant="outline"
          size="sm"
          class="text-xs h-8 px-4 rounded-full bg-background border-border/50 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0"
          @click="insertSuggestion(suggestion.key)"
        >
          {{ t(suggestion.key) }}
        </Button>
      </div>

      <div
        class="bg-card border border-border rounded-lg focus-within:border-primary p-2 flex flex-col gap-2 shadow-sm relative"
        :class="{
          'ring-2 ring-ring': isDragging
        }"
        @dragenter.prevent="handleDragEnter"
        @dragleave.prevent="handleDragLeave"
        @dragover.prevent="handleDragOver"
        @drop.prevent="handleDrop"
        @paste="handlePaste"
      >
        <!-- {{  t('chat.input.fileArea') }} -->
        <div v-if="selectedFiles.length > 0">
          <TransitionGroup
            name="file-list"
            tag="div"
            class="flex flex-wrap gap-1.5"
            enter-active-class="transition-all duration-300 ease-in-out"
            leave-active-class="transition-all duration-300 ease-in-out"
            enter-from-class="opacity-0 -translate-y-2"
            leave-to-class="opacity-0 -translate-y-2"
            move-class="transition-transform duration-300 ease-in-out"
          >
            <FileItem
              v-for="(file, idx) in selectedFiles"
              :key="file.metadata.fileName"
              :file-name="file.metadata.fileName"
              :deletable="true"
              :mime-type="file.mimeType"
              :tokens="file.token"
              :thumbnail="file.thumbnail"
              @click="previewFile(file.path)"
              @delete="deleteFile(idx)"
            />
          </TransitionGroup>
        </div>
        <!-- {{ t('chat.input.inputArea') }} -->
        <editor-content
          :editor="editor"
          class="p-2 text-sm"
          @keydown.enter.exact="handleEditorEnter"
        />

        <div class="flex items-center justify-between">
          <!-- {{ t('chat.input.functionSwitch') }} -->
          <div class="flex gap-1.5">
            <!-- 工具栏展开/收起按钮 -->
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline"
                  size="icon"
                  class="w-7 h-7 text-xs rounded-lg"
                  @click="showToolbar = !showToolbar"
                >
                  <Icon 
                    :icon="showToolbar ? 'lucide:chevron-left' : 'lucide:chevron-right'" 
                    class="w-4 h-4" 
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ showToolbar ? t('chat.input.hideToolbar') : t('chat.input.showToolbar') }}</TooltipContent>
            </Tooltip>

            <!-- 工具栏内容 (条件渲染) -->
            <template v-if="showToolbar">
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    class="w-7 h-7 text-xs rounded-lg"
                    @click="openFilePicker"
                  >
                    <Icon icon="lucide:paperclip" class="w-4 h-4" />
                    <input
                      ref="fileInput"
                      type="file"
                      class="hidden"
                      multiple
                      accept="application/json,application/javascript,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/vnd.apple.numbers,text/markdown,application/x-yaml,application/xml,application/typescript,text/typescript,text/x-typescript,application/x-typescript,application/x-sh,text/*,application/pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/html,text/css,application/xhtml+xml,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rb,.php,.rs,.swift,.kt,.scala,.pl,.lua,.sh,.json,.yaml,.yml,.xml,.html,.htm,.css,.md,audio/mp3,audio/wav,audio/mp4,audio/mpeg,.mp3,.wav,.m4a"
                      @change="handleFileSelect"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t('chat.input.fileSelect') }}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <span
                    class="search-engine-select overflow-hidden flex items-center h-7 rounded-lg shadow-sm border border-input transition-all duration-300"
                    :class="{
                      'border-primary': settings.webSearch
                    }"
                  >
                    <Button
                      variant="outline"
                      :class="[
                        'flex w-7 border-none rounded-none shadow-none items-center gap-1.5 px-2 h-full',
                        settings.webSearch
                          ? 'dark:!bg-primary bg-primary border-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                          : ''
                      ]"
                      size="icon"
                      @click="onWebSearchClick"
                    >
                      <Icon icon="lucide:globe" class="w-4 h-4" />
                    </Button>
                    <Select
                      v-model="selectedSearchEngine"
                      @update:model-value="onSearchEngineChange"
                      @update:open="handleSelectOpen"
                    >
                      <SelectTrigger
                        class="h-full rounded-none border-none shadow-none hover:bg-accent text-muted-foreground dark:hover:text-primary-foreground transition-all duration-300"
                        :class="{
                          'w-0 opacity-0 p-0 overflow-hidden':
                            !showSearchSettingsButton && !isSearchHovering && !isSelectOpen,
                          'w-24 max-w-28 px-2 opacity-100':
                            showSearchSettingsButton || isSearchHovering || isSelectOpen
                        }"
                      >
                        <div class="flex items-center gap-1">
                          <SelectValue class="text-xs font-bold truncate" />
                        </div>
                      </SelectTrigger>
                      <SelectContent align="start" class="w-64">
                        <SelectItem
                          v-for="engine in searchEngines"
                          :key="engine.id"
                          :value="engine.id"
                        >
                          {{ engine.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{{ t('chat.features.webSearch') }}</TooltipContent>
              </Tooltip>

              <McpToolsList />
            </template>
            
            <!-- {{ t('chat.input.fileSelect') }} -->
            <slot name="addon-buttons"></slot>
          </div>
          <div class="flex items-center gap-2">
            <div
              v-if="
                contextLength &&
                contextLength > 0 &&
                currentContextLength / (contextLength ?? 1000) > 0.5
              "
              class="text-xs text-muted-foreground"
              :class="[
                currentContextLength / (contextLength ?? 1000) > 0.9 ? ' text-red-600' : '',
                currentContextLength / (contextLength ?? 1000) > 0.8
                  ? ' text-yellow-600'
                  : 'text-muted-foreground'
              ]"
            >
              {{ currentContextLengthText }}
            </div>
            <!-- 麦克风按钮 -->
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline"
                  size="icon"
                  class="w-7 h-7 text-xs rounded-lg"
                  :class="[
                    isRecording ? 'bg-red-500 text-white border-red-500 hover:bg-red-600' : '',
                    isTranscribing ? 'bg-blue-500 text-white border-blue-500' : ''
                  ]"
                  :disabled="disabledSend || isTranscribing"
                  @click="toggleRecording"
                >
                  <Icon 
                    v-if="!isRecording && !isTranscribing"
                    icon="lucide:mic" 
                    class="w-4 h-4" 
                  />
                  <Icon 
                    v-else-if="isRecording"
                    icon="lucide:square" 
                    class="w-4 h-4" 
                  />
                  <Icon 
                    v-else
                    icon="lucide:loader-2" 
                    class="w-4 h-4 animate-spin" 
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ 
                  isRecording 
                    ? t('chat.input.voiceRecording') 
                    : isTranscribing 
                      ? t('chat.input.voiceTranscribing')
                      : t('chat.input.voiceInput') 
                }}
              </TooltipContent>
            </Tooltip>
            <!-- 语音交互按钮 -->
            <Button
              variant="outline"
              size="icon"
              class="w-7 h-7 rounded-lg border-2 hover:border-primary transition-colors"
              @click="showVoiceInterface = true"
            >
              <Icon icon="lucide:audio-waveform" class="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              class="h-7 px-3 text-xs rounded-lg font-medium"
              :disabled="disabledSend"
              @click="emitSend"
            >
              {{ t('chat.input.send') }}
            </Button>
          </div>
        </div>
        <div v-if="isDragging" class="absolute inset-0 bg-black/40 rounded-lg">
          <div class="flex flex-col items-center justify-center h-full gap-2">
            <div class="flex items-center gap-1">
              <Icon icon="lucide:file-up" class="w-4 h-4 text-white" />
              <span class="text-sm text-white">{{ t('chat.input.dropFiles') }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Icon icon="lucide:clipboard" class="w-3 h-3 text-white/80" />
              <span class="text-xs text-white/80">{{ t('chat.input.pasteFiles') }}</span>
            </div>
          </div>
        </div>
      </div>
      </div> <!-- 关闭 v-else div -->
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Icon } from '@iconify/vue'
import FileItem from './FileItem.vue'
import { useChatStore } from '@/stores/chat'
import {
  MessageFile,
  UserMessageCodeBlock,
  UserMessageContent,
  UserMessageMentionBlock,
  UserMessageTextBlock
} from '@shared/chat'
import { usePresenter } from '@/composables/usePresenter'
import { approximateTokenSize } from 'tokenx'
import { useSettingsStore } from '@/stores/settings'
import McpToolsList from './mcpToolsList.vue'
import { useEventListener } from '@vueuse/core'
import { calculateImageTokens, getClipboardImageInfo, imageFileToBase64 } from '@/lib/image'
import { Editor, EditorContent, JSONContent } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Mention } from './editor/mention/mention'
import suggestion, { mentionData, setPromptFilesHandler } from './editor/mention/suggestion'
import { mentionSelected } from './editor/mention/suggestion'
import Placeholder from '@tiptap/extension-placeholder'
import HardBreak from '@tiptap/extension-hard-break'
import CodeBlock from '@tiptap/extension-code-block'
import History from '@tiptap/extension-history'
import { useMcpStore } from '@/stores/mcp'
import { ResourceListEntry } from '@shared/presenter'
import { useToast } from '@/components/ui/toast/use-toast'
const mcpStore = useMcpStore()
const { t } = useI18n()
const { toast } = useToast()
const editor = new Editor({
  editorProps: {
    attributes: {
      class:
        'outline-none focus:outline-none focus-within:outline-none min-h-[3rem] max-h-[7rem] overflow-y-auto'
    }
  },
  autofocus: true,
  extensions: [
    Document,
    Paragraph,
    Text,
    History,
    Mention.configure({
      HTMLAttributes: {
        class:
          'mention px-1.5 py-0.5 text-xs rounded-md bg-secondary text-foreground inline-block max-w-64 align-sub !truncate'
      },
      suggestion
    }),
    Placeholder.configure({
      placeholder: () => {
        const placeholder = t('chat.input.placeholder')
        return `${placeholder}`
      }
    }),
    HardBreak.extend({
      addKeyboardShortcuts() {
        return {
          'Shift-Enter': () => this.editor.commands.setHardBreak(),
          'Alt-Enter': () => this.editor.commands.setHardBreak()
        }
      }
    }).configure({
      keepMarks: true,
      HTMLAttributes: {
        class: 'line-break'
      }
    }),
    CodeBlock.extend({
      addStorage() {
        return {
          lastShiftEnterTime: 0
        }
      },
      addKeyboardShortcuts() {
        return {
          'Shift-Enter': () => {
            if (this.editor.isActive('codeBlock')) {
              const now = Date.now()
              const timeDiff = now - this.storage.lastShiftEnterTime

              // If Shift+Enter was pressed within 800ms, exit the code block
              if (timeDiff < 800) {
                this.editor.commands.exitCode()
                this.storage.lastShiftEnterTime = 0
                return true
              }

              // Otherwise, insert a newline and record the time
              this.editor.commands.insertContent('\n')
              this.storage.lastShiftEnterTime = now
              return true
            }
            return false
          }
        }
      }
    }).configure({
      HTMLAttributes: {
        class: 'rounded-md bg-secondary dark:bg-zinc-800 p-2'
      }
    })
  ],
  onUpdate: ({ editor }) => {
    inputText.value = editor.getText()
  }
})

const configPresenter = usePresenter('configPresenter')
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const inputText = ref('')
const fetchingMcpEntry = ref(false)
const fileInput = ref<HTMLInputElement>()
const filePresenter = usePresenter('filePresenter')
const windowPresenter = usePresenter('windowPresenter')
const settings = ref({
  deepThinking: false,
  webSearch: false
})
const selectedSearchEngine = ref('')
const searchEngines = computed(() => settingsStore.searchEngines)

// 语音录音相关状态
const isRecording = ref(false)
const isTranscribing = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])

const currentContextLength = computed(() => {
  return (
    approximateTokenSize(inputText.value) +
    selectedFiles.value.reduce((acc, file) => {
      return acc + file.token
    }, 0)
  )
})

const isDragging = ref(false)
const dragCounter = ref(0)
let dragLeaveTimer: number | null = null

const selectedFiles = ref<MessageFile[]>([])
const props = withDefaults(
  defineProps<{
    contextLength?: number
    maxRows?: number
    rows?: number
  }>(),
  {
    maxRows: 10,
    rows: 1
  }
)

const currentContextLengthText = computed(() => {
  return `${Math.round((currentContextLength.value / (props.contextLength ?? 1000)) * 100)}%`
})

const emit = defineEmits<{
  'send': [messageContent: UserMessageContent],
  'file-upload': [files: MessageFile[]],
  'toolbar-toggle': [visible: boolean]
}>()

const openFilePicker = () => {
  fileInput.value?.click()
}

const previewFile = (filePath: string) => {
  windowPresenter.previewFile(filePath)
}

const handlePaste = async (e: ClipboardEvent) => {
  const files = e.clipboardData?.files
  if (files && files.length > 0) {
    for (const file of files) {
      try {
        if (file.type.startsWith('image/')) {
          // 处理图片文件
          const base64 = (await imageFileToBase64(file)) as string
          const imageInfo = await getClipboardImageInfo(file)

          const tempFilePath = await filePresenter.writeImageBase64({
            name: file.name ?? 'image',
            content: base64
          })

          const fileInfo: MessageFile = {
            name: file.name ?? 'image',
            content: base64,
            mimeType: file.type,
            metadata: {
              fileName: file.name ?? 'image',
              fileSize: file.size,
              // fileHash: string
              fileDescription: file.type,
              fileCreated: new Date(),
              fileModified: new Date()
            },
            token: calculateImageTokens(imageInfo.width, imageInfo.height),
            path: tempFilePath
          }
          if (fileInfo) {
            selectedFiles.value.push(fileInfo)
          }
        } else {
          // 处理其他类型的文件
          const path = window.api.getPathForFile(file)
          const mimeType = await filePresenter.getMimeType(path)
          const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
          if (fileInfo) {
            selectedFiles.value.push(fileInfo)
          } else {
            console.error('File info is null:', file.name)
          }
        }
      } catch (error) {
        console.error('文件处理失败:', error)
        // 继续处理其他文件，不要中断整个流程
      }
    }
    if (selectedFiles.value.length > 0) {
      emit('file-upload', selectedFiles.value)
    }
  }
}

const handleFileSelect = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files

  if (files && files.length > 0) {
    for (const file of files) {
      const path = window.api.getPathForFile(file)
      try {
        const mimeType = await filePresenter.getMimeType(path)
        const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
        if (fileInfo) {
          selectedFiles.value.push(fileInfo)
        } else {
          console.error('File info is null:', file.name)
        }
      } catch (error) {
        console.error('文件准备失败:', error)
        // Don't return here, continue processing other files
      }
    }
    if (selectedFiles.value.length > 0) {
      emit('file-upload', selectedFiles.value)
    }
  }
  // Reset the input
  if (e.target) {
    ;(e.target as HTMLInputElement).value = ''
  }
}

const tiptapJSONtoMessageBlock = async (docJSON: JSONContent) => {
  const blocks: (UserMessageMentionBlock | UserMessageTextBlock | UserMessageCodeBlock)[] = []
  if (docJSON.type === 'doc') {
    for (const [idx, block] of (docJSON.content ?? []).entries()) {
      if (block.type === 'paragraph') {
        // console.log(block)
        for (const [index, subBlock] of (block.content ?? []).entries()) {
          if (subBlock.type === 'text') {
            blocks.push({
              type: 'text',
              content: subBlock.text ?? ''
            })
          } else if (subBlock.type === 'hardBreak') {
            if (index > 0 && block.content?.[index - 1]?.type === 'text') {
              blocks[blocks.length - 1].content += '\n'
            } else {
              blocks.push({
                type: 'text',
                content: '\n'
              })
            }
          } else if (subBlock.type === 'mention') {
            let content = subBlock.attrs?.label ?? ''
            try {
              if (subBlock.attrs?.category === 'resources' && subBlock.attrs?.content) {
                fetchingMcpEntry.value = true
                // console.log(subBlock.attrs?.content)
                const mcpEntry = JSON.parse(subBlock.attrs?.content) as ResourceListEntry

                const mcpEntryResult = await mcpStore.readResource(mcpEntry)

                if (mcpEntryResult.blob) {
                  // Convert blob to ArrayBuffer
                  const arrayBuffer = await new Blob([mcpEntryResult.blob], {
                    type: mcpEntryResult.mimeType
                  }).arrayBuffer()
                  // Write the blob content to a temporary file
                  const tempFilePath = await filePresenter.writeTemp({
                    name: mcpEntry.name ?? 'temp_resource', // Use resource name or a default
                    content: arrayBuffer
                  })
                  const mimeType = await filePresenter.getMimeType(tempFilePath)
                  const fileInfo: MessageFile = await filePresenter.prepareFile(
                    tempFilePath,
                    mimeType
                  )
                  if (fileInfo) {
                    selectedFiles.value.push(fileInfo)
                  }
                  console.log('MCP resource saved to temp file:', tempFilePath)
                  content = mcpEntry.name ?? 'temp_resource' // Placeholder content for the mention
                } else {
                  content = mcpEntryResult.text ?? ''
                }

                // console.log('fix ', mcpEntryResult)
              }
            } catch (error) {
              console.error('读取资源失败:', error)
            } finally {
              fetchingMcpEntry.value = false
            }

            if (subBlock.attrs?.category === 'prompts') {
              fetchingMcpEntry.value = true // Mimicking resource style
              try {
                const promptAttrContent = subBlock.attrs?.content as string
                if (promptAttrContent) {
                  // Assuming promptAttrContent is JSON.stringify(originalPromptObjectFromStore)
                  // And originalPromptObjectFromStore has a field 'content' with base64 data.
                  const promptObject = JSON.parse(promptAttrContent)
                  const prompResult = await mcpStore.getPrompt(
                    promptObject,
                    promptObject.argumentsValue
                  )
                  content = JSON.stringify(prompResult)
                } else {
                  console.warn('Prompt mention is missing "content" attribute.')
                  content = subBlock.attrs?.label || subBlock.attrs?.id || 'prompt'
                }
              } catch (error) {
                console.error('Error processing prompt mention:', error)
                content = subBlock.attrs?.label || subBlock.attrs?.id || 'prompt'
              } finally {
                fetchingMcpEntry.value = false
              }
            }

            const newBlock: UserMessageMentionBlock = {
              type: 'mention',
              id: subBlock.attrs?.id ?? '',
              content: content,
              category: subBlock.attrs?.category ?? ''
            }
            blocks.push(newBlock)
          }
        }
        if (idx < (docJSON.content?.length ?? 0) - 1 && idx > 0) {
          blocks.push({ type: 'text', content: '\n' })
        }
      } else if (block.type === 'codeBlock') {
        console.log('push code block', block)
        blocks.push({
          type: 'code',
          content: block.content?.[0]?.text ?? '',
          language: block.content?.[0]?.attrs?.language ?? 'text'
        })
      }
    }
  }
  return blocks
}

const emitSend = async () => {
  if (inputText.value.trim()) {
    const blocks = await tiptapJSONtoMessageBlock(editor.getJSON())

    const messageContent: UserMessageContent = {
      text: inputText.value.trim(),
      files: selectedFiles.value,
      links: [],
      search: settings.value.webSearch,
      think: settings.value.deepThinking,
      content: blocks
    }
    console.log(JSON.stringify(blocks), JSON.stringify(messageContent.content))

    emit('send', messageContent)
    inputText.value = ''
    editor.chain().clearContent().blur().run()

    // 清理已上传的文件
    if (selectedFiles.value.length > 0) {
      // 清空文件列表
      selectedFiles.value = []
      // 重置文件输入控件
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }
  }
}

// 语音录音相关函数
const toggleRecording = async () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    await startRecording()
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      await processRecording()
      // 停止所有音频轨道
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.value.start()
    isRecording.value = true
  } catch (error) {
    console.error('开始录音失败:', error)
    toast({
      title: t('chat.input.voiceError'),
      description: t('chat.input.voiceRecordingError'),
      variant: 'destructive'
    })
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
  }
}

const processRecording = async () => {
  if (audioChunks.value.length === 0) return

  isTranscribing.value = true
  try {
    // 创建音频文件
    const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' })
    
    // 调用语音转文字
    const transcription = await transcribeAudio(audioBlob)
    
    if (transcription.trim()) {
      // 将转录结果添加到输入框
      const currentText = inputText.value
      const newText = currentText ? `${currentText} ${transcription}` : transcription
      inputText.value = newText
      editor.commands.setContent(newText)
      editor.commands.focus('end')
      
      toast({
        title: t('chat.input.voiceSuccess'),
        description: t('chat.input.voiceTranscriptionComplete'),
        variant: 'default'
      })
    } else {
      toast({
        title: t('chat.input.voiceWarning'),
        description: t('chat.input.voiceNoSpeechDetected'),
        variant: 'default'
      })
    }
  } catch (error) {
    console.error('语音转文字失败:', error)
    toast({
      title: t('chat.input.voiceError'),
      description: t('chat.input.voiceTranscriptionError'),
      variant: 'destructive'
    })
  } finally {
    isTranscribing.value = false
    audioChunks.value = []
  }
}

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

const deleteFile = (idx: number) => {
  selectedFiles.value.splice(idx, 1)
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 处理来自 Prompt 的文件
const handlePromptFiles = async (files: Array<{
  id: string
  name: string
  type: string
  size: number
  path: string
  description?: string
  content?: string
  createdAt: number
}>) => {
  if (!files || files.length === 0) return

  let addedCount = 0
  let errorCount = 0

  for (const fileItem of files) {
    try {
      // 检查文件是否已存在（基于文件名去重）
      const exists = selectedFiles.value.some(f => f.name === fileItem.name)
      if (exists) {
        continue
      }

      // 转换 FileItem -> MessageFile
      const messageFile: MessageFile = {
        name: fileItem.name,
        content: fileItem.content || '', // 如果没有内容，尝试从路径读取
        mimeType: fileItem.type || 'application/octet-stream',
        metadata: {
          fileName: fileItem.name,
          fileSize: fileItem.size || 0,
          fileDescription: fileItem.description || '',
          fileCreated: new Date(fileItem.createdAt || Date.now()),
          fileModified: new Date(fileItem.createdAt || Date.now())
        },
        token: approximateTokenSize(fileItem.content || ''),
        path: fileItem.path || fileItem.name
      }

      // 如果没有内容但有路径，尝试读取文件
      if (!messageFile.content && fileItem.path) {
        try {
          const fileContent = await filePresenter.readFile(fileItem.path)
          messageFile.content = fileContent
          messageFile.token = approximateTokenSize(fileContent)
        } catch (error) {
          console.warn(`Failed to read file content: ${fileItem.path}`, error)
          // 如果读取失败，仍然添加文件但内容为空
        }
      }

      selectedFiles.value.push(messageFile)
      addedCount++
    } catch (error) {
      console.error('Failed to process prompt file:', fileItem, error)
      errorCount++
    }
  }

  // 显示结果反馈
  if (addedCount > 0) {
    toast({
      title: t('chat.input.promptFilesAdded'),
      description: t('chat.input.promptFilesAddedDesc', { count: addedCount }),
      variant: 'default'
    })
    emit('file-upload', selectedFiles.value)
  }

  if (errorCount > 0) {
    toast({
      title: t('chat.input.promptFilesError'),
      description: t('chat.input.promptFilesErrorDesc', { count: errorCount }),
      variant: 'destructive'
    })
  }
}

const disabledSend = computed(() => {
  const activeThreadId = chatStore.getActiveThreadId()
  if (activeThreadId) {
    return (
      chatStore.generatingThreadIds.has(activeThreadId) ||
      inputText.value.length <= 0 ||
      currentContextLength.value > (props.contextLength ?? chatStore.chatConfig.contextLength)
    )
  }
  return false
})

const handleEditorEnter = (e: KeyboardEvent) => {
  // If a mention was just selected, don't do anything
  if (mentionSelected.value) {
    return
  }

  // Only handle enter if there's no active suggestion popup
  if (editor.isActive('mention') || document.querySelector('.tippy-box')) {
    // Don't prevent default - let the mention suggestion handle it
    return
  }

  // For normal enter behavior (no mention suggestion active)
  e.preventDefault()

  if (disabledSend.value) {
    return
  }

  if (!e.isComposing) {
    emitSend()
  }
}

const onWebSearchClick = async () => {
  settings.value.webSearch = !settings.value.webSearch
  await configPresenter.setSetting('input_webSearch', settings.value.webSearch)
}

// const onDeepThinkingClick = async () => {
//   settings.value.deepThinking = !settings.value.deepThinking
//   await configPresenter.setSetting('input_deepThinking', settings.value.deepThinking)
// }

const onSearchEngineChange = async (engineName: string) => {
  await settingsStore.setSearchEngine(engineName)
}

const initSettings = async () => {
  settings.value.deepThinking = Boolean(await configPresenter.getSetting('input_deepThinking'))
  settings.value.webSearch = Boolean(await configPresenter.getSetting('input_webSearch'))
  selectedSearchEngine.value = settingsStore.activeSearchEngine?.id ?? 'google'
}

const handleDragEnter = (e: DragEvent) => {
  dragCounter.value++
  isDragging.value = true

  // 确保目标是文件
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true
  }
}

const handleDragOver = () => {
  // 防止默认行为并保持拖拽状态
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
    dragLeaveTimer = null
  }
}

const handleDragLeave = () => {
  dragCounter.value--

  // 只有当计数器归零时才隐藏拖拽状态，并添加小延迟防止闪烁
  if (dragCounter.value <= 0) {
    if (dragLeaveTimer) clearTimeout(dragLeaveTimer)

    dragLeaveTimer = window.setTimeout(() => {
      if (dragCounter.value <= 0) {
        isDragging.value = false
        dragCounter.value = 0
      }
      dragLeaveTimer = null
    }, 50)
  }
}

const handleDrop = async (e: DragEvent) => {
  isDragging.value = false
  dragCounter.value = 0

  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    for (const file of e.dataTransfer.files) {
      try {
        const path = window.api.getPathForFile(file)
        if (file.type === '') {
          const isDirectory = await filePresenter.isDirectory(path)
          if (isDirectory) {
            const fileInfo: MessageFile = await filePresenter.prepareDirectory(path)
            if (fileInfo) {
              selectedFiles.value.push(fileInfo)
            }
          } else {
            const mimeType = await filePresenter.getMimeType(path)
            console.log('mimeType', mimeType)
            const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
            console.log('fileInfo', fileInfo)
            if (fileInfo) {
              selectedFiles.value.push(fileInfo)
            }
          }
        } else {
          const mimeType = await filePresenter.getMimeType(path)
          const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
          if (fileInfo) {
            selectedFiles.value.push(fileInfo)
          }
        }
      } catch (error) {
        console.error('文件准备失败:', error)
        return
      }
    }
    emit('file-upload', selectedFiles.value)
  }
}

// Search engine selector variables
const showSearchSettingsButton = ref(false)
const isSearchHovering = ref(false)
const isSelectOpen = ref(false)

// Handle select open state
const handleSelectOpen = (isOpen: boolean) => {
  isSelectOpen.value = isOpen
}

// Mouse hover handlers for search engine selector
const handleSearchMouseEnter = () => {
  isSearchHovering.value = true
}

const handleSearchMouseLeave = () => {
  isSearchHovering.value = false
}

// 添加工具栏显示/隐藏状态
const showToolbar = ref(false)

// 语音交互状态
const showVoiceInterface = ref(false)
const waveformHeights = ref<number[]>(Array.from({ length: 30 }, () => 4))
const microphoneEnabled = ref(false)

// 音频相关状态
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let microphone: MediaStreamAudioSourceNode | null = null
let dataArray: Uint8Array | null = null
let animationFrameId: number | null = null

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
    microphoneEnabled.value = true
    
    startWaveformAnimation()
  } catch (error) {
    console.error('Error accessing microphone:', error)
    microphoneEnabled.value = false
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
    waveformHeights.value = waveformHeights.value.map((_, i) => {
      // 基础静态高度
      const baseHeight = 4
      
      // 计算当前条对应的频率索引
      const frequencyIndex = speechStartIndex + Math.floor((i / waveformHeights.value.length) * speechData.length)
      const frequencyValue = dataArray![frequencyIndex] || 0
      
      // 增强灵敏度的计算
      const localIntensity = (frequencyValue / 255) * (frequencyValue / 255) // 平方增强对比度
      const energyBoost = normalizedEnergy * 3 // 增强整体能量影响
      
      // 添加一些随机变化模拟真实语音的复杂性
      const randomVariation = (Math.random() - 0.5) * 0.3 * normalizedEnergy
      
      // 计算最终高度
      const dynamicHeight = baseHeight + 
                           localIntensity * 60 + 
                           energyBoost * 40 + 
                           randomVariation * 20
      
      // 限制高度范围并添加平滑过渡
      const targetHeight = Math.max(baseHeight, Math.min(dynamicHeight, 100))
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
    waveformHeights.value = waveformHeights.value.map((_, i) => {
      // 创建更自然的波形模拟
      const wave1 = Math.sin(time * 2 + i * 0.4) * 12
      const wave2 = Math.sin(time * 3.2 + i * 0.6) * 8
      const wave3 = Math.sin(time * 1.8 + i * 0.2) * 6
      const randomNoise = (Math.random() - 0.5) * 4
      
      const height = 4 + wave1 + wave2 + wave3 + randomNoise
      return Math.max(4, Math.min(height, 35))
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
  microphoneEnabled.value = false
  
  // 重置波形高度
  waveformHeights.value = Array.from({ length: 30 }, () => 4)
}

// 监听语音界面状态变化
watch(showVoiceInterface, (newVal) => {
  if (newVal) {
    initAudioAnalysis()
  } else {
    stopAudioAnalysis()
  }
})

// 组件销毁时清理音频资源
onUnmounted(() => {
  stopAudioAnalysis()
})

// 监听showToolbar变化并发射事件
watch(showToolbar, (newValue) => {
  emit('toolbar-toggle', newValue)
})

// 建议按钮数据
const suggestions = ref([
  { key: 'chat.suggestions.vpn_us_node' },
  { key: 'chat.suggestions.nba_today' },
  { key: 'chat.suggestions.mr_beast' },
  { key: 'chat.suggestions.new_chan_drama' },
  { key: 'chat.suggestions.uk_node_fastest' }
])

// 插入建议文本到编辑器
const insertSuggestion = (suggestionKey: string) => {
  const text = t(suggestionKey)
  editor.commands.setContent(text)
  editor.commands.focus('end')
  // 立即更新inputText.value，确保Send按钮能立即响应
  inputText.value = text
}

onMounted(() => {
  initSettings()

  // 设置 prompt 文件处理回调
  setPromptFilesHandler(handlePromptFiles)

  // Add event listeners for search engine selector hover with auto remove
  const searchElement = document.querySelector('.search-engine-select')
  if (searchElement) {
    useEventListener(searchElement, 'mouseenter', handleSearchMouseEnter)
    useEventListener(searchElement, 'mouseleave', handleSearchMouseLeave)
  }

  // 监听 Ask AI 事件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.addEventListener('context-menu-ask-ai', (e: any) => {
    inputText.value = e.detail
    editor.commands.setContent(e.detail)
    editor.commands.focus()
  })
})

watch(
  () => settingsStore.activeSearchEngine?.id,
  async () => {
    selectedSearchEngine.value = settingsStore.activeSearchEngine?.id ?? 'google'
  }
)

watch(
  () => selectedFiles.value,
  () => {
    mentionData.value = mentionData.value
      .filter((item) => item.type != 'item' || item.category != 'files')
      .concat(
        selectedFiles.value.map((file) => ({
          id: file.metadata.fileName,
          label: file.metadata.fileName,
          icon: file.mimeType?.startsWith('image/') ? 'lucide:image' : 'lucide:file',
          type: 'item',
          category: 'files'
        }))
      )
  },
  { deep: true }
)

watch(
  () => mcpStore.resources,
  () => {
    mentionData.value = mentionData.value
      .filter((item) => item.type != 'item' || item.category != 'resources')
      .concat(
        mcpStore.resources.map((resource) => ({
          id: `${resource.client.name}.${resource.name ?? ''}`,
          label: resource.name ?? '',
          icon: 'lucide:tag',
          type: 'item',
          category: 'resources',
          mcpEntry: resource
        }))
      )
  }
)

watch(
  () => mcpStore.tools,
  () => {
    mentionData.value = mentionData.value
      .filter((item) => item.type != 'item' || item.category != 'tools')
      .concat(
        mcpStore.tools.map((tool) => ({
          id: `${tool.server.name}.${tool.function.name ?? ''}`,
          label: `${tool.server.icons}${' '}${tool.function.name ?? ''}`,
          icon: undefined,
          type: 'item',
          category: 'tools',
          description: tool.function.description ?? ''
        }))
      )
  }
)

watch(
  () => mcpStore.prompts,
  () => {
    mentionData.value = mentionData.value
      .filter((item) => item.type != 'item' || item.category != 'prompts')
      .concat(
        mcpStore.prompts.map((prompt) => ({
          id: prompt.name,
          label: prompt.name,
          icon: undefined,
          type: 'item',
          category: 'prompts',
          mcpEntry: prompt
        }))
      )
  }
)

defineExpose({
  setText: (text: string) => {
    inputText.value = text
  }
})
</script>

<style scoped>
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-300 {
  transition-duration: 300ms;
}
</style>
<style>
.tiptap p.is-editor-empty:first-child::before {
  @apply text-muted-foreground;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
