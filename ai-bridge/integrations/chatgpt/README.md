# OpenAI ChatGPT & Codex Integration

ChatGPT supports MCP and remote tool connectors through Streamable HTTP / Server-Sent Events (SSE).

## Requirements
- OpenAI ChatGPT Plus, Team, or Enterprise account with custom actions or developer tools enabled.
- Remote AI Bridge server exposed over TLS (HTTPS).

## Configuration
Configure your custom action or MCP server connector with the endpoint:
- **URL**: `https://<YOUR_AI_BRIDGE_DOMAIN>/api/mcp/sse`
- **Auth**: Bearer Token (obtain from AI Bridge Dashboard -> API Keys)
