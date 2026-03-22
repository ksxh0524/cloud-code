// WebSocket 连接管理器
// 单例模式，用于在应用中共享 WebSocket 广播功能

import { WebSocket } from '@hono/node-ws'

type WSConnection = WebSocket & { readyState: number }

interface ConversationClients {
  [conversationId: string]: Set<WSConnection>
}

class WebSocketManager {
  private clients: ConversationClients = {}

  addClient(conversationId: string, ws: WSConnection): void {
    if (!this.clients[conversationId]) {
      this.clients[conversationId] = new Set()
    }
    this.clients[conversationId].add(ws)
  }

  removeClient(conversationId: string, ws: WSConnection): void {
    if (this.clients[conversationId]) {
      this.clients[conversationId].delete(ws)
      // 如果没有客户端了，清理
      if (this.clients[conversationId].size === 0) {
        delete this.clients[conversationId]
      }
    }
  }

  hasClients(conversationId: string): boolean {
    return this.clients[conversationId]?.size > 0
  }

  broadcast(conversationId: string, data: any): void {
    const clients = this.clients[conversationId]
    if (clients) {
      const message = JSON.stringify(data)
      clients.forEach((ws) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(message)
          } catch (e) {
            console.error('Failed to send message:', e)
          }
        }
      })
    }
  }
}

// 单例导出
export const wsManager = new WebSocketManager()
