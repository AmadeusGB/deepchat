import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// Import crypto for RSA encryption
import { publicEncrypt } from 'node:crypto'
import { exec } from 'node:child_process'
import axios from 'axios'

// Interfaces for Access Control and Tunnels
interface AccessControlDevice {
  mac: string
  createdAt: number
  name: string
  routeMode: string
  regionCode: string | null
  httpsFilter: boolean
  remark: string
  pinned: boolean
  bypass: string[]
  bwLimit: number
  ip: string
}

interface TunnelInfo {
  tunnelCode: string
  activeIp: string | null
  activeNum: number
}

interface AccessControlListResponse {
  success: boolean
  data?: {
    online: AccessControlDevice[]
    offline: AccessControlDevice[]
  }
  error?: string
}

// Default public key for encryption
const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxZ9YwQ1CVM4zNHVNPxoD
Sz6uFGEcyHUOFkoA2hnijjJccCNRGnYlQmnCmaKPtCPiJ26ibXcL9BpfputJpE7Q
cJcJx8CN0Pr/MceYQraFS3UG+zNdI6tGzLDGrBoB+5WFSbK6aOdHFJfcoBfdULHb
g2eGp2IJwSPal3lFNwE/oTL3K1z7EiwbDq0LrY7FcwMGmG3EFaGtMxRy/cq3r0xR
M1V7WIu1I6gw463luLs6NFCdrY/fiXoSrXRf6sOTZClXeRhKjA6c0wLIxizgw6ll
4EeffYVBQSKlEjJJR2y7cxxbp1XkC19evxe0DYbnsemogDcSkmDCj75hsgwuzoTM
FwIDAQAB
-----END PUBLIC KEY-----`

// State management
let cookie: string | null = null
let BaseUrl = '34.34.34.34'
let deviceList: AccessControlDevice[] = [] // 新增：设备列表状态

// Global mapping of DPN modes to their corresponding tunnel codes
const DPN_MODE_TUNNEL_CODE: Record<string, string> = {
  direct: 'DIRECT'
}

// 自动登录配置
const AUTO_LOGIN_CONFIG = {
  username: 'admin',
  password: 'admin'
}

// Helper functions
const getCookie = () => cookie
const setCookie = (newCookie: string) => {
  cookie = newCookie
}

const getDpnTunnelCode = (mode: string) => DPN_MODE_TUNNEL_CODE[mode]
const setDpnTunnelCode = (mode: string, code: string) => {
  DPN_MODE_TUNNEL_CODE[mode] = code
}

const setBaseUrl = (url: string) => {
  BaseUrl = url
}

// 新增：设备列表管理函数
const getDeviceList = () => deviceList
const setDeviceList = (devices: AccessControlDevice[]) => {
  deviceList = devices
}

// 自动登录函数
async function tryAutoLogin(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('尝试使用默认账户自动登录到Deeper设备...')
    const result = await loginToDeeperDevice(AUTO_LOGIN_CONFIG.username, AUTO_LOGIN_CONFIG.password)
    if (result.success && result.data) {
      setCookie(result.data)
      console.log('自动登录成功')
      return { success: true }
    } else {
      console.log('自动登录失败:', result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log('自动登录异常:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// 获取有效的认证cookie，如果没有则尝试自动登录
async function getValidCookie(): Promise<{ cookie: string | null; error?: string }> {
  let currentCookie = getCookie()

  if (!currentCookie) {
    // 没有cookie，尝试自动登录
    const autoLoginResult = await tryAutoLogin()
    if (autoLoginResult.success) {
      currentCookie = getCookie()
    } else {
      return {
        cookie: null,
        error: `自动登录失败：${autoLoginResult.error}。请手动调用 loginToDeeperDevice 工具，使用正确的账户名和密码。`
      }
    }
  }

  return { cookie: currentCookie }
}

// Core functions
const encryptWithPublicKey = (string: string) => {
  if (string) {
    const encrypted = publicEncrypt(publicKey, Buffer.from(string))
    return encrypted.toString('base64')
  }
  return ''
}

const getDefaultHeaders = (cookie?: string) => {
  return {
    Host: BaseUrl,
    Connection: 'keep-alive',
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
    Cookie: cookie || ''
  }
}

async function loginToDeeperDevice(
  username: string,
  password: string
): Promise<{
  success: boolean
  data?: string
  error?: string
}> {
  password = encryptWithPublicKey(password)
  const url = `http://${BaseUrl}/api/admin/login`
  const headers = getDefaultHeaders()

  const data = {
    username: username,
    password: password
  }

  try {
    const response = await axios.post(url, data, { headers })
    const cookies = response.headers['set-cookie']
    if (cookies && cookies.length > 0) {
      const cookie = cookies[0].split(';')[0]
      return {
        success: true,
        data: cookie
      }
    }
    return {
      success: false,
      error: 'No authentication cookie received'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setDpnMode(cookie: string, mode: string, tunnelCode: string): Promise<boolean> {
  const url = `http://${BaseUrl}/api/smartRoute/setDpnMode`
  const headers = getDefaultHeaders(cookie)

  let dpnMode = ''
  if (mode.includes('direct')) {
    dpnMode = 'disabled'
  } else if (mode.includes('smart')) {
    dpnMode = 'smart'
  } else if (mode.includes('full')) {
    dpnMode = 'full'
  }

  const data = {
    dpnMode: dpnMode,
    tunnelCode: tunnelCode
  }

  try {
    const response = await axios.post(url, data, { headers })
    return response.data && response.data.success === true
  } catch (error) {
    console.error('Error:', error)
  }
  return false
}

async function listTunnels(cookie: string): Promise<{
  success: boolean
  data?: TunnelInfo[]
  error?: string
}> {
  const url = `http://${BaseUrl}/api/smartRoute/listTunnels`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      success: false
    }
  }
}

async function getDpnMode(cookie: string): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  const url = `http://${BaseUrl}/api/smartRoute/getDpnMode`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function listApps(cookie: string): Promise<{
  success: boolean
  data?: string[]
  error?: string
}> {
  const url = `http://${BaseUrl}/api/appRelocator/apps`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    const data = response.data
    if (Array.isArray(data)) {
      const categoryObj = data.find(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'category' in item &&
          item.category === 'allCategories'
      )
      if (
        categoryObj &&
        'appsBySubcategory' in categoryObj &&
        Array.isArray(categoryObj.appsBySubcategory)
      ) {
        const subcatObj = categoryObj.appsBySubcategory.find(
          (sub) =>
            typeof sub === 'object' &&
            sub !== null &&
            'subcategory' in sub &&
            sub.subcategory === 'allCountries'
        )
        if (subcatObj && 'apps' in subcatObj && Array.isArray(subcatObj.apps)) {
          const appNames = subcatObj.apps
            .map((app) =>
              typeof app === 'object' && app !== null && 'app' in app ? String(app.app) : ''
            )
            .filter(Boolean)
          return {
            success: true,
            data: appNames
          }
        }
      }
    }
    return {
      success: false,
      error: 'Invalid data structure for fetching apps'
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function addApp(
  cookie: string,
  appName: string,
  tunnelCode: string
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/appRelocator/addApp`
  const headers = getDefaultHeaders(cookie)

  const data = {
    appName,
    tunnelCode
  }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function addTunnel(
  cookie: string,
  regionCode: string,
  countryCode: string
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/smartRoute/addTunnel`
  const headers = getDefaultHeaders(cookie)

  const data = {
    regionCode,
    countryCode
  }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function rebootDevice(cookie: string): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/admin/reboot`
  const headers = getDefaultHeaders(cookie)

  try {
    await axios.post(url, undefined, { headers, timeout: 1000 })
    return { success: true }
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (
      err.code === 'ECONNABORTED' ||
      err.code === 'ECONNRESET' ||
      err.message?.includes('aborted') ||
      err.message?.includes('socket hang up') ||
      err.message?.includes('timeout')
    ) {
      return { success: true }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setCategoryStates(
  cookie: string,
  states: { [key: string]: number },
  pornStateChanged: boolean,
  socialStateChanged: boolean,
  gameStateChanged: boolean
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/security/setCategoryStates`
  const headers = getDefaultHeaders(cookie)

  const data = {
    states,
    pornStateChanged,
    socialStateChanged,
    gameStateChanged
  }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getUrlFilterData(cookie: string): Promise<{
  success: boolean
  data?: { [key: string]: number }
  error?: string
}> {
  const url = `http://${BaseUrl}/api/security/getUrlFilterData`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    const categoryStates = response.data?.categoryStates
    if (categoryStates && typeof categoryStates === 'object') {
      return {
        success: true,
        data: categoryStates as { [key: string]: number }
      }
    } else {
      return {
        success: false,
        error: 'No categoryStates data found'
      }
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setAdsFilter(
  cookie: string,
  enable: boolean
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/tproxy/adsFilter`
  const headers = getDefaultHeaders(cookie)

  const data = {
    type: 'httpsFilter',
    enable
  }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setSslBypass(
  cookie: string,
  enable: boolean
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/tproxy/sslBypass`
  const headers = getDefaultHeaders(cookie)

  const data = {
    enable
  }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getAdsFilter(cookie: string): Promise<{
  success: boolean
  enable?: boolean
  error?: string
}> {
  const url = `http://${BaseUrl}/api/tproxy/adsFilter`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: response.data && response.data.success === true,
      enable: response.data?.enable
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Access Control Functions
async function listAccessControl(cookie: string): Promise<AccessControlListResponse> {
  const url = `http://${BaseUrl}/api/accessControl/list`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data as { online: AccessControlDevice[]; offline: AccessControlDevice[] }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setOneAccessControl(
  cookie: string,
  updates: AccessControlDevice
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/accessControl/setOne`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.post(url, updates, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function switchAccessControl(
  cookie: string,
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/accessControl/switch`
  const headers = getDefaultHeaders(cookie)
  const data = { value }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getAccessControlSwitch(
  cookie: string
): Promise<{ success: boolean; value?: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/accessControl/switch`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: typeof response.data?.value === 'boolean',
      value: response.data?.value
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function ensureAccessControlSwitch(
  cookie: string
): Promise<{ success: boolean; error?: string }> {
  const switchStatus = await getAccessControlSwitch(cookie)
  if (!switchStatus.success) {
    return { success: false, error: 'Failed to get access control switch status' }
  }
  if (!switchStatus.value) {
    const enableResult = await switchAccessControl(cookie, true)
    if (!enableResult.success) {
      return { success: false, error: 'Failed to enable access control' }
    }
  }
  return { success: true }
}

// Sharing Functions (getSharingConfig removed - not used)

async function setSharingConfig(
  cookie: string,
  key: string,
  value: boolean | number | string
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/sharing/setSharingConfig`
  const headers = getDefaultHeaders(cookie)
  const data = { [key]: value }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setSharingState(
  cookie: string,
  sharingEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return setSharingConfig(cookie, 'sharingEnabled', sharingEnabled)
}

async function setBtSharing(
  cookie: string,
  btEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return setSharingConfig(cookie, 'btEnabled', btEnabled)
}

async function setSmtpSharing(
  cookie: string,
  smtpEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return setSharingConfig(cookie, 'smtpEnabled', smtpEnabled)
}

async function setSharingTrafficLimit(
  cookie: string,
  number: number
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/sharing/setTrafficLimit`
  const headers = getDefaultHeaders(cookie)
  const data = { number, unit: 'GB' }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function setSharingBandwidthLimit(
  cookie: string,
  number: number
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/sharing/setBandwidthLimit`
  const headers = getDefaultHeaders(cookie)
  const data = { number: number * 1024 } // Convert Mbps to Kbps

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// System Info Functions
async function getSessionInfo(cookie: string): Promise<{
  success: boolean
  data?: {
    maxSessionNum: string
    currSessionNum: string
    tcpSessionNum: string
    udpSessionNum: string
    icmpSessionNum: string
    tunnelSessionNum: string
  }
  error?: string
}> {
  const url = `http://${BaseUrl}/api/system-info/session-info`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getHardwareInfo(cookie: string): Promise<{
  success: boolean
  data?: {
    SN: string
    deviceId: string
    cpuCount: number
    cpuModel: string
    totalMem: number
    tempInCelsius: number
  }
  error?: string
}> {
  const url = `http://${BaseUrl}/api/system-info/hardware-info`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getSoftwareInfo(cookie: string): Promise<{
  success: boolean
  data?: {
    softwareVersion: string
    appSigVersion: string
    builtinRuleVersion: string
    urlSigVersion: string
  }
  error?: string
}> {
  const url = `http://${BaseUrl}/api/system-info/software-info`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function getNetworkAddress(cookie: string): Promise<{
  success: boolean
  data?: {
    ip: string
    pubIp: string
    routerMac: string
    gatewayMac: string
  }
  error?: string
}> {
  const url = `http://${BaseUrl}/api/system-info/network-address`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    return {
      success: true,
      data: response.data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// DPN Enhanced Functions
async function deleteTunnels(
  cookie: string,
  tunnelCodes: string[]
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/smartRoute/deleteTunnels`
  const headers = getDefaultHeaders(cookie)
  const data = { tunnelCodes }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function refreshTunnel(
  cookie: string,
  tunnelCode: string
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/smartRoute/refreshTunnel`
  const headers = getDefaultHeaders(cookie)
  const data = { tunnelCode }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function switchNode(
  cookie: string,
  tunnelCode: string,
  targetIp: string
): Promise<{ success: boolean; error?: string }> {
  const url = `http://${BaseUrl}/api/smartRoute/switchNode`
  const headers = getDefaultHeaders(cookie)
  const data = { tunnelCode, targetIp }

  try {
    const response = await axios.post(url, data, { headers })
    return {
      success: response.data && response.data.success === true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export class DeeperDeviceServer {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'deepchat-inmemory/deeper-device-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupTools()
  }

  private setupTools() {
    // Define all tool schemas
    const loginSchema = z.object({
      username: z.string().default('admin').describe('The username for authentication.'),
      password: z.string().default('admin').describe('The password for authentication.')
    })

    const setBaseUrlSchema = z.object({
      baseUrl: z
        .string()
        .default('34.34.34.34')
        .describe('The base URL to use for the Deeper device API.')
    })

    const setDpnModeSchema = z.object({
      dpnMode: z
        .string()
        .default('smart')
        .describe(
          "The DPN mode to set: 'direct' for Direct routing, 'smart' for Smart routing, or 'full' for Full routing."
        ),
      tunnelCode: z.string().nullable().describe('tunnel code')
    })

    const addTunnelSchema = z.object({
      regionCode: z
        .string()
        .describe("Region code(e.g., 'AMN' for North America, 'ASE' for East Asia)"),
      tunnelCode: z.string().describe('Tunnel code to add.')
    })

    const setAppTunnelCodeSchema = z.object({
      appName: z.string().describe('The name of the app to set.'),
      tunnelCode: z
        .string()
        .describe(
          'The tunnel code to use for the app, if using Direct Access, the tunnel code is LL.'
        )
    })

    const setParentalControlSchema = z.object({
      porn: z
        .number()
        .nullable()
        .describe(
          'Porn category state: 0 (not block), 1 (block), 2 (unblock 2 hours), 4 (unblock 4 hours), 8 (unblock 8 hours)'
        ),
      social: z
        .number()
        .nullable()
        .describe(
          'Social category state: 0 (not block), 1 (block), 2 (unblock 2 hours), 4 (unblock 4 hours), 8 (unblock 8 hours)'
        ),
      game: z
        .number()
        .nullable()
        .describe(
          'Game category state: 0 (not block), 1 (block), 2 (unblock 2 hours), 4 (unblock 4 hours), 8 (unblock 8 hours)'
        )
    })

    const setAdsFilterSchema = z.object({
      enabled: z.boolean().describe('Set to true to enable ad filtering, false to disable.')
    })

    const setSslBypassSchema = z.object({
      enabled: z
        .boolean()
        .describe('Set to true to allow devices without certificates, false to disallow.')
    })

    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'loginToDeeperDevice',
            description:
              '🔐 登录Deeper设备管理界面 - 使用admin/admin默认凭证或自定义用户名密码获取访问权限，为所有设备操作建立认证会话',
            inputSchema: zodToJsonSchema(loginSchema)
          },
          {
            name: 'setBaseUrl',
            description:
              '🌐 配置设备连接地址 - 设置Deeper设备的IP地址(默认34.34.34.34)，支持局域网地址如192.168.1.1，确保MCP工具能正确连接到您的设备',
            inputSchema: zodToJsonSchema(setBaseUrlSchema)
          },
          {
            name: 'setDpnMode',
            description:
              '🚀 配置DPN路由模式 - 选择Smart Routing(智能路由)、Full Routing(完全路由)或Direct Routing(直接路由)，并设置备份隧道确保网络连接稳定性',
            inputSchema: zodToJsonSchema(setDpnModeSchema)
          },
          {
            name: 'getDpnMode',
            description:
              '📊 查看DPN路由状态 - 显示当前DPN工作模式(Smart/Full/Direct)、使用的隧道信息、节点数量和连接状态，帮助诊断网络配置',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'listTunnels',
            description:
              '🌍 查看隧道列表 - 显示所有已配置的DPN隧道，包括地区、国家、活跃IP数量和连接状态，用于管理和监控隧道连接',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'addTunnel',
            description:
              '➕ 添加DPN隧道 - 选择指定地区和国家创建新的DPN隧道连接，提供更多网络出口选择，增强网络访问的灵活性和速度',
            inputSchema: zodToJsonSchema(addTunnelSchema)
          },
          {
            name: 'listApps',
            description:
              '📱 查看应用重定向列表 - 显示所有支持的应用(Netflix、YouTube、Instagram等)及其当前隧道配置，可按类型、国家、标签筛选应用',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'setAppTunnelCode',
            description:
              '🎯 配置应用专用隧道 - 为特定应用(如Netflix、YouTube)设置专用的地区隧道，实现地理位置重定向，解锁不同地区的内容和服务',
            inputSchema: zodToJsonSchema(setAppTunnelCodeSchema)
          },
          {
            name: 'setParentalControl',
            description:
              '👨‍👩‍👧‍👦 配置家长控制 - 设置色情内容、社交媒体、游戏的访问控制，支持永久阻止或临时解除(2/4/8小时)，保护儿童免受不当内容影响',
            inputSchema: zodToJsonSchema(setParentalControlSchema)
          },
          {
            name: 'setAdsFilter',
            description:
              '🛡️ 配置DNS内容过滤 - 启用/禁用广告拦截、追踪器拦截、恶意软件拦截，在DNS层面保护所有设备免受广告和恶意内容侵扰',
            inputSchema: zodToJsonSchema(setAdsFilterSchema)
          },
          {
            name: 'setSslBypass',
            description:
              '🔒 配置HTTPS过滤策略 - 启用HTTPS广告过滤或SSL绕过模式。注意：启用SSL绕过可能会降低广告过滤效果，需要安装证书才能正常工作',
            inputSchema: zodToJsonSchema(setSslBypassSchema)
          },
          {
            name: 'rebootDevice',
            description:
              '🔄 重启设备 - 重启Deeper设备以应用配置更改或解决系统问题，重启后需要重新连接和认证',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          // New Access Control Tools
          {
            name: 'listAccessControl',
            description:
              '📋 查看设备访问控制列表 - 显示所有在线和离线设备的访问控制配置，包括路由模式、HTTPS过滤、带宽限制等详细信息',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'setAccessControl',
            description:
              '🎯 配置设备访问控制 - 初始化设备访问控制配置流程，获取设备列表并准备进行单独设备的配置',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'updateOneAccessControlDevice',
            description:
              '⚙️ 更新单个设备配置 - 配置指定设备的路由模式、HTTPS过滤、域名绕过、带宽限制等参数，实现精细化的设备管理',
            inputSchema: zodToJsonSchema(
              z.object({
                index: z.number().describe('设备在列表中的索引位置（从0开始）'),
                routeMode: z
                  .string()
                  .describe('路由模式：direct（直连）、smart（智能）、full（完全）'),
                httpsFilter: z.boolean().describe('是否启用HTTPS过滤'),
                bypass: z.array(z.string()).optional().describe('绕过的域名列表'),
                remark: z.string().optional().describe('设备备注'),
                pinned: z.boolean().optional().describe('是否置顶设备'),
                bwLimit: z.number().optional().describe('带宽限制（Kbps）')
              })
            )
          },
          // New Sharing Tools
          {
            name: 'enableSharingState',
            description:
              '🌐 配置网络共享状态 - 启用或禁用Deeper设备的网络共享功能，控制是否允许其他用户使用您的网络连接',
            inputSchema: zodToJsonSchema(
              z.object({
                enabled: z.boolean().describe('true启用共享，false禁用共享')
              })
            )
          },
          {
            name: 'setBtSharing',
            description:
              '🔄 配置BitTorrent共享 - 启用或禁用BitTorrent协议的网络共享，控制P2P流量的共享策略',
            inputSchema: zodToJsonSchema(
              z.object({
                enabled: z.boolean().describe('true启用BT共享，false禁用BT共享')
              })
            )
          },
          {
            name: 'setSmtpSharing',
            description:
              '📧 配置SMTP共享 - 启用或禁用SMTP邮件协议的网络共享，控制邮件流量的共享策略',
            inputSchema: zodToJsonSchema(
              z.object({
                enabled: z.boolean().describe('true启用SMTP共享，false禁用SMTP共享')
              })
            )
          },
          {
            name: 'setSharingTrafficLimit',
            description: '📊 设置共享流量限制 - 配置每月网络共享的流量上限，防止流量超支，单位为GB',
            inputSchema: zodToJsonSchema(
              z.object({
                number: z.number().describe('每月流量限制（GB）')
              })
            )
          },
          {
            name: 'setSharingBandwidthLimit',
            description:
              '🚀 设置共享带宽限制 - 配置网络共享的最大带宽，确保本地网络性能，单位为Mbps',
            inputSchema: zodToJsonSchema(
              z.object({
                number: z.number().describe('带宽限制（Mbps）')
              })
            )
          },
          // New DPN Enhanced Tools
          {
            name: 'deleteTunnels',
            description: '🗑️ 删除DPN隧道 - 批量删除不需要的DPN隧道连接，清理隧道列表，优化网络资源',
            inputSchema: zodToJsonSchema(
              z.object({
                tunnelCodes: z.array(z.string()).describe('要删除的隧道代码数组')
              })
            )
          },
          {
            name: 'testTunnelsConnectivity',
            description:
              '🔍 测试隧道连接性 - 自动检测隧道的活跃IP并测试连接性，发现问题时自动切换节点或刷新隧道，确保网络畅通',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          // New System Info Tool
          {
            name: 'getDeeperSystemInfo',
            description:
              '📊 获取系统综合信息 - 一次性获取设备的软件版本、硬件信息、网络地址、会话统计等全面的系统状态信息',
            inputSchema: zodToJsonSchema(z.object({}))
          }
        ]
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'loginToDeeperDevice': {
            const { username, password } = loginSchema.parse(args)
            const result = await loginToDeeperDevice(username, password)
            if (result.success && result.data) {
              setCookie(result.data)
              return { content: [{ type: 'text', text: 'loginToDeeperDevice success' }] }
            } else {
              return {
                content: [{ type: 'text', text: `loginToDeeperDevice failed: ${result.error}` }]
              }
            }
          }

          case 'setBaseUrl': {
            const { baseUrl } = setBaseUrlSchema.parse(args)
            setBaseUrl(baseUrl)
            return {
              content: [
                {
                  type: 'text',
                  text: `Base URL set to ${baseUrl}. You can now use other tools with this base URL.`
                }
              ]
            }
          }

          case 'setDpnMode': {
            const { dpnMode, tunnelCode } = setDpnModeSchema.parse(args)
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            let finalTunnelCode = tunnelCode
            if (!finalTunnelCode) {
              if (getDpnTunnelCode(dpnMode)) {
                finalTunnelCode = getDpnTunnelCode(dpnMode)
              } else {
                return {
                  content: [
                    {
                      type: 'text',
                      text: 'tunnelCode is required for setting dpnMode, please use listTunnels tool to pick one available tunnel codes.'
                    }
                  ]
                }
              }
            }

            const success = await setDpnMode(cookie, dpnMode, finalTunnelCode)
            if (success) {
              return {
                content: [
                  { type: 'text', text: `set Deeper device DPN mode to ${dpnMode} success` }
                ]
              }
            } else {
              return {
                content: [{ type: 'text', text: `set Deeper device DPN mode to ${dpnMode} failed` }]
              }
            }
          }

          case 'getDpnMode': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await getDpnMode(cookie)
            if (result.success) {
              if (typeof result.data === 'object' && result.data !== null) {
                const data = result.data as Record<string, unknown>
                const { dpnMode, smartTunnel, fullTunnel } = data
                if (typeof smartTunnel === 'string') {
                  setDpnTunnelCode('smart', smartTunnel)
                }
                if (typeof fullTunnel === 'string') {
                  setDpnTunnelCode('full', fullTunnel)
                }
                if (typeof data.tunnelCode === 'string') {
                  setDpnTunnelCode('curMode', String(dpnMode))
                }
              }
              return {
                content: [
                  { type: 'text', text: `Current DPN mode: ${JSON.stringify(result.data)}` }
                ]
              }
            } else {
              return { content: [{ type: 'text', text: `getDpnMode failed: ${result.error}` }] }
            }
          }

          case 'listTunnels': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await listTunnels(cookie)
            if (result.success && Array.isArray(result.data)) {
              const tunnelCodes = result.data.map((t) => t.tunnelCode)
              return { content: [{ type: 'text', text: tunnelCodes.join(', ') }] }
            } else {
              return { content: [{ type: 'text', text: `listTunnels failed: ${result.error}` }] }
            }
          }

          case 'addTunnel': {
            const { regionCode, tunnelCode } = addTunnelSchema.parse(args)
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await addTunnel(cookie, regionCode, tunnelCode)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tunnel "${tunnelCode}" in region "${regionCode}" added successfully.`
                  }
                ]
              }
            } else {
              return { content: [{ type: 'text', text: `addTunnel failed: ${result.error}` }] }
            }
          }

          case 'listApps': {
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await listApps(cookie)
            if (result.success && Array.isArray(result.data)) {
              return {
                content: [{ type: 'text', text: `Supported apps: ${result.data.join(', ')}` }]
              }
            } else {
              return { content: [{ type: 'text', text: `listApps failed: ${result.error}` }] }
            }
          }

          case 'setAppTunnelCode': {
            const { appName, tunnelCode } = setAppTunnelCodeSchema.parse(args)
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await addApp(cookie, appName, tunnelCode)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `App "${appName}" added successfully with tunnel code "${tunnelCode}".`
                  }
                ]
              }
            } else {
              return { content: [{ type: 'text', text: `addApp failed: ${result.error}` }] }
            }
          }

          case 'setParentalControl': {
            const { porn, social, game } = setParentalControlSchema.parse(args)
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const filterDataResult = await getUrlFilterData(cookie)
            if (!filterDataResult.success || !filterDataResult.data) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to get current parental control states: ${filterDataResult.error}`
                  }
                ]
              }
            }

            const current = filterDataResult.data
            const pornStateChanged = porn !== null
            const socialStateChanged = social !== null
            const gameStateChanged = game !== null

            if (pornStateChanged) {
              current.porn = porn
            }
            if (socialStateChanged) {
              current.social = social
            }
            if (gameStateChanged) {
              current.game = game
            }

            const setResult = await setCategoryStates(
              cookie,
              current,
              pornStateChanged,
              socialStateChanged,
              gameStateChanged
            )
            if (setResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Parental control updated. Changed: ${
                      [
                        pornStateChanged ? 'porn' : null,
                        socialStateChanged ? 'social' : null,
                        gameStateChanged ? 'game' : null
                      ]
                        .filter(Boolean)
                        .join(', ') || 'none'
                    }.`
                  }
                ]
              }
            } else {
              return {
                content: [{ type: 'text', text: 'Failed to update parental control states.' }]
              }
            }
          }

          case 'setAdsFilter': {
            const { enabled } = setAdsFilterSchema.parse(args)
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await setAdsFilter(cookie, enabled)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Ad filter has been ${enabled ? 'enabled' : 'disabled'} successfully.`
                  }
                ]
              }
            } else {
              return { content: [{ type: 'text', text: `setAdsFilter failed: ${result.error}` }] }
            }
          }

          case 'setSslBypass': {
            const { enabled } = setSslBypassSchema.parse(args)
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            if (enabled) {
              const adsFilterStatus = await getAdsFilter(cookie)
              if (!adsFilterStatus.success) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Failed to get ad filter status: ${adsFilterStatus.error}`
                    }
                  ]
                }
              }
              if (!adsFilterStatus.enable) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: 'Ad filter must be enabled before allowing SSL bypass. Please enable ad filter first.'
                    }
                  ]
                }
              }
            }

            const result = await setSslBypass(cookie, enabled)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `SSL bypass has been ${enabled ? 'enabled' : 'disabled'} successfully.`
                  }
                ]
              }
            } else {
              return { content: [{ type: 'text', text: `setSslBypass failed: ${result.error}` }] }
            }
          }

          case 'rebootDevice': {
            const { cookie } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await rebootDevice(cookie)
            if (result.success) {
              return { content: [{ type: 'text', text: 'Device reboot initiated successfully.' }] }
            } else {
              return { content: [{ type: 'text', text: `rebootDevice failed: ${result.error}` }] }
            }
          }

          case 'listAccessControl': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await listAccessControl(cookie)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result.data, null, 2)
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to list access control devices: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'setAccessControl': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await listAccessControl(cookie)
            if (result.success && result.data) {
              const allDevices = [...result.data.online, ...result.data.offline]
              setDeviceList(allDevices)

              const formattedList = allDevices
                .map((device, index) => `${index + 1}. ${device.name} (${device.mac})`)
                .join('\n')

              return {
                content: [
                  {
                    type: 'text',
                    text: `Here are the devices:\n${formattedList}\nPlease use 'updateOneAccessControlDevice' with the device index and the settings you want to change.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to list access control devices: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'updateOneAccessControlDevice': {
            const { index, routeMode, httpsFilter, bypass, remark, pinned, bwLimit } = z
              .object({
                index: z.number().describe('设备在列表中的索引位置（从0开始）'),
                routeMode: z
                  .string()
                  .optional()
                  .describe('路由模式：direct（直连）、smart（智能）、full（完全）'),
                httpsFilter: z.boolean().optional().describe('是否启用HTTPS过滤'),
                bypass: z.array(z.string()).optional().describe('绕过的域名列表'),
                remark: z.string().optional().describe('设备备注'),
                pinned: z.boolean().optional().describe('是否置顶设备'),
                bwLimit: z.number().optional().describe('带宽限制（Kbps）')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            // Ensure access control switch is enabled
            const ensureResult = await ensureAccessControlSwitch(cookie)
            if (!ensureResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to enable access control switch: ${ensureResult.error}`
                  }
                ]
              }
            }

            const deviceList = getDeviceList()
            if (!deviceList || deviceList.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Device list not found. Please run 'setAccessControl' first to select a device.`
                  }
                ]
              }
            }

            const deviceIndex = index - 1
            if (deviceIndex < 0 || deviceIndex >= deviceList.length) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Invalid index ${index}. Please provide an index between 1 and ${deviceList.length}.`
                  }
                ]
              }
            }

            const existingDevice = deviceList[deviceIndex]
            const deviceUpdates: Partial<AccessControlDevice> = {}
            if (routeMode !== undefined) deviceUpdates.routeMode = routeMode
            if (httpsFilter !== undefined) deviceUpdates.httpsFilter = httpsFilter
            if (bypass !== undefined) deviceUpdates.bypass = bypass
            if (remark !== undefined) deviceUpdates.remark = remark
            if (pinned !== undefined) deviceUpdates.pinned = pinned
            if (bwLimit !== undefined) deviceUpdates.bwLimit = bwLimit

            const updatedDevice: AccessControlDevice = {
              ...existingDevice,
              ...deviceUpdates
            }

            const setResult = await setOneAccessControl(cookie, updatedDevice)
            if (setResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Successfully updated device ${existingDevice.name} (${existingDevice.mac}).`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to update device ${existingDevice.name} (${existingDevice.mac}): ${setResult.error}`
                  }
                ]
              }
            }
          }

          case 'enableSharingState': {
            const { enabled } = z
              .object({
                enabled: z.boolean().describe('true启用共享，false禁用共享')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await setSharingState(cookie, enabled)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `sharing has been ${enabled ? 'enabled' : 'disabled'} successfully.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `sharing failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'setBtSharing': {
            const { enabled } = z
              .object({
                enabled: z.boolean().describe('true启用BT共享，false禁用BT共享')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            if (enabled) {
              const enableSharingResult = await setSharingState(cookie, true)
              if (!enableSharingResult.success) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Failed to enable sharing before setting BitTorrent sharing: ${enableSharingResult.error}`
                    }
                  ]
                }
              }
            }

            const result = await setBtSharing(cookie, enabled)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `BitTorrent sharing has been ${enabled ? 'enabled' : 'disabled'} successfully.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `BitTorrent sharing failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'setSmtpSharing': {
            const { enabled } = z
              .object({
                enabled: z.boolean().describe('true启用SMTP共享，false禁用SMTP共享')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            if (enabled) {
              const enableSharingResult = await setSharingState(cookie, true)
              if (!enableSharingResult.success) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Failed to enable sharing before setting SMTP sharing: ${enableSharingResult.error}`
                    }
                  ]
                }
              }
            }

            const result = await setSmtpSharing(cookie, enabled)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `SMTP sharing has been ${enabled ? 'enabled' : 'disabled'} successfully.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `SMTP sharing failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'setSharingTrafficLimit': {
            const { number } = z
              .object({
                number: z.number().describe('每月流量限制（GB）')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            // Enable sharing first
            const enableSharingResult = await setSharingState(cookie, true)
            if (!enableSharingResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to enable sharing before setting traffic limit: ${enableSharingResult.error}`
                  }
                ]
              }
            }

            const result = await setSharingTrafficLimit(cookie, number)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Sharing traffic limit has been set to ${number} GB successfully.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Setting sharing traffic limit failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'setSharingBandwidthLimit': {
            const { number } = z
              .object({
                number: z.number().describe('带宽限制（Mbps）')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            // Enable sharing first
            const enableSharingResult = await setSharingState(cookie, true)
            if (!enableSharingResult.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to enable sharing before setting bandwidth limit: ${enableSharingResult.error}`
                  }
                ]
              }
            }

            const result = await setSharingBandwidthLimit(cookie, number)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Sharing bandwidth limit has been set to ${number} Mbps successfully.`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Setting sharing bandwidth limit failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'deleteTunnels': {
            const { tunnelCodes } = z
              .object({
                tunnelCodes: z.array(z.string()).describe('要删除的隧道代码数组')
              })
              .parse(args)

            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            const result = await deleteTunnels(cookie, tunnelCodes)
            if (result.success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tunnels deleted successfully: ${tunnelCodes.join(', ')}`
                  }
                ]
              }
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `deleteTunnels failed: ${result.error}`
                  }
                ]
              }
            }
          }

          case 'testTunnelsConnectivity': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            try {
              const tunnelsResult = await listTunnels(cookie)
              if (!tunnelsResult.success || !Array.isArray(tunnelsResult.data)) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Failed to list tunnels: ${tunnelsResult.error}`
                    }
                  ]
                }
              }

              const tunnels = tunnelsResult.data
              const actions: string[] = []

              // Ping function implementation
              const pingIp = (ip: string): Promise<boolean> => {
                return new Promise((resolve) => {
                  const platform = process.platform
                  const cmd = platform === 'win32' ? `ping -n 1 ${ip}` : `ping -c 1 ${ip}`
                  exec(cmd, (error) => {
                    resolve(!error)
                  })
                })
              }

              for (const tunnel of tunnels) {
                const tunnelData = tunnel as TunnelInfo
                const { tunnelCode, activeIp, activeNum } = tunnelData
                if (!activeIp) {
                  actions.push(`Tunnel ${tunnelCode} has no active IP.`)
                  continue
                }

                const success = await pingIp(activeIp)
                if (success) {
                  actions.push(`Tunnel ${tunnelCode} (${activeIp}) is reachable.`)
                } else {
                  if (activeNum > 1) {
                    const switchResult = await switchNode(cookie, tunnelCode, activeIp)
                    if (switchResult.success) {
                      actions.push(
                        `Tunnel ${tunnelCode} (${activeIp}) unreachable, switched node successfully.`
                      )
                    } else {
                      actions.push(
                        `Tunnel ${tunnelCode} (${activeIp}) unreachable, failed to switch node: ${switchResult.error}`
                      )
                    }
                  } else {
                    const refreshResult = await refreshTunnel(cookie, tunnelCode)
                    if (refreshResult.success) {
                      actions.push(
                        `Tunnel ${tunnelCode} (${activeIp}) unreachable, refreshed tunnel successfully.`
                      )
                    } else {
                      actions.push(
                        `Tunnel ${tunnelCode} (${activeIp}) unreachable, failed to refresh tunnel: ${refreshResult.error}`
                      )
                    }
                  }
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: actions.join('\n')
                  }
                ]
              }
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `testTunnelsConnectivity error: ${error instanceof Error ? error.message : 'Unknown error'}`
                  }
                ]
              }
            }
          }

          case 'getDeeperSystemInfo': {
            const { cookie, error } = await getValidCookie()
            if (!cookie) {
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      error || 'Please login to Deeper device first using loginToDeeperDevice tool.'
                  }
                ]
              }
            }

            try {
              const [softwareInfo, networkAddress, hardwareInfo, sessionInfo] = await Promise.all([
                getSoftwareInfo(cookie),
                getNetworkAddress(cookie),
                getHardwareInfo(cookie),
                getSessionInfo(cookie)
              ])

              if (
                !softwareInfo.success ||
                !networkAddress.success ||
                !hardwareInfo.success ||
                !sessionInfo.success
              ) {
                const errors = [
                  !softwareInfo.success ? `SoftwareInfo: ${softwareInfo.error}` : '',
                  !networkAddress.success ? `NetworkAddress: ${networkAddress.error}` : '',
                  !hardwareInfo.success ? `HardwareInfo: ${hardwareInfo.error}` : '',
                  !sessionInfo.success ? `SessionInfo: ${sessionInfo.error}` : ''
                ]
                  .filter(Boolean)
                  .join('; ')
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Failed to retrieve some system info: ${errors}`
                    }
                  ]
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Deeper System Info:\n` +
                      `Software Info: ${JSON.stringify(softwareInfo.data, null, 2)}\n` +
                      `Network Address: ${JSON.stringify(networkAddress.data, null, 2)}\n` +
                      `Hardware Info: ${JSON.stringify(hardwareInfo.data, null, 2)}\n` +
                      `Session Info: ${JSON.stringify(sessionInfo.data, null, 2)}`
                  }
                ]
              }
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `getDeeperSystemInfo error: ${error instanceof Error ? error.message : 'Unknown error'}`
                  }
                ]
              }
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true
        }
      }
    })
  }

  // 启动服务器
  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // 提供对server的访问方法，供外部调用
  public getServer(): Server {
    return this.server
  }
}
