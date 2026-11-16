# Mobile startup

This pass followed the [initial startup optimization](performance.md).
The [render-first pipeline](mobile-performance-round2.md) supersedes its
startup architecture.

## Deployment baseline

| Metric | Mobile median | Desktop median |
| --- | ---: | ---: |
| Lighthouse performance | 77 | 98 |
| First contentful paint | 1,565 ms | 449 ms |
| Simulated largest contentful paint | 5,638 ms | 1,095 ms |
| Total blocking time | 154 ms | 0 ms |
| Main-thread work | 1,572 ms | 469 ms |
| Transferred bytes | 1,045,935 | 1,045,774 |
| Requests | 39 | 39 |

The middle mobile run recorded an observed LCP of 592 ms. The mobile trace
showed about 38 ms of raster cropping for unused AIRPORT artwork and about
50 ms of sampled editor initialization.

## Implementation

- Serve 15 shield SVGs as individual assets. The backup artwork bundle loads
  in file mode or after an asset error. Asset bytes match the embedded SVGs.
- Prepare resources for the active sign. Skip saved exit-tab profiles,
  hidden icon previews, empty exit tabs, and inactive Exit Only text. A fresh
  Control sign prepares Series EM.
- Inline the font hint helper. Compact CSS with syntax-tree equivalence checks
  that preserve declaration order, duplicate rules, and cascade layers.
- Keep hidden asset inputs as scalar values. Create options only for real
  selects and defer shield trigger previews until the editor needs them.
- Yield between editor setup phases. The sign can paint before the controls
  finish initialization.
- Cache hashed UI fonts for one year. The legacy font rule matches a single
  path segment. Set intrinsic dimensions on the footer logo.

## Build comparison

| Resource | Previous build | Mobile build |
| --- | ---: | ---: |
| External startup JS, raw | 2,007,039 B | 1,662,159 B |
| External startup JS, gzip | 525,640 B | 339,695 B |
| External startup JS, Brotli | 445,906 B | 271,740 B |
| External startup scripts | 22 | 21 |
| Stylesheet, raw | 697,497 B | 579,841 B |
| Stylesheet, gzip | 97,975 B | 78,850 B |
| Options inside hidden asset inputs | 368 | 0 |
| Fonts prepared for a fresh Control sign | 3 | 1 |

The inline font helper adds 8,187 raw bytes to the HTML. Compression figures
are local estimates. Run the [browser checks](performance.md#local-checks)
to measure paints, requests, and long tasks.
