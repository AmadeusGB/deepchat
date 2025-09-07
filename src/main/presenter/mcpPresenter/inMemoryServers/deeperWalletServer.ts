import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import axios from 'axios'

// Network configurations
const SUPPORTED_NETWORKS = {
  // Ethereum Mainnets
  ETHEREUM: {
    name: 'Ethereum',
    type: 'EVM',
    chainId: 1,
    rpcUrls: [
      'https://eth-mainnet.public.blastapi.io',
      'https://eth.llamarpc.com',
      'https://ethereum-rpc.publicnode.com'
    ],
    currency: 'ETH'
  },
  ARBITRUM: {
    name: 'Arbitrum One',
    type: 'EVM',
    chainId: 42161,
    rpcUrls: [
      'https://arbitrum-rpc.publicnode.com',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one-rpc.publicnode.com'
    ],
    currency: 'ETH'
  },
  OPTIMISM: {
    name: 'Optimism',
    type: 'EVM',
    chainId: 10,
    rpcUrls: [
      'https://optimism-rpc.publicnode.com',
      'https://optimism.llamarpc.com',
      'https://rpc.ankr.com/optimism'
    ],
    currency: 'ETH'
  },
  BASE: {
    name: 'Base',
    type: 'EVM',
    chainId: 8453,
    rpcUrls: [
      'https://base.llamarpc.com',
      'https://developer-access-mainnet.base.org',
      'https://base-mainnet.public.blastapi.io'
    ],
    currency: 'ETH'
  },
  POLYGON: {
    name: 'Polygon',
    type: 'EVM',
    chainId: 137,
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-mainnet.public.blastapi.io'
    ],
    currency: 'MATIC'
  },
  AVALANCHE: {
    name: 'Avalanche',
    type: 'EVM',
    chainId: 43114,
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche',
      'https://avalanche-c-chain-rpc.publicnode.com'
    ],
    currency: 'AVAX'
  },
  BNBSMARTCHAIN: {
    name: 'BNB Smart Chain',
    type: 'EVM',
    chainId: 56,
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://rpc.ankr.com/bsc',
      'https://bsc-mainnet.public.blastapi.io'
    ],
    currency: 'BNB'
  },
  // Testnets
  'ETHEREUM-SEPOLIA': {
    name: 'Ethereum Sepolia',
    type: 'EVM',
    chainId: 11155111,
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://1rpc.io/sepolia',
      'https://sepolia.gateway.tenderly.co'
    ],
    currency: 'ETH'
  },
  // Solana
  SOLANA: {
    name: 'Solana Mainnet',
    type: 'SOLANA',
    rpcUrls: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com'
    ],
    currency: 'SOL'
  },
  'SOLANA-DEVNET': {
    name: 'Solana Devnet',
    type: 'SOLANA',
    rpcUrls: [
      'https://api.devnet.solana.com'
    ],
    currency: 'SOL'
  }
} as const

type NetworkKey = keyof typeof SUPPORTED_NETWORKS

// EVM Contract selectors
const CONTRACT_SELECTORS = {
  BALANCE_OF: '0x70a08231',
  NAME: '0x06fdde03',
  SYMBOL: '0x95d89b41',
  DECIMALS: '0x313ce567'
}

// Helper functions
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

function hexToDecimal(hex: string): string {
  if (hex.startsWith('0x')) {
    hex = hex.slice(2)
  }
  return BigInt('0x' + hex).toString()
}

// Core RPC functions
async function makeRpcCall(
  network: NetworkKey,
  method: string,
  params: unknown[] = []
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const networkConfig = SUPPORTED_NETWORKS[network]
  if (!networkConfig) {
    return { success: false, error: `Unsupported network: ${network}` }
  }

  for (const rpcUrl of networkConfig.rpcUrls) {
    try {
      const response = await axios.post(
        rpcUrl,
        {
          jsonrpc: '2.0',
          method,
          params,
          id: 1
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.error) {
        return { success: false, error: response.data.error.message }
      }

      return { success: true, data: response.data.result }
    } catch (error) {
      console.warn(`RPC call failed for ${rpcUrl}:`, error)
      continue
    }
  }

  return { success: false, error: `All RPC endpoints failed for ${network}` }
}

// EVM balance functions
async function getEVMBalance(
  network: NetworkKey,
  address: string
): Promise<{ success: boolean; balance?: string; error?: string }> {
  if (!isValidEthereumAddress(address)) {
    return { success: false, error: 'Invalid Ethereum address format' }
  }

  const result = await makeRpcCall(network, 'eth_getBalance', [address, 'latest'])
  if (!result.success) {
    return { success: false, error: result.error }
  }

  const balance = hexToDecimal(result.data as string)
  return { success: true, balance }
}

async function getEVMTokenBalance(
  network: NetworkKey,
  address: string,
  contractAddress: string
): Promise<{ success: boolean; balance?: string; error?: string }> {
  if (!isValidEthereumAddress(address) || !isValidEthereumAddress(contractAddress)) {
    return { success: false, error: 'Invalid address format' }
  }

  // Encode balanceOf call data
  const paddedAddress = address.slice(2).padStart(64, '0')
  const data = CONTRACT_SELECTORS.BALANCE_OF + paddedAddress

  const result = await makeRpcCall(network, 'eth_call', [
    {
      to: contractAddress,
      data
    },
    'latest'
  ])

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const balance = hexToDecimal(result.data as string)
  return { success: true, balance }
}

async function getEVMTokenMetadata(
  network: NetworkKey,
  contractAddress: string
): Promise<{
  success: boolean
  name?: string
  symbol?: string
  decimals?: number
  error?: string
}> {
  if (!isValidEthereumAddress(contractAddress)) {
    return { success: false, error: 'Invalid contract address format' }
  }

  try {
    // Get name
    const nameResult = await makeRpcCall(network, 'eth_call', [
      { to: contractAddress, data: CONTRACT_SELECTORS.NAME },
      'latest'
    ])

    // Get symbol
    const symbolResult = await makeRpcCall(network, 'eth_call', [
      { to: contractAddress, data: CONTRACT_SELECTORS.SYMBOL },
      'latest'
    ])

    // Get decimals
    const decimalsResult = await makeRpcCall(network, 'eth_call', [
      { to: contractAddress, data: CONTRACT_SELECTORS.DECIMALS },
      'latest'
    ])

    const name = nameResult.data ? hexToString(nameResult.data as string) : ''
    const symbol = symbolResult.data ? hexToString(symbolResult.data as string) : ''
    const decimals = decimalsResult.data ? parseInt(hexToDecimal(decimalsResult.data as string)) : 18

    return {
      success: true,
      name,
      symbol,
      decimals
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get token metadata'
    }
  }
}

function hexToString(hex: string): string {
  if (!hex || hex === '0x') return ''
  
  // Remove 0x prefix if present
  if (hex.startsWith('0x')) {
    hex = hex.slice(2)
  }

  // Convert hex to bytes and then to string, removing null bytes
  let result = ''
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16)
    if (byte !== 0) {
      result += String.fromCharCode(byte)
    }
  }

  return result.trim()
}

// Solana functions
async function getSolanaBalance(
  network: NetworkKey,
  address: string
): Promise<{ success: boolean; balance?: string; error?: string }> {
  if (!isValidSolanaAddress(address)) {
    return { success: false, error: 'Invalid Solana address format' }
  }

  const result = await makeRpcCall(network, 'getBalance', [address])
  if (!result.success) {
    return { success: false, error: result.error }
  }

  const balanceData = result.data as { value: number }
  return { success: true, balance: balanceData.value.toString() }
}

export class DeeperWalletServer {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'deepchat-inmemory/deeper-wallet-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupTools()
  }

  private setupTools() {
    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'getSupportedNetworks',
            description: '🌐 查看支持的区块链网络 - 显示所有支持的主网和测试网络列表，包括网络名称、类型、链ID和本地货币',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'getBalance',
            description: '💰 查询地址余额 - 获取指定区块链网络上特定地址的原生代币余额（如ETH、MATIC、SOL等）',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称，如 ETHEREUM、SOLANA、POLYGON 等'),
                address: z.string().describe('要查询的钱包地址')
              })
            )
          },
          {
            name: 'getTokenBalance',
            description: '🪙 查询代币余额 - 获取指定地址在特定合约代币的余额（如ERC20、SPL代币等）',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称'),
                address: z.string().describe('钱包地址'),
                contractAddress: z.string().describe('代币合约地址')
              })
            )
          },
          {
            name: 'getTokenMetadata',
            description: '🏷️ 查询代币信息 - 获取代币合约的基本信息，包括名称、符号、小数位数等元数据',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称'),
                contractAddress: z.string().describe('代币合约地址')
              })
            )
          },
          {
            name: 'validateAddress',
            description: '✅ 验证地址格式 - 验证给定地址是否符合指定区块链网络的地址格式规范',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称'),
                address: z.string().describe('要验证的地址')
              })
            )
          }
        ]
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'getSupportedNetworks': {
            const networks = Object.entries(SUPPORTED_NETWORKS).map(([key, config]) => ({
              network: key,
              name: config.name,
              type: config.type,
              chainId: 'chainId' in config ? config.chainId : undefined,
              currency: config.currency
            }))

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(networks, null, 2)
                }
              ]
            }
          }

          case 'getBalance': {
            const { network, address } = z
              .object({
                network: z.string(),
                address: z.string()
              })
              .parse(args)

            const networkKey = network.toUpperCase() as NetworkKey
            if (!(networkKey in SUPPORTED_NETWORKS)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Unsupported network: ${network}. Use getSupportedNetworks to see available networks.`
                  }
                ]
              }
            }

            const networkConfig = SUPPORTED_NETWORKS[networkKey]
            let result

            if (networkConfig.type === 'EVM') {
              result = await getEVMBalance(networkKey, address)
            } else if (networkConfig.type === 'SOLANA') {
              result = await getSolanaBalance(networkKey, address)
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Network type ${(networkConfig as any).type} not yet implemented`
                  }
                ]
              }
            }

            if (result.success) {
              // Convert to readable format (assuming 18 decimals for EVM, 9 for Solana)
              const decimals = networkConfig.type === 'SOLANA' ? 9 : 18
              const balance = BigInt(result.balance!)
              const divisor = BigInt(10 ** decimals)
              const readable = (Number(balance) / Number(divisor)).toFixed(6)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Address: ${address}\nNetwork: ${networkConfig.name}\nBalance: ${readable} ${networkConfig.currency}\nRaw Balance: ${result.balance} (smallest unit)`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get balance: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'getTokenBalance': {
            const { network, address, contractAddress } = z
              .object({
                network: z.string(),
                address: z.string(),
                contractAddress: z.string()
              })
              .parse(args)

            const networkKey = network.toUpperCase() as NetworkKey
            if (!(networkKey in SUPPORTED_NETWORKS)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Unsupported network: ${network}`
                  }
                ]
              }
            }

            const networkConfig = SUPPORTED_NETWORKS[networkKey]

            if (networkConfig.type !== 'EVM') {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Token balance queries currently only supported for EVM networks'
                  }
                ]
              }
            }

            const result = await getEVMTokenBalance(networkKey, address, contractAddress)

            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Address: ${address}\nContract: ${contractAddress}\nNetwork: ${networkConfig.name}\nToken Balance: ${result.balance} (raw units)\n\nNote: Use getTokenMetadata to get decimals for proper formatting`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get token balance: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'getTokenMetadata': {
            const { network, contractAddress } = z
              .object({
                network: z.string(),
                contractAddress: z.string()
              })
              .parse(args)

            const networkKey = network.toUpperCase() as NetworkKey
            if (!(networkKey in SUPPORTED_NETWORKS)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Unsupported network: ${network}`
                  }
                ]
              }
            }

            const networkConfig = SUPPORTED_NETWORKS[networkKey]

            if (networkConfig.type !== 'EVM') {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Token metadata queries currently only supported for EVM networks'
                  }
                ]
              }
            }

            const result = await getEVMTokenMetadata(networkKey, contractAddress)

            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Contract: ${contractAddress}\nNetwork: ${networkConfig.name}\nName: ${result.name || 'Unknown'}\nSymbol: ${result.symbol || 'Unknown'}\nDecimals: ${result.decimals || 18}`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get token metadata: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'validateAddress': {
            const { network, address } = z
              .object({
                network: z.string(),
                address: z.string()
              })
              .parse(args)

            const networkKey = network.toUpperCase() as NetworkKey
            if (!(networkKey in SUPPORTED_NETWORKS)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Unsupported network: ${network}`
                  }
                ]
              }
            }

            const networkConfig = SUPPORTED_NETWORKS[networkKey]
            let isValid = false

            if (networkConfig.type === 'EVM') {
              isValid = isValidEthereumAddress(address)
            } else if (networkConfig.type === 'SOLANA') {
              isValid = isValidSolanaAddress(address)
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Address: ${address}\nNetwork: ${networkConfig.name}\nType: ${networkConfig.type}\nValid: ${isValid ? '✅ Yes' : '❌ No'}`
                }
              ]
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true
        }
      }
    })
  }

  // 启动服务器
  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // 提供对server的访问方法，供外部调用
  public getServer(): Server {
    return this.server
  }
}