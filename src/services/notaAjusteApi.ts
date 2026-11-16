import apiManager, { ApiCallType, type ApiCallResponse } from './apiManager';
import { GlobalConfig } from './globalConfig';
import { obterClientesFornecedoresCall } from './apiCalls';

export type ModoTributacao =
  | 'gIBSCBS'
  | 'gTransfCred'
  | 'gAjusteCompet'
  | 'gEstornoCred'
  | 'gCredPresIBSZFM';

export interface NotaAjusteSubtipoInfo {
  codigo: string;
  finalidade: 'D' | 'C' | string;
  finNFe: number;
  tpDebCred: string;
  titulo: string;
  descricaoFiscal: string;
  autoEmissao: boolean;
  compoeTotal: boolean;
  exigeRefCabecalho: boolean;
  exigeDFeRefItem: boolean;
  permiteNItemDFeRef: boolean;
  permiteNcmGenerico00: boolean;
  permiteDataPrevEntrega: boolean;
  exigePagamentoReal: boolean;
  cstPadrao: string;
  classTribPadrao: string;
  modoTributacao: ModoTributacao | string;
}

export interface NotaAjusteItemInput {
  numItem: number;
  codigoMaterial: string;
  descricaoMaterial?: string | null;
  ncm?: string | null;
  cest?: string | null;
  cfop: string;
  unidMedida: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;

  cstIbsCbs: string;
  classTribIbsCbs: string;
  valorBaseIbsCbs: number;
  aliquotaIbsUf: number;
  valorIbsUf: number;
  aliquotaIbsMun: number;
  valorIbsMun: number;
  aliquotaCbs: number;
  valorCbs: number;

  difUf: number;
  devTribUf: number;
  reducaoAliqUf: number;
  reducaoAliqEfetivaUf: number;

  difMun: number;
  devTribMun: number;
  reducaoAliqMun: number;
  reducaoAliqEfetivaMun: number;

  difCbs: number;
  devTribCbs: number;
  reducaoCbs: number;
  reducaoCbsEfetiva: number;

  valorIbsTransfCred?: number | null;
  valorCbsTransfCred?: number | null;
  anoBaseAjusteCompNf?: string | null;
  valorIbsAjusteCompNf?: number | null;
  valorCbsAjusteCompNf?: number | null;

  chaveDfeRef?: string | null;
  numItemRefAjuste?: number | null;
  valorIbsEstCred?: number | null;
  valorCbsEstCred?: number | null;
  competApurZfm?: string | null;
  tpCredPresIbsZfm?: number | null;
  valorCredPresIbsZfm?: number | null;

  cstIs?: string | null;
  classTribIs?: string | null;
  valorBaseIs?: number | null;
  aliquotaIs?: number | null;
  valorIs?: number | null;
}

export interface NotaAjusteEmitirRequest {
  codigoEmpresa: number;
  numNotaFiscal?: string | null;
  serNotaFiscal: string;
  subtipo: string;
  codigoCfo: string;
  tipoDestinatario: 'C' | 'F' | 'E' | string;
  codigoDestinatario?: number | null;
  dataEmissao?: string | null;
  dataPrevEntrega?: string | null;
  chaveNfRefPrincipal?: string | null;
  chavesNfRefAdicionais?: string[];
  numNotaOrigem?: string | null;
  serNotaOrigem?: string | null;
  numLancAdiantamento?: number | null;
  observacao?: string | null;
  codigoUsuario?: string | null;
  tipoAmbiente?: number | null;
  versaoSistema?: string | null;
  transmitirSefaz: boolean;
  itens: NotaAjusteItemInput[];
}

export interface NotaAjusteRetransmitirRequest {
  codigoEmpresa: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  tipoAmbiente?: number | null;
  versaoSistema?: string | null;
}

export interface NotaAjusteListItem {
  codigoEmpresa: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  dataEmissao?: string | null;
  entradaSaida: string;
  subtipo: string;
  finalidade: string;
  tpDebCred: string;
  descricaoSubtipo: string;
  codigoCfo: string;
  descricaoCfo?: string | null;
  tipoDestinatario: string;
  codigoDestinatario?: number | null;
  nomeDestinatario: string;
  cnpjCpfDestinatario?: string | null;
  ufDestinatario?: string | null;
  valorTotalNota: number;
  valorTotalIbs: number;
  valorTotalCbs: number;
  valorTotalIbsEstCred: number;
  valorTotalCbsEstCred: number;
  situacaoNota?: number | null;
  situacaoDescricao: string;
  chaveAcessoNfe?: string | null;
  autorizacaoNfe?: string | null;
  numNotaOrigem?: string | null;
  serNotaOrigem?: string | null;
  dataPrevEntrega?: string | null;
  ultimoRetorno?: string | null;
  possuiXml: boolean;
}

export interface NotaAjusteOcorrencia {
  numOcorrencia?: number | null;
  dataOcorrencia?: string | null;
  situacaoNota?: number | null;
  descricaoOcorrencia?: string | null;
  codigoUsuario?: string | null;
}

export interface NotaAjusteDetalhe extends NotaAjusteListItem {
  chavesNfRefAdicionais: string[];
  observacao?: string | null;
  numLancAdiantamento?: number | null;
  xmlNfe?: string | null;
  itens: NotaAjusteItemInput[];
  ocorrencias: NotaAjusteOcorrencia[];
}

export interface NotaAjusteSerieCombo {
  serNotaFiscal: string;
  tipoNota: number; // 2 = Homologação, 3 = Produção
  numUltimaNf?: number | null;
  ambienteDescricao?: string;
}

export interface NotaAjusteCfopCombo {
  codigoCfo: string;
  descricaoCfo: string;
  consumidorFinal?: number | null;
  situacao?: number | null;
}

export interface NotaAjusteMotivoCancelamento {
  codigoMotivo: number;
  descricaoMotivo: string;
}

export interface NotaAjusteTributoOpcao {
  codigo: string;
  descricao: string;
}

export interface NotaAjusteCombos {
  ufEmpresa?: string;
  subtipos: NotaAjusteSubtipoInfo[];
  series: NotaAjusteSerieCombo[];
  cfops: NotaAjusteCfopCombo[];
  motivosCancelamento: NotaAjusteMotivoCancelamento[];
  cstsIbsCbs: NotaAjusteTributoOpcao[];
  classTribsIbsCbs: NotaAjusteTributoOpcao[];
  unidadesMedida: string[];
}

export interface NotaOriginalResumo {
  codigoEmpresa: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  dataEmissao?: string | null;
  entradaSaida: string;
  codigoCfo: string;
  tipoDestinatario: string;
  codigoDestinatario?: number | null;
  nomeDestinatario: string;
  ufDestinatario?: string | null;
  chaveAcessoNfe?: string | null;
  valorTotalNota: number;
  valorTotalIbs: number;
  valorTotalCbs: number;
}

export interface BuscarNotaReferenciaPorNumeroResponse {
  nota: NotaOriginalResumo;
  itens: NotaAjusteItemInput[];
}

export interface RecebimentoResumo {
  codigoEmpresa: number;
  numeroDocto: string;
  serie: string;
  codigoFornecedor: number;
  nomeFornecedor: string;
  dataRecebimento?: string | null;
  dataDocumento?: string | null;
  chaveAcessoNfe?: string | null;
  valorTotal: number;
}

export interface AdiantamentoDisponivel {
  codigoEmpresa: number;
  numLanc: number;
  numDocumento: string;
  parcela: number;
  tipoCedente: string;
  codigoCedente: number;
  nomeCedente: string;
  dataEmissao?: string | null;
  dataVencimento?: string | null;
  valorTitulo: number;
  valorSaldo: number;
  observacao?: string | null;
}

export interface MaterialBusca {
  codigoMaterial: string;
  descricao: string;
  unidMedida: string;
  ncm?: string | null;
  cest?: string | null;
  precoVenda?: number | null;
  cstIbsCbs?: string | null;
  classTribIbsCbs?: string | null;
  aliquotaIbsUf?: number | null;
  aliquotaIbsMun?: number | null;
  aliquotaCbs?: number | null;
}

export interface ReducaoIbsCbs {
  cst: string;
  classTrib: string;
  reducaoIbsUf: number;
  reducaoIbsMun: number;
  reducaoCbs: number;
}

export interface SimularXmlNotaAjusteResponse {
  sucesso: boolean;
  mensagem: string;
  xml: string;
  avisos: string[];
}

export interface EmitirNotaAjusteResponse {
  sucesso: boolean;
  mensagem: string;
  numNotaFiscal: string;
  serNotaFiscal: string;
  chaveAcessoNfe?: string | null;
  situacaoNota?: number | null;
  transmitida: boolean;
}

export interface DestinatarioOpcao {
  value: string; // Ex: "C-12" ou "F-45"
  tipo: 'C' | 'F';
  codigo: number;
  nomeFantasia: string;
  razaoSocial: string;
  cnpjCpf: string;
  uf?: string;
  codigoPais?: number;
  label: string;
}

const getSessionContext = (codigoEmpresaOverride?: number) => {
  const baseUrl = GlobalConfig.getBaseUrl().replace(/\/+$/, '');
  const jwToken = GlobalConfig.getJwToken();
  const codigoEmpresa = codigoEmpresaOverride ?? GlobalConfig.getCodEmpresa() ?? 1;
  const codigoUsuario = GlobalConfig.getUsuario() || 'QSERPX';

  if (!baseUrl || !jwToken) {
    throw new Error('Sessão inválida ou expirada. Faça login novamente.');
  }

  return {
    baseUrl,
    headers: { Authorization: `Bearer ${jwToken}` },
    codigoEmpresa,
    codigoUsuario,
  };
};

export const extractApiError = (resp: ApiCallResponse<any>, fallback: string): string => {
  const body = resp.jsonBody;
  if (body) {
    const detail = body.detail ?? body.Detail;
    const baseMsg = body.message ?? body.Message ?? body.mensagem ?? body.error;
    const candidate =
      baseMsg ??
      (detail && body.title ? `${body.title}: ${detail}` : detail ?? body.title);
    if (candidate) return String(candidate);
  }
  if (resp.bodyText && !resp.bodyText.startsWith('[binary')) {
    try {
      const parsed = JSON.parse(resp.bodyText);
      const candidate = parsed?.message ?? parsed?.Message ?? parsed?.mensagem ?? parsed?.error;
      if (candidate) return String(candidate);
    } catch {
      return resp.bodyText;
    }
  }
  return fallback;
};

export const round2 = (value: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const round4 = (value: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
};

export const formatCurrencyBr = (value: number | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

export const formatDecimalBr = (value: number | null | undefined, digits = 2): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));

export const toIsoDateFromBr = (ddmmyyyy?: string | null): string | undefined => {
  const raw = String(ddmmyyyy ?? '').trim();
  if (!raw) return undefined;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return undefined;
};

export const toBrDateFromIso = (isoDate?: string | null): string => {
  const raw = String(isoDate ?? '').trim();
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const getTodayBr = (): string => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

export const getFirstDayMonthBr = (): string => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `01/${m}/${y}`;
};

export const getCurrentCompetencia = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const calcularAliquotaEfetiva = (aliq: number, reducaoPct: number): number => {
  const a = Number(aliq || 0);
  const r = Number(reducaoPct || 0);
  if (a <= 0) return 0;
  if (r <= 0) return round4(a);
  return round4(a * (1 - r / 100));
};

export const createEmptyItem = (
  numItem: number,
  subtipo?: NotaAjusteSubtipoInfo | null,
  cfopPadrao = '',
): NotaAjusteItemInput => ({
  numItem,
  codigoMaterial: subtipo?.permiteNcmGenerico00 ? `AJUSTE${String(numItem).padStart(2, '0')}` : '',
  descricaoMaterial: subtipo ? `${subtipo.titulo}` : '',
  ncm: subtipo?.permiteNcmGenerico00 ? '00' : '',
  cest: '',
  cfop: cfopPadrao,
  unidMedida: 'UN',
  quantidade: 1,
  valorUnitario: 0,
  valorTotalItem: 0,

  cstIbsCbs: subtipo?.cstPadrao || '000',
  classTribIbsCbs: subtipo?.classTribPadrao || '000001',
  valorBaseIbsCbs: 0,
  aliquotaIbsUf: 0,
  valorIbsUf: 0,
  aliquotaIbsMun: 0,
  valorIbsMun: 0,
  aliquotaCbs: 0,
  valorCbs: 0,

  difUf: 0,
  devTribUf: 0,
  reducaoAliqUf: 0,
  reducaoAliqEfetivaUf: 0,

  difMun: 0,
  devTribMun: 0,
  reducaoAliqMun: 0,
  reducaoAliqEfetivaMun: 0,

  difCbs: 0,
  devTribCbs: 0,
  reducaoCbs: 0,
  reducaoCbsEfetiva: 0,

  valorIbsTransfCred: 0,
  valorCbsTransfCred: 0,
  anoBaseAjusteCompNf: getCurrentCompetencia(),
  valorIbsAjusteCompNf: 0,
  valorCbsAjusteCompNf: 0,

  chaveDfeRef: '',
  numItemRefAjuste: subtipo?.exigeDFeRefItem && subtipo?.permiteNItemDFeRef ? numItem : null,
  valorIbsEstCred: 0,
  valorCbsEstCred: 0,
  competApurZfm: getCurrentCompetencia(),
  tpCredPresIbsZfm: 1,
  valorCredPresIbsZfm: 0,

  cstIs: '',
  classTribIs: '',
  valorBaseIs: 0,
  aliquotaIs: 0,
  valorIs: 0,
});

export const recalcularTributosItem = (
  item: NotaAjusteItemInput,
  subtipo?: NotaAjusteSubtipoInfo | null,
  syncBaseComTotal = true,
): NotaAjusteItemInput => {
  const modo = (subtipo?.modoTributacao || 'gIBSCBS') as ModoTributacao;
  const valorTotalItem = round2(Number(item.quantidade || 0) * Number(item.valorUnitario || 0));

  const next: NotaAjusteItemInput = {
    ...item,
    valorTotalItem,
  };

  if (modo === 'gTransfCred') {
    const vIbs = round2(Number(item.valorIbsTransfCred ?? item.valorIbsUf ?? 0));
    const vCbs = round2(Number(item.valorCbsTransfCred ?? item.valorCbs ?? 0));
    next.valorBaseIbsCbs = 0;
    next.valorIbsTransfCred = vIbs;
    next.valorCbsTransfCred = vCbs;
    next.valorIbsUf = vIbs;
    next.valorIbsMun = 0;
    next.valorCbs = vCbs;
    return next;
  }

  if (modo === 'gAjusteCompet') {
    const vIbs = round2(Number(item.valorIbsAjusteCompNf ?? item.valorIbsUf ?? 0));
    const vCbs = round2(Number(item.valorCbsAjusteCompNf ?? item.valorCbs ?? 0));
    next.valorBaseIbsCbs = 0;
    next.anoBaseAjusteCompNf = item.anoBaseAjusteCompNf || getCurrentCompetencia();
    next.valorIbsAjusteCompNf = vIbs;
    next.valorCbsAjusteCompNf = vCbs;
    next.valorIbsUf = vIbs;
    next.valorIbsMun = 0;
    next.valorCbs = vCbs;
    return next;
  }

  if (modo === 'gEstornoCred') {
    const vIbsEst = round2(Number(item.valorIbsEstCred ?? 0));
    const vCbsEst = round2(Number(item.valorCbsEstCred ?? 0));
    next.valorBaseIbsCbs = 0;
    next.valorIbsEstCred = vIbsEst;
    next.valorCbsEstCred = vCbsEst;
    next.valorIbsUf = 0;
    next.valorIbsMun = 0;
    next.valorCbs = 0;
    return next;
  }

  if (modo === 'gCredPresIBSZFM') {
    const vZfm = round2(Number(item.valorCredPresIbsZfm ?? 0));
    next.valorBaseIbsCbs = 0;
    next.competApurZfm = item.competApurZfm || getCurrentCompetencia();
    next.tpCredPresIbsZfm = item.tpCredPresIbsZfm ?? 1;
    next.valorCredPresIbsZfm = vZfm;
    next.valorIbsUf = 0;
    next.valorIbsMun = 0;
    next.valorCbs = 0;
    return next;
  }

  // gIBSCBS padrão (CST 000, 010, 011, 200, 510, 515, 550, 620)
  const base = syncBaseComTotal ? valorTotalItem : round2(Number(item.valorBaseIbsCbs || 0));
  const efetUf =
    Number(item.reducaoAliqUf || 0) > 0
      ? calcularAliquotaEfetiva(item.aliquotaIbsUf, item.reducaoAliqUf)
      : Number(item.aliquotaIbsUf || 0);
  const efetMun =
    Number(item.reducaoAliqMun || 0) > 0
      ? calcularAliquotaEfetiva(item.aliquotaIbsMun, item.reducaoAliqMun)
      : Number(item.aliquotaIbsMun || 0);
  const efetCbs =
    Number(item.reducaoCbs || 0) > 0
      ? calcularAliquotaEfetiva(item.aliquotaCbs, item.reducaoCbs)
      : Number(item.aliquotaCbs || 0);

  next.valorBaseIbsCbs = base;
  next.reducaoAliqEfetivaUf = efetUf;
  next.reducaoAliqEfetivaMun = efetMun;
  next.reducaoCbsEfetiva = efetCbs;
  next.valorIbsUf = round2(base * (efetUf / 100));
  next.valorIbsMun = round2(base * (efetMun / 100));
  next.valorCbs = round2(base * (efetCbs / 100));

  if ((item.aliquotaIs ?? 0) > 0) {
    const baseIs = Number(item.valorBaseIs ?? 0) > 0 ? Number(item.valorBaseIs) : valorTotalItem;
    next.valorBaseIs = round2(baseIs);
    next.valorIs = round2(baseIs * (Number(item.aliquotaIs || 0) / 100));
  }

  return next;
};

export interface RateioMultaJurosConfig {
  modoValor: 'valor' | 'percentual';
  valorAcrescimo: number;
  percentualAcrescimo: number;
  sobrescreverTributos: boolean;
  cstIbsCbs?: string;
  classTribIbsCbs?: string;
  aliquotaIbsUf?: number;
  aliquotaIbsMun?: number;
  aliquotaCbs?: number;
  reducaoAliqUf?: number;
  reducaoAliqMun?: number;
  reducaoCbs?: number;
}

export const aplicarRateioMultaJuros = (
  itens: NotaAjusteItemInput[],
  config: RateioMultaJurosConfig,
  subtipo?: NotaAjusteSubtipoInfo | null,
): NotaAjusteItemInput[] => {
  if (!itens.length) return [];

  const basesOriginais = itens.map((item) => {
    const total = Number(item.valorTotalItem || 0) > 0
      ? Number(item.valorTotalItem)
      : Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
    return Math.max(0, round2(total));
  });

  const somaBase = round2(basesOriginais.reduce((acc, v) => acc + v, 0));
  const totalRatear =
    config.modoValor === 'percentual'
      ? round2(somaBase * (Number(config.percentualAcrescimo || 0) / 100))
      : round2(Number(config.valorAcrescimo || 0));

  if (totalRatear <= 0) return itens;

  const valoresRateados = itens.map((_, idx) => {
    if (somaBase <= 0) {
      return round2(totalRatear / itens.length);
    }
    const proporcao = basesOriginais[idx] / somaBase;
    return round2(totalRatear * proporcao);
  });

  // Ajuste de centavos no item de maior peso original para fechar exatamente totalRatear
  const somaRateada = round2(valoresRateados.reduce((acc, v) => acc + v, 0));
  const diffCentavos = round2(totalRatear - somaRateada);
  if (Math.abs(diffCentavos) > 0) {
    let maiorIdx = 0;
    for (let i = 1; i < basesOriginais.length; i += 1) {
      if (basesOriginais[i] > basesOriginais[maiorIdx]) {
        maiorIdx = i;
      }
    }
    valoresRateados[maiorIdx] = round2(valoresRateados[maiorIdx] + diffCentavos);
  }

  return itens.map((item, idx) => {
    const novoValor = valoresRateados[idx];
    const atualizado: NotaAjusteItemInput = {
      ...item,
      quantidade: 1,
      valorUnitario: novoValor,
      valorTotalItem: novoValor,
      valorBaseIbsCbs: novoValor,
      ncm: !item.ncm && subtipo?.permiteNcmGenerico00 ? '00' : item.ncm,
      ...(config.sobrescreverTributos
        ? {
            cstIbsCbs: config.cstIbsCbs ?? item.cstIbsCbs,
            classTribIbsCbs: config.classTribIbsCbs ?? item.classTribIbsCbs,
            aliquotaIbsUf: config.aliquotaIbsUf ?? item.aliquotaIbsUf,
            aliquotaIbsMun: config.aliquotaIbsMun ?? item.aliquotaIbsMun,
            aliquotaCbs: config.aliquotaCbs ?? item.aliquotaCbs,
            reducaoAliqUf: config.reducaoAliqUf ?? item.reducaoAliqUf,
            reducaoAliqMun: config.reducaoAliqMun ?? item.reducaoAliqMun,
            reducaoCbs: config.reducaoCbs ?? item.reducaoCbs,
          }
        : {}),
    };

    return recalcularTributosItem(atualizado, subtipo, true);
  });
};

// ============================
// Chamadas HTTP REST QSApi
// ============================

export async function obterCombosNotaAjuste(codigoEmpresaOverride?: number): Promise<NotaAjusteCombos> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<NotaAjusteCombos>(
    `${baseUrl}/api/v1/NotasAjuste/Combos`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa },
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao carregar parâmetros de Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function obterProximoNumeroNotaAjuste(
  serie: string,
  codigoEmpresaOverride?: number,
): Promise<{ proximoNumero: string; numUltimaNf: number; tipoNota: number }> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<{ proximoNumero: string; numUltimaNf: number; tipoNota: number }>(
    `${baseUrl}/api/v1/NotasAjuste/ProximoNumero`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, serie },
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao obter próxima numeração da série.'));
  }
  return resp.data;
}

export async function listarNotasAjuste(params: {
  dataInicio?: string;
  dataFim?: string;
  finalidade?: string;
  subtipo?: string;
  situacao?: string;
  busca?: string;
  codigoEmpresa?: number;
}): Promise<NotaAjusteListItem[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params.codigoEmpresa);
  const query: Record<string, any> = { codigoEmpresa };

  const isoIni = toIsoDateFromBr(params.dataInicio);
  const isoFim = toIsoDateFromBr(params.dataFim);
  if (isoIni) query.dataInicio = isoIni;
  if (isoFim) query.dataFim = isoFim;
  if (params.finalidade) query.finalidade = params.finalidade;
  if (params.subtipo) query.subtipo = params.subtipo;
  if (params.situacao !== undefined && params.situacao !== '') query.situacao = params.situacao;
  if (params.busca?.trim()) query.busca = params.busca.trim();

  const resp = await apiManager.makeApiCall<NotaAjusteListItem[]>(
    `${baseUrl}/api/v1/NotasAjuste`,
    ApiCallType.GET,
    headers,
    query,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao consultar Notas Fiscais de Ajuste.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function obterDetalheNotaAjuste(
  numNota: string,
  serie: string,
  codigoEmpresaOverride?: number,
): Promise<NotaAjusteDetalhe> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<NotaAjusteDetalhe>(
    `${baseUrl}/api/v1/NotasAjuste/${encodeURIComponent(codigoEmpresa)}/${encodeURIComponent(numNota)}/${encodeURIComponent(serie)}`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao obter detalhes da Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function listarNotasReferenciaAjuste(params?: {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  codigoEmpresa?: number;
}): Promise<NotaOriginalResumo[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params?.codigoEmpresa);
  const query: Record<string, any> = { codigoEmpresa };
  if (params?.busca?.trim()) query.busca = params.busca.trim();
  const isoIni = toIsoDateFromBr(params?.dataInicio);
  const isoFim = toIsoDateFromBr(params?.dataFim);
  if (isoIni) query.dataInicio = isoIni;
  if (isoFim) query.dataFim = isoFim;

  const resp = await apiManager.makeApiCall<NotaOriginalResumo[]>(
    `${baseUrl}/api/v1/NotasAjuste/NotasReferencia`,
    ApiCallType.GET,
    headers,
    query,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao buscar notas fiscais de referência.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function buscarNotaReferenciaPorNumero(
  numNota: string,
  serie?: string,
  codigoEmpresaOverride?: number,
): Promise<BuscarNotaReferenciaPorNumeroResponse> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<BuscarNotaReferenciaPorNumeroResponse>(
    `${baseUrl}/api/v1/NotasAjuste/NotasReferencia/BuscarPorNumero`,
    ApiCallType.GET,
    headers,
    {
      codigoEmpresa,
      numNota: numNota.trim(),
      ...(serie?.trim() ? { serie: serie.trim() } : {}),
    },
  );
  if (!resp.succeeded || !resp.jsonBody) {
    throw new Error(extractApiError(resp, 'Nota fiscal de referência não encontrada para esse número/série.'));
  }
  return resp.jsonBody;
}

export async function obterItensNotaReferenciaAjuste(
  numNota: string,
  serie: string,
  codigoEmpresaOverride?: number,
): Promise<NotaAjusteItemInput[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<NotaAjusteItemInput[]>(
    `${baseUrl}/api/v1/NotasAjuste/NotasReferencia/${encodeURIComponent(codigoEmpresa)}/${encodeURIComponent(numNota)}/${encodeURIComponent(serie)}/Itens`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao importar itens da nota fiscal selecionada.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function listarRecebimentosAjuste(params?: {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  codigoEmpresa?: number;
}): Promise<RecebimentoResumo[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params?.codigoEmpresa);
  const query: Record<string, any> = { codigoEmpresa };
  if (params?.busca?.trim()) query.busca = params.busca.trim();
  const isoIni = toIsoDateFromBr(params?.dataInicio);
  const isoFim = toIsoDateFromBr(params?.dataFim);
  if (isoIni) query.dataInicio = isoIni;
  if (isoFim) query.dataFim = isoFim;

  const resp = await apiManager.makeApiCall<RecebimentoResumo[]>(
    `${baseUrl}/api/v1/NotasAjuste/Recebimentos`,
    ApiCallType.GET,
    headers,
    query,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao buscar recebimentos de mercadorias.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function obterItensRecebimentoAjuste(
  numReceb: string,
  codigoEmpresaOverride?: number,
): Promise<NotaAjusteItemInput[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<NotaAjusteItemInput[]>(
    `${baseUrl}/api/v1/NotasAjuste/Recebimentos/${encodeURIComponent(codigoEmpresa)}/${encodeURIComponent(numReceb)}/Itens`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao importar itens do recebimento selecionado.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function listarAdiantamentosAjuste(params?: {
  codigoCliente?: number;
  busca?: string;
  codigoEmpresa?: number;
}): Promise<AdiantamentoDisponivel[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params?.codigoEmpresa);
  const query: Record<string, any> = { codigoEmpresa };
  if (params?.codigoCliente && params.codigoCliente > 0) query.codigoCliente = params.codigoCliente;
  if (params?.busca?.trim()) query.busca = params.busca.trim();

  const resp = await apiManager.makeApiCall<AdiantamentoDisponivel[]>(
    `${baseUrl}/api/v1/NotasAjuste/Adiantamentos`,
    ApiCallType.GET,
    headers,
    query,
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao buscar adiantamentos disponíveis.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function buscarMateriaisAjuste(
  busca: string,
  codigoEmpresaOverride?: number,
): Promise<MaterialBusca[]> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<MaterialBusca[]>(
    `${baseUrl}/api/v1/NotasAjuste/Materiais`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, busca },
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao buscar materiais.'));
  }
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function obterReducaoIbsCbs(cst: string, classTrib: string): Promise<ReducaoIbsCbs> {
  const { baseUrl, headers } = getSessionContext();
  const resp = await apiManager.makeApiCall<ReducaoIbsCbs>(
    `${baseUrl}/api/v1/NotasAjuste/ReducaoIBSCBS`,
    ApiCallType.GET,
    headers,
    { cst, classTrib },
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao consultar redução tributária IBS/CBS.'));
  }
  return resp.data;
}

export async function simularXmlNotaAjuste(
  payload: NotaAjusteEmitirRequest,
): Promise<SimularXmlNotaAjusteResponse> {
  const { baseUrl, headers, codigoEmpresa, codigoUsuario } = getSessionContext(payload.codigoEmpresa);
  const body: NotaAjusteEmitirRequest = {
    ...payload,
    codigoEmpresa,
    codigoUsuario: payload.codigoUsuario || codigoUsuario,
  };
  const resp = await apiManager.makeApiCall<SimularXmlNotaAjusteResponse>(
    `${baseUrl}/api/v1/NotasAjuste/SimularXml`,
    ApiCallType.POST,
    headers,
    {},
    body,
    { timeoutMs: 45000 },
  );
  if (!resp.succeeded && !resp.data?.xml) {
    throw new Error(extractApiError(resp, 'Falha ao simular XML da Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function emitirNotaAjuste(
  payload: NotaAjusteEmitirRequest,
): Promise<EmitirNotaAjusteResponse> {
  const { baseUrl, headers, codigoEmpresa, codigoUsuario } = getSessionContext(payload.codigoEmpresa);
  const body: NotaAjusteEmitirRequest = {
    ...payload,
    codigoEmpresa,
    codigoUsuario: payload.codigoUsuario || codigoUsuario,
  };
  const resp = await apiManager.makeApiCall<EmitirNotaAjusteResponse>(
    `${baseUrl}/api/v1/NotasAjuste/Emitir`,
    ApiCallType.POST,
    headers,
    {},
    body,
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded) {
    if (resp.jsonBody && typeof resp.jsonBody === 'object' && 'mensagem' in resp.jsonBody) {
      return resp.jsonBody as EmitirNotaAjusteResponse;
    }
    throw new Error(extractApiError(resp, 'Erro ao emitir Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function retransmitirNotaAjuste(
  payload: NotaAjusteRetransmitirRequest,
): Promise<EmitirNotaAjusteResponse> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(payload.codigoEmpresa);
  const body: NotaAjusteRetransmitirRequest = { ...payload, codigoEmpresa };
  const resp = await apiManager.makeApiCall<EmitirNotaAjusteResponse>(
    `${baseUrl}/api/v1/NotasAjuste/Retransmitir`,
    ApiCallType.POST,
    headers,
    {},
    body,
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded) {
    if (resp.jsonBody && typeof resp.jsonBody === 'object' && 'mensagem' in resp.jsonBody) {
      return resp.jsonBody as EmitirNotaAjusteResponse;
    }
    throw new Error(extractApiError(resp, 'Erro ao retransmitir Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export interface ExcluirNotaAjusteResponse {
  sucesso: boolean;
  mensagem: string;
  bloqueadaPorAutorizacao: boolean;
  situacaoNota?: number | null;
  autorizacaoNfe?: string | null;
}

export async function excluirNotaAjuste(params: {
  numNotaFiscal: string;
  serNotaFiscal: string;
  codigoMotivo: number;
  codigoEmpresa?: number;
}): Promise<ExcluirNotaAjusteResponse> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params.codigoEmpresa);
  const resp = await apiManager.makeApiCall<ExcluirNotaAjusteResponse>(
    `${baseUrl}/api/v1/NotasAjuste/Excluir`,
    ApiCallType.POST,
    headers,
    {},
    {
      codigoEmpresa,
      numNotaFiscal: params.numNotaFiscal,
      serNotaFiscal: params.serNotaFiscal,
      codigoMotivo: params.codigoMotivo,
    },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded) {
    if (resp.jsonBody && typeof resp.jsonBody === 'object' && 'mensagem' in resp.jsonBody) {
      return resp.jsonBody as ExcluirNotaAjusteResponse;
    }
    throw new Error(extractApiError(resp, 'Erro ao excluir Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function cancelarNotaAjuste(params: {
  numNotaFiscal: string;
  serNotaFiscal: string;
  codigoMotivo: number;
  codigoEmpresa?: number;
}): Promise<{ sucesso: boolean; message: string }> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(params.codigoEmpresa);
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; message: string }>(
    `${baseUrl}/api/v1/NotasAjuste/Cancelar`,
    ApiCallType.POST,
    headers,
    {},
    {
      codigoEmpresa,
      numNotaFiscal: params.numNotaFiscal,
      serNotaFiscal: params.serNotaFiscal,
      codigoMotivo: params.codigoMotivo,
    },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao cancelar Nota Fiscal de Ajuste.'));
  }
  return resp.data;
}

export async function obterXmlNotaAjuste(
  numNota: string,
  serie: string,
  codigoEmpresaOverride?: number,
): Promise<string> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<{ xml: string }>(
    `${baseUrl}/api/v1/NotasAjuste/Xml/${encodeURIComponent(codigoEmpresa)}/${encodeURIComponent(numNota)}/${encodeURIComponent(serie)}`,
    ApiCallType.GET,
    headers,
    { download: false },
  );
  if (!resp.succeeded || !resp.data?.xml) {
    throw new Error(extractApiError(resp, 'XML não disponível para esta NF de Ajuste.'));
  }
  return resp.data.xml;
}

export async function baixarXmlNotaAjuste(
  numNota: string,
  serie: string,
  chaveAcesso?: string | null,
  codigoEmpresaOverride?: number,
): Promise<void> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const resp = await apiManager.makeApiCall<Blob>(
    `${baseUrl}/api/v1/NotasAjuste/Xml/${encodeURIComponent(codigoEmpresa)}/${encodeURIComponent(numNota)}/${encodeURIComponent(serie)}`,
    ApiCallType.GET,
    headers,
    { download: true },
    undefined,
    { responseType: 'blob' },
  );
  if (!resp.succeeded || !(resp.data instanceof Blob) || resp.data.size === 0) {
    throw new Error(extractApiError(resp, 'Não foi possível baixar o XML desta NF de Ajuste.'));
  }
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = chaveAcesso ? `${chaveAcesso}-nfe.xml` : `NFe_Ajuste_${numNota}_${serie}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function gerarDanfeNotaAjustePdf(
  numNota: string,
  serNota: string,
  tipoDanfe: 5 | 6 = 5,
  codigoEmpresaOverride?: number,
  opcoes?: { simulacao?: boolean; xml?: string },
): Promise<Blob> {
  const { baseUrl, headers, codigoEmpresa } = getSessionContext(codigoEmpresaOverride);
  const simulacao = Boolean(opcoes?.simulacao);
  const resp = await apiManager.makeApiCall<Blob>(
    `${baseUrl}/api/v1/NotasAjuste/Danfe`,
    ApiCallType.POST,
    headers,
    {},
    {
      codigoEmpresa,
      numNotaFiscal: numNota,
      serNotaFiscal: serNota,
      tipoDanfe,
      simulacao,
      xml: simulacao ? opcoes?.xml : undefined,
    },
    { responseType: 'blob', timeoutMs: 45000 },
  );
  if (!resp.succeeded || !(resp.data instanceof Blob) || resp.data.size === 0) {
    throw new Error(extractApiError(resp, 'Não foi possível gerar o PDF da DANFE.'));
  }
  return resp.data;
}

export const abrirBlobPdf = (pdfBlob: Blob) => {
  const blobUrl = URL.createObjectURL(pdfBlob);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

const normalizeText = (v: string) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export async function buscarDestinatariosAjuste(termo: string): Promise<DestinatarioOpcao[]> {
  const q = termo.trim();
  const { baseUrl, headers } = getSessionContext();
  const token = headers.Authorization.replace(/^Bearer\s+/i, '');
  const resp = await obterClientesFornecedoresCall(baseUrl, token);
  if (!resp.succeeded) {
    throw new Error(extractApiError(resp, 'Erro ao buscar destinatários.'));
  }

  const body = resp.jsonBody ?? resp.data;
  const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  const qNorm = normalizeText(q);

  return lista
    .filter((c: any) => {
      if (!qNorm) return true;
      const nome = normalizeText(c.nome_Fantasia ?? c.nomeFantasia ?? '');
      const razao = normalizeText(c.razao_Social ?? c.razaoSocial ?? '');
      const doc = normalizeText(c.num_CGC ?? c.numCgc ?? '');
      const cod = String(c.codigo ?? '');
      return nome.includes(qNorm) || razao.includes(qNorm) || doc.includes(qNorm) || cod === q;
    })
    .slice(0, 60)
    .map((c: any) => {
      const tipo = String(c.tipo ?? 'C').toUpperCase() === 'F' ? 'F' : 'C';
      const codigo = Number(c.codigo ?? 0);
      const nomeFantasia = String(c.nome_Fantasia ?? c.nomeFantasia ?? c.razao_Social ?? c.razaoSocial ?? '').trim();
      const razaoSocial = String(c.razao_Social ?? c.razaoSocial ?? nomeFantasia).trim();
      const cnpjCpf = String(c.num_CGC ?? c.numCgc ?? '').trim();
      const uf = String(c.estado ?? c.uf ?? '').trim().toUpperCase();
      const codigoPais = Number(c.codigo_Pais ?? c.codigoPais ?? 1058) || 1058;
      const tipoLabel = tipo === 'F' ? 'Fornecedor' : 'Cliente';
      const cgcPart = cnpjCpf ? ` | ${cnpjCpf}` : '';
      const ufPart = uf ? ` | ${uf}` : '';
      return {
        value: `${tipo}-${codigo}`,
        tipo,
        codigo,
        nomeFantasia,
        razaoSocial,
        cnpjCpf,
        uf,
        codigoPais,
        label: `${codigo} - ${nomeFantasia}${cgcPart}${ufPart} (${tipoLabel})`,
      };
    });
}
