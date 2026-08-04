$ErrorActionPreference = 'Stop'

$startScript = Join-Path $PSScriptRoot 'start-youchang.ps1'
if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw 'start-youchang.ps1 does not exist.'
}

function Assert-True {
    param([bool] $Condition, [string] $Message)

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function ConvertFrom-CodePoints {
    param([int[]] $CodePoints)

    return (-join [char[]] $CodePoints)
}

function Get-TestPort {
    $probe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, 0)
    $probe.Start()
    $port = $probe.LocalEndpoint.Port
    $probe.Stop()
    return $port
}

function Start-TestListener {
    param(
        [string] $TemporaryDirectory,
        [int] $Port = (Get-TestPort)
    )

    $healthyPath = Join-Path $TemporaryDirectory 'healthy.html'
    $otherPath = Join-Path $TemporaryDirectory 'other.html'
    $readyPath = Join-Path $TemporaryDirectory "listener-$Port.ready"
    $youchang = ConvertFrom-CodePoints @(0x6709, 0x5e38)
    $otherApp = ConvertFrom-CodePoints @(0x522b, 0x7684, 0x5e94, 0x7528)
    Set-Content -LiteralPath $healthyPath -Encoding UTF8 -Value ('<!doctype html><title>{0}</title><div id="root"></div>' -f $youchang)
    Set-Content -LiteralPath $otherPath -Encoding UTF8 -Value ('<!doctype html><title>{0}</title><div id="root"></div>' -f $otherApp)

    $listenerScript = Join-Path $PSScriptRoot 'YouchangLauncher.TestListener.ps1'
    $job = Start-Job -FilePath $listenerScript -ArgumentList $Port, $healthyPath, $otherPath, $readyPath
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    try {
        while (-not (Test-Path -LiteralPath $readyPath)) {
            if ($job.State -in @('Completed', 'Failed', 'Stopped')) {
                throw "Temporary HTTP listener stopped early: $(Receive-Job -Job $job)"
            }
            if ([DateTime]::UtcNow -ge $deadline) {
                throw 'Temporary HTTP listener did not become ready.'
            }
            Start-Sleep -Milliseconds 50
        }
    }
    catch {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        throw
    }

    return [pscustomobject]@{
        Job = $job
        Url = "http://127.0.0.1:$Port/"
    }
}

function Stop-TestListener {
    param($Server)

    if ($null -eq $Server) {
        return
    }

    try {
        if ($Server.Job.State -eq 'Running') {
            Invoke-WebRequest -Uri ($Server.Url + '?shutdown=1') -TimeoutSec 2 -UseBasicParsing | Out-Null
            if ($null -eq (Wait-Job -Job $Server.Job -Timeout 3)) {
                throw 'Temporary HTTP listener did not exit after shutdown.'
            }
        }
    }
    finally {
        Stop-Job -Job $Server.Job -ErrorAction SilentlyContinue
        Remove-Job -Job $Server.Job -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-StartScript {
    param(
        [string] $Url,
        [int] $TimeoutSeconds = 2,
        [string] $PnpmDirectory
    )

    $previousTestMode = $env:YOUCHANG_LAUNCHER_TEST_MODE
    $previousTestUrl = $env:YOUCHANG_LAUNCHER_TEST_URL
    $previousPath = $env:PATH
    try {
        $env:YOUCHANG_LAUNCHER_TEST_MODE = '1'
        $env:YOUCHANG_LAUNCHER_TEST_URL = $Url
        if ($PnpmDirectory) {
            $env:PATH = "$PnpmDirectory;$previousPath"
        }

        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = (Get-Command 'pwsh.exe' -ErrorAction Stop).Source
        $startInfo.Arguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -NoOpen -TimeoutSeconds {1}' -f $startScript, $TimeoutSeconds)
        $startInfo.UseShellExecute = $false
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        [void] $process.Start()
        $standardOutput = $process.StandardOutput.ReadToEnd()
        $standardError = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Output = $standardOutput + $standardError
        }
    }
    finally {
        $env:YOUCHANG_LAUNCHER_TEST_MODE = $previousTestMode
        $env:YOUCHANG_LAUNCHER_TEST_URL = $previousTestUrl
        $env:PATH = $previousPath
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('youchang-start-test-' + [guid]::NewGuid().ToString('N'))
$server = $null
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $server = Start-TestListener -TemporaryDirectory $testRoot

    $fakePnpmDirectory = Join-Path $testRoot 'fake-pnpm'
    New-Item -ItemType Directory -Path $fakePnpmDirectory | Out-Null
    $markerPath = Join-Path $testRoot 'pnpm-was-called.txt'
    $fakePnpmLines = @(
        ('@echo called>"{0}"' -f $markerPath)
    )
    Set-Content -LiteralPath (Join-Path $fakePnpmDirectory 'pnpm.cmd') -Encoding Ascii -Value $fakePnpmLines

    $healthyResult = Invoke-StartScript -Url $server.Url -PnpmDirectory $fakePnpmDirectory
    Assert-True ($healthyResult.ExitCode -eq 0) 'An already healthy Youchang page exits successfully.'
    Assert-True (-not (Test-Path -LiteralPath $markerPath)) 'An already healthy page does not start a second listener.'

    $otherResult = Invoke-StartScript -Url ($server.Url + 'other')
    Assert-True ($otherResult.ExitCode -eq 2) 'A non-Youchang page returns the occupied-port exit code.'
    $occupiedMessage = '5173 ' + (ConvertFrom-CodePoints @(0x7aef, 0x53e3, 0x6b63, 0x5728, 0x88ab, 0x5176, 0x4ed6, 0x7a0b, 0x5e8f, 0x4f7f, 0x7528))
    Assert-True ($otherResult.Output -match [regex]::Escape($occupiedMessage)) 'A non-Youchang page reports the Chinese occupied-port message.'
}
finally {
    Stop-TestListener $server
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Output 'Youchang start script tests passed'
