# Google Gemini & Gemini CLI Integration

AI Bridge supports Google Gemini through the Model Context Protocol (MCP) or direct tool function declaration using the `@google/genai` TypeScript/Python SDK.

## Using with Gemini CLI or MCP Clients
Add AI Bridge to your Gemini MCP environment:
```json
{
  "mcpServers": {
    "ai-bridge": {
      "command": "python",
      "args": ["-m", "services.mcp_server.server", "--transport", "stdio"],
      "env": {
        "AI_BRIDGE_WORKSPACE": "/path/to/workspace"
      }
    }
  }
}
```

## Function Calling with Gemini SDK
In Python or TypeScript, tools can be queried dynamically via the Control API (`/api/mcp/tools`) and declared directly in `generationConfig.tools`.
