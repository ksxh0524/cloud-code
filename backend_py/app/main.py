"""Main FastAPI application"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.database import engine, Base
from app.models import Conversation, TerminalHistory
from app.routers import web
from app.services.cli_service import cli_service
from app.services.ws_manager import ws_manager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    # Startup
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    yield
    # Shutdown
    logger.info("Application shutting down")


app = FastAPI(title="Cloud Code API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(web.router, prefix="/api")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for terminal communication"""
    await websocket.accept()
    
    conversation_id = websocket.query_params.get("conversationId")
    
    if not conversation_id:
        await websocket.send_text(json.dumps({
            "type": "error",
            "conversationId": None,
            "data": {"error": "No conversationId provided"}
        }))
        await websocket.close()
        return
    
    logger.info(f"WebSocket connection opened for conversation: {conversation_id}")
    ws_manager.add_client(conversation_id, websocket)

    # 取消延迟终止（如果有的话）
    cli_service.cancel_delayed_stop(conversation_id)

    from app.database import SessionLocal
    
    db = SessionLocal()
    try:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            await websocket.send_text(json.dumps({
                "type": "error",
                "conversationId": conversation_id,
                "data": {"error": "Conversation not found"}
            }))
            await websocket.close()
            return
        
        work_dir = str(conversation.workDir)
        cli_type = str(conversation.cliType)

        # 检查是否复用已有会话
        reused = cli_service.has_session(conversation_id)

        # Define output callback with history saving
        callback_active = {"active": True}
        
        async def send_output(output: str):
            # Only save/send if callback is still active
            if not callback_active["active"]:
                logger.debug(f"Callback inactive, skipping output: {output[:50]}...")
                return
            
            logger.debug(f"Processing output: {output[:50]}...")
            
            # Send to WebSocket clients first
            sent = False
            try:
                sent = await ws_manager.send_output(conversation_id, output)
                logger.debug(f"Sent to WebSocket: {sent}, clients: {ws_manager.get_client_count(conversation_id)}")
            except Exception as e:
                logger.error(f"Failed to send output: {e}")
            
            # Save to database only if sent successfully and still active
            if not sent or not callback_active["active"]:
                if not callback_active["active"]:
                    logger.debug(f"Callback became inactive after send, skipping save")
                elif not sent:
                    logger.debug(f"Not sent to any client, skipping save")
                return
                
            try:
                history_entry = TerminalHistory(
                    conversationId=conversation_id,
                    content=output
                )
                db.add(history_entry)
                db.commit()
                logger.debug(f"Saved to database")
            except Exception as e:
                logger.error(f"Failed to save terminal history: {e}")
                db.rollback()
        
        # Start CLI session
        await cli_service.start_session(
            conversation_id,
            work_dir,
            cli_type,
            lambda output: asyncio.create_task(send_output(output))
        )

        await ws_manager.send_status(conversation_id, "started", cliType=cli_type, reused=reused)
        
        # If session is being reused, also send history to the new client
        if reused:
            logger.info(f"Reusing existing session for {conversation_id}, sending history to new client")
            try:
                from app.routers.web import get_terminal_history
                history = await get_terminal_history(conversation_id, db)
                if history.get("content"):
                    # Send history content to the specific WebSocket client
                    await websocket.send_text(json.dumps({
                        "type": "history",
                        "conversationId": conversation_id,
                        "data": {"content": history["content"]}
                    }))
                    logger.info(f"Sent {history.get('entries', 0)} history entries to new client")
            except Exception as e:
                logger.error(f"Failed to send history to new client: {e}")
        
    finally:
        db.close()
    
    try:
        # Main message loop
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get("type") == "input":
                input_data = msg.get("data", {}).get("input", "")
                cli_service.send_input(conversation_id, input_data)
                
            elif msg.get("type") == "resize":
                cols = msg.get("cols", 80)
                rows = msg.get("rows", 24)
                cli_service.resize_session(conversation_id, rows, cols)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket connection closed for conversation: {conversation_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Deactivate callback to stop saving history
        callback_active["active"] = False
        
        ws_manager.remove_client(conversation_id, websocket)

        # 延迟终止 CLI session（5 分钟后）
        if not ws_manager.has_clients(conversation_id):
            cli_service.stop_session_delayed(conversation_id)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Cloud Code API", "version": "1.0.0"}


# Static files
static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
