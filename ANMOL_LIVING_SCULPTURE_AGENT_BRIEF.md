# ANMOL — Living Sculpture Hero
Production specification · 1 November 2026

## Goal
Build an original, recognizable interactive 3D portrait of Anmol for his portfolio homepage. Reference aesthetic: *Dark Grace – Curl noise simulations* by Flaré (https://www.behance.net/gallery/129044741/Dark-Grace-Curl-noise-simulations) combined with the restrained interaction of Daniel Ingrassia’s portfolio (https://ingrassiadaniel.it/). This is an interpretation, **not a literal copy**.

## Source material
- Anmol’s front-facing portrait `IMG_7055.JPG` (provided by user).
- `image(6).png` and `image(7).png` show current attempts: particles approximating a silhouette in the frontal view. These are **rejected**, because the subject reads like a thin acrylic face mask, not a volume.
- Do not use existing flat-point-cloud mesh or image-plane extrusion as the final head.

## Art direction — locked
- A monochrome charcoal/pewter head, neck, and **only the tops of the shoulders**. Crop around upper chest. No full torso.
- Smooth sculpture as the base with a *living skin* of fine directional strands/filaments. A smaller number of loose particles emerge along edges, near hair, and at certain transitions.
- Identity comes from Anmol’s overall proportions: pronounced curly hair mass and taper, brow/nose volume, ear placement, jaw, short beard silhouette, and neck proportion. No skin-colour/photo-realism needed.
- Minimal black stage, editorial typography, clear negative space. No hologram blue, glowing wireframe face, thick strands, glitter confetti, or facial photo texture.
- Movement should feel restrained and expensive: nearly still at rest; organic, locally coherent motion that suggests the surface is breathing.

## Non-negotiable geometry requirements
1. **A complete closed 360° volumetric skull**, including rounded cranium, posterior skull, temples, nose, cheeks, chin, jaw, and ears. Neck volume connects organically to shallow shoulder geometry. No thin sheet or mirrored front shell.
2. Use a real 3D head basemesh and *sculpt/reconstruct* likeness. A single front photo cannot accurately determine the back of the skull or side profile. Treat side/back as artistic approximations until more photographs or a scan are provided; do not claim scan accuracy.
3. Add genuine hair volume with layered low/mid-frequency clumps reflecting curly silhouette. Hair must read correctly at 45° yaw, not just head-on.
4. Clean normals, sufficient topology for smooth shading and displacement. No open holes or self-intersecting slab edge. Export `anmol_bust.glb` in a known coordinate system (Y up, face toward +Z or document actual forward).
5. Render visual QA images at 0°, 45°, 90°, 180° yaw **without surface effects** before adding particles. If 90° and 180° look wrong, stop: fix the base model first.

## Surface animation
- Use a stable base sculpt. Preserve the face silhouette while the surface moves.
- Generate thousands of short, thin filaments **on or just above the mesh**, conforming to local surface normals and tangents. Integrate paths through a low-amplitude, time-varying, **tangential curl-noise / divergence-free velocity field**, so traces flow around facial features instead of tunnelling through the face.
- Animate filaments as material flow or tiny along-surface offsets. Do **not** displace the main head silhouette significantly. Maintain enough density to preserve form even during motion.
- Use delicate anisotropic highlights or emissive falloff along some strands, mixed with patches of matte smooth material. Surface coverage should be selective and vary across face/hair/neck.
- Add limited loose particles sampled from actual mesh positions (not from screen-space image luminance). They drift short distances then settle/return; never replace the volumetric structure.
- Cursor light position projected into 3D viewport; small, soft point/area-light-like highlight around cursor with finite falloff, plus low-level rim light so the back and sides do not disappear. The light should orbit/slide across the rounded skull, demonstrating true depth.
- Smooth cursor tracking (damped interpolation), idle head turn ±3–6°, very small breathing motion, and gentle load-in. No constant dramatic spins.

## Implementation handoff
- Geometry: Blender or comparable DCC for base sculpt, export real `GLB`; mesh is independent of styling.
- Browser: React Three Fiber / Three.js for GLB loader, PBR smooth base shader, GPU-instanced strands/lines or custom shader particle system, raycast/light pointer mapping.
- UI: Tailwind CSS only for HTML, responsive layout, typography; it does *not* build the 3D mesh or animations.
- Prefer GPU shader instancing / batched line rendering over one JavaScript object per filament. Target steady desktop 60fps with reasonable mobile quality scaling; set DPR cap and reduced-motion fallback. Do not hide page content while model loads.
- Use a gracefully degraded static poster or simplified head with responsive touch behaviour and `prefers-reduced-motion`.

## Review checklist — do not ship unless all pass
- [ ] Gray, smooth complete bust recognizably resembles the front portrait without any effects.
- [ ] Side view and back view have believable cranial volume, not a thin acrylic-mask profile.
- [ ] Hair silhouette and neck/shoulder crop read as intended at 0° and 45°.
- [ ] Filaments follow surface curvature around cheeks, ears, forehead, nose, and hair.
- [ ] Soft cursor-controlled illumination travels naturally over 3D surface.
- [ ] Loose particles are secondary; subject remains legible at all moments.
- [ ] Motion is smooth, quiet, and loops without a visible jump or chaotic flicker.
- [ ] Model, strand effect, and site layout are separable modules.
- [ ] QA screenshots/video of base model and final effect reviewed before integration.

## Delivery order
1. `anmol_bust.glb` and contact sheet: front / 45° / side / back, no effects.
2. 10–15 second browser capture with living filament treatment and hover light.
3. `LivingSculptureHero.tsx` (or `.jsx`) and shaders; exportable particle data, documented asset paths, fallback images, README.

**Critical constraint:** Reject any prototype that creates face points from photo pixels and then invents a small depth displacement. That method caused the mask problem. The pipeline must begin with a genuine 3D human-head mesh.
