# FDOT support renderer

Open Post Style from the config bar or by clicking the support. Choose a
position, then select a compatible preset from the FDOT group in Post Type.
Changing positions selects the standard support for that position. Saved signs
keep their existing preset IDs. The renderer loads with the editor and
measures geometry when an FDOT preset is active.

The 26 presets fall into ground, overhead, and street or wire supports.
The renderer builds an orthographic front elevation as an SVG behind the
panels. Overhead trusses use level chords, verticals, front-plane diagonals,
upright connections, and symmetric base plates. Material shading indicates
depth. Catwalk floors and luminaires use the same projection.
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

## Verification

Choose each Post Position and try its available Post Type options. Check
the support color, thickness, visibility, and restore behavior. Export
the entire post to include the support or select a panel to export its face.
