<template>
  <ScrollArea class="w-full h-full p-2">
    <div class="w-full h-full flex flex-col gap-1.5">
      <!-- 异性语音回应设置 -->
      <div class="flex flex-col p-2 gap-2 px-2">
        <div class="flex flex-row items-center gap-2">
          <span class="flex flex-row items-center gap-2 flex-grow w-full">
            <Icon icon="lucide:heart" class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{
              t('settings.voice.oppositeGenderResponse')
            }}</span>
          </span>
          <div class="flex-shrink-0">
            <Switch
              id="opposite-gender-response-switch"
              :checked="oppositeGenderResponseEnabled"
              @update:checked="handleOppositeGenderResponseChange"
            />
          </div>
        </div>
        <div class="pl-6 text-xs text-muted-foreground">
          {{ t('settings.voice.oppositeGenderResponseDesc') }}
        </div>
      </div>

      <!-- 用户性别设置 -->
      <div class="flex flex-row p-2 items-center gap-2 px-2">
        <span class="flex flex-row items-center gap-2 flex-grow w-full">
          <Icon icon="lucide:user" class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">{{ t('settings.voice.userGender') }}</span>
        </span>
        <div class="flex-shrink-0 min-w-64 max-w-96">
          <Select v-model="userGender" @update:model-value="handleUserGenderChange">
            <SelectTrigger>
              <SelectValue :placeholder="t('settings.voice.userGender')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{{ t('settings.voice.userGenderAuto') }}</SelectItem>
              <SelectItem value="male">{{ t('settings.voice.userGenderMale') }}</SelectItem>
              <SelectItem value="female">{{ t('settings.voice.userGenderFemale') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- 性别检测状态显示 -->
      <div v-if="userGender === 'auto'" class="flex flex-col p-2 gap-2 px-2">
        <div class="flex flex-row items-center gap-2">
          <span class="flex flex-row items-center gap-2 flex-grow w-full">
            <Icon icon="lucide:scan" class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{ t('settings.voice.genderDetectionStatus') }}</span>
          </span>
          <div class="flex-shrink-0">
            <span class="text-xs text-muted-foreground">
              {{ genderDetectionStatus }}
            </span>
          </div>
        </div>
        <div class="pl-6 text-xs text-muted-foreground">
          {{ genderDetectionDetails }}
        </div>
      </div>

      <!-- 偏好语音设置 -->
      <div class="flex flex-col p-2 gap-3 px-2">
        <div class="flex flex-row items-center gap-2">
          <Icon icon="lucide:volume-2" class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">{{ t('settings.voice.preferredVoices') }}</span>
        </div>

        <!-- 偏好男声 -->
        <div class="flex flex-row items-center gap-2 pl-6">
          <span class="flex-grow text-sm">{{ t('settings.voice.preferredMaleVoice') }}：</span>
          <div class="flex-shrink-0 min-w-32">
            <Select v-model="preferredMaleVoice" @update:model-value="handlePreferredVoicesChange">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onyx">{{ t('settings.voice.voiceOnyx') }}</SelectItem>
                <SelectItem value="echo">{{ t('settings.voice.voiceEcho') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- 偏好女声 -->
        <div class="flex flex-row items-center gap-2 pl-6">
          <span class="flex-grow text-sm">{{ t('settings.voice.preferredFemaleVoice') }}：</span>
          <div class="flex-shrink-0 min-w-32">
            <Select
              v-model="preferredFemaleVoice"
              @update:model-value="handlePreferredVoicesChange"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alloy">{{ t('settings.voice.voiceAlloy') }}</SelectItem>
                <SelectItem value="nova">{{ t('settings.voice.voiceNova') }}</SelectItem>
                <SelectItem value="shimmer">{{ t('settings.voice.voiceShimmer') }}</SelectItem>
                <SelectItem value="fable">{{ t('settings.voice.voiceFable') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <!-- 测试语音功能 -->
      <div class="flex flex-col p-2 gap-2 px-2">
        <div class="flex flex-row items-center gap-2">
          <span class="flex flex-row items-center gap-2 flex-grow w-full">
            <Icon icon="lucide:play-circle" class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{ t('settings.voice.testVoice') }}</span>
          </span>
          <div class="flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              :disabled="isTestingVoice"
              @click="testVoiceResponse"
            >
              <Icon v-if="isTestingVoice" icon="lucide:loader" class="w-3 h-3 mr-1 animate-spin" />
              <Icon v-else icon="lucide:volume-2" class="w-3 h-3 mr-1" />
              {{
                isTestingVoice
                  ? t('settings.voice.testVoicePlaying')
                  : t('settings.voice.testVoicePlay')
              }}
            </Button>
          </div>
        </div>
        <div class="pl-6 text-xs text-muted-foreground">
          {{ t('settings.voice.testVoiceDesc') }}
        </div>
      </div>
    </div>
  </ScrollArea>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ttsService } from '@/lib/ttsService'
import { useToast } from '@/components/ui/toast/use-toast'

const { t } = useI18n()
const { toast } = useToast()

// 响应式状态
const oppositeGenderResponseEnabled = ref(true)
const userGender = ref<'auto' | 'male' | 'female'>('auto')
const preferredMaleVoice = ref('onyx')
const preferredFemaleVoice = ref('shimmer')
const isTestingVoice = ref(false)

// 性别检测状态
const genderDetectionStatus = computed(() => {
  const result = ttsService.getGenderDetectionResult()
  if (result.gender === 'unknown') {
    return t('settings.voice.genderDetectionUnknown')
  }
  const genderText =
    result.gender === 'male'
      ? t('settings.voice.genderDetectionMale')
      : t('settings.voice.genderDetectionFemale')
  const confidenceText = (result.confidence * 100).toFixed(0) + '%'
  return `${genderText} (${confidenceText})`
})

const genderDetectionDetails = computed(() => {
  const result = ttsService.getGenderDetectionResult()
  if (result.gender === 'unknown') {
    return t('settings.voice.genderDetectionDetails')
  }
  return t('settings.voice.genderDetectionDetailsWithResult', {
    confidence: (result.confidence * 100).toFixed(1)
  })
})

// 事件处理
const handleOppositeGenderResponseChange = async (enabled: boolean) => {
  try {
    await ttsService.setOppositeGenderResponse(enabled)
    oppositeGenderResponseEnabled.value = enabled

    toast({
      title: t('settings.voice.settingsSaved'),
      description: enabled
        ? t('settings.voice.oppositeGenderEnabled')
        : t('settings.voice.oppositeGenderDisabled')
    })
  } catch (error) {
    console.error('设置异性语音回应失败:', error)
    toast({
      title: t('settings.voice.settingsFailed'),
      description: t('settings.voice.cannotSaveOppositeGender'),
      variant: 'destructive'
    })
  }
}

const handleUserGenderChange = async (gender: string) => {
  try {
    await ttsService.setUserGender(gender as 'auto' | 'male' | 'female')
    userGender.value = gender as 'auto' | 'male' | 'female'

    const genderText =
      gender === 'auto'
        ? t('settings.voice.userGenderAuto')
        : gender === 'male'
          ? t('settings.voice.userGenderMale')
          : t('settings.voice.userGenderFemale')
    toast({
      title: t('settings.voice.settingsSaved'),
      description: t('settings.voice.userGenderSet', { gender: genderText })
    })
  } catch (error) {
    console.error('设置用户性别失败:', error)
    toast({
      title: t('settings.voice.settingsFailed'),
      description: t('settings.voice.cannotSaveUserGender'),
      variant: 'destructive'
    })
  }
}

const handlePreferredVoicesChange = async () => {
  try {
    await ttsService.setPreferredVoices(preferredMaleVoice.value, preferredFemaleVoice.value)

    toast({
      title: t('settings.voice.settingsSaved'),
      description: t('settings.voice.preferredVoicesUpdated', {
        maleVoice: preferredMaleVoice.value,
        femaleVoice: preferredFemaleVoice.value
      })
    })
  } catch (error) {
    console.error('设置偏好语音失败:', error)
    toast({
      title: t('settings.voice.settingsFailed'),
      description: t('settings.voice.cannotSavePreferredVoices'),
      variant: 'destructive'
    })
  }
}

const testVoiceResponse = async () => {
  if (isTestingVoice.value) return

  isTestingVoice.value = true

  try {
    const result = ttsService.getGenderDetectionResult()
    let testText = ''

    if (result.gender === 'male') {
      testText =
        '您好！我是您的AI助手小深。我检测到您是男性用户，所以我用女声为您服务。希望您喜欢这种交互方式！'
    } else if (result.gender === 'female') {
      testText =
        '您好！我是您的AI助手小深。我检测到您是女性用户，所以我用男声为您服务。希望您喜欢这种交互方式！'
    } else {
      testText =
        '您好！我是您的AI助手小深。目前还没有检测到您的性别信息，请先使用语音功能让我了解您的声音特征。'
    }

    // 使用TTS服务播放测试语音
    const audioBlob = await ttsService.generateAudioBlob(testText)
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      isTestingVoice.value = false
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      isTestingVoice.value = false
      toast({
        title: t('settings.voice.playbackFailed'),
        description: t('settings.voice.cannotPlayTestVoice'),
        variant: 'destructive'
      })
    }

    await audio.play()
  } catch (error) {
    console.error('测试语音失败:', error)
    isTestingVoice.value = false
    toast({
      title: t('settings.voice.testVoiceFailed'),
      description: t('settings.voice.cannotGenerateTestVoice'),
      variant: 'destructive'
    })
  }
}

// 初始化
onMounted(async () => {
  try {
    const preferences = ttsService.getVoicePreferences()
    oppositeGenderResponseEnabled.value = preferences.oppositeGenderResponseEnabled
    userGender.value = preferences.userGender
    preferredMaleVoice.value = preferences.preferredMaleVoice
    preferredFemaleVoice.value = preferences.preferredFemaleVoice
  } catch (error) {
    console.error('加载语音设置失败:', error)
  }
})
</script>
