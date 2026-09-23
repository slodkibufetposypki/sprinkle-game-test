# Project: Sprinkle Everything (mobile web game)

Casual touch game themed around cake decorating (sprinkles, drips, glitter).
Original art and content only – do not copy other games' names, art or levels.

## Tech rules
- Plain HTML + CSS + vanilla JavaScript + <canvas>. No frameworks, no build step, no npm.
- Mobile first: portrait, full screen, touch controls (pointer events), works in iPhone Safari.
  Exception: the Sprinkle Wars prototype (prototypes/wars/) is landscape and asks portrait players to rotate.
- All graphics drawn in code (canvas shapes/paths) for now – no image files needed.
- Sounds with the Web Audio API (generated, no audio files) – keep them short and satisfying.
- Keep code split: index.html, style.css, js/game.js, js/levels.js, js/tools.js, js/audio.js.
- UI text in English for now (easy to translate later). Keep strings in one place.

## Preview
- Five Server: right-click index.html → Open with Five Server → http://127.0.0.1:5500 (fiveserver.config.js has open: false).
- To test on iPhone (same Wi-Fi): serve on 0.0.0.0 and give the Mac's local IP, e.g. http://192.168.x.x:5500

## Workflow
- Read GAME-DESIGN.md and PROGRESS.md at the start of every session.
- Build in small steps; after each finished step: update PROGRESS.md and commit to git with a clear message.
- Before ending a session, update PROGRESS.md (done / in progress / next steps / known issues).
