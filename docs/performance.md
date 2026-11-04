# Dev performance update, November 4, 2026

This page documents the first optimization pass. The newer
[mobile performance pass](mobile-performance.md) starts from the resulting
deployed build and includes the latest measurements and validation.

This update starts from the supplied `Merge-v2-2.zip`, which matches the dev
deployment used in the latest reports. It retains the current editor features,
sign models, assets, animations, import/export paths and saved-state formats.

## Measurements that guided this update

The latest set contains two Chrome traces and three Lighthouse runs for each
site/device combination. The table below contains medians of the **existing dev
deployment**, before this update. These are not results for the new build.

| Dev baseline | Desktop | Mobile |
| --- | ---: | ---: |
| Lighthouse performance | 77 | 62 |
| Simulated first contentful paint | 842 ms | 2,824 ms |
| Simulated largest contentful paint | 4,442 ms | 26,666 ms |
| Total blocking time | 27 ms | 199 ms |
| Main-thread work | 595 ms | 2,465 ms |
| Transferred bytes | 5,786,682 | 5,786,720 |
| Requests | 160 | 160 |
| Observed, unthrottled LCP | 605 ms | 584 ms |

The dev trace has 542 ms of top-level main-thread work and a longest task of
165 ms. The corresponding production trace has 683 ms and a longest task of
262 ms. The merge was already doing less startup work in these new captures;
its inconsistent simulated LCP was not evidence that every part became slower.

The oversized Material Symbols download finished close to observed LCP. Some
runs included that download in Lighthouse's simulated critical path and others
did not. This matches the behavior described in the
[Lighthouse maintainers' analysis of inflated simulated LCP](https://github.com/GoogleChrome/lighthouse/issues/17436).
The font is also a real bandwidth cost regardless of how Lighthouse scores it.

## Changes

| Item | Before | Included build |
| --- | ---: | ---: |
| Material Symbols font payload | 4,011,576 bytes | 18,628 bytes |
| Legacy shield gallery images created while closed | 105 | 0 |
| Google Fonts stylesheet requests on normal load | 1 | 0 |

The icon font is 99.54% smaller, saving 3,992,948 payload bytes on its own.
It contains all 52 requested interface icon names, including dynamic states.
Its weight and optical-size axes remain available. The font's actual GSUB
ligatures were decoded and checked, rather than relying on the download name.

Inter and Overpass are self-hosted with their normal/italic styles, variable
weights and international Unicode subsets. The browser still loads only the
faces and Unicode ranges that it uses. The 25 included UI font files occupy
1,006,260 bytes on disk; this is not their startup transfer size. The
[Material Symbols documentation](https://developers.google.com/fonts/docs/material_symbols)
describes the icon-name subsetting and self-hosting mechanism used here.

The old shield dialog initializes its gallery only when requested, before its
selection/search setup runs. Its images are lazy and asynchronously decoded.
Static dialog previews use the same loading hints. Closed arrow pickers defer
preview construction, reuse their list rows after selection changes, skip
unchanged values, and remove their popovers and listeners when destroyed.

The hidden default icon preview no longer requests and crops AIRPORT artwork
on a Control-only sign. The selected sign's actual artwork still prepares
before rendering. Color-picker classification checks the control's own metadata
first and caches associated label discovery while reading live label text.

Settings positioning now checks the active menu before constructing its CSS
selector. This removes the `.sMModal.` selector exception present in every
supplied dev report. The HTML also has a standards-mode doctype. The existing
global border-box sizing rule remains in place.

The existing compacted scripts, combined stylesheet, deferred editor controls,
font prioritization for the current sign, on-demand export library, dropdown
geometry handling and layout coalescing remain in use. The archive includes
`package.json`, the complete source tree and the rebuilt production assets.

## Validation and limits

All 19 Node regression checks pass. They cover generated asset equivalence,
font checksums and glyph coverage, menu sizing/cleanup, deferred editors and
galleries, selection behavior, label caching, hidden icon work, nested model
cloning, export-library loading and lossless PNG compression.

A separate full-page DOM smoke check passed initialization, rendered panel
creation, undo/redo, settings-tab switching, the dropdown-animation toggle,
type-picker dismissal and construction of the complete legacy gallery. It
used simulated fonts, canvas and geometry, so it is not a visual check.

Chromium could not launch in the execution environment because its socket
operation was denied. No new browser timing, Lighthouse score, visual result or
end-to-end PNG/SVG export result is claimed for this build. The expected
bandwidth reduction is grounded in actual font bytes and deferred image
construction; its effect on performance scores needs a deployed browser run.

Preview SEO should remain separate from performance. The Workers preview's
`X-Robots-Tag: noindex` accounts for its lower SEO score and is left alone.

## Repeat the checks

From the project root:

```sh
npm run build
npm test
```

Optional real-browser checks require Playwright and its Chromium installation:

```sh
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 8765 --directory public
```

In another terminal, run:

```sh
npm run test:browser -- http://localhost:8765
```

The browser check writes timings, resource entries, errors and settings
screenshots to `browser-results/`. It exercises menu closing, scrollability,
settings overflow, persistence and undo/redo. For comparable Lighthouse runs,
use the same initial sign, browser version and throttling profile, with three
fresh runs per device. Keep each run's exported report separately.

To add a new interface icon, update `scripts/ui-icons.json`, then refresh the
self-hosted font subset. This maintenance operation needs Python's `fonttools`
package and an internet connection; ordinary builds do not:

```sh
python3 -m pip install fonttools
python3 scripts/refresh-ui-fonts.py
npm run build
npm test
```

The refresh downloads font faces and licenses and verifies all requested
ligatures. A build fails when a detected interface icon is missing from the
included font. Optional `npm run optimize:assets` performs lossless PNG IDAT
recompression, including embedded PNGs in SVG files, with raster byte checks.
