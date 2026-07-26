# Asset pipeline

Two scripts keep `public/assets/` from growing without anyone noticing. Both are
read-only by default; both need an explicit flag to change anything.

## `npm run assets:report`

Answers two questions: **what does the app never load**, and **what is stored
twice**. It resolves references the three ways the runtime actually builds asset
paths — literal strings, loop templates like `` `models/car_${id}.obj` ``, and
bare filenames in config arrays like `ADS_META` — and grades each file by how
strong the evidence is.

```
npm run assets:report                  # summary
npm run assets:report -- --verbose     # every unreferenced file
npm run assets:report -- --tier stem   # list the weak matches, to eyeball them
npm run assets:report -- --emit-prune  # write scripts/prune-assets.sh
```

The `stem` tier is the one to read before deleting anything: those files matched
only on their name-without-extension, which is a deliberately loose test. Files
in the `none` tier had no evidence of any kind.

`--emit-prune` writes a reviewable shell script of `git rm` commands. It is
gitignored, and it deletes nothing until you run it yourself.

## `npm run assets:optimize`

Prunes unused glTF data, welds duplicate vertices, downscales and re-encodes
embedded textures to WebP, and Draco-compresses geometry.

```
npm run assets:optimize                        # dry run → .asset-cache/optimized
npm run assets:optimize -- --apply             # overwrite public/assets in place
npm run assets:optimize -- --max-texture 1024  # tighter cap for background models
npm run assets:optimize -- --no-draco          # textures only
npm run assets:optimize -- path/to/one.glb     # single file
```

`--apply` refuses to run when `public/assets` has uncommitted changes, so the
originals always stay recoverable from git. Files that don't shrink by at least
5% keep their original bytes — Draco's per-primitive header and WebP's floor
cost can exceed the saving on a low-poly mesh with small textures.

### Why Draco and not meshopt

meshopt implies `KHR_mesh_quantization`: positions arrive as *normalized integer*
attributes with a compensating scale on the node. `AssetManager` bakes node
transforms into the geometry (`extractGeometryFromGLTF` and `mergeGLTFMeshes`,
both via `applyMatrix4`), and three's `BufferAttribute.setXYZ` re-normalizes
writes back into the integer range — world-scale coordinates would clamp and
every model would collapse. `DRACOLoader` decodes to float32, so the same bake is
safe.

If you ever want meshopt's faster decode, dequantize at load time first.

### Why `prune({ keepAttributes: true })`

Dropping unused attributes is decided per-primitive, so two primitives in one GLB
can end up with different attribute sets. `AssetManager` merges all primitives of
a model with `BufferGeometryUtils.mergeGeometries`, which returns `null` on a
mismatch — the model would silently disappear. Keeping attributes costs a little
size and removes the failure mode entirely.

### Runtime requirement

Draco-compressed GLBs need the decoder in `public/draco/` (committed) and
`DRACOLoader` wired into both `GLTFLoader`s in `AssetManager`. Uncompressed GLBs
load unchanged either way, so the pipeline can be applied incrementally.

Refresh the decoder after a three.js upgrade:

```
npm run assets:sync-draco
```

## Verifying a change

`npm run typecheck`, then render the city and look at it — the skill in
`.claude/skills/run-future-cityscape/` drives headless Chromium and screenshots
the canvas. Geometry corruption from a bad compression setting shows up as
collapsed or exploded buildings, not as a load error.

## Not covered yet

- **LOD.** No model has one; a 2.7 MB skyscraper draws at full resolution when
  it's a few pixels tall. `simplify()` from `@gltf-transform/functions` plus a
  per-tier `InstancedMesh` chosen from the distance sort already in
  `InstancedBuildings.tsx` is the natural next step.
- **Audio.** `sounds/*.wav` are uncompressed (~28 MB across three referenced
  ambience loops). Lossy encoding would save most of it, but encoder padding
  becomes real silence in a decoded `AudioBuffer`, which clicks on a seamless
  loop — pick the codec deliberately.
- **Cross-file texture sharing.** Several building GLBs embed byte-identical
  facade atlases. Hoisting shared textures out of the GLBs would cut more than
  any per-file setting, but changes how models are authored and loaded.
