/**
 * 增强型统一TTS服务
 * 解决双重系统复杂性，提供智能、健壮、用户友好的语音合成体验
 */

// 类型定义
export interface TTSOptions {
  apiKey: string
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer'
  speed?: number
  volume?: number
  model?: 'tts-1' | 'tts-1-hd'
}

export interface TTSConfig {
  // 文本处理策略
  chunkingStrategy: 'realtime' | 'balanced' | 'precise'
  // 延迟控制
  minChunkSize: number
  maxChunkSize: number
  adaptiveDelay: boolean
  // 质量控制
  maxRetries: number
  timeoutMs: number
  maxConcurrent: number
  // 用户体验
  enablePreloading: boolean
  showVisualFeedback: boolean
}

export interface TTSCallbacks {
  onStart?: () => void
  onTextChunk?: (text: string, chunkId: string) => void
  onAudioReady?: (chunkId: string, duration: number) => void
  onPlayStart?: (chunkId: string, text: string) => void
  onPlayEnd?: (chunkId: string) => void
  onError?: (error: Error, chunkId?: string) => void
  onComplete?: () => void
  onStatusChange?: (status: TTSStatus) => void
}

export interface TextChunk {
  id: string
  text: string
  position: number
  priority: number
  timestamp: number
  retryCount: number
}

export interface AudioChunk {
  id: string
  textChunk: TextChunk
  audioBlob: Blob
  audioUrl: string
  audio: HTMLAudioElement
  duration: number
  isReady: boolean
  isPlaying: boolean
}

export type TTSStatus = 'idle' | 'processing' | 'playing' | 'paused' | 'error' | 'stopped'

/**
 * 智能文本分块器 - 专业级句子完整性保护版本
 * 根据不同策略和内容特点进行最优分块，始终保持句子完整性
 */
class SmartTextChunker {
  private config: TTSConfig
  private textBuffer = ''
  private position = 0
  
  // 句子完整性保护缓冲区
  // private sentenceBuffer = ''
  private pendingCompleteChunks: TextChunk[] = []
  
  constructor(config: TTSConfig) {
    this.config = config
  }

  addText(newText: string): TextChunk[] {
    if (!newText) return []
    
    this.textBuffer += newText
    return this.processBufferWithSentenceProtection()
  }

  finalize(): TextChunk[] {
    const chunks: TextChunk[] = [...this.pendingCompleteChunks]
    
    // 处理剩余的完整句子
    const finalSentences = this.extractCompleteSentences(this.textBuffer)
    chunks.push(...finalSentences.map(text => this.createChunk(text.trim())))
    
    // 处理最后的不完整片段（如果有实际内容）
    const remainingText = this.textBuffer.trim()
    if (remainingText && remainingText.length >= 10) { // 至少10字符才处理不完整片段
      chunks.push(this.createChunk(remainingText))
    }
    
    this.reset()
    this.pendingCompleteChunks = []
    return chunks
  }

  private processBufferWithSentenceProtection(): TextChunk[] {
    const chunks: TextChunk[] = [...this.pendingCompleteChunks]
    this.pendingCompleteChunks = []
    
    // 提取完整句子
    const completeSentences = this.extractCompleteSentences(this.textBuffer)
    
    if (completeSentences.length > 0) {
      // 根据策略处理完整句子
      const processedChunks = this.processCompleteSentences(completeSentences)
      chunks.push(...processedChunks)
    }
    
    return chunks
  }

  /**
   * 提取完整句子 - 核心句子识别算法
   */
  private extractCompleteSentences(text: string): string[] {
    const completeSentences: string[] = []
    
    // 真正的句末标点符号（不包括逗号、分号、冒号等）
    const sentenceEndPattern = /[。！？.!?]/g
    
    let lastIndex = 0
    let match: RegExpExecArray | null
    
    while ((match = sentenceEndPattern.exec(text)) !== null) {
      const sentenceEnd = match.index + 1
      const sentence = text.substring(lastIndex, sentenceEnd).trim()
      
      if (sentence) {
        completeSentences.push(sentence)
        lastIndex = sentenceEnd
      }
    }
    
    // 更新textBuffer，移除已提取的完整句子
    this.textBuffer = text.substring(lastIndex)
    
    return completeSentences
  }

  /**
   * 处理完整句子的分块策略
   */
  private processCompleteSentences(sentences: string[]): TextChunk[] {
    const chunks: TextChunk[] = []
    
    switch (this.config.chunkingStrategy) {
      case 'realtime':
        // 超低延迟：但保持句子完整性
        chunks.push(...this.realtimeSentenceChunking(sentences))
        break
      case 'balanced':
        // 平衡策略：合并句子到理想长度
        chunks.push(...this.balancedSentenceChunking(sentences))
        break
      case 'precise':
        // 精确策略：等待更多句子或段落
        chunks.push(...this.preciseSentenceChunking(sentences))
        break
      default:
        chunks.push(...this.balancedSentenceChunking(sentences))
    }
    
    return chunks
  }

  /**
   * 超低延迟句子分块 - 保持句子完整性
   */
  private realtimeSentenceChunking(sentences: string[]): TextChunk[] {
    const chunks: TextChunk[] = []
    
    for (const sentence of sentences) {
      // 即使是实时策略，也要保证句子完整性
      if (sentence.length <= this.config.maxChunkSize) {
        chunks.push(this.createChunk(sentence))
      } else {
        // 超长句子需要在合适位置分割（保持子句完整性）
        const subChunks = this.splitLongSentence(sentence)
        chunks.push(...subChunks.map(text => this.createChunk(text)))
      }
    }
    
    return chunks
  }

  /**
   * 平衡句子分块 - 合并句子到理想长度
   */
  private balancedSentenceChunking(sentences: string[]): TextChunk[] {
    const chunks: TextChunk[] = []
    let currentChunk = ''
    
    for (const sentence of sentences) {
      const potentialLength = currentChunk.length + sentence.length
      
      if (!currentChunk) {
        // 第一个句子
        currentChunk = sentence
      } else if (potentialLength <= this.config.maxChunkSize) {
        // 可以合并
        currentChunk += sentence
        
        // 如果达到理想长度，立即输出
        if (potentialLength >= this.config.minChunkSize) {
          chunks.push(this.createChunk(currentChunk))
          currentChunk = ''
        }
      } else {
        // 无法合并，输出当前块
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk))
        }
        currentChunk = sentence
      }
    }
    
    // 检查是否有待处理的块
    if (currentChunk) {
      if (currentChunk.length >= this.config.minChunkSize) {
        chunks.push(this.createChunk(currentChunk))
      } else {
        // 长度不足，暂存等待更多句子
        this.pendingCompleteChunks.push(this.createChunk(currentChunk))
      }
    }
    
    return chunks
  }

  /**
   * 精确句子分块 - 等待段落或更多句子
   */
  private preciseSentenceChunking(sentences: string[]): TextChunk[] {
    const chunks: TextChunk[] = []
    
    // 检查是否有段落分割符
    const fullText = sentences.join('')
    if (fullText.includes('\n') || fullText.includes('\r')) {
      // 有段落分割，按段落处理
      const paragraphs = fullText.split(/[\r\n]+/).filter(p => p.trim())
      chunks.push(...paragraphs.map(p => this.createChunk(p.trim())))
    } else {
      // 无段落分割，累积更多句子
      const combinedText = sentences.join('')
      if (combinedText.length >= this.config.minChunkSize * 2) {
        chunks.push(this.createChunk(combinedText))
      } else {
        // 继续等待更多内容
        this.pendingCompleteChunks.push(this.createChunk(combinedText))
      }
    }
    
    return chunks
  }

  /**
   * 分割超长句子 - 保持子句完整性
   */
  private splitLongSentence(sentence: string): string[] {
    const chunks: string[] = []
    
    // 在逗号、分号等处分割，但保持子句完整性
    const subClausePattern = /([^，；,;]*[，；,;]\s*)/g
    
    let currentChunk = ''
    let lastIndex = 0
    let match: RegExpExecArray | null
    
    while ((match = subClausePattern.exec(sentence)) !== null) {
      const subClause = match[1]
      const potentialLength = currentChunk.length + subClause.length
      
      if (potentialLength <= this.config.maxChunkSize) {
        currentChunk += subClause
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = subClause
      }
      lastIndex = match.index + match[1].length
    }
    
    // 处理剩余部分
    const remaining = sentence.substring(lastIndex)
    if (remaining.trim()) {
      if (currentChunk) {
        const finalChunk = currentChunk + remaining
        if (finalChunk.length <= this.config.maxChunkSize) {
          chunks.push(finalChunk.trim())
        } else {
          chunks.push(currentChunk.trim())
          chunks.push(remaining.trim())
        }
      } else {
        chunks.push(remaining.trim())
      }
    } else if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.filter(chunk => chunk.length > 0)
  }

  private createChunk(text: string, priority = 0): TextChunk {
    return {
      id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      position: this.position++,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    }
  }

  reset(): void {
    this.textBuffer = ''
    this.position = 0
    this.pendingCompleteChunks = []
  }
}

/**
 * 音频队列管理器
 * 处理音频生成、队列管理、播放控制
 */
class AudioQueueManager {
  private audioQueue: AudioChunk[] = []
  private playingChunk: AudioChunk | null = null
  private isPlaying = false
  private isPaused = false
  private volume = 1.0
  
  private callbacks: TTSCallbacks
  private config: TTSConfig
  
  constructor(callbacks: TTSCallbacks, config: TTSConfig) {
    this.callbacks = callbacks
    this.config = config
  }

  addAudioChunk(chunk: AudioChunk): void {
    // 按位置顺序插入
    const insertIndex = this.audioQueue.findIndex(item => item.textChunk.position > chunk.textChunk.position)
    if (insertIndex === -1) {
      this.audioQueue.push(chunk)
    } else {
      this.audioQueue.splice(insertIndex, 0, chunk)
    }
    
    console.log(`[增强TTS] 音频块已加入队列: "${chunk.textChunk.text.substring(0, 20)}..." (队列长度: ${this.audioQueue.length})`)
    
    // 如果没有正在播放，开始播放
    if (!this.isPlaying && !this.isPaused) {
      this.startPlayback()
    }
  }

  async startPlayback(): Promise<void> {
    if (this.isPlaying || this.isPaused) return
    
    this.isPlaying = true
    this.callbacks.onStart?.()
    
    await this.playNextChunk()
  }

  pausePlayback(): void {
    this.isPaused = true
    if (this.playingChunk?.audio) {
      this.playingChunk.audio.pause()
    }
  }

  resumePlayback(): void {
    this.isPaused = false
    if (this.playingChunk?.audio) {
      this.playingChunk.audio.play()
    } else if (this.audioQueue.length > 0) {
      this.startPlayback()
    }
  }

  stopPlayback(): void {
    this.isPlaying = false
    this.isPaused = false
    
    if (this.playingChunk?.audio) {
      this.playingChunk.audio.pause()
      this.playingChunk.audio.currentTime = 0
    }
    
    this.cleanupAudioResources()
  }

  skipCurrentChunk(): void {
    if (this.playingChunk) {
      this.playingChunk.audio.dispatchEvent(new Event('ended'))
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.playingChunk?.audio) {
      this.playingChunk.audio.volume = this.volume
    }
  }

  private async playNextChunk(): Promise<void> {
    if (this.isPaused || this.audioQueue.length === 0) {
      this.isPlaying = false
      this.callbacks.onComplete?.()
      return
    }

    const chunk = this.audioQueue.shift()!
    this.playingChunk = chunk
    chunk.isPlaying = true

    try {
      await this.playAudioChunk(chunk)
    } catch (error) {
      console.error('[增强TTS] 播放失败:', error)
      this.callbacks.onError?.(error as Error, chunk.id)
    }

    // 继续播放下一个
    this.playingChunk = null
    this.playNextChunk()
  }

  private playAudioChunk(chunk: AudioChunk): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = chunk.audio
      audio.volume = this.volume

      const handleEnded = () => {
        console.log(`[增强TTS] 播放完成: "${chunk.textChunk.text.substring(0, 20)}..."`)
        cleanup()
        this.callbacks.onPlayEnd?.(chunk.id)
        resolve()
      }

      const handleError = (event: Event) => {
        console.error('[增强TTS] 播放错误:', event)
        cleanup()
        reject(new Error('音频播放失败'))
      }

      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('error', handleError)
        URL.revokeObjectURL(audio.src)
        chunk.isPlaying = false
      }

      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('error', handleError)

      console.log(`[增强TTS] 开始播放: "${chunk.textChunk.text.substring(0, 20)}..."`)
      this.callbacks.onPlayStart?.(chunk.id, chunk.textChunk.text)

      audio.play().catch(reject)
    })
  }

  private cleanupAudioResources(): void {
    // 清理队列中的音频资源
    this.audioQueue.forEach(chunk => {
      if (chunk.audioUrl) {
        URL.revokeObjectURL(chunk.audioUrl)
      }
    })
    this.audioQueue = []

    // 清理正在播放的音频
    if (this.playingChunk?.audioUrl) {
      URL.revokeObjectURL(this.playingChunk.audioUrl)
    }
    this.playingChunk = null
  }

  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      queueLength: this.audioQueue.length,
      currentChunk: this.playingChunk?.textChunk.text.substring(0, 30) || null,
      volume: this.volume
    }
  }
}

/**
 * 自适应延迟控制器
 * 根据网络状况和用户行为动态调整处理策略
 */
class AdaptiveDelayController {
  private performanceHistory: number[] = []
  private userInterruptCount = 0
  private lastInterruptTime = 0
  
  private config: TTSConfig
  
  constructor(config: TTSConfig) {
    this.config = config
  }

  recordTTSPerformance(duration: number): void {
    this.performanceHistory.push(duration)
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift()
    }
  }

  recordUserInterrupt(): void {
    this.userInterruptCount++
    this.lastInterruptTime = Date.now()
  }

  getOptimalStrategy(): TTSConfig['chunkingStrategy'] {
    const avgPerformance = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length
    const recentInterrupts = Date.now() - this.lastInterruptTime < 60000 ? this.userInterruptCount : 0

    // 如果用户经常中断，使用更实时的策略
    if (recentInterrupts > 3) {
      return 'realtime'
    }

    // 如果网络性能好，可以使用平衡策略
    if (avgPerformance < 2000) {
      return 'balanced'
    }

    // 网络较慢时使用精确策略，减少请求频率
    return 'precise'
  }

  getOptimalChunkSize(): { min: number; max: number } {
    const strategy = this.getOptimalStrategy()
    
    switch (strategy) {
      case 'realtime':
        return { min: 8, max: 25 }
      case 'balanced':
        return { min: 15, max: 50 }
      case 'precise':
        return { min: 30, max: 100 }
      default:
        return { min: 15, max: 50 }
    }
  }
}

/**
 * 增强型TTS服务主类
 * 统一管理所有TTS功能，提供简洁的API接口
 */
export class EnhancedTTSService {
  private options: TTSOptions
  private config: TTSConfig
  private callbacks: TTSCallbacks
  
  private textChunker: SmartTextChunker
  private audioManager: AudioQueueManager
  private adaptiveController: AdaptiveDelayController
  
  private status: TTSStatus = 'idle'
  private activeRequests = new Set<string>()
  private processTimeout: NodeJS.Timeout | null = null
  
  constructor(options: TTSOptions, callbacks: TTSCallbacks = {}) {
    this.options = {
      voice: 'alloy',
      speed: 1.1,
      volume: 1.0,
      model: 'tts-1',
      ...options
    }

    this.callbacks = callbacks

    // 默认配置 - 优化分块大小以提高TTS效率
    this.config = {
      chunkingStrategy: 'balanced',
      minChunkSize: 120,  // 增加最小分块大小，减少TTS API开销
      maxChunkSize: 300,  // 增加最大分块大小，提高处理效率
      adaptiveDelay: true,
      maxRetries: 3,
      timeoutMs: 15000,   // 增加超时时间适应更大的文本块
      maxConcurrent: 4,   // 增加并发数以提高处理速度
      enablePreloading: true,
      showVisualFeedback: true
    }

    this.textChunker = new SmartTextChunker(this.config)
    this.audioManager = new AudioQueueManager(this.callbacks, this.config)
    this.adaptiveController = new AdaptiveDelayController(this.config)
    
    console.log('[增强TTS] 服务初始化完成')
  }

  /**
   * 添加文本到处理队列
   */
  addText(text: string): void {
    if (!text || this.status === 'stopped') return

    console.log(`[增强TTS] 接收文本: "${text.substring(0, 30)}..."`)
    
    const chunks = this.textChunker.addText(text)
    chunks.forEach(chunk => this.processTextChunk(chunk))

    // 设置自适应延迟处理
    if (this.config.adaptiveDelay) {
      this.scheduleAdaptiveProcessing()
    }

    this.updateStatus('processing')
  }

  /**
   * 完成文本输入
   */
  finish(): void {
    console.log('[增强TTS] 完成文本输入，处理剩余内容')
    
    const remainingChunks = this.textChunker.finalize()
    remainingChunks.forEach(chunk => this.processTextChunk(chunk))
    
    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = null
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.audioManager.pausePlayback()
    this.updateStatus('paused')
  }

  /**
   * 恢复播放
   */
  resume(): void {
    this.audioManager.resumePlayback()
    this.updateStatus('playing')
  }

  /**
   * 停止服务
   */
  stop(): void {
    console.log('[增强TTS] 停止TTS服务')
    
    this.audioManager.stopPlayback()
    this.textChunker.reset()
    this.activeRequests.clear()
    
    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = null
    }
    
    this.updateStatus('stopped')
  }

  /**
   * 跳过当前播放
   */
  skip(): void {
    this.audioManager.skipCurrentChunk()
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.audioManager.setVolume(volume)
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.textChunker = new SmartTextChunker(this.config)
    console.log('[增强TTS] 配置已更新:', newConfig)
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      status: this.status,
      audioQueue: this.audioManager.getStatus(),
      activeRequests: this.activeRequests.size,
      config: this.config
    }
  }

  private async processTextChunk(chunk: TextChunk): Promise<void> {
    if (this.activeRequests.size >= this.config.maxConcurrent) {
      console.log('[增强TTS] 达到最大并发数，等待处理')
      setTimeout(() => this.processTextChunk(chunk), 100)
      return
    }

    this.activeRequests.add(chunk.id)
    this.callbacks.onTextChunk?.(chunk.text, chunk.id)

    try {
      const startTime = Date.now()
      const audioBlob = await this.synthesizeText(chunk.text)
      const duration = Date.now() - startTime
      
      this.adaptiveController.recordTTSPerformance(duration)
      
      const audioChunk = await this.createAudioChunk(chunk, audioBlob)
      this.audioManager.addAudioChunk(audioChunk)
      
      this.callbacks.onAudioReady?.(chunk.id, audioChunk.duration)
      
    } catch (error) {
      console.error(`[增强TTS] 处理文本块失败: "${chunk.text}"`, error)
      
      if (chunk.retryCount < this.config.maxRetries) {
        chunk.retryCount++
        console.log(`[增强TTS] 重试第 ${chunk.retryCount} 次: "${chunk.text}"`)
        setTimeout(() => this.processTextChunk(chunk), 1000 * chunk.retryCount)
      } else {
        this.callbacks.onError?.(error as Error, chunk.id)
      }
    } finally {
      this.activeRequests.delete(chunk.id)
    }
  }

  private async synthesizeText(text: string): Promise<Blob> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.options.model,
        voice: this.options.voice,
        input: text,
        speed: this.options.speed
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    })

    if (!response.ok) {
      throw new Error(`TTS API 错误: ${response.status} ${response.statusText}`)
    }

    return await response.blob()
  }

  private async createAudioChunk(textChunk: TextChunk, audioBlob: Blob): Promise<AudioChunk> {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    
    // 获取音频时长
    const duration = await new Promise<number>((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration)
      })
      audio.load()
    })

    return {
      id: textChunk.id,
      textChunk,
      audioBlob,
      audioUrl,
      audio,
      duration,
      isReady: true,
      isPlaying: false
    }
  }

  private scheduleAdaptiveProcessing(): void {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
    }

    // 根据自适应控制器调整延迟
    const optimalSizes = this.adaptiveController.getOptimalChunkSize()
    this.config.minChunkSize = optimalSizes.min
    this.config.maxChunkSize = optimalSizes.max
    this.config.chunkingStrategy = this.adaptiveController.getOptimalStrategy()

    this.processTimeout = setTimeout(() => {
      const chunks = this.textChunker.addText('')
      chunks.forEach(chunk => this.processTextChunk(chunk))
    }, 200)
  }

  private updateStatus(newStatus: TTSStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus
      this.callbacks.onStatusChange?.(newStatus)
    }
  }



  private calculateChunkConfidence(chunk: string): number {
    let confidence = 100
    
    // 检查句子完整性（是否以句末标点结尾）
    if (!/[。！？.!?]$/.test(chunk.trim())) {
      confidence -= 40  // 不完整句子大幅降低信心度
    }
    
    // 检查是否包含逗号分割（逗号分割降低连贯性）
    if (chunk.includes('，') || chunk.includes(',')) {
      const parts = chunk.split(/[，,]/)
      if (parts.length > 2) {
        confidence -= 15  // 多逗号分割适度降低信心度
      }
    }
    
    // 长度评估
    if (chunk.length < 5) {
      confidence -= 20  // 过短
    } else if (chunk.length > 150) {
      confidence -= 10  // 过长
    }
    
    return Math.max(0, confidence)
  }
}

// 导出工厂函数
export function createEnhancedTTS(options: TTSOptions, callbacks?: TTSCallbacks): EnhancedTTSService {
  return new EnhancedTTSService(options, callbacks)
} 