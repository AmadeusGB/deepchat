import { MCPToolDefinition, IConfigPresenter } from '@shared/presenter'

// 工具类别枚举
enum ToolCategory {
  BROWSER = 'browser',
  DEVICE = 'device',
  GENERAL = 'general'
}

// 选择结果接口
interface SelectionResult {
  selectedTool: string
  confidence: number
  reason: string
  alternatives: string[]
}

// 工具使用历史接口
interface ToolUsageHistory {
  toolName: string
  successCount: number
  failureCount: number
  lastUsed: Date
}

export class SmartToolSelector {
  private configPresenter: IConfigPresenter
  private usageHistory: Map<string, ToolUsageHistory> = new Map()

  // 关键词匹配规则 - 优化版
  private readonly BROWSER_KEYWORDS = [
    '浏览器',
    'browser',
    '网页',
    'webpage',
    '访问网站',
    'visit',
    '点击',
    'click',
    'playwright',
    '截图',
    'screenshot',
    '导航',
    'navigate',
    '页面',
    'page',
    '元素',
    'element',
    '输入文本',
    'type',
    '选择选项',
    'select',
    '上传文件',
    'upload',
    '等待',
    'wait',
    '悬停',
    'hover',
    '拖拽',
    'drag',
    '键盘',
    'key',
    '网络请求',
    'network',
    '控制台',
    'console',
    '标签页',
    'tab',
    '窗口',
    'window',
    'mcp_playwright',
    'browser_',
    '打开网址',
    'open url',
    '网站登录',
    'web login',
    '表单填写',
    'fill form',
    '页面操作',
    'page action',
    '浏览器操作',
    'browser action',
    '登录',
    'login',
    '访问',
    'access',
    '网页登录',
    'web access',
    '打开',
    'open',
    '网站访问',
    'site visit',
    '页面访问',
    'page visit',
    '浏览',
    'browse',
    '上网',
    'surf web'
  ]

  private readonly DEVICE_KEYWORDS = [
    'deeper设备',
    'deeper device',
    'dpn隧道',
    'dpn tunnel',
    'dpn路由',
    'dpn routing',
    '家长控制',
    'parental control',
    '广告拦截',
    'ads filter',
    '内容过滤',
    'content filter',
    '应用重定向',
    'app relocator',
    'ssl bypass',
    'https过滤',
    'https filter',
    'dns过滤',
    '恶意软件拦截',
    'malware block',
    '追踪拦截',
    'tracker block',
    '设备重启',
    'device reboot',
    '设备配置',
    'device config',
    '设备地址',
    'device url',
    '设备连接',
    'device connect',
    'dpn模式',
    'dpn mode',
    '智能路由',
    'smart routing',
    '完全路由',
    'full routing',
    '直接路由',
    'direct routing',
    'loginToDeeperDevice',
    'setDpnMode',
    'getDpnMode',
    'listTunnels',
    'addTunnel',
    'setParentalControl',
    'setAdsFilter',
    'setSslBypass',
    'rebootDevice',
    'setBaseUrl',
    'listApps',
    'setAppTunnelCode',
    'deeper api',
    'deeper 接口'
  ]

  // 高优先级浏览器操作关键词
  private readonly HIGH_PRIORITY_BROWSER_KEYWORDS = [
    'mcp_playwright',
    'playwright',
    'browser_',
    '浏览器操作',
    'browser action',
    '网页操作',
    'web operation',
    '页面操作',
    'page operation'
  ]

  // 高优先级设备操作关键词
  private readonly HIGH_PRIORITY_DEVICE_KEYWORDS = [
    'deeper设备',
    'deeper device',
    'dpn模式',
    'dpn mode',
    'loginToDeeperDevice',
    'setDpnMode',
    'getDpnMode',
    'listTunnels',
    'addTunnel',
    'setParentalControl',
    'setAdsFilter',
    'setSslBypass',
    'rebootDevice',
    'deeper api',
    'deeper 接口',
    '设备api',
    'device api'
  ]

  constructor(configPresenter: IConfigPresenter) {
    this.configPresenter = configPresenter
  }

  /**
   * 分析工具调用的意图 - 优化版
   */
  private analyzeIntent(toolName: string, description: string): ToolCategory {
    const text = `${toolName} ${description}`.toLowerCase()

    // 首先检查高优先级关键词
    const highPriorityBrowserScore = this.HIGH_PRIORITY_BROWSER_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length

    const highPriorityDeviceScore = this.HIGH_PRIORITY_DEVICE_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length

    // 如果有高优先级匹配，直接返回
    if (highPriorityBrowserScore > 0 && highPriorityBrowserScore >= highPriorityDeviceScore) {
      return ToolCategory.BROWSER
    }
    if (highPriorityDeviceScore > 0 && highPriorityDeviceScore > highPriorityBrowserScore) {
      return ToolCategory.DEVICE
    }

    // 计算普通关键词匹配分数
    const browserScore = this.BROWSER_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length

    const deviceScore = this.DEVICE_KEYWORDS.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ).length

    // 根据分数确定类别，增加权重差异要求
    const scoreDiff = Math.abs(browserScore - deviceScore)
    const minDiff = 2 // 至少需要2个关键词的差异才能确定类别

    if (browserScore > deviceScore && scoreDiff >= minDiff) {
      return ToolCategory.BROWSER
    } else if (deviceScore > browserScore && scoreDiff >= minDiff) {
      return ToolCategory.DEVICE
    } else {
      return ToolCategory.GENERAL
    }
  }

  /**
   * 计算两个字符串的相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.getEditDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * 计算编辑距离
   */
  private getEditDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 根据使用历史计算工具评分
   */
  private getUsageScore(toolName: string): number {
    const history = this.usageHistory.get(toolName)
    if (!history) return 0

    const totalUsage = history.successCount + history.failureCount
    if (totalUsage === 0) return 0

    const successRate = history.successCount / totalUsage
    const recencyScore = this.getRecencyScore(history.lastUsed)

    return successRate * 0.7 + recencyScore * 0.3
  }

  /**
   * 根据最后使用时间计算新近性评分
   */
  private getRecencyScore(lastUsed: Date): number {
    const now = new Date()
    const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)

    // 24小时内使用过的工具得分较高
    if (hoursSinceLastUse < 24) return 1.0
    if (hoursSinceLastUse < 72) return 0.7
    if (hoursSinceLastUse < 168) return 0.4
    return 0.1
  }

  /**
   * 查找最佳工具匹配
   */
  public async findBestTool(
    requestedTool: string,
    availableTools: MCPToolDefinition[]
  ): Promise<SelectionResult> {
    // 1. 精确匹配检查
    const exactMatch = availableTools.find((tool) => tool.function.name === requestedTool)

    if (exactMatch) {
      return {
        selectedTool: requestedTool,
        confidence: 1.0,
        reason: '精确匹配',
        alternatives: []
      }
    }

    // 2. 语义匹配分析
    const candidates = availableTools.map((tool) => {
      const nameSimilarity = this.calculateSimilarity(
        requestedTool.toLowerCase(),
        tool.function.name.toLowerCase()
      )

      const descriptionSimilarity = this.calculateSimilarity(
        requestedTool.toLowerCase(),
        tool.function.description.toLowerCase()
      )

      // 意图分析 - 增强版
      const requestedIntent = this.analyzeIntent(requestedTool, '')
      const toolIntent = this.analyzeIntent(tool.function.name, tool.function.description)

      // 特殊处理：明确的工具类型识别
      let intentMatch = 0
      if (requestedIntent === toolIntent) {
        // 基础匹配分数
        intentMatch = 0.15

        // 如果是明确的工具类型匹配，给予额外加分
        if (requestedIntent === ToolCategory.BROWSER && tool.function.name.includes('playwright')) {
          intentMatch += 0.1 // 浏览器工具额外加分
        }
        if (requestedIntent === ToolCategory.DEVICE && tool.function.name.includes('Deeper')) {
          intentMatch += 0.1 // 设备工具额外加分
        }
      }

      // 反向惩罚：如果用户明确要求浏览器操作但工具是设备工具，给予惩罚
      if (requestedIntent === ToolCategory.BROWSER && toolIntent === ToolCategory.DEVICE) {
        intentMatch = -0.2
      }
      if (requestedIntent === ToolCategory.DEVICE && toolIntent === ToolCategory.BROWSER) {
        intentMatch = -0.2
      }

      // 使用历史评分
      const usageScore = this.getUsageScore(tool.function.name)

      // 综合评分 - 优化权重
      const totalScore =
        nameSimilarity * 0.5 + // 名称相似度权重提高到50%
        descriptionSimilarity * 0.25 + // 描述相似度权重提高到25%
        intentMatch * 0.15 + // 意图匹配权重降低到15%
        usageScore * 0.1 // 使用历史保持10%

      return {
        tool: tool.function.name,
        score: totalScore,
        nameSimilarity,
        descriptionSimilarity,
        intentMatch,
        usageScore,
        requestedIntent,
        toolIntent
      }
    })

    // 3. 排序并选择最佳匹配
    candidates.sort((a, b) => b.score - a.score)

    const bestMatch = candidates[0]
    const alternatives = candidates
      .slice(1, 4)
      .filter((c) => c.score > 0.3)
      .map((c) => c.tool)

    // 4. 生成选择原因 - 详细版
    let reason = ''
    const debugInfo = `(名称:${(bestMatch.nameSimilarity * 100).toFixed(1)}% 描述:${(bestMatch.descriptionSimilarity * 100).toFixed(1)}% 意图:${bestMatch.requestedIntent}→${bestMatch.toolIntent} 历史:${(bestMatch.usageScore * 100).toFixed(1)}%)`

    if (bestMatch.nameSimilarity > 0.8) {
      reason = `名称高度相似 ${debugInfo}`
    } else if (bestMatch.intentMatch > 0.1) {
      reason = `功能类别匹配 ${debugInfo}`
    } else if (bestMatch.intentMatch < 0) {
      reason = `类别不匹配惩罚 ${debugInfo}`
    } else if (bestMatch.usageScore > 0.5) {
      reason = `基于使用历史推荐 ${debugInfo}`
    } else {
      reason = `语义相似度匹配 ${debugInfo}`
    }

    // 添加调试日志
    console.log(`[SmartToolSelector] 请求工具: "${requestedTool}"`)
    console.log(
      `[SmartToolSelector] 最佳匹配: "${bestMatch.tool}" (评分: ${bestMatch.score.toFixed(3)})`
    )
    console.log(`[SmartToolSelector] 详细评分: ${debugInfo}`)
    if (alternatives.length > 0) {
      console.log(`[SmartToolSelector] 替代方案: ${alternatives.join(', ')}`)
    }

    return {
      selectedTool: bestMatch.tool,
      confidence: bestMatch.score,
      reason,
      alternatives
    }
  }

  /**
   * 获取工具的替代方案
   */
  public getAlternativeTools(toolName: string, availableTools: MCPToolDefinition[]): string[] {
    const tool = availableTools.find((t) => t.function.name === toolName)
    if (!tool) return []

    const toolIntent = this.analyzeIntent(tool.function.name, tool.function.description)

    return availableTools
      .filter((t) => t.function.name !== toolName)
      .filter((t) => {
        const intent = this.analyzeIntent(t.function.name, t.function.description)
        return intent === toolIntent
      })
      .map((t) => t.function.name)
      .slice(0, 3)
  }

  /**
   * 更新工具使用历史
   */
  public updateUsageHistory(toolName: string, success: boolean): void {
    const history = this.usageHistory.get(toolName) || {
      toolName,
      successCount: 0,
      failureCount: 0,
      lastUsed: new Date()
    }

    if (success) {
      history.successCount++
    } else {
      history.failureCount++
    }

    history.lastUsed = new Date()
    this.usageHistory.set(toolName, history)
  }

  /**
   * 检查是否启用智能选择
   */
  public async isSmartSelectionEnabled(): Promise<boolean> {
    try {
      // 这里可以添加配置检查逻辑
      // 目前默认启用
      return true
    } catch (error) {
      console.error('Failed to check smart selection config:', error)
      return false
    }
  }
}
