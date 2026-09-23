# Sprinkle Everything – game design (v0.1)

## One-line pitch
Every level shows one object. Decorate it with sprinkles, drips and glitter until it's fully covered.
Starts with cupcakes, gets more absurd: a cat, a car, a grandma's slipper, the Moon.

## Core loop (one level ≈ 10–30 s)
1. Object appears in the middle of the screen (drawn in code).
2. Player drags a finger over it → the active tool decorates the object.
3. Coverage meter fills up (percent of the object's area that's decorated).
4. At 90% coverage → "Sweet!" celebration (confetti burst + sound + haptic-style shake) → next level.
5. Decorations that land outside the object fall off the screen (fun, no penalty).

## Tools (unlock one by one)
| Tool | Feel | Unlocks |
|---|---|---|
| Sprinkles | Colourful rod sprinkles scatter under the finger, random rotation | Level 1 |
| Nonpareils | Tiny round balls, dense spray | Level 3 |
| Chocolate drip | Thick drip that runs down the object with gravity | Level 5 |
| Glitter | Sparkly dust, shimmers | Level 7 |
| Gold leaf | Rare, big flakes, bonus points | Level 9 |

Tool picker = row of round buttons at the bottom of the screen.

## Levels (MVP = 10)
1 Cupcake · 2 Donut · 3 Birthday cake · 4 Ice cream cone · 5 Cookie
6 Cat · 7 Rubber duck · 8 Car · 9 Slipper · 10 The Moon

Each level in js/levels.js: name, shape draw function, target coverage, allowed tools, background colour.

## Scoring
- Stars 1–3 based on time to reach 90%.
- Best stars per level saved in localStorage.

## Screens
- Title: "Sprinkle Everything" + Play button
- Level select grid (10 tiles, stars, locked/unlocked)
- Game screen: object, coverage bar at top, tool picker at bottom, pause button
- Level complete: stars, "Next" button

## Look & feel
- Pastel background per level, bold outlines, playful rounded font (system font is fine for v0.1).
- Juicy feedback: little bounce when decorations land, screen shake on completion, pop sounds.

## Out of scope for v0.1
Accounts, ads, in-app purchases, online leaderboards, App Store wrapping.
