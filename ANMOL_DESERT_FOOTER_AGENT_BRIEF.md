# ANMOL — DESERT WALK / LIVING PARTICLE LANDSCAPE
## Implementation brief for the website agent • 1 November 2026

### The creative target
Rebuild the website footer as a **recognizable walking scene**, not a generic starfield or a flat silhouette. It should unquestionably depict **Anmol walking in a desert**, looking back at the viewer, while the photographic world gradually becomes a restrained, living 3D particle-and-filament sculpture. Retain the existing dark-to-white footer transition.

This is separate from the homepage **headshot bust**, which requires a full-volume skull. Do not reuse that bust mesh as the walking figure.

### Source / visual evidence
- Source photo: `IMG_4139.jpg` (the original walking image). The cleaned, landscape (16:9) desert-and-sky version produced during this conversation is the intended composition. Use that clean image as the final photographic color guide, if available; otherwise rebuild it non-destructively from the original.
- Remove from the desert scene: trees, signage, poles, buildings/tents, distant people, camera/photographer shadow, and other distractions. Keep sandy terrain and a natural blue sky. Keep the walking subject itself intact.
- Identity and pose anchors: white cap; dark sunglasses; deep navy hooded top; pale gray trousers; white trainers; sideways upper body, head turned back toward camera; one foot ahead of the other; natural bent arm/hand. Maintain his real proportions, cap-to-shoulder shape, body direction, and negative space between the legs.
- Current footer screenshot `image(8).png` proves the problem: most points read as uniform atmospheric noise, the body is faint, and the desert does not read. Avoid that outcome. Existing homepage bust screenshots `image(6).png` and `image(7).png` are *not* the target geometry for this scene.

### Core visual idea
**“A memory of a walk, held together by luminous fragments.”**

The person is not an opaque photo pasted over stars. Nor is he a hollow cutout. The visual is a spatial composition: a recognizable articulated figure, dunes with gentle terrain depth, a meaningful horizon, and a sparse sky. Some of the particles form short animated filament streams, particularly around folds of the hoodie, shoe edges, silhouette boundaries, and sand contours. The living motion is subtle enough to preserve legibility. No shiny acrylic face mask, glitter blizzard, big glowing dots, neon trails, explosive vortex, or generic galaxy field.

### Asset preparation: do this before writing shaders
1. Create a high-quality subject alpha mask with edge refinement for cap, glasses, fingers, hoodie, trousers, shoe outline and the split between legs. Restore background cleanly without cloning obvious patterns. Keep alpha antialiasing; avoid halos.
2. Separate image layers: subject, foreground ripples, midground dunes, far horizon, and sky. Create masks and depth maps (16-bit grayscale preferable) for each.
3. Build rough geometry for the terrain (a low-poly displaced dune mesh) and 2.5D subject relief or, **if true gait and mild camera orbit are required**, build and rig a recognizable full 3D body. A single image cannot reveal unseen body surfaces. Never present an invented 360° scan as accurate. Constrain camera orbit to a shallow range for 2.5D.
4. Test an unanimated render at 0°, slight left/right, and at the intended footer framing. The cap, head direction, torso, both legs, and footwear must remain understandable before any VFX are added.

### Particle sampling: intelligently distribute, do not scatter
- Sample predominantly from **surfaces** and their depth geometry. Do not create uniform random points across a rectangle.
- As a starting distribution, target **~55–65% of visible points on the person**, ~25–35% on dunes and ground, and ~5–10% on sky or dust. Adjust for visual legibility rather than treating percentages as rigid.
- Prioritize silhouettes, high-contrast folds, cap brim, shoulder/hood outline, chin/glasses area, pockets, shoe contours, knees and the empty space between legs. Use image gradients, segmentation confidence, normals and local contrast to guide density.
- Vary particle scale and opacity slightly. Cluster in meaningful surfaces, leaving negative space outside the scene; use nonuniform, artist-directed density. Ensure both legs do not merge into a bright column.
- Preserve enough color/value relationships that **navy top reads darker than trousers**, cap and shoes read lighter, and terrain reads as sand. In monochrome mode, translate these differences into brightness and opacity without flattening them.
- Use soft but crisp points at normal screen size (typically 0.7–1.8 px at desktop DPR 1), anti-aliased and depth-tested. Avoid enormous star-like circles.

### Living filaments (the nuanced texture)
- Layer a sparse population of **short, hairline curves** or thin instanced ribbons over the surface/particle geometry. This is the restrained reference to the Behance *Dark Grace* animated filament language, not a literal copy.
- Curves follow surface tangents and contour directions. Motion is continuous, local and low-amplitude (curl noise / flow field), with coherent drift and slight density breathing; anchor them to the subject and dunes.
- Restrict deformation around the face, cap, feet and silhouette; never dissolve defining landmarks so far that the person becomes unrecognizable.
- Allow only a minority of elements to detach briefly into drifting sand/dust particles. Most must remain attached to the figure or terrain.

### The movement must communicate walking
There are two acceptable production routes:

**A. Preferred: rigged 3D figure + particles tied to skin and clothing.** Create a natural 1.2–1.8 second walk cycle with restrained arm opposition, heel-to-toe steps, minimal torso bounce and head still partly turned toward camera. Rig particles to the same joints or sample skinned mesh positions each frame. Keep movement grounded: shoes contact the dune surface; no skating or floating. Subtle dust puffs at steps.

**B. Limited single-photo route: staged 2.5D parallax.** Preserve the exact source pose while moving the figure slowly across the scene, use controlled localized clothing/limb deformation, parallax and foreground sand motion to imply walking. This will not create a convincing full gait from all angles. Do not promise it does. If the gait is essential, request a short walking video or additional views for a proper rig.

Movement should feel contemplative, almost like a living photograph: not fast, exaggerated or game-like. The viewer should immediately say “that's Anmol walking across a desert,” not “that's an abstract particle humanoid.”

### Scroll sequence for the existing footer
The timing below is a suggested starting point, normalized to footer scroll progress from 0 to 1, and should be tunable:

- **0.00–0.15 — Recognition:** Start on a medium-wide desert composition. Subject around 45–55% of the scene height. Body, dunes and horizon unmistakable. Fade photographic textures into a richly shaded point/filament structure without losing the identity landmarks.
- **0.15–0.50 — Living landscape:** Subject continues an understated walk; surface-attached filaments drift, sand ripples shimmer softly, cursor light reveals depth and shape. Figure remains the brightest or most contrast-rich focal object.
- **0.50–0.78 — Pullback:** Camera eases back (not simply CSS scale of a flat image). More dunes and the horizon come into view. Figure reduces in frame but remains legible; points become sparser, never turning into random fog.
- **0.78–1.00 — Dissolve to white:** The dark landscape recedes into an elegant field of fine particles. Particle brightness and page palette crossfade deliberately into the existing **white** next section. Avoid a hard cut, a full-screen white flash, or text losing contrast. Finish in a genuinely clean white frame.

If the site currently requires a different exact scroll distance, preserve its architecture but keep the above perceptual sequence. Text, including “Still no signal. Still not stopping.”, must remain readable, positioned away from the figure, and visually above noisy particle fields.

### Pointer interaction / light
Use a soft, bounded light whose 3D target tracks the mouse via raycasting or normalized screen projection. The light should reveal gradients and volume on the person and nearby dunes, not manifest as a detached bright orb. Smooth follow with damping and clamp intensity. On touch devices use a slowly drifting authored light; disable aggressive mouse-only interactivity. Keep an ambient baseline so the figure is still recognizable when the cursor is far away.

### Technical architecture
- React Three Fiber + Three.js or native Three.js; WebGL shader materials for spatial particles and optional filaments. Tailwind handles layout only; it does not create 3D geometry.
- One shared 3D coordinate system for the subject, terrain and filaments; camera depth/parallax must be coherent. Use depth testing and appropriate transparency ordering.
- GPU instancing/point buffers rather than one React component per particle. For detailed animation use a shader flow field or GPU texture/simulation if needed.
- Use GSAP ScrollTrigger **or** an existing scroll progress system, not competing scroll controllers.
- Quality/performance targets: desktop ~60 fps at normal DPR, mobile ~30 fps; adaptive point counts, dynamic DPR cap (~1.5), offscreen pause, lazy loading, visibility and reduced-motion fallbacks. Begin around 80k–160k effective particles on desktop if device testing permits, scaling down substantially for mobile. Visual density matters more than raw count.
- Provide a non-WebGL fallback using an optimized still or short video/WebM sequence; respect `prefers-reduced-motion` with a mostly static readable composition and accessible footer links.

### Gate reviews — cannot ship before these pass
1. **Recognition test:** Remove color temporarily and freeze animation. Ask three viewers what the composition shows; they must identify a man walking in a desert from cap, posture, separated feet, horizon and sand.
2. **Likeness test:** Side by side with the source. White cap shape, hoodie volume, sunglasses/head turn, trousers, body ratio and shoes must match. No generic stock humanoid.
3. **Depth test:** A slight camera move shows subject, dunes and sky with coherent parallax. No acrylic-masked cutout.
4. **Motion test:** Feet connect with terrain, no skating; if not rigged, label movement as implied rather than true gait.
5. **Texture test:** Filaments follow actual surface contours and animate gently; particles don't randomly migrate off the body.
6. **Transition test:** Scroll from black footer to clean white, both forward and backward, with no flicker, pop, flash or illegible text.
7. **Responsive test:** Subject and text remain readable at 1440, 1024, 768 and 390 px widths.
8. **Performance test:** Profile GPU frame time and allocations, test touch and reduced motion.

### Delivery expected from the agent
- A component usable in the existing footer, with isolated assets and tunable parameters for amount of detail, light, noise, scroll thresholds and figure scale.
- Export the processed subject alpha mask, depth layers, any subject rig/mesh, terrain mesh, shaders, and fallback image/video; use descriptive filenames.
- Screenshots or recordings at footer progress `0.10`, `0.35`, `0.65`, `0.95` plus a simple GIF/video showing one complete walk cycle and the full scroll transition.
- A short note on what is truly 3D versus 2.5D, the image-reference limitations and how to replace the approximation with a proper captured/rigged model later.

### Non-negotiable
**Do not prioritize spectacle over likeness.** If the animation conceals the source pose, cap, split legs, dunes or horizon, reduce particles and motion until the scene reads clearly. The person is the visual anchor, the desert is the context, and living filaments are the finishing layer—not the other way around.
