# movrax60

A Next.js site for an international CTF team. One live Three.js camera follows the team's flag from its crest along five stitched result marks, around the hem to the roster label, and back out for contact. Anime.js animates the result readouts as they enter.

## Run locally

```sh
npm ci
npm run dev
```

Use `npm run build` and `npm start` for the production build. The repository uses the Vercel Next.js preset. Run `npm test` for the browser checks with Google Chrome installed.

## Edit the design and content

- Open `design/movrax60-continuous-flag.fig` in OpenPencil for the desktop and portrait boards, camera positions, member directory, and interaction states.
- Open `art/textile/standard.blend` for the Blender rig. Run `blender -b -t 4 --python art/textile/weave.py` to regenerate it and export `public/models/standard.glb`. The model export includes a shared cloth binding for the silk, stitching, and fringe. `cloth-response.ts` simulates the cloth around the fixed hoist edge. `textile.ts` handles lighting, rendering, and pointer input, and `flag-track.ts` defines the camera path.
- Edit `records.json` for results, member details, and contacts. Add URLs to enable the Telegram, Discord, and email links. The Hack The Box placement is player-reported.

Scrolling works with wheel, trackpad and touch. Grab and drag the silk, or use the lift button to pick up the hem from three points. In results, use the eyelets, dot index, arrow keys or horizontal swipe. The roster has eight direct profile anchors. Reduced-motion mode holds a stable pose for each reading position.
