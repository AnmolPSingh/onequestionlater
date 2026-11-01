"""Build a closed 3D bust from the front portrait: the base the hero's strands and dots live on.
  python make-bust.py <portrait.jpg> <out.npz>

Needs mediapipe, scikit-image, scipy, pillow and numpy, which the site itself doesn't, so run it from
a scratch environment. The face is measured from the photo (MediaPipe's 3D face landmarks). The back
and sides of the head can't be seen in one photo, so the skull, ears, neck and hair are modelled from
ordinary head proportions and fitted to the outline. Treat those as artistic, not as a scan.

Works in a voxel grid, so the result is one watertight volume with no slab edges. x runs right, y
runs up, z runs toward the viewer; the output is in units of the photo's width at 1333px.
"""
import sys

import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.interpolate import griddata
from skimage import measure

W, H = 1333, 2000  # working size of the photo
PITCH = 3  # px per voxel
TOP, CROP = 440, 1590  # rows the bust spans
BACK, FRONT = -420, 420  # depth the grid spans
SKULL = dict(top=535, centre=850, bottom=1190, half_width=262, front=292, back=338)  # px
HAIR = dict(lift=0.2, side_row=790, back_row=800, fade=130)  # curls stand this share of the skull's size off it; the fade down the sides and nape starts at these rows
EAR = dict(x=246, y=962, z=-26, height=98, width=34, depth=50)
NECK = dict(half_width=172, front=150, back=186, z=-58, top=1040, bottom=1300)
SHOULDER = dict(start=1150, full=1560, half_width=610, depth=190)  # the slope from neck to shoulder
BEARD_LIFT = 15
BROW_LIFT = 8
CARVE = 40  # px of press per unit of local darkness
SEED = 11
EYE_RINGS = ([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398])
LIP_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LIP_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
EYE = dict(set_back=6, lid_line=3, crease=4, iris=19, pupil=8, drill=2)  # px
LIPS = dict(lift=7, parting=6)  # px


def landmarks(photo):
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=1) as mesh:
        found = mesh.process(np.asarray(photo))
    if not found.multi_face_landmarks:
        raise SystemExit('No face found in the photo.')
    points = found.multi_face_landmarks[0].landmark
    return np.array([[p.x * W, p.y * H, -p.z * W] for p in points])  # z toward the viewer; 468 and 473 are the irises


def silhouette(photo):
    wall = Image.fromarray(((np.asarray(photo).min(axis=2) >= 236) * 255).astype('uint8')).copy()
    for corner in ((0, 0), (W - 1, 0)):
        ImageDraw.floodfill(wall, corner, 128)
    return np.asarray(wall) != 128


def polygon(points):
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon([tuple(p) for p in points], fill=255)
    return np.asarray(img) > 0


def oval_ring():
    next_of = dict(mp.solutions.face_mesh.FACEMESH_FACE_OVAL)
    start = next(iter(next_of))
    ring, at = [start], next_of[start]
    while at != start:
        ring.append(at)
        at = next_of[at]
    return ring


def skull_shell(xx, yy, cx):
    """How far out the egg of the skull reaches here, 0 at its outline to 1 at its middle."""
    s = SKULL
    vertical = np.where(yy < s['centre'], (yy - s['centre']) / (s['centre'] - s['top']), (yy - s['centre']) / (s['bottom'] - s['centre']))
    return np.sqrt(np.clip(1 - ((xx - cx) / s['half_width']) ** 2 - vertical ** 2, 0, 1))


def face_surface(points, ring, cx, grey):
    xx, yy = np.meshgrid(np.arange(W, dtype=float), np.arange(H, dtype=float))
    front = skull_shell(xx, yy, cx) * SKULL['front']
    z = griddata(points[:468, :2], points[:468, 2], (xx, yy), method='linear')
    oval = polygon(points[ring, :2])
    # MediaPipe's depth has its own origin: seat the face on the skull where they meet, at the temples and forehead.
    seat = [i for i in ring if points[i, 1] < SKULL['centre'] + 60]
    offset = np.median(front[points[seat, 1].astype(int), points[seat, 0].astype(int)] - points[seat, 2])
    z = ndimage.gaussian_filter(np.nan_to_num(z + offset, nan=float(offset)), 2)
    weight = ndimage.gaussian_filter(ndimage.binary_erosion(oval, iterations=26).astype(float), 22)
    surface = front * (1 - weight) + z * weight

    # Beard and brows are thin layers on the skin, not depth in the skin.
    lower = (yy > points[1, 1] + 20) & oval
    beard = ndimage.gaussian_filter(((grey < 0.26) & ndimage.binary_dilation(lower, iterations=8)).astype(float), 5)
    upper = (yy > points[10, 1]) & (yy < points[1, 1] - 60) & oval
    brows = ndimage.gaussian_filter(((grey < 0.26) & upper).astype(float), 5)
    # Eyelids, the line of the lips and the nostrils are drawn on by sculpting, as on a carved head:
    # where the photo goes locally dark the surface is pressed in a little.
    soft = ndimage.gaussian_filter(grey, 2.2) - ndimage.gaussian_filter(grey, 14)
    carve = np.clip(soft, -0.3, 0) * CARVE * weight * (1 - np.clip(beard + brows, 0, 1))  # only ever in: bright skin doesn't bulge
    return surface + carve + beard * BEARD_LIFT + brows * BROW_LIFT + features(points, xx, yy), oval


def features(points, xx, yy):
    """Eyes and lips as a sculptor cuts them: the landmarks give the shapes, so these stay crisp
    where a depth map goes soft. Eyeballs under lids, a shallow drilled iris, lips with a parting line."""
    out = np.zeros((H, W))
    for ring, iris in ((EYE_RINGS[0], 468), (EYE_RINGS[1], 473)):
        shape = polygon(points[ring, :2])
        far = ndimage.distance_transform_edt(shape)
        out -= np.clip(far / 6, 0, 1) * EYE['set_back']  # the eyeball sits behind the lids, which is what makes an eye look open
        out -= (ndimage.binary_dilation(shape, iterations=4) & ~ndimage.binary_erosion(shape, iterations=2)) * EYE['lid_line']
        fold = polygon(points[ring, :2] + [0, -17])
        out -= (ndimage.binary_dilation(fold, iterations=3) & ~ndimage.binary_erosion(fold, iterations=2) & (yy < points[ring, 1].mean() - 7) & ~shape) * EYE['crease']
        reach = np.hypot(xx - points[iris, 0], yy - points[iris, 1])
        out += ((reach < EYE['iris']) & shape) * EYE['drill'] - ((reach < EYE['pupil']) & shape) * EYE['drill'] * 2
    lips = polygon(points[LIP_OUTER, :2])
    far = ndimage.distance_transform_edt(lips)
    out += np.sqrt(np.clip(far / max(far.max(), 1), 0, 1)) * LIPS['lift']
    parting = polygon(points[LIP_INNER, :2])
    out -= ndimage.binary_dilation(parting, iterations=3) * LIPS['parting']
    return ndimage.gaussian_filter(out, 1.3)


def noise(shape, sigma, rng):
    n = ndimage.gaussian_filter(rng.standard_normal(shape).astype('float32'), sigma)
    return n / n.std()


def hair_volume(where, cx, rng, xs, ys, zs):
    """One mass of curls grown out of the skull, broken up by noise at two sizes, so it holds its
    shape from any side. Its thickness runs down to nothing at the hairline and through the fade at
    the sides and nape, so there's no wig edge. The strands on the site carry the fine detail."""
    s, h = SKULL, HAIR
    px, py, pz = xs[:, None, None], ys[None, :, None], zs[None, None, :]
    shape = (len(xs), len(ys), len(zs))
    up = s['centre'] - s['top']
    depth = np.where(pz > 0, s['front'], s['back'])
    below = np.maximum(py - s['centre'], 0) * (up / (s['bottom'] - s['centre']) - 1)
    reach = np.sqrt(((px - cx) / s['half_width']) ** 2 + ((py - s['centre'] + below) / up) ** 2 + (pz / depth) ** 2)
    edge = noise((len(xs), len(zs)), 14, rng)[:, None, :] * 24  # the fade isn't a ruled line
    round_head = np.clip((np.where(pz > 0, h['side_row'], h['back_row']) + edge - py) / h['fade'], 0, 1)
    round_head = round_head * round_head * (3 - 2 * round_head)
    front = where[np.ix_(ys.astype(int), xs.astype(int))].T[:, :, None]
    facing = np.clip((pz - 30) / 60, 0, 1)
    thick = round_head * (1 - facing) + np.minimum(front, round_head + 0.5) * facing
    broken = reach - thick * (h['lift'] + 0.075 * noise(shape, 10, rng) + 0.04 * noise(shape, 4, rng))
    return (broken < 1) & (thick > 0.02)


def ellipsoid(cx, cy, cz, rx, ry, rz, px, py, pz):
    return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 + ((pz - cz) / rz) ** 2 < 1


def main(source, target):
    rng = np.random.default_rng(SEED)
    photo = Image.open(source).convert('RGB').resize((W, H), Image.LANCZOS)
    grey = np.asarray(photo.convert('L'), float) / 255
    points = landmarks(photo)
    ring = oval_ring()
    person = silhouette(photo)
    cx = float(points[1, 0] * 0.5 + points[[234, 454], 0].mean() * 0.5)  # nose and cheek midpoint: the head's centre line
    print('centre', round(cx), 'chin', round(points[152, 1]), 'top of face', round(points[10, 1]), 'nose z', round(points[1, 2]), 'cheek z', round(points[234, 2]))

    surface, oval = face_surface(points, ring, cx, grey)

    xs = np.arange(0, W, PITCH, dtype=float)
    ys = np.arange(TOP, CROP, PITCH, dtype=float)
    zs = np.arange(BACK, FRONT, PITCH, dtype=float)
    gx, gy = np.meshgrid(xs, ys, indexing='ij')
    ix, iy = gx.astype(int), gy.astype(int)

    # The head: everything between the back of the skull and the front of the face.
    shell = skull_shell(gx, gy, cx)
    back = 36 - (SKULL['back'] + 36) * shell
    front = surface[iy, ix]
    outline = (shell > 0) | ndimage.binary_dilation(oval, iterations=4)[iy, ix]
    head = np.zeros((len(xs), len(ys), len(zs)), bool)
    for k, z in enumerate(zs):
        head[:, :, k] = outline & (z < front) & (z > back)

    # Hair: the photo says where it sits at the front; the clumps give it volume all round.
    rows = np.arange(H)[:, None]
    above_face = (rows < points[10, 1] + 12) | ((rows < HAIR['side_row'] + 40) & ~oval)
    hair = ndimage.binary_opening((grey < 0.3) & above_face & person, iterations=2)
    head |= hair_volume(np.clip(ndimage.gaussian_filter(hair.astype(float), 10) * 1.5, 0, 1), cx, rng, xs, ys, zs)

    # Ears, out from the skull, with the bowl pressed in so they catch the light.
    a, b, c = np.ogrid[0:len(xs), 0:len(ys), 0:len(zs)]
    px, py, pz = xs[a], ys[b], zs[c]
    for side in (-1, 1):
        ear_x = cx + side * EAR['x']
        ear = ellipsoid(ear_x, EAR['y'], EAR['z'], EAR['width'], EAR['height'], EAR['depth'], px, py, pz)
        bowl = ellipsoid(ear_x + side * 26, EAR['y'] - 6, EAR['z'] + 8, 12, 50, 26, px, py, pz)
        head |= ear & ~bowl

    # Neck and shoulders: each row an ellipse, the neck sloping out into the shoulders.
    body = np.zeros_like(head)
    for j, y in enumerate(ys):
        if y < NECK['top']:
            continue
        lean = np.clip((y - NECK['top']) / (NECK['bottom'] - NECK['top']), 0, 1)
        slope = np.clip((y - SHOULDER['start']) / (SHOULDER['full'] - SHOULDER['start']), 0, 1)
        slope = slope * slope * (3 - 2 * slope)
        half = NECK['half_width'] + (SHOULDER['half_width'] - NECK['half_width']) * slope
        forward = NECK['front'] + (SHOULDER['depth'] * 0.85 - NECK['front']) * slope
        behind = NECK['back'] + (SHOULDER['depth'] - NECK['back']) * slope
        middle = NECK['z'] + 30 * lean
        u = ((xs - cx) / half)[:, None]
        v = ((zs - middle) / np.where(zs > middle, forward, behind))[None, :]
        body[:, j, :] = u ** 2 + v ** 2 < 1

    # The body is smoothed harder than the head, or the voxel steps show as contour lines on the chest.
    solid = np.maximum(ndimage.binary_fill_holes(head).astype('float32'), ndimage.gaussian_filter(body.astype('float32'), 3.2))
    solid[:, -3:, :] = 0  # the flat cut under the bust
    solid[:, :3, :] = 0
    solid = ndimage.gaussian_filter(solid, 1.15)
    parts, _ = ndimage.label(solid > 0.5)
    solid[parts != np.argmax(np.bincount(parts[parts > 0]))] = 0  # stray curls that came loose
    verts, faces, _, _ = measure.marching_cubes(solid, 0.5, allow_degenerate=False)
    out = np.column_stack([verts[:, 0] * PITCH - cx, -(verts[:, 1] * PITCH + TOP), verts[:, 2] * PITCH + BACK])
    np.savez_compressed(target, verts=out.astype('float32'), faces=faces.astype('int32'), centre=cx)
    # Matte tone for hair, beard, brows and eyes, as on a toned stone bust. Dark features keep their
    # weight; the skin stays one even graphite, so no photographic texture reaches the sculpture.
    soft = ndimage.gaussian_filter(grey, 1.4)
    dark = np.clip((0.5 - soft) / 0.34, 0, 1)
    dark *= np.clip((points[152, 1] + 8 - np.arange(H)[:, None]) / 14, 0, 1)  # stops at the chin: the shirt isn't sculpture
    dark *= ndimage.gaussian_filter((ndimage.binary_dilation(oval, iterations=14) | (np.arange(H)[:, None] < points[1, 1])).astype(float), 6)
    tone = np.where(person, 0.62 - dark * 0.56, 0.62)
    tone = np.where(np.arange(H)[:, None] < 640, 0.08, tone)  # all of this is hair, whatever the gaps between curls show
    Image.fromarray((tone * 255).astype('uint8')).save(target.replace('.npz', '-tone.png'))
    print(len(out), 'vertices', len(faces), 'faces')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
