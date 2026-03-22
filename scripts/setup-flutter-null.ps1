param(
  [string]$ProjectDir = "null_app",
  [string]$Org = "com.aura.music"
)

$ErrorActionPreference = "Stop"

function Assert-Flutter {
  if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Host "Flutter SDK not found in PATH." -ForegroundColor Red
    Write-Host "Install Flutter, then re-run this script:" -ForegroundColor Yellow
    Write-Host "  https://docs.flutter.dev/get-started/install/windows" -ForegroundColor Yellow
    exit 1
  }
}

function Copy-Tree($Source, $Dest) {
  if (Test-Path $Dest) {
    Remove-Item -Recurse -Force $Dest
  }
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Copy-Item -Recurse -Force -Path (Join-Path $Source '*') -Destination $Dest
}

Assert-Flutter

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templateLib = Join-Path $root "flutter-template\lib"
$templateRes = Join-Path $root "flutter-template\android-res\app\src\main\res"

Push-Location $root

if (-not (Test-Path $templateLib)) {
  throw "Missing template at $templateLib"
}

if (-not (Test-Path $ProjectDir)) {
  Write-Host "Creating Flutter project at $ProjectDir (Android + Kotlin)..." -ForegroundColor Cyan
  flutter create --platforms=android --android-language kotlin --org $Org $ProjectDir
}

Write-Host "Adding dependencies..." -ForegroundColor Cyan
Push-Location $ProjectDir
flutter pub add http provider just_audio shared_preferences
flutter pub get
Pop-Location

Write-Host "Copying Dart UI template..." -ForegroundColor Cyan
Copy-Tree $templateLib (Join-Path $ProjectDir "lib")

Write-Host "Applying Android launcher icon resources..." -ForegroundColor Cyan
$destRes = Join-Path $ProjectDir "android\app\src\main\res"
New-Item -ItemType Directory -Force -Path $destRes | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $templateRes '*') -Destination $destRes

Write-Host "Setting Android app label to 'Null'..." -ForegroundColor Cyan
$stringsPath = Join-Path $ProjectDir "android\app\src\main\res\values\strings.xml"
if (Test-Path $stringsPath) {
  $xml = Get-Content $stringsPath -Raw
  $xml = $xml -replace '<string name="app_name">.*?</string>', '<string name="app_name">Null</string>'
  Set-Content -Path $stringsPath -Value $xml -Encoding UTF8
}

Write-Host "Done." -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  cd $ProjectDir" -ForegroundColor Yellow
Write-Host "  flutter run --dart-define=AURA_BASE_URL=http://10.0.2.2:3001" -ForegroundColor Yellow

Pop-Location
