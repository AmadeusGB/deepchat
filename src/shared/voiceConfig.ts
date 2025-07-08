/**
 * 语音系统配置常量
 * 将硬编码的值外部化，便于维护和调整
 */

// 定义具体的语音类型
export const MALE_VOICES = ['onyx', 'echo'] as const
export const FEMALE_VOICES = ['alloy', 'nova', 'shimmer', 'fable'] as const
export const ALL_VOICES = [...MALE_VOICES, ...FEMALE_VOICES] as const

export const EMOTION_TYPES = [
  'excited',
  'calm',
  'serious',
  'friendly',
  'empathetic',
  'playful',
  'professional'
] as const

// 类型定义
export type MaleVoiceType = (typeof MALE_VOICES)[number]
export type FemaleVoiceType = (typeof FEMALE_VOICES)[number]
export type VoiceType = (typeof ALL_VOICES)[number]
export type EmotionType = (typeof EMOTION_TYPES)[number]

export const VoiceConfig = {
  // 性别检测相关配置
  genderDetection: {
    // 基频阈值 (Hz)
    maleFrequencyThreshold: 140, // 男性基频上限
    femaleFrequencyThreshold: 200, // 女性基频下限
    overlapLowThreshold: 170, // 重叠区域分界线

    // 基频范围 (Hz)
    minValidFrequency: 80, // 人声基频下限
    maxValidFrequency: 400, // 人声基频上限

    // 置信度配置
    minConfidence: 0.6, // 最小置信度
    maxConfidence: 0.95, // 最大置信度
    overlapConfidence: 0.4, // 重叠区域置信度
    confidenceThreshold: 0.6, // 高置信度阈值

    // 能量检测
    silenceEnergyThreshold: 0.001, // 静音能量阈值

    // 分析窗口
    analysisWindowMs: 100, // 分析窗口大小 (毫秒)
    maxAnalysisSeconds: 1, // 最大分析时长 (秒)
    minLagSamples: 20 // 自相关最小延迟
  },

  // 情感分析相关配置
  emotionAnalysis: {
    // 情感强度阈值
    emotionThreshold: 0.3, // 情感切换门槛

    // 语速调节范围
    minSpeed: 0.7, // 最小语速
    maxSpeed: 1.3, // 最大语速

    // 模型选择阈值
    hdModelThreshold: 0.7 // 高清模型阈值
  },

  // 语音映射配置
  voiceMapping: {
    // 男声选项
    maleVoices: MALE_VOICES,

    // 女声选项
    femaleVoices: FEMALE_VOICES,

    // 所有语音选项
    allVoices: ALL_VOICES,

    // 默认语音
    defaultMaleVoice: 'onyx' as MaleVoiceType,
    defaultFemaleVoice: 'shimmer' as FemaleVoiceType,

    // 情感语音映射
    emotionVoiceMapping: {
      excited: 'nova', // 活力充沛
      calm: 'alloy', // 温和平静
      serious: 'echo', // 庄重严肃
      friendly: 'alloy', // 友好亲切
      empathetic: 'shimmer', // 温暖共情
      playful: 'fable', // 活泼有趣
      professional: 'onyx' // 专业权威
    } as const satisfies Record<EmotionType, VoiceType>
  },

  // 性能相关配置
  performance: {
    // AudioContext管理
    audioContextTimeout: 5000, // AudioContext超时时间 (毫秒)

    // 缓存配置
    maxCacheAge: 300000, // 最大缓存时间 (毫秒，5分钟)

    // 错误重试
    maxRetries: 3, // 最大重试次数
    retryDelay: 1000 // 重试延迟 (毫秒)
  }
} as const

// 类型检查函数
export function isMaleVoice(voice: string): voice is MaleVoiceType {
  return MALE_VOICES.includes(voice as MaleVoiceType)
}

export function isFemaleVoice(voice: string): voice is FemaleVoiceType {
  return FEMALE_VOICES.includes(voice as FemaleVoiceType)
}

export function isValidVoice(voice: string): voice is VoiceType {
  return ALL_VOICES.includes(voice as VoiceType)
}
