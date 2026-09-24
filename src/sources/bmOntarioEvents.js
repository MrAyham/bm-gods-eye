import { fetchBmOntarioOps } from '../bmOntarioOps.js';

/** Ontario 511 incident/closure snapshot supplied by authenticated BM Core. */
export function createBmOntarioEventsSource({ fetchOntarioOps = fetchBmOntarioOps } = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      const payload = await fetchOntarioOps(signal);
      if (payload?.status?.events !== 'live') {
        throw new Error('BM Ontario traffic events feed is unavailable');
      }
      return (payload.events || [])
        .filter((event) => Number.isFinite(event?.latitude) && Number.isFinite(event?.longitude))
        .map((event) => ({
          id: String(event.id || ''),
          lat: Number(event.latitude),
          lon: Number(event.longitude),
          roadway: event.roadway || null,
          direction: event.direction || null,
          description: event.description || null,
          eventType: event.eventType || 'Road Event',
          eventSubType: event.eventSubType || null,
          fullClosure: Boolean(event.fullClosure),
          severity: event.severity || null,
          impact: event.impact || null,
          lanesAffected: event.lanesAffected || null,
          lastUpdated: event.lastUpdated || null,
          plannedEnd: event.plannedEnd || null,
        }));
    },
  };
}
