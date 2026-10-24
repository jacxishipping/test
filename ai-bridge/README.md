# AI Bridge — Universal AI-to-Computer Control Platform

AI Bridge is a production-grade, security-hardened bridge connecting authorized AI assistants (Claude, Gemini, ChatGPT, Codex) to Linux servers and Windows workstations via the Model Context Protocol (MCP).

## Key Features
- **Strict Risk Tiers**: Tiers 1-4 with real-time approval queue for sensitive and destructive operations.
- **Workspace Sandboxing**: Absolute path rejection, directory traversal (`..`) blocking, and symlink escape verification.
- **Automatic Pre-Modification Backups**: Snapshot rollback archives generated automatically before any file edit or deletion.
- **Cross-Platform Agents**: Dedicated unprivileged Linux agent with systemd unit, and Windows Service daemon with separate interactive desktop helper.
- **Zero Arbitrary Shell Access**: No generic `bash -c` or arbitrary PowerShell command execution.
- **Multi-Client MCP Support**: One-click configuration for Claude Desktop, Claude Code, Gemini CLI, and ChatGPT.

## Quickstart

### 1. Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

### 2. Run MCP Server (Local Stdio)
```bash
python3 -m services.mcp_server.server --transport stdio
```

### 3. Run Control API
```bash
uvicorn apps.control_api.app:app --host 0.0.0.0 --port 8000
```

### 4. Run Test Suite
```bash
pytest tests/ -v
```
