# movrax60

A live 3D room for an international cybersecurity CTF team. Scroll to move between the mascot, roster, competition highlights and contact. Drag the mascot to turn it, or tap it to wave. The character also supports arrow keys and Enter. The competition stations have a button that opens their display plates.

The homepage is at `/` and the player directory is at `/members/`. Each result and member can be linked directly. All team copy and navigation ship as HTML. A browser without WebGL or JavaScript still gets the complete team information. Reduced motion stops the idle movement and switches camera poses directly.

## Run and deploy

Run `npm ci` and `npm run dev` for the local preview. Vercel uses `npm run build` and serves `dist/`. Run `npm test` for the Chrome checks.

Edit `records.json` for results, roster and contact details. Telegram, Discord, and email turn into links when their URL values are filled in. The Hack The Box placement retains its player-reported attribution.

The room, lighting, and mascot geometry render at runtime with Three.js. The mascot is extruded from the outline and enamel paths traced from the team's original drawing. Room surfaces use procedural shading and the site requests no picture or video assets.
