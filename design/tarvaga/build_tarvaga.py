"""
АЛХААЧ — Тарваа: 3D загвар ба рендер (Blender 5.x, Cycles)

Ажиллуулах (repo-ийн үндсээс):
  blender --background --factory-startup --python design/tarvaga/build_tarvaga.py -- \
      design/tarvaga/renders [--levels 0,50,100] [--samples 128] [--scale 100] \
      [--save-blend design/tarvaga/tarvaga.blend]

Жин бүрийн түвшинд (0..100) хоёр зураг + мета гаргана:
  beauty_XXX.png — бүрэн өнгөтэй рендер. Ороолт нь цагаан: апп дотор
                   хэрэглэгчийн сонгосон өнгөөр будагдана (сүүдэр нь хадгалагдана).
  mask_XXX.png   — ороолт цагаан, бусад хар (ороолтын хэсгийг ялгахад).
  meta.json      — нүдний байрлал (апп дотор анивчуулахад).

Дараа нь compose_layers.py нь эдгээрийг аппын давхаргууд болгож хувиргана.

Загвар бүхэлдээ кодоор үүсдэг: биеийг metaball-аар (зөөлөн, нийлсэн хэлбэр),
жижиг хэсгүүдийг (нүд, хамар, шүд, чих, сарвуу, ороолт) энгийн mesh-ээр.
Бүдүүрэлт t = жин/100: 0 — туранхай, 1 — бөндгөр.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

RES_X, RES_Y = 600, 650  # аппын харьцаа 240:260
K = 0.575  # metaball (stiffness 2, threshold 0.6)-ийн гадаргуу = K * radius


# ───────────────────────── тусламж ─────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t


def lerpv(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def smoothstep(e0, e1, x):
    x = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return x * x * (3 - 2 * x)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), 1.0)


def mixc(c1, c2, t):
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    here = os.path.dirname(os.path.abspath(__file__))
    opts = {
        "out": argv[0] if argv else os.path.join(here, "renders"),
        "levels": list(range(0, 101, 5)),
        "samples": 128,
        "scale": 100,
        "save_blend": None,
    }
    i = 1
    while i < len(argv):
        key = argv[i]
        val = argv[i + 1] if i + 1 < len(argv) else None
        if key == "--levels":
            opts["levels"] = [int(x) for x in val.split(",")]
        elif key == "--samples":
            opts["samples"] = int(val)
        elif key == "--scale":
            opts["scale"] = int(val)
        elif key == "--save-blend":
            opts["save_blend"] = os.path.abspath(val)
        i += 2
    return opts


# ───────────────────────── тайз ─────────────────────────

def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.metaballs, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for block in list(coll):
            coll.remove(block)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def new_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    return m


def principled(name, color=None, rough=0.6, sheen=0.0, coat=0.0, attr=None,
               bump=None, subsurface=0.0):
    """bump = (scale, strength, kind) — kind: 'fur' | 'knit'"""
    m = new_material(name)
    nt = m.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    if color is not None:
        bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Roughness"].default_value = 0.4
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if subsurface:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (0.02, 0.012, 0.008)
    if attr:
        a = nt.nodes.new("ShaderNodeAttribute")
        a.attribute_name = attr
        nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
    if bump:
        scale, strength, kind = bump
        coord = nt.nodes.new("ShaderNodeTexCoord")
        bmp = nt.nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = strength
        bmp.inputs["Distance"].default_value = 0.004
        if kind == "knit":
            # UV: u — хүзүүг тойрсон чиглэл, v — туузны хөндлөн. Судал × эгнээ = сүлжмэл
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            nt.links.new(coord.outputs["UV"], sep.inputs["Vector"])

            def wave(inp, freq):
                mul = nt.nodes.new("ShaderNodeMath")
                mul.operation = "MULTIPLY"
                mul.inputs[1].default_value = freq * 2 * math.pi
                nt.links.new(inp, mul.inputs[0])
                sn = nt.nodes.new("ShaderNodeMath")
                sn.operation = "SINE"
                nt.links.new(mul.outputs[0], sn.inputs[0])
                ab = nt.nodes.new("ShaderNodeMath")
                ab.operation = "ABSOLUTE"
                nt.links.new(sn.outputs[0], ab.inputs[0])
                return ab.outputs[0]

            ribs = wave(sep.outputs["X"], scale)
            rows = wave(sep.outputs["Y"], 4)
            prod = nt.nodes.new("ShaderNodeMath")
            prod.operation = "MULTIPLY"
            nt.links.new(ribs, prod.inputs[0])
            nt.links.new(rows, prod.inputs[1])
            nt.links.new(prod.outputs[0], bmp.inputs["Height"])
        else:
            noise = nt.nodes.new("ShaderNodeTexNoise")
            noise.inputs["Scale"].default_value = scale
            noise.inputs["Detail"].default_value = 6.0
            noise.inputs["Roughness"].default_value = 0.65
            nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
            nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"])
        nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def emission_material(name, value):
    m = new_material(name)
    nt = m.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (value, value, value, 1.0)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def ellipsoid_mesh(name, center, half, mat, rot=None, segs=40):
    """Тэгш бөмбөлгийг сунгаж зөөлөн ellipsoid mesh үүсгэнэ."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1.0, calc_uvs=True)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    ob.scale = half
    if rot is not None:
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = rot
    ob.location = center
    return ob


def capsule_between(name, a, b, radius, mat):
    """a → b чиглэлд сунасан зөөлөн капсул (гар, сүүл)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return ellipsoid_mesh(name, (a + b) / 2, (radius, radius, d.length / 2 + radius * 0.4), mat, rot)


def strip_between(name, a, b, width, thick, mat):
    """a → b чиглэлд унжсан хавтгай тууз: зузаан нь урагш (камер руу) харна."""
    a, b = Vector(a), Vector(b)
    z = (b - a).normalized()
    x = Vector((0, -1, 0)).cross(z).normalized()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_quaternion()
    return ellipsoid_mesh(name, (a + b) / 2, (width, thick, (b - a).length / 2 + 0.01), mat, rot)


# ───────────────────────── загвар ─────────────────────────

def fur_palette(t):
    # Одоогийн SVG дүрсний өнгөтэй ижил: туранхай үед саарал, бүдүүн үед алтлаг
    return {
        "light": mixc(hexcol("#DCD4C2"), hexcol("#F5CE82"), t),
        "base": mixc(hexcol("#A89A80"), hexcol("#D29236"), t),
        "dark": mixc(hexcol("#5E5646"), hexcol("#7E4E14"), t),
        "belly": mixc(hexcol("#E9E1D0"), hexcol("#F8E5B9"), t),
        "blush": hexcol("#E89A8E"),
    }


def build_body(t):
    """Их бие + толгой — нэг metaball (хэсгүүд зөөлөн нийлнэ)."""
    mb = bpy.data.metaballs.new("TarvaaBody")
    mb.resolution = mb.render_resolution = 0.011
    mb.threshold = 0.6

    def ell(co, half, stiff=2.0):
        r = max(half) / K
        e = mb.elements.new(type="ELLIPSOID")
        e.co = co
        e.radius = r
        e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = (h / max(half) for h in half)

    head_z = lerp(0.83, 0.77, t)
    # их бие (тарвага босоо суудаг)
    ell((0, 0.02, lerp(0.40, 0.35, t)), (lerp(0.20, 0.37, t), lerp(0.18, 0.31, t), lerp(0.30, 0.29, t)))
    # гэдэс — урагш товойно
    ell((0, -lerp(0.06, 0.13, t), lerp(0.31, 0.27, t)), (lerp(0.15, 0.30, t), lerp(0.12, 0.22, t), lerp(0.18, 0.24, t)))
    # суудал / ташаа
    ell((0, 0.03, lerp(0.13, 0.14, t)), (lerp(0.21, 0.39, t), lerp(0.19, 0.31, t), 0.13))
    # хүзүү (ороолт далдална)
    ell((0, -0.01, lerp(0.64, 0.58, t)), (lerp(0.13, 0.19, t), 0.12, 0.10))
    # толгой
    ell((0, -0.03, head_z), (lerp(0.19, 0.22, t), 0.17, 0.165))
    # хацар — бүдүүрэхэд томорно
    for s in (-1, 1):
        ell((s * lerp(0.09, 0.12, t), -0.09, head_z - 0.06), (lerp(0.075, 0.105, t),) * 3)
    # хошуу
    ell((0, -0.14, head_z - 0.055), (0.085, 0.075, 0.065))

    ob = link(bpy.data.objects.new("TarvaaBodyMeta", mb))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.metaballs.remove(mb)
    me.name = "TarvaaBody"
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    body = link(bpy.data.objects.new("TarvaaBody", me))
    return body, head_z


def paint_fur(body, t, head_z, muzzle_center):
    """Үсний өнгийг оройн өнгөөр: нуруу/орой бараан, гэдэс/хошуу цайвар."""
    me = body.data
    pal = fur_palette(t)
    attr = me.color_attributes.new("fur", "FLOAT_COLOR", "POINT")
    normals = [v.normal for v in me.vertices]
    colors = []
    belly_c = Vector((0, -lerp(0.1, 0.2, t), lerp(0.33, 0.28, t)))
    for v, n in zip(me.vertices, normals):
        p = v.co
        c = pal["base"]
        # дээш/хойш харсан хэсэг бараан (тарваганы нуруу, оройн "малгай")
        back = smoothstep(-0.1, 0.8, n.y) * 0.8 + smoothstep(0.5, 1.0, n.z) * smoothstep(head_z, head_z + 0.12, p.z) * 0.7
        c = mixc(c, pal["dark"], min(1.0, back))
        # гэдэс
        front = smoothstep(0.1, 0.8, -n.y)
        dz = (p.z - belly_c.z) / lerp(0.24, 0.3, t)
        dx = p.x / lerp(0.16, 0.3, t)
        belly = front * max(0.0, 1.0 - (dx * dx + dz * dz)) ** 0.7
        c = mixc(c, pal["belly"], min(1.0, belly * 1.1))
        # хошуу, эрүү
        dm = (p - muzzle_center).length
        c = mixc(c, pal["light"], smoothstep(0.13, 0.05, dm) * smoothstep(-0.2, 0.5, -n.y))
        # хацрын ягаан туяа
        for s in (-1, 1):
            dc = (p - Vector((s * lerp(0.11, 0.14, t), -0.15, head_z - 0.07))).length
            c = mixc(c, pal["blush"], 0.45 * smoothstep(0.07, 0.0, dc) * smoothstep(0.0, 0.5, -n.y))
        colors.extend(c)
    attr.data.foreach_set("color", colors)
    me.color_attributes.active_color = attr


def surface_point(bvh, origin, direction):
    hit, normal, _i, _d = bvh.ray_cast(Vector(origin), Vector(direction).normalized())
    return hit, normal


def build(t):
    """t (0..1) бүдүүрэлтэй бүтэн тарваа. Материал ба нүдний мэдээллийг буцаана."""
    pal = fur_palette(t)
    mats = {
        "fur": principled("Fur", rough=0.72, sheen=0.55, attr="fur", bump=(260, 0.18, "fur"), subsurface=0.04),
        "paw": principled("Paw", color=mixc(hexcol("#4A3A2C"), hexcol("#5C3A1A"), t), rough=0.55, sheen=0.3),
        "ear": principled("EarInner", color=mixc(hexcol("#8E6E5C"), hexcol("#A0674A"), t), rough=0.6),
        "eye": principled("Eye", color=hexcol("#0B0A0A"), rough=0.06, coat=1.0),
        "nose": principled("Nose", color=hexcol("#3A2624"), rough=0.3, coat=0.5),
        "teeth": principled("Teeth", color=hexcol("#F4ECD8"), rough=0.3),
        "scarf": principled("Scarf", color=(0.9, 0.9, 0.9, 1.0), rough=0.9, sheen=0.4, bump=(56, 0.5, "knit")),
    }

    body, head_z = build_body(t)
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(body, dg)
    head_c = Vector((0, -0.03, head_z))

    # хошууны урд цэг
    muzzle_hit, muzzle_n = surface_point(bvh, head_c + Vector((0, 0, -0.05)), (0, -1, -0.05))
    paint_fur(body, t, head_z, muzzle_hit + Vector((0, 0.03, -0.01)))
    body.data.materials.append(mats["fur"])

    # ── нүд (гадаргуу дээр raycast-аар байрлуулна)
    eye_r = lerp(0.043, 0.038, t)
    eyes = []
    for s in (-1, 1):
        hit, n = surface_point(bvh, head_c, (s * 0.47, -1.0, 0.33))
        c = hit - n * eye_r * 0.35
        eyes.append(ellipsoid_mesh(f"Eye{s}", c, (eye_r, eye_r * 0.85, eye_r * 1.08), mats["eye"]))

    # ── хамар
    nose_hit, nose_n = surface_point(bvh, head_c + Vector((0, 0, -0.03)), (0, -1, 0.12))
    ellipsoid_mesh("Nose", nose_hit + nose_n * 0.006, (0.033, 0.022, 0.022), mats["nose"])

    # ── ам: хамраас доош «λ» хэлбэртэй зураас (мэрэгчдийн ам)
    top_hit, top_n = surface_point(bvh, Vector((0, -0.03, nose_hit.z - 0.018)), (0, -1, 0))
    mouth_top = top_hit + top_n * 0.002
    mouth_hit, mouth_n = surface_point(bvh, Vector((0, -0.03, nose_hit.z - 0.048)), (0, -1, 0))
    mouth_bot = mouth_hit + mouth_n * 0.002
    capsule_between("Mouth", mouth_top, mouth_bot, 0.0055, mats["nose"])
    for s in (-1, 1):
        corner, cn = surface_point(bvh, Vector((0, -0.03, nose_hit.z - 0.036)), (s * 0.24, -1, 0))
        capsule_between(f"MouthSide{s}", mouth_bot, corner + cn * 0.002, 0.005, mats["nose"])

    # ── шүд (тарваганы хоёр том урд шүд) — амны доор
    for s in (-1, 1):
        th, tn = surface_point(bvh, Vector((s * 0.0105, -0.03, mouth_bot.z - 0.022)), (0, -1, 0))
        ellipsoid_mesh(f"Tooth{s}", th + tn * 0.003, (0.0098, 0.0055, 0.019), mats["teeth"], segs=24)

    # ── чих
    head_w = lerp(0.19, 0.22, t)
    for s in (-1, 1):
        hit, n = surface_point(bvh, head_c, (s * 0.8, 0.15, 0.75))
        rot = Vector((0, 0, 1)).rotation_difference(n)
        ellipsoid_mesh(f"Ear{s}", hit + n * 0.01, (0.055, 0.03, 0.05), mats["fur"], rot)
        ellipsoid_mesh(f"EarIn{s}", hit + n * 0.018 + Vector((0, -0.012, 0)), (0.034, 0.012, 0.03), mats["ear"], rot)
    # чихний mesh-үүдэд үсний өнгийн attribute байхгүй тул тусдаа материал өгнө
    ear_mat = principled("EarFur", color=pal["dark"], rough=0.72, sheen=0.55, bump=(260, 0.18, "fur"))
    for s in (-1, 1):
        bpy.data.objects[f"Ear{s}"].data.materials[0] = ear_mat

    # ── урд сарвуу: цээжин дээрээ нийлүүлж барина (тарваганы алдартай байрлал)
    paw_z = lerp(0.47, 0.44, t)
    arm_mat = principled("ArmFur", color=pal["base"], rough=0.72, sheen=0.55, bump=(260, 0.18, "fur"))
    for s in (-1, 1):
        front, _n = surface_point(bvh, (s * lerp(0.07, 0.1, t), -1.0, paw_z), (0, 1, 0))
        paw = front + Vector((0, -0.035, 0))
        shoulder = Vector((s * lerp(0.15, 0.27, t), -lerp(0.02, 0.08, t), lerp(0.58, 0.52, t)))
        capsule_between(f"Arm{s}", shoulder, paw + Vector((s * 0.01, 0.01, 0.02)), lerp(0.045, 0.058, t), arm_mat)
        ellipsoid_mesh(f"Paw{s}", paw, (0.042, 0.034, 0.03), mats["paw"])

    # ── хойд хөл (биеийн доор шургасан)
    foot_mat = principled("Foot", color=mixc(pal["dark"], hexcol("#3A2C22"), 0.4), rough=0.6, sheen=0.4)
    for s in (-1, 1):
        x = s * lerp(0.1, 0.19, t)
        front, _n = surface_point(bvh, (x, -1.0, 0.045), (0, 1, 0))
        foot = Vector((x, (front.y if front else -0.22) - 0.012, 0.03))
        ellipsoid_mesh(f"Foot{s}", foot, (0.05, 0.08, 0.03), foot_mat,
                       rot=Matrix.Rotation(s * -0.25, 4, "Z").to_quaternion())

    # ── сүүл: бараан, сэвсгэр, ард нь бага зэрэг цухуйна
    tail_mat = principled("Tail", color=pal["dark"], rough=0.75, sheen=0.6, bump=(260, 0.22, "fur"))
    capsule_between("Tail", (lerp(0.08, 0.2, t), 0.24, 0.07), (lerp(0.2, 0.33, t), 0.4, 0.035), 0.055, tail_mat)

    # ── ороолт: хүзүүг тойрсон хавтгай сүлжмэл тууз + зангилаа + хоёр унжлага
    neck_z = lerp(0.605, 0.55, t)
    center = Vector((0, 0, neck_z))
    samples = 36
    neck_r = []
    for k in range(samples):
        a = 2 * math.pi * k / samples
        d = Vector((math.cos(a), math.sin(a), 0))
        hit, _n = surface_point(bvh, center + d * 1.0, -d)
        neck_r.append((hit - center).length if hit else 0.15)

    def r_at(a):
        f = (a / (2 * math.pi)) * samples
        i0 = int(math.floor(f)) % samples
        w = f - math.floor(f)
        return neck_r[i0] * (1 - w) + neck_r[(i0 + 1) % samples] * w

    thick, half_h = 0.036, 0.062
    seg_major, seg_minor = 96, 20
    me = bpy.data.meshes.new("Scarf")
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = []
    for i in range(seg_major):
        a = 2 * math.pi * i / seg_major
        base_r = r_at(a) + thick * 0.55
        droop = 0.022 * max(0.0, -math.sin(a))  # урд тал бага зэрэг унжина
        row = []
        for j in range(seg_minor):
            b = 2 * math.pi * j / seg_minor
            rr = base_r + thick * math.cos(b)
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a),
                                     neck_z - droop + half_h * math.sin(b))))
        grid.append(row)
    for i in range(seg_major):
        for j in range(seg_minor):
            i1, j1 = (i + 1) % seg_major, (j + 1) % seg_minor
            f = bm.faces.new((grid[i][j], grid[i1][j], grid[i1][j1], grid[i][j1]))
            uvs = ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
            for loop, (u, v) in zip(f.loops, uvs):
                loop[uv_layer].uv = (u / seg_major, v / seg_minor)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(mats["scarf"])
    link(bpy.data.objects.new("Scarf", me))

    # зангилаа: камер тийш харсан баруун урд талд
    ak = math.radians(-32)
    rk = r_at(ak % (2 * math.pi)) + thick * 1.6
    knot = Vector((rk * math.cos(ak), rk * math.sin(ak), neck_z - 0.012))
    ellipsoid_mesh("ScarfKnot", knot, (0.048, 0.034, 0.046), mats["scarf"])
    for name, off, width in (("ScarfEndA", (0.012, -0.018, -0.15), 0.046), ("ScarfEndB", (0.058, 0.0, -0.12), 0.04)):
        a = knot + Vector((0, -0.01, -0.02))
        b = knot + Vector(off)
        strip_between(name, a, b, width, 0.016, mats["scarf"])

    scarf = [o for o in bpy.data.objects
             if o.type == "MESH" and o.data.materials and o.data.materials[0] == mats["scarf"]]
    return eyes, eye_r, scarf


def setup_camera_and_lights(samples, scale):
    scene = bpy.context.scene
    target = Vector((0, 0, 0.51))
    direction = Vector((0.22, -1.0, 0.2)).normalized()
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 120
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = 36
    cam = link(bpy.data.objects.new("Cam", cam_data))
    dist = 1.2 * 120 / 36  # кадрын өргөн ≈ 1.2 м
    cam.location = target + direction * dist
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (-direction).to_track_quat("-Z", "Y")
    scene.camera = cam

    def area(name, loc, energy, size, color):
        ld = bpy.data.lights.new(name, type="AREA")
        ld.energy = energy
        ld.size = size
        ld.color = color
        ob = link(bpy.data.objects.new(name, ld))
        ob.location = loc
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = (target - Vector(loc)).to_track_quat("-Z", "Y")

    area("Key", (-1.7, -2.4, 2.4), 170, 1.6, (1.0, 0.95, 0.88))
    area("Fill", (2.4, -1.6, 0.9), 55, 2.2, (0.86, 0.91, 1.0))
    area("Rim", (0.9, 2.4, 2.1), 260, 1.2, (1.0, 0.97, 0.92))
    area("Bounce", (0, -1.2, -0.6), 12, 2.0, (1.0, 0.92, 0.8))

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    wnt = world.node_tree
    bg = wnt.nodes.get("Background")
    if bg is None:
        wnt.nodes.clear()
        bg = wnt.nodes.new("ShaderNodeBackground")
        wout = wnt.nodes.new("ShaderNodeOutputWorld")
        wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])
    bg.inputs["Color"].default_value = (0.55, 0.57, 0.62, 1.0)
    bg.inputs["Strength"].default_value = 0.22
    scene.world = world

    r = scene.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y = RES_X, RES_Y
    r.resolution_percentage = scale
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    # CUDA: OptiX-ийн kernel зарим драйвер дээр compile хийгдэхгүй байна
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "CUDA"
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == "CUDA"]
        for d in prefs.devices:
            d.use = d.type == "CUDA"
        scene.cycles.device = "GPU" if gpus else "CPU"
    except Exception as e:  # GPU байхгүй бол CPU
        print("GPU unavailable:", e)
        scene.cycles.device = "CPU"
    return cam


def eye_meta(eyes, eye_r, cam):
    scene = bpy.context.scene
    right = cam.matrix_world.to_quaternion() @ Vector((1, 0, 0))
    up = cam.matrix_world.to_quaternion() @ Vector((0, 1, 0))
    out = []
    for e in sorted(eyes, key=lambda o: o.location.x):
        c = world_to_camera_view(scene, cam, e.location)
        cx = world_to_camera_view(scene, cam, e.location + right * eye_r)
        cy = world_to_camera_view(scene, cam, e.location + up * eye_r * 1.08)
        out.append({
            "x": round(c.x, 4), "y": round(1 - c.y, 4),
            "rx": round(abs(cx.x - c.x), 4), "ry": round(abs(cy.y - c.y), 4),
        })
    return out


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    opts = parse_args()
    os.makedirs(opts["out"], exist_ok=True)
    meta = {"width": RES_X, "height": RES_Y, "levels": {}}
    for level in opts["levels"]:
        t = level / 100
        reset_scene()
        cam = setup_camera_and_lights(opts["samples"], opts["scale"])
        eyes, eye_r, scarf_objs = build(t)
        meta["levels"][str(level)] = {"eyes": eye_meta(eyes, eye_r, cam)}

        if opts["save_blend"] and level == 50:
            bpy.ops.wm.save_as_mainfile(filepath=opts["save_blend"], compress=True, copy=True)

        render(os.path.join(opts["out"], f"beauty_{level:03d}.png"))

        # Маскын рендер: ороолт = цагаан, бусад = хар (гэрэлтүүлэггүй)
        white = emission_material("MaskWhite", 1.0)
        black = emission_material("MaskBlack", 0.0)
        scarf_names = {o.name for o in scarf_objs}
        for ob in bpy.data.objects:
            if ob.type == "MESH":
                for i in range(len(ob.data.materials)):
                    ob.data.materials[i] = white if ob.name in scarf_names else black
        sc = bpy.context.scene.cycles
        samples, denoise = sc.samples, sc.use_denoising
        sc.samples, sc.use_denoising = 32, False
        render(os.path.join(opts["out"], f"mask_{level:03d}.png"))
        sc.samples, sc.use_denoising = samples, denoise
        print(f"LEVEL {level} done")

    meta_path = os.path.join(opts["out"], "meta.json")
    old = {}
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as f:
            old = json.load(f).get("levels", {})
    old.update(meta["levels"])
    meta["levels"] = dict(sorted(old.items(), key=lambda kv: int(kv[0])))
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)


main()
