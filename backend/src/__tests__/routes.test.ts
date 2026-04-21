import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import { rm, mkdir, copyFile } from 'fs/promises'
import { router } from '../routes.js'
import { addAllowedRoot } from '../store.js'

const REAL_DATA_DIR = join(homedir(), '.cloud-code')
const REAL_DATA_FILE = join(REAL_DATA_DIR, 'data.json')
const BACKUP_FILE = join(homedir(), '.cloud-code-test', 'routes-data-backup.json')

// 添加 /tmp 到允许列表（仅用于测试）
addAllowedRoot('/tmp')

const app = express()
app.use(express.json())
app.use('/api', router)

describe('REST API Routes', () => {
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

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.timestamp).toBeTruthy()
    })
  })

  describe('Conversations CRUD', () => {
    it('should create a conversation', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Test Conversation',
          workDir: '/tmp',
          cliType: 'claude',
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeTruthy()
      expect(res.body.name).toBe('Test Conversation')
      expect(res.body.workDir).toBe('/tmp')
      expect(res.body.cliType).toBe('claude')
    })

    it('should reject invalid conversation data', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({
          name: '',
          workDir: '/tmp',
        })

      expect(res.status).toBe(400)
    })

    it('should reject disallowed workDir', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Test',
          workDir: '/etc',
        })

      expect(res.status).toBe(400)
    })

    it('should reject relative workDir', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Test',
          workDir: 'relative/path',
        })

      expect(res.status).toBe(400)
    })

    it('should list conversations', async () => {
      const res = await request(app).get('/api/conversations')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('should get a single conversation', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Single Test',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app).get(`/api/conversations/${conv.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(conv.id)
      expect(res.body.name).toBe('Single Test')
    })

    it('should return 404 for non-existent conversation', async () => {
      const res = await request(app).get('/api/conversations/non-existent-id')
      expect(res.status).toBe(404)
    })

    it('should update a conversation', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'To Update',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app)
        .patch(`/api/conversations/${conv.id}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated Name')
    })

    it('should reject invalid update data', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Test',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app)
        .patch(`/api/conversations/${conv.id}`)
        .send({ name: '' })

      expect(res.status).toBe(400)
    })

    it('should delete a conversation', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'To Delete',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app).delete(`/api/conversations/${conv.id}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const getRes = await request(app).get(`/api/conversations/${conv.id}`)
      expect(getRes.status).toBe(404)
    })
  })

  describe('Config', () => {
    it('should get config', async () => {
      const res = await request(app).get('/api/config')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('defaultWorkDir')
    })

    it('should update config with allowed path', async () => {
      const res = await request(app)
        .put('/api/config')
        .send({
          defaultWorkDir: '/tmp',
        })

      expect(res.status).toBe(200)
      expect(res.body.defaultWorkDir).toBe('/tmp')
    })

    it('should reject disallowed config path', async () => {
      const res = await request(app)
        .put('/api/config')
        .send({
          defaultWorkDir: '/etc',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Work Directories', () => {
    it('should get work directories', async () => {
      const res = await request(app).get('/api/workdirs')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('should reject disallowed path for sub directories', async () => {
      const res = await request(app).get('/api/directories?path=/root')

      expect(res.status).toBe(403)
    })

    it('should reject invalid path for sub directories', async () => {
      const res = await request(app).get('/api/directories?path=/etc')

      expect(res.status).toBe(403)
    })
  })

  describe('Messages', () => {
    it('should get messages for a conversation', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Messages Test',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app).get(`/api/conversations/${conv.id}/messages`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('should return 404 for non-existent conversation messages', async () => {
      const res = await request(app).get('/api/conversations/non-existent/messages')
      expect(res.status).toBe(404)
    })
  })

  describe('404 handling', () => {
    it('should return 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/nonexistent')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })
  })
})
