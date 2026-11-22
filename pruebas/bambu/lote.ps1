# Lamina todos los .3mf de una carpeta, uno tras otro, y junta los resultados en <carpeta>\lote.json.
# Uso (en segundo plano): powershell -NoProfile -ExecutionPolicy Bypass -File lote.ps1 -Carpeta <carpeta>
param([Parameter(Mandatory=$true)][string]$Carpeta)
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
Remove-Item (Join-Path $Carpeta "lote.json") -Force -ErrorAction SilentlyContinue
$todo = [ordered]@{}
Get-ChildItem $Carpeta -Filter *.3mf -File | Sort-Object Name | ForEach-Object {
  $sal = Join-Path $Carpeta ($_.BaseName + "_lam")
  & (Join-Path $aqui "laminar.ps1") -Entrada $_.FullName -Salida $sal
  $rj = Join-Path $sal "resultado.json"
  if (Test-Path $rj) { $todo[$_.BaseName] = (Get-Content $rj -Raw | ConvertFrom-Json) } else { $todo[$_.BaseName] = @{ ok = $false; error = "sin resultado.json" } }
}
[System.IO.File]::WriteAllText((Join-Path $Carpeta "lote.json"), ($todo | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
