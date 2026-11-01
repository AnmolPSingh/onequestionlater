# ONE QUESTION LATER — VERIFIED REFERENCE LIBRARY
**Date checked:** 1 November 2026. URLs and source descriptions may change.  
**Read alongside:** `01_HERO_LIVING_CONTOURS_AND_PARTICLES.md` and `02_FOOTER_ELIMAR_INSPIRED_LIVING_DESERT.md`.

## A. Creative references — use what is visible, do not assume codebase

### 1. Elimar — LMI presents Elimar
- Website: https://elimar.lmigroupintl.com/
- Location: scroll to Chapter 02 / **The Asylum**. Supplied screenshot files: `assets/Elimar_reference_frame_01.png` and `assets/Elimar_reference_frame_02.png`.
- **Borrow:** a scene that exists in depth before the particle effect; atmospheric motes linked to architecture and a person; dark cinematic grading; continuous subtle activity during quiet moments; scroll drives camera/narrative rather than merely toggling dots.
- **Do NOT borrow:** asylum room, windows, bed, the original person, text or narrative. The target is desert dunes + walking person.
- **Technical confidence:** The public page confirms content and chapter, but its exact animation implementation cannot be verified from accessible public markup. Do not claim its technique is definitely Gaussian splatting or GSAP; **Elimar is a visual target, not a code recipe**.

### 2. Dark Grace — Curl noise simulations, Flaré
- https://www.behance.net/gallery/129044741/Dark-Grace-Curl-noise-simulations
- **Borrow:** surface-related filament movement, fluid curl noise, restrained density variations, sculptural depth, clearly continuous organic animation.
- **Do NOT borrow:** exact artwork, face, scene, shader code, composition. This is inspiration. A Behance page may block machine access; open in a human browser for proper animation review.

### 3. Daniel Ingrassia — interactive portfolio
- https://ingrassiadaniel.it/
- **Borrow:** negative space, editorial hierarchy, interactive portrait/hover-light cues. The site has evolved; user's earlier Daniel reference and screenshots may not match the current page exactly.
- **Do NOT borrow:** portrait geometry, brand assets, exact layouts.

## B. Production references — what each one solves

| Reference | Link | Relevance | Caution |
|---|---|---|---|
| KeenTools FaceBuilder for Blender | https://keentools.io/products/facebuilder-for-blender | Proper multi-photo fitted facial mesh; Mac support; reusable 3D geometry | Hair, rear skull and shoulders still need authoring; a single image cannot guarantee accurate unseen areas |
| Three.js GLTFLoader | https://threejs.org/docs/pages/GLTFLoader.html | Load stable `.glb` head in browser | It is a loader, not a face reconstruction engine |
| React Three Fiber GPU instanced strand example | https://github.com/eriondibrani/hair-simulator | Surface-linked strands, raycast-derived roots, curl noise texture; concrete implementation inspiration | Experimental example, not a ready-to-use human likeness or guaranteed high-end aesthetic; evaluate code/security/license before reuse |
| Three.js `Line2` | https://threejs.org/docs/pages/Line2.html | Rendering curved lines with controlled widths | For many fine lines consider batched/custom instancing for speed |
| Three.js GPUComputationRenderer | https://threejs.org/docs/pages/GPUComputationRenderer.html | Stateful GPU point position/velocity computation | Test mobile GPU support, float texture precision and memory |
| Codrops dynamic particles / curl noise | https://tympanus.net/codrops/2023/12/19/creating-audio-reactive-visuals-with-dynamic-particles-in-three-js/ | Working article on organic 3D point motion, shader-based curl noise | Its demo is audio-reactive; repurpose principles for autonomous local airflow, not audio |
| GSAP ScrollTrigger | https://gsap.com/docs/v3/Plugins/ScrollTrigger/ | Pin/scrub camera + transition with reversible scroll | Keep shader `time` independent of `progress`; don't mount duplicate scroll drivers |
| PlayCanvas Gaussian splat creation | https://developer.playcanvas.com/user-manual/gaussian-splatting/creating/ | Honest capture requirements; multi-view imagery or synthetic renders | One still image alone does not produce an accurate navigable scene |
| PlayCanvas GSplat component | https://developer.playcanvas.com/user-manual/editor/scenes/components/gsplat/ | How to render splat data in a real-time browser scene | Consider cost, sorting and format before adopting |
| PlayCanvas React GSplat | https://developer.playcanvas.com/user-manual/react/api/gsplat/ | `.ply`/`.sog` handling in PlayCanvas React | Not direct drop-in for a preexisting R3F scene; integration requires planning |
| SuperSplat | https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/ | Clean, crop and animate Gaussian splats with browser tooling | No scene data supplied in this bundle; this is tooling guidance |
| Polycam Gaussian splatting | https://poly.cam/tools/gaussian-splatting | Photo/video capture requirements; viewpoint coverage | User's existing single photo should not be misrepresented as multi-view capture |

## C. Bundled visual assets — provenance / purpose
All image filenames below are **local in this bundle**. Images were supplied in this chat or created from the user's photo in the preceding work; they are not third-party images downloaded for resale. Reference screenshots should remain in this private working package, not published as site content.

| File | Origin / what it shows | Use |
|---|---|---|
| `assets/hero_original_portrait.JPG` | User-submitted front portrait | Likeness, skull silhouette, hair mass; does not validate profile/rear anatomy |
| `assets/desert_original_photo.jpg` | User-submitted desert photo | Exact body pose, gait moment, outfit and proportions |
| `assets/desert_clean_16x9.png` | Edited/generative landscape version from chat | Main composition and color guide, **verify likeness against original** |
| `assets/Elimar_reference_frame_01.png` | Screenshot submitted by user | Particle scene spatial composition, window light, figure, environment |
| `assets/Elimar_reference_frame_02.png` | Screenshot submitted by user | Same scene with overlay text, visual depth and motion intent |
| `assets/rejected_current_hero.png` | Screenshot submitted by user | Negative example: warped anatomy + tangled face filaments |
| `assets/rejected_current_desert.png` | Screenshot submitted by user | Negative example: ungrounded particle humanoid, missing dunes |

## D. Direction consistency matrix

| Attribute | Hero | Footer |
|---|---|---|
| Primary recognition | face and real 3D skull | person walking in visible desert |
| Spatial base | closed GLB head/neck/upper shoulders | layered relief scene; optional proper splat with multi-view |
| Primary language | living contours | living spatial environment / drifting dust |
| Secondary language | tiny particle blooms | localized surface particles and occasional contour streaks |
| Movement source | autonomous micro-motion + pointer lighting | autonomous wind/shimmer + GSAP camera progress |
| Must stay stable | head shape and likeness | figure pose, leg gap, horizon and dunes |
| Palette | dark graphite monochrome | photo-informed then cinematic dark/monochrome to clean white |
| Must not happen | acrylic mask / melting face | grey starfield, erased desert |

## E. What approval actually means
Use this exact order. **Do not change the deployed website until gates are approved:**

1. **Geometry:** Head from 5 angles without effects; footer full scene without effects. Show contact sheets.
2. **Surface language:** Head contours ON, particles OFF; desert terrain shimmer ON, random dust OFF. Show stills and 8–10s idle recordings.
3. **Living behavior:** Turn particles ON. Record 10s while mouse/scroll are stationary. The particles should live but silhouettes should stay intact.
4. **Input behavior:** Hero hover-controlled light; desert forward and reverse GSAP scrub. Provide captured desktop and mobile behavior.
5. **Integration & performance:** 1440×900 and 390×844 captures, reduced-motion pass, no blocking of buttons/text, actual frame profiling.

## F. Two tests to catch the existing failures in seconds
**Test 1 — the black-screen comparison:** turn off the particle system. If the head has no recognizable face, or the desert has no recognizable dunes/person, the artwork is not ready. VFX cannot fix the scene.

**Test 2 — hands-off ten seconds:** keep cursor still, stop scroll, screen-record 10 seconds. The world should have *quiet, continuous* change, with movement that respects shape and light. If it freezes or looks like random pixel noise, it fails the 'Elimar alive' target.

## G. Technical risk and truthfulness
- Elimar's underlying stack is unknown; don't invent one.
- Gaussian splat ≠ ordinary white-dot particle effect. A splat is a reconstruction/rendering representation that usually requires multi-view imagery. You can render custom particles **on top of** a splat or mesh, but they are separate effects.
- A true 3D head cannot be faithfully reconstructed in rear view from a single front portrait. Request additional views for likeness sign-off.
- A true gait cycle cannot be reliably extracted from one static walking frame. Use a proper rig/video for gait or keep a subtle living-still pose.
- A static high Lighthouse score does not validate interaction smoothness or visual quality.
