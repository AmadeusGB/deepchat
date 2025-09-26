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
  // Additional EVM networks
  HOLESKY: {
    name: 'Holesky Testnet',
    type: 'EVM',
    chainId: 17000,
    rpcUrls: [
      'https://ethereum-holesky-rpc.publicnode.com',
      'https://holesky.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    ],
    currency: 'ETH'
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
  'ETHEREUM-HOLESKY': {
    name: 'Ethereum Holesky',
    type: 'EVM',
    chainId: 17000,
    rpcUrls: [
      'https://ethereum-holesky-rpc.publicnode.com',
      'https://holesky.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    ],
    currency: 'ETH'
  },
  'POLYGON-MUMBAI': {
    name: 'Polygon Mumbai',
    type: 'EVM',
    chainId: 80001,
    rpcUrls: [
      'https://rpc-mumbai.maticvigil.com',
      'https://polygon-mumbai.blockpi.network/v1/rpc/public'
    ],
    currency: 'MATIC'
  },
  // Solana
  SOLANA: {
    name: 'Solana Mainnet',
    type: 'SOLANA',
    rpcUrls: ['https://api.mainnet-beta.solana.com', 'https://solana-api.projectserum.com'],
    currency: 'SOL'
  },
  'SOLANA-DEVNET': {
    name: 'Solana Devnet',
    type: 'SOLANA',
    rpcUrls: ['https://api.devnet.solana.com'],
    currency: 'SOL'
  },
  'SOLANA-TESTNET': {
    name: 'Solana Testnet',
    type: 'SOLANA',
    rpcUrls: ['https://api.testnet.solana.com'],
    currency: 'SOL'
  },
  // SUI Network
  SUI: {
    name: 'Sui Mainnet',
    type: 'SUI',
    rpcUrls: ['https://fullnode.mainnet.sui.io:443'],
    currency: 'SUI'
  },
  'SUI-TESTNET': {
    name: 'Sui Testnet',
    type: 'SUI',
    rpcUrls: ['https://fullnode.testnet.sui.io:443'],
    currency: 'SUI'
  },
  // TRON Network
  TRON: {
    name: 'TRON Mainnet',
    type: 'TRON',
    rpcUrls: ['https://api.trongrid.io'],
    currency: 'TRX'
  },
  // Bitcoin
  BITCOIN: {
    name: 'Bitcoin Mainnet',
    type: 'BITCOIN',
    rpcUrls: ['https://blockstream.info/api'],
    currency: 'BTC'
  },
  'BITCOIN-TESTNET': {
    name: 'Bitcoin Testnet',
    type: 'BITCOIN',
    rpcUrls: ['https://blockstream.info/testnet/api'],
    currency: 'BTC'
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

function isValidSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address)
}

function isValidTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

function isValidBitcoinAddress(address: string): boolean {
  // Bitcoin mainnet: starts with 1, 3, or bc1
  // Bitcoin testnet: starts with m, n, 2, or tb1
  return /^(1|3|bc1|m|n|2|tb1)[a-zA-Z0-9]{25,62}$/.test(address)
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
    const decimals = decimalsResult.data
      ? parseInt(hexToDecimal(decimalsResult.data as string))
      : 18

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
    const byte = parseInt(hex.substring(i, i + 2), 16)
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

// Uniswap swap implementation
interface SwapOptions {
  version?: string
  slippage?: number
  deadline?: number
  fee?: number
}

interface SwapParams {
  fromAddress: string
  fromToken: string
  toToken: string
  amountIn: string
  amountOutMin: string
  network: NetworkKey
  options: SwapOptions
}

interface SwapResult {
  success: boolean
  hash?: string
  amountOut?: string
  gasUsed?: string
  error?: string
}

async function executeUniswapSwap(params: SwapParams): Promise<SwapResult> {
  // For now, return a simulated result since we need to integrate the full uniswap.js functionality
  // This would be replaced with actual swap execution from deeper-wallet-mcp
  const { fromToken, toToken, amountIn, network, options } = params

  return {
    success: false,
    error: `Uniswap ${options.version || 'V3'} swap functionality is being integrated. Attempted to swap ${amountIn} ${fromToken} to ${toToken} on ${network}.`
  }
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
            description:
              '🌐 查看支持的区块链网络 - 显示所有支持的主网和测试网络列表，包括网络名称、类型、链ID和本地货币',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'getBalance',
            description:
              '💰 查询地址余额 - 获取指定区块链网络上特定地址的原生代币余额（如ETH、MATIC、SOL等）',
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
            description:
              '🏷️ 查询代币信息 - 获取代币合约的基本信息，包括名称、符号、小数位数等元数据',
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
          },
          {
            name: 'getNetworkInfo',
            description:
              '📋 获取网络详细信息 - 获取指定区块链网络的详细配置信息，包括RPC端点、链ID等',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称')
              })
            )
          },
          {
            name: 'swapTokens',
            description: '💱 交换代币 - 使用 Uniswap 在指定的区块链网络上交换代币',
            inputSchema: zodToJsonSchema(
              z.object({
                fromAddress: z.string().describe('发送者地址'),
                fromToken: z
                  .string()
                  .describe('要交换的代币符号或地址（例如 "eth" 或 ERC20 地址）'),
                toToken: z
                  .string()
                  .describe('要交换到的代币符号或地址（例如 "usdc" 或 ERC20 地址）'),
                amountIn: z.string().describe('要交换的金额（以最小单位的字符串形式）'),
                amountOutMin: z
                  .string()
                  .optional()
                  .default('0')
                  .describe('最小接收金额（以最小单位的字符串形式）'),
                network: z.string().describe('区块链网络名称，如 ETHEREUM、POLYGON 等'),
                options: z
                  .object({
                    version: z.string().optional().describe('Uniswap 版本，例如 "V3"'),
                    slippage: z.number().optional().describe('滑点容忍度（百分比）'),
                    deadline: z.number().optional().describe('交易截止时间（Unix时间戳）'),
                    fee: z.number().optional().describe('手续费级别（3000=0.3%）')
                  })
                  .optional()
                  .describe('其他交换选项')
              })
            )
          },
          {
            name: 'accountList',
            description: '👤 获取钱包账户列表 - 获取本地钱包中所有可用的账户地址列表',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'transferTokenFromMyWallet',
            description: '💸 转账原生代币 - 从我的钱包地址向其他地址转账原生代币（如ETH、MATIC、SOL等）',
            inputSchema: zodToJsonSchema(
              z.object({
                toAddress: z.string().describe('接收者地址'),
                amount: z.string().describe('转账金额（以最小单位的字符串形式）'),
                network: z.string().describe('区块链网络名称，如 ETHEREUM、POLYGON 等')
              })
            )
          },
          {
            name: 'transferContractTokenFromMyWallet',
            description: '🪙 转账合约代币 - 从我的钱包地址向其他地址转账合约代币（如ERC20、SPL代币等）',
            inputSchema: zodToJsonSchema(
              z.object({
                toAddress: z.string().describe('接收者地址'),
                contract: z.string().describe('代币合约地址'),
                amount: z.string().describe('转账金额（以最小单位的字符串形式）'),
                network: z.string().describe('区块链网络名称')
              })
            )
          },
          {
            name: 'getTokenPrice',
            description: '💹 获取代币价格 - 获取两个代币之间的当前价格信息和流动性池数据',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称'),
                tokenA: z.string().describe('第一个代币的合约地址'),
                tokenB: z.string().describe('第二个代币的合约地址')
              })
            )
          },
          {
            name: 'getAllPools',
            description: '🏊 获取所有流动性池 - 获取两个代币之间所有可用的流动性池信息',
            inputSchema: zodToJsonSchema(
              z.object({
                network: z.string().describe('区块链网络名称'),
                tokenA: z.string().describe('第一个代币的合约地址'),
                tokenB: z.string().describe('第二个代币的合约地址')
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
            let result: { success: boolean; balance?: string; error?: string }

            if (networkConfig.type === 'EVM') {
              result = await getEVMBalance(networkKey, address)
            } else if (networkConfig.type === 'SOLANA') {
              result = await getSolanaBalance(networkKey, address)
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Network type ${networkConfig.type} not yet implemented`
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
            } else if (networkConfig.type === 'SUI') {
              isValid = isValidSuiAddress(address)
            } else if (networkConfig.type === 'TRON') {
              isValid = isValidTronAddress(address)
            } else if (networkConfig.type === 'BITCOIN') {
              isValid = isValidBitcoinAddress(address)
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

          case 'getNetworkInfo': {
            const { network } = z
              .object({
                network: z.string()
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
            const networkInfo = {
              network: networkKey,
              name: networkConfig.name,
              type: networkConfig.type,
              currency: networkConfig.currency,
              chainId: 'chainId' in networkConfig ? networkConfig.chainId : undefined,
              rpcUrls: networkConfig.rpcUrls
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Network Information:\n${JSON.stringify(networkInfo, null, 2)}`
                }
              ]
            }
          }

          case 'swapTokens': {
            const { fromAddress, fromToken, toToken, amountIn, amountOutMin, network, options } = z
              .object({
                fromAddress: z.string(),
                fromToken: z.string(),
                toToken: z.string(),
                amountIn: z.string(),
                amountOutMin: z.string().optional().default('0'),
                network: z.string(),
                options: z
                  .object({
                    version: z.string().optional(),
                    slippage: z.number().optional(),
                    deadline: z.number().optional(),
                    fee: z.number().optional()
                  })
                  .optional()
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

            // Check if network is EVM-based (Uniswap only works on EVM chains)
            if (networkConfig.type !== 'EVM') {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Token swapping via Uniswap is only supported on EVM-compatible networks. ${network} is a ${networkConfig.type} network.`
                  }
                ]
              }
            }

            try {
              // Execute the actual swap using deeper-wallet-mcp functionality
              const swapResult = await executeUniswapSwap({
                fromAddress,
                fromToken: fromToken.toLowerCase(),
                toToken: toToken.toLowerCase(),
                amountIn,
                amountOutMin,
                network: networkKey,
                options: {
                  version: options?.version || 'V3',
                  slippage: options?.slippage || 0.5,
                  deadline: options?.deadline || Math.floor(Date.now() / 1000) + 3600,
                  fee: options?.fee || 3000
                }
              })

              if (swapResult.success) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `✅ Swap executed successfully!\n\nTransaction Hash: ${swapResult.hash}\nNetwork: ${networkConfig.name}\nFrom: ${fromToken} → To: ${toToken}\nAmount In: ${amountIn}\nAmount Out: ${swapResult.amountOut || 'Unknown'}\nGas Used: ${swapResult.gasUsed || 'Unknown'}\nUniswap Version: ${options?.version || 'V3'}`
                    }
                  ]
                }
              } else {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `❌ Swap failed: ${swapResult.error}`
                    }
                  ]
                }
              }
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ Swap execution error: ${error instanceof Error ? error.message : String(error)}`
                  }
                ]
              }
            }
          }

          case 'accountList': {
            // Simulate account list - in real implementation this would come from deeper-wallet-mcp
            const mockAccounts = [
              {
                address: '0x742d35cc6634C0532925a3b8D21F21e1a3f2a007',
                chain_type: 'ETHEREUM',
                index: 0,
                derivePath: "m/44'/60'/0'/0/0"
              },
              {
                address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
                chain_type: 'SOLANA',
                index: 0,
                derivePath: "m/44'/501'/0'/0'"
              }
            ]

            return {
              content: [
                {
                  type: 'text',
                  text: `Available Wallet Accounts:\n${JSON.stringify(mockAccounts, null, 2)}\n\nNote: This is simulated data. In a real implementation, this would show actual wallet accounts from the deeper-wallet-mcp service.`
                }
              ]
            }
          }

          case 'transferTokenFromMyWallet': {
            const { toAddress, amount, network } = z
              .object({
                toAddress: z.string(),
                amount: z.string(),
                network: z.string()
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

            // Simulate transfer result
            const transferInfo = {
              network: networkKey,
              networkName: networkConfig.name,
              toAddress,
              amount,
              currency: networkConfig.currency,
              status: 'simulated',
              estimatedGas: networkConfig.type === 'EVM' ? '21000' : '5000'
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Token Transfer (Simulated):\n${JSON.stringify(transferInfo, null, 2)}\n\nNote: This is a simulated transfer. In a real implementation, this would execute the transfer using the deeper-wallet-mcp service.`
                }
              ]
            }
          }

          case 'transferContractTokenFromMyWallet': {
            const { toAddress, contract, amount, network } = z
              .object({
                toAddress: z.string(),
                contract: z.string(),
                amount: z.string(),
                network: z.string()
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

            // Simulate contract token transfer result
            const transferInfo = {
              network: networkKey,
              networkName: networkConfig.name,
              toAddress,
              contract,
              amount,
              status: 'simulated',
              estimatedGas: networkConfig.type === 'EVM' ? '65000' : '10000'
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Contract Token Transfer (Simulated):\n${JSON.stringify(transferInfo, null, 2)}\n\nNote: This is a simulated transfer. In a real implementation, this would execute the contract token transfer using the deeper-wallet-mcp service.`
                }
              ]
            }
          }

          case 'getTokenPrice': {
            const { network, tokenA, tokenB } = z
              .object({
                network: z.string(),
                tokenA: z.string(),
                tokenB: z.string()
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

            if (networkConfig.type !== 'EVM') {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Token price queries currently only supported for EVM networks. ${network} is a ${networkConfig.type} network.`
                  }
                ]
              }
            }

            // Simulate token price data
            const priceInfo = {
              network: networkKey,
              networkName: networkConfig.name,
              tokenA,
              tokenB,
              price: '0.000567',
              priceInverse: '1762.34',
              liquidityUSD: '2,456,789.12',
              volume24h: '1,234,567.89',
              priceChange24h: '+2.34%',
              poolAddress: '0x1234567890abcdef1234567890abcdef12345678',
              status: 'simulated'
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Token Price Information (Simulated):\n${JSON.stringify(priceInfo, null, 2)}\n\nNote: This is simulated price data. In a real implementation, this would fetch live prices from Uniswap pools using the deeper-wallet-mcp service.`
                }
              ]
            }
          }

          case 'getAllPools': {
            const { network, tokenA, tokenB } = z
              .object({
                network: z.string(),
                tokenA: z.string(),
                tokenB: z.string()
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

            if (networkConfig.type !== 'EVM') {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Pool queries currently only supported for EVM networks. ${network} is a ${networkConfig.type} network.`
                  }
                ]
              }
            }

            // Simulate pool data
            const pools = [
              {
                poolAddress: '0x1234567890abcdef1234567890abcdef12345678',
                version: 'V3',
                fee: 3000,
                liquidity: '123456789012345678901234',
                sqrtPriceX96: '987654321098765432109876',
                tick: 12345,
                token0: tokenA,
                token1: tokenB,
                tickSpacing: 60
              },
              {
                poolAddress: '0x2345678901bcdef01234567890abcdef23456789',
                version: 'V3',
                fee: 500,
                liquidity: '987654321098765432109876',
                sqrtPriceX96: '123456789012345678901234',
                tick: -6789,
                token0: tokenA,
                token1: tokenB,
                tickSpacing: 10
              },
              {
                poolAddress: '0x3456789012cdef012345678901bcdef034567890',
                version: 'V2',
                fee: 3000,
                reserve0: '123456789012345678901234',
                reserve1: '987654321098765432109876',
                token0: tokenA,
                token1: tokenB
              }
            ]

            return {
              content: [
                {
                  type: 'text',
                  text: `Available Liquidity Pools (Simulated):\n${JSON.stringify({ network: networkKey, networkName: networkConfig.name, pools, totalPools: pools.length }, null, 2)}\n\nNote: This is simulated pool data. In a real implementation, this would fetch actual pool information from Uniswap using the deeper-wallet-mcp service.`
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
