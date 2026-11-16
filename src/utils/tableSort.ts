export type SortDirection = 'asc' | 'desc';

const SORT_COLLATOR = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

/** Compara textos respeitando acentuação e ordenação numérica natural (pt-BR). */
export const compareSortText = (a: unknown, b: unknown): number =>
  SORT_COLLATOR.compare(String(a ?? '').trim(), String(b ?? '').trim());

/** Compara valores numéricos de forma segura (strings numéricas, null/undefined). */
export const compareSortNumber = (a: unknown, b: unknown): number => {
  const numA = Number(a ?? 0);
  const numB = Number(b ?? 0);
  const safeA = Number.isFinite(numA) ? numA : 0;
  const safeB = Number.isFinite(numB) ? numB : 0;
  return safeA - safeB;
};

/** Converte data ISO ou DD/MM/AAAA em timestamp numérico para ordenação cronológica. */
export const parseSortTimestamp = (value: unknown): number => {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text;
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? ts : 0;
};

/** Calcula o próximo estado de ordenação ao clicar no cabeçalho da coluna. */
export const nextSortState = <T extends string>(
  currentField: T,
  currentDirection: SortDirection,
  clickedField: T,
): { field: T; direction: SortDirection } => {
  if (currentField === clickedField) {
    return {
      field: currentField,
      direction: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    field: clickedField,
    direction: 'asc',
  };
};

/** Retorna indicador visual no padrão da tela de Nota Fiscal de Serviço. */
export const getSortIndicator = <T extends string>(
  activeField: T,
  direction: SortDirection,
  field: T,
): string => {
  if (activeField !== field) return '▲▼';
  return direction === 'asc' ? '▲' : '▼';
};

/** Retorna o atributo aria-sort apenas para a coluna atualmente ordenada. */
export const getAriaSort = <T extends string>(
  activeField: T,
  direction: SortDirection,
  field: T,
): 'ascending' | 'descending' | undefined => {
  if (activeField !== field) return undefined;
  return direction === 'asc' ? 'ascending' : 'descending';
};

/** Ordena uma lista sem mutar o array original usando o comparador em ordem asc/desc. */
export const sortByComparator = <T>(
  items: readonly T[],
  direction: SortDirection,
  comparator: (a: T, b: T) => number,
): T[] => {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => comparator(a, b) * factor);
};
