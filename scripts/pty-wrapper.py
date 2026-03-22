#!/usr/bin/env python3
"""
PTY wrapper for starting claude/opencode in a pseudo-terminal
Supports dynamic terminal size changes via stdin commands
"""
import pty
import os
import sys
import subprocess
import select
import termios
import struct
import fcntl
import json
import re

# Supported CLI tools
CLI_COMMANDS = {
    'claude': ['claude'],
    'opencode': ['opencode']
}

def set_winsize(fd, rows=24, cols=80):
    """Set terminal window size"""
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception as e:
        print(f"Failed to set window size: {e}", file=sys.stderr)

class PTYSession:
    def __init__(self, workdir, cli_type='claude'):
        self.workdir = workdir
        self.cli_type = cli_type
        self.master_fd = None
        self.slave_fd = None
        self.proc = None

    def start(self):
        """Start the PTY session"""
        # Create pseudo-terminal
        self.master_fd, self.slave_fd = pty.openpty()

        # Set initial window size
        set_winsize(self.master_fd, rows=40, cols=120)

        # Get command for CLI type
        command = CLI_COMMANDS.get(self.cli_type, ['claude'])

        # Start the process
        self.proc = subprocess.Popen(
            command,
            cwd=self.workdir,
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            close_fds=True,
            env=dict(os.environ, TERM='xterm-256color')
        )

        # Close slave fd in parent
        os.close(self.slave_fd)
        self.slave_fd = None

        # Set non-blocking
        os.set_blocking(self.master_fd, False)

        print(json.dumps({"type": "ready", "pid": self.proc.pid, "cli": self.cli_type}), file=sys.stderr)
        sys.stderr.flush()

    def _filter_terminal_queries(self, data):
        """Filter out terminal query sequences that can confuse CLI tools"""
        try:
            text = data.decode('utf-8', errors='ignore')
        except:
            return data
        
        # Remove common xterm query sequences
        filtered = text
        
        # Remove OSC color queries: ESC ] 4 ; 0 ; ? BEL/ST
        filtered = re.sub(r'\x1b\]4;\d+;\?(\x07|\x1b\\)', '', filtered)
        # Remove DA2 queries: ESC [ > 0 ; ... c
        filtered = re.sub(r'\x1b\[>\d+[^c]*c', '', filtered)
        # Remove mode queries: ESC [ ? ... $ y
        filtered = re.sub(r'\x1b\[\?\d+[\$;\d]*[yp]', '', filtered)
        # Remove cursor position queries: ESC [ 6 n
        filtered = re.sub(r'\x1b\[6n', '', filtered)
        # Remove focus events: ESC [ ? 1004 h/l
        filtered = re.sub(r'\x1b\[\?1004[hl]', '', filtered)
        # Remove focus in/out: ESC [ I/O
        filtered = re.sub(r'\x1b\[[IO]', '', filtered)
        
        return filtered.encode('utf-8') if filtered else b''

    def process_command(self, cmd_dict):
        """Process a command received from stdin"""
        try:
            if cmd_dict.get("type") == "resize":
                cols = cmd_dict.get("cols", 80)
                rows = cmd_dict.get("rows", 24)
                set_winsize(self.master_fd, rows, cols)
                print(f"[Resized to {cols}x{rows}]", file=sys.stderr)
        except Exception as e:
            print(f"Failed to process command: {e}", file=sys.stderr)

    def run(self):
        """Main event loop"""
        try:
            while True:
                # Check if process is still running
                if self.proc.poll() is not None:
                    break

                # Use select to wait for data
                rlist, _, _ = select.select([self.master_fd, sys.stdin.fileno()], [], [], 0.1)

                for fd in rlist:
                    if fd == self.master_fd:
                        # Data from PTY to stdout
                        try:
                            data = os.read(self.master_fd, 4096)
                            if data:
                                os.write(sys.stdout.fileno(), data)
                        except OSError:
                            pass
                    elif fd == sys.stdin.fileno():
                        # Data from stdin to PTY
                        data = os.read(sys.stdin.fileno(), 8192)
                        if data:
                            try:
                                data_str = data.decode('utf-8', errors='ignore')
                                # Check for JSON resize command
                                if data_str.strip().startswith('{') and '"type": "resize"' in data_str:
                                    cmd = json.loads(data_str.strip())
                                    self.process_command(cmd)
                                else:
                                    # Filter out xterm query sequences
                                    filtered_data = self._filter_terminal_queries(data)
                                    if filtered_data:
                                        os.write(self.master_fd, filtered_data)
                            except:
                                # Filter and send
                                filtered_data = self._filter_terminal_queries(data)
                                if filtered_data:
                                    os.write(self.master_fd, filtered_data)

        except KeyboardInterrupt:
            pass
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        if self.master_fd is not None:
            os.close(self.master_fd)
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()

def main():
    workdir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    cli_type = sys.argv[2] if len(sys.argv) > 2 else 'claude'

    session = PTYSession(workdir, cli_type)
    session.start()
    session.run()

    sys.exit(session.proc.returncode or 0)

if __name__ == '__main__':
    main()
