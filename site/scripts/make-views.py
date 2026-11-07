"""Turn the hero's two reference views into dots that can flow from one to the other. Run from site/:
  python3 scripts/make-views.py

Reads assets-src/views/front.png and slant.png (the bust facing you and turned three-quarters, on black).
Dots are scattered where light falls, as in Elimar's scenes, so the shadow side stays nearly empty.
Dot i sits on the same part of the body in both views: dots are matched by height band, then by
left-to-right order, so a turn moves them sideways and never up or down.

Writes public/hero/views.bin: for each view, POINTS x (u, v, luma) as Uint16, u and v across the
square view. Also stills of the front view for reduced motion, no JS and no WebGL.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
VIEWS = ['front', 'slant']
POINTS = 36000
BANDS = 300  # rows of dots matched across views
BACKGROUND = 0.11  # a pixel darker than this is the black backdrop
FRAME = 1206 / 1600  # the hero frame's height over its width, sized with .portrait in base.css
STILLS = {'portrait.webp': (1600, 0.95), 'portrait-1100.webp': (1100, 0.75), 'portrait-760.webp': (760, 0.6)}  # name: (width, dot radius)
INK = np.array((11, 10, 11))
PAPER = np.array((242, 242, 242))
rng = np.random.default_rng(7)


def view(name):
    grey = np.asarray(Image.open(ROOT / f'assets-src/views/{name}.png').convert('L'), float) / 255
    size = grey.shape[0]
    labels, _ = ndimage.label(grey > BACKGROUND)
    body = ndimage.binary_fill_holes(labels == np.argmax(np.bincount(labels.ravel())[1:]) + 1)
    soft = ndimage.gaussian_filter(grey, 1.2)
    edge = np.hypot(ndimage.sobel(soft, 0), ndimage.sobel(soft, 1))
    edge = np.clip(edge / np.percentile(edge[body], 97), 0, 1)
    tone = np.clip((soft - 0.08) / 0.75, 0, 1)
    rows = np.arange(size)[:, None]
    weight = (0.015 + tone ** 3.2 + edge * 0.35 * tone) * body  # dots gather where light falls
    weight *= 1 - 0.4 * np.clip((rows - 640) / 300, 0, 1)  # the face carries the dots, not the shirt
    picked = rng.choice(weight.size, POINTS, replace=False, p=(weight / weight.sum()).ravel())
    y, x = np.divmod(picked, size)
    x = x + rng.random(POINTS) - 0.5
    y = y + rng.random(POINTS) - 0.5
    luma = np.clip(soft[y.astype(int), x.astype(int)] / 0.75, 0, 1) ** 1.4
    return np.column_stack([x / size, y / size, luma])


def paired(points):
    """Same height band, same left-to-right rank: dot i is on the same part of the body in every view."""
    order = np.argsort(points[:, 1], kind='stable')
    return np.concatenate([band[np.argsort(points[band, 0])] for band in np.array_split(order, BANDS)])


def main():
    views = [view(name) for name in VIEWS]
    views = [v[paired(v)] for v in views]
    out = ROOT / 'public/hero'
    (np.clip(np.concatenate(views), 0, 1) * 65535).astype('<u2').tofile(out / 'views.bin')

    front = views[0]
    shades = (INK + (PAPER - INK) * front[:, 2:3]).astype(int)
    for name, (width, radius) in STILLS.items():
        still = Image.new('RGB', (width, round(width * FRAME)), tuple(int(c) for c in INK))
        draw = ImageDraw.Draw(still)
        for (u, v, _), shade in zip(front, shades):  # the square view at the frame's width: the shoulders run off the bottom
            cx, cy = u * width, v * width
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=tuple(int(c) for c in shade))
        still.save(out / name, quality=60, method=6)
        print(f'{name} {(out / name).stat().st_size // 1024}KB')
    print(f'{len(VIEWS)} views, {POINTS} dots, views.bin {(out / "views.bin").stat().st_size // 1024}KB')


if __name__ == '__main__':
    main()
