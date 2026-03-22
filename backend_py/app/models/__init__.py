"""Database models"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import uuid


class Conversation(Base):
    """Conversation model"""
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    workDir = Column(String, nullable=False)
    cliType = Column(String, default="claude")
    feishuChatId = Column(String, nullable=True)
    createdAt = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    updatedAt = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    
    # Relationship
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    terminal_history = relationship("TerminalHistory", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message model"""
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversationId = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    toolCalls = Column(Text, nullable=True)  # JSON serialized
    status = Column(String, nullable=False)  # 'pending', 'streaming', 'completed', 'error'
    createdAt = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    
    # Relationship
    conversation = relationship("Conversation", back_populates="messages")


class TerminalHistory(Base):
    """Terminal output history model"""
    __tablename__ = "terminal_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversationId = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)  # 原始终端输出（包含 ANSI 转义码）
    createdAt = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    # Relationship
    conversation = relationship("Conversation", back_populates="terminal_history")


class Config(Base):
    """Configuration model"""
    __tablename__ = "config"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
