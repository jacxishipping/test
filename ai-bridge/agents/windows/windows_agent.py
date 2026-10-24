"""AI Bridge — Windows Service Agent (Non-interactive Background Daemon)."""

import argparse
import logging
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from agents.common.client import AgentClient
from policy_engine.policy import PolicyEngine
from audit.logger import AuditLogger

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_bridge.windows_agent")


class WindowsAgent:
    def __init__(self, server_url: str, workspace_root: Path, device_id: str = "", auth_token: str = ""):
        self.server_url = server_url
        self.workspace_root = workspace_root
        self.policy_engine = PolicyEngine(workspace_root=self.workspace_root)
        self.audit_logger = AuditLogger(log_path=self.workspace_root / ".ai-bridge" / "audit.log")
        self.client = AgentClient(server_url=server_url, device_id=device_id, auth_token=auth_token)
        self._running = True

    def query_cim_memory(self) -> dict:
        """Safe CIM query for physical memory without arbitrary script execution."""
        try:
            cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", 
                   "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            free_kb = int(proc.stdout.strip()) if proc.stdout.strip().isdigit() else 8388608
            return {"free_mb": round(free_kb / 1024, 1)}
        except Exception:
            return {"free_mb": 8192.0}

    def start(self):
        logger.info("Starting Windows Agent on %s (workspace: %s)", platform.node(), self.workspace_root)
        while self._running:
            try:
                if self.client.device_id and self.client.auth_token:
                    self.client.send_heartbeat()
                    logger.debug("Windows heartbeat sent.")
            except Exception as e:
                logger.warning("Heartbeat failed: %s. Retrying in 15s...", str(e))
            time.sleep(15)

    def stop(self):
        logger.info("Stopping Windows Agent...")
        self._running = False


def main():
    parser = argparse.ArgumentParser(description="AI Bridge Windows Agent")
    parser.add_argument("--server", required=True, help="Control API endpoint")
    parser.add_argument("--workspace", default="C:\\Workspace\\ai-bridge", help="Workspace directory")
    parser.add_argument("--device-id", default="", help="Enrolled Device ID")
    parser.add_argument("--token", default="", help="Agent auth token")
    args = parser.parse_args()

    agent = WindowsAgent(
        server_url=args.server,
        workspace_root=Path(args.workspace),
        device_id=args.device_id,
        auth_token=args.token,
    )
    agent.start()


if __name__ == "__main__":
    main()
