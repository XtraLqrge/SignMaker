class SubPanels {

	constructor({
		shields = [],
		width = 1,
		height = SubPanels.defaultHeight,
		shieldDistance = 0.8,
		blockElements,
		customDividerHeight = false,
		hideDivider = false,
	} = {}
	) {
		this.controlText = controlText;
		this.actionMessage = actionMessage;

		if (blockElements) {
			this.blockElements = blockElements;
		} else {
			this.blockElements = new Control();
			this.blockElements.rows[0] = [blockDefaults.create(ControlTextElement)];
			this.blockElements.blockProperties[0] = new Block();
		}

		this.shields = shields;
		if ((parseInt(width) < 1) || (parseInt(width) == undefined)) {
			this.width = 1;
		} else {
			this.width = parseInt(width);
		}

		Object.defineProperty(this, "height", {
			get() {
				return this._height;
			},
			set(value) {
				const normalized = SubPanels.normalizeHeight(value);
				Object.defineProperty(this, "_height", {
					value: normalized,
					enumerable: false,
					writable: true,
					configurable: true,
				});
			},
			enumerable: true,
			configurable: true,
		});

		this.height = height;
		this.shieldDistance = shieldDistance;
		this.customDividerHeight = !!customDividerHeight;
		// Hides the line before this subpanel; its space and any APL arrow stay.
		this.hideDivider = !!hideDivider;
	}
}

SubPanels.defaultHeight = "100%";
SubPanels.normalizeHeight = function (value) {
	const defaultHeight = SubPanels.defaultHeight;
	if (typeof value === "number") {
		return `${value}rem`;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return defaultHeight;
		}
		if (/^-?\d*\.?\d+$/.test(trimmed)) {
			return `${trimmed}rem`;
		}
		return trimmed;
	}
	return defaultHeight;
};
