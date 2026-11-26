import apiManager, { ApiCallType, type ApiCallResponse } from './apiManager';
import { GlobalConfig } from './globalConfig';

export interface SolicitacaoNfDiversaListItem {
  codigoEmpresa: number;
  numSolicitacao: number;
  entradaSaida: number;
  entradaSaidaDescricao: string;
  dataSolicitacao: string;
  motivoSolicitacao?: string | null;
  codigoSolicitante?: string | null;
  codigoCfo?: string | null;
  descricaoCfo?: string | null;
  tipoDestinatario?: string | null;
  codigoDestinatario?: number | null;
  nomeDestinatario?: string | null;
  tipoMovimentoEstoque?: number | null;
  tipoMovimentoEstoqueDescricao?: string | null;
  situacaoSolicitacao: number;
  situacaoDescricao: string;
  qtdItens: number;
  qtdServicos: number;
  valorTotal: number;
  numNotaFiscal?: string | null;
  serNotaFiscal?: string | null;
  numRnc?: number | null;
  numSeparacao?: number | null;
  possuiOrigemServico: boolean;
  podeEditar: boolean;
  podeCancelar: boolean;
}

export interface SolicitacaoNfDiversaItem {
  numItem: number;
  codigoMaterial: string;
  descricaoMaterial?: string | null;
  descricaoComplem?: string | null;
  descricaoExibida?: string | null;
  codigoLote?: string | null;
  qtdMaterial: number;
  unidMedida?: string | null;
  valorUnitario: number;
  valorTotal: number;
  numIdent?: string | null;
  controlarEstoque: boolean;
  controlarLote: boolean;
  controleSerial: boolean;
  unidMedEstq?: string | null;
  pesoBrutoUnitario: number;
  pesoLiquidoUnitario: number;
  qtdDetalheItem: number;
  qtdEmbalagens: number;
  qtdSeriais: number;
  qtdBloqueiosSelecionados: number;
  permiteDetalhes: boolean;
  tipoDetalhe: 'situacao' | 'serial' | 'embalagem' | 'nenhum';
}

export interface SolicitacaoNfDiversaServico {
  numItem: number;
  descrServico: string;
  qtdServico?: number | null;
  valorUnitario: number;
  valorTotal: number;
}

export interface SolicitacaoNfDiversaOrigem {
  numOrcServ: number;
  numItemServ: number;
}

export interface SolicitacaoNfDiversaDetalhe {
  codigoEmpresa: number;
  numSolicitacao: number;
  entradaSaida: number;
  entradaSaidaDescricao: string;
  dataSolicitacao: string;
  motivoSolicitacao?: string | null;
  codigoSolicitante?: string | null;
  codigoCfo?: string | null;
  descricaoCfo?: string | null;
  tipoDestinatario?: string | null;
  codigoDestinatario?: number | null;
  nomeDestinatario?: string | null;
  razaoSocialDestinatario?: string | null;
  codigoTransportadora?: number | null;
  nomeTransportadora?: string | null;
  responsavelFrete?: number | null;
  responsavelFreteDescricao?: string | null;
  placaVeiculo?: string | null;
  qtdVolumes?: number | null;
  especieVolumes?: string | null;
  pesoBruto?: number | null;
  pesoLiquido?: number | null;
  tipoMovimentoEstoque?: number | null;
  tipoMovimentoEstoqueDescricao?: string | null;
  observSolicitacao?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  situacaoSolicitacao: number;
  situacaoDescricao: string;
  numRnc?: number | null;
  numSeparacao?: number | null;
  numNotaFiscal?: string | null;
  serNotaFiscal?: string | null;
  possuiEmbalagens: boolean;
  possuiDetalhes: boolean;
  possuiOrigemServico: boolean;
  regra64Ativa: boolean;
  limiteItensNf: number;
  valorTotalItens: number;
  valorTotalServicos: number;
  podeEditar: boolean;
  podeConfirmar: boolean;
  podeCancelar: boolean;
  itens: SolicitacaoNfDiversaItem[];
  servicos: SolicitacaoNfDiversaServico[];
  origens: SolicitacaoNfDiversaOrigem[];
}

export interface SolicitacaoNfDiversaDestinatarioCombo {
  chave: string;
  tipoDestinatario: 'C' | 'F';
  codigoDestinatario: number;
  nomeFantasia: string;
  razaoSocial?: string | null;
  cnpjCpf?: string | null;
  codigoTransportadora?: number | null;
  fretePorConta?: number | null;
}

export interface SolicitacaoNfDiversaCfoCombo {
  codigoCfo: string;
  descricaoCfo: string;
  atualizaEstoque: boolean;
  tipoOperacao?: number | null;
  geraOperFinanc: boolean;
  entradaSaidaCfop: number;
}

export interface SolicitacaoNfDiversaComboOpcao {
  codigo: string;
  descricao: string;
  extra?: string | null;
}

export interface SolicitacaoNfDiversaCombos {
  destinatarios: SolicitacaoNfDiversaDestinatarioCombo[];
  naturezasOperacao: SolicitacaoNfDiversaCfoCombo[];
  transportadoras: SolicitacaoNfDiversaComboOpcao[];
  unidadesMedida: SolicitacaoNfDiversaComboOpcao[];
  limiteItensNf: number;
}

export interface SolicitacaoNfDiversaMaterialInfo {
  encontrado: boolean;
  mensagem?: string | null;
  codigoMaterial: string;
  descricaoPortug?: string | null;
  situacaoMaterial?: string | null;
  controlarEstoque: boolean;
  controlarLote: boolean;
  controleSerial: boolean;
  unidMedEstq?: string | null;
  unidMedVenda?: string | null;
  valorUnitarioSugerido: number;
  codigoCfoPadrao?: string | null;
  pesoBruto: number;
  pesoLiquido: number;
  imprimeDetalhe: boolean;
}

export interface SolicitacaoNfDiversaLoteDisponivel {
  codigoLote: string;
  qtdDisponivel: number;
  qtdBloqueada: number;
  dataValidade?: string | null;
  unidMedEstq?: string | null;
}

export interface SolicitacaoNfDiversaItemDetalhe {
  numDetalhe: number;
  numEmbalagem?: number | null;
  numItemEmb?: number | null;
  serialEmbalagem?: string | null;
  tipoEmbalagem?: number | null;
  tipoEmbalagemDescricao?: string | null;
  serialPallet?: string | null;
  numSerial?: string | null;
  qtdProduto?: number | null;
  unidMedida?: string | null;
  codigoLocal?: number | null;
}

export interface SolicitacaoNfDiversaSerialDisponivel {
  numSerial: string;
  codigoLote: string;
  codigoLocal: number;
  enderecoLocal?: string | null;
  situacaoSerial: number;
  jaSelecionado: boolean;
}

export interface SolicitacaoNfDiversaBloqueioDisponivel {
  numSituacao: number;
  codigoLocal: number;
  enderecoLocal?: string | null;
  dataSituacao?: string | null;
  codigoMotivo?: number | null;
  descricaoMotivo?: string | null;
  saldoEstoque: number;
  saldoUnidadeItem: number;
  qtdJaSelecionada: number;
  saldoRestanteItem: number;
  numSerial?: string | null;
}

export interface SolicitacaoNfDiversaItemSit {
  numSituacao: number;
  qtdSituacao: number;
  codigoLocal: number;
  enderecoLocal?: string | null;
  dataSituacao?: string | null;
  descricaoMotivo?: string | null;
  numSerial?: string | null;
}

export interface SolicitacaoNfDiversaBloqueiosResponse {
  qtdItem: number;
  unidMedidaItem?: string | null;
  unidMedEstq?: string | null;
  fatorConversao: number;
  totalSelecionado: number;
  disponiveis: SolicitacaoNfDiversaBloqueioDisponivel[];
  selecionados: SolicitacaoNfDiversaItemSit[];
}

export interface SolicitacaoNfDiversaResultado {
  sucesso: boolean;
  mensagem: string;
  codigoConfirmacao?: string | null;
  erros?: string[] | null;
  numSolicitacao?: number | null;
  numItem?: number | null;
  detalhe?: SolicitacaoNfDiversaDetalhe | null;
}

export interface SolicitacaoNfDiversaCabecalhoPayload {
  entradaSaida: number;
  dataSolicitacao?: string | null;
  motivoSolicitacao?: string | null;
  codigoCfo?: string | null;
  tipoDestinatario: string;
  codigoDestinatario: number;
  codigoTransportadora?: number | null;
  responsavelFrete?: number | null;
  placaVeiculo?: string | null;
  qtdVolumes?: number | null;
  especieVolumes?: string | null;
  pesoBruto?: number | null;
  pesoLiquido?: number | null;
  tipoMovimentoEstoque?: number | null;
  observSolicitacao?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
}

export interface SolicitacaoNfDiversaItemPayload {
  codigoMaterial: string;
  descricaoComplem?: string | null;
  codigoLote?: string | null;
  qtdMaterial: number;
  unidMedida: string;
  valorUnitario: number;
  confirmarLimparDetalhes?: boolean;
}

export interface SolicitacaoNfDiversaServicoPayload {
  descrServico: string;
  qtdServico?: number | null;
  valorUnitario: number;
}

const getContext = () => {
  const baseUrl = GlobalConfig.getBaseUrl().replace(/\/$/, '');
  const token = GlobalConfig.getJwToken();
  const codigoEmpresa = Number(GlobalConfig.getCodEmpresa() ?? 0);
  const usuario = GlobalConfig.getUsuario() || '';
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return {
    baseUrl,
    headers,
    codigoEmpresa,
    usuario,
  };
};

const extractErrorMessage = (resp: ApiCallResponse<any>, fallback: string): string => {
  const body = resp.jsonBody ?? resp.data;
  if (body && typeof body === 'object') {
    const msg = body.mensagem ?? body.Mensagem ?? body.message ?? body.detail ?? body.title;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (typeof resp.bodyText === 'string' && resp.bodyText.trim()) {
    try {
      const parsed = JSON.parse(resp.bodyText);
      const msg = parsed?.mensagem ?? parsed?.Mensagem ?? parsed?.message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    } catch {
      return resp.bodyText.trim();
    }
  }
  return fallback;
};

const normalizeResultado = (resp: ApiCallResponse<any>, fallbackError: string): SolicitacaoNfDiversaResultado => {
  const raw = resp.jsonBody ?? resp.data;
  if (raw && typeof raw === 'object' && ('sucesso' in raw || 'Sucesso' in raw)) {
    return {
      sucesso: Boolean(raw.sucesso ?? raw.Sucesso),
      mensagem: String(raw.mensagem ?? raw.Mensagem ?? ''),
      codigoConfirmacao: raw.codigoConfirmacao ?? raw.CodigoConfirmacao ?? null,
      erros: raw.erros ?? raw.Erros ?? null,
      numSolicitacao: raw.numSolicitacao ?? raw.NumSolicitacao ?? null,
      numItem: raw.numItem ?? raw.NumItem ?? null,
      detalhe: raw.detalhe ?? raw.Detalhe ?? null,
    };
  }
  return {
    sucesso: resp.succeeded,
    mensagem: resp.succeeded ? 'Operação concluída.' : extractErrorMessage(resp, fallbackError),
  };
};

export const toIsoDateFromBr = (br?: string | null): string | undefined => {
  const str = String(br || '').trim();
  if (!str) return undefined;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return undefined;
};

export const toBrDateFromIso = (iso?: string | null): string => {
  const str = String(iso || '').trim();
  if (!str) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const part = str.split('T')[0];
  const m = part.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return str;
};

export const getTodayBr = (): string => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

export const getFirstDayMonthBr = (): string => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `01/${mm}/${yyyy}`;
};

export const formatCurrencyBr = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export const formatNumberBr = (value: number, maxDecimals = 3): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(Number(value || 0));

export const parseDecimalInput = (raw: string): number | null => {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

export async function listarSolicitacoesNfDiversa(filtros: {
  aba: 'em_digitacao' | 'pendentes' | 'emitidas' | 'todas';
  dataInicio?: string;
  dataFim?: string;
  tipoDestinatario?: string;
  codigoDestinatario?: number;
  numSolicitacao?: number;
  entradaSaida?: number;
  busca?: string;
}): Promise<SolicitacaoNfDiversaListItem[]> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const params: Record<string, any> = {
    codigoEmpresa,
    aba: filtros.aba,
    usuario,
  };
  const di = toIsoDateFromBr(filtros.dataInicio);
  const df = toIsoDateFromBr(filtros.dataFim);
  if (di) params.dataInicio = di;
  if (df) params.dataFim = df;
  if (filtros.tipoDestinatario && filtros.codigoDestinatario) {
    params.tipoDestinatario = filtros.tipoDestinatario;
    params.codigoDestinatario = filtros.codigoDestinatario;
  }
  if (filtros.numSolicitacao && filtros.numSolicitacao > 0) params.numSolicitacao = filtros.numSolicitacao;
  if (filtros.entradaSaida && filtros.entradaSaida > 0) params.entradaSaida = filtros.entradaSaida;
  if (filtros.busca?.trim()) params.busca = filtros.busca.trim();

  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaListItem[]>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa`,
    ApiCallType.GET,
    headers,
    params,
  );
  if (!resp.succeeded) {
    throw new Error(extractErrorMessage(resp, 'Não foi possível carregar as solicitações de NF Diversa.'));
  }
  return Array.isArray(resp.jsonBody) ? resp.jsonBody : [];
}

export async function obterDetalheSolicitacaoNfDiversa(numSolicitacao: number): Promise<SolicitacaoNfDiversaDetalhe> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaDetalhe>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}`,
    ApiCallType.GET,
    headers,
    { usuario },
  );
  if (!resp.succeeded || !resp.jsonBody) {
    throw new Error(extractErrorMessage(resp, 'Não foi possível carregar os detalhes da solicitação.'));
  }
  return resp.jsonBody;
}

export async function obterCombosSolicitacaoNfDiversa(entradaSaida?: number): Promise<SolicitacaoNfDiversaCombos> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const params: Record<string, any> = { codigoEmpresa };
  if (entradaSaida) params.entradaSaida = entradaSaida;
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaCombos>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/combos`,
    ApiCallType.GET,
    headers,
    params,
  );
  if (!resp.succeeded || !resp.jsonBody) {
    throw new Error(extractErrorMessage(resp, 'Não foi possível carregar os cadastros auxiliares.'));
  }
  return resp.jsonBody;
}

export async function buscarMateriaisSolicitacaoNfDiversa(busca?: string): Promise<SolicitacaoNfDiversaComboOpcao[]> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaComboOpcao[]>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/materiais`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, busca: busca?.trim() || undefined },
  );
  return resp.succeeded && Array.isArray(resp.jsonBody) ? resp.jsonBody : [];
}

export async function obterInfoMaterialSolicitacaoNfDiversa(paramsInput: {
  codigoMaterial: string;
  tipoDestinatario?: string | null;
  codigoDestinatario?: number | null;
  codigoCfo?: string | null;
  tipoMovimentoEstoque?: number | null;
  numSolicitacao?: number | null;
  codigoLote?: string | null;
}): Promise<SolicitacaoNfDiversaMaterialInfo> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaMaterialInfo>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/material-info`,
    ApiCallType.GET,
    headers,
    {
      codigoEmpresa,
      codigoMaterial: paramsInput.codigoMaterial,
      tipoDestinatario: paramsInput.tipoDestinatario || undefined,
      codigoDestinatario: paramsInput.codigoDestinatario || undefined,
      codigoCfo: paramsInput.codigoCfo || undefined,
      tipoMovimentoEstoque: paramsInput.tipoMovimentoEstoque ?? undefined,
      numSolicitacao: paramsInput.numSolicitacao || undefined,
      codigoLote: paramsInput.codigoLote || undefined,
    },
  );
  if (!resp.succeeded || !resp.jsonBody) {
    throw new Error(extractErrorMessage(resp, 'Erro ao consultar dados do material.'));
  }
  return resp.jsonBody;
}

export async function obterLotesSolicitacaoNfDiversa(
  codigoMaterial: string,
  tipoMovimentoEstoque?: number | null,
  busca?: string,
): Promise<SolicitacaoNfDiversaLoteDisponivel[]> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaLoteDisponivel[]>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/lotes`,
    ApiCallType.GET,
    headers,
    {
      codigoEmpresa,
      codigoMaterial,
      tipoMovimentoEstoque: tipoMovimentoEstoque ?? undefined,
      busca: busca?.trim() || undefined,
    },
  );
  return resp.succeeded && Array.isArray(resp.jsonBody) ? resp.jsonBody : [];
}

export async function criarSolicitacaoNfDiversa(
  payload: SolicitacaoNfDiversaCabecalhoPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa`,
    ApiCallType.POST,
    headers,
    {},
    {
      ...payload,
      codigoEmpresa,
      codigoSolicitante: usuario,
    },
  );
  return normalizeResultado(resp, 'Erro ao criar solicitação de NF Diversa.');
}

export async function atualizarSolicitacaoNfDiversa(
  numSolicitacao: number,
  payload: SolicitacaoNfDiversaCabecalhoPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}`,
    ApiCallType.PUT,
    headers,
    {},
    {
      ...payload,
      codigoEmpresa,
      codigoSolicitante: usuario,
      usuario,
    },
  );
  return normalizeResultado(resp, 'Erro ao salvar solicitação de NF Diversa.');
}

export async function excluirSolicitacaoNfDiversa(numSolicitacao: number): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}`,
    ApiCallType.DELETE,
    headers,
    { usuario },
  );
  return normalizeResultado(resp, 'Erro ao excluir solicitação.');
}

export async function calcularPesoSolicitacaoNfDiversa(numSolicitacao: number): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/calcular-peso`,
    ApiCallType.POST,
    headers,
    { usuario },
  );
  return normalizeResultado(resp, 'Erro ao calcular pesos.');
}

export async function adicionarItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  payload: SolicitacaoNfDiversaItemPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens`,
    ApiCallType.POST,
    headers,
    {},
    { ...payload, usuario },
  );
  return normalizeResultado(resp, 'Erro ao adicionar item.');
}

export async function atualizarItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  payload: SolicitacaoNfDiversaItemPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}`,
    ApiCallType.PUT,
    headers,
    {},
    { ...payload, usuario },
  );
  return normalizeResultado(resp, 'Erro ao atualizar item.');
}

export async function excluirItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  confirmarEstornoEmbalagem = false,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}`,
    ApiCallType.DELETE,
    headers,
    { confirmarEstornoEmbalagem, usuario },
  );
  return normalizeResultado(resp, 'Erro ao excluir item.');
}

export async function adicionarServicoSolicitacaoNfDiversa(
  numSolicitacao: number,
  payload: SolicitacaoNfDiversaServicoPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/servicos`,
    ApiCallType.POST,
    headers,
    {},
    { ...payload, usuario },
  );
  return normalizeResultado(resp, 'Erro ao adicionar serviço.');
}

export async function atualizarServicoSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  payload: SolicitacaoNfDiversaServicoPayload,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/servicos/${numItem}`,
    ApiCallType.PUT,
    headers,
    {},
    { ...payload, usuario },
  );
  return normalizeResultado(resp, 'Erro ao atualizar serviço.');
}

export async function excluirServicoSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/servicos/${numItem}`,
    ApiCallType.DELETE,
    headers,
    { usuario },
  );
  return normalizeResultado(resp, 'Erro ao excluir serviço.');
}

export async function obterDetalhesItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
): Promise<SolicitacaoNfDiversaItemDetalhe[]> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaItemDetalhe[]>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/detalhes`,
    ApiCallType.GET,
    headers,
  );
  return resp.succeeded && Array.isArray(resp.jsonBody) ? resp.jsonBody : [];
}

export async function excluirDetalheItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  numDetalhe: number,
  confirmarEstornoEmbalagem = false,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/detalhes/${numDetalhe}`,
    ApiCallType.DELETE,
    headers,
    { confirmarEstornoEmbalagem, usuario },
  );
  return normalizeResultado(resp, 'Erro ao remover detalhe do item.');
}

export async function incluirEmbalagemSolicitacaoNfDiversa(
  numSolicitacao: number,
  serialEmbalagem: string,
  tipoEmbalagem: 1 | 2,
  confirmarRemoverDoPallet = false,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/embalagens`,
    ApiCallType.POST,
    headers,
    {},
    { serialEmbalagem, tipoEmbalagem, confirmarRemoverDoPallet, usuario },
  );
  return normalizeResultado(resp, 'Erro ao incluir embalagem.');
}

export async function listarSeriaisDisponiveisItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
): Promise<SolicitacaoNfDiversaSerialDisponivel[]> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaSerialDisponivel[]>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/seriais-disponiveis`,
    ApiCallType.GET,
    headers,
  );
  return resp.succeeded && Array.isArray(resp.jsonBody) ? resp.jsonBody : [];
}

export async function incluirSeriaisItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  payload: { seriais?: string[]; scanCodigo?: string },
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/seriais`,
    ApiCallType.POST,
    headers,
    {},
    { ...payload, usuario },
  );
  return normalizeResultado(resp, 'Erro ao incluir seriais.');
}

export async function obterBloqueiosItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
): Promise<SolicitacaoNfDiversaBloqueiosResponse> {
  const { baseUrl, headers, codigoEmpresa } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaBloqueiosResponse>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/bloqueios`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded || !resp.jsonBody) {
    throw new Error(extractErrorMessage(resp, 'Erro ao carregar bloqueios disponíveis.'));
  }
  return resp.jsonBody;
}

export async function adicionarBloqueioItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  numSituacao: number,
  qtdSituacao: number,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/bloqueios`,
    ApiCallType.POST,
    headers,
    {},
    { numSituacao, qtdSituacao, usuario },
  );
  return normalizeResultado(resp, 'Erro ao adicionar bloqueio ao item.');
}

export async function excluirBloqueioItemSolicitacaoNfDiversa(
  numSolicitacao: number,
  numItem: number,
  numSituacao: number,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/itens/${numItem}/bloqueios/${numSituacao}`,
    ApiCallType.DELETE,
    headers,
    { usuario },
  );
  return normalizeResultado(resp, 'Erro ao remover bloqueio do item.');
}

export async function confirmarSolicitacaoNfDiversa(
  numSolicitacao: number,
  confirmarSemSaldo = false,
): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/confirmar`,
    ApiCallType.POST,
    headers,
    {},
    { confirmarSemSaldo, usuario },
  );
  return normalizeResultado(resp, 'Erro ao confirmar solicitação.');
}

export async function cancelarSolicitacaoNfDiversa(numSolicitacao: number): Promise<SolicitacaoNfDiversaResultado> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getContext();
  const resp = await apiManager.makeApiCall<SolicitacaoNfDiversaResultado>(
    `${baseUrl}/api/v1/solicitacao-nf-diversa/${codigoEmpresa}/${numSolicitacao}/cancelar`,
    ApiCallType.POST,
    headers,
    {},
    { usuario },
  );
  return normalizeResultado(resp, 'Erro ao cancelar solicitação.');
}
