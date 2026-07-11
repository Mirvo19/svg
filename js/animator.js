window.Animator = (function () {
  let activeTimeline = null;
  let activePaths    = [];

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function snapshotPaths(paths) {
    paths.forEach(p => {
      if (!p.dataset.animSnap) {
        p.dataset.animOrigStroke = p.getAttribute('stroke')       || '';
        p.dataset.animOrigSw     = p.getAttribute('stroke-width') || '';
        p.dataset.animSnap = '1';
      }
    });
  }

  function resetPaths(paths) {
    paths.forEach(p => {
      gsap.killTweensOf(p);
      gsap.set(p, { clearProps: 'all' }); 
      p.style.cssText = '';              
      p.setAttribute('fill', 'none');     
    });
  }

  function restoreFill(p) {
    const f = p.dataset.originalFill;
    if (f && f !== 'none') p.setAttribute('fill', f);
  }

  function bboxCenter(p) {
    const b = p.getBBox();
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  }

  function makeGroups(paths) {
    if (!paths.length) return [];

    const bboxes = paths.map(p => p.getBBox());

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    bboxes.forEach(b => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    const W = maxX - minX || 1;
    const H = maxY - minY || 1;

    const base = Math.ceil(Math.sqrt(paths.length));
    const cols  = Math.max(4, Math.min(14, Math.round(base * Math.sqrt(W / H))));
    const rows  = Math.max(4, Math.min(14, Math.round(base * Math.sqrt(H / W))));

    const cellMap = new Map();
    paths.forEach((p, i) => {
      const b   = bboxes[i];
      const cx  = b.x + b.width  / 2;
      const cy  = b.y + b.height / 2;
      const col = Math.min(cols - 1, Math.floor(((cx - minX) / W) * cols));
      const row = Math.min(rows - 1, Math.floor(((cy - minY) / H) * rows));
      const key = `${col},${row}`;
      if (!cellMap.has(key)) cellMap.set(key, { col, row, paths: [] });
      cellMap.get(key).paths.push(p);
    });

    return [...cellMap.values()]
      .sort((a, b) => (a.col + a.row) - (b.col + b.row) || a.col - b.col)
      .map(c => c.paths);
  }

  function groupStagger(s, nGroups) {
    if (nGroups <= 1) return 0;
    return Math.min(s.stagger, (s.duration * 1.5) / (nGroups - 1));
  }

  function buildDrawTimeline(paths, s) {
    const groups  = makeGroups(paths);
    const nG      = groups.length;
    const gStag   = groupStagger(s, nG);
    const tl      = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });

    const lenMap = new Map(paths.map(p => [p, p.getTotalLength() + 1]));
    const maxLen = Math.max(...lenMap.values(), 1);

    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        const len = lenMap.get(path);
        const dur = Math.max(s.duration * 0.3, s.duration * (len / maxLen));
        tl.fromTo(path,
          { strokeDasharray: len, strokeDashoffset: len, fill: 'none' },
          {
            strokeDashoffset: 0,
            duration: dur,
            onStart()    { path.setAttribute('fill', 'none'); },
            onComplete() {
              const orig = path.dataset.originalFill;
              if (orig && orig !== 'none') gsap.to(path, { fill: orig, duration: 0.25, ease: 'power1.out' });
            },
            onReverseComplete() { path.setAttribute('fill', 'none'); }
          },
          offset
        );
      });
    });
    return tl;
  }

  function buildFadeTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        tl.fromTo(path,
          { opacity: 0 },
          { opacity: 1, duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildDashTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.4, defaults: { ease: 'none' } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        const len  = path.getTotalLength() + 1;
        const dash = Math.max(len * 0.15, 6);
        tl.fromTo(path,
          { strokeDasharray: `${dash} ${len}`, strokeDashoffset: len, fill: 'none' },
          { strokeDashoffset: -(len + dash), duration: s.duration * 1.8 },
          offset
        );
      });
    });
    return tl;
  }

  function buildScaleTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        const { cx, cy } = bboxCenter(path);
        tl.fromTo(path,
          { scale: 0, opacity: 0, transformOrigin: `${cx}px ${cy}px` },
          { scale: 1, opacity: 1, duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildSlideTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        tl.fromTo(path,
          { x: -80, opacity: 0 },
          { x: 0,   opacity: 1, duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildSpinTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        const { cx, cy } = bboxCenter(path);
        tl.fromTo(path,
          { rotation: -180, opacity: 0, transformOrigin: `${cx}px ${cy}px` },
          { rotation:    0, opacity: 1, duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildBlurTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        const { cx, cy } = bboxCenter(path);
        tl.fromTo(path,
          { opacity: 0, filter: 'blur(14px)', scale: 1.06, transformOrigin: `${cx}px ${cy}px` },
          { opacity: 1, filter: 'blur(0px)',  scale: 1,    duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildBounceTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: 'bounce.out' } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        tl.fromTo(path,
          { y: -100, opacity: 0 },
          { y:    0, opacity: 1, duration: s.duration * 1.2 },
          offset
        );
      });
    });
    return tl;
  }

  function buildFlipTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      group.forEach(path => {
        restoreFill(path);
        const { cx, cy } = bboxCenter(path);
        tl.fromTo(path,
          { rotationX: -90, opacity: 0, transformOrigin: `${cx}px ${cy}px`, transformPerspective: 800 },
          { rotationX:   0, opacity: 1, duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  function buildWaveTimeline(paths, s) {
    const groups = makeGroups(paths);
    const nG     = groups.length;
    const gStag  = groupStagger(s, nG);
    const tl     = gsap.timeline({ repeat: -1, repeatDelay: 0.8, defaults: { ease: s.easing } });
    groups.forEach((group, gi) => {
      const offset = gi * gStag + s.delay;
      const waveY  = Math.sin(gi * (Math.PI * 2 / Math.max(nG, 1))) * 40;
      group.forEach(path => {
        restoreFill(path);
        const { cx, cy } = bboxCenter(path);
        tl.fromTo(path,
          { y: waveY, opacity: 0, scale: 0.88, transformOrigin: `${cx}px ${cy}px` },
          { y:      0, opacity: 1, scale: 1,    duration: s.duration },
          offset
        );
      });
    });
    return tl;
  }

  const builders = {
    draw:   buildDrawTimeline,
    fade:   buildFadeTimeline,
    dash:   buildDashTimeline,
    scale:  buildScaleTimeline,
    slide:  buildSlideTimeline,
    spin:   buildSpinTimeline,
    blur:   buildBlurTimeline,
    bounce: buildBounceTimeline,
    flip:   buildFlipTimeline,
    wave:   buildWaveTimeline,
  };

  function build(svgEl, settings) {
    if (activeTimeline) { activeTimeline.kill(); activeTimeline = null; }

    const rawPaths = [...svgEl.querySelectorAll('path')].filter(p => {
      const d = p.getAttribute('d');
      return d && d.trim().length > 0;
    });

    snapshotPaths(rawPaths);
    resetPaths(rawPaths);

    activePaths = rawPaths;
    if (!activePaths.length) return null;

    activePaths.forEach(path => {
      path.setAttribute('stroke', settings.strokeColor);
      const sw = parseFloat(path.dataset.animOrigSw) || 1;
      path.setAttribute('stroke-width', (sw * settings.strokeWidthMultiplier).toFixed(3));
    });

    const builder = builders[settings.mode] || buildDrawTimeline;
    activeTimeline = builder(activePaths, settings);
    return activeTimeline;
  }

  function destroy() {
    if (activeTimeline) { activeTimeline.kill(); activeTimeline = null; }
    if (activePaths.length) { resetPaths(activePaths); activePaths = []; }
  }

  function getTimeline() { return activeTimeline; }
  function getPaths()    { return activePaths; }

  const buildDebounced = debounce(build, 150);

  return { build, buildDebounced, destroy, getTimeline, getPaths };
})();
