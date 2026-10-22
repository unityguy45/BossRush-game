# 🐸 Tode: Boss Rush

**Four titans. One frog. No mercy.**

A 3D browser action game where you play as Tode the Frog and battle four bosses. Dodge attacks, jump over shockwaves, and turn the arena into your weapon.

Built with **JavaScript, Three.js, and Vite**, expanding on JetBrains Academy’s *Build a Game with an AI Coding Agent* project.

## Gameplay

- Lash enemies with your tongue.
- Grab rubble and throw it at bosses.
- Grapple pillars to move around the arena.
- Break shields by destroying wards, defeating guards, or hurling rubble.
- Survive enraged boss phases and defeat all four bosses.

## Bosses

| Boss | Title |
| --- | --- |
| Kilnheart | The Magma Colossus |
| Oculus | The Storm Eye |
| Regina Apis | The Hive Queen |
| Nidhogg | The Void Serpent |

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Click / J | Use tongue or throw held rubble |
| Space | Jump |
| Shift / K | Dash |
| P / Escape | Pause / Resume |
| Space / Enter | Start from the title screen |
| Space after defeat | Retry the current boss |
| R after defeat | Restart the run |

## Run Locally

Install Node.js 22.12 or newer, then run these commands from the repository’s course project folder:

```bash
cd game
npm install
npm run dev
```

Open the local URL shown in your terminal.

## Production Build

From the `game` folder:

```bash
npm run build
npm run preview
```

The production files are generated in `game/dist`.

## Built With

- **Three.js** — 3D graphics
- **Vite** — Development server and builds
- **JavaScript, HTML, and CSS** — Gameplay and interface

## Credits

Based on the **Build a Game with an AI Coding Agent** course project by **JetBrains Academy**.

## License

See the repository’s `LICENSE` file.
