"""Main FastAPI Application"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import Conversation, Config, Message
from app.routers import web
from app.services.ws_manager import ws_manager
from app.services import cli_service

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Cloud Code API",
    description="Python backend for Cloud Code",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
        
        # Define output callback
        async def send_output(output: str):
            await ws_manager.send_output(conversation_id, output)
        
        # Start CLI session
        await cli_service.start_session(
            conversation_id,
            work_dir,
            cli_type,
            lambda output: asyncio.create_task(send_output(output))
        )
        
        await ws_manager.send_status(conversation_id, "started", cliType=cli_type)
        
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
        ws_manager.remove_client(conversation_id, websocket)
        
        # Stop CLI session if no more clients
        if not ws_manager.has_clients(conversation_id):
            cli_service.stop_session(conversation_id)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Cloud Code API", "version": "1.0.0"}