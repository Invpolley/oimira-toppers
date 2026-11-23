# Lamina un proyecto .3mf con el Bambu Studio real (modo linea de comandos, sin ventanas) y resume el resultado.
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File laminar.ps1 -Entrada <ruta.3mf> -Salida <carpeta>
# Escribe <carpeta>\resultado.json. Trabaja sobre una copia; no toca la configuracion de Bambu Studio.
# Averiguado el 22-11-2026 con Bambu Studio 02.09.01.70 (ver docs/superpowers/notas/2026-11-22-bambu-cli.md).
param(
  [Parameter(Mandatory=$true)][string]$Entrada,
  [Parameter(Mandatory=$true)][string]$Salida,
  [string]$Exe = "C:\Program Files\Bambu Studio\bambu-studio.exe",
  [int]$EsperaSeg = 240
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Leer-Entrada($zip, $nombre){
  $e = $zip.Entries | Where-Object { $_.FullName -eq $nombre } | Select-Object -First 1
  if (-not $e) { return $null }
  $r = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
  try { return $r.ReadToEnd() } finally { $r.Close() }
}
$res = [ordered]@{ ok = $false; error = ""; segundos = 0; gramos = 0; gramosPurga = 0; capas = 0; cambiosFilamento = 0; soportes = $false; avisos = ""; tiempos = @{}; filamentos = @(); partes = @() }
try {
  New-Item -ItemType Directory -Force $Salida | Out-Null
  Get-ChildItem $Salida -File | Where-Object { $_.Name -in "result.json","resultado.json","laminado.3mf","plate_1.gcode" } | Remove-Item -Force
  $copia = Join-Path $Salida "entrada.3mf"
  Copy-Item $Entrada $copia -Force
  $p = Start-Process -FilePath $Exe -ArgumentList @("--debug","2","--slice","0","--outputdir","`"$Salida`"","--export-3mf","laminado.3mf","`"$copia`"") -PassThru -WindowStyle Hidden
  $rj = Join-Path $Salida "result.json"
  $t0 = Get-Date
  # El proceso no siempre termina solo despues de escribir el resultado: se espera el archivo y luego se cierra.
  while (-not (Test-Path $rj) -and -not $p.HasExited -and ((Get-Date) - $t0).TotalSeconds -lt $EsperaSeg) { Start-Sleep -Milliseconds 500 }
  Start-Sleep -Seconds 2
  if (-not $p.HasExited) { try { $p.Kill() } catch {} }
  if (-not (Test-Path $rj)) { throw "Bambu Studio no escribio result.json (codigo de salida: $($p.ExitCode))" }
  $r = Get-Content $rj -Raw | ConvertFrom-Json
  $res.error = [string]$r.error_string
  if ($r.return_code -ne 0) { throw "Bambu Studio devolvio $($r.return_code): $($r.error_string)" }
  $pl = $r.sliced_plates[0]
  $res.segundos = [int][math]::Round($pl.total_predication)
  $res.cambiosFilamento = [int]$pl.filament_change_times
  $res.avisos = [string]$pl.warning_message
  $tt = [ordered]@{}; foreach ($pp in $pl.feature_type_times.PSObject.Properties) { $tt[$pp.Name] = [int][math]::Round($pp.Value) }; $res.tiempos = $tt
  $purga = 0.0; foreach ($f in $pl.filaments) { $purga += ([double]$f.total_used_g - [double]$f.main_used_g) }; $res.gramosPurga = [math]::Round($purga, 2)
  $zip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $Salida "laminado.3mf"))
  try {
    [xml]$si = Leer-Entrada $zip "Metadata/slice_info.config"
    $plate = $si.config.plate
    $meta = @{}; foreach ($m in $plate.metadata) { $meta[$m.key] = $m.value }
    $res.gramos = [double]$meta["weight"]
    $res.soportes = ($meta["support_used"] -eq "true")
    $res.filamentos = @($plate.filament | ForEach-Object { [ordered]@{ id = [int]$_.id; color = $_.color; gramos = [double]$_.used_g; boquilla = $_.group_id } })
    $rangos = @($plate.layer_filament_lists.layer_filament_list | ForEach-Object { ($_.layer_ranges -split " ")[-1] })
    if ($rangos.Count) { $res.capas = ([int](($rangos | Measure-Object -Maximum).Maximum)) + 1 }
    [xml]$ms = Leer-Entrada $zip "Metadata/model_settings.config"
    $res.partes = @($ms.config.object | ForEach-Object {
      $ob = $_; $extOb = ($ob.metadata | Where-Object { $_.key -eq "extruder" }).value
      $ob.part | ForEach-Object {
        $pt = $_
        $ext = ($pt.metadata | Where-Object { $_.key -eq "extruder" }).value
        $st = $pt.mesh_stat
        $rep = 0; foreach ($k in "edges_fixed","degenerate_facets","facets_removed","facets_reversed","backwards_edges") { $rep += [int]$st.$k }
        [ordered]@{ nombre = ($pt.metadata | Where-Object { $_.key -eq "name" }).value; extruder = $(if ($ext) { [int]$ext } else { $null }); extruderObjeto = $(if ($extOb) { [int]$extOb } else { $null }); caras = [int]$st.face_count; reparaciones = $rep }
      }
    })
  } finally { $zip.Dispose() }
  $res.ok = $true
} catch {
  $res.ok = $false
  if (-not $res.error -or $res.error -eq "Success.") { $res.error = $_.Exception.Message } else { $res.error = $res.error + " | " + $_.Exception.Message }
}
$json = $res | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $Salida "resultado.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
