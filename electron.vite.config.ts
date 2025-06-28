import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'
import tailwind from 'tailwindcss'
import vueDevTools from 'vite-plugin-vue-devtools'
import svgLoader from 'vite-svg-loader'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['mermaid', 'dompurify', 'pyodide']
      })
    ],
    resolve: {
      alias: {
        '@': resolve('src/main/'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['sharp', 'pyodide']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    optimizeDeps: {
      include: [
        'monaco-editor',
        'axios'
      ]
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shell': resolve('src/renderer/shell'),
        '@shared': resolve('src/shared'),
        vue: 'vue/dist/vue.esm-bundler.js'
      }
    },
    css: {
      postcss: {
        plugins: [tailwind(), autoprefixer()]
      }
    },
    server: {
      host: '0.0.0.0' // 防止代理干扰，导致vite-electron之间ws://localhost:5713和http://localhost:5713通信失败、页面组件无法加载
    },
    plugins: [
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'typescript', 'css', 'html', 'json'],
        customDistPath(_root, buildOutDir) {
          return path.resolve(buildOutDir, 'monacoeditorwork')
        },
      }),
      vue(),
      svgLoader(),
      vueDevTools({
        // use export LAUNCH_EDITOR=cursor instead
        // launchEditor: 'cursor'
      })
    ],
    build: {
      minify: 'esbuild',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          shell: resolve('src/renderer/shell/index.html'),
          index: resolve('src/renderer/index.html')
        },
        output: {
          manualChunks: (id) => {
            if (id.includes('monaco-editor')) {
              return 'monaco-editor'
            }
            
            if (id.includes('/node_modules/') && (
              id.includes('highlight.js') || 
              id.includes('shiki') ||
              id.includes('/languages/') ||
              id.includes('/themes/')
            )) {
              return 'syntax-highlighting'
            }
            
            if (id.includes('/node_modules/vue/') || 
                id.includes('/node_modules/vue-router/') || 
                id.includes('/node_modules/pinia/')) {
              return 'vue-vendor'
            }
            
            if (id.includes('/node_modules/@radix-icons/') || 
                id.includes('/node_modules/lucide-vue-next/') ||
                id.includes('/node_modules/radix-vue/') ||
                id.includes('/node_modules/@iconify/')) {
              return 'ui-vendor'
            }
            
            if (id.includes('/node_modules/@tiptap/')) {
              return 'editor-vendor'
            }
            
            if (id.includes('/node_modules/mermaid/') ||
                id.includes('/node_modules/d3/') ||
                id.includes('/node_modules/cytoscape/')) {
              return 'chart-vendor'
            }
            
            if (id.includes('/node_modules/@anthropic-ai/') ||
                id.includes('/node_modules/openai/') ||
                id.includes('/node_modules/@google/genai/') ||
                id.includes('/node_modules/ollama/')) {
              return 'ai-vendor'
            }
            
            if (id.includes('/node_modules/axios/') || 
                id.includes('/node_modules/nanoid/') || 
                id.includes('/node_modules/compare-versions/') ||
                id.includes('/node_modules/lodash/') ||
                id.includes('/node_modules/uuid/')) {
              return 'utility-vendor'
            }
            
            if (id.includes('/node_modules/pdf-parse/') ||
                id.includes('/node_modules/mammoth/') ||
                id.includes('/node_modules/xlsx/') ||
                id.includes('/node_modules/file-type/')) {
              return 'file-vendor'
            }
            
            if (id.includes('/node_modules/crypto/') ||
                id.includes('/node_modules/better-sqlite3/')) {
              return 'crypto-vendor'
            }
            
            if (id.includes('/node_modules/@vueuse/')) {
              return 'vueuse-vendor'
            }
            
            if (id.includes('/node_modules/vue-i18n/')) {
              return 'i18n-vendor'
            }
            
            if (id.includes('/node_modules/') && !id.includes('/src/')) {
              return 'vendor'
            }
            
            // 默认返回undefined，让Rollup自动处理
            return undefined
          }
        }
      }
    }
  }
})
