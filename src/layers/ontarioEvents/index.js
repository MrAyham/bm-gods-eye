import * as Cesium from 'cesium';

function eventColor(event) {
  if (event.fullClosure) return Cesium.Color.RED;
  const severity = String(event.severity || event.impact || '').toLowerCase();
  if (/major|high|severe|critical/.test(severity)) return Cesium.Color.ORANGERED;
  if (/moderate|medium/.test(severity)) return Cesium.Color.ORANGE;
  return Cesium.Color.GOLD;
}

function eventLabel(event) {
  return (
    [event.eventType, event.roadway, event.direction].filter(Boolean).join(' · ') ||
    'Ontario Road Event'
  );
}

function eventMapLabel(event) {
  return (
    [event.fullClosure ? 'CLOSED' : event.eventType, event.roadway]
      .filter(Boolean)
      .join(' · ') || 'ROAD EVENT'
  );
}

/** Native Cesium layer for verified Ontario 511 road events from BM Core. */
export function createOntarioEventsLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Ontario events require a snapshot source');

  let dataSource = null;
  let request = null;
  let enabled = false;
  let count = 0;
  let lastUpdate = null;
  let lastError = null;

  return {
    id: 'ontario-events',
    name: 'Ontario Road Events',
    icon: '⚠',
    source: 'Ontario 511 · BM',
    updateInterval: 60_000,

    init(viewer) {
      if (dataSource)
        throw new Error('Ontario events layer is already initialized');
      dataSource = new Cesium.CustomDataSource('ontario-events');
      dataSource.show = false;
      viewer.dataSources.add(dataSource);
    },

    enable() {
      enabled = true;
      if (dataSource) dataSource.show = true;
    },

    disable() {
      request?.abort();
      request = null;
      enabled = false;
      if (dataSource) dataSource.show = false;
    },

    async update() {
      if (!enabled || !dataSource) return false;
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const rows = await source.getSnapshot({ signal: current.signal });
        if (current.signal.aborted || request !== current || !enabled)
          return false;

        dataSource.entities.removeAll();
        for (const event of rows) {
          const color = eventColor(event);
          dataSource.entities.add(
            new Cesium.Entity({
              id: `ontario-event:${event.id}`,
              name: eventLabel(event),
              position: Cesium.Cartesian3.fromDegrees(event.lon, event.lat),
              point: {
                pixelSize: event.fullClosure ? 16 : 12,
                color: color.withAlpha(0.97),
                outlineColor: Cesium.Color.BLACK.withAlpha(0.9),
                outlineWidth: 3,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(
                  2_000,
                  1.15,
                  650_000,
                  0.85,
                ),
              },
              label: {
                text: eventMapLabel(event),
                font: '600 12px JetBrains Mono, monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
                backgroundPadding: new Cesium.Cartesian2(7, 4),
                pixelOffset: new Cesium.Cartesian2(0, -19),
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                  0,
                  180_000,
                ),
                scaleByDistance: new Cesium.NearFarScalar(
                  5_000,
                  1,
                  180_000,
                  0.72,
                ),
              },
              properties: {
                provider: 'Ontario 511',
                verifiedPublicSource: true,
                roadway: event.roadway,
                direction: event.direction,
                description: event.description,
                eventType: event.eventType,
                eventSubType: event.eventSubType,
                fullClosure: event.fullClosure,
                severity: event.severity,
                impact: event.impact,
                lanesAffected: event.lanesAffected,
                lastUpdated: event.lastUpdated,
                plannedEnd: event.plannedEnd,
              },
            }),
          );
        }
        count = rows.length;
        lastUpdate = Date.now();
        lastError = null;
        return true;
      } catch (error) {
        if (current.signal.aborted || request !== current || !enabled)
          return false;
        lastError = error?.message || 'Ontario events source unavailable';
        return false;
      } finally {
        if (request === current) request = null;
      }
    },

    destroy(viewer) {
      request?.abort();
      request = null;
      enabled = false;
      if (dataSource) {
        viewer.dataSources.remove(dataSource, true);
        dataSource = null;
      }
      count = 0;
      lastUpdate = null;
      lastError = null;
    },

    getStats() {
      return { count, lastUpdate, error: lastError };
    },
  };
}
