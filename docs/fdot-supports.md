# FDOT sign supports

Choose a preset in **Post Settings → Post Kind**. The 26 FDOT options are grouped into ground, overhead, and street / wire supports. Existing color, thickness, alignment, panel orientation, Hide Post, Copy Signs Only, and Entire Post download controls apply to these presets.

The source edition is [FDOT Standard Plans, FY 2026–27](https://www.fdot.gov/design/standardplans/current), inspected October 3, 2026. The dropdown includes the relevant drawing index. Overhead supports use an orthographic front elevation, with depth conveyed through material shading. They show level top/bottom chords, vertical panel members, front-plane diagonal braces, upright connections, and symmetric base plates. Rear truss chords and out-of-plane braces are omitted as in FDOT's front-elevation drawings. Catwalk floors and light fixtures also use front projections.

| FDOT drawing | Presets / details used |
| --- | --- |
| [700-010: Single Column Ground Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-010.pdf) | Frangible round aluminum post, welded stub slip base, and bolted stub/sleeve slip base. Sheets 3–5 supply column, foundation, and base details. |
| [700-011: Single Column Cantilever Ground Mounted Sign](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-011.pdf) | Left/right offset column, wind beams, and bolted sleeve base, sheets 1–2. |
| [700-012: Single Post Sign Support Barrier Side-Mounted](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-012.pdf) | Bridge railing / barrier side mount, with offset support and two connections, sheets 1–3. |
| [700-013: Single Post Sign Support Barrier Top-Mounted](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-013.pdf) | Barrier / median top mount and base plate, sheets 1–2. |
| [700-020: Multi-Column Ground Sign](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-020.pdf) | Two or three steel I-section columns, fuse/hinge plates, and slip bases. Column locations follow sheet 1: 21% / 79% or 15% / 50% / 85% of face width. |
| [700-030: Wind and Hanger Beams for Overhead Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-030.pdf) | Wind beams and vertical hangers incorporated into overhead supports; this is attachment hardware rather than a freestanding support. |
| [700-031: External Lighting for Signs](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-031.pdf) | Bottom-mounted luminaire arms on the left/right cantilever and span presets, sheets 1–2. |
| [700-040: Cantilever Sign Structure](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-040.pdf#page=4) | Left/right overhead cantilevers following sheet 4's front elevation: diagonals rise toward the upright. The triangular cross section shown in the side elevation is not drawn in the front view. Upright connections and anchor bases follow sheets 2–3. |
| [700-041: Span Sign Structure](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-041.pdf#page=4) | Two-upright span following sheet 4's front elevation: diagonal direction reverses at midspan. The renderer uses an even panel count to keep the elevation symmetric. Upright connections and anchor bases follow sheets 2–3. |
| [700-090: Dynamic Message Sign Walk-In](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-090.pdf) and [700-091: Catwalk Details](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-091.pdf) | Left/right cantilever or span with adjacent grated access bay, hangers, and rails. 700-090 sheet 2 gives the layout; 700-091 sheets 1–3 give catwalk construction. Select DMS in Panel Style to give the sign its message-board face. |
| [700-050: Free-Swinging, Internally-Illuminated Street Sign Assemblies](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/700-050.pdf) | Left/right mast arm attachment (option 1), separate cantilever arm (option 2), or span wire assembly with separate arm. The preset supplies support hardware; sign content and face styling stay under the existing panel controls. |
| [659-010: Span Wire Mounted Sign Details](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/idx/659-010.pdf) | Catenary and messenger wires with direct attachment (A), wind beams (B/C), or adjustable hangers (D). B and C share a support preset; their placement along the span is a project layout choice. |

These are visual presets, fitted to the sign dimensions in the editor. Member sizes, truss depth, bay length, clearance, light spacing, and access-bay dimensions are illustrative. Buried foundations and project-specific structural calculations are outside the renderer. Left/right versions mirror the documented assemblies.

## Where the overhead measurements are defined

Sheet 4 of both overhead standards contains a dimensioned **FRONT ELEVATION**, a separate **SIDE ELEVATION**, and section views. Most main dimensions are named parameters, not universal fixed sizes. The project designer fills their values into the sign-structure data table included in the contract plans. The [700-040 instructions](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/spi/spi-700-040.pdf) and [700-041 instructions](https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/design/standardplans/2027/spi/spi-700-041.pdf) provide those table templates and require them to be completed from the structural design.

| Measurement | 700-040 cantilever | 700-041 span |
| --- | --- | --- |
| Truss span | `N × B`: number of equal panels × panel length (sheet 4) | `A`, made up of `D` equal panels (sheet 4) |
| Bay / panel length | `B` | `A / D` |
| Truss depth between front chord centerlines | `C` | `E` |
| Chord pipe outside diameter and wall thickness | `D` in the data table | `F` in the data table |
| Upright pipe outside diameter and wall thickness | `F` in the data table | `H` (left) and `J` (right) in the data table |
| Upright height | `A` on sheet 1 | `B` / `C` on sheet 1 |

The cantilever front elevation also specifies a 7-inch plug-end overhang and an upright-end extension of half the upright outside diameter plus 1 inch. The span elevation specifies its end extensions using half the corresponding upright outside diameter plus 1 inch. The instructions limit cantilever spans to 50 feet and span structures to 220 feet; these are maximums, not default dimensions.

FDOT publishes the **Cantilever Overhead Sign** and **Span Overhead Sign** design programs in its [Structures Design Programs Library](https://www.fdot.gov/structures/proglib.shtm). A particular installation's completed data table supplies the numeric measurements needed to reproduce that installation at scale. The app does not substitute arbitrary numbers for that table or treat its `rem` display units as surveyed dimensions.

The support is a self-contained SVG image behind the sign panels. It resizes when panels, fonts, spacing, or orientation change. Whole-post PNG/SVG exports include it; signs-only exports omit it. Saved posts retain the preset through the existing `polePosition` field, including session restore, templates, and undo/redo.

## Verification

Start a local server, then run `node scripts/test-fdot-supports.cjs http://127.0.0.1:8766` with Playwright and WebKit available. `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` can select an installed WebKit executable, and `FDOT_TEST_OUTPUT` can set the screenshot directory. The test uses an isolated browser profile and captures clipboard exports locally.
