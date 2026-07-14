# Small-ad source art

The lossless source PNGs are kept here, outside `public/`, so Vite does not copy
or serve them in production. Runtime versions live in
`public/assets/textures/small-ads/` as max-1024px WebPs.

To regenerate one runtime image while preserving its aspect ratio:

```sh
cwebp -q 82 -alpha_q 90 -m 6 -resize 0 1024 source.png -o runtime.webp
```

Use `-resize 1024 0` for landscape images.
