# Block editor and panel placement

The row and block action bars keep their selection labels alongside the
actions. Each row and element pill has its own delete action. The editor keeps at
least one row and one element in each subpanel. Shield names can wrap to two
lines. Shield, variant, and route-number controls share a minimum height.

Disable Selection Flash, Show Block Bounds, and Alignment Guides live under
Settings → General → Interface. Settings anchors to the top of the right
toolbar. Settings dropdowns open below their triggers and scroll within the
available viewport space. Settings, Panel Style, and the panel selector use
short opacity animations that respect reduced motion and the animation
preference.

## Defaults and saved state

New posts default to Right and panel spacing defaults to 1 rem. Explicit
saved values, including spacing of 0, take precedence. Built-in presets use
the current defaults. Custom templates retain their saved post settings.

## Dragging

Standard Left, Right, and Overhead posts and all FDOT supports allow panel
bodies to move vertically. The offset is limited to ±6 rem. Horizontal dragging
reorders panels. A stack moves as a unit and stores its offset on the main
panel. Standard Rural and Center posts use their original placement behavior.
The exit tab and guide arrow areas also start panel drags. Hold Alt to move an
individually draggable exit tab or arrow from its own handle.

The dominant direction at the drag threshold determines whether the gesture
moves a panel vertically or reorders it. A horizontal drag reaches each new
insertion point one third of the way between neighboring panel centers.
The marker previews where the panel will land on release. Text selection is
disabled in the rendered panels.

Snap candidates are the top, bottom, and center of nearby panels, including
adjacent top-to-bottom edges. Snapping uses the sign body without its separate
exit tabs. It ignores the starting alignment and
uses a tolerance of eight screen pixels at any preview zoom. Alt temporarily
disables snapping. Releasing with a snap guide visible commits that
alignment. Escape and pointer cancellation restore the original position.

A gesture measures panel bounds once after it passes the drag threshold.
Pointer moves are coalesced into one pending animation frame. Offset, drop
marker, and snap guide writes are skipped when the corresponding values are
unchanged. The model updates once on drop, as a single undo step.

Offsets are serialized with the post. Snap guides live outside the sign
export subtree. Export clones use measured sign bounds to retain full-post
placement and crop individual panels to their visible bounds.

## Checks

Run `npm test` for defaults, offset normalization, snap math, and stacked
panel ordering. Run `npm run test:browser` against a local build to check
pointer dragging, action-bar alignment, settings, undo/redo, and reload.

| Workload | Previous build | Current build |
| --- | ---: | ---: |
| Fresh startup requests at `sign-ready` | 15 | 15 |
| Fresh startup requests at `editor-ready` | 25 | 25 |
| Startup JavaScript, Brotli estimate | 130,895 B | 130,951 B |
| Panel bounds reads on a click in a two-panel post | 3 | 0 |
| Style or class mutations on a frame with the same snap and drop target | 2 | 0 |

Request and drag counts come from simulated DOM runs. Use browser traces for
paint timing, frame latency, and Lighthouse comparisons.
