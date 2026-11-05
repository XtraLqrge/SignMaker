# Startup optimization

This pass targeted the initial dev deployment on November 4, 2026. The
[mobile startup notes](mobile-performance.md) and
[render-first notes](mobile-performance-round2.md) cover subsequent changes.

## Deployment baseline

| Metric | Desktop median | Mobile median |
| --- | ---: | ---: |
| Lighthouse performance | 77 | 62 |
| Simulated first contentful paint | 842 ms | 2,824 ms |
| Simulated largest contentful paint | 4,442 ms | 26,666 ms |
| Total blocking time | 27 ms | 199 ms |
| Main-thread work | 595 ms | 2,465 ms |
| Transferred bytes | 5,786,682 | 5,786,720 |
| Requests | 160 | 160 |
| Observed LCP | 605 ms | 584 ms |

The dev trace recorded 542 ms of top-level main-thread work and a 165 ms
longest task. Production recorded 683 ms and 262 ms. Simulated LCP varied
with whether the Material Symbols download landed on Lighthouse's critical
path. Compare simulated LCP separately from observed paint timings.
[Lighthouse issue 17436](https://github.com/GoogleChrome/lighthouse/issues/17436)

## Implementation

| Resource or operation | Before | After |
| --- | ---: | ---: |
| Material Symbols font | 4,011,576 B | 18,628 B |
| Shield preview images created before gallery open | 105 | 0 |
| Google Fonts stylesheet requests | 1 | 0 |

- The icon subset retains all 52 interface ligatures and their variable
  weight and optical-size axes. The build verifies glyph coverage and font
  checksums. Inter and Overpass are self-hosted with style, weight, and
  Unicode range declarations.
- The legacy shield gallery creates previews on first use. Preview images
  load lazily and decode asynchronously. Arrow picker lists reuse their
  preview rows and release their listeners on teardown.
- Startup skips the hidden default icon preview when the sign has no icons.
  Color picker classification caches label lookup and reads the live label text.
- Settings validates the active menu before building its modal selector. The
  document uses standards mode.

## Local checks

```sh
npm run build
npm test
```

For browser checks, install Playwright and Chromium and start a static server.

```sh
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 8765 --directory public
```

Run the browser check in a second terminal.

```sh
npm run test:browser -- http://localhost:8765
npm run test:browser -- http://localhost:8765 --mobile
```

Results go to `browser-results/`. Use the same initial sign, browser version,
and throttling profile when comparing Lighthouse runs. Capture at least
three runs per device.

## Font and image maintenance

Add interface icon names to `scripts/ui-icons.json` before rebuilding the font
subset. Font refresh requires network access and Python's `fonttools`.
Ordinary builds use the checked-in font assets.

```sh
python3 -m pip install fonttools
python3 scripts/refresh-ui-fonts.py
npm run build
npm test
```

`npm run optimize:assets` recompresses PNG image data, including PNGs embedded
in SVGs, and checks raster bytes for equivalence.
