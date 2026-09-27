export const RFM_SCORING_METHOD_VERSION = 'midpoint-rank-v1';

export type ScoreLevel = 'low' | 'medium' | 'high';
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function utcDayTimestamp(value: Date): number {
  const day = new Date(0);
  day.setUTCFullYear(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  day.setUTCHours(0, 0, 0, 0);
  return day.getTime();
}

export function parseUtcCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function getInclusivePeriodDays(start: Date, end: Date): number | null {
  const startDay = utcDayTimestamp(start);
  const endDay = utcDayTimestamp(end);
  if (startDay > endDay) return null;
  return Math.floor((endDay - startDay) / DAY_IN_MILLISECONDS) + 1;
}

export interface RfmTransactionInput {
  clientId: number;
  transactionDate: Date | string;
  amount: number | string;
}

export interface RfmClientMetrics {
  clientId: number;
  recency: number;
  frequency: number;
  monetary: number;
}

export function calculateClientMetrics(
  transactions: RfmTransactionInput[],
  referenceDate: Date,
): RfmClientMetrics[] {
  const clients = new Map<number, {
    frequency: number;
    monetaryCents: number;
    lastTransactionDate: Date;
  }>();

  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.transactionDate);
    const client = clients.get(transaction.clientId) || {
      frequency: 0,
      monetaryCents: 0,
      lastTransactionDate: transactionDate,
    };
    client.frequency += 1;
    client.monetaryCents += Math.round(Number(transaction.amount) * 100);
    if (transactionDate > client.lastTransactionDate) {
      client.lastTransactionDate = transactionDate;
    }
    clients.set(transaction.clientId, client);
  }

  const referenceDay = utcDayTimestamp(referenceDate);

  return [...clients.entries()].map(([clientId, metric]) => {
    const lastTransactionDay = utcDayTimestamp(metric.lastTransactionDate);
    return {
      clientId,
      recency: Math.max(0, Math.floor((referenceDay - lastTransactionDay) / DAY_IN_MILLISECONDS)),
      frequency: metric.frequency,
      monetary: metric.monetaryCents / 100,
    };
  });
}

export function calculateRankScores(
  values: number[],
  scoreCount: number,
  lowerIsBetter: boolean,
): number[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const scoresByValue = new Map<number, number>();
  let groupStart = 0;

  while (groupStart < sorted.length) {
    let groupEnd = groupStart;
    while (groupEnd + 1 < sorted.length && sorted[groupEnd + 1] === sorted[groupStart]) {
      groupEnd += 1;
    }

    const percentile = sorted.length === 1
      ? 0.5
      : ((groupStart + groupEnd) / 2) / (sorted.length - 1);
    const orientedPercentile = lowerIsBetter ? 1 - percentile : percentile;
    const score = Math.min(scoreCount, Math.floor(orientedPercentile * scoreCount) + 1);
    scoresByValue.set(sorted[groupStart], score);
    groupStart = groupEnd + 1;
  }

  return values.map(value => scoresByValue.get(value)!);
}

export function getScoreLevel(score: number, scoreCount: number): ScoreLevel {
  const lowThreshold = Math.floor(scoreCount / 3);
  const highThreshold = Math.floor((2 * scoreCount) / 3) + 1;
  if (score <= lowThreshold) return 'low';
  if (score >= highThreshold) return 'high';
  return 'medium';
}

export function getSegmentName(r: number, f: number, m: number, scoreCount: number): string {
  const rLevel = getScoreLevel(r, scoreCount);
  const fLevel = getScoreLevel(f, scoreCount);
  const mLevel = getScoreLevel(m, scoreCount);
  const pattern = `${r}${f}${m}`;

  if (rLevel === 'high' && fLevel === 'high' && mLevel === 'high') {
    return `Лояльные клиенты (${pattern})`;
  }
  if (rLevel === 'low' && fLevel === 'high' && mLevel === 'high') {
    return `Клиенты группы риска (${pattern})`;
  }
  if (rLevel === 'high' && fLevel === 'low' && mLevel === 'high') {
    return `Новые ценные клиенты (${pattern})`;
  }
  if (rLevel === 'low' && fLevel === 'low' && mLevel === 'low') {
    return `Потерянные клиенты (${pattern})`;
  }

  const levelNames = { low: 'низкий', medium: 'средний', high: 'высокий' };
  return `R ${levelNames[rLevel]} · F ${levelNames[fLevel]} · M ${levelNames[mLevel]} (${pattern})`;
}
