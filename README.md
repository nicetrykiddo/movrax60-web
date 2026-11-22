# movrax60 · The Weather Quarry

An interactive, fixed-camera quarry with a movable rain sculpture, a competition archive, and a public team directory.

## Run locally

Use Node.js 22.12 or later. Run `npm ci`, then `npm run dev`. Open the local URL printed by Vite. For a production preview, run `npm run build` followed by `npm run preview`. Deploy the contents of `dist/` to a static host. The hash links work without server-side rewrites.

## Editing

- The Blender scene and its procedural builder live in `art/`. The browser loads the compact landscape or portrait WebP from `public/`.
- The live weather and audio are implemented in `weather.ts`. The rain follows pointer movement. Drag the cut directly or focus the sculpture and use the arrow keys to reposition it. Sound is opt-in.
- `records.json` contains the dated CTFtime snapshot. The site serves it locally. Update membership from the current-member tab on the linked team page.
- Fonts ship locally with their licenses in `public/fonts/`.

## Vercel

Import this repository using its root directory. The checked-in configuration selects Vite, runs `npm run build`, and serves `dist/`. Blender is only needed to re-render the artwork.

The stone, gravel and distant horizon use CC0 assets from Poly Haven. The source material names are in `art/materials/`; the horizon comes from *Sunset in the Chalk Quarry*.
