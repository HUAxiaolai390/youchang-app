$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot 'install-desktop-shortcut.ps1'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw 'install-desktop-shortcut.ps1 does not exist.'
}

function Assert-True {
    param([bool] $Condition, [string] $Message)

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Assert-Equal {
    param($Actual, $Expected, [string] $Message)

    if ($Actual -cne $Expected) {
        throw "Assertion failed: $Message`nExpected: $Expected`nActual:   $Actual"
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('youchang-shortcut-test-' + [guid]::NewGuid().ToString('N'))
$shell = $null
$shortcut = $null
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $sentinelPath = Join-Path $testRoot 'unrelated-desktop-item.txt'
    Set-Content -LiteralPath $sentinelPath -Encoding UTF8 -Value 'keep me'

    $projectRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
    $startScript = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'scripts/start-youchang.ps1')).Path
    $iconPath = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'public/favicon.ico')).Path
    $stablePwshAlias = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Microsoft/WindowsApps/pwsh.exe'
    $hasStablePwshAlias = Test-Path -LiteralPath $stablePwshAlias -PathType Leaf
    Assert-True $hasStablePwshAlias 'This machine exposes the stable PowerShell Store App Execution Alias used by the regression test.'
    $expectedArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $startScript
    $shortcutPath = Join-Path $testRoot '启动有常.lnk'

    $output = @(& $installer -DestinationDirectory $testRoot -ProjectRoot $projectRoot)

    Assert-True (Test-Path -LiteralPath $shortcutPath -PathType Leaf) 'The exact shortcut name is created.'
    Assert-Equal $output[-1] $shortcutPath 'The installer prints the final absolute shortcut path.'
    Assert-True (Test-Path -LiteralPath $sentinelPath -PathType Leaf) 'An unrelated destination item is preserved.'

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    Assert-Equal $shortcut.TargetPath $stablePwshAlias 'The target is the stable PowerShell 7 App Execution Alias, not a versioned package path.'
    Assert-Equal ([System.IO.Path]::GetFileName($shortcut.TargetPath)) 'pwsh.exe' 'The target is not Windows PowerShell 5.1.'
    Assert-Equal $shortcut.Arguments $expectedArguments 'The hidden launch arguments contain the quoted absolute start script.'
    Assert-Equal $shortcut.WorkingDirectory $projectRoot 'The working directory is the exact project root.'
    Assert-Equal $shortcut.IconLocation "$iconPath,0" 'The icon is the exact project favicon at icon index zero.'

    # Saving the exact link again must remain idempotent and preserve unrelated items.
    $secondOutput = @(& $installer -DestinationDirectory $testRoot -ProjectRoot $projectRoot)
    Assert-Equal $secondOutput[-1] $shortcutPath 'Reinstalling overwrites only the same shortcut path.'
    Assert-True (Test-Path -LiteralPath $sentinelPath -PathType Leaf) 'Reinstalling still preserves unrelated destination items.'
}
finally {
    if ($null -ne $shortcut) {
        [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
    }
    if ($null -ne $shell) {
        [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Output 'Youchang desktop shortcut installer tests passed'
