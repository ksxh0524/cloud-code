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
    _stop_task: Optional[asyncio.Task] = None  # 延迟终止任务
    
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
    
    def _filter_output(self, data: str) -> str:
        """Filter output for display - removes control characters, colors, lines"""
        import re
        
        # Remove ANSI escape sequences - ORDER MATTERS!
        filtered = data
        
        # 1. First remove complex patterns (RGB colors) before simple ones
        filtered = re.sub(r'\x1b\[38;2;\d+;\d+;\d+m', '', filtered)  # RGB foreground colors
        filtered = re.sub(r'\x1b\[48;2;\d+;\d+;\d+m', '', filtered)  # RGB background colors
        
        # 2. Remove cursor movements and positioning (complex patterns)
        filtered = re.sub(r'\x1b\[\d+;\d+[A-Za-z]', '', filtered)  # Complex movement
        filtered = re.sub(r'\x1b\[\?\d+;\d+[hl]', '', filtered)  # Complex mode set/reset
        
        # 3. Remove simple patterns
        filtered = re.sub(r'\x1b\[\d+[A-Za-z]', '', filtered)  # Cursor movement
        filtered = re.sub(r'\x1b\[\d+[JK]', '', filtered)  # Clear screen/line
        filtered = re.sub(r'\x1b\[\?\d+[hl]', '', filtered)  # Mode set/reset
        filtered = re.sub(r'\x1b\[\d+m', '', filtered)  # Simple colors
        filtered = re.sub(r'\x1b\[m', '', filtered)  # Reset
        filtered = re.sub(r'\x1b\[\d+n', '', filtered)  # Device status
        filtered = re.sub(r'\x1b\[\?\d+[cyp]', '', filtered)  # Device attributes
        filtered = re.sub(r'\x1b\[\d*q', '', filtered)  # SGR
        
        # 4. Remove OSC sequences (title, colors)
        filtered = re.sub(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\\\)', '', filtered)
        
        # 5. Remove charset sequences
        filtered = re.sub(r'\x1b[()][A-Za-z0-9]', '', filtered)
        
        # 6. Remove Braille characters (loading animation)
        filtered = re.sub(r'[\u2800-\u28FF]', '', filtered)
        
        # 7. Remove box drawing characters (lines)
        filtered = re.sub(r'[─━│┃┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋╌╍╎╏═║]', '', filtered)
        
        # 8. Remove other special characters
        filtered = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', filtered)
        
        return filtered
    
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
    
    @staticmethod
    def _filter_braille_chars(data: str) -> str:
        """Filter out Braille characters (used by Claude Code for loading animation)"""
        # Braille patterns: U+2800 to U+28FF
        # Replace with empty string or simple dot
        import re
        filtered = re.sub(r'[\u2800-\u28FF]', '', data)
        return filtered
    
    def is_running(self) -> bool:
        """Check if session is running"""
        return self.process is not None and self.process.isalive()


class CliService:
    """CLI Service - manages multiple PTY sessions"""

    # 延迟终止时间（秒）
    STOP_DELAY_SECONDS = 300  # 5 分钟

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
        """Stop a session immediately"""
        session = self._sessions.get(conversation_id)
        if session:
            # 取消延迟终止任务
            if session._stop_task:
                session._stop_task.cancel()
                session._stop_task = None

            logger.info(f"Stopping session {conversation_id}")
            session.stop()
            del self._sessions[conversation_id]

    def stop_session_delayed(self, conversation_id: str):
        """Stop a session after delay (5 minutes)"""
        session = self._sessions.get(conversation_id)
        if not session:
            return

        # 取消之前的延迟任务
        if session._stop_task:
            session._stop_task.cancel()

        async def delayed_stop():
            try:
                logger.info(f"Scheduling stop for session {conversation_id} in {self.STOP_DELAY_SECONDS}s")
                await asyncio.sleep(self.STOP_DELAY_SECONDS)

                # 检查是否还有 WebSocket 客户端
                from app.services.ws_manager import ws_manager
                if not ws_manager.has_clients(conversation_id):
                    logger.info(f"Delayed stop: terminating session {conversation_id}")
                    self.stop_session(conversation_id)
                else:
                    logger.info(f"Delayed stop cancelled: session {conversation_id} has clients")
            except asyncio.CancelledError:
                logger.info(f"Delayed stop cancelled for session {conversation_id}")

        session._stop_task = asyncio.create_task(delayed_stop())

    def cancel_delayed_stop(self, conversation_id: str):
        """Cancel delayed stop for a session"""
        session = self._sessions.get(conversation_id)
        if session and session._stop_task:
            session._stop_task.cancel()
            session._stop_task = None
            logger.info(f"Cancelled delayed stop for session {conversation_id}")
    
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
