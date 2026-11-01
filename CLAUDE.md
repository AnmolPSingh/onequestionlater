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

**Direction, 1 Nov 2026 (overrides the portrait and close above):** the site is One Question Later, by Anmol Pratap Singh. The name is the body of work, not a pseudonym: Anmol's name stays on the hero. Never a staircase, ladder or career progression, and AI is not the top; the visual idea is one thread wandering between discoveries, running off the edge. The hero is a closed 3D bust (`site/scripts/make-bust.py`, `bust-blender.py`, `bake-bust.py`; the GLB and review sheet are in `site/assets-src/bust/`) with strands on its surface and the scene's dots landing on it (`site/src/scripts/bust.js`). Never go back to points from photo pixels with invented depth: that made the acrylic mask. The face is measured from `IMG_7055.JPG`; the side, back and hair are artistic, and a scan or more photos would improve them. The close is `assets-src/desert-walk.png` as dots on real surfaces (`scripts/make-desert.py`, `src/scripts/dunes.js`), then a camera pull-back, then white. Walking is implied from one photo, not a true gait; a walking video would allow a rig.

## Stack

- Static site. Astro with plain HTML sections and a small amount of vanilla JS, or a single hand-built HTML/CSS/JS site if Astro is overkill.
- Raw WebGL for the particle scene and Lenis for smooth scroll. No three.js or GSAP.
- Run it with Node 24 (`site/.nvmrc`).
- Self-hosted woff2 fonts.
- Hosting: Cloudflare Pages or Netlify. Domains: onequestionlater.com is primary, set in `site/src/config.ts` (not bought yet). becuriousenough.com 301-redirects to it, including all paths.
- No analytics cookies. If analytics are wanted, use a cookieless option (Plausible or Cloudflare Web Analytics).

## Pages

- `/`: loader (the last photo breaks into the dots that form the sculpture), hero sculpture (it turns and moves right on scroll), statement with the thread, the curiosity two-liner (radio static to signal), Session (a fly-through where each scene arrives with the playhead, ending in "What comes next" in particles), globe, Work (one full-screen slide per project, turning over on scroll), close (the desert in particles, a pull-back into flat white, the line, then contact details).
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
