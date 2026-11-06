# Florida official shield sources

The FDOT SVGs in `FDOT/` reconstruct the Florida State guide, Toll, and
Florida's Turnpike markers from the current FY 2026-27 FDOT Standard Plans,
Index 700-102, sheets 15 and 16. The source is the errata-incorporated edition
currently served by FDOT as of August 2026. The FDOT State catalogue contains
only guide-sign constructions; Freeway and Independent variants are excluded
because FDOT designates those two groups for independent use outside
SignMaker's overhead-sign scope. FDOT-specific U.S., Interstate, and County
variants are likewise excluded; the app's existing families remain unchanged.

- Current FDOT Standard Plans: https://www.fdot.gov/design/standardplans/current
- Current FDOT CADD files: https://www.fdot.gov/design/standardplans/current/dgns
- Current Index 700-102 with errata: https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-102ee.pdf?sfvrsn=6c73990a_1
- FY 2026-27 revisions log: https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/fy2026-27revisionlog.pdf?sfvrsn=9a9c25fb_1
- Index 700-102 origination/FHWA review package: https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/irr/2027/700-102fhwareviewpkg.pdf?sfvrsn=e0b83e60_1
- FY 2026-27 Industry Review package: https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/irr/2027/700-102indreviewpkg.pdf?sfvrsn=998527d8_1

The fixed FDOT lettering, Florida ribbons, and Turnpike silhouettes come from
the plan's authored vector paths. The guide Florida ribbons are closed filled
compounds reconstructed from the distinct fixed and variable CADD polygons,
not browser strokes around an approximate centerline. Their CADD rail geometry
is retained while the 1.75-inch physical band and dimensioned 1.25-inch outer
clearance remain fixed for all three panel heights. Published inch dimensions
control view boxes, corner radii, ribbon widths, dividers, cap heights, and
placement. The 40x48 FDOT Toll illustration contains 36-inch-wide authored
content; it is centered with 2-inch side margins instead of being stretched to
40 inches.

FDOT State guide numerals use the specified Series D, physical cap height,
and dimensioned cap top. Guide-marker ink edges use the published `A-G` or `E`
location, measured from the rendered glyph bounds rather than the CSS text box.
Natural Roadgeek advances are retained with zero added tracking and kerning.
The official Series D spacing intentionally leaves a wider left space on the
digit `3`; these FDOT/CFX markers therefore do not use SignMaker's legacy
noninitial-`3` tightening rule.
FDOT publishes the 3-or-more-digit guide width as variable from 48 to 58
inches; it does not assign 53- and 58-inch widths to the 30- and 36-inch-high
markers. SignMaker intentionally limits this family to three-character route
legends because four-digit Florida routes are outside the app's scope. It still
starts with the official 48-inch-wide construction and uses the sheet's
dimension scheme for each supported numeral combination:
`width = clamp(48, 58, E + natural numeral ink width + G)`, where `E` is 1.25
inches and `G` is 8.25, 8.75, or 11 inches for the 24-, 30-, or 36-inch-high
marker. With the bundled Series D metrics, numeric three-character legends
remain 48 inches wide at 24-inch height, range from 48 to 50.2 inches at
30-inch height, and range from 48 to 52.45 inches at 36-inch height. The
published 58-inch ceiling is consequently retained as source geometry but is
unreachable for a numeric three-character legend. The Florida outline remains
anchored to the right-hand edge as the panel changes width.

All six guide constructions retain the rounded outer CADD contour. Its plotted
lineweight converts to approximately 1/8 inch using the dimensioned 1.25-inch
corner-radius scale; this is a CADD-display reconstruction, not a separately
published fabrication callout. The fixed 1-2-digit construction additionally
places a 5/8-inch physical black border on a centerline 5/8 inch inside the cut
edge. Its ink therefore spans 5/16 to 15/16 inch, leaving 5/16 inch of white
before the Florida ribbon begins at the dimensioned 1.25-inch outer rail. The
current final sheet does not restate the 5/8-inch width; that value is retained
from the issued FY 2025-26 sheet and the FY 2026-27 Industry Review detail. The
current 3-or-more-digit CADD construction has only the common outer contour and
no heavy inner border. SignMaker now deliberately adds the same 5/8-inch inner
border as the fixed guide, per the requested consistent rectangular border.
The full-width SVG overlay is the only border renderer for variable guides.
The underlying asset is clipped one inch inward, clearing its border without
clipping the Florida ribbon (which begins at least 1.25 inches inward).
There is no preview-only CSS hairline: at small sizes it filled the white
separation between the outer contour and inner border, particularly at corners.
Editor and export now use the same physical border geometry.

The CFX SVGs in `CFX/` implement the 2026 Toll Route Shield TM and TM-ALT
details on sheets 5 and 6. The shell is built as a 0.75-inch white inset followed
by a 1-inch black border. The divider occupies y=11-12 inches on 36x48 shields
and y=13-14 inches on 48x60 shields. The Florida ribbon now follows a centerline
derived from paired rails of the authored polygon, with a uniform 1-inch stroke,
miter joins, and butt ends in both sizes. The former 48x60 polygon measured
approximately 1.25 inches thick, conflicting with the drawing's 1-inch callout;
the explicit dimension now takes precedence over that plotted geometry.
The Series E `TOLL` outlines
are fitted to the published 6/8-inch cap heights and 21.8/29.0-inch widths.

- Current CFX design guidelines: https://www.cfxway.com/cfx-design-guidelines/
- 2026 CFX details: https://www.cfxway.com/wp-content/uploads/2026/03/2026-CFX-SPM-Design-Details.pdf

FDOT and CFX specify sign-film colors rather than RGB or hex values. CFX calls
for its designated orange film (3M EC Film Series 1174, or approved equal, with
Series 1170 clear). The SVG green, yellow, and orange values are therefore
screen approximations, not certified colorimetric values.

All fixed lettering is stored as paths. Live route numerals remain editable in
SignMaker. CFX numerals begin at standard Series D spacing and are tightened
only when necessary. Tightening now reserves a gap of 8% of cap height between
adjacent glyph bounds. If the legend still exceeds its available span, it is
condensed horizontally, preserving cap height. This fallback is a documented
display compromise, not unmodified FHWA Series D fabrication lettering.
The previous unbounded tracking rule visibly merged digits on many routes.

The Turnpike `Toll` variant is now a fully vector composition: a nominal 30x12
yellow header with 6-inch Series D TOLL lettering above the corrected 30x36
Turnpike artwork. Its combined 30x48 arrangement is a SignMaker composition,
not a separately issued sheet-15 construction. The historical raster-backed
file is retained on disk, but is no longer used by the selectable variant.

## Sanity check - September 23, 2026

Reviewed all 17 currently selectable Florida variants: six state-route guides,
three FDOT toll markers, three FDOT Turnpike markers, four CFX TM/TM-ALT
markers, and the legacy Turnpike Toll composite. Compared the SVG geometry,
live-number metadata, and rendered exports with the published CAD-derived
construction sheets linked above (FDOT 700-102 sheets 15-16; CFX sheets 5-6).
This was a drawing/implementation sanity check, not an independent raw-DGN
coordinate comparison or a fabrication certification.

- State-route guide sizes, Series D numeral heights, bottom clearances, and
  fixed/variable source-border distinction agree with the guide-use table. The
  48-58 inch variable width and right-anchored Florida artwork are retained.
- FDOT toll sizes and 6/10/12-inch Series D route numerals agree with sheet 15.
  Turnpike sizes and fixed Series B lettering retain the authored artwork.
- CFX sizes, white inset, black border/dividers, 6/8-inch Series E TOLL legend,
  and 12/15-inch Series D route numerals agree with sheets 5-6. Orange TM and
  black TM-ALT outlines retain their documented jurisdiction distinction.
- The initial review did not change artwork; the subsequent stroke/alignment
  review corrected the CFX ribbon thickness and applied the requested matching
  three-digit panel border. Three-digit numeral ink is right-aligned at panel
  width minus G (11, 8.75, or 8.25 inches), while E remains the minimum left
  clearance used in width calculation. The inferred display
  contours, 40x48 authored-content discrepancy, screen colors, and legacy
  Turnpike Toll exception documented above remain qualifications.

All selectable Florida artwork is included in the tracked
`js/FloridaExportAssetData.js` supplement. Unlike the optional git-ignored
`ExportAssetData.js`, it ships with a fresh checkout. Copying no longer needs
to fetch Florida artwork while rendering the export. A WebKit regression test
blocks those fetches and removes the optional bundle, then checks that every
shield is decoded and embedded before a PNG is sent to a mocked clipboard.
Export also waits for source images before measuring the clone, avoiding
clipping when a lazy-loaded legacy shield is copied immediately after insertion.

After editing a Florida SVG, run `node scripts/sync-florida-export-assets.cjs`.
Verify with `node scripts/sync-florida-export-assets.cjs --check`. With
Playwright and its WebKit browser installed and a local server running, run
`node scripts/test-florida-exports.cjs http://127.0.0.1:8765`.

## Deep audit and repairs

The current catalog has 20 variants: the 17 above plus explicitly labeled
legacy FDOT Old, Selmon, and CFX Old designs. Legacy saves resolve to those
original assets instead of silently changing their design. The Selmon logo
suppresses route numerals. Legacy artwork remains unverified against current
construction sheets; restoring it is a compatibility measure.

- Turnpike silhouettes: removed the erroneous internal route-line cutout;
  retained the lake opening shown on the source drawing.
- Turnpike lettering: fit each size independently to 5, 7, and 8-inch flat
  cap heights, rather than scaling the small panel. First-line tops are 3,
  3.7, and 5.4 inches; second-line tops are 10.5, 14.1, and 17.4 inches.
  First-line widths are 22.5, 32.6, and 37.2 inches.
- Turnpike silhouettes: fit to heights 15, 20.4, and 25.6 inches at tops 18,
  24.5, and 29.4 inches. Silhouettes are centered without changing aspect ratio.
  The 40x48 sheet's horizontal chain (1.7 + 32.6 + 1.7 = 36) conflicts with
  its 40-inch overall width. The implementation honors the overall width and
  32.6-inch legend, centering it with 3.7-inch margins; it does not claim that
  all inconsistent callouts can be satisfied simultaneously.
- State guides: retain the requested matching rectangular borders and
  right-aligned numeral ink. Adding a third digit to an explicitly selected
  narrow panel now selects the wide construction at the same height.
- Both current TOLL families now have the same three-character limit as the
  state family. CFX fitting cannot introduce digit overlaps by negative tracking.
- FDOT border widths, corner-radius callouts, dividers, and numeral heights
  were retained. Exact inset placement remains a source-interpretation
  qualification; no new offset was invented from plotted pen thickness.

Verification (Playwright/WebKit, server running on localhost):

- `node scripts/test-florida-artwork.cjs`: source-dimension fixtures for
  Turnpike and TOLL artwork, vector-only composite, route limits and migrations.
- `node scripts/audit-florida-numerals.cjs`: 9,990 valid numeric layouts,
  rasterized at 8 pixels per sign inch; checks individual glyph ink against
  other digits, the Florida artwork, and borders. No collisions after repairs.
  This tests numeric legends, not every possible letter/symbol combination.
- `node scripts/test-florida-exports.cjs`: all 20 variants, with artwork fetches
  blocked and the optional export bundle absent. PNG payload creation alone
  is not treated as proof of correct numeral layout.

After changing the standard Turnpike artwork, rebuild the composite with
`node scripts/build-turnpike-toll.cjs`, then regenerate the export bundle.
Both generation scripts accept `--check` to detect stale output.
