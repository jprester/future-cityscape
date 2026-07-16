"""Generate a low-poly commercial building from an atlas-region specification.

Run through `npm run generate:commercial-pilot`, or invoke Blender directly:

  blender --background --factory-startup \
    --python tools/blender/generate_commercial_building.py -- \
    --spec spec.json --atlas diffuse.png --regions regions.json \
    --output-dir output
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


FACE_ORDER = ("front", "right", "back", "left", "top", "bottom")


def parse_args() -> argparse.Namespace:
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--atlas", required=True, type=Path)
    parser.add_argument("--emissive", required=True, type=Path)
    parser.add_argument("--roughness", required=True, type=Path)
    parser.add_argument("--normal", required=True, type=Path)
    parser.add_argument("--regions", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--geometry-only",
        action="store_true",
        help="Export UV-mapped geometry without embedding the shared atlas material",
    )
    return parser.parse_args(sys.argv[separator + 1 :])


def load_json(filename: Path) -> dict:
    with filename.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_box_dimensions(definition: dict, spec: dict) -> tuple[float, float, float, float]:
    facade = spec.get("facade")
    if "floors" in definition:
        if not facade:
            raise ValueError(f"{definition['name']} uses floors without a facade config")
        width, depth = definition.get("footprint", definition.get("size", []))[:2]
        floor_height = facade["floorHeight"]
        height = definition["floors"] * floor_height
        bottom = definition.get("bottomFloor", 0) * floor_height
        return width, depth, height, bottom

    width, depth, height = definition["size"]
    if "bottomFloor" in definition:
        if not facade:
            raise ValueError(
                f"{definition['name']} uses bottomFloor without a facade config"
            )
        bottom = definition["bottomFloor"] * facade["floorHeight"]
    else:
        bottom = definition["bottom"]
    return width, depth, height, bottom


def regions_for_definition(definition: dict, spec: dict) -> dict[str, str]:
    if "regions" in definition:
        return definition["regions"]
    facade = spec.get("facade")
    if not facade:
        raise ValueError(f"{definition['name']} has no explicit or primary facade")
    primary = facade["region"]
    return {
        "front": primary,
        "right": primary,
        "back": primary,
        "left": primary,
        "top": definition.get("roofRegion", "roof_dark_metal"),
    }


def add_quad(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    corners: tuple[
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
    ],
    mapping: dict,
) -> None:
    offset = len(vertices)
    vertices.extend(corners)
    faces.append((offset, offset + 1, offset + 2, offset + 3))
    face_mappings.append(mapping)


def roof_segments(length: float, tile_size: float) -> list[float]:
    count = max(1, math.ceil(length / tile_size))
    segment = length / count
    return [segment] * count


def add_roof_grid(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    definition: dict,
    spec: dict,
    width: float,
    depth: float,
    top: float,
    roof_region: str,
) -> None:
    roof = spec["roof"]
    tile_size = roof.get("tileSize", 8.0)
    tile_regions = roof.get("tiles", {}).get(roof_region, [roof_region])
    center_x, center_y = definition.get("center", [0, 0])
    x_segments = roof_segments(width, tile_size)
    y_segments = roof_segments(depth, tile_size)
    x0 = center_x - width / 2
    y0 = center_y - depth / 2

    y = y0
    for row, cell_depth in enumerate(y_segments):
        x = x0
        for column, cell_width in enumerate(x_segments):
            tile_index = (row * 3 + column * 5 + len(definition["name"])) % len(
                tile_regions
            )
            add_quad(
                vertices,
                faces,
                face_mappings,
                (
                    (x, y, top),
                    (x + cell_width, y, top),
                    (x + cell_width, y + cell_depth, top),
                    (x, y + cell_depth, top),
                ),
                {
                    "region": tile_regions[tile_index],
                    "face": "top",
                    "width": cell_width,
                    "depth": cell_depth,
                    "uvMode": "roofTile",
                    "tileSize": tile_size,
                },
            )
            x += cell_width
        y += cell_depth


def add_parapet(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    definition: dict,
    spec: dict,
    width: float,
    depth: float,
    top: float,
) -> None:
    parapet = spec["roof"].get("parapet")
    if not parapet:
        return
    parapet_width = min(parapet.get("width", 0.55), width / 4, depth / 4)
    parapet_height = parapet.get("height", 0.9)
    side_region = parapet.get("sideRegion", "hvac_louver_wide")
    cap_region = parapet.get("capRegion", "roof_metal_tile_a")
    center_x, center_y = definition.get("center", [0, 0])
    definitions = (
        ("north", [center_x, center_y + depth / 2 - parapet_width / 2], [width, parapet_width, parapet_height]),
        ("south", [center_x, center_y - depth / 2 + parapet_width / 2], [width, parapet_width, parapet_height]),
        ("east", [center_x + width / 2 - parapet_width / 2, center_y], [parapet_width, depth - 2 * parapet_width, parapet_height]),
        ("west", [center_x - width / 2 + parapet_width / 2, center_y], [parapet_width, depth - 2 * parapet_width, parapet_height]),
    )
    for suffix, center, size in definitions:
        add_box(
            vertices,
            faces,
            face_mappings,
            {
                "name": f"{definition['name']}_parapet_{suffix}",
                "center": center,
                "size": size,
                "bottom": top,
                "fitAspect": True,
                "regions": {
                    "front": side_region,
                    "right": side_region,
                    "back": side_region,
                    "left": side_region,
                    "top": cap_region,
                },
            },
            spec,
            role="prop",
        )


def add_box(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    definition: dict,
    spec: dict,
    role: str = "prop",
) -> None:
    center_x, center_y = definition.get("center", [0, 0])
    width, depth, height, bottom = resolve_box_dimensions(definition, spec)
    top = bottom + height
    x0, x1 = center_x - width / 2, center_x + width / 2
    y0, y1 = center_y - depth / 2, center_y + depth / 2
    offset = len(vertices)

    vertices.extend(
        [
            (x0, y0, bottom),
            (x1, y0, bottom),
            (x1, y1, bottom),
            (x0, y1, bottom),
            (x0, y0, top),
            (x1, y0, top),
            (x1, y1, top),
            (x0, y1, top),
        ]
    )
    side_faces = [
        (offset + 0, offset + 1, offset + 5, offset + 4),
        (offset + 1, offset + 2, offset + 6, offset + 5),
        (offset + 2, offset + 3, offset + 7, offset + 6),
        (offset + 3, offset + 0, offset + 4, offset + 7),
    ]
    faces.extend(side_faces)

    regions = regions_for_definition(definition, spec)
    bottom_region = regions.get("bottom", regions["top"])
    floor_mapping = {
        "floors": definition.get("floors"),
        "bottomFloor": definition.get("bottomFloor", 0),
        "sourceFloorStart": definition.get("sourceFloorStart"),
        "height": height,
        "fitAspect": definition.get("fitAspect", role == "prop"),
    }
    face_mappings.extend(
        [
            {"region": regions["front"], "face": "front", "width": width, **floor_mapping},
            {"region": regions["right"], "face": "right", "width": depth, **floor_mapping},
            {"region": regions["back"], "face": "back", "width": width, **floor_mapping},
            {"region": regions["left"], "face": "left", "width": depth, **floor_mapping},
        ]
    )
    if role == "mass" and spec.get("roof"):
        faces.append((offset + 3, offset + 2, offset + 1, offset + 0))
        face_mappings.append({"region": bottom_region, "face": "bottom"})
        add_roof_grid(
            vertices,
            faces,
            face_mappings,
            definition,
            spec,
            width,
            depth,
            top,
            regions["top"],
        )
        add_parapet(
            vertices, faces, face_mappings, definition, spec, width, depth, top
        )
    else:
        faces.extend(
            [
                (offset + 4, offset + 5, offset + 6, offset + 7),
                (offset + 3, offset + 2, offset + 1, offset + 0),
            ]
        )
        face_mappings.extend(
            [
                {
                    "region": regions["top"],
                    "face": "top",
                    "width": width,
                    "depth": depth,
                    "fitAspect": definition.get(
                        "topFitAspect",
                        definition.get("fitAspect", role == "prop")
                        and regions["top"] != "hvac_fan_quad",
                    ),
                },
                {"region": bottom_region, "face": "bottom"},
            ]
        )


def resolve_beacon_base(beacon: dict, spec: dict) -> float:
    if "bottom" in beacon:
        return beacon["bottom"]
    floor_height = spec.get("facade", {}).get("floorHeight")
    if floor_height is None or "bottomFloor" not in beacon:
        raise ValueError(
            f"{beacon['name']} requires bottom or bottomFloor with a facade config"
        )
    return beacon["bottomFloor"] * floor_height + beacon.get("baseOffset", 0)


def add_octahedron(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    center: tuple[float, float, float],
    radius: float,
    region: str,
) -> None:
    center_x, center_y, center_z = center
    offset = len(vertices)
    vertices.extend(
        [
            (center_x, center_y, center_z - radius),
            (center_x, center_y, center_z + radius),
            (center_x + radius, center_y, center_z),
            (center_x, center_y + radius, center_z),
            (center_x - radius, center_y, center_z),
            (center_x, center_y - radius, center_z),
        ]
    )
    cap_faces = [
        (offset + 0, offset + 2, offset + 3),
        (offset + 0, offset + 3, offset + 4),
        (offset + 0, offset + 4, offset + 5),
        (offset + 0, offset + 5, offset + 2),
        (offset + 1, offset + 3, offset + 2),
        (offset + 1, offset + 4, offset + 3),
        (offset + 1, offset + 5, offset + 4),
        (offset + 1, offset + 2, offset + 5),
    ]
    faces.extend(cap_faces)
    face_mappings.extend(
        {"region": region, "face": "beacon"} for _ in cap_faces
    )


def add_beacon(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    face_mappings: list[dict],
    beacon: dict,
    spec: dict,
) -> None:
    center_x, center_y = beacon.get("center", [0, 0])
    bottom = resolve_beacon_base(beacon, spec)
    rod_height = beacon.get("rodHeight", 1.8)
    rod_width = beacon.get("rodWidth", 0.12)
    cap_radius = beacon.get("capRadius", 0.28)
    rod_region = beacon.get("rodRegion", "beacon_rod_dark")
    cap_region = beacon.get("capRegion", "beacon_red")
    add_box(
        vertices,
        faces,
        face_mappings,
        {
            "name": f"{beacon['name']}_rod",
            "center": [center_x, center_y],
            "size": [rod_width, rod_width, rod_height],
            "bottom": bottom,
            "fitAspect": False,
            "regions": {
                "front": rod_region,
                "right": rod_region,
                "back": rod_region,
                "left": rod_region,
                "top": rod_region,
            },
        },
        spec,
        role="prop",
    )
    add_octahedron(
        vertices,
        faces,
        face_mappings,
        (center_x, center_y, bottom + rod_height + cap_radius),
        cap_radius,
        cap_region,
    )


def floor_aware_uv(
    region: dict,
    mapping: dict,
    facade: dict,
) -> dict[str, float]:
    facade_grid = region.get("facadeGrid", {})
    row_boundaries = facade_grid.get("rowBoundaries")
    column_boundaries = facade_grid.get("columnBoundaries")
    source_floors = (
        len(row_boundaries) - 1
        if row_boundaries
        else facade_grid.get("floors")
    )
    floors = mapping.get("floors")
    if not source_floors or not floors:
        return region["uv"]
    if floors > source_floors:
        raise ValueError(
            f"{mapping['face']} face requests {floors} floors from a "
            f"{source_floors}-floor atlas region"
        )

    floor_height = facade["floorHeight"]
    region_aspect = region["pixel"]["width"] / region["pixel"]["height"]
    source_height = source_floors * floor_height
    source_width = source_height * region_aspect
    width_fraction = mapping["width"] / source_width
    if not column_boundaries and width_fraction > 1.001:
        raise ValueError(
            f"{mapping['face']} face width {mapping['width']:.2f} exceeds "
            f"the facade region's {source_width:.2f}-unit coverage"
        )
    width_fraction = min(width_fraction, 1.0)

    horizontal_anchor = facade.get("horizontalAnchor", 0.5)
    if column_boundaries:
        available_bays = len(column_boundaries) - 1
        bay_width = facade.get("bayWidth", source_width / available_bays)
        requested_bays = max(1, round(mapping["width"] / bay_width))
        if requested_bays > available_bays:
            raise ValueError(
                f"{mapping['face']} face requests {requested_bays} facade bays "
                f"but only {available_bays} complete bays are available"
            )
        bay_start = round((available_bays - requested_bays) * horizontal_anchor)
        horizontal_start = column_boundaries[bay_start]
        horizontal_end = column_boundaries[bay_start + requested_bays]
    else:
        horizontal_start = (1.0 - width_fraction) * horizontal_anchor
        horizontal_end = horizontal_start + width_fraction
    requested_start = mapping.get("sourceFloorStart")
    if requested_start is None:
        requested_start = mapping.get("bottomFloor", 0) % source_floors
    vertical_start = min(requested_start, source_floors - floors)
    if row_boundaries:
        vertical_start_fraction = row_boundaries[vertical_start]
        vertical_end_fraction = row_boundaries[vertical_start + floors]
    else:
        vertical_start_fraction = vertical_start / source_floors
        vertical_end_fraction = (vertical_start + floors) / source_floors

    source_uv = region["uv"]
    source_u_width = source_uv["u1"] - source_uv["u0"]
    source_v_height = source_uv["v1"] - source_uv["v0"]
    return {
        "u0": source_uv["u0"] + source_u_width * horizontal_start,
        "u1": source_uv["u0"] + source_u_width * horizontal_end,
        "v0": source_uv["v0"]
        + source_v_height * vertical_start_fraction,
        "v1": source_uv["v0"]
        + source_v_height * vertical_end_fraction,
    }


def cropped_uv(
    region: dict,
    u_fraction: float,
    v_fraction: float,
) -> dict[str, float]:
    source_uv = region["uv"]
    u_fraction = max(0.001, min(u_fraction, 1.0))
    v_fraction = max(0.001, min(v_fraction, 1.0))
    u_margin = (1.0 - u_fraction) / 2
    v_margin = (1.0 - v_fraction) / 2
    width = source_uv["u1"] - source_uv["u0"]
    height = source_uv["v1"] - source_uv["v0"]
    return {
        "u0": source_uv["u0"] + width * u_margin,
        "u1": source_uv["u1"] - width * u_margin,
        "v0": source_uv["v0"] + height * v_margin,
        "v1": source_uv["v1"] - height * v_margin,
    }


def aspect_fit_uv(region: dict, mapping: dict) -> dict[str, float]:
    face_width = mapping.get("width")
    face_height = mapping.get("depth", mapping.get("height"))
    if not face_width or not face_height:
        return region["uv"]
    face_aspect = face_width / face_height
    region_aspect = region["pixel"]["width"] / region["pixel"]["height"]
    if face_aspect >= region_aspect:
        return cropped_uv(region, 1.0, region_aspect / face_aspect)
    return cropped_uv(region, face_aspect / region_aspect, 1.0)


def roof_tile_uv(region: dict, mapping: dict) -> dict[str, float]:
    face_width = mapping["width"]
    face_depth = mapping["depth"]
    tile_size = mapping["tileSize"]
    face_aspect = face_width / face_depth
    region_aspect = region["pixel"]["width"] / region["pixel"]["height"]
    if face_aspect >= region_aspect:
        u_fraction, v_fraction = 1.0, region_aspect / face_aspect
    else:
        u_fraction, v_fraction = face_aspect / region_aspect, 1.0
    scale = min(max(face_width, face_depth) / tile_size, 1.0)
    return cropped_uv(region, u_fraction * scale, v_fraction * scale)


def load_texture(path: Path, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path.resolve()), check_existing=True)
    image.colorspace_settings.name = color_space
    return image


def texture_node(
    nodes: bpy.types.Nodes,
    image: bpy.types.Image,
    location: tuple[int, int],
) -> bpy.types.ShaderNodeTexImage:
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    node.interpolation = "Linear"
    node.extension = "CLIP"
    node.location = location
    return node


def create_atlas_material(
    spec: dict,
    texture_paths: dict[str, Path],
) -> tuple[bpy.types.Material, dict[str, bpy.types.Image]]:
    material_spec = spec["material"]
    material = bpy.data.materials.new(material_spec["name"])
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (460, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (120, 0)
    shader.inputs["Roughness"].default_value = material_spec["roughness"]
    shader.inputs["Metallic"].default_value = material_spec["metallic"]

    images = {
        "diffuse": load_texture(texture_paths["diffuse"], "sRGB"),
        "emissive": load_texture(texture_paths["emissive"], "sRGB"),
        "roughness": load_texture(texture_paths["roughness"], "Non-Color"),
        "normal": load_texture(texture_paths["normal"], "Non-Color"),
    }
    diffuse_texture = texture_node(nodes, images["diffuse"], (-360, 180))
    emissive_texture = texture_node(nodes, images["emissive"], (-360, -20))
    roughness_texture = texture_node(nodes, images["roughness"], (-360, -220))
    normal_texture = texture_node(nodes, images["normal"], (-560, -430))
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (-120, -410)
    normal_map.inputs["Strength"].default_value = material_spec["normalStrength"]

    material.node_tree.links.new(
        diffuse_texture.outputs["Color"], shader.inputs["Base Color"]
    )
    material.node_tree.links.new(
        roughness_texture.outputs["Color"], shader.inputs["Roughness"]
    )
    emission_input = shader.inputs.get("Emission Color") or shader.inputs.get(
        "Emission"
    )
    material.node_tree.links.new(emissive_texture.outputs["Color"], emission_input)
    shader.inputs["Emission Strength"].default_value = material_spec[
        "emissiveStrength"
    ]
    material.node_tree.links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    material.node_tree.links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material, images


def create_building(
    spec: dict,
    region_manifest: dict,
    material: bpy.types.Material,
) -> tuple[bpy.types.Object, list[str]]:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    face_mappings: list[dict] = []
    for definition in spec["masses"]:
        add_box(vertices, faces, face_mappings, definition, spec, role="mass")
    for definition in spec.get("props", []):
        add_box(vertices, faces, face_mappings, definition, spec, role="prop")
    for beacon in spec.get("beacons", []):
        add_beacon(vertices, faces, face_mappings, beacon, spec)

    used_regions = sorted({mapping["region"] for mapping in face_mappings})
    missing = sorted(set(used_regions) - set(region_manifest["regions"]))
    if missing:
        raise ValueError(f"Unknown atlas regions: {', '.join(missing)}")

    mesh = bpy.data.meshes.new(f"{spec['name']}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.validate(verbose=True)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    primary_facade = spec.get("facade", {}).get("region")
    for polygon, mapping in zip(mesh.polygons, face_mappings, strict=True):
        region = region_manifest["regions"][mapping["region"]]
        if mapping["region"] == primary_facade and mapping["face"] in {
            "front",
            "right",
            "back",
            "left",
        }:
            uv = floor_aware_uv(region, mapping, spec["facade"])
        elif mapping.get("uvMode") == "roofTile":
            uv = roof_tile_uv(region, mapping)
        elif mapping.get("fitAspect"):
            uv = aspect_fit_uv(region, mapping)
        else:
            uv = region["uv"]
        if len(polygon.loop_indices) == 3:
            corners = (
                (uv["u0"], uv["v0"]),
                (uv["u1"], uv["v0"]),
                ((uv["u0"] + uv["u1"]) / 2, uv["v1"]),
            )
        else:
            corners = (
                (uv["u0"], uv["v0"]),
                (uv["u1"], uv["v0"]),
                (uv["u1"], uv["v1"]),
                (uv["u0"], uv["v1"]),
            )
        for loop_index, coordinates in zip(polygon.loop_indices, corners, strict=True):
            uv_layer.data[loop_index].uv = coordinates

    building = bpy.data.objects.new(spec["name"], mesh)
    bpy.context.scene.collection.objects.link(building)
    building["asset_family"] = "commercial_v1"
    building["atlas"] = "commercial-atlas-v1"
    building["base_centered"] = True
    if spec.get("facade"):
        building["primary_facade"] = spec["facade"]["region"]
        building["floor_height"] = spec["facade"]["floorHeight"]
    return building, used_regions


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_preview_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    return material


def setup_preview(spec: dict, output_path: Path, roof_output_path: Path) -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    resolution = spec["preview"].get("resolution", 900)
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output_path)
    scene.render.film_transparent = False

    world = bpy.data.worlds.new("Commercial Pilot World")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.003, 0.006, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.35
    scene.world = world

    camera_data = bpy.data.cameras.new("Preview Camera")
    camera = bpy.data.objects.new("Preview Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = spec["preview"]["camera"]
    camera_data.lens = 58
    look_at(camera, tuple(spec["preview"]["target"]))
    scene.camera = camera

    for name, location, color, energy, size in (
        ("Key", (85, -110, 225), (0.52, 0.72, 1.0), 85000, 90),
        ("Fill", (-105, -25, 115), (0.08, 0.42, 1.0), 52000, 75),
        ("Rim", (75, 80, 190), (1.0, 0.12, 0.55), 56000, 65),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.color = color
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        light.location = location
        look_at(light, (0, 0, 85))
        scene.collection.objects.link(light)

    sun_data = bpy.data.lights.new("Architectural Sun", "SUN")
    sun_data.color = (0.62, 0.78, 1.0)
    sun_data.energy = 2.2
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("Architectural Sun", sun_data)
    sun.rotation_euler = (math.radians(28), 0, math.radians(-32))
    scene.collection.objects.link(sun)

    bpy.ops.mesh.primitive_plane_add(size=360, location=(0, 0, -0.05))
    ground = bpy.context.object
    ground.name = "Preview Ground"
    ground.data.materials.append(
        create_preview_material("Preview Ground", (0.012, 0.02, 0.03, 1.0), 0.72)
    )

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    bpy.ops.render.render(write_still=True)

    roof_camera = spec["preview"].get("roofCamera")
    if roof_camera:
        camera.location = roof_camera["camera"]
        look_at(camera, tuple(roof_camera["target"]))
        scene.render.filepath = str(roof_output_path)
        bpy.ops.render.render(write_still=True)


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh_bounds(obj: bpy.types.Object) -> dict:
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    minimum = [min(vertex[axis] for vertex in vertices) for axis in range(3)]
    maximum = [max(vertex[axis] for vertex in vertices) for axis in range(3)]
    return {
        "min": minimum,
        "max": maximum,
        "dimensions": [maximum[axis] - minimum[axis] for axis in range(3)],
    }


def main() -> None:
    args = parse_args()
    spec = load_json(args.spec)
    regions = load_json(args.regions)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    texture_paths = {
        "diffuse": args.atlas,
        "emissive": args.emissive,
        "roughness": args.roughness,
        "normal": args.normal,
    }
    material, images = create_atlas_material(spec, texture_paths)
    building, used_regions = create_building(spec, regions, material)

    glb_path = args.output_dir / f"{spec['name']}.glb"
    preview_path = args.output_dir / f"{spec['name']}-preview.png"
    roof_preview_path = args.output_dir / f"{spec['name']}-roof-preview.png"
    blend_path = args.output_dir / f"{spec['name']}.blend"
    report_path = args.output_dir / f"{spec['name']}-report.json"

    select_only(building)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        use_selection=True,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="NONE" if args.geometry_only else "EXPORT",
        export_image_format="JPEG",
        export_image_quality=85,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )

    setup_preview(spec, preview_path, roof_preview_path)
    for map_name, image in images.items():
        image.filepath = f"//../atlas/{texture_paths[map_name].name}"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    bounds = mesh_bounds(building)
    report = {
        "name": spec["name"],
        "bounds": bounds,
        "baseCentered": math.isclose(bounds["min"][2], 0.0, abs_tol=1e-6),
        "vertices": len(building.data.vertices),
        "polygons": len(building.data.polygons),
        "triangles": sum(len(polygon.vertices) - 2 for polygon in building.data.polygons),
        "uvLayers": len(building.data.uv_layers),
        "materials": len(building.data.materials),
        "geometryOnly": args.geometry_only,
        "facade": spec.get("facade"),
        "beacons": spec.get("beacons", []),
        "textureMaps": {
            map_name: str(texture_path)
            for map_name, texture_path in texture_paths.items()
        },
        "atlasRegions": used_regions,
        "outputs": {
            "blend": str(blend_path),
            "glb": str(glb_path),
            "preview": str(preview_path),
            "roofPreview": str(roof_preview_path),
        },
    }
    report_path.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
