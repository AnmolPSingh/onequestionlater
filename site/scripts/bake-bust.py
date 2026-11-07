"""Turn the bust GLB into what the browser loads. Run after bust-blender.py:
  python bake-bust.py <head.glb> <still.png> <tone.png> <hair.png>

Needs trimesh, fast-simplification and numpy. Writes public/hero/bust.bin (the sculpture) and
strands.bin (the living skin), plus the stills. All positions are photo px about the head's pivot.

bust.bin: Uint32 vertex count, Uint32 index count, Int16 xyz per vertex, Int8 xyz normal per vertex,
pad to 2, Uint16 indices.
strands.bin: Uint32 count, then per strand Int16 xyz start, Int8 xyz tangent, Int8 xyz normal,
Uint8 length px, Int8 bend, Uint8 brightness, Uint8 1 if in the hair.

Each strand runs along a tangent of the surface. Tangents are the surface curl of a smooth potential
(normal x gradient), which makes the field divergence free: strands flow round the features instead
of piling into them.
"""
import struct
import sys
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCALE = 1000  # the GLB is in metres of 1 photo px = 1 mm
PHOTO_CENTRE = 711  # px across the photo of the head's centre line
PIVOT_ROW = 826  # px down the photo; shapes.js keeps the head's turn here
STRANDS = 30000
HAIRLINE = 790  # rows above this are hair, unless they're forehead
INK = (13, 12, 11)
STILLS = {'portrait.webp': (1600, 72), 'portrait-1100.webp': (1100, 66), 'portrait-760.webp': (760, 60)}
SEED = 5


def potential_gradient(p, frequency, rng):
    """Gradient of a sum of a few waves. Cheap, smooth, and it needs no library."""
    k = rng.normal(0, frequency, (7, 3))
    phase = rng.uniform(0, 6.28, 7)
    return np.sum(k[None] * np.cos(p @ k.T + phase)[:, :, None], axis=1)


def main(glb, still, tone, hair_mask):
    rng = np.random.default_rng(SEED)
    mesh = trimesh.load(glb, force='mesh')
    verts = mesh.vertices * SCALE
    assert verts[:, 2].max() > -verts[:, 2].min() * 0.5, 'face should look toward +z'
    print('watertight', mesh.is_watertight, 'faces', len(mesh.faces))
    light = mesh  # bust-blender.py already decimated it, favouring the face
    v = light.vertices * SCALE
    v = v + [0, PIVOT_ROW, 0]  # y is minus the photo's row, so this puts the pivot at 0
    n = light.vertex_normals

    out = ROOT / 'public/hero'
    with open(out / 'bust.bin', 'wb') as f:
        f.write(struct.pack('<II', len(v), light.faces.size))
        f.write(np.round(v).astype('<i2').tobytes())
        f.write(np.round(n * 127).astype('i1').tobytes())
        if (len(v) * 3) % 2:
            f.write(b'\0')
        f.write(light.faces.astype('<u2').tobytes())

    # Where strands go: most in the hair and beard, some across the skin, few on the shoulders.
    tri = light.triangles * SCALE + [0, PIVOT_ROW, 0]
    centres = tri.mean(axis=1)
    rows = PIVOT_ROW - centres[:, 1]
    face_normals = light.face_normals
    rough = np.linalg.norm(light.vertex_normals[light.faces].std(axis=1), axis=1)
    in_photo_hair = np.asarray(Image.open(hair_mask))[np.clip(rows, 0, 1999).astype(int), np.clip(centres[:, 0] + PHOTO_CENTRE, 0, 1332).astype(int)] > 0
    forehead = (face_normals[:, 2] > 0.3) & (centres[:, 2] > 60) & ~in_photo_hair
    hair = (rows < HAIRLINE + 110) & ~forehead & (in_photo_hair | (centres[:, 2] < 60)) & ((rows < HAIRLINE) | (np.linalg.norm(centres[:, [0, 2]], axis=1) > 0))
    beard = (rows > 1110) & (rows < 1262) & (face_normals[:, 2] > 0.1) & (centres[:, 2] > 135)
    body = rows > 1290
    weight = np.ones(len(rows)) * 0.5
    weight[hair] = 2.4
    weight[beard] = 2.2
    weight[body] = 0.28
    weight *= 0.7 + np.clip(rough * 8, 0, 1.2)
    chosen = rng.choice(len(rows), STRANDS, p=(light.area_faces * weight) / (light.area_faces * weight).sum())
    a, b = rng.random(STRANDS), rng.random(STRANDS)
    flip = a + b > 1
    a[flip], b[flip] = 1 - a[flip], 1 - b[flip]
    corners = tri[chosen]
    start = corners[:, 0] + (corners[:, 1] - corners[:, 0]) * a[:, None] + (corners[:, 2] - corners[:, 0]) * b[:, None]
    bary = np.column_stack([1 - a - b, a, b])
    normal = (light.vertex_normals[light.faces[chosen]] * bary[:, :, None]).sum(axis=1)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)

    # Tight curling flow in the hair, long calm flow on the skin.
    in_hair = hair[chosen]
    grad = np.where(in_hair[:, None], potential_gradient(start, 0.03, rng), potential_gradient(start, 0.008, rng))
    tangent = np.cross(normal, grad)
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-6)
    length = np.where(in_hair, rng.uniform(10, 26, STRANDS), rng.uniform(9, 20, STRANDS))
    length[body[chosen]] = rng.uniform(14, 30, body[chosen].sum())
    bend = np.where(in_hair, rng.uniform(-0.9, 0.9, STRANDS), rng.uniform(-0.2, 0.2, STRANDS))
    bright = np.where(in_hair, rng.uniform(0.45, 1, STRANDS), rng.uniform(0.25, 0.7, STRANDS))
    bright[~in_hair] *= 0.62
    bright[beard[chosen]] = rng.uniform(0.4, 0.85, beard[chosen].sum())
    bright[body[chosen]] *= 0.6

    record = np.dtype([('p', '<i2', 3), ('t', 'i1', 3), ('n', 'i1', 3), ('len', 'u1'), ('bend', 'i1'), ('lum', 'u1'), ('pad', 'u1')])
    rows_out = np.zeros(STRANDS, record)
    rows_out['p'] = np.round(start)
    rows_out['t'] = np.round(tangent * 127)
    rows_out['n'] = np.round(normal * 127)
    rows_out['len'] = np.round(length)
    rows_out['bend'] = np.round(bend * 127)
    rows_out['lum'] = np.round(bright * 255)
    rows_out['pad'] = in_hair
    with open(out / 'strands.bin', 'wb') as f:
        f.write(struct.pack('<I', STRANDS))
        f.write(rows_out.tobytes())

    # The tone of hair, beard, brows and eyes, for the shader to throw back onto the sculpture.
    Image.open(tone).convert('L').resize((667, 1000), Image.LANCZOS).save(out / 'bust-tone.webp', quality=60, method=6)

    frame = Image.open(still).convert('RGBA')
    ground = Image.new('RGBA', frame.size, (*INK, 255))
    ground.alpha_composite(frame)
    for name, (width, quality) in STILLS.items():
        ground.convert('RGB').resize((width, round(width * frame.height / frame.width)), Image.LANCZOS).save(out / name, quality=quality, method=6)
    print('bust.bin', (out / 'bust.bin').stat().st_size // 1024, 'KB, strands.bin', (out / 'strands.bin').stat().st_size // 1024, 'KB, verts', len(v), 'hair strands', int(in_hair.sum()))


if __name__ == '__main__':
    main(*sys.argv[1:])
