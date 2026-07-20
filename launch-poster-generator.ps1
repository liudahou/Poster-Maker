# ============================================================
# Lecture Poster Generator - one-click launcher
#
# Usage:
#   1. Recommended: double-click "讲座海报生成器.cmd".
#   2. Or run:
#      powershell -NoProfile -ExecutionPolicy Bypass -File .\launch-poster-generator.ps1
#   3. This script cd's to the project folder automatically.
#   4. It checks ports from 3000 upward and selects a free port.
#   5. Next.js dev starts both the frontend and backend API routes.
#   6. The default browser opens after the service is ready.
#   7. Close this window to stop the service.
# ============================================================

$ErrorActionPreference = "Stop"

$ProjectDir = "C:\Users\sangu\Documents\Codex\2026-05-31\files-mentioned-by-the-user-222e2ac9252eb153876e248c89502f8"
$NodeDir = Join-Path $ProjectDir "tools\node-v24.15.0-win-x64"
$NpmCmd = Join-Path $NodeDir "npm.cmd"

function Test-PortFree {
  param([int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  return $false
}

if (!(Test-Path $ProjectDir)) {
  throw "Project folder does not exist: $ProjectDir"
}

if (!(Test-Path $NpmCmd)) {
  throw "npm.cmd was not found. Please check tools\node-v24.15.0-win-x64."
}

Set-Location $ProjectDir

$port = 3000
while (!(Test-PortFree -Port $port)) {
  Write-Host "Port $port is already in use. Trying the next port..."
  $port++
}

$url = "http://localhost:$port"

Write-Host "Project folder: $ProjectDir"
Write-Host "Selected port: $port"
Write-Host "Starting frontend and backend API routes with Next.js..."

$processInfo = [System.Diagnostics.ProcessStartInfo]::new()
$processInfo.FileName = $env:ComSpec
$processInfo.Arguments = "/d /s /c ""set ""PATH=$NodeDir;%PATH%"" && ""$NpmCmd"" run dev -- -p $port"""
$processInfo.WorkingDirectory = $ProjectDir
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $false

$process = [System.Diagnostics.Process]::Start($processInfo)

if (Wait-HttpReady -Url $url -TimeoutSeconds 90) {
  Write-Host "Service is ready: $url"

  if ($env:POSTER_GENERATOR_TEST -eq "1") {
    Write-Host "Test mode: service verified. Stopping dev server."
    Stop-Process -Id $process.Id -Force
    exit 0
  }

  Start-Process $url
} else {
  if ($process.HasExited) {
    throw "Dev server exited before it became ready. Check the log above."
  }
  Write-Host "Service is taking longer than expected. Check the log above. Browser was not opened automatically."
}

if (!$process.HasExited) {
  Wait-Process -Id $process.Id
}
