# CLAUDE.md: onequestionlater.com build brief

*This is the handoff file for Claude Code. Read it before writing any code. It points to the spec files in this folder. Those files are the source of truth.*

## Read first, in this order

1. `2026-10-31 — 01 Site Brief.md`: purpose, audiences, non-negotiables, open decisions.
2. `2026-10-31 — 02 Story Arc and Interaction.md`: section order and what each one does.
3. `2026-10-31 — 03 UX Copy.md`: every word on the site. Use it verbatim. Don't rewrite copy while building.
4. `2026-10-31 — 04 Design Direction.md`: palette, type, layout, motion.
5. `2026-10-31 — 05 Assets Map.md`: which media goes where, and what must never be used.
6. `one-question-later-agent-philosophy.md`: the philosophy. It overrides anything above that frames the career as a ladder. The test for every section: does this feel like someone following curiosity, or presenting a résumé?
7. `md files/`: the current hero (Living Contours) and desert (Living Desert) specs, with approval gates A to D. They replace `ANMOL_LIVING_SCULPTURE_AGENT_BRIEF.md` and `ANMOL_DESERT_FOOTER_AGENT_BRIEF.md`. Don't move past a gate, or deploy, without Anmol's sign-off.

**Direction, 31 Oct 2026 (overrides 02 and the layout and palette parts of 04):** the site is a short portfolio, not a scroll story, and it must not look like the talk deck. The concept is "your life as a session": a music arrangement of Anmol's career, with projects as Releases. Motion follows the per-scroll particle behaviour of https://ingrassiadaniel.it/ (one particle cloud morphing section by section, nothing ever static), in shapes that are Anmol's own: portrait, waveform, radio static tuning into a signal (the curiosity story), career tracks, globe, ribbon. Keep 03 for voice and any line it covers; new labels and project write-ups are drafts for Anmol to approve. References set the feel, so never copy their code or reskin the deck. The hero matches the reference's measured proportions: Inter Tight at 22.5px at 1440 wide, 5vw side margins, hair at 10% of the screen, head 29% of its width, shoulders running off the bottom. The pointer is a light: it falls across the surface and leans the head slightly, and never distorts anything.

**Direction, 1 Nov 2026 (overrides the portrait and close above):** the site is One Question Later, by Anmol Pratap Singh. The name is the body of work, not a pseudonym: Anmol's name stays on the hero. Never a staircase, ladder or career progression, and AI is not the top; the visual idea is one thread wandering between discoveries, running off the edge. The hero is a closed 3D bust (`site/scripts/fit-head.py`, which fits the MIT ICT Face Model to the portrait's landmarks, then `build-head.py`, `bust-blender.py`, `bake-bust.py`; the GLB and review sheet are in `site/assets-src/bust/`) with strands on its surface and the scene's dots landing on it (`site/src/scripts/bust.js`). Never go back to points from photo pixels with invented depth: that made the acrylic mask. The face is measured from `IMG_7055.JPG`; the side, back and hair are artistic, and a scan or more photos would improve them. The close is `src/scripts/living-desert.js`: the dune plate, the figure and its matte at their own depths on near-black, flecks sampled from where light falls, a continuous camera push-in, then white. Walking is implied from one photo, not a true gait; a walking video would allow a rig.

**Revamp, 2 Nov 2026 (overrides the type, hero and middle sections above; the concept is `review/2026-11-02-revamp/revamp-concept.md`):** every element must mean something where it appears, so nothing borrowed from a reference stays (the DNA ribbon is gone). The globe was cut and then brought back at Anmol's request: it stays, with its arcs and orbit ring, shifted right so the sentence stays clear of it. Living dark canvas (smoke and grain in `scene.js`). Type: Newsreader Light for thoughts and headlines, Geist Sans for reading, Geist Mono only for measured things. The hero is two of Anmol's reference views in Elimar-lit dots (`site/scripts/make-views.py` writes `public/hero/views.bin`; `shapes.portrait` reads it); scrolling flows the front view into the three-quarter slant and never further, and the figure steps aside so words never land on it. The radio scene is three beats: static, a dial passing each thing he found, then the voice. Release pages gather their dust into a question mark beside the column.

**Direction, 7 Nov 2026 (overrides the type, section order, radio and globe above; the brief is `portfolio-handoff/`):** the home page runs portrait, approach, Selected Work, journey (Session), close. The approach screen keeps the big line and replaces the steps-and-fields diagram with "Bring another way of seeing, then make it work" and its first paragraph. Selected Work shows four cases side by side (document assistant, voice receptionist, invoice processing, research assistant), each with its Anatomy isometric figure and its own `/work/<slug>` page, then the rest of the work as an index. The radio chapter, the globe stop and the project slides are gone; the globe's sentence sits inside Selected Work. Type is Space Grotesk throughout: 700 for statements and titles, 400 for reading, 500 for labels and dates. `found.js` is parked, not imported.

**Direction, 2 Nov 2026, earlier (the close still holds; the hero part is replaced by the revamp):** Anmol rolled both back to the original particle design. The hero was the dot portrait (`site/scripts/make-portrait.py`). The close is the earlier Elimar-style dot desert from `assets-src/desert.jpg` (`scripts/make-desert.py`, `walked()` in `scene.js`): the figure holds still and shimmers, "Still no signal. Still not stopping." sits mid-screen beside it, then each scroll walks the camera into the light, the dots pass it, and the page turns white. Not `dunes.js` or its pull-back, and the figure's legs never move. The fitted bust (`bust.js`) and the living desert (`living-desert.js`) are parked, not imported.

## Stack

- Static site. Astro with plain HTML sections and a small amount of vanilla JS, or a single hand-built HTML/CSS/JS site if Astro is overkill.
- Raw WebGL for the particle scene and Lenis for smooth scroll. No three.js or GSAP.
- Run it with Node 24 (`site/.nvmrc`).
- Self-hosted woff2 fonts.
- Hosting: Cloudflare Pages or Netlify. Domains: onequestionlater.com is primary, set in `site/src/config.ts` (not bought yet). becuriousenough.com 301-redirects to it, including all paths.
- No analytics cookies. If analytics are wanted, use a cookieless option (Plausible or Cloudflare Web Analytics).

## Pages

- `/`: loader (the last photo breaks into the dots that form the portrait), hero portrait (it turns and moves right on scroll), approach, Selected Work (four cases, then an index of the rest), Session (a fly-through where each scene arrives with the playhead, ending in "What comes next" in particles), close (the dot desert, a walk into the light, flat white, the line, then contact details).
- `/work/<slug>`: one page per release (`site/src/data/work.ts`, `site/src/content/work/`). Music is not a release. Philanthropel leads, with Penname and Catalyst as part of it.
- `/philosophy`: the philosophy as an experience (`site/src/pages/philosophy.astro`, `src/scripts/philosophy.js`, `src/styles/philosophy.css`, `src/data/philosophy.ts`). Its copy is final and supplied by Anmol: never rewrite it. Reached from the hidden thought under the name, top left, and it ends in an arrow into the work, with no footer.
- Project pages tell each story as The question, What I found, What I tried, What it became, The next question. Talking Philanthropy, Philanthropic Intelligence and Back at ISDI keep their short format.
- `/404`: copy in 03.

## Hard rules

1. **All story text is real HTML text**, never baked into images or canvas. It must read fully with JS off.
2. **Respect `prefers-reduced-motion`**: those visitors get every graphic in its final state, silent. The Calm mode toggle was removed on 31 Oct 2026 at Anmol's request.
3. **Mobile first.** Test at 360px wide. No horizontal scroll. Pinned sections must work with touch scrolling.
4. **Keyboard:** skip link, visible focus ring in `--onair`, timeline clips reachable by Tab, form fully operable.
5. **Accessibility:** WCAG 2.1 AA contrast, real labels on every form field, error messages tied to fields with `aria-describedby`, alt text on every photo.
6. **Performance:** Lighthouse 90+ on mobile. Lazy load media below the fold. Total JS under about 150 KB gzipped.
7. **Email address** appears as text with a copy button, not a bare `mailto:` scraped by bots. Light obfuscation is fine.

## Content rules (do not break)

- **GP disclosure:** Anmol confirmed on 31 Oct 2026 that Global Philanthropic has agreed to full detail, so metrics and project write-ups can go on the site. No client names. Internal screens only as clean versions Anmol supplies. `gp-proposal-system.jpg` must never be in the build, because it shows client names and colleague emails. `src/assets/work/proposal-dashboard.jpg` is a redacted copy (names, organisations and emails blurred) made because Anmol asked for the slide example; the original `gp-proposal-system.jpg` stays out of the build.
- **No job-search signals.** No "open to work", "hire me", "available for roles", CV download buttons or salary talk. The site is a story and a place to ask questions.
- **Voice:** first person, Anmol's voice, no em dashes (the top-left thought was supplied with one; it's set as a line break instead), straight quotes. If copy needs to change, flag it and ask. Don't improvise new copy.
- Keep out of all public copy: how Photoshop was first obtained, and anything that frames early posters as copying. The approved framing is "rebuilding posters I loved".
- Srishti's section and photos need her sign-off before launch. Build it, but keep a flag (`SHOW_FULL_CIRCLE`) to turn it off.

## Open decisions (check `01 Site Brief` before building)

Palette, typeface option, and the Srishti section. Ask Anmol was removed on 31 Oct 2026. Sound is decided: Anmol's own track, Reverie, in `site/public/score/`, on by default, fading from 0 to 35% over 8 seconds, with the particles reacting very subtly. Browsers only allow it after a click, tap or key press, so that first gesture starts the fade; reduced motion stays silent. Build with the defaults in 04 and keep them as CSS variables and flags, so they're one-line changes.

## Definition of done for v1

- The story reads start to finish on a phone, with reduced motion, and with JS off.
- No em dashes in the rendered site (grep the build output).
- No file from the "Do not use" list in the build (grep the build output).
