function cctvFrameFingerprint(image) {
  if (!image || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0x811c9dc5;
    for (let i = 0; i < pixels.length; i += 4) {
      hash = Math.imul(hash ^ pixels[i], 0x01000193);
      hash = Math.imul(hash ^ pixels[i + 1], 0x01000193);
      hash = Math.imul(hash ^ pixels[i + 2], 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch {
    return null;
  }
}

function isOntarioRoadSnapshot(camera) {
  const id = String(camera?.id || '').toLowerCase();
  const provider = String(
    camera?.provider || camera?.sourceLabel || '',
  ).toLowerCase();
  return id.startsWith('ontario511:') || provider.includes('ontario 511');
}

function formatFrameClock(value) {
  const stamp = Number(value);
  if (!Number.isFinite(stamp) || stamp <= 0) return '--:--';
  return new Date(stamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function _clearCctvFrame() {
  this._cctvFrameRequestToken += 1;
  if (this._cctvFramePreloader) {
    this._cctvFramePreloader.onload = null;
    this._cctvFramePreloader.onerror = null;
  }
  this._cctvFramePreloader = null;
  if (this._cctvFrame) {
    this._cctvFrame.classList.remove('active');
    this._cctvFrame.removeAttribute('src');
    this._cctvFrame.dataset.cameraId = '';
    this._cctvFrame.dataset.currentSrc = '';
    this._cctvFrame.dataset.loading = '';
    this._cctvFrame.dataset.error = '';
    this._cctvFrame.dataset.frameFingerprint = '';
    this._cctvFrame.dataset.lastFetchedAt = '';
    this._cctvFrame.dataset.lastChangedAt = '';
  }
  this._cctvFrameWrap?.classList.remove('loading', 'has-frame');
}

export function _queueCctvFrame(src, cameraId, cameraChanged) {
  if (this.destroyed || !this._cctvFrame || !src) return;

  if (cameraChanged) {
    // A different camera gets an honest acquisition state. Never retain
    // the prior camera's pixels or freshness metadata under the newly selected
    // camera.
    this._cctvFrame.classList.remove('active');
    this._cctvFrame.removeAttribute('src');
    this._cctvFrame.dataset.frameFingerprint = '';
    this._cctvFrame.dataset.lastFetchedAt = '';
    this._cctvFrame.dataset.lastChangedAt = '';
    this._cctvFrameWrap?.classList.remove('has-frame');
  }

  if (this._cctvFramePreloader) {
    this._cctvFramePreloader.onload = null;
    this._cctvFramePreloader.onerror = null;
  }
  const token = ++this._cctvFrameRequestToken;
  this._cctvFrame.dataset.cameraId = cameraId;
  this._cctvFrame.dataset.currentSrc = src;
  this._cctvFrame.dataset.loading = 'true';
  this._cctvFrame.dataset.error = '';
  this._cctvFrameWrap?.classList.toggle(
    'loading',
    !this._cctvFrameWrap?.classList.contains('has-frame'),
  );

  const preloader = new Image();
  this._cctvFramePreloader = preloader;
  preloader.onload = () => this._settleCctvFrame(token, src, true, preloader);
  preloader.onerror = () => this._settleCctvFrame(token, src, false, preloader);
  preloader.src = src;
}

export function _settleCctvFrame(token, src, ok, loadedImage = null) {
  if (
    this.destroyed ||
    !this._cctvFrame ||
    token !== this._cctvFrameRequestToken
  )
    return;

  const fetchedAt = ok ? Date.now() : null;
  const fingerprint = ok ? cctvFrameFingerprint(loadedImage) : null;

  if (this._cctvFramePreloader) {
    this._cctvFramePreloader.onload = null;
    this._cctvFramePreloader.onerror = null;
  }
  this._cctvFramePreloader = null;
  this._cctvFrame.dataset.loading = '';
  this._cctvFrameWrap?.classList.remove('loading');

  const syncBadge = () =>
    this._syncCctvSourceBadge(
      this._cctvState?.activeCamera,
      !!this._cctvState?.enabled && !!this.actions.isEnabled(),
    );

  if (!ok) {
    // Keep the last settled pixels visible, but mark them stale below instead
    // of allowing a failed refresh to look current.
    this._cctvFrame.dataset.error = 'true';
    syncBadge();
    return;
  }

  const previousFingerprint = this._cctvFrame.dataset.frameFingerprint || '';
  const previousChangedAt = Number(this._cctvFrame.dataset.lastChangedAt) || 0;
  this._cctvFrame.dataset.lastFetchedAt = String(fetchedAt);

  // The BM Ontario proxy is same-origin, so the sampled pixels are readable.
  // lastChangedAt advances only when the actual frame pixels change; a healthy
  // HTTP refresh that returns the same roadway snapshot does not masquerade as
  // a new live frame.
  if (
    !previousChangedAt ||
    (fingerprint && previousFingerprint && fingerprint !== previousFingerprint)
  ) {
    this._cctvFrame.dataset.lastChangedAt = String(fetchedAt);
  }
  if (fingerprint) this._cctvFrame.dataset.frameFingerprint = fingerprint;

  this._cctvFrame.dataset.error = '';
  this._cctvFrame.src = src;
  this._cctvFrame.classList.add('active');
  this._cctvFrameWrap?.classList.add('has-frame');
  syncBadge();
}

export function _syncCctvSourceBadge(activeCamera, enabled) {
  if (!this._cctvSourceBadge) return;
  if (!enabled || !activeCamera) {
    this._cctvSourceBadge.textContent = 'SOURCE · UNKNOWN';
    this._cctvSourceBadge.removeAttribute('title');
    this._cctvSourceBadge.dataset.frameState = 'idle';
    return;
  }
  const hasDisplayedFrame =
    this._cctvFrameWrap?.classList.contains('has-frame');
  const frameFailed = this._cctvFrame?.dataset.error === 'true';
  if (this._cctvFrame?.dataset.loading === 'true' && !hasDisplayedFrame) {
    this._cctvSourceBadge.textContent = 'FRAME · LOADING';
    this._cctvSourceBadge.removeAttribute('title');
    this._cctvSourceBadge.dataset.frameState = 'loading';
    return;
  }
  if (frameFailed && !hasDisplayedFrame) {
    this._cctvSourceBadge.textContent = 'FRAME · UNAVAILABLE';
    this._cctvSourceBadge.removeAttribute('title');
    this._cctvSourceBadge.dataset.frameState = 'error';
    return;
  }

  if (isOntarioRoadSnapshot(activeCamera)) {
    const fetchedAt = Number(this._cctvFrame?.dataset.lastFetchedAt) || 0;
    const changedAt = Number(this._cctvFrame?.dataset.lastChangedAt) || 0;
    const fetched = formatFrameClock(fetchedAt);
    const changed = formatFrameClock(changedAt);
    const unchanged = fetchedAt > 0 && changedAt > 0 && fetchedAt > changedAt;
    const changeLabel = unchanged ? 'UNCHANGED SINCE' : 'CHANGE';

    if (frameFailed && hasDisplayedFrame) {
      this._cctvSourceBadge.textContent =
        `ROAD SNAPSHOT · STALE DISPLAY · LAST OK ${fetched} · ${changeLabel} ${changed}`;
      this._cctvSourceBadge.title =
        `Ontario 511 roadway snapshot. The latest refresh failed; displaying the last successful frame from ${fetched}. Last pixel change ${changed}.`;
      this._cctvSourceBadge.dataset.frameState = 'stale';
      return;
    }

    this._cctvSourceBadge.textContent = hasDisplayedFrame
      ? `ROAD SNAPSHOT · FETCH ${fetched} · ${changeLabel} ${changed}`
      : 'ROAD SNAPSHOT · WAITING FOR FRAME';
    this._cctvSourceBadge.title = hasDisplayedFrame
      ? `Ontario 511 roadway snapshot. Last fetched ${fetched}; last pixel change ${changed}.`
      : 'Ontario 511 roadway snapshot awaiting its first frame.';
    this._cctvSourceBadge.dataset.frameState = hasDisplayedFrame
      ? 'snapshot'
      : 'loading';
    return;
  }

  const kind = String(
    activeCamera.sourceKind || activeCamera.feedType || 'unknown',
  ).toUpperCase();
  const status = String(activeCamera.sourceStatus || 'unknown').toUpperCase();
  this._cctvSourceBadge.textContent = `${kind} · ${status}`;
  this._cctvSourceBadge.removeAttribute('title');
  this._cctvSourceBadge.dataset.frameState = 'ready';
}
