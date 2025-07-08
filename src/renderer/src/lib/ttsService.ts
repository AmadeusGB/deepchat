import { usePresenter } from '@/composables/usePresenter'
import { VoiceConfig, isMaleVoice, isFemaleVoice, type VoiceType } from '@shared/voiceConfig'
import { ttsCoordinator } from './ttsCoordinator'

export interface TTSOptions {
  voice?: string
  speed?: number
  language?: string
}

// 🎯 新增：语音性别检测和异性回应功能
export interface VoiceGenderDetectionResult {
  detectedGender: 'male' | 'female' | 'unknown'
  confidence: number // 0-1
  fundamentalFrequency: number // 基频 Hz
  method: 'frequency' | 'manual' | 'default'
}

export interface VoicePreferences {
  genderDetectionEnabled: boolean
  oppositeGenderResponseEnabled: boolean
  userGender: 'auto' | 'male' | 'female'
  preferredMaleVoice: string
  preferredFemaleVoice: string
}

export class TTSService {
  private configPresenter = usePresenter('configPresenter')
  private currentAudio: HTMLAudioElement | null = null
  private isPlaying = false
  // private requestQueue: Promise<void> = Promise.resolve() // 请求队列，避免并发 - 暂未使用

  /**
   * 🎯 智能语音参数优化 - 修复版本
   * 增加语音一致性保护，避免突然的性别切换
   */
  private static lastUsedVoice: string = VoiceConfig.voiceMapping.defaultMaleVoice
  private static voiceConsistencyMode: boolean = true // 语音一致性模式开关

  // 🎯 新增：用户性别检测缓存
  private static detectedUserGender: 'male' | 'female' | 'unknown' = 'unknown'
  private static genderDetectionConfidence: number = 0
  private static voicePreferences: VoicePreferences = {
    genderDetectionEnabled: true,
    oppositeGenderResponseEnabled: true,
    userGender: 'auto',
    preferredMaleVoice: VoiceConfig.voiceMapping.defaultMaleVoice,
    preferredFemaleVoice: VoiceConfig.voiceMapping.defaultFemaleVoice
  }

  // 🚨 新增：TTS服务冲突检测
  private static activeInstances: Set<string> = new Set()
  private instanceId: string

  constructor() {
    // 生成唯一实例ID
    this.instanceId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 检测服务冲突
    if (TTSService.activeInstances.size > 0) {
      console.warn(`⚠️ [TTS服务] 检测到多个TTS服务实例，当前实例: ${this.instanceId}`)
      console.warn(`   已存在实例: ${Array.from(TTSService.activeInstances).join(', ')}`)
    }

    TTSService.activeInstances.add(this.instanceId)

    // 🎯 注册到TTS协调器 - 修复优先级
    ttsCoordinator.registerService(
      this.instanceId,
      'TTSService (Gender Detection)',
      50, // 降低优先级，让其他播放服务优先
      () => this.stop()
    )

    // 🎯 初始化时加载语音偏好设置
    this.loadVoicePreferences().catch((error) => {
      console.error('TTSService初始化时加载语音偏好设置失败:', error)
    })

    console.log(`🎯 [TTS服务] 实例 ${this.instanceId} 初始化完成`)
  }

  /**
   * 🛡️ 析构函数，清理实例
   */
  destroy(): void {
    try {
      // 停止当前播放
      this.stop()

      // 清理实例注册
      TTSService.activeInstances.delete(this.instanceId)
      ttsCoordinator.releaseService(this.instanceId)

      console.log(`🎯 [TTS服务] 实例 ${this.instanceId} 已销毁`)
    } catch (error) {
      console.error(`🚨 [TTS服务] 销毁实例失败:`, error)
    }
  }

  /**
   * 🎯 请求播放权限
   */
  private requestPlayPermission(): boolean {
    try {
      return ttsCoordinator.requestActivation(this.instanceId)
    } catch (error) {
      console.error(`🚨 [TTS服务] 请求播放权限失败:`, error)
      return false
    }
  }

  /**
   * 🎯 智能语音参数优化 - 修复版本
   * 增加语音一致性保护，避免突然的性别切换
   */
  private optimizeVoiceParameters(
    text: string,
    language: string
  ): {
    speed: number
    voice: string
    model: string
  } {
    // 获取基础语速
    const baseSpeed = this.selectSpeedForLanguage(language)

    // 🛡️ 增强情感分析 - 避免技术术语误判
    const emotionAnalysis = this.analyzeTextEmotionEnhanced(text)

    // 结合情感调节最终语速
    const finalSpeed = Math.max(0.7, Math.min(1.3, baseSpeed * emotionAnalysis.speedModifier))

    // 🎯 固定语音选择 - 确保对话一致性，禁用智能切换
    // 🎯 新增：异性语音回应逻辑（如果启用）
    const optimizedVoice = this.applyOppositeGenderLogicSync('alloy') // 默认使用alloy，然后根据性别设置调整

    // 更新最后使用的语音
    TTSService.lastUsedVoice = optimizedVoice

    // 根据情感强度选择模型
    const model = emotionAnalysis.intensity > 0.7 ? 'tts-1-hd' : 'tts-1'

    console.log(
      `🎯 [语音参数优化-修复版] 最终参数: 语速=${finalSpeed}, 语音=${optimizedVoice}, 模型=${model}`
    )
    console.log(
      `   🛡️ 一致性保护: ${TTSService.voiceConsistencyMode ? '启用' : '禁用'}, 上次语音: ${TTSService.lastUsedVoice}`
    )

    return {
      speed: finalSpeed,
      voice: optimizedVoice,
      model: model
    }
  }

  /**
   * 🛡️ 带一致性保护的智能语音选择
   */
  private _selectVoiceWithConsistency(
    _emotionAnalysis: {
      emotionType:
        | 'excited'
        | 'calm'
        | 'serious'
        | 'friendly'
        | 'empathetic'
        | 'playful'
        | 'professional'
      intensity: number
      speedModifier: number
      pausePattern: 'normal' | 'dramatic' | 'gentle' | 'urgent'
    },
    text: string
  ): string {
    const currentVoice = TTSService.lastUsedVoice

    // 🔍 检测是否为技术描述内容
    const isTechnicalContent = this.isTechnicalDescription(text)

    // 🎯 情感强度阈值检查 - 提高切换门槛
    const emotionThreshold = 0.3 // 从0.07提高到0.3，避免误判
    const isStrongEmotion = _emotionAnalysis.intensity >= emotionThreshold

    console.log(
      `🛡️ [语音一致性分析] 技术内容: ${isTechnicalContent}, 情感强度: ${_emotionAnalysis.intensity.toFixed(3)}, 阈值: ${emotionThreshold}`
    )

    // 🚫 技术内容强制使用专业语音
    if (isTechnicalContent) {
      console.log(`   🔧 检测到技术内容，强制使用专业语音: onyx`)
      return 'onyx'
    }

    // 🚫 情感强度不足，保持当前语音
    if (!isStrongEmotion) {
      console.log(
        `   📊 情感强度不足(${_emotionAnalysis.intensity.toFixed(3)} < ${emotionThreshold})，保持当前语音: ${currentVoice}`
      )
      return currentVoice
    }

    // 🎭 强情感且非技术内容，允许切换
    const emotionVoiceMapping = {
      excited: 'nova', // 活力充沛
      calm: 'alloy', // 温和平静
      serious: 'echo', // 庄重严肃
      friendly: 'alloy', // 友好亲切
      empathetic: 'shimmer', // 温暖共情
      playful: 'fable', // 活泼有趣
      professional: 'onyx' // 专业权威
    }

    const targetVoice = emotionVoiceMapping[_emotionAnalysis.emotionType] || currentVoice

    // 🔄 性别切换保护 - 避免男女声突然切换
    const maleVoices = ['onyx', 'echo']

    const currentGender = maleVoices.includes(currentVoice) ? 'male' : 'female'
    const targetGender = maleVoices.includes(targetVoice) ? 'male' : 'female'

    if (currentGender !== targetGender) {
      console.log(
        `   ⚠️ 检测到性别切换风险 (${currentGender} → ${targetGender})，保持当前语音: ${currentVoice}`
      )
      return currentVoice
    }

    console.log(`   ✅ 允许情感语音切换: ${currentVoice} → ${targetVoice}`)
    return targetVoice
  }

  /**
   * 🔍 检测是否为技术描述内容
   */
  private isTechnicalDescription(text: string): boolean {
    const technicalKeywords = [
      // 技术功能描述
      '语言理解',
      '图像识别',
      '创作助手',
      '智能决策',
      '数据分析',
      '算法处理',
      '机器学习',
      '深度学习',
      '神经网络',
      '自然语言',
      '计算机视觉',
      // 技术术语
      'API',
      'SDK',
      '接口',
      '协议',
      '框架',
      '架构',
      '模块',
      '组件',
      '配置',
      '参数',
      '变量',
      '函数',
      '方法',
      '类',
      '对象',
      // 系统功能
      '系统',
      '平台',
      '服务',
      '工具',
      '应用',
      '软件',
      '程序',
      '功能',
      '特性',
      '能力',
      '性能',
      '效率',
      '优化'
    ]

    const lowerText = text.toLowerCase()
    const matchCount = technicalKeywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    ).length

    // 如果包含2个或以上技术关键词，认为是技术内容
    const isTechnical = matchCount >= 2

    console.log(
      `🔍 [技术内容检测] 文本: "${text.substring(0, 30)}...", 匹配关键词数: ${matchCount}, 判定: ${isTechnical ? '技术内容' : '普通内容'}`
    )

    return isTechnical
  }

  /**
   * 🧠 增强版情感分析 - 避免技术术语误判
   */
  private analyzeTextEmotionEnhanced(text: string): {
    emotionType:
      | 'excited'
      | 'calm'
      | 'serious'
      | 'friendly'
      | 'empathetic'
      | 'playful'
      | 'professional'
    intensity: number // 0-1
    speedModifier: number // 0.8-1.2
    pausePattern: 'normal' | 'dramatic' | 'gentle' | 'urgent'
  } {
    const lowerText = text.toLowerCase()

    // 🔍 预先检测技术内容
    const isTechnicalContent = this.isTechnicalDescription(text)

    if (isTechnicalContent) {
      // 技术内容强制使用专业情感
      console.log(`🔧 [增强情感分析] 检测到技术内容，强制使用专业情感`)
      return {
        emotionType: 'professional',
        intensity: 0.8,
        speedModifier: 0.95,
        pausePattern: 'normal'
      }
    }

    // 🎭 优化后的情感关键词 - 避免技术术语误判
    const excitedWords = [
      '哇',
      '太棒了',
      '惊喜',
      '激动',
      '兴奋',
      '厉害',
      '完美',
      'amazing',
      'fantastic',
      'awesome'
    ]
    const calmWords = ['平静', '安静', '温和', '缓慢', '轻松', '舒缓', 'calm', 'gentle', 'peaceful']
    const seriousWords = [
      '重要',
      '严肃',
      '认真',
      '关键',
      '注意',
      '警告',
      'serious',
      'important',
      'critical'
    ]
    const friendlyWords = [
      '朋友',
      '亲爱的',
      '温暖',
      '亲切',
      '友好',
      '开心',
      'friend',
      'dear',
      'warm'
    ]
    // 🛡️ 修复：移除容易误判的技术术语，只保留真正的情感词汇
    const empatheticWords = [
      '心情',
      '情感',
      '同情',
      '关怀',
      '体贴',
      '温柔',
      'empathy',
      'caring',
      'compassion'
    ]
    const playfulWords = ['哈哈', '嘻嘻', '有趣', '好玩', '搞笑', '逗', 'haha', 'funny', 'playful']
    const professionalWords = [
      '专业',
      '技术',
      '分析',
      '数据',
      '研究',
      '报告',
      'professional',
      'technical',
      'analysis'
    ]

    // 计算各种情感的得分
    const scores = {
      excited: this.calculateEmotionScore(lowerText, excitedWords),
      calm: this.calculateEmotionScore(lowerText, calmWords),
      serious: this.calculateEmotionScore(lowerText, seriousWords),
      friendly: this.calculateEmotionScore(lowerText, friendlyWords),
      empathetic: this.calculateEmotionScore(lowerText, empatheticWords),
      playful: this.calculateEmotionScore(lowerText, playfulWords),
      professional: this.calculateEmotionScore(lowerText, professionalWords)
    }

    // 找出最高得分的情感
    const emotionEntries = Object.entries(scores) as Array<[keyof typeof scores, number]>
    const maxEmotion = emotionEntries.reduce((a, b) => (scores[a[0]] > scores[b[0]] ? a : b))[0]
    const maxScore = scores[maxEmotion]

    // 根据情感类型调整语音参数
    const emotionConfig = {
      excited: { speedModifier: 1.1, pausePattern: 'urgent' as const },
      calm: { speedModifier: 0.9, pausePattern: 'gentle' as const },
      serious: { speedModifier: 0.95, pausePattern: 'dramatic' as const },
      friendly: { speedModifier: 1.0, pausePattern: 'normal' as const },
      empathetic: { speedModifier: 0.9, pausePattern: 'gentle' as const },
      playful: { speedModifier: 1.05, pausePattern: 'normal' as const },
      professional: { speedModifier: 0.95, pausePattern: 'normal' as const }
    }

    const config = emotionConfig[maxEmotion] || emotionConfig.friendly

    console.log(`🧠 [增强情感分析] 检测到情感: ${maxEmotion} (强度: ${maxScore.toFixed(3)})`)
    console.log(`   🎵 语速调节: ${config.speedModifier}x, 停顿模式: ${config.pausePattern}`)
    console.log(
      `   📊 详细得分: excited=${scores.excited.toFixed(3)}, empathetic=${scores.empathetic.toFixed(3)}, professional=${scores.professional.toFixed(3)}`
    )

    return {
      emotionType: maxEmotion,
      intensity: maxScore,
      speedModifier: config.speedModifier,
      pausePattern: config.pausePattern
    }
  }

  /**
   * 计算情感得分
   */
  private calculateEmotionScore(text: string, keywords: string[]): number {
    let score = 0
    for (const keyword of keywords) {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length
      score += matches * (keyword.length / 10) // 较长的关键词权重更高
    }
    return Math.min(1, score / 3) // 归一化到0-1
  }

  /**
   * 智能检测文本语言
   */
  private detectLanguage(text: string): string {
    if (!text || !text.trim()) return 'en'

    const cleanText = text.trim().toLowerCase()

    // 中文检测（包括繁体和简体）
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh'
    }

    // 日文检测（平假名、片假名、汉字）
    if (
      /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text) &&
      /[\u3040-\u309f\u30a0-\u30ff]/.test(text)
    ) {
      return 'ja'
    }

    // 韩文检测
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko'
    }

    // 阿拉伯文检测
    if (/[\u0600-\u06ff\u0750-\u077f]/.test(text)) {
      return 'ar'
    }

    // 俄文检测
    if (/[\u0400-\u04ff]/.test(text)) {
      return 'ru'
    }

    // 印地语检测
    if (/[\u0900-\u097f]/.test(text)) {
      return 'hi'
    }

    // 欧洲语言检测（基于常见词汇和字符特征）

    // 法语检测
    const frenchPatterns = [
      /[àâäéèêëïîôöùûüÿç]/,
      /\b(le|la|les|un|une|des|et|ou|de|du|dans|avec|pour|par|sur|sous|être|avoir|faire|aller|dire|voir|savoir|pouvoir|vouloir|venir|prendre|donner|mettre|tenir|parler|porter|laisser|suivre|trouver|montrer|demander|passer|rester|tomber|sentir|partir|sortir|entrer|regarder|aimer|croire|comprendre|attendre|vivre|mourir|naître|devenir|ouvrir|fermer|commencer|finir|gagner|perdre|réussir|échouer|choisir|décider|accepter|refuser|aider|servir|utiliser|jouer|travailler|étudier|apprendre|enseigner|lire|écrire|écouter|entendre|répondre|appeler|téléphoner|acheter|vendre|payer|coûter|valoir|préférer|détester|espérer|rêver|réveiller|dormir|manger|boire|cuisiner|préparer|nettoyer|laver|habiter|déménager|voyager|conduire|marcher|courir|nager|voler|chanter|danser|rire|pleurer|sourire|rencontrer|connaître|présenter|saluer|remercier|excuser|pardonner|inviter|visiter|organiser|planifier|réserver|annuler|confirmer|rappeler|oublier|souvenir|reconnaître|identifier|expliquer|décrire|raconter|mentionner|suggérer|proposer|recommander|conseiller|interdire|permettre|autoriser|défendre|protéger|sauver|aider|soutenir|encourager|féliciter|critiquer|juger|évaluer|mesurer|compter|calculer|résoudre|réparer|construire|détruire|créer|inventer|découvrir|chercher|examiner|observer|regarder|surveiller|contrôler|vérifier|tester|essayer|réessayer|continuer|arrêter|cesser|pause|reprendre|recommencer|terminer|achever|réaliser|accomplir|atteindre|obtenir|recevoir|envoyer|livrer|distribuer|partager|diviser|séparer|joindre|connecter|relier|attacher|détacher|fixer|installer|enlever|retirer|ajouter|inclure|exclure|remplacer|changer|modifier|améliorer|empirer|augmenter|diminuer|réduire|élever|baisser|monter|descendre|avancer|reculer|approcher|éloigner|rapprocher|distancer|accélérer|ralentir|dépêcher|retarder|presser|calmer|rassurer|inquiéter|effrayer|surprendre|choquer|impressionner|intéresser|ennuyer|amuser|divertir|occuper|libérer|capturer|emprisonner|échapper|fuir|poursuivre|suivre|guider|diriger|mener|conduire|commander|obéir|respecter|honorer|admirer|envieux|jaloux|fier|honteux|coupable|innocent|responsable|irresponsable|sérieux|drôle|amusant|triste|heureux|content|satisfait|mécontent|déçu|surpris|étonné|confus|clair|sombre|lumineux|brillant|terne|coloré|noir|blanc|rouge|bleu|vert|jaune|orange|violet|rose|marron|gris|grand|petit|gros|mince|épais|fin|large|étroit|long|court|haut|bas|profond|superficiel|lourd|léger|dur|mou|chaud|froid|tiède|frais|sec|humide|mouillé|propre|sale|neuf|vieux|jeune|âgé|rapide|lent|fort|faible|facile|difficile|simple|compliqué|possible|impossible|probable|improbable|certain|incertain|sûr|dangereux|sécurisé|libre|occupé|disponible|indisponible|ouvert|fermé|public|privé|personnel|professionnel|officiel|informel|formel|naturel|artificiel|réel|faux|vrai|correct|incorrect|bon|mauvais|meilleur|pire|parfait|imparfait|complet|incomplet|entier|partiel|total|final|initial|premier|dernier|suivant|précédent)\b/
    ]

    if (frenchPatterns.some((pattern) => pattern.test(cleanText))) {
      return 'fr'
    }

    // 德语检测
    const germanPatterns = [
      /[äöüß]/,
      /\b(der|die|das|den|dem|des|ein|eine|eines|einem|einer|und|oder|aber|doch|sondern|denn|weil|da|obwohl|wenn|falls|als|während|bevor|nachdem|bis|seit|seitdem|sein|haben|werden|können|dürfen|mögen|müssen|sollen|wollen|lassen|gehen|kommen|machen|tun|sagen|sprechen|reden|hören|sehen|schauen|wissen|kennen|verstehen|lernen|lehren|studieren|arbeiten|spielen|leben|wohnen|bleiben|fahren|fliegen|reisen|laufen|rennen|springen|fallen|stehen|sitzen|liegen|schlafen|aufwachen|essen|trinken|kochen|kaufen|verkaufen|bezahlen|kosten|geben|nehmen|bekommen|bringen|holen|suchen|finden|verlieren|gewinnen|beginnen|anfangen|aufhören|enden|beenden|öffnen|schließen|helfen|danken|entschuldigen|bitten|fragen|antworten|rufen|telefonieren|schreiben|lesen|denken|glauben|hoffen|wünschen|träumen|lieben|mögen|hassen|freuen|ärgern|wundern|interessieren|langweilen|lachen|weinen|lächeln|schreien|flüstern|singen|tanzen|fotografieren|malen|zeichnen|bauen|reparieren|putzen|waschen|anziehen|ausziehen|tragen|ziehen|drücken|stoßen|werfen|fangen|halten|loslassen|berühren|küssen|umarmen|schlagen|verletzen|heilen|krank|gesund|müde|wach|hungrig|durstig|satt|warm|kalt|heiß|kühl|groß|klein|dick|dünn|lang|kurz|hoch|niedrig|breit|schmal|tief|flach|schwer|leicht|stark|schwach|schnell|langsam|alt|jung|neu|gut|schlecht|schön|hässlich|interessant|langweilig|wichtig|unwichtig|richtig|falsch|einfach|schwierig|leicht|schwer|möglich|unmöglich|sicher|unsicher|gefährlich|ruhig|laut|leise|hell|dunkel|klar|unklar|sauber|schmutzig|ordentlich|unordentlich|pünktlich|unpünktlich|früh|spät|heute|gestern|morgen|jetzt|gleich|später|immer|nie|manchmal|oft|selten|hier|dort|da|wo|wohin|woher|wie|was|wer|wen|wem|wessen|warum|weshalb|wieso|wann|wie)\b/
    ]

    if (germanPatterns.some((pattern) => pattern.test(cleanText))) {
      return 'de'
    }

    // 西班牙语检测
    const spanishPatterns = [
      /[ñáéíóúü]/,
      /\b(el|la|los|las|un|una|unos|unas|y|o|pero|sino|porque|que|de|del|al|en|con|por|para|sin|sobre|bajo|ante|tras|durante|mediante|según|entre|hasta|desde|hacia|contra|ser|estar|haber|tener|hacer|poder|decir|ir|ver|dar|saber|querer|llegar|pasar|deber|poner|parecer|quedar|creer|hablar|llevar|dejar|seguir|encontrar|llamar|venir|pensar|salir|volver|tomar|conocer|vivir|sentir|tratar|mirar|contar|empezar|esperar|buscar|existir|entrar|trabajar|escribir|perder|producir|acontecer|entender|pedir|recibir|recordar|terminar|permitir|aparecer|conseguir|comenzar|servir|sacar|necesitar|mantener|resultar|ler|cair|cambiar|apresentar|criar|abrir|considerar|ouvir|acabar|tornar|ganhar|formar|trazer|partir|morrer|aceitar|realizar|supor|compreender|conseguir|explicar|perguntar|tocar|reconhecer|estudar|alcançar|nascer|dirigir|correr|usar|pagar|ajudar|gustar|jogar|escutar|cumprir|oferecer|descobrir|levantar|tentar|decidir|repetir|construir|dormir|mover|continuar|aumentar|aprender|acontecer|desejar|aproximar|fugir|funcionar|quebrar|escolher|importar|valer|cortar|arrancar|coger|subir|bajar|encender|apagar|limpiar|cocinar|planchar|barrer|fregar|plantar|regar|cosechar|sembrar|crecer|morrer|nascer|envelhecer|cansar|descansar|dormir|despertar|soñar|pesadilla|recordar|olvidar|perdonar|disculpar|agradecer|felicitar|saludar|despedir|invitar|rifiutare|accettare|decidere|scegliere|preferire|desiderare|sperare|credere|pensare|ricordare|dimenticare|imparare|insegnare|spiegare|capire|sbagliare|riuscire|provare|tentare|cercare|controllare|verificare|dimostrare|mostrare|nascondere|coprire|scoprire|inventare|creare|costruire|distruggere|rompere|aggiustare|riparare|funzionare|accendere|spegnere|salire|scendere|cadere|saltare|nuotare|cucinare|preparare|servire|ordinare|prenotare|cancellare|confermare|chiamare|telefonare|rispondere|domandare|chiedere|raccontare|spiegare|descrivere|presentare|organizzare|pianificare|programmare|festeggiare|celebrare|ricordare|commemorare|dimenticare|perdonare)\b/
    ]

    if (spanishPatterns.some((pattern) => pattern.test(cleanText))) {
      return 'es'
    }

    // 意大利语检测
    const italianPatterns = [
      /[àèéìíîòóù]/,
      /\b(il|lo|la|i|gli|le|un|uno|una|e|o|ma|però|anche|se|che|di|del|della|dei|delle|dello|degli|a|al|alla|ai|alle|allo|agli|in|nel|nella|nei|nelle|nello|negli|con|per|da|dal|dalla|dai|dalle|dallo|dagli|su|sul|sulla|sui|sulle|sullo|sugli|essere|avere|fare|dire|andare|potere|dovere|volere|sapere|dare|stare|vedere|uscire|parlare|arrivare|portare|mettere|prendere|venire|bere|mangiare|lavorare|studiare|giocare|dormire|svegliarsi|alzarsi|lavarsi|vestirsi|tornare|partire|entrare|rimanere|diventare|nascere|morire|vivere|abitare|sentire|guardare|ascoltare|leggere|scrivere|aprire|chiudere|cominciare|finire|continuare|smettere|aiutare|cercare|trovare|perdere|vincere|comprare|vendere|pagare|costare|spendere|guadagnare|lavorare|riposare|viaggiare|guidare|camminare|correre|volare|cantare|ballare|ridere|piangere|sorridere|incontrare|conoscere|sposare|amare|odiare|piacere|interessare|preoccupare|annoiare|divertire|sorprendere|aiutare|ringraziare|scusare|invitare|rifiutare|accettare|decidere|scegliere|preferire|desiderare|sperare|credere|pensare|ricordare|dimenticare|imparare|insegnare|spiegare|capire|sbagliare|riuscire|provare|tentare|cercare|controllare|verificare|dimostrare|mostrare|nascondere|coprire|scoprire|inventare|creare|costruire|distruggere|rompere|aggiustare|riparare|funzionare|accendere|spegnere|salire|scendere|cadere|saltare|nuotare|cucinare|preparare|servire|ordinare|prenotare|cancellare|confermare|chiamare|telefonare|rispondere|domandare|chiedere|raccontare|spiegare|descrivere|presentare|organizzare|pianificare|programmare|festeggiare|celebrare|ricordare|commemorare|dimenticare|perdonare)\b/
    ]

    if (italianPatterns.some((pattern) => pattern.test(cleanText))) {
      return 'it'
    }

    // 葡萄牙语检测
    const portuguesePatterns = [
      /[ãâáàçéêíóôõú]/,
      /\b(o|a|os|as|um|uma|uns|umas|e|ou|mas|porém|contudo|todavia|entretanto|no|na|nos|nas|do|da|dos|das|ao|à|aos|às|em|com|por|para|de|desde|até|sobre|sob|entre|contra|sem|ser|estar|ter|haver|fazer|poder|dizer|ir|ver|dar|saber|querer|chegar|passar|dever|pôr|parecer|ficar|acreditar|falar|levar|deixar|seguir|encontrar|chamar|vir|pensar|sair|voltar|tomar|conhecer|viver|sentir|tratar|olhar|contar|começar|esperar|buscar|existir|entrar|trabalhar|escrever|perder|produzir|acontecer|entender|pedir|receber|lembrar|terminar|permitir|aparecer|conseguir|servir|tirar|precisar|manter|resultar|ler|cair|mudar|apresentar|criar|abrir|considerar|ouvir|acabar|tornar|ganhar|formar|trazer|partir|morrer|aceitar|realizar|supor|compreender|conseguir|explicar|perguntar|tocar|reconhecer|estudar|alcançar|nascer|dirigir|correr|usar|pagar|ajudar|gostar|jogar|escutar|cumprir|oferecer|descobrir|levantar|tentar|decidir|repetir|construir|dormir|mover|continuar|aumentar|aprender|acontecer|desejar|aproximar|fugir|funcionar|quebrar|escolher|importar|valer|cortar|pegar|subir|descer|acender|apagar|limpar|cozinhar|varrer|lavar|plantar|regar|colher|plantar|crescer|morrer|nascer|envelhecer|cansar|descansar|dormir|acordar|sonhar|lembrar|esquecer|perdoar|desculpar|agradecer|parabenizar|cumprimentar|despedir|convidar|recusar|aceitar|negar|afirmar|mentir|verdade|mentira|enganar|confiar|duvidar|acreditar|esperar|iludir|apaixonar|odiar|amar|querer|desejar|precisar|faltar|sobrar|bastar|alcançar|chegar|partir|voltar|ficar|estabelecer|instalar|sentar|levantar|deitar|banhar|lavar|secar|pentear|maquiar|vestir|despir|provar|comprar|vender|alugar|emprestar|devolver|dar|receber|enviar|mandar|entregar|pegar|guardar|tirar|pôr|retirar|adicionar|eliminar|apagar|escrever|ler|estudar|aprender|ensinar|explicar|entender|compreender|saber|conhecer|ignorar|descobrir|inventar|criar|construir|destruir|quebrar|consertar|reparar|funcionar|estragar|acender|apagar|abrir|fechar|entrar|sair|subir|descer|ir|vir|chegar|partir|ficar|estar|ser|ter|haver|fazer|dizer|ver|ouvir|tocar|cheirar|provar|sentir|pensar|lembrar|esquecer|sonhar|imaginar|acreditar|supor|opinar|considerar|julgar|criticar|elogiar|parabenizar|agradecer|desculpar|perdoar|pedir|rogar|suplicar|exigir|ordenar|mandar|proibir|permitir|autorizar|negar|recusar|aceitar|aprovar|desaprovar|gostar|adorar|fascinar|odiar|detestar|incomodar|preocupar|tranquilizar|acalmar|relaxar|estressar|divertir|aborrecer|entreter|interessar|desinteressar|surpreender|impressionar|decepcionar|satisfazer|agradar|desagradar|irritar|alegrar|entristecer|emocionar|comover|tocar|mover)\b/
    ]

    if (portuguesePatterns.some((pattern) => pattern.test(cleanText))) {
      return 'pt'
    }

    // 默认英语
    return 'en'
  }

  /**
   * 根据语言智能调整播放速度 - 让语音更自然、更拟人
   * 采用保守的渐进式优化策略
   */
  private selectSpeedForLanguage(language: string): number {
    // 基于OpenAI社区实测数据和语言学特性的保守调整
    // 第一版采用温和的速度差异，后续可根据用户反馈微调
    const baseSpeedMapping = {
      en: 0.9, // 英语：从178 WPM温和降速，保守起步
      zh: 1.0, // 中文：用户满意的现有速度，不变
      ja: 0.95, // 日语：轻微调整，让发音更清晰
      ko: 0.95, // 韩语：轻微调整，让发音更清晰
      fr: 0.95, // 法语：轻微放慢，保持优雅
      de: 0.95, // 德语：轻微放慢，保持庄重
      es: 0.95, // 西班牙语：轻微调整
      it: 0.95, // 意大利语：轻微调整
      pt: 0.95, // 葡萄牙语：轻微调整
      ru: 1.0, // 俄语：社区测试130 WPM正常，保持
      ar: 0.95, // 阿拉伯语：轻微放慢
      hi: 0.95 // 印地语：轻微放慢
    }

    const baseSpeed = baseSpeedMapping[language] || 0.95 // 未知语言保守默认

    // TODO: 未来版本可以添加用户全局语速偏好倍数
    // const userSpeedMultiplier = await this.getUserSpeedPreference()
    // const finalSpeed = baseSpeed * userSpeedMultiplier

    console.log(`[TTS服务] 智能语速调整 - 语言: ${language} → 基础语速: ${baseSpeed} (保守优化)`)
    return baseSpeed
  }

  /**
   * 停止当前播放
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }

    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }

    this.isPlaying = false
  }

  /**
   * 获取播放状态
   */
  getPlayingStatus(): boolean {
    return this.isPlaying
  }

  // 🎭 情感语音生成方法：生成音频数据但不播放
  async generateAudioBlob(text: string): Promise<Blob> {
    // 🎯 检查播放权限
    if (!this.requestPlayPermission()) {
      throw new Error('TTS服务被其他高优先级服务阻止')
    }

    console.log(`[TTS服务] 🎭 情感语音生成开始: ${text.length}字符`)

    try {
      const openaiProvider = await this.configPresenter.getProviderById('openai')

      if (!openaiProvider || !openaiProvider.apiKey) {
        throw new Error('OpenAI配置未找到或API密钥缺失')
      }

      const language = this.detectLanguage(text)

      // 🎯 使用情感语音优化系统
      const optimizedParams = this.optimizeVoiceParameters(text, language)

      console.log(`[TTS服务] 🎭 情感优化参数:`)
      console.log(`   🌍 语言: ${language}`)
      console.log(`   🎵 语音: ${optimizedParams.voice}`)
      console.log(`   ⚡ 语速: ${optimizedParams.speed}`)
      console.log(`   🎬 模型: ${optimizedParams.model}`)

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiProvider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: optimizedParams.model,
          input: text,
          voice: optimizedParams.voice,
          speed: optimizedParams.speed
        })
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`TTS API请求失败: ${response.status} - ${errorText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        throw new Error('收到空的音频数据')
      }

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      console.log(`[TTS服务] 🎭 情感语音生成完成: ${audioBlob.size}字节`)
      console.log(`   🎯 情感效果: ${optimizedParams.voice}语音 + ${optimizedParams.speed}x语速`)

      return audioBlob
    } catch (error) {
      console.error(`[TTS服务] 🎭 情感语音生成失败:`, error)
      throw error
    } finally {
      // 🎯 音频生成完成后立即释放权限，允许其他TTS服务播放
      ttsCoordinator.releaseService(this.instanceId)
      console.log(`🎯 [TTS服务] 已释放权限，允许其他服务播放`)
    }
  }

  /**
   * 🎯 新增：异性语音回应逻辑（同步版本）
   */
  private applyOppositeGenderLogicSync(originalVoice: string): string {
    try {
      // 检查是否启用异性语音回应
      if (!TTSService.voicePreferences.oppositeGenderResponseEnabled) {
        console.log(`🎯 [异性语音] 异性语音回应已禁用，使用原始语音: ${originalVoice}`)
        return originalVoice
      }

      // 获取用户性别（同步版本）
      const userGender = this.determineUserGenderSync()

      if (userGender === 'unknown') {
        console.log(`🎯 [异性语音] 用户性别未知，使用原始语音: ${originalVoice}`)
        return originalVoice
      }

      // 根据用户性别选择异性语音
      const oppositeGenderVoice = this.selectOppositeGenderVoice(userGender, originalVoice)

      console.log(
        `🎯 [异性语音] 用户性别: ${userGender}, 原始语音: ${originalVoice} → 异性语音: ${oppositeGenderVoice}`
      )

      return oppositeGenderVoice
    } catch (error) {
      console.error(`🎯 [异性语音] 处理失败，使用原始语音:`, error)
      return originalVoice
    }
  }

  /**
   * 🎯 新增：加载用户语音偏好设置
   */
  private async loadVoicePreferences(): Promise<void> {
    try {
      const genderDetectionEnabled =
        ((await this.configPresenter.getSetting('voice_gender_detection')) as boolean) ?? true
      const oppositeGenderResponseEnabled =
        ((await this.configPresenter.getSetting('voice_opposite_gender_response')) as boolean) ??
        true
      const userGender =
        ((await this.configPresenter.getSetting('voice_user_gender')) as
          | 'auto'
          | 'male'
          | 'female') ?? 'auto'
      const preferredMaleVoice =
        ((await this.configPresenter.getSetting('voice_preferred_male_voice')) as string) ??
        VoiceConfig.voiceMapping.defaultMaleVoice
      const preferredFemaleVoice =
        ((await this.configPresenter.getSetting('voice_preferred_female_voice')) as string) ??
        VoiceConfig.voiceMapping.defaultFemaleVoice

      TTSService.voicePreferences = {
        genderDetectionEnabled,
        oppositeGenderResponseEnabled,
        userGender,
        preferredMaleVoice,
        preferredFemaleVoice
      }

      console.log(`🎯 [语音偏好] 已加载设置:`, TTSService.voicePreferences)
    } catch (error) {
      console.error('加载语音偏好设置失败:', error)
    }
  }

  /**
   * 🎯 新增：确定用户性别（同步版本）
   */
  private determineUserGenderSync(): 'male' | 'female' | 'unknown' {
    // 如果用户手动设置了性别
    if (TTSService.voicePreferences.userGender !== 'auto') {
      const manualGender = TTSService.voicePreferences.userGender as 'male' | 'female'
      console.log(`🎯 [性别确定] 使用手动设置: ${manualGender}`)
      return manualGender
    }

    // 如果禁用了自动检测
    if (!TTSService.voicePreferences.genderDetectionEnabled) {
      console.log(`🎯 [性别确定] 自动检测已禁用，返回未知`)
      return 'unknown'
    }

    // 使用缓存的检测结果
    if (TTSService.detectedUserGender !== 'unknown' && TTSService.genderDetectionConfidence > 0.6) {
      console.log(
        `🎯 [性别确定] 使用缓存结果: ${TTSService.detectedUserGender} (置信度: ${TTSService.genderDetectionConfidence.toFixed(2)})`
      )
      return TTSService.detectedUserGender
    }

    console.log(`🎯 [性别确定] 无可用的性别信息，返回未知`)
    return 'unknown'
  }

  /**
   * 🎯 新增：音频性别检测（基于基频分析）
   */
  async detectUserGenderFromAudio(audioBlob: Blob): Promise<VoiceGenderDetectionResult> {
    try {
      console.log(`🎤 [性别检测] 开始分析音频，大小: ${(audioBlob.size / 1024).toFixed(2)} KB`)

      // 使用Web Audio API分析音频
      const audioContext = new AudioContext()
      try {
        const arrayBuffer = await audioBlob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // 提取音频数据
        const channelData = audioBuffer.getChannelData(0)
        const sampleRate = audioBuffer.sampleRate

        // 计算基频（简化的自相关算法）
        const fundamentalFrequency = this.calculateFundamentalFrequency(channelData, sampleRate)

        // 基于基频判断性别
        let detectedGender: 'male' | 'female' | 'unknown' = 'unknown'
        let confidence = 0

        if (fundamentalFrequency > 0) {
          // 使用配置化的基频阈值
          const config = VoiceConfig.genderDetection

          if (fundamentalFrequency < config.maleFrequencyThreshold) {
            detectedGender = 'male'
            confidence = Math.max(
              config.minConfidence,
              Math.min(
                config.maxConfidence,
                (config.maleFrequencyThreshold - fundamentalFrequency) / 55
              )
            )
          } else if (fundamentalFrequency > config.femaleFrequencyThreshold) {
            detectedGender = 'female'
            confidence = Math.max(
              config.minConfidence,
              Math.min(
                config.maxConfidence,
                (fundamentalFrequency - config.femaleFrequencyThreshold) / 65
              )
            )
          } else {
            // 重叠区域，置信度较低
            if (fundamentalFrequency < config.overlapLowThreshold) {
              detectedGender = 'male'
              confidence = config.overlapConfidence
            } else {
              detectedGender = 'female'
              confidence = config.overlapConfidence
            }
          }
        }

        // 更新缓存
        TTSService.detectedUserGender = detectedGender
        TTSService.genderDetectionConfidence = confidence

        const result: VoiceGenderDetectionResult = {
          detectedGender,
          confidence,
          fundamentalFrequency,
          method: 'frequency'
        }

        console.log(`🎤 [性别检测] 完成分析:`, result)

        // 🎯 性别检测完成后立即释放权限，不阻止其他TTS服务
        ttsCoordinator.releaseService(this.instanceId)
        console.log(`🎯 [性别检测] 已释放TTS权限，允许其他服务播放`)

        return result
      } finally {
        // 🛡️ 确保AudioContext被正确关闭，避免内存泄漏
        await audioContext.close()
      }
    } catch (error) {
      console.error('音频性别检测失败:', error)
      // 🎯 即使出错也要释放权限
      ttsCoordinator.releaseService(this.instanceId)
      return {
        detectedGender: 'unknown',
        confidence: 0,
        fundamentalFrequency: 0,
        method: 'frequency'
      }
    }
  }

  /**
   * 🎯 新增：计算基频（简化实现）
   */
  private calculateFundamentalFrequency(audioData: Float32Array, sampleRate: number): number {
    try {
      // 简化的自相关算法计算基频
      const bufferSize = Math.min(audioData.length, sampleRate) // 最多分析1秒
      const correlations = new Array(bufferSize / 2)

      // 寻找能量最大的片段
      let maxEnergy = 0
      let maxEnergyStart = 0
      const windowSize = Math.floor(
        sampleRate * (VoiceConfig.genderDetection.analysisWindowMs / 1000)
      ) // 配置化窗口大小

      for (let i = 0; i < bufferSize - windowSize; i += windowSize / 4) {
        let energy = 0
        for (let j = 0; j < windowSize; j++) {
          energy += audioData[i + j] * audioData[i + j]
        }
        if (energy > maxEnergy) {
          maxEnergy = energy
          maxEnergyStart = i
        }
      }

      // 如果能量太小，可能是静音
      if (maxEnergy < VoiceConfig.genderDetection.silenceEnergyThreshold) {
        return 0
      }

      // 在能量最大的片段计算自相关
      const analysisStart = maxEnergyStart
      const analysisLength = Math.min(windowSize, bufferSize - analysisStart)

      // 计算自相关
      for (let lag = VoiceConfig.genderDetection.minLagSamples; lag < analysisLength / 2; lag++) {
        let correlation = 0
        for (let i = 0; i < analysisLength - lag; i++) {
          correlation += audioData[analysisStart + i] * audioData[analysisStart + i + lag]
        }
        correlations[lag] = correlation
      }

      // 寻找第一个显著的峰值
      let maxCorrelation = 0
      let bestLag = 0

      for (let lag = VoiceConfig.genderDetection.minLagSamples; lag < correlations.length; lag++) {
        if (correlations[lag] > maxCorrelation) {
          maxCorrelation = correlations[lag]
          bestLag = lag
        }
      }

      // 计算基频
      const fundamentalFrequency = bestLag > 0 ? sampleRate / bestLag : 0

      // 合理性检查：使用配置的基频范围
      const config = VoiceConfig.genderDetection
      if (
        fundamentalFrequency < config.minValidFrequency ||
        fundamentalFrequency > config.maxValidFrequency
      ) {
        return 0
      }

      return fundamentalFrequency
    } catch (error) {
      console.error('基频计算失败:', error)
      return 0
    }
  }

  /**
   * 🎯 新增：选择异性语音
   */
  private selectOppositeGenderVoice(
    userGender: 'male' | 'female',
    originalVoice: string
  ): VoiceType {
    if (userGender === 'male') {
      // 男用户 → 选择女声
      const preferredFemaleVoice = TTSService.voicePreferences.preferredFemaleVoice

      // 如果偏好的女声可用，使用偏好的
      if (isFemaleVoice(preferredFemaleVoice)) {
        return preferredFemaleVoice
      }

      // 否则，如果原始语音是女声，保持原样
      if (isFemaleVoice(originalVoice)) {
        return originalVoice
      }

      // 最后使用默认女声
      return VoiceConfig.voiceMapping.defaultFemaleVoice
    } else {
      // 女用户 → 选择男声
      const preferredMaleVoice = TTSService.voicePreferences.preferredMaleVoice

      // 如果偏好的男声可用，使用偏好的
      if (isMaleVoice(preferredMaleVoice)) {
        return preferredMaleVoice
      }

      // 否则，如果原始语音是男声，保持原样
      if (isMaleVoice(originalVoice)) {
        return originalVoice
      }

      // 最后使用默认男声
      return VoiceConfig.voiceMapping.defaultMaleVoice
    }
  }

  /**
   * 🎯 新增：手动设置用户性别
   */
  async setUserGender(gender: 'auto' | 'male' | 'female'): Promise<void> {
    try {
      await this.configPresenter.setSetting('voice_user_gender', gender)
      TTSService.voicePreferences.userGender = gender

      console.log(`🎯 [性别设置] 用户性别已设置为: ${gender}`)

      // 如果设置为手动，清除自动检测缓存
      if (gender !== 'auto') {
        TTSService.detectedUserGender = 'unknown'
        TTSService.genderDetectionConfidence = 0
      }
    } catch (error) {
      console.error('设置用户性别失败:', error)
    }
  }

  /**
   * 🎯 新增：设置异性语音回应开关
   */
  async setOppositeGenderResponse(enabled: boolean): Promise<void> {
    try {
      await this.configPresenter.setSetting('voice_opposite_gender_response', enabled)
      TTSService.voicePreferences.oppositeGenderResponseEnabled = enabled

      console.log(`🎯 [异性语音] 异性语音回应已${enabled ? '启用' : '禁用'}`)
    } catch (error) {
      console.error('设置异性语音回应失败:', error)
    }
  }

  /**
   * 🎯 新增：设置偏好语音
   */
  async setPreferredVoices(maleVoice: string, femaleVoice: string): Promise<void> {
    try {
      await this.configPresenter.setSetting('voice_preferred_male_voice', maleVoice)
      await this.configPresenter.setSetting('voice_preferred_female_voice', femaleVoice)

      TTSService.voicePreferences.preferredMaleVoice = maleVoice
      TTSService.voicePreferences.preferredFemaleVoice = femaleVoice

      console.log(`🎯 [偏好语音] 已设置 - 男声: ${maleVoice}, 女声: ${femaleVoice}`)
    } catch (error) {
      console.error('设置偏好语音失败:', error)
    }
  }

  /**
   * 🎯 新增：获取当前语音偏好设置
   */
  getVoicePreferences(): VoicePreferences {
    return { ...TTSService.voicePreferences }
  }

  /**
   * 🎯 新增：获取性别检测结果
   */
  getGenderDetectionResult(): { gender: 'male' | 'female' | 'unknown'; confidence: number } {
    return {
      gender: TTSService.detectedUserGender,
      confidence: TTSService.genderDetectionConfidence
    }
  }
}

// 创建单例实例
export const ttsService = new TTSService()
