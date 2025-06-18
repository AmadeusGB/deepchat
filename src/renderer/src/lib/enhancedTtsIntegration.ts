/**
 * 增强TTS服务集成适配器
 * 提供简化的API接口，方便在chatStore和组件中使用
 */

import { ref, computed } from 'vue'
import { createEnhancedTTS, type EnhancedTTSService, type TTSOptions, type TTSCallbacks, type TTSStatus } from './enhancedTtsService'

// 全局TTS状态管理
export interface TTSState {
  isEnabled: boolean
  isPlaying: boolean
  isPaused: boolean
  currentText: string
  queueLength: number
  volume: number
  status: TTSStatus
  strategy: 'realtime' | 'balanced' | 'precise'
}

class EnhancedTTSIntegration {
  private ttsService: EnhancedTTSService | null = null
  private isInitialized = false
  
  // 响应式状态
  public state = ref<TTSState>({
    isEnabled: false,
    isPlaying: false,
    isPaused: false,
    currentText: '',
    queueLength: 0,
    volume: 1.0,
    status: 'idle',
    strategy: 'balanced'
  })

  // 计算属性
  public readonly isActive = computed(() => this.state.value.isEnabled && this.ttsService !== null)
  public readonly canControl = computed(() => this.isActive.value && this.state.value.queueLength > 0)

  /**
   * 初始化TTS服务
   */
  async initialize(apiKey: string, options: Partial<TTSOptions> = {}): Promise<void> {
    if (this.isInitialized) {
      console.log('[TTS集成] 服务已初始化')
      return
    }

    try {
      const ttsOptions: TTSOptions = {
        apiKey,
        voice: 'alloy',
        speed: 1.1,
        volume: 1.0,
        model: 'tts-1',
        ...options
      }

      const callbacks: TTSCallbacks = {
        onStart: () => {
          console.log('[TTS集成] 开始播放')
          this.updateState({ isPlaying: true, isPaused: false })
        },
        onTextChunk: (text: string, chunkId: string) => {
          console.log(`[TTS集成] 处理文本块: "${text.substring(0, 20)}..." (${chunkId})`)
        },
        onAudioReady: (chunkId: string, duration: number) => {
          console.log(`[TTS集成] 音频就绪: ${chunkId}, 时长: ${duration.toFixed(2)}s`)
          this.updateQueueStatus()
        },
        onPlayStart: (chunkId: string, text: string) => {
          console.log(`[TTS集成] 播放开始: "${text.substring(0, 30)}..."`)
          this.updateState({ currentText: text })
        },
        onPlayEnd: (chunkId: string) => {
          console.log(`[TTS集成] 播放结束: ${chunkId}`)
          this.updateQueueStatus()
        },
        onError: (error: Error, chunkId?: string) => {
          console.error('[TTS集成] 错误:', error, chunkId)
          this.updateState({ status: 'error' })
        },
        onComplete: () => {
          console.log('[TTS集成] 播放完成')
          this.updateState({ 
            isPlaying: false, 
            isPaused: false, 
            currentText: '',
            queueLength: 0,
            status: 'idle'
          })
        },
        onStatusChange: (status: TTSStatus) => {
          console.log(`[TTS集成] 状态变更: ${status}`)
          this.updateState({ status })
        }
      }

      this.ttsService = createEnhancedTTS(ttsOptions, callbacks)
      this.isInitialized = true
      this.state.value.isEnabled = true
      
      console.log('[TTS集成] 初始化完成')
    } catch (error) {
      console.error('[TTS集成] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 处理流式文本输入
   */
  processStreamText(text: string): void {
    if (!this.isActive.value || !text) return

    try {
      this.ttsService!.addText(text)
      console.log(`[TTS集成] 添加流式文本: "${text.substring(0, 30)}..."`)
    } catch (error) {
      console.error('[TTS集成] 处理流式文本失败:', error)
    }
  }

  /**
   * 完成文本输入
   */
  finishTextInput(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.finish()
      console.log('[TTS集成] 完成文本输入')
    } catch (error) {
      console.error('[TTS集成] 完成文本输入失败:', error)
    }
  }

  /**
   * 处理完整文本（非流式）
   */
  processCompleteText(text: string): void {
    if (!this.isActive.value || !text) return

    try {
      this.ttsService!.addText(text)
      this.ttsService!.finish()
      console.log(`[TTS集成] 处理完整文本: "${text.substring(0, 30)}..."`)
    } catch (error) {
      console.error('[TTS集成] 处理完整文本失败:', error)
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.pause()
      console.log('[TTS集成] 暂停播放')
    } catch (error) {
      console.error('[TTS集成] 暂停失败:', error)
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.resume()
      console.log('[TTS集成] 恢复播放')
    } catch (error) {
      console.error('[TTS集成] 恢复失败:', error)
    }
  }

  /**
   * 停止播放
   */
  stop(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.stop()
      console.log('[TTS集成] 停止播放')
    } catch (error) {
      console.error('[TTS集成] 停止失败:', error)
    }
  }

  /**
   * 跳过当前播放
   */
  skip(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.skip()
      console.log('[TTS集成] 跳过当前')
    } catch (error) {
      console.error('[TTS集成] 跳过失败:', error)
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    
    if (this.isActive.value) {
      try {
        this.ttsService!.setVolume(clampedVolume)
      } catch (error) {
        console.error('[TTS集成] 设置音量失败:', error)
      }
    }
    
    this.updateState({ volume: clampedVolume })
    console.log(`[TTS集成] 音量设置为: ${(clampedVolume * 100).toFixed(0)}%`)
  }

  /**
   * 切换播放策略
   */
  setStrategy(strategy: 'realtime' | 'balanced' | 'precise'): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.updateConfig({ chunkingStrategy: strategy })
      this.updateState({ strategy })
      console.log(`[TTS集成] 策略切换为: ${strategy}`)
    } catch (error) {
      console.error('[TTS集成] 切换策略失败:', error)
    }
  }

  /**
   * 启用/禁用TTS
   */
  setEnabled(enabled: boolean): void {
    if (enabled === this.state.value.isEnabled) return

    if (enabled && !this.isInitialized) {
      console.warn('[TTS集成] 请先初始化TTS服务')
      return
    }

    if (!enabled && this.isActive.value) {
      this.stop()
    }

    this.updateState({ isEnabled: enabled })
    console.log(`[TTS集成] TTS ${enabled ? '启用' : '禁用'}`)
  }

  /**
   * 获取详细状态
   */
  getDetailedStatus() {
    if (!this.isActive.value) {
      return {
        ...this.state.value,
        serviceStatus: null
      }
    }

    try {
      const serviceStatus = this.ttsService!.getStatus()
      return {
        ...this.state.value,
        serviceStatus
      }
    } catch (error) {
      console.error('[TTS集成] 获取状态失败:', error)
      return {
        ...this.state.value,
        serviceStatus: null
      }
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.isActive.value) {
      this.stop()
    }

    this.ttsService = null
    this.isInitialized = false
    this.state.value = {
      isEnabled: false,
      isPlaying: false,
      isPaused: false,
      currentText: '',
      queueLength: 0,
      volume: 1.0,
      status: 'idle',
      strategy: 'balanced'
    }

    console.log('[TTS集成] 服务已销毁')
  }

  /**
   * 更新状态
   */
  private updateState(updates: Partial<TTSState>): void {
    Object.assign(this.state.value, updates)
  }

  /**
   * 更新队列状态
   */
  private updateQueueStatus(): void {
    if (!this.isActive.value) return

    try {
      const status = this.ttsService!.getStatus()
      this.updateState({
        queueLength: status.audioQueue.queueLength,
        isPlaying: status.audioQueue.isPlaying,
        isPaused: status.audioQueue.isPaused
      })
    } catch (error) {
      console.error('[TTS集成] 更新队列状态失败:', error)
    }
  }
}

// 创建全局实例
export const enhancedTTSIntegration = new EnhancedTTSIntegration()

// 导出便捷函数
export const useTTS = () => {
  return {
    // 状态
    state: enhancedTTSIntegration.state,
    isActive: enhancedTTSIntegration.isActive,
    canControl: enhancedTTSIntegration.canControl,
    
    // 方法
    initialize: enhancedTTSIntegration.initialize.bind(enhancedTTSIntegration),
    processStreamText: enhancedTTSIntegration.processStreamText.bind(enhancedTTSIntegration),
    finishTextInput: enhancedTTSIntegration.finishTextInput.bind(enhancedTTSIntegration),
    processCompleteText: enhancedTTSIntegration.processCompleteText.bind(enhancedTTSIntegration),
    pause: enhancedTTSIntegration.pause.bind(enhancedTTSIntegration),
    resume: enhancedTTSIntegration.resume.bind(enhancedTTSIntegration),
    stop: enhancedTTSIntegration.stop.bind(enhancedTTSIntegration),
    skip: enhancedTTSIntegration.skip.bind(enhancedTTSIntegration),
    setVolume: enhancedTTSIntegration.setVolume.bind(enhancedTTSIntegration),
    setStrategy: enhancedTTSIntegration.setStrategy.bind(enhancedTTSIntegration),
    setEnabled: enhancedTTSIntegration.setEnabled.bind(enhancedTTSIntegration),
    getDetailedStatus: enhancedTTSIntegration.getDetailedStatus.bind(enhancedTTSIntegration),
    destroy: enhancedTTSIntegration.destroy.bind(enhancedTTSIntegration)
  }
}

// TTSState 类型已在上面定义并导出 