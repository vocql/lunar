/* LUNAR – external asset manifest.
   Every file here is downloaded from its original source by scripts/download-assets.sh
   (or the GitHub Action) into assets/space/. Nothing here is AI-generated. */
window.LUNAR_ASSETS = {
  base: 'assets/space/',

  // Solar System Scope textures: CC BY 4.0, based on NASA elevation and imagery data.
  // Source: https://www.solarsystemscope.com/textures/
  textures: {
    sun: { lo: 'textures/2k_sun.jpg', hi: 'textures/8k_sun.jpg' },
    mercury: { lo: 'textures/2k_mercury.jpg', hi: 'textures/8k_mercury.jpg' },
    venus: { lo: 'textures/2k_venus_atmosphere.jpg', hi: 'textures/4k_venus_atmosphere.jpg' },
    earth: { lo: 'textures/2k_earth_daymap.jpg', hi: 'textures/8k_earth_daymap.jpg' },
    earthNight: { lo: 'textures/2k_earth_nightmap.jpg', hi: 'textures/8k_earth_nightmap.jpg' },
    earthClouds: { lo: 'textures/2k_earth_clouds.jpg', hi: 'textures/8k_earth_clouds.jpg' },
    moon: { lo: 'textures/2k_moon.jpg', hi: 'textures/8k_moon.jpg' },
    mars: { lo: 'textures/2k_mars.jpg', hi: 'textures/8k_mars.jpg' },
    jupiter: { lo: 'textures/2k_jupiter.jpg', hi: 'textures/8k_jupiter.jpg' },
    saturn: { lo: 'textures/2k_saturn.jpg', hi: 'textures/8k_saturn.jpg' },
    saturnRing: { lo: 'textures/2k_saturn_ring_alpha.png', hi: 'textures/8k_saturn_ring_alpha.png' },
    uranus: { lo: 'textures/2k_uranus.jpg' },
    neptune: { lo: 'textures/2k_neptune.jpg' },
    stars: { lo: 'textures/2k_stars_milky_way.jpg', hi: 'textures/8k_stars_milky_way.jpg' }
  },

  // Fallback copies of the same Solar System Scope files on Wikimedia Commons (same CC BY 4.0 license).
  // Used automatically when a file is not in assets/space/, so the site works without the download step.
  mirrors: {
      "2k_earth_clouds.jpg": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Solarsystemscope_texture_2k_earth_clouds.jpg",
      "2k_earth_daymap.jpg": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg",
      "2k_earth_nightmap.jpg": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Solarsystemscope_texture_2k_earth_nightmap.jpg",
      "2k_jupiter.jpg": "https://upload.wikimedia.org/wikipedia/commons/b/be/Solarsystemscope_texture_2k_jupiter.jpg",
      "2k_mars.jpg": "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg",
      "2k_mercury.jpg": "https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg",
      "2k_moon.jpg": "https://upload.wikimedia.org/wikipedia/commons/2/26/Solarsystemscope_texture_2k_moon.jpg",
      "2k_neptune.jpg": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_2k_neptune.jpg",
      "2k_saturn.jpg": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Solarsystemscope_texture_2k_saturn.jpg",
      "2k_saturn_ring_alpha.png": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Solarsystemscope_texture_2k_saturn_ring_alpha.png",
      "2k_stars_milky_way.jpg": "https://upload.wikimedia.org/wikipedia/commons/0/0e/Solarsystemscope_texture_2k_stars_milky_way.jpg",
      "2k_sun.jpg": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg",
      "2k_uranus.jpg": "https://upload.wikimedia.org/wikipedia/commons/9/95/Solarsystemscope_texture_2k_uranus.jpg",
      "2k_venus_atmosphere.jpg": "https://upload.wikimedia.org/wikipedia/commons/6/63/Solarsystemscope_texture_2k_venus_atmosphere.jpg",
      "4k_venus_atmosphere.jpg": "https://upload.wikimedia.org/wikipedia/commons/5/57/Solarsystemscope_texture_4k_venus_atmosphere.jpg",
      "8k_earth_clouds.jpg": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Solarsystemscope_texture_8k_earth_clouds.jpg",
      "8k_earth_daymap.jpg": "https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg",
      "8k_earth_nightmap.jpg": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg",
      "8k_jupiter.jpg": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Solarsystemscope_texture_8k_jupiter.jpg",
      "8k_mars.jpg": "https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg",
      "8k_mercury.jpg": "https://upload.wikimedia.org/wikipedia/commons/2/27/Solarsystemscope_texture_8k_mercury.jpg",
      "8k_moon.jpg": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Solarsystemscope_texture_8k_moon.jpg",
      "8k_saturn.jpg": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_8k_saturn.jpg",
      "8k_saturn_ring_alpha.png": "https://upload.wikimedia.org/wikipedia/commons/2/29/Solarsystemscope_texture_8k_saturn_ring_alpha.png",
      "8k_stars_milky_way.jpg": "https://upload.wikimedia.org/wikipedia/commons/8/85/Solarsystemscope_texture_8k_stars_milky_way.jpg",
      "8k_sun.jpg": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Solarsystemscope_texture_8k_sun.jpg"
  },

  // NASA/JPL-Caltech Curiosity rover glTF model.
  // Source: https://science.nasa.gov/resource/curiosity-rover-3d-model/
  rover: {
    file: 'models/curiosity.glb',
    remote: 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24584_Curiosity_static.glb',
    lengthMeters: 3.0,      // Curiosity is about 3 m long
    yawOffsetDeg: 0         // change to 180 if the rover drives backwards
  },

  credits: [
    {
      what: 'Planet, Sun, Moon, Saturn ring and Milky Way textures',
      who: 'Solar System Scope (INOVE), based on NASA elevation and imagery data',
      license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      url: 'https://www.solarsystemscope.com/textures/',
      note: 'Used unmodified. Loaded from this site’s own copy, or from the identical files on Wikimedia Commons. Solar System Scope notes that a few unmapped areas on some maps are filled with matching fictional terrain.'
    },
    {
      what: 'Curiosity rover 3D model (glTF)',
      who: 'NASA/JPL-Caltech',
      license: 'NASA media usage guidelines (generally not subject to copyright in the US)', licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
      url: 'https://science.nasa.gov/resource/curiosity-rover-3d-model/',
      note: 'Scaled to about 3 m long. Use does not imply NASA endorsement.'
    },
    {
      what: 'Planet facts (diameter, gravity, atmosphere, temperature, orbits)',
      who: 'NASA Planetary Fact Sheet and NASA Science',
      license: 'Public information', licenseUrl: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
      note: 'Moon counts are as of mid-2026 (NASA Space Place, NASA APOD) and keep changing as new moons are confirmed.'
    },
    {
      what: '3D engine',
      who: 'three.js r128 with OrbitControls, GLTFLoader and DRACOLoader',
      license: 'MIT', licenseUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
      url: 'https://threejs.org/'
    }
  ]
};
