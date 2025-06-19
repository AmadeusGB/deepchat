import { usePresenter } from '@/composables/usePresenter'

export interface TTSOptions {
  voice?: string
  speed?: number
  language?: string
}

export class TTSService {
  private configPresenter = usePresenter('configPresenter')
  private currentAudio: HTMLAudioElement | null = null
  private isPlaying = false
  private requestQueue: Promise<void> = Promise.resolve() // 请求队列，避免并发

  /**
   * 使用GPT TTS API进行语音合成（带重试机制）
   */
  async playWithGPTTTS(text: string, options: TTSOptions = {}): Promise<void> {
    // 打印TTS文字内容
    console.log('\n[TTS文字转语音] 开始播放:')
    console.log(text)
    console.log(`[字符数: ${text.length}] [语言: ${this.detectLanguage(text) === 'zh' ? '中文' : '英文'}] [时间: ${new Date().toLocaleString()}]`)
    
    // 使用队列确保请求按顺序执行，避免并发问题
    this.requestQueue = this.requestQueue.then(() => this.playWithGPTTTSInternal(text, options))
    return this.requestQueue
  }

  /**
   * 内部TTS实现（带重试）
   */
  private async playWithGPTTTSInternal(text: string, options: TTSOptions = {}): Promise<void> {
    const maxRetries = 2 // 最多重试2次
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        await this.attemptGPTTTS(text, options, attempt)
        return // 成功则直接返回
      } catch (error) {
        lastError = error as Error
        console.warn(`[TTS服务] 🔄 第${attempt}次尝试失败:`, error)
        
        if (attempt <= maxRetries) {
          // 指数退避：第一次重试等待1秒，第二次等待2秒
          const delay = attempt * 1000
          console.log(`[TTS服务] ⏳ ${delay}ms后进行第${attempt + 1}次尝试`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // 所有重试都失败
    console.error(`[TTS服务] ❌ 所有重试都失败，最后错误:`, lastError)
    console.log(`[TTS服务] 🔇 TTS完全失败，静默跳过播放`)
  }

  /**
   * 单次TTS尝试
   */
  private async attemptGPTTTS(text: string, _options: TTSOptions, attempt: number): Promise<void> {
    // 简化日志输出
    if (attempt === 1) {
      console.log(`[TTS服务] 开始播放 (${text.length}字符)`)
    } else {
      console.log(`[TTS服务] 重试第${attempt}次`)
    }

    // 优化超时时间：基础20秒 + 每100字符增加8秒，最大90秒
    const baseTimeout = 20000
    const extraTimeout = Math.ceil(text.length / 100) * 8000
    const dynamicTimeout = Math.max(baseTimeout, Math.min(baseTimeout + extraTimeout, 90000))

    const openaiProvider = await this.configPresenter.getProviderById('openai')
    
    if (!openaiProvider || !openaiProvider.apiKey) {
      throw new Error('OpenAI配置未找到或API密钥缺失')
    }
    
    const language = this.detectLanguage(text)
    const voice = this.selectVoiceForLanguage(language)
    const speed = this.selectSpeedForLanguage(language)
    
    // 根据尝试次数调整API超时时间
    const apiTimeout = 10000 + (attempt - 1) * 5000 // 每次重试增加5秒
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, apiTimeout)
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiProvider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          speed: speed
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`TTS API请求失败: ${response.status} - ${errorText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        throw new Error('收到空的音频数据')
      }

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)

      await this.playAudioFromUrl(audioUrl, dynamicTimeout)
      
      URL.revokeObjectURL(audioUrl)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  }

  /**
   * 使用浏览器原生SpeechSynthesis API
   */
  async playWithBrowserTTS(text: string): Promise<void> {
    // 打印TTS文字内容
    console.log('\n[TTS文字转语音-浏览器] 开始播放:')
    console.log(text)
    console.log(`[字符数: ${text.length}] [语言: ${this.detectLanguage(text) === 'zh' ? '中文' : '英文'}] [时间: ${new Date().toLocaleString()}]`)
    
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.error(`[TTS服务] 浏览器不支持语音合成`)
        reject(new Error('浏览器不支持语音合成'))
        return
      }

      // 停止当前播放
      this.stop()

      const utterance = new SpeechSynthesisUtterance(text)
      
      // 设置语音参数
      const language = this.detectLanguage(text)
      utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US'
      utterance.rate = this.selectSpeedForLanguage(language)
      utterance.pitch = 1.0
      utterance.volume = 1.0

      console.log(`[TTS服务] 浏览器TTS配置:`, {
        language,
        lang: utterance.lang,
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume
      })

      // 选择合适的语音
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith(utterance.lang) && voice.localService
      )
      if (preferredVoice) {
        utterance.voice = preferredVoice
        console.log(`[TTS服务] 选择语音: ${preferredVoice.name}`)
      } else {
        console.log(`[TTS服务] 未找到合适的本地语音，使用默认语音`)
      }

      utterance.onstart = () => {
        console.log(`[TTS服务] 浏览器TTS开始播放`)
        this.isPlaying = true
      }

      utterance.onend = () => {
        console.log(`[TTS服务] 浏览器TTS播放完成`)
        this.isPlaying = false
        resolve()
      }

      utterance.onerror = (event) => {
        console.error(`[TTS服务] 浏览器TTS播放错误:`, event.error)
        this.isPlaying = false
        reject(new Error(`语音合成失败: ${event.error}`))
      }

      console.log(`[TTS服务] 开始浏览器语音合成`)
      this.isPlaying = true
      speechSynthesis.speak(utterance)
      
      // 设置浏览器TTS超时（基于文本长度）
      const browserTimeout = Math.max(15000, text.length * 100) // 每字符100ms，最少15秒
      setTimeout(() => {
        if (this.isPlaying) {
          console.log(`[TTS服务] 浏览器TTS播放超时`)
          speechSynthesis.cancel()
          this.isPlaying = false
          reject(new Error('浏览器TTS播放超时'))
        }
      }, browserTimeout)
    })
  }

  /**
   * 播放音频URL
   */
  private async playAudioFromUrl(url: string, timeout: number): Promise<void> {
    const playStartTime = Date.now()
    
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(url)
      
      // 添加超时机制，防止音频播放卡住
      const timeoutHandle = setTimeout(() => {
        console.error(`[TTS服务] 音频播放超时 (${timeout/1000}秒)`)
        this.isPlaying = false
        if (this.currentAudio) {
          this.currentAudio.pause()
          this.currentAudio = null
        }
        reject(new Error('音频播放超时'))
      }, timeout)
      
      const cleanup = () => {
        const playDuration = Date.now() - playStartTime
        console.log(`[TTS服务] 清理音频资源，播放耗时: ${playDuration}ms`)
        
        // 添加播放完成的详细信息
        console.log(`[TTS播放完成] 耗时: ${(playDuration/1000).toFixed(2)}秒 完成时间: ${new Date().toLocaleString()}`)
        
        clearTimeout(timeoutHandle)
        this.isPlaying = false
        this.currentAudio = null
      }
      
      this.currentAudio.onloadeddata = () => {
        this.isPlaying = true
        this.currentAudio!.play().then(() => {
          // 播放开始成功
        }).catch((error) => {
          console.error(`[TTS服务] 音频播放开始失败:`, error)
          cleanup()
          reject(error)
        })
      }

      this.currentAudio.onended = () => {
        cleanup()
        resolve()
      }

      this.currentAudio.onerror = (event) => {
        console.error(`[TTS服务] 音频播放错误:`, event)
        cleanup()
        reject(new Error('音频播放失败'))
      }

      this.currentAudio.onabort = () => {
        cleanup()
        resolve() // 中止不算错误，正常结束
      }
    })
  }

  /**
   * 统一语音选择 - 所有语言使用同一个声音确保一致性
   */
  private selectVoiceForLanguage(language: string): string {
    // 用户需求：所有语言都使用同一个人的声音，确保语音对话的一致性
    // 选择 'alloy' 作为统一语音，因为它对多种语言的发音都比较自然
    const unifiedVoice = 'alloy'
    
    console.log(`[TTS服务] 统一语音策略 - 语言: ${language} → 统一语音: ${unifiedVoice}`)
    return unifiedVoice
  }

  /**
   * 根据语言智能调整播放速度 - 让语音更自然、更拟人
   * 采用保守的渐进式优化策略
   */
  private selectSpeedForLanguage(language: string): number {
    // 基于OpenAI社区实测数据和语言学特性的保守调整
    // 第一版采用温和的速度差异，后续可根据用户反馈微调
    const baseSpeedMapping = {
      'en': 0.9,   // 英语：从178 WPM温和降速，保守起步
      'zh': 1.0,   // 中文：用户满意的现有速度，不变
      'ja': 0.95,  // 日语：轻微调整，让发音更清晰
      'ko': 0.95,  // 韩语：轻微调整，让发音更清晰
      'fr': 0.95,  // 法语：轻微放慢，保持优雅
      'de': 0.95,  // 德语：轻微放慢，保持庄重
      'es': 0.95,  // 西班牙语：轻微调整
      'it': 0.95,  // 意大利语：轻微调整
      'pt': 0.95,  // 葡萄牙语：轻微调整
      'ru': 1.0,   // 俄语：社区测试130 WPM正常，保持
      'ar': 0.95,  // 阿拉伯语：轻微放慢
      'hi': 0.95   // 印地语：轻微放慢
    }
    
    const baseSpeed = baseSpeedMapping[language] || 0.95 // 未知语言保守默认
    
    // TODO: 未来版本可以添加用户全局语速偏好倍数
    // const userSpeedMultiplier = await this.getUserSpeedPreference()
    // const finalSpeed = baseSpeed * userSpeedMultiplier
    
    console.log(`[TTS服务] 智能语速调整 - 语言: ${language} → 基础语速: ${baseSpeed} (保守优化)`)
    return baseSpeed
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
    if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text) && /[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
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
    
    if (frenchPatterns.some(pattern => pattern.test(cleanText))) {
      return 'fr'
    }
    
    // 德语检测
    const germanPatterns = [
      /[äöüß]/,
      /\b(der|die|das|den|dem|des|ein|eine|eines|einem|einer|und|oder|aber|doch|sondern|denn|weil|da|obwohl|wenn|falls|als|während|bevor|nachdem|bis|seit|seitdem|sein|haben|werden|können|dürfen|mögen|müssen|sollen|wollen|lassen|gehen|kommen|machen|tun|sagen|sprechen|reden|hören|sehen|schauen|wissen|kennen|verstehen|lernen|lehren|studieren|arbeiten|spielen|leben|wohnen|bleiben|fahren|fliegen|reisen|laufen|rennen|springen|fallen|stehen|sitzen|liegen|schlafen|aufwachen|essen|trinken|kochen|kaufen|verkaufen|bezahlen|kosten|geben|nehmen|bekommen|bringen|holen|suchen|finden|verlieren|gewinnen|beginnen|anfangen|aufhören|enden|beenden|öffnen|schließen|helfen|danken|entschuldigen|bitten|fragen|antworten|rufen|telefonieren|schreiben|lesen|denken|glauben|hoffen|wünschen|träumen|lieben|mögen|hassen|freuen|ärgern|wundern|interessieren|langweilen|lachen|weinen|lächeln|schreien|flüstern|singen|tanzen|fotografieren|malen|zeichnen|bauen|reparieren|putzen|waschen|anziehen|ausziehen|tragen|ziehen|drücken|stoßen|werfen|fangen|halten|loslassen|berühren|küssen|umarmen|schlagen|verletzen|heilen|krank|gesund|müde|wach|hungrig|durstig|satt|warm|kalt|heiß|kühl|groß|klein|dick|dünn|lang|kurz|hoch|niedrig|breit|schmal|tief|flach|schwer|leicht|stark|schwach|schnell|langsam|alt|jung|neu|gut|schlecht|schön|hässlich|interessant|langweilig|wichtig|unwichtig|richtig|falsch|einfach|schwierig|leicht|schwer|möglich|unmöglich|sicher|unsicher|gefährlich|ruhig|laut|leise|hell|dunkel|klar|unklar|sauber|schmutzig|ordentlich|unordentlich|pünktlich|unpünktlich|früh|spät|heute|gestern|morgen|jetzt|gleich|später|immer|nie|manchmal|oft|selten|hier|dort|da|wo|wohin|woher|wie|was|wer|wen|wem|wessen|warum|weshalb|wieso|wann|wie)\b/
    ]
    
    if (germanPatterns.some(pattern => pattern.test(cleanText))) {
      return 'de'
    }
    
    // 西班牙语检测
    const spanishPatterns = [
      /[ñáéíóúü]/,
      /\b(el|la|los|las|un|una|unos|unas|y|o|pero|sino|porque|que|de|del|al|en|con|por|para|sin|sobre|bajo|ante|tras|durante|mediante|según|entre|hasta|desde|hacia|contra|ser|estar|haber|tener|hacer|poder|decir|ir|ver|dar|saber|querer|llegar|pasar|deber|poner|parecer|quedar|creer|hablar|llevar|dejar|seguir|encontrar|llamar|venir|pensar|salir|volver|tomar|conocer|vivir|sentir|tratar|mirar|contar|empezar|esperar|buscar|existir|entrar|trabajar|escribir|perder|producir|acontecer|entender|pedir|recibir|recordar|terminar|permitir|aparecer|conseguir|comenzar|servir|sacar|necesitar|mantener|resultar|ler|cair|cambiar|apresentar|criar|abrir|considerar|ouvir|acabar|tornar|ganhar|formar|trazer|partir|morrer|aceitar|realizar|supor|compreender|conseguir|explicar|perguntar|tocar|reconhecer|estudar|alcançar|nascer|dirigir|correr|usar|pagar|ajudar|gustar|jogar|escutar|cumprir|oferecer|descobrir|levantar|tentar|decidir|repetir|construir|dormir|mover|continuar|aumentar|aprender|acontecer|desejar|aproximar|fugir|funcionar|quebrar|escolher|importar|valer|cortar|arrancar|coger|subir|bajar|encender|apagar|limpiar|cocinar|planchar|barrer|fregar|plantar|regar|cosechar|sembrar|crecer|morrer|nascer|envelhecer|cansar|descansar|dormir|despertar|soñar|pesadilla|recordar|olvidar|perdonar|disculpar|agradecer|felicitar|saludar|despedir|invitar|rifiutare|accettare|decidere|scegliere|preferire|desiderare|sperare|credere|pensare|ricordare|dimenticare|imparare|insegnare|spiegare|capire|sbagliare|riuscire|provare|tentare|cercare|controllare|verificare|dimostrare|mostrare|nascondere|coprire|scoprire|inventare|creare|costruire|distruggere|rompere|aggiustare|riparare|funzionare|accendere|spegnere|salire|scendere|cadere|saltare|nuotare|cucinare|preparare|servire|ordinare|prenotare|cancellare|confermare|chiamare|telefonare|rispondere|domandare|chiedere|raccontare|spiegare|descrivere|presentare|organizzare|pianificare|programmare|festeggiare|celebrare|ricordare|commemorare|dimenticare|perdonare)\b/
    ]
    
    if (spanishPatterns.some(pattern => pattern.test(cleanText))) {
      return 'es'
    }
    
    // 意大利语检测
    const italianPatterns = [
      /[àèéìíîòóù]/,
      /\b(il|lo|la|i|gli|le|un|uno|una|e|o|ma|però|anche|se|che|di|del|della|dei|delle|dello|degli|a|al|alla|ai|alle|allo|agli|in|nel|nella|nei|nelle|nello|negli|con|per|da|dal|dalla|dai|dalle|dallo|dagli|su|sul|sulla|sui|sulle|sullo|sugli|essere|avere|fare|dire|andare|potere|dovere|volere|sapere|dare|stare|vedere|uscire|parlare|arrivare|portare|mettere|prendere|venire|bere|mangiare|lavorare|studiare|giocare|dormire|svegliarsi|alzarsi|lavarsi|vestirsi|tornare|partire|entrare|rimanere|diventare|nascere|morire|vivere|abitare|sentire|guardare|ascoltare|leggere|scrivere|aprire|chiudere|cominciare|finire|continuare|smettere|aiutare|cercare|trovare|perdere|vincere|comprare|vendere|pagare|costare|spendere|guadagnare|lavorare|riposare|viaggiare|guidare|camminare|correre|volare|cantare|ballare|ridere|piangere|sorridere|incontrare|conoscere|sposare|amare|odiare|piacere|interessare|preoccupare|annoiare|divertire|sorprendere|aiutare|ringraziare|scusare|invitare|rifiutare|accettare|decidere|scegliere|preferire|desiderare|sperare|credere|pensare|ricordare|dimenticare|imparare|insegnare|spiegare|capire|sbagliare|riuscire|provare|tentare|cercare|controllare|verificare|dimostrare|mostrare|nascondere|coprire|scoprire|inventare|creare|costruire|distruggere|rompere|aggiustare|riparare|funzionare|accendere|spegnere|salire|scendere|cadere|saltare|nuotare|cucinare|preparare|servire|ordinare|prenotare|cancellare|confermare|chiamare|telefonare|rispondere|domandare|chiedere|raccontare|spiegare|descrivere|presentare|organizzare|pianificare|programmare|festeggiare|celebrare|ricordare|commemorare|dimenticare|perdonare)\b/
    ]
    
    if (italianPatterns.some(pattern => pattern.test(cleanText))) {
      return 'it'
    }
    
    // 葡萄牙语检测
    const portuguesePatterns = [
      /[ãâáàçéêíóôõú]/,
      /\b(o|a|os|as|um|uma|uns|umas|e|ou|mas|porém|contudo|todavia|entretanto|no|na|nos|nas|do|da|dos|das|ao|à|aos|às|em|com|por|para|de|desde|até|sobre|sob|entre|contra|sem|ser|estar|ter|haver|fazer|poder|dizer|ir|ver|dar|saber|querer|chegar|passar|dever|pôr|parecer|ficar|acreditar|falar|levar|deixar|seguir|encontrar|chamar|vir|pensar|sair|voltar|tomar|conhecer|viver|sentir|tratar|olhar|contar|começar|esperar|buscar|existir|entrar|trabalhar|escrever|perder|produzir|acontecer|entender|pedir|receber|lembrar|terminar|permitir|aparecer|conseguir|servir|tirar|precisar|manter|resultar|ler|cair|mudar|apresentar|criar|abrir|considerar|ouvir|acabar|tornar|ganhar|formar|trazer|partir|morrer|aceitar|realizar|supor|compreender|conseguir|explicar|perguntar|tocar|reconhecer|estudar|alcançar|nascer|dirigir|correr|usar|pagar|ajudar|gostar|jogar|escutar|cumprir|oferecer|descobrir|levantar|tentar|decidir|repetir|construir|dormir|mover|continuar|aumentar|aprender|acontecer|desejar|aproximar|fugir|funcionar|quebrar|escolher|importar|valer|cortar|pegar|subir|descer|acender|apagar|limpar|cozinhar|varrer|lavar|plantar|regar|colher|plantar|crescer|morrer|nascer|envelhecer|cansar|descansar|dormir|acordar|sonhar|lembrar|esquecer|perdoar|desculpar|agradecer|parabenizar|cumprimentar|despedir|convidar|recusar|aceitar|negar|afirmar|mentir|verdade|mentira|enganar|confiar|duvidar|acreditar|esperar|iludir|apaixonar|odiar|amar|querer|desejar|precisar|faltar|sobrar|bastar|alcançar|chegar|partir|voltar|ficar|estabelecer|instalar|sentar|levantar|deitar|banhar|lavar|secar|pentear|maquiar|vestir|despir|provar|comprar|vender|alugar|emprestar|devolver|dar|receber|enviar|mandar|entregar|pegar|guardar|tirar|pôr|retirar|adicionar|eliminar|apagar|escrever|ler|estudar|aprender|ensinar|explicar|entender|compreender|saber|conhecer|ignorar|descobrir|inventar|criar|construir|destruir|quebrar|consertar|reparar|funcionar|estragar|acender|apagar|abrir|fechar|entrar|sair|subir|descer|ir|vir|chegar|partir|ficar|estar|ser|ter|haver|fazer|dizer|ver|ouvir|tocar|cheirar|provar|sentir|pensar|lembrar|esquecer|sonhar|imaginar|acreditar|supor|opinar|considerar|julgar|criticar|elogiar|parabenizar|agradecer|desculpar|perdoar|pedir|rogar|suplicar|exigir|ordenar|mandar|proibir|permitir|autorizar|negar|recusar|aceitar|aprovar|desaprovar|gostar|adorar|fascinar|odiar|detestar|incomodar|preocupar|tranquilizar|acalmar|relaxar|estressar|divertir|aborrecer|entreter|interessar|desinteressar|surpreender|impressionar|decepcionar|satisfazer|agradar|desagradar|irritar|alegrar|entristecer|emocionar|comover|tocar|mover)\b/
    ]
    
    if (portuguesePatterns.some(pattern => pattern.test(cleanText))) {
      return 'pt'
    }
    
    // 默认英语
    return 'en'
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

  // 添加新方法：生成音频数据但不播放
  async generateAudioBlob(text: string): Promise<Blob> {
    console.log(`[TTS服务] 生成音频数据: ${text.length}字符`)
    
    const openaiProvider = await this.configPresenter.getProviderById('openai')
    
    if (!openaiProvider || !openaiProvider.apiKey) {
      throw new Error('OpenAI配置未找到或API密钥缺失')
    }
    
    const language = this.detectLanguage(text)
    const voice = this.selectVoiceForLanguage(language)
    const speed = this.selectSpeedForLanguage(language)
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiProvider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          speed: speed
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
      console.log(`[TTS服务] 音频生成完成: ${audioBlob.size}字节, 语言: ${language}, 语音: ${voice}, 语速: ${speed} (智能优化)`)
      
      return audioBlob
    } catch (error) {
      console.error(`[TTS服务] 音频生成失败 (语言: ${language}, 语音: ${voice}):`, error)
      throw error
    }
  }
}

// 创建单例实例
export const ttsService = new TTSService() 