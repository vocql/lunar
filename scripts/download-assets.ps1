# Windows version of download-assets.sh. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\download-assets.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$tex = 'assets/space/textures'; $mod = 'assets/space/models'
New-Item -ItemType Directory -Force -Path $tex, $mod | Out-Null
$sss = 'https://www.solarsystemscope.com/textures/download'
$files = @('2k_sun.jpg','8k_sun.jpg','2k_mercury.jpg','8k_mercury.jpg','2k_venus_atmosphere.jpg','4k_venus_atmosphere.jpg',
  '2k_earth_daymap.jpg','8k_earth_daymap.jpg','2k_earth_nightmap.jpg','8k_earth_nightmap.jpg','2k_earth_clouds.jpg','8k_earth_clouds.jpg',
  '2k_moon.jpg','8k_moon.jpg','2k_mars.jpg','8k_mars.jpg','2k_jupiter.jpg','8k_jupiter.jpg','2k_saturn.jpg','8k_saturn.jpg',
  '2k_saturn_ring_alpha.png','8k_saturn_ring_alpha.png','2k_uranus.jpg','2k_neptune.jpg','2k_stars_milky_way.jpg','8k_stars_milky_way.jpg')
function Get-Asset($url, $dest) {
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 0)) { Write-Host "  have  $dest"; return }
  Write-Host "  get   $dest"
  Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent 'Mozilla/5.0 (LUNAR asset downloader)'
}
Write-Host 'Solar System Scope textures (CC BY 4.0)'
foreach ($f in $files) {
  try { Get-Asset "$sss/$f" "$tex/$f" }
  catch {
    # fall back to the identical file on Wikimedia Commons
    $n = "Solarsystemscope_texture_$f"
    $h = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($n))).Replace('-','').ToLower()
    Get-Asset "https://upload.wikimedia.org/wikipedia/commons/$($h[0])/$($h.Substring(0,2))/$n" "$tex/$f"
  }
}
Write-Host 'NASA/JPL-Caltech Curiosity rover model'
Get-Asset 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24584_Curiosity_static.glb' "$mod/curiosity.glb"
Write-Host 'Done.'
