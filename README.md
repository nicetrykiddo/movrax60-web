# movrax60 — The Relay

A CTF team site that opens on an illustrated late-night team session and follows a camera through a communications exchange. The public routes are `/` for the team, competition highlights and contact, and `/members/` for the interactive roster. Existing section and player anchors work directly.

## Run and deploy

Run `npm ci` and `npm run dev`. Vercel uses `npm run build` and serves `dist/`. Run `npm test` to check both production routes in Chrome.

Edit `records.json` to update public profiles, competition results and contact links. Telegram, Discord and email become links when their `url` values are filled in. Hack The Box's placement remains labelled as player-reported.

## Camera and interaction

A single fixed stage plays four 30 fps H.264 clips according to scroll position. Wide assets are 1920×1080 and portrait assets are 1080×1440. The player keeps only nearby clips loaded, coalesces seeks and keeps the current decoded frame visible at each handoff. Native HTML holds the copy, links and sharp posters. Reduced motion keeps the posters and disables the moving stage. Rain, mist and steam live on separate layers. The opening desk light changes the scene, competition previews let visitors jump to a result, and sound activates on request.

The members page keeps the familiar profile anchors. Its engraved nameplates follow the current player on scroll. Visitors can also select a handle or move through the rack with the arrow keys.

## Rebuild the film

Run Blender and FFmpeg from the repository root. `RELAY_OUT` specifies the same frame directory for both steps, defaulting to `/tmp/relay-frames`.

```sh
blender -b --python-exit-code 1 -P art/relay/render.py
python art/relay/package.py
```

For lighting proofs, set `RELAY_SHOTS=entrance`, `RELAY_VIEWS=wide` and `RELAY_FRAMES=0,36,75`. The render script projects the location plates into depth, adds the physically positioned glass and the traced mascot from `art/pin/enamel.json`, and animates the camera, practical light and mullion crossings. `python art/relay/fog.py` rebuilds the mist with Pillow, NumPy and SciPy.

The source plates in `art/relay/plates/` were made with the built-in image generation tool. The prompts specified an illustrative CTF team session around a shared oak table in a rainy city at night, a smoked-glass hall with overhead fiber bundles, an after-dark service corridor with amber reflections, and a night window over a misty valley. The opening portrait is a crop of the matching landscape plate. The other portrait plates were separately reframed from their landscape versions. The mascot outline comes from the team's supplied artwork.
