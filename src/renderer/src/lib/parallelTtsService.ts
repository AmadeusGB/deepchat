import { ttsService } from './ttsService'

interface AudioChunk {
  id: string
  text: string
  position: number
  status: 'pending' | 'processing' | 'ready' | 'playing' | 'completed' | 'error'
  audioBuffer?: ArrayBuffer
  audioBlob?: Blob
  startTime?: number
  duration?: number
  retryCount: number
}

interface TtsConfig {
  maxConcurrent: number
  chunkSize: { min: number; max: number }
  maxRetries: number
  timeoutMs: number
  enablePreloading: boolean
}

export class ParallelTtsService {
  private chunks: Map<string, AudioChunk> = new Map()
  private playQueue: AudioChunk[] = []
  private isPlaying = false
  private currentAudio: HTMLAudioElement | null = null
  private nextPosition = 0
  private activeRequests = 0
  
  // Web Audio API 相关属性
  private audioContext: AudioContext | null = null
  private nextPlayTime = 0 // 下一个音频片段的开始时间
  private currentSourceNodes: AudioBufferSourceNode[] = []

  private config: TtsConfig = {
    maxConcurrent: 3,
    chunkSize: { min: 100, max: 300 },
    maxRetries: 2,
    timeoutMs: 15000,
    enablePreloading: true
  }

  constructor(customConfig?: Partial<TtsConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig }
    }
    
    // 初始化Web Audio API
    this.initAudioContext()
  }

  // 初始化音频上下文
  private initAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioContext = new AudioContextClass()
    } catch {
      console.warn('[并行TTS] Web Audio API 不支持，回退到HTMLAudioElement')
      this.audioContext = null
    }
  }

  // 智能文本分块 - 更激进的大块策略
  private intelligentChunking(text: string): string[] {
    if (text.length <= this.config.chunkSize.min) {
      return [text]
    }

    const chunks: string[] = []
    const sentences = text.split(/([。！？；.!?;])/g).filter(s => s.trim())
    
    let currentChunk = ''
    let i = 0

    while (i < sentences.length) {
      const sentence = sentences[i]
      const punctuation = sentences[i + 1] || ''
      const fullSentence = sentence + punctuation
      
      // 如果当前块为空，直接添加句子
      if (!currentChunk) {
        currentChunk = fullSentence
        i += punctuation ? 2 : 1
        continue
      }

      // 检查添加后的长度
      const potentialLength = currentChunk.length + fullSentence.length
      
      if (potentialLength <= this.config.chunkSize.max) {
        currentChunk += fullSentence
        i += punctuation ? 2 : 1
        
        // 如果达到理想大小且有句号，可以分块
        if (potentialLength >= this.config.chunkSize.min && /[。！？.!?]/.test(punctuation)) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }
      } else {
        // 当前块已满，保存并开始新块
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = fullSentence
        i += punctuation ? 2 : 1
      }
    }

    // 添加最后的块
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    console.log(`[并行TTS] 智能分块完成: ${text.length}字符 → ${chunks.length}块`)
    chunks.forEach((chunk, idx) => {
      console.log(`[并行TTS] 块${idx + 1}: ${chunk.length}字符 - "${chunk.substring(0, 30)}..."`)
    })

    return chunks
  }

  // 添加文本到处理队列
  async addText(text: string): Promise<void> {
    const textChunks = this.intelligentChunking(text)
    
    for (const chunkText of textChunks) {
      const chunk: AudioChunk = {
        id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: chunkText,
        position: this.nextPosition++,
        status: 'pending',
        retryCount: 0
      }
      
      this.chunks.set(chunk.id, chunk)
      this.playQueue.push(chunk)
      
      console.log(`[并行TTS] 添加块 ${chunk.position}: ${chunk.text.length}字符`)
    }

    // 开始并行处理
    this.startParallelProcessing()
    
    // 开始播放队列
    if (!this.isPlaying) {
      this.startPlayback()
    }
  }

  // 并行处理TTS请求
  private async startParallelProcessing(): Promise<void> {
    const pendingChunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.status === 'pending')
      .sort((a, b) => a.position - b.position) // 按位置排序，优先处理前面的块

    for (const chunk of pendingChunks) {
      if (this.activeRequests >= this.config.maxConcurrent) {
        break // 达到并发限制
      }

      this.processChunk(chunk)
    }
  }

  // 处理单个音频块
  private async processChunk(chunk: AudioChunk): Promise<void> {
    if (chunk.status !== 'pending') return

    this.activeRequests++
    chunk.status = 'processing'
    chunk.startTime = Date.now()

    console.log(`[并行TTS] 开始处理块 ${chunk.position}: ${chunk.text.length}字符 (并发: ${this.activeRequests})`)

    try {
      // 使用Promise.race实现超时
      const audioBlob = await Promise.race([
        this.generateAudio(chunk.text),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TTS timeout')), this.config.timeoutMs)
        )
      ])

      chunk.audioBlob = audioBlob
      chunk.status = 'ready'
      chunk.duration = Date.now() - chunk.startTime!

      console.log(`[并行TTS] 块 ${chunk.position} 处理完成: ${chunk.duration}ms`)

    } catch (error) {
      console.error(`[并行TTS] 块 ${chunk.position} 处理失败:`, error)
      
      chunk.retryCount++
      if (chunk.retryCount < this.config.maxRetries) {
        console.log(`[并行TTS] 重试块 ${chunk.position} (${chunk.retryCount}/${this.config.maxRetries})`)
        chunk.status = 'pending'
        // 延迟重试
        setTimeout(() => this.processChunk(chunk), 1000 * chunk.retryCount)
      } else {
        chunk.status = 'error'
        console.error(`[并行TTS] 块 ${chunk.position} 最终失败`)
      }
    } finally {
      this.activeRequests--
      
      // 继续处理下一个块
      this.startParallelProcessing()
    }
  }

  // 生成音频
  private async generateAudio(text: string): Promise<Blob> {
    try {
      // 调用TTS服务生成音频数据
      const audioBlob = await ttsService.generateAudioBlob(text)
      return audioBlob
    } catch (error) {
      console.error(`[并行TTS] 音频生成失败:`, error)
      throw error
    }
  }

  // 开始播放队列
  private async startPlayback(): Promise<void> {
    if (this.isPlaying) return

    this.isPlaying = true
    console.log(`[并行TTS] 开始播放队列`)

    while (this.playQueue.length > 0) {
      const chunk = this.playQueue[0]
      
      // 等待块准备就绪
      await this.waitForChunkReady(chunk)
      
      if (chunk.status === 'ready' && chunk.audioBlob) {
        try {
          await this.playChunk(chunk)
          chunk.status = 'completed'
          this.playQueue.shift() // 移除已播放的块
        } catch (error) {
          console.error(`[并行TTS] 播放块 ${chunk.position} 失败:`, error)
          chunk.status = 'error'
          this.playQueue.shift() // 跳过错误的块
        }
      } else {
        console.warn(`[并行TTS] 跳过错误块 ${chunk.position}`)
        this.playQueue.shift()
      }
    }

    this.isPlaying = false
    console.log(`[并行TTS] 播放队列完成`)
  }

  // 等待块准备就绪
  private async waitForChunkReady(chunk: AudioChunk, maxWait = 30000): Promise<void> {
    const startTime = Date.now()
    
    while (chunk.status === 'pending' || chunk.status === 'processing') {
      if (Date.now() - startTime > maxWait) {
        throw new Error(`等待块 ${chunk.position} 超时`)
      }
      
      console.log(`[并行TTS] 等待块 ${chunk.position} 准备就绪... (状态: ${chunk.status})`)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // 播放单个块
  private async playChunk(chunk: AudioChunk): Promise<void> {
    if (!chunk.audioBlob) {
      throw new Error('音频数据不存在')
    }

    console.log(`[并行TTS] 开始播放块 ${chunk.position}: ${chunk.text.length}字符`)
    chunk.status = 'playing'

    // 优先使用Web Audio API实现无缝播放
    if (this.audioContext) {
      return this.playChunkWithWebAudio(chunk)
    } else {
      // 回退到HTMLAudioElement
      return this.playChunkWithHTMLAudio(chunk)
    }
  }

  // 使用Web Audio API播放音频（无缝衔接）
  private async playChunkWithWebAudio(chunk: AudioChunk): Promise<void> {
    try {
      if (!this.audioContext || !chunk.audioBlob) {
        throw new Error('AudioContext或音频数据不存在')
      }

      // 将Blob转换为AudioBuffer
      const audioBuffer = await this.blobToAudioBuffer(chunk.audioBlob)
      
      return new Promise((resolve, reject) => {
        if (!this.audioContext) {
          reject(new Error('AudioContext不存在'))
          return
        }

        // 创建音频源节点
        const sourceNode = this.audioContext.createBufferSource()
        sourceNode.buffer = audioBuffer
        sourceNode.connect(this.audioContext.destination)

        // 计算播放时间
        const currentTime = this.audioContext.currentTime
        const startTime = Math.max(currentTime, this.nextPlayTime)
        
        // 更新下次播放时间
        this.nextPlayTime = startTime + audioBuffer.duration
        
        console.log(`[并行TTS] 无缝播放块 ${chunk.position}: 开始时间=${startTime.toFixed(3)}s, 时长=${audioBuffer.duration.toFixed(3)}s`)

        // 播放结束回调
        sourceNode.onended = () => {
          console.log(`[并行TTS] 块 ${chunk.position} 播放完成`)
          const index = this.currentSourceNodes.indexOf(sourceNode)
          if (index > -1) {
            this.currentSourceNodes.splice(index, 1)
          }
          resolve()
        }

        // 记录当前播放的节点
        this.currentSourceNodes.push(sourceNode)
        
        // 开始播放
        sourceNode.start(startTime)
      })

    } catch (error) {
      console.error(`[并行TTS] Web Audio播放块 ${chunk.position} 失败:`, error)
      throw error
    }
  }

  // 将Blob转换为AudioBuffer
  private async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext未初始化')
    }

    const arrayBuffer = await blob.arrayBuffer()
    return await this.audioContext.decodeAudioData(arrayBuffer)
  }

  // 使用HTMLAudioElement播放音频（回退方案）
  private async playChunkWithHTMLAudio(chunk: AudioChunk): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!chunk.audioBlob) {
        reject(new Error('音频数据不存在'))
        return
      }

      const audioUrl = URL.createObjectURL(chunk.audioBlob)
      const audio = new Audio(audioUrl)
      
      this.currentAudio = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        this.currentAudio = null
        console.log(`[并行TTS] 块 ${chunk.position} 播放完成`)
        resolve()
      }

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl)
        this.currentAudio = null
        console.error(`[并行TTS] 块 ${chunk.position} 播放错误:`, error)
        reject(error)
      }

      audio.play().catch(reject)
    })
  }

  // 停止播放
  stop(): void {
    // 停止HTMLAudioElement
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    
    // 停止所有Web Audio API源节点
    this.currentSourceNodes.forEach(sourceNode => {
      try {
        sourceNode.stop()
        sourceNode.disconnect()
      } catch {
        // 忽略已经停止的节点错误
      }
    })
    this.currentSourceNodes.length = 0
    
    // 重置播放时间
    this.nextPlayTime = 0
    
    this.isPlaying = false
    this.playQueue.length = 0
    this.chunks.clear()
    this.activeRequests = 0
    this.nextPosition = 0
    
    console.log(`[并行TTS] 停止播放`)
  }

  // 获取状态
  getStatus() {
    const totalChunks = this.chunks.size
    const readyChunks = Array.from(this.chunks.values()).filter(c => c.status === 'ready').length
    const processingChunks = Array.from(this.chunks.values()).filter(c => c.status === 'processing').length
    const queueLength = this.playQueue.length

    return {
      totalChunks,
      readyChunks,
      processingChunks,
      queueLength,
      isPlaying: this.isPlaying,
      activeRequests: this.activeRequests
    }
  }
}

// 创建全局实例
export const parallelTtsService = new ParallelTtsService() 