# Progress

## Done
- Project set up: AGENTS.md, GAME-DESIGN.md, preview config, git, GitHub (slodkibufetposypki/sprinkle-game-test).
- Step 1: full-screen portrait game screen; objects drawn on canvas (levels.js), scaled to fit any phone, Retina-sharp.
- Step 2: Sprinkles tool (tools.js) – hold/drag to scatter; pieces bounce as they land, stick on the object, and hop + fall off the screen when they miss. Stuck pieces are baked into an offscreen canvas (cheap to draw).
- Step 3: coverage meter (HUD at top, goal marker at 90%) measured on a coarse grid mask of the decoratable area; at 90% → "Sweet!": confetti, screen shake, vibration (Android only), arpeggio sound, popup with time.
- Step 4: levels 1–5 + tool picker.
  - Levels: 1 Cupcake, 2 Donut (icing ring, the hole lets pieces fall through), 3 Birthday Cake (flickering candles), 4 Ice Cream Cone (two scoops), 5 Cookie.
  - Tools: Sprinkles (L1), Nonpareils (L3, dense tiny balls), Chocolate Drip (L5, blobs that start drips running down to the object's edge).
  - Tool picker: round buttons at the bottom with icons drawn in code; a newly unlocked tool is auto-selected, pulses, and gets a "New tool: …!" toast + ding.
  - Win popup → "Next" goes to the next level; after level 5 "Play again" goes back to level 1.
- Sounds (audio.js): ticks (sprinkles/nonpareils), blop (chocolate), ding (new tool), "Sweet!" fanfare. Audio unlocks on first touch (iOS). iPhone: unlocks on a finished tap, plays even with the silent switch on (audioSession "playback" on iOS 17+, silent looping <audio> on older iOS).

## In progress
- **Sprinkle Wars prototype** (prototypes/wars/, online at https://slodkibufetposypki.github.io/sprinkle-game-test/prototypes/wars/)
  - v2 (after the user's concept image): landscape, tiered cake castles with cannon towers + capybara gunners, king capybara with crown in the river (shots bounce off him), candy-land backdrop.
  - Weapons: Sprinkles (unlimited), Glitter, Golden Trio, Pink Drip (2 each), weapon bar under the active player's castle.
  - HUD: player badges with segmented yum bars, round tracker with crowns; floating "+X% yum" / "Miss!" / "Oops!"; bonus toppings every 20%; signpost points at the tastier cake.
  - Finale: king eats the tastiest castle bite by bite; draw when both bars show the same %.
  - Simulated match (scripted aim): good sprinkle volley ≈ +11%, match ends around 35–40% each.
  - Reuses js/audio.js (`Sfx.play`, `Sfx.noise`).
  - Fits short screens (iPhone Safari with toolbars in landscape ≈ 874×292): UI scales with screen height, empty top sky may be cropped, weapons go into a column in the side margin when there's room (respects the notch), otherwise a row under the active castle.
  - Next: playtest with a real person on iPhone (landscape), tune power/values; decide on real artwork; decide if this becomes the main game.

## Next steps
5. Title screen, level select, stars saved (win time is already measured: `state.elapsed`).
6. Levels 6–10 (Cat, Rubber Duck, Car, Slipper, The Moon), Glitter (L7) and Gold Leaf (L9) tools, sounds, polish.

## Notes
- Level format: `id`, `bg`, `box {w,h}` (level units), `target`, `tools`, `coverPath(ctx)` (decoratable area = coverage mask), optional `fillRule` ('evenodd' for holes), `drawBase(ctx)`, optional `drawTop(ctx, time)`.
- Tool format is documented at the top of js/tools.js (`onStick` / `grow` hooks for tools like the drip).
- UI strings live in `STRINGS` at the top of js/game.js (level and tool names keyed by id).
- Dev shortcut: in the browser console, `loadLevel(n)` jumps to a level (0-based).
- Only the frosting/icing/scoops/cake count – pieces on the wrapper, dough, cone or plate fall off.

## Known issues
- iPhone sound confirmed working (iPhone 16 Pro, iOS 26.6). It plays through the silent switch on purpose, and pauses other music (e.g. Spotify) while playing.
- Level progress isn't saved yet (step 5).
- GitHub Pages caches files ~10 min: after a push, phones may show the old version for a while (close the tab and reopen).
