function Test-YouchangPage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        $html = [string] $response.Content
        $hasTitle = $html -match '(?is)<title\b[^>]*>\s*有常\s*</title>'
        $hasRoot = $html -match '(?is)<[a-z][a-z0-9:-]*\b[^>]*\bid\s*=\s*(?:"root"|''root''|root)(?=\s|/?>)[^>]*>'
        return ($hasTitle -and $hasRoot)
    }
    catch {
        return $false
    }
}
