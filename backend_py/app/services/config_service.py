"""Config CRUD operations"""
import json
from functools import lru_cache
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

# Config cache (expires after 60 seconds)
_config_cache: dict = {}
_cache_version: int = 0


def _invalidate_cache():
    """Invalidate the config cache"""
    global _config_cache, _cache_version
    _config_cache = {}
    _cache_version += 1


@lru_cache(maxsize=1)
def get_config(db: Session) -> dict:
    """Get full configuration (cached)"""
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
    """Set config value and invalidate cache"""
    value_str = value if isinstance(value, str) else json.dumps(value)


    existing = db.query(ConfigModel).filter(ConfigModel.key == key).first()
    if existing:
        existing.value = value_str
    else:
        new_config = ConfigModel(key=key, value=value_str)
        db.add(new_config)

    db.commit()

    # Invalidate cache when config changes
    get_config.cache_clear()


def get_config_value(db: Session, key: str) -> Optional[str]:
    """Get single config value"""
    row = db.query(ConfigModel).filter(ConfigModel.key == key).first()
    return row.value if row else None
