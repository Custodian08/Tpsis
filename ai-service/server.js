const { createServer } = require('node:http');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8001);
const maxBodySize = 1024 * 1024;

function decodePattern(pattern, quartilesCount) {
  if (typeof pattern !== 'string' || !/^\d{3,6}$/.test(pattern)) return null;
  const scores = [];
  let offset = 0;

  while (scores.length < 3 && offset < pattern.length) {
    const isTopScore = quartilesCount === 10 && pattern.slice(offset, offset + 2) === '10';
    const score = isTopScore ? 10 : Number(pattern[offset]);
    if (score < 1 || score > quartilesCount) return null;
    scores.push(score);
    offset += isTopScore ? 2 : 1;
  }

  return scores.length === 3 && offset === pattern.length ? scores : null;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function formatClientCount(count) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  const noun = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'клиентов'
    : lastDigit === 1
      ? 'клиент'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'клиента'
        : 'клиентов';
  return `${count} ${noun}`;
}

function validateRequest(data) {
  if (!data || !Number.isInteger(data.totalClients) || data.totalClients < 0) {
    return 'Поле totalClients должно быть целым неотрицательным числом.';
  }
  if (!Number.isInteger(data.quartilesCount) || data.quartilesCount < 3 || data.quartilesCount > 10) {
    return 'Количество квантилей должно быть от 3 до 10.';
  }
  if (!Array.isArray(data.segments) || data.segments.length > 1000) {
    return 'Поле segments должно содержать не более 1000 сегментов.';
  }

  const patterns = new Set();
  let assignedClients = 0;
  for (const segment of data.segments) {
    if (
      !segment ||
      typeof segment.segmentName !== 'string' ||
      segment.segmentName.trim().length === 0 ||
      segment.segmentName.length > 200 ||
      !decodePattern(segment.rfmPattern, data.quartilesCount) ||
      !Number.isInteger(segment.clientCount) ||
      segment.clientCount < 0 ||
      segment.clientCount > data.totalClients ||
      !Number.isFinite(segment.avgMonetary) ||
      typeof segment.avgMonetary !== 'number' ||
      patterns.has(segment.rfmPattern)
    ) {
      return 'Один из сегментов содержит некорректные данные.';
    }
    patterns.add(segment.rfmPattern);
    assignedClients += segment.clientCount;
  }

  if (assignedClients !== data.totalClients) {
    return 'Сумма клиентов по сегментам должна совпадать с totalClients.';
  }

  return null;
}

function interpret(data) {
  const nonEmptySegments = data.segments.filter(segment => segment.clientCount > 0);
  const totalAssigned = nonEmptySegments.reduce((sum, segment) => sum + segment.clientCount, 0);
  const totalMonetary = nonEmptySegments.reduce(
    (sum, segment) => sum + segment.avgMonetary * segment.clientCount,
    0,
  );
  const rankedByCount = [...nonEmptySegments].sort((a, b) => b.clientCount - a.clientCount);
  const rankedByValue = [...nonEmptySegments].sort(
    (a, b) => b.avgMonetary * b.clientCount - a.avgMonetary * a.clientCount,
  );
  const largest = rankedByCount[0];
  const leadingValue = rankedByValue[0];
  const riskSegments = nonEmptySegments.filter(segment => {
    const [r, f, m] = decodePattern(segment.rfmPattern, data.quartilesCount);
    const strongThreshold = Math.max(2, data.quartilesCount - 1);
    const lowRecencyThreshold = Math.floor(data.quartilesCount / 2);
    return r <= lowRecencyThreshold && f >= strongThreshold && m >= strongThreshold;
  });
  const loyalSegments = nonEmptySegments.filter(segment => {
    const [r, f, m] = decodePattern(segment.rfmPattern, data.quartilesCount);
    const strongThreshold = Math.max(2, data.quartilesCount - 1);
    return r >= strongThreshold && f >= strongThreshold && m >= strongThreshold;
  });

  const insights = [];
  if (largest && data.totalClients > 0) {
    const share = Math.round((largest.clientCount / data.totalClients) * 100);
    insights.push(
      `Крупнейшая группа — «${largest.segmentName}»: ${formatClientCount(largest.clientCount)} (${share}% базы).`,
    );
  }
  if (leadingValue && totalMonetary > 0) {
    const contribution = leadingValue.avgMonetary * leadingValue.clientCount;
    const share = Math.round((contribution / totalMonetary) * 100);
    insights.push(
      `Наибольший расчётный денежный вклад даёт группа «${leadingValue.segmentName}» (${share}% суммы Monetary по сегментам).`,
    );
  }
  if (riskSegments.length) {
    const riskCount = riskSegments.reduce((sum, segment) => sum + segment.clientCount, 0);
    insights.push(
      `${formatClientCount(riskCount)} относятся к группам с высокой Frequency/Monetary и низким Recency-баллом; это аудитория для проверки риска оттока.`,
    );
  }
  if (loyalSegments.length) {
    const loyalCount = loyalSegments.reduce((sum, segment) => sum + segment.clientCount, 0);
    insights.push(`${formatClientCount(loyalCount)} имеют высокие оценки по всем трём RFM-показателям.`);
  }
  if (!insights.length) {
    insights.push('Сегменты рассчитаны, но для содержательного сравнения требуется больше распределённых данных.');
  }

  const recommendations = [];
  if (riskSegments.length) {
    recommendations.push('Проверьте динамику покупок групп риска и рассмотрите адресную кампанию возврата клиентов.');
  }
  if (loyalSegments.length) {
    recommendations.push('Оцените удержание наиболее активных клиентов и их реакцию на программу лояльности.');
  }
  if (rankedByCount.length > 1) {
    recommendations.push('Сравните крупнейшие сегменты по доле клиентов и денежному вкладу перед выбором приоритетов.');
  }
  if (!recommendations.length) {
    recommendations.push('Проверьте полноту периода и исходных транзакций перед принятием решений по сегментам.');
  }

  return {
    summary: `Распределено ${formatClientCount(totalAssigned)} по ${nonEmptySegments.length} непустым сегментам. Интерпретация сформирована по правилам экспертной системы и не заменяет проверку исходных данных.`,
    insights,
    recommendations,
  };
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return sendJson(response, 200, { status: 'ok' });
  }
  if (request.method !== 'POST' || request.url !== '/interpret') {
    return sendJson(response, 404, { message: 'Маршрут не найден.' });
  }

  if (!request.headers['content-type']?.includes('application/json')) {
    return sendJson(response, 415, { message: 'Ожидается запрос application/json.' });
  }

  let body = '';
  request.on('data', chunk => {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodySize) {
      sendJson(response, 413, { message: 'Размер запроса превышает 1 МБ.' });
      request.destroy();
    }
  });
  request.on('end', () => {
    if (response.writableEnded) return;
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJson(response, 400, { message: 'Тело запроса должно содержать корректный JSON.' });
    }

    const validationError = validateRequest(data);
    if (validationError) {
      return sendJson(response, 400, { message: validationError });
    }
    return sendJson(response, 200, interpret(data));
  });
});

if (require.main === module) {
  server.listen(port, host, () => {
    console.log(`Сервис интерпретации RFM запущен на ${host}:${port}`);
  });
}

module.exports = { decodePattern, validateRequest, interpret };
