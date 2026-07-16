# Commercial atlas v1 image-generation prompts

The source artwork was generated with Codex's built-in GPT Image workflow. The
existing diffuse atlas embedded in `2026-commercial-building-10.glb` was used as
a style reference, not as an edit target.

## Facade sources

Common prompt:

```text
Use case: stylized-concept
Asset type: production diffuse/albedo source panel for a modular commercial
high-rise texture atlas used in Blender and Three.js
Input images: the contact-sheet crop is the primary approved design reference;
the existing wide atlas is a secondary material and rendering-language reference
Primary request: regenerate the approved facade as one clean, dedicated,
high-resolution wall texture while preserving its architectural identity
Style/medium: realistic near-future cyberpunk PBR diffuse/albedo texture source,
professional game-asset quality, detailed glass, painted metal, concrete, frames,
mullions, and believable occupied windows
Composition/framing: one vertical 2:3 facade panel filling the entire canvas,
perfectly orthographic straight-on elevation, approximately 16 to 24 clearly
readable floors, parallel straight vertical and horizontal lines, edge-to-edge
texture
Lighting/mood: neutral flat material presentation; readable dark blue-gray
surfaces; scattered warm and cool windows; no environmental scene lighting
Constraints: no perspective, vanishing point, complete 3D building, roof
silhouette, sky, street, ground, people, vehicles, text, logos, labels, watermark,
bloom, fog, cast shadows, dramatic highlights, strong baked reflections, border,
or gutter
Avoid: warped windows, leaning lines, ornamental fantasy motifs, excessive neon,
crushed black detail, large blank areas, close-up floor detail
```

Per-image subjects:

- `facade-01`: dense blue-gray curtain wall, fine dark mullions, subtle cyan
  vertical channels, scattered warm occupied offices.
- `facade-02`: monumental silver-gray vertical fins over narrow dark window bays.
- `facade-03`: dark horizontal office bands, continuous ribbon windows, recessed
  service floors, sparse cyan accents.
- `facade-04`: glass facade with exposed diagonal structural exoskeleton and
  restrained cyan/magenta light channels.
- `facade-05`: dense gridded glass, layered fine mullions, cyan structural lines.
- `facade-06`: heavy dark facade with recessed horizontal office strips and
  mechanical side bays.
- `facade-07`: fine irregular curtain wall with sparse vertical magenta/cyan
  architectural strips.
- `facade-08`: dark stone-and-metal facade with wide vertical pilasters and narrow
  window bays.

## Mechanical sources

Common prompt:

```text
Use case: stylized-concept
Asset type: production diffuse/albedo source tile for the mechanical bottom row
of a commercial high-rise texture atlas used in Blender and Three.js
Input image: material, palette, and architectural-language reference only
Primary request: create one clean, high-resolution, edge-to-edge texture source
matching the existing realistic glass-and-metal cyberpunk building family
Style/medium: realistic near-future industrial PBR diffuse/albedo texture source,
professional game-asset quality, dark blue-gray painted metal, charcoal steel,
restrained concrete, detailed but readable at skyline distance
Composition/framing: perfectly orthographic; square texture filling the entire
canvas; straight parallel geometry; balanced modular layout; no surrounding scene
Lighting/mood: neutral flat material presentation with readable midtones and
subtle ambient definition; no environmental scene lighting
Constraints: no perspective, vanishing point, 3D object silhouette, sky, ground,
people, vehicles, text, numbers, logos, labels, watermark, bloom, fog, cast
shadows, dramatic highlights, strong baked reflections, outer border, or margin
Avoid: warped grilles, elliptical fans, rusty post-apocalypse styling, ornamental
fantasy motifs, excessive neon, crushed black detail, photostudio backdrop
```

Per-image subjects:

- `roof-dark-metal`: dark painted-metal roof/service panels, seams, hatches,
  drainage channels, bolts and restrained wear.
- `roof-weathered-concrete`: charcoal concrete slabs, expansion joints, service
  plates, repair patches and drainage grates.
- `hvac-louver-bank`: broad louvers, access panels, vents and industrial framing.
- `hvac-fan-array`: circular fan grilles, square housings, maintenance plates and
  vents.
- `service-wall`: vent banks, access doors, conduit channels, utility boxes and
  heat exchangers.
- `mechanical-panels`: reusable vents, louvers, fan grilles, access plates and
  small mechanisms.
- `trim-cyan`: reusable straight cyan/blue illuminated channels on dark metal.
- `trim-magenta`: reusable restrained magenta/violet/white illuminated channels
  on dark metal.
