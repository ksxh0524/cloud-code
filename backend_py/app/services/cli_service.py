"""CLI Service - manages PTY sessions for Claude/OpenCode"""
import asyncio
import fcntl
import logging
import os
import re
import signal
import time
import pexpect
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from app.config import settings

logger = logging.getLogger(__name__)

CLI_COMMANDS = {
    'claude': ['claude'],
    'opencode': ['opencode']
}


@dataclass
class Session:
    """CLI Session"""
    conversation_id: str
    work_dir: str
    cli_type: str
    process: Optional[pexpect.spawn] = None
    output_callback: Optional[Callable[[str], None]] = None
    _task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the CLI session"""
        command = CLI_COMMANDS.get(self.cli_type, ['claude'])
        
        # Create PTY process
        self.process = pexpect.spawn(
            command[0],
            args=command[1:] if len(command) > 1 else [],
            cwd=self.work_dir,
            encoding='utf-8',
            timeout=None,
        )
        
        # Set environment variables
        self.process.env = {**os.environ, 'TERM': 'xterm-256color', 'FORCE_COLOR': '1'}
        
        # Set initial terminal size
        self.process.setwinsize(40, 120)
        
        # Start reading output
        self._task = asyncio.create_task(self._read_output())
    
    async def _read_output(self):
        """Read output from PTY"""
        # Set non-blocking mode
        fd = self.process.child_fd
        fl = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        
        while self.process and self.process.isalive():
            try:
                # Try to read available data
                try:
                    data = os.read(fd, 4096)
                    if data:
                        output = data.decode('utf-8', errors='replace')
                        if output and self.output_callback:
                            # Call callback directly (it's already a coroutine)
                            if asyncio.iscoroutinefunction(self.output_callback):
                                await self.output_callback(output)
                            else:
                                self.output_callback(output)
                except (OSError, IOError):
                    # No data available
                    await asyncio.sleep(0.01)
            except Exception as e:
                logger.error(f"Error reading output: {e}")
                await asyncio.sleep(0.01)
    
    def send_input(self, data: str):
        """Send input to the CLI"""
        if self.process and self.process.isalive():
            # Filter terminal query sequences
            filtered = self._filter_terminal_queries(data)
            self.process.send(filtered)
    
    def resize(self, rows: int, cols: int):
        """Resize terminal"""
        if self.process:
            self.process.setwinsize(rows, cols)
    
    def stop(self):
        """Stop the session"""
        if self._task:
            self._task.cancel()
        
        if self.process:
            try:
                # Send Ctrl+D
                self.process.sendcontrol('d')
                time.sleep(0.3)

                if self.process.isalive():
                    # Terminate the process group to kill all child processes
                    try:
                        os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                        time.sleep(0.3)
                        
                        if self.process.isalive():
                            os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    except Exception:
                        # Fallback to normal termination
                        self.process.terminate()
                        time.sleep(0.3)
                        if self.process.isalive():
                            self.process.kill()
                            
            except Exception as e:
                logger.error(f"Error stopping: {e}")
    
    @staticmethod
    def _filter_terminal_queries(data: str) -> str:
        """Filter out terminal query sequences"""
        # Remove common xterm query sequences
        filtered = data
        # OSC color queries
        filtered = re.sub(r'\x1b\]4;\d+;\?(\x07|\x1b\\)', '', filtered)
        # DA2 queries
        filtered = re.sub(r'\x1b\[>\d+[^c]*c', '', filtered)
        # Mode queries
        filtered = re.sub(r'\x1b\[\?\d+[\$;\d]*[yp]', '', filtered)
        # Cursor position queries
        filtered = re.sub(r'\x1b\[6n', '', filtered)
        # Focus events
        filtered = re.sub(r'\x1b\[\?1004[hl]', '', filtered)
        # Focus in/out
        filtered = re.sub(r'\x1b\[[IO]', '', filtered)
        return filtered
    
    def is_running(self) -> bool:
        """Check if session is running"""
        return self.process is not None and self.process.isalive()


class CliService:
    """CLI Service - manages multiple PTY sessions"""
    
    def __init__(self):
        self._sessions: Dict[str, Session] = {}
    
    def get_supported_cli_types(self):
        """Get supported CLI types"""
        return [
            {'type': 'claude', 'name': 'Claude Code', 'description': 'Anthropic 官方 CLI 工具'},
            {'type': 'opencode', 'name': 'OpenCode', 'description': '开源 AI 编程助手'},
        ]
    
    async def check_cli_installed(self, cli_type: str) -> dict:
        """Check if CLI is installed"""
        command = CLI_COMMANDS.get(cli_type, ['claude'])
        try:
            # Check with --version
            result = await asyncio.create_subprocess_exec(
                command[0], '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            version = stdout.decode().strip() or stderr.decode().strip()
            return {'installed': True, 'version': version}
        except Exception as e:
            return {'installed': False, 'error': str(e)}
    
    async def start_session(
        self, 
        conversation_id: str, 
        work_dir: str, 
        cli_type: str,
        output_callback: Optional[Callable[[str], None]] = None
    ) -> bool:
        """Start a CLI session"""
        # Check if session exists and is running
        existing = self._sessions.get(conversation_id)
        if existing and existing.is_running():
            logger.info(f"Session {conversation_id} already running, reusing")
            if output_callback:
                existing.output_callback = output_callback
            return True
        
        # Stop existing if not running
        if existing:
            existing.stop()
            del self._sessions[conversation_id]
        
        logger.info(f"Starting session {conversation_id} in {work_dir}")

        # Create new session
        session = Session(
            conversation_id=conversation_id,
            work_dir=work_dir,
            cli_type=cli_type,
            output_callback=output_callback
        )
        
        await session.start()
        self._sessions[conversation_id] = session
        
        return True
    
    def send_input(self, conversation_id: str, data: str):
        """Send input to a session"""
        session = self._sessions.get(conversation_id)
        if session:
            session.send_input(data)
    
    def stop_session(self, conversation_id: str):
        """Stop a session"""
        session = self._sessions.get(conversation_id)
        if session:
            logger.info(f"Stopping session {conversation_id}")
            session.stop()
            del self._sessions[conversation_id]
    
    def resize_session(self, conversation_id: str, rows: int, cols: int):
        """Resize a session"""
        session = self._sessions.get(conversation_id)
        if session:
            session.resize(rows, cols)
    
    def has_session(self, conversation_id: str) -> bool:
        """Check if session exists"""
        session = self._sessions.get(conversation_id)
        return session is not None and session.is_running()


# Singleton instance
cli_service = CliService()
