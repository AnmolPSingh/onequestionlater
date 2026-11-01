# ONE QUESTION LATER — START HERE
**Strict handoff for the website agent**  
Project: headshot hero + Elimar-inspired walking-desert footer.  
Date: 1 November 2026.

## Read in order
1. `01_HERO_LIVING_CONTOURS_AND_PARTICLES.md`
2. `02_FOOTER_ELIMAR_INSPIRED_LIVING_DESERT.md`
3. `03_REFERENCES_AND_ACCEPTANCE.md`
4. Open all seven images in `assets/` (including **rejected** screenshots).

## Non-negotiable direction
- **Hero = Living Contours + limited particles** on a legitimate closed 3D skull, not a 2D depth mask. Art reference: Dark Grace, interpreted originally. Hair keeps its recognisable volume; head, neck and just upper shoulders; hover light on real volume.
- **Footer = Living Desert** inspired by *Elimar's* living scene particles. Scene of Anmol walking across a *recognisable* sand landscape, with his cap/hoodie/legs/feet and the dunes/horizon all visible. The scene must stay alive when the scroll stops. Particles sit **within** the scene, adhere and detach from geometry, drift in coherent local currents, and react to spatial lighting. Scroll pulls camera back and blends to white. Do not erase the desert.
- There is **no evidence the Elimar site definitely runs a Gaussian splat, nor is there an actual multi-view scan of this desert**. Make the practical default a carefully art-directed 2.5D environment plus 3D surface/dust particles; move to real splatting only with actual multi-view capture/synthetic scene renders and proof of improvement.
- Preserve the rest of the site's information architecture, copy and working navigation while rebuilding these two scenes. Do not rework unrelated project pages or diagrams without separate approval.

## Execution plan (each requires user approval)
- [ ] **A — bare geometry / scene:** 5-angle shaded head contact sheet; unanimated desert scene with clear depth and silhouettes.
- [ ] **B — living without scroll:** 10s idle-motion capture of hero and desert. Contour paths follow real surfaces; desert dust flows in depth. No pointer/scroll input.
- [ ] **C — interaction:** hero mouse-controlled soft illumination; reversible scroll-driven desert camera and transition.
- [ ] **D — polished integration:** real mobile capture, performance, reduced motion, fallback, text hierarchy.

Do not skip A in pursuit of elaborate shaders. Do not claim 'complete' because builds pass. If the current agent cannot model a complete head, it must surface that blocker and propose a proper modeling tool/human sculptor, not counterfeit a 360° mesh.

## Outputs required for first approval
- Head: GLB or proven mesh asset + neutral front/45°/side/back frames. **No effects**.
- Desert: layered scene + depth/subject matte evidence + recognizable still at starting and mid zoom. **No effects**.
- Technical route recommendation: A/B/C from the footer brief, with honest limitations.
- Then, and only then, 10s idle reference captures.

## Quick operational prompt to paste to an agent
> Please read every Markdown file and bundled image in this folder before editing the site. Do not modify unrelated sections. First solve asset correctness, then living contour/particle behavior. The Elimar reference is about coherent *alive* scene motion in real perceived depth, **not** a universal point-scramble shader; the desired hero is a real closed 3D skull with organic surface contours + restrained particles. Build the bare head and bare desert scene and show them for approval first. Stop if either fails recognizability. Keep a ledger of accepted assets, frames and devices. Do not deploy or report finished until all review gates pass.

## All creative and technical links
See `03_REFERENCES_AND_ACCEPTANCE.md` for live websites, authoring tools, documentation links, and their exact roles and caveats.
