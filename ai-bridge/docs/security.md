# AI Bridge Security Guide

## Security Standards & Policies

### 1. Principle of Least Privilege
- The AI Bridge Linux Agent must be run under a dedicated, unprivileged system account (`aibridge:aibridge`), never as `root`.
- The Windows Agent runs under `NetworkService` or a dedicated low-privilege service account.
- Desktop automation runs inside a user session helper with strict application allowlists.

### 2. Secret Redaction
All audit records and tool outputs pass through `packages/audit/logger.py` which redacts:
- OpenAI, Anthropic, Google API keys
- RSA/Ed25519/EC private keys (`-----BEGIN PRIVATE KEY-----`)
- Bearer tokens and JWT authorization headers
- Sensitive dictionary keys (`password`, `secret`, `token`, `credential`, `api_key`)

### 3. Emergency Stop (Kill Switch)
Operators have instantaneous control to halt operations:
- **UI Trigger**: Red "Emergency Stop" button in top dashboard header.
- **API Trigger**: `POST /api/emergency-stop/trigger`
- **Effect**: Immediately rejects all pending, queued, and newly submitted tasks. Running tasks receive cancellation signals.

### 4. Vulnerability Disclosure & Incident Response
If you identify a security issue in AI Bridge:
1. Do not open a public GitHub issue.
2. Email the security team at `security@example.com` with reproducible steps.
3. Fixes will be prepared and released within standard responsible disclosure timelines.
