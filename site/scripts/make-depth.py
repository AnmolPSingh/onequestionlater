"""Estimate a depth map from a photo: the mask the particle figures are sculpted from.
  python make-depth.py <in.jpg> <out.png>

Needs torch and transformers, which the site itself doesn't, so run it from any environment that
has them. Writes a 16-bit greyscale PNG the size of the photo, near is bright. The results are kept
in assets-src/, so the build scripts don't need this to run.
"""
import sys

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

MODEL = 'depth-anything/Depth-Anything-V2-Base-hf'
LONG_SIDE = 1022  # a multiple of the model's 14px patch; finer picks up curls and the line of the nose


def main(source, target):
    photo = Image.open(source).convert('RGB')
    scale = LONG_SIDE / max(photo.size)
    size = {'height': round(photo.height * scale / 14) * 14, 'width': round(photo.width * scale / 14) * 14}
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL).eval()
    inputs = processor(images=photo, return_tensors='pt', size=size, do_resize=True, keep_aspect_ratio=False, ensure_multiple_of=14)
    with torch.no_grad():
        depth = model(**inputs).predicted_depth
    depth = torch.nn.functional.interpolate(depth[None], size=photo.size[::-1], mode='bicubic', align_corners=False)[0, 0].numpy()
    depth = (depth - depth.min()) / (depth.max() - depth.min())
    Image.fromarray((depth * 65535).astype('uint16')).save(target)
    print(target, depth.shape)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
