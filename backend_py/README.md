"""Cloud Code Python Backend

FastAPI + SQLAlchemy + pexpect

## Setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate  # macOS/Linux
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

## Running

```bash
# Development mode (with hot reload)
uvicorn app.main:app --host 0.0.0.0 --port 18765 --reload

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 18765
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:18765/docs
- ReDoc: http://localhost:18765/redoc

## Architecture

- **app/main.py**: FastAPI application entry point
- **app/routers/**: API route handlers
- **app/services/**: Business logic (CLI, WebSocket, CRUD)
- **app/models/**: SQLAlchemy database models
- **app/database.py**: Database configuration
- **app/config.py**: Application settings
