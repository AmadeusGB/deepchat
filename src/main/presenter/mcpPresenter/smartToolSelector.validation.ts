import { SmartToolSelector } from './smartToolSelector'
import { MCPToolDefinition, IConfigPresenter } from '@shared/presenter'

// 模拟配置
const mockConfigPresenter: IConfigPresenter = {
  getLanguage: () => 'zh-CN',
  getMcpServers: async () => ({}),
  getMcpDefaultServers: async () => [],
  addMcpDefaultServer: async () => {},
  removeMcpDefaultServer: async () => {},
  toggleMcpDefaultServer: async () => {},
  addMcpServer: async () => false,
  updateMcpServer: async () => {},
  removeMcpServer: async () => {},
  getMcpEnabled: async () => true,
  setMcpEnabled: async () => {}
} as unknown as IConfigPresenter

// 模拟完整的工具列表
const mockToolDefinitions: MCPToolDefinition[] = [
  // Playwright 工具
  {
    type: 'function',
    function: {
      name: 'mcp_playwright_browser_navigate',
      description: 'Navigate to a URL',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'playwright', icons: '🎭', description: 'Playwright browser automation' }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_playwright_browser_click',
      description: 'Perform click on a web page',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'playwright', icons: '🎭', description: 'Playwright browser automation' }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_playwright_browser_type',
      description: 'Type text into editable element',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'playwright', icons: '🎭', description: 'Playwright browser automation' }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_playwright_browser_snapshot',
      description: 'Capture accessibility snapshot of the current page',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'playwright', icons: '🎭', description: 'Playwright browser automation' }
  },

  // Deeper Device 工具
  {
    type: 'function',
    function: {
      name: 'loginToDeeperDevice',
      description:
        '🔐 登录Deeper设备管理界面 - 使用admin/admin默认凭证或自定义用户名密码获取访问权限',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'deeper-device', icons: '🌐', description: 'Deeper device management' }
  },
  {
    type: 'function',
    function: {
      name: 'setDpnMode',
      description:
        '🚀 配置DPN路由模式 - 选择Smart Routing(智能路由)、Full Routing(完全路由)或Direct Routing(直接路由)',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'deeper-device', icons: '🌐', description: 'Deeper device management' }
  },
  {
    type: 'function',
    function: {
      name: 'getDpnMode',
      description: '📊 查看DPN路由状态 - 显示当前DPN工作模式(Smart/Full/Direct)、使用的隧道信息',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    server: { name: 'deeper-device', icons: '🌐', description: 'Deeper device management' }
  }
]

// 测试用例
const testCases = [
  // 应该选择 Playwright 的情况
  { input: 'navigate', expected: 'mcp_playwright_browser_navigate', description: '网页导航' },
  {
    input: 'browser_navigate',
    expected: 'mcp_playwright_browser_navigate',
    description: '浏览器导航'
  },
  { input: 'click', expected: 'mcp_playwright_browser_click', description: '点击操作' },
  { input: 'type', expected: 'mcp_playwright_browser_type', description: '文字输入' },
  { input: 'snapshot', expected: 'mcp_playwright_browser_snapshot', description: '页面快照' },
  {
    input: 'playwright',
    expected: 'mcp_playwright_browser_navigate',
    description: 'Playwright操作'
  },
  { input: '访问网页', expected: 'mcp_playwright_browser_navigate', description: '访问网页' },
  { input: '点击按钮', expected: 'mcp_playwright_browser_click', description: '点击按钮' },
  { input: '浏览器操作', expected: 'mcp_playwright_browser_navigate', description: '浏览器操作' },
  { input: '网站登录', expected: 'mcp_playwright_browser_navigate', description: '网站登录' },

  // 应该选择 Deeper Device 的情况
  { input: 'loginToDeeperDevice', expected: 'loginToDeeperDevice', description: '设备登录' },
  { input: 'setDpnMode', expected: 'setDpnMode', description: 'DPN模式设置' },
  { input: 'getDpnMode', expected: 'getDpnMode', description: 'DPN模式查询' },
  { input: 'deeper', expected: 'loginToDeeperDevice', description: 'Deeper设备' },
  { input: 'dpn', expected: 'setDpnMode', description: 'DPN配置' },
  { input: '设备登录', expected: 'loginToDeeperDevice', description: '设备登录' },
  { input: 'deeper设备', expected: 'loginToDeeperDevice', description: 'Deeper设备操作' },
  { input: 'device login', expected: 'loginToDeeperDevice', description: '设备登录(英文)' }
]

export async function validateSmartToolSelector() {
  console.log('\n🧪 智能工具选择器验证测试')
  console.log('='.repeat(50))

  const selector = new SmartToolSelector(mockConfigPresenter)

  let passedTests = 0
  const totalTests = testCases.length

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.description}`)
    console.log(`输入: "${testCase.input}"`)
    console.log(`期望: ${testCase.expected}`)

    try {
      const result = await selector.findBestTool(testCase.input, mockToolDefinitions)

      console.log(`实际: ${result.selectedTool}`)
      console.log(`置信度: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`原因: ${result.reason}`)

      if (result.selectedTool === testCase.expected) {
        console.log('✅ 测试通过')
        passedTests++
      } else {
        console.log('❌ 测试失败')
        if (result.alternatives.includes(testCase.expected)) {
          console.log(`注意: 期望工具在替代方案中: ${result.alternatives.join(', ')}`)
        }
      }

      if (result.alternatives.length > 0) {
        console.log(`替代方案: ${result.alternatives.join(', ')}`)
      }
    } catch (error) {
      console.log(`❌ 测试出错: ${error}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(
    `测试结果: ${passedTests}/${totalTests} 通过 (${((passedTests / totalTests) * 100).toFixed(1)}%)`
  )

  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！智能工具选择器工作正常')
  } else {
    console.log('⚠️  部分测试失败，需要进一步优化')
  }

  return { passed: passedTests, total: totalTests, rate: passedTests / totalTests }
}

// 问题场景重现测试
export async function reproduceIssueScenario() {
  console.log('\n🔍 问题场景重现测试')
  console.log('='.repeat(50))

  const selector = new SmartToolSelector(mockConfigPresenter)

  // 模拟用户可能输入的导致错误选择的场景
  const problematicInputs = [
    'login',
    '登录',
    'navigate to login page',
    'access website',
    'visit url',
    'open browser',
    'go to page'
  ]

  for (const input of problematicInputs) {
    console.log(`\n测试输入: "${input}"`)

    try {
      const result = await selector.findBestTool(input, mockToolDefinitions)

      console.log(`选择工具: ${result.selectedTool}`)
      console.log(`置信度: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`原因: ${result.reason}`)

      // 分析是否为正确选择
      if (result.selectedTool.includes('playwright')) {
        console.log('✅ 正确选择了浏览器工具')
      } else if (result.selectedTool.includes('Deeper') || result.selectedTool.includes('Device')) {
        console.log('❌ 错误选择了设备工具')
      } else {
        console.log('⚠️  选择了其他工具')
      }
    } catch (error) {
      console.log(`❌ 测试出错: ${error}`)
    }
  }
}
