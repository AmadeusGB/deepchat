import { defineAsyncComponent, Component } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

/**
 * 创建懒加载组件的工厂函数
 * @param loader 组件加载函数
 * @param options 配置选项
 */
export function useLazyComponent(
  loader: () => Promise<Component>,
  options: {
    loadingComponent?: Component
    errorComponent?: Component
    delay?: number
    timeout?: number
  } = {}
) {
  const { t } = useI18n()
  
  const defaultLoadingComponent = {
    template: `
      <div class="flex items-center justify-center p-8">
        <Icon icon="lucide:loader-2" class="w-6 h-6 animate-spin mr-2" />
        <span class="text-muted-foreground">{{ t('common.loading') }}...</span>
      </div>
    `,
    components: { Icon },
    setup() {
      return { t }
    }
  }

  const defaultErrorComponent = {
    template: `
      <div class="flex items-center justify-center p-8 text-destructive">
        <Icon icon="lucide:alert-circle" class="w-6 h-6 mr-2" />
        <span>{{ t('common.loadError') }}</span>
      </div>
    `,
    components: { Icon },
    setup() {
      return { t }
    }
  }

  return defineAsyncComponent({
    loader,
    loadingComponent: options.loadingComponent || defaultLoadingComponent,
    errorComponent: options.errorComponent || defaultErrorComponent,
    delay: options.delay || 200,
    timeout: options.timeout || 10000
  })
}

/**
 * 创建条件懒加载组件
 * 只有在满足条件时才加载组件
 */
export function useConditionalLazyComponent(
  condition: () => boolean,
  loader: () => Promise<Component>,
  fallback?: Component
) {
  return defineAsyncComponent({
    loader: async () => {
      if (condition()) {
        return await loader()
      }
      return fallback || { template: '<div></div>' }
    }
  })
}

/**
 * 预定义的大型组件懒加载
 */
export const LazyComponents = {
  // 设置相关组件
  McpSettings: () => useLazyComponent(() => import('@/components/settings/McpSettings.vue')),
  ModelProviderSettings: () => useLazyComponent(() => import('@/components/settings/ModelProviderSettings.vue')),
  KnowledgeBaseSettings: () => useLazyComponent(() => import('@/components/settings/KnowledgeBaseSettings.vue')),
  VoiceSettings: () => useLazyComponent(() => import('@/components/settings/VoiceSettings.vue')),
  
  // 其他大型组件
  ThreadsView: () => useLazyComponent(() => import('@/components/ThreadsView.vue')),
  ChatView: () => useLazyComponent(() => import('@/components/ChatView.vue'))
} 