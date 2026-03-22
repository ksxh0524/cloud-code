"""Web API Routes"""
import os
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models import Conversation
from app.services.conversation_service import (
    create_conversation, get_conversation,
    list_conversations, update_conversation, delete_conversation
)
from app.services.config_service import get_config, set_config
from app.services import cli_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic schemas with validation
class ConversationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="Conversation name")
    workDir: str = Field(min_length=1, description="Working directory path")
    cliType: str = Field(default="claude", pattern="^(claude|opencode)$", description="CLI type")


class ConversationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class ConfigUpdate(BaseModel):
    feishu: Optional[dict] = None
    defaultWorkDir: Optional[str] = None


# Helper functions
def conversation_to_dict(c: Conversation) -> dict:
    """Convert conversation model to dictionary"""
    return {
        "id": c.id,
        "name": c.name,
        "workDir": c.workDir,
        "cliType": c.cliType,
        "feishuChatId": c.feishuChatId,
        "createdAt": c.createdAt,
        "updatedAt": c.updatedAt
    }


def validate_path(user_path: str) -> Path:
    """Validate that path is within allowed directories"""
    try:
        resolved = Path(user_path).resolve()
        # Allow access to any existing directory (local deployment only)
        if not resolved.exists():
            raise HTTPException(status_code=400, detail=f"Path does not exist: {user_path}")
        if not resolved.is_dir():
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {user_path}")
        return resolved
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        logger.error(f"Path validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid path: {user_path}")


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
    return [conversation_to_dict(c) for c in conversations]


@router.post("/conversations", status_code=201)
async def create_new_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db)
):
    """Create a new conversation"""
    # Validate work directory exists
    try:
        validate_path(data.workDir)
    except HTTPException:
        raise HTTPException(status_code=400, detail=f"Invalid work directory: {data.workDir}")

    conversation = create_conversation(
        db, data.name, data.workDir, data.cliType
    )

    logger.info(f"Created conversation: {conversation.id} in {data.workDir}")

    return conversation_to_dict(conversation)


@router.get("/conversations/{conversation_id}")
async def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get conversation by ID"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation_to_dict(conversation)


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

    logger.info(f"Updated conversation: {conversation_id}")
    return conversation_to_dict(conversation)


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
    logger.info(f"Deleted conversation: {conversation_id}")

    return {"success": True}


@router.get("/workdirs")
async def get_workdirs(db: Session = Depends(get_db)):
    """Get work directories from config"""
    config = get_config(db)
    work_dir = config.get("defaultWorkDir", str(settings.default_work_dir))

    # Get subdirectories
    subdirs = []
    try:
        if os.path.exists(work_dir):
            entries = os.listdir(work_dir)
            subdirs = sorted([
                name for name in entries
                if os.path.isdir(os.path.join(work_dir, name))
                and not name.startswith(".")
            ])
    except PermissionError:
        logger.warning(f"Permission denied accessing work directory: {work_dir}")
    except OSError as e:
        logger.error(f"Error reading work directory {work_dir}: {e}")

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
async def get_directories(path: str = Query(..., min_length=1)):
    """Get subdirectories of a path"""
    try:
        validated_path = validate_path(path)
        entries = os.listdir(validated_path)
        return sorted([
            name for name in entries
            if os.path.isdir(os.path.join(validated_path, name))
            and not name.startswith(".")
        ])
    except PermissionError:
        logger.warning(f"Permission denied accessing path: {path}")
        raise HTTPException(status_code=403, detail="Permission denied")
    except OSError as e:
        logger.error(f"OS error accessing path {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to read directory")


@router.get("/config")
async def get_app_config(db: Session = Depends(get_db)):
    """Get app configuration"""
    return get_config(db)


@router.get("/sessions")
async def get_active_sessions():
    """Get active CLI sessions"""
    from app.services.cli_service import cli_service
    sessions = []
    for conv_id, session in cli_service._sessions.items():
        sessions.append({
            "conversationId": conv_id,
            "cliType": session.cli_type,
            "workDir": session.work_dir,
            "running": session.is_running()
        })
    return sessions


@router.delete("/sessions")
async def stop_all_sessions():
    """Stop all CLI sessions"""
    from app.services.cli_service import cli_service
    stopped = []
    for conv_id in list(cli_service._sessions.keys()):
        cli_service.stop_session(conv_id)
        stopped.append(conv_id)
    logger.info(f"Stopped {len(stopped)} CLI sessions")
    return {"stopped": len(stopped), "sessions": stopped}


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
        logger.info("Updated Feishu configuration")

    if data.defaultWorkDir:
        # Validate the path before saving
        try:
            validate_path(data.defaultWorkDir)
            set_config(db, "defaultWorkDir", data.defaultWorkDir)
            logger.info(f"Updated default work directory: {data.defaultWorkDir}")
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=str(e.detail))

    return get_config(db)
