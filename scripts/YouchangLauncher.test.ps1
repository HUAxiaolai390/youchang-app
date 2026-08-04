$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'YouchangLauncher.psm1') -Force

function Assert-True {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Get-TestPort {
    $probe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, 0)
    $probe.Start()
    $port = $probe.LocalEndpoint.Port
    $probe.Stop()
    return $port
}

function Start-TestListener {
    param([string] $TemporaryDirectory)

    $port = Get-TestPort
    $healthyPath = Join-Path $TemporaryDirectory 'healthy.html'
    $otherPath = Join-Path $TemporaryDirectory 'other.html'
    $readyPath = Join-Path $TemporaryDirectory 'listener.ready'
    Set-Content -LiteralPath $healthyPath -Encoding UTF8 -Value '<!doctype html><title>有常</title><div id="root"></div>'
    Set-Content -LiteralPath $otherPath -Encoding UTF8 -Value '<!doctype html><title>别的应用</title><div id="root"></div>'

    $listenerScript = Join-Path $PSScriptRoot 'YouchangLauncher.TestListener.ps1'
    $job = Start-Job -FilePath $listenerScript -ArgumentList $port, $healthyPath, $otherPath, $readyPath
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
        HealthyUrl = "http://127.0.0.1:$port/"
        OtherUrl = "http://127.0.0.1:$port/other"
    }
}

function Stop-TestListener {
    param($Server)
    if ($null -eq $Server) {
        return
    }

    try {
        if ($Server.Job.State -eq 'Running') {
            Invoke-WebRequest -Uri ($Server.HealthyUrl + '?shutdown=1') -TimeoutSec 2 -UseBasicParsing | Out-Null
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

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('youchang-launcher-test-' + [guid]::NewGuid().ToString('N'))
$server = $null
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $server = Start-TestListener -TemporaryDirectory $testRoot

    Assert-True (Test-YouchangPage -Url $server.HealthyUrl) 'The 有常 page is recognized.'
    Assert-True (-not (Test-YouchangPage -Url $server.OtherUrl)) 'A different app is rejected.'
    Assert-True (Wait-YouchangReady -Url $server.HealthyUrl -TimeoutSeconds 2) 'The healthy page becomes ready.'
    $unusedPort = Get-TestPort
    Assert-True (-not (Wait-YouchangReady -Url "http://127.0.0.1:$unusedPort/" -TimeoutSeconds 1)) 'Readiness returns false when its timeout expires.'

    $fakePnpmPath = Join-Path $testRoot 'pnpm.cmd'
    Set-Content -LiteralPath $fakePnpmPath -Encoding Ascii -Value '@echo %*'
    $process = Start-YouchangServer -ProjectRoot $testRoot -PnpmPath $fakePnpmPath
    Assert-True ($process.WaitForExit(5000)) 'The injected pnpm.cmd process exits.'

    $logs = Get-ChildItem -LiteralPath (Join-Path $testRoot '.youchang/logs') -File
    Assert-True (($logs | Where-Object Name -Like '*-stdout.log').Count -eq 1) 'A separate stdout log is created.'
    Assert-True (($logs | Where-Object Name -Like '*-stderr.log').Count -eq 1) 'A separate stderr log is created.'
    $stdoutLog = $logs | Where-Object Name -Like '*-stdout.log'
    Assert-True ((Get-Content -LiteralPath $stdoutLog.FullName -Raw).Trim() -eq 'dev -- --host 127.0.0.1 --port 5173 --strictPort') 'The fixed strict-port arguments are passed unchanged.'

    $exports = @(Get-Command -Module YouchangLauncher | Select-Object -ExpandProperty Name | Sort-Object)
    Assert-True (($exports -join ',') -eq 'Start-YouchangServer,Test-YouchangPage,Wait-YouchangReady') 'Only the required functions are exported.'
}
finally {
    Stop-TestListener $server
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Output 'Youchang launcher module tests passed'
