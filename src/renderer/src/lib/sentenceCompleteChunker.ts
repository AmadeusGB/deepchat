/**
 * 句子完整性保护分块器 - 技术文档优化版
 * 专门解决AI流式输出中句子被拆开的问题
 *
 * 核心原则：
 * 1. 句子完整性 > 延迟优化
 * 2. 技术文档语义完整性保护
 * 3. 中英文混合内容智能处理
 * 4. 结构化内容（列表、标题）保护
 * 5. 流式累积缓冲机制
 */

export interface ChunkResult {
  id: string
  text: string
  type: 'complete' | 'partial' | 'structured'
  confidence: number
  category: 'sentence' | 'list' | 'title' | 'definition' | 'mixed'
}

export interface ChunkerCallbacks {
  onForceFlush?: (chunks: ChunkResult[]) => void
  onError?: (error: Error) => void
}

export class SentenceCompleteChunker {
  private buffer = ''
  private position = 0
  private minSize: number
  private maxSize: number
  private forceFlushTimeout: NodeJS.Timeout | null = null
  private readonly forceFlushTimeoutMs = 1500
  private callbacks: ChunkerCallbacks

  constructor(minSize = 15, maxSize = 180, callbacks: ChunkerCallbacks = {}) {
    this.minSize = minSize
    this.maxSize = maxSize
    this.callbacks = callbacks
    this.buffer = ''
    this.forceFlushTimeoutMs = 1500 // 减少超时时间，提高响应性

    console.log(`🔧 [技术文档分块器] 初始化完成`)
    console.log(`   📏 最小块大小: ${this.minSize}字符`)
    console.log(`   📏 最大块大小: ${this.maxSize}字符`)
    console.log(`   ⏰ 强制刷新超时: ${this.forceFlushTimeoutMs}ms`)
  }

  /**
   * 添加流式文本片段
   */
  addFragment(fragment: string): ChunkResult[] {
    try {
      // 增强输入验证
      if (!fragment || typeof fragment !== 'string') return []

      if (fragment.length === 0) return []

      // 优化空白处理 - 更宽松的条件
      const trimmedFragment = fragment.trim()
      if (!trimmedFragment && fragment.length < 5 && this.buffer.length === 0) {
        console.log(`🚫 [跳过] 短空白片段: "${fragment}" (${fragment.length}字符)`)
        return []
      }

      console.log(`\n🔄 [技术文档分块-新片段] 输入 (${fragment.length}字符):`)
      console.log(`📝 新片段: "${fragment}"`)

      const oldBuffer = this.buffer

      // 原子操作：缓冲区更新
      const newBuffer = oldBuffer + fragment

      // 防止缓冲区过度膨胀 - 改进策略
      if (newBuffer.length > this.maxSize * 4) {
        // 提高阈值
        console.log(`⚠️ [缓冲区过大] ${newBuffer.length} > ${this.maxSize * 4}，智能分割处理`)

        // 智能分割：寻找最佳分割点
        const splitPoint = this.findOptimalSplitPoint(newBuffer)
        if (splitPoint > 0) {
          this.buffer = newBuffer.substring(0, splitPoint)
          const result = this.finalize()
          this.buffer = newBuffer.substring(splitPoint) // 保留剩余部分
          return result
        } else {
          // 强制分割
          const result = this.finalize()
          this.buffer = fragment
          return result
        }
      }

      // 缓冲区溢出保护 - 立即处理过大的缓冲区
      if (newBuffer.length > this.maxSize * 2.5) {
        console.log(`⚠️  [缓冲区保护] 缓冲区过大(${newBuffer.length}字符)，强制处理`)
        const emergencyChunks = this.forceProcessBuffer(newBuffer)
        if (emergencyChunks.length > 0) {
          this.buffer = fragment // 重置缓冲区为当前片段
          return emergencyChunks
        }
      }

      // 安全更新缓冲区
      this.buffer = newBuffer

      console.log(`🗂️  缓冲区更新:`)
      console.log(`   📂 旧缓冲: "${oldBuffer}" (${oldBuffer.length}字符)`)
      console.log(`   ➕ 新片段: "${fragment}" (${fragment.length}字符)`)
      console.log(`   📋 新缓冲: "${this.buffer}" (${this.buffer.length}字符)`)
      console.log(`➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖`)

      // 重置强制刷新计时器
      this.resetForceFlushTimeout()

      return this.extractReadyChunks()
    } catch (error) {
      console.error(`❌ [技术文档分块] 处理片段时发生错误:`, error)
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error)
      }
      return []
    }
  }

  /**
   * 寻找最佳分割点
   */
  private findOptimalSplitPoint(text: string): number {
    const maxSearchLength = this.maxSize * 2
    const searchText = text.substring(0, Math.min(text.length, maxSearchLength))

    // 优先级分割点
    const splitPatterns = [
      /[。！？.!?]\s*/g, // 句末标点
      /[，；,;]\s*/g, // 分句标点
      /\n\n/g, // 段落分隔
      /\n/g, // 行分隔
      /\s+/g // 空白字符
    ]

    for (const pattern of splitPatterns) {
      const matches = Array.from(searchText.matchAll(pattern))
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const splitPoint = lastMatch.index! + lastMatch[0].length
        if (splitPoint > this.minSize && splitPoint < maxSearchLength) {
          console.log(`🔍 [智能分割] 找到最佳分割点: 位置${splitPoint}`)
          return splitPoint
        }
      }
    }

    return 0
  }

  /**
   * 重置强制刷新计时器 - 改进版
   */
  private resetForceFlushTimeout(): void {
    if (this.forceFlushTimeout) {
      clearTimeout(this.forceFlushTimeout)
    }

    this.forceFlushTimeout = setTimeout(() => {
      console.log(`⏰ [强制刷新] ${this.forceFlushTimeoutMs}ms超时，强制输出缓冲内容`)

      try {
        const chunks = this.finalize()
        if (chunks.length > 0) {
          console.log(`🔥 [强制刷新] 输出${chunks.length}个超时块`)

          // 通过回调机制处理强制刷新的块
          if (this.callbacks.onForceFlush) {
            this.callbacks.onForceFlush(chunks)
          }
        }
      } catch (error) {
        console.error(`❌ [强制刷新] 处理错误:`, error)
        if (this.callbacks.onError) {
          this.callbacks.onError(error as Error)
        }
      }
    }, this.forceFlushTimeoutMs)
  }

  /**
   * 完成输入，输出剩余内容
   */
  finalize(): ChunkResult[] {
    console.log(`\n🔥 [技术文档分块-强制完成] 处理剩余缓冲区`)
    console.log(`📋 剩余缓冲: "${this.buffer}" (${this.buffer.length}字符)`)

    // 清除计时器
    if (this.forceFlushTimeout) {
      clearTimeout(this.forceFlushTimeout)
      this.forceFlushTimeout = null
    }

    const chunks: ChunkResult[] = []

    if (this.buffer.trim()) {
      const category = this.identifyContentCategory(this.buffer)
      const finalChunk = {
        id: this.generateId(),
        text: this.buffer.trim(),
        type: 'partial' as const,
        confidence: 0.8,
        category
      }
      chunks.push(finalChunk)

      console.log(
        `🏁 强制输出最后块: "${finalChunk.text}" (${finalChunk.text.length}字符, 类型:${finalChunk.category}, 信心度:${finalChunk.confidence})`
      )

      this.buffer = ''
    }

    console.log(`🔚 [技术文档分块-强制完成结束] 输出${chunks.length}块\n`)
    return chunks
  }

  /**
   * 提取准备好的文本块 - 技术文档优化版
   */
  private extractReadyChunks(): ChunkResult[] {
    console.log(`🔍 [技术文档分块-提取] 开始智能分析缓冲区`)

    const chunks: ChunkResult[] = []

    // 智能识别结构化内容
    const structuredContent = this.identifyStructuredContent()
    if (structuredContent.length > 0) {
      console.log(`🏗️  [结构化内容] 识别到${structuredContent.length}个结构化块`)
      chunks.push(...structuredContent)
      return chunks
    }

    // 提取完整句子 - 技术文档增强版
    const sentences = this.extractCompleteSentencesEnhanced()

    console.log(`📊 [技术文档分块-提取] 提取到 ${sentences.length} 个语义单元`)
    sentences.forEach((sentence, idx) => {
      console.log(`   ✅ 语义单元${idx + 1}: "${sentence}" (${sentence.length}字符)`)
    })

    // 智能合并 - 考虑语义完整性
    let currentChunk = ''
    let chunkIndex = 0

    console.log(`🧩 [技术文档分块-合并] 开始语义智能合并处理`)

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const potentialLength = currentChunk.length + sentence.length

      console.log(`\n🔍 处理语义单元${i + 1}: "${sentence}" (${sentence.length}字符)`)
      console.log(`   📏 当前块: ${currentChunk.length}字符, 合并后: ${potentialLength}字符`)
      console.log(`   📊 限制: 最小${this.minSize}, 最大${this.maxSize}`)

      // 检查语义关联性
      const semanticRelation = this.checkSemanticRelation(currentChunk, sentence)
      console.log(`   🔗 语义关联: ${semanticRelation}`)

      if (!currentChunk) {
        currentChunk = sentence
        console.log(`   ➕ 新块开始: "${currentChunk}"`)
      } else if (potentialLength <= this.maxSize && semanticRelation !== 'independent') {
        currentChunk += sentence
        console.log(`   ✅ 语义合并: "${currentChunk}" (${currentChunk.length}字符)`)

        // 达到最小长度且语义完整就可以输出
        if (potentialLength >= this.minSize && semanticRelation === 'complete') {
          chunkIndex++
          const category = this.identifyContentCategory(currentChunk)
          const newChunk = {
            id: this.generateId(),
            text: currentChunk.trim(),
            type: 'complete' as const,
            confidence: 1.0,
            category
          }
          chunks.push(newChunk)
          console.log(
            `   🎯 语义完整，输出块${chunkIndex}: "${newChunk.text}" (${newChunk.text.length}字符, 类型:${newChunk.category}, 信心度:${newChunk.confidence})`
          )
          currentChunk = ''
        }
      } else {
        // 无法合并，分别输出
        if (currentChunk) {
          chunkIndex++
          const category = this.identifyContentCategory(currentChunk)
          const currentChunkObj = {
            id: this.generateId(),
            text: currentChunk.trim(),
            type: 'complete' as const,
            confidence: 1.0,
            category
          }
          chunks.push(currentChunkObj)
          console.log(
            `   🚫 无法合并，输出当前块${chunkIndex}: "${currentChunkObj.text}" (${currentChunkObj.text.length}字符, 类型:${currentChunkObj.category})`
          )
        }

        // 处理当前句子
        if (sentence.length <= this.maxSize) {
          chunkIndex++
          const category = this.identifyContentCategory(sentence)
          const sentenceChunk = {
            id: this.generateId(),
            text: sentence.trim(),
            type: 'complete' as const,
            confidence: 1.0,
            category
          }
          chunks.push(sentenceChunk)
          console.log(
            `   📦 独立输出语义块${chunkIndex}: "${sentenceChunk.text}" (${sentenceChunk.text.length}字符, 类型:${sentenceChunk.category})`
          )
        } else {
          // 超长句子按语义分割
          console.log(`   ⚠️  超长语义单元需要分割: ${sentence.length}字符 > ${this.maxSize}字符`)
          const subChunks = this.splitLongSentenceEnhanced(sentence)
          subChunks.forEach((subChunk) => {
            chunkIndex++
            console.log(
              `   🔪 语义子分割块${chunkIndex}: "${subChunk.text}" (${subChunk.text.length}字符, 类型:${subChunk.category})`
            )
          })
          chunks.push(...subChunks)
        }

        currentChunk = ''
      }
    }

    // 智能决策是否输出最后的块
    if (currentChunk) {
      // 使用新的智能输出决策
      if (this.shouldOutputImmediately(currentChunk, sentences)) {
        chunkIndex++
        const category = this.identifyContentCategory(currentChunk)
        const lastChunk = {
          id: this.generateId(),
          text: currentChunk.trim(),
          type: 'complete' as const,
          confidence: 0.9,
          category
        }
        chunks.push(lastChunk)
        console.log(
          `   ✅ 智能决策输出最后块${chunkIndex}: "${lastChunk.text}" (${lastChunk.text.length}字符, 类型:${lastChunk.category}, 信心度:${lastChunk.confidence})`
        )

        // 从缓冲区中移除已输出的内容
        this.buffer = this.buffer.substring(currentChunk.length)
      } else {
        console.log(
          `   ⏳ 最后块暂不输出，等待更多内容: "${currentChunk}" (${currentChunk.length}字符)`
        )
      }
    }

    console.log(`\n📊 [技术文档分块-提取结果] 本次输出${chunks.length}块`)
    chunks.forEach((chunk, idx) => {
      console.log(
        `📦 块${idx + 1} [${chunk.category}] (${chunk.text.length}字符, 信心度:${chunk.confidence}): "${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}"`
      )
    })
    console.log(`🔚 [技术文档分块-提取结束]\n`)

    return chunks
  }

  /**
   * 增强版句子提取 - 支持技术文档和Markdown格式
   */
  private extractCompleteSentencesEnhanced(): string[] {
    console.log(`🧠 [增强句子提取] 开始处理缓冲区 (${this.buffer.length}字符)`)
    console.log(
      `📄 缓冲区内容预览: "${this.buffer.substring(0, 100)}${this.buffer.length > 100 ? '...' : ''}"`
    )

    const sentences: string[] = []

    // 预处理：智能清理Markdown但保持语义完整性
    let cleanBuffer = this.buffer

    // 1. 处理标题：将 ### 标题 转换为 标题。
    cleanBuffer = cleanBuffer.replace(/#{1,6}\s+([^#\n]+)/g, '$1。')

    // 2. 处理列表项：将 - 项目 转换为 项目。
    cleanBuffer = cleanBuffer.replace(/^\s*[-*+]\s+([^\n]+)/gm, '$1。')

    // 3. 处理加粗：移除 **文本** 的星号但保留文本
    cleanBuffer = cleanBuffer.replace(/\*\*([^*]+)\*\*/g, '$1')

    // 4. 处理链接：移除 [文本](链接) 的格式但保留文本
    cleanBuffer = cleanBuffer.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // 5. 处理代码：移除 `代码` 的反引号
    cleanBuffer = cleanBuffer.replace(/`([^`]+)`/g, '$1')

    // 6. 清理多余的空白和换行
    cleanBuffer = cleanBuffer.replace(/\s+/g, ' ').trim()

    console.log(`🧹 [清理后] 缓冲区内容: "${cleanBuffer}"`)

    // 增强的句子识别模式：支持中英文混合、技术术语、括号等
    const enhancedSentencePattern = /([^。！？.!?]*[。！？.!?]+(?:\s*["""])?(?:\s*\))?)/g

    let match
    let lastIndex = 0

    while ((match = enhancedSentencePattern.exec(cleanBuffer)) !== null) {
      const sentence = match[1].trim()
      if (sentence && sentence.length > 1) {
        sentences.push(sentence)
        console.log(`    📝 提取句子${sentences.length}: "${sentence}" (${sentence.length}字符)`)
        lastIndex = match.index + match[0].length
      }
    }

    // 更新缓冲区：移除已提取的句子
    if (lastIndex > 0) {
      // 找到原始缓冲区中对应的位置
      const originalPosition = this.findOriginalPosition(lastIndex)
      this.buffer = this.buffer.substring(originalPosition)
      console.log(`🔄 [缓冲区更新] 移除${originalPosition}字符，剩余${this.buffer.length}字符`)
    }

    console.log(`✅ [增强句子提取] 完成，提取${sentences.length}个语义单元`)
    return sentences
  }

  /**
   * 查找原始位置（简化版）
   */
  private findOriginalPosition(cleanedIndex: number): number {
    // 简化实现：按比例估算
    const ratio = cleanedIndex / Math.max(this.buffer.length, 1)
    return Math.min(Math.floor(this.buffer.length * ratio), this.buffer.length)
  }

  /**
   * 强制处理缓冲区
   */
  private forceProcessBuffer(buffer: string = this.buffer): ChunkResult[] {
    console.log(`🚨 [强制处理] 开始处理过大缓冲区 (${buffer.length}字符)`)

    const chunks: ChunkResult[] = []

    // 按最大块大小强制分割
    let remainingText = buffer
    let chunkCount = 0

    while (remainingText.length > this.maxSize) {
      // 寻找合适的分割点
      const splitPoint = this.findOptimalSplitPoint(remainingText)

      if (splitPoint > this.minSize) {
        const chunkText = remainingText.substring(0, splitPoint).trim()
        if (chunkText.length > 0) {
          chunkCount++
          const category = this.identifyContentCategory(chunkText)
          chunks.push({
            id: this.generateId(),
            text: chunkText,
            type: 'partial',
            confidence: 0.7,
            category
          })
          console.log(
            `   🔪 强制分割块${chunkCount}: "${chunkText.substring(0, 50)}..." (${chunkText.length}字符)`
          )
        }
        remainingText = remainingText.substring(splitPoint)
      } else {
        // 无法找到合适分割点，强制按maxSize分割
        const chunkText = remainingText.substring(0, this.maxSize).trim()
        if (chunkText.length > 0) {
          chunkCount++
          const category = this.identifyContentCategory(chunkText)
          chunks.push({
            id: this.generateId(),
            text: chunkText,
            type: 'partial',
            confidence: 0.5,
            category
          })
          console.log(
            `   ⚡ 硬分割块${chunkCount}: "${chunkText.substring(0, 50)}..." (${chunkText.length}字符)`
          )
        }
        remainingText = remainingText.substring(this.maxSize)
      }
    }

    // 处理剩余部分
    if (remainingText.trim().length > 0) {
      chunkCount++
      const category = this.identifyContentCategory(remainingText)
      chunks.push({
        id: this.generateId(),
        text: remainingText.trim(),
        type: 'partial',
        confidence: 0.8,
        category
      })
      console.log(
        `   🏁 剩余块${chunkCount}: "${remainingText.trim().substring(0, 50)}..." (${remainingText.trim().length}字符)`
      )
    }

    console.log(`✅ [强制处理] 完成，输出${chunks.length}个块`)
    return chunks
  }

  /**
   * 识别结构化内容
   */
  private identifyStructuredContent(): ChunkResult[] {
    const chunks: ChunkResult[] = []

    // 检测列表项
    const listItemPattern = /^(\s*[0-9]+\.\s+[^。！？.!?]*[。！？.!?]*)/gm
    let match

    while ((match = listItemPattern.exec(this.buffer)) !== null) {
      const listItem = match[1].trim()
      if (listItem.length >= 10) {
        chunks.push({
          id: this.generateId(),
          text: listItem,
          type: 'structured',
          confidence: 1.0,
          category: 'list'
        })

        // 从缓冲区移除已处理的内容
        this.buffer = this.buffer.replace(match[0], '')
      }
    }

    return chunks
  }

  /**
   * 检查语义关联性
   */
  private checkSemanticRelation(
    current: string,
    next: string
  ): 'independent' | 'related' | 'complete' {
    if (!current) return 'independent'

    // 检查是否是定义和解释的关系
    if (current.includes('：') && !next.includes('：')) {
      return 'related'
    }

    // 检查是否是列表项
    if (/^\s*[0-9]+\.\s+/.test(next)) {
      return 'independent'
    }

    // 检查是否是完整的概念描述
    if (current.includes('是') && next.includes('包括')) {
      return 'related'
    }

    // 默认认为相关
    return 'complete'
  }

  /**
   * 识别内容类别
   */
  private identifyContentCategory(
    text: string
  ): 'sentence' | 'list' | 'title' | 'definition' | 'mixed' {
    if (/^\s*[0-9]+\.\s+/.test(text)) return 'list'
    if (/^[#]+\s+/.test(text)) return 'title'
    if (text.includes('：') || text.includes('是')) return 'definition'
    if (/[a-zA-Z]/.test(text) && /[\u4e00-\u9fa5]/.test(text)) return 'mixed'
    return 'sentence'
  }

  /**
   * 增强版长句分割
   */
  private splitLongSentenceEnhanced(sentence: string): ChunkResult[] {
    const chunks: ChunkResult[] = []

    // 在语义分割点分割：逗号、分号、冒号、括号
    const semanticSplitPattern = /([^，；：,;:()（）]*[，；：,;:()（）]\s*)/g

    let currentChunk = ''
    let lastIndex = 0
    let match

    while ((match = semanticSplitPattern.exec(sentence)) !== null) {
      const segment = match[1]
      const potentialLength = currentChunk.length + segment.length

      if (potentialLength <= this.maxSize) {
        currentChunk += segment
      } else {
        if (currentChunk) {
          const category = this.identifyContentCategory(currentChunk)
          chunks.push({
            id: this.generateId(),
            text: currentChunk.trim(),
            type: 'complete',
            confidence: 0.9,
            category
          })
        }
        currentChunk = segment
      }
      lastIndex = match.index + match[1].length
    }

    // 处理剩余部分
    const remaining = sentence.substring(lastIndex)
    if (remaining.trim()) {
      if (currentChunk) {
        const finalChunk = currentChunk + remaining
        if (finalChunk.length <= this.maxSize) {
          const category = this.identifyContentCategory(finalChunk)
          chunks.push({
            id: this.generateId(),
            text: finalChunk.trim(),
            type: 'complete',
            confidence: 0.9,
            category
          })
        } else {
          const category1 = this.identifyContentCategory(currentChunk)
          chunks.push({
            id: this.generateId(),
            text: currentChunk.trim(),
            type: 'complete',
            confidence: 0.9,
            category: category1
          })
          const category2 = this.identifyContentCategory(remaining)
          chunks.push({
            id: this.generateId(),
            text: remaining.trim(),
            type: 'complete',
            confidence: 0.9,
            category: category2
          })
        }
      } else {
        const category = this.identifyContentCategory(remaining)
        chunks.push({
          id: this.generateId(),
          text: remaining.trim(),
          type: 'complete',
          confidence: 0.9,
          category
        })
      }
    } else if (currentChunk) {
      const category = this.identifyContentCategory(currentChunk)
      chunks.push({
        id: this.generateId(),
        text: currentChunk.trim(),
        type: 'complete',
        confidence: 0.9,
        category
      })
    }

    return chunks.filter((chunk) => chunk.text.length > 0)
  }

  private generateId(): string {
    return `chunk_${Date.now()}_${this.position++}_${Math.random().toString(36).substr(2, 6)}`
  }

  /**
   * 获取状态信息
   */
  getStatus() {
    return {
      bufferLength: this.buffer.length,
      bufferPreview: this.buffer.substring(0, 50) + (this.buffer.length > 50 ? '...' : ''),
      position: this.position
    }
  }

  reset() {
    this.buffer = ''
    this.position = 0
  }

  /**
   * 智能输出决策 - 降低阈值，提高响应性
   */
  private shouldOutputImmediately(currentChunk: string, sentences: string[]): boolean {
    const chunkLength = currentChunk.length

    // 1. 达到最小阈值立即输出
    if (chunkLength >= this.minSize) {
      console.log(`✅ [输出决策] 达到最小阈值(${this.minSize})，立即输出`)
      return true
    }

    // 2. 包含完整句子且长度合理
    if (sentences.length > 0 && chunkLength >= 8) {
      console.log(`✅ [输出决策] 包含完整句子且长度合理(${chunkLength}>=8)，立即输出`)
      return true
    }

    // 3. 以句号结尾的短句
    if (/[。！？.!?]$/.test(currentChunk) && chunkLength >= 5) {
      console.log(`✅ [输出决策] 句号结尾的短句(${chunkLength}>=5)，立即输出`)
      return true
    }

    // 4. 缓冲区过大时强制输出
    if (this.buffer.length > this.maxSize * 1.5) {
      console.log(`⚠️ [输出决策] 缓冲区过大(${this.buffer.length}>${this.maxSize * 1.5})，强制输出`)
      return true
    }

    console.log(`⏳ [输出决策] 等待更多内容 (当前${chunkLength}字符)`)
    return false
  }
}
