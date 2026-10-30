// A vector replacement for the legacy yellow-TOLL/Turnpike composite.
// This is a SignMaker composition, not an issued FDOT panel construction.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..", "public");
const folder = "img/shields/United States/Florida/FDOT";
const read = (name) => fs.readFileSync(path.join(root, folder, name), "utf8");
const body = read("Turnpike-30x36.svg")
  .match(/<\/metadata>\s*([\s\S]*?)<\/svg>/)?.[1].trim();
const toll = [...read("Toll-48x60.svg").matchAll(/  <path\b[^\n]+/g)]
  .slice(2, 6).map((match) => match[0]).join("\n");
if (!body || (toll.match(/<path/g) || []).length !== 4) {
  throw new Error("Unexpected source artwork; inspect before rebuilding");
}
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="48" viewBox="0 0 30 48" role="img" aria-labelledby="title source">
  <title id="title">Florida's Turnpike with yellow TOLL header</title>
  <metadata id="source">SignMaker vector composition: a nominal 30x12 yellow header with 6-inch Series D TOLL paths above the FDOT 30x36 Turnpike artwork. The combined 30x48 arrangement is not an issued FDOT construction. Source components: FY 2026-27 Index 700-102, sheet 15.</metadata>
  <rect width="30" height="12" rx="1.5" fill="#fccf34"/>
  <g transform="translate(-9 0)">
${toll}
  </g>
  <g transform="translate(0 12)">
${body}
  </g>
</svg>
`;
const output = path.join(root, folder, "Turnpike-Toll-30x48.svg");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== svg) {
    throw new Error("Turnpike TOLL composite is stale; rebuild it");
  }
} else fs.writeFileSync(output, svg);
