const cloneSignMakerValue=(t,e=new WeakMap)=>{if(null===t||"object"!=typeof t)return t;if(e.has(t))return e.get(t);if(Array.isArray(t)){const s=[];e.set(t,s);for(const n of t)s.push(cloneSignMakerValue(n,e));return s}const s=Object.create(Object.getPrototypeOf(t));e.set(t,s);for(const n of Object.keys(t))s[n]=cloneSignMakerValue(t[n],e);return s};class Post{
/**
   * Post that contains the panels.
   * @param {string} polePosition - Position of the poles on which to display the panels.
   * @param {number} [lanesWide=1] - How many lanes wide the post should appear to be.
   * @param {string} [color=Post.prototype.colors[0]] - Visual color treatment for the post.
   */
constructor(t,e=1,s=Post.prototype.colors?.[0]){this.polePositions.includes(t)?this.polePosition=t:this.polePosition=this.polePositions[0],this.lanesWide=e>=1&&e<=6?e:1;const n=Array.isArray(Post.prototype.colors)?Post.prototype.colors:["Silver"];n.includes(s)?this.color=s:this.color=n[0];const i="number"==typeof Post.prototype.defaultThickness?Post.prototype.defaultThickness:1;this.thickness=this.normalizeThickness(i),this.copySignsOnly=!0,this.showBlockBoundingBoxes=!1,this.showAlignmentGuides=!1,this.alignmentGuideSpacing=4,this.alignmentGuidePhase=0,this.panels=[],this.panelSpacing=1}
/**
   * Create a new panel for the post. Add it to the end of the list of existing panels.
   */newPanel(){const t=new Sign;t.newSubPanel();const e=new Panel(t,void 0),s=new ExitTab;e.exitTabs.push(s),this.panels.push(e)}
/**
   * Duplicate an existing panel. Add it immediately after the panel being duplicated.
   * @param {number} panelIndex - Position of the panel in the array of panels on this post.
   */
/**
   * Duplicate an existing panel. Add it immediately after the panel being duplicated.
   * @param {number} panelIndex - Position of the panel in the array of panels on this post.
   */duplicatePanel(t){const e=this.panels[t];if(!e)return;const s=cloneSignMakerValue(e);this.panels.splice(t+1,0,s)}
/**
   * Delete an existing panel at the requested index.
   * @param {number} panelIndex - Position of the panel in the array of panels on this post to delete.
   */deletePanel(t){this.panels.splice(t,1)}
/**
   * Shift the requested panel to the left one position swapping it with that panel to the left.
   * @param {number} panelIndex - Position of the panel in the array of panels on this post to shift left.
   * @return {number} The new index of the shifted panel.
   */shiftLeft(t){
// If already at the far left end, return.
return t<=0?t:(this.panels.splice(t-1,2,this.panels[t],this.panels[t-1]),t-1)}
/**
   * Shift the requested panel to the right one position swaping it with that panel to the right.
   * @param {number} panelIndex - Position of the panel in the array of panels on this post to shift right.
   * @return {number} The new index of the shifted panel.
   */shiftRight(t){
// If already at the far right end, return.
return t>=this.panels.length-1?t:(this.panels.splice(t,2,this.panels[t+1],this.panels[t]),t+1)}
/**
   * Move a panel to a new position within the list.
   * @param {number} fromIndex - Current position of the panel.
   * @param {number} toIndex - Target insertion index (before adjustment for removal).
   * @return {number} The new index of the moved panel.
   */movePanel(t,e){const s=this.panels.length;if(s<2)return t;const clampIndex=(t,e)=>Math.max(0,Math.min(t,e)),n=clampIndex(t,s-1);let i=clampIndex(e,s);if(n===i||n+1===i)return n;const[o]=this.panels.splice(n,1);return o?(i>n&&i--,this.panels.splice(i,0,o),i):n}normalizeThickness(t){const e="number"==typeof Post.prototype.defaultThickness?Post.prototype.defaultThickness:1,s="string"==typeof t?parseFloat(t):Number(t);return Number.isFinite(s)?Math.max(0,s):Math.max(0,e)}}Post.prototype.polePositions=["Left","Right","Overhead","Rural","Center"],Post.prototype.colors=["Silver","Black","Brown","Red"],Post.prototype.defaultThickness=1,Post.prototype.normalizeAlignmentGuideSpacing=function(t){const e=Post.prototype.defaultAlignmentGuideSpacing||4,s="string"==typeof t?parseFloat(t):Number(t);return Number.isFinite(s)?Math.min(15,Math.max(1,s)):e},Post.prototype.normalizeAlignmentGuidePhase=function(t,e=this.alignmentGuideSpacing){const s=this.normalizeAlignmentGuideSpacing(e),n=Post.prototype.defaultAlignmentGuidePhase||0,i="string"==typeof t?parseFloat(t):Number(t);return Number.isFinite(i)?Math.min(s,Math.max(0,i)):Math.min(s,Math.max(0,n))},Post.prototype.defaultAlignmentGuideSpacing=4,Post.prototype.defaultAlignmentGuidePhase=0;
