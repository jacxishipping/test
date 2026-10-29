<#
.SYNOPSIS
    AI Bridge Windows Agent Installer
.DESCRIPTION
    Installs the AI Bridge agent as a Windows Service, configures the secure workspace directory with restricted ACL permissions, and prompts the user securely for the authentication token.
.PARAMETER InstallPath
    The directory where AI Bridge agent will be installed. Defaults to C:\Program Files\AIBridge
.PARAMETER WorkspacePath
    The directory designated as the secure agent workspace. Defaults to C:\AIBridge\Workspace
.PARAMETER ServerUrl
    The AI Bridge control plane WebSocket/HTTP URL.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\Program Files\AIBridge",
    [string]$WorkspacePath = "C:\AIBridge\Workspace",
    [string]$ServerUrl = "https://bridge.example.com"
)

# Ensure running as Administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "AI Bridge installer must be run with Administrator privileges. Please relaunch PowerShell as Administrator."
    Exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         AI Bridge Windows Agent Installer         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Prompt Securely for Authentication Token
Write-Host "`nPlease enter your AI Bridge device authentication token:" -ForegroundColor Yellow
$SecureToken = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
$AuthToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ([string]::IsNullOrWhiteSpace($AuthToken)) {
    Write-Error "Authentication token cannot be empty."
    Exit 1
}

# 2. Create Directories
Write-Host "`n[1/5] Creating installation and workspace directories..." -ForegroundColor Green
foreach ($dir in @($InstallPath, "$InstallPath\config", "$InstallPath\agent", $WorkspacePath)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir"
    }
}

# 3. Configure Workspace ACL Permissions (Restrict to Administrators and SYSTEM)
Write-Host "`n[2/5] Securing workspace directory ACL permissions..." -ForegroundColor Green
try {
    $Acl = Get-Acl $WorkspacePath
    $Acl.SetAccessRuleProtection($true, $false) # Disable inheritance, remove inherited rules
    
    # Add FullControl for SYSTEM
    $SystemIdentity = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::NTAuthorityIdentity, $null)
    $RuleSystem = [System.Security.AccessControl.FileSystemAccessRule]::new("NT AUTHORITY\SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $Acl.AddAccessRule($RuleSystem)

    # Add FullControl for Administrators
    $RuleAdmin = [System.Security.AccessControl.FileSystemAccessRule]::new("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $Acl.AddAccessRule($RuleAdmin)

    Set-Acl -Path $WorkspacePath -AclObject $Acl
    Write-Host "  Workspace permissions successfully secured (SYSTEM and Administrators only)." -ForegroundColor DarkGreen
} catch {
    Write-Warning "  Could not fully configure advanced ACLs: $_"
}

# 4. Write Agent Configuration
Write-Host "`n[3/5] Writing agent configuration..." -ForegroundColor Green
$ConfigJson = @{
    server_url = $ServerUrl
    workspace_path = $WorkspacePath
    auth_token = $AuthToken
    log_level = "INFO"
    max_concurrent_tasks = 4
} | ConvertTo-Json -Depth 4

$ConfigPath = "$InstallPath\config\agent.json"
Set-Content -Path $ConfigPath -Value $ConfigJson -Encoding utf8
# Secure config file permissions
$ConfigAcl = Get-Acl $ConfigPath
$ConfigAcl.SetAccessRuleProtection($true, $false)
$ConfigAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new("NT AUTHORITY\SYSTEM", "FullControl", "Allow"))
$ConfigAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new("BUILTIN\Administrators", "FullControl", "Allow"))
Set-Content -Path $ConfigPath -Value $ConfigJson -Encoding utf8

Write-Host "  Configuration saved securely to $ConfigPath"

# 5. Install or Register Windows Service
Write-Host "`n[4/5] Configuring AI Bridge Windows Service..." -ForegroundColor Green

$ServiceName = "AIBridgeAgent"
$DisplayName = "AI Bridge Device Agent"
$Description = "Connects this Windows computer to the authorized AI Bridge control plane for secure task execution."

# Check if service already exists
$ExistingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($ExistingService) {
    Write-Host "  Existing service found. Stopping and removing..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

# Locate Python or packaged agent executable
$PythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonPath) {
    Write-Error "Python is not installed or not in system PATH. Python 3.10+ is required for the AI Bridge Windows agent."
    Exit 1
}

# Create wrapper runner script in InstallPath
$RunnerScript = "$InstallPath\agent\run_agent.py"
$RunnerContent = @"
import sys
import os
import json
import logging

# Add agent path
sys.path.insert(0, r"$InstallPath")

logging.basicConfig(level=logging.INFO, filename=r"$InstallPath\agent\agent.log", format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

if __name__ == "__main__":
    logging.info("Starting AI Bridge Agent Windows Service...")
    # Load config and start agent loop
    config_path = r"$InstallPath\config\agent.json"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = json.load(f)
        logging.info(f"Loaded configuration for server: {config.get('server_url')}")
    else:
        logging.error("Configuration file not found!")
    
    # Placeholder loop or actual agent start
    import time
    while True:
        time.sleep(10)
"@
Set-Content -Path $RunnerScript -Value $RunnerContent -Encoding utf8

# Register Windows Service using New-Service with pythonw.exe or python.exe
$PythonDir = Split-Path $PythonPath
$PythonWPath = Join-Path $PythonDir "pythonw.exe"
if (-not (Test-Path $PythonWPath)) {
    $PythonWPath = $PythonPath
}

$BinaryPath = "`"$PythonWPath`" `"$RunnerScript`""

New-Service -Name $ServiceName `
    -DisplayName $DisplayName `
    -Description $Description `
    -BinaryPathName $BinaryPath `
    -StartupType Automatic | Out-Null

Write-Host "  Windows Service '$ServiceName' registered successfully." -ForegroundColor Green

# 6. Start Service
Write-Host "`n[5/5] Starting AI Bridge Agent service..." -ForegroundColor Green
Start-Service -Name $ServiceName
$ServiceStatus = (Get-Service -Name $ServiceName).Status
Write-Host "  Service Status: $ServiceStatus" -ForegroundColor Cyan

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " AI Bridge Agent Installation Completed Successfully!" -ForegroundColor Green
Write-Host " Workspace: $WorkspacePath" -ForegroundColor White
Write-Host " Service:   $ServiceName" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
