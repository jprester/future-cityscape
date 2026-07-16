# Commercial building atlas v1

This directory contains the editable source artwork for the commercial building
family. The generated atlas is intentionally kept outside `public/` until its UV
layout and material maps have been validated on a pilot building.

## Rebuild the diffuse atlas

ImageMagick must provide the `magick` command. Then run:

```sh
npm run build:commercial-atlas
```

This packs the eight facade sources and the ancillary roof, mechanical, and trim
sources into `atlas/commercial-atlas-v1-diffuse.png`. It also writes
`atlas/regions.json` with top-left pixel rectangles and Blender-compatible,
bottom-left normalized UV bounds.

Build the pixel-aligned emissive, roughness, and tangent-space normal maps with:

```sh
npm run build:commercial-pbr
```

These maps are derived deterministically from the diffuse atlas. Facade and trim
regions receive color/lightness-based emission masks, roughness ranges are chosen
by region type, and the normal map is generated from softened luminance gradients.
Independent image generation is intentionally not used for PBR maps because it
would shift architectural details between channels.

Every exposed UV region is inset by 16 pixels from its packing cell. The unused
edge pixels act as mip padding and reduce bleeding between neighbouring atlas
regions.

## Generate the Blender pilot

Run:

```sh
npm run generate:commercial-pilot
```

The command uses `BLENDER_PATH`, a `blender` executable on `PATH`, or the default
macOS Blender application path. It reads `specs/commercial-pilot-01.json`, builds
one merged low-poly mesh with explicit per-face atlas UVs, and writes the `.blend`,
`.glb`, preview render, and validation report to `pilot/`.

The pilot material consumes all four aligned atlas maps. Build the diffuse atlas
and PBR maps before regenerating the pilot.

Inspect the exported GLB metadata with:

```sh
npm run inspect:commercial-pilot
```

Generate the three coherent production candidates with:

```sh
npm run generate:commercial-variants
```

Production specs declare one primary facade, a physical floor height, and each
mass's floor count. The Blender generator takes proportional horizontal and
vertical slices from the primary facade region instead of stretching the entire
texture over every face. This preserves window scale across fronts, sides,
podiums, and setbacks. It rejects faces that exceed a facade region's physical
coverage rather than silently distorting them.

Production roofs use curated atlas subregions rather than stretching a complete
mechanical sheet over each top face. Roof decks are divided into fixed-scale
modules, HVAC tops/sides use dedicated fan, louver, and access-panel crops, and
each building mass receives a shallow generated parapet. Each production run
also writes a `*-roof-preview.png` diagnostic render for roof-level art review.
Static rooftop obstruction beacons are generated from declarative spec entries:
dark low-poly rods and red octahedral caps share the main atlas material, with
the caps mapped to a dedicated emissive swatch.

## Source layout

- `concepts/` contains the approved facade contact sheet.
- `reference-crops/` contains the eight contact-sheet panels used as generation
  references.
- `facades/` contains the full-resolution facade sources.
- `mechanical/` contains roof, HVAC, service, and illuminated trim sources.
- `atlas/` contains deterministic generated output.
- `specs/` contains declarative building definitions consumed by Blender.
- `pilot/` contains the generated Blender/GLB validation asset.
- `production/` contains generated coherent building candidates for art review.
- `PROMPTS.md` records the built-in GPT Image prompt templates and per-image
  subjects used to create the source artwork.
