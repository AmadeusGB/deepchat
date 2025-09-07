# Deeper MCP 迁移方案

## 概述

本文档记录了从独立的 Deeper MCP 项目迁移到 DeepChat 内置 MCP 服务的方案和流程。

## 原始项目结构

```
deeper-device-mcp/
├── src/
│   ├── index.ts           # 独立运行的入口文件
│   ├── server.ts          # MCP服务器创建和配置
│   ├── functions.ts       # 核心功能函数
│   ├── instructions.ts    # 服务器指令说明
│   ├── state.ts           # 状态管理
│   ├── public.ts          # 公共常量和类型
│   └── tools/             # 工具分类
│       ├── dpn.ts         # DPN网络相关工具
│       ├── parental.ts    # 家长控制工具
│       └── system.ts      # 系统管理工具
├── package.json
└── tsconfig.json
```

## 迁移后的结构

```
deepchat/src/main/presenter/mcpPresenter/inMemoryServers/
├── deeperDeviceServer.ts  # 合并后的完整服务器实现
└── DEEPER_MCP_MIGRATION.md  # 本文档
```

## 迁移过程记录

### 1. 代码合并策略

原始项目使用模块化的方式分离了不同的功能，迁移时采用了**合并策略**：

- 将所有工具函数合并到 `deeperDeviceServer.ts` 中
- 保持原有的API接口和功能不变
- 适配 DeepChat 的 MCP 服务器接口规范

### 2. 关键变更

#### 2.1 服务器类结构

- **原始**: 使用函数式创建服务器 (`getServer()`)
- **迁移后**: 使用类结构 (`DeeperDeviceServer`)

#### 2.2 传输层适配

- **原始**: 使用 `StdioServerTransport`
- **迁移后**: 使用 `Transport` 接口，支持内存传输

#### 2.3 配置集成

- **原始**: 独立的配置管理
- **迁移后**: 集成到 DeepChat 的 MCP 配置系统

### 3. 核心功能映射

| 原始功能 | 迁移后位置              | 说明                 |
| -------- | ----------------------- | -------------------- |
| DPN 管理 | `deeperDeviceServer.ts` | 保持所有DPN相关功能  |
| 家长控制 | `deeperDeviceServer.ts` | 保持所有家长控制功能 |
| 系统管理 | `deeperDeviceServer.ts` | 保持所有系统管理功能 |
| 状态管理 | `deeperDeviceServer.ts` | 全局状态变量         |
| 指令说明 | `deeperDeviceServer.ts` | 嵌入到工具设置中     |

## 后续迁移流程

### 自动化迁移脚本

为了确保后续更新的一致性，建议创建以下迁移脚本：

```bash
#!/bin/bash
# migrate-deeper-mcp.sh

# 1. 备份当前版本
cp deeperDeviceServer.ts deeperDeviceServer.ts.backup

# 2. 从原始项目提取最新代码
# 3. 应用迁移模板
# 4. 验证功能完整性
# 5. 更新配置文件
```

### 手动迁移步骤

1. **代码更新**：

   ```bash
   cd /Users/binguo/workspaces/deeper-device-mcp
   git pull origin main
   ```

2. **功能对比**：
   - 检查 `src/tools/` 下的新增或修改的工具
   - 检查 `src/functions.ts` 中的核心功能变更
   - 检查 `src/instructions.ts` 中的指令更新

3. **迁移更改**：
   - 将新功能添加到 `deeperDeviceServer.ts` 的对应位置
   - 更新工具定义和描述
   - 更新指令说明

4. **配置更新**：
   - 如需要，更新 `mcpConfHelper.ts` 中的服务器配置
   - 检查环境变量和依赖变更

5. **测试验证**：
   - 运行 `npm run dev` 启动 DeepChat
   - 测试所有 Deeper Device 相关功能
   - 验证与原始项目的功能一致性

### 重要注意事项

1. **接口兼容性**：
   - 保持所有工具的名称和参数结构不变
   - 确保返回值格式与原始项目一致

2. **依赖管理**：
   - 检查原始项目的 `package.json` 依赖更新
   - 确保 DeepChat 项目包含所需的依赖

3. **配置变更**：
   - 监控原始项目的配置变更
   - 及时更新 DeepChat 中的相关配置

4. **版本同步**：
   - 记录每次迁移的版本号
   - 维护变更日志

## 迁移检查清单

### 代码迁移

- [ ] 所有工具函数已迁移
- [ ] 状态管理逻辑已迁移
- [ ] 指令说明已更新
- [ ] 错误处理逻辑已迁移

### 配置迁移

- [ ] 服务器配置已更新
- [ ] 默认服务器列表已更新
- [ ] 环境变量已配置
- [ ] 权限设置已配置

### 功能验证

- [ ] 所有DPN功能正常工作
- [ ] 所有家长控制功能正常工作
- [ ] 所有系统管理功能正常工作
- [ ] 与原始项目功能一致

### 集成验证

- [ ] 在DeepChat中能正常启动
- [ ] 在MCP服务器列表中显示正常
- [ ] 工具调用正常响应
- [ ] 错误处理正常工作

## 版本历史

| 版本  | 日期       | 变更说明                                                                       |
| ----- | ---------- | ------------------------------------------------------------------------------ |
| 1.0.0 | 2024-07-09 | 初始迁移完成                                                                   |
| 1.0.1 | 2024-07-09 | 优化显示名称：从 "deepchat-inmemory/deeper-device-server" 改为 "Deeper Device" |
| 2.0.0 | 2025-01-07 | **重大功能更新** - 同步原项目最新功能，新增11个工具和30+个API函数               |

## 2.0.0 版本更新详情

### 新增功能模块

#### 🔐 访问控制管理
- **listAccessControl** - 查看设备访问控制列表
- **setAccessControl** - 配置设备访问控制  
- **updateOneAccessControlDevice** - 更新单个设备配置
- 新增设备状态管理：在线/离线设备分类显示
- 支持设备路由模式、HTTPS过滤、域名绕过、带宽限制配置

#### 🌐 网络共享功能
- **enableSharingState** - 配置网络共享状态
- **setBtSharing** - BitTorrent共享配置
- **setSmtpSharing** - SMTP共享配置
- **setSharingTrafficLimit** - 共享流量限制（GB）
- **setSharingBandwidthLimit** - 共享带宽限制（Mbps）

#### 🔍 DPN增强功能
- **deleteTunnels** - 批量删除DPN隧道
- **testTunnelsConnectivity** - 隧道连接性测试与自动修复
- 新增隧道节点切换和刷新功能
- 集成ping连接性检测

#### 📊 系统信息聚合
- **getDeeperSystemInfo** - 综合系统信息获取
- 集成软件版本、硬件信息、网络地址、会话统计
- 一次性获取全面系统状态

### 技术架构增强

#### 新增接口定义
```typescript
interface AccessControlDevice {
  mac: string
  createdAt: number
  name: string
  routeMode: string
  regionCode: string | null
  httpsFilter: boolean
  remark: string
  pinned: boolean
  bypass: string[]
  bwLimit: number
  ip: string
}
```

#### 状态管理扩展
- 新增设备列表状态管理 `deviceList: AccessControlDevice[]`
- 新增设备列表操作函数 `getDeviceList()`, `setDeviceList()`

#### API端点映射
- `/api/accessControl/*` - 访问控制相关API
- `/api/sharing/*` - 网络共享相关API
- `/api/system-info/*` - 系统信息相关API
- `/api/smartRoute/deleteTunnels` - 隧道删除API
- `/api/smartRoute/switchNode` - 节点切换API
- `/api/smartRoute/refreshTunnel` - 隧道刷新API

### 新增核心函数

#### 访问控制函数 (6个)
- `listAccessControl()` - 获取设备列表
- `setOneAccessControl()` - 更新设备配置
- `switchAccessControl()` - 启用/禁用访问控制
- `getAccessControlSwitch()` - 获取访问控制状态
- `ensureAccessControlSwitch()` - 确保访问控制启用

#### 网络共享函数 (6个)
- `getSharingConfig()` - 获取共享配置
- `setSharingConfig()` - 设置共享配置
- `setSharingState()` - 设置共享状态
- `setBtSharing()` - 设置BT共享
- `setSmtpSharing()` - 设置SMTP共享
- `setSharingTrafficLimit()` - 设置流量限制
- `setSharingBandwidthLimit()` - 设置带宽限制

#### 系统信息函数 (4个)
- `getSessionInfo()` - 获取会话信息
- `getHardwareInfo()` - 获取硬件信息
- `getSoftwareInfo()` - 获取软件信息
- `getNetworkAddress()` - 获取网络地址

#### DPN增强函数 (3个)
- `deleteTunnels()` - 删除隧道
- `refreshTunnel()` - 刷新隧道
- `switchNode()` - 切换节点

### 用户体验提升

#### 智能自动化
- 隧道连接性自动检测和修复
- 访问控制自动启用依赖检查
- 共享功能依赖自动配置

#### 详细中文描述
- 所有新工具配备emoji图标和详细中文说明
- 明确功能用途、配置选项和使用场景
- 提供参数说明和使用建议

#### 增强错误处理
- 完善的错误信息提示
- 自动登录回退机制
- 详细的操作失败原因说明

### 兼容性保证
- 保持与原有工具的完全兼容性
- 维持现有API接口不变
- 支持DeepChat MCP传输层
- 兼容现有认证和状态管理机制

## 相关文件

- `deeperDeviceServer.ts` - 主要服务器实现
- `builder.ts` - 服务器构建器
- `mcpConfHelper.ts` - MCP配置管理
- `/Users/binguo/workspaces/deeper-device-mcp/` - 原始项目路径
