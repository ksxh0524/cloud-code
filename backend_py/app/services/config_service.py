"""Config CRUD operations"""
import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models import Config as ConfigModel


DEFAULT_CONFIG = {
    "feishu": {
        "appId": "",
        "appSecret": "",
        "verifyToken": "",
        "encryptKey": ""
    },
    "defaultWorkDir": "."
}


def get_config(db: Session) -> dict:
    """Get full configuration"""
    config = dict(DEFAULT_CONFIG)
    
    rows = db.query(ConfigModel).all()
    for row in rows:
        keys = row.key.split('.')
        current = config
        for key in keys[:-1]:
            current = current.setdefault(key, {})
        
        try:
            current[keys[-1]] = json.loads(row.value)
        except json.JSONDecodeError:
            current[keys[-1]] = row.value
    
    return config


def set_config(db: Session, key: str, value: Any):
    """Set config value"""
    value_str = value if isinstance(value, str) else json.dumps(value)
    
    existing = db.query(ConfigModel).filter(ConfigModel.key == key).first()
    if existing:
        existing.value = value_str
    else:
        new_config = ConfigModel(key=key, value=value_str)
        db.add(new_config)
    
    db.commit()


def get_config_value(db: Session, key: str) -> Optional[str]:
    """Get single config value"""
    row = db.query(ConfigModel).filter(ConfigModel.key == key).first()
    return row.value if row else None
