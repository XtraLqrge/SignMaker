# Mobile loading and SEO, November 4, 2026

## What the supplied reports show

The three dev3 mobile scores are 83, 85 and 83. Their median first contentful
paint is 1.86 seconds, median largest contentful paint is 4.37 seconds and
median total blocking time is 73 milliseconds. Desktop scores are 99, 99 and
100. These are the deployed baseline, before this revision.

All six SEO reports have exactly one failed SEO audit: `is-crawlable`. The
response contains `X-Robots-Tag: noindex`.

## Loading changes

- The rendering code is loaded first. A fresh Control sign prepares its font
  and paints before requesting the editor scripts or complete editor styles.
  The toolbar and sign remain inert until initialization is complete.
- Saved signs and stored post preferences use the full initialization path.
  The editor starts downloading alongside rendering code for returning users.
  The sign waits for custom registries and its complete styles before drawing.
- Terser minifies code, including local variable names, without property
  mangling or unsafe transformations. Model class and function names remain
  intact. Script boundaries stay separate to preserve global lexical semantics.
- A small first stylesheet includes the canvas, visible toolbar and page.
  The complete original stylesheet loads before editor interaction, preserving
  every original rule and its cascade order. Shield styles are available before
  any saved shield is rendered or a new shield can be added.
- Inter's common ASCII glyphs use a 35,704-byte variable font, retaining
  weight and optical-size axes. The original complete fonts remain available
  for every other supported character and for italic text.
- A 2,384-byte favicon replaces the 93 KB original logo request. The footer
  uses 3,162-byte and 7,204-byte responsive logo images. The original artwork
  remains unchanged in the project.
- The hidden shield value field holds its current value rather than building
  the entire catalog. The visible tree retains the complete catalog. Variant
  menus build their thumbnails on opening.
- The build removes outdated generated outputs. Editable source files and
  all original fonts and artwork remain included.

## Reproducible build measurements

These are local file sizes, not a new Lighthouse score or a measured network
transfer. Gzip and Brotli figures are compression estimates.

| Resource | Previous mobile build | This revision |
| --- | ---: | ---: |
| External JavaScript needed before the first fresh sign, raw | 1,662,159 B | 578,178 B |
| Same JavaScript, gzip estimate | 339,695 B | 155,063 B |
| Same JavaScript, Brotli estimate | 271,740 B | 128,728 B |
| All initial and deferred editor JavaScript, gzip estimate | 339,695 B | 276,981 B |
| Blocking CSS, raw | 579,841 B | 229,772 B |
| Blocking CSS, gzip estimate | 78,850 B | 35,309 B |

The 8,187-byte early sign-font helper stays inline. The editor's full CSS is
still downloaded after the first fresh sign, so the critical stylesheet adds
some duplicate CSS transfer. The logo, font and JavaScript savings exceed that
extra transfer. The split is intended to shorten the path to visible content.

## Validation and limits

All 32 automated regression checks pass. Full-page simulated-DOM checks cover
fresh startup, saved-state restoration, stored post preferences, shield/type
switching, lazy variant construction, dropdown dismissal, settings, undo/redo
and the complete legacy shield gallery. The fresh startup capture confirms
that no editor JavaScript or full editor CSS is requested before `sign-ready`.
Visible toolbar and canvas selectors were checked against the complete CSS.

Chromium cannot launch in this execution environment because socket creation
is denied. No new browser-rendering check, export image comparison, real phone
timing or 97–100 Lighthouse result is claimed. Deploy and rerun the same mobile
audit to measure the result. Use the included browser check for interaction
and menu bounds as documented in the README.

## SEO deployment

The project now includes `robots.txt`, an index/follow meta tag and a static
header rule that removes `X-Robots-Tag` when the static-assets layer controls it.
However, Cloudflare automatically adds `noindex` to Workers Preview URLs.
The project cannot promise to override a header applied by that preview layer.
Adding a meta robots tag does not cancel an HTTP noindex directive.

For an indexable dev deployment, use the included standalone Worker config:

```sh
npm run build
npx wrangler deploy --config wrangler.dev.jsonc
```

This creates or updates a regular Worker named `signmaker-dev`, separate from
the production config. Use the regular Worker URL printed by that command for
the audit. With the account shown in the supplied reports, its expected URL is
`https://signmaker-dev.xtralqrge.workers.dev/`. Verify the actual output instead
of assuming the account name. A public custom domain is another option.

The default `wrangler.jsonc` remains unchanged. A Cloudflare dashboard preview
build or `wrangler preview` still uses preview hosting and can still score 66
for SEO. No deployment or account setting was changed from this environment.

Confirm the deployed response with:

```sh
curl -I https://YOUR-DEPLOYMENT-URL/
```

`X-Robots-Tag: noindex` must be absent, and `robots.txt` must allow crawling.
The supplied reports already pass the other SEO audits, so this addresses the
recorded blocker. A new audit is still required to establish an SEO score.

References:
- [Cloudflare Workers Preview URLs](https://developers.cloudflare.com/workers/previews/)
- [Cloudflare static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Optimizing Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [Terser](https://terser.org/docs/options/)
