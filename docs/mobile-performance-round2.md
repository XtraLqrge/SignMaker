# Render-first startup and crawler configuration

## Deployment baseline

The November 4, 2026 mobile runs scored 83, 85, and 83. Median FCP was
1.86 s, median LCP was 4.37 s, and median TBT was 73 ms. Desktop runs
scored 99, 99, and 100. All six SEO runs failed `is-crawlable` on a response
with `X-Robots-Tag: noindex`.

## Loading order

- Fresh Control signs load rendering scripts and critical CSS first. After
  the sign renders, startup requests the full stylesheet and editor scripts.
  Controls stay inert until the editor is ready.
- Saved signs and stored post preferences start the full download in
  parallel with rendering scripts. Saved signs wait for complete sign styles
  and custom registries before rendering.
- Terser minifies each script independently. The build retains global model
  names and property names. Script boundaries preserve initialization order
  and global lexical bindings.
- Critical CSS includes the sign, page, and visible toolbar rules. The full
  stylesheet preserves rule order and loads before editor interaction.
- Common ASCII glyphs use a 35,704 B Inter subset. Other glyphs and italic
  faces use the complete fonts. The favicon is 2,384 B and the responsive
  footer logo variants are 3,162 B and 7,204 B.
- The hidden shield field stores the selected value. The catalog and variant
  thumbnails populate when their pickers open.

## Build comparison

| Resource | Previous mobile build | Render-first build |
| --- | ---: | ---: |
| JS before the first fresh sign, raw | 1,662,159 B | 578,178 B |
| JS before the first fresh sign, gzip | 339,695 B | 155,063 B |
| JS before the first fresh sign, Brotli | 271,740 B | 128,728 B |
| Startup and deferred editor JS, gzip | 339,695 B | 276,981 B |
| Blocking CSS, raw | 579,841 B | 229,772 B |
| Blocking CSS, gzip | 78,850 B | 35,309 B |

The inline sign-font helper is 8,187 B in both builds. The critical
stylesheet duplicates some rules from the full stylesheet to move editor CSS
off the first-render path. File sizes and compression estimates describe
build output. Use browser traces to measure paint and execution time.

## Dev deployment

`wrangler.dev.jsonc` defines a standalone `signmaker-dev` Worker. Use its
regular URL for a crawlable dev audit, or run the SEO audit on
`https://hwysignmaker.com/` after deploying to production. Cloudflare adds
`X-Robots-Tag: noindex` to its `workers.dev` Preview URLs even when the app's
`robots.txt` allows crawling.
[Cloudflare Workers previews](https://developers.cloudflare.com/workers/previews/)

```sh
npm run build
npx wrangler deploy --config wrangler.dev.jsonc
```

Check the response headers and `robots.txt` on the URL printed by Wrangler.
Crawler access requires a robots policy that allows the URL and a response
without an HTTP `noindex` directive.
[Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
