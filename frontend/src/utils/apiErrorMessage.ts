interface ApiErrorShape {
  response?: {
    status?: number;
    data?: { message?: string | string[] };
  };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = (typeof error === 'object' && error !== null ? error : {}) as ApiErrorShape;
  const status = apiError.response?.status;
  const message = apiError.response?.data?.message;

  if (status === 413) return 'Файл или запрос слишком большой.';
  if (status === 429) return 'Слишком много запросов. Подождите немного и повторите.';
  if (status !== undefined && status >= 500) {
    return 'Сервер не смог выполнить запрос. Повторите попытку позже.';
  }
  if (Array.isArray(message) && message.length) return message.join('\n');
  if (typeof message === 'string' && message && message.toLowerCase() !== 'internal server error') {
    return message;
  }
  if (!apiError.response && error instanceof Error && error.message === 'Network Error') {
    return 'Не удалось связаться с сервером. Проверьте, запущен ли backend.';
  }
  return fallback;
}
