param(
  [string]$OutputDir = ".\backups"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$target = Join-Path $OutputDir $timestamp
New-Item -ItemType Directory -Force -Path $target | Out-Null

$docker = "C:\Users\polni\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"

$postgresPath = Join-Path $target "postgres.sql"
$minioPath = Join-Path $target "minio.tar.gz"

& $docker compose exec -T postgres pg_dump -U flow flow | Out-File -Encoding utf8 $postgresPath
cmd /c "`"$docker`" compose exec -T minio sh -c `"tar -C /data -czf - .`" > `"$minioPath`""

Compress-Archive -Path (Join-Path $target "*") -DestinationPath (Join-Path $OutputDir "flow-backup-$timestamp.zip") -Force
Write-Host "Backup created:" (Join-Path $OutputDir "flow-backup-$timestamp.zip")
