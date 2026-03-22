"""WebSocket Manager - manages WebSocket connections"""
import asyncio
import json
from typing import Dict, Set, Callable, Optional, Any
from fastapi import WebSocket


class WebSocketManager:
    """WebSocket connection manager"""
    
    def __init__(self):
        self._clients: Dict[str, Set[WebSocket]] = {}
        self._message_callbacks: Dict[str, Callable] = {}
    
    def add_client(self, conversation_id: str, websocket: WebSocket):
        """Add a WebSocket client for a conversation"""
        if conversation_id not in self._clients:
            self._clients[conversation_id] = set()
        self._clients[conversation_id].add(websocket)
        print(f"[WS] Client added for conversation: {conversation_id}")
    
    def remove_client(self, conversation_id: str, websocket: WebSocket):
        """Remove a WebSocket client"""
        if conversation_id in self._clients:
            self._clients[conversation_id].discard(websocket)
            if len(self._clients[conversation_id]) == 0:
                del self._clients[conversation_id]
        print(f"[WS] Client removed for conversation: {conversation_id}")
    
    def has_clients(self, conversation_id: str) -> bool:
        """Check if conversation has any clients"""
        return conversation_id in self._clients and len(self._clients[conversation_id]) > 0
    
    def get_client_count(self, conversation_id: str) -> int:
        """Get number of clients for a conversation"""
        return len(self._clients.get(conversation_id, set()))
    
    async def broadcast(self, conversation_id: str, data: Any):
        """Broadcast message to all clients of a conversation"""
        clients = self._clients.get(conversation_id)
        if not clients:
            return
        
        message = json.dumps(data)
        disconnected = []
        
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception as e:
                print(f"[WS] Failed to send message: {e}")
                disconnected.append(ws)
        
        # Remove disconnected clients
        for ws in disconnected:
            self._clients[conversation_id].discard(ws)
    
    async def send_output(self, conversation_id: str, output: str):
        """Send CLI output to clients"""
        await self.broadcast(conversation_id, {
            "type": "output",
            "conversationId": conversation_id,
            "data": {"output": output}
        })
    
    async def send_status(self, conversation_id: str, status: str, **kwargs):
        """Send status update"""
        data = {
            "type": "status",
            "conversationId": conversation_id,
            "data": {"status": status, **kwargs}
        }
        await self.broadcast(conversation_id, data)
    
    async def send_error(self, conversation_id: str, error: str):
        """Send error message"""
        await self.broadcast(conversation_id, {
            "type": "error",
            "conversationId": conversation_id,
            "data": {"error": error}
        })


# Singleton instance
ws_manager = WebSocketManager()
