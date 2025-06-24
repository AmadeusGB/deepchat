/**
 * 专业级流式文本分块处理器
 * 专门解决AI流式输出中的句子完整性问题
 * 
 * 核心原理：
 * 1. 流式输入累积缓冲
 * 2. 句子边界智能识别
 * 3. 完整句子优先分块
 * 4. 子句完整性保护
 */

export interface StreamChunkerConfig {
  minChunkSize: number    // 最小分块大小 (字符)
  maxChunkSize: number    // 最大分块大小 (字符)
  strategy: 'realtime' | 'balanced' | 'precise'  // 分块策略
  flushTimeout?: number   // 强制刷新超时 (毫秒)
}

export interface TextChunk {
  id: string
  text: string
  position: number
  type: 'complete_sentence' | 'partial_sentence' | 'clause'
  confidence: number  // 完整性置信度 0-1
  timestamp: number
}

export class StreamTextChunker {
  private config: StreamChunkerConfig
  private buffer = ''
  private position = 0
  private lastFlushTime = Date.now()
  private chunkQueue: TextChunk[] = []

  // 句子边界检测正则表达式
  private readonly _SENTENCE_END = /[。！？.!?]/
  private readonly _CLAUSE_BREAK = /[，；,;]/
  private readonly _WEAK_BREAK = /[：:]/

  constructor(config: StreamChunkerConfig) {
    this.config = {
      flushTimeout: 3000, // 默认3秒超时
      ...config
    }
  }

  /**
   * 添加流式文本片段
   */
  addText(fragment: string): TextChunk[] {
    if (!fragment) return []

    this.buffer += fragment
    this.lastFlushTime = Date.now()

    return this.processBuffer()
  }

  /**
   * 完成流式输入，处理剩余内容
   */
  finish(): TextChunk[] {
    const chunks = this.processBuffer(true)
    
    // 处理最后的不完整内容
    if (this.buffer.trim()) {
      const remainingChunk = this.createChunk(
        this.buffer.trim(),
        this.buffer.length >= 10 ? 'partial_sentence' : 'clause',
        0.5 // 低置信度
      )
      chunks.push(remainingChunk)
    }

    this.reset()
    return chunks
  }

  /**
   * 获取待处理队列中的块
   */
  getQueuedChunks(): TextChunk[] {
    const chunks = [...this.chunkQueue]
    this.chunkQueue = []
    return chunks
  }

  /**
   * 核心处理逻辑
   */
  private processBuffer(isFinal = false): TextChunk[] {
    const chunks: TextChunk[] = []

    // 根据策略选择处理方法
    switch (this.config.strategy) {
      case 'realtime':
        chunks.push(...this.realtimeProcessing(isFinal))
        break
      case 'balanced':
        chunks.push(...this.balancedProcessing(isFinal))
        break
      case 'precise':
        chunks.push(...this.preciseProcessing(isFinal))
        break
    }

    // 处理超时强制刷新
    if (!isFinal && this.shouldForceFlush()) {
      chunks.push(...this.forceFlushBuffer())
    }

    return chunks
  }

  /**
   * 实时处理策略 - 低延迟优先
   */
  private realtimeProcessing(isFinal: boolean): TextChunk[] {
    const chunks: TextChunk[] = []
    
    // 提取完整句子
    const completeSentences = this.extractCompleteSentences()
    for (const sentence of completeSentences) {
      if (sentence.length <= this.config.maxChunkSize) {
        chunks.push(this.createChunk(sentence, 'complete_sentence', 1.0))
      } else {
        // 超长句子分解为子句
        const clauses = this.splitIntoGoodClauses(sentence)
        chunks.push(...clauses.map(clause => 
          this.createChunk(clause, 'clause', 0.8)
        ))
      }
    }

    // 如果是最终处理或缓冲区较大，处理子句
    if (isFinal || this.buffer.length >= this.config.minChunkSize) {
      const clauses = this.extractGoodClauses()
      chunks.push(...clauses.map(clause => 
        this.createChunk(clause, 'clause', 0.7)
      ))
    }

    return chunks
  }

  /**
   * 平衡处理策略 - 质量与延迟平衡
   */
  private balancedProcessing(isFinal: boolean): TextChunk[] {
    const chunks: TextChunk[] = []
    
    // 提取完整句子
    const completeSentences = this.extractCompleteSentences()
    
    // 合并短句子
    let currentChunk = ''
    for (const sentence of completeSentences) {
      const potentialLength = currentChunk.length + sentence.length
      
      if (!currentChunk) {
        currentChunk = sentence
      } else if (potentialLength <= this.config.maxChunkSize) {
        currentChunk += sentence
        
        // 达到理想大小就输出
        if (potentialLength >= this.config.minChunkSize) {
          chunks.push(this.createChunk(currentChunk, 'complete_sentence', 1.0))
          currentChunk = ''
        }
      } else {
        // 无法合并，分别处理
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, 'complete_sentence', 1.0))
        }
        
        if (sentence.length <= this.config.maxChunkSize) {
          chunks.push(this.createChunk(sentence, 'complete_sentence', 1.0))
        } else {
          const clauses = this.splitIntoGoodClauses(sentence)
          chunks.push(...clauses.map(clause => 
            this.createChunk(clause, 'clause', 0.8)
          ))
        }
        currentChunk = ''
      }
    }

    // 处理合并后的剩余内容
    if (currentChunk) {
      if (currentChunk.length >= this.config.minChunkSize || isFinal) {
        chunks.push(this.createChunk(currentChunk, 'complete_sentence', 1.0))
      } else {
        // 暂存等待更多内容
        this.chunkQueue.push(this.createChunk(currentChunk, 'partial_sentence', 0.6))
      }
    }

    return chunks
  }

  /**
   * 精确处理策略 - 质量优先
   */
  private preciseProcessing(isFinal: boolean): TextChunk[] {
    const chunks: TextChunk[] = []
    
    // 只有在充分积累或最终处理时才输出
    const completeSentences = this.extractCompleteSentences()
    
    if (completeSentences.length >= 2 || isFinal) {
      // 按段落或长文本合并
      const combinedText = completeSentences.join('')
      
      if (combinedText.length >= this.config.minChunkSize * 1.5) {
        chunks.push(this.createChunk(combinedText, 'complete_sentence', 1.0))
      } else if (isFinal && combinedText) {
        chunks.push(this.createChunk(combinedText, 'complete_sentence', 0.9))
      } else {
        // 继续等待更多内容
        this.chunkQueue.push(this.createChunk(combinedText, 'partial_sentence', 0.6))
      }
    }

    return chunks
  }

  /**
   * 提取完整句子
   */
  private extractCompleteSentences(): string[] {
    const sentences: string[] = []
    const sentencePattern = /([^。！？.!?]*[。！？.!?])/g
    
    let match: RegExpExecArray | null
    let lastIndex = 0
    
    while ((match = sentencePattern.exec(this.buffer)) !== null) {
      const sentence = match[1].trim()
      if (sentence) {
        sentences.push(sentence)
        lastIndex = match.index + match[1].length
      }
    }
    
    // 更新缓冲区
    this.buffer = this.buffer.substring(lastIndex)
    
    return sentences
  }

  /**
   * 提取良好的子句（在标点处分割但保持意义完整）
   */
  private extractGoodClauses(): string[] {
    const clauses: string[] = []
    
    // 在逗号、分号处寻找合适的分割点
    const clausePattern = /([^，；,;]*[，；,;])/g
    
    let match: RegExpExecArray | null
    let lastIndex = 0
    
    while ((match = clausePattern.exec(this.buffer)) !== null) {
      const clause = match[1].trim()
      if (clause && clause.length >= 10) { // 至少10字符才算有意义的子句
        clauses.push(clause)
        lastIndex = match.index + match[1].length
      }
    }
    
    // 更新缓冲区
    this.buffer = this.buffer.substring(lastIndex)
    
    return clauses
  }

  /**
   * 将超长句子分解为有意义的子句
   */
  private splitIntoGoodClauses(sentence: string): string[] {
    const clauses: string[] = []
    
    // 优先在逗号、分号处分割
    const parts = sentence.split(/([，；,;])/)
    
    let currentClause = ''
    for (let i = 0; i < parts.length; i += 2) {
      const part = parts[i] || ''
      const punctuation = parts[i + 1] || ''
      const segment = part + punctuation
      
      if (!currentClause) {
        currentClause = segment
      } else if ((currentClause + segment).length <= this.config.maxChunkSize) {
        currentClause += segment
      } else {
        if (currentClause.trim()) {
          clauses.push(currentClause.trim())
        }
        currentClause = segment
      }
    }
    
    if (currentClause.trim()) {
      clauses.push(currentClause.trim())
    }
    
    return clauses.filter(clause => clause.length > 0)
  }

  /**
   * 检查是否需要强制刷新
   */
  private shouldForceFlush(): boolean {
    const timeSinceLastFlush = Date.now() - this.lastFlushTime
    return Boolean(this.config.flushTimeout) && 
           timeSinceLastFlush > (this.config.flushTimeout || 0) &&
           this.buffer.length > 0
  }

  /**
   * 强制刷新缓冲区
   */
  private forceFlushBuffer(): TextChunk[] {
    const chunks: TextChunk[] = []
    
    if (this.buffer.trim()) {
      // 尝试提取子句
      const clauses = this.extractGoodClauses()
      if (clauses.length > 0) {
        chunks.push(...clauses.map(clause => 
          this.createChunk(clause, 'clause', 0.6)
        ))
      } else if (this.buffer.length >= 20) {
        // 至少20字符才强制输出
        chunks.push(this.createChunk(this.buffer.trim(), 'partial_sentence', 0.4))
        this.buffer = ''
      }
    }
    
    return chunks
  }

  /**
   * 创建文本块
   */
  private createChunk(
    text: string, 
    type: TextChunk['type'], 
    confidence: number
  ): TextChunk {
    return {
      id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      position: this.position++,
      type,
      confidence,
      timestamp: Date.now()
    }
  }

  /**
   * 重置状态
   */
  private reset(): void {
    this.buffer = ''
    this.position = 0
    this.chunkQueue = []
    this.lastFlushTime = Date.now()
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      bufferLength: this.buffer.length,
      bufferContent: this.buffer.substring(0, 50) + (this.buffer.length > 50 ? '...' : ''),
      queuedChunks: this.chunkQueue.length,
      timeSinceLastFlush: Date.now() - this.lastFlushTime
    }
  }
} 