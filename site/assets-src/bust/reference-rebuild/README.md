# Fresh bust from the supplied sculpture reference

Status: local likeness draft, not approved as an exact likeness. The old fitted Anmol heads were rejected and were not used as input.

The input is `3d assests/face 3d reference.png`. A fresh MIT-licensed ICT neutral head topology and identity basis were fitted to 478 locally measured reference landmarks. The crown, 480 tubular ringlets, beard bristles and shirt are authored geometry. The side and back remain estimates from a single view.

The GLB has 64,733 vertices and 125,518 triangles. Every authored mesh part is watertight in the geometry report. Its coordinates are Y up, face toward +Z, in metres. The native Blender project includes materials, a camera, lights and the packed reference image.

The website loads `public/hero/reference-bust.bin` and `reference-strands.bin`: an indexed triangle mesh with vertex normals and authored material values, plus 30,000 area-weighted barycentric surface anchors. The renderer in `src/scripts/bust.js` draws the solid mesh, intersects its triangles with planes for attached contour paths, and lights the mesh and strands in 3D. It does not use image luminance for the face geometry or material. The GLB and compact runtime data contain the same model, with runtime positions quantized to the fitted coordinate system.

`reference-poster-*.webp` are actual Blender renders of this model. They are fallbacks for reduced motion, no JavaScript and unavailable WebGL. The ordinary homepage uses the live WebGL mesh. `?layer=mesh` isolates geometry; `?layer=contours` isolates its attached surface treatment.

The original model files remain archived in `assets-src/rejected-head`, outside the served public assets. The new model is deliberately named `reference-*` to avoid stale caches and accidental reuse of those files.

Build with Node 24 and `npm run build`. The current local static preview is at http://127.0.0.1:4340/. No hosting registration, repository push or public deployment was performed.

Neutral topology: https://github.com/USC-ICT/ICT-FaceKit (MIT license included). Local measurement: MediaPipe Face Landmarker. No reference image was uploaded to a third party.
