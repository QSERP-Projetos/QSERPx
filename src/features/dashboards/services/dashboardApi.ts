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

  return {
    FluxoCaixaReceitas: ensureArray(body.FluxoCaixaReceitas),
    FluxoCaixaDespesas: ensureArray(body.FluxoCaixaDespesas),
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

  return {
    MoedasSemCotacao: ensureArray(body.MoedasSemCotacao),
    Faturamento: ensureArray(body.Faturamento),
    Atraso: ensureArray(body.Atraso),
    Forecast: ensureArray(body.Forecast),
  };
};
