// Default rotation for a guide arrow: straight down arrows point down, the
// rest point diagonally up and away from the side they sit on.
const getDefaultGuideArrowAngle = (type, alignment = "Center") => {
	const key = String(type || "");
	if (key.startsWith("DOWN") || key.startsWith("TYPE_C_") ||
		key === "TYPE_E" || key.startsWith("APL_")) return 0;
	return alignment === "Left" && ["TYPE_A", "TYPE_A_EXTENDED", "TYPE_B", "TYPE_D"].includes(key)
		? 315 : 45;
};

class Sign {

	/**
	 * Cretes a new sign.
	 * @param {Object} [opt] - Optional parameters.
	 * @param {string} [opt.controlText="New Sign"] - Control cities to display on the sign.
	 * @param {string} [opt.shieldPosition] - Where the shields should be displayed relative to the control cities.
	 * @param {boolean} [opt.shieldBacks=false] - Whether or not shields should be displayed with backings.
	 * @param {string} [opt.guideArrow] - Which guide arrow to display on the sign, if any.
	 * @param {number} [opt.guideArrowLanes=1] - Number of lanes actoss to display guide arrows.
	 * @param {string} [opt.bottomArrowKind="None"] - Arrow block asset used for standard bottom arrows.
	 * @param {number} [opt.bottomArrowRotation=0] - Rotation applied to standard bottom arrows.
	 * @param {number} [opt.bottomArrowGap=0.5] - Padding around standard bottom arrows.
	 * @param {number} [opt.bottomArrowSpacing=1] - Spacing between standard bottom arrows.
	 * @param {number} [opt.exitOnlyArrowHorizontalPadding=0] - Extra horizontal padding around arrows inside an Exit Only or Half Exit Only row.
	 * @param {string} [opt.otherSymbols] - Other symbols on the bottom of signs (like Quebec style exit markers)
	 * @param {string} [opt.oSNum=""] - Number to place on otherSymbol
	 * @param {string} [opt.actionMessage=""] - Custom subtext to display on the sign.
	 * @param {Shield[]} [opt.shields] - Array of shields to include on sign.
	 */
	constructor({
		// shield
		shieldPosition,
		shieldBacks = false,

		// arrow
		arrowMode = "Standard",
		arrows = [],
		aplArrows = [],
		combineAPLExitOnlyLabels = false,
		guideArrow,
		guideArrowLanes = 1,
		bottomArrowKind = "None",
		bottomArrowRotation = 0,
		bottomArrowGap = 0.5,
		bottomArrowSpacing = 1,
		useCanadianDownArrows = false,
		standardArrowType,
		standardArrowAngle = null,
		standardArrowFlip = false,
		standardArrowSize = 3,
		standardArrowPadding,
		standardArrowSpacing = 8.5,
		standardArrowAlignment = "Center",
		standardArrowPosition = "Down",
		exitOnlyEditorVersion = 0,
		// Exit Only defaults reproduce v2.2's Exit Only band (Type A arrow).
		exitArrowType = "TYPE_A",
		exitArrowAngle = null,
		exitArrowFlip = false,
		exitArrowSize = 3.5,
		exitArrowPadding = 0.25,
		exitArrowSpacing = 8.5,
		exitArrowAlignment = "Center",
		exitTextFont = "Series E",
		exitTextSize = 75,
		exitTextSpacing = 0,
		exitTextColor = "Inherit",
		exitBackgroundColor = "Yellow",
		exitBorderColor = "Inherit",
		exitTopBorder = false,
		exitColorEdges = true,
		exitTexasBorder = true,
		exitForceSubpanelWidth = false,
		exitSplitPlainArrowPosition = null,
		exitguideArrows = "Down Arrow",
		exitOnlyPadding = 0,
		exitOnlyArrowHorizontalPadding = 0,
		exitOnlyBorderMode,
		exitOnlyLeftText = "EXIT",
		exitOnlyRightText = "ONLY",
		exitOnlyLabelPreset = "EXIT ONLY",
		hideExitArrow = false,

		// other
		otherSymbol,
		oSNum = "",

		// subpanel
		subPanels = [],

		// global settings

		// shields
		shields = [],
		shieldDistance = 0.8,

		// main info
		controlText = "",

		// settings
		globalPositioning = "Top",

		// action message
		actionMessage = "",
		advisoryMessage = true,
		advisoryText = "",

		// panel
		padding,
		arrowPosition = "Middle",
		halfExitGap = 5
	} = {}
	) {
		if (this.shieldPositions.includes(shieldPosition)) {
			this.shieldPosition = shieldPosition;
		} else {
			this.shieldPosition = "Above";
		}
		if (this.otherSymbols.includes(otherSymbol)) {
			this.otherSymbol = otherSymbol;
		}
		else {
			this.otherSymbol = "None";
		}
		this.shieldBacks = shieldBacks;
		if (this.guideArrows.includes(guideArrow)) {
			this.guideArrow = guideArrow;
		} else {
			this.guideArrow = "None";
		}
		this.bottomArrowKind =
			typeof bottomArrowKind === "string" && bottomArrowKind.length > 0
				? bottomArrowKind
				: "None";
		const parsedBottomArrowRotation = parseFloat(bottomArrowRotation);
		this.bottomArrowRotation = Number.isFinite(parsedBottomArrowRotation)
			? parsedBottomArrowRotation
			: 0;
		const parsedBottomArrowGap = parseFloat(bottomArrowGap);
		this.bottomArrowGap = Number.isFinite(parsedBottomArrowGap)
			? Math.max(parsedBottomArrowGap, 0)
			: 0.5;
		const parsedBottomArrowSpacing = parseFloat(bottomArrowSpacing);
		this.bottomArrowSpacing = Number.isFinite(parsedBottomArrowSpacing)
			? Math.max(parsedBottomArrowSpacing, 0)
			: 1;
		if (guideArrowLanes >= 0 && guideArrowLanes <= 6) {
			this.guideArrowLanes = guideArrowLanes;
		} else {
			this.guideArrowLanes = 0;
		}
		this.useCanadianDownArrows = !!useCanadianDownArrows;

		this.standardArrowType = standardArrowType || "DOWN";
		this.standardArrowAngle = standardArrowAngle ?? getDefaultGuideArrowAngle(this.standardArrowType,
			standardArrowAlignment === "Left" || standardArrowPosition === "Left" ? "Left" : "Center");
		this.standardArrowFlip = !!standardArrowFlip;
		this.standardArrowSize = standardArrowSize;
		// v2.2's exitOnlyPadding defaults to 0, so use v2.19's 0.2 default directly.
		this.standardArrowPadding = standardArrowPadding ?? 0.2;
		this.standardArrowSpacing = standardArrowSpacing;
		this.standardArrowAlignment = standardArrowAlignment;
		this.standardArrowPosition = standardArrowPosition;
		this.exitOnlyEditorVersion = exitOnlyEditorVersion;
		this.exitArrowType = exitArrowType;
		// v2.2's Exit Only arrow points straight up.
		this.exitArrowAngle = exitArrowAngle ?? 0;
		this.exitArrowFlip = !!exitArrowFlip;
		this.exitArrowSize = exitArrowSize;
		this.exitArrowPadding = exitArrowPadding;
		this.exitArrowSpacing = exitArrowSpacing;
		this.exitArrowAlignment = guideArrow === "Half Exit Only" &&
			!["Left", "Right"].includes(exitArrowAlignment) ? "Left" : exitArrowAlignment;
		this.exitTextFont = exitTextFont;
		this.exitTextSize = exitTextSize;
		this.exitTextSpacing = exitTextSpacing;
		this.exitTextColor = exitTextColor;
		this.exitBackgroundColor = exitBackgroundColor;
		this.exitBorderColor = exitBorderColor;
		this.exitTopBorder = !!exitTopBorder;
		this.exitColorEdges = !!exitColorEdges;
		this.exitTexasBorder = !!exitTexasBorder;
		this.exitForceSubpanelWidth = !!exitForceSubpanelWidth;
		this.exitSplitPlainArrowPosition = exitSplitPlainArrowPosition == null ||
			!Number.isFinite(Number(exitSplitPlainArrowPosition)) ? null :
			Math.max(0, Math.min(1, Number(exitSplitPlainArrowPosition)));
		this.migrateLegacyBottomArrow({ standardArrowType, arrowMode });
		this.oSNum = oSNum;
		this.actionMessage = actionMessage;
		this.subPanels = subPanels;
		this.advisoryMessage = advisoryMessage;
		const defaultPadding =
			typeof Sign.prototype.defaultPadding === "string"
				? Sign.prototype.defaultPadding
				: "0.3rem 0.75rem 0.3rem 0.75rem";
		this.padding =
			typeof padding === "string" && padding.trim().length > 0
				? padding
				: defaultPadding;
		this.arrowPosition = arrowPosition;
		this.halfExitGap = halfExitGap;
		this.shields = shields;
		this.controlText = controlText;
		this.shieldDistance = shieldDistance;
		this.advisoryText = advisoryText;
		this.arrowMode = arrowMode;
		this.arrows = arrows;
		this.aplArrows = aplArrows;
		this.combineAPLExitOnlyLabels = !!combineAPLExitOnlyLabels;
		this.exitguideArrows = exitguideArrows;
		this.exitOnlyPadding = exitOnlyPadding;
		const parsedExitOnlyArrowHorizontalPadding = parseFloat(
			exitOnlyArrowHorizontalPadding
		);
		this.exitOnlyArrowHorizontalPadding = Number.isFinite(
			parsedExitOnlyArrowHorizontalPadding
		)
			? Math.min(Math.max(parsedExitOnlyArrowHorizontalPadding, 0), 6)
			: 0;
		const exitOnlyBorderModes = Sign.prototype.exitOnlyBorderModes;
		if (exitOnlyBorderModes.includes(exitOnlyBorderMode)) {
			this.exitOnlyBorderMode = exitOnlyBorderMode;
		} else {
			const defaultBorderMode =
				this.guideArrow === "Half Exit Only" ? "edge" : "white-edge";
			this.exitOnlyBorderMode = exitOnlyBorderModes.includes(
				defaultBorderMode
			)
				? defaultBorderMode
				: exitOnlyBorderModes[0];
		}
		let resolvedLeft =
			typeof exitOnlyLeftText === "string" ? exitOnlyLeftText : undefined;
		let resolvedRight =
			typeof exitOnlyRightText === "string" ? exitOnlyRightText : undefined;
		if (
			(typeof resolvedLeft === "undefined" || typeof resolvedRight === "undefined") &&
			typeof exitOnlyLabelPreset === "string" &&
			exitOnlyLabelPreset.trim().length > 0
		) {
			const parts = exitOnlyLabelPreset.trim().split(/\s+/);
			const presetLeft = parts.length ? parts[0] : "EXIT";
			const presetRight =
				parts.length > 1 ? parts.slice(1).join(" ") : presetLeft;
			if (typeof resolvedLeft === "undefined") {
				resolvedLeft = presetLeft;
			}
			if (typeof resolvedRight === "undefined") {
				resolvedRight = presetRight;
			}
		}
		if (typeof resolvedLeft !== "string") {
			resolvedLeft = "EXIT";
		}
		if (typeof resolvedRight !== "string") {
			resolvedRight = "ONLY";
		}
		this.exitOnlyLeftText = resolvedLeft;
		this.exitOnlyRightText = resolvedRight;
		const combinedLabel = [resolvedLeft, resolvedRight]
			.filter((part) => typeof part === "string" && part.trim().length > 0)
			.join(" ")
			.trim();
		this.exitOnlyLabelPreset = combinedLabel || "EXIT ONLY";
		this.hideExitArrow = !!hideExitArrow;

		if (this.globalPositioning.includes(globalPositioning)) {
			this.globalPositioning = globalPositioning;
		} else {
			this.globalPositioning = "Top";
		}

	}

	/**
	 * Create a new shield for the post. Add it to the end of the list of existing shields.
	 */

	newArrow() {
		const newArrow = new Arrow();
		this.arrows.push(newArrow);
	}

	newAPLArrow(type = "APL_UP") {
		this.aplArrows.push({
			type: type,
			flip: false,
			dividerAfter: false,
			groupedWithDivider: false,
			exitOnly: false,
			arrowMarginLeft: null,
			arrowMarginRight: null,
			exitOnlyBgColor: "yellow",
			exitOnlyPadding: null,
			exitOnlyBorderRadius: null,
			exitOnlyTextLeft: "EXIT",
			exitOnlyTextRight: "ONLY",
			exitOnlyHideLeft: false,
			exitOnlyHideRight: false
		});
	}

	deleteAPLArrow(index) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows.splice(index, 1);
		}
	}

	updateAPLArrowType(index, type) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].type = type;
		}
	}

	toggleAPLArrowFlip(index) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].flip = !this.aplArrows[index].flip;
		}
	}

	setAPLDivider(index, hasDivider) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].dividerAfter = hasDivider;
			if (!hasDivider) {
				this.aplArrows[index].groupedWithDivider = false; // Reset if divider removed
				this.aplArrows[index].exitOnly = false;
			}
		}
	}

	setAPLGroupedWithDivider(index, grouped) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].groupedWithDivider = grouped;
			if (grouped) {
				this.aplArrows[index].exitOnly = false; // Mutually exclusive
			}
		}
	}

	setAPLExitOnly(index, isExitOnly) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnly = isExitOnly;
			if (isExitOnly) {
				this.aplArrows[index].groupedWithDivider = false; // Mutually exclusive
			}
		}
	}

	setAPLArrowMarginLeft(index, margin) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].arrowMarginLeft = margin;
		}
	}

	setAPLArrowMarginRight(index, margin) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].arrowMarginRight = margin;
		}
	}

	setAPLExitOnlyBgColor(index, color) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyBgColor = color;
		}
	}

	setAPLExitOnlyPadding(index, padding) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyPadding = padding;
		}
	}

	setAPLExitOnlyBorderRadius(index, radius) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyBorderRadius = radius;
		}
	}

	setAPLExitOnlyFont(index, font) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyFont = font || null;
		}
	}

	setAPLExitOnlySize(index, size) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlySize = size;
		}
	}

	setAPLExitOnlyLetterSpacing(index, spacing) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyLetterSpacing = spacing;
		}
	}

	setAPLExitOnlyTextLeft(index, text) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyTextLeft = text;
		}
	}

	setAPLExitOnlyTextRight(index, text) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyTextRight = text;
		}
	}

	setAPLExitOnlyHideLeft(index, hidden) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyHideLeft = hidden;
		}
	}

	setAPLExitOnlyHideRight(index, hidden) {
		if (index >= 0 && index < this.aplArrows.length) {
			this.aplArrows[index].exitOnlyHideRight = hidden;
		}
	}

	deleteArrow(parentIndex, arrowIndex) {
		var selectedArrow;

		for (const arrow of this.arrows) {
			if (arrow.parentIndex == parentIndex && arrow.arrowIndex == arrowIndex) {
				selectedArrow = arrow;
				break;
			}
		}

		this.arrows.splice(this.arrows.indexOf(selectedArrow), 1);
	}

	newShield(number) {
		const newShield = new Shield();
		if (number != -1) {
			this.subPanels[number].shields.push(newShield);
		} else {
			this.shields.push(newShield);
		}
	}

	duplicateShield(shieldIndex, number) {
		const existingShield = this.subPanels[number].shields[shieldIndex];
		const newShield = new Shield({
			type: existingShield.type,
			routeNumber: existingShield.routeNumber,
			to: existingShield.to,
			specialBannerType: existingShield.specialBannerType,
			bannerType: existingShield.bannerType,
			bannerType2: existingShield.bannerType2,
			bannerPosition: existingShield.bannerPosition,
			bannerPosition2: existingShield.bannerPosition2,
			indentFirstLetter: existingShield.indentFirstLetter,
			indentFirstLetter2: existingShield.indentFirstLetter2,
			fontSize: existingShield.fontSize,
			bannerFontFamily: existingShield.bannerFontFamily
		})
		if (number != -1) {
			this.subPanels[number].shields.splice(++shieldIndex, 0, newShield);
		} else {
			this.shields.splice(++shieldIndex, 0, newShield)
		}

	}

	/**
	 * Delete an existing shield at the requested index.
	 * @param {number} shieldIndex - Position of the shield in the array of shields on this sign to delete.
	 */
	deleteShield(shieldIndex, number) {
		if (number != -1) {
			this.subPanels[number].shields.splice(shieldIndex, 1);
		} else {
			this.shields.splice(shieldIndex, 1);
		}
	}

	/**
	 * Creates a new subpanel
	*/

	newSubPanel() {
		const new_subPanel = new SubPanels();
		this.subPanels.push(new_subPanel);
	}

	/**
	  * Deletes a subpanel
	  * @param {number} subPanelIndex - you already know lol
	*/

	deleteSubPanel(subPanelIndex) {
		this.subPanels.splice(subPanelIndex, 1);
	}

	duplicateSubPanel(subPanelIndex) {
		const existingSubPanel = this.subPanels[subPanelIndex];
		if (!existingSubPanel) {
			return;
		}

		const newSubPanel =
			typeof Post !== "undefined" && typeof Post.cloneSubPanel === "function"
				? Post.cloneSubPanel(existingSubPanel)
				: new SubPanels({
					shields: existingSubPanel.shields,
					width: existingSubPanel.width,
					height: existingSubPanel.height,
					customDividerHeight: existingSubPanel.customDividerHeight
				});
		this.subPanels.splice(subPanelIndex + 1, 0, newSubPanel);
	}

}

Sign.prototype.shieldPositions = ["Left", "Above", "Right"];
// v2.2 drew standard arrows from bottomArrow*; a sign saved that way (no
// standardArrowType) loads as v2.19's Standard Arrow. Loaders call this
// again after copying saved data onto the sign.
Sign.prototype.migrateLegacyBottomArrow = function (data = {}) {
	if (
		data.standardArrowType !== undefined ||
		data.arrowMode === "apl" ||
		this.guideArrow !== "None" ||
		!this.bottomArrowKind ||
		this.bottomArrowKind === "None"
	) {
		return;
	}
	this.guideArrow = "Standard Arrow";
	this.standardArrowType = this.bottomArrowKind;
	this.standardArrowAngle = this.bottomArrowRotation;
	this.standardArrowPadding = this.bottomArrowGap;
	this.bottomArrowKind = "None";
};

Sign.prototype.guideArrows = [
	"None",
	"Standard Arrow",
	"Side Left",
	"Side Right",
	"Down Arrow:C-1",
	"Up Arrow:C-2",
	"Exit Only",
	"Split Exit Only",
	"Half Exit Only",
	"Left/Down Arrow:A-3",
	"Left Arrow:D-1",
	"Left/Up Arrow:A-4",
	"Right/Down Arrow:A-2",
	"Right Arrow:D-2",
	"Right/Up Arrow:A-1",
	"alt. Left/Down Arrow:B-3",
	"alt. Left/Up Arrow:B-4",
	"alt. Right/Up Arrow:B-1",
	"alt. Right/Down Arrow:B-2",
	"Sharp Left:E-1",
	"Sharp Right:E-2"
];
Sign.prototype.exitguideArrows = [
	"Down Arrow:EC-1/C-1",
	"Left/Up Arrow:EB-4/B-4",
	"alt. Left/Up Arrow:EA-4/A-4",
	"Right/Up Arrow:EB-1/B-1",
	"alt. Right/Up Arrow:EA-1/A-1"

];

Sign.prototype.exitOnlyBorderModes = [
	"edge",
	"white-edge"
];

Sign.prototype.defaultPadding = "0.3rem 0.75rem 0.3rem 0.75rem";

Sign.prototype.arrowPositions = [
	"Left",
	"Right",
	"Middle"
]

Sign.prototype.otherSymbols = [
	"None",
	"Quebec-Style Exit Marker",
	"Quebec-Left"
]

// this needs to be deprecreated in favor of block elements (add vertical dividers maybe?)
Sign.prototype.globalPositioning = [
	"Top",
	"Bottom",
	"Shield Top",
	"Control Top"
]
