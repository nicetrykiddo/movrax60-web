# movrax60

A Next.js site for the international CTF team. The home and member routes are prerendered. The optical workbench loads separately in the browser, using Three.js and Anime.js.

## Local development

Run `npm ci` and `npm run dev`. For a production preview use `npm run build` and `npm start`. Vercel can use its Next.js preset. Run `npm test` for the production browser checks (requires Google Chrome).

## Content and controls

Edit `records.json` for competition results, member information and contacts. Telegram, Discord and email become links when their URLs are filled in. The Hack The Box result retains its player-reported attribution.

Click the relay to send a pulse, drag horizontally to orbit or use the arrow keys when the model has focus. Lift the cover to inspect the electronics. Native scrolling moves the camera from the three launch ferrules along the optical loom to its nine receiver sockets. Reduced motion disables continuous camera and light animation.

The original Blender model is built by `art/optic/model.py` and served as `public/models/relay.glb`. The instanced loom has 4,608 strands and 1,024 spans per strand at full detail. The renderer selects a subset based on the adapter and observed frame intervals.
