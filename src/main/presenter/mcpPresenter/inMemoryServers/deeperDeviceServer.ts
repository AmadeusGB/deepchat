import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// Import crypto for RSA encryption
import { publicEncrypt } from 'node:crypto'
import axios from 'axios'

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

// Global mapping of DPN modes to their corresponding tunnel codes
const DPN_MODE_TUNNEL_CODE: Record<string, string> = {
  direct: 'DIRECT'
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

async function loginToDeeperDevice(username: string, password: string): Promise<any> {
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

async function listTunnels(cookie: string): Promise<any> {
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

async function getDpnMode(cookie: string): Promise<any> {
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

async function listApps(cookie: string): Promise<any> {
  const url = `http://${BaseUrl}/api/appRelocator/apps`
  const headers = getDefaultHeaders(cookie)

  try {
    const response = await axios.get(url, { headers })
    const data = response.data
    if (Array.isArray(data)) {
      const categoryObj = data.find((item: any) => item.category === 'allCategories')
      if (categoryObj && Array.isArray(categoryObj.appsBySubcategory)) {
        const subcatObj = categoryObj.appsBySubcategory.find(
          (sub: any) => sub.subcategory === 'allCountries'
        )
        if (subcatObj && Array.isArray(subcatObj.apps)) {
          const appNames = subcatObj.apps.map((app: any) => app.app)
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
  } catch (error: any) {
    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('aborted') ||
      error.message?.includes('socket hang up') ||
      error.message?.includes('timeout')
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
      password: z.string().default('yubo12345').describe('The password for authentication.')
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
            description: 'Logs into the Deeper device to establish a session and obtain an auth cookie.',
            inputSchema: zodToJsonSchema(loginSchema)
          },
          {
            name: 'setBaseUrl',
            description: 'Configures the base URL for API calls to the Deeper device. Default: 34.34.34.34.',
            inputSchema: zodToJsonSchema(setBaseUrlSchema)
          },
          {
            name: 'setDpnMode',
            description: 'Sets the DPN mode and the associated tunnel for that mode.',
            inputSchema: zodToJsonSchema(setDpnModeSchema)
          },
          {
            name: 'getDpnMode',
            description: 'Retrieves the current DPN mode and the tunnels assigned to "smart" and "full" modes.',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'listTunnels',
            description: 'Lists the active tunnels available for DPN configuration.',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'addTunnel',
            description: 'Adds a new tunnel to the active list, making it available for DPN configuration.',
            inputSchema: zodToJsonSchema(addTunnelSchema)
          },
          {
            name: 'listApps',
            description: 'Lists all applications that can have their own dedicated DPN tunnel.',
            inputSchema: zodToJsonSchema(z.object({}))
          },
          {
            name: 'setAppTunnelCode',
            description: 'Assigns a specific tunnel to an application, overriding the main DPN mode for that app.',
            inputSchema: zodToJsonSchema(setAppTunnelCodeSchema)
          },
          {
            name: 'setParentalControl',
            description: 'Configures parental control states for porn, social, and game categories.',
            inputSchema: zodToJsonSchema(setParentalControlSchema)
          },
          {
            name: 'setAdsFilter',
            description: 'Enables or disables the ad filter on the Deeper device.',
            inputSchema: zodToJsonSchema(setAdsFilterSchema)
          },
          {
            name: 'setSslBypass',
            description: 'Allows or disallows devices without certificates to connect to the network.',
            inputSchema: zodToJsonSchema(setSslBypassSchema)
          },
          {
            name: 'rebootDevice',
            description: 'Reboots the Deeper device.',
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
            if (result.success) {
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
            const cookie = getCookie()
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
                content: [{ type: 'text', text: `set Deeper device DPN mode to ${dpnMode} success` }]
              }
            } else {
              return {
                content: [{ type: 'text', text: `set Deeper device DPN mode to ${dpnMode} failed` }]
              }
            }
          }

          case 'getDpnMode': {
            const cookie = getCookie()
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

            const result = await getDpnMode(cookie)
            if (result.success) {
              if (typeof result.data === 'object' && result.data !== null) {
                const { dpnMode, smartTunnel, fullTunnel } = result.data
                if (typeof smartTunnel === 'string') {
                  setDpnTunnelCode('smart', smartTunnel)
                }
                if (typeof fullTunnel === 'string') {
                  setDpnTunnelCode('full', fullTunnel)
                }
                if (typeof result.data.tunnelCode === 'string') {
                  setDpnTunnelCode('curMode', dpnMode)
                }
              }
              return {
                content: [{ type: 'text', text: `Current DPN mode: ${JSON.stringify(result.data)}` }]
              }
            } else {
              return { content: [{ type: 'text', text: `getDpnMode failed: ${result.error}` }] }
            }
          }

          case 'listTunnels': {
            const cookie = getCookie()
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

            const result = await listTunnels(cookie)
            if (result.success && Array.isArray(result.data)) {
              const tunnelCodes = result.data.map((t: any) => t.tunnelCode)
              return { content: [{ type: 'text', text: tunnelCodes.join(', ') }] }
            } else {
              return { content: [{ type: 'text', text: `listTunnels failed: ${result.error}` }] }
            }
          }

          case 'addTunnel': {
            const { regionCode, tunnelCode } = addTunnelSchema.parse(args)
            const cookie = getCookie()
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
            const cookie = getCookie()
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
            const cookie = getCookie()
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
            const cookie = getCookie()
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
            const cookie = getCookie()
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
            const cookie = getCookie()
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
            const cookie = getCookie()
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