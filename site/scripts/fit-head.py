"""Fit a real head to the front portrait: the base of the hero's sculpture.
  python fit-head.py <portrait.jpg> <ICT FaceXModel dir> <ict README.md> <out.npz> [<overlay.jpg>]

The head is the ICT Face Model (MIT, github.com/ICT-VGL/ICT-FaceKit): light-stage scans reduced to 100
identity shapes on one topology, with a real skull, ears, eye sockets and neck. Nothing here is pasted
from the photo. The identity shapes are solved against MediaPipe's landmarks, then the surface is
pulled onto every landmark, so from the front it's measured and from the side it's anatomy that agrees
with those measurements. x runs right, y runs down the photo, z runs toward the viewer, all in photo px.
"""
import re
import sys
from pathlib import Path

import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree

W, H = 1333, 2000  # the same working size make-bust uses, so everything downstream lines up
FACE = range(0, 9409)
HEAD_NECK = range(9409, 11248)
SOCKETS = range(13294, 14062)
EYEBALLS = (range(21451, 23021), range(23021, 24591))
IDENTITIES = 100
DOWN = np.array([1, -1, 1], dtype='float32')  # the model's y runs up, the photo's runs down
PRIOR = 2.0  # how hard the identity solve is held to an ordinary head
ROUNDS = 6
MP_68 = [162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323, 454, 389,
         71, 63, 105, 66, 107, 336, 296, 334, 293, 301, 168, 197, 5, 4, 75, 97, 2, 326, 305,
         33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
         61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181, 78, 82, 13, 312, 308, 317, 14, 87]
EYE_LOOPS = ([33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
             [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382])
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
OVAL_SET = set(OVAL)
SIDEWAYS = 0.45  # a vertex stands for the outline only if its normal is turned this far from the viewer
MOUTH_LOOP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]


def read_obj(path):
    rows = [line[2:] for line in open(path) if line.startswith('v ')]
    return np.array(' '.join(rows).split(), dtype='float32').reshape(-1, 3)


def read_faces(path):
    faces = []
    for line in open(path):
        if line.startswith('f '):
            faces.append([int(token.split('/')[0]) - 1 for token in line.split()[1:]])
    return faces


def model(folder):
    cache = Path(folder) / 'identity.npy'
    neutral = read_obj(Path(folder) / 'generic_neutral_mesh.obj') * DOWN
    if cache.exists():
        return neutral, np.load(cache)
    shapes = np.stack([read_obj(Path(folder) / f'identity{i:03d}.obj') * DOWN - neutral for i in range(IDENTITIES)])
    np.save(cache, shapes)
    return neutral, shapes


def landmarks(photo):
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=1) as mesh:
        found = mesh.process(np.asarray(photo))
    points = found.multi_face_landmarks[0].landmark
    return np.array([[p.x * W, p.y * H, -p.z * W] for p in points])


def similarity(source, target):
    """Scale, rotation and shift that take source onto target, seen straight on (orthographic)."""
    s0, t0 = source.mean(axis=0), target.mean(axis=0)
    u, d, vt = np.linalg.svd((target - t0).T @ (source - s0))
    r = u @ np.diag([1, 1, np.sign(np.linalg.det(u @ vt))]) @ vt
    scale = d.sum() / ((source - s0) ** 2).sum()
    return scale, r, t0 - scale * r @ s0


def boundary_loops(faces):
    """The open rims of the face mesh: each eye, the mouth, the outer edge."""
    edges = {}
    for face in faces:
        for a, b in zip(face, face[1:] + face[:1]):
            edges[(a, b)] = 1
    rim = {a: b for (a, b) in edges if (b, a) not in edges}
    loops = []
    while rim:
        start, chain = next(iter(rim)), []
        at = start
        while at in rim:
            chain.append(at)
            at = rim.pop(at)
        loops.append(chain)
    return sorted(loops, key=len)


def along(loop, positions, count):
    """count points evenly round a loop, by length."""
    p = positions[loop + loop[:1]]
    steps = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    wanted = np.linspace(0, steps[-1], count, endpoint=False)
    return np.array([loop[min(np.searchsorted(steps, t), len(loop) - 1)] for t in wanted])


def pair_loop(loop, positions, target):
    """Match a landmark ring to a mesh rim, starting from the nearest corners and running the same way."""
    picked = along(loop, positions, len(target))
    best, cost = None, np.inf
    for flip in (picked, picked[::-1]):
        for shift in range(len(target)):
            candidate = np.roll(flip, shift)
            c = ((positions[candidate, :2] - target[:, :2]) ** 2).sum()
            if c < cost:
                best, cost = candidate, c
    return best


def vertex_normals(positions, quads):
    a, b, c = positions[quads[:, 0]], positions[quads[:, 1]], positions[quads[:, 2]]
    n = np.cross(b - a, c - a)
    out = np.zeros_like(positions)
    for k in range(4):
        np.add.at(out, quads[:, k], n)
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)


def solve_identity(neutral, shapes, verts, marks, weights):
    """Pose and identity in turn. x and y are measured; MediaPipe's z only nudges."""
    a = np.zeros(IDENTITIES)
    for _ in range(ROUNDS):
        current = neutral + np.tensordot(a, shapes, axes=1)
        scale, r, t = similarity(current[verts], marks)
        placed = scale * (r @ neutral[verts].T).T + t
        basis = np.stack([scale * (r @ shapes[i, verts].T).T for i in range(IDENTITIES)], axis=2)  # n,3,k
        depth = np.array([1, 1, 0.15])
        w = (weights[:, None] * depth[None]).ravel()
        A = basis.reshape(-1, IDENTITIES) * w[:, None]
        b = ((marks - placed) * (weights[:, None] * depth[None])).ravel()
        unit = np.linalg.norm(A, axis=0).mean()
        a = np.linalg.solve(A.T @ A + (PRIOR * unit) ** 2 * np.eye(IDENTITIES), A.T @ b)
    return a, scale, r, t


def main(source, folder, readme, target, overlay=None):
    photo = Image.open(source).convert('RGB').resize((W, H), Image.LANCZOS)
    marks = landmarks(photo)
    neutral, shapes = model(folder)
    faces = read_faces(Path(folder) / 'generic_neutral_mesh.obj')

    text = open(readme).read()
    block = text[text.index('Multi-PIE 68 point'):]
    pie = [int(x) for x in re.findall(r'\d+', block.split('\n\n')[1])]
    assert len(pie) == 68, len(pie)

    quads = np.array([f for f in faces if len(f) == 4], dtype='int32')
    # Rough fit on the 68 points. The jaw of the 68 is a silhouette, so it's left out of this round.
    verts, weights = np.array(pie[17:]), np.ones(51)
    a, scale, r, t = solve_identity(neutral, shapes, verts, marks[MP_68[17:]], weights)

    # Now every landmark: the rims of the eyes and mouth by their own loops, the rest by nearness.
    face_faces = [f for f in faces[:9230]]
    loops = boundary_loops(face_faces)
    print('rims', [len(l) for l in loops])
    for _ in range(3):
        current = neutral + np.tensordot(a, shapes, axes=1)
        placed = scale * (r @ current.T).T + t
        rims = [l for l in loops if len(l) < 200]
        eye_rims = sorted(rims, key=lambda l: placed[l, 0].mean())
        centre = [l for l in rims if abs(placed[l, 1].mean() - marks[13, 1]) < 60]
        mouth_rim = centre[0]
        eyes = [l for l in rims if l is not mouth_rim]
        eyes.sort(key=lambda l: placed[l, 0].mean())
        pairs = []
        for loop, ring in zip(eyes, (EYE_LOOPS[0], EYE_LOOPS[1])):
            pairs.append((pair_loop(loop, placed, marks[ring]), ring))
        pairs.append((pair_loop(mouth_rim, placed, marks[MOUTH_LOOP]), MOUTH_LOOP))
        rim_v = np.concatenate([p[0] for p in pairs])
        rim_m = np.concatenate([p[1] for p in pairs])
        fixed = set(rim_m.tolist()) | set(range(468, 478))
        others = np.array([i for i in range(468) if i not in fixed])
        narrow = placed[:6706]
        inner = np.array([i for i in others if i not in OVAL_SET])
        _, near = cKDTree(narrow[:, :2]).query(marks[inner, :2])
        # The oval is a silhouette, so only vertices turned sideways there can stand for it.
        facing = vertex_normals(placed, quads)[:9409, 2]
        rim_ids = np.where(np.abs(facing) < SIDEWAYS)[0]
        lower = np.array([i for i in OVAL if marks[i, 1] > marks[1, 1] - 60])
        _, turned = cKDTree(placed[rim_ids, :2]).query(marks[lower, :2])
        verts = np.r_[rim_v, near, rim_ids[turned]]
        mp_ids = np.r_[rim_m, inner, lower]
        near = verts[len(rim_v):]
        weights = np.r_[np.full(len(rim_v), 3.0), np.ones(len(near))]
        a, scale, r, t = solve_identity(neutral, shapes, verts, marks[mp_ids], weights)

    current = neutral + np.tensordot(a, shapes, axes=1)
    placed = scale * (r @ current.T).T + t

    # Pull the surface onto the landmarks exactly, smoothly falling away. Only x and y: z stays the model's.
    misses = marks[mp_ids, :2] - placed[verts, :2]
    print('fit error px before pull: mean', round(float(np.linalg.norm(misses, axis=1).mean()), 2), 'max', round(float(np.linalg.norm(misses, axis=1).max()), 2))
    _, keep = np.unique(verts, return_index=True)
    field = RBFInterpolator(placed[verts[keep]], misses[keep], kernel='thin_plate_spline', smoothing=30, neighbors=120)
    pulled = placed.copy()
    pulled[:, :2] += field(placed)

    np.savez_compressed(target, verts=pulled.astype('float32'), rigid=placed.astype('float32'), marks=marks, weights=a, scale=scale, faces=np.array([f for f in faces if len(f) == 4], dtype='int32'), tris=np.array([f for f in faces if len(f) == 3], dtype='int32'))
    print('scale', round(float(scale), 3), 'width', round(float(np.ptp(pulled[:9409, 0]))), 'nose z', round(float(pulled[:9409, 2].max())), 'largest identity', round(float(np.abs(a).max()), 2))

    if overlay:
        sheet = photo.copy()
        draw = ImageDraw.Draw(sheet)
        for x, y in pulled[list(FACE)[::3], :2]:
            draw.point((x, y), fill=(0, 255, 90))
        for x, y in marks[:, :2]:
            draw.ellipse((x - 1.5, y - 1.5, x + 1.5, y + 1.5), outline=(255, 40, 40))
        sheet.crop((180, 480, 1160, 1400)).save(overlay, quality=90)


if __name__ == '__main__':
    main(*sys.argv[1:])
