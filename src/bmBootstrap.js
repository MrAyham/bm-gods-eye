function statusNode() {
  return document.querySelector('#loading-screen .loader-status');
}

function formatError(error) {
  if (!error) return 'Unknown module error';
  if (typeof error === 'string') return error;
  return error.message || error.reason?.message || String(error);
}

function showFailure(error, detail = '') {
  const status = statusNode();
  if (!status) return;
  const message = formatError(error);
  status.textContent = `BOOT ERROR: ${message}${detail ? ` · ${detail}` : ''}`;
  status.style.color = '#ff5f5f';
  console.error('[BM Bootstrap] God\'s Eye failed to start', error, detail);
}

const status = statusNode();
if (status) status.textContent = 'Loading application module...';

window.addEventListener('error', (event) => {
  if (!event?.message && !event?.filename) return;
  showFailure(event.error || event.message, event.filename || '');
});

window.addEventListener('unhandledrejection', (event) => {
  showFailure(event.reason || 'Unhandled promise rejection');
});

const stallTimer = window.setTimeout(() => {
  const current = statusNode();
  if (!current) return;
  if (current.textContent === 'Loading application module...') {
    current.textContent = 'BOOT STALLED: application module did not start. Check module delivery through the BM gateway.';
    current.style.color = '#ffb84c';
  }
}, 12_000);

import('./main.js')
  .then(() => {
    window.clearTimeout(stallTimer);
  })
  .catch((error) => {
    window.clearTimeout(stallTimer);
    showFailure(error);
  });
