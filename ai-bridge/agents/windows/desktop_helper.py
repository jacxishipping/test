"""AI Bridge — Windows Interactive Desktop Automation Helper.

IMPORTANT ARCHITECTURAL NOTE:
Windows services run in Session 0 (non-interactive) and cannot capture screenshots
or interact with user windows. This helper is designed to run inside the logged-in user's
interactive session (Session 1+) and communicates with the Windows service or control plane
over a local loopback named pipe or port.
"""

import argparse
import base64
import logging
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai_bridge.desktop_helper")


class WindowsDesktopHelper:
    def __init__(self, port: int = 59100):
        self.port = port
        self.approved_apps = ["notepad", "calc", "code", "terminal", "msedge"]

    def capture_screen(self) -> str:
        """Capture active desktop monitor (placeholder for win32gui/Pillow in Windows)."""
        logger.info("Desktop screenshot requested in user session.")
        # Minimal valid 1x1 transparent PNG in base64
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    def launch_app(self, app_name: str) -> bool:
        if app_name.lower() not in self.approved_apps:
            logger.warning("Rejected unapproved app launch: %s", app_name)
            return False
        logger.info("Launching approved app: %s", app_name)
        return True

    def run(self):
        logger.info("Windows Desktop Helper active in interactive session.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Desktop helper terminated.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Windows Desktop Automation Helper")
    parser.add_argument("--port", type=int, default=59100)
    args = parser.parse_args()
    helper = WindowsDesktopHelper(port=args.port)
    helper.run()
