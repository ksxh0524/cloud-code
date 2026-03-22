#!/usr/bin/env python3
"""Test WebSocket connection to Python backend"""
import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:18765/ws?conversationId=393a0fbe-82e8-4d89-92c4-b3b77defd70d"
    
    try:
        async with websockets.connect(uri) as ws:
            print(f"Connected to {uri}")
            
            # Send init message
            await ws.send(json.dumps({
                "type": "init",
                "conversationId": "393a0fbe-82e8-4d89-92c4-b3b77defd70d"
            }))
            
            # Wait for messages
            for i in range(10):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    data = json.loads(msg)
                    print(f"Received: {data.get('type')} - {str(data.get('data', ''))[:100]}")
                except asyncio.TimeoutError:
                    print("Timeout waiting for message")
                    break
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())