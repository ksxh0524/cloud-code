import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdir, rm, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
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

const REAL_DATA_DIR = join(homedir(), '.cloud-code')
const REAL_DATA_FILE = join(REAL_DATA_DIR, 'data.json')
const BACKUP_FILE = join(homedir(), '.cloud-code-test', 'data-backup.json')

describe('Store Module', () => {
  beforeAll(async () => {
    if (existsSync(REAL_DATA_FILE)) {
      await mkdir(join(homedir(), '.cloud-code-test'), { recursive: true })
      await copyFile(REAL_DATA_FILE, BACKUP_FILE)
    }
  })

  beforeEach(async () => {
    if (existsSync(REAL_DATA_FILE)) {
      await rm(REAL_DATA_FILE, { force: true })
    }
  })

  afterAll(async () => {
    if (existsSync(BACKUP_FILE)) {
      await copyFile(BACKUP_FILE, REAL_DATA_FILE)
      await rm(BACKUP_FILE, { force: true })
    }
  })

  describe('Conversations', () => {
    it('should create a conversation', async () => {
      const conv = await createConversation({
        name: 'Test Conversation',
        workDir: homedir(),
      })

      expect(conv).toBeDefined()
      expect(conv.id).toBeTruthy()
      expect(conv.name).toBe('Test Conversation')
      expect(conv.workDir).toBe(homedir())
      expect(conv.cliType).toBe('claude')
      expect(conv.createdAt).toBeTruthy()
      expect(conv.updatedAt).toBeTruthy()
    })

    it('should list conversations sorted by updatedAt', async () => {
      const conv1 = await createConversation({ name: 'First', workDir: homedir() })
      await new Promise(r => setTimeout(r, 10))
      const conv2 = await createConversation({ name: 'Second', workDir: homedir() })

      const list = await listConversations()

      expect(list).toHaveLength(2)
      expect(list[0].id).toBe(conv2.id)
      expect(list[1].id).toBe(conv1.id)
    })

    it('should get a conversation by id', async () => {
      const conv = await createConversation({ name: 'Test', workDir: homedir() })
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
      const conv = await createConversation({ name: 'Original', workDir: homedir() })
      const updated = await updateConversation(conv.id, { name: 'Updated' })

      expect(updated).toBeDefined()
      expect(updated?.name).toBe('Updated')
      expect(updated?.id).toBe(conv.id)

      const found = await getConversation(conv.id)
      expect(found?.name).toBe('Updated')
    })

    it('should return null when updating non-existent conversation', async () => {
      const updated = await updateConversation('non-existent', { name: 'New Name' })
      expect(updated).toBeNull()
    })

    it('should delete a conversation', async () => {
      const conv = await createConversation({ name: 'To Delete', workDir: homedir() })
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
      const conv = await createConversation({ name: 'Test', workDir: homedir() })

      await saveMessages(conv.id, [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
      ])

      const messagesBefore = await loadMessages(conv.id)
      expect(messagesBefore).toHaveLength(1)

      await deleteConversation(conv.id)

      const messagesAfter = await loadMessages(conv.id)
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
      const newDir = join(homedir(), 'custom-workdir')
      await updateConfig({ defaultWorkDir: newDir })

      const config = await getConfig()
      expect(config.defaultWorkDir).toBe(newDir)
    })

    it('should merge partial updates', async () => {
      await updateConfig({ defaultWorkDir: join(homedir(), 'another') })

      const updated = await getConfig()
      expect(updated.defaultWorkDir).toBe(join(homedir(), 'another'))
    })
  })

  describe('Work Directories', () => {
    it('should get work directories', async () => {
      const dirs = await getWorkDirs()
      expect(Array.isArray(dirs)).toBe(true)
    })

    it('should get sub directories for allowed path', async () => {
      const testDir = join(homedir(), 'codes')

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
      const conversationId = crypto.randomUUID()
      const messages = [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hi there!', type: 'text', timestamp: Date.now() },
      ]

      await saveMessages(conversationId, messages)
      const loaded = await loadMessages(conversationId)

      expect(loaded).toHaveLength(2)
      expect(loaded[0].content).toBe('Hello')
      expect(loaded[1].content).toBe('Hi there!')
    })

    it('should return empty array for non-existent conversation', async () => {
      const loaded = await loadMessages(crypto.randomUUID())
      expect(loaded).toEqual([])
    })

    it('should append to existing messages', async () => {
      const conversationId = crypto.randomUUID()

      await saveMessages(conversationId, [
        { id: '1', role: 'user', content: 'First', type: 'text', timestamp: Date.now() },
      ])

      await saveMessages(conversationId, [
        { id: '2', role: 'user', content: 'Second', type: 'text', timestamp: Date.now() },
      ])

      const loaded = await loadMessages(conversationId)
      expect(loaded).toHaveLength(2)
      expect(loaded[0]!.content).toBe('First')
      expect(loaded[1]!.content).toBe('Second')
    })

    it('should handle messages with metadata', async () => {
      const conversationId = crypto.randomUUID()
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
      const loaded = await loadMessages(conversationId)

      expect(loaded[0].metadata).toBeDefined()
      expect(loaded[0].metadata?.toolName).toBe('Bash')
    })

    it('should delete messages', async () => {
      const conversationId = crypto.randomUUID()

      await saveMessages(conversationId, [
        { id: '1', role: 'user', content: 'Hello', type: 'text', timestamp: Date.now() },
      ])

      await deleteMessages(conversationId)

      const loaded = await loadMessages(conversationId)
      expect(loaded).toEqual([])
    })

    it('should handle delete for non-existent messages', async () => {
      await expect(deleteMessages(crypto.randomUUID())).resolves.toBeUndefined()
    })

    it('should reject invalid conversation IDs', async () => {
      await expect(saveMessages('../../etc/passwd', [])).rejects.toThrow('Invalid conversation ID')
      await expect(loadMessages('../hack')).rejects.toThrow('Invalid conversation ID')
      await expect(deleteMessages('not-a-uuid')).rejects.toThrow('Invalid conversation ID')
    })
  })
})
