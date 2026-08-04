function Start-YouchangServer {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $ProjectRoot,

        [string] $PnpmPath
    )

    $resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
    if ([string]::IsNullOrWhiteSpace($PnpmPath)) {
        $PnpmPath = (Get-Command 'pnpm.cmd' -ErrorAction Stop).Source
    }
    if (-not (Test-Path -LiteralPath $PnpmPath -PathType Leaf)) {
        throw "找不到 pnpm.cmd：$PnpmPath"
    }

    $logDirectory = Join-Path $resolvedProjectRoot '.youchang/logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $logStamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
    $stdoutLog = Join-Path $logDirectory "server-$logStamp-stdout.log"
    $stderrLog = Join-Path $logDirectory "server-$logStamp-stderr.log"
    $arguments = @('dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort')

    return Start-Process -FilePath $PnpmPath `
        -ArgumentList $arguments `
        -WorkingDirectory $resolvedProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru
}
