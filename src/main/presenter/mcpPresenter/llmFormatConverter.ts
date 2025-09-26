/**
 * LLM格式转换器
 * 负责MCP工具定义与各种LLM API格式之间的转换
 * 支持OpenAI、Anthropic、Gemini等格式
 */

import { MCPToolDefinition, MCPToolCall } from '@shared/presenter'
import { OpenAI } from 'openai'
import { ToolListUnion, Type, FunctionDeclaration } from '@google/genai'

// 通用接口定义
export interface OpenAIToolCall {
  function: {
    name: string
    arguments: string
  }
}

export interface AnthropicToolUse {
  name: string
  input: Record<string, unknown>
}

export interface GeminiFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, Record<string, unknown>>
      required: string[]
    }
  }
}

export interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, Record<string, unknown>>
    required: string[]
  }
}

// MCP工具内部表示
interface MCPTool {
  id: string
  name: string
  type: string
  description: string
  serverName: string
  inputSchema: {
    properties: Record<string, Record<string, unknown>>
    required: string[]
    [key: string]: unknown
  }
}

/**
 * LLM格式转换器类
 * 提供统一的API来处理不同LLM格式的转换
 */
export class LLMFormatConverter {
  /**
   * 将MCPToolDefinition转换为内部MCPTool格式
   */
  private static mcpToolDefinitionToMcpTool(
    toolDefinition: MCPToolDefinition,
    serverName: string
  ): MCPTool {
    return {
      id: toolDefinition.function.name,
      name: toolDefinition.function.name,
      type: toolDefinition.type,
      description: toolDefinition.function.description,
      serverName,
      inputSchema: {
        properties: toolDefinition.function.parameters.properties as Record<
          string,
          Record<string, unknown>
        >,
        type: toolDefinition.function.parameters.type,
        required: toolDefinition.function.parameters.required || []
      }
    }
  }

  /**
   * 过滤工具属性，只保留支持的属性
   */
  private static filterPropertieAttributes(tool: MCPTool): Record<string, Record<string, unknown>> {
    const supportedAttributes = [
      'type',
      'nullable',
      'description',
      'properties',
      'items',
      'enum',
      'anyOf'
    ]

    const properties = tool.inputSchema.properties
    const getSubMap = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
      return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)))
    }

    const result: Record<string, Record<string, unknown>> = {}
    for (const [key, val] of Object.entries(properties)) {
      result[key] = getSubMap(val, supportedAttributes)
    }

    return result
  }

  // ==================== OpenAI 格式转换 ====================

  /**
   * 将MCP工具定义转换为OpenAI工具格式
   */
  static mcpToolsToOpenAITools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): OpenAITool[] {
    return mcpTools.map((toolDef) => {
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: this.filterPropertieAttributes(tool),
            required: (tool.inputSchema.required as string[]) || []
          }
        }
      }
    })
  }

  /**
   * 将OpenAI工具调用转换为MCP工具调用
   */
  static async openAIToolsToMcpTool(
    llmTool: OpenAIToolCall,
    providerId: string,
    allMcpTools: MCPToolDefinition[]
  ): Promise<MCPToolCall | undefined> {
    const tool = allMcpTools.find((tool) => tool.function.name === llmTool.function.name)
    if (!tool) {
      return undefined
    }

    return {
      id: `${providerId}:${tool.function.name}-${Date.now()}`,
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: llmTool.function.arguments
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }
  }

  /**
   * 将MCP工具定义转换为OpenAI Responses API工具格式
   */
  static mcpToolsToOpenAIResponsesTools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): OpenAI.Responses.Tool[] {
    return mcpTools.map((toolDef) => {
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)
      return {
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.filterPropertieAttributes(tool),
          required: (tool.inputSchema.required as string[]) || []
        },
        strict: false
      }
    })
  }

  // ==================== Anthropic 格式转换 ====================

  /**
   * 将MCP工具定义转换为Anthropic工具格式
   */
  static mcpToolsToAnthropicTools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): AnthropicTool[] {
    return mcpTools.map((toolDef) => {
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)
      return {
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.inputSchema.properties,
          required: (tool.inputSchema.required as string[]) || []
        }
      }
    })
  }

  /**
   * 将Anthropic工具使用转换为MCP工具调用
   */
  static async anthropicToolUseToMcpTool(
    toolUse: AnthropicToolUse,
    providerId: string,
    allMcpTools: MCPToolDefinition[]
  ): Promise<MCPToolCall | undefined> {
    const tool = allMcpTools.find((tool) => tool.function.name === toolUse.name)
    if (!tool) {
      return undefined
    }

    return {
      id: `${providerId}:${tool.function.name}-${Date.now()}`,
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: JSON.stringify(toolUse.input)
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }
  }

  // ==================== Gemini 格式转换 ====================

  /**
   * 递归清理Schema对象，确保符合Gemini API要求
   */
  private static cleanSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const cleanedSchema: Record<string, unknown> = {}

    // 处理type字段 - 确保始终有有效值
    if ('type' in schema) {
      const type = schema.type
      if (typeof type === 'string' && type.trim() !== '') {
        cleanedSchema.type = type
      } else if (Array.isArray(type) && type.length > 0) {
        // 如果是类型数组，取第一个非空类型
        const validType = type.find((t) => typeof t === 'string' && t.trim() !== '')
        if (validType) {
          cleanedSchema.type = validType
        } else {
          cleanedSchema.type = 'string' // 默认类型
        }
      } else {
        // 如果没有有效的type，根据其他属性推断
        if ('enum' in schema) {
          cleanedSchema.type = 'string'
        } else if ('properties' in schema) {
          cleanedSchema.type = 'object'
        } else if ('items' in schema) {
          cleanedSchema.type = 'array'
        } else {
          cleanedSchema.type = 'string' // 默认类型
        }
      }
    } else {
      // 如果完全没有type字段，根据其他属性推断
      if ('enum' in schema) {
        cleanedSchema.type = 'string'
      } else if ('properties' in schema) {
        cleanedSchema.type = 'object'
      } else if ('items' in schema) {
        cleanedSchema.type = 'array'
      } else if ('anyOf' in schema || 'oneOf' in schema) {
        // 对于union类型，尝试推断最合适的类型
        cleanedSchema.type = 'string' // 默认为string
      } else {
        cleanedSchema.type = 'string' // 最终默认类型
      }
    }

    // 处理description
    if ('description' in schema && typeof schema.description === 'string') {
      cleanedSchema.description = schema.description
    }

    // 处理enum
    if ('enum' in schema && Array.isArray(schema.enum)) {
      cleanedSchema.enum = schema.enum
      // 确保enum类型是string
      if (!cleanedSchema.type || cleanedSchema.type === '') {
        cleanedSchema.type = 'string'
      }
    }

    // 处理properties
    if (
      'properties' in schema &&
      typeof schema.properties === 'object' &&
      schema.properties !== null
    ) {
      const properties = schema.properties as Record<string, unknown>
      const cleanedProperties: Record<string, unknown> = {}

      for (const [propName, propValue] of Object.entries(properties)) {
        if (typeof propValue === 'object' && propValue !== null) {
          cleanedProperties[propName] = this.cleanSchema(propValue as Record<string, unknown>)
        }
      }

      if (Object.keys(cleanedProperties).length > 0) {
        cleanedSchema.properties = cleanedProperties
        cleanedSchema.type = 'object'
      }
    }

    // 处理items (数组类型)
    if ('items' in schema && typeof schema.items === 'object' && schema.items !== null) {
      cleanedSchema.items = this.cleanSchema(schema.items as Record<string, unknown>)
      cleanedSchema.type = 'array'
    }

    // 处理nullable
    if ('nullable' in schema && typeof schema.nullable === 'boolean') {
      cleanedSchema.nullable = schema.nullable
    }

    // 处理anyOf/oneOf (union类型) - 简化为单一类型
    if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
      const anyOfOptions = schema.anyOf as Array<Record<string, unknown>>

      // 尝试找到最适合的类型
      let bestOption = anyOfOptions[0]

      // 优先选择有enum的选项
      for (const option of anyOfOptions) {
        if ('enum' in option && Array.isArray(option.enum)) {
          bestOption = option
          break
        }
      }

      // 如果没有enum，优先选择string类型
      if (!('enum' in bestOption)) {
        for (const option of anyOfOptions) {
          if (option.type === 'string') {
            bestOption = option
            break
          }
        }
      }

      // 递归清理选中的选项
      const cleanedOption = this.cleanSchema(bestOption)
      Object.assign(cleanedSchema, cleanedOption)
    }

    // 处理oneOf类似anyOf
    if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
      const oneOfOptions = schema.oneOf as Array<Record<string, unknown>>
      const bestOption = oneOfOptions[0] || {}
      const cleanedOption = this.cleanSchema(bestOption)
      Object.assign(cleanedSchema, cleanedOption)
    }

    // 最终检查：确保必须有type字段
    if (!cleanedSchema.type || cleanedSchema.type === '') {
      cleanedSchema.type = 'string'
    }

    return cleanedSchema
  }

  /**
   * 将MCP工具定义转换为Gemini工具格式
   */
  static mcpToolsToGeminiTools(
    mcpTools: MCPToolDefinition[] | undefined,
    serverName: string
  ): ToolListUnion {
    if (!mcpTools || mcpTools.length === 0) {
      return []
    }

    // 处理每个工具定义，构建符合Gemini API的函数声明
    const functionDeclarations = mcpTools.map((toolDef) => {
      // 转换为内部工具表示
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)

      // 获取参数属性
      const properties = tool.inputSchema.properties
      const processedProperties: Record<string, Record<string, unknown>> = {}

      // 处理每个属性，应用清理函数
      for (const [propName, propValue] of Object.entries(properties)) {
        if (typeof propValue === 'object' && propValue !== null) {
          const cleaned = this.cleanSchema(propValue as Record<string, unknown>)
          // 确保清理后的属性有有效的type
          if (cleaned.type && cleaned.type !== '') {
            processedProperties[propName] = cleaned
          } else {
            console.warn(`[MCP] Skipping property ${propName} due to invalid type`)
          }
        }
      }

      // 准备函数声明结构
      const functionDeclaration: FunctionDeclaration = {
        name: tool.id,
        description: tool.description
      }

      if (Object.keys(processedProperties).length > 0) {
        functionDeclaration.parameters = {
          type: Type.OBJECT,
          properties: processedProperties,
          required: (tool.inputSchema.required as string[]) || []
        }
      }

      // 记录没有参数的函数
      if (Object.keys(processedProperties).length === 0) {
        console.log(
          `[MCP] Function ${tool.id} has no parameters, providing minimal parameter structure`
        )
      }

      return functionDeclaration
    })

    // 返回符合Gemini工具格式的结果
    return [
      {
        functionDeclarations
      }
    ]
  }

  /**
   * 将Gemini函数调用转换为MCP工具调用
   */
  static async geminiFunctionCallToMcpTool(
    fcall: GeminiFunctionCall | undefined,
    providerId: string,
    allMcpTools: MCPToolDefinition[]
  ): Promise<MCPToolCall | undefined> {
    if (!fcall || !allMcpTools) return undefined

    const tool = allMcpTools.find((tool) => tool.function.name === fcall.name)
    if (!tool) {
      return undefined
    }

    return {
      id: `${providerId}:${tool.function.name}-${Date.now()}`,
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: JSON.stringify(fcall.args)
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }
  }
}