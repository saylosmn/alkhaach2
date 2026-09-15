# АЛХААЧ — APK-г ШУУД угсарна (EAS / Expo cloud хэрэггүй, интернэт зөвхөн
# анхны Gradle татахад л хэрэгтэй).
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Clean
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -BackendUrl https://alkhaach2.onrender.com
#
# Үр дүн: frontend\alkhaach.apk  (утсандаа хуулаад суулгана)

param(
    [switch]$Clean,
    [string]$BackendUrl
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# --- 1. Backend URL --------------------------------------------------------
$envFile = Join-Path $root '.env'
if ($BackendUrl) {
    $clean = $BackendUrl.TrimEnd('/')
    @"
# Render дээрх backend-ийн хаяг (сүүлийн / байхгүй).
# Энэ утга APK дотор шууд шигтгэгдэнэ — өөрчилсөн бол APK-г дахин угсарна.
EXPO_PUBLIC_BACKEND_URL=$clean
"@ | Set-Content -Path $envFile -Encoding utf8
}
if (-not (Test-Path $envFile)) {
    throw ".env олдсонгүй. -BackendUrl https://... гэж дамжуулна уу."
}
$url = (Select-String -Path $envFile -Pattern '^EXPO_PUBLIC_BACKEND_URL=(.+)$').Matches.Groups[1].Value
Write-Host "Backend: $url" -ForegroundColor Cyan

# --- 2. JDK ----------------------------------------------------------------
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $candidates = @(
        "$env:ProgramFiles\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
        "$env:ProgramFiles\Android\Android Studio\jre"
    )
    $found = $candidates | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
    if (-not $found) { throw "JDK олдсонгүй. Android Studio суулгана уу (JBR дагалдана)." }
    $env:JAVA_HOME = $found
}
Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Cyan

# --- 3. Android SDK --------------------------------------------------------
$localProps = Join-Path $root 'android\local.properties'
if (-not (Test-Path $localProps)) {
    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
    if (-not (Test-Path $sdk)) { throw "Android SDK олдсонгүй: $sdk" }
    "sdk.dir=$($sdk -replace '\','\')" | Set-Content -Path $localProps -Encoding ascii
}

# --- 4. node_modules -------------------------------------------------------
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host "node_modules суулгаж байна..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { throw "npm install амжилтгүй." }
}

# --- 5. Gradle -------------------------------------------------------------
Set-Location (Join-Path $root 'android')
$task = if ($Clean) { @('clean', 'assembleRelease') } else { @('assembleRelease') }
Write-Host "Gradle: $($task -join ' ') (эхний удаа 10-20 мин үргэлжилж болно)" -ForegroundColor Yellow
& .\gradlew.bat @task --no-daemon
if ($LASTEXITCODE -ne 0) { Set-Location $root; throw "Gradle build амжилтгүй." }
Set-Location $root

# --- 6. Үр дүн -------------------------------------------------------------
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $apk)) { throw "APK олдсонгүй: $apk" }
$out = Join-Path $root 'alkhaach.apk'
Copy-Item $apk $out -Force
$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)

Write-Host ""
Write-Host "APK бэлэн: $out ($mb MB)" -ForegroundColor Green
Write-Host "Утсандаа хуулж суулгана уу («Үл мэдэгдэх эх сурвалж»-ийг зөвшөөрнө)." -ForegroundColor Green
Write-Host "USB-тэй бол: adb install -r `"$out`"" -ForegroundColor Gray
