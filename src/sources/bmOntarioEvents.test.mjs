import test from 'node:test';
import assert from 'node:assert/strict';
import { createBmOntarioEventsSource } from './bmOntarioEvents.js';

test('BM Ontario events source returns only geocoded verified road events', async () => {
  const source = createBmOntarioEventsSource({
    fetchOntarioOps: async () => ({
      status: { events: 'live' },
      events: [
        {
          id: 'a',
          latitude: 42.31,
          longitude: -83.03,
          roadway: 'Highway 401',
          direction: 'Eastbound',
          description: 'Lane blocked',
          eventType: 'Incident',
          fullClosure: false,
          severity: 'Moderate',
        },
        { id: 'missing-coordinates', latitude: null, longitude: null },
      ],
    }),
  });

  const rows = await source.getSnapshot();
  assert.equal(rows.length, 1);
  assert.deepEqual(
    {
      id: rows[0].id,
      lat: rows[0].lat,
      lon: rows[0].lon,
      eventType: rows[0].eventType,
      severity: rows[0].severity,
    },
    {
      id: 'a',
      lat: 42.31,
      lon: -83.03,
      eventType: 'Incident',
      severity: 'Moderate',
    },
  );
});

test('BM Ontario events source refuses unavailable feed state', async () => {
  const source = createBmOntarioEventsSource({
    fetchOntarioOps: async () => ({ status: { events: 'unavailable' }, events: [] }),
  });
  await assert.rejects(source.getSnapshot(), /feed is unavailable/i);
});
