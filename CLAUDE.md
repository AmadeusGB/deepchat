# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepChat is a sophisticated open-source AI chat platform built as a cross-platform Electron desktop application. It provides a unified interface for interacting with multiple large language models (LLMs) from various providers, supporting both cloud APIs and local models through Ollama integration.

## Technology Stack

- **Desktop Framework**: Electron (v35.4.0) with multi-process architecture
- **Frontend**: Vue 3 with Composition API, TypeScript, Vite
- **UI Components**: Tailwind CSS, Radix Vue, Shadcn/ui components
- **State Management**: Pinia stores with persistence
- **Database**: SQLite with better-sqlite3-multiple-ciphers
- **Code Editor**: Monaco Editor integration
- **Build Tool**: Electron Vite with custom configuration

## Development Commands

### Setup

```bash
npm install                    # Install dependencies
npm run installRuntime         # Install Node.js runtime for MCP services
```

### Development

```bash
npm run dev                    # Start development server
npm run dev:inspect            # Start with Node.js debugging (port 9229)
npm run dev:linux              # Linux development mode with --noSandbox
```

### Code Quality

```bash
npm run typecheck              # Run TypeScript checking for both node and web
npm run lint                   # Run ESLint
npm run format                 # Format code with Prettier
npm run i18n                   # Check i18n translations completeness
```

### Building

```bash
npm run build                  # Build for current platform
npm run build:win:x64          # Windows x64
npm run build:mac:arm64        # macOS Apple Silicon
npm run build:linux:x64        # Linux x64
```

## Architecture Overview

### Electron Multi-Process Architecture

- **Main Process** (`src/main/`): Node.js backend handling system integration, database, file operations
- **Renderer Process** (`src/renderer/`): Vue.js frontend for user interface
- **Preload Scripts** (`src/preload/`): Secure bridge between main and renderer processes
- **Shared Types** (`src/shared/`): TypeScript definitions shared between processes

### Key Architectural Patterns

- **Presenter Pattern**: Business logic separated into presenter classes in `src/main/presenter/`
- **Event-Driven Communication**: EventBus (`src/main/eventbus.ts`) for inter-process communication
- **IPC Implementation**: `usePresenter.ts` composable for renderer-to-main communication
- **Store Pattern**: Pinia stores for reactive state management

### Core Components

- **LLM Provider Integration** (`src/main/presenter/llmProviderPresenter/`): Unified interface for 20+ LLM providers
- **MCP Protocol Support** (`src/main/presenter/mcpPresenter/`): Model Context Protocol for tool calling
- **Thread Management** (`src/main/presenter/threadPresenter/`): Chat conversation handling
- **SQLite Database** (`src/main/presenter/sqlitePresenter/`): Local data persistence
- **Configuration Management** (`src/main/presenter/configPresenter/`): App settings and provider configs

## Development Guidelines

### Code Style

- Use ESLint configuration in `eslint.config.mjs`
- Format with Prettier (`.prettierrc.yaml`)
- TypeScript strict mode enabled
- Vue 3 Composition API preferred over Options API

### File Organization

- Main process code: `src/main/presenter/` (business logic) and `src/main/lib/` (utilities)
- Renderer components: `src/renderer/src/components/` with feature-based organization
- Shared utilities: `src/shared/` for cross-process types and helpers
- UI components: `src/renderer/src/components/ui/` (Shadcn/ui based)

### IPC Communication

- Renderer to Main: Use `usePresenter()` composable for type-safe IPC calls
- Main to Renderer: Use EventBus pattern with `mainWindow.webContents.send()`
- Event decoupling: Use `src/main/eventbus.ts` for main process inter-module communication

### State Management

- Use Pinia stores for global state in `src/renderer/src/stores/`
- Implement persistence for critical data (user settings, chat history)
- Keep stores focused on global state, not component-specific data
- Use getters for computed properties and actions for side effects

### Internationalization

- Framework: vue-i18n
- Location: `src/renderer/src/i18n/`
- Supported locales: zh-CN, en-US, ko-KR, ru-RU, zh-HK, fr-FR
- All user-facing strings must use i18n keys
- Use hierarchical key naming: `common.button.submit`

### Component Development

- Use Composition API with `<script setup>` syntax
- Implement scoped styles to prevent CSS conflicts
- Follow Vue 3 best practices for reactivity and lifecycle management
- Leverage built-in components from Shadcn/ui and Radix Vue

### Testing and Quality Assurance

- Always run `npm run typecheck` before committing
- Use `npm run lint` and `npm run format` for code quality
- Check i18n completeness with `npm run i18n`
- Test builds with platform-specific commands before release

### Security Considerations

- Use context isolation in Electron preload scripts
- Never expose Node.js APIs directly to renderer process
- Implement proper input validation for IPC communications
- Use encrypted SQLite database for sensitive data storage

## LLM Provider Integration

When adding new LLM providers:

- Create provider class in `src/main/presenter/llmProviderPresenter/providers/`
- Implement standard interface for API calls, streaming, and error handling
- Add provider configuration in settings UI
- Update provider icons in `src/renderer/src/assets/llm-icons/`
- Support both API key and self-hosted endpoint configurations

## MCP Service Development

For Model Context Protocol services:

- Built-in Node.js runtime available at `runtime/node/`
- Support for stdio, SSE, and HTTP transports
- Services configuration in settings UI with user-friendly interface
- Debug window shows formatted tool parameters and responses
- Implement semantic workflows for complex automation tasks
