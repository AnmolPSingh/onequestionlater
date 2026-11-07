"""Turn the desert photo into the closing particle scene. Run from site/:
  python3 scripts/make-desert.py

Reads assets-src/desert.jpg. Cuts me out of the sand by colour and leaves out the tree, the pole,
the fence and the shadows. Writes public/hero/desert.bin (Uint16 u, v, depth, luma; depth 1 is
nearest, luma's lowest bit marks a dot on me), a still of the same dots for Calm mode, no-JS and no-WebGL, and the soft grey ghost of
the scene that sits behind the particles.
"""
import importlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

portrait = importlib.import_module('make-portrait')
blur, scatter = portrait.blur, portrait.scatter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = 'assets-src/desert.jpg'
FRAME = (150, 384, 1216, 760)  # left, top, width, height of the scene in photo pixels, wider than the photo on the right
BODY_BOX = (540, 465, 735, 1030)  # around me in the photo
HEAD_BOX = (596, 465, 712, 620)  # my head and hood, which meet the bushes on the horizon
FACE = (675, 530, 30, 34)  # centre and radii: skin reads as sand, so the face and hand are placed by hand
HAND = (688, 750, 22, 26)
HORIZON = ((0, 560), (1170, 545))  # two points on the top of the dune
# Left, top, right, bottom in photo pixels, of things that aren't sand or sky.
ERASE = [(0, 535, 560, 700), (770, 540, 880, 568), (690, 1050, 830, 1156)]
ERASE_SKY = [(780, 460, 900, 560), (1060, 470, 1110, 560), (0, 500, 560, 560)]
TREE = (0, 0, 440, 700)
CLEAN = 'assets-src/desert-clean.jpg'
DEPTH = 'assets-src/desert-depth.png'  # make-depth.py on CLEAN
POINTS = {'body': 12000, 'ground': 30000, 'sky': 10000}
OUT = ROOT / 'public/hero'
INK = np.array((13, 12, 11))
PAPER = np.array((243, 238, 228))


def cut_out(rgb):
    r, g, b = [rgb[..., i].astype(float) for i in range(3)]
    sand = (r - b > 42) & (r >= g) & (g >= b)
    sky = (b > r + 6) & (np.indices(r.shape)[0] < horizon_rows(r.shape[1])[None, :])
    dark = (r + g + b) / 3 < 110  # the navy hood is bluer than the sky behind it
    left, top, right, bottom = BODY_BOX
    box = np.zeros(r.shape, bool)
    box[HEAD_BOX[3]:bottom, left:right] = True
    box[HEAD_BOX[1]:HEAD_BOX[3], HEAD_BOX[0]:HEAD_BOX[2]] = True
    body = box & (dark | (~sand & ~sky))
    yy, xx = np.indices(r.shape)
    for cx, cy, rx, ry in (FACE, HAND):
        body |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
    body = ndimage.binary_fill_holes(ndimage.binary_closing(body, iterations=3))
    labels, count = ndimage.label(body)
    biggest = 1 + np.argmax(ndimage.sum(body, labels, range(1, count + 1)))
    return labels == biggest


def extended(values):
    """The sand carries on past the right of the photo, in mirror image."""
    left, top, width, height = FRAME
    extra = max(0, left + width - values.shape[1])
    below = max(0, top + height - values.shape[0])
    return np.pad(values, ((0, below), (0, extra)), mode='reflect')


def horizon_rows(width):
    (x0, y0), (x1, y1) = HORIZON
    return y0 + (np.arange(width) - x0) * (y1 - y0) / (x1 - x0)


def blank(mask, boxes):
    for left, top, right, bottom in boxes:
        mask[top:bottom, left:right] = True
    return mask


def maps(rgb, body):
    grey = np.asarray(Image.fromarray(rgb).convert('L'), float) / 255
    height, width = grey.shape
    rows = np.indices(grey.shape)[0]
    ground = rows > horizon_rows(width)[None, :] + 2

    # Sand: the ripples, read as local contrast, with my shadow left dark.
    sand = np.where(ground & ~body, grey, grey[ground & ~body].mean())
    ripple = np.clip(0.5 + (sand - blur(sand, 15)) * 11, 0, 1)
    tone = np.clip(blur(sand, 3) / np.median(sand[ground]), 0, 1.1) ** 3
    crest = np.exp(-(((rows - horizon_rows(width)[None, :]) / 5) ** 2))  # the top of the dune, as a clean line
    sand_map = (0.09 + ripple ** 3 + 1.4 * crest) * tone * ground * ~ndimage.binary_dilation(body, iterations=3)

    # Sky: only the brightest cloud, with the tree and the pole left out.
    cloud = np.clip((rgb[..., 0].astype(float) / 255 - 0.3) / 0.6, 0, 1) ** 1.5
    sky_map = (0.04 + cloud) * (rows < horizon_rows(width)[None, :] - 4) * ~body

    # Me: the same recipe as the hero, with a bright rim so I stand off the sand.
    filled = np.where(body, grey, grey[body].mean())
    detail = np.clip(0.5 + (filled - blur(filled, 12)) * 3.4, 0, 1)
    inner = ndimage.binary_erosion(body, iterations=3)
    body_map = (0.55 + detail * 0.9 + np.clip(filled / 0.6, 0, 1) * 0.3) * body
    body_map = np.where(body & ~inner, 2.6, body_map)
    return extended(body_map), extended(sand_map), extended(sky_map), extended(body.astype(float)) > 0.5


def fill(rgb, mask):
    """Each masked pixel from the nearest pixel on the same side of the horizon, softened."""
    rows = np.indices(mask.shape)[0]
    sky = rows < horizon_rows(mask.shape[1])[None, :]
    wide = ndimage.binary_dilation(mask, iterations=14)
    filled = rgb.copy()
    for side in (sky, ~sky):
        hole = wide & side
        nearest = ndimage.distance_transform_edt(~(side & ~wide), return_distances=False, return_indices=True)
        filled[hole] = rgb[nearest[0][hole], nearest[1][hole]]
    soft = np.stack([ndimage.gaussian_filter(filled[..., i].astype(float), 12) for i in range(3)], axis=-1)
    return np.where(wide[..., None], soft, filled).astype('uint8')


def clean(rgb, body):
    """The scene without the tree, the pole, the fence or the shadows: each filled from the nearest sky or sand."""
    r, g, b = [rgb[..., i].astype(float) for i in range(3)]
    rows = np.indices(r.shape)[0]
    above = rows < horizon_rows(r.shape[1])[None, :] + 6
    foreign = (above & ~(b > r + 6) & (r + g + b < 640)) | blank(np.zeros(r.shape, bool), ERASE + ERASE_SKY + [TREE])
    foreign = ndimage.binary_dilation(foreign & ~ndimage.binary_dilation(body, iterations=4), iterations=7)
    filled = rgb.copy()
    sky = rows < horizon_rows(r.shape[1])[None, :]
    for side in (sky, ~sky):  # sky fills from sky and sand from sand, so the horizon stays clean
        hole = foreign & side
        nearest = ndimage.distance_transform_edt(~(side & ~foreign & ~body), return_distances=False, return_indices=True)
        filled[hole] = rgb[nearest[0][hole], nearest[1][hole]]
    soft = np.stack([ndimage.gaussian_filter(filled[..., i].astype(float), 9) for i in range(3)], axis=-1)
    return np.where(foreign[..., None], soft, filled).astype('uint8')


def extended_rgb(rgb):
    return np.stack([extended(rgb[..., i]) for i in range(3)], axis=-1)


def main():
    rgb = np.asarray(Image.open(ROOT / SOURCE).convert('RGB'))
    body = cut_out(rgb)
    scene = clean(rgb, body)
    left, top, width, height = FRAME
    frame = extended_rgb(scene)[top:top + height, left:left + width]
    Image.fromarray(frame).save(ROOT / CLEAN, quality=92)
    if not (ROOT / DEPTH).exists():
        print(f'Now run make-depth.py on {CLEAN}, writing {DEPTH}, and run this again.')
        return

    # The ground carries on behind me, in its own dots at its own depth. Without them the walk,
    # which slides me off the sand, would leave an empty hole the shape of me.
    depth = np.asarray(Image.open(ROOT / DEPTH), float) / 65535
    gone = body.copy()
    gone[BODY_BOX[1]:min(BODY_BOX[3] + 130, body.shape[0]), BODY_BOX[0] - 30:BODY_BOX[2] + 110] = True  # and my shadow
    empty = fill(scene, gone)
    alone = extended_rgb(empty)[top:top + height, left:left + width]
    behind = extended(ndimage.binary_dilation(body, iterations=14).astype(float))[top:top + height, left:left + width] > 0.5
    nearest = ndimage.distance_transform_edt(behind, return_distances=False, return_indices=True)
    ground_depth = depth[nearest[0], nearest[1]]

    body_map, _, _, mask = maps(scene, body)
    _, sand_map, sky_map, _ = maps(empty, np.zeros(body.shape, bool))
    groups = [scatter(body_map, POINTS['body'], 21), scatter(sand_map, POINTS['ground'], 22), scatter(sky_map, POINTS['sky'], 23)]
    is_body = np.r_[np.ones(POINTS['body'], bool), np.zeros(POINTS['ground'] + POINTS['sky'], bool)]
    xs = np.concatenate([g[0] for g in groups]) - left
    ys = np.concatenate([g[1] for g in groups]) - top
    keep = (xs >= 0) & (xs < width) & (ys >= 0) & (ys < height)
    xs, ys, is_body = xs[keep], ys[keep], is_body[keep]
    col, row = xs.astype(int), ys.astype(int)
    grey = np.asarray(Image.fromarray(frame).convert('L'), float) / 255
    ground_grey = np.asarray(Image.fromarray(alone).convert('L'), float) / 255
    low, high = np.percentile(ground_grey, [2, 99])
    luma = np.where(is_body, np.maximum((grey[row, col] - low) / (high - low), 0.55), 0.3 + 0.7 * (ground_grey[row, col] - low) / (high - low))  # the dark jacket still has to catch the light
    points = np.column_stack([xs / width, ys / height, np.where(is_body, depth[row, col], ground_depth[row, col]).clip(0, 1), luma.clip(0, 1)])
    order = np.random.default_rng(3).permutation(len(points))
    points, order_body = points[order], is_body[order].astype('<u2')
    OUT.mkdir(parents=True, exist_ok=True)
    packed = (points * 65535).astype('<u2')
    packed[:, 3] = (packed[:, 3] & 0xFFFE) | order_body  # the lowest bit of luma marks a dot on me: I shimmer while the sand blows past
    (OUT / 'desert.bin').write_bytes(packed.tobytes())

    still_w, still_h = 1600, 1000
    still = Image.new('RGB', (still_w, still_h), tuple(int(c) for c in INK))
    draw = ImageDraw.Draw(still)
    for u, v, _, luma in points:
        colour = tuple(int(c) for c in INK + (PAPER - INK) * (0.15 + 0.85 * luma))
        cx, cy = u * still_w, v * still_h
        draw.ellipse([cx - 0.85, cy - 0.85, cx + 0.85, cy + 0.85], fill=colour)
    still.save(OUT / 'desert.webp', quality=55, method=6)

    # What the particles sit in front of: the place without me, out of focus and without its colour.
    # With me in it, the walk would blow my jacket up into a dark hole.
    ghost = Image.fromarray((ground_grey ** 2.6 * 200).astype('uint8')).resize((640, 400)).filter(ImageFilter.GaussianBlur(22))
    ghost.save(OUT / 'desert-soft.webp', quality=50, method=6)

    ys_body = np.where(mask.any(axis=1))[0]
    print(f'{len(points)} points, bin {(OUT / "desert.bin").stat().st_size // 1024}KB, still {(OUT / "desert.webp").stat().st_size // 1024}KB, ghost {(OUT / "desert-soft.webp").stat().st_size // 1024}KB')
    print('axis u', round((np.median(xs[:POINTS['body']])) / width, 4), 'head v', round((ys_body.min() - top) / height, 4), 'feet v', round((ys_body.max() - top) / height, 4))


if __name__ == '__main__':
    main()
