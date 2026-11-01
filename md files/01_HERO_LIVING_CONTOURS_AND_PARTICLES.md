# ONE QUESTION LATER — HERO
## Production specification 01: Living Contours × Particles
**Status:** art direction approved; technical build NOT approved.  
**Updated:** 1 November 2026  
**Priority:** correct human geometry → coherent contour field → living particles → pointer lighting → integration.

> Creative aim: A recognizable, complete sculptural portrait that appears to be **drawing and redrawing itself with living contour lines**. Fine particles are its transient breath, not its construction material.

## 0. Source assets and reference priority
- **Identity:** `assets/hero_original_portrait.JPG` (Anmol's face; use likeness and silhouette, not photographic face texture).
- **Explicitly rejected:** `assets/rejected_current_hero.png`; warped/melted features, over-textured hair, patchy face, dark eye sockets, little legibility.
- **Look/behavior:** *Living Contours* direction approved by user, interpreted originally. Secondary kinetic reference: **Dark Grace – Curl noise simulations**, Flaré: https://www.behance.net/gallery/129044741/Dark-Grace-Curl-noise-simulations (visual-motion reference only; do not copy composition or source files).
- **Interaction heritage:** Daniel Ingrassia: https://ingrassiadaniel.it/ (mouse-reactive, editorial presentation; not geometry-source code).
- **Technical starting points:** FaceBuilder https://keentools.io/products/facebuilder-for-blender ; mesh import https://threejs.org/docs/pages/GLTFLoader.html ; surface-attached GPU strands example https://github.com/eriondibrani/hair-simulator ; Three Line2 https://threejs.org/docs/pages/Line2.html ; GPU simulation https://threejs.org/docs/pages/GPUComputationRenderer.html ; research index in `03_REFERENCES_AND_ACCEPTANCE.md`.

## 1. Locked visual composition
- Head, neck, tops of shoulders only; no full chest/torso. True **rounded, closed 360° skull** (not a front-only relief).
- Dark graphite, satin/stone material, restrained grayscale. Black/near-black webpage canvas. Do not aim for realistic skin or hair color.
- Recognizable shape anchors: broad curly hair mass with tapered sides, Anmol's brow contour, nasal silhouette, cheek-to-jaw transitions, short facial hair outline, ear placement, neck proportion. Avoid all unnecessary tattoo, jewelry, pores, photorealism.
- Keep a stable shaded facial base beneath lines: face reads when contours and particles are turned off.
- Architectural feeling: dense precision, negative space, coherent visual rhythm; **not** glowing hair noodles, a wireframe hacker mask, random sparkles, spiky rock, chrome alien, or melted wax.
- Head may show slight asymmetry and a restrained three-quarter turn. No strong bobbing or constant rotation.

## 2. Stage A — Build the bust before VFX (hard stop gate)
1. Inspect the current asset. If it is built from one image plane / warped depth mask / thin extruded silhouette, **discard it as hero geometry**. Do not polish its shader.
2. Reconstruct using a fitted human-head topology workflow (FaceBuilder for Blender or another dedicated head-fitting tool), then manually adjust against portrait. Best evidence: supplementary left/right three-quarter and side photos if available. The rear skull is necessarily approximate from a single front photo; label as such.
3. Model rear cranial volume, jaw underside, temples, ears, neck-to-shoulder transition. Hair = **real 3D clumped silhouette** around scalp; separate mesh or mesh groups to allow distinct shading.
4. Confirm outward normals, no holes, no duplicate shell, no floating jaw/ear/neck seam; decimate carefully for the browser.
5. Export `anmol_head_neck_shoulders.glb` plus a neutral studio light QA contact sheet at yaw 0°, ±45°, 90°, and 180°. Face forward convention documented, e.g. +Z, Y-up, meters.
6. **Approval gate A:** With all effects disabled, frontal likeness must be recognizable, profile/rear must show real cranium and believable hair. If not, stop and correct geometry.

## 3. Stage B — Living CONTOURS (primary surface language)
**Do not draw generic random lines directly in screen coordinates.** Lines must live in mesh coordinates and continue across its curved surfaces.

- Derive field lines on the mesh using UV/tangent directions, local curvature, and/or a carefully authored tangent vector field. Construct streamlines in 3D; at each step project back to the base mesh or update using surface coordinates, so they never cut through cheek/nose/ear geometry.
- Start with layered, fine (roughly 0.45–1.0 screen px at desktop DPR 1; adapt to resolution), silver-gray curves. Mix longer orbital contour tracks with many short surface strokes. Variable spacing and phase; no uniform zebra pattern.
- Curves should bend around nose/cheeks/brow and flow around hair clumps. Hair can have denser/high-frequency strands; facial planes need quieter, wider paths to preserve identity.
- Sample surface zones separately: brow/nose/cheek/jaw/hair/ear/neck/shoulder. Use per-zone speed, density and opacity settings. Mask out eyes and nostril interiors to prevent distracting luminous tangles.
- Suggested starting art balance: base bust ~60% of perceived image, living contours ~30%, free particles ~10%. **These are perceptual targets, not blending equations**. Make tunable in debug controls.
- Animate path highlight/phase or gentle tangential drift, not the whole head mesh. A slowly advancing bright segment should travel along a curve while the line remains anchored to the sculpture.
- The motion must be **continuous even when the mouse and scroll are stationary**. Different contour zones have independent subtle cycles; no synchronized global flashing.
- Use batched line geometry / instanced ribbons / custom shader; do not create thousands of independent React mesh components.

## 4. Stage C — Particles as living secondary layer
Build a mesh-surface particle buffer with anchors in position/normal/UV or barycentric coordinates. **Never sample from screen-space white pixels for the 3D face**.

Each particle needs: `anchor`, `normal`, `surfaceZone`, `seed`, `age`, `phase`, `size`, `luminance`, `restPosition`.

Three controlled behaviors should coexist:
1. **Surface dwell (majority):** maintain attachment to a face/hair surface and shimmer in intensity with asynchronous phases; tiny drift tangentially, then spring back toward anchor.
2. **Contour carry:** a sparse subset travels along the animated contour paths; luminous flecks periodically collect at curvature turns and fade away. Never all move in the same direction.
3. **Edge release (very small subset):** a few detach near hair perimeter, jaw, shoulder, then arc into negative space and fade/reset. No steady snowstorm.

Particle movement is local and coherent. A good loop has a stable recognizable shape with micro-events inside it: a passing glint, a gentle ribbon shift, then a few disappearing flecks.

**Algorithmic guideline (not drop-in code):**
```
surfaceP = sampleMesh(anchorUV, barycentricCoords)
tangentFlow = projectToTangent(curlNoise(surfaceP*frequency, time*slowRate), normal)
position = surfaceP + tangentFlow*smallOffset + normal*microLift
position += springToAnchor(position, surfaceP, stiffness)
brightness = base + localTravelingGlint + lowAmplitudeNoise(seed, time)
```
Avoid `position += randomVector*dt` without an anchor or return force. That is how the portrait turns into an undirected cloud.

## 5. Pointer-driven illumination and movement
- Cursor coordinates → eased 3D target → soft light/material response on actual face curvature. **No visible point-light sprite or white orb**.
- 3D pointer light changes roughness/specular/emission subtly along near-facing contour segments, as if a light is scanning the surface.
- Smooth follow around 0.12–0.25 seconds (tunable); clamp falloff so the nose does not bleach into an amorphous blob.
- Base fill/rim lighting always keeps the skull silhouette readable at rest, with the pointer far away.
- Tilt ≤ ~4° yaw and ≤ ~2° pitch on hover, if used; no manual orbit by default. A test-only QA orbit controller is fine.
- Always-on slow idle animation stays active even without pointer input. On touch, authored slowly wandering light; no mouse dependency.

## 6. Implementation architecture
Suggested structure:
```
HeroExperience.tsx
  ├─ HeadMesh.tsx                  // GLB only; geometry stable
  ├─ ContourField.tsx              // surface-anchored curves, shader phase
  ├─ SurfaceParticles.tsx          // instanced/points geometry, anchor attributes
  ├─ PointerLight.tsx              // damped 3D light target
  ├─ HeroFallback.tsx              // optimized still, a11y
  └─ heroConfig.ts                // tunable density, movement, roughness, DPR
```
- Three.js / React Three Fiber; use `GLTFLoader` or `useGLTF`. Tailwind CSS is for layout/typography only.
- Consider GPU simulation only when simple vertex shader animation cannot meet the art direction. If using `GPUComputationRenderer`, account for GPU precision and mobile compatibility. Use proper z-depth/occlusion of strands.
- Frame-time budgets matter more than a boast about points. Start modestly and profile while moving the mouse and scrolling on a real machine; enforce DPR / LOD reductions on mobile.
- Stop work when canvas not visible; dispose geometries/textures/RAF; no scroll library conflicts. Reduced-motion -> stable smooth bust + a few static contours.

## 7. Motion language — 'alive' test
**Reference behavior, not literal imitation:** Elimar's scene suggests a world in continuous atmospheric motion; Dark Grace suggests an organic flow field. For the hero, translate these into micro-scale surface activity.
- Breath: tiny density/brightness expansion across hair and cheek patches, staggered, no visible global pumping.
- Advection: contour highlights migrate along stable paths; motion wraps around depth.
- Release/return: very few particles drift away and rejoin/swap at stable anchors.
- Persistence: form remains intact when the user stops moving the mouse; looping time remains independent of scroll state.
- Spatial lighting: brightness tracks surface orientation and shadow, not uniform random blinking.

## 8. Capture, acceptance and delivery
**Gate A — clean mesh**: PNGs from front, both three-quarter views, side, back; compare to portrait. No contour or particles. Must look like a complete head, not a mask.

**Gate B — still style**: 1440×900 desktop composition and 390×844 mobile crop, one image with mesh only, second with contour only, third with combined contours+particles. Face still legible when downscaled to a thumbnail.

**Gate C — motion**: 10–15s uncut screen capture with NO mouse movement for first 5s; motion should still be visibly alive. Then move pointer across face; light responds without hotspots. Capture a 45° QA orbit without melting artifacts.

**Gate D — integration/performance**: homepage layout preserved, text unoccluded, 60fps target on representative desktop and sensible 30fps mobile target (measure, do not assert), fallback for non-WebGL and reduced motion.

Deliver: `anmol_head_neck_shoulders.glb`, QA contact sheet, `HeroExperience`, shaders/config, fallback, performance notes, recorded clips. **Do not claim completed until all four gates are shown and visually approved.**

## Explicit rejection conditions
- A thin front-face sheet, flat point cloud, shiny acrylic mask, or missing back of cranium.
- Heavy filament density hiding the eyes, jaw and profile; distorted nose/lips.
- A portrait made primarily of flickering white dots on black.
- Identical full-scene noise used for hair/face/neck; random hair explosions.
- Bright light orb tracking the cursor instead of actual surface lighting.
