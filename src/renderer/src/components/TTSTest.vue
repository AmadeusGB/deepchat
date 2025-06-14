<template>
  <div class="tts-test-container p-6 max-w-md mx-auto">
    <h2 class="text-xl font-bold mb-4">TTS 测试</h2>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">测试文本:</label>
        <textarea 
          v-model="testText"
          class="w-full p-2 border rounded-md"
          rows="3"
          placeholder="输入要测试的文本..."
        />
      </div>
      
      <div class="flex gap-2">
        <Button 
          @click="testGPTTTS"
          :disabled="isPlaying || !testText.trim()"
          class="flex-1"
        >
          {{ isPlaying ? '播放中...' : '测试 GPT TTS' }}
        </Button>
        
        <Button 
          @click="testBrowserTTS"
          :disabled="isPlaying || !testText.trim()"
          variant="outline"
          class="flex-1"
        >
          {{ isPlaying ? '播放中...' : '测试浏览器 TTS' }}
        </Button>
      </div>
      
      <Button 
        @click="stopTTS"
        :disabled="!isPlaying"
        variant="destructive"
        class="w-full"
      >
        停止播放
      </Button>
      
      <div v-if="error" class="text-red-500 text-sm">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { ttsService } from '@/lib/ttsService'

const testText = ref('你好，这是一个语音合成测试。Hello, this is a text-to-speech test.')
const isPlaying = ref(false)
const error = ref('')

const testGPTTTS = async () => {
  if (!testText.value.trim()) return
  
  try {
    error.value = ''
    isPlaying.value = true
    await ttsService.playWithGPTTTS(testText.value)
  } catch (err) {
    error.value = `GPT TTS 错误: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    isPlaying.value = false
  }
}

const testBrowserTTS = async () => {
  if (!testText.value.trim()) return
  
  try {
    error.value = ''
    isPlaying.value = true
    await ttsService.playWithBrowserTTS(testText.value)
  } catch (err) {
    error.value = `浏览器 TTS 错误: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    isPlaying.value = false
  }
}

const stopTTS = () => {
  ttsService.stop()
  isPlaying.value = false
}
</script>

<style scoped>
.tts-test-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.dark .tts-test-container {
  background: #1a1a1a;
  color: white;
}
</style> 