window.UI = (function () {
  let strokePickr = null;
  let bgPickr = null;

  function showToast(message, type = 'info') {
    const bg = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#52525b';
    Toastify({
      text: message,
      duration: 3200,
      gravity: 'bottom',
      position: 'right',
      stopOnFocus: true,
      style: { background: bg }
    }).showToast();
  }

  function alertError(title, html) {
    return Swal.fire({
      icon: 'error',
      title,
      html,
      confirmButtonText: 'Got it',
      background: '#18181b',
    });
  }

  function alertWarn(title, html) {
    return Swal.fire({
      icon: 'warning',
      title,
      html,
      confirmButtonText: 'OK',
      background: '#18181b',
    });
  }

  function initPickr(elId, defaultColor, onChange) {
    return Pickr.create({
      el: '#' + elId,
      theme: 'nano',
      default: defaultColor,
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: { hex: true, input: true, save: true }
      }
    }).on('save', (color, instance) => {
      const hex = color.toHEXA().toString();
      instance.hide();
      onChange(hex);
    });
  }

  function initColorPickers(onStrokeChange, onBgChange) {
    strokePickr = initPickr('pickr-stroke', '#ffffff', onStrokeChange);
    bgPickr = initPickr('pickr-bg', '#09090b', onBgChange);
  }

  function initTooltips() {
    tippy('[data-tippy-content]', {
      theme: 'app',
      delay: [400, 80],
      arrow: true,
      placement: 'right',
    });
  }

  function initIcons() {
    lucide.createIcons();
  }

  function destroyPickrs() {
    if (strokePickr) { strokePickr.destroyAndRemove(); strokePickr = null; }
    if (bgPickr) { bgPickr.destroyAndRemove(); bgPickr = null; }
  }

  return { showToast, alertError, alertWarn, initColorPickers, initTooltips, initIcons };
})();
