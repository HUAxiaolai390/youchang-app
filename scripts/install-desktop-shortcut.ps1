[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string] $DestinationDirectory = [Environment]::GetFolderPath('Desktop'),

    [ValidateNotNullOrEmpty()]
    [string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedDestination = (Resolve-Path -LiteralPath $DestinationDirectory -ErrorAction Stop).Path
$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $resolvedDestination -PathType Container)) {
    throw "快捷方式目标文件夹不存在：$resolvedDestination"
}
if (-not (Test-Path -LiteralPath $resolvedProjectRoot -PathType Container)) {
    throw "有常项目文件夹不存在：$resolvedProjectRoot"
}

$startScript = Join-Path $resolvedProjectRoot 'scripts/start-youchang.ps1'
$iconPath = Join-Path $resolvedProjectRoot 'public/favicon.ico'
if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw "找不到有常启动脚本：$startScript"
}
if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
    throw "找不到有常图标：$iconPath"
}
$startScript = (Resolve-Path -LiteralPath $startScript -ErrorAction Stop).Path
$iconPath = (Resolve-Path -LiteralPath $iconPath -ErrorAction Stop).Path

$pwshCommands = @(Get-Command 'pwsh.exe' -CommandType Application -All -ErrorAction Stop)
if ($pwshCommands.Count -eq 0) {
    throw '找不到 PowerShell 7 pwsh.exe。'
}
$pwshPath = (Resolve-Path -LiteralPath $pwshCommands[0].Source -ErrorAction Stop).Path
if ([System.IO.Path]::GetFileName($pwshPath) -ine 'pwsh.exe') {
    throw "PowerShell 7 路径无效：$pwshPath"
}

$shortcutPath = Join-Path $resolvedDestination '启动有常.lnk'
$shortcutArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $startScript
$shell = $null
$shortcut = $null
try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $pwshPath
    $shortcut.Arguments = $shortcutArguments
    $shortcut.WorkingDirectory = $resolvedProjectRoot
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = '启动有常'
    $shortcut.Save()
}
finally {
    if ($null -ne $shortcut) {
        [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
    }
    if ($null -ne $shell) {
        [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    }
}

if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
    throw "创建桌面快捷方式失败：$shortcutPath"
}

Write-Output $shortcutPath
