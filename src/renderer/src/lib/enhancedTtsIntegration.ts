/**
 * 增强TTS服务集成适配器
 * 提供简化的API接口，方便在chatStore和组件中使用
 */

import { ref, computed } from 'vue'
import { SentenceCompleteChunker, type ChunkResult, type ChunkerCallbacks } from './sentenceCompleteChunker'
import { createEnhancedTTS, type TTSOptions, type TTSCallbacks, type TTSStatus, type EnhancedTTSService } from './enhancedTtsService'

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

export interface TtsIntegrationConfig {
  minChunkLength: number
  maxChunkLength: number
  confidenceThreshold: number
  maxDelayMs: number
  forceFlushTimeoutMs: number
}

class EnhancedTTSIntegration {
  private ttsService: EnhancedTTSService | null = null
  private isInitialized = false
  private chunker: SentenceCompleteChunker
  private config: TtsIntegrationConfig
  private isProcessing = false
  private pendingTimeout: NodeJS.Timeout | null = null
  private lastInputTime: number = 0 // 新增：记录最后输入时间
  private forceFlushInProgress: boolean = false // 新增：防止重复强制刷新
  
  // 🎯 新增：全局禁用开关
  private isGloballyDisabled = false
  
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
  public readonly isActive = computed(() => this.isInitialized && this.state.value.isEnabled)
  public readonly canControl = computed(() => this.isActive.value && this.state.value.queueLength > 0)

  constructor(config: Partial<TtsIntegrationConfig> = {}) {
    this.config = {
      minChunkLength: 80,
      maxChunkLength: 250,
      confidenceThreshold: 0.9,
      maxDelayMs: 2000,
      forceFlushTimeoutMs: 2000, // 优化：减少强制刷新等待时间
      ...config
    }

    // 设置分块器回调
    const chunkerCallbacks: ChunkerCallbacks = {
      onForceFlush: (chunks: ChunkResult[]) => {
        console.log(`🔥 [TTS集成] 接收到强制刷新的${chunks.length}个块`)
        // 异步处理强制刷新的块
        chunks.forEach(chunk => {
          this.handleChunk(chunk).catch(error => {
            console.error(`❌ [TTS集成] 强制刷新块处理失败:`, error)
          })
        })
      },
      onError: (error: Error) => {
        console.error(`❌ [TTS集成] 分块器错误:`, error)
      }
    }

    this.chunker = new SentenceCompleteChunker(
      this.config.minChunkLength,
      this.config.maxChunkLength,
      chunkerCallbacks
    )

    console.log(`🚀 [增强TTS集成] 初始化完成`)
    console.log(`   ⚙️  配置参数:`)
    console.log(`      📏 长度范围: ${this.config.minChunkLength}-${this.config.maxChunkLength}字符`)
    console.log(`      📊 信心度阈值: ${this.config.confidenceThreshold}`)
    console.log(`      ⏱️  最大延迟: ${this.config.maxDelayMs}ms`)
    console.log(`      🔥 强制刷新: ${this.config.forceFlushTimeoutMs}ms`)
    console.log(`      🔔 回调机制: 已启用`)
  }

  /**
   * 初始化TTS服务
   */
  async initialize(apiKey: string, options: Partial<TTSOptions> = {}): Promise<void> {
    try {
      // 配置TTS选项
      const ttsOptions: TTSOptions = {
        apiKey, // 添加必需的apiKey参数
        voice: 'alloy',
        speed: 1.1,
        volume: 1.0,
        model: 'tts-1',
        ...options
      }

      // 配置回调函数
      const callbacks: TTSCallbacks = {
        onStart: () => {
          console.log(`🎵 [TTS集成] 开始播放`)
          this.state.value.isPlaying = true
        },
        onComplete: () => {
          console.log(`✅ [TTS集成] 播放完成`)
          this.state.value.isPlaying = false
          this.state.value.currentText = ''
        },
        onError: (error) => {
          console.error(`❌ [TTS集成] 播放错误:`, error)
          this.state.value.isPlaying = false
          this.state.value.currentText = ''
        }
      }

      // 初始化技术文档专业分块器 - 优化配置
      const chunkerConfig = {
        minSize: 50,      // 提高最小块大小，适应技术文档
        maxSize: 300      // 增加最大块大小，保持语义完整性
      }

      this.chunker = new SentenceCompleteChunker(chunkerConfig.minSize, chunkerConfig.maxSize)
      this.ttsService = createEnhancedTTS(ttsOptions, callbacks)
      this.isInitialized = true
      this.state.value.isEnabled = true
      
      console.log('[TTS集成] 初始化完成 - 使用技术文档专业分块器')
      console.log(`   📏 分块配置: ${chunkerConfig.minSize}-${chunkerConfig.maxSize}字符`)
      console.log(`   🎯 优化特性: 语义完整性、结构化内容保护、中英文混合支持`)
    } catch (error) {
      console.error('[TTS集成] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 🎯 全局禁用TTS（用于避免与其他TTS服务冲突）
   */
  setGloballyDisabled(disabled: boolean): void {
    this.isGloballyDisabled = disabled
    console.log(`🎛️ [TTS集成] 全局${disabled ? '禁用' : '启用'}TTS服务`)
    
    if (disabled && this.isActive.value) {
      this.stop()
    }
  }

  /**
   * 🎯 检查是否全局禁用
   */
  isDisabled(): boolean {
    return this.isGloballyDisabled
  }

  /**
   * 处理流式文本输入 - 技术文档优化版
   */
  async processStreamText(text: string): Promise<void> {
    // 🎯 检查全局禁用状态
    if (this.isGloballyDisabled) {
      console.debug(`🚫 [TTS集成] 全局禁用状态，跳过文本处理`)
      return
    }
    
    if (!this.isActive.value) {
      console.debug(`🔇 [TTS集成] 服务未激活，跳过文本处理 (这是正常的，用户可在设置中启用TTS)`)
      return
    }

    console.log(`\n🌊 [TTS集成-技术文档流式处理] 收到文本片段`)
    console.log(`📝 输入文本: "${text}" (${text.length}字符)`)
    console.log(`🔄 当前处理状态: ${this.isProcessing ? '处理中' : '空闲'}`)
    console.log(`🎯 内容类型: ${this.identifyContentType(text)}`)
    console.log(`═══════════════════════════════════════════`)

    // 更新最后输入时间
    this.lastInputTime = Date.now()

    try {
      // 使用技术文档优化分块器处理
      const chunks = this.chunker.addFragment(text)
      
      console.log(`📊 [TTS集成-技术文档流式处理] 分块器返回${chunks.length}个块`)

      // 处理每个准备好的块
      for (const chunk of chunks) {
        await this.handleChunk(chunk)
      }

      // 检查缓冲区状态并智能设置强制刷新超时
      this.smartForceFlushTimeout()

    } catch (error) {
      console.error(`❌ [TTS集成-技术文档流式处理] 处理错误:`, error)
    }
  }

  /**
   * 识别内容类型
   */
  private identifyContentType(text: string): string {
    if (/^\s*[0-9]+\.\s+/.test(text)) return '列表项'
    if (/^[#]+\s+/.test(text)) return '标题'
    if (text.includes('：') || text.includes('是')) return '定义'
    if (/[a-zA-Z]/.test(text) && /[\u4e00-\u9fa5]/.test(text)) return '中英混合'
    if (text.includes('（') && text.includes('）')) return '括号说明'
    return '普通文本'
  }

  /**
   * 处理单个文本块 - 技术文档优化版
   */
  private async handleChunk(chunk: ChunkResult): Promise<void> {
    console.log(`\n📦 [TTS集成-技术文档处理块] 开始处理`)
    console.log(`   🆔 块ID: ${chunk.id}`)
    console.log(`   📝 文本: "${chunk.text}" (${chunk.text.length}字符)`)
    console.log(`   🏷️  类型: ${chunk.type}`)
    console.log(`   📊 信心度: ${chunk.confidence}`)
    console.log(`   🎯 内容类别: ${chunk.category}`)
    console.log(`   📏 阈值: ${this.config.confidenceThreshold}`)

    // 基于内容类别和信心度决定处理策略
    const shouldProcessImmediately = 
      chunk.confidence >= this.config.confidenceThreshold ||
      chunk.category === 'definition' ||  // 定义类内容立即处理
      chunk.category === 'list' ||        // 列表项立即处理
      chunk.type === 'structured';        // 结构化内容立即处理

    if (shouldProcessImmediately) {
      console.log(`   ✅ 符合处理条件，立即处理 (类别:${chunk.category}, 信心度:${chunk.confidence})`)
      await this.processTts(chunk.text)
    } else {
      console.log(`   ⚠️  信心度不足或内容类型需延迟处理`)
      await this.delayedProcess(chunk)
    }
  }

  /**
   * 延迟处理低信心度块
   */
  private async delayedProcess(chunk: ChunkResult): Promise<void> {
    const delay = Math.min(
      (1 - chunk.confidence) * this.config.maxDelayMs,
      this.config.maxDelayMs
    )

    console.log(`⏳ [TTS集成-延迟处理] 等待${delay}ms后处理`)
    console.log(`   📊 计算: (1-${chunk.confidence}) × ${this.config.maxDelayMs} = ${delay}ms`)

    await new Promise(resolve => setTimeout(resolve, delay))
    
    console.log(`⏰ [TTS集成-延迟处理] 延迟结束，开始处理`)
    await this.processTts(chunk.text)
  }

  /**
   * 实际TTS处理
   */
  private async processTts(text: string): Promise<void> {
    console.log(`\n🔊 [TTS集成-语音处理] 开始TTS`)
    console.log(`📝 处理文本: "${text}" (${text.length}字符)`)
    
    this.isProcessing = true

    try {
      // 调用实际的TTS服务
      if (this.ttsService) {
        this.ttsService.addText(text)
        console.log(`✅ [TTS集成-语音处理] TTS文本已添加`)
      }
      
    } catch (error) {
      console.error(`❌ [TTS集成-语音处理] TTS处理错误:`, error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 智能强制刷新超时管理
   */
  private smartForceFlushTimeout(): void {
    const bufferStatus = this.chunker.getStatus()
    const currentTime = Date.now()
    
    console.log(`🧠 [TTS集成-智能超时] 分析缓冲区状态`)
    console.log(`   📋 缓冲区长度: ${bufferStatus.bufferLength}字符`)
    console.log(`   📄 缓冲区内容: "${bufferStatus.bufferPreview}"`)
    console.log(`   ⏰ 距离上次输入: ${currentTime - this.lastInputTime}ms`)
    console.log(`   🔄 强制刷新进行中: ${this.forceFlushInProgress}`)
    console.log(`   ⏳ 当前超时状态: ${this.pendingTimeout ? '已设置' : '未设置'}`)

    // 缓冲区溢出保护：如果缓冲区过大，立即处理
    if (bufferStatus.bufferLength > this.config.maxChunkLength * 2) {
      console.log(`🚨 [TTS集成-缓冲区溢出] 缓冲区过大(${bufferStatus.bufferLength}字符)，立即强制刷新`)
      this.triggerForceFlush()
      return
    }

    // 如果缓冲区为空，清除超时
    if (bufferStatus.bufferLength === 0) {
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout)
        this.pendingTimeout = null
        console.log(`🧹 [TTS集成-智能超时] 缓冲区为空，清除超时`)
      }
      return
    }

    // 如果强制刷新正在进行中，不要重复设置
    if (this.forceFlushInProgress) {
      console.log(`⏸️  [TTS集成-智能超时] 强制刷新进行中，跳过超时设置`)
      return
    }

    // 只有在没有设置超时的情况下才设置新的超时
    if (!this.pendingTimeout) {
      this.pendingTimeout = setTimeout(async () => {
        console.log(`⏰ [TTS集成-强制刷新] 超时触发！开始强制处理`)
        console.log(`   📊 触发时缓冲区: "${this.chunker.getStatus().bufferPreview}" (${this.chunker.getStatus().bufferLength}字符)`)
        console.log(`   ⏱️  超时时间: ${this.config.forceFlushTimeoutMs}ms`)
        console.log(`   🕐 触发时间: ${new Date().toLocaleTimeString()}`)
        
        await this.triggerForceFlush()
      }, this.config.forceFlushTimeoutMs)

      console.log(`⏱️  [TTS集成-智能超时] 设置${this.config.forceFlushTimeoutMs}ms超时`)
      console.log(`   🎯 目标: 处理${bufferStatus.bufferLength}字符缓冲区`)
      console.log(`   📅 预计触发时间: ${new Date(currentTime + this.config.forceFlushTimeoutMs).toLocaleTimeString()}`)
    } else {
      console.log(`⏳ [TTS集成-智能超时] 超时已存在，保持当前超时`)
    }
  }

  /**
   * 触发强制刷新
   */
  private async triggerForceFlush(): Promise<void> {
    if (this.forceFlushInProgress) {
      console.log(`⏸️  [TTS集成-强制刷新] 已在进行中，跳过重复触发`)
      return
    }

    this.forceFlushInProgress = true
    console.log(`🔥 [TTS集成-强制刷新] 开始强制刷新流程`)

    try {
      // 清除超时
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout)
        this.pendingTimeout = null
        console.log(`🧹 [TTS集成-强制刷新] 清除超时定时器`)
      }

      const bufferStatus = this.chunker.getStatus()
      console.log(`📋 [TTS集成-强制刷新] 当前缓冲区: "${bufferStatus.bufferPreview}" (${bufferStatus.bufferLength}字符)`)
      
      if (bufferStatus.bufferLength > 0) {
        console.log(`🚀 [TTS集成-强制刷新] 执行最终处理`)
        await this.finalizeText()
      } else {
        console.log(`✅ [TTS集成-强制刷新] 缓冲区为空，无需处理`)
      }
    } catch (error) {
      console.error(`❌ [TTS集成-强制刷新] 强制刷新错误:`, error)
    } finally {
      this.forceFlushInProgress = false
      console.log(`🏁 [TTS集成-强制刷新] 强制刷新流程完成`)
    }
  }

  /**
   * 获取处理状态
   */
  getStatus(): {
    isProcessing: boolean
    bufferStatus: ReturnType<SentenceCompleteChunker['getStatus']>
    config: TtsIntegrationConfig
  } {
    const status = {
      isProcessing: this.isProcessing,
      bufferStatus: this.chunker.getStatus(),
      config: this.config
    }

    console.log(`📊 [TTS集成-状态查询] 当前状态:`)
    console.log(`   🔄 处理中: ${status.isProcessing}`)
    console.log(`   📋 缓冲区: "${status.bufferStatus.bufferPreview}" (${status.bufferStatus.bufferLength}字符)`)
    console.log(`   📈 缓冲区空: ${status.bufferStatus.bufferLength === 0}`)

    return status
  }

  /**
   * 重置服务状态
   */
  reset(): void {
    console.log(`🔄 [TTS集成-重置] 重置所有状态`)
    
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout)
      this.pendingTimeout = null
      console.log(`   🧹 清除超时`)
    }

    this.chunker.reset()
    this.isProcessing = false
    this.forceFlushInProgress = false // 重置强制刷新状态
    this.lastInputTime = 0 // 重置最后输入时间
    
    console.log(`✅ [TTS集成-重置] 重置完成`)
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (!this.isActive.value) return

    try {
      this.ttsService!.pause()
      this.updateState({ isPaused: true })
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
      this.updateState({ isPaused: false })
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
      this.updateState({ 
        isPlaying: false, 
        isPaused: false, 
        currentText: '',
        queueLength: 0,
        status: 'idle'
      })
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
   * 完成文本输入处理
   */
  async finalizeText(): Promise<void> {
    console.log(`\n🔚 [TTS集成-完成处理] 开始最终处理`)
    
    try {
      // 清除超时
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout)
        this.pendingTimeout = null
        console.log(`🧹 [TTS集成-完成处理] 清除强制刷新超时`)
      }

      // 强制处理剩余内容
      const finalChunks = this.chunker.finalize()
      console.log(`📊 [TTS集成-完成处理] 最终分块器返回${finalChunks.length}个块`)

      // 处理所有最终块
      for (const chunk of finalChunks) {
        await this.handleChunk(chunk)
      }

      console.log(`✅ [TTS集成-完成处理] 所有文本处理完成`)

    } catch (error) {
      console.error(`❌ [TTS集成-完成处理] 最终处理错误:`, error)
    } finally {
      this.isProcessing = false
      this.forceFlushInProgress = false // 重置强制刷新状态
      console.log(`🏁 [TTS集成-完成处理] 重置处理状态`)
    }
  }

  /**
   * 完成文本输入 - 兼容性方法
   * 这个方法被 chat.ts 调用
   */
  finishTextInput(): void {
    console.log(`🔚 [TTS集成-兼容性] finishTextInput 被调用`)
    this.finalizeText().catch(error => {
      console.error(`❌ [TTS集成-兼容性] finishTextInput 异步错误:`, error)
    })
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
    finalizeText: enhancedTTSIntegration.finalizeText.bind(enhancedTTSIntegration),
    finishTextInput: enhancedTTSIntegration.finishTextInput.bind(enhancedTTSIntegration),
    pause: enhancedTTSIntegration.pause.bind(enhancedTTSIntegration),
    resume: enhancedTTSIntegration.resume.bind(enhancedTTSIntegration),
    stop: enhancedTTSIntegration.stop.bind(enhancedTTSIntegration),
    skip: enhancedTTSIntegration.skip.bind(enhancedTTSIntegration),
    setVolume: enhancedTTSIntegration.setVolume.bind(enhancedTTSIntegration),
    setStrategy: enhancedTTSIntegration.setStrategy.bind(enhancedTTSIntegration),
    setEnabled: enhancedTTSIntegration.setEnabled.bind(enhancedTTSIntegration),
    getDetailedStatus: enhancedTTSIntegration.getDetailedStatus.bind(enhancedTTSIntegration),
    destroy: enhancedTTSIntegration.destroy.bind(enhancedTTSIntegration),
    getStatus: enhancedTTSIntegration.getStatus.bind(enhancedTTSIntegration),
    reset: enhancedTTSIntegration.reset.bind(enhancedTTSIntegration),
    setGloballyDisabled: enhancedTTSIntegration.setGloballyDisabled.bind(enhancedTTSIntegration),
    isDisabled: enhancedTTSIntegration.isDisabled.bind(enhancedTTSIntegration)
  }
}

// TTSState 类型已在上面定义并导出 
// TTSState 类型已在上面定义并导出 