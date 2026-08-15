# Application icons

Installable PWA icons generated from the original Kotoba Lab mark: a white
言 on a vermilion rounded square, matching `favicon.png`.

- `icon-192.png` — 192×192, Android launcher baseline. Rounded square.
- `icon-512.png` — 512×512, splash and store-quality any-purpose icon.
  Rounded square.
- `icon-maskable-512.png` — 512×512, `purpose: maskable`. The background is
  **full-bleed** with no rounded corners, because Android applies its own mask
  and a pre-rounded background would leave transparent corners when cropped to
  a squircle. The glyph is scaled to 62% so it stays well inside the centre 80%
  safe zone under any mask shape.

Rendered with canvas using Zen Old Mincho, the same typeface the application
uses, so the mark matches the product's typography. Original work, covered by
the repository's MIT license.

To regenerate, draw the mark to a canvas at the target size and save the PNG.
Do not upscale `favicon.png` — it is 46×46 and produces a visibly blurry
launcher icon.
