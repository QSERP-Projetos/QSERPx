import apiManager, { ApiCallType, type ApiCallResponse } from './apiManager';
import { GlobalConfig } from './globalConfig';

export type TipoApuracaoCbs = 'DEBITOS' | 'CREDITOS' | 'PAGAMENTOS' | 'RECOLHIMENTOS';

export interface CredenciaisApuracaoDto {
  codigoEmpresa: number;
  razaoSocial?: string | null;
  cnpjEmpresa?: string | null;
  cnpjBase?: string | null;
  clientId?: string | null;
  possuiClientSecret: boolean;
  clientSecretMascarado?: string | null;
  ambienteHomologacao: number;
  ambienteDescricao: string;
  configurado: boolean;
}

export interface CredenciaisApuracaoRequest {
  codigoEmpresa: number;
  clientId: string;
  clientSecret?: string;
  ambienteHomologacao: number;
}

export interface SolicitacaoApuracaoDto {
  id: number;
  codigoEmpresa: number;
  tipoApuracao: TipoApuracaoCbs | string;
  cnpjBase: string;
  ambiente: number;
  tiqueteSolicitacao?: string | null;
  teaSegundos?: number | null;
  situacao: string;
  codigoErro?: string | null;
  mensagemErro?: string | null;
  urlAssinadaExpiraEm?: string | null;
  periodoIni?: string | null;
  periodoFim?: string | null;
  qtdRegistros: number;
  downloadRealizado: boolean;
  temJson: boolean;
  usuarioSolicitante?: string | null;
  dataSolicitacao: string;
  dataUltimaConsulta?: string | null;
  dataConclusao?: string | null;
  dataDownload?: string | null;
  proximaConsultaEm?: string | null;
  expirandoEmBreve: boolean;
}

export interface ApuracaoDebitoItemDto {
  id: number;
  idSolicitacao: number;
  cnpjBase: string;
  niContribuinte?: string | null;
  cst?: string | null;
  tpOper?: string | null;
  tpDocumento?: string | null;
  chEletr?: string | null;
  dataEmissao?: string | null;
  dataRegistro?: string | null;
  dataApropriacao?: string | null;
  valorBc: number;
  aliqCbs: number;
  valorCbsApurado: number;
  valorCbsDevido: number;
  valorCbsExigivel: number;
  valorCbsAcompa: number;
  payloadJson?: string | null;
  dataAtualizacao: string;
}

export interface ApuracaoCreditoItemDto {
  id: number;
  idSolicitacao: number;
  cnpjBase: string;
  niContribuinte?: string | null;
  cst?: string | null;
  tpOper?: string | null;
  tpDocumento?: string | null;
  chEletr?: string | null;
  dataEmissao?: string | null;
  dataRegistro?: string | null;
  dataApropriacao?: string | null;
  valorOper: number;
  valorBc: number;
  aliqCbs: number;
  valorCbsApropriavel: number;
  valorCbsApropriada: number;
  valorCbsAprov: number;
  valorCbsNaoAprov: number;
  valorCbsUtilizada: number;
  valorCbsUtilizadaAnt: number;
  valorCbsUtilizadaIncond: number;
  valorCbsNaoUtilizada: number;
  valorCbsNaoUtilizadaAnt: number;
  payloadJson?: string | null;
  dataAtualizacao: string;
}

export interface ApuracaoPagamentoItemDto {
  id: number;
  idSolicitacao: number;
  cnpjBase: string;
  niContribuinte?: string | null;
  numeroPagamento?: string | null;
  numeroDesmembramento?: string | null;
  tipoPagamento?: string | null;
  chEletr?: string | null;
  niAdquirente?: string | null;
  niFornecedor?: string | null;
  dataArrecadacao?: string | null;
  dataRegistro?: string | null;
  valorPrincipal: number;
  valorMulta: number;
  valorJuros: number;
  valorTotal: number;
  valorUtilizado: number;
  valorSaldo: number;
  payloadJson?: string | null;
  dataAtualizacao: string;
}

export interface ApuracaoRecolhimentoItemDto {
  id: number;
  idSolicitacao: number;
  cnpjBase: string;
  niContribuinte?: string | null;
  numeroPagamento?: string | null;
  numeroDesmembramento?: string | null;
  chEletr?: string | null;
  niFornecedor?: string | null;
  dataArrecadacao?: string | null;
  dataRegistro?: string | null;
  valorPrincipal: number;
  valorMulta: number;
  valorJuros: number;
  valorTotal: number;
  valorCreditoApropriado: number;
  payloadJson?: string | null;
  dataAtualizacao: string;
}

export interface ResumoApuracaoCbsDto {
  codigoEmpresa: number;
  dataInicio: string;
  dataFim: string;
  totalDebitosBc: number;
  totalDebitosApurado: number;
  totalDebitosDevido: number;
  totalDebitosExigivel: number;
  totalCreditosBc: number;
  totalCreditosApropriada: number;
  totalCreditosUtilizada: number;
  totalCreditosNaoUtilizada: number;
  totalPagamentos: number;
  totalPagamentosSaldo: number;
  totalRecolhimentos: number;
  totalRecolhimentosCredito: number;
  qtdDebitos: number;
  qtdCreditos: number;
  qtdPagamentos: number;
  qtdRecolhimentos: number;
  solicitacoesPendentes: number;
  chamadasHojePorTipo: Record<string, number>;
  limiteDiarioPorApi: number;
}

export interface ApuracaoFiltroParams {
  dataInicio?: string;
  dataFim?: string;
  cst?: string;
  tipoOperacao?: string;
  tipoPagamento?: string;
  chEletr?: string;
  termo?: string;
}

const getCtx = () => {
  const baseUrl = GlobalConfig.getBaseUrl().replace(/\/$/, '');
  const token = GlobalConfig.getJwToken();
  const codigoEmpresa = Number(GlobalConfig.getCodEmpresa() ?? 0);
  const usuario = GlobalConfig.getUsuario() || 'ADMIN';
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return { baseUrl, headers, codigoEmpresa, usuario };
};

const extractError = (resp: ApiCallResponse<any>, fallback: string): string => {
  const body = resp.jsonBody ?? resp.data;
  if (body && typeof body === 'object') {
    const msg = body.message ?? body.Message ?? body.mensagem ?? body.Mensagem ?? body.detail ?? body.title;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (typeof resp.bodyText === 'string' && resp.bodyText.trim()) {
    try {
      const parsed = JSON.parse(resp.bodyText);
      const msg = parsed?.message ?? parsed?.Message ?? parsed?.mensagem ?? parsed?.detail;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    } catch {
      return resp.bodyText.trim();
    }
  }
  return fallback;
};

const unwrapEnvelope = <T>(resp: ApiCallResponse<any>, fallbackMsg: string): { data: T; message: string } => {
  const body = resp.jsonBody ?? resp.data;
  if (!resp.succeeded || (body && typeof body === 'object' && body.success === false)) {
    throw new Error(extractError(resp, fallbackMsg));
  }
  if (body && typeof body === 'object' && 'data' in body) {
    return {
      data: body.data as T,
      message: typeof body.message === 'string' && body.message ? body.message : 'Operação concluída.',
    };
  }
  return { data: body as T, message: 'Operação concluída.' };
};

export const getFirstDayYearBr = (): string => {
  const d = new Date();
  return `01/01/${d.getFullYear()}`;
};

export const formatDateTimeBr = (iso?: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export async function obterCredenciaisApuracao(): Promise<CredenciaisApuracaoDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/credenciais/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
  );
  return unwrapEnvelope<CredenciaisApuracaoDto>(resp, 'Erro ao carregar credenciais RFB.').data;
}

export async function salvarCredenciaisApuracao(
  payload: Omit<CredenciaisApuracaoRequest, 'codigoEmpresa'>,
): Promise<CredenciaisApuracaoDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/credenciais`,
    ApiCallType.PUT,
    headers,
    {},
    { ...payload, codigoEmpresa },
  );
  return unwrapEnvelope<CredenciaisApuracaoDto>(resp, 'Erro ao salvar credenciais RFB.').data;
}

export async function testarAutenticacaoApuracao(): Promise<string> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/credenciais/${codigoEmpresa}/testar`,
    ApiCallType.POST,
    headers,
    {},
    {},
    { timeoutMs: 90000 },
  );
  return unwrapEnvelope<string>(resp, 'Erro ao testar autenticação na RFB.').message;
}

export async function obterResumoApuracao(
  filtro: Pick<ApuracaoFiltroParams, 'dataInicio' | 'dataFim'>,
): Promise<ResumoApuracaoCbsDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<ResumoApuracaoCbsDto>(
    `${baseUrl}/api/v1/ibscbs/resumo/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    filtro,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao carregar resumo da apuração.'));
  return (resp.jsonBody ?? resp.data) as ResumoApuracaoCbsDto;
}

export async function listarSolicitacoesApuracao(
  tipo?: string,
  situacao?: string,
): Promise<SolicitacaoApuracaoDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<SolicitacaoApuracaoDto[]>(
    `${baseUrl}/api/v1/ibscbs/solicitacoes/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    { tipo: tipo || undefined, situacao: situacao || undefined },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao listar solicitações RFB.'));
  const raw = resp.jsonBody ?? resp.data;
  return Array.isArray(raw) ? raw : [];
}

export async function solicitarApuracao(
  tipoApuracao: TipoApuracaoCbs,
): Promise<{ data: SolicitacaoApuracaoDto; message: string }> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/solicitacoes`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, tipoApuracao, usuario },
    { timeoutMs: 90000 },
  );
  return unwrapEnvelope<SolicitacaoApuracaoDto>(resp, 'Erro ao abrir solicitação na Receita Federal.');
}

export async function consultarSituacaoSolicitacao(
  id: number,
  baixarSeConcluida = true,
): Promise<{ data: SolicitacaoApuracaoDto; message: string }> {
  const { baseUrl, headers } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/solicitacoes/${id}/consultar-situacao`,
    ApiCallType.POST,
    headers,
    { baixarSeConcluida },
    {},
    { timeoutMs: 60000 },
  );
  return unwrapEnvelope<SolicitacaoApuracaoDto>(resp, 'Erro ao consultar situação na Receita Federal.');
}

export async function baixarSolicitacao(
  id: number,
): Promise<{ data: SolicitacaoApuracaoDto; message: string }> {
  const { baseUrl, headers } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/solicitacoes/${id}/baixar`,
    ApiCallType.POST,
    headers,
    {},
    {},
    { timeoutMs: 90000 },
  );
  return unwrapEnvelope<SolicitacaoApuracaoDto>(resp, 'Erro ao baixar arquivo da Receita Federal.');
}

export async function reprocessarSolicitacao(
  id: number,
): Promise<{ data: SolicitacaoApuracaoDto; message: string }> {
  const { baseUrl, headers } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/solicitacoes/${id}/reprocessar`,
    ApiCallType.POST,
    headers,
    {},
    {},
  );
  return unwrapEnvelope<SolicitacaoApuracaoDto>(resp, 'Erro ao reprocessar arquivo JSON.');
}

export async function obterJsonSolicitacao(id: number): Promise<string> {
  const { baseUrl, headers } = getCtx();
  const resp = await apiManager.makeApiCall(
    `${baseUrl}/api/v1/ibscbs/solicitacoes/${id}/json`,
    ApiCallType.GET,
    headers,
  );
  return unwrapEnvelope<string>(resp, 'Erro ao obter JSON da solicitação.').data;
}

export async function listarDebitosApuracao(filtro: ApuracaoFiltroParams): Promise<ApuracaoDebitoItemDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<ApuracaoDebitoItemDto[]>(
    `${baseUrl}/api/v1/ibscbs/debitos/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    filtro,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao consultar débitos de CBS.'));
  const raw = resp.jsonBody ?? resp.data;
  return Array.isArray(raw) ? raw : [];
}

export async function listarCreditosApuracao(filtro: ApuracaoFiltroParams): Promise<ApuracaoCreditoItemDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<ApuracaoCreditoItemDto[]>(
    `${baseUrl}/api/v1/ibscbs/creditos/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    filtro,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao consultar créditos de CBS.'));
  const raw = resp.jsonBody ?? resp.data;
  return Array.isArray(raw) ? raw : [];
}

export async function listarPagamentosApuracao(filtro: ApuracaoFiltroParams): Promise<ApuracaoPagamentoItemDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<ApuracaoPagamentoItemDto[]>(
    `${baseUrl}/api/v1/ibscbs/pagamentos/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    filtro,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao consultar pagamentos de CBS.'));
  const raw = resp.jsonBody ?? resp.data;
  return Array.isArray(raw) ? raw : [];
}

export async function listarRecolhimentosApuracao(
  filtro: ApuracaoFiltroParams,
): Promise<ApuracaoRecolhimentoItemDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<ApuracaoRecolhimentoItemDto[]>(
    `${baseUrl}/api/v1/ibscbs/recolhimentos/${codigoEmpresa}`,
    ApiCallType.GET,
    headers,
    filtro,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao consultar recolhimentos de CBS.'));
  const raw = resp.jsonBody ?? resp.data;
  return Array.isArray(raw) ? raw : [];
}

export async function executarProcessamentoPendentes(): Promise<number> {
  const { baseUrl, headers } = getCtx();
  const resp = await apiManager.makeApiCall<{ processadas: number }>(
    `${baseUrl}/api/v1/ibscbs/worker/processar-pendentes`,
    ApiCallType.POST,
    headers,
    {},
    {},
    { timeoutMs: 90000 },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao processar solicitações pendentes.'));
  const raw = resp.jsonBody ?? resp.data;
  return Number(raw?.processadas ?? 0);
}
