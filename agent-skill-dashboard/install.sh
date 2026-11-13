#!/usr/bin/env bash
# =============================================================================
#  AI Agent Skill Hub — 원커맨드 설치 스크립트 (macOS · Linux · WSL · Termux)
# -----------------------------------------------------------------------------
#  하는 일
#   1. recommended-mcp.json (토큰 절감 & 코딩 최적화 팩 5종)을 내려받습니다.
#   2. 현재 프로젝트의 .mcp.json 에 병합합니다. (기존 설정은 그대로 보존)
#   3. claude CLI 가 있으면 claude mcp add 까지 자동 실행합니다.
#
#  사용법
#   curl -fsSL https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --global         # 모든 프로젝트에 적용
#   curl -fsSL .../install.sh | bash -s -- --dir ~/my-app   # 대상 프로젝트 지정
#
#  옵션
#   --dir <path>   설치 대상 프로젝트 경로 (기본: 현재 디렉터리)
#   --global       Claude Code 사용자 전역 범위(--scope user)로 등록
#   --no-claude    claude CLI 등록 단계를 건너뜀 (.mcp.json 병합만)
#   --dry-run      실제로 쓰지 않고 실행될 내용만 출력
#   --help         이 도움말
#
#  요구사항: curl 또는 wget, 병합을 위해 python3(권장) 또는 jq
# =============================================================================
set -eu

BASE_URL="${SKILL_HUB_BASE:-https://gitsong123.github.io/taegomap/agent-skill-dashboard}"
RAW_URL="${SKILL_HUB_RAW:-https://raw.githubusercontent.com/gitsong123/taegomap/main/agent-skill-dashboard}"

TARGET_DIR="$(pwd)"
SCOPE="project"
SKIP_CLAUDE=0
DRY_RUN=0
TMP_DIR=""
BACKUP=""

usage() {
  cat <<'TXT'

  AI Agent Skill Hub — 원커맨드 설치 (Claude Code · Grok Bot · Cursor)

  사용법:
    bash install.sh [옵션]

  옵션:
    --dir <path>   설치 대상 프로젝트 경로 (기본: 현재 디렉터리)
    --global       Claude Code 사용자 전역 범위(--scope user)로 등록
    --no-claude    claude CLI 등록 단계를 건너뜀 (.mcp.json 병합만)
    --dry-run      실제로 쓰지 않고 실행될 내용만 출력
    --help         이 도움말

  예:
    curl -fsSL https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.sh | bash
    curl -fsSL .../install.sh | bash -s -- --global

TXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) TARGET_DIR="${2:-}"; shift 2 ;;
    --dir=*) TARGET_DIR="${1#*=}"; shift ;;
    --global|--user) SCOPE="user"; shift ;;
    --no-claude) SKIP_CLAUDE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1 (--help 참고)" >&2; exit 1 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  \033[36m·\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

cleanup() { if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi; }
trap cleanup EXIT INT TERM

PY=""
if command -v python3 >/dev/null 2>&1; then PY="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then PY="$(command -v python)"; fi

say ""
say "⚡ AI Agent Skill Hub — 토큰 절감 & 코딩 최적화 팩 설치"
say "   Claude Code · Grok Bot · Cursor 용 MCP 설정을 준비합니다."
say ""

# ---------------------------------------------------------------- 0. 환경 확인
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  fail "curl 또는 wget 이 필요합니다."
  exit 1
fi
if [ ! -d "$TARGET_DIR" ]; then
  fail "대상 디렉터리가 없습니다: $TARGET_DIR"
  exit 1
fi
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t skillhub)"

# ------------------------------------------------------- 1. recommended-mcp.json
fetch_to() { # $1=remote path, $2=local dest
  path="$1"; dest="$2"
  # 저장소를 클론한 상태에서 실행하면 옆에 있는 파일을 먼저 사용
  if [ -f "$0" ]; then
    script_dir="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
    if [ -n "$script_dir" ] && [ -f "$script_dir/$path" ]; then
      cp "$script_dir/$path" "$dest" && return 0
    fi
  fi
  for base in "$BASE_URL" "$RAW_URL"; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsSL --max-time 20 "$base/$path" -o "$dest" 2>/dev/null; then return 0; fi
    else
      if wget -q -T 20 -O "$dest" "$base/$path" 2>/dev/null; then return 0; fi
    fi
  done
  return 1
}

say "[1/3] 추천 MCP 설정 내려받기"
if ! fetch_to "recommended-mcp.json" "$TMP_DIR/recommended-mcp.json"; then
  fail "recommended-mcp.json 을 내려받지 못했습니다. 네트워크 또는 URL을 확인하세요."
  say "     시도한 주소: $BASE_URL , $RAW_URL"
  exit 1
fi
if [ -n "$PY" ]; then
  if ! "$PY" -c "import json,sys;json.load(open(sys.argv[1]))" "$TMP_DIR/recommended-mcp.json" 2>/dev/null; then
    fail "내려받은 JSON 형식이 올바르지 않습니다."
    exit 1
  fi
fi
ok "recommended-mcp.json 준비 완료 (토큰 절감 팩 5종)"

# ---------------------------------------------------------------- 2. 병합
say ""
say "[2/3] .mcp.json 병합"
MCP_PATH="$TARGET_DIR/.mcp.json"

merge_python() { # $1=source, $2=target
"$PY" - "$1" "$2" <<'PY'
import json, sys

src, dst = sys.argv[1], sys.argv[2]
try:
    with open(dst, encoding="utf-8") as f:
        cfg = json.load(f)
except FileNotFoundError:
    cfg = {}
except Exception as e:
    print("  ! 기존 파일을 읽지 못했습니다: %s" % e)
    sys.exit(2)

with open(src, encoding="utf-8") as f:
    new = json.load(f)

servers = cfg.get("mcpServers")
if not isinstance(servers, dict):
    servers = {}

added, kept = [], []
for name, entry in (new.get("mcpServers") or {}).items():
    if name in servers:
        kept.append(name)
    else:
        servers[name] = entry
        added.append(name)

cfg["mcpServers"] = servers
with open(dst, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("  ADDED:%s" % (", ".join(added) if added else "-"))
print("  KEPT:%s" % (", ".join(kept) if kept else "-"))
PY
}

merge_jq() { # $1=source, $2=dest
  command -v jq >/dev/null 2>&1 || return 1
  tmp_out="$TMP_DIR/merged.json"
  if [ -f "$2" ]; then
    jq -s '.[0] as $old | .[1] as $new | ($new + $old) | .mcpServers = (($new.mcpServers // {}) + ($old.mcpServers // {}))' "$2" "$1" > "$tmp_out" 2>/dev/null || return 1
  else
    cp "$1" "$tmp_out" || return 1
  fi
  [ -s "$tmp_out" ] || return 1
  mv "$tmp_out" "$2"
  echo "  ADDED:jq 로 병합 완료"
  return 0
}

if [ "$SCOPE" = "user" ] && command -v claude >/dev/null 2>&1; then
  info "--global 선택: .mcp.json 대신 Claude Code 사용자 전역 설정(--scope user)에 등록합니다."
else
  if [ -f "$MCP_PATH" ]; then
    BACKUP="$MCP_PATH.bak.$(date +%Y%m%d%H%M%S)"
    if [ "$DRY_RUN" = "1" ]; then
      info "[dry-run] 기존 $MCP_PATH 백업 예정: $(basename "$BACKUP")"
    else
      cp "$MCP_PATH" "$BACKUP"
      info "기존 설정을 백업했습니다: $(basename "$BACKUP")"
    fi
  fi

  if [ "$DRY_RUN" = "1" ]; then
    info "[dry-run] recommended-mcp.json 을 $MCP_PATH 에 병합 예정"
  else
    merged=0
    if [ -n "$PY" ] && merge_python "$TMP_DIR/recommended-mcp.json" "$MCP_PATH"; then
      merged=1
      ok ".mcp.json 병합 완료: $MCP_PATH"
    elif merge_jq "$TMP_DIR/recommended-mcp.json" "$MCP_PATH"; then
      merged=1
      ok ".mcp.json 병합 완료 (jq): $MCP_PATH"
    fi

    if [ "$merged" = "0" ]; then
      if [ ! -f "$MCP_PATH" ]; then
        cp "$TMP_DIR/recommended-mcp.json" "$MCP_PATH"
        ok ".mcp.json 생성 완료 (병합 도구 없음 — 새 파일로 저장)"
      else
        warn "python3·jq 가 없어 자동 병합을 하지 못했습니다."
        warn ".mcp.json 의 mcpServers 안에 아래 파일 내용을 직접 붙여넣어 주세요."
        cp "$TMP_DIR/recommended-mcp.json" "$TARGET_DIR/recommended-mcp.json"
        info "참고용 파일을 저장했습니다: $TARGET_DIR/recommended-mcp.json"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------- 3. claude CLI
say ""
say "[3/3] Claude Code 자동 등록"
if [ "$SKIP_CLAUDE" = "1" ]; then
  info "--no-claude: claude mcp add 단계를 건너뜁니다."
elif ! command -v claude >/dev/null 2>&1; then
  info "claude CLI 가 없어 등록을 건너뜁니다. (.mcp.json 만 준비됨)"
  info "Claude Code 설치 후 이 스크립트를 다시 실행하면 자동 등록됩니다."
elif [ -z "$PY" ]; then
  info "python 이 없어 claude 자동 등록을 건너뜁니다. 대시보드의 [claude mcp add] 탭에서 명령을 복사해 실행하세요."
else
  SKILL_HUB_SCOPE="$SCOPE" "$PY" - "$TMP_DIR/recommended-mcp.json" <<'PY' > "$TMP_DIR/commands.txt"
import json, os, shlex, sys

scope = os.environ.get("SKILL_HUB_SCOPE", "project")
with open(sys.argv[1], encoding="utf-8") as f:
    servers = json.load(f).get("mcpServers", {})

for name, cfg in servers.items():
    env = cfg.get("env") or {}
    missing = [k for k, v in env.items() if v == "${%s}" % k and not os.environ.get(k)]
    if missing:
        print("#SKIP\t%s\t%s" % (name, ", ".join(missing)))
        continue
    parts = ["claude", "mcp", "add", "--scope", scope, name]
    for key, val in env.items():
        if val == "${%s}" % key:
            val = os.environ.get(key, "")
        parts += ["-e", "%s=%s" % (key, val)]
    parts.append("--")
    parts.append(cfg.get("command", "npx"))
    parts += list(cfg.get("args", []))
    print("%s\t%s" % (name, " ".join(shlex.quote(p) for p in parts)))
PY

  while IFS="$(printf '\t')" read -r name cmd_line extra; do
    [ -n "${name:-}" ] || continue
    if [ "$name" = "#SKIP" ]; then
      info "건너뜀: ${cmd_line:-} (환경변수 ${extra:-} 미설정)"
      continue
    fi
    if [ "$DRY_RUN" = "1" ]; then
      info "[dry-run] $cmd_line"
      continue
    fi
    if out="$(sh -c "$cmd_line" 2>&1)"; then
      ok "등록: $name"
    else
      case "$out" in
        *"already exists"*|*"already registered"*|*"이미"*) info "이미 등록됨: $name" ;;
        *) warn "등록 실패: $name — $out" ;;
      esac
    fi
  done < "$TMP_DIR/commands.txt"
fi

# ---------------------------------------------------------------- 안내
say ""
say "──────────────────────────────────────────────────────────"
say " 다음 단계"
say "──────────────────────────────────────────────────────────"
say " 1) Claude Code 실행 → /mcp 입력 → 등록된 서버 확인"
if [ "$SCOPE" = "project" ]; then
  say "    프로젝트 .mcp.json 서버는 처음 한 번 승인(approve)하면 계속 사용됩니다."
else
  say "    --scope user 로 등록되어 모든 프로젝트에서 바로 사용할 수 있습니다."
fi
say " 2) Grok Bot · Cursor: $MCP_PATH 를 읽게 하거나,"
say "    대시보드의 [Grok Bot] 탭에서 grok_skills.json 을 복사해 붙여넣으세요."
say " 3) github-diff-inspector 는 GitHub 토큰이 필요합니다:"
say "    export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx"
say "    토큰이 없다면 .mcp.json 에서 그 항목만 지워도 나머지 4종은 그대로 동작합니다."
say ""
say " 대시보드: $BASE_URL/"
say " 카탈로그: $BASE_URL/skills.json"
say ""
if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
  say " 되돌리려면: cp \"$BACKUP\" \"$MCP_PATH\""
  say ""
fi
say " 설치가 끝났습니다. 즐거운 코딩 되세요! ⚡"
say ""
