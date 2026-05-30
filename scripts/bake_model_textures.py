"""
Blender Script: Bake Model Textures and Export GLB (Generic)
=============================================================

Usage:
1. Open your Blender project
2. Select the model(s) you want to bake
3. Open this script in Blender's Text Editor
4. Run the script (Alt+P or click "Run Script")

The script will:
- Join selected meshes into one object
- Apply all transforms
- Create new UV layout for baking (Smart UV Project)
- Bake all PBR channels to textures
- Create a new combined material
- Center model and export as GLB
- Restore original objects

Requirements:
- Blender 4.0+ / 5.0
- Cycles render engine (script will switch automatically)
"""

import bpy
import os
import mathutils
from pathlib import Path


# ============================================================================
# CONFIGURATION - Modify these paths as needed
# ============================================================================

# Use user's home directory for generic paths
HOME_DIR = str(Path.home())
TEXTURES_BASE_PATH = os.path.join(HOME_DIR, "Projects/3d-modeling/blender/baked-textures")
GLB_OUTPUT_PATH = os.path.join(HOME_DIR, "Projects/3d-modeling/blender/render-outputs/baked-models")

# ============================================================================
# QUALITY PRESET - Set to "low", "medium", or "high"
# Set to None to use manual settings below
# ============================================================================
QUALITY_PRESET = "medium"

# ============================================================================
# MANUAL SETTINGS (used when QUALITY_PRESET is None)
# ============================================================================

# Bake settings
BAKE_RESOLUTION = 1024  # Texture resolution (512, 1024, 2048, 4096)
BAKE_MARGIN = 2  # Margin in pixels to prevent seam bleeding
BAKE_SAMPLES = 64  # Samples for baking (higher = better quality, slower)

# UV island margin for Smart UV Project
UV_ISLAND_MARGIN = 0.02

# Texture format settings
USE_JPEG_FOR_ALL = True  # True = JPEG for all textures (smaller), False = PNG for data textures
JPEG_QUALITY = 85  # JPEG quality (0-100)
GLB_IMAGE_QUALITY = 75  # Image quality inside GLB (0-100)

# Which maps to bake
BAKE_MAPS = {
    'diffuse': True,      # Base color
    'roughness': True,    # Roughness
    'metallic': True,     # Metallic
    'normal': True,       # Normal map
    'emission': True,     # Emission
}

# Emissive detection threshold (0.0 to 1.0)
# Materials with emission brighter than this will be kept
EMISSIVE_THRESHOLD = 0.05

# ============================================================================
# QUALITY PRESETS DEFINITION
# ============================================================================
QUALITY_PRESETS = {
    "low": {
        "resolution": 512,
        "samples": 32,
        "margin": 2,
        "jpeg_quality": 70,
        "glb_quality": 60,
        "use_jpeg_for_all": True,
    },
    "medium": {
        "resolution": 1024,
        "samples": 64,
        "margin": 2,
        "jpeg_quality": 85,
        "glb_quality": 75,
        "use_jpeg_for_all": True,
    },
    "high": {
        "resolution": 2048,
        "samples": 128,
        "margin": 4,
        "jpeg_quality": 95,
        "glb_quality": 90,
        "use_jpeg_for_all": False,  # Use PNG for data textures
    },
}

def apply_quality_preset():
    """Apply quality preset settings."""
    global BAKE_RESOLUTION, BAKE_SAMPLES, BAKE_MARGIN, JPEG_QUALITY, GLB_IMAGE_QUALITY, USE_JPEG_FOR_ALL

    if QUALITY_PRESET and QUALITY_PRESET in QUALITY_PRESETS:
        preset = QUALITY_PRESETS[QUALITY_PRESET]
        BAKE_RESOLUTION = preset["resolution"]
        BAKE_SAMPLES = preset["samples"]
        BAKE_MARGIN = preset["margin"]
        JPEG_QUALITY = preset["jpeg_quality"]
        GLB_IMAGE_QUALITY = preset["glb_quality"]
        USE_JPEG_FOR_ALL = preset["use_jpeg_for_all"]
        print(f"Using quality preset: {QUALITY_PRESET}")
        print(f"  Resolution: {BAKE_RESOLUTION}, Samples: {BAKE_SAMPLES}, JPEG: {JPEG_QUALITY}%")

# Apply preset on script load
apply_quality_preset()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_selected_objects():
    """Get all selected mesh objects."""
    return [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']


def get_model_name(objects):
    """Generate a name for the model based on selection."""
    if len(objects) == 1:
        return objects[0].name
    elif len(objects) > 1:
        parent = objects[0].parent
        if parent and all(obj.parent == parent for obj in objects):
            return parent.name
        return objects[0].name + "_combined"
    return "unnamed_model"


def sanitize_filename(name):
    """Remove invalid characters from filename."""
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    return name


def ensure_directory(path):
    """Create directory if it doesn't exist."""
    Path(path).mkdir(parents=True, exist_ok=True)
    return path


def setup_cycles():
    """Switch to Cycles render engine for baking."""
    bpy.context.scene.render.engine = 'CYCLES'
    
    # Use GPU if available (Metal for macOS)
    try:
        prefs = bpy.context.preferences.addons.get('cycles')
        if prefs:
            cycles_prefs = prefs.preferences
            cycles_prefs.compute_device_type = 'METAL'
            bpy.context.scene.cycles.device = 'GPU'
            cycles_prefs.get_devices()
            for device in cycles_prefs.devices:
                device.use = True
    except Exception as e:
        print(f"  Note: Could not setup GPU, using CPU: {e}")
    
    # Bake settings
    bpy.context.scene.cycles.samples = BAKE_SAMPLES
    bpy.context.scene.render.bake.margin = BAKE_MARGIN
    bpy.context.scene.render.bake.use_clear = True
    bpy.context.scene.render.bake.use_selected_to_active = False
    
    print(f"  Cycles configured with {BAKE_SAMPLES} samples")


def store_object_data(objects):
    """Store original object data for later restoration."""
    data = []
    for obj in objects:
        obj_data = {
            'name': obj.name,
            'location': obj.location.copy(),
            'rotation': obj.rotation_euler.copy(),
            'scale': obj.scale.copy(),
            'materials': [slot.material for slot in obj.material_slots],
            'mesh_data': obj.data.copy(),  # Copy mesh data
        }
        data.append(obj_data)
    return data


def duplicate_objects(objects):
    """Create duplicates of objects for baking (to preserve originals)."""
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    
    # Duplicate
    bpy.ops.object.duplicate()
    
    # Get duplicated objects
    duplicates = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    return duplicates


def apply_transforms(objects):
    """Apply transforms to all objects."""
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def join_meshes(objects):
    """Join multiple mesh objects into one."""
    if len(objects) < 2:
        return objects[0] if objects else None
    
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    
    return bpy.context.active_object


def create_bake_uv_map(obj, uv_name="BakeUV"):
    """Create a new UV map for baking using Smart UV Project."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    
    # Remove existing bake UV if present
    if uv_name in obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[uv_name])
    
    # Create new UV map
    uv_layer = obj.data.uv_layers.new(name=uv_name)
    uv_layer.active = True
    obj.data.uv_layers.active = uv_layer
    
    # Enter edit mode and select all
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    
    # Smart UV Project
    bpy.ops.uv.smart_project(
        angle_limit=66.0 * (3.14159 / 180),  # Convert to radians
        island_margin=UV_ISLAND_MARGIN,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=True
    )
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    return uv_layer


def create_bake_image(name, size, is_data=False):
    """Create a new image for baking with appropriate defaults."""
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    
    image = bpy.data.images.new(
        name=name,
        width=size,
        height=size,
        alpha=True,
        float_buffer=is_data,
        is_data=is_data
    )
    
    # Fill with appropriate default color
    if "normal" in name.lower():
        image.pixels[:] = [0.5, 0.5, 1.0, 1.0] * (size * size)
    elif "roughness" in name.lower():
        image.pixels[:] = [0.5, 0.5, 0.5, 1.0] * (size * size)
    elif "metallic" in name.lower():
        image.pixels[:] = [0.0, 0.0, 0.0, 1.0] * (size * size)
    elif "emission" in name.lower():
        image.pixels[:] = [0.0, 0.0, 0.0, 1.0] * (size * size)
    else:
        image.pixels[:] = [0.5, 0.5, 0.5, 1.0] * (size * size)
    
    return image


def setup_bake_node(material, image):
    """Add an image texture node to material for baking target."""
    if not material.use_nodes:
        material.use_nodes = True
    
    nodes = material.node_tree.nodes
    
    # Remove existing bake nodes
    for node in [n for n in nodes if n.name == "BakeTarget"]:
        nodes.remove(node)
    
    # Create image texture node
    tex_node = nodes.new('ShaderNodeTexImage')
    tex_node.name = "BakeTarget"
    tex_node.image = image
    tex_node.select = True
    nodes.active = tex_node
    
    return tex_node


def remove_bake_nodes(material):
    """Remove bake target nodes from material."""
    if not material.use_nodes:
        return
    
    nodes = material.node_tree.nodes
    for node in [n for n in nodes if n.name == "BakeTarget"]:
        nodes.remove(node)


def material_has_emission(mat):
    """
    Auto-detect if material has actual emission set.
    Returns True if material has non-black emission color with strength > 0.
    """
    if not mat or not mat.use_nodes:
        return False

    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            emission_input = node.inputs.get('Emission Color') or node.inputs.get('Emission')
            strength_input = node.inputs.get('Emission Strength')

            # Check if emission is linked (texture connected)
            if emission_input and emission_input.is_linked:
                if strength_input and strength_input.default_value > 0:
                    return True

            # Check emission color value
            if emission_input and hasattr(emission_input, 'default_value'):
                color = emission_input.default_value
                if len(color) >= 3:
                    brightness = (color[0] + color[1] + color[2]) / 3
                    if brightness > EMISSIVE_THRESHOLD:
                        if strength_input and strength_input.default_value > 0:
                            return True

        elif node.type == 'EMISSION':
            strength_input = node.inputs.get('Strength')
            if strength_input and strength_input.default_value > 0:
                return True

    return False


def prepare_emissive_for_bake(obj):
    """
    Prepare materials for emissive baking.
    Auto-detects which materials have real emission based on their properties.
    """
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue

        # Auto-detect based on actual material properties
        if material_has_emission(mat):
            print(f"      KEEPING emission in: {mat.name} (auto-detected)")
            # Boost emission strength to ensure it bakes properly
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    strength_input = node.inputs.get('Emission Strength')
                    if strength_input and strength_input.default_value < 1.0:
                        strength_input.default_value = 1.0
                elif node.type == 'EMISSION':
                    strength_input = node.inputs.get('Strength')
                    if strength_input and strength_input.default_value < 1.0:
                        strength_input.default_value = 1.0
        else:
            print(f"      No emission in: {mat.name}")


def get_original_uv_name(obj):
    """Get the name of the first non-bake UV map (the original UV layout)."""
    for uv_layer in obj.data.uv_layers:
        if uv_layer.name != "BakeUV":
            return uv_layer.name
    return None


def fix_texture_uv_references(obj, original_uv_name):
    """
    Ensure all source texture nodes explicitly reference the original UV map.

    When BakeUV is set as the active UV layer (required for bake output),
    texture nodes without explicit UV connections will incorrectly sample
    from BakeUV instead of the original UV. This adds UV Map nodes to
    preserve correct texture sampling during baking.
    """
    if not original_uv_name:
        print("      WARNING: No original UV map found, skipping UV fix")
        return

    fixed_count = 0
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue

        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        for node in list(nodes):
            if node.type == 'TEX_IMAGE' and node.name != "BakeTarget":
                if not node.inputs['Vector'].is_linked:
                    uv_node = nodes.new('ShaderNodeUVMap')
                    uv_node.uv_map = original_uv_name
                    uv_node.location = (node.location.x - 200, node.location.y)
                    links.new(uv_node.outputs['UV'], node.inputs['Vector'])
                    fixed_count += 1

    if fixed_count > 0:
        print(f"      Fixed {fixed_count} texture node(s) to use original UV: '{original_uv_name}'")
    else:
        print(f"      All texture nodes already have explicit UV references")


def bake_channel(obj, image, bake_type, **kwargs):
    """Bake a specific channel to image."""
    # Setup bake target node in all materials
    for slot in obj.material_slots:
        if slot.material:
            setup_bake_node(slot.material, image)
    
    # Select object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    
    # Perform bake
    bpy.ops.object.bake(type=bake_type, **kwargs)
    
    # Clean up bake nodes
    for slot in obj.material_slots:
        if slot.material:
            remove_bake_nodes(slot.material)


def save_image(image, filepath, channel_name=""):
    """Save image to file (JPEG or PNG based on settings)."""
    # Data textures (normal, metallic) benefit from PNG unless USE_JPEG_FOR_ALL is True
    data_channels = ["normal", "metallic"]
    use_jpeg = USE_JPEG_FOR_ALL or channel_name not in data_channels

    if use_jpeg:
        # Change extension to .jpg
        filepath = os.path.splitext(filepath)[0] + ".jpg"
        image.filepath_raw = filepath
        image.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = JPEG_QUALITY
    else:
        image.filepath_raw = filepath
        image.file_format = 'PNG'

    image.save()
    return filepath


def create_baked_material(name, images):
    """Create a new material using the baked textures."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # Create output and BSDF
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    # Add UV map node (use the bake UV)
    uv_node = nodes.new('ShaderNodeUVMap')
    uv_node.uv_map = "BakeUV"
    uv_node.location = (-800, 0)
    
    y_offset = 300
    x_offset = -400
    
    # Connect textures
    if "diffuse" in images:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = images["diffuse"]
        tex.location = (x_offset, y_offset)
        links.new(uv_node.outputs['UV'], tex.inputs['Vector'])
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        y_offset -= 300
    
    if "roughness" in images:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = images["roughness"]
        tex.image.colorspace_settings.name = 'Non-Color'
        tex.location = (x_offset, y_offset)
        links.new(uv_node.outputs['UV'], tex.inputs['Vector'])
        links.new(tex.outputs['Color'], bsdf.inputs['Roughness'])
        y_offset -= 300
    
    if "metallic" in images:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = images["metallic"]
        tex.image.colorspace_settings.name = 'Non-Color'
        tex.location = (x_offset, y_offset)
        links.new(uv_node.outputs['UV'], tex.inputs['Vector'])
        links.new(tex.outputs['Color'], bsdf.inputs['Metallic'])
        y_offset -= 300
    
    if "normal" in images:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = images["normal"]
        tex.image.colorspace_settings.name = 'Non-Color'
        tex.location = (x_offset, y_offset)
        
        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (x_offset + 300, y_offset)
        
        links.new(uv_node.outputs['UV'], tex.inputs['Vector'])
        links.new(tex.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
        y_offset -= 300
    
    if "emission" in images:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = images["emission"]
        tex.location = (x_offset, y_offset)
        links.new(uv_node.outputs['UV'], tex.inputs['Vector'])
        # Blender 4.0+/5.0 uses 'Emission Color'
        emission_input = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        if emission_input:
            links.new(tex.outputs['Color'], emission_input)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    
    return mat


def center_object(obj):
    """Center object at origin with bottom at Z=0."""
    # Get bounding box in world space
    bbox_corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    
    # Calculate center
    min_coord = mathutils.Vector((
        min(c.x for c in bbox_corners),
        min(c.y for c in bbox_corners),
        min(c.z for c in bbox_corners)
    ))
    max_coord = mathutils.Vector((
        max(c.x for c in bbox_corners),
        max(c.y for c in bbox_corners),
        max(c.z for c in bbox_corners)
    ))
    
    center = (min_coord + max_coord) / 2
    
    # Move to center, bottom at Z=0
    obj.location.x -= center.x
    obj.location.y -= center.y
    obj.location.z -= min_coord.z


def export_glb(filepath, obj):
    """Export object to GLB with compressed textures."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=filepath,
        use_selection=True,
        export_format='GLB',
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='JPEG',
        export_image_quality=GLB_IMAGE_QUALITY,
    )


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    print("\n" + "=" * 60)
    print("BAKE MODEL TEXTURES AND EXPORT GLB")
    print("=" * 60 + "\n")
    
    # Get selected objects
    original_objects = get_selected_objects()
    
    if not original_objects:
        print("ERROR: No mesh objects selected!")
        print("Please select one or more mesh objects and run the script again.")
        return
    
    print(f"Selected objects: {[obj.name for obj in original_objects]}")
    
    # Get model name
    model_name = sanitize_filename(get_model_name(original_objects))
    print(f"Model name: {model_name}")
    
    # Setup paths
    textures_folder = ensure_directory(
        os.path.join(TEXTURES_BASE_PATH, f"{model_name}_baked_textures")
    )
    glb_folder = ensure_directory(GLB_OUTPUT_PATH)
    glb_path = os.path.join(glb_folder, f"{model_name}_baked.glb")
    
    print(f"\nTextures will be saved to: {textures_folder}")
    print(f"GLB will be saved to: {glb_path}")
    
    # Step 1: Duplicate objects (to preserve originals)
    print("\n[1/8] Duplicating objects...")
    work_objects = duplicate_objects(original_objects)
    print(f"      Created {len(work_objects)} duplicate(s)")
    
    # Hide originals
    for obj in original_objects:
        obj.hide_set(True)
    
    # Step 2: Apply transforms
    print("\n[2/8] Applying transforms...")
    apply_transforms(work_objects)
    
    # Step 3: Join meshes (critical for unified UV layout!)
    print("\n[3/8] Joining meshes...")
    joined_obj = join_meshes(work_objects)
    print(f"      Joined into: {joined_obj.name}")
    
    # Record original UV map name before creating BakeUV
    original_uv_name = get_original_uv_name(joined_obj)
    if original_uv_name:
        print(f"      Original UV map: '{original_uv_name}'")
    else:
        print("      WARNING: No existing UV map found on joined object")

    # Step 4: Create bake UV map
    print("\n[4/8] Creating bake UV map (Smart UV Project)...")
    create_bake_uv_map(joined_obj, "BakeUV")
    print("      UV map created: BakeUV")

    # Fix source texture UV references so they sample from original UV,
    # not the now-active BakeUV
    print("      Fixing texture UV references...")
    fix_texture_uv_references(joined_obj, original_uv_name)

    # Step 5: Setup Cycles
    print("\n[5/8] Setting up Cycles renderer...")
    setup_cycles()
    
    # Step 6: Create bake images and bake
    print("\n[6/8] Baking textures...")
    images = {}
    
    # Prepare emissive materials
    if BAKE_MAPS.get('emission'):
        print("      Preparing emissive materials...")
        prepare_emissive_for_bake(joined_obj)
    
    if BAKE_MAPS.get('diffuse'):
        print("      Baking diffuse...")
        images["diffuse"] = create_bake_image("Bake_Diffuse", BAKE_RESOLUTION, is_data=False)
        bake_channel(joined_obj, images["diffuse"], 'DIFFUSE', pass_filter={'COLOR'})
    
    if BAKE_MAPS.get('roughness'):
        print("      Baking roughness...")
        images["roughness"] = create_bake_image("Bake_Roughness", BAKE_RESOLUTION, is_data=True)
        bake_channel(joined_obj, images["roughness"], 'ROUGHNESS')
    
    if BAKE_MAPS.get('metallic'):
        print("      Baking metallic...")
        images["metallic"] = create_bake_image("Bake_Metallic", BAKE_RESOLUTION, is_data=True)
        bake_channel(joined_obj, images["metallic"], 'GLOSSY', pass_filter={'COLOR'})
    
    if BAKE_MAPS.get('normal'):
        print("      Baking normals...")
        images["normal"] = create_bake_image("Bake_Normal", BAKE_RESOLUTION, is_data=True)
        bake_channel(joined_obj, images["normal"], 'NORMAL')
    
    if BAKE_MAPS.get('emission'):
        print("      Baking emission...")
        images["emission"] = create_bake_image("Bake_Emission", BAKE_RESOLUTION, is_data=False)
        bake_channel(joined_obj, images["emission"], 'EMIT')
    
    # Step 7: Save images and create baked material
    print("\n[7/8] Saving textures and creating baked material...")
    
    for channel, image in images.items():
        filepath = os.path.join(textures_folder, f"{model_name}_{channel}.png")
        saved_path = save_image(image, filepath, channel_name=channel)
        print(f"      Saved: {saved_path}")
    
    # Create and assign baked material
    baked_mat = create_baked_material(f"{model_name}_baked", images)
    joined_obj.data.materials.clear()
    joined_obj.data.materials.append(baked_mat)
    print(f"      Created material: {baked_mat.name}")
    
    # Step 8: Center and export
    print("\n[8/8] Centering and exporting GLB...")
    center_object(joined_obj)
    export_glb(glb_path, joined_obj)
    print(f"      Exported: {glb_path}")
    
    # Cleanup: Delete the working object
    bpy.data.objects.remove(joined_obj, do_unlink=True)
    
    # Show originals again
    for obj in original_objects:
        obj.hide_set(False)
    
    # Reselect originals
    bpy.ops.object.select_all(action='DESELECT')
    for obj in original_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = original_objects[0]
    
    print("\n" + "=" * 60)
    print("BAKING COMPLETE!")
    print("=" * 60)
    print(f"\nTextures saved to: {textures_folder}")
    print(f"GLB saved to: {glb_path}")
    print("\nOriginal objects have been restored.")
    print("")


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    main()
