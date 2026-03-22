"""Conversation CRUD operations"""
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import Conversation
from datetime import datetime
import uuid


def create_conversation(
    db: Session, 
    name: str, 
    work_dir: str, 
    cli_type: str = "claude"
) -> Conversation:
    """Create a new conversation"""
    now = datetime.now().isoformat()
    conversation = Conversation(
        id=str(uuid.uuid4()),
        name=name,
        workDir=work_dir,
        cliType=cli_type,
        createdAt=now,
        updatedAt=now
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_conversation(db: Session, conversation_id: str) -> Optional[Conversation]:
    """Get conversation by ID"""
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def list_conversations(db: Session) -> List[Conversation]:
    """List all conversations ordered by updatedAt DESC"""
    return db.query(Conversation).order_by(Conversation.updatedAt.desc()).all()


def update_conversation(
    db: Session, 
    conversation_id: str, 
    updates: dict
) -> Optional[Conversation]:
    """Update conversation"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        return None
    
    if 'name' in updates:
        conversation.name = updates['name']
    if 'feishuChatId' in updates:
        conversation.feishuChatId = updates['feishuChatId']
    
    conversation.updatedAt = datetime.now().isoformat()
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, conversation_id: str) -> bool:
    """Delete conversation"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        return False
    
    db.delete(conversation)
    db.commit()
    return True
