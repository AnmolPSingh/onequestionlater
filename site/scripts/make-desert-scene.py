"""The desert as a layered 2.5D scene, with no particles: the approval stage before any dust.
  python scripts/make-desert-scene.py <out_dir>

Route A from the footer brief. One photograph can't give a true 3D desert, so: a matted figure, a
clean plate with the figure removed, dune ridges and a ground plane with real perspective, and a
camera that moves back along that plane. Writes the matte, plate and depth, and stills at scroll
0.10 and 0.55 in two gradings. Needs opencv, scipy, pillow.
"""
import importlib.util
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('make_desert', ROOT / 'scripts/make-desert.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

BACK = 0.6  # the same pull as PULL_GLSL in scene.js
FIGURE_NEAR = 0.83
RIDGES = [(0.05, 14, 0.13, 90), (0.17, 24, 0.17, 170), (0.42, 34, 0.15, 300)]  # nearness, sway px, depth of shade, shade length px


def dune_shade(h, w, horizon):
    """Three long ridges in the sand. Each is lit on its crest and falls into shade behind it."""
    shade = np.zeros((h, w))
    xs = np.arange(w)
    for i, (near, sway, strength, reach) in enumerate(RIDGES):
        crest = horizon + near * (h - horizon) + sway * np.sin(xs / (w / (2.1 + i)) + i * 1.7) + sway * 0.4 * np.sin(xs / (w / 7.3) + i)
        rows = np.arange(h)[:, None] - crest[None, :]
        shade += np.where(rows > 0, -strength * np.exp(-rows / reach), strength * 0.55 * np.exp(rows / (reach * 0.12)))
    return ndimage.gaussian_filter(shade, 2.5) * (np.arange(h)[:, None] > horizon + 1)


def render(plate, figure, alpha, horizon, t, lateral):
    """t runs 0 to 1 as the camera eases back. Near ground shrinks most, and more of it comes in below."""
    h, w = plate.shape[:2]
    k = BACK * t
    cx = base.BODY_BOX[0] + (base.BODY_BOX[2] - base.BODY_BOX[0]) / 2
    yy, xx = np.mgrid[0:h, 0:w].astype('float32')
    screen = np.clip((yy - horizon) / (h - horizon), 0, None)
    near = screen / np.maximum(1 - k * screen, 0.05)
    scale = 1 + k * near
    ground_x = cx + (xx - cx) * scale + lateral * near
    ground_y = horizon + near * (h - horizon)
    ground_x = ground_x + (ground_y > h - 1) * w * 0.3  # past the photo the sand repeats, but not from under my feet
    map_x = np.where(yy > horizon, ground_x, xx + lateral * 0.04)
    map_y = np.where(yy > horizon, ground_y, yy)
    out = cv2.remap(plate, map_x.astype('float32'), map_y.astype('float32'), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    # The figure stands on the ground, so it moves with the ground at its feet.
    s = 1 / (1 + k * FIGURE_NEAR)
    feet_row = horizon + FIGURE_NEAR * (h - horizon)
    placed_feet = horizon + (FIGURE_NEAR * s) * (h - horizon)
    matrix = np.float32([[s, 0, cx * (1 - s) - lateral * FIGURE_NEAR * s], [0, s, placed_feet - s * feet_row]])
    person = cv2.warpAffine(figure, matrix, (w, h), flags=cv2.INTER_AREA)
    matte = cv2.warpAffine(alpha, matrix, (w, h), flags=cv2.INTER_LINEAR)
    ground_shadow = cv2.GaussianBlur(np.roll(matte, 6, axis=0) * (yy > placed_feet - 16 * s), (0, 0), 7)
    out = out * (1 - 0.34 * np.clip(ground_shadow, 0, 1))[:, :, None]
    return out * (1 - matte[:, :, None]) + person * matte[:, :, None]


def grade(rgb, mono):
    grey = rgb @ np.array([0.3, 0.59, 0.11])
    if mono:
        return np.stack([grey * 0.96, grey * 0.94, grey * 0.9], axis=2) ** 1.25
    return (grey[:, :, None] * 0.55 + rgb * 0.45) ** 1.2 * [1, 0.97, 0.92]


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(ROOT / base.SOURCE).convert('RGB'))
    h, w = rgb.shape[:2]
    person = base.cut_out(rgb)
    alpha = cv2.GaussianBlur(person.astype('float32'), (0, 0), 0.8)
    hole = ndimage.binary_dilation(person, iterations=7).astype('uint8')
    plate = cv2.inpaint(rgb, hole, 9, cv2.INPAINT_TELEA).astype('float32') / 255
    # Inpainting smears: put the sand's grain back from the same row, further along.
    grain = rgb.astype('float32') / 255 - cv2.GaussianBlur(rgb.astype('float32') / 255, (0, 0), 5)
    borrowed = np.roll(grain, 240, axis=1)
    plate = np.where(hole[:, :, None] > 0, plate + borrowed, plate)
    plate = np.clip(plate * (1 + dune_shade(h, w, base.HORIZON))[:, :, None], 0, 1)
    figure = rgb.astype('float32') / 255

    Image.fromarray((alpha * 255).astype('uint8')).save(out / 'figure-matte.png')
    Image.fromarray((plate * 255).astype('uint8')).save(out / 'clean-plate.png')
    depth = np.clip((np.arange(h)[:, None] - base.HORIZON) / (h - base.HORIZON), 0, 1) * np.ones((h, w))
    depth = np.where(person, np.maximum(depth, FIGURE_NEAR), depth)
    Image.fromarray((depth * 65535).astype('uint16')).save(out / 'depth.png')

    # Scroll 0.10 is before the camera moves; 0.55 is about half way back, drifting a little sideways.
    stills = {'0.10': (0.0, 0.0), '0.55': (0.5, 26.0)}
    sheet = np.zeros((h * 2, w * 2, 3), 'uint8')
    for row, (name, (t, lateral)) in enumerate(stills.items()):
        frame = render(plate, figure, alpha, base.HORIZON, t, lateral)
        for col, mono in enumerate((False, True)):
            graded = (np.clip(grade(frame, mono), 0, 1) * 255).astype('uint8')
            Image.fromarray(graded).save(out / f"still-{name}-{'mono' if mono else 'colour'}.png")
            sheet[row * h:(row + 1) * h, col * w:(col + 1) * w] = graded
    Image.fromarray(sheet).resize((w, h)).save(out / 'desert-sheet.jpg', quality=90)
    print('wrote', out)


if __name__ == '__main__':
    main(sys.argv[1])
