# 🔄 版本更新功能恢复指南

## 📋 当前状态

版本更新功能已临时禁用，具体修改位置：

### 1. 主要逻辑禁用
**文件**: `src/main/presenter/upgradePresenter/index.ts`

**位置**: 
- `checkUpdate()` 方法 (第235行左右)
- `handleAppFocus()` 方法 (第225行左右)

**修改内容**: 在方法开头添加了 `return` 语句

### 2. UI界面禁用
**文件**: `src/renderer/src/components/settings/AboutUsSettings.vue`

**位置**: 检查更新按钮 (第55行左右)

**修改内容**: 
- 添加了 `:disabled="true"` 
- 按钮文本改为 "检查更新 (已禁用)"
- 添加了 `opacity-50` 样式

## 🔓 恢复方法

### 快速恢复 (推荐)

1. **恢复主要逻辑**:
   - 打开 `src/main/presenter/upgradePresenter/index.ts`
   - 找到两个带有 `========== 临时禁用版本更新功能 ==========` 注释的代码块
   - 删除每个代码块中的 `return` 语句 (保留其他代码)

2. **恢复UI界面**:
   - 打开 `src/renderer/src/components/settings/AboutUsSettings.vue`
   - 找到检查更新按钮的代码
   - 将 `:disabled="true"` 改为 `:disabled="upgrade.isChecking || upgrade.isDownloading || upgrade.isRestarting"`
   - 将按钮文本中的 ` (已禁用)` 删除
   - 移除 `opacity-50` 样式类

### 完整恢复 (用于自己的版本)

如果要配置为自己的更新系统，还需要修改：

1. **API地址**: `src/main/presenter/upgradePresenter/index.ts` 中的 `getVersionCheckBaseUrl()`
2. **下载链接**: `build/generate-version-files.mjs` 中的仓库地址
3. **版本信息托管**: 设置自己的API或GitHub Pages

## ⚠️ 注意事项

- 目前使用的是原作者的API (`https://cdn.deepchatai.cn/upgrade`)
- 如果恢复功能，建议先配置为自己的API地址
- 测试时请确保网络连接正常

## 🧪 测试恢复

恢复后可以通过以下方式测试：

1. 重启应用
2. 在设置中点击"检查更新"按钮
3. 查看控制台日志确认是否正常工作

---

**文件创建时间**: 2025-06-28  
**禁用原因**: 二次开发项目，暂时禁用原作者的更新系统 