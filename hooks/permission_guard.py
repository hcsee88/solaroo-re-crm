#!/usr/bin/env python3
import json
import re
import sys

def emit_allow():
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PermissionRequest",
            "decision": {
                "behavior": "allow"
            }
        }
    }))
    sys.exit(0)

def emit_deny(message):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PermissionRequest",
            "decision": {
                "behavior": "deny",
                "message": message
            }
        }
    }))
    sys.exit(0)

def emit_ask():
    sys.exit(0)

def normalize_path(path: str) -> str:
    return (path or "").replace("\\", "/")

def is_sensitive_path(path: str) -> bool:
    path = normalize_path(path)
    patterns = [
        r"(^|/)\.env($|\.)",
        r"(^|/)secrets?(/|$)",
        r"(^|/)credentials?(/|$)",
        r"(^|/)id_rsa$",
        r"(^|/)id_ed25519$",
        r"(^|/)auth(/|$)",
        r"(^|/)billing(/|$)",
        r"(^|/)payment(s)?(/|$)",
        r"(^|/)infra(/|$)",
        r"(^|/)\.git(/|$)",
        r"(^|/)\.claude(/|$)",
        r"(^|/)\.vscode(/|$)",
        r"(^|/)\.idea(/|$)",
        r"(^|/)\.husky(/|$)"
    ]
    return any(re.search(p, path, re.IGNORECASE) for p in patterns)

def is_risky_bash(cmd: str) -> bool:
    risky = [
        r"(^|&&|\|\|)\s*rm\s",
        r"(^|&&|\|\|)\s*sudo\s",
        r"(^|&&|\|\|)\s*chmod\s",
        r"(^|&&|\|\|)\s*chown\s",
        r"(^|&&|\|\|)\s*mv\s",
        r"(^|&&|\|\|)\s*git\s+push\b",
        r"(^|&&|\|\|)\s*git\s+reset\s+--hard\b",
        r"(^|&&|\|\|)\s*git\s+clean\b",
        r"(^|&&|\|\|)\s*git\s+rebase\b",
        r"(^|&&|\|\|)\s*curl\b",
        r"(^|&&|\|\|)\s*wget\b",
        r"(^|&&|\|\|)\s*npm\s+install\b",
        r"(^|&&|\|\|)\s*npm\s+update\b",
        r"(^|&&|\|\|)\s*pnpm\s+add\b",
        r"(^|&&|\|\|)\s*pnpm\s+update\b",
        r"(^|&&|\|\|)\s*yarn\s+add\b",
        r"(^|&&|\|\|)\s*yarn\s+upgrade\b",
        r"(^|&&|\|\|)\s*pip\s+install\b",
        r"(^|&&|\|\|)\s*pip3\s+install\b",
        r"(^|&&|\|\|)\s*docker\b",
        r"(^|&&|\|\|)\s*kubectl\b",
        r"(^|&&|\|\|)\s*terraform\b"
    ]
    return any(re.search(p, cmd, re.IGNORECASE) for p in risky)

def is_safe_bash(cmd: str) -> bool:
    safe = [
        r"(^|&&|\|\|)\s*git\s+status\s*$",
        r"(^|&&|\|\|)\s*git\s+diff\b",
        r"(^|&&|\|\|)\s*git\s+log\b",
        r"(^|&&|\|\|)\s*git\s+branch\b",
        r"(^|&&|\|\|)\s*git\s+show\b",
        r"(^|&&|\|\|)\s*rg\s",
        r"(^|&&|\|\|)\s*grep\s",
        r"(^|&&|\|\|)\s*find\s",
        r"(^|&&|\|\|)\s*ls(\s|$)",
        r"(^|&&|\|\|)\s*pwd\s*$",
        r"(^|&&|\|\|)\s*cat\s",
        r"(^|&&|\|\|)\s*head\s",
        r"(^|&&|\|\|)\s*tail\s",
        r"(^|&&|\|\|)\s*wc\s",
        r"(^|&&|\|\|)\s*npm\s+test\b",
        r"(^|&&|\|\|)\s*pnpm\s+test\b",
        r"(^|&&|\|\|)\s*yarn\s+test\b",
        r"(^|&&|\|\|)\s*pytest\b",
        r"(^|&&|\|\|)\s*python\s+-m\s+pytest\b",
        r"(^|&&|\|\|)\s*npm\s+run\s+lint\b",
        r"(^|&&|\|\|)\s*pnpm\s+lint\b",
        r"(^|&&|\|\|)\s*yarn\s+lint\b",
        r"(^|&&|\|\|)\s*npm\s+run\s+build\b",
        r"(^|&&|\|\|)\s*pnpm\s+build\b",
        r"(^|&&|\|\|)\s*yarn\s+build\b"
    ]
    return any(re.search(p, cmd, re.IGNORECASE) for p in safe)

payload = json.load(sys.stdin)
tool_name = payload.get("tool_name", "")
tool_input = payload.get("tool_input", {})

if tool_name in {"Read", "Glob", "Grep", "LS"}:
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if is_sensitive_path(path):
        emit_ask()
    emit_allow()

if tool_name in {"Edit", "Write", "MultiEdit"}:
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if is_sensitive_path(path):
        emit_ask()
    emit_allow()

if tool_name == "Bash":
    cmd = (tool_input.get("command") or "").strip()
    if is_risky_bash(cmd):
        emit_ask()
    if is_safe_bash(cmd):
        emit_allow()
    emit_ask()

emit_ask()