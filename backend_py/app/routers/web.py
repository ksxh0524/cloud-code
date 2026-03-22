"""Web API Routes"""
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Conversation
from app.services.conversation_service import (
    create_conversation, get_conversation, 
    list_conversations, update_conversation, delete_conversation
)
from app.services.config_service import get_config, set_config
from app.services import cli_service

router = APIRouter()


# Pydantic schemas
class ConversationCreate(BaseModel):
    name: str
    workDir: str
    cliType: str = "claude"


class ConversationUpdate(BaseModel):
    name: Optional[str] = None


class ConfigUpdate(BaseModel):
    feishu: Optional[dict] = None
    defaultWorkDir: Optional[str] = None


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@router.get("/cli-types")
async def get_cli_types():
    """Get supported CLI types"""
    return cli_service.get_supported_cli_types()


@router.get("/cli-check/{cli_type}")
async def check_cli(cli_type: str):
    """Check if CLI is installed"""
    return await cli_service.check_cli_installed(cli_type)


@router.get("/conversations", response_model=List[dict])
async def get_conversations(db: Session = Depends(get_db)):
    """List all conversations"""
    conversations = list_conversations(db)
    return [
        {
            "id": c.id,
            "name": c.name,
            "workDir": c.workDir,
            "cliType": c.cliType,
            "feishuChatId": c.feishuChatId,
            "createdAt": c.createdAt,
            "updatedAt": c.updatedAt
        }
        for c in conversations
    ]


@router.post("/conversations", status_code=201)
async def create_new_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db)
):
    """Create a new conversation"""
    conversation = create_conversation(
        db, data.name, data.workDir, data.cliType
    )
    
    # Prewarm: Start CLI session (disabled for now - will be started on WebSocket connect)
    # asyncio.create_task(cli_service.start_session(...))
    
    return {
        "id": conversation.id,
        "name": conversation.name,
        "workDir": conversation.workDir,
        "cliType": conversation.cliType,
        "createdAt": conversation.createdAt,
        "updatedAt": conversation.updatedAt
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get conversation by ID"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": conversation.id,
        "name": conversation.name,
        "workDir": conversation.workDir,
        "cliType": conversation.cliType,
        "feishuChatId": conversation.feishuChatId,
        "createdAt": conversation.createdAt,
        "updatedAt": conversation.updatedAt
    }


@router.patch("/conversations/{conversation_id}")
async def update_conversation_detail(
    conversation_id: str,
    data: ConversationUpdate,
    db: Session = Depends(get_db)
):
    """Update conversation"""
    updates = {}
    if data.name:
        updates["name"] = data.name
    
    conversation = update_conversation(db, conversation_id, updates)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": conversation.id,
        "name": conversation.name,
        "workDir": conversation.workDir,
        "cliType": conversation.cliType,
        "feishuChatId": conversation.feishuChatId,
        "createdAt": conversation.createdAt,
        "updatedAt": conversation.updatedAt
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Delete conversation"""
    success = delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Stop CLI session
    cli_service.stop_session(conversation_id)
    
    return {"success": True}


@router.get("/workdirs")
async def get_workdirs(db: Session = Depends(get_db)):
    """Get work directories from config"""
    config = get_config(db)
    work_dir = config.get("defaultWorkDir", os.getcwd())
    
    # Get subdirectories
    subdirs = []
    if os.path.exists(work_dir):
        try:
            entries = os.listdir(work_dir)
            subdirs = sorted([
                name for name in entries
                if os.path.isdir(os.path.join(work_dir, name)) 
                and not name.startswith(".")
            ])
        except Exception:
            pass
    
    return [
        {
            "path": work_dir,
            "name": Path(work_dir).name or work_dir,
            "isConfig": True
        },
        *[
            {
                "path": os.path.join(work_dir, name),
                "name": name,
                "isConfig": False
            }
            for name in subdirs
        ]
    ]


@router.get("/directories")
async def get_directories(path: str = Query(...)):
    """Get subdirectories of a path"""
    if not os.path.exists(path):
        return []
    
    try:
        entries = os.listdir(path)
        return sorted([
            name for name in entries
            if os.path.isdir(os.path.join(path, name))
            and not name.startswith(".")
        ])
    except Exception:
        return []


@router.get("/config")
async def get_app_config(db: Session = Depends(get_db)):
    """Get app configuration"""
    return get_config(db)


@router.put("/config")
async def update_app_config(
    data: ConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update app configuration"""
    if data.feishu:
        if "appId" in data.feishu:
            set_config(db, "feishu.appId", data.feishu["appId"])
        if "appSecret" in data.feishu:
            set_config(db, "feishu.appSecret", data.feishu["appSecret"])
        if "verifyToken" in data.feishu:
            set_config(db, "feishu.verifyToken", data.feishu["verifyToken"])
        if "encryptKey" in data.feishu:
            set_config(db, "feishu.encryptKey", data.feishu["encryptKey"])
    
    if data.defaultWorkDir:
        set_config(db, "defaultWorkDir", data.defaultWorkDir)
    
    return get_config(db)
