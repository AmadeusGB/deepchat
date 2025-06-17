import { usePresenter } from '@/composables/usePresenter'

export interface TTSOptions {
  voice?: string
  speed?: number
  language?: string
}

export class TTSService {
  private configPresenter = usePresenter('configPresenter')
  private currentAudio: HTMLAudioElement | null = null
  private isPlaying = false
  private requestQueue: Promise<void> = Promise.resolve() // 请求队列，避免并发

  /**
   * 使用GPT TTS API进行语音合成（带重试机制）
   */
  async playWithGPTTTS(text: string, options: TTSOptions = {}): Promise<void> {
    // 打印TTS文字内容
    console.log('\n[TTS文字转语音] 开始播放:')
    console.log(text)
    console.log(`[字符数: ${text.length}] [语言: ${this.detectLanguage(text) === 'zh' ? '中文' : '英文'}] [时间: ${new Date().toLocaleString()}]`)
    
    // 使用队列确保请求按顺序执行，避免并发问题
    this.requestQueue = this.requestQueue.then(() => this.playWithGPTTTSInternal(text, options))
    return this.requestQueue
  }

  /**
   * 内部TTS实现（带重试）
   */
  private async playWithGPTTTSInternal(text: string, options: TTSOptions = {}): Promise<void> {
    const maxRetries = 2 // 最多重试2次
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        await this.attemptGPTTTS(text, options, attempt)
        return // 成功则直接返回
      } catch (error) {
        lastError = error as Error
        console.warn(`[TTS服务] 🔄 第${attempt}次尝试失败:`, error)
        
        if (attempt <= maxRetries) {
          // 指数退避：第一次重试等待1秒，第二次等待2秒
          const delay = attempt * 1000
          console.log(`[TTS服务] ⏳ ${delay}ms后进行第${attempt + 1}次尝试`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // 所有重试都失败
    console.error(`[TTS服务] ❌ 所有重试都失败，最后错误:`, lastError)
    console.log(`[TTS服务] 🔇 TTS完全失败，静默跳过播放`)
  }

  /**
   * 单次TTS尝试
   */
  private async attemptGPTTTS(text: string, options: TTSOptions, attempt: number): Promise<void> {
    // 简化日志输出
    if (attempt === 1) {
      console.log(`[TTS服务] 开始播放 (${text.length}字符)`)
    } else {
      console.log(`[TTS服务] 重试第${attempt}次`)
    }

    // 优化超时时间：基础20秒 + 每100字符增加8秒，最大90秒
    const baseTimeout = 20000
    const extraTimeout = Math.ceil(text.length / 100) * 8000
    const dynamicTimeout = Math.max(baseTimeout, Math.min(baseTimeout + extraTimeout, 90000))

    const openaiProvider = await this.configPresenter.getProviderById('openai')
    
    if (!openaiProvider || !openaiProvider.apiKey) {
      throw new Error('OpenAI配置未找到或API密钥缺失')
    }
    
    const language = this.detectLanguage(text)
    const voice = language === 'zh' ? 'alloy' : 'nova'
    
    // 根据尝试次数调整API超时时间
    const apiTimeout = 10000 + (attempt - 1) * 5000 // 每次重试增加5秒
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, apiTimeout)
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiProvider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          speed: options.speed || 1.2
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`TTS API请求失败: ${response.status} - ${errorText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        throw new Error('收到空的音频数据')
      }

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)

      await this.playAudioFromUrl(audioUrl, dynamicTimeout)
      
      URL.revokeObjectURL(audioUrl)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  }

  /**
   * 使用浏览器原生SpeechSynthesis API
   */
  async playWithBrowserTTS(text: string, options: TTSOptions = {}): Promise<void> {
    // 打印TTS文字内容
    console.log('\n[TTS文字转语音-浏览器] 开始播放:')
    console.log(text)
    console.log(`[字符数: ${text.length}] [语言: ${this.detectLanguage(text) === 'zh' ? '中文' : '英文'}] [时间: ${new Date().toLocaleString()}]`)
    
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.error(`[TTS服务] 浏览器不支持语音合成`)
        reject(new Error('浏览器不支持语音合成'))
        return
      }

      // 停止当前播放
      this.stop()

      const utterance = new SpeechSynthesisUtterance(text)
      
      // 设置语音参数
      const language = this.detectLanguage(text)
      utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US'
      utterance.rate = options.speed || 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0

      console.log(`[TTS服务] 浏览器TTS配置:`, {
        language,
        lang: utterance.lang,
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume
      })

      // 选择合适的语音
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith(utterance.lang) && voice.localService
      )
      if (preferredVoice) {
        utterance.voice = preferredVoice
        console.log(`[TTS服务] 选择语音: ${preferredVoice.name}`)
      } else {
        console.log(`[TTS服务] 未找到合适的本地语音，使用默认语音`)
      }

      utterance.onstart = () => {
        console.log(`[TTS服务] 浏览器TTS开始播放`)
        this.isPlaying = true
      }

      utterance.onend = () => {
        console.log(`[TTS服务] 浏览器TTS播放完成`)
        this.isPlaying = false
        resolve()
      }

      utterance.onerror = (event) => {
        console.error(`[TTS服务] 浏览器TTS播放错误:`, event.error)
        this.isPlaying = false
        reject(new Error(`语音合成失败: ${event.error}`))
      }

      console.log(`[TTS服务] 开始浏览器语音合成`)
      this.isPlaying = true
      speechSynthesis.speak(utterance)
      
      // 设置浏览器TTS超时（基于文本长度）
      const browserTimeout = Math.max(15000, text.length * 100) // 每字符100ms，最少15秒
      setTimeout(() => {
        if (this.isPlaying) {
          console.log(`[TTS服务] 浏览器TTS播放超时`)
          speechSynthesis.cancel()
          this.isPlaying = false
          reject(new Error('浏览器TTS播放超时'))
        }
      }, browserTimeout)
    })
  }

  /**
   * 播放音频URL
   */
  private async playAudioFromUrl(url: string, timeout: number): Promise<void> {
    const playStartTime = Date.now()
    
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(url)
      
      // 添加超时机制，防止音频播放卡住
      const timeoutHandle = setTimeout(() => {
        console.error(`[TTS服务] 音频播放超时 (${timeout/1000}秒)`)
        this.isPlaying = false
        if (this.currentAudio) {
          this.currentAudio.pause()
          this.currentAudio = null
        }
        reject(new Error('音频播放超时'))
      }, timeout)
      
      const cleanup = () => {
        const playDuration = Date.now() - playStartTime
        console.log(`[TTS服务] 清理音频资源，播放耗时: ${playDuration}ms`)
        
        // 添加播放完成的详细信息
        console.log(`[TTS播放完成] 耗时: ${(playDuration/1000).toFixed(2)}秒 完成时间: ${new Date().toLocaleString()}`)
        
        clearTimeout(timeoutHandle)
        this.isPlaying = false
        this.currentAudio = null
      }
      
      this.currentAudio.onloadeddata = () => {
        this.isPlaying = true
        this.currentAudio!.play().then(() => {
          // 播放开始成功
        }).catch((error) => {
          console.error(`[TTS服务] 音频播放开始失败:`, error)
          cleanup()
          reject(error)
        })
      }

      this.currentAudio.onended = () => {
        cleanup()
        resolve()
      }

      this.currentAudio.onerror = (event) => {
        console.error(`[TTS服务] 音频播放错误:`, event)
        cleanup()
        reject(new Error('音频播放失败'))
      }

      this.currentAudio.onabort = () => {
        cleanup()
        resolve() // 中止不算错误，正常结束
      }
    })
  }

  /**
   * 检测文本语言
   */
  private detectLanguage(text: string): string {
    // 简单的中文检测
    const chineseRegex = /[\u4e00-\u9fff]/
    return chineseRegex.test(text) ? 'zh' : 'en'
  }

  /**
   * 停止当前播放
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    
    this.isPlaying = false
  }

  /**
   * 获取播放状态
   */
  getPlayingStatus(): boolean {
    return this.isPlaying
  }
}

// 创建单例实例
export const ttsService = new TTSService() 