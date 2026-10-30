#!/usr/bin/env bash
# Downloads LUNAR's real space assets from their original sources into assets/space/.
#   Textures: Solar System Scope (CC BY 4.0, based on NASA data) https://www.solarsystemscope.com/textures/
#   Rover:    NASA/JPL-Caltech Curiosity glTF https://science.nasa.gov/resource/curiosity-rover-3d-model/
# Usage: bash scripts/download-assets.sh        (skips files you already have)
set -euo pipefail
cd "$(dirname "$0")/.."
TEX=assets/space/textures; MOD=assets/space/models
mkdir -p "$TEX" "$MOD"
UA="Mozilla/5.0 (LUNAR asset downloader)"
SSS=https://www.solarsystemscope.com/textures/download
FILES=(
  2k_sun.jpg 8k_sun.jpg
  2k_mercury.jpg 8k_mercury.jpg
  2k_venus_atmosphere.jpg 4k_venus_atmosphere.jpg
  2k_earth_daymap.jpg 8k_earth_daymap.jpg
  2k_earth_nightmap.jpg 8k_earth_nightmap.jpg
  2k_earth_clouds.jpg 8k_earth_clouds.jpg
  2k_moon.jpg 8k_moon.jpg
  2k_mars.jpg 8k_mars.jpg
  2k_jupiter.jpg 8k_jupiter.jpg
  2k_saturn.jpg 8k_saturn.jpg
  2k_saturn_ring_alpha.png 8k_saturn_ring_alpha.png
  2k_uranus.jpg 2k_neptune.jpg
  2k_stars_milky_way.jpg 8k_stars_milky_way.jpg
)
fetch () { # url dest
  if [ -s "$2" ]; then echo "  have  $2"; return 0; fi
  echo "  get   $2"
  curl -fL --retry 3 --retry-delay 2 -A "$UA" -o "$2.part" "$1" && mv "$2.part" "$2" || { rm -f "$2.part"; echo "  FAILED $1" >&2; return 1; }
}
fail=0
echo "Solar System Scope textures (CC BY 4.0)"
WIKI_PREFIX="Solarsystemscope_texture_"
for f in "${FILES[@]}"; do
  if ! fetch "$SSS/$f" "$TEX/$f"; then
    # fall back to the identical file on Wikimedia Commons
    n="${WIKI_PREFIX}${f}"; h=$(printf '%s' "$n" | md5sum | cut -c1-32)
    fetch "https://upload.wikimedia.org/wikipedia/commons/${h:0:1}/${h:0:2}/${n}" "$TEX/$f" || fail=1
  fi
done
echo "NASA/JPL-Caltech Curiosity rover model"
fetch "https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24584_Curiosity_static.glb" "$MOD/curiosity.glb" || fail=1
if [ "$fail" = 1 ]; then echo "Some downloads failed. Re-run the script to retry." >&2; exit 1; fi
echo "Done."
