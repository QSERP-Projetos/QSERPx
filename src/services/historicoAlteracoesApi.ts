import apiManager, { ApiCallType } from './apiManager';
import { GlobalConfig } from './globalConfig';

export interface HistoricoAlteracaoItemDto {
  codigoAlteracao: number;
  codigoEmpresa: number | null;
  dataAlteracao: string;
  horaAlteracao: string;
  codigoTransacao: string;
  nomeTransacao: string;
  moduloTransacao: string;
  chaveRegistro: string;
  codigoCampo: number | null;
  nomeCampo: string;
  codigoUsuario: string;
  valorAntigo: string;
  valorNovo: string;
}

export interface HistoricoAlteracoesListaResponse {
  total: number;
  page: number;
  pageSize: number;
  itens: HistoricoAlteracaoItemDto[];
}

export interface HistoricoTransacaoFiltroDto {
  idTransacao: number;
  codigoTransacao: string;
  nomeFormulario: string;
  moduloTransacao: string;
}

export interface HistoricoUsuarioFiltroDto {
  codigoUsuario: string;
  nomeUsuario: string;
}

export interface HistoricoFiltrosResponse {
  transacoes: HistoricoTransacaoFiltroDto[];
  usuarios: HistoricoUsuarioFiltroDto[];
}

export interface ListarHistoricoAlteracoesParams {
  codigoEmpresa?: number;
  codigoTransacao?: string;
  codigoUsuario?: string;
  chaveRegistro?: string;
  nomeCampo?: string;
  termo?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const unwrap = <T,>(resp: { jsonBody?: any; data?: any }): T => {
  return (resp.jsonBody ?? resp.data) as T;
};

const getAuth = () => {
  const baseUrl = GlobalConfig.getBaseUrl() || '';
  const jwtToken = GlobalConfig.getJwToken() || '';
  const codigoEmpresa = GlobalConfig.getCodEmpresa();
  return { baseUrl, jwtToken, codigoEmpresa };
};

const getErrorMessage = (resp: { jsonBody?: any; data?: any; bodyText?: string }, fallback: string) => {
  const body = resp.jsonBody ?? resp.data;
  return body?.message || body?.error || resp.bodyText || fallback;
};

export const listarHistoricoAlteracoes = async (
  params: ListarHistoricoAlteracoesParams,
): Promise<HistoricoAlteracoesListaResponse> => {
  const { baseUrl, jwtToken, codigoEmpresa } = getAuth();
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/historico-alteracoes`;

  const queryParams: Record<string, any> = {
    codigoEmpresa: params.codigoEmpresa ?? codigoEmpresa,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 100,
  };

  if (params.codigoTransacao) queryParams.codigoTransacao = params.codigoTransacao;
  if (params.codigoUsuario) queryParams.codigoUsuario = params.codigoUsuario;
  if (params.chaveRegistro) queryParams.chaveRegistro = params.chaveRegistro;
  if (params.nomeCampo) queryParams.nomeCampo = params.nomeCampo;
  if (params.termo) queryParams.termo = params.termo;
  if (params.dataInicio) queryParams.dataInicio = params.dataInicio;
  if (params.dataFim) queryParams.dataFim = params.dataFim;

  const resp = await apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    queryParams,
  );

  if (!resp.succeeded) {
    throw new Error(getErrorMessage(resp, 'Erro ao consultar histórico de alterações.'));
  }

  const data = unwrap<HistoricoAlteracoesListaResponse>(resp);
  return {
    total: Number(data?.total ?? 0),
    page: Number(data?.page ?? 1),
    pageSize: Number(data?.pageSize ?? 100),
    itens: Array.isArray(data?.itens) ? data.itens : [],
  };
};

export const obterFiltrosHistoricoAlteracoes = async (): Promise<HistoricoFiltrosResponse> => {
  const { baseUrl, jwtToken } = getAuth();
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/historico-alteracoes/filtros`;

  const resp = await apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );

  if (!resp.succeeded) {
    throw new Error(getErrorMessage(resp, 'Erro ao carregar filtros do histórico.'));
  }

  const data = unwrap<HistoricoFiltrosResponse>(resp);
  return {
    transacoes: Array.isArray(data?.transacoes) ? data.transacoes : [],
    usuarios: Array.isArray(data?.usuarios) ? data.usuarios : [],
  };
};
