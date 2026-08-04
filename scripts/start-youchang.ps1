[CmdletBinding()]
param(
    [switch] $NoOpen,

    [ValidateRange(1, [int]::MaxValue)]
    [int] $TimeoutSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:5173/'

# The override is intentionally opt-in and only for this script's isolated tests.
# Desktop shortcuts never set these variables, so their endpoint remains fixed.
if ($env:YOUCHANG_LAUNCHER_TEST_MODE -eq '1' -and -not [string]::IsNullOrWhiteSpace($env:YOUCHANG_LAUNCHER_TEST_URL)) {
    $url = $env:YOUCHANG_LAUNCHER_TEST_URL
}

Import-Module (Join-Path $PSScriptRoot 'YouchangLauncher.psm1') -Force

function ConvertFrom-CodePoints {
    param([int[]] $CodePoints)

    return (-join [char[]] $CodePoints)
}

$occupiedPortMessage = '5173 ' + (ConvertFrom-CodePoints @(0x7aef, 0x53e3, 0x6b63, 0x5728, 0x88ab, 0x5176, 0x4ed6, 0x7a0b, 0x5e8f, 0x4f7f, 0x7528, 0xff0c, 0x8bf7, 0x5173, 0x95ed, 0x8be5, 0x7a0b, 0x5e8f, 0x540e, 0x518d, 0x542f, 0x52a8, 0x6709, 0x5e38, 0x3002))
$missingPnpmMessage = ConvertFrom-CodePoints @(0x627e, 0x4e0d, 0x5230, 0x20, 0x70, 0x6e, 0x70, 0x6d, 0x3002, 0x8bf7, 0x5148, 0x5b89, 0x88c5, 0x20, 0x4e, 0x6f, 0x64, 0x65, 0x2e, 0x6a, 0x73, 0x20, 0x548c, 0x20, 0x70, 0x6e, 0x70, 0x6d, 0xff0c, 0x7136, 0x540e, 0x5728, 0x6709, 0x5e38, 0x9879, 0x76ee, 0x4e2d, 0x8fd0, 0x884c, 0x20, 0x70, 0x6e, 0x70, 0x6d, 0x20, 0x69, 0x6e, 0x73, 0x74, 0x61, 0x6c, 0x6c, 0x3002)
$startFailureMessage = ConvertFrom-CodePoints @(0x6709, 0x5e38, 0x542f, 0x52a8, 0x5931, 0x8d25, 0x3002, 0x8bf7, 0x67e5, 0x770b, 0x20, 0x2e, 0x79, 0x6f, 0x75, 0x63, 0x68, 0x61, 0x6e, 0x67, 0x2f, 0x6c, 0x6f, 0x67, 0x73, 0x20, 0x4e2d, 0x7684, 0x65e5, 0x5fd7, 0x540e, 0x91cd, 0x8bd5, 0x3002)
$timeoutMessage = ConvertFrom-CodePoints @(0x6709, 0x5e38, 0x672a, 0x80fd, 0x5728, 0x89c4, 0x5b9a, 0x65f6, 0x95f4, 0x5185, 0x542f, 0x52a8, 0x3002, 0x8bf7, 0x67e5, 0x770b, 0x20, 0x2e, 0x79, 0x6f, 0x75, 0x63, 0x68, 0x61, 0x6e, 0x67, 0x2f, 0x6c, 0x6f, 0x67, 0x73, 0x20, 0x4e2d, 0x7684, 0x65e5, 0x5fd7, 0x540e, 0x91cd, 0x8bd5, 0x3002)
$browserFailureMessage = ConvertFrom-CodePoints @(0x6709, 0x5e38, 0x5df2, 0x7ecf, 0x542f, 0x52a8, 0xff0c, 0x4f46, 0x65e0, 0x6cd5, 0x6253, 0x5f00, 0x6d4f, 0x89c8, 0x5668, 0x3002, 0x8bf7, 0x624b, 0x52a8, 0x8bbf, 0x95ee, 0x20, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f, 0x31, 0x32, 0x37, 0x2e, 0x30, 0x2e, 0x30, 0x2e, 0x31, 0x3a, 0x35, 0x31, 0x37, 0x33, 0x2f, 0x3002)

function Exit-LaunchFailure {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Message,

        [Parameter(Mandatory = $true)]
        [int] $ExitCode
    )

    if ($NoOpen) {
        [Console]::Error.WriteLine($Message)
    }
    else {
        try {
            Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
            [System.Windows.Forms.MessageBox]::Show(
                $Message,
                (ConvertFrom-CodePoints @(0x542f, 0x52a8, 0x6709, 0x5e38)),
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            ) | Out-Null
        }
        catch {
            [Console]::Error.WriteLine($Message)
        }
    }

    exit $ExitCode
}

function Test-LauncherEndpointResponds {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Url
    )

    try {
        $endpoint = [System.Uri]::new($Url, [System.UriKind]::Absolute)
        if ([string]::IsNullOrWhiteSpace($endpoint.DnsSafeHost) -or $endpoint.Port -le 0) {
            return $false
        }
    }
    catch {
        return $false
    }

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        # Test-YouchangPage already performed the bounded HTTP recognition step.
        # A TCP connect catches non-HTTP owners, including services that hang or
        # close immediately after accepting a connection.
        $connectTask = $client.ConnectAsync($endpoint.DnsSafeHost, $endpoint.Port)
        return $connectTask.Wait(750)
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Open-YouchangPage {
    if (-not $NoOpen) {
        Start-Process -FilePath $url -ErrorAction Stop
    }
}

if (Test-YouchangPage -Url $url) {
    try {
        Open-YouchangPage
        exit 0
    }
    catch {
        Exit-LaunchFailure -Message $browserFailureMessage -ExitCode 4
    }
}

if (Test-LauncherEndpointResponds -Url $url) {
    Exit-LaunchFailure -Message $occupiedPortMessage -ExitCode 2
}

try {
    $pnpmPath = (Get-Command 'pnpm.cmd' -ErrorAction Stop).Source
}
catch {
    Exit-LaunchFailure -Message $missingPnpmMessage -ExitCode 3
}

try {
    Start-YouchangServer -ProjectRoot $projectRoot -PnpmPath $pnpmPath | Out-Null
}
catch {
    Exit-LaunchFailure -Message $startFailureMessage -ExitCode 4
}

if (-not (Wait-YouchangReady -Url $url -TimeoutSeconds $TimeoutSeconds)) {
    Exit-LaunchFailure -Message $timeoutMessage -ExitCode 4
}

try {
    Open-YouchangPage
    exit 0
}
catch {
    Exit-LaunchFailure -Message $browserFailureMessage -ExitCode 4
}
