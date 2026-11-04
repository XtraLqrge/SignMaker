
const lib = (function() {
const clearChildren = function(parentElmt) {
while (parentElmt.firstChild) {
parentElmt.removeChild(parentElmt.firstChild);
}
};
const appendOption = function(selectElmt, value, {selected = false, text} = {}) {
if (!text) {
text = value;
}
const optionElmt = document.createElement("option");
optionElmt.value = value;
optionElmt.selected = selected;
optionElmt.appendChild(document.createTextNode(text));
selectElmt.appendChild(optionElmt);
};
const colors = {
Green : "rgb(0, 95, 77)",
Blue : "rgb(0, 67, 123)",
Brown : "rgb(98, 51, 30)",
Yellow : "rgb(252, 207, 52)",
White : "rgb(255, 255, 255)",
Black : "rgb(0, 0, 0)",
Purple : "#4B0082",
Orange : "rgb(255, 89, 4)",
Red : "rgb(255, 0, 0)",
"Fluorescent Pink" : "rgb(255, 51, 204)",
"Fluorescent Yellow-Green" : "rgb(153, 255, 0)"
};
const shieldPositions = {
Left : "row",
Above : "column",
Right : "row-reverse"
};
return {
clearChildren : clearChildren,
appendOption : appendOption,
colors : colors,
shieldPositions : shieldPositions
};
})();
