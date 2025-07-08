<template>
  <div class="my-1">
    <!-- 使用Figma设计样式的工具调用块 -->
    <div class="figma-tool-call-block" @click="toggleExpanded">
      <div class="figma-tool-call-content">
        <div class="figma-tool-call-left">
          <!-- 特殊处理：如果是 playwright 相关工具，显示工具图标 -->
          <template
            v-if="
              block.tool_call?.server_name?.toLowerCase().includes('playwright') ||
              block.tool_call?.name?.toLowerCase().includes('playwright')
            "
          >
            <img src="@/assets/figma-icons/tool.png" alt="Tool" class="figma-tool-icon" />
          </template>
          <!-- 默认逻辑：显示服务器图标或默认图标 -->
          <template v-else>
            <span v-if="block.tool_call?.server_icons" class="figma-tool-emoji">{{
              block.tool_call?.server_icons
            }}</span>
            <Icon v-else icon="lucide:hammer" class="figma-tool-icon" />
          </template>
          <span class="figma-tool-name">
            {{ block.tool_call?.server_name ? `${block.tool_call?.server_name} - ` : ''
            }}{{ block.tool_call?.name ?? '' }}
          </span>
        </div>
        <div class="figma-tool-call-right">
          <div class="figma-status-capsule">
            <span class="figma-status-text">{{ getToolCallStatus() }}</span>
            <Icon
              v-if="block.status === 'loading'"
              icon="lucide:loader-2"
              class="figma-status-icon animate-spin"
            />
            <Icon
              v-else-if="block.status === 'success'"
              icon="lucide:check"
              class="figma-status-icon-success"
            />
            <Icon
              v-else-if="block.status === 'error'"
              icon="lucide:x"
              class="figma-status-icon-error"
            />
            <Icon
              v-else-if="showPermissionIcon()"
              icon="lucide:hand"
              class="figma-status-icon-warning"
            />
            <Icon
              v-else
              :icon="isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
              class="figma-status-icon"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 详细内容区域 -->
    <transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-4 scale-95"
    >
      <div
        v-if="isExpanded"
        class="rounded-lg border bg-card text-card-foreground px-2 py-3 mt-2 mb-4"
      >
        <div class="space-y-4">
          <!-- 参数 -->
          <div v-if="block.tool_call?.params" class="space-y-2">
            <h5 class="text-xs font-medium text-accent-foreground flex flex-row gap-2 items-center">
              <Icon icon="lucide:arrow-up-from-dot" class="w-4 h-4 text-muted-foreground" />
              {{ t('toolCall.params') }}
            </h5>
            <div class="text-sm rounded-md p-2">
              <JsonObject :data="parseJson(block.tool_call.params)" />
            </div>
          </div>

          <hr />

          <!-- 响应 -->
          <div v-if="block.tool_call?.response" class="space-y-2">
            <h5 class="text-xs font-medium text-accent-foreground flex flex-row gap-2 items-center">
              <Icon icon="lucide:arrow-down-to-dot" class="w-4 h-4 text-muted-foreground" />
              {{ t('toolCall.responseData') }}
            </h5>
            <div class="text-sm rounded-md p-3">
              <JsonObject :data="parseJson(block.tool_call.response)" />
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { AssistantMessageBlock } from '@shared/chat'
import { ref } from 'vue'
import { JsonObject } from '@/components/json-viewer'

// 创建一个安全的翻译函数
const t = (() => {
  try {
    const { t } = useI18n()
    return t
  } catch {
    // 如果 i18n 未初始化，提供默认翻译
    return (key: string) => {
      if (key === 'toolCall.calling') return '工具调用中'
      if (key === 'toolCall.response') return '工具响应'
      if (key === 'toolCall.end') return '工具调用完成'
      if (key === 'toolCall.error') return '工具调用错误'
      if (key === 'toolCall.title') return '工具调用'
      if (key === 'toolCall.clickToView') return '点击查看详情'
      if (key === 'toolCall.functionName') return '函数名称'
      if (key === 'toolCall.params') return '参数'
      if (key === 'toolCall.responseData') return '响应数据'
      return key
    }
  }
})()

const props = defineProps<{
  block: AssistantMessageBlock
  messageId?: string
  threadId?: string
}>()

const isExpanded = ref(false)

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const getToolCallStatus = () => {
  if (!props.block.tool_call) return ''

  if (props.block.status === 'error') {
    return t('toolCall.error')
  }

  if (props.block.status === 'loading') {
    return props.block.tool_call.response ? t('toolCall.response') : t('toolCall.calling')
  }

  if (props.block.status === 'success') {
    return t('toolCall.end')
  }

  return t('toolCall.title')
}

// 辅助函数，用于判断是否显示权限图标
const showPermissionIcon = () => {
  // 这里保留原有逻辑，暂时默认不显示
  return false
}

// 解析JSON为对象
const parseJson = (jsonStr: string) => {
  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed) {
      if (typeof parsed === 'object' || Array.isArray(parsed)) {
        return parsed
      } else {
        return { raw: parsed }
      }
    }
    return parsed
  } catch {
    return { raw: jsonStr }
  }
}

// const simpleIn = computed(() => {
//   if (!props.block.tool_call) return false
//   if (props.block.tool_call.params) {
//     const params = parseJson(props.block.tool_call.params)
//     const strArr: string[] = []
//     for (const key in params) {
//       strArr.push(`${params[key]}`)
//     }
//     return strArr.join(', ')
//   }
//   return ''
// })
</script>

<style scoped>
pre {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.85em;
}
</style>
