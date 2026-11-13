# =============================================================================
#  AI Agent Skill Hub — 원커맨드 설치 스크립트 (Windows PowerShell 5.1+ / PowerShell 7)
# -----------------------------------------------------------------------------
#  하는 일
#   1. recommended-mcp.json (토큰 절감 & 코딩 최적화 팩 5종)을 내려받습니다.
#   2. 현재 프로젝트의 .mcp.json 에 병합합니다. (기존 설정은 그대로 보존)
#   3. claude CLI 가 있으면 claude mcp add 까지 자동 실행합니다.
#
#  사용법 (PowerShell)
#   irm https://gitsong123.github.io/taegomap/agent-skill-dashboard/install.ps1 | iex
#
#  옵션 (내려받아 실행할 때)
#   .\install.ps1 -TargetDir C:\dev\my-app -Global -SkipClaude -DryRun
#
#  참고: 스크립트 실행이 차단되면 한 번만 실행하세요
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# =============================================================================
param(
    [string]$TargetDir = (Get-Location).Path,
    [string]$BaseUrl   = $(if ($env:SKILL_HUB_BASE) { $env:SKILL_HUB_BASE } else { 'https://gitsong123.github.io/taegomap/agent-skill-dashboard' }),
    [string]$RawUrl    = $(if ($env:SKILL_HUB_RAW)  { $env:SKILL_HUB_RAW }  else { 'https://raw.githubusercontent.com/gitsong123/taegomap/main/agent-skill-dashboard' }),
    [switch]$Global,
    [switch]$SkipClaude,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Ok($m)   { Write-Host "  " -NoNewline; Write-Host "OK" -ForegroundColor Green -NoNewline; Write-Host " $m" }
function Write-Info($m) { Write-Host "  " -NoNewline; Write-Host "·" -ForegroundColor Cyan -NoNewline; Write-Host " $m" }
function Write-Warn($m) { Write-Host "  " -NoNewline; Write-Host "!" -ForegroundColor Yellow -NoNewline; Write-Host " $m" }
function Write-Err($m)  { Write-Host "  " -NoNewline; Write-Host "x" -ForegroundColor Red -NoNewline; Write-Host " $m" }

$Scope = if ($Global) { 'user' } else { 'project' }

Write-Host ""
Write-Host "AI Agent Skill Hub — 토큰 절감 & 코딩 최적화 팩 설치" -ForegroundColor White
Write-Host "   Claude Code · Grok Bot · Cursor 용 MCP 설정을 준비합니다." -ForegroundColor DarkGray
Write-Host ""

# ---------------------------------------------------------------- 0. 환경 확인
if (-not (Test-Path -LiteralPath $TargetDir)) {
    Write-Err "대상 디렉터리가 없습니다: $TargetDir"
    return
}
$TargetDir = (Resolve-Path -LiteralPath $TargetDir).Path
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("skillhub-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

function Get-RemoteFile {
    param([string]$Path, [string]$Dest)
    # 저장소를 클론한 상태에서 실행하면 옆에 있는 파일을 먼저 사용
    if ($PSCommandPath) {
        $local = Join-Path (Split-Path -Parent $PSCommandPath) $Path
        if (Test-Path -LiteralPath $local) {
            Copy-Item -LiteralPath $local -Destination $Dest -Force
            return $true
        }
    }
    foreach ($b in @($BaseUrl, $RawUrl)) {
        try {
            Invoke-WebRequest -Uri "$b/$Path" -OutFile $Dest -UseBasicParsing -TimeoutSec 20
            if ((Test-Path -LiteralPath $Dest) -and ((Get-Item -LiteralPath $Dest).Length -gt 0)) { return $true }
        } catch { }
    }
    return $false
}

# ------------------------------------------------------- 1. recommended-mcp.json
Write-Host "[1/3] 추천 MCP 설정 내려받기"
$recPath = Join-Path $tmpDir 'recommended-mcp.json'
if (-not (Get-RemoteFile -Path 'recommended-mcp.json' -Dest $recPath)) {
    Write-Err "recommended-mcp.json 을 내려받지 못했습니다. 네트워크 또는 URL을 확인하세요."
    Write-Host "     시도한 주소: $BaseUrl , $RawUrl"
    return
}
try {
    $rec = Get-Content -LiteralPath $recPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Err "내려받은 JSON 형식이 올바르지 않습니다."
    return
}
$recNames = @($rec.mcpServers.PSObject.Properties.Name)
Write-Ok "recommended-mcp.json 준비 완료 (스킬 $($recNames.Count)종)"

# ---------------------------------------------------------------- 2. 병합
Write-Host ""
Write-Host "[2/3] .mcp.json 병합"
$mcpPath = Join-Path $TargetDir '.mcp.json'
$backup = $null

if ($Scope -eq 'user' -and (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Info "-Global 선택: .mcp.json 대신 Claude Code 사용자 전역 설정(--scope user)에 등록합니다."
} else {
    $config = [ordered]@{ mcpServers = [ordered]@{} }
    if (Test-Path -LiteralPath $mcpPath) {
        $backup = "${mcpPath}.bak." + (Get-Date -Format 'yyyyMMddHHmmss')
        if ($DryRun) {
            Write-Info "[dry-run] 기존 .mcp.json 백업 예정: $(Split-Path -Leaf $backup)"
        } else {
            Copy-Item -LiteralPath $mcpPath -Destination $backup -Force
            Write-Info "기존 설정을 백업했습니다: $(Split-Path -Leaf $backup)"
        }
        try {
            $existing = Get-Content -LiteralPath $mcpPath -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($prop in $existing.PSObject.Properties) {
                if ($prop.Name -ne 'mcpServers') { $config[$prop.Name] = $prop.Value }
            }
            if ($existing.mcpServers) {
                foreach ($prop in $existing.mcpServers.PSObject.Properties) {
                    $config.mcpServers[$prop.Name] = $prop.Value
                }
            }
        } catch {
            Write-Err "기존 .mcp.json 을 읽지 못했습니다: $($_.Exception.Message)"
            Write-Info "파일을 그대로 두고 중단합니다. 형식을 확인한 뒤 다시 실행해 주세요."
            return
        }
    }

    $added = @(); $kept = @()
    foreach ($name in $recNames) {
        if ($config.mcpServers.Contains($name)) { $kept += $name; continue }
        $config.mcpServers[$name] = $rec.mcpServers.$name
        $added += $name
    }

    if ($DryRun) {
        Write-Info "[dry-run] 추가 예정: $(if ($added.Count) { $added -join ', ' } else { '없음' })"
    } else {
        $json = $config | ConvertTo-Json -Depth 24
        [System.IO.File]::WriteAllText($mcpPath, $json, (New-Object System.Text.UTF8Encoding($false)))
        Write-Ok ".mcp.json 병합 완료: $mcpPath"
        Write-Info "추가: $(if ($added.Count) { $added -join ', ' } else { '없음' })"
        Write-Info "유지: $(if ($kept.Count) { $kept -join ', ' } else { '없음' })"
    }
}

# ---------------------------------------------------------------- 3. claude CLI
Write-Host ""
Write-Host "[3/3] Claude Code 자동 등록"
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($SkipClaude) {
    Write-Info "-SkipClaude: claude mcp add 단계를 건너뜁니다."
} elseif (-not $claude) {
    Write-Info "claude CLI 가 없어 등록을 건너뜁니다. (.mcp.json 만 준비됨)"
    Write-Info "Claude Code 설치 후 이 스크립트를 다시 실행하면 자동 등록됩니다."
} else {
    foreach ($name in $recNames) {
        $entry = $rec.mcpServers.$name
        $cliArgs = @('mcp', 'add', '--scope', $Scope, $name)

        $skip = $false
        if ($entry.env) {
            foreach ($prop in $entry.env.PSObject.Properties) {
                $val = [string]$prop.Value
                if ($val -eq "`${$($prop.Name)}") {
                    $actual = [Environment]::GetEnvironmentVariable($prop.Name, 'Process')
                    if ([string]::IsNullOrWhiteSpace($actual)) { $skip = $true; break }
                    $val = $actual
                }
                $cliArgs += @('-e', "$($prop.Name)=$val")
            }
        }
        if ($skip) {
            Write-Info "건너뜀: $name (환경변수 미설정 — 대시보드 안내 참고)"
            continue
        }

        $cliArgs += '--'
        $cliArgs += [string]$entry.command
        foreach ($a in @($entry.args)) { $cliArgs += [string]$a }

        if ($DryRun) {
            Write-Info "[dry-run] claude $($cliArgs -join ' ')"
            continue
        }
        # 네이티브 명령의 stderr가 종료 오류로 승격되지 않도록 잠시 완화
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $out = & claude @cliArgs 2>&1
        $code = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($code -eq 0) {
            Write-Ok "등록: $name"
        } elseif ("$out" -match 'already') {
            Write-Info "이미 등록됨: $name"
        } else {
            Write-Warn "등록 실패: $name — $out"
        }
    }
}

Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------- 안내
Write-Host ""
Write-Host "──────────────────────────────────────────────────────────"
Write-Host " 다음 단계"
Write-Host "──────────────────────────────────────────────────────────"
Write-Host " 1) Claude Code 실행 → /mcp 입력 → 등록된 서버 확인"
if ($Scope -eq 'project') {
    Write-Host "    프로젝트 .mcp.json 서버는 처음 한 번 승인(approve)하면 계속 사용됩니다."
} else {
    Write-Host "    --scope user 로 등록되어 모든 프로젝트에서 바로 사용할 수 있습니다."
}
Write-Host " 2) Grok Bot · Cursor: $mcpPath 를 읽게 하거나,"
Write-Host "    대시보드의 [Grok Bot] 탭에서 grok_skills.json 을 복사해 붙여넣으세요."
Write-Host " 3) github-diff-inspector 는 GitHub 토큰이 필요합니다:"
Write-Host '    $env:GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_xxx"'
Write-Host "    토큰이 없다면 .mcp.json 에서 그 항목만 지워도 나머지 4종은 그대로 동작합니다."
Write-Host ""
Write-Host " 대시보드: $BaseUrl/"
Write-Host " 카탈로그: $BaseUrl/skills.json"
Write-Host ""
if ($backup -and (Test-Path -LiteralPath $backup)) {
    Write-Host " 되돌리려면: Copy-Item `"$backup`" `"$mcpPath`" -Force"
    Write-Host ""
}
Write-Host " 설치가 끝났습니다. 즐거운 코딩 되세요!" -ForegroundColor Green
Write-Host ""
