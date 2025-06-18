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
 * 智能文本分块器
 * 根据不同策略和内容特点进行最优分块
 */
class SmartTextChunker {
  private config: TTSConfig
  private textBuffer = ''
  private position = 0
  
  constructor(config: TTSConfig) {
    this.config = config
  }

  addText(newText: string): TextChunk[] {
    if (!newText) return []
    
    this.textBuffer += newText
    return this.processBuffer()
  }

  finalize(): TextChunk[] {
    if (!this.textBuffer.trim()) return []
    
    const chunk = this.createChunk(this.textBuffer.trim(), 1)
    this.textBuffer = ''
    return [chunk]
  }

  private processBuffer(): TextChunk[] {
    const chunks: TextChunk[] = []
    
    while (this.textBuffer.length > 0) {
      const chunkResult = this.findNextChunk()
      if (!chunkResult) break
      
      const { text, shouldProcess } = chunkResult
      if (shouldProcess && text.trim()) {
        chunks.push(this.createChunk(text.trim()))
        this.textBuffer = this.textBuffer.substring(text.length).trim()
      } else {
        break
      }
    }
    
    return chunks
  }

  private findNextChunk(): { text: string; shouldProcess: boolean } | null {
    const strategy = this.config.chunkingStrategy
    
    switch (strategy) {
      case 'realtime':
        return this.realtimeChunking()
      case 'balanced':
        return this.balancedChunking()
      case 'precise':
        return this.preciseChunking()
      default:
        return this.balancedChunking()
    }
  }

  private realtimeChunking(): { text: string; shouldProcess: boolean } | null {
    // 超低延迟：遇到任何标点或达到最小长度就处理
    const quickBreakMatch = this.textBuffer.match(/^([^，。！？；：,.:!?;]*[，。！？；：,.:!?;])/)
    
    if (quickBreakMatch) {
      return { text: quickBreakMatch[1], shouldProcess: true }
    }
    
    if (this.textBuffer.length >= this.config.minChunkSize) {
      const cutPoint = this.findOptimalCutPoint(this.config.minChunkSize)
      return { text: this.textBuffer.substring(0, cutPoint), shouldProcess: true }
    }
    
    return null
  }

  private balancedChunking(): { text: string; shouldProcess: boolean } | null {
    // 平衡策略：优化大块处理，减少TTS开销
    
    // 优先处理完整句子，但要达到最小长度
    const sentenceMatch = this.textBuffer.match(/^([^。！？.!?]*[。！？.!?]\s*)/)
    
    if (sentenceMatch && sentenceMatch[1].length >= this.config.minChunkSize) {
      return { text: sentenceMatch[1], shouldProcess: true }
    }
    
    // 尝试合并多个句子直到达到理想长度
    if (sentenceMatch && this.textBuffer.length >= this.config.minChunkSize) {
      const multiSentenceMatch = this.textBuffer.match(/^([^。！？.!?]*[。！？.!?]\s*){1,3}/)
      if (multiSentenceMatch && multiSentenceMatch[0].length >= this.config.minChunkSize) {
        return { text: multiSentenceMatch[0], shouldProcess: true }
      }
    }
    
    // 如果没有完整句子但长度超过阈值，在合适位置分割
    if (this.textBuffer.length >= this.config.maxChunkSize) {
      const cutPoint = this.findOptimalCutPoint(this.config.maxChunkSize)
      return { text: this.textBuffer.substring(0, cutPoint), shouldProcess: true }
    }
    
    // 只有在达到较大长度时才处理逗号分隔的片段
    if (this.textBuffer.length >= this.config.minChunkSize * 1.5) {
      const commaMatch = this.textBuffer.match(/^([^，,]*[，,]\s*){1,2}/)
      if (commaMatch && commaMatch[0].length >= this.config.minChunkSize) {
        return { text: commaMatch[0], shouldProcess: true }
      }
    }
    
    return null
  }

  private preciseChunking(): { text: string; shouldProcess: boolean } | null {
    // 精确策略：等待完整段落或强制分割点
    const paragraphMatch = this.textBuffer.match(/^([^。！？.!?]*[。！？.!?]\s*[\n\r]*)/)
    
    if (paragraphMatch) {
      return { text: paragraphMatch[1], shouldProcess: true }
    }
    
    // 只有在达到最大长度时才强制分割
    if (this.textBuffer.length >= this.config.maxChunkSize * 2) {
      const cutPoint = this.findOptimalCutPoint(this.config.maxChunkSize * 2)
      return { text: this.textBuffer.substring(0, cutPoint), shouldProcess: true }
    }
    
    return null
  }

  private findOptimalCutPoint(maxLength: number): number {
    if (this.textBuffer.length <= maxLength) return this.textBuffer.length
    
    const searchText = this.textBuffer.substring(0, maxLength)
    
    // 优先在标点符号处分割
    const punctuationIndex = Math.max(
      searchText.lastIndexOf('，'),
      searchText.lastIndexOf('；'),
      searchText.lastIndexOf(','),
      searchText.lastIndexOf(';'),
      searchText.lastIndexOf('：'),
      searchText.lastIndexOf(':')
    )
    
    if (punctuationIndex > maxLength * 0.7) {
      return punctuationIndex + 1
    }
    
    // 在空格处分割
    const spaceIndex = searchText.lastIndexOf(' ')
    if (spaceIndex > maxLength * 0.8) {
      return spaceIndex + 1
    }
    
    // 避免在中文字符中间分割
    for (let i = maxLength - 1; i >= maxLength * 0.8; i--) {
      if (!this.isCJKCharacter(this.textBuffer[i])) {
        return i + 1
      }
    }
    
    return maxLength
  }

  private isCJKCharacter(char: string): boolean {
    const code = char.charCodeAt(0)
    return (code >= 0x4e00 && code <= 0x9fff) || // 中文
           (code >= 0x3400 && code <= 0x4dbf) || // 扩展A
           (code >= 0x20000 && code <= 0x2a6df) || // 扩展B
           (code >= 0x3040 && code <= 0x309f) || // 平假名
           (code >= 0x30a0 && code <= 0x30ff) || // 片假名
           (code >= 0xac00 && code <= 0xd7af)    // 韩文
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
}

// 导出工厂函数
export function createEnhancedTTS(options: TTSOptions, callbacks?: TTSCallbacks): EnhancedTTSService {
  return new EnhancedTTSService(options, callbacks)
} 