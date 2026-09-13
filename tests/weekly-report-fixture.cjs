const now = new Date('2026-09-13T12:00:00Z');
function database(empty = false) {
  const groups = [
    [{ source: 'NFC', _count: { _all: 7 } }, { source: 'QR', _count: { _all: 3 } }],
    [{ storeId: 's1', _count: { _all: 10 } }],
    [{ storeId: 's1', _count: { _all: 5 } }, { storeId: 's2', _count: { _all: 5 } }],
    [{ cardId: 'c1', _count: { _all: 10 } }],
    [{ cardId: 'c1', _max: { createdAt: now } }, { cardId: 'c2', _max: { createdAt: new Date('2026-08-01') } }],
  ];
  let counts = 0, lists = 0, groupIndex = 0;
  return {
    business: { findUnique: async () => ({ id: 'b1', name: 'Business' }) },
    store: { findMany: async () => empty ? [] : [
      { id: 's1', name: 'Main', createdAt: new Date('2025-01-01') },
      { id: 's2', name: 'Branch', createdAt: new Date('2025-01-01') },
    ] },
    card: { findMany: async () => empty ? [] : [
      { id: 'c1', label: 'Counter', code: 'abcdef123', storeId: 's1' },
      { id: 'c2', label: null, code: 'ghijkl123', storeId: 's2' },
      { id: 'c3', label: null, code: 'mnopqr123', storeId: 's2' },
    ] },
    interaction: {
      count: async () => [10, 10][counts++],
      groupBy: async () => groups[groupIndex++],
      findMany: async () => lists++ === 0 ? [{ visitorKey: 'v1' }, { visitorKey: 'v2' }] : [
        { createdAt: new Date('2026-09-12T20:00:00Z') },
        { createdAt: new Date('2026-09-12T20:30:00Z') },
        { createdAt: new Date('2026-09-12T21:00:00Z') },
      ],
    },
  };
}
module.exports = { now, database };
