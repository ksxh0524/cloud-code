import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { router } from '../routes.js'

const app = express()
app.use(express.json())
app.use('/api', router)

describe('REST API Routes', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.timestamp).toBeTruthy()
    })
  })

  describe('Conversations CRUD', () => {
    let createdConvId: string

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

      createdConvId = res.body.id
    })

    it('should reject invalid conversation data', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .send({
          name: '', // Invalid: empty name
          workDir: '/tmp',
        })

      expect(res.status).toBe(400)
    })

    it('should list conversations', async () => {
      const res = await request(app).get('/api/conversations')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('should get a single conversation', async () => {
      // First create a conversation
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
      // First create a conversation
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
        .send({ name: '' }) // Invalid: empty name

      expect(res.status).toBe(400)
    })

    it('should delete a conversation', async () => {
      // First create a conversation
      const createRes = await request(app)
        .post('/api/conversations')
        .send({
          name: 'To Delete',
          workDir: '/tmp',
          cliType: 'claude',
        })
      const conv = createRes.body

      const res = await request(app).delete(`/api/conversations/${conv.id}`)

      expect(res.status).toBe(204)

      // Verify it's deleted
      const getRes = await request(app).get(`/api/conversations/${conv.id}`)
      expect(getRes.status).toBe(404)
    })
  })

  describe('Config', () => {
    it('should get config', async () => {
      const res = await request(app).get('/api/config')

      expect(res.status).toBe(200)
      expect(res.body.defaultWorkDir).toBeTruthy()
    })

    it('should update config', async () => {
      const res = await request(app)
        .put('/api/config')
        .send({
          defaultWorkDir: '/custom/workdir',
        })

      expect(res.status).toBe(200)
      expect(res.body.defaultWorkDir).toBe('/custom/workdir')
    })

    it('should reject invalid config', async () => {
      const res = await request(app)
        .put('/api/config')
        .send({
          defaultWorkDir: '', // Invalid: empty path
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

    it('should get sub directories', async () => {
      const res = await request(app).get('/api/directories?path=/tmp')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('should reject invalid path for sub directories', async () => {
      const res = await request(app).get('/api/directories?path=/etc')

      expect(res.status).toBe(200) // Returns empty array, not error
      expect(res.body).toEqual([])
    })
  })

  describe('Messages', () => {
    it('should get messages for a conversation', async () => {
      // First create a conversation
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
})
