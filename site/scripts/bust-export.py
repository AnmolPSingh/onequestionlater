"""Unpack make-bust's npz into raw arrays Blender's Python can read without numpy.
  python bust-export.py <in.npz> <out_prefix>
"""
import json
import sys

import numpy as np

data = np.load(sys.argv[1])
prefix = sys.argv[2]
data['verts'].astype('<f4').tofile(prefix + '.verts')
data['faces'].astype('<i4').tofile(prefix + '.faces')
json.dump({'centre': float(data['centre'])}, open(prefix + '.json', 'w'))
