import * as LSDK from '@larksuiteoapi/node-sdk'
// import { createSessionSelectCard, createMessageCard, createNewSessionCard } from '../cards/session-card.js'
import * as conversationModel from '../models/conversation.js'
// import { sendMessage } from './conversation.service.js'

export class FeishuService {
  private client: any = null
  private appId: string = ''
  private appSecret: string = ''
  private verifyToken: string = ''
  private encryptKey: string = ''

  configure(config: { appId: string; appSecret: string; verifyToken: string; encryptKey: string }) {
    this.appId = config.appId
    this.appSecret = config.appSecret
    this.verifyToken = config.verifyToken
    this.encryptKey = config.encryptKey

    if (config.appId && config.appSecret) {
      this.client = new LSDK.Client({
        appId: config.appId,
        appSecret: config.appSecret
      })
    }
  }

  verifySignature(signature: string, timestamp: string, body: string): boolean {
    // TODO: 实现签名验证
    // 需要根据飞书文档使用 encrypt_key 进行验证
    return true
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appSecret)
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Feishu client not configured')
    }

    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text })
        }
      })
    } catch (error) {
      console.error('[Feishu] Failed to send message:', error)
      throw error
    }
  }

  async sendCard(chatId: string, card: any): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Feishu client not configured')
    }

    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'interactive',
          content: JSON.stringify(card)
        }
      })
    } catch (error) {
      console.error('[Feishu] Failed to send card:', error)
      throw error
    }
  }

  async updateCard(chatId: string, messageId: string, card: any): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Feishu client not configured')
    }

    try {
      await this.client.im.message.patch({
        path: { message_id: messageId },
        data: {
          msg_type: 'interactive',
          content: JSON.stringify(card)
        }
      })
    } catch (error) {
      console.error('[Feishu] Failed to update card:', error)
      throw error
    }
  }

  /**
   * 处理飞书消息
   */
  async handleMessage(chatId: string, text: string, senderId: string): Promise<void> {
    console.log('[Feishu] Received message:', chatId, text)
    // TODO: 实现消息处理
  }

  /**
   * 处理卡片交互
   */
  async handleCardAction(chatId: string, action: any, messageId: string): Promise<void> {
    console.log('[Feishu] Card action:', action)
    // TODO: 实现卡片交互处理
  }
}

export const feishuService = new FeishuService()
