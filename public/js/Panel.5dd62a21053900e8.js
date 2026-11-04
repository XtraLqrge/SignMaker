class Panel{
/**
   * Creates a new Panel consisting of a sign and an exit tab.
   * @param {string} color - Background color of the sign and exit tab.
   * @param {Sign} sign - Sign to make up the panel.
   * @param {String} corner - Choice of Sharp or Rounded Corners on the Panel
   * @param {ExitTab} [exitTab=null] - Optional exit tab to include in the panel.
   */
constructor(e,s,t=[],i,r){Object.keys(lib.colors).includes(s)?this.color=s:this.color="Green",Object.keys(this.cornerType).includes(i)?this.corner=i:this.corner=this.cornerType[0],this.sign=e,this.exitTabs=t,this.isVms=!1,this.borderThickness=.2,this.vmsResolution="medium",this.vmsResolutionVersion=5,this.vmsAntialias=!0,this.vmsFrameColor="#3c3e42",this.borderRadius="number"==typeof r&&r>=0?r:Panel.prototype.defaultBorderRadius}newExitTab(){const e=new ExitTab;e.borderThickness=Panel.getBorderThickness(this),this.exitTabs.push(e)}static getBorderThickness(e={}){if(!0===e.hideBorder&&null==e.borderThickness)return 0;const s=parseFloat(e.borderThickness);return Number.isFinite(s)?Math.round(10*Math.max(0,Math.min(.4,s)))/10:.2}static setBorderThickness(e,s){e.borderThickness=Panel.getBorderThickness({borderThickness:s}),delete e.hideBorder;const syncTabs=s=>(s||[]).forEach(s=>{s.borderThickness=e.borderThickness,syncTabs(s.nestedExitTabs)});syncTabs(e.exitTabs)}deleteExitTab(e,s){const t=this.exitTabs[e];t&&("number"==typeof s&&s>-1&&t.nestedExitTabs&&s<t.nestedExitTabs.length?t.nestedExitTabs.splice(s,1):this.exitTabs.splice(e,1))}duplicateExitTab(e){const s=this.exitTabs[e],t=[],i="undefined"!=typeof ExitTab&&null!=ExitTab.prototype.maxNested?ExitTab.prototype.maxNested:s.nestedExitTabs.length;for(const e of s.nestedExitTabs){if(t.length>=i)break;t.push(Object.assign(new ExitTab,e))}const r=new ExitTab({number:s.number,position:s.position,width:s.width,color:s.color,variant:s.variant,icon:s.icon,squareCorners:s.squareCorners,fullBorder:s.fullBorder,borderThickness:s.borderThickness,minHeight:s.minHeight,nestedExitTabs:t,verticalArrangement:s.verticalArrangement,caStyle:s.caStyle,profileId:s.profileId});this.exitTabs.push(r)}}
/* vvv DO NOT CHANGE THIS, IDK WHY BUT THE ENTIRE PROGRAM BREAKS WITHOUT THIS LINE vvv */Panel.prototype.cornerType=["Sharp","Round"],
/* ^^^ DO NOT CHANGE THIS, IDK WHY BUT THE ENTIRE PROGRAM BREAKS WITHOUT THIS LINE ^^^ */
Panel.prototype.defaultBorderRadius=.75;
