window.Preprocessor = (function () {

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      if (!isSvg) reject(new Error('Please upload an SVG file (image/svg+xml).'));
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('Could not read the file.'));
      r.readAsText(file);
    });
  }

  function sanitizeAndParse(raw) {
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
    const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
    const errNode = doc.querySelector('parsererror');
    if (errNode) throw new Error('Malformed SVG XML — the parser returned an error.');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error('No &lt;svg&gt; root element found in the uploaded file.');
    return svgEl;
  }

  function resolveUseTags(svgEl) {
    [...svgEl.querySelectorAll('use')].forEach(useEl => {
      const href = (useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '').replace('#', '');
      if (!href) { useEl.remove(); return; }
      const ref = svgEl.getElementById(href);
      if (!ref) { useEl.remove(); return; }
      const clone = ref.cloneNode(true);
      clone.removeAttribute('id');
      const x = parseFloat(useEl.getAttribute('x')) || 0;
      const y = parseFloat(useEl.getAttribute('y')) || 0;
      const existing = clone.getAttribute('transform') || '';
      if (x || y) clone.setAttribute('transform', `translate(${x},${y})${existing ? ' ' + existing : ''}`);
      [...useEl.attributes].forEach(a => {
        if (!['href', 'xlink:href', 'x', 'y', 'width', 'height'].includes(a.name))
          clone.setAttribute(a.name, a.value);
      });
      useEl.replaceWith(clone);
    });
  }

  function normalizeViewBox(svgEl) {
    if (!svgEl.getAttribute('viewBox')) {
      const w = parseFloat(svgEl.getAttribute('width')) || 300;
      const h = parseFloat(svgEl.getAttribute('height')) || 150;
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.cssText = 'display:block;width:100%;height:100%;';
  }

  function circleToPath(el) {
    const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0, r = +el.getAttribute('r') || 0;
    return `M ${cx + r},${cy} A ${r},${r},0,1,0,${cx - r},${cy} A ${r},${r},0,1,0,${cx + r},${cy} Z`;
  }

  function ellipseToPath(el) {
    const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0;
    const rx = +el.getAttribute('rx') || 0, ry = +el.getAttribute('ry') || 0;
    return `M ${cx + rx},${cy} A ${rx},${ry},0,1,0,${cx - rx},${cy} A ${rx},${ry},0,1,0,${cx + rx},${cy} Z`;
  }

  function rectToPath(el) {
    const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
    const w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0;
    let rx = +el.getAttribute('rx') || +el.getAttribute('ry') || 0;
    let ry = +el.getAttribute('ry') || rx;
    rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    if (!rx && !ry) return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `M ${x + rx},${y} H ${x + w - rx} A ${rx},${ry},0,0,1,${x + w},${y + ry} V ${y + h - ry} A ${rx},${ry},0,0,1,${x + w - rx},${y + h} H ${x + rx} A ${rx},${ry},0,0,1,${x},${y + h - ry} V ${y + ry} A ${rx},${ry},0,0,1,${x + rx},${y} Z`;
  }

  function lineToPath(el) {
    return `M ${el.getAttribute('x1') || 0},${el.getAttribute('y1') || 0} L ${el.getAttribute('x2') || 0},${el.getAttribute('y2') || 0}`;
  }

  function pointsToPath(el, close) {
    const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
    if (pts.length < 4) return '';
    let d = `M ${pts[0]},${pts[1]}`;
    for (let i = 2; i + 1 < pts.length; i += 2) d += ` L ${pts[i]},${pts[i + 1]}`;
    return close ? d + ' Z' : d;
  }

  const INHERIT_ATTRS = ['fill', 'stroke', 'stroke-width', 'opacity', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'transform', 'clip-path', 'mask', 'filter', 'class', 'id', 'style'];

  function copyPresentationAttrs(from, to) {
    INHERIT_ATTRS.forEach(a => { const v = from.getAttribute(a); if (v !== null) to.setAttribute(a, v); });
  }

  function convertShapesToPaths(svgEl) {
    const ns = 'http://www.w3.org/2000/svg';
    [...svgEl.querySelectorAll('circle,ellipse,rect,line,polyline,polygon')].forEach(shape => {
      const tag = shape.tagName.toLowerCase();
      const d = tag === 'circle' ? circleToPath(shape)
        : tag === 'ellipse' ? ellipseToPath(shape)
          : tag === 'rect' ? rectToPath(shape)
            : tag === 'line' ? lineToPath(shape)
              : tag === 'polyline' ? pointsToPath(shape, false)
                : pointsToPath(shape, true);
      if (!d) return;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      copyPresentationAttrs(shape, path);
      shape.replaceWith(path);
    });
  }

  function tokenizePath(d) {
    const tokens = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?)/g;
    let m;
    while ((m = re.exec(d)) !== null) tokens.push(m[1] !== undefined ? m[1] : +m[2]);
    return tokens;
  }

  function applyMatrixToPath(d, mx) {
    if (!d || !d.trim()) return '';
    const tp = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(mx); return [+p.x.toFixed(4), +p.y.toFixed(4)]; };
    const tokens = tokenizePath(d);
    const scale = Math.sqrt(Math.abs(mx.a * mx.d - mx.b * mx.c));
    const parts = [];
    let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = 'M', isFirst = true;

    while (i <= tokens.length) {
      const tok = tokens[i];
      if (typeof tok === 'string') { cmd = tok; i++; isFirst = true; continue; }
      if (tok === undefined) break;

      const uCmd = cmd.toUpperCase();
      const rel = cmd !== uCmd;

      if (uCmd === 'Z') { parts.push('Z'); cx = sx; cy = sy; i++; continue; }
      if (typeof tokens[i] !== 'number') { i++; continue; }

      if (uCmd === 'M' || uCmd === 'L' || uCmd === 'T') {
        let ax = +tokens[i++], ay = +tokens[i++];
        if (rel) { ax += cx; ay += cy; }
        const [tx, ty] = tp(ax, ay);
        const label = uCmd === 'T' ? 'T' : (uCmd === 'M' && isFirst) ? 'M' : 'L';
        parts.push(`${label} ${tx},${ty}`);
        if (uCmd === 'M' && isFirst) { sx = ax; sy = ay; }
        cx = ax; cy = ay;
      } else if (uCmd === 'H') {
        let ax = +tokens[i++]; if (rel) ax += cx;
        const [tx, ty] = tp(ax, cy); parts.push(`L ${tx},${ty}`); cx = ax;
      } else if (uCmd === 'V') {
        let ay = +tokens[i++]; if (rel) ay += cy;
        const [tx, ty] = tp(cx, ay); parts.push(`L ${tx},${ty}`); cy = ay;
      } else if (uCmd === 'C') {
        let x1 = +tokens[i++], y1 = +tokens[i++], x2 = +tokens[i++], y2 = +tokens[i++], x = +tokens[i++], y = +tokens[i++];
        if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
        const [a, b] = tp(x1, y1), [c, d2] = tp(x2, y2), [e, f] = tp(x, y);
        parts.push(`C ${a},${b} ${c},${d2} ${e},${f}`); cx = x; cy = y;
      } else if (uCmd === 'S') {
        let x2 = +tokens[i++], y2 = +tokens[i++], x = +tokens[i++], y = +tokens[i++];
        if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
        const [c, d2] = tp(x2, y2), [e, f] = tp(x, y);
        parts.push(`S ${c},${d2} ${e},${f}`); cx = x; cy = y;
      } else if (uCmd === 'Q') {
        let x1 = +tokens[i++], y1 = +tokens[i++], x = +tokens[i++], y = +tokens[i++];
        if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
        const [a, b] = tp(x1, y1), [e, f] = tp(x, y);
        parts.push(`Q ${a},${b} ${e},${f}`); cx = x; cy = y;
      } else if (uCmd === 'A') {
        let rx = +tokens[i++], ry2 = +tokens[i++], angle = +tokens[i++], laf = +tokens[i++], sf = +tokens[i++], x = +tokens[i++], y = +tokens[i++];
        if (rel) { x += cx; y += cy; }
        const [e, f] = tp(x, y);
        parts.push(`A ${+(rx * scale).toFixed(4)},${+(ry2 * scale).toFixed(4)} ${angle} ${laf},${sf} ${e},${f}`);
        cx = x; cy = y;
      } else { i++; }

      isFirst = false;
    }
    return parts.join(' ');
  }

  function parseTransformString(str) {
    const m = new DOMMatrix();
    const re = /(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^)]+)\)/g;
    let match;
    while ((match = re.exec(str)) !== null) {
      const fn = match[1];
      const args = match[2].trim().split(/[\s,]+/).map(Number);
      if (fn === 'translate') m.translateSelf(args[0] || 0, args[1] || 0);
      else if (fn === 'scale') m.scaleSelf(args[0], args[1] !== undefined ? args[1] : args[0]);
      else if (fn === 'rotate') {
        const cx2 = args[1] || 0, cy2 = args[2] || 0;
        if (cx2 || cy2) { m.translateSelf(cx2, cy2); m.rotateSelf(args[0]); m.translateSelf(-cx2, -cy2); }
        else m.rotateSelf(args[0]);
      } else if (fn === 'skewX') m.skewXSelf(args[0]);
      else if (fn === 'skewY') m.skewYSelf(args[0]);
      else if (fn === 'matrix') m.multiplySelf(new DOMMatrix(args));
    }
    return m;
  }

  function accumulatedMatrix(el, stopAt) {
    const chain = [];
    let node = el;
    while (node && node !== stopAt) {
      const t = node.getAttribute && node.getAttribute('transform');
      if (t) chain.unshift(t);
      node = node.parentElement;
    }
    const m = new DOMMatrix();
    chain.forEach(t => m.multiplySelf(parseTransformString(t)));
    return m;
  }

  function isIdentityMatrix(m) {
    return Math.abs(m.a - 1) < 1e-5 && Math.abs(m.b) < 1e-5 && Math.abs(m.c) < 1e-5 && Math.abs(m.d - 1) < 1e-5 && Math.abs(m.e) < 1e-5 && Math.abs(m.f) < 1e-5;
  }

  function flattenTransforms(svgEl) {
    [...svgEl.querySelectorAll('path')].forEach(path => {
      const m = accumulatedMatrix(path, svgEl);
      if (!isIdentityMatrix(m)) {
        const d = path.getAttribute('d');
        if (d) path.setAttribute('d', applyMatrixToPath(d, m));
      }
    });
    [...svgEl.querySelectorAll('[transform]')].forEach(el => el.removeAttribute('transform'));
  }

  function isolateStrokes(svgEl) {
    const vb = (svgEl.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number);
    const diagLen = Math.sqrt((vb[2] || 100) ** 2 + (vb[3] || 100) ** 2);
    const autoStroke = +(diagLen * 0.005).toFixed(3);

    [...svgEl.querySelectorAll('path')].forEach(path => {
      const fill = path.getAttribute('fill');
      const stroke = path.getAttribute('stroke');
      const hasFill = fill && fill !== 'none';
      const hasStroke = stroke && stroke !== 'none';

      if (hasFill) path.dataset.originalFill = fill;

      if (hasFill && !hasStroke) {
        path.setAttribute('stroke', fill);
        path.setAttribute('fill', 'none');
      } else if (hasFill && hasStroke) {
        path.setAttribute('fill', 'none');
      } else if (!hasFill && !hasStroke) {
        path.setAttribute('stroke', '#000000');
        path.setAttribute('fill', 'none');
      }

      if (!path.getAttribute('stroke-width')) {
        path.setAttribute('stroke-width', String(autoStroke));
      }

      path.setAttribute('stroke-linecap', path.getAttribute('stroke-linecap') || 'round');
      path.setAttribute('stroke-linejoin', path.getAttribute('stroke-linejoin') || 'round');
    });
  }

  async function process(file) {
    const raw = await readFile(file);
    const svgEl = sanitizeAndParse(raw);

    resolveUseTags(svgEl);
    normalizeViewBox(svgEl);
    convertShapesToPaths(svgEl);
    flattenTransforms(svgEl);
    isolateStrokes(svgEl);

    const pathCount = svgEl.querySelectorAll('path[d]').length;
    if (pathCount === 0) {
      throw new Error('This SVG contains no vector geometry to animate. Ensure all text is converted to outlines and raster images are vectorized.');
    }

    return { svgEl, pathCount };
  }

  return { process };
})();
