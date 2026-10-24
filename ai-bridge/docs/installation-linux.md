# AI Bridge — Linux Installation Guide

Tested on Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, and Debian 12.

## 1. System Prerequisites
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip git curl
```

## 2. Create Service User & Directories
```bash
# Create dedicated unprivileged system user
sudo useradd -r -s /usr/sbin/nologin -d /opt/ai-bridge aibridge

# Create application and workspace directories
sudo mkdir -p /opt/ai-bridge /opt/ai-bridge/workspace /etc/ai-bridge /var/log/ai-bridge
sudo chown -R aibridge:aibridge /opt/ai-bridge /etc/ai-bridge /var/log/ai-bridge
```

## 3. Clone Repository & Setup Virtual Environment
```bash
cd /opt/ai-bridge
sudo -u aibridge python3 -m venv venv
sudo -u aibridge /opt/ai-bridge/venv/bin/pip install --upgrade pip setuptools wheel
sudo -u aibridge /opt/ai-bridge/venv/bin/pip install -e .
```

## 4. Configure Environment
Create `/etc/ai-bridge/agent.env`:
```ini
AI_BRIDGE_SERVER_URL=https://control.example.com
AI_BRIDGE_WORKSPACE=/opt/ai-bridge/workspace
AI_BRIDGE_DEVICE_ID=dev-prod-linux-01
AI_BRIDGE_AUTH_TOKEN=your_enrolled_device_token_here
```
Secure permissions:
```bash
sudo chmod 600 /etc/ai-bridge/agent.env
sudo chown aibridge:aibridge /etc/ai-bridge/agent.env
```

## 5. Enable & Start Systemd Service
```bash
sudo cp deployment/systemd/ai-bridge-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ai-bridge-agent.service
```

## 6. Verify Service Health
```bash
sudo systemctl status ai-bridge-agent.service
journalctl -u ai-bridge-agent.service -f
```
