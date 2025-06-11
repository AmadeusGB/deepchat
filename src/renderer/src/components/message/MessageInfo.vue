<template>
  <div class="flex flex-row items-center gap-2 min-h-5">
    <!-- 特殊处理：如果名称以 "Deeper Ai" 开头，显示自定义图标 -->
    <template v-if="name.startsWith('Deeper Ai')">
      <img src="@/assets/deeper.png" alt="Deeper AI" class="w-4 h-4" />
      <span class="text-xs font-bold text-muted-foreground">{{ name }}</span>
    </template>
    <!-- 默认显示 -->
    <template v-else>
      <span class="text-xs font-bold text-muted-foreground">{{ name }}</span>
    </template>
    <span
      class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >{{ formattedTime }}</span
    >
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
