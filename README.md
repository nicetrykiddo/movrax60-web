# movrax60 — The Last Exposure

A scroll-controlled short film introduces the international CTF team. A vintage film projector, eight moving film strips and a backlit registration gate form three connected Blender Cycles shots. The eight printed separations align into the lowercase team mark. The roster and the team's featured finish are real HTML links rendered from `records.json`.

## Run and deploy

Run `npm ci` and `npm run dev`. Production uses `npm run build` and the `dist/` directory on Vercel. `npm test` runs the build and local Chrome interaction checks. All film frames ship as WebPs. Deployment requires neither Blender nor a GPU.

## Motion and sound

The two camera compositions each have 128 main frames plus 39 intermediate exposures for the moving projector. A three-request window loads around the current scroll position. The opening dolly uses native intermediate renders to keep the lens and moving spokes crisp. The two later shots blend adjacent frames during slow scrolling. A damped spring settles the playhead. The wheel uses Lenis and ScrollTrigger; touch scrolling remains native. With reduced motion or JavaScript disabled, each chapter uses its own still. The projector recording and original tonal score load after the sound control is pressed.

## Artwork

- `art/film/stock.py` prints perforated acetate textures from public-domain machinery engravings and public team handles. `art/library/generated/make_mattes.py` prepares the eight optical separations. Both tools use Python, Pillow, NumPy and fontTools with WOFF2 support.
- `blender -b --python-exit-code 1 -P art/film/render.py` rebuilds the film. Set `FILM_FRAMES=0,62,127` to preview the three chapters, `FILM_VIEWS=tall` for a single orientation, and `FILM_OUT` to use a separate preview directory. Blender is configured for Cycles with OptiX where available.
- `python art/film/score.py` mixes the CC0 recording *Cinema-Projector.wav* by Dr. Macak with an original three-note score, using NumPy and FFmpeg. The rendered audio is in `public/audio/`.
- The research board is `art/library/index.html`. File-level provenance is in `art/library/sources.json`. The published film uses historical plates from the 1911 *Cyclopedia of Motion-Picture Work*, CC0 Poly Haven and ambientCG surfaces and lighting, and the team's generated lettering. DM Sans ships with its license in `public/fonts/`.
