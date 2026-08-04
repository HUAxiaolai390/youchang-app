param(
    [Parameter(Mandatory = $true)]
    [int] $Port,
    [Parameter(Mandatory = $true)]
    [string] $HealthyHtmlPath,
    [Parameter(Mandatory = $true)]
    [string] $OtherHtmlPath,
    [Parameter(Mandatory = $true)]
    [string] $ReadyPath
)

$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
    [System.IO.File]::WriteAllText($ReadyPath, 'ready')
    $healthyBody = [System.IO.File]::ReadAllBytes($HealthyHtmlPath)
    $otherBody = [System.IO.File]::ReadAllBytes($OtherHtmlPath)

    while ($true) {
        $context = $listener.GetContext()
        $shouldStop = $context.Request.QueryString['shutdown'] -eq '1'
        $body = if ($context.Request.Url.AbsolutePath -eq '/other') { $otherBody } else { $healthyBody }
        $context.Response.StatusCode = 200
        $context.Response.ContentType = 'text/html; charset=utf-8'
        $context.Response.ContentLength64 = $body.Length
        $context.Response.OutputStream.Write($body, 0, $body.Length)
        $context.Response.Close()
        if ($shouldStop) {
            break
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
