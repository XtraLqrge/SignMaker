/* Longitudinal pavement marking lines: their catalog and stripe patterns.
   Pure functions, shared by js/elements.js, js/longitudinal.js and the tests.

   Patterns follow FDOT Standard Plans Index 711-001 (FY 2025-26) sheet 2,
   "Pavement Marking Lines", with its contrast variants ("10'-30' Skip Line With
   Contrast Markings", "Dotted Line With Alternating Contrast Markings",
   "Longitudinal Solid Lane Line With Contrast Markings"), and the MUTCD 11th
   Edition where FDOT has no detail. Widths are inches, dashes feet; offsets are
   inches right of the line's center (right of travel), to the center of each
   stripe (711-001: dimensions are to the centerline of markings). */
(() => {
  const app = globalThis.StripeMaker ??= {};
  const COLORS = { white: '#ffffff', yellow: '#ffc72c' };
  const BLACK = '#000000';
  const DOUBLE = (6 + 4) / 2;          // 6" lines, 4" apart: centers 5" either side
  const CONTRAST_SIDE = 1.5;           // 711-001 sheet 2: 1.5" min. black contrast each side
  const SKIP = { on: 10, off: 30 };    // 711-001 sheet 2, 10'-30' skip line
  const dotted = (on, off, width, name, note) => ({ stripes: [{ offset: 0, width, dash: { on, off } }], name, note, dot: { on, off } });
  const styles = [
    { id: 'solid', name: 'Solid line', note: '6 in, edge or lane line', stripes: [{ offset: 0, width: 6 }], colors: ['white', 'yellow'] },
    { id: 'channelizing', name: 'Solid channelizing line', note: '8, 12 or 18 in white', widths: [8, 12, 18],
      stripes: [{ offset: 0, width: 8 }], colors: ['white'] },
    { id: 'skip', name: 'Skip line', note: '6 in, 10 ft line, 30 ft gap', stripes: [{ offset: 0, width: 6, dash: SKIP }], colors: ['white', 'yellow'] },
    { id: 'dottedGuide', ...dotted(2, 4, 6, 'Dotted guide line', '6 in, 2 ft line, 4 ft gap'), colors: ['white', 'yellow'] },
    { id: 'dottedExtension', ...dotted(2, 2, 12, 'Dotted extension line', '12 in, 2 ft line, 2 ft gap'), colors: ['white', 'yellow'] },
    { id: 'dottedExtensionLong', ...dotted(6, 10, 6, 'Dotted extension line (6–10)', '6 in, 6 ft line, 10 ft gap'), colors: ['white', 'yellow'] },
    { id: 'dottedInterchange', ...dotted(3, 9, 6, 'Dotted interchange line', '6 in, 3 ft line, 9 ft gap'), colors: ['white'] },
    { id: 'dottedLaneDrop', ...dotted(3, 9, 12, 'Dotted lane drop line', '12 in, 3 ft line, 9 ft gap'), colors: ['white'] },
    // Two-way bikeways: FDOT gives no center line, so MUTCD 11th Edition Part 9's
    // yellow broken center line, here 6 in with 3 ft lines and 9 ft gaps.
    { id: 'bikewayCenter', ...dotted(3, 9, 6, 'Bikeway center line', '6 in yellow, 3 ft line, 9 ft gap (two-way bike tracks)'), colors: ['yellow'], source: 'MUTCD Part 9' },
    { id: 'doubleSolid', name: 'Double solid lines', note: 'Two 6 in lines, 4 in apart',
      stripes: [{ offset: -DOUBLE, width: 6 }, { offset: DOUBLE, width: 6 }], colors: ['yellow', 'white'] },
    // Two-Lane Passing Prohibited Lines; MUTCD Section 3B.05 uses the same pair for
    // two-way left-turn lanes (skip toward the turn lane).
    { id: 'solidSkip', name: 'Solid and skip lines', note: 'No passing one way, or a two-way left turn lane', sided: true,
      stripes: [{ offset: -DOUBLE, width: 6, solidSide: 'left' }, { offset: DOUBLE, width: 6, solidSide: 'right' }], colors: ['yellow'] },
    // MUTCD 11th Edition Section 3B.04: normal width broken double yellow lines for
    // reversible lanes, at 711-001's 6"-4"-6" and 10'-30'.
    { id: 'doubleSkip', name: 'Double skip lines', note: 'Reversible lane', source: 'MUTCD 3B.04',
      stripes: [{ offset: -DOUBLE, width: 6, dash: SKIP }, { offset: DOUBLE, width: 6, dash: SKIP }], colors: ['yellow'] },
    { id: 'custom', name: 'Custom marking', note: 'User-defined stripes', stripes: [], colors: [] },
    { id: 'none', name: 'No line', note: 'Remove the line here', stripes: [], colors: [] },
  ];
  const byId = new Map(styles.map(s => [s.id, s]));
  const find = id => byId.get(id) ?? null;

  // Stripes to draw for a line { style, color, width, side, contrast }, contrast
  // first. Each is { offset, width (in), color, dash: null | { on, off, start } };
  // a dash pattern repeats every on + off feet, its first dash starting `start`
  // feet along.
  function stripes(line, { edge = false } = {}) {
    if (line.style === 'custom') {
      const out = (line.custom?.stripes ?? []).map(s => ({ offset: s.offset, width: s.width, color: s.color,
        dash: s.pattern?.length ? { pattern: s.pattern, start: s.phase ?? 0 } : null }));
      if (!line.contrast) return out;
      return [...out.map(s => ({ ...s, color: line.custom.contrastColor ?? BLACK,
        width: s.width + 2 * (line.custom.contrastWidth ?? CONTRAST_SIDE) })), ...out];
    }
    const style = find(line.style);
    if (!style) return [];
    const color = COLORS[style.colors.includes(line.color) ? line.color : style.colors[0]] ?? COLORS.white;
    const out = style.stripes.map(s => {
      const dash = style.sided ? ((line.side ?? 'left') === s.solidSide ? null : SKIP) : s.dash;
      return { offset: s.offset, width: style.widths ? (style.widths.includes(line.width) ? line.width : style.widths[0]) : s.width,
        color, dash: dash ? { on: dash.on, off: dash.off, start: 0 } : null };
    });
    // Black contrast goes with white lane lines, not edge lines (FDOT Design
    // Manual 230.3.1.1-230.3.1.2; 711-001 sheet 2).
    if (!line.contrast || !contrastable(line) || edge) return out;
    const black = [];
    for (const s of out) {
      if (!s.dash) black.push({ ...s, width: s.width + 2 * CONTRAST_SIDE, color: BLACK });
      else if (style.dot) {
        // Alternating contrast: every other dot is followed by a black block of
        // the same length (3' white, 3' black, 6' gap, 3' white, 9' gap for 3'-9').
        const { on, off } = style.dot;
        black.push({ ...s, color: BLACK, dash: { on, off: 2 * (on + off) - on, start: on } });
        s.dash = { on, off, start: 0 };
      } else {
        // 10' white, 10' black contrast, 20' gap.
        black.push({ ...s, color: BLACK, dash: { on: s.dash.on, off: s.dash.off, start: s.dash.on } });
      }
    }
    return [...black, ...out];
  }
  function contrastable(line) {
    if (line.style === 'custom') return true;
    const style = find(line.style);
    return Boolean(style?.stripes.length) && (style.colors.includes(line.color) ? line.color : style.colors[0]) === 'white';
  }
  // Total width (inches) a line covers, for picking and previews.
  function span(line) {
    const s = stripes({ ...line, contrast: false });
    return s.length ? Math.max(...s.map(t => Math.abs(t.offset) + t.width / 2)) * 2 : 6;
  }

  // SVG dash attributes for a stripe on a path whose start lies `distance` feet
  // along its chained line (so patterns stay in step across joints).
  function dashAttributes(dash, distance, pixelsPerFoot) {
    if (!dash) return null;
    const pattern = dash.pattern ?? [dash.on, dash.off];
    const period = pattern.reduce((a, b) => a + b, 0);
    const offset = (((distance - dash.start) % period) + period) % period;
    return { array: pattern.map(n => (n * pixelsPerFoot).toFixed(3)).join(' '), offset: offset * pixelsPerFoot };
  }

  const api = { styles, find, stripes, contrastable, span, dashAttributes, COLORS };
  app.lineStyles = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
