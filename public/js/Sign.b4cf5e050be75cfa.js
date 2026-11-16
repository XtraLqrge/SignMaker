const cloneSignModelValue=(e,t=new WeakMap)=>{if(null===e||"object"!=typeof e)return e;if(t.has(e))return t.get(e);if(Array.isArray(e)){const i=[];t.set(e,i);for(const r of e)i.push(cloneSignModelValue(r,t));return i}const i=Object.create(Object.getPrototypeOf(e));t.set(e,i);for(const r of Object.keys(e))i[r]=cloneSignModelValue(e[r],t);return i},getDefaultGuideArrowAngle=(e,t="Center")=>{const i=String(e||"");return i.startsWith("DOWN")||i.startsWith("TYPE_C_")||"TYPE_E"===i||i.startsWith("APL_")?0:"Left"===t&&["TYPE_A","TYPE_A_EXTENDED","TYPE_B","TYPE_D"].includes(i)?315:45};class Sign{
/**
   * Cretes a new sign.
   * @param {Object} [opt] - Optional parameters.
   * @param {string} [opt.controlText="New Sign"] - Control cities to display on the sign.
   * @param {string} [opt.shieldPosition] - Where the shields should be displayed relative to the control cities.
   * @param {boolean} [opt.shieldBacks=false] - Whether or not shields should be displayed with backings.
   * @param {string} [opt.guideArrow] - Which guide arrow to display on the sign, if any.
   * @param {number} [opt.guideArrowLanes=1] - Number of lanes actoss to display guide arrows.
   * @param {string} [opt.otherSymbols] - Other symbols on the bottom of signs (like Quebec style exit markers)
   * @param {string} [opt.oSNum=""] - Number to place on otherSymbol
   * @param {string} [opt.actionMessage=""] - Custom subtext to display on the sign.
   * @param {Shield[]} [opt.shields] - Array of shields to include on sign.
   */
constructor({shieldPosition:
// shield
e,shieldBacks:t=!1,arrowMode:
// arrow
i="Standard",arrows:r=[],aplArrows:o=[],diagrammatic:s,roundabout:n,guideArrow:l,guideArrowLanes:a=1,standardArrowType:d="DOWN",standardArrowAngle:h=null,standardArrowFlip:p=!1,standardArrowSize:A=3,standardArrowPadding:w,standardArrowSpacing:g=8.5,standardArrowAlignment:u="Center",standardArrowPosition:c="Down",useCanadianDownArrows:x=!1,exitguideArrows:y="Down Arrow",exitOnlyPadding:b=.2,exitOnlyBorderMode:P,exitOnlyLeftText:f="EXIT",exitOnlyRightText:S="ONLY",exitOnlyLabelPreset:T="EXIT ONLY",exitOnlyEditorVersion:m=0,exitArrowType:E="DOWN",exitArrowAngle:O=null,exitArrowFlip:L=!1,exitArrowSize:D=3,exitArrowPadding:C=.2,exitArrowHorizontalPadding:B=.2,exitArrowSpacing:M=8.5,exitArrowAlignment:v="Center",exitTextFont:k="Series E",exitTextSize:N=70,exitTextSpacing:F=0,exitTextColor:R="Inherit",exitBackgroundColor:W="Yellow",exitBorderColor:V="Inherit",exitTopBorder:j=!1,exitColorEdges:Y=!0,exitTexasBorder:z=!0,exitForceSubpanelWidth:U=!1,exitSplitPlainArrowPosition:_=null,hideExitArrow:I=!1,otherSymbol:
// other
H,oSNum:X="",subPanels:
// subpanel
G=[],shields:
// global settings
// shields
Q=[],shieldDistance:q=.8,controlText:
// main info
J="",globalPositioning:
// settings
K="Top",actionMessage:
// action message
Z="",advisoryMessage:$=!0,advisoryText:ee="",padding:
// panel
te="0.3rem 0.75rem 0.3rem 0.75rem",arrowPosition:ie="Middle"}={}){this.shieldPositions.includes(e)?this.shieldPosition=e:this.shieldPosition="Above",this.otherSymbols.includes(H)?this.otherSymbol=H:this.otherSymbol="None",this.shieldBacks=t,this.guideArrows.includes(l)?this.guideArrow=l:this.guideArrow="None",this.guideArrowLanes=a>=0&&a<=6?a:0,this.useCanadianDownArrows=!!x,this.standardArrowType=d,this.standardArrowAngle=h??getDefaultGuideArrowAngle(d,"Left"===u||"Left"===c?"Left":"Center"),this.standardArrowFlip=!!p,this.standardArrowSize=A,this.standardArrowPadding=w??b,this.standardArrowSpacing=g,this.standardArrowAlignment=u,this.standardArrowPosition=c,this.oSNum=X,this.actionMessage=Z,this.subPanels=G,this.advisoryMessage=$,this.padding=te,this.arrowPosition=ie,this.shields=Q,this.controlText=J,this.shieldDistance=q,this.advisoryText=ee,this.arrowMode=i,this.diagrammatic=cloneSignModelValue(s||{}),this.roundabout=cloneSignModelValue(n||{}),this.arrows=r,this.aplArrows=o,this.exitguideArrows=y,this.exitOnlyPadding=b,this.exitOnlyEditorVersion=m,this.exitArrowType=E,this.exitArrowAngle=O??getDefaultGuideArrowAngle(E,v),this.exitArrowFlip=!!L,this.exitArrowSize=D,this.exitArrowPadding=C,this.exitArrowHorizontalPadding=B,this.exitArrowSpacing=M,this.exitArrowAlignment="Half Exit Only"!==l||["Left","Right"].includes(v)?v:"Right",this.exitTextFont=k,this.exitTextSize=N,this.exitTextSpacing=F,this.exitTextColor=R,this.exitBackgroundColor=W,this.exitBorderColor=V,this.exitTopBorder=!!j,this.exitColorEdges=!!Y,this.exitTexasBorder=!!z,this.exitForceSubpanelWidth=!!U,this.exitSplitPlainArrowPosition=null!=_&&Number.isFinite(Number(_))?Math.max(0,Math.min(1,Number(_))):null;const re=Sign.prototype.exitOnlyBorderModes;if(re.includes(P))this.exitOnlyBorderMode=P;else{const e="Half Exit Only"===this.guideArrow?"edge":"white-edge";this.exitOnlyBorderMode=re.includes(e)?e:re[0]}let oe="string"==typeof f?f:void 0,se="string"==typeof S?S:void 0;if((void 0===oe||void 0===se)&&"string"==typeof T&&T.trim().length>0){const e=T.trim().split(/\s+/),t=e.length?e[0]:"EXIT",i=e.length>1?e.slice(1).join(" "):t;void 0===oe&&(oe=t),void 0===se&&(se=i)}"string"!=typeof oe&&(oe="EXIT"),"string"!=typeof se&&(se="ONLY"),this.exitOnlyLeftText=oe,this.exitOnlyRightText=se;const ne=[oe,se].filter(e=>"string"==typeof e&&e.trim().length>0).join(" ").trim();this.exitOnlyLabelPreset=ne||"EXIT ONLY",this.hideExitArrow=!!I,this.globalPositioning.includes(K)?this.globalPositioning=K:this.globalPositioning="Top"}
/**
   * Create a new shield for the post. Add it to the end of the list of existing shields.
   */newArrow(){const e=new Arrow;this.arrows.push(e)}newAPLArrow(e="APL_UP"){this.aplArrows.push({type:e,flip:!1,dividerAfter:!1,groupedWithDivider:!1,exitOnly:!1})}deleteAPLArrow(e){e>=0&&e<this.aplArrows.length&&this.aplArrows.splice(e,1)}updateAPLArrowType(e,t){e>=0&&e<this.aplArrows.length&&(this.aplArrows[e].type=t)}toggleAPLArrowFlip(e){e>=0&&e<this.aplArrows.length&&(this.aplArrows[e].flip=!this.aplArrows[e].flip)}setAPLDivider(e,t){e>=0&&e<this.aplArrows.length&&(this.aplArrows[e].dividerAfter=t,t||(this.aplArrows[e].groupedWithDivider=!1,// Reset if divider removed
this.aplArrows[e].exitOnly=!1))}setAPLGroupedWithDivider(e,t){e>=0&&e<this.aplArrows.length&&(this.aplArrows[e].groupedWithDivider=t,t&&(this.aplArrows[e].exitOnly=!1))}setAPLExitOnly(e,t){e>=0&&e<this.aplArrows.length&&(this.aplArrows[e].exitOnly=t,t&&(this.aplArrows[e].groupedWithDivider=!1))}deleteArrow(e,t){var i;for(const r of this.arrows)if(r.parentIndex==e&&r.arrowIndex==t){i=r;break}this.arrows.splice(this.arrows.indexOf(i),1)}newShield(e){const t=new Shield;-1!=e?this.subPanels[e].shields.push(t):this.shields.push(t)}duplicateShield(e,t){const i=this.subPanels[t].shields[e],r=new Shield({type:i.type,routeNumber:i.routeNumber,to:i.to,specialBannerType:i.specialBannerType,bannerType:i.bannerType,bannerType2:i.bannerType2,bannerPosition:i.bannerPosition,bannerPosition2:i.bannerPosition2,indentFirstLetter:i.indentFirstLetter,indentFirstLetter2:i.indentFirstLetter2,fontSize:i.fontSize,bannerFontFamily:i.bannerFontFamily});-1!=t?this.subPanels[t].shields.splice(++e,0,r):this.shields.splice(++e,0,r)}
/**
   * Delete an existing shield at the requested index.
   * @param {number} shieldIndex - Position of the shield in the array of shields on this sign to delete.
   */deleteShield(e,t){-1!=t?this.subPanels[t].shields.splice(e,1):this.shields.splice(e,1)}
/**
   * Creates a new subpanel
  */newSubPanel(){const e=new SubPanels;this.subPanels.push(e)}
/**
    * Deletes a subpanel
    * @param {number} subPanelIndex - you already know lol
  */deleteSubPanel(e){this.subPanels.splice(e,1)}duplicateSubPanel(e){const t=this.subPanels[e];if(!t)return null;const cloneBlockElement=e=>{const t=cloneSignModelValue(e);if("undefined"==typeof Control||!Control.prototype||!Control.prototype.blockToClassElems)return t;let i=Control.prototype.blockToClassElems.getElem(t);!i&&t&&t.constructor&&Control.prototype.blockToClassElems[t.constructor.name]&&(i=t.constructor.name);const r=i?Control.prototype.blockToClassElems[i]:null;return"function"==typeof r?Object.assign(new r,t):t},i=cloneSignModelValue(t),r=new SubPanels({shields:i.shields||[],width:i.width,height:i.height,shieldDistance:i.shieldDistance,blockElements:(e=>{const t=cloneSignModelValue(e),i="function"==typeof Control?Object.assign(new Control,t||{}):t;return i&&"object"==typeof i?(Array.isArray(i.rows)&&(i.rows=i.rows.map(e=>Array.isArray(e)?e.map(cloneBlockElement):[])),Array.isArray(i.blockProperties)&&(i.blockProperties=i.blockProperties.map(e=>{const t=cloneSignModelValue(e);return"function"==typeof Block?Object.assign(new Block,t||{}):t})),i):i})(t.blockElements),customDividerHeight:i.customDividerHeight});return Object.keys(i).forEach(e=>{"blockElements"!==e&&(r[e]=cloneSignModelValue(i[e]))}),this.subPanels.splice(e+1,0,r),r}}Sign.prototype.shieldPositions=["Left","Above","Right"],Sign.prototype.guideArrows=["None","Standard Arrow","Side Left","Side Right","Down Arrow:C-1","Up Arrow:C-2","Exit Only","Split Exit Only","Half Exit Only","Left/Down Arrow:A-3","Left Arrow:D-1","Left/Up Arrow:A-4","Right/Down Arrow:A-2","Right Arrow:D-2","Right/Up Arrow:A-1","alt. Left/Down Arrow:B-3","alt. Left/Up Arrow:B-4","alt. Right/Up Arrow:B-1","alt. Right/Down Arrow:B-2","Sharp Left:E-1","Sharp Right:E-2"],Sign.prototype.exitguideArrows=["Down Arrow:EC-1/C-1","Left/Up Arrow:EA-4/A-4","Alt. Left/Up Arrow:EB-4/B-4","Right/Up Arrow:EA-1/A-1","Alt. Right/Up Arrow:EB-1/B-1"],Sign.prototype.exitOnlyBorderModes=["edge","white-edge"],Sign.prototype.arrowPositions=["Middle","Left","Right"],Sign.prototype.otherSymbols=["None","Quebec-Style Exit Marker","Quebec-Left"],
// this needs to be deprecreated in favor of block elements (add vertical dividers maybe?)
Sign.prototype.globalPositioning=["Top","Bottom","Shield Top","Control Top"];
