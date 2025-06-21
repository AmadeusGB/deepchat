/**
 * TTS服务协调器
 * 解决多个TTS服务同时运行的冲突问题
 * 确保同一时间只有一个TTS服务在工作
 */

interface TTSServiceInstance {
  id: string
  name: string
  priority: number
  isActive: boolean
  stop: () => void
}

export class TTSCoordinator {
  private static instance: TTSCoordinator | null = null
  private services: Map<string, TTSServiceInstance> = new Map()
  private currentActiveService: string | null = null

  private constructor() {
    console.log('🎯 [TTS协调器] 初始化完成')
  }

  static getInstance(): TTSCoordinator {
    if (!TTSCoordinator.instance) {
      TTSCoordinator.instance = new TTSCoordinator()
    }
    return TTSCoordinator.instance
  }

  /**
   * 注册TTS服务
   */
  registerService(id: string, name: string, priority: number, stopFn: () => void): void {
    const service: TTSServiceInstance = {
      id,
      name,
      priority,
      isActive: false,
      stop: stopFn
    }

    this.services.set(id, service)
    console.log(`🎯 [TTS协调器] 注册服务: ${name} (优先级: ${priority})`)
  }

  /**
   * 请求激活TTS服务
   */
  requestActivation(serviceId: string): boolean {
    const service = this.services.get(serviceId)
    if (!service) {
      console.warn(`⚠️ [TTS协调器] 服务不存在: ${serviceId}`)
      return false
    }

    // 如果当前没有活跃服务，直接激活
    if (!this.currentActiveService) {
      this.activateService(serviceId)
      return true
    }

    // 如果当前服务就是请求的服务，直接返回成功
    if (this.currentActiveService === serviceId) {
      return true
    }

    // 比较优先级
    const currentService = this.services.get(this.currentActiveService)
    if (currentService && service.priority > currentService.priority) {
      // 新服务优先级更高，停止当前服务并激活新服务
      console.log(`🎯 [TTS协调器] 高优先级服务接管: ${service.name} > ${currentService.name}`)
      this.deactivateService(this.currentActiveService)
      this.activateService(serviceId)
      return true
    } else {
      // 当前服务优先级更高，拒绝新服务
      console.log(`⚠️ [TTS协调器] 服务被拒绝: ${service.name} (当前: ${currentService?.name})`)
      return false
    }
  }

  /**
   * 释放TTS服务
   */
  releaseService(serviceId: string): void {
    if (this.currentActiveService === serviceId) {
      this.deactivateService(serviceId)
    }
  }

  /**
   * 获取当前活跃服务
   */
  getCurrentActiveService(): string | null {
    return this.currentActiveService
  }

  /**
   * 获取所有服务状态
   */
  getServicesStatus(): Array<{id: string, name: string, priority: number, isActive: boolean}> {
    return Array.from(this.services.values()).map(service => ({
      id: service.id,
      name: service.name,
      priority: service.priority,
      isActive: service.isActive
    }))
  }

  private activateService(serviceId: string): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.isActive = true
      this.currentActiveService = serviceId
      console.log(`✅ [TTS协调器] 激活服务: ${service.name}`)
    }
  }

  private deactivateService(serviceId: string): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.isActive = false
      service.stop()
      this.currentActiveService = null
      console.log(`🛑 [TTS协调器] 停止服务: ${service.name}`)
    }
  }

  /**
   * 紧急停止所有服务
   */
  emergencyStopAll(): void {
    console.log('🚨 [TTS协调器] 紧急停止所有TTS服务')
    this.services.forEach(service => {
      if (service.isActive) {
        service.stop()
        service.isActive = false
      }
    })
    this.currentActiveService = null
  }
}

// 导出单例实例
export const ttsCoordinator = TTSCoordinator.getInstance() 