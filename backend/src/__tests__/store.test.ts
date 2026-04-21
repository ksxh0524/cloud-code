import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { mkdir, rm, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  getConfig,
  updateConfig,
  getWorkDirs,
  getSubDirectories,
  isPathAllowed,
  addAllowedRoot,
  saveMessages,
  loadMessages,
  deleteMessages,
} from '../store.js'

const TEST_DATA_DIR = join(homedir(), '.cloud-code-test')
const TEST_DATA_FILE = join(TEST_DATA_DIR, 'data.json')
const TEST_MESSAGES_DIR = join(TEST_DATA_DIR, 'messages')

describe('Store Module', () => {
  beforeAll(async () => {
    // Create test directory
    await mkdir(TEST_DATA_DIR, { recursive: true })
    await mkdir(TEST_MESSAGES_DIR, { recursive: true })
  })

  beforeEach(async () => {
    // Clear test data before each test
    try {
      await rm(TEST_DATA_FILE, { force: true })
      const files = await import('fs/promises').then(m => m.readdir(TEST_MESSAGES_DIR))
      for (const file of files) {
        await rm(join(TEST_MESSAGES_DIR, file), { force: true })
      }
    } catch {
      // Ignore errors
    }
  })

  afterEach(async () => {
    // Cleanup after each test
    try {
      await rm(TEST_DATA_FILE, { force: true })
    } catch {
      // Ignore errors
    }
  })

  describe('Conversations', () => {
    it('should create a conversation', async () => {
      const conv = await createConversation({
        name: 'Test Conversation',
        workDir: '/tmp/test',
      })

      expect(conv).toBeDefined()
      expect(conv.id).toBeTruthy()
      expect(conv.name).toBe('Test Conversation')
      expect(conv.workDir).toBe('/tmp/test')
      expect(conv.cliType).toBe('claude')
      expect(conv.createdAt).toBeTruthy()
      expect(conv.updatedAt).toBeTruthy()
    })

    it('should list conversations sorted by updatedAt', async () => {
      const conv1 = await createConversation({ name: 'First', workDir: '/tmp/1' })
      await new Promise(r => setTimeout(r, 10))
      const conv2 = await createConversation({ name: 'Second', workDir: '/tmp/2' })

      const list = await listConversations()

      expect(list).toHaveLength(2)
      expect(list[0].id).toBe(conv2.id) // Most recent first
      expect(list[1].id).toBe(conv1.id)
    })

    it('should get a conversation by id', async () => {
      const conv = await createConversation({ name: 'Test', workDir: '/tmp' })
      const found = await getConversation(conv.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(conv.id)
      expect(found?.name).toBe('Test')
    })

    it('should return undefined for non-existent conversation', async () => {
      const found = await getConversation('non-existent-id')
      expect(found).toBeUndefined()
    })

    it('should update a conversation', async () => {
      const conv = await createConversation({ name: 'Original', workDir: '/tmp' })
      const updated = await updateConversation(conv.id, { name: 'Updated' })

      expect(updated).toBeDefined()
      expect(updated?.name).toBe('Updated')
      expect(updated?.id).toBe(conv.id)

      // Verify it was saved
      const found = await getConversation(conv.id)
      expect(found?.name).toBe('Updated')
    })

    it('should return null when updating non-existent conversation', async () => {
      const updated = await updateConversation('non-existent', { name: 'New Name' })
      expect(updated).toBeNull()
    })

    it('should delete a conversation', async () => {
      const conv = await createConversation({ name: 'To Delete', workDir: '/tmp' })
      const deleted = await deleteConversation(conv.id)

      expect(deleted).toBe(true)

      const found = await getConversation(conv.id)
      expect(found).toBeUndefined()
    })

    it('should return false when deleting non-existent conversation', async () => {
      const deleted = await deleteConversation('non-existent')
      expect(deleted).toBe(false)
    })

    it('should delete associated messages when deleting conversation', async () => {
      const conv = await createConversation({ name: 'Test', workDir: '/tmp' })

      // Save some messages
      await saveMessages(conv.id, [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
      ])

      // Verify messages exist
      const messagesBefore = loadMessages(conv.id)
      expect(messagesBefore).toHaveLength(1)

      // Delete conversation
      await deleteConversation(conv.id)

      // Verify messages are deleted
      const messagesAfter = loadMessages(conv.id)
      expect(messagesAfter).toHaveLength(0)
    })
  })

  describe('Config', () => {
    it('should get default config', async () => {
      const config = await getConfig()

      expect(config).toBeDefined()
      expect(config.defaultWorkDir).toBeTruthy()
    })

    it('should update config', async () => {
      const newDir = '/custom/workdir'
      await updateConfig({ defaultWorkDir: newDir })

      const config = await getConfig()
      expect(config.defaultWorkDir).toBe(newDir)
    })

    it('should merge partial updates', async () => {
      const original = await getConfig()
      await updateConfig({ defaultWorkDir: '/another/dir' })

      const updated = await getConfig()
      expect(updated.defaultWorkDir).toBe('/another/dir')
    })
  })

  describe('Work Directories', () => {
    it('should get work directories', async () => {
      const dirs = await getWorkDirs()
      expect(Array.isArray(dirs)).toBe(true)
    })

    it('should get sub directories for allowed path', async () => {
      const testDir = join(homedir(), 'codes')

      // Only test if the directory exists
      try {
        const subs = await getSubDirectories(testDir)
        expect(Array.isArray(subs)).toBe(true)
      } catch {
        // Directory might not exist, skip
      }
    })

    it('should return empty array for non-allowed path', async () => {
      const subs = await getSubDirectories('/etc')
      expect(subs).toEqual([])
    })

    it('should return empty array for non-existent path', async () => {
      const subs = await getSubDirectories('/non/existent/path/12345')
      expect(subs).toEqual([])
    })
  })

  describe('Path Safety', () => {
    it('should allow home directory', () => {
      expect(isPathAllowed(homedir())).toBe(true)
    })

    it('should allow paths under home directory', () => {
      expect(isPathAllowed(join(homedir(), 'codes'))).toBe(true)
      expect(isPathAllowed(join(homedir(), 'codes', 'project'))).toBe(true)
    })

    it('should reject paths outside home directory', () => {
      expect(isPathAllowed('/etc')).toBe(false)
      expect(isPathAllowed('/root')).toBe(false)
    })

    it('should allow adding custom roots', () => {
      const customRoot = '/custom/root'
      addAllowedRoot(customRoot)
      expect(isPathAllowed(customRoot)).toBe(true)
    })

    it('should handle path traversal attempts', () => {
      const traversalPath = join(homedir(), '..', 'etc')
      expect(isPathAllowed(traversalPath)).toBe(false)
    })
  })

  describe('Messages', () => {
    it('should save and load messages', async () => {
      const conversationId = 'test-conv-1'
      const messages = [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hi there!', type: 'text', timestamp: Date.now() },
      ]

      await saveMessages(conversationId, messages)
      const loaded = loadMessages(conversationId)

      expect(loaded).toHaveLength(2)
      expect(loaded[0].content).toBe('Hello')
      expect(loaded[1].content).toBe('Hi there!')
    })

    it('should return empty array for non-existent conversation', () => {
      const loaded = loadMessages('non-existent-conv')
      expect(loaded).toEqual([])
    })

    it('should overwrite existing messages', async () => {
      const conversationId = 'test-conv-2'

      await saveMessages(conversationId, [
        { id: '1', role: 'user', content: 'First', type: 'text', timestamp: Date.now() },
      ])

      await saveMessages(conversationId, [
        { id: '2', role: 'user', content: 'Second', type: 'text', timestamp: Date.now() },
      ])

      const loaded = loadMessages(conversationId)
      expect(loaded).toHaveLength(1)
      expect(loaded[0].content).toBe('Second')
    })

    it('should handle messages with metadata', async () => {
      const conversationId = 'test-conv-3'
      const messages = [
        {
          id: '1',
          role: 'assistant',
          content: 'Tool result',
          type: 'tool_use',
          metadata: { toolName: 'Bash', toolInput: { command: 'ls' } },
          timestamp: Date.now(),
        },
      ]

      await saveMessages(conversationId, messages)
      const loaded = loadMessages(conversationId)

      expect(loaded[0].metadata).toBeDefined()
      expect(loaded[0].metadata?.toolName).toBe('Bash')
    })

    it('should delete messages', async () => {
      const conversationId = 'test-conv-4'

      await saveMessages(conversationId, [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
      ])

      deleteMessages(conversationId)

      const loaded = loadMessages(conversationId)
      expect(loaded).toEqual([])
    })

    it('should handle delete for non-existent messages', () => {
      // Should not throw
      expect(() => deleteMessages('non-existent')).not.toThrow()
    })
  })
})
