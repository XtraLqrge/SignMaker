
const cloneSignMakerValue = (value, seen = new WeakMap()) => {
if (value === null || typeof value !== "object") {
return value;
}
if (seen.has(value)) {
return seen.get(value);
}
if (Array.isArray(value)) {
const clonedArray = [];
seen.set(value, clonedArray);
for (const item of value) {
clonedArray.push(cloneSignMakerValue(item, seen));
}
return clonedArray;
}
const clonedObject = Object.create(Object.getPrototypeOf(value));
seen.set(value, clonedObject);
for (const key of Object.keys(value)) {
clonedObject[key] = cloneSignMakerValue(value[key], seen);
}
return clonedObject;
};
class Post {
constructor(polePosition, lanesWide = 1, color = Post.prototype.colors?.[0]) {
if (this.polePositions.includes(polePosition)) {
this.polePosition = polePosition;
} else {
this.polePosition = this.polePositions[0];
}
if (lanesWide >= 1 && lanesWide <= 6) {
this.lanesWide = lanesWide;
} else {
this.lanesWide = 1;
}
const availableColors = Array.isArray(Post.prototype.colors)
? Post.prototype.colors
: ["Silver"];
if (availableColors.includes(color)) {
this.color = color;
} else {
this.color = availableColors[0];
}
const defaultThickness =
typeof Post.prototype.defaultThickness === "number"
? Post.prototype.defaultThickness
: 1;
this.thickness = this.normalizeThickness(defaultThickness);
this.copySignsOnly = true;
this.showBlockBoundingBoxes = false;
this.showAlignmentGuides = false;
this.alignmentGuideSpacing = 4;
this.alignmentGuidePhase = 0;
this.panels = [];
this.panelSpacing = 1;
}
newPanel() {
const newSign = new Sign();
newSign.newSubPanel();
const newPanel = new Panel(newSign, undefined);
const exitTab = new ExitTab();
newPanel.exitTabs.push(exitTab);
this.panels.push(newPanel);
}
duplicatePanel(panelIndex) {
const existingPanel = this.panels[panelIndex];
if (!existingPanel) {
return;
}
const newPanel = cloneSignMakerValue(existingPanel);
this.panels.splice(panelIndex + 1, 0, newPanel);
}
deletePanel(panelIndex) {
this.panels.splice(panelIndex, 1);
}
shiftLeft(panelIndex) {
if (panelIndex <= 0) {
return panelIndex;
}
this.panels.splice(panelIndex - 1, 2, this.panels[panelIndex], this.panels[panelIndex - 1]);
return panelIndex - 1;
}
shiftRight(panelIndex) {
if (panelIndex >= this.panels.length - 1) {
return panelIndex;
}
this.panels.splice(panelIndex, 2, this.panels[panelIndex + 1], this.panels[panelIndex]);
return panelIndex + 1;
}
movePanel(fromIndex, toIndex) {
const panelCount = this.panels.length;
if (panelCount < 2) {
return fromIndex;
}
const clampIndex = (value, max) => Math.max(0, Math.min(value, max));
const normalizedFrom = clampIndex(fromIndex, panelCount - 1);
let normalizedTo = clampIndex(toIndex, panelCount);
if (
normalizedFrom === normalizedTo ||
normalizedFrom + 1 === normalizedTo
) {
return normalizedFrom;
}
const [panel] = this.panels.splice(normalizedFrom, 1);
if (!panel) {
return normalizedFrom;
}
if (normalizedTo > normalizedFrom) {
normalizedTo--;
}
this.panels.splice(normalizedTo, 0, panel);
return normalizedTo;
}
normalizeThickness(value) {
const fallback =
typeof Post.prototype.defaultThickness === "number"
? Post.prototype.defaultThickness
: 1;
const parsed =
typeof value === "string" ? parseFloat(value) : Number(value);
if (!Number.isFinite(parsed)) {
return Math.max(0, fallback);
}
return Math.max(0, parsed);
}
}
Post.prototype.polePositions = [
"Left",
"Right",
"Overhead",
"Rural",
"Center"
];
Post.prototype.colors = [
"Silver",
"Black",
"Brown",
"Red"
];
Post.prototype.defaultThickness = 1;
Post.prototype.normalizeAlignmentGuideSpacing = function (value) {
const fallback = Post.prototype.defaultAlignmentGuideSpacing || 4;
const parsed =
typeof value === "string" ? parseFloat(value) : Number(value);
return Number.isFinite(parsed)
? Math.min(15, Math.max(1, parsed))
: fallback;
};
Post.prototype.normalizeAlignmentGuidePhase = function (value, spacing = this.alignmentGuideSpacing) {
const normalizedSpacing = this.normalizeAlignmentGuideSpacing(spacing);
const fallback = Post.prototype.defaultAlignmentGuidePhase || 0;
const parsed =
typeof value === "string" ? parseFloat(value) : Number(value);
return Number.isFinite(parsed)
? Math.min(normalizedSpacing, Math.max(0, parsed))
: Math.min(normalizedSpacing, Math.max(0, fallback));
};
Post.prototype.defaultAlignmentGuideSpacing=4;
Post.prototype.defaultAlignmentGuidePhase=0;
