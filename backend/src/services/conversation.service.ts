import * as conversationModel from '../models/conversation.js'
import * as messageModel from '../models/message.js'
import { claudeService } from './claude.service.js'
import { broadcastToConversation } from '../routes/ws.js'

export async function createConversation(name: string, workDir: string) {
  const conv = conversationModel.createConversation(name, workDir)
  // 启动 Claude 会话
  await claudeService.startSession(conv.id, workDir)
  return conv
}

export async function sendMessage(conversationId: string, content: string) {
  // 保存用户消息
  const userMessage = messageModel.createMessage(conversationId, 'user', content)

  // 广播用户消息
  broadcastToConversation(conversationId, {
    type: 'message',
    conversationId,
    data: userMessage
  })

  // 发送到 Claude
  await claudeService.sendMessage(conversationId, content)

  return userMessage
}

export async function deleteConversation(conversationId: string) {
  await claudeService.stopSession(conversationId)
  conversationModel.deleteConversation(conversationId)
}

export async function getConversationMessages(conversationId: string) {
  return messageModel.getMessages(conversationId)
}
