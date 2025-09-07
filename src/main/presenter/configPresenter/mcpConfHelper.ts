import { eventBus, SendTarget } from '@/eventbus'
import { MCPServerConfig } from '@shared/presenter'
import { MCP_EVENTS } from '@/events'
import ElectronStore from 'electron-store'
import { app } from 'electron'

// MCP设置的接口
interface IMcpSettings {
  mcpServers: Record<string, MCPServerConfig>
  defaultServer?: string // 保留旧字段以支持版本兼容
  defaultServers: string[] // 新增：多个默认服务器数组
  mcpEnabled: boolean // 添加MCP启用状态字段
  [key: string]: unknown // 允许任意键
}
export type MCPServerType = 'stdio' | 'sse' | 'inmemory' | 'http'
// const filesystemPath = path.join(app.getAppPath(), 'resources', 'mcp', 'filesystem.mjs')

// 抽取inmemory类型的服务为常量
const DEFAULT_INMEMORY_SERVERS: Record<string, MCPServerConfig> = {
  buildInFileSystem: {
    args: [app.getPath('home')],
    descriptions: 'DeepChat内置文件系统mcp服务',
    icons: '📁',
    autoApprove: ['read'],
    type: 'inmemory' as MCPServerType,
    command: 'filesystem',
    env: {},
    disable: true
  },
  Artifacts: {
    args: [],
    descriptions: 'DeepChat内置 artifacts mcp服务',
    icons: '🎨',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'artifacts',
    env: {},
    disable: false
  },
  bochaSearch: {
    args: [],
    descriptions: 'DeepChat内置博查搜索服务',
    icons: '🔍',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'bochaSearch',
    env: {
      apiKey: 'YOUR_BOCHA_API_KEY' // 需要用户提供实际的API Key
    },
    disable: false
  },
  braveSearch: {
    args: [],
    descriptions: 'DeepChat内置Brave搜索服务',
    icons: '🦁',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'braveSearch',
    env: {
      apiKey: 'YOUR_BRAVE_API_KEY' // 需要用户提供实际的API Key
    },
    disable: false
  },
  difyKnowledge: {
    args: [],
    descriptions: 'DeepChat内置Dify知识库检索服务',
    icons: '📚',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'difyKnowledge',
    env: {
      configs: [
        {
          description: 'this is a description for the current knowledge base',
          apiKey: 'YOUR_DIFY_API_KEY',
          datasetId: 'YOUR_DATASET_ID',
          endpoint: 'http://localhost:3000/v1'
        }
      ]
    },
    disable: false
  },
  imageServer: {
    args: [],
    descriptions: 'Image processing MCP service',
    icons: '🖼️',
    autoApprove: ['read_image_base64', 'read_multiple_images_base64'], // Auto-approve reading, require confirmation for uploads
    type: 'inmemory' as MCPServerType,
    command: 'image', // We need to map this command to the ImageServer class later
    env: {},
    disable: false
  },
  powerpack: {
    args: [],
    descriptions: 'DeepChat内置增强工具包',
    icons: '🛠️',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'powerpack',
    env: {},
    disable: false
  },
  ragflowKnowledge: {
    args: [],
    descriptions: 'DeepChat内置RAGFlow知识库检索服务',
    icons: '📚',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'ragflowKnowledge',
    env: {
      configs: [
        {
          description: '默认RAGFlow知识库',
          apiKey: 'YOUR_RAGFLOW_API_KEY',
          datasetIds: ['YOUR_DATASET_ID'],
          endpoint: 'http://localhost:8000'
        }
      ]
    },
    disable: false
  },
  fastGptKnowledge: {
    args: [],
    descriptions: 'DeepChat内置FastGPT知识库检索服务',
    icons: '📚',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'fastGptKnowledge',
    env: {
      configs: [
        {
          description: 'this is a description for the current knowledge base',
          apiKey: 'YOUR_FastGPT_API_KEY',
          datasetId: 'YOUR_DATASET_ID',
          endpoint: 'http://localhost:3000/api'
        }
      ]
    },
    disable: false
  },
  'deepchat-inmemory/deep-research-server': {
    args: [],
    descriptions:
      'DeepChat内置深度研究服务，使用博查搜索(注意该服务需要较长的上下文模型，请勿在短上下文的模型中使用)',
    icons: '🔬',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'deepchat-inmemory/deep-research-server',
    env: {
      BOCHA_API_KEY: 'YOUR_BOCHA_API_KEY'
    },
    disable: false
  },
  'deepchat-inmemory/auto-prompting-server': {
    args: [],
    descriptions: 'DeepChat内置自动模板提示词服务',
    icons: '📜',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'deepchat-inmemory/auto-prompting-server',
    env: {},
    disable: false
  },
  'deepchat-inmemory/conversation-search-server': {
    args: [],
    descriptions: 'DeepChat built-in conversation history search service',
    icons: '🔍',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'deepchat-inmemory/conversation-search-server',
    env: {},
    disable: false
  },
  'Deeper Device': {
    args: [],
    descriptions: 'DeepChat内置Deeper网络设备控制服务',
    icons: '🌐',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'deepchat-inmemory/deeper-device-server',
    env: {},
    disable: false
  },
  'Deeper Wallet': {
    args: [],
    descriptions: 'DeepChat内置多链钱包服务 - 支持以太坊、Solana、Polygon等区块链网络查询',
    icons: '💰',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    command: 'deepchat-inmemory/deeper-wallet-server',
    env: {},
    disable: false
  }
}

const DEFAULT_MCP_SERVERS = {
  mcpServers: {
    // 先定义内置MCP服务器
    ...DEFAULT_INMEMORY_SERVERS,
    // 之后是默认的三方MCP服务器
    memory: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: {},
      descriptions: '内存存储服务',
      icons: '🧠',
      autoApprove: ['all'],
      disable: true,
      type: 'stdio' as MCPServerType
    },
    playwright: {
      command: 'npx',
      args: ['@playwright/mcp@latest'],
      env: {},
      descriptions: 'Playwright web automation and testing service',
      icons: '🎭',
      autoApprove: ['all'],
      disable: false,
      type: 'stdio' as MCPServerType
    }
  },
  defaultServers: ['Artifacts', 'playwright', 'Deeper Device', 'Deeper Wallet'], // 使用友好的显示名称
  mcpEnabled: true // 默认开启MCP功能
}
// 这部分mcp有系统逻辑判断是否启用，不受用户配置控制，受软件环境控制
export const SYSTEM_INMEM_MCP_SERVERS: Record<string, MCPServerConfig> = {
  'deepchat-inmemory/custom-prompts-server': {
    command: 'deepchat-inmemory/custom-prompts-server',
    args: [],
    env: {},
    descriptions: 'DeepChat内置自定义提示词服务',
    icons: '📝',
    autoApprove: ['all'],
    type: 'inmemory' as MCPServerType,
    disable: false
  }
}

export class McpConfHelper {
  private mcpStore: ElectronStore<IMcpSettings>

  constructor() {
    // 初始化MCP设置存储
    this.mcpStore = new ElectronStore<IMcpSettings>({
      name: 'mcp-settings',
      defaults: {
        mcpServers: DEFAULT_MCP_SERVERS.mcpServers,
        defaultServers: DEFAULT_MCP_SERVERS.defaultServers,
        mcpEnabled: DEFAULT_MCP_SERVERS.mcpEnabled
      }
    })
  }

  // 获取MCP服务器配置
  getMcpServers(): Promise<Record<string, MCPServerConfig>> {
    const storedServers = this.mcpStore.get('mcpServers') || DEFAULT_MCP_SERVERS.mcpServers

    // 检查并补充缺少的inmemory服务
    const updatedServers = { ...storedServers }

    // 清理重复的 Deeper Device 配置 - 删除旧的技术名称配置
    if (
      updatedServers['deepchat-inmemory/deeper-device-server'] &&
      updatedServers['Deeper Device']
    ) {
      console.log('检测到重复的 Deeper Device 配置，删除旧的技术名称配置')
      delete updatedServers['deepchat-inmemory/deeper-device-server']
    }

    // 遍历所有默认的inmemory服务，确保它们都存在
    for (const [serverName, serverConfig] of Object.entries(DEFAULT_INMEMORY_SERVERS)) {
      if (!updatedServers[serverName]) {
        console.log(`添加缺少的inmemory服务: ${serverName}`)
        updatedServers[serverName] = serverConfig
      }
    }

    // 检查并补充缺少的第三方MCP服务器
    for (const [serverName, serverConfig] of Object.entries(DEFAULT_MCP_SERVERS.mcpServers)) {
      if (serverConfig.type === 'stdio' && !updatedServers[serverName]) {
        console.log(`添加缺少的stdio服务: ${serverName}`)
        updatedServers[serverName] = serverConfig
      } else if (updatedServers[serverName] && serverConfig.type === 'stdio') {
        // 检查现有的stdio服务器配置是否正确，如果不正确则修复
        const existingConfig = updatedServers[serverName]
        const needsUpdate =
          existingConfig.type === 'stdio' &&
          (!existingConfig.descriptions ||
            existingConfig.descriptions === '' ||
            JSON.stringify(existingConfig.args) !== JSON.stringify(serverConfig.args)) // 检查 args 是否匹配

        if (needsUpdate) {
          console.log(`修复stdio服务配置: ${serverName}`)
          updatedServers[serverName] = {
            ...existingConfig,
            args: serverConfig.args, // 更新 args
            descriptions: serverConfig.descriptions,
            icons: existingConfig.icons || serverConfig.icons
          }
        }
      }
    }

    // 如果有新增或修复的服务，更新存储
    if (JSON.stringify(updatedServers) !== JSON.stringify(storedServers)) {
      this.mcpStore.set('mcpServers', updatedServers)
    }

    return Promise.resolve(updatedServers)
  }

  // 设置MCP服务器配置
  async setMcpServers(servers: Record<string, MCPServerConfig>): Promise<void> {
    this.mcpStore.set('mcpServers', servers)
    eventBus.emit(MCP_EVENTS.CONFIG_CHANGED, {
      mcpServers: servers,
      defaultServers: this.mcpStore.get('defaultServers') || [],
      mcpEnabled: this.mcpStore.get('mcpEnabled')
    })
  }

  // 获取默认服务器列表
  getMcpDefaultServers(): Promise<string[]> {
    const storedDefaultServers = this.mcpStore.get('defaultServers') || []
    const expectedDefaultServers = DEFAULT_MCP_SERVERS.defaultServers

    // 过滤出有效的默认服务器（既在期望列表中，又在当前存储中）
    let needsUpdate = false
    const updatedDefaultServers: string[] = []

    // 首先添加所有期望的默认服务器
    for (const serverName of expectedDefaultServers) {
      if (!updatedDefaultServers.includes(serverName)) {
        updatedDefaultServers.push(serverName)
        if (!storedDefaultServers.includes(serverName)) {
          console.log(`添加缺失的默认服务器: ${serverName}`)
          needsUpdate = true
        }
      }
    }

    // 检查是否有需要删除的旧服务器
    for (const serverName of storedDefaultServers) {
      if (!expectedDefaultServers.includes(serverName)) {
        console.log(`删除过时的默认服务器: ${serverName}`)
        needsUpdate = true
      }
    }

    // 如果有更新，保存到存储
    if (needsUpdate || updatedDefaultServers.length !== storedDefaultServers.length) {
      this.mcpStore.set('defaultServers', updatedDefaultServers)
      // 发送配置变更事件
      eventBus.send(MCP_EVENTS.CONFIG_CHANGED, SendTarget.ALL_WINDOWS, {
        mcpServers: this.mcpStore.get('mcpServers'),
        defaultServers: updatedDefaultServers,
        mcpEnabled: this.mcpStore.get('mcpEnabled')
      })
    }

    return Promise.resolve(updatedDefaultServers)
  }

  // 添加默认服务器
  async addMcpDefaultServer(serverName: string): Promise<void> {
    const defaultServers = this.mcpStore.get('defaultServers') || []
    const mcpServers = this.mcpStore.get('mcpServers') || {}

    // 检测并清理失效的服务器
    const validDefaultServers = defaultServers.filter((server) => {
      const exists = mcpServers[server] !== undefined
      if (!exists) {
        console.log(`检测到失效的MCP服务器: ${server}，已从默认列表中移除`)
      }
      return exists
    })

    // 添加新服务器（如果不在列表中）
    if (!validDefaultServers.includes(serverName)) {
      validDefaultServers.push(serverName)
    }

    // 如果有变化则更新存储并发送事件
    if (
      validDefaultServers.length !== defaultServers.length ||
      !defaultServers.includes(serverName)
    ) {
      this.mcpStore.set('defaultServers', validDefaultServers)
      eventBus.send(MCP_EVENTS.CONFIG_CHANGED, SendTarget.ALL_WINDOWS, {
        mcpServers: mcpServers,
        defaultServers: validDefaultServers,
        mcpEnabled: this.mcpStore.get('mcpEnabled')
      })
    }
  }

  // 移除默认服务器
  async removeMcpDefaultServer(serverName: string): Promise<void> {
    const defaultServers = this.mcpStore.get('defaultServers') || []
    const updatedServers = defaultServers.filter((name) => name !== serverName)
    this.mcpStore.set('defaultServers', updatedServers)
    eventBus.send(MCP_EVENTS.CONFIG_CHANGED, SendTarget.ALL_WINDOWS, {
      mcpServers: this.mcpStore.get('mcpServers'),
      defaultServers: updatedServers,
      mcpEnabled: this.mcpStore.get('mcpEnabled')
    })
  }

  // 切换服务器的默认状态
  async toggleMcpDefaultServer(serverName: string): Promise<void> {
    const defaultServers = this.mcpStore.get('defaultServers') || []
    if (defaultServers.includes(serverName)) {
      await this.removeMcpDefaultServer(serverName)
    } else {
      await this.addMcpDefaultServer(serverName)
    }
  }

  // 设置MCP启用状态
  async setMcpEnabled(enabled: boolean): Promise<void> {
    this.mcpStore.set('mcpEnabled', enabled)
    eventBus.send(MCP_EVENTS.CONFIG_CHANGED, SendTarget.ALL_WINDOWS, {
      mcpServers: this.mcpStore.get('mcpServers'),
      defaultServers: this.mcpStore.get('defaultServers'),
      mcpEnabled: enabled
    })
  }

  // 获取MCP启用状态
  getMcpEnabled(): Promise<boolean> {
    return Promise.resolve(this.mcpStore.get('mcpEnabled') ?? DEFAULT_MCP_SERVERS.mcpEnabled)
  }

  // 添加MCP服务器
  async addMcpServer(name: string, config: MCPServerConfig): Promise<boolean> {
    const mcpServers = await this.getMcpServers()
    mcpServers[name] = config
    await this.setMcpServers(mcpServers)
    return true
  }

  // 移除MCP服务器
  async removeMcpServer(name: string): Promise<void> {
    const mcpServers = await this.getMcpServers()
    delete mcpServers[name]
    await this.setMcpServers(mcpServers)

    // 如果删除的服务器在默认服务器列表中，则从列表中移除
    const defaultServers = await this.getMcpDefaultServers()
    if (defaultServers.includes(name)) {
      await this.removeMcpDefaultServer(name)
    }
  }

  // 更新MCP服务器配置
  async updateMcpServer(name: string, config: Partial<MCPServerConfig>): Promise<void> {
    const mcpServers = await this.getMcpServers()
    if (!mcpServers[name]) {
      throw new Error(`MCP server ${name} not found`)
    }
    mcpServers[name] = {
      ...mcpServers[name],
      ...config
    }
    await this.setMcpServers(mcpServers)
  }

  // 恢复默认服务器配置
  async resetToDefaultServers(): Promise<void> {
    const currentServers = await this.getMcpServers()
    const updatedServers = { ...currentServers }

    // 删除所有类型为inmemory的服务
    for (const [serverName, serverConfig] of Object.entries(updatedServers)) {
      if (serverConfig.type === 'inmemory') {
        delete updatedServers[serverName]
      }
    }

    // 遍历所有默认服务，有则覆盖，无则新增
    for (const [serverName, serverConfig] of Object.entries(DEFAULT_MCP_SERVERS.mcpServers)) {
      updatedServers[serverName] = serverConfig
    }

    // 更新服务器配置
    await this.setMcpServers(updatedServers)

    // 恢复默认服务器设置
    this.mcpStore.set('defaultServers', DEFAULT_MCP_SERVERS.defaultServers)
    eventBus.send(MCP_EVENTS.CONFIG_CHANGED, SendTarget.ALL_WINDOWS, {
      mcpServers: updatedServers,
      defaultServers: DEFAULT_MCP_SERVERS.defaultServers,
      mcpEnabled: this.mcpStore.get('mcpEnabled')
    })
  }

  public onUpgrade(oldVersion: string | undefined): void {
    if (!oldVersion) {
      // 这是全新安装，不需要迁移
      return
    }

    // 清理旧的 Deeper Device 配置
    this.cleanupDeeperDeviceConfig()

    // 迁移 filesystem 服务器到 buildInFileSystem
    try {
      const mcpServers = this.mcpStore.get('mcpServers') || {}
      // console.log('mcpServers', mcpServers)
      if (mcpServers.filesystem) {
        console.log('检测到旧版本的 filesystem MCP 服务器，开始迁移到 buildInFileSystem')

        // 检查 buildInFileSystem 是否已存在
        if (!mcpServers.buildInFileSystem) {
          // 创建 buildInFileSystem 配置
          mcpServers.buildInFileSystem = {
            args: [app.getPath('home')], // 默认值
            descriptions: '内置文件系统mcp服务',
            icons: '💾',
            autoApprove: ['read'],
            type: 'inmemory' as MCPServerType,
            command: 'filesystem',
            env: {},
            disable: false
          }
        }

        // 如果 filesystem 的 args 长度大于 2，将第三个参数及以后的参数迁移
        if (mcpServers.filesystem.args && mcpServers.filesystem.args.length > 2) {
          mcpServers.buildInFileSystem.args = mcpServers.filesystem.args.slice(2)
        }

        // 迁移 autoApprove 设置
        if (mcpServers.filesystem.autoApprove) {
          mcpServers.buildInFileSystem.autoApprove = [...mcpServers.filesystem.autoApprove]
        }

        delete mcpServers.filesystem
        // 更新 mcpServers
        this.mcpStore.set('mcpServers', mcpServers)

        // 如果 filesystem 是默认服务器，将 buildInFileSystem 添加到默认服务器列表
        const defaultServers = this.mcpStore.get('defaultServers') || []
        if (
          defaultServers.includes('filesystem') &&
          !defaultServers.includes('buildInFileSystem')
        ) {
          defaultServers.push('buildInFileSystem')
          this.mcpStore.set('defaultServers', defaultServers)
        }

        console.log('迁移 filesystem 到 buildInFileSystem 完成')
      }
    } catch (error) {
      console.error('迁移 filesystem 失败:', error)
    }
  }

  // 清理旧的 Deeper Device 配置
  private cleanupDeeperDeviceConfig(): void {
    try {
      const mcpServers = this.mcpStore.get('mcpServers') || {}
      const defaultServers = this.mcpStore.get('defaultServers') || []

      let serversChanged = false
      let defaultsChanged = false

      // 如果存在旧的技术名称配置，删除它
      if (mcpServers['deepchat-inmemory/deeper-device-server']) {
        console.log('清理旧的 deepchat-inmemory/deeper-device-server 配置')
        delete mcpServers['deepchat-inmemory/deeper-device-server']
        serversChanged = true
      }

      // 从默认服务器列表中删除旧的技术名称
      const oldServerIndex = defaultServers.indexOf('deepchat-inmemory/deeper-device-server')
      if (oldServerIndex !== -1) {
        console.log('从默认服务器列表中删除旧的 deepchat-inmemory/deeper-device-server')
        defaultServers.splice(oldServerIndex, 1)
        defaultsChanged = true
      }

      // 确保新的 Deeper Device 配置存在
      if (!mcpServers['Deeper Device']) {
        console.log('添加新的 Deeper Device 配置')
        mcpServers['Deeper Device'] = {
          args: [],
          descriptions: 'DeepChat内置Deeper网络设备控制服务',
          icons: '🌐',
          autoApprove: ['all'],
          type: 'inmemory' as MCPServerType,
          command: 'deepchat-inmemory/deeper-device-server',
          env: {},
          disable: false
        }
        serversChanged = true
      }

      // 确保 Deeper Device 在默认服务器列表中
      if (!defaultServers.includes('Deeper Device')) {
        console.log('将 Deeper Device 添加到默认服务器列表')
        defaultServers.push('Deeper Device')
        defaultsChanged = true
      }

      // 保存更改
      if (serversChanged) {
        this.mcpStore.set('mcpServers', mcpServers)
      }
      if (defaultsChanged) {
        this.mcpStore.set('defaultServers', defaultServers)
      }

      if (serversChanged || defaultsChanged) {
        console.log('Deeper Device 配置清理完成')
      }
    } catch (error) {
      console.error('清理 Deeper Device 配置失败:', error)
    }
  }
}
