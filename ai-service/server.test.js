const test = require('node:test');
const assert = require('node:assert/strict');
const { interpret, validateRequest } = require('./server');

const baseRequest = {
  totalClients: 12,
  quartilesCount: 5,
  segments: [
    { segmentName: 'Лояльные', rfmPattern: '555', clientCount: 4, avgMonetary: 300 },
    { segmentName: 'В зоне риска', rfmPattern: '155', clientCount: 3, avgMonetary: 200 },
    { segmentName: 'Новые', rfmPattern: '511', clientCount: 5, avgMonetary: 50 },
  ],
};

test('reports the largest group, monetary contribution, loyal and risk groups', () => {
  const result = interpret(baseRequest);

  assert.match(result.summary, /12 клиентов по 3 непустым сегментам/);
  assert.ok(result.insights.some(item => item.includes('«Новые»: 5 клиентов (42% базы)')));
  assert.ok(result.insights.some(item => item.includes('«Лояльные» (59% суммы Monetary')));
  assert.ok(result.insights.some(item => item.includes('3 клиента') && item.includes('риска оттока')));
  assert.ok(result.insights.some(item => item.includes('4 клиента имеют высокие оценки')));
  assert.ok(result.recommendations.some(item => item.includes('кампанию возврата')));
  assert.ok(result.recommendations.some(item => item.includes('программу лояльности')));
});

test('returns a useful neutral interpretation for an empty population', () => {
  const result = interpret({ totalClients: 0, quartilesCount: 5, segments: [] });

  assert.match(result.summary, /0 клиентов по 0 непустым сегментам/);
  assert.equal(result.insights.length, 1);
  assert.equal(result.recommendations.length, 1);
});

test('supports two-digit scores when ten quantiles are selected', () => {
  const request = {
    totalClients: 1,
    quartilesCount: 10,
    segments: [{ segmentName: 'Максимум', rfmPattern: '101010', clientCount: 1, avgMonetary: 10 }],
  };

  assert.equal(validateRequest(request), null);
  assert.ok(interpret(request).insights.some(item => item.includes('1 клиент')));
});

test('does not classify the middle Recency score as low when three quantiles are used', () => {
  const request = {
    totalClients: 2,
    quartilesCount: 3,
    segments: [
      { segmentName: 'Низкий R', rfmPattern: '133', clientCount: 1, avgMonetary: 100 },
      { segmentName: 'Средний R', rfmPattern: '233', clientCount: 1, avgMonetary: 50 },
    ],
  };
  const result = interpret(request);

  assert.ok(result.insights.some(item => item.includes('1 клиент') && item.includes('риска оттока')));
});

test('rejects inconsistent client totals and duplicate patterns', () => {
  const inconsistent = { ...baseRequest, totalClients: 13 };
  assert.match(validateRequest(inconsistent), /должна совпадать/);

  const duplicated = {
    totalClients: 2,
    quartilesCount: 5,
    segments: [
      { segmentName: 'Первый', rfmPattern: '555', clientCount: 1, avgMonetary: 20 },
      { segmentName: 'Второй', rfmPattern: '555', clientCount: 1, avgMonetary: 10 },
    ],
  };
  assert.match(validateRequest(duplicated), /некорректные данные/);
});

test('rejects malformed RFM patterns and segment names', () => {
  const invalidPattern = structuredClone(baseRequest);
  invalidPattern.segments[0].rfmPattern = '666';
  assert.match(validateRequest(invalidPattern), /некорректные данные/);

  const invalidName = structuredClone(baseRequest);
  invalidName.segments[0].segmentName = '   ';
  assert.match(validateRequest(invalidName), /некорректные данные/);
});

test('does not claim a monetary leader when aggregate monetary value is non-positive', () => {
  const request = {
    totalClients: 2,
    quartilesCount: 5,
    segments: [
      { segmentName: 'Возвраты', rfmPattern: '111', clientCount: 2, avgMonetary: -25 },
    ],
  };
  const result = interpret(request);

  assert.ok(!result.insights.some(item => item.includes('денежный вклад')));
});
