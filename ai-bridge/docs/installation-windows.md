# AI Bridge — Windows Installation Guide

Tested on Windows Server 2022 and Windows 11 Pro (22H2 / 23H2).

## 1. Prerequisites
- Python 3.11+ installed (select "Add python.exe to PATH" during installation)
- PowerShell 5.1 or PowerShell 7+
- Administrator privileges for service installation

## 2. Directory Setup
In an elevated PowerShell window:
```powershell
New-Item -ItemType Directory -Force -Path "C:\Program Files\AIBridge"
New-Item -ItemType Directory -Force -Path "C:\Workspace\ai-bridge"
```

## 3. Virtual Environment Installation
```powershell
cd "C:\Program Files\AIBridge"
python -m venv venv
.\venv\Scripts\pip.exe install --upgrade pip
.\venv\Scripts\pip.exe install -e .
```

## 4. Register Windows Service
Run the automated installation script:
```powershell
.\agents\windows\install-service.ps1 -ServerUrl "https://control.example.com" -Workspace "C:\Workspace\ai-bridge"
```

## 5. Desktop Automation Setup (Optional)
If desktop GUI actions and screenshots are required:
1. Ensure the user is logged into an active Windows desktop session.
2. The installation script automatically places a shortcut to `desktop_helper.py` in the Startup folder:
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
3. Launch manually to verify:
   ```powershell
   .\venv\Scripts\python.exe -m agents.windows.desktop_helper
   ```
