param(
  [string]$OutputDir = "db/dumps"
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Assert-DockerAvailable {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker n'est pas installe ou n'est pas accessible dans ce terminal."
  }

  $oldErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & docker ps 1>$null 2>$null
  $dockerPsExitCode = $LASTEXITCODE
  $ErrorActionPreference = $oldErrorActionPreference

  if ($dockerPsExitCode -ne 0) {
    throw "Docker n'est pas accessible. Ouvre Docker Desktop, puis relance ce script."
  }
}

function Test-ContainerExists {
  param([string]$Name)

  $containerId = & docker ps -q -f "name=^/$Name$"
  if ($LASTEXITCODE -ne 0) {
    throw "Impossible de verifier le conteneur $Name."
  }
  return -not [string]::IsNullOrWhiteSpace($containerId)
}

function Assert-FileNotEmpty {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Le fichier $Path n'a pas ete cree."
  }
  if ((Get-Item $Path).Length -le 0) {
    throw "Le fichier $Path est vide."
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Assert-DockerAvailable

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$created = @()

if (Test-ContainerExists "amaz-mysql") {
  $mysqlDump = Join-Path $OutputDir "mysql-bd_final_projet_annuel-$stamp.sql"
  Write-Host "Creation du dump MySQL..."
  & docker exec amaz-mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > $mysqlDump
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path $mysqlDump) { Remove-Item $mysqlDump -Force }
    throw "Echec du dump MySQL depuis le conteneur amaz-mysql."
  }
  Assert-FileNotEmpty $mysqlDump
  $created += $mysqlDump
} elseif (Test-ContainerExists "amaz-postgres") {
  $postgresDump = Join-Path $OutputDir "postgres-amaz_db-$stamp.sql"
  Write-Host "Creation du dump PostgreSQL..."
  & docker exec amaz-postgres pg_dump -U amaz -d amaz_db > $postgresDump
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path $postgresDump) { Remove-Item $postgresDump -Force }
    throw "Echec du dump PostgreSQL depuis le conteneur amaz-postgres."
  }
  Assert-FileNotEmpty $postgresDump
  $created += $postgresDump
} else {
  throw "Aucun conteneur SQL trouve. Attendu: amaz-mysql ou amaz-postgres."
}

if (Test-ContainerExists "amaz-mongo") {
  $mongoDump = Join-Path $OutputDir "mongo-amaz_db-$stamp.archive"
  Write-Host "Creation du dump MongoDB..."
  & docker exec amaz-mongo mongodump --db=amaz_db --archive=/tmp/amaz_db.archive
  if ($LASTEXITCODE -ne 0) {
    throw "Echec du dump MongoDB depuis le conteneur amaz-mongo."
  }
  & docker cp amaz-mongo:/tmp/amaz_db.archive $mongoDump
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path $mongoDump) { Remove-Item $mongoDump -Force }
    throw "Echec de la copie du dump MongoDB."
  }
  Assert-FileNotEmpty $mongoDump
  $created += $mongoDump
} else {
  Write-Warning "Conteneur amaz-mongo introuvable: aucun dump MongoDB cree."
}

Write-Host ""
Write-Host "Dumps crees avec succes:"
foreach ($file in $created) {
  Write-Host " - $file"
}
Write-Host ""
Write-Host "Ces fichiers peuvent etre partages avec l'equipe si le projet scolaire l'autorise."
