const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const collectSearchText = (value: unknown, visited: WeakSet<object>): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => collectSearchText(item, visited)).join(' ');
  }

  if (typeof value === 'object') {
    if (visited.has(value)) {
      return '';
    }

    visited.add(value);
    return Object.values(value).map((item) => collectSearchText(item, visited)).join(' ');
  }

  return '';
};

export const filterListByTerm = <T>(items: T[], term: string): T[] => {
  const normalizedTerm = normalizeText(term.trim());
  if (!normalizedTerm) {
    return items;
  }

  return items.filter((item) => {
    const searchableText = collectSearchText(item, new WeakSet<object>());
    return normalizeText(searchableText).includes(normalizedTerm);
  });
};