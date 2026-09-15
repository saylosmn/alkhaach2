# АЛХААЧ — release гарын үсгийн түлхүүр үүсгэнэ (нэг л удаа).
#
#   powershell -ExecutionPolicy Bypass -File scripts\make-keystore.ps1
#
# Үүссэн alkhaach-release.jks болон keystore.properties нь git-д ОРОХГҮЙ.
# ЭНЭ ФАЙЛЫГ САЙН ХАДГАЛААРАЙ — алдвал ижил багцын шинэчлэлт гаргаж чадахгүй.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root 'android'
$keystore = Join-Path $androidDir 'alkhaach-release.jks'
$propsFile = Join-Path $androidDir 'keystore.properties'

if (Test-Path $keystore) {
    Write-Host "Түлхүүр аль хэдийн байна: $keystore" -ForegroundColor Yellow
    exit 0
}

# keytool-ыг Android Studio-ийн JDK-аас олно
$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome 'bin\keytool.exe'))) {
    $candidates = @(
        "$env:ProgramFiles\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
        "$env:ProgramFiles\Android\Android Studio\jre"
    )
    $javaHome = $candidates | Where-Object { Test-Path (Join-Path $_ 'bin\keytool.exe') } | Select-Object -First 1
}
if (-not $javaHome) { throw "JDK олдсонгүй. Android Studio суулгасан эсэхээ шалгана уу." }
$keytool = Join-Path $javaHome 'bin\keytool.exe'

$pass = Read-Host "Түлхүүрийн нууц үг (доод тал нь 6 тэмдэгт)" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
if ($plain.Length -lt 6) { throw "Нууц үг хэт богино байна." }

& $keytool -genkeypair -v `
    -keystore $keystore `
    -alias alkhaach `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $plain -keypass $plain `
    -dname "CN=Alkhaach, OU=Mobile, O=Alkhaach, L=Ulaanbaatar, C=MN"
if ($LASTEXITCODE -ne 0) { throw "keytool амжилтгүй боллоо." }

@"
storeFile=$($keystore -replace '\','\')
storePassword=$plain
keyAlias=alkhaach
keyPassword=$plain
"@ | Set-Content -Path $propsFile -Encoding utf8

Write-Host ""
Write-Host "Бэлэн:" -ForegroundColor Green
Write-Host "  $keystore"
Write-Host "  $propsFile"
Write-Host "Эдгээрийг нөөцөлж хадгална уу — алдвал шинэчлэлт гаргах боломжгүй." -ForegroundColor Yellow
