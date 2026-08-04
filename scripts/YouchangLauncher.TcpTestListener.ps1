param(
    [Parameter(Mandatory = $true)]
    [int] $Port,
    [Parameter(Mandatory = $true)]
    [string] $ReadyPath,
    [Parameter(Mandatory = $true)]
    [string] $StopPath
)

$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $Port)

try {
    $listener.Start()
    [System.IO.File]::WriteAllText($ReadyPath, 'ready')
    while (-not (Test-Path -LiteralPath $StopPath)) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $client.Dispose()
        }
        else {
            Start-Sleep -Milliseconds 10
        }
    }
}
finally {
    $listener.Stop()
}
