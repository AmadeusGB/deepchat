# Deeper Wallet MCP 迁移方案

## 概述

本文档记录了从独立的 Deeper Wallet MCP 项目迁移到 DeepChat 内置 MCP 服务的方案和流程。

## 原始项目结构

```
deeper-wallet-mcp/
├── index.js                    # 主入口文件，MCP服务器设置
├── instructions.js             # 服务描述和支持的网络列表
├── package.json                # 项目配置和依赖
├── .env                        # 环境变量（助记词等敏感信息）
└── deeperWallet/              # 核心钱包功能模块
    ├── index.js               # 主要钱包操作接口
    ├── eth.js                 # 以太坊和EVM链操作
    ├── solana.js              # Solana区块链操作
    ├── tron.js                # Tron区块链操作
    ├── sui.js                 # Sui区块链操作
    ├── bitcoin.js             # 比特币操作（如存在）
    ├── db.js                  # 数据库抽象接口
    ├── sqlite3.js             # SQLite数据库实现
    ├── log.js                 # 日志记录功能
    └── utils.js               # 工具函数
```

## 迁移后的结构

```
deepchat/src/main/presenter/mcpPresenter/inMemoryServers/
├── deeperWalletServer.ts          # 简化版钱包服务实现
└── DEEPER_WALLET_MCP_MIGRATION.md # 本文档
```

## 迁移策略

### 简化集成方案

考虑到原项目的复杂性和安全性要求，采用**简化集成方案**：

#### ✅ **已迁移的功能**

- **网络支持查询**：显示所有支持的区块链网络
- **余额查询**：原生代币余额查询（ETH、MATIC、SOL等）
- **代币余额查询**：ERC20/SPL代币余额查询
- **代币信息查询**：代币名称、符号、小数位数
- **地址验证**：不同区块链的地址格式验证

#### ❌ **暂未迁移的功能**

- **钱包管理**：HD钱包创建、导入、账户管理
- **交易签名**：私钥管理和交易签名
- **交易发送**：代币转账功能
- **本地数据库**：SQLite存储
- **价格查询**：代币价格和汇率

### 技术架构变更

#### 原始架构

- **运行方式**：独立进程，通过stdio通信
- **依赖管理**：Node.js + 多个区块链SDK
- **数据存储**：本地SQLite数据库
- **私钥管理**：外部hd-wallet.exe二进制文件
- **网络访问**：直接RPC调用多个区块链

#### 迁移后架构

- **运行方式**：DeepChat内存服务器
- **依赖管理**：TypeScript + axios（最小依赖）
- **数据存储**：无持久化存储（只读服务）
- **私钥管理**：无（安全考虑，不处理私钥）
- **网络访问**：公共RPC端点查询

## 支持的区块链网络

### 主网络 (Mainnets)

- **ETHEREUM** - 以太坊主网
- **ARBITRUM** - Arbitrum One
- **OPTIMISM** - Optimism主网
- **BASE** - Base主网
- **POLYGON** - Polygon主网
- **AVALANCHE** - Avalanche C-Chain
- **BNBSMARTCHAIN** - BNB智能链
- **SOLANA** - Solana主网
- **SUI** - Sui主网 (新增)
- **TRON** - Tron主网 (新增)
- **BITCOIN** - 比特币主网 (新增)

### 测试网络 (Testnets)

- **ETHEREUM-SEPOLIA** - 以太坊Sepolia测试网
- **ETHEREUM-HOLESKY** - 以太坊Holesky测试网 (新增)
- **POLYGON-MUMBAI** - Polygon Mumbai测试网 (新增)
- **SOLANA-DEVNET** - Solana开发网
- **SOLANA-TESTNET** - Solana测试网 (新增)
- **SUI-TESTNET** - Sui测试网 (新增)
- **BITCOIN-TESTNET** - 比特币测试网 (新增)

## 工具功能映射

| 原始工具                          | 迁移状态  | 新工具名称           | 功能描述           |
| --------------------------------- | --------- | -------------------- | ------------------ |
| getBalance                        | ✅ 已迁移 | getBalance           | 查询原生代币余额   |
| getContractBalance                | ✅ 已迁移 | getTokenBalance      | 查询代币合约余额   |
| getContractMeta                   | ✅ 已迁移 | getTokenMetadata     | 查询代币元数据     |
| accountList                       | ❌ 未迁移 | -                    | 需要钱包管理功能   |
| transferTokenFromMyWallet         | ❌ 未迁移 | -                    | 涉及私钥，安全风险 |
| transferContractTokenFromMyWallet | ❌ 未迁移 | -                    | 涉及私钥，安全风险 |
| -                                 | ✅ 新增   | getSupportedNetworks | 查看支持的网络列表 |
| -                                 | ✅ 新增   | validateAddress      | 验证地址格式       |
| -                                 | ✅ 新增   | getNetworkInfo       | 获取网络详细信息   |

## API端点使用

### 公共RPC端点配置

各网络使用的公共RPC端点：

**以太坊主网**：

- https://eth-mainnet.public.blastapi.io
- https://eth.llamarpc.com
- https://ethereum-rpc.publicnode.com

**Solana主网**：

- https://api.mainnet-beta.solana.com
- https://solana-api.projectserum.com

**Sui主网**：

- https://fullnode.mainnet.sui.io:443

**TRON主网**：

- https://api.trongrid.io

**Bitcoin主网**：

- https://blockstream.info/api

**其他网络**：类似配置多个备用端点以确保服务可用性

## 安全考虑

### 已实施的安全措施

1. **无私钥处理**：不涉及任何私钥操作
2. **只读操作**：仅提供查询功能，无写入操作
3. **地址验证**：严格的地址格式验证
4. **网络隔离**：仅使用公共RPC端点
5. **错误处理**：完善的异常处理和超时控制

### 不支持的功能原因

1. **交易签名**：需要私钥访问，存在安全风险
2. **钱包管理**：需要文件系统访问和外部二进制依赖
3. **数据库存储**：与DeepChat内存架构不兼容

## 使用示例

### 1. 查看支持的网络

```javascript
// 工具调用
getSupportedNetworks()

// 返回结果
[
  {
    "network": "ETHEREUM",
    "name": "Ethereum",
    "type": "EVM",
    "chainId": 1,
    "currency": "ETH"
  },
  ...
]
```

### 2. 查询ETH余额

```javascript
// 工具调用
getBalance({
  network: 'ETHEREUM',
  address: '0x742d35Cc6C7e8D87C2d7BC2482b0E46e0F6d1234'
})

// 返回结果
;('Balance: 1.234567 ETH')
```

### 3. 查询ERC20代币余额

```javascript
// 工具调用
getTokenBalance({
  network: 'ETHEREUM',
  address: '0x742d35Cc6C7e8D87C2d7BC2482b0E46e0F6d1234',
  contractAddress: '0xA0b86a33E6441E4CF6cE8c8FB62D7b0f7d3D7890'
})

// 返回结果
;('Token Balance: 1000000000000000000 (raw units)')
```

### 4. 查询代币信息

```javascript
// 工具调用
getTokenMetadata({
  network: 'ETHEREUM',
  contractAddress: '0xA0b86a33E6441E4CF6cE8c8FB62D7b0f7d3D7890'
})

// 返回结果
;('Name: Example Token\nSymbol: EXT\nDecimals: 18')
```

## 未来扩展计划

### 短期计划

1. **更多网络支持**：添加更多EVM兼容链
2. **批量查询**：支持一次查询多个地址
3. **缓存机制**：添加查询结果缓存

### 长期计划

1. **只读钱包集成**：支持查看钱包地址（无私钥）
2. **交易历史查询**：通过区块链浏览器API
3. **DeFi协议集成**：查询DeFi头寸和收益

### 安全增强计划

1. **请求限制**：添加API调用频率限制
2. **网络监控**：监控RPC端点可用性
3. **审计日志**：记录所有API调用

## 版本历史

| 版本  | 日期       | 变更说明                                                               |
| ----- | ---------- | ---------------------------------------------------------------------- |
| 1.0.0 | 2025-01-07 | 初始简化版本集成完成                                                   |
| 1.1.0 | 2025-01-12 | 新增SUI、TRON、Bitcoin网络支持，新增getNetworkInfo工具，添加更多测试网 |

## 相关文件

- `deeperWalletServer.ts` - 主要服务器实现
- `builder.ts` - 服务器构建器配置
- `mcpConfHelper.ts` - MCP配置管理
- `/Users/binguo/workspaces/deeper-wallet-mcp/` - 原始项目路径

## 故障排除

### 常见问题

**Q: 为什么不支持交易功能？**
A: 出于安全考虑，当前版本不处理私钥和交易签名。如需交易功能，请使用原始独立版本。

**Q: 如何添加新的区块链网络？**  
A: 在`deeperWalletServer.ts`的`SUPPORTED_NETWORKS`配置中添加新网络的RPC端点和参数。

**Q: 查询失败怎么办？**
A: 服务使用多个RPC端点备份，如果所有端点都失败，请检查网络连接或等待片刻重试。

**Q: 支持哪些代币标准？**
A: 当前支持EVM网络的ERC20代币，未来计划支持SPL（Solana）和其他代币标准。
