import apiManager, { ApiCallType } from '../../../services/apiManager';

const DASHBOARD_TIMEOUT_MS = 120000;

type DashboardChunk = {
  dataDe: string;
  dataAte: string;
};

type DashboardParams = {
  baseUrl: string;
  token?: string;
  codigoEmpresa: string;
  dataDe: string;
  dataAte: string;
};

const normalizeBaseUrl = (url: string) => String(url || '').replace(/\/$/, '');

export type FinanceiroApiItem = Record<string, any>;

export type DashboardFinanceiroResponse = {
  MoedasSemCotacao: Array<Record<string, any>>;
  FluxoCaixaReceitas: FinanceiroApiItem[];
  FluxoCaixaDespesas: FinanceiroApiItem[];
};

export type DashboardVendasResponse = {
  MoedasSemCotacao: Array<Record<string, any>>;
  Faturamento: Array<Record<string, any>>;
  Atraso: Array<Record<string, any>>;
  Forecast: Array<Record<string, any>>;
};

const ensureArray = (value: unknown) => (Array.isArray(value) ? value : []);
const pickFirst = (body: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in body) return body[key];
  }
  return undefined;
};

const parsePtBrDate = (value: string) => {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
};

const toPtBrDate = (value: Date) => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = String(value.getFullYear());
  return `${day}/${month}/${year}`;
};

const buildMonthlyChunks = (dataDe: string, dataAte: string): DashboardChunk[] => {
  const from = parsePtBrDate(dataDe);
  const to = parsePtBrDate(dataAte);

  if (!from || !to || from.getTime() > to.getTime()) {
    return [{ dataDe, dataAte }];
  }

  const chunks: DashboardChunk[] = [];
  let currentStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  while (currentStart.getTime() <= to.getTime()) {
    const monthEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0);
    const currentEnd = monthEnd.getTime() < to.getTime() ? monthEnd : to;

    chunks.push({
      dataDe: toPtBrDate(currentStart),
      dataAte: toPtBrDate(currentEnd),
    });

    currentStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate() + 1);
  }

  return chunks;
};

const mergeMoedasSemCotacao = (allChunks: Array<Array<Record<string, any>>>) => {
  const merged = new Map<string, Record<string, any>>();

  for (const moedas of allChunks) {
    for (const moedaItem of moedas ?? []) {
      const key = String(moedaItem?.moeda ?? moedaItem?.Moeda ?? '').trim();
      if (!key) continue;
      if (!merged.has(key)) {
        merged.set(key, { moeda: key });
      }
    }
  }

  return Array.from(merged.values());
};

const parseMoedasSemCotacao = (body: Record<string, unknown>) => {
  const moedasSemCotacaoRaw = pickFirst(body, ['MoedasSemCotacao', 'moedasSemCotacao']);

  return Array.isArray(moedasSemCotacaoRaw)
    ? moedasSemCotacaoRaw
    : String(moedasSemCotacaoRaw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => ({ moeda: item }));
};

export const getDashboardFinanceiro = async ({
  baseUrl,
  token,
  codigoEmpresa,
  dataDe,
  dataAte,
}: DashboardParams): Promise<DashboardFinanceiroResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Dashboards/Financeiro`;
  const chunks = buildMonthlyChunks(dataDe, dataAte);
  const receitas: FinanceiroApiItem[] = [];
  const despesas: FinanceiroApiItem[] = [];
  const moedasChunks: Array<Array<Record<string, any>>> = [];

  for (const chunk of chunks) {
    const response = await apiManager.makeApiCall(
      url,
      ApiCallType.GET,
      token ? { Authorization: `Bearer ${token}` } : {},
      {
        Codigo_Empresa: codigoEmpresa,
        Data_De: chunk.dataDe,
        Data_Ate: chunk.dataAte,
      },
      null,
      { timeoutMs: DASHBOARD_TIMEOUT_MS },
    );

    if (!response.succeeded) {
      throw new Error(response.bodyText || 'Erro ao consultar dashboard financeiro.');
    }

    const body = (response.jsonBody ?? response.data ?? {}) as Record<string, unknown>;
    moedasChunks.push(parseMoedasSemCotacao(body));
    receitas.push(...ensureArray(pickFirst(body, ['FluxoCaixaReceitas', 'fluxoCaixaReceitas'])));
    despesas.push(...ensureArray(pickFirst(body, ['FluxoCaixaDespesas', 'fluxoCaixaDespesas'])));
  }

  return {
    MoedasSemCotacao: mergeMoedasSemCotacao(moedasChunks),
    FluxoCaixaReceitas: receitas,
    FluxoCaixaDespesas: despesas,
  };
};

export const getDashboardVendas = async ({
  baseUrl,
  token,
  codigoEmpresa,
  dataDe,
  dataAte,
}: DashboardParams): Promise<DashboardVendasResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Dashboards/Vendas`;
  const chunks = buildMonthlyChunks(dataDe, dataAte);
  const faturamento: Array<Record<string, any>> = [];
  const atraso: Array<Record<string, any>> = [];
  const forecast: Array<Record<string, any>> = [];
  const moedasChunks: Array<Array<Record<string, any>>> = [];

  for (const chunk of chunks) {
    const response = await apiManager.makeApiCall(
      url,
      ApiCallType.GET,
      token ? { Authorization: `Bearer ${token}` } : {},
      {
        Codigo_Empresa: codigoEmpresa,
        Data_De: chunk.dataDe,
        Data_Ate: chunk.dataAte,
      },
      null,
      { timeoutMs: DASHBOARD_TIMEOUT_MS },
    );

    if (!response.succeeded) {
      throw new Error(response.bodyText || 'Erro ao consultar dashboard de vendas.');
    }

    const body = (response.jsonBody ?? response.data ?? {}) as Record<string, unknown>;
    moedasChunks.push(parseMoedasSemCotacao(body));
    faturamento.push(...ensureArray(pickFirst(body, ['Faturamento', 'faturamento'])));
    atraso.push(...ensureArray(pickFirst(body, ['Atraso', 'atraso'])));
    forecast.push(...ensureArray(pickFirst(body, ['Forecast', 'forecast'])));
  }

  return {
    MoedasSemCotacao: mergeMoedasSemCotacao(moedasChunks),
    Faturamento: faturamento,
    Atraso: atraso,
    Forecast: forecast,
  };
};
