# MOVRAX60

Scroll-first website for an international CTF team. Team information, current public profiles and the full competition archive are built into the HTML from records.json. Season and placement controls enhance the archive when JavaScript is available.

Run `npm ci` and `npm run dev` locally. Use `npm test` for production build and browser checks. Vercel uses the repository root, `npm run build`, and the `dist` output directory. The original metal artwork can be regenerated with `blender -b -P art/emblem.py`; deployment uses the included WebP.
