"""Turn the desert photo into the closing scene. Run from site/ in an environment with opencv:
  python scripts/make-desert.py

Reads assets-src/desert-walk.png. The figure is cut from the sand and sky by colour, then every dot
is placed on a surface: on me, weighted to my outline, folds, cap, glasses and shoes; on the ground,
weighted to the ripples, with its real perspective depth; and a few in the sky. The ground carries on
past the bottom and sides of the photo, so the camera can pull back and find more of it.

Writes public/hero/desert.bin, Uint16 per dot: u, v, z, luma. u is (x + 1.5) / 4 and v is y / 3 in
units of the photo, so dots can lie outside it. z is nearness, 0 at the horizon, 1 at the bottom of
the photo, stored over 3; on me it's how much the trailing leg swings instead. Luma's lowest bit
marks a dot on me. desert-strands.bin: 12 bytes per strand, Uint16 u, v, z, Int8 x, y direction,
Uint8 length px, brightness, flag, pad. Also the still, and the dim photo that sits behind the dots.
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = 'assets-src/desert-walk.png'
HORIZON = 400  # photo row
BODY_BOX = (750, 285, 960, 860)
HEAD_ROW = 385  # above this is cap, glasses and face
LEG_GAP = (870, 640, -0.16)  # x, row and slope of the line between my legs
TOTAL = 58000
SHARE = dict(figure=0.55, ground=0.37, sky=0.08)
PAST_PHOTO = 0.42  # the share of the ground's dots that lie beyond the photo
FURTHEST = 2.5  # nearness the ground runs to; the camera's pull in scene.js needs under 1 / BACK
STRANDS = dict(figure=5200, ground=4200)
INK = np.array((13, 12, 11))
PAPER = np.array((243, 238, 228))
SEED = 3


def cut_out(rgb):
    h, w = rgb.shape[:2]
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(float)
    background = np.stack([np.median(np.r_[lab[y, :640], lab[y, 1050:]], axis=0) for y in range(h)])[:, None, :]
    distance = np.sqrt((((lab - background) * [0.45, 1, 1]) ** 2).sum(axis=2))
    left, top, right, bottom = BODY_BOX
    box = np.zeros((h, w), bool)
    box[top:bottom, left:right] = True
    mask = ndimage.binary_opening(ndimage.binary_closing((distance > 26) & box, iterations=4), iterations=1)
    mask = ndimage.binary_fill_holes(mask)
    strip = ndimage.binary_opening(mask, structure=np.ones((11, 1)))  # the horizon line reads as figure at its edges
    mask[HORIZON - 12:HORIZON + 12] = strip[HORIZON - 12:HORIZON + 12]
    parts, _ = ndimage.label(mask)
    return parts == np.argmax(np.bincount(parts[parts > 0]))


def pick(weight, count, rng):
    picks = rng.choice(weight.size, count, p=(weight / weight.sum()).ravel())
    y, x = np.unravel_index(picks, weight.shape)
    return x + rng.random(count), y + rng.random(count)


def main():
    rng = np.random.default_rng(SEED)
    rgb = np.asarray(Image.open(ROOT / SOURCE).convert('RGB'))
    h, w = rgb.shape[:2]
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(float) / 255
    person = cut_out(rgb)
    rows = np.arange(h)[:, None]
    near = np.clip((rows - HORIZON) / (h - HORIZON), 0, 1)
    print('figure px', person.sum(), 'rows', np.where(person.any(axis=1))[0][[0, -1]], 'columns', np.where(person.any(axis=0))[0][[0, -1]])

    # Me. The outline and folds get the density; brightness keeps the navy darker than the trousers.
    gx, gy = cv2.Sobel(grey, cv2.CV_64F, 1, 0, ksize=3), cv2.Sobel(grey, cv2.CV_64F, 0, 1, ksize=3)
    edge = ndimage.gaussian_filter(np.hypot(gx, gy), 1)
    rim = person & ~ndimage.binary_erosion(person, iterations=3)
    head = rows < HEAD_ROW
    weight = person * (1 + np.clip(edge * 6, 0, 3.5) + rim * 2.2 + (person & head) * 0.7)
    count = int(TOTAL * SHARE['figure'])
    fx, fy = pick(weight, count, rng)
    col, row = fx.astype(int).clip(0, w - 1), fy.astype(int).clip(0, h - 1)
    tone = ndimage.gaussian_filter(grey, 1)[row, col]
    fig_luma = 0.13 + 0.66 * np.clip(tone, 0, 1) ** 0.95
    fig_luma = np.maximum(fig_luma, rim[row, col] * 0.42)  # the dark hoodie still has an edge against the dark
    gap = LEG_GAP[0] + (fy - LEG_GAP[1]) * LEG_GAP[2]
    sway = np.where(fx < gap, np.clip((fy - 620) / 225, 0, 1) ** 1.3, 0)

    # The ground: ripples get the dots, and it runs on past the photo.
    sand = ~ndimage.binary_dilation(person, iterations=4) & (rows > HORIZON + 1)
    fine = grey - ndimage.gaussian_filter(grey, 6)
    ripple = np.abs(fine)
    crest = np.exp(-(((rows - HORIZON) / 5.0) ** 2)) * 3.5  # the top of the dune, so the horizon is a line
    ground_weight = sand * ((0.14 + np.clip(ripple * 40, 0, 1)) * (1.5 - 0.95 * near) + crest)  # far ground crowds together, as it does
    count = int(TOTAL * SHARE['ground'])
    inside = int(count * (1 - PAST_PHOTO))
    gx0, gy0 = pick(ground_weight, inside, rng)
    gz = (gy0 - HORIZON) / (h - HORIZON)
    c, r = gx0.astype(int).clip(0, w - 1), gy0.astype(int).clip(0, h - 1)
    g_luma = 0.3 + np.clip(0.4 + fine[r, c] * 10, 0, 1) * 0.62
    # Past the photo there's nothing to read, so the same ripples carry on in mirror.
    outside = count - inside
    oz = rng.uniform(0.15, FURTHEST, outside)
    ox = 0.5 + rng.uniform(-1, 1, outside) * (0.5 + 0.7 * oz)
    keep = (ox > 0) & (ox < 1) & (oz < 1)
    ox[keep] = ox[keep] + np.sign(ox[keep] - 0.5) * 0.5 + 1e-3
    oy = (HORIZON + oz * (h - HORIZON)) / h
    mirror_x = (np.abs(((ox * w) % (2 * w)) - w)).astype(int).clip(0, w - 1)
    mirror_y = (HORIZON + 1 + ((oz * (h - HORIZON)) % (h - HORIZON - 2))).astype(int).clip(0, h - 1)
    o_luma = 0.26 + np.clip(0.4 + fine[mirror_y, mirror_x] * 10, 0, 1) * 0.5

    # A sparse sky, thicker where the high cloud is.
    sky_map = (rows < HORIZON - 1) * ~person
    blue_white = np.clip(rgb[:, :, 0].astype(float) / 255 - 0.12, 0, 1)
    sx, sy = pick(sky_map * (0.05 + blue_white ** 1.6), TOTAL - int(TOTAL * SHARE['figure']) - count, rng)
    s_luma = 0.05 + np.clip(blue_white[sy.astype(int), sx.astype(int)], 0, 1) * 0.3

    u = np.r_[fx / w, gx0 / w, ox, sx / w]
    v = np.r_[fy / h, gy0 / h, oy, sy / h]
    z = np.r_[sway * 3, gz, oz, np.zeros(len(sx))]  # stored over 3
    luma = np.r_[fig_luma, g_luma, o_luma, s_luma]
    order = rng.permutation(len(u))
    figure = np.r_[np.ones(len(fx), bool), np.zeros(len(u) - len(fx), bool)][order]
    packed = np.column_stack([(u[order] + 1.5) / 4, v[order] / 3, z[order] / 3, luma[order]])
    records = (np.clip(packed, 0, 1) * 65535).astype('<u2')
    records[:, 3] = (records[:, 3] & 0xfffe) | figure
    out = ROOT / 'public/hero'
    records.tofile(out / 'desert.bin')

    # Strands: hairlines along the folds of my clothes and along the contours of the ripples.
    smooth = ndimage.gaussian_filter(grey, 1.6)
    dy, dx = np.gradient(smooth)
    def strands(weight, count, flag, length, lum):
        x, y = pick(weight, count, rng)
        c, r = x.astype(int).clip(0, w - 1), y.astype(int).clip(0, h - 1)
        a, b = -dy[r, c], dx[r, c]  # along the contour, not across it
        size = np.maximum(np.hypot(a, b), 1e-5)
        z_of = np.clip((y - HORIZON) / (h - HORIZON), 0, 1)
        return x / w, y / h, z_of, a / size, b / size, length(z_of), lum(c, r), np.full(count, flag)
    body = strands(person * (0.3 + np.clip(edge * 6, 0, 2)), STRANDS['figure'], 1, lambda z: rng.uniform(7, 20, len(z)), lambda c, r: 0.3 + 0.7 * np.clip(smooth[r, c] * 1.3, 0, 1))
    dunes = strands(sand * (0.04 + np.clip(ripple * 60, 0, 1)) * near, STRANDS['ground'], 0, lambda z: rng.uniform(10, 34, len(z)) * (0.35 + z), lambda c, r: rng.uniform(0.2, 0.55, len(c)))
    record = np.dtype([('u', '<u2'), ('v', '<u2'), ('z', '<u2'), ('dx', 'i1'), ('dy', 'i1'), ('len', 'u1'), ('lum', 'u1'), ('flag', 'u1'), ('pad', 'u1')])
    rows_out = np.zeros(STRANDS['figure'] + STRANDS['ground'], record)
    joined = [np.r_[a, b] for a, b in zip(body, dunes)]
    rows_out['u'] = (joined[0] + 1.5) / 4 * 65535
    rows_out['v'] = joined[1] / 3 * 65535
    rows_out['z'] = joined[2] / 3 * 65535
    rows_out['dx'] = joined[3] * 127
    rows_out['dy'] = joined[4] * 127
    rows_out['len'] = joined[5]
    rows_out['lum'] = joined[6] * 255
    rows_out['flag'] = joined[7]
    rng.shuffle(rows_out)
    rows_out.tofile(out / 'desert-strands.bin')

    # The dim photo behind the dots, warm grey, so the place is there before they've gathered.
    dim = (grey[:, :, None] * 0.62 * (PAPER - INK) + INK).astype('uint8')
    Image.fromarray(dim).resize((1280, 720), Image.LANCZOS).save(out / 'desert-soft.webp', quality=56, method=6)

    still = Image.new('RGB', (1600, 900), tuple(int(c) for c in INK))
    draw = ImageDraw.Draw(still)
    inside_photo = (u >= 0) & (u <= 1) & (v <= 1)
    shades = INK + (PAPER - INK) * np.clip(luma, 0, 1)[:, None]
    for x, y, shade in zip(u[inside_photo] * 1600, v[inside_photo] * 900, shades[inside_photo].astype(int)):
        draw.ellipse([x - 0.8, y - 0.8, x + 0.8, y + 0.8], fill=tuple(int(c) for c in shade))
    still.save(out / 'desert.webp', quality=60, method=6)
    print('dots', len(u), 'on me', len(fx), 'bin', (out / 'desert.bin').stat().st_size // 1024, 'KB, strands', (out / 'desert-strands.bin').stat().st_size // 1024, 'KB, ghost', (out / 'desert-soft.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
