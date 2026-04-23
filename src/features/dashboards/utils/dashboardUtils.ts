import type { DashboardRow } from '../types';

export const chartPalette = ['#2563eb', '#0ea5e9', '#10b981', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#e11d48'];

export const formatCurrencyBRL = (value: number) => {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatNumberBR = (value: number) => {
  return Number(value || 0).toLocaleString('pt-BR');
};

export const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d,.-]/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  let finalValue = normalized;
  if (hasComma && hasDot) {
    finalValue = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    finalValue = normalized.replace(',', '.');
  }

  const parsed = Number(finalValue);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseDateStrict = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
};

export const toApiDate = (value: string) => {
  const parsed = parseDateStrict(value);
  if (!parsed) return '';

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
};

export const todayPtBr = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

export const monthStartPtBr = () => {
  const now = new Date();
  const day = '01';
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

export const sortRows = (rows: DashboardRow[], measureKey?: string) => {
  return [...rows].sort((a, b) => {
    const orderA = Number(a.order ?? 0);
    const orderB = Number(b.order ?? 0);

    if (orderA && orderB && orderA !== orderB) {
      return orderA - orderB;
    }

    if (measureKey) {
      const valA = Number(a[measureKey] ?? 0);
      const valB = Number(b[measureKey] ?? 0);
      if (valA !== valB) return valB - valA;
    }

    return String(a.label).localeCompare(String(b.label), 'pt-BR');
  });
};

export const limitRowsForPie = (rows: DashboardRow[], measureKey: string, maxItems = 8): DashboardRow[] => {
  if (rows.length <= maxItems) return rows;

  const sorted = [...rows].sort((a, b) => Number(b[measureKey] ?? 0) - Number(a[measureKey] ?? 0));
  const top = sorted.slice(0, maxItems - 1);
  const rest = sorted.slice(maxItems - 1);

  const othersValue = rest.reduce((acc, item) => acc + Number(item[measureKey] ?? 0), 0);

  return [
    ...top,
    {
      key: 'outros',
      label: 'Outros',
      [measureKey]: othersValue,
    },
  ];
};

export const groupSum = <T>(
  items: T[],
  getKey: (item: T) => string,
  getLabel: (item: T) => string,
  getOrder: (item: T) => number | undefined,
  metricMappers: Record<string, (item: T) => number>,
) => {
  const grouped = new Map<string, DashboardRow>();

  for (const item of items) {
    const key = String(getKey(item) || '-').trim() || '-';
    const label = String(getLabel(item) || key).trim() || key;

    const current = grouped.get(key) || { key, label, order: getOrder(item) };

    for (const [metricKey, metricFn] of Object.entries(metricMappers)) {
      const currentValue = Number(current[metricKey] ?? 0);
      current[metricKey] = currentValue + Number(metricFn(item) ?? 0);
    }

    if (!current.order) {
      current.order = getOrder(item);
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values());
};
