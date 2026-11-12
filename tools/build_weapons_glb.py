from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app/src/main/assets"


def solid_pbr_material(name, color, metallic, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def weapon_material(prefix, object_name):
    part = object_name.lower()
    if "magazine" in part or "cargador" in part:
        return solid_pbr_material(f"{prefix}_Polymer", (0.055, 0.065, 0.052), 0.08, 0.78)
    if "trigger" in part or "ejection" in part:
        return solid_pbr_material(f"{prefix}_Steel", (0.075, 0.082, 0.075), 0.72, 0.42)
    if "low part" in part or "parte baja" in part:
        return solid_pbr_material(f"{prefix}_LowerReceiver", (0.085, 0.095, 0.075), 0.18, 0.7)
    return solid_pbr_material(f"{prefix}_Receiver", (0.12, 0.14, 0.12), 0.62, 0.48)


def export_fbx(filename, output_name, prefix):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = ROOT / filename
    if not source.is_file():
        raise FileNotFoundError(f"Weapon source FBX was not found: {source}")

    bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{filename} contains no mesh objects.")

    for obj in meshes:
        material = weapon_material(prefix, obj.name)
        obj.name = f"{prefix}_{obj.name}"
        world_matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_matrix
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.select_set(False)
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    output = OUTPUT / output_name
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_animations=False,
        export_skins=False,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
        export_yup=True,
        use_selection=True,
    )
    print(f"Exported {output.name}: {output.stat().st_size} bytes ({len(meshes)} meshes)")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    export_fbx("ar70_pbr.FBX", "ar70_pbr.glb", "AR70")
    export_fbx("akm.fbx", "akm.glb", "AKM")


main()
