import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMessages } from '../useMessages'

// Mock authFetch
vi.mock('../../lib/fetch', () => ({
  authFetch: vi.fn(),
}))

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    userAction: vi.fn(),
    system: vi.fn(),
    network: vi.fn(),
    sdk: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    setSource: vi.fn(),
  },
}))

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useMessages(null))
    expect(result.current.messages).toEqual([])
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.sdkSessionId).toBeNull()
  })

  it('should add user message', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.addUserMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.role).toBe('user')
    expect(result.current.messages[0]!.content).toBe('Hello')
    expect(result.current.messages[0]!.type).toBe('text')
  })

  it('should handle stream messages for token-level streaming', () => {
    const { result } = renderHook(() => useMessages(null))

    // First stream token creates a new message
    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'stream', data: { delta: { text: 'Hello' } } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Hello')
    expect(result.current.messages[0]!.role).toBe('assistant')

    // Subsequent stream token appends
    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'stream', data: { delta: { text: ' World' } } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Hello World')
  })

  it('should replace streaming content with complete message', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'stream', data: { delta: { text: 'Partial' } } },
        null
      )
    })

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'message', data: { role: 'assistant', content: 'Complete message', type: 'text' } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Complete message')
  })

  it('should handle thinking messages', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'thinking', data: { content: 'Thinking about this...' } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.type).toBe('thinking')
    expect(result.current.messages[0]!.content).toBe('Thinking about this...')
  })

  it('should handle tool_call messages', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'tool_call', data: { toolId: 'tool-1', toolName: 'Bash', toolInput: { command: 'ls' } } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.type).toBe('tool_use')
    expect(result.current.messages[0]!.metadata?.toolName).toBe('Bash')
  })

  it('should merge tool_result into existing tool_use', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'tool_call', data: { toolId: 'tool-1', toolName: 'Bash', toolInput: { command: 'ls' } } },
        null
      )
    })

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'tool_result', data: { toolId: 'tool-1', toolOutput: 'file1.txt\nfile2.txt' } },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.metadata?.toolOutput).toBe('file1.txt\nfile2.txt')
  })

  it('should handle done message', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.setIsStreaming(true)
    })
    expect(result.current.isStreaming).toBe(true)

    act(() => {
      result.current.handleWebSocketMessage(
        { type: 'done', data: { sdkSessionId: 'session-123' } },
        null
      )
    })

    expect(result.current.isStreaming).toBe(false)
  })

  it('should handle error message', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.setIsStreaming(true)
      result.current.handleWebSocketMessage(
        { type: 'error', data: 'Something went wrong' },
        null
      )
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.role).toBe('system')
    expect(result.current.messages[0]!.content).toContain('Something went wrong')
    expect(result.current.isStreaming).toBe(false)
  })

  it('should clear messages', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.addUserMessage('Hello')
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
  })

  it('should get history for prompt (text-only messages)', () => {
    const { result } = renderHook(() => useMessages(null))

    act(() => {
      result.current.addUserMessage('Hello')
      result.current.handleWebSocketMessage(
        { type: 'message', data: { role: 'assistant', content: 'Hi', type: 'text' } },
        null
      )
      result.current.handleWebSocketMessage(
        { type: 'thinking', data: { content: 'Thinking...' } },
        null
      )
    })

    const history = result.current.getHistoryForPrompt()
    expect(history).toHaveLength(2) // user + assistant, thinking excluded
    expect(history[0]!.role).toBe('user')
    expect(history[1]!.role).toBe('assistant')
  })

  it('should filter messages by sessionId', () => {
    const { result } = renderHook(() => useMessages(null))

    const handled = result.current.handleWebSocketMessage(
      { type: 'done', data: null, sessionId: 'wrong-session' },
      'my-session'
    )

    expect(handled).toBe(false)
    expect(result.current.messages).toHaveLength(0)
  })
})
