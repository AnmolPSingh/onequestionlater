"""Turn the fitted head into the closed bust: the face from fit-head.py, plus what the model doesn't
have. Run after fit-head.py:
  python build-head.py <portrait.jpg> <fit.npz> <out.npz>

Beard and brows are raised off the skin where the photo shows them; eyes are real balls with a dished
iris; hair is thousands of separate curls whose outline from the front is the photo's. The side and
back of the hair can't be seen in one photo, so those are modelled. All of it is cut into one voxel
volume, so the result is watertight, then the skin is snapped back onto the exact fitted surface so
the voxels don't soften the face. Output is what make-bust.py used to write: bust frame, x right, y up
(minus the photo's row), z toward the viewer, in photo px.
"""
import sys

import igl
import numpy as np
import trimesh
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

W, H = 1333, 2000
PITCH = 2.5  # px per voxel
ROWS = (430, 1590)  # rows the bust spans
REACH = (640, 480)  # half width and half depth the grid spans
STRIDE = 3  # the head is sampled this much coarser first, and finely only near its surface
SNAP = 4  # px: marching-cubes vertices this close to the fitted skin go back onto it
FACE, HEAD_NECK = 9409, 11248
SOCKETS = (13294, 14062)
EYEBALLS = ((21451, 23021), (23021, 24591))
EAR_ROWS = (850, 1085)
BEARD = dict(lift=9, stubble=3, rough=1.0)  # px
BROW = dict(lift=7, rough=0.8)  # px
CARVE = 34  # px of press per unit of local darkness: lid folds, the lines round the nose and mouth
IRIS = dict(radius=21, dish=2.6, pupil=9, drill=6)  # px
HAIR = dict(tone_reach=16, curls=2200, points=130, tube=7, helix=30, turns=2.0, length=(170, 330), trim=12, clump=0.5, rows=(800, 895), back=(830, 925), seat=14, grow=0.85)
MELT_ROWS = (1230, 1330)
NECK_CUT = 1405  # the model's neck is used down to here
BODY = dict(rows=(1290, 1400, 1590), half=(200, 442, 640), z=(-150, -216, -200), front=(150, 218, 232), back=(170, 221, 252))  # the model's neck leans back, so the body sits under it
BROWS = ([70, 63, 105, 66, 107, 55, 65, 52, 53, 46], [300, 293, 334, 296, 336, 285, 295, 282, 283, 276])
LIP_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
EYE_RINGS = ([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398])
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
SEED = 11


def polygon(points):
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon([tuple(p) for p in points], fill=255)
    return np.asarray(img) > 0


def silhouette(photo):
    wall = Image.fromarray(((np.asarray(photo).min(axis=2) >= 236) * 255).astype('uint8')).copy()
    for corner in ((0, 0), (W - 1, 0)):
        ImageDraw.floodfill(wall, corner, 128)
    return np.asarray(wall) != 128


def smooth01(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def trim_ears(v, marks, person, cx):
    """The model's ears stand out further than mine. Bring them in to the photo's outline."""
    for side, edge_mark in ((-1, 234), (1, 454)):
        edge = marks[edge_mark, 0]
        rows = np.arange(*EAR_ROWS)
        columns = np.where(person[rows].any(axis=0))[0]
        photo_outer = columns.min() if side < 0 else columns.max()
        ear = (side * (v[:, 0] - edge) > 0) & (v[:, 1] > EAR_ROWS[0] - 40) & (v[:, 1] < EAR_ROWS[1] + 40)
        model_outer = v[ear, 0].min() if side < 0 else v[ear, 0].max()
        k = (photo_outer - edge) / (model_outer - edge)
        print('ear', side, 'photo', int(photo_outer), 'model', int(model_outer), 'scale', round(float(k), 2))
        v = v.copy()
        v[ear, 0] = edge + (v[ear, 0] - edge) * k
    return v


def skin_maps(grey, marks):
    """Where beard and brows lie, in photo px."""
    oval = polygon(marks[OVAL, :2])
    around = ndimage.binary_dilation(oval, iterations=14)
    rows = np.arange(H)[:, None]
    lower = around & (rows > marks[2, 1] + 6)
    lips = ndimage.binary_dilation(polygon(marks[LIP_OUTER, :2]), iterations=1)
    beard = ndimage.gaussian_filter(((grey < 0.3) & lower & ~lips).astype('float32'), 3.4)
    stubble = ndimage.gaussian_filter(((grey < 0.42) & lower & ~lips).astype('float32'), 7) * (1 - beard)
    near = np.zeros((H, W), bool)
    for ring in BROWS:
        near |= ndimage.binary_dilation(polygon(marks[ring, :2]), iterations=9)
    brows = ndimage.gaussian_filter(((grey < 0.34) & near).astype('float32'), 3)
    soft = ndimage.gaussian_filter(grey, 2.2) - ndimage.gaussian_filter(grey, 14)
    weight = ndimage.gaussian_filter(ndimage.binary_erosion(oval, iterations=20).astype('float32'), 16)
    weight = weight * smooth01(np.arange(H, dtype='float32')[:, None], marks[9, 1] - 40, marks[9, 1])  # above the brows, dark is a stray curl, not a crease
    press = np.clip(soft, -0.3, 0) * CARVE * weight * (1 - np.clip(beard + stubble + brows, 0, 1))
    return beard, stubble, brows, press


def sample(image, cols, rows):
    return ndimage.map_coordinates(image, [rows, cols], order=1, mode='nearest')


def noise(shape, sigma, rng):
    n = ndimage.gaussian_filter(rng.standard_normal(shape).astype('float32'), sigma)
    return n / n.std()


def displaced_skin(verts, faces, grey, marks, cx, rng):
    mesh = trimesh.Trimesh(verts, faces, process=False)
    mesh.merge_vertices(merge_tex=True, merge_norm=True)
    v, f = trimesh.remesh.subdivide_loop(mesh.vertices, mesh.faces, iterations=2)
    mesh = trimesh.Trimesh(v, f, process=False)
    n = mesh.vertex_normals
    beard, stubble, brows, press = skin_maps(grey, marks)
    fine = noise((H, W), 1.2, rng)
    cols, rows = v[:, 0] + cx, -v[:, 1]
    facing = smooth01(n[:, 2], 0.08, 0.42)
    b, s, e = sample(beard, cols, rows), sample(stubble, cols, rows), sample(brows, cols, rows)
    rough = sample(fine, cols, rows)
    lift = b * (BEARD['lift'] + rough * BEARD['rough']) + s * (BEARD['stubble'] + rough * BEARD['rough'] * 0.6)
    lift = lift + e * (BROW['lift'] + rough * BROW['rough']) + sample(press, cols, rows)
    return v + n * (lift * facing)[:, None], f


def inside(v, f, grid):
    """Solid or not at each grid point, by winding number: open rims close themselves."""
    xs, ys, zs = grid
    coarse = [g[::STRIDE] for g in grid]
    q = np.stack(np.meshgrid(*coarse, indexing='ij'), axis=-1).reshape(-1, 3)
    w = igl.fast_winding_number(v, f, q).reshape(*[len(c) for c in coarse]).astype('float32')
    up = ndimage.zoom(w, [len(a) / len(b) for a, b in zip(grid, coarse)], order=1, grid_mode=True, mode='nearest')
    band = ndimage.binary_dilation((up > 0.04) & (up < 0.96), iterations=2)
    at = np.argwhere(band)
    fine = np.column_stack([xs[at[:, 0]], ys[at[:, 1]], zs[at[:, 2]]])
    out = up > 0.5
    out[band] = igl.fast_winding_number(v, f, fine) > 0.5
    print('winding: band', len(at), 'of', out.size)
    return out


def outline_lift(hair, solid_front, cx, centre_row):
    """How far off the skull the photo's hair reaches, by angle round the head."""
    angles = np.linspace(-np.pi, np.pi, 720, endpoint=False)
    reach = np.zeros((2, 720))
    for k, mask in enumerate((hair, solid_front)):
        rows, cols = np.nonzero(mask)
        a = np.arctan2(rows - centre_row, cols - cx)
        r = np.hypot(rows - centre_row, cols - cx)
        at = ((a + np.pi) / (2 * np.pi) * 720).astype(int) % 720
        np.maximum.at(reach[k], at, r)
    lift = ndimage.median_filter(np.maximum(reach[0] - reach[1], 0), size=9, mode='wrap')
    return angles, ndimage.gaussian_filter1d(lift, 3, mode='wrap')


def curl_paths(rng, seeds, normals, count):
    """Springy ringlets lying roughly along the surface, each its own way round."""
    h = HAIR
    t = np.linspace(0, 1, h['points'])[None, :, None]
    drift = rng.normal(size=(count, 3))
    tangent = drift - (drift * normals).sum(axis=1, keepdims=True) * normals
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    side = np.cross(normals, tangent)
    length = rng.uniform(*h['length'], (count, 1, 1))
    phase = rng.uniform(0, 6.28, (count, 1, 1))
    turns = rng.uniform(0.7, 1.3, (count, 1, 1)) * h['turns'] * 6.28
    spin = rng.choice([-1, 1], (count, 1, 1))
    amp = rng.uniform(0.7, 1.35, (count, 1, 1)) * h['helix']
    a = t * turns * spin + phase
    p = seeds[:, None] + tangent[:, None] * (t - 0.5) * length * 0.55
    p = p + side[:, None] * np.cos(a) * amp + normals[:, None] * (np.sin(a) * amp * 0.8)
    return p.reshape(-1, 3)


def main(source, fit, target):
    rng = np.random.default_rng(SEED)
    photo = Image.open(source).convert('RGB').resize((W, H), Image.LANCZOS)
    grey = np.asarray(photo.convert('L'), 'float32') / 255
    person = silhouette(photo)
    data = np.load(fit)
    marks = data['marks']
    cx = float(marks[1, 0] * 0.5 + marks[[234, 454], 0].mean() * 0.5)
    verts = trim_ears(data['verts'].astype('float64'), marks, person, cx)
    z_shift = -float(verts[:HEAD_NECK][verts[:HEAD_NECK, 1] < marks[152, 1], 2].min() + verts[:FACE, 2].max()) / 2
    bust = np.column_stack([verts[:, 0] - cx, -verts[:, 1], verts[:, 2] + z_shift])

    quads, tris = data['faces'], data['tris']
    keep = lambda f: (f < HEAD_NECK).all(axis=1) | ((f >= SOCKETS[0]) & (f < SOCKETS[1])).all(axis=1)
    skin_q, skin_t = quads[keep(quads)], tris[keep(tris)]
    skin_f = np.vstack([skin_q[:, [0, 1, 2]], skin_q[:, [0, 2, 3]], skin_t])
    skin_v, skin_f = displaced_skin(bust, skin_f, grey, marks, cx, rng)
    print('skin', len(skin_v), 'vertices; z', round(skin_v[:, 2].min()), round(skin_v[:, 2].max()))

    xs = np.arange(-REACH[0], REACH[0], PITCH, dtype='float32')
    ys = -np.arange(ROWS[0], ROWS[1], PITCH, dtype='float32')  # row 430 first
    zs = np.arange(-REACH[1], REACH[1], PITCH, dtype='float32')
    solid = np.zeros((len(xs), len(ys), len(zs)), 'float32')

    # The head, in a tighter box; winding numbers are the slow step.
    box = [np.where((xs > -345) & (xs < 345))[0], np.where(-ys < NECK_CUT)[0], np.where((zs > -440) & (zs < 440))[0]]
    bx, by, bz = [b[0] for b in box]
    grid = (xs[box[0]], ys[box[1]], zs[box[2]])
    head = inside(skin_v, skin_f, grid)

    # Eyeballs, as they are in the model, with the iris dished and the pupil drilled.
    px, py, pz = np.ogrid[0:len(grid[0]), 0:len(grid[1]), 0:len(grid[2])]
    px, py, pz = grid[0][px], grid[1][py], grid[2][pz]
    balls = []
    for (lo, hi), iris in zip(EYEBALLS, (473, 468)):
        ball = bust[lo:hi]
        centre = (ball.max(axis=0) + ball.min(axis=0)) / 2
        radius = np.ptp(ball, axis=0).mean() / 2
        balls.append((centre, radius))
        solid_ball = (px - centre[0]) ** 2 + (py - centre[1]) ** 2 + (pz - centre[2]) ** 2 < radius ** 2
        ix, iy = marks[iris, 0] - cx, -marks[iris, 1]
        front = centre[2] + np.sqrt(max(radius ** 2 - (ix - centre[0]) ** 2 - (iy - centre[1]) ** 2, 1))
        r = np.sqrt((px - ix) ** 2 + (py - iy) ** 2)
        cut = IRIS['dish'] * smooth01(IRIS['radius'] - r, 0, 3) + IRIS['drill'] * smooth01(IRIS['pupil'] - r, 0, 3)
        solid_ball &= pz < front - cut
        head |= solid_ball

    # Hair.
    rows = np.arange(H)[:, None]
    oval = polygon(marks[OVAL, :2])
    dark = ndimage.binary_opening((grey < 0.34) & person & (rows < HAIR['rows'][1]) & ~ndimage.binary_dilation(oval & (rows > marks[9, 1]), iterations=2), iterations=2)
    parts, count = ndimage.label(ndimage.binary_closing(dark, iterations=7))
    hair = parts == np.argmax(np.bincount(parts[parts > 0]))
    hair = ndimage.binary_fill_holes(ndimage.binary_closing(hair, iterations=14))
    hair = ndimage.binary_opening(hair, iterations=7)  # stray curls across the forehead aren't part of the mass
    print('hair px', int(hair.sum()), 'top row', int(np.where(hair.any(axis=1))[0].min()))

    front_view = head.any(axis=2)  # x, row
    cols = np.clip((grid[0] + cx).astype(int), 0, W - 1)
    row_ids = np.clip((-grid[1]).astype(int), 0, H - 1)
    skull_front = np.zeros((H, W), bool)
    fx, fy = np.nonzero(front_view)
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 0), (0, 2), (2, 2)):
        skull_front[np.clip(row_ids[fy] + dy, 0, H - 1), np.clip(cols[fx] + dx, 0, W - 1)] = True
    centre_row = float(marks[10, 1] + 120)
    _, lift_by_angle = outline_lift(hair, skull_front, cx, centre_row)
    print('hair lift px: min', round(lift_by_angle.min()), 'max', round(lift_by_angle.max()))

    distance = ndimage.distance_transform_edt(~head, sampling=PITCH).astype('float32')
    inner = np.where((-grid[1]) < HAIR['back'][1] + 40)[0]
    nx, ny, nz = len(grid[0]), len(inner), len(grid[2])
    gx = grid[0][:, None, None]
    gr = -grid[1][inner][None, :, None]
    gz = grid[2][None, None, :]
    angle = np.arctan2(gr - centre_row, gx)
    table = lift_by_angle[((angle + np.pi) / (2 * np.pi) * 720).astype(int) % 720]
    behind = smooth01(-gz, -20, 130)
    edge = noise((nx, nz), 12, rng)[:, None, :] * 16  # the fade isn't a ruled line
    fade_row = HAIR['rows'][0] * (1 - behind) + HAIR['back'][0] * behind + edge
    fade_end = HAIR['rows'][1] * (1 - behind) + HAIR['back'][1] * behind + edge
    fade = 1 - smooth01(gr, fade_row, fade_end)
    wide = np.median(lift_by_angle[lift_by_angle > 10]) * HAIR['grow']
    lift = np.maximum(table * (1 - behind) + wide * behind - HAIR['trim'], 0) * fade  # the curls stand proud of this, so hold it in by their reach

    # Toward the front the hair stops where the photo says, thinning to nothing at its edge.
    in_hair = ndimage.distance_transform_edt(hair).astype('float32')
    photo_cols = np.clip((gx + cx).astype(int), 0, W - 1)
    photo_rows = np.clip(gr.astype(int), 0, H - 1)
    depth_in = in_hair[photo_rows.ravel()[None, :].repeat(nx, 0), photo_cols.ravel()[:, None].repeat(ny, 1)][:, :, None]
    facing = smooth01(gz, -30, 90)
    allowed = (1 - facing) + facing * np.minimum(1, (HAIR['seat'] + depth_in * 0.8) / np.maximum(lift, 1))
    allowed = np.where((facing > 0.5) & (depth_in <= 0), 0, allowed)
    # Curls hang together in clumps, so the mass isn't an even carpet.
    shell = lift * allowed * (1 + HAIR['clump'] * np.clip(noise((nx, ny, nz), 13, rng), -1.4, 0.4))
    near = distance[:, inner, :]
    envelope = (near < shell) & (shell > 3)
    filler = (near < shell * 0.5) & (shell > 8)

    # Curls seeded through the outer part of that shell, each pointing its own way along the surface.
    seeds_at = np.argwhere(envelope & (near > shell * 0.4))
    chosen = seeds_at[rng.choice(len(seeds_at), HAIR['curls'])]
    seed = np.column_stack([grid[0][chosen[:, 0]], grid[1][inner][chosen[:, 1]], grid[2][chosen[:, 2]]])
    grad = np.stack(np.gradient(ndimage.gaussian_filter(distance, 3)), axis=-1)
    normal = grad[chosen[:, 0], inner[chosen[:, 1]], chosen[:, 2]]
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    path = curl_paths(rng, seed, normal, HAIR['curls'])
    ix = np.round((path[:, 0] - grid[0][0]) / PITCH).astype(int)
    iy = np.round((grid[1][inner][0] - path[:, 1]) / PITCH).astype(int)
    iz = np.round((path[:, 2] - grid[2][0]) / PITCH).astype(int)
    ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny) & (iz >= 0) & (iz < nz)
    stamps = np.zeros((nx, ny, nz), bool)
    stamps[ix[ok], iy[ok], iz[ok]] = True
    stamps &= ndimage.binary_dilation(envelope, iterations=4)
    curls = ndimage.distance_transform_edt(~stamps, sampling=PITCH) < HAIR['tube']
    hair_solid = filler | curls
    print('hair voxels', int(hair_solid.sum()))
    head[:, inner, :] |= hair_solid

    solid[bx:bx + len(grid[0]), by:by + len(grid[1]), bz:bz + len(grid[2])] = head
    del distance, grad, near, envelope, filler, curls, stamps

    # Shoulders: each row an ellipse, starting hidden inside the model's neck and sloping out past it.
    body = np.zeros_like(solid)
    for j, y in enumerate(-ys):
        if y < BODY['rows'][0]:
            continue
        half, middle, forward, behind_ = (np.interp(y, BODY['rows'], BODY[k]) for k in ('half', 'z', 'front', 'back'))
        u = (xs / half)[:, None]
        v = ((zs - middle) / np.where(zs > middle, forward, behind_))[None, :]
        body[:, j, :] = u ** 2 + v ** 2 < 1
    solid = np.maximum(solid, ndimage.gaussian_filter(body, 3.2))  # smoothed harder, or the voxel steps show as contour lines on the chest

    # Below the jaw the head and the body are one form: melt the join.
    melt = smooth01(-ys, *MELT_ROWS)[None, :, None]
    solid = solid * (1 - melt) + ndimage.gaussian_filter(solid, 5) * melt
    solid[:, -3:, :] = 0  # the flat cut under the bust
    solid[:, :3, :] = 0
    solid = ndimage.gaussian_filter(solid, 0.9)
    parts, _ = ndimage.label(solid > 0.5)
    biggest = np.argmax(np.bincount(parts[parts > 0]))
    solid[parts != biggest] = 0  # curls that came loose
    parts, _ = ndimage.label(solid <= 0.5)
    outside = parts[0, 0, 0]
    solid[(parts != outside) & (parts > 0)] = 1  # no sealed bubbles inside
    del parts
    v, f, _, _ = measure.marching_cubes(solid, 0.5, allow_degenerate=False)
    out = np.column_stack([v[:, 0] * PITCH + xs[0], ys[0] - v[:, 1] * PITCH, v[:, 2] * PITCH + zs[0]])

    # Back onto the true skin wherever the volume only approximated it.
    d2, tri, closest = igl.point_mesh_squared_distance(out.astype('float64'), skin_v, skin_f)
    eyes = np.any([((out - c) ** 2).sum(axis=1) < (r + 3) ** 2 for c, r in balls], axis=0)
    snap = (d2 < SNAP ** 2) & ~eyes & (out[:, 1] > -MELT_ROWS[0])
    out[snap] = closest[snap]
    print('snapped', int(snap.sum()), 'of', len(out))
    np.savez_compressed(target, verts=out.astype('float32'), faces=f.astype('int32'), centre=cx, z_shift=z_shift)
    # Matte zones, as on a toned stone bust: hair, beard, brows and irises darker than the skin. These
    # are flat values over the sculpted shapes, never the photo's shading.
    beard, stubble, brows, _ = skin_maps(grey, marks)
    yy, xx = np.mgrid[0:H, 0:W]
    reach = [np.hypot(xx - marks[i, 0], yy - marks[i, 1]) for i in (468, 473)]
    irises = sum(smooth01(IRIS['radius'] - r, -2, 5) * 0.5 + smooth01(IRIS['pupil'] + 1 - r, -2, 3) * 0.42 for r in reach)
    irises = ndimage.gaussian_filter(irises * sum(polygon(marks[ring, :2]) for ring in EYE_RINGS), 1.2)
    reach_hair = ndimage.binary_dilation(hair, iterations=HAIR['tone_reach'])  # the curls stand past the outline
    zones = np.clip(ndimage.gaussian_filter(reach_hair.astype('float32'), 3) * 0.92 + beard * 0.85 + stubble * 0.32 + brows * 0.8 + irises, 0, 1)
    Image.fromarray(((0.62 - zones * 0.54) * 255).astype('uint8')).save(target.replace('.npz', '-tone.png'))
    Image.fromarray((hair * 255).astype('uint8')).save(target.replace('.npz', '-hair.png'))
    print(len(out), 'vertices', len(f), 'faces')


if __name__ == '__main__':
    main(*sys.argv[1:])
