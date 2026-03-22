import { Hono } from 'hono'
import * as configModel from '../models/config.js'
import { feishuService } from '../services/feishu.service.js'

const app = new Hono()

// 飞书事件回调
app.post('/events', async (c) => {
  const body = await c.req.json()

  console.log('[Feishu] Received event:', JSON.stringify(body, null, 2))

  // 加载飞书配置
  const config = configModel.getConfig()
  feishuService.configure(config.feishu)

  // 验证签名（TODO: 实现签名验证）
  // const signature = c.req.header('X-Lark-Request-Nonce')
  // const timestamp = c.req.header('X-Lark-Request-Timestamp')
  // if (!feishuService.verifySignature(signature, timestamp, JSON.stringify(body))) {
  //   return c.json({ code: 401, msg: 'Invalid signature' }, 401)
  // }

  // 处理 URL 验证
  if (body.type === 'url_verification') {
    const challenge = body.challenge
    console.log('[Feishu] URL verification, challenge:', challenge)
    return c.json({ challenge })
  }

  // 处理事件回调
  if (body.type === 'event_callback') {
    const event = body.event

    // 处理不同类型的事件
    switch (event.type) {
      case 'im.message.receive_v1':
        // 收到消息
        await handleMessage(event, config)
        break

      case 'card.action.trigger':
        // 卡片交互
        await handleCardAction(event, config)
        break

      default:
        console.log('[Feishu] Unknown event type:', event.type)
    }
  }

  return c.json({ code: 0, msg: 'success' })
})

async function handleMessage(event: any, config: any) {
  const { chat_id, content, message_id, sender } = event.message

  // 解析消息内容
  let text = ''
  try {
    const contentObj = JSON.parse(content)
    text = contentObj.text || ''
  } catch {
    text = content || ''
  }

  if (!text) return

  // 处理消息
  try {
    await feishuService.sendMessage(chat_id, '正在处理...')
    await feishuService.handleMessage(chat_id, text, sender.sender_id.user_id)
  } catch (error) {
    console.error('[Feishu] Error handling message:', error)
    await feishuService.sendMessage(chat_id, `处理失败: ${error}`)
  }
}

async function handleCardAction(event: any, config: any) {
  const { chat_id, token, action } = event

  try {
    await feishuService.handleCardAction(chat_id, action, token)
  } catch (error) {
    console.error('[Feishu] Error handling card action:', error)
    await feishuService.sendMessage(chat_id, `操作失败: ${error}`)
  }
}

export default app
