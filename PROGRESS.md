# Progress

## Done
- Project set up: AGENTS.md, GAME-DESIGN.md, preview config, git.
- Step 1: full-screen portrait game screen; cupcake drawn on canvas (levels.js), scaled to fit any phone, Retina-sharp.
- Step 2: Sprinkles tool (tools.js) – hold/drag to scatter; pieces bounce as they land, stick on the frosting, and hop + fall off the screen when they miss. Stuck sprinkles are baked into an offscreen canvas (cheap to draw).
- Step 3: coverage meter (HUD at top, goal marker at 90%) measured on a coarse grid mask of the frosting; at 90% → "Sweet!": confetti, screen shake, vibration (Android only), arpeggio sound, popup with time + "Play again".
- Sounds (audio.js): tiny ticks while sprinkling, "Sweet!" fanfare. Audio unlocks on first touch (iOS).

## In progress
- (nothing)

## Next steps
4. Levels 1–5 + tool picker (bottom row of round buttons; 110 px are already kept free there).
5. Title screen, level select, stars saved (win time is already measured: `state.elapsed`).
6. Levels 6–10, remaining tools, sounds, polish.

## Notes
- Level format: `id`, `bg`, `box {w,h}` (level units), `target`, `tools`, `coverPath(ctx)` (decoratable area = coverage mask), `drawBase(ctx)`, optional `drawTop(ctx)`.
- UI strings live in `STRINGS` at the top of js/game.js (level names keyed by level id).
- Only the frosting counts for the cupcake – sprinkles on the wrapper fall off.

## Known issues
- Not yet tested on a real iPhone. On iPhone, Web Audio is silent when the ring/silent switch is on.
- "Play again" restarts the cupcake – there is no next level until step 4.
