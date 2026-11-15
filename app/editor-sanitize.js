/* Sanitiser for the notebook editor's rich text.
 *
 * The editor is a contentEditable whose HTML is saved to localStorage and put
 * back into the page on every visit. That round trip is the app's one real
 * script-injection path: a paste or drop from a web page can carry markup like
 * <img src=x onerror=…>, and anything that reaches storage — a paste, a hand
 * edit, a value written by something else on the device — would run the moment
 * it was written back into the live document.
 *
 * So editor HTML passes through here wherever it enters: paste, drop, restore
 * from storage, and again on save so storage itself stays clean. It is an
 * allowlist — only what the editor genuinely produces survives: text formatting,
 * lists, headings, quotes, alignment, highlight colour, drawings and images as
 * raster data: images, and formula spans. Anything else is unwrapped to its
 * text, or removed outright if it's the kind of element that exists to run or
 * load something.
 *
 * Parsing happens in an inert DOMParser document, where nothing executes and
 * nothing loads, and results go into the page as imported nodes rather than as
 * a string, so the cleaned markup isn't re-parsed on the way in.
 *
 * Loaded from <head>, not the helmet: the editor restores its content on mount,
 * and a sanitiser that arrived late would leave it empty — and the next save
 * would then overwrite the chapter.
 */
(function () {
  // Removed together with everything inside them.
  var DROP = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET',
    'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT',
    'OPTION', 'OPTGROUP', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS', 'AUDIO',
    'VIDEO', 'SOURCE', 'TRACK', 'PORTAL', 'DIALOG', 'TITLE', 'HEAD', 'PICTURE',
    'MAP', 'AREA', 'PARAM', 'XMP', 'PLAINTEXT', 'LISTING', 'NOEMBED', 'NOFRAMES',
  ]);

  // Kept, with only their allowed attributes.
  var KEEP = new Set([
    'DIV', 'P', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
    'INS', 'MARK', 'SUB', 'SUP', 'SMALL', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5',
    'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'A', 'IMG',
  ]);

  // Classes the editor itself assigns. Anything else is dropped, so pasted
  // content can't borrow the app's own styles to dress itself up as UI.
  var CLASS_ALLOW = new Set(['nb-formula', 'nb-formula-block', 'nb-drawing']);
  var STYLE_ALLOW = new Set([
    'text-align', 'background-color', 'color', 'font-weight', 'font-style',
    'text-decoration', 'text-decoration-line',
  ]);
  var ALIGN_VALUES = new Set(['left', 'right', 'center', 'justify']);
  // Raster data URLs only. SVG is excluded: it's an image type that can carry
  // script. Remote URLs are excluded too — they'd load from wherever they point.
  var IMG_SRC_RE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+\/=\s]+$/i;
  var HREF_RE = /^(https?:|mailto:)/i;
  var UNSAFE_CSS_RE = /url\s*\(|expression\s*\(|javascript:|@import|\\|[<>]/i;
  var COLOR_RE = /^[#a-z0-9(),.%\s-]{1,64}$/i;

  function cleanStyle(value) {
    var out = [];
    String(value).split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var prop = decl.slice(0, i).trim().toLowerCase();
      var val = decl.slice(i + 1).trim();
      if (!STYLE_ALLOW.has(prop) || !val || val.length > 64 || UNSAFE_CSS_RE.test(val)) return;
      out.push(prop + ': ' + val);
    });
    return out.join('; ');
  }

  function cleanAttributes(el, tag) {
    var attrs = Array.prototype.slice.call(el.attributes);
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name.toLowerCase();
      var value = attrs[i].value;
      if (name === 'class') {
        var classes = value.split(/\s+/).filter(function (c) { return CLASS_ALLOW.has(c); });
        if (classes.length) el.setAttribute('class', classes.join(' '));
        else el.removeAttribute('class');
        continue;
      }
      if (name === 'style') {
        var st = cleanStyle(value);
        if (st) el.setAttribute('style', st);
        else el.removeAttribute('style');
        continue;
      }
      var keep = false;
      if (name === 'dir') keep = value === 'ltr' || value === 'rtl' || value === 'auto';
      else if (name === 'align') keep = ALIGN_VALUES.has(value.toLowerCase()) && /^(DIV|P|H[1-6]|BLOCKQUOTE|LI)$/.test(tag);
      else if (tag === 'A' && name === 'href') keep = HREF_RE.test(value.trim());
      else if (tag === 'A' && name === 'title') keep = true;
      else if (tag === 'IMG' && name === 'src') keep = IMG_SRC_RE.test(value);
      else if (tag === 'IMG' && name === 'alt') keep = true;
      else if (tag === 'IMG' && (name === 'width' || name === 'height')) keep = /^\d{1,5}$/.test(value);
      else if (tag === 'OL' && name === 'start') keep = /^\d{1,6}$/.test(value);
      else if (tag === 'FONT' && name === 'color') keep = COLOR_RE.test(value);
      if (!keep) el.removeAttribute(attrs[i].name);
    }
    if (tag === 'A' && el.hasAttribute('href')) el.setAttribute('rel', 'noopener noreferrer');
  }

  function unwrap(el) {
    var parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  // A formula's stored MathML is thrown away and regenerated from its LaTeX,
  // which the converter escapes — so markup smuggled inside a formula can't
  // survive, and MathML never has to be allowlisted at all.
  function rebuildFormula(el, opts) {
    var latex = (el.getAttribute('data-latex') || '').slice(0, 4000);
    var block = (' ' + (el.getAttribute('class') || '') + ' ').indexOf(' nb-formula-block ') >= 0;
    var span = el.ownerDocument.createElement('span');
    span.className = 'nb-formula' + (block ? ' nb-formula-block' : '');
    span.setAttribute('data-latex', latex);
    span.setAttribute('contenteditable', 'false');
    if (opts && typeof opts.renderFormula === 'function') {
      try { span.innerHTML = opts.renderFormula(latex, block); } catch (e) { span.textContent = latex; }
    } else {
      span.textContent = latex;
    }
    el.parentNode.replaceChild(span, el);
  }

  function sanitizeElement(el, opts) {
    var tag = el.nodeName.toUpperCase();
    if (tag === 'SPAN' && el.hasAttribute('data-latex')
        && (' ' + (el.getAttribute('class') || '') + ' ').indexOf(' nb-formula ') >= 0) {
      rebuildFormula(el, opts);
      return;
    }
    // Maths pasted from elsewhere keeps its text but none of its markup.
    if (tag === 'MATH') {
      el.parentNode.replaceChild(el.ownerDocument.createTextNode(el.textContent), el);
      return;
    }
    if (DROP.has(tag)) { el.parentNode.removeChild(el); return; }
    if (!KEEP.has(tag)) {
      walk(el, opts); // clean the children first, then lift them out
      unwrap(el);
      return;
    }
    cleanAttributes(el, tag);
    if (tag === 'IMG' && !el.hasAttribute('src')) { el.parentNode.removeChild(el); return; }
    walk(el, opts);
  }

  function walk(node, opts) {
    var child = node.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 1) sanitizeElement(child, opts);
      else if (child.nodeType !== 3) node.removeChild(child); // comments, PIs, CDATA
      child = next;
    }
  }

  function sanitizedBody(html, opts) {
    var doc = new DOMParser().parseFromString(
      '<!doctype html><body>' + (html == null ? '' : String(html)) + '</body>', 'text/html');
    walk(doc.body, opts || {});
    return doc.body;
  }

  // For writing into the live editor: imported nodes, never a re-parsed string.
  function sanitizeEditorFragment(html, opts) {
    var body = sanitizedBody(html, opts);
    var frag = document.createDocumentFragment();
    Array.prototype.forEach.call(body.childNodes, function (n) {
      frag.appendChild(document.importNode(n, true));
    });
    return frag;
  }

  // For storage.
  function sanitizeEditorHtml(html, opts) {
    return sanitizedBody(html, opts).innerHTML;
  }

  window.sanitizeEditorFragment = sanitizeEditorFragment;
  window.sanitizeEditorHtml = sanitizeEditorHtml;
})();
