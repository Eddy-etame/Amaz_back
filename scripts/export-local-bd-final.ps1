param(
  [string]$MysqlUser = "root",
  [Parameter(Mandatory = $true)]
  [string]$MysqlPassword,
  [string]$MysqlDatabase = "bd_final_projet_annuel",
  [string]$MongoUri = "mongodb://host.docker.internal:27017/bd_final_projet_annuel",
  [string]$OutputDir = "db/dumps"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$mysqlDumpPath = Join-Path $OutputDir "mysql-local-$MysqlDatabase-$stamp.sql"
$mongoDump = Join-Path $OutputDir "mongo-local-$MysqlDatabase-$stamp.archive"

$mysqldumpExe = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
if (-not (Test-Path $mysqldumpExe)) {
  throw "mysqldump.exe introuvable: $mysqldumpExe"
}

Write-Host "Export MySQL local: $MysqlDatabase"
$mysqlArgs = @("-u$MysqlUser", "-p$MysqlPassword", $MysqlDatabase)
& $mysqldumpExe @mysqlArgs | Set-Content -Path $mysqlDumpPath -Encoding UTF8
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $mysqlDumpPath) { Remove-Item $mysqlDumpPath -Force }
  throw "Echec export MySQL local. Verifie le nom utilisateur et le mot de passe."
}

Write-Host "Export MongoDB local: $MongoUri"
docker exec amaz-mongo mongodump --uri="$MongoUri" --archive=/tmp/bd_final_projet_annuel_local.archive
if ($LASTEXITCODE -ne 0) {
  throw "Echec export MongoDB local."
}
docker cp amaz-mongo:/tmp/bd_final_projet_annuel_local.archive $mongoDump
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $mongoDump) { Remove-Item $mongoDump -Force }
  throw "Echec copie dump MongoDB local."
}

Write-Host ""
Write-Host "Dumps locaux crees:"
Write-Host " - $mysqlDumpPath"
Write-Host " - $mongoDump"
