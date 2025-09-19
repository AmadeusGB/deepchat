// MCP配置和工具验证工具

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 验证MCP服务器配置
 */
export function validateMcpServerConfig(config: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 基础字段验证
  if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
    errors.push('服务器名称不能为空')
  }

  if (!config.type || !['stdio', 'sse', 'inmemory', 'http'].includes(config.type)) {
    errors.push('服务器类型必须是 stdio、sse、inmemory 或 http 中的一种')
  }

  // 根据类型进行特定验证
  switch (config.type) {
    case 'stdio':
      if (!config.command || typeof config.command !== 'string') {
        errors.push('stdio 类型服务器必须指定命令')
      }
      break

    case 'sse':
    case 'http':
      if (!config.baseUrl || typeof config.baseUrl !== 'string') {
        errors.push('SSE/HTTP 类型服务器必须指定基础URL')
      } else if (!isValidUrl(config.baseUrl)) {
        errors.push('基础URL格式不正确')
      }
      break

    case 'inmemory':
      // inmemory 类型不需要额外验证
      break
  }

  // ENV 验证
  if (config.env) {
    if (typeof config.env === 'string') {
      try {
        JSON.parse(config.env)
      } catch {
        errors.push('环境变量必须是有效的JSON格式')
      }
    } else if (typeof config.env !== 'object') {
      errors.push('环境变量必须是JSON字符串或对象')
    }
  }

  // Args 验证
  if (config.args && typeof config.args !== 'string' && !Array.isArray(config.args)) {
    warnings.push('参数应该是字符串或数组格式')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证工具参数
 */
export function validateToolParameters(toolSchema: any, params: Record<string, any>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!toolSchema.parameters || !toolSchema.parameters.properties) {
    return { isValid: true, errors: [], warnings: [] }
  }

  const { properties, required = [] } = toolSchema.parameters

  // 检查必需参数
  for (const requiredParam of required) {
    if (!(requiredParam in params) || params[requiredParam] === '' || params[requiredParam] == null) {
      errors.push(`必需参数 "${requiredParam}" 不能为空`)
    }
  }

  // 检查参数类型
  for (const [paramName, paramValue] of Object.entries(params)) {
    if (paramValue === '' || paramValue == null) continue

    const paramSchema = properties[paramName]
    if (!paramSchema) {
      warnings.push(`参数 "${paramName}" 不在工具定义中`)
      continue
    }

    const validationError = validateParameterType(paramName, paramValue, paramSchema)
    if (validationError) {
      errors.push(validationError)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证参数类型
 */
function validateParameterType(paramName: string, value: any, schema: any): string | null {
  const { type, format } = schema

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `参数 "${paramName}" 必须是字符串类型`
      }
      if (format === 'email' && !isValidEmail(value)) {
        return `参数 "${paramName}" 必须是有效的邮箱地址`
      }
      if (format === 'uri' && !isValidUrl(value)) {
        return `参数 "${paramName}" 必须是有效的URL`
      }
      break

    case 'number':
    case 'integer':
      const numValue = Number(value)
      if (isNaN(numValue)) {
        return `参数 "${paramName}" 必须是数字类型`
      }
      if (type === 'integer' && !Number.isInteger(numValue)) {
        return `参数 "${paramName}" 必须是整数`
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return `参数 "${paramName}" 必须是布尔类型`
      }
      break

    case 'array':
      if (!Array.isArray(value) && typeof value === 'string') {
        try {
          JSON.parse(value)
        } catch {
          return `参数 "${paramName}" 必须是有效的数组格式`
        }
      }
      break

    case 'object':
      if (typeof value === 'string') {
        try {
          JSON.parse(value)
        } catch {
          return `参数 "${paramName}" 必须是有效的JSON对象`
        }
      }
      break
  }

  return null
}

/**
 * 验证JSON格式
 */
export function validateJsonFormat(jsonString: string): ValidationResult {
  const errors: string[] = []

  if (!jsonString.trim()) {
    return { isValid: true, errors: [], warnings: [] }
  }

  try {
    JSON.parse(jsonString)
  } catch (error) {
    errors.push(`JSON格式错误: ${error instanceof Error ? error.message : '未知错误'}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  }
}

/**
 * 验证URL格式
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 实时验证
 */
export function createRealtimeValidator<T>(
  validateFn: (value: T) => ValidationResult,
  onValidation: (result: ValidationResult) => void,
  debounceMs = 300
) {
  let timeoutId: NodeJS.Timeout | null = null

  return (value: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      const result = validateFn(value)
      onValidation(result)
      timeoutId = null
    }, debounceMs)
  }
}