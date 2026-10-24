# AI Bridge — MCP Clients Configuration Guide

This guide details connection parameters for major AI assistant ecosystems.

## Summary Matrix

| AI Assistant / Client | Supported Transport | Security Model | Setup Complexity |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude Desktop** | `stdio` | Local process, direct stdio pipes | 1 file edit (`claude_desktop_config.json`) |
| **Claude Code (CLI)** | `stdio` | Local execution sandboxed to project | 1 CLI command (`claude mcp add`) |
| **Google Gemini CLI / SDK** | `stdio` / Direct JSON-RPC | Tool declaration via `@google/genai` | Environment config |
| **OpenAI ChatGPT Plus/Team** | Streamable HTTP / SSE | Bearer Token over TLS | Custom Action in GPT Builder |
| **Generic MCP Clients** | `stdio` / `sse` | Standard MCP 1.0 specification | Standard JSON manifest |

---

## 1. Claude Desktop
Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/.config/Claude/claude_desktop_config.json` (Linux):
```json
{
  "mcpServers": {
    "ai-bridge": {
      "command": "python",
      "args": ["-m", "services.mcp_server.server", "--transport", "stdio"],
      "env": {
        "AI_BRIDGE_WORKSPACE": "/home/user/workspace"
      }
    }
  }
}
```

## 2. Remote Streamable HTTP (SSE)
When connecting remote cloud models:
```bash
python -m services.mcp_server.server --transport sse --port 8080
```
Then point your client to:
`http://localhost:8080/sse`
