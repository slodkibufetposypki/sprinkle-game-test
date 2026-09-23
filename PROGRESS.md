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
- Sounds (audio.js): ticks (sprinkles/nonpareils), blop (chocolate), ding (new tool), "Sweet!" fanfare. Audio unlocks on first touch (iOS).

## In progress
- (nothing)

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
- Not yet tested on a real iPhone. On iPhone, Web Audio is silent when the ring/silent switch is on.
- Level progress isn't saved yet (step 5).
