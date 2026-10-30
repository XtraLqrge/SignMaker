const normalizeExitTabBoolean = (value) =>
	value === true ||
	value === "true" ||
	value === 1 ||
	value === "1" ||
	value === "on";

class ExitTab {
	/**
	 * Creates a new ExitTab.
	 * @param {string} number - Number to display on the exit tab.
	 * @param {string} [position=null] - Position to display the exit tab relative to the sign.
	 * @param {string} [width=null] - Width of the exit tab (narrow or wide).
	 */
	constructor({
		number = null,
		position = ExitTab.prototype.defaultPosition,
		width = ExitTab.prototype.defaultWidth,
		color = null,
		variant = "Default",
		icon = null,
		useTextBasedIcon = false,
		fullBorder = ExitTab.prototype.defaultFullBorder,
		squareCorners = ExitTab.prototype.defaultSquareCorners,
		extendHorizontalPadding = false,
		matchSignCornerRadius = false,
		cornerRadius = ExitTab.prototype.defaultCornerRadius,
		horizontalPadding = ExitTab.prototype.defaultHorizontalPadding,
		attached = ExitTab.prototype.defaultAttached,
		topOffset = ExitTab.prototype.defaultTopOffset,
		showLeft = false,
		borderThickness = 0.2,
		minHeight = 2.25,
		nestedExitTabs = [],
		nestedTabSpacing = 0,
		dragOffsetRem = 0,
		FHWAFont = ExitTab.prototype.defaultFHWAFont,
		fontFamily = null,
		fontSize = 18,
		characterSpacing = 0,
		textColor = "Panel Color",
		exitTextSizePercent = ExitTab.prototype.defaultExitTextSizePercent,
		exitTextSizePercentVersion = ExitTab.prototype.exitTextSizePercentVersion,
		transparent = false,
		bilingual = false,
		bilingualTopText = "EXIT",
		bilingualBottomText = "SORTIE",
		tollLogoOnly = true,
		tollLogoSquare = false,
		tollLogoSize = null,
		verticalArrangement = ExitTab.prototype.defaultVerticalArrangement,
		caStyle = ExitTab.prototype.defaultCAStyle
	} = {}
	) {
		this.number = number;
		const defaultPosition = this.positions.includes(
			ExitTab.prototype.defaultPosition
		)
			? ExitTab.prototype.defaultPosition
			: this.positions[1];
		if (this.positions.includes(position)) {
			this.position = position;
		} else {
			this.position = defaultPosition;
		}
		const defaultWidth = this.widths.includes(ExitTab.prototype.defaultWidth)
			? ExitTab.prototype.defaultWidth
			: this.widths[0];
		if (this.widths.includes(width)) {
			this.width = width;
		} else {
			this.width = defaultWidth;
		}
		if (this.colors.includes(color)) {
			this.color = color;
		} else {
			this.color = this.colors[0];
		}

		if (this.variants.includes(variant)) {
			this.variant = variant;
		} else {
			this.variant = this.variants[0];
		}

		const sourceOptions =
			arguments.length > 0 &&
			arguments[0] &&
			typeof arguments[0] === "object"
				? arguments[0]
				: null;
		const hasOption = (key) => sourceOptions?.[key] !== undefined;

		this.fullBorder = fullBorder;
		this.squareCorners = normalizeExitTabBoolean(squareCorners);
		// v2.2 saves used checkboxes for these; v2.19's sliders replace them.
		// Before the checkboxes were separated, squareCorners also extended the
		// padding, so older tabs without either setting keep that look.
		const extendedPadding = hasOption("extendHorizontalPadding")
			? normalizeExitTabBoolean(extendHorizontalPadding)
			: this.squareCorners;
		this.horizontalPadding = hasOption("horizontalPadding")
			? ExitTab.normalizeHorizontalPadding(horizontalPadding)
			: sourceOptions && (hasOption("extendHorizontalPadding") || hasOption("squareCorners"))
				? (extendedPadding ? ExitTab.prototype.extendedHorizontalPadding : 0)
				: ExitTab.normalizeHorizontalPadding(horizontalPadding);
		this.cornerRadius = hasOption("cornerRadius")
			? ExitTab.normalizeCornerRadius(cornerRadius)
			: hasOption("matchSignCornerRadius")
				? (normalizeExitTabBoolean(matchSignCornerRadius) ? "panel" : 0.5)
				: ExitTab.normalizeCornerRadius(cornerRadius);
		this.attached = !!attached;
		const parsedBorderThickness =
			typeof borderThickness === "number"
				? borderThickness
				: parseFloat(borderThickness);
		const fallbackBorderThickness =
			typeof ExitTab.prototype.defaultBorderThickness === "number"
				? ExitTab.prototype.defaultBorderThickness
				: 0.2;
		this.borderThickness = Number.isFinite(parsedBorderThickness)
			? Math.max(0, parsedBorderThickness)
			: fallbackBorderThickness;
		this.topOffset = topOffset;
		this.minHeight = minHeight;
		this.nestedExitTabs = nestedExitTabs;
		const parsedNestedTabSpacing =
			typeof nestedTabSpacing === "number"
				? nestedTabSpacing
				: parseFloat(nestedTabSpacing);
		this.nestedTabSpacing = Number.isFinite(parsedNestedTabSpacing)
			? Math.max(0, parsedNestedTabSpacing)
			: 0;
		// v2.19 sideways drag along the sign, in rem.
		this.dragOffsetRem = Number.isFinite(Number(dragOffsetRem)) ? Number(dragOffsetRem) : 0;
		const explicitFont = typeof fontFamily === "string" && fontFamily.trim()
			? fontFamily.trim()
			: null;
		this.fontFamily = explicitFont ||
			(hasOption("FHWAFont")
				? (FHWAFont ? "Series E" : ExitTab.prototype.defaultClearviewFont)
				: ExitTab.prototype.defaultFontFamily);
		this.FHWAFont = /^Series\s/i.test(this.fontFamily);
		this.icon = icon;
		this.showLeft = showLeft;
		this.fontSize = fontSize;
		const parsedSpacing = parseFloat(characterSpacing);
		this.characterSpacing = Number.isFinite(parsedSpacing)
			? Math.max(-0.15, Math.min(0.25, parsedSpacing))
			: 0;
		this.textColor = typeof textColor === "string" && textColor.trim()
			? textColor.trim()
			: "Panel Color";
		// v2.19 saves before version 3 stored 100 or 60 meaning "default".
		const parsedTextSize = parseFloat(exitTextSizePercent);
		const isLegacyTextSize =
			parseInt(exitTextSizePercentVersion, 10) !== ExitTab.prototype.exitTextSizePercentVersion &&
			(parsedTextSize === 100 || parsedTextSize === 60);
		this.exitTextSizePercent = Number.isFinite(parsedTextSize) && !isLegacyTextSize
			? Math.max(25, Math.min(100, parsedTextSize))
			: ExitTab.prototype.defaultExitTextSizePercent;
		this.exitTextSizePercentVersion = ExitTab.prototype.exitTextSizePercentVersion;
		this.transparent = transparent === true || transparent === "true";
		this.bilingual = bilingual === true || bilingual === "true";
		this.bilingualTopText = typeof bilingualTopText === "string" && bilingualTopText.trim()
			? bilingualTopText
			: "EXIT";
		this.bilingualBottomText = typeof bilingualBottomText === "string" && bilingualBottomText.trim()
			? bilingualBottomText
			: "SORTIE";
		this.verticalArrangement = verticalArrangement;
		this.caStyle = caStyle;
		const defaultTollLogoSize =
			typeof ExitTab.prototype.defaultTollLogoSize === "number"
				? ExitTab.prototype.defaultTollLogoSize
				: 3;
		this.tollLogoOnly = !!tollLogoOnly;
		this.tollLogoSquare = !!tollLogoSquare;
		const parsedTollLogoSize =
			typeof tollLogoSize === "number" ? tollLogoSize : parseFloat(tollLogoSize);
		this.tollLogoSize = Number.isFinite(parsedTollLogoSize) && parsedTollLogoSize > 0
			? parsedTollLogoSize
			: defaultTollLogoSize;
		if (
			Array.isArray(this.nestedExitTabs) &&
			ExitTab.prototype.maxNested != null &&
			this.nestedExitTabs.length > ExitTab.prototype.maxNested
		) {
			this.nestedExitTabs = this.nestedExitTabs.slice(
				0,
				ExitTab.prototype.maxNested
			);
		}
	}

	nestExitTab() {
		if (this.nestedExitTabs.length >= ExitTab.prototype.maxNested) {
			return null;
		}
		const exitTab = new ExitTab();
		this.nestedExitTabs.push(exitTab);
		return exitTab;
	}

	deleteNestExitTab(index) {
		this.nestedExitTabs.splice(index, 1);
	}

	duplicateNestExitTab(index) {
		if (this.nestedExitTabs.length >= ExitTab.prototype.maxNested) {
			return null;
		}
		const exisitingTab = this.nestedExitTabs[index];
		if (!exisitingTab) {
			return null;
		}
		const exitTab = new ExitTab({
			number: exisitingTab.number,
			position: exisitingTab.position,
			width: exisitingTab.width,
			color: exisitingTab.color,
			variant: exisitingTab.variant,
			icon: exisitingTab.icon,
			squareCorners: exisitingTab.squareCorners,
			cornerRadius: exisitingTab.cornerRadius,
			horizontalPadding: exisitingTab.horizontalPadding,
			fontFamily: exisitingTab.fontFamily,
			fontSize: exisitingTab.fontSize,
			characterSpacing: exisitingTab.characterSpacing,
			textColor: exisitingTab.textColor,
			exitTextSizePercent: exisitingTab.exitTextSizePercent,
			transparent: exisitingTab.transparent,
			bilingual: exisitingTab.bilingual,
			bilingualTopText: exisitingTab.bilingualTopText,
			bilingualBottomText: exisitingTab.bilingualBottomText,
			fullBorder: exisitingTab.fullBorder,
			attached: exisitingTab.attached,
			borderThickness: exisitingTab.borderThickness,
			minHeight: exisitingTab.minHeight,
			tollLogoOnly: exisitingTab.tollLogoOnly,
			tollLogoSquare: exisitingTab.tollLogoSquare,
			tollLogoSize: exisitingTab.tollLogoSize,
			verticalArrangement: exisitingTab.verticalArrangement,
			caStyle: exisitingTab.caStyle
		});

		this.nestedExitTabs.push(exitTab);
		return exitTab;
	}

	static normalizeCornerRadius(value) {
		if (value === "panel") {
			return "panel";
		}
		const parsed = parseFloat(value);
		return Number.isFinite(parsed) ? Math.max(0, Math.min(2, parsed)) : 0.5;
	}

	static normalizeHorizontalPadding(value) {
		const parsed = parseFloat(value);
		return Number.isFinite(parsed) ? Math.max(-1, Math.min(3, parsed)) : 0;
	}
}

ExitTab.prototype.positions = ["Left", "Center", "Right"];
ExitTab.prototype.variants = ["Default", "Toll Logo", "Icon", "Full Left", "Stacked", "HOV 1", "HOV 2", "Quebec Exit Marker"];
ExitTab.prototype.widths = ["Narrow", "Wide", "Full", "Edge", "Out", "Side"];
ExitTab.prototype.defaultPosition = "Center";
ExitTab.prototype.defaultWidth = "Narrow";
ExitTab.prototype.defaultBorderThickness = 0.2;
ExitTab.prototype.defaultTollLogoSize = 3;
ExitTab.prototype.defaultFullBorder = false;
ExitTab.prototype.defaultSquareCorners = false;
// The old "Extend Padding" checkbox padded tabs out to 1.3rem a side.
ExitTab.prototype.extendedHorizontalPadding = 0.8;
ExitTab.prototype.defaultHorizontalPadding = 0;
ExitTab.prototype.defaultCornerRadius = 0.5;
ExitTab.prototype.defaultExitTextSizePercent = 67;
ExitTab.prototype.exitTextSizePercentVersion = 3;
ExitTab.prototype.defaultAttached = false;
ExitTab.prototype.defaultTopOffset = true;
ExitTab.prototype.defaultFHWAFont = false;
ExitTab.prototype.defaultClearviewFont = "Clearview 4";
ExitTab.prototype.defaultFontFamily = "Clearview 4";
ExitTab.prototype.defaultVerticalArrangement = false;
ExitTab.prototype.defaultCAStyle = false;
ExitTab.prototype.colors = (() => {
	const colors = ["Panel Color"];
	if (typeof lib !== "undefined" && lib?.colors) {
		colors.push(...Object.keys(lib.colors));
	} else {
		colors.push(
			"Green",
			"Blue",
			"Brown",
			"Yellow",
			"White",
			"Black",
			"Purple",
			"Orange",
			"Red",
			"Fluorescent Pink",
			"Fluorescent Yellow-Green"
		);
	}
	return colors;
})();
ExitTab.prototype.icons = [
	"Hazardous Materials:HM.png:var(--white):var(--white)",
	"No Hazardous Materials:NO-HM.png:var(--white):var(--white)",
	"Hospital:H.png:var(--blue):var(--white)"
]
ExitTab.prototype.maxNested = 999;
