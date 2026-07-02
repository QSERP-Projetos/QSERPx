import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoAddOutline,
  IoCloseCircleOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { listContasReceberCall, listContasReceberNCCall, obterClientesFornecedoresCall, contasReceberSaldoAbaterCall, listContasReceberAbatimentoCall, abatimentoDocCall, cabecalhoEstornoAbatCall, listContasReceberEstornoAbatNCCall, estornarDocumentoAbatCall, adiantamentosRecebidosCall, encerrarReabrirAdiantamentoCall, devolverSaldoCall, cancelarContasReceberCall, consultaPortadorCall, contasFinanceirasCall, atualizaValorCalculadoCall, consultaPedidoCall, consultaNotaClienteCall, adicionaContasReceberCall, baixaContasReceberCall, consultaContaSelectCall, contasReceberOcorrenciasCall } from '../../../services/apiCalls';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type ContaReceber = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  data_Prev?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  situacao_Pag?: string | null;
  situacao_Docum?: number | null;
  tipo_Documento?: number | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Bordero_Desc?: string | number | null;
  valor_Abatido?: number | null;
  tipo_Cedente?: string | null;
  codigo_Cedente?: number | string | null;
  num_Nota_Fiscal?: string | number | null;
  ser_Nota_Fiscal?: string | number | null;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
};

type SortField = 'prev' | 'venc' | 'tipoDoc' | 'numero' | 'emissao' | 'valor' | 'sacado' | 'situacao';
type SortDirection = 'asc' | 'desc';
type ActiveTab = 'contas-receber' | 'nota-debito';

type NotaDebito = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  data_Prev?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  situacao_Pag?: string | null;
  situacao_Docum?: number | null;
  tipo_Documento?: number | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Bordero_Desc?: string | number | null;
};

type AbatimentoItem = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Nota_Fiscal?: string | null;
};

type EstornoAbatCabecalho = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  num_Documento?: string | null;
  num_Nota_Fiscal?: string | null;
  ser_Nota_Fiscal?: string | null;
  valor_Receber?: number | null;
  data_Vencimento?: string | null;
  data_Emissao?: string | null;
  nome_Fantasia?: string | null;
  tipo_Cedente?: string | null;
  codigo_Cedente?: number | string | null;
  valor_Abatido?: number | null;
  valor_Receber_Calc?: number | null;
};

type EstornoAbatItem = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  num_Lanc_Principal?: number | null;
  num_Lanc_Abatimento?: number | null;
  num_Documento?: string | null;
  num_Nota_Fiscal?: string | null;
  data_Emissao?: string | null;
  data_Abatimento?: string | null;
  nome_Fantasia?: string | null;
  tipo?: string | null;
  valor_Abatido?: number | null;
};

type AdiantamentoItem = {
  num_Lanc?: number | null;
  num_Documento?: string | null;
  num_Nota_Fiscal?: string | null;
  descricao_Lanc?: string | null;
  data_Vencimento?: string | null;
  data_Emissao?: string | null;
  valor_Saldo?: number | null;
  valor_Orig?: number | null;
  codigo_Portador?: number | null;
  temDev?: boolean | null;
  nome_Fantasia?: string | null;
};

type PortadorItem = {
  codigo_Portador: number;
  nome: string;
  nome_Banco: string;
};

type ContaFinanceiraItem = {
  num_Conta: number;
  codigo_Conta: string;
  descricao_Conta: string;
  tipo_Conta: string | null;
  recebe_Lanc: number;
};

type ConsultaAlterarMode = 'consulta' | 'alterar';

type ConsultaContaSelectResult = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipo_Documento?: number | null;
  num_Documento?: string | null;
  codigo_Portador?: number | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  data_Prev?: string | null;
  valor_Receber?: number | null;
  valor_Abatimento?: number | null;
  valor_Desconto?: number | null;
  valor_Juros?: number | null;
  valor_Outras_Desp?: number | null;
  valor_PIS?: number | null;
  valor_Cofins?: number | null;
  valor_Abatido?: number | null;
  valor_Recebido?: number | null;
  tipo_Cedente?: string | null;
  codigo_Cedente?: number | null;
  num_Nota_Fiscal?: string | null;
  ser_Nota_Fiscal?: string | null;
  num_Pedido?: string | null;
  descricao_Lanc?: string | null;
  num_Conta?: number | null;
  situacao_Pagto?: number | null;
};

type OcorrenciaItem = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  num_Ocorrencia?: number | null;
  data_Ocorrencia?: string | null;
  tipo_Ocorrencia?: number | null;
  descricao_Ocorrencia?: string | null;
  valor_Ocorrencia?: number | null;
  codigo_Usuario?: string | null;
};

const TIPO_DOC_OPTIONS = [
  { value: '8', label: 'Adiantamento' },
  { value: '3', label: 'Boleto' },
  { value: '11', label: 'Cartão Crédito' },
  { value: '10', label: 'Cartão Débito' },
  { value: '2', label: 'Cheque' },
  { value: '4', label: 'Depósito' },
  { value: '1', label: 'Dinheiro' },
  { value: '5', label: 'Duplicata' },
  { value: '9', label: 'Nota Crédito' },
  { value: '7', label: 'Nota Débito' },
  { value: '6', label: 'Outros' },
];

const SITUACAO_PAGTO_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: '1', label: 'Liberado' },
  { value: '2', label: 'Bloqueado' },
  { value: '3', label: 'Garantia' },
];

const parseBrFloat = (v: string): number =>
  parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

const formatBrFloat = (n: number): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatFirstDayOfMonth = () => {
  const now = new Date();
  const day = String(now.getDay()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatDateDdMmYy = (isoOrBrDate: string | null | undefined): string => {
  if (!isoOrBrDate) return '-';
  const str = String(isoOrBrDate).trim();

  // ISO format: 2026-05-13T00:00:00
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yy = isoMatch[1].slice(2);
    return `${isoMatch[3]}/${isoMatch[2]}/${yy}`;
  }

  // Already dd/mm/yyyy or dd/mm/yy
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (brMatch) {
    const yy = brMatch[3].length === 4 ? brMatch[3].slice(2) : brMatch[3];
    return `${brMatch[1]}/${brMatch[2]}/${yy}`;
  }

  return str;
};

const parseDateForSort = (isoOrBrDate: string | null | undefined): number => {
  if (!isoOrBrDate) return 0;
  const str = String(isoOrBrDate).trim();

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (brMatch) {
    const year = brMatch[3].length === 2 ? 2000 + Number(brMatch[3]) : Number(brMatch[3]);
    const d = new Date(year, Number(brMatch[2]) - 1, Number(brMatch[1]));
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  return 0;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Convert dd/mm/yyyy (DatePicker format) to dd/mm/yy (API format)
const toApiDateFormat = (ddMmYyyy: string): string => {
  const match = String(ddMmYyyy ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return ddMmYyyy;
  return `${match[1]}/${match[2]}/${match[3].slice(2)}`;
};

const brDateToIso = (ddMmYyyy: string): string => {
  const str = String(ddMmYyyy ?? '').trim();
  const match4 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match4) return `${match4[3]}-${match4[2]}-${match4[1]}`;
  const match2 = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (match2) return `${2000 + Number(match2[3])}-${match2[2]}-${match2[1]}`;
  return '';
};

const tipoOcorrenciaLabel = (tipo: number | null | undefined): string => {
  switch (tipo) {
    case 1: return 'Abatimento';
    case 2: return 'Desconto';
    case 3: return 'Juros';
    case 4: return 'Outras Desp.';
    case 5: return 'PIS';
    case 6: return 'Cofins';
    default: return '';
  }
};

// ── Consulta / Alterar Contas a Receber ───────────────────────────────────────
const ConsultaAlterarContasReceberModal = memo(function ConsultaAlterarContasReceberModal({
  open,
  mode,
  numLanc,
  sacadoNomeInicial,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: ConsultaAlterarMode;
  numLanc: number | null;
  sacadoNomeInicial?: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fNumero, setFNumero] = useState('');
  const [fTipoDoc, setFTipoDoc] = useState('');
  const [fValorDoc, setFValorDoc] = useState('');
  const [fEmissao, setFEmissao] = useState('');
  const [fValorRec, setFValorRec] = useState('');
  const [fVencto, setFVencto] = useState('');
  const [fPedido, setFPedido] = useState('');
  const [fPrevisao, setFPrevisao] = useState('');
  const [fAbatimento, setFAbatimento] = useState('0,00');
  const [fPis, setFPis] = useState('0,00');
  const [fDesconto, setFDesconto] = useState('0,00');
  const [fCofins, setFCofins] = useState('0,00');
  const [fJuros, setFJuros] = useState('0,00');
  const [fAbatido, setFAbatido] = useState('0,00');
  const [fOutrasDesp, setFOutrasDesp] = useState('0,00');
  const [fSituacaoPagto, setFSituacaoPagto] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fNotaFiscal, setFNotaFiscal] = useState('');
  const [fSerie, setFSerie] = useState('');
  const [portadores, setPortadores] = useState<PortadorItem[]>([]);
  const [portadorValue, setPortadorValue] = useState('');
  const [portadorCodigo, setPortadorCodigo] = useState('');
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceiraItem[]>([]);
  const [contaFinValue, setContaFinValue] = useState('');
  const [contaFinDescricao, setContaFinDescricao] = useState('');
  const [sacadoNome, setSacadoNome] = useState('');
  const [sacadoTipo, setSacadoTipo] = useState('');
  const [fJustificativa, setFJustificativa] = useState('');
  const consultaDataRef = useRef<ConsultaContaSelectResult | null>(null);
  const [ocorrenciasOpen, setOcorrenciasOpen] = useState(false);
  const [ocorrenciasRows, setOcorrenciasRows] = useState<OcorrenciaItem[]>([]);
  const [ocorrenciasLoading, setOcorrenciasLoading] = useState(false);
  const [abatimentosConsOpen, setAbatimentosConsOpen] = useState(false);
  const [abatimentosConsRows, setAbatimentosConsRows] = useState<EstornoAbatItem[]>([]);
  const [abatimentosConsLoading, setAbatimentosConsLoading] = useState(false);
  const [alterarConfirmOpen, setAlterarConfirmOpen] = useState(false);
  const [alterarSaving, setAlterarSaving] = useState(false);

  useEffect(() => {
    if (!open || numLanc == null) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;
    setLoading(true);
    setSacadoNome(sacadoNomeInicial ?? '');
    consultaDataRef.current = null;
    void Promise.all([
      consultaContaSelectCall(baseUrl, token, { codigoEmpresa, numLanc }),
      consultaPortadorCall(baseUrl, token),
      contasFinanceirasCall(baseUrl, token),
    ]).then(async ([consultaResp, portadoresResp, contasFinResp]) => {
      const portList: PortadorItem[] = [];
      const contaList: ContaFinanceiraItem[] = [];
      if (portadoresResp.succeeded) {
        const body = portadoresResp.jsonBody ?? portadoresResp.data;
        portList.push(...(Array.isArray(body) ? body : getRows(body)));
        setPortadores(portList);
      }
      if (contasFinResp.succeeded) {
        const body = contasFinResp.jsonBody ?? contasFinResp.data;
        contaList.push(...(Array.isArray(body) ? body : getRows(body)));
        setContasFinanceiras(contaList);
      }
      if (!consultaResp.succeeded) {
        showToast('Erro ao carregar dados do lançamento.', 'error');
        onClose();
        return;
      }
      const d: ConsultaContaSelectResult = consultaResp.jsonBody ?? consultaResp.data ?? {};
      consultaDataRef.current = d;
      setFNumero(String(d.num_Documento ?? ''));
      setFTipoDoc(String(d.tipo_Documento ?? '6'));
      setFValorDoc(d.valor_Receber != null ? formatBrFloat(d.valor_Receber) : '');
      setFEmissao(d.data_Emissao ? formatDateDdMmYy(d.data_Emissao) : '');
      setFVencto(d.data_Vencimento ? formatDateDdMmYy(d.data_Vencimento) : '');
      setFPedido(String(d.num_Pedido ?? ''));
      setFPrevisao(d.data_Prev ? formatDateDdMmYy(d.data_Prev) : '');
      setFAbatimento(formatBrFloat(d.valor_Abatimento ?? 0));
      setFPis(formatBrFloat(d.valor_PIS ?? 0));
      setFDesconto(formatBrFloat(d.valor_Desconto ?? 0));
      setFCofins(formatBrFloat(d.valor_Cofins ?? 0));
      setFJuros(formatBrFloat(d.valor_Juros ?? 0));
      setFAbatido(formatBrFloat(d.valor_Abatido ?? 0));
      setFOutrasDesp(formatBrFloat(d.valor_Outras_Desp ?? 0));
      setFSituacaoPagto(d.situacao_Pagto != null ? String(d.situacao_Pagto) : '');
      setFDescricao(String(d.descricao_Lanc ?? ''));
      setFJustificativa('');
      setFNotaFiscal(String(d.num_Nota_Fiscal ?? ''));
      setFSerie(String(d.ser_Nota_Fiscal ?? ''));
      const portVal = d.codigo_Portador != null ? String(d.codigo_Portador) : '';
      setPortadorValue(portVal);
      setPortadorCodigo(portVal);
      const contaVal = d.num_Conta != null ? String(d.num_Conta) : '';
      setContaFinValue(contaVal);
      const foundConta = contaList.find((c) => String(c.num_Conta) === contaVal);
      setContaFinDescricao(foundConta ? foundConta.descricao_Conta : '');
      setSacadoTipo(String(d.tipo_Cedente ?? '').toUpperCase());

      // Calcula valor recebido via API (Calcular=false)
      try {
        const calcRes = await atualizaValorCalculadoCall(baseUrl, token, {
          ValorReceber: d.valor_Receber ?? 0,
          ValorAbatimento: d.valor_Abatimento ?? 0,
          ValorAbatido: d.valor_Abatido ?? 0,
          ValorPis: d.valor_PIS ?? 0,
          ValorCofins: d.valor_Cofins ?? 0,
          ValorDesconto: d.valor_Desconto ?? 0,
          ValorJuros: d.valor_Juros ?? 0,
          ValorOutrasDesp: d.valor_Outras_Desp ?? 0,
          ValorCalculado: d.valor_Recebido ?? 0,
          Calcular: false,
        });
        if (calcRes.succeeded) {
          const calcBody = calcRes.jsonBody ?? calcRes.data;
          if (calcBody?.valorCalculado != null) setFValorRec(formatBrFloat(Number(calcBody.valorCalculado)));
          else setFValorRec(d.valor_Recebido != null ? formatBrFloat(d.valor_Recebido) : '');
        } else {
          setFValorRec(d.valor_Recebido != null ? formatBrFloat(d.valor_Recebido) : '');
        }
      } catch {
        setFValorRec(d.valor_Recebido != null ? formatBrFloat(d.valor_Recebido) : '');
      }
    }).finally(() => setLoading(false));
  }, [open, numLanc, sacadoNomeInicial]);

  const handleAbrirOcorrencias = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa || numLanc == null) return;
    setOcorrenciasRows([]);
    setOcorrenciasOpen(true);
    setOcorrenciasLoading(true);
    try {
      const resp = await contasReceberOcorrenciasCall(baseUrl, token, { codigoEmpresa, numLanc });
      if (resp.succeeded) {
        const body = resp.jsonBody ?? resp.data;
        setOcorrenciasRows(Array.isArray(body) ? body : getRows(body));
      }
    } catch {
      setOcorrenciasRows([]);
    } finally {
      setOcorrenciasLoading(false);
    }
  }, [numLanc]);

  const handleAtualizaValorAlt = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await atualizaValorCalculadoCall(baseUrl, token, {
        ValorReceber: parseBrFloat(fValorDoc),
        ValorAbatimento: parseBrFloat(fAbatimento),
        ValorAbatido: parseBrFloat(fAbatido),
        ValorPis: parseBrFloat(fPis),
        ValorCofins: parseBrFloat(fCofins),
        ValorDesconto: parseBrFloat(fDesconto),
        ValorJuros: parseBrFloat(fJuros),
        ValorOutrasDesp: parseBrFloat(fOutrasDesp),
        ValorCalculado: parseBrFloat(fValorRec),
        Calcular: false,
      });
      if (res.succeeded) {
        const body = res.jsonBody ?? res.data;
        if (body?.valorCalculado != null) setFValorRec(formatBrFloat(Number(body.valorCalculado)));
      }
    } catch {
      // silently ignore
    }
  }, [fValorDoc, fAbatimento, fAbatido, fPis, fCofins, fDesconto, fJuros, fOutrasDesp, fValorRec]);

  const handleCalcularAlt = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await atualizaValorCalculadoCall(baseUrl, token, {
        ValorReceber: parseBrFloat(fValorDoc),
        ValorAbatimento: parseBrFloat(fAbatimento),
        ValorAbatido: parseBrFloat(fAbatido),
        ValorPis: parseBrFloat(fPis),
        ValorCofins: parseBrFloat(fCofins),
        ValorDesconto: parseBrFloat(fDesconto),
        ValorJuros: parseBrFloat(fJuros),
        ValorOutrasDesp: parseBrFloat(fOutrasDesp),
        ValorCalculado: parseBrFloat(fValorRec),
        Calcular: true,
      });
      if (res.succeeded) {
        const body = res.jsonBody ?? res.data;
        if (body?.valorAbatimento != null) setFAbatimento(formatBrFloat(Number(body.valorAbatimento)));
        if (body?.valorJuros != null) setFJuros(formatBrFloat(Number(body.valorJuros)));
      }
    } catch {
      // silently ignore
    }
  }, [fValorDoc, fAbatimento, fAbatido, fPis, fCofins, fDesconto, fJuros, fOutrasDesp, fValorRec]);

  const handleConfirmAlterar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token || !codEmpresa || numLanc == null) return;
    const d = consultaDataRef.current;
    setAlterarSaving(true);
    setAlterarConfirmOpen(false);
    try {
      const res = await adicionaContasReceberCall(baseUrl, token, {
        codigoEmpesa: Number(codEmpresa),
        NumDocumento: fNumero,
        TipoDoc: Number(fTipoDoc) || 0,
        DataEmissao: brDateToIso(fEmissao),
        DataVenciment: brDateToIso(fVencto),
        DataPrevisao: brDateToIso(fPrevisao),
        Usuario: usuario,
        ValorReceber: parseBrFloat(fValorDoc),
        ValorCalculado: parseBrFloat(fValorRec),
        NumPedido: fPedido.trim() ? (Number(fPedido.trim()) || 0) : 0,
        NumSeparacao: 0,
        ValorAbatimento: parseBrFloat(fAbatimento),
        ValorDesconto: parseBrFloat(fDesconto),
        ValorJuros: parseBrFloat(fJuros),
        ValorOutrasDesp: parseBrFloat(fOutrasDesp),
        ValorPis: parseBrFloat(fPis),
        ValorCofins: parseBrFloat(fCofins),
        ValorAbatido: parseBrFloat(fAbatido),
        SituacaoPagto: fSituacaoPagto ? (Number(fSituacaoPagto) || 0) : 0,
        NumParcelas: 0,
        CodigoSacado: Number(d?.codigo_Cedente ?? 0) || 0,
        TipoSacado: String(d?.tipo_Cedente ?? ''),
        CodigoPortador: portadorCodigo ?? '',
        NumConta: Number(contaFinValue) || 0,
        NumNotaFiscal: fNotaFiscal.trim() ? fNotaFiscal.trim().padStart(6, '0') : '',
        SerNotaFiscal: fSerie.trim(),
        DescricaoLanc: fDescricao,
        JustAlteracao: fJustificativa,
        OrigemChamada: 2,
        NumLanc: numLanc,
      });
      if (res.succeeded) {
        showToast('Alteração realizada com sucesso!', 'success');
        onClose();
        onSuccess?.();
      } else {
        const body = res.jsonBody ?? res.data;
        showToast(String(body?.message ?? 'Erro ao alterar lançamento'), 'error');
      }
    } catch {
      showToast('Erro ao alterar lançamento', 'error');
    } finally {
      setAlterarSaving(false);
    }
  }, [
    numLanc, fNumero, fTipoDoc, fEmissao, fVencto, fPrevisao,
    fValorDoc, fValorRec, fPedido, fAbatimento, fDesconto, fJuros,
    fOutrasDesp, fPis, fCofins, fAbatido, fSituacaoPagto,
    portadorCodigo, contaFinValue, fNotaFiscal, fSerie,
    fDescricao, fJustificativa, onClose, onSuccess, showToast,
  ]);

  const handleAbrirAbatimentosConsulta = useCallback(async () => {
    const d = consultaDataRef.current;
    if (!d) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa || d.num_Lanc == null) return;
    setAbatimentosConsRows([]);
    setAbatimentosConsOpen(true);
    setAbatimentosConsLoading(true);
    try {
      const resp = await listContasReceberEstornoAbatNCCall(baseUrl, token, {
        codigoEmpresa,
        codCedente: d.codigo_Cedente ?? '',
        tipoCedente: String(d.tipo_Cedente ?? ''),
        numLancPrincipal: d.num_Lanc,
      });
      if (resp.succeeded) {
        const body = resp.jsonBody ?? resp.data;
        setAbatimentosConsRows(Array.isArray(body) ? body : getRows(body));
      }
    } catch {
      setAbatimentosConsRows([]);
    } finally {
      setAbatimentosConsLoading(false);
    }
  }, []);

  const ro = mode === 'consulta';

  // Regras por tipo de documento (só aplica no modo alterar)
  const tipoDocNum = Number(fTipoDoc);
  const isNotaDebitoOuAdiant = !ro && (tipoDocNum === 7 || tipoDocNum === 8);
  const isAdiantamento = !ro && tipoDocNum === 8;

  // Aplica regras de tipo de documento ao alterar
  useEffect(() => {
    if (ro || !fTipoDoc) return;
    const tipo = Number(fTipoDoc);
    if (tipo === 7 || tipo === 8) {
      setFDesconto('0,00');
      setFJuros('0,00');
      setFOutrasDesp('0,00');
      setFPis('0,00');
      setFCofins('0,00');
    }
    if (tipo === 8) {
      setFNotaFiscal('');
      setFSerie('');
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    void atualizaValorCalculadoCall(baseUrl, token, {
      ValorReceber: parseBrFloat(fValorDoc),
      ValorAbatimento: parseBrFloat(fAbatimento),
      ValorAbatido: parseBrFloat(fAbatido),
      ValorPis: tipo === 7 || tipo === 8 ? 0 : parseBrFloat(fPis),
      ValorCofins: tipo === 7 || tipo === 8 ? 0 : parseBrFloat(fCofins),
      ValorDesconto: tipo === 7 || tipo === 8 ? 0 : parseBrFloat(fDesconto),
      ValorJuros: tipo === 7 || tipo === 8 ? 0 : parseBrFloat(fJuros),
      ValorOutrasDesp: tipo === 7 || tipo === 8 ? 0 : parseBrFloat(fOutrasDesp),
      ValorCalculado: parseBrFloat(fValorRec),
      Calcular: false,
    }).then((res) => {
      if (res.succeeded) {
        const body = res.jsonBody ?? res.data;
        if (body?.valorCalculado != null) setFValorRec(formatBrFloat(Number(body.valorCalculado)));
      }
    }).catch(() => { /* silently ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fTipoDoc, ro]);

  const tipoDocLabel = TIPO_DOC_OPTIONS.find((o) => o.value === fTipoDoc)?.label ?? fTipoDoc;
  const portadorBancoLabel = portadores.find((p) => String(p.codigo_Portador) === portadorValue)?.nome_Banco ?? portadorValue;
  const situacaoPagtoLabel = SITUACAO_PAGTO_OPTIONS.find((o) => o.value === fSituacaoPagto)?.label ?? fSituacaoPagto;
  const contaFinCodigoLabel = contasFinanceiras.find((c) => String(c.num_Conta) === contaFinValue)?.codigo_Conta ?? contaFinValue;
  const fJustificativaEnabled = !ro && [fAbatimento, fDesconto, fJuros, fOutrasDesp, fPis, fCofins, fAbatido].some((v) => parseBrFloat(v) > 0);

  if (!open) return null;

  return (
    <>
      <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === 'consulta' ? 'Consulta Contas a Receber' : 'Alterar Contas a Receber'}>
        <article className="modal-card modal-card--lancamento">
          <header className="modal-card__header lancamento-modal-header">
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)' }}>
              {mode === 'consulta' ? 'Consulta' : 'Alterar'} Contas a Receber
            </h2>
          </header>

          <div className="lancamento-modal-body">
            {loading && (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)', textAlign: 'center' }}>Carregando dados...</p>
            )}

            <div className="lancamento-two-col">
              {/* Left column */}
              <div className="lancamento-col">
                <div className="lancamento-form-grid4">
                  <span className="lancamento-lbl">Número:</span>
                  <input className="lancamento-inp" readOnly value={fNumero} />
                  <span className="lancamento-lbl">Usuário:</span>
                  <input className="lancamento-inp" readOnly value={GlobalConfig.getUsuario().toUpperCase()} />

                  <span className="lancamento-lbl">Tipo doc:</span>
                  {ro
                    ? <input className="lancamento-inp" readOnly value={tipoDocLabel} />
                    : <SearchableSelect options={TIPO_DOC_OPTIONS} value={fTipoDoc} onChange={setFTipoDoc} placeholder="Selecione..." />
                  }
                  <span className="lancamento-lbl">Valor doc.:</span>
                  <input className="lancamento-inp lancamento-inp--right" readOnly value={fValorDoc} placeholder="0,00" />

                  <span className="lancamento-lbl">Emissão:</span>
                  <input className="lancamento-inp" readOnly value={fEmissao} />
                  <span className="lancamento-lbl">Valor rec.:</span>
                  <input className="lancamento-inp lancamento-inp--right" readOnly={ro} value={fValorRec} onChange={(e) => setFValorRec(e.target.value)} placeholder="0,00" />

                  <span className="lancamento-lbl">Vencto.:</span>
                  <input className="lancamento-inp" readOnly value={fVencto} />
                  <span className="lancamento-lbl">Pedido:</span>
                  <input className="lancamento-inp" readOnly={ro} value={fPedido} onChange={(e) => setFPedido(e.target.value)} />

                  <span className="lancamento-lbl">Previsão:</span>
                  {ro
                    ? <input className="lancamento-inp" readOnly value={fPrevisao} />
                    : <CustomDatePicker value={fPrevisao} onChange={setFPrevisao} />
                  }
                  <span /><span />
                </div>

                <div className="lancamento-values-box">
                  <div className="lancamento-values-grid">
                    <span className="lancamento-lbl">Abatimento:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro || isNotaDebitoOuAdiant} value={fAbatimento} onChange={(e) => setFAbatimento(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />
                    <span className="lancamento-lbl">PIS:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro} disabled={isNotaDebitoOuAdiant} value={fPis} onChange={(e) => setFPis(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />

                    <span className="lancamento-lbl">Desconto:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro} disabled={isNotaDebitoOuAdiant} value={fDesconto} onChange={(e) => setFDesconto(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />
                    <span className="lancamento-lbl">Cofins:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro} disabled={isNotaDebitoOuAdiant} value={fCofins} onChange={(e) => setFCofins(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />

                    <span className="lancamento-lbl">Juros:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro} disabled={isNotaDebitoOuAdiant} value={fJuros} onChange={(e) => setFJuros(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />
                    <span className="lancamento-lbl">Abatido:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly value={fAbatido} />

                    <span className="lancamento-lbl">Outras desp.:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly={ro} disabled={isNotaDebitoOuAdiant} value={fOutrasDesp} onChange={(e) => setFOutrasDesp(e.target.value)} onBlur={ro ? undefined : () => void handleAtualizaValorAlt()} />
                    <span /><span />
                  </div>
                  <div className="lancamento-calcular-row">
                    {!ro && (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ width: 'auto', minWidth: 80, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                        onClick={() => void handleCalcularAlt()}
                      >
                        Calcular
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <span className="lancamento-lbl" style={{ flexShrink: 0 }}>Situação do pagto.:</span>
                    {ro
                      ? <input className="lancamento-inp" readOnly value={situacaoPagtoLabel} />
                      : <SearchableSelect options={SITUACAO_PAGTO_OPTIONS} value={fSituacaoPagto} onChange={setFSituacaoPagto} placeholder="Selecione..." />
                    }
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="lancamento-col">
                <div className="lancamento-form-grid2">
                  <span className="lancamento-lbl">Sacado:</span>
                  <div className="lancamento-combo-group">
                    <input className="lancamento-inp" readOnly value={sacadoNome} style={{ flex: 1 }} />
                    <input className="lancamento-inp lancamento-inp--tipo" readOnly value={sacadoTipo === 'C' ? 'Cliente' : sacadoTipo === 'F' ? 'Fornecedor' : sacadoTipo} tabIndex={-1} />
                  </div>

                  <span className="lancamento-lbl">Portador:</span>
                  <div className="lancamento-combo-group">
                    {ro
                      ? <input className="lancamento-inp" readOnly value={portadorBancoLabel} style={{ flex: 1 }} />
                      : <SearchableSelect
                        options={[{ value: '', label: 'Selecione...' }, ...portadores.map((p) => ({ value: String(p.codigo_Portador), label: p.nome_Banco }))]}
                        value={portadorValue}
                        onChange={(v) => { setPortadorValue(v); setPortadorCodigo(v); }}
                        placeholder="Selecione..."
                      />
                    }
                    <input className="lancamento-inp lancamento-inp--sm" readOnly value={portadorCodigo} tabIndex={-1} />
                  </div>

                  <span className="lancamento-lbl">Conta Fin.:</span>
                  <div className="lancamento-combo-group">
                    {ro
                      ? <input className="lancamento-inp" readOnly value={contaFinCodigoLabel} style={{ flex: 1 }} />
                      : <SearchableSelect
                        options={[{ value: '', label: 'Selecione...' }, ...contasFinanceiras.map((c) => ({ value: String(c.num_Conta), label: c.codigo_Conta }))]}
                        value={contaFinValue}
                        onChange={(v) => {
                          setContaFinValue(v);
                          const found = contasFinanceiras.find((c) => String(c.num_Conta) === v);
                          setContaFinDescricao(found ? found.descricao_Conta : '');
                        }}
                        placeholder="Selecione..."
                      />
                    }
                    <input className="lancamento-inp lancamento-inp--desc" readOnly value={contaFinDescricao} tabIndex={-1} title={contaFinDescricao} />
                  </div>

                  <span className="lancamento-lbl">Nota Fiscal:</span>
                  <input className="lancamento-inp lancamento-inp--nf" readOnly={ro} disabled={isAdiantamento} value={fNotaFiscal} onChange={ro ? undefined : (e) => setFNotaFiscal(e.target.value)} />

                  <span className="lancamento-lbl">Série:</span>
                  <input className="lancamento-inp" style={{ maxWidth: 60 }} readOnly={ro} disabled={isAdiantamento} value={fSerie} onChange={ro ? undefined : (e) => setFSerie(e.target.value)} />
                </div>

                <div className="lancamento-textarea-wrap">
                  <span className="lancamento-lbl" style={{ textAlign: 'left' }}>Descrição:</span>
                  <textarea
                    className="lancamento-textarea"
                    readOnly={ro}
                    value={fDescricao}
                    onChange={(e) => setFDescricao(e.target.value)}
                    rows={3}
                  />
                </div>

                {!ro && (
                  <div className="lancamento-textarea-wrap">
                    <span className="lancamento-lbl" style={{ textAlign: 'left' }}>Justificativa da alteração:</span>
                    <textarea
                      className="lancamento-textarea"
                      value={fJustificativa}
                      onChange={(e) => setFJustificativa(e.target.value)}
                      rows={3}
                      disabled={!fJustificativaEnabled}
                    />
                  </div>
                )}

                <div className="lancamento-textarea-wrap">
                  <div className="lancamento-textarea-actions" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto', minWidth: 90, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                      onClick={() => void handleAbrirOcorrencias()}
                    >
                      Ocorrências
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto', minWidth: 90, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                      onClick={() => void handleAbrirAbatimentosConsulta()}
                    >
                      Abatimentos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="lancamento-modal-footer">
            <div style={{ flex: 1 }} />
            <div className="lancamento-modal-actions">
              <button type="button" className="secondary-button" style={{ width: 'auto', minWidth: 80 }} onClick={onClose} disabled={alterarSaving}>
                {mode === 'consulta' ? 'Fechar' : 'Cancelar'}
              </button>
              {mode === 'alterar' && (
                <button type="button" className="primary-button" style={{ width: 'auto', minWidth: 80 }} onClick={() => setAlterarConfirmOpen(true)} disabled={alterarSaving}>
                  {alterarSaving ? 'Salvando...' : 'OK'}
                </button>
              )}
            </div>
          </footer>
        </article>
      </section>

      {/* Confirmação de alteração */}
      {alterarConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar alteração">
          <article className="modal-card" style={{ width: 'min(420px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Alteração</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Confirma a alteração do lançamento <strong>{fNumero}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="secondary-button" style={{ width: 'auto', minWidth: 80 }} onClick={() => setAlterarConfirmOpen(false)}>Cancelar</button>
              <button type="button" className="primary-button" style={{ width: 'auto', minWidth: 80 }} onClick={() => void handleConfirmAlterar()}>Confirmar</button>
            </div>
          </article>
        </section>
      )}

      {/* Ocorrências sub-modal */}
      {ocorrenciasOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Ocorrências">
          <article className="modal-card modal-card--abatimento">
            <header className="modal-card__header">
              <h2>Ocorrências</h2>
            </header>
            <div className="abatimento-table-wrap">
              {ocorrenciasLoading ? (
                <p className="module-empty">Carregando...</p>
              ) : (
                <table className="abatimento-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Motivo da Alteração</th>
                      <th>Usuário</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocorrenciasRows.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>Nenhuma ocorrência encontrada.</td></tr>
                    ) : ocorrenciasRows.map((item, idx) => (
                      <tr key={idx}>
                        <td>{formatDateDdMmYy(item.data_Ocorrencia)}</td>
                        <td>{tipoOcorrenciaLabel(item.tipo_Ocorrencia)}</td>
                        <td>{String(item.descricao_Ocorrencia ?? '-')}</td>
                        <td>{String(item.codigo_Usuario ?? '-')}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor_Ocorrencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setOcorrenciasOpen(false)}>
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Abatimentos sub-modal */}
      {abatimentosConsOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Abatimentos">
          <article className="modal-card modal-card--abatimento">
            <header className="modal-card__header">
              <h2>Abatimentos</h2>
            </header>
            <div className="abatimento-table-wrap">
              {abatimentosConsLoading ? (
                <p className="module-empty">Carregando...</p>
              ) : (
                <table className="abatimento-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Data Abatimento</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Abatido</th>
                      <th>Nota</th>
                      <th>Sacado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abatimentosConsRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>Nenhum abatimento encontrado.</td></tr>
                    ) : abatimentosConsRows.map((item, idx) => (
                      <tr key={idx}>
                        <td>{String(item.num_Documento ?? '-')}</td>
                        <td>{formatDateDdMmYy(item.data_Abatimento)}</td>
                        <td>{String(item.tipo ?? '-')}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor_Abatido)}</td>
                        <td>{item.num_Nota_Fiscal != null ? String(item.num_Nota_Fiscal) : '-'}</td>
                        <td>{String(item.nome_Fantasia ?? '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setAbatimentosConsOpen(false)}>
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}
    </>
  );
});

// ── Lançamento de Contas a Receber — componente isolado (performance) ──────────
const LancamentoContasReceberModal = memo(function LancamentoContasReceberModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [lancLoadingInit, setLancLoadingInit] = useState(false);
  const { showToast } = useToast();
  const [lancNumero, setLancNumero] = useState('');
  const [lancTipoDoc, setLancTipoDoc] = useState('6');
  const [lancValorDoc, setLancValorDoc] = useState('');
  const [lancEmissao, setLancEmissao] = useState('');
  const [lancValorRec, setLancValorRec] = useState('');
  const [lancVencto, setLancVencto] = useState('');
  const [lancPedido, setLancPedido] = useState('');
  const [lancPedidoStatus, setLancPedidoStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [lancPedidoMsg, setLancPedidoMsg] = useState('');
  const [lancPrevisao, setLancPrevisao] = useState('');
  const [lancNotaFiscal, setLancNotaFiscal] = useState('');
  const [lancSerie, setLancSerie] = useState('');
  const [lancNotaStatus, setLancNotaStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [lancNotaMsg, setLancNotaMsg] = useState('');
  const [lancAbatimento, setLancAbatimento] = useState('0,00');
  const [lancPis, setLancPis] = useState('0,00');
  const [lancDesconto, setLancDesconto] = useState('0,00');
  const [lancCofins, setLancCofins] = useState('0,00');
  const [lancJuros, setLancJuros] = useState('0,00');
  const [lancAbatido, setLancAbatido] = useState('0,00');
  const [lancOutrasDesp, setLancOutrasDesp] = useState('0,00');
  const [lancSituacaoPagto, setLancSituacaoPagto] = useState('');
  const [lancDescricao, setLancDescricao] = useState('');
  const [lancJustificativa, setLancJustificativa] = useState('');
  const [lancParcelas, setLancParcelas] = useState(false);
  const [lancQtdParcelas, setLancQtdParcelas] = useState('');

  const [lancPortadores, setLancPortadores] = useState<PortadorItem[]>([]);
  const [lancPortadorValue, setLancPortadorValue] = useState('');
  const [lancPortadorCodigo, setLancPortadorCodigo] = useState('');

  const [lancContasFinanceiras, setLancContasFinanceiras] = useState<ContaFinanceiraItem[]>([]);
  const [lancContaFinValue, setLancContaFinValue] = useState('');
  const [lancContaFinDescricao, setLancContaFinDescricao] = useState('');

  const [lancSacadoValue, setLancSacadoValue] = useState('');
  const [lancSacadoNome, setLancSacadoNome] = useState('');
  const [lancSacadoCodigo, setLancSacadoCodigo] = useState('');
  const [lancSacadoTipo, setLancSacadoTipo] = useState('');
  const [lancSacadoOptions, setLancSacadoOptions] = useState<SearchableSelectOption[]>([{ value: '', label: 'Digite ao menos 3 letras...' }]);
  const lancSacadoRawRef = useRef<any[]>([]);
  const lancSacadoTimerRef = useRef<number | null>(null);
  const lancPedidoRef = useRef<HTMLInputElement>(null);
  const lancNotaFiscalRef = useRef<HTMLInputElement>(null);

  const [lancConfirmOpen, setLancConfirmOpen] = useState(false);
  const [lancSaving, setLancSaving] = useState(false);

  // Reset form + load combos when modal opens
  useEffect(() => {
    if (!open) return;
    setLancNumero('');
    setLancTipoDoc('6');
    setLancValorDoc('');
    setLancEmissao(formatToday());
    setLancValorRec('');
    setLancVencto('');
    setLancPedido('');
    setLancPedidoStatus('idle');
    setLancPedidoMsg('');
    setLancPrevisao('');
    setLancNotaFiscal('');
    setLancSerie('');
    setLancNotaStatus('idle');
    setLancNotaMsg('');
    setLancAbatimento('0,00');
    setLancPis('0,00');
    setLancDesconto('0,00');
    setLancCofins('0,00');
    setLancJuros('0,00');
    setLancAbatido('0,00');
    setLancOutrasDesp('0,00');
    setLancSituacaoPagto('');
    setLancDescricao('');
    setLancJustificativa('');
    setLancParcelas(false);
    setLancQtdParcelas('');
    setLancPortadorValue('');
    setLancPortadorCodigo('');
    setLancContaFinValue('');
    setLancContaFinDescricao('');
    setLancSacadoValue('');
    setLancSacadoNome('');
    setLancSacadoCodigo('');
    setLancSacadoTipo('');
    setLancSacadoOptions([{ value: '', label: 'Digite ao menos 3 letras...' }]);
    lancSacadoRawRef.current = [];

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;

    setLancLoadingInit(true);
    void Promise.all([
      consultaPortadorCall(baseUrl, token),
      contasFinanceirasCall(baseUrl, token),
    ]).then(([portadoresResp, contasFinResp]) => {
      if (portadoresResp.succeeded) {
        const body = portadoresResp.jsonBody ?? portadoresResp.data;
        setLancPortadores(Array.isArray(body) ? body : getRows(body));
      }
      if (contasFinResp.succeeded) {
        const body = contasFinResp.jsonBody ?? contasFinResp.data;
        setLancContasFinanceiras(Array.isArray(body) ? body : getRows(body));
      }
    }).finally(() => setLancLoadingInit(false));
  }, [open]);

  const carregarLancSacados = useCallback(async (term: string) => {
    const query = term.trim();
    if (query.length < 3) {
      lancSacadoRawRef.current = [];
      setLancSacadoOptions([{ value: '', label: 'Digite ao menos 3 letras...' }]);
      return;
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await obterClientesFornecedoresCall(baseUrl, token);
      if (!res.succeeded) {
        lancSacadoRawRef.current = [];
        setLancSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
        return;
      }
      const body = res.jsonBody ?? res.data;
      const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const queryNorm = normalizeText(query);
      const filtrados = lista.filter((c: any) => {
        const nome = normalizeText(String(c.nome_Fantasia ?? c.razao_Social ?? ''));
        const doc = normalizeText(String(c.num_CGC ?? ''));
        return nome.includes(queryNorm) || doc.includes(queryNorm);
      });
      lancSacadoRawRef.current = filtrados;
      setLancSacadoOptions([
        { value: '', label: filtrados.length > 0 ? 'Selecione...' : 'Nenhum encontrado' },
        ...filtrados.map((c: any) => ({
          value: `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}`,
          label: String(c.nome_Fantasia ?? c.razao_Social ?? ''),
        })),
      ]);
    } catch {
      lancSacadoRawRef.current = [];
      setLancSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
    }
  }, []);

  const handleLancSacadoSearch = useCallback((query: string) => {
    if (lancSacadoTimerRef.current != null) window.clearTimeout(lancSacadoTimerRef.current);
    lancSacadoTimerRef.current = window.setTimeout(() => { void carregarLancSacados(query); }, 250);
  }, [carregarLancSacados]);

  // Valida pedido ao sair do campo
  const handleValidatePedido = useCallback(async () => {
    if (!lancPedido.trim()) { setLancPedidoStatus('idle'); return; }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token) return;
    try {
      const res = await consultaPedidoCall(baseUrl, token, { codigoEmpresa: codEmpresa ?? 0, numPedido: lancPedido.trim() });
      if (res.succeeded) {
        setLancPedidoStatus('ok');
        setLancPedidoMsg('');
      } else {
        const body = res.jsonBody ?? res.data;
        const msg = String(body?.message ?? 'Pedido não encontrado');
        setLancPedido('');
        setLancPedidoStatus('error');
        setLancPedidoMsg(msg);
        showToast(msg, 'error');
        setTimeout(() => lancPedidoRef.current?.focus(), 0);
      }
    } catch {
      const msg = 'Erro ao consultar pedido';
      setLancPedido('');
      setLancPedidoStatus('error');
      setLancPedidoMsg(msg);
      showToast(msg, 'error');
      setTimeout(() => lancPedidoRef.current?.focus(), 0);
    }
  }, [lancPedido, showToast]);

  // Valida nota fiscal ao sair de Nota Fiscal ou Série
  const handleValidateNota = useCallback(async () => {
    if (!lancNotaFiscal.trim() || !lancSerie.trim()) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token) return;
    const numNotaFormatted = lancNotaFiscal.trim().padStart(6, '0');
    try {
      const res = await consultaNotaClienteCall(baseUrl, token, {
        codigoEmpresa: codEmpresa ?? 0,
        numNota: numNotaFormatted,
        serNota: lancSerie.trim(),
        tipoDest: lancSacadoTipo,
        codigoDest: lancSacadoCodigo,
      });
      if (res.succeeded) {
        setLancNotaStatus('ok');
        setLancNotaMsg('');
      } else {
        const body = res.jsonBody ?? res.data;
        const msg = String(body?.message ?? 'Nota não encontrada');
        setLancNotaFiscal('');
        setLancSerie('');
        setLancNotaStatus('error');
        setLancNotaMsg(msg);
        showToast(msg, 'error');
        setTimeout(() => lancNotaFiscalRef.current?.focus(), 0);
      }
    } catch {
      const msg = 'Erro ao consultar nota';
      setLancNotaFiscal('');
      setLancSerie('');
      setLancNotaStatus('error');
      setLancNotaMsg(msg);
      showToast(msg, 'error');
      setTimeout(() => lancNotaFiscalRef.current?.focus(), 0);
    }
  }, [lancNotaFiscal, lancSerie, lancSacadoTipo, lancSacadoCodigo, showToast]);

  // Justificativa fica bloqueada até que algum dos campos financeiros seja > 0
  const lancJustificativaEnabled = [lancAbatimento, lancDesconto, lancJuros, lancOutrasDesp, lancPis, lancCofins, lancAbatido].some(
    (v) => parseBrFloat(v) > 0,
  );

  // Chama a API de atualização de valor calculado (onBlur dos campos financeiros, Calcular=false)
  const handleAtualizaValor = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await atualizaValorCalculadoCall(baseUrl, token, {
        ValorReceber: parseBrFloat(lancValorDoc),
        ValorAbatimento: parseBrFloat(lancAbatimento),
        ValorAbatido: parseBrFloat(lancAbatido),
        ValorPis: parseBrFloat(lancPis),
        ValorCofins: parseBrFloat(lancCofins),
        ValorDesconto: parseBrFloat(lancDesconto),
        ValorJuros: parseBrFloat(lancJuros),
        ValorOutrasDesp: parseBrFloat(lancOutrasDesp),
        ValorCalculado: parseBrFloat(lancValorRec),
        Calcular: false,
      });
      if (res.succeeded) {
        const body = res.jsonBody ?? res.data;
        if (body?.valorCalculado != null) setLancValorRec(formatBrFloat(Number(body.valorCalculado)));
      }
    } catch {
      // silently ignore
    }
  }, [lancValorDoc, lancAbatimento, lancAbatido, lancPis, lancCofins, lancDesconto, lancJuros, lancOutrasDesp, lancValorRec]);

  // Chama a API com Calcular=true (botão Calcular) — atualiza Abatimento e Juros
  const handleCalcular = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await atualizaValorCalculadoCall(baseUrl, token, {
        ValorReceber: parseBrFloat(lancValorDoc),
        ValorAbatimento: parseBrFloat(lancAbatimento),
        ValorAbatido: parseBrFloat(lancAbatido),
        ValorPis: parseBrFloat(lancPis),
        ValorCofins: parseBrFloat(lancCofins),
        ValorDesconto: parseBrFloat(lancDesconto),
        ValorJuros: parseBrFloat(lancJuros),
        ValorOutrasDesp: parseBrFloat(lancOutrasDesp),
        ValorCalculado: parseBrFloat(lancValorRec),
        Calcular: true,
      });
      if (res.succeeded) {
        const body = res.jsonBody ?? res.data;
        if (body?.valorAbatimento != null) setLancAbatimento(formatBrFloat(Number(body.valorAbatimento)));
        if (body?.valorJuros != null) setLancJuros(formatBrFloat(Number(body.valorJuros)));
      }
    } catch {
      // silently ignore
    }
  }, [lancValorDoc, lancAbatimento, lancAbatido, lancPis, lancCofins, lancDesconto, lancJuros, lancOutrasDesp, lancValorRec]);

  const handleOkClick = useCallback(() => {
    setLancConfirmOpen(true);
  }, []);

  const handleConfirmLancamento = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token) return;
    setLancSaving(true);
    try {
      const res = await adicionaContasReceberCall(baseUrl, token, {
        codigoEmpesa: Number(codEmpresa ?? 0),
        NumDocumento: lancNumero,
        TipoDoc: Number(lancTipoDoc) || 0,
        DataEmissao: brDateToIso(lancEmissao),
        DataVenciment: brDateToIso(lancVencto),
        DataPrevisao: brDateToIso(lancPrevisao),
        Usuario: usuario,
        ValorReceber: parseBrFloat(lancValorDoc),
        ValorCalculado: parseBrFloat(lancValorRec),
        NumPedido: lancPedido.trim() ? (Number(lancPedido.trim()) || 0) : 0,
        NumSeparacao: 0,
        ValorAbatimento: parseBrFloat(lancAbatimento),
        ValorDesconto: parseBrFloat(lancDesconto),
        ValorJuros: parseBrFloat(lancJuros),
        ValorOutrasDesp: parseBrFloat(lancOutrasDesp),
        ValorPis: parseBrFloat(lancPis),
        ValorCofins: parseBrFloat(lancCofins),
        ValorAbatido: parseBrFloat(lancAbatido),
        SituacaoPagto: lancSituacaoPagto ? (Number(lancSituacaoPagto) || 0) : 0,
        NumParcelas: lancParcelas ? (Number(lancQtdParcelas) || 0) : 0,
        CodigoSacado: Number(lancSacadoCodigo) || 0,
        TipoSacado: lancSacadoTipo,
        CodigoPortador: lancPortadorCodigo ?? '',
        NumConta: Number(lancContaFinValue) || 0,
        NumNotaFiscal: lancNotaFiscal.trim() ? lancNotaFiscal.trim().padStart(6, '0') : '',
        SerNotaFiscal: lancSerie.trim(),
        DescricaoLanc: lancDescricao,
        JustAlteracao: lancJustificativa,
      });
      if (res.succeeded) {
        showToast('Lançamento realizado com sucesso!', 'success');
        setLancConfirmOpen(false);
        onClose();
        onSuccess?.();
      } else {
        const body = res.jsonBody ?? res.data;
        showToast(String(body?.message ?? 'Erro ao realizar lançamento'), 'error');
        setLancConfirmOpen(false);
      }
    } catch {
      showToast('Erro ao realizar lançamento', 'error');
      setLancConfirmOpen(false);
    } finally {
      setLancSaving(false);
    }
  }, [
    lancNumero, lancTipoDoc, lancEmissao, lancVencto, lancPrevisao,
    lancValorDoc, lancValorRec, lancPedido, lancAbatimento, lancDesconto,
    lancJuros, lancOutrasDesp, lancPis, lancCofins, lancAbatido,
    lancSituacaoPagto, lancParcelas, lancQtdParcelas,
    lancSacadoCodigo, lancSacadoTipo, lancPortadorCodigo, lancContaFinValue,
    lancNotaFiscal, lancSerie, lancDescricao, lancJustificativa,
    onClose, onSuccess, showToast,
  ]);

  if (!open) return null;

  return (
    <>
      <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Lançamento de Contas a Receber">
        <article className="modal-card modal-card--lancamento">
          {/* Header */}
          <header className="modal-card__header lancamento-modal-header">
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)' }}>
              Lançamento Contas a Receber
            </h2>
            <span className="lancamento-badge">Pend.</span>
          </header>

          {/* Body */}
          <div className="lancamento-modal-body">
            {lancLoadingInit && (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)', textAlign: 'center' }}>
                Carregando dados...
              </p>
            )}

            <div className="lancamento-two-col">
              {/* ── Left column ───────────────────────────────────────── */}
              <div className="lancamento-col">
                {/* Top form fields */}
                <div className="lancamento-form-grid4">
                  <span className="lancamento-lbl">Número:</span>
                  <input className="lancamento-inp" value={lancNumero} onChange={(e) => setLancNumero(e.target.value)} />
                  <span className="lancamento-lbl">Usuário:</span>
                  <input className="lancamento-inp" readOnly value={GlobalConfig.getUsuario().toUpperCase()} />

                  <span className="lancamento-lbl">Tipo doc:</span>
                  <SearchableSelect
                    options={TIPO_DOC_OPTIONS}
                    value={lancTipoDoc}
                    onChange={setLancTipoDoc}
                    placeholder="Selecione..."
                  />
                  <span className="lancamento-lbl">Valor doc.:</span>
                  <input className="lancamento-inp lancamento-inp--right" value={lancValorDoc} onChange={(e) => {
                    const v = e.target.value;
                    setLancValorDoc(v);
                    setLancValorRec(v);
                    setLancAbatimento('0,00');
                    setLancDesconto('0,00');
                    setLancJuros('0,00');
                    setLancOutrasDesp('0,00');
                    setLancPis('0,00');
                    setLancCofins('0,00');
                  }} placeholder="0,00" />

                  <span className="lancamento-lbl">Emissão:</span>
                  <CustomDatePicker value={lancEmissao} onChange={setLancEmissao} />
                  <span className="lancamento-lbl">Valor rec.:</span>
                  <input className="lancamento-inp lancamento-inp--right" value={lancValorRec} onChange={(e) => setLancValorRec(e.target.value)} placeholder="0,00" />

                  <span className="lancamento-lbl">Vencto.:</span>
                  <CustomDatePicker value={lancVencto} onChange={(v) => { setLancVencto(v); setLancPrevisao(v); }} />
                  <span className="lancamento-lbl">Pedido:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={lancPedidoRef}
                      className="lancamento-inp"
                      style={{ flex: 1 }}
                      value={lancPedido}
                      onChange={(e) => { setLancPedido(e.target.value); setLancPedidoStatus('idle'); setLancPedidoMsg(''); }}
                      onBlur={() => void handleValidatePedido()}
                    />
                    {lancPedidoStatus === 'ok' && <IoCheckmarkCircleOutline size={16} style={{ color: '#4caf50', flexShrink: 0 }} />}
                    {lancPedidoStatus === 'error' && <IoCloseCircleOutline size={16} style={{ color: '#f44336', flexShrink: 0 }} title={lancPedidoMsg} />}
                  </div>

                  <span className="lancamento-lbl">Previsão:</span>
                  <CustomDatePicker value={lancPrevisao} onChange={setLancPrevisao} />
                  <span /><span />
                </div>

                {/* Financial values */}
                <div className="lancamento-values-box">
                  <div className="lancamento-values-grid">
                    <span className="lancamento-lbl">Abatimento:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancAbatimento} onChange={(e) => setLancAbatimento(e.target.value)} onBlur={() => void handleAtualizaValor()} />
                    <span className="lancamento-lbl">PIS:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancPis} onChange={(e) => setLancPis(e.target.value)} onBlur={() => void handleAtualizaValor()} />

                    <span className="lancamento-lbl">Desconto:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancDesconto} onChange={(e) => setLancDesconto(e.target.value)} onBlur={() => void handleAtualizaValor()} />
                    <span className="lancamento-lbl">Cofins:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancCofins} onChange={(e) => setLancCofins(e.target.value)} onBlur={() => void handleAtualizaValor()} />

                    <span className="lancamento-lbl">Juros:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancJuros} onChange={(e) => setLancJuros(e.target.value)} onBlur={() => void handleAtualizaValor()} />
                    <span className="lancamento-lbl">Abatido:</span>
                    <input className="lancamento-inp lancamento-inp--right" readOnly value={lancAbatido} onBlur={() => void handleAtualizaValor()} />

                    <span className="lancamento-lbl">Outras desp.:</span>
                    <input className="lancamento-inp lancamento-inp--right" value={lancOutrasDesp} onChange={(e) => setLancOutrasDesp(e.target.value)} onBlur={() => void handleAtualizaValor()} />
                    <span /><span />
                  </div>
                  <div className="lancamento-calcular-row">
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto', minWidth: 80, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                      onClick={() => void handleCalcular()}
                    >
                      Calcular
                    </button>
                    <span className="lancamento-lbl" style={{ flexShrink: 0 }}>Situação do pagto.:</span>
                    <SearchableSelect
                      options={SITUACAO_PAGTO_OPTIONS}
                      value={lancSituacaoPagto}
                      onChange={setLancSituacaoPagto}
                      placeholder="Selecione..."
                    />
                  </div>
                </div>
              </div>

              {/* ── Right column ──────────────────────────────────────── */}
              <div className="lancamento-col">
                {/* Sacado / Portador / Conta Fin / NF / Série */}
                <div className="lancamento-form-grid2">
                  <span className="lancamento-lbl">Sacado:</span>
                  <div className="lancamento-combo-group" data-sacado-codigo={lancSacadoCodigo}>
                    <SearchableSelect
                      options={lancSacadoOptions.length > 0 ? lancSacadoOptions : [{ value: '', label: 'Digite ao menos 3 letras...' }]}
                      value={lancSacadoValue}
                      onChange={(v) => {
                        setLancSacadoValue(v);
                        const found = lancSacadoRawRef.current.find(
                          (c: any) => `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}` === v,
                        );
                        setLancSacadoNome(found ? String(found.nome_Fantasia ?? found.razao_Social ?? '') : '');
                        setLancSacadoCodigo(found ? String(found.codigo ?? '') : '');
                        setLancSacadoTipo(found ? String(found.tipo ?? '').toUpperCase() : '');
                        // Preenche Conta Financeira a partir de conta_Financeira do sacado
                        const contaFinanceira = found ? Number(found.conta_Financeira ?? 0) : 0;
                        if (contaFinanceira > 0) {
                          const contaMatch = lancContasFinanceiras.find((c) => c.num_Conta === contaFinanceira);
                          setLancContaFinValue(String(contaFinanceira));
                          setLancContaFinDescricao(contaMatch ? contaMatch.descricao_Conta : '');
                        } else {
                          setLancContaFinValue('');
                          setLancContaFinDescricao('');
                        }
                      }}
                      enableSearch
                      searchPlaceholder="Digite ao menos 3 letras..."
                      placeholder="Selecione..."
                      displayValue={lancSacadoNome || undefined}
                      onSearchInputChange={handleLancSacadoSearch}
                    />
                    <input
                      className="lancamento-inp lancamento-inp--tipo"
                      readOnly
                      value={
                        lancSacadoTipo === 'C' ? 'Cliente'
                          : lancSacadoTipo === 'F' ? 'Fornecedor'
                            : lancSacadoTipo || ''
                      }
                      aria-label="Tipo do sacado"
                      tabIndex={-1}
                    />
                  </div>

                  <span className="lancamento-lbl">Portador:</span>
                  <div className="lancamento-combo-group">
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...lancPortadores.map((p) => ({ value: String(p.codigo_Portador), label: p.nome_Banco })),
                      ]}
                      value={lancPortadorValue}
                      onChange={(v) => {
                        setLancPortadorValue(v);
                        setLancPortadorCodigo(v);
                      }}
                      placeholder="Selecione..."
                      listHeader={
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8 }}>
                          <span>Nome Banco</span>
                          <span style={{ textAlign: 'right' }}>Portador</span>
                        </div>
                      }
                      renderOption={(opt) => {
                        if (!opt.value) return <span>{opt.label}</span>;
                        const p = lancPortadores.find((x) => String(x.codigo_Portador) === opt.value);
                        return (
                          <span className="searchable-select__col-row" style={{ gridTemplateColumns: '1fr 72px' }}>
                            <span>{p?.nome_Banco ?? opt.label}</span>
                            <span style={{ textAlign: 'right', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{p?.codigo_Portador}</span>
                          </span>
                        );
                      }}
                    />
                    <input
                      className="lancamento-inp lancamento-inp--sm"
                      readOnly
                      value={lancPortadorCodigo}
                      aria-label="Código portador"
                      tabIndex={-1}
                    />
                  </div>

                  <span className="lancamento-lbl">Conta Fin.:</span>
                  <div className="lancamento-combo-group">
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Selecione...' },
                        ...lancContasFinanceiras.map((c) => ({ value: String(c.num_Conta), label: c.codigo_Conta })),
                      ]}
                      value={lancContaFinValue}
                      onChange={(v) => {
                        setLancContaFinValue(v);
                        const found = lancContasFinanceiras.find((c) => String(c.num_Conta) === v);
                        setLancContaFinDescricao(found ? found.descricao_Conta : '');
                      }}
                      placeholder="Selecione..."
                      listHeader={
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                          <span>Código</span>
                          <span>Descrição</span>
                        </div>
                      }
                      renderOption={(opt) => {
                        if (!opt.value) return <span>{opt.label}</span>;
                        const c = lancContasFinanceiras.find((x) => String(x.num_Conta) === opt.value);
                        return (
                          <span className="searchable-select__col-row" style={{ gridTemplateColumns: '80px 1fr' }}>
                            <span>{c?.codigo_Conta ?? opt.label}</span>
                            <span>{c?.descricao_Conta}</span>
                          </span>
                        );
                      }}
                    />
                    <input
                      className="lancamento-inp lancamento-inp--desc"
                      readOnly
                      value={lancContaFinDescricao}
                      aria-label="Descrição conta financeira"
                      tabIndex={-1}
                      title={lancContaFinDescricao}
                    />
                  </div>

                  <span className="lancamento-lbl">Nota Fiscal:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={lancNotaFiscalRef}
                      className="lancamento-inp lancamento-inp--nf"
                      value={lancNotaFiscal}
                      onChange={(e) => { setLancNotaFiscal(e.target.value); setLancNotaStatus('idle'); setLancNotaMsg(''); }}
                      onBlur={() => void handleValidateNota()}
                    />
                    {lancNotaStatus === 'ok' && <IoCheckmarkCircleOutline size={16} style={{ color: '#4caf50', flexShrink: 0 }} />}
                    {lancNotaStatus === 'error' && <IoCloseCircleOutline size={16} style={{ color: '#f44336', flexShrink: 0 }} title={lancNotaMsg} />}
                  </div>

                  <span className="lancamento-lbl">Série:</span>
                  <input
                    className="lancamento-inp"
                    style={{ maxWidth: 60 }}
                    value={lancSerie}
                    onChange={(e) => { setLancSerie(e.target.value); setLancNotaStatus('idle'); setLancNotaMsg(''); }}
                    onBlur={() => void handleValidateNota()}
                  />
                </div>

                {/* Descrição */}
                <div className="lancamento-textarea-wrap">
                  <span className="lancamento-lbl" style={{ textAlign: 'left' }}>Descrição:</span>
                  <textarea
                    className="lancamento-textarea"
                    value={lancDescricao}
                    onChange={(e) => setLancDescricao(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Justificativa */}
                <div className="lancamento-textarea-wrap">
                  <span className="lancamento-lbl" style={{ textAlign: 'left' }}>Justificativa da alteração:</span>
                  <textarea
                    className="lancamento-textarea"
                    value={lancJustificativa}
                    onChange={(e) => setLancJustificativa(e.target.value)}
                    rows={3}
                    disabled={!lancJustificativaEnabled}
                  />
                  <div className="lancamento-textarea-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto', minWidth: 90, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                    >
                      Ocorrências
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto', minWidth: 90, height: 34, fontSize: '0.78rem', padding: '0 12px' }}
                    >
                      Abatimentos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="lancamento-modal-footer">
            <div className="lancamento-parcelas-row">
              <input
                type="checkbox"
                id="lanc-parcelas-chk"
                checked={lancParcelas}
                onChange={(e) => setLancParcelas(e.target.checked)}
                style={{ width: '0.85rem', height: '0.85rem', accentColor: 'var(--color-primary)', cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="lanc-parcelas-chk" className="lancamento-lbl" style={{ textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Parcelas:
              </label>
              <input
                className="lancamento-inp"
                style={{ width: 50, flexShrink: 0 }}
                value={lancQtdParcelas}
                onChange={(e) => setLancQtdParcelas(e.target.value)}
                disabled={!lancParcelas}
              />
              <span className="lancamento-parcelas-hint">Quantidade de parcelas a gerar fora o lançamento atual</span>
            </div>
            <div className="lancamento-modal-actions">
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={handleOkClick}
                disabled={lancSaving}
              >
                OK
              </button>
            </div>
          </footer>
        </article>
      </section>
      {lancConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar lançamento">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Lançamento</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja realmente realizar o lançamento deste documento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setLancConfirmOpen(false)}
                disabled={lancSaving}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleConfirmLancamento()}
                disabled={lancSaving}
              >
                {lancSaving ? 'Salvando...' : 'Sim'}
              </button>
            </div>
          </article>
        </section>
      )}
    </>
  );
});

export function ContasReceberPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<ContaReceber[]>([]);

  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [numNf, setNumNf] = useState('');
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('venc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const [saldoDebito, setSaldoDebito] = useState<number | null>(null);
  const [saldoAdiantamento, setSaldoAdiantamento] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('contas-receber');
  const [notaDebitoRows, setNotaDebitoRows] = useState<NotaDebito[]>([]);

  const [abatimentoModalOpen, setAbatimentoModalOpen] = useState(false);
  const [abatimentoRegistro, setAbatimentoRegistro] = useState<ContaReceber | null>(null);
  const [abatimentoCabecalho, setAbatimentoCabecalho] = useState<EstornoAbatCabecalho | null>(null);
  const [abatimentoRows, setAbatimentoRows] = useState<AbatimentoItem[]>([]);
  const [abatimentoLoading, setAbatimentoLoading] = useState(false);
  const [abatimentoSelectedLanc, setAbatimentoSelectedLanc] = useState<number | null>(null);
  const [valorAbater, setValorAbater] = useState('');
  const [abatimentoConfirmOpen, setAbatimentoConfirmOpen] = useState(false);
  const [abatimentoExecutando, setAbatimentoExecutando] = useState(false);

  const [estornoModalOpen, setEstornoModalOpen] = useState(false);
  const [estornoCabecalho, setEstornoCabecalho] = useState<EstornoAbatCabecalho | null>(null);
  const [estornoRows, setEstornoRows] = useState<EstornoAbatItem[]>([]);
  const [estornoLoading, setEstornoLoading] = useState(false);
  const [estornoSelectedIdx, setEstornoSelectedIdx] = useState<number | null>(null);
  const [valorEstornar, setValorEstornar] = useState('');
  const [estornoConfirmOpen, setEstornoConfirmOpen] = useState(false);
  const [estornoExecutando, setEstornoExecutando] = useState(false);

  const [adiantamentosModalOpen, setAdiantamentosModalOpen] = useState(false);
  const [adiantamentosTab, setAdiantamentosTab] = useState<'A' | 'E'>('A');
  const [adiantamentosAbertos, setAdiantamentosAbertos] = useState<AdiantamentoItem[]>([]);
  const [adiantamentosEncerrados, setAdiantamentosEncerrados] = useState<AdiantamentoItem[]>([]);
  const [adiantamentosLoading, setAdiantamentosLoading] = useState(false);
  const [adiantamentosAbertosSelectedIdx, setAdiantamentosAbertosSelectedIdx] = useState<number | null>(null);
  const [adiantamentosEncerradosSelectedIdx, setAdiantamentosEncerradosSelectedIdx] = useState<number | null>(null);
  const [adiantamentosExecutando, setAdiantamentosExecutando] = useState(false);
  const [encerrarConfirmOpen, setEncerrarConfirmOpen] = useState(false);
  const [reabrirConfirmOpen, setReabrirConfirmOpen] = useState(false);
  const [estornarDevolucaoConfirmOpen, setEstornarDevolucaoConfirmOpen] = useState(false);
  const [devolverData, setDevolverData] = useState(formatToday());
  const [adiantamentosCedente, setAdiantamentosCedente] = useState<{ codCedente: string | number; tipoCedente: string } | null>(null);

  const [cancelarStep1Open, setCancelarStep1Open] = useState(false);
  const [cancelarStep2Open, setCancelarStep2Open] = useState(false);
  const [cancelarExecutando, setCancelarExecutando] = useState(false);
  const [cancelarIsLote, setCancelarIsLote] = useState(false);
  const [cancelarDescExclusao, setCancelarDescExclusao] = useState('');

  const [consultaAlterarOpen, setConsultaAlterarOpen] = useState(false);
  const [consultaAlterarMode, setConsultaAlterarMode] = useState<ConsultaAlterarMode>('consulta');
  const [consultaAlterarNumLanc, setConsultaAlterarNumLanc] = useState<number | null>(null);
  const [consultaAlterarSacadoNome, setConsultaAlterarSacadoNome] = useState('');

  const [dataBaixaLote, setDataBaixaLote] = useState('');
  const [baixarConfirmOpen, setBaixarConfirmOpen] = useState(false);
  const [baixarExecutando, setBaixarExecutando] = useState(false);
  const [baixaResultOpen, setBaixaResultOpen] = useState(false);
  const [baixaResultMsg, setBaixaResultMsg] = useState('');
  const [baixaResultSuccess, setBaixaResultSuccess] = useState(false);

  const [lancModalOpen, setLancModalOpen] = useState(false);

  const [sacadoValue, setSacadoValue] = useState('');
  const [sacadoNome, setSacadoNome] = useState('');
  const [sacadoCodigo, setSacadoCodigo] = useState<string>('');
  const [sacadoTipo, setSacadoTipo] = useState<string>('');
  const [sacadoOptions, setSacadoOptions] = useState<SearchableSelectOption[]>([]);
  const sacadoRawRef = useRef<any[]>([]);
  const sacadoTimerRef = useRef<number | null>(null);

  const initialLoadRef = useRef(false);

  const carregarContas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listContasReceberCall(baseUrl, token, {
        codigoEmpresa,
        dataInicio: toApiDateFormat(dataInicio),
        dataFim: toApiDateFormat(dataFim),
        numNf: numNf.trim(),
        ...(sacadoCodigo ? { codCedente: sacadoCodigo, tipoCedente: sacadoTipo } : {}),
      });

      if (!resp.succeeded) {
        setRows([]);
        showToast('Não foi possível carregar as contas a receber.', 'error');
        return;
      }

      setRows(getRows(resp.jsonBody || resp.data));
      setSelectedRows(new Set());

      // Busca saldo para abater quando sacado selecionado
      if (sacadoCodigo) {
        try {
          const saldoResp = await contasReceberSaldoAbaterCall(baseUrl, token, {
            codigoEmpresa,
            codigoCedente: sacadoCodigo,
            tipoCedente: sacadoTipo,
          });
          if (saldoResp.succeeded) {
            const body = saldoResp.jsonBody ?? saldoResp.data;
            const saldo = body?.saldoAbater ?? body;
            setSaldoDebito(saldo?.debito ?? null);
            setSaldoAdiantamento(saldo?.adiantamento ?? null);
          } else {
            setSaldoDebito(null);
            setSaldoAdiantamento(null);
          }
        } catch {
          setSaldoDebito(null);
          setSaldoAdiantamento(null);
        }
      } else {
        setSaldoDebito(null);
        setSaldoAdiantamento(null);
      }

      // Busca Notas de Crédito/Débito para a guia Nota de Débito
      try {
        const ncResp = await listContasReceberNCCall(baseUrl, token, {
          codigoEmpresa,
          ...(sacadoCodigo ? { codCedente: sacadoCodigo, tipoCedente: sacadoTipo } : {}),
        });
        if (ncResp.succeeded) {
          setNotaDebitoRows(getRows(ncResp.jsonBody ?? ncResp.data));
        } else {
          setNotaDebitoRows([]);
        }
      } catch {
        setNotaDebitoRows([]);
      }
    } catch (error: any) {
      setRows([]);
      showToast(error?.message || 'Erro ao carregar contas a receber.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numNf, sacadoCodigo, sacadoTipo, showToast]);

  const carregarSacados = useCallback(async (term: string) => {
    const query = term.trim();
    if (query.length < 3) {
      sacadoRawRef.current = [];
      setSacadoOptions([{ value: '', label: 'Digite ao menos 3 letras...' }]);
      return;
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await obterClientesFornecedoresCall(baseUrl, token);
      if (!res.succeeded) {
        sacadoRawRef.current = [];
        setSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
        return;
      }
      const body = res.jsonBody ?? res.data;
      const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const queryNorm = normalizeText(query);
      const filtrados = lista.filter((c: any) => {
        const nome = normalizeText(String(c.nome_Fantasia ?? c.razao_Social ?? ''));
        const doc = normalizeText(String(c.num_CGC ?? ''));
        return nome.includes(queryNorm) || doc.includes(queryNorm);
      });
      sacadoRawRef.current = filtrados;
      setSacadoOptions([
        { value: '', label: filtrados.length > 0 ? 'Selecione...' : 'Nenhum encontrado' },
        ...filtrados.map((c: any) => ({
          value: `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}`,
          label: String(c.nome_Fantasia ?? c.razao_Social ?? ''),
        })),
      ]);
    } catch {
      sacadoRawRef.current = [];
      setSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
    }
  }, []);

  const handleSacadoSearch = useCallback((query: string) => {
    if (sacadoTimerRef.current != null) window.clearTimeout(sacadoTimerRef.current);
    sacadoTimerRef.current = window.setTimeout(() => { void carregarSacados(query); }, 250);
  }, [carregarSacados]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio && !temDataFim) {
      nextErrors.dataFim = 'Informe a Data fim.';
    }
    if (!temDataInicio && temDataFim) {
      nextErrors.dataInicio = 'Informe a Data início.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregarContas();
  }, [carregarContas, dataFim, dataInicio]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarContas();
  }, [carregarContas]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'prev') {
        comparison = parseDateForSort(a.data_Prev) - parseDateForSort(b.data_Prev);
      } else if (sortField === 'venc') {
        comparison = parseDateForSort(a.data_Vencimento) - parseDateForSort(b.data_Vencimento);
      } else if (sortField === 'tipoDoc') {
        comparison = collator.compare(String(a.tipoDoc ?? ''), String(b.tipoDoc ?? ''));
      } else if (sortField === 'numero') {
        comparison = collator.compare(String(a.num_Documento ?? ''), String(b.num_Documento ?? ''));
      } else if (sortField === 'emissao') {
        comparison = parseDateForSort(a.data_Emissao) - parseDateForSort(b.data_Emissao);
      } else if (sortField === 'valor') {
        comparison = (a.valor_Saldo ?? 0) - (b.valor_Saldo ?? 0);
      } else if (sortField === 'sacado') {
        comparison = collator.compare(String(a.nome_Fantasia ?? ''), String(b.nome_Fantasia ?? ''));
      } else if (sortField === 'situacao') {
        comparison = collator.compare(String(a.situacao ?? ''), String(b.situacao ?? ''));
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortField, sortDirection]);

  const rowsFiltradas = useMemo(() => {
    let result = filterListByTerm(rowsOrdenadas, searchTerm);
    if (sacadoNome.trim()) {
      const norm = normalizeText(sacadoNome.trim());
      result = result.filter((row) => normalizeText(String(row.nome_Fantasia ?? '')).includes(norm));
    }
    return result;
  }, [rowsOrdenadas, searchTerm, sacadoNome]);

  const totalRegistros = rowsFiltradas.length;

  // Apenas registros visíveis que têm num_Lanc válido
  const allFilteredWithLanc = useMemo(
    () => rowsFiltradas.filter((r): r is ContaReceber & { num_Lanc: number } => r.num_Lanc != null),
    [rowsFiltradas],
  );
  const allSelected =
    allFilteredWithLanc.length > 0 && allFilteredWithLanc.every((r) => selectedRows.has(r.num_Lanc));
  const someSelected = !allSelected && allFilteredWithLanc.some((r) => selectedRows.has(r.num_Lanc));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredWithLanc.forEach((r) => next.delete(r.num_Lanc));
      } else {
        allFilteredWithLanc.forEach((r) => next.add(r.num_Lanc));
      }
      return next;
    });
  }, [allSelected, allFilteredWithLanc]);

  // Lista para envio à API: { CodigoEmpresa, NumLanc, TipoDoc }
  const selectedList = useMemo(() => {
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    return rows
      .filter((row) => row.num_Lanc != null && selectedRows.has(row.num_Lanc))
      .map((row) => ({
        CodigoEmpresa: Number(codigoEmpresa),
        NumLanc: row.num_Lanc as number,
        TipoDoc: row.tipo_Documento ?? 0,
      }));
  }, [rows, selectedRows]);

  // Suprime aviso de variável não usada durante desenvolvimento
  // selectedList é usado em handleCancelarClick e executarCancelar

  const handleAbrirAbatimento = useCallback(async () => {
    if (selectedRows.size == 0) {
      showToast('Selecione ao menos um registro para abatimento!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro para abatimento!', 'error');
      return;
    }

    const numLanc = Array.from(selectedRows)[0];
    const registro = rows.find((r) => r.num_Lanc === numLanc) ?? null;
    if (!registro) return;

    setAbatimentoRegistro(registro);
    setAbatimentoCabecalho(null);
    setAbatimentoRows([]);
    setAbatimentoSelectedLanc(null);
    setValorAbater('');
    setAbatimentoModalOpen(true);

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setAbatimentoLoading(true);
    try {
      const [cabResp, abatResp] = await Promise.all([
        cabecalhoEstornoAbatCall(baseUrl, token, { codigoEmpresa, numLanc }),
        listContasReceberAbatimentoCall(baseUrl, token, {
          codigoEmpresa,
          codigoCedente: registro.codigo_Cedente ?? '',
          tipoCedente: String(registro.tipo_Cedente ?? ''),
        }),
      ]);
      if (cabResp.succeeded) {
        setAbatimentoCabecalho(cabResp.jsonBody ?? cabResp.data ?? null);
      }
      if (abatResp.succeeded) {
        const body = abatResp.jsonBody ?? abatResp.data;
        const items: AbatimentoItem[] = Array.isArray(body?.abatimento)
          ? body.abatimento
          : getRows(body);
        setAbatimentoRows(items);
      } else {
        setAbatimentoRows([]);
      }
    } catch {
      setAbatimentoRows([]);
    } finally {
      setAbatimentoLoading(false);
    }
  }, [selectedRows, rows, showToast]);

  const handleConfirmarAbatimento = useCallback(() => {
    if (abatimentoSelectedLanc == null) {
      showToast('Selecione um registro para abatimento!', 'error');
      return;
    }
    const valorStr = valorAbater.trim().replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    if (isNaN(valorNum) || valorNum <= 0) {
      showToast('O valor a abater deve ser maior que zero.', 'error');
      return;
    }
    setAbatimentoConfirmOpen(true);
  }, [abatimentoSelectedLanc, valorAbater, showToast]);

  const handleExecutarAbatimento = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !abatimentoRegistro || abatimentoSelectedLanc == null) return;

    const valorStr = valorAbater.trim().replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    const valorSaldo = abatimentoCabecalho?.valor_Receber ?? abatimentoRegistro.valor_Saldo ?? 0;
    const valorCalculado = abatimentoCabecalho?.valor_Receber_Calc ?? (valorSaldo - (abatimentoRegistro.valor_Abatido ?? 0));

    setAbatimentoExecutando(true);
    setAbatimentoConfirmOpen(false);
    try {
      const resp = await abatimentoDocCall(baseUrl, token, {
        CodigoEmpresa: Number(codigoEmpresa),
        NumLanc: abatimentoRegistro.num_Lanc as number,
        NumLancAbatimento: abatimentoSelectedLanc,
        ValorAbatimento: valorNum,
        ValorSaldo: valorSaldo,
        ValorCalculado: valorCalculado,
        Usuario: usuario,
      });
      if (resp.succeeded) {
        showToast('Abatimento realizado com sucesso!', 'success');
        setAbatimentoSelectedLanc(null);
        setValorAbater('');
        void carregarContas();
        setAbatimentoLoading(true);
        try {
          const abatResp = await listContasReceberAbatimentoCall(baseUrl, token, {
            codigoEmpresa,
            codigoCedente: abatimentoRegistro.codigo_Cedente ?? '',
            tipoCedente: String(abatimentoRegistro.tipo_Cedente ?? ''),
          });
          if (abatResp.succeeded) {
            const body = abatResp.jsonBody ?? abatResp.data;
            const items: AbatimentoItem[] = Array.isArray(body?.abatimento)
              ? body.abatimento
              : getRows(body);
            setAbatimentoRows(items);
          } else {
            setAbatimentoRows([]);
          }
        } catch {
          setAbatimentoRows([]);
        } finally {
          setAbatimentoLoading(false);
        }
      } else {
        showToast('Erro ao realizar abatimento.', 'error');
      }
    } catch {
      showToast('Erro ao realizar abatimento.', 'error');
    } finally {
      setAbatimentoExecutando(false);
    }
  }, [abatimentoRegistro, abatimentoCabecalho, abatimentoSelectedLanc, valorAbater, showToast, carregarContas]);

  const handleAbrirEstorno = useCallback(async () => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro para estorno!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro para estorno!', 'error');
      return;
    }

    const numLanc = Array.from(selectedRows)[0];
    const registro = rows.find((r) => r.num_Lanc === numLanc) ?? null;
    if (!registro) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setEstornoCabecalho(null);
    setEstornoRows([]);
    setEstornoSelectedIdx(null);
    setValorEstornar('');
    setEstornoModalOpen(true);
    setEstornoLoading(true);

    try {
      const [cabResp, itensResp] = await Promise.all([
        cabecalhoEstornoAbatCall(baseUrl, token, { codigoEmpresa, numLanc }),
        listContasReceberEstornoAbatNCCall(baseUrl, token, {
          codigoEmpresa,
          codCedente: registro.codigo_Cedente ?? '',
          tipoCedente: String(registro.tipo_Cedente ?? ''),
          numLancPrincipal: numLanc,
        }),
      ]);

      if (cabResp.succeeded) {
        const body = cabResp.jsonBody ?? cabResp.data;
        setEstornoCabecalho(body ?? null);
      }

      if (itensResp.succeeded) {
        const body = itensResp.jsonBody ?? itensResp.data;
        setEstornoRows(Array.isArray(body) ? body : getRows(body));
      } else {
        setEstornoRows([]);
      }
    } catch {
      setEstornoRows([]);
    } finally {
      setEstornoLoading(false);
    }
  }, [selectedRows, rows, showToast]);

  const handleConfirmarEstorno = useCallback(() => {
    if (estornoSelectedIdx == null) {
      showToast('Selecione um registro para estorno!', 'error');
      return;
    }
    setEstornoConfirmOpen(true);
  }, [estornoSelectedIdx, showToast]);

  const handleExecutarEstorno = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa || !estornoCabecalho || estornoSelectedIdx == null) return;

    const selectedRow = estornoRows[estornoSelectedIdx];
    const digits = valorEstornar.replace(/\D/g, '');
    const valorNum = digits ? parseInt(digits, 10) / 100 : 0;

    setEstornoExecutando(true);
    setEstornoConfirmOpen(false);
    try {
      const resp = await estornarDocumentoAbatCall(baseUrl, token, {
        CodigoEmpresa: Number(codigoEmpresa),
        NumLancOriginal: estornoCabecalho.num_Lanc as number,
        NumLancAbatimento: selectedRow.num_Lanc_Abatimento as number,
        ValorEstornar: valorNum,
        ValorAbatido: selectedRow.valor_Abatido ?? 0,
      });
      if (resp.succeeded) {
        showToast('Estorno realizado com sucesso!', 'success');
        setEstornoSelectedIdx(null);
        setValorEstornar('');
        void carregarContas();
        setEstornoLoading(true);
        try {
          const numLancPrincipal = estornoCabecalho.num_Lanc;
          if (numLancPrincipal != null) {
            const itensResp = await listContasReceberEstornoAbatNCCall(baseUrl, token, {
              codigoEmpresa,
              codCedente: estornoCabecalho.codigo_Cedente ?? '',
              tipoCedente: String(estornoCabecalho.tipo_Cedente ?? ''),
              numLancPrincipal,
            });
            if (itensResp.succeeded) {
              const body = itensResp.jsonBody ?? itensResp.data;
              setEstornoRows(Array.isArray(body) ? body : getRows(body));
            } else {
              setEstornoRows([]);
            }
          }
        } catch {
          setEstornoRows([]);
        } finally {
          setEstornoLoading(false);
        }
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao realizar estorno.'), 'error');
      }
    } catch {
      showToast('Erro ao realizar estorno.', 'error');
    } finally {
      setEstornoExecutando(false);
    }
  }, [estornoCabecalho, estornoSelectedIdx, valorEstornar, estornoRows, showToast, carregarContas]);

  const handleAbrirAdiantamentos = useCallback(async () => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro!', 'error');
      return;
    }
    const numLanc = Array.from(selectedRows)[0];
    const registro = rows.find((r) => r.num_Lanc === numLanc) ?? null;
    if (!registro) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setAdiantamentosTab('A');
    setAdiantamentosAbertos([]);
    setAdiantamentosEncerrados([]);
    setAdiantamentosAbertosSelectedIdx(null);
    setAdiantamentosEncerradosSelectedIdx(null);
    setAdiantamentosModalOpen(true);
    setAdiantamentosLoading(true);

    try {
      const codCedente = registro.codigo_Cedente ?? '';
      const tipoCedente = String(registro.tipo_Cedente ?? '');
      setAdiantamentosCedente({ codCedente, tipoCedente });
      const [abertosResp, encerradosResp] = await Promise.all([
        adiantamentosRecebidosCall(baseUrl, token, { codigoEmpresa, codigoCedente: codCedente, tipoCedente, tipoAdiantamento: 'A' }),
        adiantamentosRecebidosCall(baseUrl, token, { codigoEmpresa, codigoCedente: codCedente, tipoCedente, tipoAdiantamento: 'E' }),
      ]);
      if (abertosResp.succeeded) {
        const body = abertosResp.jsonBody ?? abertosResp.data;
        setAdiantamentosAbertos(Array.isArray(body) ? body : getRows(body));
      } else {
        setAdiantamentosAbertos([]);
      }
      if (encerradosResp.succeeded) {
        const body = encerradosResp.jsonBody ?? encerradosResp.data;
        setAdiantamentosEncerrados(Array.isArray(body) ? body : getRows(body));
      } else {
        setAdiantamentosEncerrados([]);
      }
    } catch {
      setAdiantamentosAbertos([]);
      setAdiantamentosEncerrados([]);
    } finally {
      setAdiantamentosLoading(false);
    }
  }, [selectedRows, rows, showToast]);

  const recarregarAdiantamentos = useCallback(async () => {
    if (!adiantamentosCedente) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setAdiantamentosLoading(true);
    try {
      const [abertosResp, encerradosResp] = await Promise.all([
        adiantamentosRecebidosCall(baseUrl, token, { codigoEmpresa, codigoCedente: adiantamentosCedente.codCedente, tipoCedente: adiantamentosCedente.tipoCedente, tipoAdiantamento: 'A' }),
        adiantamentosRecebidosCall(baseUrl, token, { codigoEmpresa, codigoCedente: adiantamentosCedente.codCedente, tipoCedente: adiantamentosCedente.tipoCedente, tipoAdiantamento: 'E' }),
      ]);
      if (abertosResp.succeeded) {
        const body = abertosResp.jsonBody ?? abertosResp.data;
        setAdiantamentosAbertos(Array.isArray(body) ? body : getRows(body));
      } else {
        setAdiantamentosAbertos([]);
      }
      if (encerradosResp.succeeded) {
        const body = encerradosResp.jsonBody ?? encerradosResp.data;
        setAdiantamentosEncerrados(Array.isArray(body) ? body : getRows(body));
      } else {
        setAdiantamentosEncerrados([]);
      }
    } catch {
      setAdiantamentosAbertos([]);
      setAdiantamentosEncerrados([]);
    } finally {
      setAdiantamentosLoading(false);
    }
  }, [adiantamentosCedente]);

  const handleEncerrar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa || adiantamentosAbertosSelectedIdx == null) return;

    const item = adiantamentosAbertos[adiantamentosAbertosSelectedIdx];
    if (!item?.num_Lanc) return;

    setEncerrarConfirmOpen(false);
    setAdiantamentosExecutando(true);
    try {
      const resp = await encerrarReabrirAdiantamentoCall(baseUrl, token, {
        codigoEmpresa,
        numLanc: item.num_Lanc,
        encerrar: true,
        temDevolv: false,
      });
      if (resp.succeeded) {
        showToast('Documento encerrado com sucesso!', 'success');
        setAdiantamentosAbertosSelectedIdx(null);
        await recarregarAdiantamentos();
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao encerrar documento.'), 'error');
      }
    } catch {
      showToast('Erro ao encerrar documento.', 'error');
    } finally {
      setAdiantamentosExecutando(false);
    }
  }, [adiantamentosAbertosSelectedIdx, adiantamentosAbertos, showToast, recarregarAdiantamentos]);

  const handleReabrir = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa || adiantamentosEncerradosSelectedIdx == null) return;

    const item = adiantamentosEncerrados[adiantamentosEncerradosSelectedIdx];
    if (!item?.num_Lanc) return;

    setReabrirConfirmOpen(false);
    setAdiantamentosExecutando(true);
    try {
      const resp = await encerrarReabrirAdiantamentoCall(baseUrl, token, {
        codigoEmpresa,
        numLanc: item.num_Lanc,
        encerrar: false,
        temDevolv: item.temDev === true,
      });
      if (resp.succeeded) {
        showToast('Documento reaberto com sucesso!', 'success');
        setAdiantamentosEncerradosSelectedIdx(null);
        await recarregarAdiantamentos();
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao reabrir documento.'), 'error');
      }
    } catch {
      showToast('Erro ao reabrir documento.', 'error');
    } finally {
      setAdiantamentosExecutando(false);
    }
  }, [adiantamentosEncerradosSelectedIdx, adiantamentosEncerrados, showToast, recarregarAdiantamentos]);

  const handleDevolver = useCallback(async () => {
    if (adiantamentosAbertosSelectedIdx == null) {
      showToast('Selecione um registro para devolver!', 'error');
      return;
    }
    const item = adiantamentosAbertos[adiantamentosAbertosSelectedIdx];
    if (!item?.num_Lanc) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setAdiantamentosExecutando(true);
    try {
      const resp = await devolverSaldoCall(baseUrl, token, {
        codigoEmpresa,
        numLanc: item.num_Lanc,
        dataDevolucao: devolverData,
        usuario,
        devolver: true,
        temDevolv: false,
      });
      if (resp.succeeded) {
        showToast('Devolução realizada com sucesso!', 'success');
        setAdiantamentosAbertosSelectedIdx(null);
        await recarregarAdiantamentos();
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao realizar devolução.'), 'error');
      }
    } catch {
      showToast('Erro ao realizar devolução.', 'error');
    } finally {
      setAdiantamentosExecutando(false);
    }
  }, [adiantamentosAbertosSelectedIdx, adiantamentosAbertos, devolverData, showToast, recarregarAdiantamentos]);

  const handleEstornarDevolucao = useCallback(async () => {
    if (adiantamentosEncerradosSelectedIdx == null) {
      showToast('Selecione um registro para estornar a devolução!', 'error');
      return;
    }
    const item = adiantamentosEncerrados[adiantamentosEncerradosSelectedIdx];
    if (!item?.num_Lanc) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setEstornarDevolucaoConfirmOpen(false);
    setAdiantamentosExecutando(true);
    try {
      const resp = await devolverSaldoCall(baseUrl, token, {
        codigoEmpresa,
        numLanc: item.num_Lanc,
        dataDevolucao: devolverData,
        usuario,
        devolver: false,
        temDevolv: item.temDev === true,
      });
      if (resp.succeeded) {
        showToast('Devolução estornada com sucesso!', 'success');
        setAdiantamentosEncerradosSelectedIdx(null);
        await recarregarAdiantamentos();
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao estornar devolução.'), 'error');
      }
    } catch {
      showToast('Erro ao estornar devolução.', 'error');
    } finally {
      setAdiantamentosExecutando(false);
    }
  }, [adiantamentosEncerradosSelectedIdx, adiantamentosEncerrados, devolverData, showToast, recarregarAdiantamentos]);

  const executarCancelar = useCallback(async (excluirOutros: boolean) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setCancelarExecutando(true);
    try {
      const resp = await cancelarContasReceberCall(baseUrl, token, {
        codigoEmpresa,
        docs: selectedList,
        cancelaLote: cancelarIsLote,
        excluirOutros,
        descricao: cancelarDescExclusao,
        usuario,
      });
      if (resp.succeeded) {
        showToast('Cancelamento realizado com sucesso!', 'success');
        setSelectedRows(new Set());
        void carregarContas();
      } else {
        showToast(getApiErrorMessage(resp, 'Erro ao cancelar.'), 'error');
      }
    } catch {
      showToast('Erro ao cancelar.', 'error');
    } finally {
      setCancelarExecutando(false);
    }
  }, [selectedList, cancelarIsLote, cancelarDescExclusao, showToast, carregarContas]);

  const handleCancelarClick = useCallback(() => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro para cancelar!', 'error');
      return;
    }
    const isLote = selectedRows.size > 1;
    setCancelarIsLote(isLote);
    setCancelarDescExclusao(isLote ? 'Exclusão em lote' : 'Exclusão');
    setCancelarStep1Open(true);
  }, [selectedRows, showToast]);

  const handleCancelarStep1Confirm = useCallback(() => {
    setCancelarStep1Open(false);
    if (cancelarIsLote) {
      const hasOutros = selectedList.some((doc) => doc.TipoDoc !== 5);
      if (hasOutros) {
        setCancelarStep2Open(true);
        return;
      }
    }
    void executarCancelar(false);
  }, [cancelarIsLote, selectedList, executarCancelar]);

  const handleCancelarStep2Confirm = useCallback(() => {
    setCancelarStep2Open(false);
    void executarCancelar(true);
  }, [executarCancelar]);

  const handleAbrirConsulta = useCallback(() => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro para consultar!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro para consultar!', 'error');
      return;
    }
    const numLancC = Array.from(selectedRows)[0];
    const regC = rows.find((r) => r.num_Lanc === numLancC);
    setConsultaAlterarSacadoNome(regC?.nome_Fantasia ?? '');
    setConsultaAlterarNumLanc(numLancC);
    setConsultaAlterarMode('consulta');
    setConsultaAlterarOpen(true);
  }, [selectedRows, rows, showToast]);

  const handleAbrirAlterar = useCallback(() => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro para alterar!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro para alterar!', 'error');
      return;
    }
    const numLancA = Array.from(selectedRows)[0];
    const regA = rows.find((r) => r.num_Lanc === numLancA);
    setConsultaAlterarSacadoNome(regA?.nome_Fantasia ?? '');
    setConsultaAlterarNumLanc(numLancA);
    setConsultaAlterarMode('alterar');
    setConsultaAlterarOpen(true);
  }, [selectedRows, rows, showToast]);

  const handleBaixarClick = useCallback(() => {
    if (selectedRows.size === 0) {
      showToast('Selecione ao menos um registro para baixar!', 'error');
      return;
    }
    if (selectedRows.size > 1 && !dataBaixaLote.trim()) {
      showToast('Informe uma data para baixa em lote!', 'error');
      return;
    }
    setBaixarConfirmOpen(true);
  }, [selectedRows, dataBaixaLote, showToast]);

  const handleExecutarBaixa = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    if (!baseUrl || !token || !codigoEmpresa) return;

    const dataParaApi = selectedRows.size > 1
      ? toApiDateFormat(dataBaixaLote)
      : dataBaixaLote.trim()
        ? toApiDateFormat(dataBaixaLote)
        : toApiDateFormat(formatToday());

    setBaixarExecutando(true);
    setBaixarConfirmOpen(false);
    try {
      const resp = await baixaContasReceberCall(baseUrl, token, {
        CodigoEmpresa: Number(codigoEmpresa),
        docs: selectedList,
        Usuario: usuario,
        TipoBaixa: 1,
        DataBaixaLote: dataParaApi,
      });
      if (resp.succeeded) {
        const body = resp.jsonBody ?? resp.data;
        const msg = String(body?.message ?? 'Baixa registrada com sucesso!');
        setSelectedRows(new Set());
        void carregarContas();
        setBaixaResultMsg(msg);
        setBaixaResultSuccess(true);
        setBaixaResultOpen(true);
      } else {
        const body = resp.jsonBody ?? resp.data;
        void carregarContas();
        setBaixaResultMsg(String(body?.message ?? 'Erro ao realizar a baixa.'));
        setBaixaResultSuccess(false);
        setBaixaResultOpen(true);
      }
    } catch {
      void carregarContas();
      setBaixaResultMsg('Erro ao realizar a baixa.');
      setBaixaResultSuccess(false);
      setBaixaResultOpen(true);
    } finally {
      setBaixarExecutando(false);
    }
  }, [selectedRows, selectedList, dataBaixaLote, carregarContas]);

  const toggleSelectRow = (numLanc: number | null | undefined) => {
    if (numLanc == null) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(numLanc)) {
        next.delete(numLanc);
      } else {
        next.add(numLanc);
      }
      return next;
    });
  };

  return (
    <main className="clientes-page list-layout-page contas-receber-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Contas a Receber</h1>
            <p>Consulta de títulos a receber.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel contas-receber-panel">
        <div className="clientes-panel__top list-layout-panel__top contas-receber-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalRegistros} encontrados</span>
          </div>

          <div className="list-layout-controls contas-receber-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Contas a Receber"
              placeholder="Pesquisar na lista"
              className="contas-receber-search"
            />

            <button
              className={`icon-button module-action-button${filtrosOpen ? ' module-action-button--primary' : ''}`}
              type="button"
              onClick={() => {
                setFiltroErrors({});
                setFiltrosOpen(true);
              }}
              title={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
              aria-label={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
            >
              <IoFilterOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarContas()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => setLancModalOpen(true)}
              title="Novo lançamento"
              aria-label="Novo lançamento"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        <AdvancedFiltersPanel
          open={filtrosOpen}
          onClose={() => {
            setFiltroErrors({});
            setFiltrosOpen(false);
          }}
          onApply={handleApplyFiltros}
          applyDisabled={loading}
        >
          <div className="list-layout-extra-filters contas-receber-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
              {filtroErrors.dataInicio ? (
                <small className="module-field-error">{filtroErrors.dataInicio}</small>
              ) : null}
            </label>

            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker value={dataFim} onChange={setDataFim} />
              {filtroErrors.dataFim ? (
                <small className="module-field-error">{filtroErrors.dataFim}</small>
              ) : null}
            </label>

            <label className="list-layout-field list-layout-field--lg">
              <span>Sacado</span>
              <SearchableSelect
                options={sacadoOptions.length > 0 ? sacadoOptions : [{ value: '', label: 'Digite ao menos 3 letras...' }]}
                value={sacadoValue}
                onChange={(v) => {
                  setSacadoValue(v);
                  const found = sacadoRawRef.current.find(
                    (c: any) => `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}` === v,
                  );
                  setSacadoNome(found ? String(found.nome_Fantasia ?? found.razao_Social ?? '') : '');
                  setSacadoCodigo(found ? String(found.codigo ?? '') : '');
                  setSacadoTipo(found ? String(found.tipo ?? '').toUpperCase() : '');
                }}
                enableSearch
                searchPlaceholder="Digite ao menos 3 letras para buscar..."
                placeholder="Todos"
                displayValue={sacadoNome || undefined}
                onSearchInputChange={handleSacadoSearch}
              />
            </label>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Num Nota</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input
                  value={numNf}
                  onChange={(event) => setNumNf(event.target.value)}
                  placeholder="Número da nota"
                />
                {numNf.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da nota"
                    title="Limpar"
                    onClick={() => setNumNf('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        </AdvancedFiltersPanel>

        {/* Barra Selecionar todas */}
        <div className={`contas-receber-select-all${activeTab !== 'contas-receber' ? ' contas-receber-select-all--disabled' : ''}`}>
          <label className="contas-receber-select-all__label">
            <span>Selecionar todas:</span>
            <input
              type="checkbox"
              className="contas-receber-select-all__checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              aria-label="Selecionar todas as contas"
              disabled={activeTab !== 'contas-receber'}
            />
          </label>
          {selectedRows.size > 0 && activeTab === 'contas-receber' && (
            <span className="contas-receber-select-all__count">
              {selectedRows.size} selecionado{selectedRows.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Navegação por guias */}
        <div className="contas-receber-tabs">
          <button
            type="button"
            className={`contas-receber-tab${activeTab === 'contas-receber' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setActiveTab('contas-receber')}
          >
            Contas a Receber
          </button>
          <button
            type="button"
            className={`contas-receber-tab${activeTab === 'nota-debito' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setActiveTab('nota-debito')}
          >
            Notas de Débito
          </button>
        </div>

        {activeTab === 'contas-receber' ? (
          <section className="module-table list-layout-table contas-receber-table">
            {loading ? (
              <p className="module-empty">Carregando contas a receber...</p>
            ) : rowsFiltradas.length === 0 ? (
              <p className="module-empty">Nenhum registro encontrado.</p>
            ) : (
              <>
                <div className="table-scroll module-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('prev')}>
                            Previsão <span>{getSortIndicator('prev')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('venc')}>
                            Venc. <span>{getSortIndicator('venc')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('tipoDoc')}>
                            Tipo Doc. <span>{getSortIndicator('tipoDoc')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('numero')}>
                            Número <span>{getSortIndicator('numero')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('emissao')}>
                            Emissão <span>{getSortIndicator('emissao')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('valor')}>
                            Valor Liq. <span>{getSortIndicator('valor')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('sacado')}>
                            Sacado <span>{getSortIndicator('sacado')}</span>
                          </button>
                        </th>
                        <th>Observação</th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                            Sit. <span>{getSortIndicator('situacao')}</span>
                          </button>
                        </th>
                        <th>B.Desc.</th>
                        <th>Sit. Pagto</th>
                        <th>Sel.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsFiltradas.map((row, index) => {
                        const key = row.num_Lanc ?? index;
                        const isSelected = row.num_Lanc != null && selectedRows.has(row.num_Lanc);
                        return (
                          <tr key={key} className={isSelected ? 'module-row-selected' : undefined}>
                            <td>{formatDateDdMmYy(row.data_Prev)}</td>
                            <td>{formatDateDdMmYy(row.data_Vencimento)}</td>
                            <td>{String(row.tipoDoc ?? '-')}</td>
                            <td>{String(row.num_Documento ?? '-')}</td>
                            <td>{formatDateDdMmYy(row.data_Emissao)}</td>
                            <td>{formatCurrency(row.valor_Saldo)}</td>
                            <td>{String(row.nome_Fantasia ?? '-')}</td>
                            <td>{String(row.descricao_Lanc ?? '-')}</td>
                            <td>{String(row.situacao ?? '-')}</td>
                            <td>{row.num_Bordero_Desc != null ? String(row.num_Bordero_Desc) : '-'}</td>
                            <td>{String(row.situacao_Pag ?? '-')}</td>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Selecionar lançamento ${row.num_Lanc ?? index}`}
                                checked={isSelected}
                                onChange={() => toggleSelectRow(row.num_Lanc)}
                                style={{ width: '0.75rem', height: '0.75rem', cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="module-cards">
                  {rowsFiltradas.map((row, index) => {
                    const key = `card-${row.num_Lanc ?? index}`;
                    const isSelected = row.num_Lanc != null && selectedRows.has(row.num_Lanc);
                    return (
                      <article key={key} className={`module-card${isSelected ? ' module-row-selected' : ''}`}>
                        <div className="module-card__row">
                          <span>Sacado</span>
                          <strong>{String(row.nome_Fantasia ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Número</span>
                          <strong>{String(row.num_Documento ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Tipo Doc.</span>
                          <strong>{String(row.tipoDoc ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Venc.</span>
                          <strong>{formatDateDdMmYy(row.data_Vencimento)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Previsão</span>
                          <strong>{formatDateDdMmYy(row.data_Prev)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Emissão</span>
                          <strong>{formatDateDdMmYy(row.data_Emissao)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Valor Liq.</span>
                          <strong>{formatCurrency(row.valor_Saldo)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sit.</span>
                          <strong>{String(row.situacao ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sit. Pagto</span>
                          <strong>{String(row.situacao_Pag ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>B.Desc.</span>
                          <strong>{row.num_Bordero_Desc != null ? String(row.num_Bordero_Desc) : '-'}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Observação</span>
                          <strong>{String(row.descricao_Lanc ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sel.</span>
                          <strong>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar lançamento ${row.num_Lanc ?? index}`}
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.num_Lanc)}
                              style={{ width: '0.75rem', height: '0.75rem', cursor: 'pointer' }}
                            />
                          </strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="module-table list-layout-table contas-receber-table">
            {notaDebitoRows.length === 0 ? (
              <p className="module-empty">Nenhum registro encontrado.</p>
            ) : (
              <div className="table-scroll module-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Venc.</th>
                      <th>Número</th>
                      <th>Emissão</th>
                      <th>Valor Liq.</th>
                      <th>Sacado</th>
                      <th>Observação</th>
                      <th>Sit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notaDebitoRows.map((row, index) => (
                      <tr key={row.num_Lanc ?? index}>
                        <td>{formatDateDdMmYy(row.data_Vencimento)}</td>
                        <td>{String(row.num_Documento ?? '-')}</td>
                        <td>{formatDateDdMmYy(row.data_Emissao)}</td>
                        <td>{formatCurrency(row.valor_Saldo)}</td>
                        <td>{String(row.nome_Fantasia ?? '-')}</td>
                        <td>{String(row.descricao_Lanc ?? '-')}</td>
                        <td>{String(row.situacao ?? '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Rodapé de ações */}
        <footer className="contas-receber-footer">

          {/* Container com borda: Saldo para abater */}
          <fieldset className="contas-receber-footer__saldo-box">
            <legend className="contas-receber-footer__saldo-legend">Saldo para abater:</legend>

            <div className="contas-receber-footer__saldo-inner">
              <div className="contas-receber-footer__saldo-grid">
                <span className="contas-receber-footer__saldo-label-text">Nota de débito:</span>
                <input type="text" readOnly className="contas-receber-footer__input contas-receber-footer__input--saldo" value={saldoDebito != null ? formatCurrency(saldoDebito) : ''} />
                <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--saldo" onClick={() => void handleAbrirAbatimento()}>Abater</button>

                <span className="contas-receber-footer__saldo-label-text">Adiantamento:</span>
                <input type="text" readOnly className="contas-receber-footer__input contas-receber-footer__input--saldo" value={saldoAdiantamento != null ? formatCurrency(saldoAdiantamento) : ''} />
                <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--saldo" onClick={() => void handleAbrirEstorno()}>Estornar</button>
              </div>

              <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--adiant" onClick={() => void handleAbrirAdiantamentos()}>
                Adiantamentos<br />recebidos
              </button>
            </div>
          </fieldset>

          {/* Data da baixa em lote */}
          <fieldset className="contas-receber-footer__saldo-box">
            <label className="list-layout-field list-layout-field--date">
              <span>Data da baixa em lote</span>
              <CustomDatePicker value={dataBaixaLote} onChange={setDataBaixaLote} />
            </label>
          </fieldset>

          {/* Botões de ação */}
          <div className="contas-receber-footer__actions">
            <div className="contas-receber-footer__actions-row">
              <button type="button" className="secondary-button contas-receber-footer__btn" onClick={handleBaixarClick} disabled={baixarExecutando}>Baixar</button>
              <button type="button" className="secondary-button contas-receber-footer__btn" onClick={handleAbrirConsulta}>Consultar</button>
              <button type="button" className="secondary-button contas-receber-footer__btn" onClick={handleAbrirAlterar}>Alterar</button>
              <button type="button" className="secondary-button contas-receber-footer__btn" onClick={handleCancelarClick} disabled={cancelarExecutando}>Cancelar</button>
            </div>
          </div>
        </footer>
      </section>

      {/* Result Baixar */}
      {baixaResultOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Resultado da baixa">
          <article className="modal-card" style={{ width: 'min(560px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {baixaResultSuccess
                  ? <IoCheckmarkCircleOutline size={22} style={{ color: '#16a34a', flexShrink: 0 }} />
                  : <IoCloseCircleOutline size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
                }
                <h2 style={{ margin: 0 }}>Resultado da Baixa</h2>
              </div>
            </header>
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '12px 14px',
              background: 'var(--color-surface-alt)',
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {baixaResultMsg}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setBaixaResultOpen(false)}
              >
                Ok
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Baixar */}
      {baixarConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar baixa">
          <article className="modal-card" style={{ width: 'min(460px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Baixa</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja realizar as baixas do(s) documento(s) selecionado(s)?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setBaixarConfirmOpen(false)}
                disabled={baixarExecutando}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleExecutarBaixa()}
                disabled={baixarExecutando}
              >
                {baixarExecutando ? 'Baixando...' : 'Sim'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Modal de Abatimento */}
      {abatimentoConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar abatimento">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Abatimento</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja realmente abater esse documento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setAbatimentoConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleExecutarAbatimento()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {abatimentoModalOpen && abatimentoRegistro && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Abatimento">
          <article className="modal-card modal-card--abatimento">
            <header className="modal-card__header">
              <h2>Abatimento</h2>
            </header>

            {/* Cabeçalho com dados do título */}
            <div className="abatimento-info">
              <div className="abatimento-info__left">
                {/* Linha 1: Sacado ocupa toda a largura */}
                <div className="abatimento-field-row">
                  <span className="abatimento-field-row__label">Sacado:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--wide" readOnly value={String(abatimentoCabecalho?.nome_Fantasia ?? abatimentoRegistro.nome_Fantasia ?? '')} />
                </div>
                {/* Linhas 2-3: grade com colunas fixas para alinhar Emissão x Vencimento */}
                <div className="abatimento-info__grid">
                  <span className="abatimento-field-row__label">Nota Fiscal:</span>
                  <div className="abatimento-field-row__nf-group">
                    <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(abatimentoCabecalho?.num_Nota_Fiscal ?? abatimentoRegistro.num_Nota_Fiscal ?? '')} />
                    <span className="abatimento-field-row__sep">/</span>
                    <input className="abatimento-field-row__input abatimento-field-row__input--xs" readOnly value={String(abatimentoCabecalho?.ser_Nota_Fiscal ?? abatimentoRegistro.ser_Nota_Fiscal ?? '')} />
                  </div>
                  <span className="abatimento-field-row__label">Emissão:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(abatimentoCabecalho?.data_Emissao ?? abatimentoRegistro.data_Emissao)} />

                  <span className="abatimento-field-row__label">Num. doc.:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(abatimentoCabecalho?.num_Documento ?? abatimentoRegistro.num_Documento ?? '')} />
                  <span className="abatimento-field-row__label">Vencimento:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(abatimentoCabecalho?.data_Vencimento ?? abatimentoRegistro.data_Vencimento)} />
                </div>
              </div>

              <div className="abatimento-info__right">
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor documento:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(
                      abatimentoCabecalho?.valor_Receber ?? abatimentoRegistro.valor_Saldo ?? 0
                    )}
                  />
                </div>
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor abatido:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(
                      abatimentoCabecalho?.valor_Abatido ?? abatimentoRegistro.valor_Abatido ?? 0
                    )}
                  />
                </div>
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor receber:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(
                      abatimentoCabecalho?.valor_Receber_Calc ?? ((abatimentoRegistro.valor_Saldo ?? 0) - (abatimentoRegistro.valor_Abatido ?? 0))
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Tabela de itens disponíveis para abatimento */}
            <div className="abatimento-table-wrap">
              {abatimentoLoading ? (
                <p className="module-empty">Carregando...</p>
              ) : (
                <table className="abatimento-table">
                  <thead>
                    <tr>
                      <th>Vencto</th>
                      <th>Docum.</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Sacado</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abatimentoRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>Nenhum item encontrado.</td></tr>
                    ) : abatimentoRows.map((item, idx) => (
                      <tr
                        key={item.num_Lanc ?? idx}
                        className={abatimentoSelectedLanc === item.num_Lanc ? 'module-row-selected' : undefined}
                        onClick={() => setAbatimentoSelectedLanc((prev) => prev === item.num_Lanc ? null : (item.num_Lanc ?? null))}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDateDdMmYy(item.data_Vencimento)}</td>
                        <td>{String(item.num_Documento ?? '-')}</td>
                        <td>{String(item.tipoDoc ?? '-')}</td>
                        <td>{formatCurrency(item.valor_Saldo)}</td>
                        <td>{String(item.nome_Fantasia ?? '-')}</td>
                        <td>{String(item.descricao_Lanc ?? '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé */}
            <div className="abatimento-footer">
              <div className="abatimento-footer__left">
                <input
                  type="text"
                  className="abatimento-field-row__input abatimento-field-row__input--valor"
                  value={valorAbater}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (!digits) { setValorAbater(''); return; }
                    const num = parseInt(digits, 10);
                    setValorAbater(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num / 100));
                  }}
                  placeholder="0,00"
                  aria-label="Valor a abater"
                />
                <button type="button" className="secondary-button" onClick={handleConfirmarAbatimento} disabled={abatimentoExecutando}>
                  Abater
                </button>
              </div>
              <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setAbatimentoModalOpen(false)}>
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Estorno */}
      {estornoConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar estorno">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Estorno</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja realmente estornar esse abatimento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setEstornoConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleExecutarEstorno()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Modal Estorno Abatimento */}
      {estornoModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Estorno Abatimento">
          <article className="modal-card modal-card--abatimento">
            <header className="modal-card__header">
              <h2>Estorno Abatimento</h2>
            </header>

            {estornoLoading ? (
              <p className="module-empty">Carregando...</p>
            ) : estornoCabecalho ? (
              <>
                {/* Cabeçalho com dados do título */}
                <div className="abatimento-info">
                  <div className="abatimento-info__left">
                    <div className="abatimento-field-row">
                      <span className="abatimento-field-row__label">Sacado:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--wide" readOnly value={String(estornoCabecalho.nome_Fantasia ?? '')} />
                    </div>
                    <div className="abatimento-info__grid">
                      <span className="abatimento-field-row__label">Nota Fiscal:</span>
                      <div className="abatimento-field-row__nf-group">
                        <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(estornoCabecalho.num_Nota_Fiscal ?? '')} />
                        <span className="abatimento-field-row__sep">/</span>
                        <input className="abatimento-field-row__input abatimento-field-row__input--xs" readOnly value={String(estornoCabecalho.ser_Nota_Fiscal ?? '')} />
                      </div>
                      <span className="abatimento-field-row__label">Emissão:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(estornoCabecalho.data_Emissao)} />

                      <span className="abatimento-field-row__label">Num. doc.:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(estornoCabecalho.num_Documento ?? '')} />
                      <span className="abatimento-field-row__label">Vencimento:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(estornoCabecalho.data_Vencimento)} />
                    </div>
                  </div>

                  <div className="abatimento-info__right">
                    <div className="abatimento-valor-row">
                      <span className="abatimento-valor-row__label">Valor documento:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                        value={estornoCabecalho.valor_Receber != null
                          ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(estornoCabecalho.valor_Receber)
                          : ''}
                      />
                    </div>
                    <div className="abatimento-valor-row">
                      <span className="abatimento-valor-row__label">Valor abatido:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                        value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(estornoCabecalho.valor_Abatido ?? 0)}
                      />
                    </div>
                    <div className="abatimento-valor-row">
                      <span className="abatimento-valor-row__label">Valor receber:</span>
                      <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                        value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(estornoCabecalho.valor_Receber_Calc ?? 0)}
                      />
                    </div>
                  </div>
                </div>

                {/* Tabela de itens para estorno */}
                <div className="abatimento-table-wrap">
                  <table className="abatimento-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Data Abatimento</th>
                        <th>Tipo</th>
                        <th>Abatido</th>
                        <th>Nota</th>
                        <th>Sacado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estornoRows.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>Nenhum item encontrado.</td></tr>
                      ) : estornoRows.map((item, idx) => (
                        <tr
                          key={idx}
                          className={estornoSelectedIdx === idx ? 'module-row-selected' : undefined}
                          onClick={() => setEstornoSelectedIdx((prev) => prev === idx ? null : idx)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{String(item.num_Documento ?? '-')}</td>
                          <td>{formatDateDdMmYy(item.data_Abatimento)}</td>
                          <td>{String(item.tipo ?? '-')}</td>
                          <td>{formatCurrency(item.valor_Abatido)}</td>
                          <td>{item.num_Nota_Fiscal != null ? String(item.num_Nota_Fiscal) : '-'}</td>
                          <td>{String(item.nome_Fantasia ?? '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé */}
                <div className="abatimento-footer">
                  <div className="abatimento-footer__left">
                    <input
                      type="text"
                      className="abatimento-field-row__input abatimento-field-row__input--valor"
                      value={valorEstornar}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        if (!digits) { setValorEstornar(''); return; }
                        const num = parseInt(digits, 10);
                        setValorEstornar(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num / 100));
                      }}
                      placeholder="0,00"
                      aria-label="Valor a estornar"
                    />
                    <button type="button" className="secondary-button" onClick={handleConfirmarEstorno} disabled={estornoExecutando}>
                      Estornar
                    </button>
                  </div>
                  <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setEstornoModalOpen(false)}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <p className="module-empty">Nenhuma informação encontrada.</p>
            )}
          </article>
        </section>
      )}
      {/* Modal Adiantamentos Recebidos */}
      {adiantamentosModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Adiantamentos Recebidos">
          <article className="modal-card modal-card--adiantamentos">
            <header className="modal-card__header">
              <h2>Adiantamentos Recebidos</h2>
            </header>

            {/* Guias */}
            <div className="adiantamento-tabs">
              <button
                type="button"
                className={`adiantamento-tab${adiantamentosTab === 'A' ? ' adiantamento-tab--active' : ''}`}
                onClick={() => setAdiantamentosTab('A')}
              >
                Abertos
              </button>
              <button
                type="button"
                className={`adiantamento-tab${adiantamentosTab === 'E' ? ' adiantamento-tab--active' : ''}`}
                onClick={() => setAdiantamentosTab('E')}
              >
                Encerrados
              </button>
            </div>

            {/* Tabela */}
            <div className="abatimento-table-wrap">
              {adiantamentosLoading ? (
                <p className="module-empty" style={{ padding: 20, textAlign: 'center' }}>Carregando...</p>
              ) : (
                <table className="abatimento-table">
                  <thead>
                    <tr>
                      <th>Vencto</th>
                      <th>Docum.</th>
                      <th style={{ textAlign: 'right' }}>Saldo</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Nota</th>
                      <th>Sacado</th>
                      <th>Observação</th>
                      {adiantamentosTab === 'E' && <th style={{ textAlign: 'center' }}>Dev.</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(adiantamentosTab === 'A' ? adiantamentosAbertos : adiantamentosEncerrados).length === 0 ? (
                      <tr>
                        <td colSpan={adiantamentosTab === 'E' ? 8 : 7} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                          Nenhum item encontrado.
                        </td>
                      </tr>
                    ) : (adiantamentosTab === 'A' ? adiantamentosAbertos : adiantamentosEncerrados).map((item, idx) => {
                      const isSelected = adiantamentosTab === 'A'
                        ? adiantamentosAbertosSelectedIdx === idx
                        : adiantamentosEncerradosSelectedIdx === idx;
                      const setSelected = adiantamentosTab === 'A'
                        ? setAdiantamentosAbertosSelectedIdx
                        : setAdiantamentosEncerradosSelectedIdx;
                      return (
                        <tr
                          key={idx}
                          className={isSelected ? 'module-row-selected' : undefined}
                          onClick={() => setSelected((prev) => prev === idx ? null : idx)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{formatDateDdMmYy(item.data_Vencimento)}</td>
                          <td>{item.num_Documento ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor_Saldo)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor_Orig)}</td>
                          <td>{item.num_Nota_Fiscal ?? '-'}</td>
                          <td>{item.nome_Fantasia ?? '-'}</td>
                          <td title={adiantamentosTab === 'E' && (item.descricao_Lanc ?? '').length > 50 ? String(item.descricao_Lanc) : undefined}>
                            {adiantamentosTab === 'E' && (item.descricao_Lanc ?? '').length > 50
                              ? `${String(item.descricao_Lanc).slice(0, 50)}…`
                              : (item.descricao_Lanc ?? '')}
                          </td>
                          {adiantamentosTab === 'E' && (
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" readOnly checked={item.temDev === true} onChange={() => { }} style={{ cursor: 'default', accentColor: 'var(--color-primary)' }} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé — Abertos */}
            {adiantamentosTab === 'A' && (
              <div className="adiantamento-footer">
                <fieldset className="adiantamento-footer__devolver-box">
                  <legend className="adiantamento-footer__devolver-legend">Devolver saldo:</legend>
                  <div className="adiantamento-footer__devolver-inner">
                    <span className="abatimento-field-row__label">Data:</span>
                    <input
                      type="text"
                      className="abatimento-field-row__input abatimento-field-row__input--date"
                      value={devolverData}
                      onChange={(e) => setDevolverData(e.target.value)}
                    />
                    <button type="button" className="secondary-button" style={{ width: 'auto', minWidth: 80 }} onClick={() => void handleDevolver()} disabled={adiantamentosExecutando}>
                      Devolver
                    </button>
                  </div>
                </fieldset>
                <div className="adiantamento-footer__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: 'auto', minWidth: 90 }}
                    disabled={adiantamentosExecutando}
                    onClick={() => {
                      if (adiantamentosAbertosSelectedIdx == null) {
                        showToast('Selecione um registro para encerrar!', 'error');
                        return;
                      }
                      setEncerrarConfirmOpen(true);
                    }}
                  >
                    Encerrar
                  </button>
                  <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setAdiantamentosModalOpen(false)}>
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* Rodapé — Encerrados */}
            {adiantamentosTab === 'E' && (
              <div className="adiantamento-footer">
                <div className="adiantamento-footer__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: 'auto', minWidth: 130 }}
                    disabled={adiantamentosExecutando}
                    onClick={() => {
                      if (adiantamentosEncerradosSelectedIdx == null) {
                        showToast('Selecione um registro para estornar a devolução!', 'error');
                        return;
                      }
                      setEstornarDevolucaoConfirmOpen(true);
                    }}
                  >
                    Estornar devolução
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: 'auto', minWidth: 80 }}
                    disabled={adiantamentosExecutando}
                    onClick={() => {
                      if (adiantamentosEncerradosSelectedIdx == null) {
                        showToast('Selecione um registro para reabrir!', 'error');
                        return;
                      }
                      setReabrirConfirmOpen(true);
                    }}
                  >
                    Reabrir
                  </button>
                </div>
                <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setAdiantamentosModalOpen(false)}>
                  Fechar
                </button>
              </div>
            )}
          </article>
        </section>
      )}

      {/* Confirm Cancelar — Step 1 */}
      {cancelarStep1Open && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar cancelamento">
          <article className="modal-card" style={{ width: 'min(460px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Cancelamento</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              {cancelarIsLote
                ? 'Deseja realmente cancelar os títulos selecionados? Essa operação não poderá ser desfeita, deseja continuar?'
                : 'Deseja realmente cancelar esse título?'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setCancelarStep1Open(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={handleCancelarStep1Confirm}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Cancelar — Step 2: ExcluirOutros */}
      {cancelarStep2Open && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Excluir outros títulos">
          <article className="modal-card" style={{ width: 'min(460px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Outros Títulos Selecionados</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Existem outros títulos diferentes de 'Duplicatas' selecionados, deseja excluí-los do contas a receber?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => {
                  setCancelarStep2Open(false);
                  void executarCancelar(false);
                }}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={handleCancelarStep2Confirm}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Estornar Devolução */}
      {estornarDevolucaoConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar estorno de devolução">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Estorno</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja estornar essa devolução?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setEstornarDevolucaoConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleEstornarDevolucao()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Encerrar Adiantamento */}
      {encerrarConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar encerramento">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Encerramento</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja encerrar esse documento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setEncerrarConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleEncerrar()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Confirm Reabrir Adiantamento */}
      {reabrirConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar reabertura">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Reabertura</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja reabrir o documento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setReabrirConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleReabrir()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ── Consulta / Alterar Contas a Receber ──────────────────────────────── */}
      <ConsultaAlterarContasReceberModal
        open={consultaAlterarOpen}
        mode={consultaAlterarMode}
        numLanc={consultaAlterarNumLanc}
        sacadoNomeInicial={consultaAlterarSacadoNome}
        onClose={() => setConsultaAlterarOpen(false)}
        onSuccess={() => void carregarContas()}
      />

      {/* ── Modal Lançamento de Contas a Receber ─────────────────────────────── */}
      <LancamentoContasReceberModal open={lancModalOpen} onClose={() => setLancModalOpen(false)} onSuccess={() => void carregarContas()} />
    </main>
  );
}
