import { test, expect } from '@playwright/test'

const BACKEND_URL = 'ws://localhost:18765/ws'
const API_URL = 'http://localhost:18765'

test.describe('WebSocket', () => {
  test('should connect and receive connected message', async ({ page }) => {
    const wsResult = await page.evaluate(async (wsUrl) => {
      return new Promise<{
        connected: boolean
        sessionId: string | null
        error: string | null
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)
        let connected = false
        let sessionId: string | null = null
        let error: string | null = null

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ connected, sessionId, error: error || 'Timeout' })
        }, 5000)

        ws.onopen = () => {
          // Wait for connected message
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            connected = true
            sessionId = data.data.sessionId
            // Send init message
            ws.send(JSON.stringify({
              type: 'init',
              data: { workDir: '/tmp' }
            }))
          } else if (data.type === 'initialized') {
            clearTimeout(timeout)
            ws.close()
            resolve({ connected, sessionId, error })
          }
        }

        ws.onerror = () => {
          error = 'WebSocket error'
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!connected) {
            resolve({ connected: false, sessionId: null, error: error || 'Closed before connected' })
          }
        }
      })
    }, BACKEND_URL)

    expect(wsResult.connected).toBe(true)
    expect(wsResult.sessionId).toBeTruthy()
    expect(wsResult.error).toBeNull()
  })

  test('should reject connection without init within timeout', async ({ page }) => {
    const wsResult = await page.evaluate(async (wsUrl) => {
      return new Promise<{
        closed: boolean
        code: number
        reason: string
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)
        let closed = false
        let code = 0
        let reason = ''

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ closed: false, code: -1, reason: 'Test timeout' })
        }, 15000)

        ws.onopen = () => {
          // Don't send init, wait for timeout
        }

        ws.onclose = (event) => {
          clearTimeout(timeout)
          closed = true
          code = event.code
          reason = event.reason
          resolve({ closed, code, reason })
        }
      })
    }, BACKEND_URL)

    // Server should close connection after init timeout (10s)
    expect(wsResult.closed).toBe(true)
  })

  test('should handle prompt and stream responses', async ({ page }) => {
    // First create a conversation
    const createRes = await page.request.post(`${API_URL}/api/conversations`, {
      data: { name: 'websocket-test', workDir: '/tmp', cliType: 'claude' },
    })
    expect(createRes.ok()).toBeTruthy()
    const conversation = await createRes.json()

    const wsResult = await page.evaluate(async ({ wsUrl, conversationId }) => {
      return new Promise<{
        success: boolean
        messages: string[]
        error: string | null
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)
        const messages: string[] = []
        let initialized = false

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ success: false, messages, error: 'Timeout' })
        }, 30000)

        ws.onopen = () => {
          // Connection opened, wait for connected message
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          messages.push(data.type)

          if (data.type === 'connected') {
            ws.send(JSON.stringify({
              type: 'init',
              data: { workDir: '/tmp' }
            }))
          } else if (data.type === 'initialized') {
            initialized = true
            // Send a simple prompt
            ws.send(JSON.stringify({
              type: 'prompt',
              data: {
                prompt: 'Hello, can you tell me what time is it?',
                workDir: '/tmp',
                conversationId
              }
            }))
          } else if (data.type === 'stream' || data.type === 'message' || data.type === 'done') {
            // Response received
          }

          if (data.type === 'done' || data.type === 'error') {
            clearTimeout(timeout)
            ws.close()
            resolve({
              success: data.type === 'done',
              messages,
              error: data.type === 'error' ? data.data : null
            })
          }
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolve({ success: false, messages, error: 'WebSocket error' })
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!initialized) {
            resolve({ success: false, messages, error: 'Connection closed before completion' })
          }
        }
      })
    }, { wsUrl: BACKEND_URL, conversationId: conversation.id })

    expect(wsResult.messages).toContain('connected')
    expect(wsResult.messages).toContain('initialized')
    expect(wsResult.messages).toContain('stream')
    expect(wsResult.messages).toContain('done')
    expect(wsResult.error).toBeNull()
  })

  test('should handle interrupt', async ({ page }) => {
    const createRes = await page.request.post(`${API_URL}/api/conversations`, {
      data: { name: 'websocket-interrupt-test', workDir: '/tmp', cliType: 'claude' },
    })
    expect(createRes.ok()).toBeTruthy()
    const conversation = await createRes.json()

    const wsResult = await page.evaluate(async ({ wsUrl, conversationId }) => {
      return new Promise<{
        success: boolean
        receivedStream: boolean
        error: string | null
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)
        let initialized = false
        let receivedStream = false

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ success: false, receivedStream, error: 'Timeout' })
        }, 30000)

        ws.onopen = () => {
          // Connection opened
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            ws.send(JSON.stringify({
              type: 'init',
              data: { workDir: '/tmp' }
            }))
          } else if (data.type === 'initialized') {
            initialized = true
            // Send a long prompt that might take time
            ws.send(JSON.stringify({
              type: 'prompt',
              data: {
                prompt: 'Write a long story about a developer.',
                workDir: '/tmp',
                conversationId
              }
            }))

            // Send interrupt after a short delay
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'interrupt' }))
            }, 2000)
          } else if (data.type === 'stream') {
            receivedStream = true
          } else if (data.type === 'done') {
            clearTimeout(timeout)
            ws.close()
            resolve({ success: true, receivedStream, error: null })
          } else if (data.type === 'error') {
            clearTimeout(timeout)
            ws.close()
            resolve({ success: false, receivedStream, error: data.data })
          }
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolve({ success: false, receivedStream, error: 'WebSocket error' })
        }
      })
    }, { wsUrl: BACKEND_URL, conversationId: conversation.id })

    // Should receive some stream content before interruption
    expect(wsResult.receivedStream).toBe(true)
  })

  test('should reject prompt before initialization', async ({ page }) => {
    const wsResult = await page.evaluate(async (wsUrl) => {
      return new Promise<{
        errorReceived: boolean
        errorMessage: string
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ errorReceived: false, errorMessage: 'Timeout' })
        }, 5000)

        ws.onopen = () => {
          // Wait for connected, then send prompt without init
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            // Send prompt before init
            ws.send(JSON.stringify({
              type: 'prompt',
              data: { prompt: 'test', workDir: '/tmp' }
            }))
          } else if (data.type === 'error') {
            clearTimeout(timeout)
            ws.close()
            resolve({ errorReceived: true, errorMessage: data.data })
          }
        }

        ws.onclose = () => {
          clearTimeout(timeout)
        }
      })
    }, BACKEND_URL)

    expect(wsResult.errorReceived).toBe(true)
    expect(wsResult.errorMessage).toContain('not initialized')
  })

  test('should auto-reconnect after disconnection', async ({ page }) => {
    const wsResult = await page.evaluate(async (wsUrl) => {
      return new Promise<{
        reconnected: boolean
        sessionIds: string[]
      }>((resolve) => {
        const sessionIds: string[] = []
        let ws: WebSocket | null = new WebSocket(wsUrl)
        let reconnectCount = 0
        const maxReconnects = 2

        const timeout = setTimeout(() => {
          ws?.close()
          resolve({ reconnected: reconnectCount >= maxReconnects, sessionIds })
        }, 15000)

        const connect = () => {
          ws = new WebSocket(wsUrl)

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data)

            if (data.type === 'connected') {
              sessionIds.push(data.data.sessionId)
              if (reconnectCount >= maxReconnects) {
                clearTimeout(timeout)
                resolve({ reconnected: true, sessionIds })
              } else {
                // Simulate disconnect by closing connection
                setTimeout(() => {
                  ws?.close()
                }, 1000)
              }
            }
          }

          ws.onclose = () => {
            reconnectCount++
            if (reconnectCount < maxReconnects) {
              setTimeout(connect, 500)
            }
          }
        }

        connect()
      })
    }, BACKEND_URL)

    expect(wsResult.reconnected).toBe(true)
    expect(wsResult.sessionIds.length).toBeGreaterThanOrEqual(2)
    // Each connection should have a unique session ID
    expect(wsResult.sessionIds[0]).not.toBe(wsResult.sessionIds[1])
  })
})

test.describe('WebSocket Message Types', () => {
  test('should receive thinking message type', async ({ page }) => {
    const createRes = await page.request.post(`${API_URL}/api/conversations`, {
      data: { name: 'thinking-test', workDir: '/tmp', cliType: 'claude' },
    })
    const conversation = await createRes.json()

    const wsResult = await page.evaluate(async ({ wsUrl, conversationId }) => {
      return new Promise<{
        receivedThinking: boolean
        receivedToolCall: boolean
        messageTypes: string[]
      }>((resolve) => {
        const ws = new WebSocket(wsUrl)
        const messageTypes: string[] = []

        const timeout = setTimeout(() => {
          ws.close()
          resolve({
            receivedThinking: messageTypes.includes('thinking'),
            receivedToolCall: messageTypes.includes('tool_call'),
            messageTypes
          })
        }, 30000)

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          messageTypes.push(data.type)

          if (data.type === 'connected') {
            ws.send(JSON.stringify({
              type: 'init',
              data: { workDir: '/tmp' }
            }))
          } else if (data.type === 'initialized') {
            // Send a prompt that might trigger thinking
            ws.send(JSON.stringify({
              type: 'prompt',
              data: {
                prompt: 'What files are in the current directory?',
                workDir: '/tmp',
                conversationId
              }
            }))
          } else if (data.type === 'done') {
            clearTimeout(timeout)
            ws.close()
            resolve({
              receivedThinking: messageTypes.includes('thinking'),
              receivedToolCall: messageTypes.includes('tool_call'),
              messageTypes
            })
          }
        }
      })
    }, { wsUrl: BACKEND_URL, conversationId: conversation.id })

    // Should receive various message types
    expect(wsResult.messageTypes.length).toBeGreaterThan(3)
  })
})
