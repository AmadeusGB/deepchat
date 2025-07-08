# EventBus 重构总结

## 🎯 重构目标

构建一个简洁、明确的事件通信机制，支持主进程和渲染进程之间的精确事件传递。通过继承 EventEmitter 保持基础功能，专注于提供显式的事件发送方法，避免复杂的自动转发机制。

## 🚀 主要功能特性

### 1. EventBus 核心架构

- **继承 EventEmitter**：保持原生事件系统的基础功能
- **精确的发送方法**：
  - `sendToMain(eventName, ...args)`：仅发送到主进程
  - `sendToWindow(eventName, windowId, ...args)`：发送到特定窗口
  - `sendToRenderer(eventName, target, ...args)`：发送到渲染进程
  - `send(eventName, target, ...args)`：同时发送到主进程和渲染进程
- **显式通信**：所有跨进程通信都需要明确指定
- **WindowPresenter 集成**：通过标准接口管理渲染进程通信

### 2. SendTarget 枚举定义

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows', // 广播到所有窗口（默认推荐）
  DEFAULT_TAB = 'default_tab' // 发送到默认标签页（特殊场景）
}
```

## 📊 事件通信模式

### 主进程内部通信

适用于窗口管理、系统级操作等场景：

```typescript
// 窗口生命周期管理
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('window:focused', windowId)
eventBus.sendToMain('window:blurred', windowId)

// 快捷键触发的主进程操作
eventBus.sendToMain('shortcut:create-new-window')
eventBus.sendToMain('shortcut:create-new-tab', windowId)
eventBus.sendToMain('shortcut:close-current-tab', windowId)
```

### 渲染进程通信

适用于 UI 更新、用户界面响应等场景：

```typescript
// 配置变更通知
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.sendToRenderer('config:theme-changed', SendTarget.ALL_WINDOWS, theme)

// 特定窗口操作
eventBus.sendToWindow('window:specific-update', targetWindowId, data)

// 默认标签页操作
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, installData)
```

### 双向通信（推荐）

适用于需要主进程和渲染进程同时响应的场景：

```typescript
// 配置系统事件
eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, providerConfig)
eventBus.send('config:model-list-updated', SendTarget.ALL_WINDOWS, modelList)

// 同步系统事件
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS, backupInfo)
eventBus.send('sync:backup-completed', SendTarget.ALL_WINDOWS, result)

// 用户界面缩放
eventBus.send('shortcut:zoom-in', SendTarget.ALL_WINDOWS)
eventBus.send('shortcut:zoom-out', SendTarget.ALL_WINDOWS)
```

### 流事件和业务事件处理

需要明确指定每个事件的发送目标：

```typescript
// 流事件处理
class StreamEventHandler {
  handleError(error: Error) {
    // 主进程记录错误
    eventBus.sendToMain('stream:error-logged', error)
    // 渲染进程显示错误
    eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error)
  }
}

// 会话事件处理
class ConversationHandler {
  activateConversation(conversationId: string) {
    // 通知所有窗口更新UI
    eventBus.send('conversation:activated', SendTarget.ALL_WINDOWS, conversationId)
  }

  editMessage(messageData: any) {
    // 通知所有窗口消息已编辑
    eventBus.send('conversation:message-edited', SendTarget.ALL_WINDOWS, messageData)
  }
}

// MCP 服务器事件
class MCPHandler {
  startServer(serverInfo: any) {
    // 主进程和渲染进程都需要知道服务器启动
    eventBus.send('mcp:server-started', SendTarget.ALL_WINDOWS, serverInfo)
  }

  updateConfig(newConfig: any) {
    // 配置变更通知所有窗口
    eventBus.send('mcp:config-changed', SendTarget.ALL_WINDOWS, newConfig)
  }
}
```

## 🔧 架构优势

### 简化的初始化

```typescript
// 构造函数无需复杂参数
export const eventBus = new EventBus()

// 运行时设置 WindowPresenter
eventBus.setWindowPresenter(windowPresenter)
```

### 显式通信保障

- 所有跨进程通信都需要明确调用相应方法
- 避免意外的事件泄漏或遗漏
- 代码逻辑更加清晰和可预测
- 便于调试和维护

### 类型安全保障

- 完全移除 `any` 类型使用
- 参数类型明确定义：`...args: unknown[]`
- 枚举类型提供编译时检查
- TypeScript 智能提示支持

### 错误处理机制

```typescript
// 内置的错误检查和警告
sendToRenderer(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
  if (!this.windowPresenter) {
    console.warn('WindowPresenter not available, cannot send to renderer')
    return
  }
  // ... 发送逻辑
}
```

## 🎨 实际应用场景

### 配置管理系统

```typescript
class ConfigManager {
  updateLanguage(language: string) {
    this.saveConfig('language', language)
    // 明确通知所有界面更新语言
    eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
  }

  updateProvider(provider: ProviderConfig) {
    this.saveConfig('provider', provider)
    // 通知主进程和所有界面
    eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, provider)
  }
}
```

### 窗口管理系统

```typescript
class WindowManager {
  createWindow() {
    const windowId = this.doCreateWindow()
    // 仅通知主进程
    eventBus.sendToMain('window:created', windowId)
  }

  focusWindow(windowId: number) {
    this.doFocusWindow(windowId)
    // 仅通知主进程
    eventBus.sendToMain('window:focused', windowId)
  }

  notifySpecificWindow(windowId: number, data: any) {
    // 向特定窗口发送消息
    eventBus.sendToWindow('window:notification', windowId, data)
  }
}
```

### 通知系统

```typescript
class NotificationManager {
  showError(message: string) {
    // 明确指定仅向渲染进程发送通知
    eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, message)
  }

  handleSystemNotificationClick() {
    // 系统通知点击需要通知所有窗口
    eventBus.send('notification:sys-notify-clicked', SendTarget.ALL_WINDOWS)
  }
}
```

### 快捷键处理系统

```typescript
class ShortcutManager {
  handleGoSettings() {
    // 明确通知渲染进程跳转设置
    eventBus.sendToRenderer('shortcut:go-settings', SendTarget.ALL_WINDOWS)
  }

  handleCleanHistory() {
    // 主进程清理历史
    this.cleanHistoryInMain()
    // 明确通知渲染进程更新UI
    eventBus.sendToRenderer('shortcut:clean-chat-history', SendTarget.ALL_WINDOWS)
  }

  handleZoom(direction: 'in' | 'out' | 'reset') {
    // 缩放操作需要主进程和渲染进程同时响应
    eventBus.send(`shortcut:zoom-${direction}`, SendTarget.ALL_WINDOWS)
  }
}
```

## 🎯 性能优化

### 精确的目标控制

- 支持发送到特定窗口而非广播
- 可选择发送到默认标签页
- 避免无效的事件传播
- 减少不必要的进程间通信

### 显式控制的优势

- 开发者必须明确指定事件的发送目标
- 避免意外的性能开销
- 更好的代码可读性和维护性
- 便于性能分析和优化

### 错误预防机制

- WindowPresenter 状态检查
- 控制台警告提示
- 优雅的错误降级处理

## 🔄 兼容性和迁移

### 向后兼容

- 完全保持 EventEmitter 的所有原生功能
- 主进程内部的事件监听不受影响
- 现有的事件监听器无需修改

### 迁移指导

原有依赖自动转发的代码需要调整：

```typescript
// ❌ 之前的自动转发方式
eventBus.emit('stream:error', error) // 自动转发到渲染进程

// ✅ 现在需要明确指定
eventBus.sendToMain('stream:error-logged', error) // 主进程记录
eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error) // 渲染进程显示

// 或者使用双向发送
eventBus.send('stream:error', SendTarget.ALL_WINDOWS, error)
```

## 🎉 重构成果总结

这次 EventBus 简化重构成功实现了：

1. **架构简化**：移除复杂的自动转发机制，专注于显式通信
2. **逻辑清晰**：每个事件的发送目标都需要明确指定
3. **性能优化**：避免不必要的事件转发和处理
4. **维护性提升**：代码逻辑更加直观和可预测
5. **兼容性保障**：保持 EventEmitter 基础功能不变

特别重要的改进：

- **显式通信**：所有跨进程通信都需要明确指定，避免隐藏的依赖
- **精确控制**：可以选择发送到所有窗口、特定窗口或默认标签页
- **简洁架构**：移除了复杂的事件定义和自动转发逻辑
- **更好的可维护性**：事件流向清晰，便于调试和维护
- **性能提升**：避免了不必要的事件处理开销

现在的 EventBus 更加简洁明了，虽然需要开发者显式指定事件目标，但这带来了更好的代码可读性、可维护性和性能表现。每个事件的处理逻辑都是明确和可预测的，为应用的稳定运行提供了更好的基础。
