# FDOT support renderer

Open Post Style from the config bar or by clicking the support. Choose a
position, then select a compatible preset from the FDOT group in Post Type.
Changing positions selects the standard support for that position. Saved signs
keep their existing preset IDs. The renderer loads with the editor and
measures geometry when an FDOT preset is active.

The 26 presets fall into ground, overhead, and street or wire supports.
The renderer builds an orthographic front elevation as an SVG behind the
panels. Overhead trusses are the FDOT triangular three-chord truss seen head
on: two front chords with verticals and one diagonal per panel, and a back
chord at mid-depth. The Warren webs of the top and bottom inclined faces show
through the front panels. They meet the back chord at panel points and the
front chords at mid-panel. Depth shading is lightest on the front face, a
middle tone on the inclined webs and uprights, and darkest on the back chord.
Upright connections show the chord plates edge-on, with bolts and gussets.
Catwalk floors and luminaires use the same projection.
[FDOT Standard Plans, FY 2026–27](https://www.fdot.gov/design/standardplans/current)

| FDOT drawing | Presets / details used |
| --- | --- |
| [700-010: Single Column Ground Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-010.pdf) | Frangible round aluminum post, welded stub slip base, and bolted stub/sleeve slip base. Sheets 3–5 supply column, foundation, and base details. |
| [700-011: Single Column Cantilever Ground Mounted Sign](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-011.pdf) | Left/right offset column, wind beams, and bolted sleeve base, sheets 1–2. |
| [700-012: Single Post Sign Support Barrier Side-Mounted](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-012.pdf) | Bridge railing / barrier side mount, with offset support and two connections, sheets 1–3. |
| [700-013: Single Post Sign Support Barrier Top-Mounted](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-013.pdf) | Barrier / median top mount and base plate, sheets 1–2. |
| [700-020: Multi-Column Ground Sign](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-020.pdf) | Two or three steel I-section columns, fuse/hinge plates, and slip bases. Column locations are 21% / 79% or 15% / 50% / 85% of face width, per sheet 1. |
| [700-030: Wind and Hanger Beams for Overhead Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-030.pdf) | Wind beams and vertical hangers for overhead supports. |
| [700-031: External Lighting for Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-031.pdf) | Bottom-mounted luminaire arms on the left/right cantilever and span presets, sheets 1–2. |
| [700-040: Cantilever Sign Structure](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-040.pdf#page=4) | Left/right overhead cantilevers with front-plane diagonals rising toward the upright, per sheet 4. Upright connections and anchor bases follow sheets 2–3. |
| [700-041: Span Sign Structure](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-041.pdf#page=4) | Two-upright span with front-plane diagonals reversing at midspan, per sheet 4. The renderer uses an even panel count to keep the elevation symmetric. Upright connections and anchor bases follow sheets 2–3. |
| [700-090: Dynamic Message Sign Walk-In](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-090.pdf) and [700-091: Catwalk Details](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-091.pdf) | Left/right cantilever or span with adjacent grated access bay, hangers, and rails. 700-090 sheet 2 gives the layout; 700-091 sheets 1–3 give catwalk construction. DMS face styling is handled by Panel Style. |
| [700-050: Free-Swinging, Internally-Illuminated Street Sign Assemblies](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-050.pdf) | Left/right mast arm attachment (option 1), separate cantilever arm (option 2), or span wire assembly with separate arm. The preset supplies the support hardware. Panel settings control the sign face. |
| [659-010: Span Wire Mounted Sign Details](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/659-010.pdf) | Catenary and messenger wires with direct attachment (A), wind beams (B/C), or adjustable hangers (D). B and C share a preset. Placement along the span is project-specific. |

The SVG follows the width of the sign faces. Ground supports are 24 rem tall
and overhead trusses, mast arms, and wire supports are 30 rem tall. Panels are
bottom-aligned at a fixed mounting height so taller faces extend upward.
Dragging a panel or stack changes its own vertical offset by up to 6 rem in
either direction. Member sizes and clearances are illustrative. Whole-post
export includes the SVG. Signs-only export omits it. The preset ID is stored
in `polePosition` and follows the existing restore, template, and undo paths.

## Overhead geometry

Sheets 1 and 4 define the upright and truss geometry. The project-specific
sign-structure data table supplies the design dimensions.
[700-040 instructions](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/spi/spi-700-040.pdf)
and [700-041 instructions](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/spi/spi-700-041.pdf)

| Measurement | 700-040 cantilever | 700-041 span |
| --- | --- | --- |
| Truss span | `N × B`, number of equal panels × panel length (sheet 4) | `A`, made up of `D` equal panels (sheet 4) |
| Bay / panel length | `B` | `A / D` |
| Truss depth between front chord centerlines | `C` | `E` |
| Chord pipe outside diameter and wall thickness | `D` in the data table | `F` in the data table |
| Upright pipe outside diameter and wall thickness | `F` in the data table | `H` (left) and `J` (right) in the data table |
| Upright height | `A` on sheet 1 | `B` / `C` on sheet 1 |

The cantilever has a 7-inch plug-end overhang. Its upright end and both span
ends extend by half the corresponding upright outside diameter plus 1 inch.
The instructions specify maximum spans of 50 feet for cantilevers and 220
feet for two-upright spans. Use the completed data table for a specific
installation.
[FDOT Structures Design Programs Library](https://www.fdot.gov/structures/proglib.shtm)

Post Style shows **Truss Height** (the depth, `C` / `E`; default 4.35 rem,
2–12 rem) and **Truss Panel Length** (the target `B` / `A / D`; default
5 rem, 2–15 rem) when a truss is selected. Both are saved with the sign as
`post.trussDepth` and `post.trussPanelLength`. The drawing rounds the panel
count up so that equal panels fill the span, and spans keep an even count.

## Tampa monotubes

The Post Type menu lists these under **Tampa**: a span and left/right
cantilevers, each with curved or mitered corners. A single tube rises from each
anchored upright and turns into the horizontal member. The sign hangs on wind
beams in front of the tube, and a cantilever's free end is capped just past the
sign.

- **Mitered corners** follow the THEA East Selmon requirement: "Overhead sign
  structures shall be monotube structures with mitered corners matching the
  aesthetic of the existing monotube structures along the East Selmon
  Expressway." Exposed galvanized surfaces are painted Pro-Tech PT211W57
  (Textured White).
  [THEA design-build RFP O-02520](https://www.tampa-xway.com/wp-content/uploads/2020/12/O-02520_ASDB_RFP_Final_12-03-2020-1.pdf)
- **Curved corners** have no Tampa standard sheet behind them. The bend is
  drawn at the tube centerline with an adjustable **Corner Radius** (default
  3 rem, 0.5–10 rem, saved as `post.monotubeRadius`). Monotube details from
  other states use a bent pipe; this
  [Oklahoma DOT monotube plan sheet](https://www.odot.org/contracts/a2022/plans2210/192_2210_HSIPG-255F(581)TR_3579504/M001-3579504-Monotube%20Structure%201.pdf)
  is reported to call for a 10 ft bend radius (not yet checked against the sheet).
  Replace the default with project dimensions when a Tampa plan sheet is
  available.

## Verification

Switch between support types within the same Position and check that the mounted panels keep their vertical placement. Each Post Style row has a reset button. Panel Spacing resets to the saved Default Panel Spacing.

Choose each Post Position and try its available Post Type options. Check
the support color, thickness, visibility, and restore behavior. Export
the entire post to include the support or select a panel to export its face.
