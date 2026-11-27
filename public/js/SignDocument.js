/* Portable sign files use a schema version independent of app releases.
 * Add migrations here when changing stored data; never remove older readers.
 * Additive fields need no version bump: model constructors supply defaults.
 */
(function (root) {
  const FORMAT = 'signmaker';
  const VERSION = 1;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function decode(text) {
    const data = JSON.parse(text, (key, value) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe property in sign file.');
      return value;
    });
    if (!object(data)) throw new Error('This is not a sign file.');
    if (data.format !== undefined && data.format !== FORMAT) throw new Error('This file is not a SignMaker JSON file.');
    if (data.schemaVersion !== undefined && (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1 || data.schemaVersion > VERSION)) {
      throw new Error('Unsupported sign file version. Please use a newer version of SignMaker.');
    }
    // Pre-versioned template/post snapshots are the legacy (version 0) format.
    const post = data.post || (data.panel ? {panels: [data.panel]} : data.sign ? {panels: [data]} : data);
    if (!object(post) || !Array.isArray(post.panels) || !post.panels.length) throw new Error('The file contains no signs.');
    for (const panel of post.panels) {
      if (!object(panel) || !object(panel.sign)) throw new Error('Invalid sign panel.');
      if (panel.sign.subPanels !== undefined && (!Array.isArray(panel.sign.subPanels) || panel.sign.subPanels.some(item => !object(item)))) throw new Error('Invalid subpanels.');
      if (panel.exitTabs !== undefined && (!Array.isArray(panel.exitTabs) || panel.exitTabs.some(item => !object(item)))) throw new Error('Invalid exit tabs.');
    }
    function validate(value) {
      if (!value || typeof value !== 'object') return;
      if (value.rows !== undefined && (!Array.isArray(value.rows) || value.rows.some(row => !Array.isArray(row) || row.some(item => !object(item))))) throw new Error('Invalid sign blocks.');
      Object.values(value).forEach(validate);
    }
    validate(post);
    const customShields = data.assets?.customShields || [];
    if (!Array.isArray(customShields) || customShields.some(item => !object(item) || typeof item.id !== 'string' || typeof item.imageData !== 'string')) throw new Error('Invalid custom shields.');
    return {post, customShields};
  }
  function encode(post, customShields = []) {
    const text = JSON.stringify({format: FORMAT, schemaVersion: VERSION, post, assets: {customShields}}, null, 2);
    decode(text);
    return text;
  }
  // Stable SVG container: the embedded document owns schema versioning, so
  // JSON and SVG always use the same legacy readers and future migrations.
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const SVG_METADATA_ID = 'signmaker-document';
  function svgMetadata(text) {
    decode(text);
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<metadata id="${SVG_METADATA_ID}" data-format="signmaker" data-encoding="json">${escaped}</metadata>`;
  }
  function fromSVG(text) {
    // Parse inert XML and read only our direct metadata child. Never insert
    // imported artwork, scripts, or foreignObject content into the editor.
    if (/<!DOCTYPE/i.test(text)) throw new Error('SVG files with a DOCTYPE are not supported.');
    const xml = new root.DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = xml.documentElement;
    if (xml.getElementsByTagName('parsererror').length || svg?.localName !== 'svg' || svg.namespaceURI !== SVG_NAMESPACE) throw new Error('Invalid SVG file.');
    const metadata = Array.from(svg.children).filter(node => node.namespaceURI === SVG_NAMESPACE && node.localName === 'metadata' && node.id === SVG_METADATA_ID);
    if (!metadata.length) throw new Error('This SVG has no editable SignMaker data. Older SVG exports contain only artwork; use the original JSON or export a new SVG from SignMaker.');
    if (metadata.length !== 1 || metadata[0].children.length || metadata[0].getAttribute('data-encoding') !== 'json') throw new Error('Invalid editable SVG data.');
    const json = metadata[0].textContent;
    decode(json);
    return json;
  }
  const api = {encode, decode, svgMetadata, fromSVG};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SignMakerSignDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
