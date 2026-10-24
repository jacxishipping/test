# Anthropic Claude & Claude Code Integration

AI Bridge integrates with Anthropic Claude Desktop and Claude Code via Model Context Protocol (MCP) stdio or streamable HTTP.

## Claude Desktop Setup

1. Locate your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the `ai-bridge` server configuration:
```json
{
  "mcpServers": {
    "ai-bridge": {
      "command": "/opt/ai-bridge/venv/bin/python",
      "args": [
        "-m",
        "services.mcp_server.server",
        "--transport",
        "stdio"
      ],
      "env": {
        "AI_BRIDGE_WORKSPACE": "/path/to/your/workspace"
      }
    }
  }
}
```

3. Restart Claude Desktop. The hammer icon in the prompt input will now list all 25+ AI Bridge tools.

## Claude Code CLI Setup

For Claude Code CLI:
```bash
claude mcp add ai-bridge /opt/ai-bridge/venv/bin/python -- -m services.mcp_server.server --transport stdio
```
