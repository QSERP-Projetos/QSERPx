import apiManager, { ApiCallType } from '../../../services/apiManager';

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

export const getDashboardFinanceiro = async ({
  baseUrl,
  token,
  codigoEmpresa,
  dataDe,
  dataAte,
}: DashboardParams): Promise<DashboardFinanceiroResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Dashboards/Financeiro`;

  const response = await apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    token ? { Authorization: `Bearer ${token}` } : {},
    {
      Codigo_Empresa: codigoEmpresa,
      Data_De: dataDe,
      Data_Ate: dataAte,
    },
  );

  if (!response.succeeded) {
    throw new Error(response.bodyText || 'Erro ao consultar dashboard financeiro.');
  }

  const body = (response.jsonBody ?? response.data ?? {}) as Record<string, unknown>;
  const moedasSemCotacaoRaw = pickFirst(body, ['MoedasSemCotacao', 'moedasSemCotacao']);

  const moedasSemCotacao = Array.isArray(moedasSemCotacaoRaw)
    ? moedasSemCotacaoRaw
    : String(moedasSemCotacaoRaw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => ({ moeda: item }));

  return {
    MoedasSemCotacao: moedasSemCotacao,
    FluxoCaixaReceitas: ensureArray(pickFirst(body, ['FluxoCaixaReceitas', 'fluxoCaixaReceitas'])),
    FluxoCaixaDespesas: ensureArray(pickFirst(body, ['FluxoCaixaDespesas', 'fluxoCaixaDespesas'])),
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

  const response = await apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    token ? { Authorization: `Bearer ${token}` } : {},
    {
      Codigo_Empresa: codigoEmpresa,
      Data_De: dataDe,
      Data_Ate: dataAte,
    },
  );

  if (!response.succeeded) {
    throw new Error(response.bodyText || 'Erro ao consultar dashboard de vendas.');
  }

  const body = (response.jsonBody ?? response.data ?? {}) as Record<string, unknown>;
  const moedasSemCotacaoRaw = pickFirst(body, ['MoedasSemCotacao', 'moedasSemCotacao']);

  const moedasSemCotacao = Array.isArray(moedasSemCotacaoRaw)
    ? moedasSemCotacaoRaw
    : String(moedasSemCotacaoRaw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => ({ moeda: item }));

  return {
    MoedasSemCotacao: moedasSemCotacao,
    Faturamento: ensureArray(pickFirst(body, ['Faturamento', 'faturamento'])),
    Atraso: ensureArray(pickFirst(body, ['Atraso', 'atraso'])),
    Forecast: ensureArray(pickFirst(body, ['Forecast', 'forecast'])),
  };
};
