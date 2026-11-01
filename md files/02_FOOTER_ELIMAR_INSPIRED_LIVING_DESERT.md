# ONE QUESTION LATER — DESERT FOOTER
## Production specification 02: The Living Desert (Elimar-inspired particle scenery)
**Status:** art direction approved; no approved scene asset or renderer yet.  
**Updated:** 1 November 2026

> The user explicitly emphasizes: **“The Elimar particles feel alive.”** The requirement is NOT a static photo broken into dots. It is a spatial desert memory that is continuously breathing, glinting, shedding and re-forming—while the person, sand, horizon and walking gesture remain instantly recognizable.

## 0. Visual evidence and references
- `assets/desert_original_photo.jpg` — original subject and pose reference; include original proportions/cap/hoodie/shoes/head turn.
- `assets/desert_clean_16x9.png` — preferred wide landscape plate. No trees, signage, tent or cameraman shadow. This is a **generated edited image**; compare likeness to original before approval.
- `assets/Elimar_reference_frame_01.png`, `assets/Elimar_reference_frame_02.png` — user-supplied screenshots from the reference sequence.
- `assets/rejected_current_desert.png` — unacceptable current result: isolated white dot-person in empty grey field, no visible dunes.
- **Live creative reference:** https://elimar.lmigroupintl.com/ — see **Chapter 02 / The Asylum**, the man/window/bed scene. Cite as **visual and narrative inspiration, not a verified technical stack**. We have NOT verified that the original uses GSAP or Gaussian splats internally.
- Additional verified technical links: GSAP ScrollTrigger https://gsap.com/docs/v3/Plugins/ScrollTrigger/ ; PlayCanvas splats https://developer.playcanvas.com/user-manual/gaussian-splatting/creating/ ; https://developer.playcanvas.com/user-manual/editor/scenes/components/gsplat/ ; SuperSplat https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/ ; Polycam https://poly.cam/tools/gaussian-splatting ; GPU particle reference https://tympanus.net/codrops/2023/12/19/creating-audio-reactive-visuals-with-dynamic-particles-in-three-js/ .

## 1. What makes Elimar's particles feel alive (translate behavior, not imagery)
In supplied screenshots, the room reads through window geometry, a bed, a seated human and layers of illuminated dust. Spatial relationships survive the particle effect. From screenshots alone we cannot prove whether the scene is a true Gaussian splat, a scene-based particle system, point cloud, composited footage, or a combination.

Our footer must reproduce the **perceptual causes** of that alive feeling:
1. **Stable world:** dunes, body and horizon occupy persistent 3D/depth positions; particles do not randomly replace the world every frame.
2. **Time never freezes:** even with mouse/scroll idle, individual groups gently advect, glint, curl and settle in different phases.
3. **Local coherence:** nearby motes share a flow field for short moments; they move like air interacting with surfaces, not uncorrelated screen noise.
4. **Depth-aware behavior:** foreground dust travels more visibly than distant dust; near-sand particles glide horizontally, upper air drifts slowly and sparsely; the sky is mostly clean.
5. **Light is a field:** surface patches and particles brighten or dim as an invisible moving illumination passes. No hard circular spotlight in the middle of the screen.
6. **Structure persists through disruption:** some grains lift, but enough remain in place to preserve the hood, cap, two legs, dunes and sky at every moment.
7. **Scroll changes camera/composition and degree of disintegration**; autonomous motion continues independently. Reversing scroll restores the correct earlier stage, without permanently destroying the points.
8. **Organic rhythm:** intermittent quiet pulses and glints; asynchronous rather than global strobing.

### Scene-specific rules
- **You**: cap brim, sunglass/head direction, hood and shoulders, navy-dark top, separated trouser legs, two shoes, one step in progress. Figure is clearly walking or poised mid-walk, NOT seated or floating.
- **Desert**: real sand ripples, 2–4 layers of dune relief, distant horizon. No random architecture/window/bed from Elimar copied into desert.
- **Sky**: spacious open negative space; no full-field twinkle or stars. A few wisps of moving dust are acceptable close to horizon.
- **Palette**: the original cleaned photo's bright blue sky and warm sand are spatial/color guides. The website may grade them to restrained cinematic low saturation or monochrome, but not remove the terrain or turn it into an undifferentiated black/grey fog. Test both gradings at the initial recognition moment.

## 2. Choose an honest scene pipeline before programming effects
**Preferred with only ONE photograph: Route A.** A real 3D Gaussian splat needs multiple image viewpoints or synthetic renders from a modeled scene. A single cleaned image is insufficient to reconstruct occluded surfaces reliably.

| Route | Meaning | Strength | Limitation | Recommendation |
|---|---|---|---|---|
| A. Layered 2.5D with procedural dune relief | Segment source image, create depth maps and dune meshes; figure as shallow depth representation, backed by source-textured surface | Controlled camera pullback, likeness, performance and art direction | Camera orbit must stay small; no real 360° figure | **Default now** |
| B. 3D environment + actual splat | Model desert/figure or capture multi-view desert footage, render many views, train splat, use PlayCanvas GSplat / SuperSplat | Rich volumetric camera travel with captured lighting | Extra assets, training, splat cleanup, performance | Use if high quality multi-view source exists |
| C. Pre-rendered cinematic scene + WebGL particles | Build in Blender/Houdini; render hero shot and depth/normal passes; composite with live shader drift; sync to scroll | Most authored/art-directed result, easiest to match cinematic reference | Limited free-camera interactivity; video seek and asset size management | Strong fallback/premium variant |

Do not call any fake 2.5D extrusion a verified splat. Do not call automatically segmented parts an actual animated walking rig.

## 3. Build stable spatial scene (hard gate A)
1. Create masks/plates: full foreground person alpha with fine edge matting (cap, fingers, hood, legs, shoe edges); foreground sand, mid-ground sand, distant dune line, sky; save depth map and matte-debug images.
2. Inpaint behind isolated person so parallax reveals plausible sand/sky instead of a transparent cutout. Remove removed landmarks completely. Match exposure and material hues of the clean plate.
3. Dunes: real gently displaced surface mesh or overlapping depth-warped planes using sand-ripple displacement; subtle cast/contact shadow from shoes. Horizon stays clean and plausible.
4. Figure: use the unchanged identifiable source pose, with modest thickness/relief and correct feet/ground contact. If actual gait is critical, separately prepare a rigged likeness or user-provided video and do not imply that a photo can supply unseen limb angles.
5. Author intended camera pullback + slight lateral translation; it must show actual **parallax** between figure, near sand, far dunes, sky, not scale one flat DOM image.
6. Render a static frame at progress 0.1 and 0.55 with VFX disabled. If viewer cannot name 'person walking in desert', **stop**.

## 4. Build a layered 'living matter' system
**Do not convert each pixel into a static random scatter point.** Build particles from scene regions with attributes:
```
anchorXYZ; normal; region; color/value; seed; age; cyclePhase; speed;
flowCell; brightness; alpha; radius; detachProbability; restXYZ;
```
Suggested initial visual distribution (adjust against real render):
- **Figure surface accents:** shape-retaining micro-particles on cap, hoodie folds, elbows, trousers, shoes; higher definition at head and two leg silhouettes.
- **Sand-surface particles:** thin rippling streams guided across dunes and local slope, gathering at crests; shadows remain coherent.
- **Atmospheric dust:** sparse motes in a few 3D depth layers, most visible in light shafts / grazing light; count low compared to scene-bound points.
- **Filaments:** limited surface-following linelets (not full-screen scribbles) that drift along cloth folds, dune ridges and some silhouette edges.

### Animation loops (not all tied to scroll)
**A. Surface shimmer:** an irregular band of small luminance changes runs across dune ridges as if lit by oblique sun; subtle enough that the texture doesn't sparkle like glitter.

**B. Slow coherent advection:** dust motes share small local curl-noise fields with different speed/phase by depth; wander and settle. Avoid uniformly rising snow, horizontal starfield, aggressive swirl, and constant explosions.

**C. Particle attachment/detachment:** most stay anchored to dune or cloth; a minority detach for 0.5–2s, travel a short path guided by wind, decrease alpha, then reseed at their region's anchor. Reversible rest positions for scroll.

**D. Spatial pockets:** some dust clusters briefly appear near the moving leg, hoodie edge, or dune crest then disperse. The face/cap, shoe soles, and leg gap are protected 'clarity masks' where particles cannot obscure the shape.

**E. Independent illumination:** a very broad, low-contrast traveling soft light and ambient occlusion cue move across depth. Sparkle frequency and intensity vary with world normal and depth, not from pure white-noise blinking.

**F. Breath at rest:** if the cursor stays still and scroll stops, subtle local motion continues. Compare frames at t=0, t=3, t=8 seconds; they should not be identical but scene remains recognizable.

### Motion math guidance — illustrative only
```
flow = curlNoise(worldPos * spatialScale + windOffset, time * slowRate)
flow = mix(flow, terrainTangentWind, maskSand)
offset = clamp(flow * amplitudeByRegion, maxOffset)
position = restPosition + offset + tinyNormalLift
brightness = baseBrightness * lighting(worldPos, normal, movingSoftSource)
alpha = regionMask * stableCoverage * lifetimeEnvelope
```
**Important:** A velocity field alone doesn't guarantee a sophisticated result. Art-direct the *locations, density, rhythm, occlusion, lighting and material response*. Test rendered frames at human scale.

## 5. Walking nuance: don't fake a full gait carelessly
- Current image shows a mid-step pose. This is enough to tell the narrative if parallax + restrained drift + a few foot-contact dust events are used.
- With a single photo, default to a **living still**: subtle arm/hood/cloth micro-motion and slight travel, not a mechanically exaggerated march.
- If agent can rig a likeness accurately, animate one natural step cycle with planted contact feet, minimal head bounce, hips/shoulder counter-rotation, shoe contact shadow and sand disturbances. Gate separately.
- If no rig exists, do not animate the entire cutout bouncing on the Y axis or rotate legs as disconnected cardboard sheets. No foot skating/floating.
- Always preserve face/head turn and leg separation. When in doubt, less limb animation is better than uncanny walk.

## 6. GSAP scroll-directed camera and transition (separate from autonomous time)
Use **one scroll master timeline** (GSAP ScrollTrigger scrub and pin, if appropriate). Drive camera pose, density masks, background grading and white transition through normalized `progress`; do not bind continuous shader time to scroll, or all life will stop when visitor stops scrolling.

Proposed timeline, tune after staging:
| Scroll range | Perceptual beat | Visible and stable features |
|---|---|---|
| 0–0.16 | **Recognition / arrival** | full living photographic desert, readable walker, dunes, sky; minimal dust |
| 0.16–0.42 | **Awakening** | dunes shimmer, cloth filaments glide, a few grains detach; sky remains clean |
| 0.42–0.70 | **Memory-space** | camera pulls back, coherent spatial particle depth appears; figure still legible; modest parallax |
| 0.70–0.88 | **Release** | surface material reduces slowly, particles follow field away; still glimpse figure/horizon |
| 0.88–1.00 | **Reconciliation to white** | exposure/palette blends to light, dark elements lose density; actual page background becomes clean white |

Transitions should support scrolling **both forward and backward** without sudden reset. When text overlays the scene, maintain contrast and keep the focal body unobstructed. Never end in a dirty grey frame or a flash-white wipe.

## 7. Visual/technical composition rules
- In the first third of the section the horizon is visible and dunes occupy meaningful screen area. The figure does not become a tiny bright sprite from the start.
- Density priority follows semantic importance: cap/face silhouette → torso edge → split between legs → shoe contact → dune ridges → atmospheric motes → mostly empty sky.
- Use physical/perceptual depth cues: focus/contrast variance, occlusion, parallax, grazing light, shadow, point size by distance and subtle spatial gradients. Do not overuse depth-of-field blur.
- Keep mouse lighting broad and subtle; avoid isolated white dot markers that obscure figure.
- Keep the page's typography/UI legible, including possible 'Still no signal. Still not stopping.' caption if still used by site.
- On small/mobile screens: crop anchored to body plus visible sand/horizon, reduce motes, preserve leg separation and text, use lower DPR. Reduced-motion shows a stable strong still and transitions without intense animation.
- Motion/autoplay fallback can be a pre-rendered loop (WebM/MP4 with poster) plus CSS/HTML scroll; test actual decoding and scroll direction.

## 8. Quality gates with user sign-off
**Gate A: photography & depth** — deliver clean 16:9 unanimated scene PNG + masks + depth map + normal/parallax proof. No particles. User recognises self in desert immediately.

**Gate B: alive at rest** — 10 second continuous screen capture with mouse and scroll stationary; localized glints/filaments/dust move gracefully, not constant random pixel noise. Still images at 0/3/8 seconds should be different but stable in composition.

**Gate C: controlled scrolling** — 15–25 second capture of forward AND reverse scrolling; show camera pullback, reveal, drift, then clean white finish. Smooth transition and coherent reformation upon reverse scroll.

**Gate D: real devices** — representative desktop + mobile performance log (GPU/CPU, fps and resolution), viewport screenshots at 1440x900 and 390x844, reduced-motion behavior and fallback.

Do not claim completion based on successful build or Lighthouse score alone. User visual sign-off required before deployment.

## 9. Agent delivery inventory
- Processed source masks, depth/normal maps, inpainted backing plate.
- Dune geometry and subject plane/depth mesh; if rigged, source rig and animation. If splat-based, raw capture/synthetic renders, `.ply` / `.sog` and cleanup notes.
- Code `LivingDesertScene`, `DesertParticleField`, `SceneScrollController` with isolated parameter config and README.
- Preview footage for idle and both scroll directions, stills at 0.10/0.30/0.55/0.75/0.95 normalized progress.
- Explicit report: *what is true 3D, what is 2.5D, what is pre-rendered, what source information is unavailable.*

## Explicit rejection conditions
- A black/grey background full of evenly distributed white dots.
- A small lone figure made of points without visible sand, sky or horizon.
- Particles that freeze when the scroll stops.
- Simulated 'walking' that slides on the spot or breaks ankle/knee silhouette.
- A scene that cuts directly from charcoal to white without transitional design.
- Claiming true room/desert scan reconstruction from one generated landscape JPEG.
- Blindly replicating Elimar's actual characters/room/window/bed rather than its **behavioral aesthetic**.
