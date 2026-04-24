import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IoAddOutline, IoChevronDownOutline, IoChevronForwardOutline, IoCloseCircleOutline, IoCloseOutline, IoDocumentTextOutline, IoSaveOutline, IoSearchOutline, IoTrashOutline } from 'react-icons/io5';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ROUTES } from '../../../constants/routes';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  listaClientesCall,
  listaCondicaoPagtoCall,
  listaRepresentantesCall,
  listaTransportadorasCall,
  listaVendedoresCall,
  tabelaPrecoItensCall,
} from '../../../services/apiCalls';
import {
  alterarPedidoVenda,
  incluirPedidoVenda,
  validarItensPlanilhaExcel,
} from '../../../services/pedidoVendaApi';

type ItemForm = {
  Codigo_Produto: string;
  Descricao_Produto?: string;
  Num_Item?: number;
  Qtd_Entregar: string;
  Qtd_Entregue?: string;
  Saldo?: string;
  Preco_Negociado: string;
  Total_Item?: string;
  Pedido_Cliente: string;
  Data_Entrega: string;
  Hora_Entrega?: string;
  Unid_Med_Venda: string;
  Moeda: string;
  Moeda_Preco?: string;
  Preco_Base?: string;
};

type PedidoVendaFormPanelProps = {
  open: boolean;
  numPedido?: number | string | null;
  situacaoPedido?: string;
  initialPedido?: any | null;
  readOnly?: boolean;
  isRepresentantes?: boolean;
  allowImportSpreadsheet?: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

const emptyItem = (): ItemForm => ({
  Codigo_Produto: '',
  Descricao_Produto: '',
  Num_Item: undefined,
  Qtd_Entregar: '0.000',
  Qtd_Entregue: '0',
  Saldo: '0',
  Preco_Negociado: '0.0000',
  Total_Item: '0.00',
  Pedido_Cliente: '',
  Data_Entrega: '',
  Hora_Entrega: '',
  Unid_Med_Venda: '',
  Moeda: '',
  Moeda_Preco: 'R$',
  Preco_Base: '0.0000',
});

const fretePorContaOptions: SearchableSelectOption[] = [
  { value: '1', label: '0 - Remetente' },
  { value: '2', label: '1 - Destinatário' },
  { value: '3', label: '2 - Terceiro' },
  { value: '4', label: '3 - Remetente - transporte próprio' },
  { value: '5', label: '4 - Destinatário - transporte próprio' },
  { value: '9', label: '9 - Sem transporte' },
];

const destinoPedidoOptions: SearchableSelectOption[] = [
  { value: 'Consumo', label: 'Consumo' },
  { value: 'Revenda', label: 'Revenda' },
  { value: 'Produção', label: 'Produção' },
];

type TabelaPrecoItem = {
  codigo: string;
  descricao: string;
  unidade: string;
  moeda: string;
  preco: number;
};

type PlanilhaItemPreview = {
  Codigo_Produto: string;
  Qtd_Produto: number;
  Descricao_Produto?: string;
  Unid_Med_Venda?: string;
  Moeda?: string;
  Preco_Negociado?: number;
  status?: 'ok' | 'x' | 'i' | 't';
  Validacao?: 'OK' | 'X' | 'I' | 'T' | '';
  Imagem_Status?: string;
  statusMensagem?: string;
};

const getPlanilhaStatusCode = (item: PlanilhaItemPreview): 'ok' | 'x' | 'i' | 't' | '' => {
  if (item.status === 'ok' || item.status === 'x' || item.status === 'i' || item.status === 't') {
    return item.status;
  }

  const validacaoRaw = String(item.Validacao || item.statusMensagem || '').trim().toUpperCase();
  if (validacaoRaw === 'OK') return 'ok';
  if (validacaoRaw === 'X') return 'x';
  if (validacaoRaw === 'I') return 'i';
  if (validacaoRaw === 'T' || validacaoRaw === 'S/TABELA') return 't';
  return '';
};

const PLANILHA_HEADERS_ESPERADOS = ['Código Drw:', 'Qtde:'];

const formatQtdPlanilhaInput = (value: string) => {
  const cleaned = String(value ?? '').replace(/[^\d.,]/g, '');
  const separatorMatch = cleaned.match(/[.,]/);

  if (!separatorMatch) return cleaned;

  const idx = separatorMatch.index ?? -1;
  if (idx < 0) return cleaned;

  const intPart = cleaned.slice(0, idx).replace(/\D/g, '');
  const fracPart = cleaned.slice(idx + 1).replace(/\D/g, '').slice(0, 4);
  return fracPart ? `${intPart},${fracPart}` : `${intPart},`;
};

const parseStringArrayFromUnknown = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
};

const parseNumber = (value: string) => {
  const normalized = String(value || '0').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const formatFixedNumber = (value: number, decimals: number) => roundTo(value, decimals).toFixed(decimals);

const formatDecimalString = (value: unknown, decimals: number) => {
  const parsed = parseNumber(String(value ?? 0));
  return formatFixedNumber(parsed, decimals);
};

const sanitizeDecimalInput = (value: string, maxDecimals: number) => {
  const raw = String(value ?? '');
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const sepIndex = cleaned.search(/[.,]/);

  if (sepIndex < 0) {
    return cleaned;
  }

  const intPart = cleaned.slice(0, sepIndex).replace(/\D/g, '');
  const sep = cleaned[sepIndex];
  const fracPart = cleaned
    .slice(sepIndex + 1)
    .replace(/\D/g, '')
    .slice(0, maxDecimals);

  return fracPart ? `${intPart}${sep}${fracPart}` : `${intPart}${sep}`;
};

const sanitizePercentInput = (value: string) => {
  const raw = String(value ?? '');
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const sepIndex = cleaned.search(/[.,]/);

  if (sepIndex < 0) {
    return cleaned;
  }

  const intPart = cleaned.slice(0, sepIndex).replace(/\D/g, '');
  const sep = cleaned[sepIndex];
  const fracPart = cleaned
    .slice(sepIndex + 1)
    .replace(/\D/g, '')
    .slice(0, 2);

  return fracPart ? `${intPart}${sep}${fracPart}` : `${intPart}${sep}`;
};

const formatMoney = (value: string | number, currency = 'R$', decimals = 2) => {
  const parsed = parseNumber(String(value ?? 0));
  return `${currency} ${parsed.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

const cleanLabelText = (value: unknown) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeDestinoPedidoValue = (value: unknown) => {
  const raw = cleanLabelText(value);
  if (!raw) return 'Consumo';

  if (/^1$/.test(raw)) return 'Consumo';
  if (/^2$/.test(raw)) return 'Revenda';
  if (/^3$/.test(raw)) return 'Produção';

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('consumo')) return 'Consumo';
  if (normalized.includes('revenda')) return 'Revenda';
  if (normalized.includes('produc')) return 'Produção';

  return raw;
};

const toIsoDate = (value: unknown) => {
  const raw = cleanLabelText(value);
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brMatch) return '';

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  const year = Number(brMatch[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.Rows)) return payload.Rows;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.itens)) return payload.itens;
  if (Array.isArray(payload?.Itens)) return payload.Itens;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.Items)) return payload.Items;
  if (Array.isArray(payload?.clientes)) return payload.clientes;
  if (Array.isArray(payload?.Clientes)) return payload.Clientes;
  if (Array.isArray(payload?.listaClientes)) return payload.listaClientes;
  if (Array.isArray(payload?.ListaClientes)) return payload.ListaClientes;
  if (Array.isArray(payload?.vendedores)) return payload.vendedores;
  if (Array.isArray(payload?.Vendedores)) return payload.Vendedores;
  if (Array.isArray(payload?.listaVendedores)) return payload.listaVendedores;
  if (Array.isArray(payload?.ListaVendedores)) return payload.ListaVendedores;
  if (Array.isArray(payload?.representantes)) return payload.representantes;
  if (Array.isArray(payload?.Representantes)) return payload.Representantes;
  if (Array.isArray(payload?.listaRepresentantes)) return payload.listaRepresentantes;
  if (Array.isArray(payload?.ListaRepresentantes)) return payload.ListaRepresentantes;
  if (Array.isArray(payload?.condicoes)) return payload.condicoes;
  if (Array.isArray(payload?.Condicoes)) return payload.Condicoes;
  if (Array.isArray(payload?.listaCondicaoPagto)) return payload.listaCondicaoPagto;
  if (Array.isArray(payload?.ListaCondicaoPagto)) return payload.ListaCondicaoPagto;
  if (Array.isArray(payload?.condicaoPagto)) return payload.condicaoPagto;
  if (Array.isArray(payload?.CondicaoPagto)) return payload.CondicaoPagto;
  if (Array.isArray(payload?.transportadoras)) return payload.transportadoras;
  if (Array.isArray(payload?.Transportadoras)) return payload.Transportadoras;
  if (Array.isArray(payload?.listaTransportadoras)) return payload.listaTransportadoras;
  if (Array.isArray(payload?.ListaTransportadoras)) return payload.ListaTransportadoras;

  if (payload && typeof payload === 'object') {
    const likelySingleRowKeys = [
      'codigo_Vendedor',
      'Codigo_Vendedor',
      'cod_Vendedor',
      'Cod_Vendedor',
      'codigo_Transportadora',
      'Codigo_Transportadora',
      'cod_Transportadora',
      'Cod_Transportadora',
      'condicao_Pagto',
      'Condicao_Pagto',
      'CondicaoPagto',
      'condicaoPagto',
      'codigo',
      'Codigo',
      'id',
      'Id',
    ];
    if (likelySingleRowKeys.some((key) => payload[key] !== undefined && payload[key] !== null)) {
      return [payload];
    }
  }

  return [];
};

const toOptions = (list: any[], candidates: Array<[string, string]>): SearchableSelectOption[] => {
  return list
    .map((item) => {
      for (const [valueKey, labelKey] of candidates) {
        const value = String(item?.[valueKey] ?? '').trim();
        const label = String(item?.[labelKey] ?? '').trim();
        if (value && label) return { value, label };
      }

      for (const [valueKey, labelKey] of candidates) {
        const value = String(item?.[valueKey] ?? '').trim();
        const label = String(item?.[labelKey] ?? '').trim();
        if (value) return { value, label: label || value };
      }

      return null;
    })
    .filter((item): item is SearchableSelectOption => Boolean(item));
};

const findOptionLabel = (options: SearchableSelectOption[], value: string, fallback = '-') => {
  const found = options.find((option) => option.value === value)?.label;
  return found || value || fallback;
};

const normalizeCode = (value: unknown) => String(value ?? '').trim();
const normalizeNumericCode = (value: unknown) => {
  const raw = normalizeCode(value);
  if (!raw) return '';
  if (/^-?\d+(?:\.0+)?$/.test(raw)) {
    return String(Number(raw));
  }
  return raw;
};
const isNumericLookupCode = (value: unknown) => /^\d+$/.test(normalizeCode(value));

const findRowByCode = (rows: any[], code: string, codeKeys: string[]) => {
  const target = normalizeCode(code);
  if (!target) return null;

  return (
    rows.find((row) => codeKeys.some((key) => normalizeCode(row?.[key]) === target)) || null
  );
};

const getRowLabel = (row: any, labelKeys: string[]) => {
  for (const key of labelKeys) {
    const text = String(row?.[key] ?? '').trim();
    if (text) return text;
  }

  return '';
};

const normalizeText = (value: string) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizePlanilhaHeader = (value: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const resolveOptionValue = (options: SearchableSelectOption[], incoming: string) => {
  const raw = String(incoming ?? '').trim();
  if (!raw) return '';

  const exactValue = options.find((option) => normalizeCode(option.value) === normalizeCode(raw));
  if (exactValue) return exactValue.value;

  const numericIncoming = normalizeNumericCode(raw);
  if (numericIncoming) {
    const numericValue = options.find((option) => normalizeNumericCode(option.value) === numericIncoming);
    if (numericValue) return numericValue.value;
  }

  const normIncoming = normalizeText(raw);
  const exactLabel = options.find((option) => normalizeText(option.label) === normIncoming);
  if (exactLabel) return exactLabel.value;

  const partialLabel = options.find((option) => {
    const normLabel = normalizeText(option.label);
    return normLabel.includes(normIncoming) || normIncoming.includes(normLabel);
  });

  return partialLabel?.value || raw;
};

const toIntegerCode = (value: unknown) => {
  const normalized = normalizeNumericCode(value);
  if (!normalized) return 0;
  if (/^-?\d+$/.test(normalized)) return Number(normalized);

  const leadingCode = normalized.match(/^(-?\d+)/);
  if (leadingCode) return Number(leadingCode[1]);

  return 0;
};

const resolveNumericCode = (rawValue: unknown, options: SearchableSelectOption[]) => {
  const directCode = toIntegerCode(rawValue);
  if (directCode || String(rawValue ?? '').trim() === '0') return directCode;

  const raw = cleanLabelText(rawValue);
  if (!raw) return 0;

  const byLabel = options.find((option) => normalizeText(option.label) === normalizeText(raw));
  if (byLabel) return toIntegerCode(byLabel.value);

  const byValue = options.find((option) => normalizeText(option.value) === normalizeText(raw));
  if (byValue) return toIntegerCode(byValue.value);

  const byPartialLabel = options.find((option) => normalizeText(option.label).includes(normalizeText(raw)));
  if (byPartialLabel) return toIntegerCode(byPartialLabel.value);

  return 0;
};

const getNumericFromObjectKeys = (source: any, keys: string[]) => {
  for (const key of keys) {
    const current = source?.[key];
    if (current === undefined || current === null) continue;
    const parsed = toIntegerCode(current);
    if (parsed || String(current).trim() === '0') return parsed;
  }
  return 0;
};

const getSituacaoBadgeClass = (situacao: string) => {
  const normalized = normalizeText(situacao);
  if (normalized.includes('elaborac') || normalized.includes('pendente')) return 'warning';
  if (normalized.includes('aberto') || normalized.includes('liberad')) return 'info';
  if (normalized.includes('encerrad') || normalized.includes('faturad')) return 'success';
  if (normalized.includes('cancelad') || normalized.includes('reprovad')) return 'danger';
  if (normalized.includes('bloquead') || normalized.includes('suspens')) return 'muted';
  return 'muted';
};

const getSituacaoCodeFromText = (situacao: string | undefined) => {
  const normalized = normalizeText(String(situacao ?? ''));
  if (normalized.includes('elaborac')) return -1;
  if (normalized.includes('aberto')) return 1;
  if (normalized.includes('pendente')) return 0;
  if (normalized.includes('encerrad')) return 2;
  return -1;
};

export function PedidoVendaFormPanel({
  open,
  numPedido,
  situacaoPedido,
  initialPedido,
  readOnly = false,
  isRepresentantes = false,
  allowImportSpreadsheet = true,
  onClose,
  onSaved,
}: PedidoVendaFormPanelProps) {
  const { showToast } = useToast();
  const isEdit = Boolean(numPedido);
  const isViewOnly = Boolean(readOnly);
  const sufixoTitulo = isRepresentantes ? ' representantes' : '';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clienteOptions, setClienteOptions] = useState<SearchableSelectOption[]>([]);
  const [clienteRowsMap, setClienteRowsMap] = useState<Record<string, any>>({});
  const [condicaoOptions, setCondicaoOptions] = useState<SearchableSelectOption[]>([]);
  const [vendedorOptions, setVendedorOptions] = useState<SearchableSelectOption[]>([]);
  const [transportadoraOptions, setTransportadoraOptions] = useState<SearchableSelectOption[]>([]);
  const [, setRepresentanteOptions] = useState<SearchableSelectOption[]>([{ value: '', label: 'Selecione' }]);
  const [lookupLabels, setLookupLabels] = useState({
    cliente: '',
    vendedor: '',
    condicao: '',
    transportadora: '',
  });

  const [codigoCliente, setCodigoCliente] = useState('');
  const [condicaoPagto, setCondicaoPagto] = useState('');
  const [codigoVendedor, setCodigoVendedor] = useState('');
  const [desconto, setDesconto] = useState('0');
  const [descontoAplicado, setDescontoAplicado] = useState('0');
  const [, setDescontoAplicadoNosItens] = useState(false);
  const [frete, setFrete] = useState('0');
  const [tipoPedido, setTipoPedido] = useState('3');
  const [codigoTransportadora, setCodigoTransportadora] = useState('0');
  const [fretePorConta, setFretePorConta] = useState('0');
  const [destinoPedido, setDestinoPedido] = useState('Consumo');
  const [codigoRepresentante, setCodigoRepresentante] = useState('');
  const [percComissaoRep, setPercComissaoRep] = useState('0');
  const [codigoTabela, setCodigoTabela] = useState('0');
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [clienteSelectionVersion, setClienteSelectionVersion] = useState(0);
  const [precoModalOpen, setPrecoModalOpen] = useState(false);
  const [itemConsultaPrecoIndex, setItemConsultaPrecoIndex] = useState<number | null>(null);
  const [loadingTabelaPreco, setLoadingTabelaPreco] = useState(false);
  const [tabelaPrecoRows, setTabelaPrecoRows] = useState<TabelaPrecoItem[]>([]);
  const [tabelaPrecoTermo, setTabelaPrecoTermo] = useState('');
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const [mobileItemModalOpen, setMobileItemModalOpen] = useState(false);
  const [mobileItemDraft, setMobileItemDraft] = useState<ItemForm>(emptyItem());
  const [mobileItemEditIndex, setMobileItemEditIndex] = useState<number | null>(null);
  const [expandedMobileItemCards, setExpandedMobileItemCards] = useState<Record<string, boolean>>({});
  const [confirmarFechamentoOpen, setConfirmarFechamentoOpen] = useState(false);
  const [confirmarImportacaoOpen, setConfirmarImportacaoOpen] = useState(false);
  const [dadosImportacaoOpen, setDadosImportacaoOpen] = useState(false);
  const [pedidoClienteImportacao, setPedidoClienteImportacao] = useState('');
  const [dataEntregaImportacao, setDataEntregaImportacao] = useState('');
  const [planilhaPreviewOpen, setPlanilhaPreviewOpen] = useState(false);
  const [planilhaNomeArquivo, setPlanilhaNomeArquivo] = useState('');
  const [planilhaItensPreview, setPlanilhaItensPreview] = useState<PlanilhaItemPreview[]>([]);
  const [planilhaFiltroBusca, setPlanilhaFiltroBusca] = useState('');
  const [importandoPlanilha, setImportandoPlanilha] = useState(false);
  const [imagemStatusOpen, setImagemStatusOpen] = useState(false);
  const [imagemStatusSrc, setImagemStatusSrc] = useState('');
  const [imagemStatusTitulo, setImagemStatusTitulo] = useState('');
  const itensScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputPlanilhaRef = useRef<HTMLInputElement | null>(null);
  const initialDraftSignatureRef = useRef('');
  const createFormInitializedRef = useRef(false);

  const fretePorContaSelectOptions = useMemo(() => {
    if (!fretePorConta) return fretePorContaOptions;
    if (fretePorContaOptions.some((option) => option.value === fretePorConta)) return fretePorContaOptions;
    return [...fretePorContaOptions, { value: fretePorConta, label: `${fretePorConta} - Frete informado` }];
  }, [fretePorConta]);

  const resetForm = useCallback(() => {
    setCodigoCliente('');
    setCondicaoPagto('');
    setCodigoVendedor('');
    setDesconto('0');
    setDescontoAplicado('0');
    setDescontoAplicadoNosItens(false);
    setFrete('0');
    setTipoPedido('3');
    setCodigoTransportadora('0');
    setFretePorConta('0');
    setDestinoPedido('Consumo');
    setCodigoRepresentante('');
    setPercComissaoRep('0');
    setCodigoTabela('0');
    setItens([emptyItem()]);
    setItemConsultaPrecoIndex(null);
    setTabelaPrecoRows([]);
    setTabelaPrecoTermo('');
    setMobileItemEditIndex(null);
    setMobileItemDraft(emptyItem());
    setMobileItemModalOpen(false);
    setLookupLabels({ cliente: '', vendedor: '', condicao: '', transportadora: '' });
    setPlanilhaPreviewOpen(false);
    setPlanilhaNomeArquivo('');
    setPlanilhaItensPreview([]);
    setPlanilhaFiltroBusca('');
    setConfirmarFechamentoOpen(false);
    setConfirmarImportacaoOpen(false);
    setDadosImportacaoOpen(false);
    setPedidoClienteImportacao('');
    setDataEntregaImportacao('');

    initialDraftSignatureRef.current = JSON.stringify({
      codigoCliente: '',
      condicaoPagto: '',
      codigoVendedor: '',
      desconto: '0',
      descontoAplicado: '0',
      frete: '0',
      tipoPedido: '3',
      codigoTransportadora: '0',
      fretePorConta: '0',
      destinoPedido: 'Consumo',
      codigoRepresentante: '',
      percComissaoRep: '0',
      codigoTabela: '0',
      itens: [
        {
          Codigo_Produto: '',
          Qtd_Entregar: '0.000',
          Preco_Negociado: '0.0000',
          Pedido_Cliente: '',
          Data_Entrega: '',
          Unid_Med_Venda: '',
          Moeda: '',
        },
      ],
    });
  }, []);

  const currentDraftSignature = useMemo(
    () =>
      JSON.stringify({
        codigoCliente,
        condicaoPagto,
        codigoVendedor,
        desconto,
        descontoAplicado,
        frete,
        tipoPedido,
        codigoTransportadora,
        fretePorConta,
        destinoPedido,
        codigoRepresentante,
        percComissaoRep,
        codigoTabela,
        itens: itens.map((item) => ({
          Codigo_Produto: String(item.Codigo_Produto ?? '').trim(),
          Qtd_Entregar: String(item.Qtd_Entregar ?? '').trim(),
          Preco_Negociado: String(item.Preco_Negociado ?? '').trim(),
          Pedido_Cliente: String(item.Pedido_Cliente ?? '').trim(),
          Data_Entrega: String(item.Data_Entrega ?? '').trim(),
          Unid_Med_Venda: String(item.Unid_Med_Venda ?? '').trim(),
          Moeda: String(item.Moeda ?? '').trim(),
        })),
      }),
    [
      codigoCliente,
      condicaoPagto,
      codigoRepresentante,
      codigoTabela,
      codigoTransportadora,
      codigoVendedor,
      desconto,
      descontoAplicado,
      destinoPedido,
      frete,
      fretePorConta,
      itens,
      percComissaoRep,
      tipoPedido,
    ],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (isViewOnly) return false;
    if (!initialDraftSignatureRef.current) return false;
    return currentDraftSignature !== initialDraftSignatureRef.current;
  }, [currentDraftSignature, isViewOnly]);

  const requestCloseForm = useCallback(() => {
    if (isViewOnly || !hasUnsavedChanges) {
      onClose();
      return;
    }

    setConfirmarFechamentoOpen(true);
  }, [hasUnsavedChanges, isViewOnly, onClose]);

  const handleClickImportarPlanilha = useCallback(() => {
    if (!codigoCliente.trim()) {
      showToast('Para importar a planilha, primeiro informe o cliente.', 'info');
      return;
    }

    const pedidoClientePadrao = itens.find((item) => item.Pedido_Cliente?.trim())?.Pedido_Cliente?.trim() || '';
    const dataEntregaPadrao = itens.find((item) => item.Data_Entrega?.trim())?.Data_Entrega?.trim() || '';

    setPedidoClienteImportacao((prev) => prev || pedidoClientePadrao);
    setDataEntregaImportacao((prev) => prev || dataEntregaPadrao);
    setDadosImportacaoOpen(true);
  }, [codigoCliente, itens, showToast]);

  const handleConfirmarDadosImportacao = useCallback(() => {
    if (!pedidoClienteImportacao.trim() || !dataEntregaImportacao.trim()) {
      showToast('Informe Pedido cliente e Data de entrega para continuar a importação.', 'error');
      return;
    }

    setDadosImportacaoOpen(false);

    const hasItensInformados = itens.some((item) => String(item.Codigo_Produto ?? '').trim());
    if (hasItensInformados) {
      setConfirmarImportacaoOpen(true);
      return;
    }

    fileInputPlanilhaRef.current?.click();
  }, [dataEntregaImportacao, itens, pedidoClienteImportacao, showToast]);

  const handlePlanilhaFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      event.currentTarget.value = '';
      if (!file) return;

      try {
        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          showToast('Não foi possível ler a planilha selecionada.', 'error');
          return;
        }

        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false,
        });

        if (!rows.length) {
          showToast('A planilha está vazia.', 'error');
          return;
        }

        const headers = (rows[0] || []).map((cell) => String(cell ?? '').trim());
        const expectedNormalized = PLANILHA_HEADERS_ESPERADOS.map(normalizePlanilhaHeader);
        const headersNormalized = headers.map(normalizePlanilhaHeader);
        const headerValido =
          headersNormalized.length >= expectedNormalized.length
          && expectedNormalized.every((expected, index) => headersNormalized[index] === expected);

        if (!headerValido) {
          showToast(`Cabeçalho inválido. Use exatamente: ${PLANILHA_HEADERS_ESPERADOS.join(' | ')}`, 'error');
          return;
        }

        const idxCodigo = 0;
        const idxQtd = 1;
        const itensPreview: PlanilhaItemPreview[] = [];

        for (let i = 1; i < rows.length; i += 1) {
          const row = rows[i] || [];
          const codigo = String(row[idxCodigo] ?? '').trim();
          const qtd = parseNumber(String(row[idxQtd] ?? '0'));

          if (!codigo) continue;
          if (!(qtd > 0)) continue;

          itensPreview.push({
            Codigo_Produto: codigo,
            Qtd_Produto: qtd,
          });
        }

        if (itensPreview.length === 0) {
          showToast('Nenhum item válido foi encontrado na planilha.', 'error');
          return;
        }

        const pedidoClientePadrao = pedidoClienteImportacao.trim();
        const dataEntregaPadrao = dataEntregaImportacao.trim();

        if (!pedidoClientePadrao || !dataEntregaPadrao) {
          showToast('Informe Pedido cliente e Data entrega no pedido antes de importar a planilha.', 'error');
          return;
        }

        const payload = {
          Codigo_Empresa: Number(GlobalConfig.getCodEmpresa() ?? 0),
          Codigo_Tabela: String(codigoTabela || '0'),
          Codigo_Cliente: Number(codigoCliente) || 0,
          Condicao_Pagto: Number(condicaoPagto) || 0,
          Codigo_Vendedor: Number(codigoVendedor) || 0,
          Perc_Desconto: parseNumber(descontoAplicado),
          Perc_Desconto_Pedido: parseNumber(desconto),
          Valor_Frete: parseNumber(frete),
          Tipo_Pedido: Number(tipoPedido) || 0,
          Codigo_Transportadora: Number(codigoTransportadora) || 0,
          Frete_Por_Conta: Number(fretePorConta) || 0,
          Destino_Pedido: destinoPedido,
          Codigo_Emitente: GlobalConfig.getUsuario() || '',
          Situacao_Pedido: -1,
          Pedido_Cliente: pedidoClientePadrao,
          Data_Entrega: dataEntregaPadrao,
          Itens_Planilha: itensPreview.map((item) => ({
            Codigo_Produto: item.Codigo_Produto,
            Qtd_Produto: item.Qtd_Produto,
          })),
        };

        setImportandoPlanilha(true);

        const result = await validarItensPlanilhaExcel(payload);
        const sucesso = Boolean(result?.sucesso ?? result?.succeeded ?? result?.success ?? true);
        const mensagem = String(result?.mensagem ?? result?.message ?? '').trim();
        const dados = result?.dados ?? result?.data ?? {};

        const inexistentes = parseStringArrayFromUnknown(
          dados?.materiaisNaoEncontrados
          ?? dados?.MateriaisNaoEncontrados
          ?? dados?.itensNaoEncontrados
          ?? dados?.ItensNaoEncontrados,
        );
        const inativos = parseStringArrayFromUnknown(
          dados?.materiaisInativos
          ?? dados?.MateriaisInativos
          ?? dados?.itensInativos
          ?? dados?.ItensInativos,
        );

        const rowsApi = Array.isArray(result?.itens)
          ? result.itens
          : Array.isArray(dados?.itens)
            ? dados.itens
            : getRows(dados);
        const itensApi: PlanilhaItemPreview[] = rowsApi
          .map((row: any): PlanilhaItemPreview | null => {
            const codigo = String(row?.Codigo_Produto ?? row?.codigo_Produto ?? row?.codigo ?? '').trim();
            const qtd = parseNumber(String(row?.Qtd_Produto ?? row?.qtd_Produto ?? row?.Qtd_Entregar ?? row?.qtd_Entregar ?? 0));
            if (!codigo || !(qtd > 0)) return null;

            const validacaoRaw = String(row?.validacao ?? row?.Validacao ?? row?.VALIDACAO ?? 'OK').trim().toUpperCase();
            const statusFromApi: PlanilhaItemPreview['status'] =
              validacaoRaw === 'X'
                ? 'x'
                : validacaoRaw === 'I'
                  ? 'i'
                  : validacaoRaw === 'T'
                    ? 't'
                    : 'ok';

            const statusMensagem =
              statusFromApi === 'x'
                ? 'X - item inválido'
                : statusFromApi === 'i'
                  ? 'I - item inativo'
                  : statusFromApi === 't'
                    ? 'T - item com bloqueio'
                    : 'OK';

            const imagemRaw = String(
              row?.imagem_Validacao
              ?? row?.Imagem_Validacao
              ?? row?.imagemValidacao
              ?? row?.imagem_Status
              ?? row?.Imagem_Status
              ?? row?.url_Imagem
              ?? row?.Url_Imagem
              ?? row?.imagem
              ?? '',
            ).trim();

            const imagemStatus =
              imagemRaw && !/^https?:\/\//i.test(imagemRaw) && !/^data:image\//i.test(imagemRaw)
                ? `data:image/png;base64,${imagemRaw}`
                : imagemRaw;

            return {
              Codigo_Produto: codigo,
              Qtd_Produto: qtd,
              Descricao_Produto: String(row?.Descricao_Produto ?? row?.descricao_Produto ?? row?.descricao ?? '').trim(),
              Unid_Med_Venda: String(row?.Unid_Med_Venda ?? row?.unid_Med_Venda ?? row?.unidade ?? '').trim(),
              Moeda: String(row?.Moeda ?? row?.moeda ?? row?.Moeda_Preco ?? 'R$').trim() || 'R$',
              Preco_Negociado: parseNumber(String(row?.Preco_Negociado ?? row?.preco_Negociado ?? row?.Preco_Tabela ?? row?.preco ?? 0)),
              status: statusFromApi,
              Validacao: validacaoRaw === 'OK' || validacaoRaw === 'X' || validacaoRaw === 'I' || validacaoRaw === 'T' ? validacaoRaw : 'OK',
              Imagem_Status: imagemStatus,
              statusMensagem,
            } as PlanilhaItemPreview;
          })
          .filter((item: PlanilhaItemPreview | null): item is PlanilhaItemPreview => Boolean(item));

        const basePreview = itensApi.length > 0 ? itensApi : itensPreview;

        const previewComStatus = basePreview.map((item) => {
          if (item.status) {
            return item;
          }

          const code = String(item.Codigo_Produto ?? '').trim();
          const isInexistente = inexistentes.includes(code);
          const isInativo = !isInexistente && inativos.includes(code);

          if (isInexistente) {
            return {
              ...item,
              status: 'x' as const,
              statusMensagem: 'X - item inválido',
            };
          }

          if (isInativo) {
            return {
              ...item,
              status: 'i' as const,
              statusMensagem: 'I - item inativo',
            };
          }

          return { ...item, status: 'ok' as const, statusMensagem: 'OK' };
        });

        setPlanilhaNomeArquivo(file.name);
        setPlanilhaItensPreview(previewComStatus);
        setPlanilhaFiltroBusca('');
        setPlanilhaPreviewOpen(true);

        if (!sucesso) {
          showToast(mensagem || 'Planilha com inconsistências. Revise os itens destacados.', 'error');
          return;
        }

        if (mensagem) {
          showToast(mensagem, 'success');
        }
      } catch (error: any) {
        showToast(error?.message || 'Falha ao processar a planilha Excel.', 'error');
      } finally {
        setImportandoPlanilha(false);
      }
    },
    [
      codigoCliente,
      codigoTabela,
      codigoTransportadora,
      codigoVendedor,
      condicaoPagto,
      desconto,
      descontoAplicado,
      destinoPedido,
      frete,
      fretePorConta,
      dataEntregaImportacao,
      showToast,
      pedidoClienteImportacao,
      tipoPedido,
    ],
  );

  const handleImportarPlanilha = async () => {
    if (!planilhaItensPreview.length) {
      showToast('Nenhum item válido disponível para importar.', 'error');
      return;
    }
    const existeErroBloqueante = planilhaItensPreview.some((item) => {
      const status = getPlanilhaStatusCode(item);
      return status !== 'ok';
    });
    if (existeErroBloqueante) {
      showToast('Existem itens inválidos na planilha. Corrija ou remova os itens destacados.', 'error');
      return;
    }

    const pedidoClientePadrao = pedidoClienteImportacao.trim();
    const dataEntregaPadrao = dataEntregaImportacao.trim();

    if (!pedidoClientePadrao || !dataEntregaPadrao) {
      showToast('Informe Pedido cliente e Data entrega no pedido antes de importar a planilha.', 'error');
      return;
    }

    setImportandoPlanilha(true);
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const codEmpresa = GlobalConfig.getCodEmpresa();

      if (!baseUrl || !token) {
        showToast('Sessão inválida para consultar tabela de preços.', 'error');
        return;
      }

      const itensConvertidos = await Promise.all(
        planilhaItensPreview.map(async (item, index): Promise<ItemForm> => {
          let tabelaMatch: TabelaPrecoItem | null = null;

          try {
            const resp = await tabelaPrecoItensCall(
              baseUrl,
              token,
              codigoTabela || '0',
              codEmpresa ?? 0,
              item.Codigo_Produto,
              '0',
            );

            const tabelaRows = mapTabelaPrecoRows(resp.jsonBody || resp.data);
            tabelaMatch =
              tabelaRows.find((row) => normalizeCode(row.codigo) === normalizeCode(item.Codigo_Produto))
              ?? tabelaRows[0]
              ?? null;
          } catch {
            tabelaMatch = null;
          }

          const precoBase = tabelaMatch?.preco ?? parseNumber(String(item.Preco_Negociado ?? 0));
          const discounted = calculateDiscountedPrice(precoBase);

          const unid = tabelaMatch?.unidade || item.Unid_Med_Venda || '';
          const moeda = tabelaMatch?.moeda || item.Moeda || 'R$';
          const descricao = tabelaMatch?.descricao || item.Descricao_Produto || '';

          return {
            Codigo_Produto: item.Codigo_Produto,
            Descricao_Produto: descricao,
            Num_Item: index + 1,
            Qtd_Entregar: formatDecimalString(item.Qtd_Produto, 3),
            Qtd_Entregue: '0',
            Saldo: formatDecimalString(item.Qtd_Produto, 3),
            Preco_Negociado: formatDecimalString(discounted.price, 4),
            Total_Item: formatDecimalString(item.Qtd_Produto * discounted.price, 2),
            Pedido_Cliente: pedidoClientePadrao,
            Data_Entrega: dataEntregaPadrao,
            Hora_Entrega: '',
            Unid_Med_Venda: unid,
            Moeda: moeda,
            Moeda_Preco: moeda,
            Preco_Base: formatDecimalString(precoBase, 4),
          };
        }),
      );

      setItens(itensConvertidos.length > 0 ? itensConvertidos : [emptyItem()]);
      setPlanilhaPreviewOpen(false);
      setPlanilhaItensPreview([]);
      setPlanilhaNomeArquivo('');
      setPlanilhaFiltroBusca('');

      showToast('Itens da planilha carregados no pedido. Revise e salve para concluir.', 'success');
    } finally {
      setImportandoPlanilha(false);
    }
  };

  const handleRemoverItemPlanilhaPreview = useCallback((index: number) => {
    setPlanilhaItensPreview((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleChangeQtdPlanilhaPreview = useCallback((index: number, rawValue: string) => {
    const formatted = formatQtdPlanilhaInput(rawValue);
    const parsed = parseNumber(formatted);

    setPlanilhaItensPreview((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      next[index] = {
        ...current,
        Qtd_Produto: parsed,
        status: 'ok',
        statusMensagem: 'OK',
        Validacao: 'OK',
      };

      return next;
    });
  }, []);

  const handleAplicarDescontoItens = (percentualOverride?: number) => {
    if (isViewOnly) return;

    const percentual = typeof percentualOverride === 'number' ? percentualOverride : parseNumber(descontoAplicado);
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      showToast('Informe um desconto válido entre 0 e 100.', 'error');
      return;
    }

    const percentualCliente = parseNumber(desconto);
    const clienteValido = Number.isFinite(percentualCliente) && percentualCliente >= 0 && percentualCliente <= 100;
    const fatorCliente = clienteValido ? 1 - percentualCliente / 100 : 1;

    const fator = 1 - percentual / 100;
    setItens((prev) =>
      prev.map((item) => {
        const precoBase = parseNumber(item.Preco_Base ?? item.Preco_Negociado);
        const precoComDescontoCliente = precoBase * fatorCliente;
        const precoComDesconto = Math.max(0, precoComDescontoCliente * fator);
        return {
          ...item,
          Preco_Base: formatFixedNumber(precoBase, 4),
          Preco_Negociado: formatFixedNumber(precoComDesconto, 4),
        };
      }),
    );
    setDescontoAplicadoNosItens(true);
  };

  const calculateDiscountedPrice = useCallback(
    (basePrice: number) => {
      const percentualCliente = parseNumber(desconto);
      const percentualAplicado = parseNumber(descontoAplicado);

      const clienteValido = Number.isFinite(percentualCliente) && percentualCliente >= 0 && percentualCliente <= 100;
      const aplicadoValido = Number.isFinite(percentualAplicado) && percentualAplicado >= 0 && percentualAplicado <= 100;

      const fatorCliente = clienteValido ? 1 - percentualCliente / 100 : 1;
      const fatorAplicado = aplicadoValido ? 1 - percentualAplicado / 100 : 1;

      return {
        price: Math.max(0, basePrice * fatorCliente * fatorAplicado),
        applied: (clienteValido && percentualCliente > 0) || (aplicadoValido && percentualAplicado > 0),
      };
    },
    [desconto, descontoAplicado],
  );

  const handleChangeDescontoAplicado = (value: string) => {
    setDescontoAplicado(sanitizePercentInput(value));
    setDescontoAplicadoNosItens(false);
  };

  const handleBlurDescontoAplicado = () => {
    if (isViewOnly) return;
    if (!descontoAplicado.trim()) {
      setDescontoAplicado('0');
      handleAplicarDescontoItens(0);
      return;
    }

    handleAplicarDescontoItens();
  };

  const handleChangeCliente = useCallback(
    (nextCodigoCliente: string, options?: { clearItensIfChanged?: boolean; forceReload?: boolean }) => {
      const clearItensIfChanged = options?.clearItensIfChanged ?? true;
      const forceReload = options?.forceReload ?? false;

      const prevCodigo = normalizeCode(codigoCliente);
      const nextCodigo = normalizeCode(nextCodigoCliente);
      const changed = Boolean(prevCodigo && nextCodigo && prevCodigo !== nextCodigo);

      setCodigoCliente(nextCodigoCliente);

      if (clearItensIfChanged && changed) {
        setItens([]);
      }

      if (forceReload || prevCodigo !== nextCodigo) {
        setClienteSelectionVersion((prev) => prev + 1);
      }
    },
    [codigoCliente],
  );

  const resolveLookupLabels = useCallback(
    async (nextCondicaoPagto: string, nextCodigoVendedor: string, nextCodigoTransportadora: string) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario() || '';

      if (!baseUrl || !token || !usuario) {
        return;
      }

      const normalizedTransportadora = normalizeCode(nextCodigoTransportadora);
      const shouldLookupCondicao = isNumericLookupCode(nextCondicaoPagto);
      const shouldLookupVendedor = isNumericLookupCode(nextCodigoVendedor);
      const shouldLookupTransportadora =
        isNumericLookupCode(nextCodigoTransportadora) && normalizedTransportadora !== '0';

      if (normalizedTransportadora === '0') {
        setLookupLabels((prev) => ({
          ...prev,
          transportadora: prev.transportadora || 'Sem transportadora',
        }));
      }

      try {
        const [condResp, vendedorResp, transportadoraResp] = await Promise.all([
          shouldLookupCondicao ? listaCondicaoPagtoCall(baseUrl, token, nextCondicaoPagto) : Promise.resolve(null),
          shouldLookupVendedor ? listaVendedoresCall(baseUrl, token, usuario) : Promise.resolve(null),
          shouldLookupTransportadora
            ? listaTransportadorasCall(baseUrl, token)
            : Promise.resolve(null),
        ]);

        const condRows = getRows((condResp as any)?.jsonBody || (condResp as any)?.data || condResp);
        const vendedorRows = getRows((vendedorResp as any)?.jsonBody || (vendedorResp as any)?.data || vendedorResp);
        const transportadoraRows = getRows((transportadoraResp as any)?.jsonBody || (transportadoraResp as any)?.data || transportadoraResp);

        const condRow = findRowByCode(condRows, nextCondicaoPagto, [
          'condicao_Pagto',
          'Condicao_Pagto',
          'CondicaoPagto',
          'condicaoPagto',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);
        const vendedorRow = findRowByCode(vendedorRows, nextCodigoVendedor, [
          'codigo_Vendedor',
          'Codigo_Vendedor',
          'cod_Vendedor',
          'Cod_Vendedor',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);
        const transportadoraRow = findRowByCode(transportadoraRows, nextCodigoTransportadora, [
          'codigo_Transportadora',
          'Codigo_Transportadora',
          'cod_Transportadora',
          'Cod_Transportadora',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);

        setLookupLabels((prev) => ({
          ...prev,
          condicao:
            (shouldLookupCondicao
              ? getRowLabel(condRow, [
                  'descr_Condicao',
                  'Descr_Condicao',
                  'descricao_Condicao',
                  'Descricao_Condicao',
                  'descrCondicao',
                  'descricaoCondicao',
                  'descricao',
                  'Descricao',
                ])
              : normalizeCode(nextCondicaoPagto)) ||
            prev.condicao,
          vendedor:
            (shouldLookupVendedor
              ? getRowLabel(vendedorRow, [
                  'nome_Vendedor',
                  'Nome_Vendedor',
                  'nomeVendedor',
                  'NomeVendedor',
                  'nome',
                  'Nome',
                  'razao_Social',
                  'Razao_Social',
                  'descricao',
                  'Descricao',
                ])
              : normalizeCode(nextCodigoVendedor)) ||
            prev.vendedor,
          transportadora:
            (normalizedTransportadora === '0'
              ? 'Sem transportadora'
              : shouldLookupTransportadora
                ? getRowLabel(transportadoraRow, [
                    'nome_Transportadora',
                    'Nome_Transportadora',
                    'nomeTransportadora',
                    'NomeTransportadora',
                    'razao_Social',
                    'Razao_Social',
                    'nome_Fantasia',
                    'Nome_Fantasia',
                    'nome',
                    'Nome',
                    'descricao',
                    'Descricao',
                  ])
                : normalizeCode(nextCodigoTransportadora)) ||
            prev.transportadora,
        }));
      } catch {
        setLookupLabels((prev) => ({
          ...prev,
          condicao: normalizeCode(nextCondicaoPagto) || prev.condicao,
          vendedor: normalizeCode(nextCodigoVendedor) || prev.vendedor,
          transportadora:
            (normalizedTransportadora === '0' ? 'Sem transportadora' : normalizedTransportadora)
            || prev.transportadora,
        }));
      }
    },
    [],
  );

  const carregarListas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario() || '';
    const nivel = GlobalConfig.getNivelUsuario() ?? '';
    const codEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !usuario) {
      showToast('Sessão inválida para carregar listas do pedido.', 'error');
      return null;
    }

    try {
      const [clientesResp, condResp, vendedorResp, transportadoraResp, representantesResp] = await Promise.all([
        listaClientesCall(baseUrl, token, {
          codigoUsuario: usuario,
          codigoCliente: null,
          filtro: '',
          nivel,
        }),
        listaCondicaoPagtoCall(baseUrl, token),
        listaVendedoresCall(baseUrl, token, usuario),
        listaTransportadorasCall(baseUrl, token),
        isRepresentantes && codEmpresa ? listaRepresentantesCall(baseUrl, token, codEmpresa) : Promise.resolve(null),
      ]);

      const clienteRows = getRows(clientesResp.jsonBody || clientesResp.data);
      const condicaoRows = getRows(condResp.jsonBody || condResp.data);
      const vendedorRows = getRows(vendedorResp.jsonBody || vendedorResp.data);
      const transportadoraRows = getRows(transportadoraResp.jsonBody || transportadoraResp.data);

      const nextClienteOptions: SearchableSelectOption[] = [
        { value: '', label: 'Selecione' },
        ...toOptions(clienteRows, [
          ['codigo_Cliente', 'nome_Fantasia'],
          ['Codigo_Cliente', 'Nome_Fantasia'],
          ['codigo_cliente', 'razao_Social'],
          ['codCliente', 'nome_Cliente'],
        ]),
      ];
      setClienteOptions(nextClienteOptions);

      const nextClienteRowsMap: Record<string, any> = {};
      clienteRows.forEach((row) => {
        const code = normalizeCode(
          getRowLabel(row, ['codigo_Cliente', 'Codigo_Cliente', 'codigo_cliente', 'codCliente', 'codigo', 'Codigo', 'id', 'Id']),
        );
        if (code) nextClienteRowsMap[code] = row;
      });
      setClienteRowsMap(nextClienteRowsMap);

      const nextCondicaoOptions: SearchableSelectOption[] = [
        { value: '', label: 'Selecione' },
        ...toOptions(condicaoRows, [
          ['condicao_Pagto', 'descr_Condicao'],
          ['Condicao_Pagto', 'Descr_Condicao'],
          ['condicao_Pagto', 'descricao_Condicao'],
          ['Condicao_Pagto', 'Descricao_Condicao'],
          ['CondicaoPagto', 'Descricao_Condicao'],
          ['condicaoPagto', 'descricao_Condicao'],
          ['CondicaoPagto', 'Descricao'],
          ['condicaoPagto', 'descricao'],
          ['codigo', 'descricao_Condicao'],
          ['Codigo', 'Descricao_Condicao'],
          ['codigo', 'descricao'],
          ['Codigo', 'Descricao'],
          ['id', 'descricao'],
        ]),
      ];
      setCondicaoOptions(nextCondicaoOptions);

      const nextVendedorOptions: SearchableSelectOption[] = [
        { value: '', label: 'Selecione' },
        ...toOptions(vendedorRows, [
          ['codigo_Vendedor', 'nome_Vendedor'],
          ['Codigo_Vendedor', 'Nome_Vendedor'],
          ['cod_Vendedor', 'nome_Vendedor'],
          ['Cod_Vendedor', 'Nome_Vendedor'],
          ['codigo_Vendedor', 'razao_Social'],
          ['Codigo_Vendedor', 'Razao_Social'],
          ['cod_Vendedor', 'razao_Social'],
          ['Cod_Vendedor', 'Razao_Social'],
          ['codigo', 'nome_Vendedor'],
          ['Codigo', 'Nome_Vendedor'],
          ['codigo', 'nome'],
          ['Codigo', 'Nome'],
          ['id', 'nome'],
          ['Id', 'Nome'],
          ['id', 'descricao'],
          ['Id', 'Descricao'],
        ]),
      ];
      setVendedorOptions(nextVendedorOptions);

      const nextTransportadoraOptions: SearchableSelectOption[] = [
        { value: '0', label: 'Sem transportadora' },
        ...toOptions(transportadoraRows, [
          ['codigo_Transportadora', 'nome_Transportadora'],
          ['Codigo_Transportadora', 'Nome_Transportadora'],
          ['cod_Transportadora', 'nome_Transportadora'],
          ['Cod_Transportadora', 'Nome_Transportadora'],
          ['codigo_Transportadora', 'razao_Social'],
          ['Codigo_Transportadora', 'Razao_Social'],
          ['codigo_Transportadora', 'nome_Fantasia'],
          ['Codigo_Transportadora', 'Nome_Fantasia'],
          ['cod_Transportadora', 'razao_Social'],
          ['Cod_Transportadora', 'Razao_Social'],
          ['codigo', 'nome'],
          ['Codigo', 'Nome'],
          ['codigo', 'razao_Social'],
          ['Codigo', 'Razao_Social'],
          ['id', 'nome'],
          ['Id', 'Nome'],
          ['id', 'descricao'],
          ['Id', 'Descricao'],
        ]),
      ];
      setTransportadoraOptions(nextTransportadoraOptions);

      if (isRepresentantes) {
        const representantesRows = getRows((representantesResp as any)?.jsonBody || (representantesResp as any)?.data || representantesResp);
        const options: SearchableSelectOption[] = representantesRows
          .map((item) => {
            const codigo = String(
              item?.codigo_Representante ?? item?.codigoRepresentante ?? item?.codigo ?? item?.Codigo ?? '',
            ).trim();
            const nome = String(item?.nome_Representante ?? item?.nomeRepresentante ?? item?.nome ?? '').trim();

            if (!codigo) return null;

            return {
              value: codigo,
              label: nome ? `${codigo} - ${nome}` : codigo,
            };
          })
          .filter((item): item is SearchableSelectOption => Boolean(item));

        setRepresentanteOptions([{ value: '', label: 'Selecione' }, ...options]);
      }

      return {
        clienteOptions: nextClienteOptions,
        clienteRowsMap: nextClienteRowsMap,
        condicaoOptions: nextCondicaoOptions,
        vendedorOptions: nextVendedorOptions,
        transportadoraOptions: nextTransportadoraOptions,
      };
    } catch {
      setClienteRowsMap({});
      showToast('Não foi possível carregar listas auxiliares do pedido.', 'error');
      return null;
    }
  }, [isRepresentantes, showToast]);

  useEffect(() => {
    if (!open || isViewOnly) return;

    const selectedCode = normalizeCode(codigoCliente);
    const clienteRowByCode = selectedCode ? clienteRowsMap[selectedCode] : null;
    const clienteLabelForLookup = normalizeText(
      lookupLabels.cliente
      || cleanLabelText((initialPedido as any)?.nome_Fantasia)
      || cleanLabelText((initialPedido as any)?.nome_Cliente)
      || selectedCode,
    );
    const clienteRowByLabel = Object.values(clienteRowsMap).find((row: any) => {
      const rowLabel = normalizeText(
        row?.nome_Fantasia
        ?? row?.Nome_Fantasia
        ?? row?.nome_Cliente
        ?? row?.Nome_Cliente
        ?? row?.cliente
        ?? '',
      );
      return Boolean(clienteLabelForLookup) && rowLabel === clienteLabelForLookup;
    }) as any;

    const clienteRow = clienteRowByCode || clienteRowByLabel;
    if (!clienteRow) return;

    const nextCondicao = getRowLabel(clienteRow, ['condicao_Pagto', 'Condicao_Pagto', 'condicaoPagto', 'CondicaoPagto']);
    const nextVendedor = getRowLabel(clienteRow, ['codigo_Vendedor', 'Codigo_Vendedor', 'cod_Vendedor', 'Cod_Vendedor']);
    const nextTransportadora = getRowLabel(clienteRow, [
      'codigo_Transportadora',
      'Codigo_Transportadora',
      'cod_Transportadora',
      'Cod_Transportadora',
    ]);
    const nextDesconto = getRowLabel(clienteRow, ['perc_Desconto', 'Perc_Desconto', 'percDesconto']) || '0';
    const nextFrete = getRowLabel(clienteRow, ['valor_Frete', 'Valor_Frete', 'valorFrete']) || '0';
    const nextTipoPedido = getRowLabel(clienteRow, ['tipo_Pedido', 'Tipo_Pedido', 'tipoPedido']) || '3';
    const nextFretePorConta = getRowLabel(clienteRow, ['frete_Por_Conta', 'Frete_Por_Conta', 'fretePorConta']) || '0';
    const nextDestinoPedido = normalizeDestinoPedidoValue(
      getRowLabel(clienteRow, ['destinoPedido', 'Destino_Pedido', 'destino_Pedido']) || 'Consumo',
    );
    const nextCodigoTabela = getRowLabel(clienteRow, [
      'codigo_Tabela',
      'Codigo_Tabela',
      'codigoTabela',
      'codigo_Tabela_Preco',
      'Codigo_Tabela_Preco',
      'cod_Tabela',
      'Cod_Tabela',
      'tabela_Preco',
      'Tabela_Preco',
    ]) || '0';

    setCondicaoPagto(nextCondicao);
    setCodigoVendedor(nextVendedor);
    setCodigoTransportadora(nextTransportadora || '0');
    setDesconto(nextDesconto);
    setDescontoAplicado('0');
    setFrete(nextFrete);
    setTipoPedido(nextTipoPedido);
    setFretePorConta(nextFretePorConta);
    setDestinoPedido(nextDestinoPedido);
    setCodigoTabela(nextCodigoTabela);

    setLookupLabels((prev) => ({
      ...prev,
      cliente:
        getRowLabel(clienteRow, ['nome_Fantasia', 'Nome_Fantasia', 'nome_Cliente', 'Nome_Cliente', 'cliente']) || prev.cliente,
      condicao:
        getRowLabel(clienteRow, ['descr_Condicao', 'Descr_Condicao', 'descricao_Condicao', 'Descricao_Condicao'])
        || prev.condicao,
      vendedor:
        getRowLabel(clienteRow, ['nome_Vendedor', 'Nome_Vendedor', 'nomeVendedor', 'NomeVendedor']) || prev.vendedor,
      transportadora:
        getRowLabel(clienteRow, ['nome_Transportadora', 'Nome_Transportadora', 'nomeTransportadora', 'NomeTransportadora'])
        || prev.transportadora,
    }));

    const syncHeaderLabelsByCodes = async () => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario() || '';

      if (!baseUrl || !token || !usuario) return;

      try {
        const [condResp, vendedorResp, transportadoraResp] = await Promise.all([
          nextCondicao ? listaCondicaoPagtoCall(baseUrl, token, nextCondicao) : Promise.resolve(null),
          nextVendedor ? listaVendedoresCall(baseUrl, token, usuario) : Promise.resolve(null),
          nextTransportadora && nextTransportadora !== '0' ? listaTransportadorasCall(baseUrl, token) : Promise.resolve(null),
        ]);

        const condRows = getRows((condResp as any)?.jsonBody || (condResp as any)?.data || condResp);
        const vendedorRows = getRows((vendedorResp as any)?.jsonBody || (vendedorResp as any)?.data || vendedorResp);
        const transportadoraRows = getRows((transportadoraResp as any)?.jsonBody || (transportadoraResp as any)?.data || transportadoraResp);

        const condRow = findRowByCode(condRows, nextCondicao, [
          'condicao_Pagto',
          'Condicao_Pagto',
          'CondicaoPagto',
          'condicaoPagto',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);

        const vendedorRow = findRowByCode(vendedorRows, nextVendedor, [
          'codigo_Vendedor',
          'Codigo_Vendedor',
          'cod_Vendedor',
          'Cod_Vendedor',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);

        const transportadoraRow = findRowByCode(transportadoraRows, nextTransportadora, [
          'codigo_Transportadora',
          'Codigo_Transportadora',
          'cod_Transportadora',
          'Cod_Transportadora',
          'codigo',
          'Codigo',
          'id',
          'Id',
        ]);

        const condSource = condRow || condRows[0];
        const vendedorSource = vendedorRow || vendedorRows[0];
        const transportadoraSource = transportadoraRow || transportadoraRows[0];

        const condLabel = getRowLabel(
          condSource,
          ['descr_Condicao', 'Descr_Condicao', 'descricao_Condicao', 'Descricao_Condicao', 'descricao', 'Descricao'],
        );
        const vendedorLabel = getRowLabel(
          vendedorSource,
          ['nome_Vendedor', 'Nome_Vendedor', 'nomeVendedor', 'NomeVendedor', 'nome', 'Nome', 'razao_Social', 'Razao_Social'],
        );
        const transportadoraLabel =
          nextTransportadora === '0'
            ? 'Sem transportadora'
            : getRowLabel(
                transportadoraSource,
                [
                  'nome_Transportadora',
                  'Nome_Transportadora',
                  'nomeTransportadora',
                  'NomeTransportadora',
                  'nome_Fantasia',
                  'Nome_Fantasia',
                  'razao_Social',
                  'Razao_Social',
                  'nome',
                  'Nome',
                ],
              );

        if (nextCondicao && condLabel) {
          setCondicaoOptions((prev) =>
            prev.some((option) => option.value === nextCondicao)
              ? prev
              : [...prev, { value: nextCondicao, label: condLabel }],
          );
        }

        if (nextVendedor && vendedorLabel) {
          setVendedorOptions((prev) =>
            prev.some((option) => option.value === nextVendedor)
              ? prev
              : [...prev, { value: nextVendedor, label: vendedorLabel }],
          );
        }

        if (nextTransportadora && transportadoraLabel) {
          setTransportadoraOptions((prev) =>
            prev.some((option) => option.value === nextTransportadora)
              ? prev
              : [...prev, { value: nextTransportadora, label: transportadoraLabel }],
          );
        }

        setLookupLabels((prev) => ({
          ...prev,
          condicao:
            condLabel || prev.condicao,
          vendedor:
            vendedorLabel || prev.vendedor,
          transportadora:
            transportadoraLabel || prev.transportadora,
        }));
      } catch {
        // Mantem os valores atuais da tela; nao faz reload da pagina.
      }
    };

    void syncHeaderLabelsByCodes();
  }, [
    clienteSelectionVersion,
    clienteRowsMap,
    codigoCliente,
    initialPedido,
    isEdit,
    isViewOnly,
    lookupLabels.cliente,
    open,
  ]);

  useEffect(() => {
    if (!open || isViewOnly) return;
    void carregarListas();
  }, [carregarListas, isViewOnly, open]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches);
    syncLayout();

    mediaQuery.addEventListener('change', syncLayout);
    return () => mediaQuery.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    if (!open) {
      createFormInitializedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    const loadPedido = async () => {
      if (!open) return;

      const hasInitialPedido = Boolean(initialPedido);

      if (!isEdit || !numPedido) {
        if (!hasInitialPedido) {
          if (createFormInitializedRef.current) {
            return;
          }

          resetForm();
          createFormInitializedRef.current = true;
          return;
        }
      }

      createFormInitializedRef.current = true;

      setLoading(true);
      try {
        const pedido: any = initialPedido ?? null;

        if (isEdit && numPedido) {
          const initialNum = Number((initialPedido as any)?.num_Pedido ?? (initialPedido as any)?.numPedido ?? 0);
          const targetNum = Number(numPedido ?? 0);

          if (!pedido || initialNum <= 0 || initialNum !== targetNum) {
            showToast('Dados do pedido não disponíveis na lista para edição.', 'error');
            return;
          }
        }

        if (!pedido) {
          showToast('Dados do pedido não disponíveis para preenchimento.', 'error');
          return;
        }

        const rawCodigoCliente = String(
          pedido.codigo_Cliente
            ?? pedido.Codigo_Cliente
            ?? pedido.cod_Cliente
            ?? pedido.Cod_Cliente
            ?? pedido.codCliente
            ?? pedido.codigoCliente
            ?? pedido.id_Cliente
            ?? pedido.Id_Cliente
            ?? '',
        ).trim();
        const nextCodigoCliente = rawCodigoCliente || resolveOptionValue(
          clienteOptions,
          String(
            pedido.cliente
              ?? pedido.nome_Fantasia
              ?? pedido.nome_Cliente
              ?? '',
          ),
        );

        const rawCondicaoPagto = String(
          pedido.codigo_Condicao_Pagto
            ?? pedido.Codigo_Condicao_Pagto
            ?? pedido.codigoCondicaoPagto
            ?? pedido.codigo_Condicao
            ?? pedido.Codigo_Condicao
            ?? pedido.cod_Condicao
            ?? pedido.Cod_Condicao
            ?? pedido.condicao_Codigo
            ?? pedido.Condicao_Codigo
            ?? '',
        ).trim();
        const nextCondicaoPagto = rawCondicaoPagto || resolveOptionValue(
          condicaoOptions,
          String(
            pedido.condicao_Pagto
              ?? pedido.Condicao_Pagto
              ?? pedido.condicaoPagto
              ?? pedido.CondicaoPagto
              ?? pedido.descr_Condicao
              ?? pedido.Descr_Condicao
              ?? pedido.descricao_Condicao
              ?? pedido.Descricao_Condicao
              ?? '',
          ),
        );

        const rawCodigoVendedor = String(
          pedido.codigo_Vendedor
            ?? pedido.Codigo_Vendedor
            ?? pedido.cod_Vendedor
            ?? pedido.Cod_Vendedor
            ?? pedido.codigoVendedor
            ?? '',
        ).trim();
        const nextCodigoVendedor = rawCodigoVendedor || resolveOptionValue(
          vendedorOptions,
          String(
            pedido.vendedor
              ?? pedido.nome_Vendedor
              ?? pedido.Nome_Vendedor
              ?? pedido.nomeVendedor
              ?? '',
          ),
        );

        const rawCodigoTransportadora = String(
          pedido.codigo_Transportadora
            ?? pedido.Codigo_Transportadora
            ?? pedido.cod_Transportadora
            ?? pedido.Cod_Transportadora
            ?? pedido.codigoTransportadora
            ?? '',
        ).trim();
        const nextCodigoTransportadora = rawCodigoTransportadora || resolveOptionValue(
          transportadoraOptions,
          String(
            pedido.transportadora
              ?? pedido.nome_Transportadora
              ?? pedido.Nome_Transportadora
              ?? '',
          ),
        );

        const clienteNomeLabel = cleanLabelText(
          pedido.nome_Fantasia
            ?? pedido.nome_Cliente
            ?? pedido.Nome_Cliente
            ?? pedido.nomeCliente
            ?? pedido.cliente
            ?? '',
        );

        handleChangeCliente(nextCodigoCliente, { clearItensIfChanged: false, forceReload: true });
        if (nextCodigoCliente) {
          setClienteOptions((prev) =>
            prev.some((option) => option.value === nextCodigoCliente)
              ? prev
              : [{ value: '', label: 'Selecione' }, ...prev.filter((option) => option.value !== ''), { value: nextCodigoCliente, label: clienteNomeLabel || nextCodigoCliente }],
          );
        }

        setCondicaoPagto(nextCondicaoPagto);
        setCodigoVendedor(nextCodigoVendedor);
        const nextDescontoAplicado = String(
          pedido.Perc_Desconto_Aplicado
            ?? pedido.perc_Desconto_Aplicado
            ?? pedido.percDescontoAplicado
            ?? pedido.Perc_Desconto
            ?? pedido.perc_Desconto
            ?? pedido.percDesconto
            ?? '0',
        );
        const nextDescontoCliente = String(
          pedido.Perc_Desconto_Cliente
            ?? pedido.perc_Desconto_Cliente
            ?? pedido.percDescontoCliente
            ?? pedido.Perc_Desconto_Pedido
            ?? pedido.perc_Desconto_Pedido
            ?? pedido.percDescontoPedido
            ?? nextDescontoAplicado,
        );

        setDesconto(nextDescontoCliente);
        setDescontoAplicado(nextDescontoAplicado);
        setDescontoAplicadoNosItens(false);
        setFrete(String(pedido.valor_Frete ?? pedido.valorFrete ?? '0'));
        setTipoPedido(String(pedido.Tipo_Pedido ?? pedido.tipo_Pedido ?? pedido.tipoPedido ?? '3'));
        setCodigoTransportadora(nextCodigoTransportadora || '0');
        setFretePorConta(String(pedido.frete_Por_Conta ?? pedido.fretePorConta ?? '0'));
        setDestinoPedido(normalizeDestinoPedidoValue(pedido.destinoPedido ?? pedido.Destino_Pedido ?? 'Consumo'));
        setCodigoRepresentante(String(pedido.codigo_Representante ?? pedido.Codigo_Representante ?? ''));
        setPercComissaoRep(String(pedido.percComissaoRepresentante ?? pedido.Perc_Comissao_Representante ?? '0'));
        setCodigoTabela(String(pedido.Codigo_Tabela ?? pedido.codigo_Tabela ?? pedido.codigoTabela ?? '0'));

        setLookupLabels({
          cliente: clienteNomeLabel,
          condicao: cleanLabelText(
            pedido.descr_Condicao
              ?? pedido.Descr_Condicao
              ?? pedido.descricao_Condicao
              ?? pedido.Descricao_Condicao
              ?? pedido.condicao_Pagto
              ?? pedido.Condicao_Pagto
              ?? pedido.condicaoPagto
              ?? '',
          ),
          vendedor: cleanLabelText(
            pedido.nome_Vendedor
              ?? pedido.Nome_Vendedor
              ?? pedido.nomeVendedor
              ?? pedido.NomeVendedor
              ?? pedido.vendedor
              ?? '',
          ),
          transportadora: cleanLabelText(
            pedido.nome_Transportadora
              ?? pedido.Nome_Transportadora
              ?? pedido.nomeTransportadora
              ?? pedido.NomeTransportadora
              ?? pedido.transportadora
              ?? (nextCodigoTransportadora === '0' ? 'Sem transportadora' : ''),
          ),
        });

        const condLabelFromPedido = String(
          pedido.descr_Condicao
            ?? pedido.Descr_Condicao
            ?? pedido.descricao_Condicao
            ?? pedido.Descricao_Condicao
            ?? pedido.condicao_Pagto
            ?? pedido.Condicao_Pagto
            ?? pedido.condicaoPagto
            ?? '',
        ).trim();
        const vendedorLabelFromPedido = String(
          pedido.nome_Vendedor
            ?? pedido.Nome_Vendedor
            ?? pedido.nomeVendedor
            ?? pedido.NomeVendedor
            ?? pedido.vendedor
            ?? '',
        ).trim();
        const transportadoraLabelFromPedido = String(
          pedido.nome_Transportadora
            ?? pedido.Nome_Transportadora
            ?? pedido.nomeTransportadora
            ?? pedido.NomeTransportadora
            ?? pedido.transportadora
            ?? (nextCodigoTransportadora === '0' ? 'Sem transportadora' : ''),
        ).trim();

        if (nextCondicaoPagto) {
          setCondicaoOptions((prev) =>
            prev.some((option) => option.value === nextCondicaoPagto)
              ? prev
              : [...prev, { value: nextCondicaoPagto, label: condLabelFromPedido || nextCondicaoPagto }],
          );
        }

        if (nextCodigoVendedor) {
          setVendedorOptions((prev) =>
            prev.some((option) => option.value === nextCodigoVendedor)
              ? prev
              : [...prev, { value: nextCodigoVendedor, label: vendedorLabelFromPedido || nextCodigoVendedor }],
          );
        }

        if (nextCodigoTransportadora) {
          setTransportadoraOptions((prev) =>
            prev.some((option) => option.value === nextCodigoTransportadora)
              ? prev
              : [...prev, { value: nextCodigoTransportadora, label: transportadoraLabelFromPedido || nextCodigoTransportadora }],
          );
        }

        if (!isEdit && !isViewOnly) {
          await resolveLookupLabels(
            nextCondicaoPagto,
            nextCodigoVendedor,
            nextCodigoTransportadora,
          );
        }

        const itensRaw = pedido.Itens_Pedido ?? pedido.itens ?? pedido.items ?? [];
        const mappedItens = Array.isArray(itensRaw)
          ? itensRaw.map((item: any) => ({
              Codigo_Produto: String(item.Codigo_Produto ?? item.codigo_Produto ?? item.material ?? ''),
              Descricao_Produto: String(item.Descricao_Produto ?? item.descricao ?? item.descr_Produto ?? ''),
              Num_Item: Number(item.Num_Item ?? item.num_Item ?? 0) || undefined,
              Qtd_Entregar: formatDecimalString(item.Qtd_Entregar ?? item.qtdEntregar ?? '0', 3),
              Qtd_Entregue: String(item.Qtd_Entregue ?? item.qtdEntregue ?? '0'),
              Saldo: String(item.Saldo ?? item.saldo ?? '0'),
              Preco_Negociado: formatDecimalString(
                item.Preco_Negociado ?? item.preco_Negociado ?? item.preco ?? item.preco_Unitario ?? '0',
                4,
              ),
              Preco_Base: formatDecimalString(
                item.Preco_Base
                  ?? item.preco_Base
                  ?? item.Preco_Original
                  ?? item.preco_Original
                  ?? item.Preco_Negociado
                  ?? item.preco_Negociado
                  ?? item.preco
                  ?? item.preco_Unitario
                  ?? '0',
                4,
              ),
              Total_Item: formatDecimalString(
                item.Total_Item
                  ?? item.totalItem
                  ?? (parseNumber(String(item.Qtd_Entregar ?? item.qtdEntregar ?? 0))
                    * parseNumber(String(item.Preco_Negociado ?? item.preco_Negociado ?? item.preco ?? item.preco_Unitario ?? 0))),
                2,
              ),
              Pedido_Cliente: String(
                item.Pedido_Cliente
                  ?? item.Pedido_Ciente
                  ?? item.num_Pedido_Cliente
                  ?? item.numPedidoCliente
                  ?? item.numPedido_Cliente
                  ?? item.pedidoCliente
                  ?? '',
              ),
              Data_Entrega: String(item.Data_Entrega ?? item.entrega ?? ''),
              Hora_Entrega: String(item.Hora_Entrega ?? item.hora ?? ''),
              Unid_Med_Venda: String(
                item.Unid_Med_Venda
                  ?? item.unid_Med_Venda
                  ?? item.unid_Medida
                  ?? item.unidMedida
                  ?? item.unidade
                  ?? '',
              ),
              Moeda: String(item.Moeda ?? item.moeda ?? ''),
              Moeda_Preco: String(item.moeda_Preco ?? item.Moeda_Preco ?? item.Moeda ?? 'R$'),
            }))
          : [];

        const nextItens = mappedItens.length > 0 ? mappedItens : [emptyItem()];
        setItens(nextItens);

        initialDraftSignatureRef.current = JSON.stringify({
          codigoCliente: nextCodigoCliente,
          condicaoPagto: nextCondicaoPagto,
          codigoVendedor: nextCodigoVendedor,
          desconto: nextDescontoCliente,
          descontoAplicado: nextDescontoAplicado,
          frete: String(pedido.valor_Frete ?? pedido.valorFrete ?? '0'),
          tipoPedido: String(pedido.Tipo_Pedido ?? pedido.tipo_Pedido ?? pedido.tipoPedido ?? '3'),
          codigoTransportadora: nextCodigoTransportadora || '0',
          fretePorConta: String(pedido.frete_Por_Conta ?? pedido.fretePorConta ?? '0'),
          destinoPedido: String(pedido.destinoPedido ?? pedido.Destino_Pedido ?? 'Consumo'),
          codigoRepresentante: String(pedido.codigo_Representante ?? pedido.Codigo_Representante ?? ''),
          percComissaoRep: String(pedido.percComissaoRepresentante ?? pedido.Perc_Comissao_Representante ?? '0'),
          codigoTabela: String(pedido.Codigo_Tabela ?? pedido.codigo_Tabela ?? pedido.codigoTabela ?? '0'),
          itens: nextItens.map((item) => ({
            Codigo_Produto: String(item.Codigo_Produto ?? '').trim(),
            Qtd_Entregar: String(item.Qtd_Entregar ?? '').trim(),
            Preco_Negociado: String(item.Preco_Negociado ?? '').trim(),
            Pedido_Cliente: String(item.Pedido_Cliente ?? '').trim(),
            Data_Entrega: String(item.Data_Entrega ?? '').trim(),
            Unid_Med_Venda: String(item.Unid_Med_Venda ?? '').trim(),
            Moeda: String(item.Moeda ?? '').trim(),
          })),
        });
      } catch (error: any) {
        showToast(error?.message || 'Erro ao carregar pedido para edição.', 'error');
      } finally {
        setLoading(false);
      }
    };

    void loadPedido();
  }, [
    clienteOptions,
    condicaoOptions,
    handleChangeCliente,
    initialPedido,
    isEdit,
    isRepresentantes,
    isViewOnly,
    numPedido,
    open,
    resetForm,
    resolveLookupLabels,
    showToast,
    situacaoPedido,
    transportadoraOptions,
    vendedorOptions,
  ]);

  const totalItens = useMemo(
    () =>
      itens.reduce((acc, item) => {
        const qtd = parseNumber(item.Qtd_Entregar);
        const preco = parseNumber(item.Preco_Negociado);
        return acc + qtd * preco;
      }, 0),
    [itens],
  );

  const totalPedido = useMemo(() => totalItens + parseNumber(frete), [frete, totalItens]);

  const resumoPlanilhaStatus = useMemo(() => {
    const ok = planilhaItensPreview.filter((item) => getPlanilhaStatusCode(item) === 'ok').length;
    const x = planilhaItensPreview.filter((item) => getPlanilhaStatusCode(item) === 'x').length;
    const i = planilhaItensPreview.filter((item) => getPlanilhaStatusCode(item) === 'i').length;
    const t = planilhaItensPreview.filter((item) => getPlanilhaStatusCode(item) === 't').length;
    return { ok, x, i, t };
  }, [planilhaItensPreview]);

  const podeConfirmarImportacaoPlanilha = useMemo(
    () => planilhaItensPreview.length > 0 && planilhaItensPreview.every((item) => getPlanilhaStatusCode(item) === 'ok'),
    [planilhaItensPreview],
  );

  const tabelaPrecoRowsFiltradas = useMemo(() => {
    const term = tabelaPrecoTermo.trim().toLowerCase();
    if (!term) return tabelaPrecoRows;

    return tabelaPrecoRows.filter((row) => (
      row.codigo.toLowerCase().includes(term)
      || row.descricao.toLowerCase().includes(term)
      || row.unidade.toLowerCase().includes(term)
    ));
  }, [tabelaPrecoRows, tabelaPrecoTermo]);

  const planilhaItensPreviewFiltrados = useMemo(() => {
    const termo = normalizeText(planilhaFiltroBusca);
    const rows = planilhaItensPreview.map((item, index) => ({ item, index }));
    if (!termo) return rows;

    return rows.filter(({ item }) => {
      const codigo = normalizeText(item.Codigo_Produto);
      const descricao = normalizeText(item.Descricao_Produto ?? '');
      const validacao = normalizeText(item.Validacao ?? item.statusMensagem ?? '');
      return codigo.includes(termo) || descricao.includes(termo) || validacao.includes(termo);
    });
  }, [planilhaFiltroBusca, planilhaItensPreview]);

  const handleImprimirPedidoPDF = useCallback(() => {
    try {
      const empresa = GlobalConfig.getNomeEmpresa() || 'Empresa não identificada';
      const numero = String(numPedido ?? (initialPedido as any)?.num_Pedido ?? (initialPedido as any)?.numPedido ?? '-');
      const cliente = lookupLabels.cliente || findOptionLabel(clienteOptions, codigoCliente, '-');
      const vendedor = lookupLabels.vendedor || findOptionLabel(vendedorOptions, codigoVendedor, '-');
      const condicao = lookupLabels.condicao || findOptionLabel(condicaoOptions, condicaoPagto, '-');
      const transportadora = lookupLabels.transportadora || findOptionLabel(transportadoraOptions, codigoTransportadora, '-');
      const destino = findOptionLabel(destinoPedidoOptions, destinoPedido, '-');

      const formatNumber = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`Pedido ${numero}`, 14, 14);

      doc.setFontSize(11);
      doc.text(empresa, 14, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const metadataRows: string[][] = [
        ['Cliente', cliente, 'Vendedor', vendedor],
        ['Condição Pagto', condicao, 'Transportadora', transportadora],
        ['Destino', destino, 'Frete', `R$ ${formatNumber(parseNumber(frete))}`],
      ];

      autoTable(doc, {
        startY: 25,
        theme: 'grid',
        head: [],
        body: metadataRows,
        styles: { fontSize: 8.2, cellPadding: 1.6, textColor: [17, 24, 39] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28 },
          1: { cellWidth: 87 },
          2: { fontStyle: 'bold', cellWidth: 31 },
          3: { cellWidth: 123 },
        },
        tableWidth: pageWidth - 28,
        margin: { left: 14, right: 14 },
      });

      const itensTableRows = itens.length
        ? itens.map((item, index) => {
            const totalItem = parseNumber(item.Total_Item ?? String(parseNumber(item.Qtd_Entregar) * parseNumber(item.Preco_Negociado)));
            return [
              String(item.Num_Item ?? index + 1),
              item.Codigo_Produto || '-',
              item.Descricao_Produto || '-',
              item.Unid_Med_Venda || '-',
              String(item.Qtd_Entregar || '0'),
              formatNumber(parseNumber(item.Preco_Negociado)),
              formatNumber(totalItem),
              item.Pedido_Cliente || '-',
              item.Data_Entrega || '-',
            ];
          })
        : [['-', '-', 'Sem itens no pedido', '-', '-', '-', '-', '-', '-']];

      const metaTableFinalY = (doc as any).lastAutoTable?.finalY ?? 40;
      autoTable(doc, {
        startY: metaTableFinalY + 3,
        theme: 'grid',
        head: [['Item', 'Código', 'Descrição', 'Unid.', 'Qtd', 'Preço', 'Total item', 'Pedido cliente', 'Data entrega']],
        body: itensTableRows,
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [17, 24, 39] },
        headStyles: { fillColor: [96, 104, 118], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 246, 248] },
        tableWidth: pageWidth - 28,
        columnStyles: {
          0: { cellWidth: 12, halign: 'right' },
          1: { cellWidth: 24 },
          2: { cellWidth: 112 },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 16, halign: 'right' },
          5: { cellWidth: 21, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 24 },
          8: { cellWidth: 22, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      const itensFinalY = (doc as any).lastAutoTable?.finalY ?? 190;
      const totalsStartY = Math.min(itensFinalY + 5, 190);
      const totals = [
        { label: 'TOTAL DE ITENS DO PEDIDO', value: itens.length.toLocaleString('pt-BR') },
        { label: 'TOTAL DOS ITENS', value: `R$ ${formatNumber(totalItens)}` },
        { label: 'TOTAL DO PEDIDO', value: `R$ ${formatNumber(totalPedido)}` },
      ];

      const boxWidth = (pageWidth - 28 - 8 * 2) / 3;
      totals.forEach((total, index) => {
        const x = 14 + index * (boxWidth + 8);
        doc.setDrawColor(190, 196, 205);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(x, totalsStartY, boxWidth, 16, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(75, 85, 99);
        doc.text(total.label, x + 3, totalsStartY + 5);
        doc.setFontSize(10);
        doc.setTextColor(17, 24, 39);
        doc.text(total.value, x + 3, totalsStartY + 11.5);
      });

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`${page}/${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
      }

      const safeNumero = numero.replace(/[^0-9A-Za-z_-]/g, '') || 'pedido';
      doc.save(`pedido-${safeNumero}.pdf`);
      showToast('PDF baixado com sucesso. Abra pela pasta Downloads ou pelo gerenciador de downloads do navegador.', 'success', 5000);
    } catch {
      showToast('Não foi possível gerar o PDF do pedido.', 'error');
    }
  }, [
    clienteOptions,
    codigoCliente,
    codigoTransportadora,
    codigoVendedor,
    condicaoOptions,
    condicaoPagto,
    destinoPedido,
    frete,
    initialPedido,
    itens,
    lookupLabels,
    numPedido,
    showToast,
    totalItens,
    totalPedido,
    transportadoraOptions,
    vendedorOptions,
  ]);

  const handleChangeItem = (index: number, field: keyof ItemForm, value: string) => {
    setItens((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      let nextValue = value;
      if (field === 'Qtd_Entregar') {
        nextValue = sanitizeDecimalInput(value, 3);
      }
      if (field === 'Preco_Negociado') {
        nextValue = sanitizeDecimalInput(value, 4);
      }

      next[index] = {
        ...current,
        [field]: nextValue,
        ...(field === 'Preco_Negociado' ? { Preco_Base: nextValue } : {}),
      };

      if (field === 'Preco_Negociado') {
        setDescontoAplicadoNosItens(false);
      }

      return next;
    });
  };

  const handleBlurItem = (index: number, field: keyof ItemForm) => {
    if (field !== 'Qtd_Entregar' && field !== 'Preco_Negociado') return;

    setItens((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      if (field === 'Qtd_Entregar') {
        next[index] = {
          ...current,
          Qtd_Entregar: formatDecimalString(current.Qtd_Entregar, 3),
        };
      }

      if (field === 'Preco_Negociado') {
        const formatted = formatDecimalString(current.Preco_Negociado, 4);
        next[index] = {
          ...next[index],
          Preco_Negociado: formatted,
          Preco_Base: formatted,
        };
      }

      return next;
    });
  };

  const handleAddItem = () => {
    setItens((prev) => {
      const nextItem = emptyItem();
      const source = prev.find((item) => item.Pedido_Cliente?.trim() || item.Data_Entrega?.trim()) || prev[0];

      if (source) {
        nextItem.Pedido_Cliente = source.Pedido_Cliente || '';
        nextItem.Data_Entrega = source.Data_Entrega || '';
      }

      return [...prev, nextItem];
    });

    window.requestAnimationFrame(() => {
      const container = itensScrollAreaRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  const handleClickAdicionarItem = () => {
    if (isViewOnly) return;

    if (isMobileLayout) {
      setMobileItemEditIndex(null);
      const nextItem = emptyItem();
      const source = itens.find((item) => item.Pedido_Cliente?.trim() || item.Data_Entrega?.trim()) || itens[0];
      if (source) {
        nextItem.Pedido_Cliente = source.Pedido_Cliente || '';
        nextItem.Data_Entrega = source.Data_Entrega || '';
      }
      setMobileItemDraft(nextItem);
      setMobileItemModalOpen(true);
      return;
    }

    handleAddItem();
  };

  const handleRemoveItem = (index: number) => {
    setItens((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [emptyItem()];
    });

    if (mobileItemEditIndex === index) {
      setMobileItemEditIndex(null);
      setMobileItemDraft(emptyItem());
      setMobileItemModalOpen(false);
    }
  };

  const handleEditarItemMobile = (index: number) => {
    const item = itens[index];
    if (!item) return;

    setMobileItemEditIndex(index);
    setMobileItemDraft(item);
    setMobileItemModalOpen(true);
  };

  const mapTabelaPrecoRows = useCallback((payload: any): TabelaPrecoItem[] => {
    const rows = getRows(payload);
    return rows
      .map((item: any) => {
        const codigo = String(item?.codigo_Produto ?? item?.Codigo_Produto ?? item?.codigo ?? item?.material ?? '').trim();
        const descricao = String(
          item?.Descricao_Portug
          ?? item?.descricao_Portug
          ?? item?.descr_Produto
          ?? item?.Descr_Produto
          ?? item?.descricao
          ?? item?.descMaterial
          ?? '',
        ).trim();
        const unidade = String(item?.unid_Medida ?? item?.Unid_Medida ?? item?.unidade ?? item?.unid_Med_Venda ?? item?.Unid_Med_Venda ?? '').trim();
        const moeda = String(item?.Moeda_Tabela ?? item?.moeda_Tabela ?? item?.Moeda ?? item?.moeda ?? 'R$').trim() || 'R$';
        const preco = parseNumber(
          String(item?.Preco_Tabela ?? item?.preco_Tabela ?? item?.preco_Venda ?? item?.Preco_Venda ?? item?.preco ?? item?.valor ?? 0),
        );

        if (!codigo) return null;
        return {
          codigo,
          descricao: descricao || 'Sem descrição',
          unidade,
          moeda,
          preco,
        };
      })
      .filter((item): item is TabelaPrecoItem => Boolean(item));
  }, []);

  const carregarTabelaPreco = useCallback(
    async (filtro: string) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const codEmpresa = GlobalConfig.getCodEmpresa();

      if (!baseUrl || !token) {
        showToast('Sessão inválida para consultar tabela de preços.', 'error');
        return;
      }

      setLoadingTabelaPreco(true);
      try {
        const resp = await tabelaPrecoItensCall(
          baseUrl,
          token,
          codigoTabela || '0',
          codEmpresa ?? 0,
          filtro,
          '0',
        );
        const rows = mapTabelaPrecoRows(resp.jsonBody || resp.data);
        setTabelaPrecoRows(rows);
      } catch {
        showToast('Não foi possível consultar a tabela de preços.', 'error');
        setTabelaPrecoRows([]);
      } finally {
        setLoadingTabelaPreco(false);
      }
    },
    [codigoTabela, mapTabelaPrecoRows, showToast],
  );

  const handleAbrirConsultaPreco = async (index: number) => {
    if (!codigoCliente.trim()) {
      showToast('Informe o cliente antes de buscar itens.', 'error');
      return;
    }

    setItemConsultaPrecoIndex(index);
    setTabelaPrecoTermo('');
    setTabelaPrecoRows([]);
    setPrecoModalOpen(true);
  };

  const handleSelecionarItemTabelaPreco = (item: TabelaPrecoItem) => {
    if (itemConsultaPrecoIndex === null) return;
    const discounted = calculateDiscountedPrice(item.preco);

    setItens((prev) => {
      const next = [...prev];
      const current = next[itemConsultaPrecoIndex];
      if (!current) return prev;

      next[itemConsultaPrecoIndex] = {
        ...current,
        Codigo_Produto: item.codigo,
        Descricao_Produto: item.descricao,
        Preco_Negociado: formatFixedNumber(discounted.price, 4),
        Preco_Base: formatDecimalString(item.preco, 4),
        Unid_Med_Venda: item.unidade || current.Unid_Med_Venda,
        Moeda: item.moeda || current.Moeda,
        Moeda_Preco: item.moeda || current.Moeda_Preco,
      };
      return next;
    });

    if (discounted.applied) {
      setDescontoAplicadoNosItens(true);
    }

    setPrecoModalOpen(false);
  };

  const handleSelecionarItemTabelaPrecoMobile = (item: TabelaPrecoItem) => {
    const discounted = calculateDiscountedPrice(item.preco);

    setMobileItemDraft((prev) => ({
      ...prev,
      Codigo_Produto: item.codigo,
      Descricao_Produto: item.descricao,
      Preco_Negociado: formatFixedNumber(discounted.price, 4),
      Preco_Base: formatDecimalString(item.preco, 4),
      Unid_Med_Venda: item.unidade || prev.Unid_Med_Venda,
      Moeda: item.moeda || prev.Moeda,
      Moeda_Preco: item.moeda || prev.Moeda_Preco,
    }));

    if (discounted.applied) {
      setDescontoAplicadoNosItens(true);
    }

    setPrecoModalOpen(false);
  };

  const handleConfirmarItemMobile = () => {
    const codigoProduto = mobileItemDraft.Codigo_Produto.trim();
    const qtd = parseNumber(mobileItemDraft.Qtd_Entregar);

    if (!codigoProduto || qtd <= 0) {
      showToast('Informe produto e quantidade válida para adicionar o item.', 'error');
      return;
    }

    const normalizedItem: ItemForm = {
      ...mobileItemDraft,
      Codigo_Produto: codigoProduto,
      Qtd_Entregar: formatFixedNumber(qtd, 3),
      Preco_Negociado: formatDecimalString(mobileItemDraft.Preco_Negociado, 4),
      Preco_Base: formatDecimalString(mobileItemDraft.Preco_Base || mobileItemDraft.Preco_Negociado, 4),
    };

    if (mobileItemEditIndex === null) {
      const basePrice = parseNumber(normalizedItem.Preco_Base || normalizedItem.Preco_Negociado);
      const discounted = calculateDiscountedPrice(basePrice);
      normalizedItem.Preco_Negociado = formatFixedNumber(discounted.price, 4);
      if (discounted.applied) {
        setDescontoAplicadoNosItens(true);
      }
    }

    setItens((prev) => {
      if (mobileItemEditIndex === null) {
        return [...prev, normalizedItem];
      }

      const next = [...prev];
      if (!next[mobileItemEditIndex]) {
        return [...prev, normalizedItem];
      }

      next[mobileItemEditIndex] = normalizedItem;
      return next;
    });

    setMobileItemModalOpen(false);
    setMobileItemDraft(emptyItem());
    setMobileItemEditIndex(null);
  };

  const handleAbrirConsultaPrecoMobile = async () => {
    if (!codigoCliente.trim()) {
      showToast('Informe o cliente antes de buscar itens.', 'error');
      return;
    }

    setItemConsultaPrecoIndex(null);
    setTabelaPrecoTermo('');
    setTabelaPrecoRows([]);
    setPrecoModalOpen(true);
  };

  const handleSalvar = async (situacaoOverride?: number, itensOverride?: ItemForm[]) => {
    if (isViewOnly) return false;

    const sourceItens = itensOverride ?? itens;

    if (!codigoCliente || !condicaoPagto || !codigoVendedor) {
      showToast('Cliente, condição e vendedor são obrigatórios.', 'error');
      return false;
    }

    const itensInformados = sourceItens.filter((item) => item.Codigo_Produto.trim());

    const existeItemSemPedidoOuData = itensInformados.some(
      (item) => !item.Pedido_Cliente.trim() || !toIsoDate(item.Data_Entrega.trim()),
    );

    if (existeItemSemPedidoOuData) {
      showToast('Todos os itens devem ter Número do pedido do cliente e Data de entrega.', 'error');
      return false;
    }

    const itensValidos = sourceItens
      .map((item) => ({
        Num_Item: Number.isInteger(item.Num_Item) && Number(item.Num_Item) > 0 ? Number(item.Num_Item) : 0,
        Codigo_Produto: item.Codigo_Produto.trim(),
        Qtd_Entregar: roundTo(parseNumber(item.Qtd_Entregar), 3),
        // Persist the price shown in the grid to avoid hidden re-discount on save.
        Preco_Negociado: roundTo(parseNumber(item.Preco_Negociado), 4),
        Pedido_Cliente: item.Pedido_Cliente.trim(),
        Data_Entrega: toIsoDate(item.Data_Entrega.trim()),
        Unid_Med_Venda: item.Unid_Med_Venda.trim(),
        Moeda: item.Moeda.trim(),
        Casas_Decimais: 3,
      }))
      .filter((item) => item.Codigo_Produto && item.Qtd_Entregar > 0 && Boolean(item.Data_Entrega));

    if (itensValidos.length === 0) {
      showToast('Informe ao menos um item válido para o pedido.', 'error');
      return false;
    }

    const totalItensPedido = roundTo(
      itensValidos.reduce((acc, item) => acc + roundTo(item.Qtd_Entregar * item.Preco_Negociado, 2), 0),
      2,
    );
    const totalPedidoCalculado = roundTo(totalItensPedido + parseNumber(frete), 2);

    if (totalItensPedido <= 0 || totalPedidoCalculado <= 0) {
      showToast('Pedido e itens não podem ser 0.', 'error');
      return false;
    }

    let optionsForResolve = {
      cliente: clienteOptions,
      condicao: condicaoOptions,
      vendedor: vendedorOptions,
      transportadora: transportadoraOptions,
    };

    let codigoClienteNum =
      resolveNumericCode(codigoCliente, optionsForResolve.cliente)
      || getNumericFromObjectKeys(initialPedido, [
        'codigo_Cliente',
        'Codigo_Cliente',
        'cod_Cliente',
        'Cod_Cliente',
        'codCliente',
        'codigoCliente',
        'id_Cliente',
        'Id_Cliente',
      ]);

    let condicaoPagtoNum =
      resolveNumericCode(condicaoPagto, optionsForResolve.condicao)
      || getNumericFromObjectKeys(initialPedido, [
        'codigo_Condicao_Pagto',
        'Codigo_Condicao_Pagto',
        'codigoCondicaoPagto',
        'codigo_Condicao',
        'Codigo_Condicao',
        'cod_Condicao',
        'Cod_Condicao',
        'condicao_Codigo',
        'Condicao_Codigo',
      ]);

    let codigoVendedorNum =
      resolveNumericCode(codigoVendedor, optionsForResolve.vendedor)
      || getNumericFromObjectKeys(initialPedido, [
        'codigo_Vendedor',
        'Codigo_Vendedor',
        'cod_Vendedor',
        'Cod_Vendedor',
        'codigoVendedor',
      ]);

    let codigoTransportadoraNum =
      resolveNumericCode(codigoTransportadora, optionsForResolve.transportadora)
      || getNumericFromObjectKeys(initialPedido, [
        'codigo_Transportadora',
        'Codigo_Transportadora',
        'cod_Transportadora',
        'Cod_Transportadora',
        'codigoTransportadora',
      ]);

    const tabelaCodigoKeys = [
      'codigo_Tabela',
      'Codigo_Tabela',
      'codigoTabela',
      'codigo_Tabela_Preco',
      'Codigo_Tabela_Preco',
      'cod_Tabela',
      'Cod_Tabela',
      'tabela_Preco',
      'Tabela_Preco',
    ];

    const clienteSelecionadoRow = clienteRowsMap[normalizeCode(codigoCliente)] || null;

    let codigoTabelaNum =
      toIntegerCode(codigoTabela)
      || getNumericFromObjectKeys(clienteSelecionadoRow, tabelaCodigoKeys)
      || getNumericFromObjectKeys(initialPedido, tabelaCodigoKeys);

    if (codigoClienteNum <= 0 || condicaoPagtoNum <= 0 || codigoVendedorNum <= 0) {
      const loadedLists = await carregarListas();
      if (loadedLists) {
        optionsForResolve = {
          cliente: loadedLists.clienteOptions,
          condicao: loadedLists.condicaoOptions,
          vendedor: loadedLists.vendedorOptions,
          transportadora: loadedLists.transportadoraOptions,
        };

        codigoClienteNum =
          resolveNumericCode(codigoCliente, optionsForResolve.cliente)
          || getNumericFromObjectKeys(initialPedido, [
            'codigo_Cliente',
            'Codigo_Cliente',
            'cod_Cliente',
            'Cod_Cliente',
            'codCliente',
            'codigoCliente',
            'id_Cliente',
            'Id_Cliente',
          ]);

        condicaoPagtoNum =
          resolveNumericCode(condicaoPagto, optionsForResolve.condicao)
          || getNumericFromObjectKeys(initialPedido, [
            'codigo_Condicao_Pagto',
            'Codigo_Condicao_Pagto',
            'codigoCondicaoPagto',
            'codigo_Condicao',
            'Codigo_Condicao',
            'cod_Condicao',
            'Cod_Condicao',
            'condicao_Codigo',
            'Condicao_Codigo',
          ]);

        codigoVendedorNum =
          resolveNumericCode(codigoVendedor, optionsForResolve.vendedor)
          || getNumericFromObjectKeys(initialPedido, [
            'codigo_Vendedor',
            'Codigo_Vendedor',
            'cod_Vendedor',
            'Cod_Vendedor',
            'codigoVendedor',
          ]);

        codigoTransportadoraNum =
          resolveNumericCode(codigoTransportadora, optionsForResolve.transportadora)
          || getNumericFromObjectKeys(initialPedido, [
            'codigo_Transportadora',
            'Codigo_Transportadora',
            'cod_Transportadora',
            'Cod_Transportadora',
            'codigoTransportadora',
          ]);

        const clienteRecarregadoRow = loadedLists.clienteRowsMap?.[normalizeCode(codigoCliente)] || null;

        codigoTabelaNum =
          toIntegerCode(codigoTabela)
          || getNumericFromObjectKeys(clienteRecarregadoRow, tabelaCodigoKeys)
          || getNumericFromObjectKeys(initialPedido, tabelaCodigoKeys);
      }
    }

    if (codigoClienteNum <= 0 || condicaoPagtoNum <= 0 || codigoVendedorNum <= 0) {
      showToast('Cliente, condição e vendedor devem ter códigos válidos para salvar.', 'error');
      return false;
    }

    const payload = {
      Codigo_Empresa: Number(GlobalConfig.getCodEmpresa()) || 0,
      Codigo_Cliente: codigoClienteNum,
      Condicao_Pagto: Math.trunc(condicaoPagtoNum),
      Codigo_Vendedor: codigoVendedorNum,
      Perc_Desconto: parseNumber(descontoAplicado),
      Valor_Frete: parseNumber(frete),
      Tipo_Pedido: Math.trunc(Number(tipoPedido) || 0),
      Codigo_Transportadora: codigoTransportadoraNum,
      Frete_Por_Conta: Math.trunc(Number(fretePorConta) || 0),
      Destino_Pedido: normalizeDestinoPedidoValue(destinoPedido),
      Codigo_Emitente: String(GlobalConfig.getUsuario() || ''),
      Situacao_Pedido:
        typeof situacaoOverride === 'number'
          ? Math.trunc(situacaoOverride)
          : isEdit
            ? Math.trunc(getSituacaoCodeFromText(situacaoPedido))
            : 0,
      Itens_Pedido: itensValidos.map((item) => ({
        Num_Item: item.Num_Item,
        Codigo_Produto: item.Codigo_Produto,
        Qtd_Entregar: roundTo(item.Qtd_Entregar, 3),
        Preco_Negociado: formatFixedNumber(item.Preco_Negociado, 4),
        Total_Valor_Itens: roundTo(item.Qtd_Entregar * item.Preco_Negociado, 2),
        Descricao_Produto: String(
          sourceItens.find((it) => (Number.isInteger(it.Num_Item) && Number(it.Num_Item) > 0 ? Number(it.Num_Item) : 0) === item.Num_Item)
            ?.Descricao_Produto ?? '',
        ).trim(),
        Pedido_Cliente: item.Pedido_Cliente,
        Data_Entrega: item.Data_Entrega,
        Unid_Med_Venda: item.Unid_Med_Venda,
        Moeda: item.Moeda,
        Casas_Decimais: 3,
      })),
      Casas_Decimais: 3,
      Codigo_Tabela: String(codigoTabelaNum || 0),
      Perc_Desconto_Cliente: parseNumber(desconto),
      Codigo_Representante: codigoRepresentante ? Number(codigoRepresentante) || null : null,
      Perc_Comissao_Representante: codigoRepresentante ? parseNumber(percComissaoRep) : null,
      Valor_Total_Pedido: roundTo(totalPedidoCalculado, 2),
    };

    setSaving(true);
    try {
      if (isEdit && numPedido) {
        await alterarPedidoVenda(payload, numPedido);
        showToast('Pedido alterado com sucesso.', 'success');
      } else {
        await incluirPedidoVenda(payload);
        showToast('Pedido incluído com sucesso.', 'success');
      }

      if (onSaved) {
        await onSaved();
      }

      onClose();
      return true;
    } catch (error: any) {
      showToast(error?.message || 'Falha ao salvar pedido.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const numeroTitulo = cleanLabelText(numPedido ?? (initialPedido as any)?.num_Pedido ?? (initialPedido as any)?.numPedido ?? '');

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Pedido de venda${sufixoTitulo}`}>
      <article className={`modal-card modal-card--wide pedido-venda-form-modal${isViewOnly ? ' pedido-venda-form-modal--view' : ''}`}>
        <header className="modal-card__header">
          {isViewOnly ? (
            <div className="pedido-venda-consulta-title">
              <h2>{`Pedido ${numPedido ?? ''}`}</h2>
              {situacaoPedido ? <span className={`badge ${getSituacaoBadgeClass(situacaoPedido)} pedido-venda-consulta-situacao`}>{situacaoPedido}</span> : null}
            </div>
          ) : (
            <h2>{isEdit ? `Editar pedido: ${numeroTitulo || '-'}` : `Novo pedido de venda${sufixoTitulo}`}</h2>
          )}
          <div className="pedido-venda-header-actions">
            {!isViewOnly ? (
              <button
                type="button"
                className="icon-button module-action-button module-action-button--primary"
                aria-label="Salvar"
                title="Salvar"
                onClick={() => void handleSalvar(-1)}
                disabled={saving || loading}
              >
                <IoSaveOutline size={18} />
              </button>
            ) : null}
            <button type="button" className="icon-button" aria-label="Fechar" onClick={requestCloseForm}>
              <IoCloseOutline size={18} />
            </button>
          </div>
        </header>

        <section className="module-form">
          {loading ? (
            <p className="module-empty">Carregando pedido...</p>
          ) : (
            <>
              <div className="form-grid-3">
                {isViewOnly ? (
                  <div className="pedido-venda-static-grid form-grid-3__full">
                    <label>
                      <span>Cliente</span>
                      <div className="pedido-venda-static-value">
                        {lookupLabels.cliente || findOptionLabel(clienteOptions, codigoCliente)}
                      </div>
                    </label>
                    <label>
                      <span>Vendedor</span>
                      <div className="pedido-venda-static-value">
                        {lookupLabels.vendedor || findOptionLabel(vendedorOptions, codigoVendedor)}
                      </div>
                    </label>
                  </div>
                ) : (
                  <>
                    <label>
                      <span>Cliente *</span>
                      <SearchableSelect
                        value={codigoCliente}
                        onChange={(nextValue) => handleChangeCliente(nextValue)}
                        options={clienteOptions}
                        searchPlaceholder="Pesquisar cliente"
                        ariaLabel="Cliente"
                        disabled={isViewOnly || isEdit}
                      />
                    </label>
                    <label>
                      <span>Condição pgto *</span>
                      <SearchableSelect
                        value={condicaoPagto}
                        onChange={setCondicaoPagto}
                        options={condicaoOptions}
                        searchPlaceholder="Pesquisar condição"
                        ariaLabel="Condição de pagamento"
                        disabled={isViewOnly || isRepresentantes}
                      />
                    </label>
                    <label>
                      <span>Vendedor *</span>
                      <SearchableSelect
                        value={codigoVendedor}
                        onChange={setCodigoVendedor}
                        options={vendedorOptions}
                        searchPlaceholder="Pesquisar vendedor"
                        ariaLabel="Vendedor"
                        disabled={isViewOnly || isRepresentantes}
                      />
                    </label>
                    <label>
                      <span>Desconto do cliente (%)</span>
                      <input readOnly value={desconto} />
                    </label>
                    <label>
                      <span>Frete</span>
                      <input readOnly value={frete} />
                    </label>
                    <label>
                      <span>Desconto aplicado (%)</span>
                      <div className="pedido-venda-desconto-aplicado-wrap">
                        <input
                          readOnly={isViewOnly}
                          value={descontoAplicado}
                          inputMode="decimal"
                          onChange={(event) => handleChangeDescontoAplicado(event.target.value)}
                          onBlur={handleBlurDescontoAplicado}
                        />
                      </div>
                    </label>
                    <label>
                      <span>Transportadora</span>
                      <SearchableSelect
                        value={codigoTransportadora}
                        onChange={setCodigoTransportadora}
                        options={transportadoraOptions}
                        searchPlaceholder="Pesquisar transportadora"
                        ariaLabel="Transportadora"
                        disabled={isViewOnly || isRepresentantes}
                      />
                    </label>
                    <label>
                      <span>Frete por conta</span>
                      <SearchableSelect
                        value={fretePorConta}
                        onChange={setFretePorConta}
                        options={fretePorContaSelectOptions}
                        searchPlaceholder="Pesquisar tipo de frete"
                        ariaLabel="Frete por conta"
                        disabled={isViewOnly || isRepresentantes}
                      />
                    </label>
                    <label>
                      <span>Destino pedido</span>
                      <SearchableSelect
                        value={destinoPedido}
                        onChange={setDestinoPedido}
                        options={destinoPedidoOptions}
                        searchPlaceholder="Pesquisar destino"
                        ariaLabel="Destino do pedido"
                        disabled={isViewOnly || isRepresentantes}
                      />
                    </label>
                    {!isRepresentantes ? (
                      <>
                        <label>
                          <span>Representante</span>
                          <input
                            readOnly={isViewOnly}
                            value={codigoRepresentante}
                            onChange={(event) => setCodigoRepresentante(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>% Comissão rep.</span>
                          <input readOnly={isViewOnly} value={percComissaoRep} onChange={(event) => setPercComissaoRep(event.target.value)} />
                        </label>
                      </>
                    ) : null}
                  </>
                )}
              </div>

              <div className="module-items-header">
                <h2>Itens do pedido</h2>
                {!isViewOnly ? (
                  <div className="pedido-venda-items-actions">
                    <button
                      className="icon-button module-action-button module-action-button--primary"
                      type="button"
                      onClick={handleClickAdicionarItem}
                      aria-label="Incluir item"
                      title="Incluir item"
                    >
                      <IoAddOutline size={16} />
                    </button>
                    {isRepresentantes && allowImportSpreadsheet ? (
                      <button
                        className="icon-button module-action-button module-action-button--primary"
                        type="button"
                        onClick={handleClickImportarPlanilha}
                        aria-label="Importar planilha"
                        title="Importar planilha"
                      >
                        <IoDocumentTextOutline size={16} />
                      </button>
                    ) : null}
                    <input
                      ref={fileInputPlanilhaRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handlePlanilhaFileSelected}
                      style={{ display: 'none' }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="pedido-venda-itens-scroll-area" ref={itensScrollAreaRef}>
                {isViewOnly ? (
                  <div className="pedido-venda-itens-consulta-list" role="list" aria-label="Itens do pedido">
                    <article
                      className={`pedido-venda-consulta-row pedido-venda-consulta-row--header${isRepresentantes ? ' pedido-venda-consulta-row--representante' : ''}`}
                      aria-hidden="true"
                    >
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--item"><strong>Item</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--codigo"><strong>Código</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--descricao"><strong>Descrição</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--unidade"><strong>Unid.</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd"><strong>Qtd</strong></div>
                      {!isRepresentantes ? (
                        <>
                          <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd"><strong>Entregue</strong></div>
                          <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd"><strong>Saldo</strong></div>
                        </>
                      ) : null}
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--valor"><strong>Preço</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--valor"><strong>Total item</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--pedido-cliente"><strong>Pedido cliente</strong></div>
                      <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--data"><strong>Data entrega</strong></div>
                    </article>
                    {itens.map((item, index) => {
                    const totalItem = parseNumber(
                      item.Total_Item ?? String(parseNumber(item.Qtd_Entregar) * parseNumber(item.Preco_Negociado)),
                    );

                    return (
                      <article
                        key={`item-consulta-${index}`}
                        className={`pedido-venda-consulta-row${isRepresentantes ? ' pedido-venda-consulta-row--representante' : ''}`}
                        role="listitem"
                      >
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--item">
                          <span className="pedido-venda-consulta-label">Item</span>
                          <strong>{item.Num_Item ?? index + 1}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--codigo">
                          <span className="pedido-venda-consulta-label">Código</span>
                          <strong>{item.Codigo_Produto || '-'}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--descricao">
                          <span className="pedido-venda-consulta-label">Descrição</span>
                          <strong title={item.Descricao_Produto || '-'}>{item.Descricao_Produto || '-'}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--unidade">
                          <span className="pedido-venda-consulta-label">Unid.</span>
                          <strong>{item.Unid_Med_Venda || '-'}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd">
                          <span className="pedido-venda-consulta-label">Qtd</span>
                          <strong>{formatDecimalString(item.Qtd_Entregar, 3)}</strong>
                        </div>
                        {!isRepresentantes ? (
                          <>
                            <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd">
                              <span className="pedido-venda-consulta-label">Entregue</span>
                              <strong>{item.Qtd_Entregue || '0'}</strong>
                            </div>
                            <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--qtd">
                              <span className="pedido-venda-consulta-label">Saldo</span>
                              <strong>{item.Saldo || '0'}</strong>
                            </div>
                          </>
                        ) : null}
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--valor">
                          <span className="pedido-venda-consulta-label">Preço</span>
                          <strong>{formatMoney(item.Preco_Negociado, item.Moeda_Preco || 'R$', 4)}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--valor">
                          <span className="pedido-venda-consulta-label">Total item</span>
                          <strong>{formatMoney(totalItem, item.Moeda_Preco || 'R$')}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--pedido-cliente">
                          <span className="pedido-venda-consulta-label">Pedido cliente</span>
                          <strong>{item.Pedido_Cliente || '-'}</strong>
                        </div>
                        <div className="pedido-venda-consulta-cell pedido-venda-consulta-cell--data">
                          <span className="pedido-venda-consulta-label">Data entrega</span>
                          <strong>{item.Data_Entrega || '-'}</strong>
                        </div>
                      </article>
                    );
                    })}
                  </div>
                ) : (
                  <div className="pedido-venda-itens-desktop-cards">
                    {itens.map((item, index) => {
                    const totalItem = parseNumber(item.Qtd_Entregar) * parseNumber(item.Preco_Negociado);

                    return (
                      <article key={`item-desktop-${index}`} className="pedido-venda-item-ficha-card">
                        <div className="pedido-venda-item-ficha-row pedido-venda-item-ficha-row--top">
                          <label className="pedido-venda-item-ficha-field pedido-venda-item-ficha-field--item">
                            <span>Item</span>
                            <div className="pedido-venda-readonly-value">{item.Num_Item ?? index + 1}</div>
                          </label>

                          <label className="pedido-venda-item-ficha-field pedido-venda-item-ficha-field--search">
                            <span>Busca</span>
                            <button
                              className="icon-button module-action-button ordens-servico-produto-search"
                              type="button"
                              onClick={() => void handleAbrirConsultaPreco(index)}
                              aria-label="Consultar tabela de preços"
                              title="Consultar tabela de preços"
                            >
                              <IoSearchOutline size={16} />
                            </button>
                          </label>

                          <label className="pedido-venda-item-ficha-field pedido-venda-item-ficha-field--codigo">
                            <span>Código do produto *</span>
                            {isRepresentantes ? (
                              <div className="pedido-venda-readonly-value">{item.Codigo_Produto || '-'}</div>
                            ) : (
                              <input
                                value={item.Codigo_Produto}
                                onChange={(event) => handleChangeItem(index, 'Codigo_Produto', event.target.value)}
                              />
                            )}
                          </label>

                          <label className="pedido-venda-item-ficha-field pedido-venda-item-ficha-field--descricao">
                            <span>Descrição</span>
                            <div className="pedido-venda-readonly-value">{item.Descricao_Produto || '-'}</div>
                          </label>

                          <div className="pedido-venda-item-ficha-actions pedido-venda-item-ficha-actions--inline">
                            <button
                              className="icon-button module-action-button danger"
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              title="Excluir item"
                              aria-label="Excluir item"
                            >
                              <IoTrashOutline size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="pedido-venda-item-ficha-row pedido-venda-item-ficha-row--bottom">
                          <label className="pedido-venda-item-ficha-field">
                            <span>Qtd *</span>
                            <input
                              value={item.Qtd_Entregar}
                              onChange={(event) => handleChangeItem(index, 'Qtd_Entregar', event.target.value)}
                              onBlur={() => handleBlurItem(index, 'Qtd_Entregar')}
                            />
                          </label>

                          <label className="pedido-venda-item-ficha-field">
                            <span>Unidade</span>
                            <div className="pedido-venda-readonly-value">{item.Unid_Med_Venda || '-'}</div>
                          </label>

                          <label className="pedido-venda-item-ficha-field">
                            <span>Moeda</span>
                            <div className="pedido-venda-readonly-value">{item.Moeda || item.Moeda_Preco || '-'}</div>
                          </label>

                          <label className="pedido-venda-item-ficha-field">
                            <span>Preço *</span>
                            {isRepresentantes ? (
                              <div className="pedido-venda-readonly-value">
                                {parseNumber(item.Preco_Negociado).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                            ) : (
                              <input
                                value={item.Preco_Negociado}
                                onChange={(event) => handleChangeItem(index, 'Preco_Negociado', event.target.value)}
                                onBlur={() => handleBlurItem(index, 'Preco_Negociado')}
                              />
                            )}
                          </label>

                          <label className="pedido-venda-item-ficha-field pedido-venda-item-ficha-field--pedido-cliente">
                            <span>Pedido cliente</span>
                            <input
                              value={item.Pedido_Cliente}
                              onChange={(event) => handleChangeItem(index, 'Pedido_Cliente', event.target.value)}
                            />
                          </label>

                          <label className="pedido-venda-item-ficha-field">
                            <span>Data entrega</span>
                            <CustomDatePicker
                              value={item.Data_Entrega}
                              onChange={(nextDate) => handleChangeItem(index, 'Data_Entrega', nextDate)}
                            />
                          </label>

                          <label className="pedido-venda-item-ficha-field">
                            <span>Total item</span>
                            <div className="pedido-venda-readonly-value">
                              {totalItem.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </label>
                        </div>
                      </article>
                    );
                    })}
                  </div>
                )}

                <div className="pedido-venda-itens-mobile-list">
                  {itens.map((item, index) => {
                  const moedaItem = item.Moeda || item.Moeda_Preco || 'R$';
                  const itemCardKey = `item-${index}-${item.Codigo_Produto || 'sem-codigo'}`;
                  const isExpandedCard = Boolean(expandedMobileItemCards[itemCardKey]);

                  return (
                    <article
                      className={`module-card${isViewOnly ? '' : ' module-row-clickable'}`}
                      key={`item-mobile-${index}`}
                      role={isViewOnly ? undefined : 'button'}
                      tabIndex={isViewOnly ? undefined : 0}
                      onClick={() => {
                        if (isViewOnly) return;
                        handleEditarItemMobile(index);
                      }}
                      onKeyDown={(event) => {
                        if (isViewOnly) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleEditarItemMobile(index);
                        }
                      }}
                    >
                      <div className="module-card__row module-card__row--split">
                        <div className="module-card__row-stack">
                          <span>Código</span>
                          <strong>{item.Codigo_Produto || '-'}</strong>
                        </div>
                        <button
                          type="button"
                          className="module-card__expand-toggle"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedMobileItemCards((prev) => ({
                              ...prev,
                              [itemCardKey]: !prev[itemCardKey],
                            }));
                          }}
                          aria-label={isExpandedCard ? 'Recolher detalhes do item' : 'Expandir detalhes do item'}
                          title={isExpandedCard ? 'Recolher detalhes' : 'Expandir detalhes'}
                        >
                          {isExpandedCard ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                        </button>
                      </div>
                      <div className="module-card__row">
                        <span>Descrição</span>
                        <strong>{item.Descricao_Produto || '-'}</strong>
                      </div>
                      {isExpandedCard ? (
                        <>
                          <div className="module-card__row">
                            <span>Unidade</span>
                            <strong>{item.Unid_Med_Venda || '-'}</strong>
                          </div>
                          <div className="module-card__row">
                            <span>Qtd</span>
                            <strong>{formatDecimalString(item.Qtd_Entregar, 3)}</strong>
                          </div>
                          {!isRepresentantes ? (
                            <>
                              <div className="module-card__row">
                                <span>Qtd entregue</span>
                                <strong>{item.Qtd_Entregue || '0'}</strong>
                              </div>
                              <div className="module-card__row">
                                <span>Saldo</span>
                                <strong>{item.Saldo || '0'}</strong>
                              </div>
                            </>
                          ) : null}
                          <div className="module-card__row">
                            <span>Moeda</span>
                            <strong>{moedaItem}</strong>
                          </div>
                          <div className="module-card__row">
                            <span>Preço</span>
                            <strong>
                              {moedaItem + ' '}
                              {parseNumber(item.Preco_Negociado).toLocaleString('pt-BR', {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}
                            </strong>
                          </div>
                          <div className="module-card__row">
                            <span>Total item</span>
                            <strong>
                              {moedaItem + ' '}
                              {parseNumber(item.Total_Item ?? String(parseNumber(item.Qtd_Entregar) * parseNumber(item.Preco_Negociado))).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </strong>
                          </div>
                          <div className="module-card__row">
                            <span>Pedido cliente</span>
                            <strong>{item.Pedido_Cliente || '-'}</strong>
                          </div>
                          <div className="module-card__row">
                            <span>Data entrega</span>
                            <strong>{item.Data_Entrega || '-'}</strong>
                          </div>
                          {!isViewOnly ? (
                            <div className="module-card__actions pedido-venda-item-mobile-actions">
                              <button
                                className="icon-button module-action-button danger"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveItem(index);
                                }}
                                title="Excluir item"
                                aria-label="Excluir item"
                              >
                                <IoTrashOutline size={16} />
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </article>
                  );
                  })}
                </div>
              </div>

              {!isViewOnly ? (
                <>
                  <div className="pedido-venda-total-footer-row">
                    <div className="module-summary module-summary--single module-summary--muted pedido-venda-total-footer">
                      <article>
                        <span>Total de itens do pedido</span>
                        <strong>{itens.length.toLocaleString('pt-BR')}</strong>
                      </article>
                    </div>

                    <div className="module-summary module-summary--single module-summary--muted pedido-venda-total-footer">
                      <article>
                        <span>Total dos itens</span>
                        <strong>
                          {totalItens.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </article>
                    </div>

                    <div className="module-summary module-summary--single module-summary--muted pedido-venda-total-footer">
                      <article>
                        <span>Total do pedido</span>
                        <strong>
                          {totalPedido.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </article>
                    </div>

                    <div className="form-actions pedido-venda-total-footer__actions">
                      <button className="secondary-button" type="button" onClick={requestCloseForm}>
                        Cancelar
                      </button>

                      <button className="primary-button" type="button" onClick={() => void handleSalvar(0)} disabled={saving}>
                        {saving ? 'Salvando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>

        {isViewOnly && !loading ? (
          <footer className="pedido-venda-consulta-footer">
            <div className="pedido-venda-consulta-total-group">
              <div className="pedido-venda-consulta-total">
                <span>Total de itens do pedido</span>
                <strong>{itens.length.toLocaleString('pt-BR')}</strong>
              </div>
              <div className="pedido-venda-consulta-total">
                <span>Total do pedido</span>
                <strong>{formatMoney(totalPedido, 'R$')}</strong>
              </div>
            </div>
            <div className="pedido-venda-consulta-actions">
              <button className="secondary-button" type="button" onClick={handleImprimirPedidoPDF}>
                Imprimir PDF
              </button>
              <button className="secondary-button" type="button" onClick={requestCloseForm}>
                Fechar
              </button>
            </div>
          </footer>
        ) : null}
      </article>

      {planilhaPreviewOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização da planilha">
          <article className="modal-card modal-card--wide pedido-venda-planilha-modal">
            <header className="modal-card__header">
              <h2>Importação de planilha</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (importandoPlanilha) return;
                  setPlanilhaPreviewOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <section className="module-form">
              <div className="pedido-venda-planilha-layout">
                <div className="pedido-venda-planilha-header-info">
                  <p>
                    Arquivo: <strong>{planilhaNomeArquivo || '-'}</strong>
                  </p>
                </div>

                <label className="list-layout-field ordens-servico-material-search-field" aria-label="Pesquisar item na planilha">
                  <span>Pesquisar item na planilha</span>
                  <div className="clientes-search__input-wrap">
                    <IoSearchOutline size={16} aria-hidden="true" />
                    <input
                      value={planilhaFiltroBusca}
                      onChange={(event) => setPlanilhaFiltroBusca(event.target.value)}
                      placeholder="Digite código, descrição ou status"
                    />
                    {planilhaFiltroBusca.trim() ? (
                      <button
                        type="button"
                        className="clientes-search__clear"
                        onClick={() => setPlanilhaFiltroBusca('')}
                        aria-label="Limpar pesquisa"
                        title="Limpar"
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                </label>

                <div className="module-table pedido-venda-planilha-table">
                  <div className="table-scroll pedido-venda-planilha-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Código do produto</th>
                          <th>Qtd produto</th>
                          <th>Status</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planilhaItensPreviewFiltrados.map(({ item, index }) => {
                          const validacaoRaw = (item.Validacao || item.statusMensagem || '').toString().trim().toUpperCase();
                          const validacao =
                            validacaoRaw === 'OK' || validacaoRaw === 'X' || validacaoRaw === 'I'
                              ? validacaoRaw
                              : validacaoRaw === 'T' || validacaoRaw === 'S/TABELA'
                                ? 'T'
                                : '';
                          const statusLabel =
                            validacao === 'OK'
                              ? 'OK'
                              : validacao === 'X'
                                ? 'X'
                                : validacao === 'I'
                                  ? 'I'
                                  : validacao === 'T'
                                    ? 'S/Tabela'
                                    : '-';
                          const statusTextClass =
                            validacao === 'OK'
                              ? 'pedido-venda-planilha-status-text--ok'
                              : validacao === 'X'
                                ? 'pedido-venda-planilha-status-text--x'
                                : validacao === 'I'
                                  ? 'pedido-venda-planilha-status-text--i'
                                  : validacao === 'T'
                                    ? 'pedido-venda-planilha-status-text--t'
                                    : '';

                          return (
                          <tr key={`planilha-item-${index}`}>
                            <td>{item.Codigo_Produto}</td>
                            <td>
                              <input
                                value={item.Qtd_Produto.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                onChange={(event) => handleChangeQtdPlanilhaPreview(index, event.target.value)}
                              />
                            </td>
                            <td>
                              {item.Imagem_Status ? (
                                <div className="pedido-venda-planilha-status-cell">
                                  <img
                                    src={item.Imagem_Status}
                                    alt={`Status ${item.Validacao || ''} do item ${item.Codigo_Produto}`}
                                    className="pedido-venda-planilha-status-thumb"
                                  />
                                  <button
                                    type="button"
                                    className="icon-button module-action-button"
                                    title="Ver imagem"
                                    aria-label="Ver imagem"
                                    onClick={() => {
                                      setImagemStatusSrc(item.Imagem_Status || '');
                                      setImagemStatusTitulo(`Item ${item.Codigo_Produto} - ${item.Validacao || ''}`);
                                      setImagemStatusOpen(true);
                                    }}
                                  >
                                    <IoSearchOutline size={14} />
                                  </button>
                                  <span className={`pedido-venda-planilha-status-text ${statusTextClass}`}>{statusLabel}</span>
                                </div>
                              ) : (
                                <span className={`pedido-venda-planilha-status-text ${statusTextClass}`}>{statusLabel}</span>
                              )}
                            </td>
                            <td>
                              <button
                                className="icon-button module-action-button danger"
                                type="button"
                                onClick={() => handleRemoverItemPlanilhaPreview(index)}
                                title="Excluir item"
                              >
                                <IoTrashOutline size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                        })}
                        {planilhaItensPreviewFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="module-empty">Nenhum item encontrado para o filtro informado.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <footer className="pedido-venda-planilha-footer">
                  <div className="pedido-venda-planilha-resumo">
                    <strong>Sumário de validação</strong>
                    <span>Total de itens: {planilhaItensPreview.length}</span>
                    <span>Exibindo: {planilhaItensPreviewFiltrados.length}</span>
                  </div>
                  <div className="pedido-venda-planilha-legenda">
                    <span className="pedido-venda-planilha-legenda__item pedido-venda-planilha-legenda__item--ok">
                      (OK): item válido ({resumoPlanilhaStatus.ok})
                    </span>
                    <span className="pedido-venda-planilha-legenda__item pedido-venda-planilha-legenda__item--x">
                      (X): item inválido ({resumoPlanilhaStatus.x})
                    </span>
                    <span className="pedido-venda-planilha-legenda__item pedido-venda-planilha-legenda__item--i">
                      (I): item inativo ({resumoPlanilhaStatus.i})
                    </span>
                    <span className="pedido-venda-planilha-legenda__item pedido-venda-planilha-legenda__item--t">
                      (S/Tabela): item sem tabela de preço ({resumoPlanilhaStatus.t})
                    </span>
                  </div>

                  <div className="form-actions pedido-venda-planilha-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setPlanilhaPreviewOpen(false)}
                      disabled={importandoPlanilha}
                    >
                      Cancelar
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void handleImportarPlanilha()}
                      disabled={importandoPlanilha || !podeConfirmarImportacaoPlanilha}
                    >
                      {importandoPlanilha ? 'Importando...' : 'Confirmar'}
                    </button>
                  </div>
                </footer>
              </div>
            </section>
          </article>
        </section>
      ) : null}

      {imagemStatusOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Visualização da imagem de validação">
          <article className="modal-card pedido-venda-status-image-modal">
            <header className="modal-card__header">
              <h2>{imagemStatusTitulo || 'Imagem de validação'}</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setImagemStatusOpen(false)}>
                <IoCloseOutline size={18} />
              </button>
            </header>
            <section className="module-form pedido-venda-status-image-body">
              {imagemStatusSrc ? <img src={imagemStatusSrc} alt={imagemStatusTitulo || 'Imagem de validação'} /> : <p className="module-empty">Imagem não disponível.</p>}
            </section>
          </article>
        </section>
      ) : null}

      {dadosImportacaoOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Dados para importação da planilha">
          <article className="modal-card pedido-venda-importar-dados-modal">
            <header className="modal-card__header">
              <h2>Importar planilha</h2>
            </header>
            <section className="module-form">
              <div className="form-grid-3">
                <label>
                  <span>Pedido cliente *</span>
                  <input
                    value={pedidoClienteImportacao}
                    onChange={(event) => setPedidoClienteImportacao(event.target.value)}
                    placeholder="Informe o pedido do cliente"
                  />
                </label>

                <label>
                  <span>Data de entrega *</span>
                  <CustomDatePicker
                    value={dataEntregaImportacao}
                    onChange={setDataEntregaImportacao}
                  />
                </label>
              </div>

              <div className="form-actions pedido-venda-confirm-actions">
                <button className="secondary-button" type="button" onClick={() => setDadosImportacaoOpen(false)}>
                  Não
                </button>
                <button className="primary-button" type="button" onClick={handleConfirmarDadosImportacao}>
                  Sim
                </button>
              </div>
            </section>
          </article>
        </section>
      ) : null}

      {confirmarImportacaoOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar importação de planilha">
          <article className="modal-card pedido-venda-confirm-modal">
            <header className="modal-card__header">
              <h2>Importar planilha</h2>
            </header>
            <section className="module-form">
              <p>Se houver itens incluídos neste pedido, eles serão perdidos. Deseja continuar?</p>
              <div className="form-actions pedido-venda-confirm-actions">
                <button className="secondary-button" type="button" onClick={() => setConfirmarImportacaoOpen(false)}>
                  Não
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setConfirmarImportacaoOpen(false);
                    fileInputPlanilhaRef.current?.click();
                  }}
                >
                  Sim
                </button>
              </div>
            </section>
          </article>
        </section>
      ) : null}

      {confirmarFechamentoOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar fechamento do pedido">
          <article className="modal-card pedido-venda-confirm-modal">
            <header className="modal-card__header">
              <h2>Confirmar fechamento</h2>
            </header>
            <section className="module-form">
              <p>As alterações não salvas serão perdidas. Deseja realmente fechar?</p>
              <div className="form-actions pedido-venda-confirm-actions">
                <button className="secondary-button" type="button" onClick={() => setConfirmarFechamentoOpen(false)}>
                  Não
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setConfirmarFechamentoOpen(false);
                    onClose();
                  }}
                >
                  Sim
                </button>
              </div>
            </section>
          </article>
        </section>
      ) : null}

      {precoModalOpen && (
        <section className="modal-backdrop pedido-venda-tabela-preco-backdrop" role="dialog" aria-modal="true" aria-label="Tabela de preços do item">
          <article className="modal-card modal-card--wide pedido-venda-tabela-preco-modal">
            <header className="modal-card__header">
              <h2>Tabela de preços</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setPrecoModalOpen(false)}>
                <IoCloseOutline size={18} />
              </button>
            </header>

            <label className="list-layout-field ordens-servico-material-search-field" aria-label="Pesquisar item na tabela">
              <span>Pesquisar item</span>
              <div className="clientes-search__input-wrap">
                <IoSearchOutline size={16} aria-hidden="true" />
                <input
                  value={tabelaPrecoTermo}
                  onChange={(event) => setTabelaPrecoTermo(event.target.value)}
                  placeholder="Digite código ou descrição"
                />
                {tabelaPrecoTermo.trim() ? (
                  <button
                    type="button"
                    className="clientes-search__clear"
                    onClick={() => setTabelaPrecoTermo('')}
                    aria-label="Limpar pesquisa"
                    title="Limpar"
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>

            <div className="form-actions pedido-venda-tabela-preco-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void carregarTabelaPreco(tabelaPrecoTermo)}
                disabled={loadingTabelaPreco || !tabelaPrecoTermo.trim()}
              >
                {loadingTabelaPreco ? 'Consultando...' : 'Buscar'}
              </button>
            </div>

            {loadingTabelaPreco ? (
              <p className="module-empty">Carregando tabela de preços...</p>
            ) : tabelaPrecoRows.length === 0 ? (
              <p className="module-empty">Nenhum item encontrado na tabela de preços.</p>
            ) : tabelaPrecoRowsFiltradas.length === 0 ? (
              <p className="module-empty">Nenhum item encontrado para o filtro informado.</p>
            ) : (
              <div className="module-table pedido-venda-tabela-preco-table">
                <div className="table-scroll pedido-venda-tabela-preco-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Unidade</th>
                        <th>Preço</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabelaPrecoRowsFiltradas.map((row, index) => (
                          <tr key={`${row.codigo}-${index}`}>
                            <td>{row.codigo}</td>
                            <td>{row.descricao}</td>
                            <td>{row.unidade || '-'}</td>
                            <td>
                              {row.preco.toLocaleString('pt-BR', {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}
                            </td>
                            <td className="pedido-venda-tabela-preco-action-cell">
                              <button
                                className="icon-button module-action-button module-action-button--primary ordens-servico-material-add pedido-venda-tabela-preco-action-button"
                                type="button"
                                onClick={() => {
                                  if (itemConsultaPrecoIndex === null) {
                                    handleSelecionarItemTabelaPrecoMobile(row);
                                    return;
                                  }

                                  handleSelecionarItemTabelaPreco(row);
                                }}
                                aria-label={`Selecionar item ${row.codigo}`}
                                title="Selecionar"
                              >
                                <IoAddOutline size={16} />
                              </button>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pedido-venda-tabela-preco-cards">
                  {tabelaPrecoRowsFiltradas.map((row, index) => (
                    <article className="module-card" key={`card-${row.codigo}-${index}`}>
                      <div className="module-card__row">
                        <span>Código</span>
                        <strong>{row.codigo}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Descrição</span>
                        <strong>{row.descricao}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Unidade</span>
                        <strong>{row.unidade || '-'}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Preço</span>
                        <strong>
                          {row.preco.toLocaleString('pt-BR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                        </strong>
                      </div>
                      <div className="module-card__actions pedido-venda-tabela-preco-card-actions">
                        <button
                          className="icon-button module-action-button module-action-button--primary ordens-servico-material-add pedido-venda-tabela-preco-action-button"
                          type="button"
                          onClick={() => {
                            if (itemConsultaPrecoIndex === null) {
                              handleSelecionarItemTabelaPrecoMobile(row);
                              return;
                            }

                            handleSelecionarItemTabelaPreco(row);
                          }}
                          aria-label={`Selecionar item ${row.codigo}`}
                          title="Selecionar"
                        >
                          <IoAddOutline size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </article>
        </section>
      )}

      {mobileItemModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Adicionar item do pedido">
          <article className="modal-card pedido-venda-item-mobile-modal">
            <header className="modal-card__header">
              <h2>{mobileItemEditIndex === null ? 'Adicionar item' : 'Editar item'}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setMobileItemModalOpen(false);
                  setMobileItemEditIndex(null);
                  setMobileItemDraft(emptyItem());
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3 pedido-venda-item-mobile-form">
              {isRepresentantes ? (
                <>
                  <label>
                    <span>Item</span>
                    <input
                      readOnly
                      value={mobileItemDraft.Num_Item || String((mobileItemEditIndex ?? itens.length) + 1)}
                    />
                  </label>

                  <label className="form-grid-3__full">
                    <span>Código do item *</span>
                    <div className="ordens-servico-produto-input pedido-venda-item-produto-input">
                      <button
                        className="icon-button module-action-button ordens-servico-produto-search"
                        type="button"
                        onClick={() => void handleAbrirConsultaPrecoMobile()}
                        aria-label="Consultar tabela de preços"
                        title="Consultar tabela de preços"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                      <input
                        value={mobileItemDraft.Codigo_Produto}
                        readOnly
                        onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Codigo_Produto: event.target.value }))}
                      />
                    </div>
                  </label>
                </>
              ) : (
                <label className="form-grid-3__full">
                  <span>Produto *</span>
                  <div className="ordens-servico-produto-input pedido-venda-item-produto-input">
                    <input
                      value={mobileItemDraft.Codigo_Produto}
                      onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Codigo_Produto: event.target.value }))}
                    />
                    <button
                      className="icon-button module-action-button ordens-servico-produto-search"
                      type="button"
                      onClick={() => void handleAbrirConsultaPrecoMobile()}
                      aria-label="Consultar tabela de preços"
                      title="Consultar tabela de preços"
                    >
                      <IoSearchOutline size={16} />
                    </button>
                  </div>
                </label>
              )}

              <label>
                <span>Descrição</span>
                <input value={mobileItemDraft.Descricao_Produto} readOnly />
              </label>

              <label>
                <span>Qtd *</span>
                <input
                  value={mobileItemDraft.Qtd_Entregar}
                  onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Qtd_Entregar: sanitizeDecimalInput(event.target.value, 3) }))}
                  onBlur={() => setMobileItemDraft((prev) => ({ ...prev, Qtd_Entregar: formatDecimalString(prev.Qtd_Entregar, 3) }))}
                />
              </label>

              <label>
                <span>Preço *</span>
                <input
                  value={mobileItemDraft.Preco_Negociado}
                  readOnly={isRepresentantes}
                  onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Preco_Negociado: sanitizeDecimalInput(event.target.value, 4) }))}
                  onBlur={() => setMobileItemDraft((prev) => {
                    const formatted = formatDecimalString(prev.Preco_Negociado, 4);
                    return {
                      ...prev,
                      Preco_Negociado: formatted,
                      Preco_Base: formatted,
                    };
                  })}
                />
              </label>

              <label>
                <span>Moeda</span>
                <input
                  value={mobileItemDraft.Moeda}
                  maxLength={8}
                  readOnly={isRepresentantes}
                  onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Moeda: event.target.value }))}
                />
              </label>

              <label>
                <span>Pedido cliente</span>
                <input
                  value={mobileItemDraft.Pedido_Cliente}
                  onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Pedido_Cliente: event.target.value }))}
                />
              </label>

              <label>
                <span>Data entrega</span>
                <CustomDatePicker
                  value={mobileItemDraft.Data_Entrega}
                  onChange={(nextDate) => setMobileItemDraft((prev) => ({ ...prev, Data_Entrega: nextDate }))}
                />
              </label>

              <label>
                <span>Unidade</span>
                <input
                  value={mobileItemDraft.Unid_Med_Venda}
                  readOnly={isRepresentantes}
                  onChange={(event) => setMobileItemDraft((prev) => ({ ...prev, Unid_Med_Venda: event.target.value }))}
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setMobileItemModalOpen(false);
                  setMobileItemEditIndex(null);
                  setMobileItemDraft(emptyItem());
                }}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={handleConfirmarItemMobile}>
                {mobileItemEditIndex === null ? 'Adicionar item' : 'Salvar item'}
              </button>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}

export function NovoPedidoVendaPage() {
  const navigate = useNavigate();
  const params = useParams<{ numPedido: string }>();

  return (
    <PedidoVendaFormPanel
      open
      numPedido={params.numPedido ?? null}
      onClose={() => navigate(ROUTES.pedidoVenda)}
      onSaved={() => navigate(ROUTES.pedidoVenda)}
    />
  );
}

type PedidoVendaVariantPanelProps = Omit<PedidoVendaFormPanelProps, 'allowImportSpreadsheet'>;

export function NovoPedidoVendaFormPanel(props: PedidoVendaVariantPanelProps) {
  return <PedidoVendaFormPanel {...props} allowImportSpreadsheet />;
}

export function EditarPedidoVendaFormPanel(props: PedidoVendaVariantPanelProps) {
  return <PedidoVendaFormPanel {...props} allowImportSpreadsheet={false} />;
}
