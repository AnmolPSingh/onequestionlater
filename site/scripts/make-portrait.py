"""Turn the portrait into a sculpted particle relief. Run from site/:
  python3 scripts/make-portrait.py

Reads assets-src/portrait-curly.jpg, shot on plain white, and its depth mask. Levels the eyes, puts
the head on the centre line and frames head and shoulders for the hero. Every dot sits on the
surface the mask describes and keeps the direction that surface faces, so light can fall across
the face in the shader. Writes public/hero/portrait.bin (Uint16 u, v, z, luma per point, then Int8
nx, ny per point) and stills for Calm mode, no-JS and no-WebGL. The full photo never ships.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = 'assets-src/portrait-curly.jpg'
DEPTH = 'assets-src/portrait-depth.png'  # from scripts/make-depth.py
POINTS = 46000
RELIEF = 310  # px between the back of the head and the tip of the nose
CREASE = 44  # px of height the photo adds in the hair; the face gets none, it's structure only
FORM = 6  # px of blur on the depth mask: the planes of the head stay, the wrinkles go
DOME = 260  # px the surface rises from the outline to the middle of the head: a smooth round form, as Daniel's is
CHEST = 170  # px
DOME_REACH = 340  # px in from the outline that rise takes; past half the face's width, so there's no flat plate in front
EDGE_SOFT = 40  # px of blur on the distance to the outline, so the ears and hair don't step the form
FEATURES_DEPTH = 0.12  # the share of the mask's depth the face keeps: a trace of nose and brow. More and the eyes read as holes in a mask
EVEN = 1.0  # dots lie almost evenly; the face is told by its form and outline, not by a dot-for-dot photo
FEATURES = 0.3  # how much the photo's features still pull dots toward them
TILT_DEG = 2.14  # the eyes sit this far off level in the photo
EYES = (713, 899)  # midpoint of the pupils: the head's centre line
FRAME = (1600, 428, 1634)  # width, top and bottom in photo pixels, sized with .portrait in base.css
BACKDROP = 238  # a pixel whose darkest channel reaches this is the white wall
SHOULDER_REACH = 680  # half the shoulder width where they run off the screen
STILLS = {'portrait.webp': (1600, 0.9), 'portrait-1100.webp': (1100, 0.7), 'portrait-760.webp': (760, 0.55)}  # name: (width, dot radius)
INK = np.array((13, 12, 11))
PAPER = np.array((243, 238, 228))
CHIN_ROW = 790
HAIRLINE_ROW = 330


def framed(photo):
    width, top, bottom = FRAME
    level = photo.rotate(TILT_DEG, Image.BICUBIC, center=EYES, fillcolor=(255, 255, 255))
    canvas = Image.new('RGB', (width, bottom - top), (255, 255, 255))
    canvas.paste(level, (width // 2 - EYES[0], -top))
    return canvas


def silhouette(img):
    """Everything not joined to the white wall, which keeps each curl edge exact."""
    wall = Image.fromarray(((np.asarray(img).min(axis=2) >= BACKDROP) * 255).astype('uint8')).copy()  # fromarray is read-only, and floodfill would silently do nothing
    ImageDraw.floodfill(wall, (0, 0), 128)
    ImageDraw.floodfill(wall, (wall.width - 1, 0), 128)
    return np.asarray(wall) != 128


def round_shoulders(person):
    """The photo stops at the sleeves, off-centre. Run both shoulders down in the same soft curve."""
    h, w = person.shape
    out = person.copy()
    for side in (out, out[:, ::-1]):  # the second is a mirrored view, so writes land in out
        edge = w // 2 - SHOULDER_REACH
        first = side.argmax(axis=1)
        rows = np.where(side.any(axis=1) & (first <= edge + 70))[0]
        start = rows.min()
        for y in range(start, h):
            x = round(first[start] + (edge - first[start]) * ((y - start) / (h - start)) ** 0.6)
            side[y, :x] = False
            side[y, x:first[start] + 1] = True
    return out


def framed_depth():
    """The depth mask, put through the same levelling and framing as the photo."""
    depth = np.asarray(Image.open(ROOT / DEPTH), float) / 65535
    width, top, bottom = FRAME
    level = np.asarray(Image.fromarray(depth.astype('float32'), 'F').rotate(TILT_DEG, Image.BICUBIC, center=EYES))
    canvas = np.zeros((bottom - top, width))
    left = width // 2 - EYES[0]
    rows = level[top:bottom]
    canvas[:rows.shape[0], left:left + rows.shape[1]] = rows
    return canvas


def blur(values, radius):
    img = Image.fromarray((np.clip(values, 0, 1) * 255).astype('uint8'))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), float) / 255


def density(img, person, original):
    grey = np.asarray(img.convert('L'), float) / 255
    filled = np.where(original, grey, grey[original].mean())
    # Local contrast finds the features and curls however bright the area is around them.
    detail = np.clip(0.5 + (filled - blur(filled, 34)) * 3.4, 0, 1)
    tone = np.clip(filled / 0.62, 0, 1)
    map_ = 0.1 + detail * 0.62 + tone * 0.28
    # The shirt is a big plain area, so it gets fewer dots and the head gets more.
    body = np.clip((np.arange(person.shape[0])[:, None] - 760) / 140, 0, 1)
    map_ = map_ * (1 - 0.5 * body)
    # A brighter rim keeps the outline crisp against the dark, as on a lit silhouette.
    inner = np.asarray(Image.fromarray((person * 255).astype('uint8')).filter(ImageFilter.MinFilter(5))) > 0
    map_ = np.where(person & ~inner, np.maximum(map_, 16), map_)
    map_ = np.where(person & ~original, np.median(map_[inner & original & (np.arange(person.shape[0])[:, None] > 1000)]), map_)
    return map_ * person


def scatter(map_, count, seed=7):
    """Random, not dithered: dust, with none of a dither's worm patterns."""
    rng = np.random.default_rng(seed)
    picks = rng.choice(map_.size, count, p=(map_ / map_.sum()).ravel())
    y, x = np.unravel_index(picks, map_.shape)
    return (x + rng.random(count)), (y + rng.random(count))


def lift(depth, person, grey):
    """Heights in pixels. A shallow rounded form taken from the outline, like a coin, with only a
    trace of the depth mask on top: deep features turn into a strange profile when the head turns."""
    rows = np.arange(person.shape[0])[:, None]
    edge = ndimage.gaussian_filter(ndimage.distance_transform_edt(person), EDGE_SOFT)  # so the ears don't notch the form
    form = np.sqrt(1 - (1 - np.clip(edge / DOME_REACH, 0, 1)) ** 2) * DOME
    form += np.clip((rows - CHIN_ROW - 40) / 330, 0, 1) * CHEST  # the shoulders come forward of the head
    head = person & (rows < CHIN_ROW)
    low, high = np.percentile(depth[head], [3, 99.5])
    fine = ndimage.gaussian_filter(depth, FORM) - ndimage.gaussian_filter(depth, 70)
    z = form + fine / (high - low) * RELIEF * FEATURES_DEPTH * np.clip((rows - HAIRLINE_ROW) / 90, 0, 1) * np.clip((CHIN_ROW + 50 - rows) / 60, 0, 1)
    # The curls the mask is too soft to hold come from the photo. Only the curls.
    hair = np.clip((HAIRLINE_ROW - rows) / 60, 0, 1)
    z += (grey - ndimage.gaussian_filter(grey, 11)) * CREASE * hair
    return ndimage.gaussian_filter(z, 2) - DOME * 0.6


def normals(z):
    dy, dx = np.gradient(ndimage.gaussian_filter(z, 3))
    length = np.sqrt(dx ** 2 + dy ** 2 + 1)
    return -dx / length, dy / length  # y flips: rows run down, the scene runs up


def main():
    img = framed(Image.open(ROOT / SOURCE).convert('RGB'))
    original = silhouette(img)
    person = round_shoulders(original)
    grey = np.asarray(img.convert('L'), float) / 255
    grey = np.where(original, grey, grey[original].mean())
    z = lift(framed_depth(), person, grey)
    nx, ny = normals(z)
    width, height = person.shape[1], person.shape[0]

    xs, ys = scatter(density(img, person, original) * FEATURES + EVEN * person, POINTS)
    col, row = xs.astype(int).clip(0, width - 1), ys.astype(int).clip(0, height - 1)
    soft = ndimage.gaussian_filter(grey, 7)
    low, high = np.percentile(soft[original], [2, 98])
    luma = 0.3 + 0.4 * np.clip((soft[row, col] - low) / (high - low), 0, 1)  # a narrow range, so no one dot shouts
    luma *= 1 - 0.45 * np.clip((ys - CHIN_ROW) / 150, 0, 1)  # the face is the brightest thing, not the shirt

    position = np.column_stack([xs / width, ys / height, 0.5 + z[row, col] / width, luma])
    out = ROOT / 'public/hero'
    out.mkdir(parents=True, exist_ok=True)
    packed = (np.clip(position, 0, 1) * 65535).astype('<u2').tobytes() + (np.column_stack([nx[row, col], ny[row, col]]) * 127).astype('i1').tobytes()
    (out / 'portrait.bin').write_bytes(packed)

    shades = (INK + (PAPER - INK) * (0.25 + 0.75 * luma[:, None])).astype(int)
    for name, (still_width, radius) in STILLS.items():
        size = (still_width, round(still_width * height / width))
        still = Image.new('RGB', size, tuple(int(c) for c in INK))
        draw = ImageDraw.Draw(still)
        for x, y, shade in zip(xs / width, ys / height, shades):
            cx, cy = x * size[0], y * size[1]
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=tuple(int(c) for c in shade))
        still.save(out / name, quality=55, method=6)
        print(f'{name} {(out / name).stat().st_size // 1024}KB')
    print(f'{POINTS} points, bin {(out / "portrait.bin").stat().st_size // 1024}KB, frame {img.size}, z px {z[person].min():.0f} to {z[person].max():.0f}')


if __name__ == '__main__':
    main()
