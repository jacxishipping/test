# AI Bridge Architecture

## System Overview

AI Bridge is a distributed, security-first computer control platform enabling authorized AI assistants to interact safely with host infrastructure via the Model Context Protocol (MCP).

```
┌────────────────────────────────────────────────────────┐
│               AI ASSISTANT / CLIENT                    │
│   (Claude Desktop, Claude Code, Gemini CLI, ChatGPT)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Model Context Protocol (stdio or SSE)
┌──────────────────────────▼─────────────────────────────┐
│                 AI BRIDGE MCP SERVER                   │
│   - FastMCP Dispatcher & Tool Registration             │
│   - Typed Pydantic Arguments Validation                │
│   - Strict Schema Bounds & Output Capping              │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        Policy Evaluation          Structured Audit
               │                          │
┌──────────────▼───────────┐      ┌───────▼──────────────┐
│      POLICY ENGINE       │      │     AUDIT ENGINE     │
│  - Risk Classification   │      │  - Tamper-Evident    │
│    (Tiers 1, 2, 3, 4)    │      │    JSON Events       │
│  - Workspace Chroot      │      │  - Automated Secret  │
│  - Traversal Prevention  │      │    Redaction         │
│  - Symlink Escape Guards │      │  - Actor & IP Trace  │
└──────────────┬───────────┘      └──────────────────────┘
               │
┌──────────────▼─────────────────────────────────────────┐
│               TASK ORCHESTRATOR                        │
│   - State Transitions (Pending, Queued, Running)       │
│   - Cooperative Cancellation Tokens                    │
│   - Pre-modification File Rollback Backups             │
│   - Execution Timeouts & Deadlines                     │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        Outbound Heartbeats         Local Handshake
               │                          │
┌──────────────▼───────────┐      ┌───────▼──────────────┐
│    REMOTE AGENTS         │      │     CONTROL API      │
│  - Linux Agent (systemd) │◄────►│  - Device Registry   │
│  - Windows Service Agent │      │  - Approval Queue    │
│  - Desktop GUI Helper    │      │  - Emergency Stop    │
└──────────────────────────┘      └──────────────────────┘
```

## Security Boundaries & Design Principles
1. **Zero Direct Root Shells**: No generic `run_any_command`, `bash -c`, or arbitrary PowerShell execution. All operations map to named, allowlisted actions with strict argument schemas.
2. **Workspace Confinement**: All file read, write, search, move, and delete actions are resolved against `AI_BRIDGE_WORKSPACE`. Any attempt to escape via `..`, absolute paths, or symlinks to outside files is rejected with a fatal error.
3. **Four-Tier Risk Model**:
   - **Tier 1 (Read-Only)**: System info, resource usage, file reading, log reading, process lists. Pre-approved for autonomous AI execution.
   - **Tier 2 (Low-Risk Changes)**: New file creation, testing, linting, snapshots. Bounded execution permitted.
   - **Tier 3 (Sensitive Changes)**: Editing existing files, moving files, launching approved desktop applications. Requires operator confirmation or explicit policy pre-approval.
   - **Tier 4 (High-Risk Operations)**: File deletion, production deployments, system service changes. Strictly requires manual human approval via the Approval Queue.
4. **Outbound Connection Topology**: Agents connect outbound over TLS to the Control API. Servers never expose open inbound listening ports behind corporate firewalls or NAT.
