# LUNAR

A space arcade with five games, 1,000 discoverable cosmic events and a million universes, over a live 3D sky: the Milky Way, thousands of twinkling stars, drifting asteroids, an asteroid belt, shooting stars and a distant sun. Everything in the scene is generated in code with three.js, so there are no image files to host.

## Games

- **Click speed**: clicks per second over 1 to 60 seconds. At 50+ clicks in one run, random cosmic events hit the background (19 events: warp speed, hyperspace jump, wormhole, supernova, black hole, pulsar, gamma-ray burst, solar eclipse, planet flyby, meteor shower, fireball barrage, asteroid storm, satellite swarm, comet, galaxy spin, constellations, star pulse, galactic core flare, zero gravity). Combos hit at 100, 150 and 200 clicks.
- **Meteor defense**: asteroids fly at you in 3D. Click them before impact. White crystals are worth 5 points.
- **Reaction time**: wait for the flash, then click. Five rounds, averaged.
- **Star aim**: hit 25 stars as fast as you can, with accuracy tracked.
- **Constellation**: memorize the sequence of stars and repeat it.

Players type a name on their first visit. Every finished run goes on the leaderboard (top 25 per game). Scores and names are saved in the player's browser (localStorage), so each device has its own leaderboard. A worldwide leaderboard needs a small backend (for example a Cloudflare Worker).

## Universes, codex and settings

- **Universes**: eight hand-built universes (Milky Way, Crimson Expanse, Frost Reach, Golden Drift, Emerald Void, Violet Abyss, Twin Suns, Dead Silence) plus a generated universe for every seed from 0 to 999999.
- **Codex**: the 1,000 events are 20 effects (warp, wormhole, supernova, black hole, pulsar, eclipse, rogue planet and more) in 10 colors and 5 sizes (tiny, normal, mega, twin, swarm). Every event you trigger is logged and can be replayed.
- **Settings**: no-limit click mode, when events start and how often, random events on their own, camera drift, graphics quality, volume and data resets.

## Solar System explorer and rover

LUNAR now opens in a 3D model of the real Solar System: the Sun, Mercury, Venus, Earth and its Moon, Mars, Jupiter, Saturn with its rings, Uranus and Neptune, with real axial tilts, rotation and relative orbital periods (sizes and distances are compressed so everything fits on screen).

- Click any planet to fly to it. Its info panel shows diameter, gravity, atmosphere, temperature, moons and orbit data from NASA.
- High-resolution 8k maps load only for the planet you zoom into. Sphere detail drops with distance (level of detail).
- On Earth, the Moon and Mars, press **Land** to drive NASA's Curiosity rover in third person (110° field of view) with each world's real gravity.
- Gas and ice giants have no landing option, since they have no solid surface.

Rover controls: W accelerate, S brake/reverse, A/D steer, Shift boost, Space handbrake, mouse to look (click to lock the pointer), Esc to pause.

### Real assets

| Asset | Source | License |
|---|---|---|
| Planet, Sun, Moon, ring and Milky Way maps | [Solar System Scope](https://www.solarsystemscope.com/textures/), based on NASA data | CC BY 4.0 |
| Curiosity rover glTF | [NASA/JPL-Caltech](https://science.nasa.gov/resource/curiosity-rover-3d-model/) | NASA media guidelines |
| Planet facts | [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), NASA Science (moon counts as of mid-2026) | Public information |

These files are **not** in the zip. The site looks for them in `assets/space/` first. If a planet map isn't there, it loads the identical file from Wikimedia Commons (same CC BY 4.0 license), and the rover falls back to NASA's own download link. So the Solar System works even if you skip the download step.

Hosting your own copies is still faster and more reliable: run `scripts/download-assets.sh` (Mac/Linux/Git Bash) or `scripts/download-assets.ps1` (Windows), or let the GitHub Action do it. If a file can't be loaded from anywhere, the site says so instead of faking it.

Rover terrain is procedurally generated from each world's real gravity, colors and typical features. It is not a map of a real landing site. The full list of sources is on the site's Credits page.

If the rover drives backwards, set `yawOffsetDeg: 180` in `assets/js/assets-config.js`.

## Put it on GitHub Pages

The easiest way is the included GitHub Action, which downloads the real assets and deploys the site for you.

1. Create a repository (for example `lunar`) and upload everything in this folder, keeping the structure (including the hidden `.github` folder and `.nojekyll`).
2. Go to **Settings > Pages**. Under **Build and deployment**, set Source to **GitHub Actions**.
3. Push to `main` (or open the **Actions** tab and run **Deploy LUNAR**). In a couple of minutes the site is live at `https://YOUR-USERNAME.github.io/lunar/`.

Prefer the old way (Deploy from a branch)? Run `bash scripts/download-assets.sh` on your computer first, commit the `assets/space` folder, then set Pages to deploy from `main` / root.

## Run it locally

Browsers block loading textures and models from `file://`, so use a small local server:

```
bash scripts/download-assets.sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Customize

- Site name: change `LUNAR` in `index.html`.
- Chaos threshold and timing: the Settings page, or `DEF` in `assets/js/games.js`.
- Asset paths and rover size/orientation: `assets/js/assets-config.js`.
- Planet data and rover worlds: `BODIES` and `WORLDS` in `assets/js/explore.js`.
