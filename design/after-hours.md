# movrax60 website redesign

[Editable OpenPencil document](./movrax60-after-hours.fig) · [Figma reference](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV)

Open the local `.fig` in [OpenPencil](https://github.com/open-pencil/open-pencil/releases), the MIT-licensed editor. The layers and text are editable. The hero art uses Blender stills. Eight artboards cover desktop and mobile, the opened menu, a lifted flag, the next archive selection, and an annotated scroll map. The local document was authored and exported with [OpenPencil CLI](https://github.com/open-pencil/open-pencil). [Penpot](https://github.com/penpot/penpot) is an alternative for a shared self-hosted workspace.

## Visual direction

A woven flag carries the team's supplied mascot. The palette moves from copper under warm light to a pale competition archive and a plum roster. The cloth is the interactive object. Its folds catch light, the loose threads react when a visitor pulls the hem, and the camera passes close to the fabric as the visitor scrolls into the results. The Blender stills in the mockup set the material and lighting targets for the live scene.

The first screen says **movrax60**, identifies the team as an international CTF team, and offers **Explore results**. Members and Contact are one click away. The results use five event editions. A cover expands into the source-backed record, while the remaining editions stay visible to the side. On mobile, show one full edition with swipe and arrow controls. The home roster leads to a dedicated member view with shareable profile links.

## What to borrow

| Source inspected | Borrow for movrax60 |
| --- | --- |
| [THEM?!](https://themctf.com/) | A draggable hero object with a plain-language interaction cue. Pair that with direct links to the team’s work. |
| [idek](https://idek.team/) | A custom art direction above a compact, scannable publishing index. Use the same information economy for event names, dates and sources. |
| [SIGPwny](https://sigpwny.com/) | Show team identity through real people and their work. Feature the actual handles and public competition profiles. |
| [Maple Bacon](https://maplebacon.org/) | Give the roster its own destination and put community contact in clear view. |
| [MotionSites VHS Archive](https://studio.motionsites.ai/explore/vhs-archive) | Center the selected edition and expose the other editions as a shelf. Advance by drag, swipe or arrow. |
| [MotionSites Studio](https://studio.motionsites.ai/explore) | VELL for rounded tactile controls, Golden Portal for warm lighting, Flower Valley for foreground depth, Liquid Glass Agency for idle motion and Penthouse Rain and Solar Fog for front-to-back atmosphere. Use the supplied gallery captures as reference for these details. |

## Components to reuse

| Component | Implementation source | Changes for movrax60 |
| --- | --- | --- |
| Desktop navigation | [Mekai UI Pill Nav](https://ui.mekaigames.com/components/pill-nav) | Start from the free source. Keep the sliding selection indicator, visible focus and route links. Apply the cream shell from the design. Figma uses editable Simple Design System Navigation Pill instances. |
| Mobile menu | [Base UI Dialog](https://base-ui.com/react/components/dialog) | Use the documented trigger, portal and close controls. Escape closes, focus returns, and links navigate to real sections or the roster. |
| Competition shelf | [Embla Carousel React](https://www.embla-carousel.com/docs/get-started/react), [MIT source](https://github.com/davidjerleke/embla-carousel) | Use Embla's drag and selected-snap behavior. CSS controls the size and inset of each spine. Keep labelled arrows and a list of all five events available on the page. |
| Arrow, menu, hand and sound controls | [Lucide](https://lucide.dev/) | Use the library glyphs with visible focus and labels on icon-only buttons. Keep a 44 px minimum target. |
| Motion | [Anime.js](https://animejs.com/documentation/animation/), [Three.js](https://threejs.org/docs/) | Use the installed libraries. Animate the cloth response, archive focus and content transitions. Keep normal browser scrolling and link behavior. |

The pill navbar is a visual and interaction component. The desktop links retain navigation semantics. The mobile menu uses a dialog, with focus handling from its library. Preserve the notices when vendoring source and record the imported component version in its commit.

## Button and scroll behavior

| Input | Expected behavior |
| --- | --- |
| Home, Results or Contact | Go to the named section directly and update the active pill as the section enters the viewport. Retain the URL hash for linking and browser history. |
| Members or a player handle | Open the roster route. A handle opens its profile directly and marks the selected row. |
| Pick up the fold or press Enter on the flag | Toggle the lifted pose in place. Horizontal drag previews the same motion. Releasing settles to the nearest pose. A vertical touch gesture continues to scroll. |
| Scroll past the flag | The camera moves toward the hem and the warm highlight reveals the archive. The reverse scroll plays the same camera path backward. A direct Results link enters at the archive. |
| Competition arrow, edition spine, swipe or arrow key | Show the selected cover and its score together. The event navigation stays in place. Previous and Next stop at the first and last record. |
| Mobile menu | Open the list of page destinations. Escape and the close button return focus to the trigger. Choosing a destination closes the menu and moves to that section or route. |
| Sound toggle or Back to top | Sound starts muted. Back to top returns to the flag and restores the Home pill. |

## Implementation plan

1. **Build the information layout in Next.js.** Add the nav and mobile menu, the five results and their scoreboard or report links, the eight linked profiles, and contact. Serve these in the initial HTML. Work from [records.json](../records.json). Keep Hack The Box's placement visibly attributed to the player report. Use the public CTFtime team link and turn Telegram, Discord and email into links when the user supplies destinations.
2. **Make one live cloth interaction at production quality.** Author the sewn rim, jacquard surface and torn-thread variants on the Blender asset. Use the original logo as the material motif. Export a compact mesh with rest, raised and drawn poses. In Three.js, raycast the hem and blend poses with damped displacement through the available drag range. Use a dedicated tap or keyboard action for the same lift. Match the light, lens and silhouette in the two Figma shots before expanding the scene.
3. **Connect the scenes.** Use native scroll position as a reversible camera track. As the cloth nears the lens, let its lit highlights fill the frame and reveal the archive palette. Hold the archive in view during interaction with the shelf. As the visitor scrolls on, the final cover clears to reveal the roster on plum. Let the last part of the scene settle behind the contact links. Keep controls active while scrolling. For reduced motion, show each resting pose and let the visitor use the same links and selectors.
4. **Finish interaction states.** Give press and release feedback to the pill nav, fold handle, carousel arrows and profile choices. Keep idle fabric movement subtle. Use a small atmospheric pass sparingly, and pause rendering on a hidden tab. Sound is opt-in and remains a single toggle.
5. **Check the production build before promotion.** Check the home, selected results and member links at 390 × 844 and 1440 × 900. Use a real touch device for the drag and swipe check and keyboard navigation for the same flows. Check rapid scroll in both directions for geometry jumps. Profile the live scene and reduce render scale or decorative threads when the frame budget is missed. Confirm the content loads with WebGL or JavaScript unavailable. Commit the layout, sourced controls, scene, and checks separately.

## Design review

- [Flag at rest](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=2-38) and [flag lifted](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=4-10) establish the first interaction.
- [Cyber Apocalypse](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=2-71) and [Goa HackIM](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=4-40) show two archive selection states.
- [Mobile menu](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=3-149) and [mobile roster](https://www.figma.com/design/G8mvXnXLGkwDm8vQDvsmBV?node-id=3-300) show the touch layouts and destinations.
