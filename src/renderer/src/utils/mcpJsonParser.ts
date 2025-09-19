// MCP JSON配置解析器
// 支持多种配置格式的智能解析和错误处理

export interface MCPJsonParseResult {
  success: boolean
  servers: Array<{
    name: string
    config: any
  }>
  errors: string[]
  warnings: string[]
  detectedFormat: 'claude-desktop' | 'deepchat' | 'raw-server' | 'unknown'
}

/**
 * 智能解析MCP JSON配置
 * 支持多种格式：Claude Desktop、DeepChat、单服务器配置等
 */
export function parseMultiFormatMcpConfig(jsonString: string): MCPJsonParseResult {
  const result: MCPJsonParseResult = {
    success: false,
    servers: [],
    errors: [],
    warnings: [],
    detectedFormat: 'unknown'
  }

  // 预处理JSON字符串
  const cleanedJson = preprocessJsonString(jsonString)

  try {
    const parsed = JSON.parse(cleanedJson)

    // 尝试不同格式的解析
    const formats = [
      () => parseClaudeDesktopFormat(parsed),
      () => parseDeepChatFormat(parsed),
      () => parseRawServerFormat(parsed),
      () => parseGenericFormat(parsed)
    ]

    for (const parseFormat of formats) {
      try {
        const formatResult = parseFormat()
        if (formatResult.success) {
          Object.assign(result, formatResult)
          break
        }
      } catch (error) {
        // 继续尝试下一种格式
        console.warn('Format parsing failed:', error)
      }
    }

    if (!result.success) {
      result.errors.push('无法识别的配置格式')
    }

  } catch (error) {
    result.errors.push(`JSON解析错误: ${error instanceof Error ? error.message : '未知错误'}`)
  }

  return result
}

/**
 * 预处理JSON字符串，修复常见格式问题
 */
function preprocessJsonString(jsonString: string): string {
  let cleaned = jsonString.trim()

  // 移除JavaScript风格的注释
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/\/\/.*$/gm, '')

  // 移除末尾的逗号
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

  // 修复单引号为双引号
  cleaned = cleaned.replace(/'([^']*)':/g, '"$1":')
  cleaned = cleaned.replace(/:[ ]*'([^']*)'/g, ': "$1"')

  return cleaned
}

/**
 * 解析Claude Desktop格式配置
 * 格式: { "mcpServers": { "serverName": { ... } } }
 */
function parseClaudeDesktopFormat(parsed: any): MCPJsonParseResult {
  const result: MCPJsonParseResult = {
    success: false,
    servers: [],
    errors: [],
    warnings: [],
    detectedFormat: 'claude-desktop'
  }

  if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
    throw new Error('Not Claude Desktop format')
  }

  const servers = Object.entries(parsed.mcpServers)
  if (servers.length === 0) {
    result.warnings.push('配置中未找到任何服务器')
  }

  for (const [serverName, serverConfig] of servers) {
    if (!serverName || typeof serverConfig !== 'object') {
      result.warnings.push(`服务器配置无效: ${serverName}`)
      continue
    }

    result.servers.push({
      name: serverName,
      config: normalizeServerConfig(serverConfig)
    })
  }

  result.success = result.servers.length > 0
  return result
}

/**
 * 解析DeepChat格式配置
 * 格式: { "servers": [{ "name": "...", "config": { ... } }] }
 */
function parseDeepChatFormat(parsed: any): MCPJsonParseResult {
  const result: MCPJsonParseResult = {
    success: false,
    servers: [],
    errors: [],
    warnings: [],
    detectedFormat: 'deepchat'
  }

  if (!Array.isArray(parsed.servers)) {
    throw new Error('Not DeepChat format')
  }

  for (const [index, server] of parsed.servers.entries()) {
    if (!server.name || !server.config) {
      result.warnings.push(`服务器配置无效 (索引 ${index})`)
      continue
    }

    result.servers.push({
      name: server.name,
      config: normalizeServerConfig(server.config)
    })
  }

  result.success = result.servers.length > 0
  return result
}

/**
 * 解析单服务器配置
 * 格式: { "command": "...", "args": [...], ... }
 */
function parseRawServerFormat(parsed: any): MCPJsonParseResult {
  const result: MCPJsonParseResult = {
    success: false,
    servers: [],
    errors: [],
    warnings: [],
    detectedFormat: 'raw-server'
  }

  // 检查是否是单个服务器配置
  if (hasServerConfigFields(parsed)) {
    const serverName = parsed.name || generateServerName(parsed)
    result.servers.push({
      name: serverName,
      config: normalizeServerConfig(parsed)
    })
    result.success = true

    if (!parsed.name) {
      result.warnings.push(`自动生成服务器名称: ${serverName}`)
    }
  } else {
    throw new Error('Not raw server format')
  }

  return result
}

/**
 * 通用格式解析（尝试推断结构）
 */
function parseGenericFormat(parsed: any): MCPJsonParseResult {
  const result: MCPJsonParseResult = {
    success: false,
    servers: [],
    errors: [],
    warnings: [],
    detectedFormat: 'unknown'
  }

  // 尝试从对象中找到服务器配置
  if (typeof parsed === 'object' && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'object' && value !== null && hasServerConfigFields(value)) {
        result.servers.push({
          name: key,
          config: normalizeServerConfig(value)
        })
      }
    }
  }

  if (result.servers.length > 0) {
    result.success = true
    result.warnings.push('使用通用格式解析，请验证配置正确性')
  } else {
    throw new Error('Cannot parse as generic format')
  }

  return result
}

/**
 * 检查对象是否具有服务器配置字段
 */
function hasServerConfigFields(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false

  const serverFields = ['command', 'args', 'env', 'type', 'baseUrl', 'url']
  return serverFields.some(field => field in obj)
}

/**
 * 规范化服务器配置
 */
function normalizeServerConfig(config: any): any {
  const normalized = { ...config }

  // 统一URL字段
  if (normalized.url && !normalized.baseUrl) {
    normalized.baseUrl = normalized.url
    delete normalized.url
  }

  // 确保args是数组
  if (normalized.args && typeof normalized.args === 'string') {
    normalized.args = normalized.args.split(/\s+/).filter(Boolean)
  }

  // 确保env是对象
  if (normalized.env && typeof normalized.env === 'string') {
    try {
      normalized.env = JSON.parse(normalized.env)
    } catch {
      // 如果解析失败，保持字符串格式
    }
  }

  // 设置默认类型
  if (!normalized.type) {
    if (normalized.baseUrl) {
      normalized.type = 'http'
    } else if (normalized.command) {
      normalized.type = 'stdio'
    } else {
      normalized.type = 'stdio'
    }
  }

  return normalized
}

/**
 * 根据配置生成服务器名称
 */
function generateServerName(config: any): string {
  if (config.command) {
    const cmd = Array.isArray(config.args) && config.args.length > 0
      ? config.args[0]
      : config.command
    return `mcp-${cmd.replace(/[^a-zA-Z0-9]/g, '-')}`
  }

  if (config.baseUrl || config.url) {
    const url = config.baseUrl || config.url
    try {
      const domain = new URL(url).hostname
      return `mcp-${domain.replace(/[^a-zA-Z0-9]/g, '-')}`
    } catch {
      return 'mcp-server'
    }
  }

  return `mcp-server-${Date.now()}`
}

/**
 * 验证解析后的服务器配置
 */
export function validateParsedServers(servers: Array<{ name: string; config: any }>): {
  valid: Array<{ name: string; config: any }>
  invalid: Array<{ name: string; config: any; errors: string[] }>
} {
  const valid: Array<{ name: string; config: any }> = []
  const invalid: Array<{ name: string; config: any; errors: string[] }> = []

  for (const server of servers) {
    const errors: string[] = []

    // 基本验证
    if (!server.name || typeof server.name !== 'string') {
      errors.push('服务器名称无效')
    }

    if (!server.config || typeof server.config !== 'object') {
      errors.push('服务器配置无效')
    } else {
      // 类型特定验证
      const { type } = server.config

      if (type === 'stdio' && !server.config.command) {
        errors.push('stdio类型服务器必须指定command')
      }

      if ((type === 'sse' || type === 'http') && !server.config.baseUrl) {
        errors.push('SSE/HTTP类型服务器必须指定baseUrl')
      }
    }

    if (errors.length === 0) {
      valid.push(server)
    } else {
      invalid.push({ ...server, errors })
    }
  }

  return { valid, invalid }
}

/**
 * 生成配置预览文本
 */
export function generateConfigPreview(servers: Array<{ name: string; config: any }>): string {
  if (servers.length === 0) {
    return '未找到有效的服务器配置'
  }

  const previews = servers.map(({ name, config }) => {
    const lines = [`📋 ${name}`]

    if (config.type) {
      lines.push(`   类型: ${config.type}`)
    }

    if (config.command) {
      lines.push(`   命令: ${config.command}`)
    }

    if (config.baseUrl) {
      lines.push(`   URL: ${config.baseUrl}`)
    }

    if (config.args && config.args.length > 0) {
      lines.push(`   参数: ${config.args.join(' ')}`)
    }

    return lines.join('\n')
  })

  return previews.join('\n\n')
}