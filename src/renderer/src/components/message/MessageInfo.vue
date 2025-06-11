<template>
  <div class="flex flex-row items-center gap-2 min-h-5">
    <!-- 特殊处理：如果名称以 "Deeper Ai" 开头，使用Figma设计样式 -->
    <template v-if="name.startsWith('Deeper Ai')">
      <div class="figma-ai-message-header">
        <div class="figma-ai-header-content">
          <img src="@/assets/deeper.png" alt="Deeper AI" class="figma-ai-icon" />
          <span class="figma-ai-text">{{ name }}</span>
        </div>
      </div>
      <span class="figma-ai-timestamp">{{ formattedTime }}</span>
    </template>
    <!-- 默认显示 -->
    <template v-else>
      <span class="text-xs font-bold text-muted-foreground">{{ name }}</span>
      <span
        class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >{{ formattedTime }}</span
      >
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  timestamp: number
}>()

const formattedTime = computed(() => {
  if (!props.timestamp) {
    return ''
  }
  const date = new Date(props.timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>
