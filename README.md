# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/NftArt7/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/NftArt7/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City — Open-World Heist.** An original open-world crime game in the spirit of GTA 6, built with three.js and zero external assets: a sun-soaked coastal city to explore on foot and by car, traffic and pedestrians, cars to steal and drive, a wanted level with police who chase, ram and bust you, four story missions for the fixer Delia Voss, a HUD with a live minimap, and a fully synthesized soundtrack — every sound is a WebAudio oscillator, every texture is painted at runtime.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: every script, texture and sound is a file under `game/` or generated in code.

## Play

- **WASD** — walk and drive (Shift to run on foot)
- **E** — steal / enter a car, **E** again to get out
- **Space** — handbrake
- **Mouse drag** — orbit the chase camera
- **P** — pause, **M** — mute

## The four jobs

1. **Hot Wheels** — steal the Comet GT from the showroom, deliver it to Delia's garage. $1,200.
2. **Dockside Drop** — pick up the package at the docks, run it to the warehouse with the harbour cops alerted. $2,500.
3. **Heat Wave** — three stars on you: lose the cops, then reach the hideout unseen. $3,000.
4. **Solmar Sprint** — six checkpoints, one city, 150 seconds. $5,000 and the title of City Legend.

Steal a car, clip traffic or hit a pedestrian and the heat rises; stay clean and out of sight and it cools. Get pinned down by the Solmar PD while crawling and you are busted — $500 fine, back to the hideout on foot.

## Files

- `game/index.html` — the page, import map and HUD
- `game/src/` — one job per file: `world` (the city), `vehicles` (cars and traffic), `people` (pedestrians), `police` (wanted system), `missions` (the four jobs), `hud` (HUD and minimap), `audio` (synth), `input`, `shots` (deterministic screenshot staging), `main` (the loop)
- `game/vendor/three.module.min.js` — three.js 0.160.0, vendored
- `screenshots/` — three renders of the game itself: title, chase, finale

---

<sub>Entered on [make.fun](https://make.fun/?ref=7q6eysa2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
