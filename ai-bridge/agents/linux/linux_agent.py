"""AI Bridge — Dedicated Linux System Agent."""

import argparse
import logging
import os
import signal
import sys
import time
from pathlib import Path
from agents.common.client import AgentClient
from policy_engine.policy import PolicyEngine
from audit.logger import AuditLogger

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_bridge.linux_agent")


class LinuxAgent:
    def __init__(self, server_url: str, workspace_root: Path, device_id: str = "", auth_token: str = ""):
        self.server_url = server_url
        self.workspace_root = workspace_root
        self.policy_engine = PolicyEngine(workspace_root=self.workspace_root)
        self.audit_logger = AuditLogger(log_path=self.workspace_root / ".ai-bridge" / "audit.log")
        self.client = AgentClient(server_url=server_url, device_id=device_id, auth_token=auth_token)
        self._running = True

    def start(self):
        logger.info("Starting Linux Agent on %s (workspace: %s)", os.uname().nodename, self.workspace_root)
        while self._running:
            try:
                if self.client.device_id and self.client.auth_token:
                    self.client.send_heartbeat()
                    logger.debug("Heartbeat transmitted successfully.")
            except Exception as e:
                logger.warning("Heartbeat failed: %s. Retrying in 10s...", str(e))
            time.sleep(15)

    def stop(self, *args):
        logger.info("Shutting down Linux Agent gracefully...")
        self._running = False
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="AI Bridge Linux Agent")
    parser.add_argument("--server", required=True, help="Control API endpoint URL")
    parser.add_argument("--workspace", default="/opt/ai-bridge/workspace", help="Workspace path")
    parser.add_argument("--device-id", default="", help="Enrolled Device ID")
    parser.add_argument("--token", default="", help="Agent auth token")
    args = parser.parse_args()

    agent = LinuxAgent(
        server_url=args.server,
        workspace_root=Path(args.workspace),
        device_id=args.device_id,
        auth_token=args.token,
    )
    signal.signal(signal.SIGINT, agent.stop)
    signal.signal(signal.SIGTERM, agent.stop)
    agent.start()


if __name__ == "__main__":
    main()
