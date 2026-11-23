# movrax60

An international cybersecurity capture the flag team. The homepage has eight scroll scenes, starting with a turnable enamel mascot and closing with contact. The separate members page has a deep link and a rendered nameplate for each player on the public roster.

## Run and deploy

Use `npm ci` and `npm run dev` for local preview. Vercel builds both pages with `npm run build` and serves `dist/`. Run `npm test` to check the production build in Chrome.

Edit `records.json` to change roster details, competition highlights, or contact links. The Telegram, Discord, and email rows become links when their `url` is filled in. Both pages render the team information into HTML at build time.

## Artwork and motion

- `art/pin/original.png` is the mascot supplied by the team. Run `python art/pin/trace.py` to regenerate the die outline, enamel masks, and icon using Potrace, Pillow, SciPy and NumPy.
- Run `blender -b --python-exit-code 1 -P art/pin/render.py` for 120 mascot views and `python art/pin/atlas.py` for the low-resolution orbit used during dragging. `PIN_FRAMES=0,60` renders a front and back preview.
- Run `blender -b --python-exit-code 1 -P art/pin/scenes.py` to render the competition, roster entrance and contact shots. Set `SCENE_SHOTS` and `SCENE_FRAMES` to comma-separated shot IDs and frame indices for partial renders. Render individual nameplates with the player slug from the members page and frames 0 through 9.
- `art/pin/surface.py` renders the technical knit backdrop. `python art/pin/ambient.py` makes the opt-in ambient audio with NumPy, SciPy and FFmpeg. Lighting and surface material sources used by the Blender scripts are listed in `art/library/sources.json`.
- The same fixed canvas draws the entire workbench as the page scrolls. The camera travels between objects in Blender, while the headings, results and links stay in the document flow. Panorama and portrait each have their own path. Lightweight frame atlases play during motion. A larger exposure fades in at rest when it matches the current camera pose. A separate pass draws moving haze and depth-layered dust. Visitors using reduced motion or browsing without JavaScript see rendered stills with the same navigation and content.

Render the full scroll camera from the repository root. Use `JOURNEY_ROUTE=members` for the members page.

```sh
JOURNEY_STRIDE=4 blender -b --python-exit-code 1 -P art/pin/journey.py
blender -b --python-exit-code 1 -P art/pin/journey.py
python art/pin/journey_atlases.py --route home
```

Run both render passes for each route. The first pass renders anchor exposures at full resolution. The second fills in adjacent poses and preserves any finished exposures. The atlas packer uses Pillow, NumPy and OpenCV to build the preview strips and interpolate between rendered exposures. `JOURNEY_VIEWS` and `JOURNEY_SHOTS` narrow a render to selected orientations or chapters.
