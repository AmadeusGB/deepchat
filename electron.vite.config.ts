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
            // Monaco Editor 单独分块
            if (id.includes('monaco-editor')) {
              return 'monaco-editor'
            }
            
            // 语法高亮相关
            if (id.includes('/node_modules/') && (
              id.includes('highlight.js') || 
              id.includes('shiki') ||
              id.includes('/languages/') ||
              id.includes('/themes/')
            )) {
              return 'syntax-highlighting'
            }
            
            // Vue 生态系统保持在一起
            if (id.includes('/node_modules/vue/') || 
                id.includes('/node_modules/vue-router/') || 
                id.includes('/node_modules/pinia/') ||
                id.includes('/node_modules/vue-i18n/') ||
                id.includes('/node_modules/@vueuse/')) {
              return 'vue-vendor'
            }
            
            // 图表相关库
            if (id.includes('/node_modules/mermaid/') ||
                id.includes('/node_modules/d3/') ||
                id.includes('/node_modules/cytoscape/')) {
              return 'chart-vendor'
            }
            
            // 编辑器相关
            if (id.includes('/node_modules/@tiptap/')) {
              return 'editor-vendor'
            }
            
            // 其他所有 node_modules 依赖合并到一个 vendor chunk
            if (id.includes('/node_modules/') && !id.includes('/src/')) {
              return 'vendor'
            }
            
            // 应用代码不进行手动分块，让 Rollup 自动处理
            return undefined
          }
        }
      }
    }
  }
})
