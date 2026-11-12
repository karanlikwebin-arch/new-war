from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app/src/main/assets/soldier.glb"
CLIPS = [
    ("Idle", "Breathing Idle.fbx"),
    ("Walk", "Unarmed Walk Forward.fbx"),
    ("Backstep", "Stepping Backward.fbx"),
    ("Jump", "Jumping.fbx"),
    ("Landing", "Jumping Down.fbx"),
    ("Prone", "Prone Forward Stop.fbx"),
    ("Death", "Dying.fbx"),
]


def import_fbx(filename):
    previous_objects = set(bpy.data.objects)
    previous_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(ROOT / filename), use_anim=True)
    objects = set(bpy.data.objects) - previous_objects
    actions = set(bpy.data.actions) - previous_actions
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    clips = sorted(actions, key=lambda action: len(action.fcurves), reverse=True)
    if not armatures or not clips:
        raise RuntimeError(f"{filename} did not contain both an armature and an action")
    return objects, armatures[0], clips[0]


def remove_objects(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.object.delete(use_global=False)


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    base_objects, base_rig, idle_action = import_fbx(CLIPS[0][1])
    base_rig.name = "SoldierRig"
    base_rig.animation_data_create()
    base_meshes = [obj for obj in base_objects if obj.type == "MESH"]
    for mesh in base_meshes:
        mesh.name = "Soldier_" + mesh.name
    base_bones = {bone.name for bone in base_rig.data.bones}

    actions = [(CLIPS[0][0], idle_action)]
    for clip_name, filename in CLIPS[1:]:
        imported_objects, imported_rig, action = import_fbx(filename)
        imported_bones = {bone.name for bone in imported_rig.data.bones}
        if imported_bones != base_bones:
            missing = sorted(base_bones - imported_bones)
            extra = sorted(imported_bones - base_bones)
            raise RuntimeError(f"{filename} rig mismatch; missing={missing}, extra={extra}")
        action.name = clip_name
        action.use_fake_user = True
        actions.append((clip_name, action))
        remove_objects(imported_objects)

    idle_action.name = "Idle"
    idle_action.use_fake_user = True
    for clip_name, action in actions:
        track = base_rig.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, action)
        strip.name = clip_name
        track.mute = False

    base_rig.animation_data.action = None
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 300

    bpy.ops.object.select_all(action="DESELECT")
    base_rig.select_set(True)
    for mesh in base_meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = base_rig
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_skins=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
        export_yup=True,
    )
    print(f"Exported {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
    print("Clips:", [name for name, _ in actions])
    print("Rig bones:", len(base_bones), "meshes:", len(base_meshes))


main()
