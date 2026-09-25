function statusNode() {
  return document.querySelector('#loading-screen .loader-status');
}

function setStatus(message, color = '') {
  const status = statusNode();
  if (!status) return;
  status.textContent = message;
  status.style.whiteSpace = 'pre-wrap';
  status.style.maxWidth = 'min(1100px, 92vw)';
  status.style.textAlign = 'left';
  status.style.lineHeight = '1.45';
  if (color) status.style.color = color;
}

function formatError(error) {
  if (!error) return 'Unknown module error';
  if (typeof error === 'string') return error;
  return error.message || error.reason?.message || String(error);
}

function stackLocation(error) {
  const stack = String(error?.stack || '');
  const match = stack.match(/(https?:\/\/[^\s)]+\.js):(\d+):(\d+)/);
  if (!match) return null;
  return { url: match[1], line: Number(match[2]), column: Number(match[3]) };
}

async function bundleContext(error) {
  const location = stackLocation(error);
  if (!location || !Number.isFinite(location.line) || !Number.isFinite(location.column))
    return '';

  try {
    const response = await fetch(location.url, { cache: 'no-store' });
    if (!response.ok) return `BUNDLE PROBE: HTTP ${response.status} for ${location.url}`;
    const source = await response.text();
    const lines = source.split('\n');
    const line = lines[location.line - 1] || '';
    const index = Math.max(0, location.column - 1);
    const start = Math.max(0, index - 260);
    const end = Math.min(line.length, index + 340);
    const snippet = line.slice(start, end).replace(/\s+/g, ' ').trim();
    if (!snippet) return 'BUNDLE PROBE: source loaded but no context was found.';
    return `BUNDLE CONTEXT @ ${location.line}:${location.column}\n${snippet}`;
  } catch (probeError) {
    return `BUNDLE PROBE FAILED: ${formatError(probeError)}`;
  }
}

async function showFailure(error, detail = '') {
  const message = formatError(error);
  const base = `BOOT ERROR: ${message}${detail ? `\n${detail}` : ''}`;
  setStatus(base, '#ff5f5f');
  console.error('[BM Bootstrap] God\'s Eye failed to start', error, detail);

  const context = await bundleContext(error);
  if (context) setStatus(`${base}\n\n${context}`, '#ff5f5f');
}

window.addEventListener('error', (event) => {
  if (!event?.message && !event?.filename) return;
  void showFailure(event.error || event.message, event.filename || '');
});

window.addEventListener('unhandledrejection', (event) => {
  void showFailure(event.reason || 'Unhandled promise rejection');
});

async function boot() {
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
    await showFailure(error, error?.stack || '');
  }
}

void boot();
