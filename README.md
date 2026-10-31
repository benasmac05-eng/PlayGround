# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/benasmac05-eng/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/benasmac05-eng/PlayGround)

- 🎮 [Open the project](https://omgithub.com/benasmac05-eng/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=benasmac05-eng%2FPlayGround).
- 💻 [Explore the source](https://github.com/benasmac05-eng/PlayGround).
- 🛠️ [Check build runs](https://github.com/benasmac05-eng/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/benasmac05-eng/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/benasmac05-eng).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## BEAMFORGE — Vehicle Dynamics Lab

A playable Three.js vehicle sandbox: build a car, resize its body, swap engines, fit turbos, tune the chassis, paint it, and take it to Sector 04 for ramp jumps, drifts, prop-smashing and panel-bending crashes.

### Run it

```bash
./start.sh
```

The static app is served on the runtime port (`http://localhost:3000` by default). No package install or build step is required.

### Controls

- **W / S** throttle and brake/reverse, **A / D** steer
- **Space** handbrake drift, **Shift** nitrous
- **C** cycle camera, **R** repair and reset, **Esc** pause
- **G** randomise the build in the garage
- Drag to orbit the showroom, scroll to zoom
- On phones and tablets, use the on-screen steering, pedals, drift and nitrous buttons

Progress is stored in `localStorage`. Everything is procedural: the car mesh, textures, environment and engine audio are generated at runtime.
