import {
  IMCPPresenter,
  MCPServerConfig,
  MCPToolDefinition,
  MCPToolCall,
  McpClient,
  MCPToolResponse,
  Prompt,
  ResourceListEntry,
  Resource,
  PromptListEntry
} from '@shared/presenter'
import { ServerManager } from './serverManager'
import { ToolManager } from './toolManager'
import { MCPHealthChecker } from './healthChecker'
import { MCPUsageTracker } from './usageTracker'
import { eventBus, SendTarget } from '@/eventbus'
import { MCP_EVENTS, NOTIFICATION_EVENTS } from '@/events'
import { IConfigPresenter } from '@shared/presenter'
import { getErrorMessageLabels } from '@shared/i18n'
import { OpenAI } from 'openai'
import { ToolListUnion } from '@google/genai'
import { CONFIG_EVENTS } from '@/events'
import { presenter } from '@/presenter'
import {
  LLMFormatConverter,
  OpenAIToolCall,
  AnthropicToolUse,
  GeminiFunctionCall,
  OpenAITool,
  AnthropicTool
} from './llmFormatConverter'

// 工具类型接口现在从 LLMFormatConverter 导入

// 完整版的 McpPresenter 实现
export class McpPresenter implements IMCPPresenter {
  private serverManager: ServerManager
  private toolManager: ToolManager
  private healthChecker: MCPHealthChecker
  private usageTracker: MCPUsageTracker
  private configPresenter: IConfigPresenter
  private isInitialized: boolean = false

  constructor(configPresenter?: IConfigPresenter) {
    console.log('Initializing MCP Presenter')

    this.configPresenter = configPresenter || presenter.configPresenter
    this.serverManager = new ServerManager(this.configPresenter)
    this.toolManager = new ToolManager(this.configPresenter, this.serverManager)
    this.healthChecker = new MCPHealthChecker({
      interval: 30000, // 30秒检查一次
      timeout: 5000, // 5秒超时
      retryAttempts: 3,
      enabled: true
    })
    this.usageTracker = new MCPUsageTracker()

    // 监听自定义提示词服务器检查事件
    eventBus.on(CONFIG_EVENTS.CUSTOM_PROMPTS_SERVER_CHECK_REQUIRED, async () => {
      await this.checkAndManageCustomPromptsServer()
    })

    // 监听健康检查事件
    this.healthChecker.on(MCP_EVENTS.SERVER_HEALTH_CHECK, (result) => {
      console.log(`Health check result for ${result.serverId}:`, result)
      // 转发健康检查结果到渲染进程
      eventBus.send(MCP_EVENTS.SERVER_HEALTH_CHECK, SendTarget.ALL_WINDOWS, result)
    })

    this.healthChecker.on(MCP_EVENTS.SERVER_STATUS_CHANGED, (statusChange) => {
      console.log(`Server status changed for ${statusChange.serverId}:`, statusChange)
      // 转发状态变化到渲染进程
      eventBus.send(MCP_EVENTS.SERVER_STATUS_CHANGED, SendTarget.ALL_WINDOWS, statusChange)

      // 如果服务器变为不健康状态，可以发送通知
      if (!statusChange.isHealthy) {
        eventBus.send(NOTIFICATION_EVENTS.SHOW_ERROR, SendTarget.ALL_WINDOWS, {
          title: 'MCP服务器状态异常',
          message: `服务器 ${statusChange.serverId} 状态变为 ${statusChange.status}`,
          duration: 5000
        })
      }
    })

    // 监听使用统计事件
    this.usageTracker.on(MCP_EVENTS.USAGE_STATS_UPDATED, (analytics) => {
      console.log('Usage analytics updated:', analytics)
      // 转发使用统计更新到渲染进程
      eventBus.send(MCP_EVENTS.USAGE_STATS_UPDATED, SendTarget.ALL_WINDOWS, analytics)
    })

    // 延迟初始化，确保其他组件已经准备好
    setTimeout(() => {
      this.initialize()
    }, 1000)
  }

  private async initialize() {
    try {
      // 如果没有提供configPresenter，从presenter中获取
      if (!this.configPresenter.getLanguage) {
        // 重新创建管理器
        this.serverManager = new ServerManager(this.configPresenter)
        this.toolManager = new ToolManager(this.configPresenter, this.serverManager)
      }

      // 加载配置
      const [servers, defaultServers] = await Promise.all([
        this.configPresenter.getMcpServers(),
        this.configPresenter.getMcpDefaultServers()
      ])

      // 先测试npm registry速度
      console.log('[MCP] Testing npm registry speed...')
      try {
        await this.serverManager.testNpmRegistrySpeed()
        console.log(
          `[MCP] npm registry speed test completed, selected best registry: ${this.serverManager.getNpmRegistry()}`
        )
      } catch (error) {
        console.error('[MCP] npm registry speed test failed:', error)
      }

      // 检查并启动 deepchat-inmemory/custom-prompts-server
      const customPromptsServerName = 'deepchat-inmemory/custom-prompts-server'
      if (servers[customPromptsServerName]) {
        console.log(`[MCP] Attempting to start custom prompts server: ${customPromptsServerName}`)

        try {
          await this.serverManager.startServer(customPromptsServerName)
          console.log(`[MCP] Custom prompts server ${customPromptsServerName} started successfully`)

          // 通知渲染进程服务器已启动
          eventBus.send(MCP_EVENTS.SERVER_STARTED, SendTarget.ALL_WINDOWS, customPromptsServerName)
        } catch (error) {
          console.error(
            `[MCP] Failed to start custom prompts server ${customPromptsServerName}:`,
            error
          )
        }
      }

      // 如果有默认服务器，尝试启动
      if (defaultServers.length > 0) {
        for (const serverName of defaultServers) {
          if (servers[serverName]) {
            console.log(`[MCP] Attempting to start default server: ${serverName}`)

            try {
              await this.serverManager.startServer(serverName)
              console.log(`[MCP] Default server ${serverName} started successfully`)

              // 通知渲染进程服务器已启动
              eventBus.send(MCP_EVENTS.SERVER_STARTED, SendTarget.ALL_WINDOWS, serverName)
            } catch (error) {
              console.error(`[MCP] Failed to start default server ${serverName}:`, error)
            }
          }
        }
      }

      // 标记初始化完成并发出事件
      this.isInitialized = true
      console.log('[MCP] Initialization completed')
      eventBus.send(MCP_EVENTS.INITIALIZED, SendTarget.ALL_WINDOWS)

      // 检查并管理自定义提示词服务器
      await this.checkAndManageCustomPromptsServer()
    } catch (error) {
      console.error('[MCP] Initialization failed:', error)
      // 即使初始化失败也标记为已完成，避免系统卡在未初始化状态
      this.isInitialized = true
      eventBus.send(MCP_EVENTS.INITIALIZED, SendTarget.ALL_WINDOWS)
    }
  }

  // 添加获取初始化状态的方法
  isReady(): boolean {
    return this.isInitialized
  }

  // 检查并管理自定义提示词服务器
  private async checkAndManageCustomPromptsServer(): Promise<void> {
    const customPromptsServerName = 'deepchat-inmemory/custom-prompts-server'

    try {
      // 获取当前自定义提示词
      const customPrompts = await this.configPresenter.getCustomPrompts()
      const hasCustomPrompts = customPrompts && customPrompts.length > 0

      // 检查服务器是否正在运行
      const isServerRunning = this.serverManager.isServerRunning(customPromptsServerName)

      let statusChanged = false

      if (hasCustomPrompts && !isServerRunning) {
        // 有自定义提示词但服务器未运行，启动服务器
        try {
          await this.serverManager.startServer(customPromptsServerName)
          eventBus.send(MCP_EVENTS.SERVER_STARTED, SendTarget.ALL_WINDOWS, customPromptsServerName)
          statusChanged = true
        } catch (error) {
          console.error(`Failed to start custom prompts server ${customPromptsServerName}:`, error)
        }
      } else if (!hasCustomPrompts && isServerRunning) {
        // 没有自定义提示词但服务器正在运行，停止服务器
        try {
          await this.serverManager.stopServer(customPromptsServerName)
          eventBus.send(MCP_EVENTS.SERVER_STOPPED, SendTarget.ALL_WINDOWS, customPromptsServerName)
          statusChanged = true
        } catch (error) {
          console.error(`Failed to stop custom prompts server ${customPromptsServerName}:`, error)
        }
      } else if (hasCustomPrompts && isServerRunning) {
        // 有自定义提示词且服务器正在运行，重启服务器以刷新缓存
        try {
          await this.serverManager.stopServer(customPromptsServerName)
          await this.serverManager.startServer(customPromptsServerName)
          eventBus.send(MCP_EVENTS.SERVER_STARTED, SendTarget.ALL_WINDOWS, customPromptsServerName)
          statusChanged = true
        } catch (error) {
          console.error(
            `Failed to restart custom prompts server ${customPromptsServerName}:`,
            error
          )
        }
      }

      // 只有状态实际改变时才通知客户端列表已更新
      if (statusChanged) {
        eventBus.send(MCP_EVENTS.CLIENT_LIST_UPDATED, SendTarget.ALL_WINDOWS)
      }
    } catch (error) {
      console.error('Failed to manage custom prompts server:', error)
    }
  }

  // 获取MCP服务器配置
  getMcpServers(): Promise<Record<string, MCPServerConfig>> {
    return this.configPresenter.getMcpServers()
  }

  // 获取所有MCP服务器
  async getMcpClients(): Promise<McpClient[]> {
    const clients = await this.toolManager.getRunningClients()
    const clientsList: McpClient[] = []
    for (const client of clients) {
      const results: MCPToolDefinition[] = []
      const tools = await client.listTools()
      for (const tool of tools) {
        const properties = tool.inputSchema.properties || {}
        const toolProperties = { ...properties }
        for (const key in toolProperties) {
          if (!toolProperties[key].description) {
            toolProperties[key].description = 'Params of ' + key
          }
        }
        results.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: toolProperties,
              required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
            }
          },
          server: {
            name: client.serverName,
            icons: client.serverConfig['icons'] as string,
            description: client.serverConfig['description'] as string
          }
        })
      }

      // 创建客户端基本信息对象
      const clientObj: McpClient = {
        name: client.serverName,
        icon: client.serverConfig['icons'] as string,
        isRunning: client.isServerRunning(),
        tools: results
      }

      // 检查并添加 prompts（如果支持）
      if (typeof client.listPrompts === 'function') {
        try {
          const prompts = await client.listPrompts()
          if (prompts && prompts.length > 0) {
            clientObj.prompts = prompts.map((prompt) => ({
              id: prompt.name,
              name: prompt.name,
              content: prompt.description || '',
              description: prompt.description || '',
              arguments: prompt.arguments || [],
              client: {
                name: client.serverName,
                icon: client.serverConfig['icons'] as string
              }
            }))
          }
        } catch (error) {
          console.error(
            `[MCP] Failed to get prompt templates for client ${client.serverName}:`,
            error
          )
        }
      }

      // 检查并添加 resources（如果支持）
      if (typeof client.listResources === 'function') {
        try {
          const resources = await client.listResources()
          if (resources && resources.length > 0) {
            clientObj.resources = resources
          }
        } catch (error) {
          console.error(`[MCP] Failed to get resources for client ${client.serverName}:`, error)
        }
      }

      clientsList.push(clientObj)
    }
    return clientsList
  }

  // 获取所有默认MCP服务器
  getMcpDefaultServers(): Promise<string[]> {
    return this.configPresenter.getMcpDefaultServers()
  }

  // 添加默认MCP服务器
  async addMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.addMcpDefaultServer(serverName)
  }

  // 移除默认MCP服务器
  async removeMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.removeMcpDefaultServer(serverName)
  }

  // 切换服务器的默认状态
  async toggleMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.toggleMcpDefaultServer(serverName)
  }

  // 添加MCP服务器
  async addMcpServer(serverName: string, config: MCPServerConfig): Promise<boolean> {
    const existingServers = await this.getMcpServers()
    if (existingServers[serverName]) {
      console.error(`[MCP] Failed to add server: Server name "${serverName}" already exists.`)
      // 获取当前语言并发送通知
      const locale = this.configPresenter.getLanguage?.() || 'zh-CN'
      const errorMessages = getErrorMessageLabels(locale)
      eventBus.sendToRenderer(NOTIFICATION_EVENTS.SHOW_ERROR, SendTarget.ALL_WINDOWS, {
        title: errorMessages.addMcpServerErrorTitle || '添加服务器失败',
        message:
          errorMessages.addMcpServerDuplicateMessage?.replace('{serverName}', serverName) ||
          `服务器名称 "${serverName}" 已存在。请选择一个不同的名称。`,
        id: `mcp-error-add-server-${serverName}-${Date.now()}`,
        type: 'error'
      })
      return false
    }
    await this.configPresenter.addMcpServer(serverName, config)
    return true
  }

  // 更新MCP服务器配置
  async updateMcpServer(serverName: string, config: Partial<MCPServerConfig>): Promise<void> {
    const wasRunning = this.serverManager.isServerRunning(serverName)
    await this.configPresenter.updateMcpServer(serverName, config)

    // 如果服务器之前正在运行，则重启它以应用新配置
    if (wasRunning) {
      console.log(`[MCP] Configuration updated, restarting server: ${serverName}`)
      try {
        await this.stopServer(serverName) // stopServer 会发出 SERVER_STOPPED 事件
        await this.startServer(serverName) // startServer 会发出 SERVER_STARTED 事件
        console.log(`[MCP] Server ${serverName} restarted successfully`)
      } catch (error) {
        console.error(`[MCP] Failed to restart server ${serverName}:`, error)
        // 即使重启失败，也要确保状态正确，标记为未运行
        eventBus.emit(MCP_EVENTS.SERVER_STOPPED, serverName)
      }
    }
  }

  // 移除MCP服务器
  async removeMcpServer(serverName: string): Promise<void> {
    // 如果服务器正在运行，先停止
    if (await this.isServerRunning(serverName)) {
      await this.stopServer(serverName)
    }
    await this.configPresenter.removeMcpServer(serverName)
  }

  async isServerRunning(serverName: string): Promise<boolean> {
    return Promise.resolve(this.serverManager.isServerRunning(serverName))
  }

  async startServer(serverName: string): Promise<void> {
    await this.serverManager.startServer(serverName)

    // 注册到健康检查器
    const client = this.serverManager.getClient(serverName)
    if (client) {
      this.healthChecker.registerClient(serverName, client)
    }

    // 通知渲染进程服务器已启动
    eventBus.send(MCP_EVENTS.SERVER_STARTED, SendTarget.ALL_WINDOWS, serverName)
  }

  async stopServer(serverName: string): Promise<void> {
    // 从健康检查器中注销
    this.healthChecker.unregisterClient(serverName)

    await this.serverManager.stopServer(serverName)
    // 通知渲染进程服务器已停止
    eventBus.send(MCP_EVENTS.SERVER_STOPPED, SendTarget.ALL_WINDOWS, serverName)
  }

  async getAllToolDefinitions(): Promise<MCPToolDefinition[]> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (enabled) {
      return this.toolManager.getAllToolDefinitions()
    }
    return []
  }

  /**
   * 获取所有客户端的提示模板，并附加客户端信息
   * @returns 所有提示模板列表，每个提示模板附带所属客户端信息
   */
  async getAllPrompts(): Promise<Array<PromptListEntry>> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      return []
    }

    const clients = await this.toolManager.getRunningClients()
    const promptsList: Array<Prompt & { client: { name: string; icon: string } }> = []

    for (const client of clients) {
      if (typeof client.listPrompts === 'function') {
        try {
          const prompts = await client.listPrompts()
          if (prompts && prompts.length > 0) {
            // 为每个提示模板添加客户端信息
            const clientPrompts = prompts.map((prompt) => ({
              id: prompt.name,
              name: prompt.name,
              description: prompt.description || '',
              arguments: prompt.arguments || [],
              files: prompt.files || [], // 添加 files 字段
              client: {
                name: client.serverName,
                icon: client.serverConfig['icons'] as string
              }
            }))
            promptsList.push(...clientPrompts)
          }
        } catch (error) {
          console.error(
            `[MCP] Failed to get prompt templates for client ${client.serverName}:`,
            error
          )
        }
      }
    }

    return promptsList
  }

  /**
   * 获取所有客户端的资源列表，并附加客户端信息
   * @returns 所有资源列表，每个资源附带所属客户端信息
   */
  async getAllResources(): Promise<
    Array<ResourceListEntry & { client: { name: string; icon: string } }>
  > {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      return []
    }

    const clients = await this.toolManager.getRunningClients()
    const resourcesList: Array<ResourceListEntry & { client: { name: string; icon: string } }> = []

    for (const client of clients) {
      if (typeof client.listResources === 'function') {
        try {
          const resources = await client.listResources()
          if (resources && resources.length > 0) {
            // 为每个资源添加客户端信息
            const clientResources = resources.map((resource) => ({
              ...resource,
              client: {
                name: client.serverName,
                icon: client.serverConfig['icons'] as string
              }
            }))
            resourcesList.push(...clientResources)
          }
        } catch (error) {
          console.error(`[MCP] Failed to get resources for client ${client.serverName}:`, error)
        }
      }
    }

    return resourcesList
  }

  async callTool(request: MCPToolCall): Promise<{ content: string; rawData: MCPToolResponse }> {
    const startTime = Date.now()
    let success = false
    let error: string | undefined

    try {
      const toolCallResult = await this.toolManager.callTool(request)
      success = true

      // 包装结果为预期格式
      const wrappedResult = {
        content: typeof toolCallResult.content === 'string' ? toolCallResult.content : JSON.stringify(toolCallResult.content),
        rawData: toolCallResult
      }

      // 格式化结果
      const formattedResult = this.formatToolCallResult(wrappedResult)

      // 记录使用统计
      this.recordToolUsage(request, startTime, success, formattedResult)

      return formattedResult
    } catch (err) {
      error = err instanceof Error ? err.message : '未知错误'
      success = false

      // 记录失败的使用统计
      this.recordToolUsage(request, startTime, success, undefined, error)

      throw err
    }
  }

  /**
   * 记录工具使用统计
   */
  private recordToolUsage(
    request: MCPToolCall,
    startTime: number,
    success: boolean,
    result?: { content: string; rawData: MCPToolResponse },
    error?: string
  ): void {
    const responseTime = Date.now() - startTime
    const inputSize = JSON.stringify(request.function.arguments || '{}').length
    const outputSize = result ? JSON.stringify(result.content).length : 0

    this.usageTracker.recordToolUsage({
      toolName: request.function.name,
      serverName: request.server.name || 'unknown',
      timestamp: Date.now(),
      success,
      responseTime,
      inputSize,
      outputSize,
      error,
      sessionId: `session-${Date.now()}` // 可以从上下文获取真实的session ID
    })
  }

  /**
   * 格式化工具调用结果
   */
  private formatToolCallResult(toolCallResult: { content: string; rawData: MCPToolResponse }): { content: string; rawData: MCPToolResponse } {
    // 格式化工具调用结果为大模型易于解析的字符串
    let formattedContent = ''

    // 判断内容类型
    if (typeof toolCallResult.content === 'string') {
      // 内容已经是字符串
      formattedContent = toolCallResult.content
    } else if (Array.isArray(toolCallResult.content)) {
      // 内容是结构化数组，需要格式化
      const contentParts: string[] = []
      const contentArray = toolCallResult.content as Array<any>

      // 处理每个内容项
      for (const item of contentArray) {
        if (item.type === 'text') {
          contentParts.push(item.text)
        } else if (item.type === 'image') {
          contentParts.push(`[图片: ${item.mimeType}]`)
        } else if (item.type === 'resource') {
          if ('text' in item.resource && item.resource.text) {
            contentParts.push(`[资源: ${item.resource.uri}]\n${item.resource.text}`)
          } else if ('blob' in item.resource) {
            contentParts.push(`[二进制资源: ${item.resource.uri}]`)
          } else {
            contentParts.push(`[资源: ${item.resource.uri}]`)
          }
        } else {
          // 处理其他未知类型
          contentParts.push(JSON.stringify(item))
        }
      }

      // 合并所有内容
      formattedContent = contentParts.join('\n\n')
    }

    // 添加错误标记（如果有）
    if (toolCallResult.rawData.isError) {
      formattedContent = `错误: ${formattedContent}`
    }

    return { content: formattedContent, rawData: toolCallResult.rawData }
  }

  // 工具转换方法现在委托给 LLMFormatConverter

  // 新增工具转换方法
  /**
   * 将MCP工具定义转换为OpenAI工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns OpenAI工具格式的工具定义
   */
  async mcpToolsToOpenAITools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): Promise<OpenAITool[]> {
    return LLMFormatConverter.mcpToolsToOpenAITools(mcpTools, serverName)
  }

  /**
   * 将OpenAI工具调用转换回MCP工具调用
   * @param llmTool OpenAI工具调用
   * @param providerId 提供者ID
   * @returns 匹配的MCP工具调用
   */
  async openAIToolsToMcpTool(
    llmTool: OpenAIToolCall,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()
    return LLMFormatConverter.openAIToolsToMcpTool(llmTool, providerId, mcpTools)
  }

  /**
   * 将MCP工具定义转换为Anthropic工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns Anthropic工具格式的工具定义
   */
  async mcpToolsToAnthropicTools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): Promise<AnthropicTool[]> {
    return LLMFormatConverter.mcpToolsToAnthropicTools(mcpTools, serverName)
  }

  /**
   * 将Anthropic工具使用转换回MCP工具调用
   * @param toolUse Anthropic工具使用
   * @param providerId 提供者ID
   * @returns 匹配的MCP工具调用
   */
  async anthropicToolUseToMcpTool(
    toolUse: AnthropicToolUse,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()
    return LLMFormatConverter.anthropicToolUseToMcpTool(toolUse, providerId, mcpTools)
  }

  /**
   * 将MCP工具定义转换为Gemini工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns Gemini工具格式的工具定义
   */
  async mcpToolsToGeminiTools(
    mcpTools: MCPToolDefinition[] | undefined,
    serverName: string
  ): Promise<ToolListUnion> {
    return LLMFormatConverter.mcpToolsToGeminiTools(mcpTools, serverName)
  }

  /**
   * 将Gemini函数调用转换回MCP工具调用
   * @param fcall Gemini函数调用
   * @param providerId 提供者ID
   * @returns 匹配的MCP工具调用
   */
  async geminiFunctionCallToMcpTool(
    fcall: GeminiFunctionCall | undefined,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()
    return LLMFormatConverter.geminiFunctionCallToMcpTool(fcall, providerId, mcpTools)
  }

  // 获取MCP启用状态
  async getMcpEnabled(): Promise<boolean> {
    return this.configPresenter.getMcpEnabled()
  }

  // 设置MCP启用状态
  async setMcpEnabled(enabled: boolean): Promise<void> {
    await this.configPresenter?.setMcpEnabled(enabled)
  }

  async resetToDefaultServers(): Promise<void> {
    await this.configPresenter?.getMcpConfHelper().resetToDefaultServers()
  }

  /**
   * 获取指定提示模板
   * @param prompt 提示模板对象（包含客户端信息）
   * @param params 提示模板参数
   * @returns 提示模板内容
   */
  async getPrompt(prompt: PromptListEntry, args?: Record<string, unknown>): Promise<unknown> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      throw new Error('MCP功能已禁用')
    }

    // 传递客户端信息和提示模板名称给toolManager
    return this.toolManager.getPromptByClient(prompt.client.name, prompt.name, args)
  }

  /**
   * 读取指定资源
   * @param resource 资源对象（包含客户端信息）
   * @returns 资源内容
   */
  async readResource(resource: ResourceListEntry): Promise<Resource> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      throw new Error('MCP功能已禁用')
    }

    // 传递客户端信息和资源URI给toolManager
    return this.toolManager.readResourceByClient(resource.client.name, resource.uri)
  }

  /**
   * 将MCP工具定义转换为OpenAI Responses API工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns OpenAI Responses API工具格式的工具定义
   */
  async mcpToolsToOpenAIResponsesTools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): Promise<OpenAI.Responses.Tool[]> {
    return LLMFormatConverter.mcpToolsToOpenAIResponsesTools(mcpTools, serverName)
  }

  /**
   * 手动触发服务器健康检查
   * @param serverName 服务器名称
   * @returns 健康检查结果
   */
  async checkServerHealth(serverName: string): Promise<any> {
    try {
      const result = await this.healthChecker.checkHealth(serverName)

      // 发送健康检查结果到渲染进程
      eventBus.send(MCP_EVENTS.SERVER_HEALTH_CHECK, SendTarget.ALL_WINDOWS, {
        serverName,
        result
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '健康检查失败'
      console.error(`Health check failed for ${serverName}:`, error)

      throw new Error(`服务器 ${serverName} 健康检查失败: ${errorMessage}`)
    }
  }

  /**
   * 获取服务器健康状态
   * @param serverName 服务器名称
   * @returns 健康状态信息
   */
  async getServerHealthState(serverName: string): Promise<any> {
    const healthState = this.healthChecker.getHealthState(serverName)

    if (!healthState) {
      throw new Error(`服务器 ${serverName} 未注册到健康检查器`)
    }

    return healthState
  }

  /**
   * 获取所有服务器健康状态
   * @returns 所有服务器健康状态映射
   */
  async getAllServerHealthStates(): Promise<any> {
    const healthStates = this.healthChecker.getAllHealthStates()

    // 转换为普通对象以便序列化
    const result: Record<string, any> = {}
    for (const [serverName, state] of healthStates) {
      result[serverName] = state
    }

    return result
  }

  /**
   * 获取健康检查统计信息
   * @returns 统计信息
   */
  async getHealthCheckStats(): Promise<any> {
    return this.healthChecker.getHealthStats()
  }

  /**
   * 启用/禁用健康检查
   * @param enabled 是否启用
   */
  async setHealthCheckEnabled(enabled: boolean): Promise<void> {
    this.healthChecker.setEnabled(enabled)
    console.log(`Health check ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * 更新健康检查配置
   * @param config 新配置
   */
  async updateHealthCheckConfig(config: any): Promise<void> {
    this.healthChecker.updateConfig(config)
    console.log('Health check config updated:', config)
  }

  /**
   * 获取工具使用统计
   * @param serverName 可选的服务器名称
   * @param toolName 可选的工具名称
   * @returns 工具使用统计数组
   */
  async getToolUsageStats(serverName?: string, toolName?: string): Promise<any[]> {
    return this.usageTracker.getToolStats(serverName, toolName)
  }

  /**
   * 获取服务器使用统计
   * @param serverName 可选的服务器名称
   * @returns 服务器使用统计数组
   */
  async getServerUsageStats(serverName?: string): Promise<any[]> {
    return this.usageTracker.getServerStats(serverName)
  }

  /**
   * 获取综合使用分析数据
   * @returns 使用分析数据
   */
  async getUsageAnalytics(): Promise<any> {
    return this.usageTracker.getUsageAnalytics()
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.healthChecker?.destroy()
    this.usageTracker?.destroy()
    this.serverManager?.destroy()
    this.toolManager?.destroy?.()
  }
}
