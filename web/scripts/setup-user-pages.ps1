# Generates an SSH deploy key for tariqjaradat12.github.io (run once).
$ErrorActionPreference = 'Stop'

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$keyDir = Join-Path $root '.user-pages-deploy-key'
$privateKey = Join-Path $keyDir 'gh_pages_deploy'
$publicKey = "$privateKey.pub"

New-Item -ItemType Directory -Force -Path $keyDir | Out-Null

if (-not (Test-Path $privateKey)) {
  ssh-keygen -t ed25519 -f $privateKey -N '""' -C 'lut-lab-user-pages'
}

Write-Host ''
Write-Host '=== PUBLIC KEY (add to tariqjaradat12.github.io deploy keys) ===' -ForegroundColor Cyan
Write-Host ''
Get-Content $publicKey
Write-Host ''
Write-Host 'GitHub: https://github.com/tariqjaradat12/tariqjaradat12.github.io/settings/keys' -ForegroundColor Yellow
Write-Host '  Title: LUT_LAB deploy' -ForegroundColor Yellow
Write-Host '  Allow write access: ON' -ForegroundColor Yellow
Write-Host ''
Write-Host '=== PRIVATE KEY (LUT_LAB repo secret GH_PAGES_DEPLOY_KEY) ===' -ForegroundColor Cyan
Write-Host ''
Get-Content $privateKey
Write-Host ''
Write-Host 'GitHub: https://github.com/tariqjaradat12/LUT_LAB/settings/secrets/actions' -ForegroundColor Yellow
Write-Host '  Name: GH_PAGES_DEPLOY_KEY' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Full guide: web/docs/USER_PAGES_SETUP.md' -ForegroundColor Green
