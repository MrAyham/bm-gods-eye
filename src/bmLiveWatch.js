import * as Cesium from 'cesium';

export const BM_LIVE_WATCH_SOURCES = Object.freeze([
  Object.freeze({
    id: 'downtown-windsor-24x7',
    name: 'Downtown Windsor · 24/7',
    provider: 'DowntownWindsor / YouTube',
    kind: 'embedded-live',
    statusLabel: 'PUBLIC LIVE VIDEO',
    sourceUrl: 'https://www.youtube.com/@downtownwindsor/live',
    embedUrl:
      'https://www.youtube.com/embed/hKfHWhmsR_M?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    lat: 42.3188,
    lon: -83.0415,
    locationConfidence: 'approximate downtown area',
    focusHeightM: 2600,
    description:
      'Public 24/7 street-view stream for downtown Windsor. The marker is approximate because the public stream does not publish a verified camera coordinate.',
  }),
  Object.freeze({
    id: 'detroit-windsor-tunnel-live',
    name: 'Detroit–Windsor Tunnel · Live Border Cameras',
    provider: 'Detroit Windsor Tunnel LLC',
    kind: 'official-live-page',
    statusLabel: 'OFFICIAL LIVE PAGE · 3 FEEDS',
    sourceUrl: 'https://www.dwtunnel.com/',
    lat: 42.3184,
    lon: -83.0355,
    locationConfidence: 'approximate Windsor tunnel portal',
    focusHeightM: 3600,
    description:
      'Official Detroit–Windsor Tunnel live-camera page. It publishes three border camera views plus real-time crossing information. The provider intentionally pauses camera playback after a short viewing interval and requires user interaction to continue.',
  }),
  Object.freeze({
    id: 'lakeview-marina-webcam',
    name: 'Lakeview Park Marina · Webcam',
    provider: 'City of Windsor',
    kind: 'official-live-page',
    statusLabel: 'CITY OF WINDSOR WEBCAM',
    sourceUrl:
      'https://www.citywindsor.ca/residents/recreation/outdoor-recreation/lakeview-park-marina',
    lat: 42.3388889,
    lon: -82.92,
    locationConfidence: 'official marina coordinates',
    focusHeightM: 2800,
    description:
      'Official City of Windsor webcam for current Lake St. Clair water and weather conditions at Lakeview Park Marina.',
  }),
]);

function isBmMounted() {
  const base = String(import.meta.env?.BASE_URL || '/');
  return base.startsWith('/modules/gods-eye/');
}

function markerColor(source) {
  return source.kind === 'embedded-live'
    ? Cesium.Color.LIME.withAlpha(0.96)
    : Cesium.Color.CYAN.withAlpha(0.94);
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function installStyles() {
  if (document.getElementById('bm-live-watch-styles')) return;
  const style = document.createElement('style');
  style.id = 'bm-live-watch-styles';
  style.textContent = `
    #bm-live-watch-launcher {
      position: fixed;
      right: 22px;
      top: 112px;
      z-index: 1800;
      border: 1px solid rgba(106,232,255,.58);
      background: rgba(4,12,18,.9);
      color: #baf5ff;
      font: 600 11px/1.2 'JetBrains Mono', monospace;
      letter-spacing: .08em;
      padding: 9px 12px;
      cursor: pointer;
      box-shadow: 0 0 22px rgba(47,224,255,.12);
      backdrop-filter: blur(10px);
    }
    #bm-live-watch-panel {
      position: fixed;
      right: 22px;
      top: 152px;
      width: min(410px, calc(100vw - 44px));
      max-height: calc(100vh - 176px);
      z-index: 1801;
      display: none;
      overflow: auto;
      border: 1px solid rgba(106,232,255,.45);
      background: rgba(2,9,14,.96);
      color: #dcfbff;
      font: 500 11px/1.45 'JetBrains Mono', monospace;
      box-shadow: 0 18px 60px rgba(0,0,0,.5), 0 0 30px rgba(47,224,255,.09);
      backdrop-filter: blur(16px);
    }
    #bm-live-watch-panel.open { display: block; }
    .bm-live-watch-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 13px; border-bottom: 1px solid rgba(106,232,255,.18);
    }
    .bm-live-watch-title { color: #82efff; letter-spacing: .12em; font-weight: 700; }
    .bm-live-watch-close { border: 0; background: transparent; color: #9bdde8; cursor: pointer; font-size: 16px; }
    .bm-live-watch-stage { aspect-ratio: 16/9; background: #000; position: relative; }
    .bm-live-watch-stage iframe { width: 100%; height: 100%; border: 0; display: block; }
    .bm-live-watch-placeholder {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px; padding: 26px;
      text-align: center; color: #9ebbc1; background: radial-gradient(circle at center, rgba(15,51,61,.35), rgba(0,0,0,.92));
    }
    .bm-live-watch-placeholder strong { color: #d8fbff; letter-spacing: .08em; }
    .bm-live-watch-meta { padding: 12px 13px 8px; }
    .bm-live-watch-meta h3 { margin: 0 0 5px; font-size: 12px; color: #f1feff; }
    .bm-live-watch-status { color: #72f7a4; font-weight: 700; letter-spacing: .07em; }
    .bm-live-watch-note { color: #97b5bb; margin-top: 7px; }
    .bm-live-watch-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 0 13px 12px; }
    .bm-live-watch-actions button, .bm-live-watch-actions a {
      box-sizing: border-box; min-height: 34px; display: flex; align-items: center; justify-content: center;
      border: 1px solid rgba(106,232,255,.32); background: rgba(11,35,43,.72); color: #c9f9ff;
      text-decoration: none; cursor: pointer; font: 600 10px/1 'JetBrains Mono', monospace; letter-spacing: .05em;
    }
    .bm-live-watch-list { border-top: 1px solid rgba(106,232,255,.14); padding: 8px; display: grid; gap: 6px; }
    .bm-live-watch-source {
      width: 100%; text-align: left; border: 1px solid rgba(106,232,255,.16); background: rgba(8,22,28,.72);
      color: #c3eaf0; cursor: pointer; padding: 9px 10px; font: 500 10px/1.35 'JetBrains Mono', monospace;
    }
    .bm-live-watch-source.active { border-color: rgba(114,247,164,.7); background: rgba(10,49,38,.55); }
    .bm-live-watch-source strong { display: block; color: #effeff; margin-bottom: 2px; }
    .bm-live-watch-source span { color: #7fcbd7; }
  `;
  document.head.appendChild(style);
}

/**
 * BM-only public live-video launcher. Ontario 511 remains a truthful snapshot
 * layer; this panel is reserved for sources that publicly expose live video or
 * an official live-camera page.
 */
export function mountBmLiveWatch({ viewer } = {}) {
  if (!isBmMounted() || !viewer || typeof document === 'undefined') return () => {};

  installStyles();
  const sources = BM_LIVE_WATCH_SOURCES;
  const markerEntities = new Map();
  let active = sources[0];

  const launcher = createNode('button', '', `LIVE WATCH · ${sources.length}`);
  launcher.id = 'bm-live-watch-launcher';
  launcher.type = 'button';
  launcher.title = 'Open BM public live-video sources';

  const panel = createNode('section');
  panel.id = 'bm-live-watch-panel';
  panel.setAttribute('aria-label', 'BM Live Watch public sources');

  const head = createNode('div', 'bm-live-watch-head');
  head.appendChild(createNode('div', 'bm-live-watch-title', 'BM LIVE WATCH'));
  const close = createNode('button', 'bm-live-watch-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close Live Watch');
  head.appendChild(close);

  const stage = createNode('div', 'bm-live-watch-stage');
  const meta = createNode('div', 'bm-live-watch-meta');
  const actions = createNode('div', 'bm-live-watch-actions');
  const focusButton = createNode('button', '', 'FOCUS MAP');
  focusButton.type = 'button';
  const openLink = createNode('a', '', 'OPEN SOURCE');
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  actions.append(focusButton, openLink);
  const list = createNode('div', 'bm-live-watch-list');

  panel.append(head, stage, meta, actions, list);
  document.body.append(launcher, panel);

  const buttons = new Map();

  function focus(source) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        source.lon,
        source.lat,
        source.focusHeightM || 3000,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-48),
        roll: 0,
      },
      duration: 1.4,
    });
  }

  function render(source) {
    active = source;
    stage.replaceChildren();
    if (source.embedUrl) {
      const iframe = document.createElement('iframe');
      iframe.src = source.embedUrl;
      iframe.title = `${source.name} live video`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      stage.appendChild(iframe);
    } else {
      const placeholder = createNode('div', 'bm-live-watch-placeholder');
      placeholder.append(
        createNode('strong', '', source.statusLabel),
        createNode(
          'span',
          '',
          'This provider exposes a public live-camera page but no verified direct media endpoint is wired yet. Open the official source instead of showing a fake feed.',
        ),
      );
      stage.appendChild(placeholder);
    }

    meta.replaceChildren();
    const title = createNode('h3', '', source.name);
    const status = createNode('div', 'bm-live-watch-status', source.statusLabel);
    const provider = createNode('div', '', `SOURCE · ${source.provider}`);
    const note = createNode(
      'div',
      'bm-live-watch-note',
      `${source.description} LOCATION · ${source.locationConfidence}.`,
    );
    meta.append(title, status, provider, note);

    openLink.href = source.sourceUrl;
    for (const [id, button] of buttons) button.classList.toggle('active', id === source.id);
  }

  for (const source of sources) {
    const button = createNode('button', 'bm-live-watch-source');
    button.type = 'button';
    const name = createNode('strong', '', source.name);
    const detail = createNode('span', '', `${source.statusLabel} · ${source.provider}`);
    button.append(name, detail);
    button.addEventListener('click', () => {
      panel.classList.add('open');
      render(source);
    });
    list.appendChild(button);
    buttons.set(source.id, button);

    const entity = viewer.entities.add({
      id: `bm-live-watch:${source.id}`,
      position: Cesium.Cartesian3.fromDegrees(source.lon, source.lat),
      point: {
        pixelSize: source.kind === 'embedded-live' ? 14 : 11,
        color: markerColor(source),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.88),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: source.kind === 'embedded-live' ? 'LIVE VIDEO' : 'LIVE SOURCE',
        font: '600 11px JetBrains Mono, monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.68),
        pixelOffset: new Cesium.Cartesian2(0, -18),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80_000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entity._bmLiveWatchId = source.id;
    markerEntities.set(source.id, entity);
  }

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    const id = picked?.id?._bmLiveWatchId;
    if (!id) return;
    const source = sources.find((candidate) => candidate.id === id);
    if (!source) return;
    panel.classList.add('open');
    render(source);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  launcher.addEventListener('click', () => panel.classList.toggle('open'));
  close.addEventListener('click', () => panel.classList.remove('open'));
  focusButton.addEventListener('click', () => focus(active));

  render(active);

  return () => {
    handler.destroy();
    for (const entity of markerEntities.values()) {
      if (!viewer.isDestroyed()) viewer.entities.remove(entity);
    }
    launcher.remove();
    panel.remove();
  };
}
