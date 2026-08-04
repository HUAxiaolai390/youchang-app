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

function Test-PowerShell7Executable {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or
        [System.IO.Path]::GetFileName($Path) -ine 'pwsh.exe') {
        return $false
    }

    try {
        $marker = @(& $Path -NoLogo -NoProfile -NonInteractive -Command 'if ($PSVersionTable.PSVersion.Major -ge 7) { [Console]::Out.Write("YouchangPwsh7") } else { exit 1 }' 2>$null) -join ''
        return ($LASTEXITCODE -eq 0 -and $marker -eq 'YouchangPwsh7')
    }
    catch {
        return $false
    }
}

function Test-VersionedWindowsAppsPackagePath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $windowsAppsRoot = [System.IO.Path]::GetFullPath((Join-Path $env:ProgramFiles 'WindowsApps')).TrimEnd('\') + '\'
    $candidatePath = [System.IO.Path]::GetFullPath($Path)
    return $candidatePath.StartsWith($windowsAppsRoot, [System.StringComparison]::OrdinalIgnoreCase)
}

$pwshPath = $null
$localApplicationData = [Environment]::GetFolderPath('LocalApplicationData')
if (-not [string]::IsNullOrWhiteSpace($localApplicationData)) {
    $stableStoreAlias = Join-Path $localApplicationData 'Microsoft/WindowsApps/pwsh.exe'
    if (Test-PowerShell7Executable -Path $stableStoreAlias) {
        $pwshPath = [System.IO.Path]::GetFullPath($stableStoreAlias)
    }
}

if ($null -eq $pwshPath) {
    $pwshCommands = @(Get-Command 'pwsh.exe' -CommandType Application -All -ErrorAction SilentlyContinue)
    foreach ($pwshCommand in $pwshCommands) {
        if ([string]::IsNullOrWhiteSpace($pwshCommand.Source)) {
            continue
        }

        $resolvedCandidate = Resolve-Path -LiteralPath $pwshCommand.Source -ErrorAction SilentlyContinue
        if ($null -eq $resolvedCandidate) {
            continue
        }
        $candidatePath = $resolvedCandidate.Path
        if ((Test-VersionedWindowsAppsPackagePath -Path $candidatePath)) {
            continue
        }
        if (Test-PowerShell7Executable -Path $candidatePath) {
            $pwshPath = $candidatePath
            break
        }
    }
}

if ($null -eq $pwshPath) {
    throw '找不到可长期使用的 PowerShell 7 pwsh.exe。请启用 PowerShell 的“应用执行别名”，或安装非版本化路径的 PowerShell 7。'
}

$shortcutPath = Join-Path $resolvedDestination '启动有常.lnk'
$shortcutArguments = '-NoProfile -File "{0}"' -f $startScript
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
    # Keep the launcher unobtrusive without using the Hidden + Bypass pattern
    # that endpoint-security products commonly quarantine in desktop links.
    $shortcut.WindowStyle = 7
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
