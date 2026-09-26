$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$signingDirectory = Join-Path $projectRoot "signing"
$keystorePath = Join-Path $signingDirectory "youchang-release.jks"
$passwordPath = Join-Path $signingDirectory "release-password.txt"
$keyAlias = "youchang"

if (-not (Test-Path -LiteralPath $keystorePath)) {
  throw "Release keystore not found: $keystorePath"
}
if (-not (Test-Path -LiteralPath $passwordPath)) {
  throw "Release keystore password file not found: $passwordPath"
}

$password = (Get-Content -LiteralPath $passwordPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "Release keystore password file is empty."
}

$androidBuildFile = Join-Path $projectRoot "android\app\build.gradle"
$versionMatch = Select-String -Path $androidBuildFile -Pattern 'versionName\s+"([^"]+)"' | Select-Object -First 1
if (-not $versionMatch -or -not $versionMatch.Matches[0].Groups[1].Value) {
  throw "Android versionName was not found in $androidBuildFile"
}
$versionName = $versionMatch.Matches[0].Groups[1].Value

$androidTools = Join-Path $env:USERPROFILE ".youchang-android"
$javaHome = Get-ChildItem (Join-Path $androidTools "jdk") -Directory | Select-Object -First 1 -ExpandProperty FullName
$sdkRoot = Join-Path $androidTools "sdk"
$localGradle = Get-ChildItem (Join-Path $androidTools "gradle") -Recurse -Filter "gradle.bat" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not $javaHome -or -not (Test-Path -LiteralPath $sdkRoot)) {
  throw "Android build tools were not found."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:YOUCHANG_RELEASE_KEYSTORE = $keystorePath
$env:YOUCHANG_RELEASE_STORE_PASSWORD = $password
$env:YOUCHANG_RELEASE_KEY_ALIAS = $keyAlias
$env:YOUCHANG_RELEASE_KEY_PASSWORD = $password

Push-Location (Join-Path $projectRoot "android")
try {
  if ($localGradle) {
    & $localGradle assembleRelease
  } else {
    & ".\gradlew.bat" assembleRelease
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Signed Android package build failed."
  }
} finally {
  Pop-Location
}

$outputDirectory = Join-Path $projectRoot "outputs"
$apkSource = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
$apkDestination = Join-Path $outputDirectory "youchang-v$versionName-android-release.apk"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Copy-Item -LiteralPath $apkSource -Destination $apkDestination -Force
Write-Output $apkDestination
