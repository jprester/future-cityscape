"""
Blender Script: Export Selected Object as Centered GLB
=======================================================

Usage:
1. Select the object you want to export
2. Open this script in Blender's Text Editor
3. Run the script (Alt+P or click "Run Script")

The script will:
- Move the object to center (0,0,0) with bottom at Z=0
- Export as GLB to blender/render-outputs folder
- Restore object to its original position

Requirements:
- Blender 4.0+ / 5.0
"""

import bpy
import os
import mathutils
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

HOME_DIR = str(Path.home())
GLB_OUTPUT_PATH = os.path.join(HOME_DIR, "Projects/3d-modeling/blender/render-outputs")

# GLB export settings
GLB_IMAGE_QUALITY = 75


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_selected_object():
    """Get the active selected mesh object."""
    obj = bpy.context.active_object
    if obj and obj.type == 'MESH':
        return obj

    # Fall back to first selected mesh
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            return obj

    return None


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


def get_object_center_offset(obj):
    """
    Calculate offset to center object at origin with bottom at Z=0.
    Returns the offset vector that was applied.
    """
    # Get bounding box in world space
    bbox_corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]

    # Calculate bounds
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

    # Offset to center XY, and place bottom at Z=0
    offset = mathutils.Vector((
        -center.x,
        -center.y,
        -min_coord.z
    ))

    return offset


def export_glb(filepath, obj):
    """Export object to GLB."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

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
    print("EXPORT CENTERED GLB")
    print("=" * 60 + "\n")

    # Get selected object
    obj = get_selected_object()

    if not obj:
        print("ERROR: No mesh object selected!")
        print("Please select a mesh object and run the script again.")
        return

    print(f"Selected object: {obj.name}")

    # Setup paths
    model_name = sanitize_filename(obj.name)
    glb_folder = ensure_directory(GLB_OUTPUT_PATH)
    glb_path = os.path.join(glb_folder, f"{model_name}.glb")

    print(f"Output path: {glb_path}")

    # Store original location
    original_location = obj.location.copy()
    print(f"\nOriginal location: {original_location}")

    # Calculate and apply centering offset
    offset = get_object_center_offset(obj)
    obj.location += offset
    print(f"Centered at origin (offset: {offset})")

    # Export GLB
    print("\nExporting GLB...")
    export_glb(glb_path, obj)
    print(f"Exported: {glb_path}")

    # Restore original location
    obj.location = original_location
    print(f"\nRestored to original location: {original_location}")

    # Reselect the object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    print("\n" + "=" * 60)
    print("EXPORT COMPLETE!")
    print("=" * 60)
    print(f"\nGLB saved to: {glb_path}")
    print("")


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    main()
