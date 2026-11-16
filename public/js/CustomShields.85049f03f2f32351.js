class CustomShields{constructor(){this.db=new IndexDB,this.uploadField=document.getElementById("shieldUploadField"),this.fileInput=document.getElementById("uploadCustomShield"),this.savedShieldsList=document.getElementById("savedCustomShieldsList"),this.linkUploadInput=document.getElementById("linkUpload"),
// Initialize asynchronously
this.initialized=this.init()}async init(){
// Initialize drag and drop
this.setupDragAndDrop(),
// Initialize file input click
this.uploadField.addEventListener("click",()=>this.fileInput.click()),
// Initialize file input change
this.fileInput.addEventListener("change",e=>this.handleFileUpload(e.target.files)),
// Initialize URL input
this.linkUploadInput.addEventListener("keypress",e=>{"Enter"===e.key&&this.handleUrlUpload(e.target.value)}),
// Load existing shields
this.loadSavedShields()}setupDragAndDrop(){this.uploadField.addEventListener("dragover",e=>{e.preventDefault(),e.stopPropagation(),this.uploadField.classList.add("dragover")}),this.uploadField.addEventListener("dragleave",()=>{this.uploadField.classList.remove("dragover")}),this.uploadField.addEventListener("drop",e=>{e.preventDefault(),e.stopPropagation(),this.uploadField.classList.remove("dragover");const t=e.dataTransfer.files;this.handleFileUpload(t)})}async handleFileUpload(e){for(const t of e)if(t.type.startsWith("image/"))try{await this.db.saveShield(t),await this.loadSavedShields()}catch(e){console.error("Error uploading file:",e),alert("Error uploading file. Please try again.")}else alert("Please upload only image files.")}async handleUrlUpload(e){try{const t=await fetch(e),a=await t.blob(),i=e.split("/").pop(),l=new File([a],i,{type:a.type});await this.db.saveShield(l),await this.loadSavedShields(),this.linkUploadInput.value=""}catch(e){console.error("Error uploading from URL:",e),alert("Error uploading from URL. Please check the URL and try again.")}}async loadSavedShields(e){try{const t=await this.db.getAllShields();this.savedShieldsList.innerHTML="",t.forEach(t=>{const a=document.createElement("div");a.className="customShieldItem",a.innerHTML=`\n                    <img src="${t.data}" class="shieldItemImg">\n                    <span class="shieldItemName">${t.fileName}</span>\n                    <button class="deleteCustomShieldBtn" data-filename="${t.fileName}">\n                        <span class="material-symbols-outlined">delete</span>\n                    </button>\n                `,
// Add delete functionality
a.querySelector(".deleteCustomShieldBtn").addEventListener("click",async e=>{e.stopPropagation(),confirm("Are you sure you want to delete this shield?")&&(await this.db.deleteShield(t.fileName),await this.loadSavedShields())}),e&&a.addEventListener("click",()=>e(t)),this.savedShieldsList.appendChild(a)})}catch(e){console.error("Error loading shields:",e)}}}
