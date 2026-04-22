import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversations } from '../useConversations'

const mockFetch = vi.fn()
vi.mock('../../lib/fetch', () => ({
  authFetch: (...args: Parameters<typeof fetch>) => mockFetch(...args),
}))

vi.mock('../../components/Toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    userAction: vi.fn(),
  },
}))

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty conversations', () => {
    const { result } = renderHook(() => useConversations())
    expect(result.current.conversations).toEqual([])
  })

  it('should load conversations', async () => {
    const mockConversations = [
      { id: '1', name: 'Test', workDir: '/tmp', cliType: 'claude', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversations),
    })

    const { result } = renderHook(() => useConversations())

    await act(async () => {
      await result.current.loadConversations()
    })

    expect(result.current.conversations).toEqual(mockConversations)
    expect(mockFetch).toHaveBeenCalledWith('/api/conversations')
  })

  it('should handle load failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { result } = renderHook(() => useConversations())

    await act(async () => {
      await result.current.loadConversations()
    })

    expect(result.current.conversations).toEqual([])
  })

  it('should create a conversation', async () => {
    const newConv = {
      id: '2',
      name: 'my-project',
      workDir: '/home/user/projects/my-project',
      cliType: 'claude',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    }

    // GET /api/conversations (mount-time useEffect)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { result } = renderHook(() => useConversations())

    // Wait for mount-time loadConversations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // POST /api/conversations
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(newConv),
    })

    // GET /api/conversations (loadConversations called internally after create)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([newConv]),
    })

    await act(async () => {
      await result.current.createConversation('/home/user/projects/my-project')
    })

    expect(result.current.conversations).toHaveLength(1)
    expect(result.current.conversations[0]!.name).toBe('my-project')
  })

  it('should update a conversation', async () => {
    const existingConv = {
      id: '1',
      name: 'Old Name',
      workDir: '/tmp',
      cliType: 'claude',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    }

    // load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([existingConv]),
    })

    const { result } = renderHook(() => useConversations())

    await act(async () => {
      await result.current.loadConversations()
    })

    // update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...existingConv, name: 'New Name', updatedAt: '2024-01-02' }),
    })

    await act(async () => {
      await result.current.updateConversation('1', 'New Name')
    })

    expect(result.current.conversations[0]!.name).toBe('New Name')
  })

  it('should delete a conversation', async () => {
    const conv = {
      id: '1',
      name: 'To Delete',
      workDir: '/tmp',
      cliType: 'claude',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([conv]),
    })

    const { result } = renderHook(() => useConversations())

    await act(async () => {
      await result.current.loadConversations()
    })

    expect(result.current.conversations).toHaveLength(1)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.deleteConversation('1')
    })

    expect(result.current.conversations).toHaveLength(0)
  })
})
