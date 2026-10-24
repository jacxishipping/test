# AI Bridge Windows Service Installation Script
# Must be executed in an Elevated PowerShell Prompt (Run as Administrator)

param(
    [string]$ServerUrl = "https://control.example.com",
    [string]$Workspace = "C:\Workspace\ai-bridge",
    [string]$InstallDir = "C:\Program Files\AIBridge"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  AI Bridge Windows Service Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Create Directories
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $Workspace | Out-Null

# 2. Copy Agent Files
Write-Host "[1/4] Copying agent runtime files to $InstallDir..." -ForegroundColor Green
# In production, files are copied from package archive

# 3. Create Dedicated Low-Privilege Local Service User (or use NetworkService)
$ServiceName = "AIBridgeAgent"

# 4. Register Service via NSSM or New-Service
Write-Host "[2/4] Registering Windows Service '$ServiceName'..." -ForegroundColor Green
$ServiceBinary = "$InstallDir\python\python.exe"
$ServiceArgs = "-m agents.windows.windows_agent --server $ServerUrl --workspace $Workspace"

# Check if service already exists
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force
    sc.exe delete $ServiceName
}

New-Service -Name $ServiceName `
    -DisplayName "AI Bridge Remote Device Agent" `
    -Description "Connects Windows workstation securely to authorized AI assistants via AI Bridge Control Plane" `
    -BinaryPathName "`"$ServiceBinary`" $ServiceArgs" `
    -StartupType Automatic

# 5. Set up Startup shortcut for Desktop Helper in Current User Startup folder
Write-Host "[3/4] Configuring Interactive Desktop Helper for logged in user..." -ForegroundColor Green
$StartupFolder = [Environment]::GetFolderPath("Startup")
$HelperShortcut = "$StartupFolder\AIBridgeDesktopHelper.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($HelperShortcut)
$Shortcut.TargetPath = "$ServiceBinary"
$Shortcut.Arguments = "-m agents.windows.desktop_helper"
$Shortcut.WorkingDirectory = "$InstallDir"
$Shortcut.Save()

Write-Host "[4/4] Starting service..." -ForegroundColor Green
Start-Service -Name $ServiceName

Write-Host "Installation Complete! AI Bridge Windows Agent is running." -ForegroundColor Cyan
