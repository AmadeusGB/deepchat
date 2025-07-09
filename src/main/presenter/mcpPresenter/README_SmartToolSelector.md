# 🧠 智能工具选择器 (Smart Tool Selector)

## 概述

智能工具选择器是一个基于语义分析和机器学习的工具选择系统，能够根据用户的意图和上下文自动选择最合适的MCP工具。

## 主要功能

### 1. 意图分析
- **关键词匹配**: 基于预定义的关键词库分析用户意图
- **语义分类**: 将工具分为浏览器类、设备类、通用类等
- **上下文感知**: 考虑会话上下文和使用历史

### 2. 智能匹配
- **精确匹配**: 工具名称完全匹配时直接返回
- **语义匹配**: 基于名称和描述的相似度计算
- **意图匹配**: 根据功能类别进行智能推荐
- **历史匹配**: 基于使用历史和成功率进行推荐

### 3. 智能推荐
- **置信度评分**: 为每个推荐提供置信度分数
- **替代方案**: 提供多个可选的替代工具
- **推荐理由**: 解释为什么选择某个工具

## 使用场景

### 浏览器操作
当用户想要进行浏览器操作时，智能选择器会优先推荐Playwright MCP工具：

```typescript
// 用户输入: "navigate" 或 "访问网页"
// 智能选择器会推荐: mcp_playwright_browser_navigate

// 用户输入: "click" 或 "点击元素"  
// 智能选择器会推荐: mcp_playwright_browser_click
```

### 设备配置
当用户想要配置Deeper设备时，智能选择器会优先推荐Deeper Device MCP工具：

```typescript
// 用户输入: "dpn" 或"路由模式"
// 智能选择器会推荐: setDpnMode

// 用户输入: "login" 或 "登录设备"
// 智能选择器会推荐: loginToDeeperDevice
```

## 工作原理

### 1. 工具分类
系统根据关键词将工具分为不同类别：

```typescript
// 浏览器类关键词
const BROWSER_KEYWORDS = [
  '浏览器', 'browser', '网页', 'webpage', '访问', 'visit',
  '点击', 'click', 'playwright', '截图', 'screenshot',
  '导航', 'navigate', '页面', 'page', '元素', 'element'
]

// 设备类关键词  
const DEVICE_KEYWORDS = [
  'deeper', '设备', 'device', 'dpn', '隧道', 'tunnel',
  '路由', 'routing', '家长控制', 'parental', '广告', 'ads',
  '过滤', 'filter', '拦截', 'block', '应用', 'app'
]
```

### 2. 评分算法
智能选择器使用综合评分算法：

```typescript
const totalScore = (
  nameSimilarity * 0.4 +          // 名称相似度 (40%)
  descriptionSimilarity * 0.2 +   // 描述相似度 (20%)
  intentMatch * 0.3 +              // 意图匹配 (30%)
  usageScore * 0.1                 // 使用历史 (10%)
)
```

### 3. 选择策略
- **置信度阈值**: 只有置信度 > 0.3 的工具才会被推荐
- **优先级排序**: 按综合评分从高到低排序
- **替代方案**: 提供评分 > 0.3 的前3个替代工具

## 配置选项

### 启用/禁用智能选择
```typescript
// 在 toolManager.ts 中
const smartSelectionEnabled = await this.smartToolSelector.isSmartSelectionEnabled()
```

### 自定义置信度阈值
```typescript
// 默认阈值: 0.3
if (selectionResult.confidence > 0.3) {
  // 使用推荐的工具
}
```

## 使用历史和学习

### 历史记录
智能选择器会记录每个工具的使用历史：

```typescript
interface ToolUsageHistory {
  toolName: string
  successCount: number      // 成功次数
  failureCount: number      // 失败次数
  lastUsed: Date           // 最后使用时间
}
```

### 学习机制
- **成功率权重**: 成功率高的工具得分更高
- **时间衰减**: 最近使用的工具得分更高
- **频率统计**: 使用频率高的工具得分更高

## 用户反馈

### 透明度
当智能选择器选择了不同的工具时，会在响应中显示：

```
🧠 智能选择: 功能类别匹配 (置信度: 85.2%)
📋 其他选项: mcp_playwright_browser_click, mcp_playwright_browser_type
```

### 学习更新
系统会根据工具调用的成功/失败自动更新学习数据：

```typescript
// 在 toolManager.ts 中
this.smartToolSelector.updateUsageHistory(finalName, !result.isError)
```

## 性能优化

### 缓存机制
- 工具定义缓存
- 相似度计算缓存
- 使用历史缓存

### 异步处理
- 智能选择过程异步执行
- 不影响正常工具调用性能

## 扩展性

### 添加新的工具类别
```typescript
enum ToolCategory {
  BROWSER = 'browser',
  DEVICE = 'device',
  GENERAL = 'general',
  // 可以添加新的类别
  DATABASE = 'database',
  FILE = 'file'
}
```

### 添加新的关键词
```typescript
private readonly DATABASE_KEYWORDS = [
  '数据库', 'database', '查询', 'query', 'sql', 'mongodb'
]
```

### 自定义评分算法
可以通过修改`findBestTool`方法中的评分权重来自定义算法：

```typescript
const totalScore = (
  nameSimilarity * 0.5 +        // 调整权重
  descriptionSimilarity * 0.3 +  
  intentMatch * 0.2 +
  usageScore * 0.0              // 可以禁用某些因子
)
```

## 调试和监控

### 日志输出
智能选择器会输出详细的调试信息：

```
[MCP] Tool 'navigate' not found, attempting smart selection...
[MCP] Smart selection chose 'mcp_playwright_browser_navigate' for 'navigate' (功能类别匹配)
```

### 监控指标
- 智能选择成功率
- 用户接受率
- 工具推荐准确率

## 注意事项

1. **性能影响**: 智能选择会增加轻微的延迟
2. **准确性**: 推荐准确性依赖于关键词库的完整性
3. **学习数据**: 需要一定的使用历史才能提供准确推荐
4. **配置管理**: 需要合理配置置信度阈值和权重

## 未来优化方向

1. **自然语言处理**: 集成更先进的NLP技术
2. **用户偏好学习**: 更智能的个性化推荐
3. **多模态支持**: 支持图像、语音等多模态输入
4. **实时学习**: 实时更新推荐算法
5. **分布式学习**: 跨用户的协同学习机制 