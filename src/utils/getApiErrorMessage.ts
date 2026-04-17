type ApiLikeResponse = {
  statusCode?: number;
  jsonBody?: any;
  data?: any;
  bodyText?: string;
};

const asText = (value: unknown) => String(value ?? '').trim();

const collectValidationErrors = (errors: any): string[] => {
  if (!errors) return [];

  if (Array.isArray(errors)) {
    return errors.map((item) => asText(item)).filter(Boolean);
  }

  if (typeof errors !== 'object') {
    const text = asText(errors);
    return text ? [text] : [];
  }

  const entries: string[] = [];

  Object.entries(errors).forEach(([field, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const text = asText(item);
        if (text) entries.push(`${field}: ${text}`);
      });
      return;
    }

    const text = asText(value);
    if (text) entries.push(`${field}: ${text}`);
  });

  return entries;
};

export const getApiErrorMessage = (
  response: ApiLikeResponse | null | undefined,
  fallbackMessage = 'Não foi possível concluir a operação.',
): string => {
  const responseBodyText = asText(response?.bodyText);

  let payload = response?.jsonBody ?? response?.data;
  if (!payload && responseBodyText.startsWith('{')) {
    try {
      payload = JSON.parse(responseBodyText);
    } catch {
      // ignore malformed payload strings and keep fallback behavior
    }
  }

  if (typeof payload === 'string') {
    const text = asText(payload);
    return text || responseBodyText || fallbackMessage;
  }

  const directMessages = [
    payload?.message,
    payload?.Message,
    payload?.mensagem,
    payload?.Mensagem,
    payload?.title,
    payload?.Title,
    payload?.error,
    payload?.Error,
    payload?.detail,
    payload?.Detail,
    payload?.descricao,
    payload?.Descricao,
  ]
    .map((item) => asText(item))
    .filter(Boolean);

  const validationMessages = collectValidationErrors(
    payload?.errors ?? payload?.Errors ?? payload?.erros ?? payload?.Erros ?? payload?.ModelState,
  );

  const messages = [...directMessages, ...validationMessages].filter(Boolean);

  if (messages.length > 0) {
    return Array.from(new Set(messages)).join(' - ');
  }

  if (responseBodyText) {
    return responseBodyText;
  }

  if (response?.statusCode && response.statusCode >= 400) {
    return `${fallbackMessage} (HTTP ${response.statusCode})`;
  }

  return fallbackMessage;
};
