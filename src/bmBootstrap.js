function statusNode() {
  return document.querySelector('#loading-screen .loader-status');
}

function setStatus(message, color = '') {
  const status = statusNode();
  if (!status) return;
  status.textContent = message;
  if (color) status.style.color = color;
}

function formatError(error) {
  if (!error) return 'Unknown module error';
  if (typeof error === 'string') return error;
  return error.message || error.reason?.message || String(error);
}

function showFailure(error, detail = '') {
  const message = formatError(error);
  setStatus(
    `BOOT ERROR: ${message}${detail ? ` · ${detail}` : ''}`,
    '#ff5f5f',
  );
  console.error('[BM Bootstrap] God\'s Eye failed to start', error, detail);
}

window.addEventListener('error', (event) => {
  if (!event?.message && !event?.filename) return;
  showFailure(event.error || event.message, event.filename || '');
});

window.addEventListener('unhandledrejection', (event) => {
  showFailure(event.reason || 'Unhandled promise rejection');
});

async function boot() {
  // Keep the BM bootstrap deliberately tiny. The upstream application already
  // imports Cesium through its normal module graph. Importing the entire Cesium
  // namespace here created a second eager evaluation path and caused a TDZ
  // failure in the optimized production bundle before the application could
  // start.
  setStatus('Loading application module...');

  const stallTimer = window.setTimeout(() => {
    const current = statusNode();
    if (current?.textContent === 'Loading application module...') {
      setStatus(
        'BOOT STALLED: application module is still loading...',
        '#ffb84c',
      );
    }
  }, 20_000);

  try {
    await import('./main.js');
    window.clearTimeout(stallTimer);
  } catch (error) {
    window.clearTimeout(stallTimer);
    showFailure(error, error?.stack || '');
  }
}

void boot();
