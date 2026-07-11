const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1523600892132196402/pgWaDliU87PvpEgRjou5K7qPCDz62Ec5hH7ILKXmbCx5iEPESFiU2OeDTTN4u__qoBq_';

(function () {
  const store = {
    mode: 'draw',
    duration: 2,
    delay: 0,
    stagger: 0.05,
    easing: 'circ.inOut',
    strokeColor: '#ffffff',
    strokeWidthMultiplier: 1,
    bgColor: '#09090b',
  };

  let currentSvgEl = null;
  let isPlaying = false;

  function getSettings() {
    return { ...store };
  }

  function applyBgColor(color) {
    const container = document.getElementById('preview-container');
    if (container) container.style.background = color;
  }

  function setButtonStates(loaded) {
    ['btn-play', 'btn-restart', 'btn-export'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !loaded;
    });
  }

  function updateStatusBar(pathCount, filename) {
    const label = document.getElementById('status-label');
    const count = document.getElementById('path-count');
    if (label) label.textContent = filename;
    if (count) count.textContent = `${pathCount} path${pathCount !== 1 ? 's' : ''}`;
  }

  function showProcessing(visible, label) {
    const el = document.getElementById('upload-progress');
    const lbl = document.getElementById('progress-label');
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    if (label && lbl) lbl.textContent = label;
  }

  function mountSvg(svgEl) {
    const inner = document.getElementById('preview-inner');
    const dz = document.getElementById('dropzone');
    if (!inner || !dz) return;
    inner.innerHTML = '';
    inner.appendChild(svgEl);
    inner.classList.remove('hidden');
    inner.style.display = 'flex';
    dz.style.display = 'none';
    currentSvgEl = svgEl;
  }

  async function handleFile(file) {
    showProcessing(true, 'Processing SVG…');
    try {
      const { svgEl, pathCount } = await Preprocessor.process(file);
      mountSvg(svgEl);
      applyBgColor(store.bgColor);
      setButtonStates(true);
      updateStatusBar(pathCount, file.name);

      const tl = Animator.build(svgEl, getSettings());
      if (tl) {
        isPlaying = true;
        updatePlayButton();
      }
      UI.showToast(`Loaded "${file.name}" — ${pathCount} paths`, 'success');
    } catch (err) {
      await UI.alertError('Preprocessing Failed', err.message);
    } finally {
      showProcessing(false);
    }
  }

  function updatePlayButton() {
    const btn = document.getElementById('btn-play');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    if (icon) { icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play'); lucide.createIcons(); }
    if (label) label.textContent = isPlaying ? 'Pause' : 'Play';
  }

  function rebuildTimeline() {
    if (!currentSvgEl) return;
    Animator.build(currentSvgEl, getSettings());
    isPlaying = true;
    updatePlayButton();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  const debouncedRebuild = debounce(rebuildTimeline, 150);

  function initDropZone() {
    const dz = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    if (!dz || !fileInput) return;

    dz.addEventListener('click', () => fileInput.click());
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dropzone-active-drag'); });
    dz.addEventListener('dragleave', e => { if (!dz.contains(e.relatedTarget)) dz.classList.remove('dropzone-active-drag'); });
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('dropzone-active-drag');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleFile(file);
      fileInput.value = '';
    });

    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'image/svg+xml' || file.name.endsWith('.svg'))) handleFile(file);
    });
  }

  function initControls() {
    const modeButtons = document.querySelectorAll('#mode-tabs .mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        store.mode = btn.dataset.mode;
        debouncedRebuild();
      });
    });

    const sliders = [
      { id: 'sl-duration', valId: 'val-duration', key: 'duration', fmt: v => v.toFixed(1) + 's' },
      { id: 'sl-delay', valId: 'val-delay', key: 'delay', fmt: v => v.toFixed(2) + 's' },
      { id: 'sl-stagger', valId: 'val-stagger', key: 'stagger', fmt: v => v.toFixed(2) + 's' },
      { id: 'sl-sw', valId: 'val-sw', key: 'strokeWidthMultiplier', fmt: v => v.toFixed(1) + '×' },
    ];

    sliders.forEach(({ id, valId, key, fmt }) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        store[key] = v;
        if (valEl) valEl.textContent = fmt(v);
        debouncedRebuild();
      });
    });

    const easingSelect = document.getElementById('sel-easing');
    if (easingSelect) {
      easingSelect.addEventListener('change', () => {
        store.easing = easingSelect.value;
        debouncedRebuild();
      });
    }

    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        const tl = Animator.getTimeline();
        if (!tl) return;
        if (isPlaying) { tl.pause(); isPlaying = false; }
        else { tl.play(); isPlaying = true; }
        updatePlayButton();
      });
    }

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        const tl = Animator.getTimeline();
        if (!tl) return;
        tl.restart();
        isPlaying = true;
        updatePlayButton();
      });
    }

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (!currentSvgEl) return;
        exportBtn.disabled = true;
        exportBtn.querySelector('span').textContent = 'Exporting…';
        try {
          await Exporter.exportHTML(currentSvgEl, { ...getSettings(), pathCount: Animator.getPaths().length });
          UI.showToast('HTML file exported successfully', 'success');
        } catch (err) {
          if (err.name !== 'AbortError') UI.alertError('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.querySelector('span').textContent = 'Export HTML';
        }
      });
    }
  }

  function initColorPickers() {
    UI.initColorPickers(
      hex => {
        store.strokeColor = hex;
        document.getElementById('stroke-hex').textContent = hex;
        debouncedRebuild();
      },
      hex => {
        store.bgColor = hex;
        document.getElementById('bg-hex').textContent = hex;
        applyBgColor(hex);
      }
    );
  }

  function initFeedbackForm() {
    const form = document.getElementById('feedback-form');
    const notice = document.getElementById('webhook-notice');
    if (!form) return;

    if (!DISCORD_WEBHOOK_URL) {
      notice && notice.classList.remove('hidden');
      const btn = document.getElementById('btn-send');
      if (btn) btn.disabled = true;
      return;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('fb-name').value.trim() || 'Anonymous';
      const message = document.getElementById('fb-message').value.trim();
      if (!message) { UI.showToast('Message cannot be empty', 'error'); return; }

      const btn = document.getElementById('btn-send');
      if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Sending…'; }

      try {
        const res = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: ' SVG Animator Feedback',
              color: 0x52525b,
              fields: [
                { name: 'From', value: name, inline: true },
                { name: 'Message', value: message, inline: false },
              ],
              timestamp: new Date().toISOString(),
            }]
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        UI.showToast('Feedback sent - thanks!', 'success');
        form.reset();
      } catch (err) {
        UI.alertError('Send Failed', 'Could not reach the Discord webhook. ' + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Send Feedback'; }
      }
    });
  }

  function initRouter() {
    const views = { editor: 'view-editor', 'how-it-works': 'view-how-it-works', feedback: 'view-feedback' };
    const navLinks = document.querySelectorAll('.nav-link');

    function showView(hash) {
      const key = hash.replace('#', '') || 'editor';
      const target = views[key] || views.editor;
      Object.values(views).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== target);
      });
      navLinks.forEach(a => {
        const v = a.dataset.view;
        a.classList.toggle('active', v === key || (key === '' && v === 'editor'));
      });
    }

    window.addEventListener('hashchange', () => showView(window.location.hash));
    showView(window.location.hash || '#editor');
  }

  function init() {
    UI.initIcons();
    UI.initTooltips();
    initRouter();
    initDropZone();
    initControls();
    initColorPickers();
    initFeedbackForm();
    applyBgColor(store.bgColor);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
