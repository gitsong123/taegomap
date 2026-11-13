# ⚡ AI Agent Skill Hub — Claude Code · Grok Bot 스킬 카탈로그

Claude Code, Grok Bot, Cursor 같은 코딩 에이전트에 **MCP 스킬**을 골라 붙이는 카탈로그입니다.
코딩 생산성과 **토큰 절감**에 특화된 5종을 기본 추천 팩으로 묶었고, 웹 개발용 8종을 함께 제공합니다.

| 항목 | 주소 |
|---|---|
| 대시보드 (웹) | https://gitsong123.github.io/taegomap/agent-skill-dashboard/ |
| 스킬 카탈로그 (JSON) | https://gitsong123.github.io/taegomap/agent-skill-dashboard/skills.json |
| 추천 MCP 설정 | https://gitsong123.github.io/taegomap/agent-skill-dashboard/recommended-mcp.json |
| 저장소 | https://github.com/gitsong123/taegomap |

---

## 1. 원커맨드 설치

**macOS · Linux · WSL · Termux**

```bash
curl -fsSL https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.sh | bash
```

모든 프로젝트에 적용하려면(Claude Code 사용자 전역):

```bash
curl -fsSL https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.sh | bash -s -- --global
```

**Windows PowerShell**

```powershell
irm https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.ps1 | iex
```

설치 스크립트가 하는 일:

1. `recommended-mcp.json`(토큰 절감 팩 5종)을 내려받습니다.
2. 현재 프로젝트의 `.mcp.json`에 **병합**합니다. 기존 서버 설정은 지우지 않고, 같은 이름이 있으면 그대로 둡니다. (덮어쓰기 전 `.mcp.json.bak.<시각>` 백업 생성)
3. `claude` CLI가 있으면 `claude mcp add --scope project`(또는 `--global`이면 `--scope user`)까지 자동 실행합니다.
4. `claude mcp add` 자동 실행을 원하지 않으면 `--no-claude`, 결과만 보고 싶으면 `--dry-run`.

설치 후 확인:

```
claude        # Claude Code 실행
/mcp          # 등록된 서버가 connected 인지 확인
```

프로젝트 `.mcp.json`으로 등록한 서버는 처음 한 번 **승인(approve)** 하면 계속 사용할 수 있습니다.

---

## 2. 에이전트에게 그대로 주면 되는 지시문

Claude Code나 Grok Bot에게 아래 문장과 URL을 주면, 이 저장소를 읽고 필요한 스킬을 스스로 골라 설치합니다.

```text
https://gitsong123.github.io/taegomap/agent-skill-dashboard/skills.json 을 읽어라.
이 프로젝트의 스택과 작업에 맞는 스킬을 skills 배열에서 고르고,
고른 스킬의 mcp.command / mcp.args 를 프로젝트 루트 .mcp.json 의 mcpServers 에 병합하라.
claude CLI 가 있으면 각 스킬의 claude_mcp_add 명령을 --scope project 로 실행하라.
기존 .mcp.json 항목은 지우지 말고, 같은 id 가 이미 있으면 건너뛰어라.
마지막에 등록한 스킬 목록과 /mcp 확인 방법을 알려 달라.
```

에이전트가 읽어야 할 구조 (`skills.json`):

```jsonc
{
  "skills": [
    {
      "id": "context7-live-docs",          // .mcp.json 서버 이름으로 그대로 사용
      "name": "Context7 Live Docs",
      "category": "token",                  // token | frontend | backend | database | testing | devops
      "description": "…",
      "agents": ["Claude Code", "Grok Bot", "Cursor"],
      "stacks": ["token", "docs", "typescript"],
      "mcp": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
      "claude_mcp_add": "claude mcp add context7-live-docs -- npx -y @upstash/context7-mcp",
      "recommended_for": "최신 라이브러리 API를 정확하게 쓰고 싶을 때",
      "token_saver": true,
      "savings": "문서 컨텍스트 대폭 절감"
    }
  ]
}
```

- `tokenPack.ids` : 토큰 절감 팩 5종의 id 목록
- `categories` : 카테고리 코드 → 한글 이름
- `install` : 플랫폼별 원커맨드 설치 명령

---

## 3. 파일 구성

| 파일 | 용도 |
|---|---|
| `index.html` | 웹 대시보드. 스택 추천, 검색·필터, 스킬 선택, `.mcp.json`·`claude mcp add`·`grok_skills.json` 생성 및 원클릭 복사 |
| `skills.json` | 전체 스킬 카탈로그(13종). 에이전트가 읽고 스스로 고르는 표준 데이터 |
| `recommended-mcp.json` | 토큰 절감 & 코딩 최적화 5종이 담긴 표준 `.mcp.json` 형식 파일 |
| `install.sh` | macOS · Linux · WSL · Termux 원커맨드 설치 (다운로드 → 병합 → `claude mcp add`) |
| `install.ps1` | Windows PowerShell 원커맨드 설치 |
| `README.md` | 이 문서 |

---

## 4. 스킬 카탈로그 (13종)

### 🪙 토큰 절감 & 코딩 최적화 팩 (신규 5종)

| 스킬 | 실행 명령 | 무엇을 아끼나 |
|---|---|---|
| **Context7 Live Docs** | `npx -y @upstash/context7-mcp` | 웹 검색·긴 문서 덤프 대신, 필요한 버전의 API 스펙만 주입 → 문서 토큰과 잘못된 API 사용(할루시네이션) 동시 절감 |
| **AST Symbol Code Reader** | `npx -y ast-mcp-server` | 파일 전체 대신 함수·클래스 심볼과 의존성만 로드 → 대형 코드베이스 읽기 토큰 절감 (TS/JS AST 기반) |
| **Smart Repo Packer / Repomix** | `npx -y repomix --mcp` | 빌드 산출물·lock 파일을 빼고 핵심 구조만 압축 인덱싱 |
| **Sequential Thinking & Plan Optimizer** | `npx -y @modelcontextprotocol/server-sequential-thinking` | 구현 전 단계별 설계·엣지케이스 검증 → 수정 루프와 재질문 감소 |
| **Minimal Diff & PR Inspector** | `npx -y @modelcontextprotocol/server-github` | 저장소 전체 대신 변경된 Diff·이슈 문맥만 조회 (GitHub 토큰 필요) |

> 다국어 대형 저장소에서 심볼 단위 탐색이 필요하면 [Serena](https://github.com/oraios/serena)(LSP 기반, 40개 이상 언어)를 함께 쓰는 것을 권장합니다.
> `uv tool install -p 3.13 serena-agent` 후 `claude mcp add serena -- serena start-mcp-server --context claude-code --project "$(pwd)"`.

### 웹 개발 스킬 (기존 8종)

| 스킬 | 카테고리 | 실행 명령 |
|---|---|---|
| Next.js App Router Expert | frontend | `npx -y @modelcontextprotocol/server-nextjs` |
| Tailwind UI Component Craft | frontend | `npx -y mcp-tailwind-craft` |
| SQLite & Drizzle Schema Architect | database | `npx -y mcp-sqlite-drizzle --db ./dev.sqlite` |
| Playwright E2E Web Tester | testing | `npx -y @playwright/mcp-server` |
| OpenAPI Mock & Contract Validator | backend | `npx -y mcp-openapi-mock` |
| Rust Axum API Engineer | backend | `cargo run --bin mcp-rust-axum` |
| Docker Web Stack Orchestrator | devops | `npx -y mcp-docker-compose` |
| Web Security & XSS Sentinel | testing | `npx -y mcp-security-sentinel` |

스택 태그(`stacks`)로 대시보드 프리셋과 매칭됩니다: `token`, `nextjs`, `tailwind`, `sqlite`, `drizzle`, `rust`, `axum`, `docker`, `security`, `github` …

---

## 5. 수동 설정

### 5-1. `.mcp.json` (프로젝트 공용)

`recommended-mcp.json`을 프로젝트 루트 `.mcp.json`으로 저장하거나, 기존 파일의 `mcpServers`에 병합합니다.

```json
{
  "mcpServers": {
    "context7-live-docs": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "ast-symbol-reader": { "command": "npx", "args": ["-y", "ast-mcp-server"] },
    "repomix-repo-packer": { "command": "npx", "args": ["-y", "repomix", "--mcp"] },
    "sequential-thinking": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
    "github-diff-inspector": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" }
    }
  }
}
```

`${GITHUB_PERSONAL_ACCESS_TOKEN}`은 실행 시 환경변수로 확장됩니다. 토큰이 없다면 그 항목만 지워도 나머지 4종은 그대로 동작합니다.

### 5-2. `claude mcp add` (Claude Code)

```bash
claude mcp add context7-live-docs -- npx -y @upstash/context7-mcp
claude mcp add ast-symbol-reader -- npx -y ast-mcp-server
claude mcp add repomix-repo-packer -- npx -y repomix --mcp
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
claude mcp add github-diff-inspector -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx -- npx -y @modelcontextprotocol/server-github
```

- 프로젝트에만 적용: `--scope project` (기본)
- 모든 프로젝트에 적용: `--scope user`
- 등록 확인: `claude mcp list` · Claude Code 안에서는 `/mcp`

### 5-3. Grok Bot (`grok_skills.json`)

```json
{
  "version": "1.0",
  "agent": "grok-bot",
  "skills": [
    { "id": "context7-live-docs", "name": "Context7 Live Docs", "command": "npx", "args": ["-y", "@upstash/context7-mcp"], "enabled": true },
    { "id": "ast-symbol-reader", "name": "AST Symbol Code Reader", "command": "npx", "args": ["-y", "ast-mcp-server"], "enabled": true }
  ]
}
```

`recommended-mcp.json`의 `mcpServers`를 같은 형태로 옮기면 됩니다. 대시보드의 **Grok Bot** 탭이 선택한 스킬만 담아 이 JSON을 만들어 줍니다.
Grok Bot이 `.mcp.json`을 직접 읽는 환경이라면 5-1만으로도 동작합니다.

---

## 6. 요구사항

- Node.js 18 이상 (`npx` 기반 스킬)
- 병합 스크립트용 `python3`(권장) 또는 `jq` — 둘 다 없으면 새 `.mcp.json`만 생성됩니다.
- 선택: `claude` CLI (Claude Code)
- Windows는 PowerShell 5.1 이상. 스크립트 차단 시 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

---

## 7. 문제 해결

| 증상 | 확인 |
|---|---|
| `claude: command not found` | Claude Code 미설치. 설치 후 `install.sh`를 다시 실행하면 자동 등록됩니다. |
| `/mcp`에 서버가 안 보임 | 프로젝트 루트에서 Claude Code를 실행했는지, `.mcp.json` 승인 프롬프트를 수락했는지 확인 |
| 서버가 `failed` | `npx -y <패키지>`를 터미널에서 직접 실행해 패키지 다운로드/네트워크를 확인 |
| GitHub 스킬 오류 | `GITHUB_PERSONAL_ACCESS_TOKEN` 설정 여부 확인. 없으면 해당 항목 제거 |
| 설치 스크립트가 멈춤 | `curl -fsSL <install.sh 주소> -o install.sh && bash install.sh --dry-run`으로 먼저 확인 |

---

## 8. 보안

- 저장소와 스크립트는 공개되어 있으니, 실행 전 내용을 한 번 확인하는 습관을 권장합니다.
- MCP 서버는 로컬 프로세스로 실행되며, 토큰은 `.mcp.json`에 직접 쓰지 말고 환경변수로 넘기세요.
- 사내 코드베이스에서 외부 MCP 서버를 쓸 때는 조직의 보안 정책을 먼저 확인하세요.

---

대시보드: https://gitsong123.github.io/taegomap/agent-skill-dashboard/
저장소: https://github.com/gitsong123/taegomap
