"""Clean the bust in Blender, render its review sheet with no effects, and export the GLB.
  Blender --background --python bust-blender.py -- <in.npz.json> <out.glb> <sheet_prefix>

The volume from make-bust.py comes in here as a plain mesh. Y up, the face toward +Z in the GLB.
Blender doesn't ship numpy-free npz reading in every build, so make-bust's output is passed as raw
arrays by bust-export.py.
"""
import json
import math
import sys
from array import array

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
source, glb, sheet = args[0], args[1], args[2]
TARGET_FACES = 60000
YAWS = (0, 45, -45, 90, 180)

meta = json.load(open(source + '.json'))
verts = array('f')
faces = array('i')
with open(source + '.verts', 'rb') as f:
    verts.frombytes(f.read())
with open(source + '.faces', 'rb') as f:
    faces.frombytes(f.read())

bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('anmol_bust')
mesh.from_pydata([verts[i:i + 3] for i in range(0, len(verts), 3)], [], [faces[i:i + 3] for i in range(0, len(faces), 3)])
mesh.update()
bust = bpy.data.objects.new('anmol_bust', mesh)
bpy.context.collection.objects.link(bust)
bpy.context.view_layer.objects.active = bust
bust.select_set(True)

# Blender's Z is up: the bust's y becomes Z, its z becomes -Y, so the face looks down -Y.
bust.rotation_euler = (math.pi / 2, 0, 0)
bust.scale = (0.001, 0.001, 0.001)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

smooth = bust.modifiers.new('smooth', 'SMOOTH')
smooth.factor = 0.5
smooth.iterations = 2
bpy.ops.object.modifier_apply(modifier='smooth')
decimate = bust.modifiers.new('decimate', 'DECIMATE')
decimate.ratio = min(1, TARGET_FACES / len(mesh.polygons))
bpy.ops.object.modifier_apply(modifier='decimate')
bpy.ops.object.shade_smooth()

xs = [v.co.x for v in mesh.vertices]
ys = [v.co.y for v in mesh.vertices]
zs = [v.co.z for v in mesh.vertices]
middle = ((min(xs) + max(xs)) / 2, 0, (min(zs) + max(zs)) / 2)
height = max(zs) - min(zs)
print('bust', len(mesh.vertices), 'vertices', len(mesh.polygons), 'faces, size', round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(height, 3))

grey = bpy.data.materials.new('clay')
grey.use_nodes = True
shader = grey.node_tree.nodes['Principled BSDF']
# The tone map is thrown straight back from the front, so only surfaces facing the photo take it.
nodes, links = grey.node_tree.nodes, grey.node_tree.links
tone = nodes.new('ShaderNodeTexImage')
tone.image = bpy.data.images.load(source.replace('/bust', '/bust-tone.png'))
tone.image.colorspace_settings.name = 'Non-Color'
coord = nodes.new('ShaderNodeTexCoord')
split = nodes.new('ShaderNodeSeparateXYZ')
links.new(coord.outputs['Object'], split.inputs[0])
join = nodes.new('ShaderNodeCombineXYZ')
scale_u = nodes.new('ShaderNodeMath')
scale_u.operation = 'MULTIPLY_ADD'
scale_u.inputs[1].default_value = 1 / 1.333
scale_u.inputs[2].default_value = meta['centre'] / 1333
links.new(split.outputs['X'], scale_u.inputs[0])
scale_v = nodes.new('ShaderNodeMath')
scale_v.operation = 'MULTIPLY_ADD'
scale_v.inputs[1].default_value = 0.5
scale_v.inputs[2].default_value = 1
links.new(split.outputs['Z'], scale_v.inputs[0])
links.new(scale_u.outputs[0], join.inputs['X'])
links.new(scale_v.outputs[0], join.inputs['Y'])
links.new(join.outputs[0], tone.inputs['Vector'])
facing = nodes.new('ShaderNodeSeparateXYZ')
links.new(nodes.new('ShaderNodeNewGeometry').outputs['Normal'], facing.inputs[0])
front = nodes.new('ShaderNodeMapRange')
front.inputs['From Min'].default_value = -0.05
front.inputs['From Max'].default_value = -0.45
links.new(facing.outputs['Y'], front.inputs['Value'])
mix = nodes.new('ShaderNodeMix')
mix.data_type = 'RGBA'
mix.inputs['A'].default_value = (0.3, 0.3, 0.31, 1)
links.new(front.outputs[0], mix.inputs['Factor'])
# The crown and back of the hair face away from the photo, so they take the hair's tone directly.
crown = nodes.new('ShaderNodeMapRange')
crown.inputs['From Min'].default_value = -0.82
crown.inputs['From Max'].default_value = -0.76
crown.inputs['To Min'].default_value = 0.3
crown.inputs['To Max'].default_value = 0.1
links.new(split.outputs['Z'], crown.inputs['Value'])
links.new(crown.outputs[0], mix.inputs['A'])
links.new(tone.outputs['Color'], mix.inputs['B'])
links.new(mix.outputs['Result'], shader.inputs['Base Color'])
shader.inputs['Roughness'].default_value = 0.55
mesh.materials.append(grey)

world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.02, 0.02, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
bpy.context.scene.world = world

pivot = bpy.data.objects.new('pivot', None)
bpy.context.collection.objects.link(pivot)
pivot.location = (0, 0, min(zs) + height * 0.62)
camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
bpy.context.collection.objects.link(camera)
camera.parent = pivot
camera.location = (0, -2.6, 0)
camera.rotation_euler = (math.pi / 2, 0, 0)
camera.data.lens = 70
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
bpy.context.collection.objects.link(key)
key.parent = pivot
key.data.energy = 90
key.data.size = 1.2
key.location = (-1.2, -1.4, 1.1)
key.rotation_euler = (1.0, 0, -0.7)
rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'AREA'))
bpy.context.collection.objects.link(rim)
rim.parent = pivot
rim.data.energy = 60
rim.data.size = 1
rim.location = (1.4, 1.2, 0.6)
rim.rotation_euler = (-1.0, 0, 2.3)

scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.device = 'CPU'
scene.render.resolution_x = 640
scene.render.resolution_y = 760
for yaw in YAWS:
    pivot.rotation_euler = (0, 0, math.radians(yaw))
    scene.render.filepath = f'{sheet}-{yaw:+04d}.png'
    bpy.ops.render.render(write_still=True)

# The still for visitors without motion or WebGL: the frame the hero uses, on transparent, darker.
pivot.rotation_euler = (0, 0, 0)
pivot.location = (0, 0, -1.031)
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.6
crown.inputs['To Min'].default_value = 0.13
crown.inputs['To Max'].default_value = 0.06
scene.render.film_transparent = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1206
scene.render.filepath = f'{sheet}-still.png'
bpy.ops.render.render(write_still=True)

bust.select_set(True)
bpy.context.view_layer.objects.active = bust
for extra in (pivot, camera, key, rim):
    extra.select_set(False)
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_yup=True, export_apply=True, export_materials='NONE')
print('wrote', glb)
