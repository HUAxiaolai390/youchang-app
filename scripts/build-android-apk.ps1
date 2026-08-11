$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$androidTools = Join-Path $env:USERPROFILE ".youchang-android"
$javaHome = Get-ChildItem (Join-Path $androidTools "jdk") -Directory | Select-Object -First 1 -ExpandProperty FullName
$sdkRoot = Join-Path $androidTools "sdk"
$localGradle = Get-ChildItem (Join-Path $androidTools "gradle") -Recurse -Filter "gradle.bat" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not $javaHome -or -not (Test-Path $sdkRoot)) {
  throw "Android build tools were not found."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot

Push-Location (Join-Path $projectRoot "android")
try {
  if ($localGradle) {
    & $localGradle assembleDebug
  } else {
    & ".\gradlew.bat" assembleDebug
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Android package build failed."
  }
} finally {
  Pop-Location
}

$outputDirectory = Join-Path $projectRoot "outputs"
$apkSource = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
$apkDestination = Join-Path $outputDirectory "youchang-android-test.apk"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Copy-Item -LiteralPath $apkSource -Destination $apkDestination -Force
Write-Output $apkDestination
