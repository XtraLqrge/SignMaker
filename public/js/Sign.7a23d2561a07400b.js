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
i="Standard",arrows:r=[],aplArrows:o=[],guideArrow:s,guideArrowLanes:n=1,standardArrowType:l="DOWN",standardArrowAngle:a=null,standardArrowFlip:d=!1,standardArrowSize:h=3,standardArrowPadding:p,standardArrowSpacing:A=8.5,standardArrowAlignment:w="Center",standardArrowPosition:g="Down",useCanadianDownArrows:c=!1,exitguideArrows:u="Down Arrow",exitOnlyPadding:x=.2,exitOnlyBorderMode:y,exitOnlyLeftText:b="EXIT",exitOnlyRightText:f="ONLY",exitOnlyLabelPreset:P="EXIT ONLY",exitOnlyEditorVersion:S=0,exitArrowType:T="DOWN",exitArrowAngle:E=null,exitArrowFlip:m=!1,exitArrowSize:O=3,exitArrowPadding:L=.2,exitArrowSpacing:D=8.5,exitArrowTextGap:C=0,exitArrowAlignment:B="Center",exitTextFont:M="Series E",exitTextSize:v=70,exitTextSpacing:k=0,exitTextColor:N="Inherit",exitBackgroundColor:F="Yellow",exitBorderColor:R="Inherit",exitTopBorder:W=!1,exitColorEdges:j=!0,exitTexasBorder:Y=!0,exitForceSubpanelWidth:U=!1,exitSplitPlainArrowPosition:V=null,hideExitArrow:_=!1,otherSymbol:
// other
I,oSNum:z="",subPanels:
// subpanel
G=[],shields:
// global settings
// shields
X=[],shieldDistance:H=.8,controlText:
// main info
Q="",globalPositioning:
// settings
q="Top",actionMessage:
// action message
J="",advisoryMessage:K=!0,advisoryText:Z="",padding:
// panel
$="0.3rem 0.75rem 0.3rem 0.75rem",arrowPosition:ee="Middle"}={}){this.shieldPositions.includes(e)?this.shieldPosition=e:this.shieldPosition="Above",this.otherSymbols.includes(I)?this.otherSymbol=I:this.otherSymbol="None",this.shieldBacks=t,this.guideArrows.includes(s)?this.guideArrow=s:this.guideArrow="None",this.guideArrowLanes=n>=0&&n<=6?n:0,this.useCanadianDownArrows=!!c,this.standardArrowType=l,this.standardArrowAngle=a??getDefaultGuideArrowAngle(l,"Left"===w||"Left"===g?"Left":"Center"),this.standardArrowFlip=!!d,this.standardArrowSize=h,this.standardArrowPadding=p??x,this.standardArrowSpacing=A,this.standardArrowAlignment=w,this.standardArrowPosition=g,this.oSNum=z,this.actionMessage=J,this.subPanels=G,this.advisoryMessage=K,this.padding=$,this.arrowPosition=ee,this.shields=X,this.controlText=Q,this.shieldDistance=H,this.advisoryText=Z,this.arrowMode=i,this.arrows=r,this.aplArrows=o,this.exitguideArrows=u,this.exitOnlyPadding=x,this.exitOnlyEditorVersion=S,this.exitArrowType=T,this.exitArrowAngle=E??getDefaultGuideArrowAngle(T,B),this.exitArrowFlip=!!m,this.exitArrowSize=O,this.exitArrowPadding=L,this.exitArrowSpacing=D,this.exitArrowTextGap=C,this.exitArrowAlignment="Half Exit Only"!==s||["Left","Right"].includes(B)?B:"Right",this.exitTextFont=M,this.exitTextSize=v,this.exitTextSpacing=k,this.exitTextColor=N,this.exitBackgroundColor=F,this.exitBorderColor=R,this.exitTopBorder=!!W,this.exitColorEdges=!!j,this.exitTexasBorder=!!Y,this.exitForceSubpanelWidth=!!U,this.exitSplitPlainArrowPosition=null!=V&&Number.isFinite(Number(V))?Math.max(0,Math.min(1,Number(V))):null;const te=Sign.prototype.exitOnlyBorderModes;if(te.includes(y))this.exitOnlyBorderMode=y;else{const e="Half Exit Only"===this.guideArrow?"edge":"white-edge";this.exitOnlyBorderMode=te.includes(e)?e:te[0]}let ie="string"==typeof b?b:void 0,re="string"==typeof f?f:void 0;if((void 0===ie||void 0===re)&&"string"==typeof P&&P.trim().length>0){const e=P.trim().split(/\s+/),t=e.length?e[0]:"EXIT",i=e.length>1?e.slice(1).join(" "):t;void 0===ie&&(ie=t),void 0===re&&(re=i)}"string"!=typeof ie&&(ie="EXIT"),"string"!=typeof re&&(re="ONLY"),this.exitOnlyLeftText=ie,this.exitOnlyRightText=re;const oe=[ie,re].filter(e=>"string"==typeof e&&e.trim().length>0).join(" ").trim();this.exitOnlyLabelPreset=oe||"EXIT ONLY",this.hideExitArrow=!!_,this.globalPositioning.includes(q)?this.globalPositioning=q:this.globalPositioning="Top"}
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
