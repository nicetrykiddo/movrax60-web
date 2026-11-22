# movrax60

Scroll through the team introduction, featured competition and public roster. The CTFtime link leads to complete standings. Content is built into the HTML from records.json.

Lenis handles wheel smoothing and GSAP ScrollTrigger measures camera travel. A damped spring follows the desired viewpoint. Frames from a 64-view Blender Cycles studio shoot are fetched around the current angle; a still is available before loading, without JavaScript and with reduced motion. The desktop sculpture stays beside the team content and the mobile composition scrolls away naturally.

Run `npm ci` and `npm run dev` locally. Use `npm test` for production build and browser checks. Vercel uses the repository root, `npm run build`, and the `dist` output directory. Regenerate the included artwork and frame sequence using `blender -b -P art/emblem.py`.
