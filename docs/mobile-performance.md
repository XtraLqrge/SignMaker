> Historical first-pass notes. See [the latest mobile and SEO revision](mobile-performance-round2.md) for the current build.

# Mobile performance pass, November 4, 2026

This update starts from the previously delivered dev build. Its generated HTML
matches the HTML captured in the new `dev2` trace. The six new Lighthouse
reports consistently score 98 on desktop and 77 on mobile. All six show 100
for accessibility and best practices. The preview's noindex setting remains
unchanged.

## Deployed baseline

These medians come from the three supplied reports per device. They describe
the deployment **before this mobile pass**, not the new build's results.

| Metric | Mobile | Desktop |
| --- | ---: | ---: |
| Performance score | 77 | 98 |
| First contentful paint | 1,565 ms | 449 ms |
| Largest contentful paint, simulated | 5,638 ms | 1,095 ms |
| Total blocking time | 154 ms | 0 ms |
| Main-thread work | 1,572 ms | 469 ms |
| Transferred bytes | 1,045,935 | 1,045,774 |
| Requests | 39 | 39 |

Mobile uses Lighthouse's simulated network and 4x CPU slowdown. In the middle
mobile run, the observed, unthrottled LCP is 592 ms. Simulated LCP and observed
LCP represent different conditions. Their difference is not an observed
five-second blank screen.

The supplied trace shows approximately 38 ms of raster cropping for AIRPORT
artwork, despite the visible sign containing only Control text. It also shows
about 50 ms of sampled work within editor initialization. The reports flag
render-blocking CSS, unused JavaScript and a large hidden option tree. These
are the targets of this pass.

## Changes

- Moved 15 embedded shield SVGs out of the startup script into their individual
  asset paths. Their bytes match the original embedded artwork exactly. The
  backup copies remain in a separate bundle that loads only for file-mode use
  or an image error. Normal HTTP startup does not load that bundle.
- Excluded saved exit-tab profiles from startup resource preparation. An icon
  left in the settings of a non-icon tab no longer triggers image loading or
  cropping. Actual block icons and nested icon tabs still prepare normally.
- Stopped preparing fonts for blank default exit tabs and inactive Exit Only
  text. A fresh Control-only sign now prepares Series EM alone. Visible exit
  tabs and Exit Only text still prepare their selected fonts.
- Inlined the small early font-hint helper to remove its parser-blocking
  request, while retaining early font discovery and the font-loading fallback.
- Compacted CSS using CSS Tree's parser and generator. The build compares the
  complete syntax tree before and after generation. It retains declaration
  order, duplicate rules, custom-property tokens and cascade layers. It does
  not remove styles based on startup coverage.
- Prevented option creation inside hidden input fields used by the asset
  pickers. This removes 368 unused option elements from the fresh startup DOM
  while preserving the fields' values and normal select-option behavior.
- Deferred shield-picker trigger artwork until its editor becomes active.
- Separated editor setup phases with browser task yields and gave the sign a
  paint opportunity first. The controls become interactive when initialization
  finishes, so users cannot change a partially initialized form.
- Added a year-long immutable cache rule for content-hashed UI fonts. The
  legacy font rule uses a single-segment path placeholder so it does not
  overlap the UI font rule. Header counts stay below Cloudflare's limit.
- Added intrinsic dimensions to the footer logo while preserving its displayed
  size and original artwork.

## Build measurements

| Artifact or structural check | Previous build | Mobile build |
| --- | ---: | ---: |
| External startup JavaScript, raw bytes | 2,007,039 | 1,662,159 |
| External startup JavaScript, gzip estimate | 525,640 | 339,695 |
| External startup JavaScript, Brotli estimate | 445,906 | 271,740 |
| External startup scripts | 22 | 21 |
| Early font helper, now inline | External, included above | 8,187 raw bytes |
| Stylesheet, raw bytes | 697,497 | 579,841 |
| Stylesheet, gzip estimate | 97,975 | 78,850 |
| Unused options inside hidden inputs | 368 | 0 |
| Fonts explicitly prepared for a fresh Control sign | 3 | 1 |

The inline helper's gzip estimate is 2,302 bytes. Its bytes now travel with
HTML rather than disappearing from the total page payload. Gzip and Brotli
figures are local compression estimates; the deployed server's transfer sizes
can differ. The remaining shield backup bundle is not part of startup totals.

The DOM checks use a simulated DOM, fonts and geometry. They establish which
work is requested and which nodes are built, rather than measuring phone CPU
time or rendering.

## Validation

All 27 Node regression checks pass. New coverage includes CSS syntax-tree
equivalence, the inline font helper, unused versus visible resource selection,
native selects versus hidden asset inputs, exact shield artwork preservation,
deferred fallback loading, stale-image request handling, browser task yielding,
cache-rule boundaries and deferred shield trigger previews.

The full-page DOM smoke check passes startup, sign creation, panel creation,
undo/redo, picker dismissal, all settings tabs, the animation toggle, and
construction of all 105 legacy gallery previews on request. The default sign
creates no prepared icon sources and prepares only Series EM. Source and
generated asset references are checked separately.

A fresh real-browser Lighthouse run is not available from this execution
environment because Chromium launch is blocked. No new mobile score, visual
verification or end-to-end image export result is claimed. The SVG, CSS and
model preservation checks reduce regression risk, but do not replace rendering
checks in a browser.

## Run the mobile browser checks

The archive contains the rebuilt `public/` directory. Deploy that directory
with the existing project configuration, or serve it locally as described in
the README. After installing Playwright and Chromium, run:

```sh
npm run test:browser -- http://localhost:8765 --mobile
```

This uses a 390 by 844 touch-enabled viewport and checks menu bounds,
scrollability, settings overflow, startup readiness, persistence and undo/redo.
Desktop checks use the same command without `--mobile`. Outputs go into
`browser-results/mobile/` and `browser-results/desktop/` respectively.

After deploying this build, three new mobile Lighthouse reports using the same
initial Control sign and test settings will measure the improvement. Keep each
report separately. No new production-site captures are needed for that
comparison.

Implementation references:
[CSS Tree](https://github.com/csstree/csstree) and
[Cloudflare static-asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
