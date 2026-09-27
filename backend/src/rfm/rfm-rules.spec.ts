import {
  calculateClientMetrics,
  calculateRankScores,
  getInclusivePeriodDays,
  getScoreLevel,
  getSegmentName,
  RFM_SCORING_METHOD_VERSION,
  parseUtcCalendarDate,
} from './rfm-rules';

describe('RFM calculation rules', () => {
  it('accepts real calendar dates, rejects invalid dates, and counts period boundaries inclusively', () => {
    expect(parseUtcCalendarDate('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(parseUtcCalendarDate('2025-02-29')).toBeNull();
    expect(parseUtcCalendarDate('2025-01-01T00:00:00Z')).toBeNull();

    const start = parseUtcCalendarDate('2025-01-01')!;
    const sameDay = parseUtcCalendarDate('2025-01-01')!;
    const end = parseUtcCalendarDate('2025-01-03')!;
    expect(getInclusivePeriodDays(start, sameDay)).toBe(1);
    expect(getInclusivePeriodDays(start, end)).toBe(3);
    expect(getInclusivePeriodDays(end, start)).toBeNull();
  });

  it('counts transaction rows, sums signed amounts in cents and anchors Recency to the reference day', () => {
    const metrics = calculateClientMetrics([
      { clientId: 1, transactionDate: '2025-01-01', amount: '0.10' },
      { clientId: 1, transactionDate: '2025-01-05', amount: '0.20' },
      { clientId: 1, transactionDate: '2025-01-03', amount: '-0.05' },
      { clientId: 2, transactionDate: '2025-01-06', amount: '15.00' },
    ], new Date('2025-01-10T00:00:00.000Z'));

    expect(metrics).toEqual([
      { clientId: 1, recency: 5, frequency: 3, monetary: 0.25 },
      { clientId: 2, recency: 4, frequency: 1, monetary: 15 },
    ]);
  });

  it('assigns higher Recency scores to more recent values', () => {
    expect(calculateRankScores([30, 0, 10], 5, true)).toEqual([1, 5, 3]);
  });

  it('assigns higher Frequency and Monetary scores to larger values', () => {
    expect(calculateRankScores([1, 3, 2], 3, false)).toEqual([1, 3, 2]);
  });

  it('keeps tied values together and gives a single-value sample a neutral score', () => {
    expect(calculateRankScores([1, 1, 2, 3], 5, false)).toEqual([1, 1, 4, 5]);
    expect(calculateRankScores([42], 5, false)).toEqual([3]);
  });

  it('uses three distinct low, medium and high bands for supported quantile counts', () => {
    for (const scoreCount of [3, 4, 5, 10]) {
      const levels = Array.from({ length: scoreCount }, (_, index) =>
        getScoreLevel(index + 1, scoreCount),
      );
      expect(levels).toContain('low');
      expect(levels).toContain('medium');
      expect(levels).toContain('high');
    }
  });

  it('uses the same RFM rules for named segments and records a version', () => {
    expect(getSegmentName(5, 5, 5, 5)).toBe('Лояльные клиенты (555)');
    expect(getSegmentName(1, 5, 5, 5)).toBe('Клиенты группы риска (155)');
    expect(RFM_SCORING_METHOD_VERSION).toBe('midpoint-rank-v1');
  });
});
