import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCartOutline,
  IoCheckmarkDoneOutline,
  IoCheckmarkOutline,
  IoCreateOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoLayersOutline,
  IoLockOpenOutline,
  IoPrintOutline,
  IoQrCodeOutline,
  IoRefreshOutline,
  IoReturnDownBackOutline,
  IoSearchOutline,
  IoSwapHorizontalOutline,
  IoTrashOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess } from '../../../hooks/useTransactionAccess';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  adicionarItemManualSeparacaoCall,
  adicionarPedidosSeparacaoCall,
  alterarTransportadoraSeparacaoCall,
  atualizarItemSeparacaoCall,
  atualizarObservacaoClienteSeparacaoCall,
  atualizarOrdemSeparacaoCall,
  cancelarOrdemSeparacaoCall,
  confirmarOrdemSeparacaoCall,
  confirmarQrCodeSeparacaoCall,
  criarOrdemSeparacaoCall,
  excluirItemSeparacaoCall,
  incluirEmbalagemSeparacaoCall,
  incluirSeriaisItemCall,
  liberarItensOrdemSeparacaoCall,
  listarSeriaisDisponiveisItemCall,
  obterCombosSeparacaoCall,
  obterDetalhesItemSeparacaoCall,
  obterInfoMaterialSeparacaoCall,
  obterLotesDisponiveisSeparacaoCall,
  obterOrdemSeparacaoDetalheCall,
  obterOrdensSeparacaoBasicCall,
  obterPedidosPendentesSeparacaoCall,
  obterProximoNumeroSeparacaoCall,
  obterRelatorioOrdemSeparacaoCall,
  obterTransportadorasPedidosSeparacaoCall,
  resetarQrCodeSeparacaoCall,
  validarEmbalagemSeparacaoCall,
  validarQrCodeSeparacaoCall,
} from '../../../services/apiCalls';
import {
  compareSortNumber,
  compareSortText,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatNowTime = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseIsoToBrDate = (val?: string | null): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const datePart = str.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return str;
};

const parseBrDateToIso = (val?: string | null): string | null => {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return null;
};

const isValidTime24h = (val?: string | null): boolean =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(val || '').trim());

const parseIsoToTime = (val?: string | null): string => {
  if (!val) return '';
  const match = String(val).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
};

const parseDecimalInput = (raw: string): number | null => {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const escapeHtml = (value: unknown): string => {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const TIPOS_ENTREGA_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: '1 - Entrega Normal' },
  { value: '2', label: '2 - Retira' },
  { value: '3', label: '3 - Redespacho' },
];

export type LoteDisponivel = {
  codigoLote: string;
  loteFornecedor?: string;
  codigoLocal: number;
  qtdDisponivel: number;
  unidMedida?: string;
  dataValidade?: string;
};

type AbaListagem = 'pendentes' | 'liberacao' | 'emitidas' | 'todas';

type OrdemSortField =
  | 'ordem'
  | 'data'
  | 'hora'
  | 'cliente'
  | 'pedido'
  | 'cfop'
  | 'nf'
  | 'usuario'
  | 'situacao';

type OrdemMenu = {
  numPedido?: string;
  numSeparacao: number;
  codigoCliente: number;
  dataSeparacao: string;
  horaSeparacao?: string;
  nomeFantasia?: string;
  codigoCFO?: string;
  descricaoCFO?: string;
  codigoUsuario?: string;
  observacao?: string;
  situacaoSeparacao: number;
  emiteNF?: number;
  numNotaFiscal?: string;
  serNotaFiscal?: string;
  situacaoNota?: number;
  chaveAcessoNfe?: string;
  valorTotal: number;
  itensPendentesLiberacao: number;
  situacaoDescricao?: string;
};

type OrdemItem = {
  numSeparacao: number;
  numItem: number;
  codigoCliente: number;
  codigoMaterial: string;
  descricaoMaterial?: string;
  numLote?: string;
  qtdSeparar?: number;
  unidMedida?: string;
  qtdSeparada: number;
  pesoMaterial: number;
  pesoEmbPadrao: number;
  pesoEmbReal: number;
  qtdPorEmb: number;
  qtdVolumes: number;
  enderecoLocal?: string;
  codigoLocal: number;
  unidMedEstq?: string;
  precoSeparacao: number;
  codigoMatKit: boolean;
  procedenciaMaterial?: string;
  loteFornec?: string;
  numPedido?: number;
  numPedidoCliente?: string;
  codigoProdutoCliente?: string;
  qtdDetalheItem?: number;
  controleSerial?: boolean;
  situacaoItem?: number;
  liberadoPor?: string;
  dataLiberacao?: string;
  qtdSeriaisSelecionados?: number;
  codigoEmbalagem?: string;
  qtdPorEmbPadrao?: number;
};

type OrdemDetalhe = {
  situacaoSeparacao: number;
  codigoEmpresa: number;
  numSeparacao: number;
  codigoCliente: number;
  nomeCliente?: string;
  razaoSocialCliente?: string;
  dataSeparacao?: string;
  tipoEntrega: number;
  chapaVeiculo?: string;
  codigoCFO?: string;
  descricaoCFO?: string;
  observacao?: string;
  codigoUsuario?: string;
  codigoTransportadora?: number;
  nomeTransportadora?: string;
  horaSeparacao?: string;
  emiteNF?: number;
  localEntrega?: string;
  respRedespacho?: number;
  nomeRedespacho?: string;
  utilizaRedespacho?: boolean;
  capacidadeVeiculo?: number;
  utilizaSeppen?: boolean;
  osSituacaoFatur?: number;
  valorMaxFatur?: number;
  layoutNF?: string;
  tipoCliente?: string;
  exibirLoteFornecedor?: boolean;
  regra42Ativa?: boolean;
  regra43Ativa?: boolean;
  regra112Ativa?: boolean;
  regra114Ativa?: boolean;
  regra23Cliente?: boolean;
  permiteAlterarPeso?: boolean;
  usarUnidMedEstoque?: boolean;
  podeAlterarEmiteNf?: boolean;
  podeEstornarCancelarOs?: boolean;
  observacaoSeparacaoCliente?: string;
  itens: OrdemItem[];
  pesoTotalMaterialEmb: number;
  pesoTotalMaterial: number;
  pesoTotalEmbalagem: number;
  valorSeparacaoTotal?: number;
};

type PedidoPendente = {
  numPedido: number;
  numItem: number;
  numPedidoCliente?: string;
  codigoMaterial: string;
  descricaoMaterial?: string;
  dataEntrega?: string;
  horaEntrega?: string;
  semana?: string;
  saldo: number;
  qtdEntregar: number;
  qtdEntregue: number;
  unidMedVenda?: string;
  codigoCFO?: string;
  localEntrega?: string;
  codigoEmbalagem?: string;
  qtdPorEmb?: number;
  destino?: string;
  tipoPedido: number;
  codigoProdutoCliente?: string;
  destinoPedido?: number;
  similarSugerido?: string;
};

type VeiculoComboRaw = {
  value: string;
  label: string;
  descricaoAuxiliar?: string;
  capacidadeCarga?: number | null;
  codigoTransportadora?: number | null;
  nomeTransportadora?: string | null;
};

type ItemDetalheEmb = {
  numSeparacao: number;
  numItem: number;
  numDetalhe: number;
  codigoMaterial: string;
  qtdEmb: number;
  pesoEmb: number;
  numEmbalagem?: number;
  serialEmbalagem?: string;
};

type SerialDisponivel = {
  numSerial: string;
  codigoLote: string;
  codigoLocal: number;
  situacaoSerial: number;
  selecionado: boolean;
};

type TransportadoraOpcaoPedido = {
  codigoTransportadora: number;
  nomeTransportadora?: string;
  respRedespacho?: number;
  nomeRedespacho?: string;
  qtdPedidos: number;
  numPedidos: number[];
};

type ConfirmDialogState = {
  titulo: string;
  subtitulo?: string;
  mensagem: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
};

const getSituacaoBadgeInfo = (situacao: number, itensPendentesLiberacao?: number) => {
  if (situacao === 1 || (itensPendentesLiberacao && itensPendentesLiberacao > 0 && situacao < 2)) {
    return { text: 'Pendente Liberação', cls: 'separacao-status-pill--warning' };
  }
  switch (situacao) {
    case -1:
      return { text: 'QR Code OK', cls: 'separacao-status-pill--info' };
    case 0:
      return { text: 'Em Digitação', cls: 'separacao-status-pill--pending' };
    case 2:
      return { text: 'Separada p/ Fatur.', cls: 'separacao-status-pill--success' };
    case 7:
      return { text: 'Emitida (Sem NF)', cls: 'separacao-status-pill--success' };
    case 8:
      return { text: 'Faturada', cls: 'separacao-status-pill--success' };
    case 9:
      return { text: 'Cancelada', cls: 'separacao-status-pill--danger' };
    default:
      return { text: 'Pendente', cls: 'separacao-status-pill--pending' };
  }
};

export function OrdensSeparacaoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const permissaoStatus = useTransactionAccess('PCP008', 'Ordens de Separação');
  const showSuccess = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const showError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const showInfo = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

  // Estados da listagem e abas QSERPx
  const [abaListagem, setAbaListagem] = useState<AbaListagem>('pendentes');
  const [abaConsultada, setAbaConsultada] = useState(true);
  const [ordens, setOrdens] = useState<OrdemMenu[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroDataInicioBr, setFiltroDataInicioBr] = useState('');
  const [filtroDataFimBr, setFiltroDataFimBr] = useState('');
  const [filtroNumNf, setFiltroNumNf] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [sortField, setSortField] = useState<OrdemSortField>('ordem');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Estados da modal principal
  const [modalAberta, setModalAberta] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'itens' | 'obs'>('geral');

  // Cabeçalho da OS
  const [formOS, setFormOS] = useState<Partial<OrdemDetalhe>>({
    numSeparacao: 0,
    codigoCliente: 0,
    dataSeparacao: new Date().toISOString().substring(0, 10),
    codigoCFO: '',
    descricaoCFO: '',
    chapaVeiculo: '',
    codigoTransportadora: 0,
    respRedespacho: 0,
    tipoEntrega: 1,
    emiteNF: 1,
    localEntrega: '',
    observacao: '',
    itens: [],
  });

  const [dataSeparacaoBr, setDataSeparacaoBr] = useState<string>(formatToday());
  const [horaSeparacaoStr, setHoraSeparacaoStr] = useState<string>(formatNowTime());
  const [geraSolicEmbalagem, setGeraSolicEmbalagem] = useState(false);
  const [capacidadeKg, setCapacidadeKg] = useState<string>('');
  const [tipoFiltroLote, setTipoFiltroLote] = useState<1 | 2>(2);

  // Combos
  const [clientesCombo, setClientesCombo] = useState<SearchableSelectOption[]>([]);
  const [transportadorasCombo, setTransportadorasCombo] = useState<SearchableSelectOption[]>([]);
  const [cfopsCombo, setCfopsCombo] = useState<SearchableSelectOption[]>([]);
  const [veiculosRaw, setVeiculosRaw] = useState<VeiculoComboRaw[]>([]);
  const [locaisCombo, setLocaisCombo] = useState<SearchableSelectOption[]>([]);
  const [materiaisCombo, setMateriaisCombo] = useState<SearchableSelectOption[]>([]);
  const [carregandoMateriais, setCarregandoMateriais] = useState(false);
  const [manualMaterialDesc, setManualMaterialDesc] = useState('');
  const debounceMatSearchTimer = useRef<number | null>(null);

  // Submodal: Pedidos Pendentes
  const [modalPedidosAberta, setModalPedidosAberta] = useState(false);
  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoPendente[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [searchPedido, setSearchPedido] = useState('');
  const [pedidosSelecionados, setPedidosSelecionados] = useState<string[]>([]);
  const listRequestIdRef = useRef(0);
  const createInFlightRef = useRef<Promise<OrdemDetalhe | null> | null>(null);

  // Inclusão de itens (Material | Pallet | Caixa)
  const [abaInclusao, setAbaInclusao] = useState<'material' | 'pallet' | 'caixa'>('material');
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualQtd, setManualQtd] = useState('');
  const [manualUnid, setManualUnid] = useState('PC');
  const [manualPesoUnitario, setManualPesoUnitario] = useState<number>(0);
  const [manualPesoTotal, setManualPesoTotal] = useState<string>('');
  const [manualLote, setManualLote] = useState('');
  const [manualLocal, setManualLocal] = useState<number | undefined>(undefined);
  const [lotesDisponiveisManual, setLotesDisponiveisManual] = useState<LoteDisponivel[]>([]);
  const [lotesManualCombo, setLotesManualCombo] = useState<SearchableSelectOption[]>([]);
  const [carregandoLotesManual, setCarregandoLotesManual] = useState(false);
  const [serialPalete, setSerialPalete] = useState('');
  const [pesoTotalPalete, setPesoTotalPalete] = useState('');
  const [serialCaixa, setSerialCaixa] = useState('');
  const [pesoTotalCaixa, setPesoTotalCaixa] = useState('');

  // Submodal: Editar Item (Lote, Local, Qtd, Peso, Emb)
  const [itemEditando, setItemEditando] = useState<OrdemItem | null>(null);
  const [editLote, setEditLote] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editQtd, setEditQtd] = useState('');
  const [editPesoMaterial, setEditPesoMaterial] = useState('');
  const [editQtdPorEmb, setEditQtdPorEmb] = useState('');
  const [editQtdVolumes, setEditQtdVolumes] = useState('');
  const [editPesoEmbReal, setEditPesoEmbReal] = useState('');

  // Submodal: Detalhes Embalagem (Pallet/Caixa do Item)
  const [modalDetalhesItem, setModalDetalhesItem] = useState<OrdemItem | null>(null);
  const [detalhesItemLista, setDetalhesItemLista] = useState<ItemDetalheEmb[]>([]);
  const [carregandoDetalhesItem, setCarregandoDetalhesItem] = useState(false);

  // Submodal: Seriais do Item
  const [modalSeriaisItem, setModalSeriaisItem] = useState<OrdemItem | null>(null);
  const [seriaisLista, setSeriaisLista] = useState<SerialDisponivel[]>([]);
  const [seriaisSelecionados, setSeriaisSelecionados] = useState<string[]>([]);
  const [carregandoSeriais, setCarregandoSeriais] = useState(false);

  // Submodal: Consulta Lotes (F3 / Lupa)
  const [modalLotesAberta, setModalLotesAberta] = useState(false);
  const [lotesDisponiveis, setLotesDisponiveis] = useState<LoteDisponivel[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [filtroLote, setFiltroLote] = useState('');
  const [itemParaAlterarLote, setItemParaAlterarLote] = useState<OrdemItem | null>(null);
  const [modoLoteEditModal, setModoLoteEditModal] = useState(false);
  const [materialLotesConsultando, setMaterialLotesConsultando] = useState<string>('');
  const [descricaoLotesConsultando, setDescricaoLotesConsultando] = useState<string>('');

  // Submodal: QR Code (Regra 112)
  const [modalQrCodeAberta, setModalQrCodeAberta] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [etiquetasLidas, setEtiquetasLidas] = useState<string[]>([]);
  const [qtdLidaPorItemKey, setQtdLidaPorItemKey] = useState<Record<string, number>>({});

  // Submodal: Observações
  const [modalObsSeparacaoAberta, setModalObsSeparacaoAberta] = useState(false);
  const [obsClienteTexto, setObsClienteTexto] = useState('');

  // Submodal: Impressão
  const [modalImprimirAberta, setModalImprimirAberta] = useState(false);
  const [dadosRelatorio, setDadosRelatorio] = useState<any>(null);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);

  // Submodal: Confirmar Ordem de Separação
  const [modalConfirmarOSAberta, setModalConfirmarOSAberta] = useState(false);

  // Submodal: Cancelar / Estornar OS
  const [acaoStatusOS, setAcaoStatusOS] = useState<{
    numSeparacao: number;
    situacaoAtual: number;
    situacaoDestino: 0 | 9;
  } | null>(null);

  // Submodal: Exclusão de Item
  const [itemParaExcluir, setItemParaExcluir] = useState<OrdemItem | null>(null);

  // Submodal: Alterar Transportadora (Conflito com Pedido / Troca manual)
  const [modalTransportadoraAberta, setModalTransportadoraAberta] = useState(false);
  const [transpOpcoesPedidos, setTranspOpcoesPedidos] = useState<TransportadoraOpcaoPedido[]>([]);
  const [transpSelecionadaModal, setTranspSelecionadaModal] = useState<string>('');
  const [redespSelecionadoModal, setRedespSelecionadoModal] = useState<string>('');
  const [transpConflitoMensagem, setTranspConflitoMensagem] = useState<string>('');
  const [carregandoTranspPedidos, setCarregandoTranspPedidos] = useState(false);

  // Submodal genérica de confirmação (zero window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const osReadOnly = useMemo(() => {
    if (modoNovo) return false;
    const sit = formOS.situacaoSeparacao ?? 0;
    return sit === 2 || sit === 7 || sit === 8 || sit === 9;
  }, [modoNovo, formOS.situacaoSeparacao]);

  const clienteBloqueado = useMemo(() => {
    if (osReadOnly) return true;
    return !modoNovo && (formOS.itens?.length || 0) > 0;
  }, [osReadOnly, modoNovo, formOS.itens]);

  const veiculosCombo = useMemo<SearchableSelectOption[]>(() => {
    const base = veiculosRaw.map((v) => ({
      value: v.value,
      label: v.label,
    }));
    if (formOS.chapaVeiculo && !base.some((o) => o.value === formOS.chapaVeiculo)) {
      base.unshift({ value: formOS.chapaVeiculo, label: formOS.chapaVeiculo });
    }
    return base;
  }, [veiculosRaw, formOS.chapaVeiculo]);

  const cfopsComboRender = useMemo<SearchableSelectOption[]>(() => {
    const base = [...cfopsCombo];
    if (formOS.codigoCFO && !base.some((c) => c.value === formOS.codigoCFO)) {
      base.unshift({
        value: formOS.codigoCFO,
        label: formOS.descricaoCFO ? `${formOS.codigoCFO} - ${formOS.descricaoCFO}` : formOS.codigoCFO,
      });
    }
    return base;
  }, [cfopsCombo, formOS.codigoCFO, formOS.descricaoCFO]);

  const clientesComboRender = useMemo<SearchableSelectOption[]>(() => {
    const base = [...clientesCombo];
    if (formOS.codigoCliente && !base.some((c) => c.value === String(formOS.codigoCliente))) {
      base.unshift({
        value: String(formOS.codigoCliente),
        label: `${formOS.codigoCliente} - ${formOS.nomeCliente || 'Cliente'}`,
      });
    }
    return base;
  }, [clientesCombo, formOS.codigoCliente, formOS.nomeCliente]);

  const transportadorasComboRender = useMemo<SearchableSelectOption[]>(() => {
    const base = [...transportadorasCombo];
    if (
      formOS.codigoTransportadora &&
      !base.some((t) => t.value === String(formOS.codigoTransportadora))
    ) {
      base.unshift({
        value: String(formOS.codigoTransportadora),
        label: `${formOS.codigoTransportadora} - ${formOS.nomeTransportadora || 'Transportadora'}`,
      });
    }
    if (formOS.respRedespacho && !base.some((t) => t.value === String(formOS.respRedespacho))) {
      base.unshift({
        value: String(formOS.respRedespacho),
        label: `${formOS.respRedespacho} - ${formOS.nomeRedespacho || 'Redespacho'}`,
      });
    }
    return base;
  }, [
    transportadorasCombo,
    formOS.codigoTransportadora,
    formOS.nomeTransportadora,
    formOS.respRedespacho,
    formOS.nomeRedespacho,
  ]);

  const temItensBloqueados = useMemo(
    () => (formOS.itens || []).some((i) => i.situacaoItem === 0) || formOS.situacaoSeparacao === 1,
    [formOS.itens, formOS.situacaoSeparacao],
  );

  // Carregar combos de apoio
  const carregarCombos = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      const [resCli, resTransp, resCfops, resVeic, resLocais] = await Promise.all([
        obterCombosSeparacaoCall(baseUrl, token, 'clientes'),
        obterCombosSeparacaoCall(baseUrl, token, 'transportadoras'),
        obterCombosSeparacaoCall(baseUrl, token, 'cfops', undefined, empresa),
        obterCombosSeparacaoCall(baseUrl, token, 'veiculos'),
        obterCombosSeparacaoCall(baseUrl, token, 'locais'),
      ]);

      const toOptions = (arr: any[]) =>
        arr.map((c: any) => ({
          value: String(c.value ?? c.Value ?? ''),
          label: String(c.label ?? c.Label ?? ''),
        }));

      if (resCli.succeeded && Array.isArray(resCli.jsonBody)) {
        setClientesCombo(toOptions(resCli.jsonBody));
      }
      if (resTransp.succeeded && Array.isArray(resTransp.jsonBody)) {
        setTransportadorasCombo(toOptions(resTransp.jsonBody));
      }
      if (resCfops.succeeded && Array.isArray(resCfops.jsonBody)) {
        setCfopsCombo(toOptions(resCfops.jsonBody));
      }
      if (resVeic.succeeded && Array.isArray(resVeic.jsonBody)) {
        setVeiculosRaw(
          resVeic.jsonBody.map((v: any) => ({
            value: String(v.value ?? v.Value ?? ''),
            label: String(v.label ?? v.Label ?? ''),
            descricaoAuxiliar: v.descricaoAuxiliar ?? v.DescricaoAuxiliar,
            capacidadeCarga: v.capacidadeCarga ?? v.CapacidadeCarga ?? null,
            codigoTransportadora: v.codigoTransportadora ?? v.CodigoTransportadora ?? null,
            nomeTransportadora: v.nomeTransportadora ?? v.NomeTransportadora ?? null,
          })),
        );
      }
      if (resLocais.succeeded && Array.isArray(resLocais.jsonBody)) {
        setLocaisCombo(toOptions(resLocais.jsonBody));
      }
    } catch {
      // Ignora erro silenciosamente na inicialização de combos
    }
  }, []);

  const handleBuscarMateriais = (query: string) => {
    if (debounceMatSearchTimer.current) {
      window.clearTimeout(debounceMatSearchTimer.current);
    }
    const termo = query.trim();
    if (!termo) {
      setMateriaisCombo([]);
      return;
    }
    debounceMatSearchTimer.current = window.setTimeout(async () => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const empresa = GlobalConfig.getCodEmpresa() ?? 1;
      if (!baseUrl || !token) return;
      try {
        setCarregandoMateriais(true);
        const resp = await obterCombosSeparacaoCall(
          baseUrl,
          token,
          'materiais',
          termo,
          empresa,
          formOS.codigoCliente || undefined,
        );
        if (resp.succeeded && Array.isArray(resp.jsonBody)) {
          setMateriaisCombo(
            resp.jsonBody.map((m: any) => ({
              value: String(m.value ?? m.Value ?? ''),
              label: String(m.label ?? m.Label ?? ''),
            })),
          );
        }
      } finally {
        setCarregandoMateriais(false);
      }
    }, 250);
  };

  // Carregar listagem de OS respeitando aba + filtros de data/NF/busca
  const carregarOrdens = useCallback(
    async (opts?: {
      aba?: AbaListagem;
      dataInicio?: string;
      dataFim?: string;
      numNf?: string;
      busca?: string;
      manual?: boolean;
    }) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const empresa = GlobalConfig.getCodEmpresa() ?? 1;
      if (!baseUrl || !token) return;

      const abaAtual = opts?.aba ?? abaListagem;
      const dIniRaw = (opts?.dataInicio !== undefined ? opts.dataInicio : filtroDataInicioBr).trim();
      const dFimRaw = (opts?.dataFim !== undefined ? opts.dataFim : filtroDataFimBr).trim();
      const nfRaw = (opts?.numNf !== undefined ? opts.numNf : filtroNumNf).trim();
      const buscaRaw = (opts?.busca !== undefined ? opts.busca : filtroBusca).trim();

      const dIniIso = dIniRaw ? parseBrDateToIso(dIniRaw) : null;
      if (dIniRaw && !dIniIso) {
        if (opts?.manual) {
          showError('Data Inicial inválida. Utilize o formato DD/MM/AAAA.');
        }
        return;
      }

      const dFimIso = dFimRaw ? parseBrDateToIso(dFimRaw) : null;
      if (dFimRaw && !dFimIso) {
        if (opts?.manual) {
          showError('Data Final inválida. Utilize o formato DD/MM/AAAA.');
        }
        return;
      }

      if (dIniIso && dFimIso && dIniIso > dFimIso) {
        if (opts?.manual) {
          showError('A Data Inicial não pode ser maior que a Data Final.');
        }
        return;
      }

      const temFiltro = Boolean(dIniIso || dFimIso || nfRaw || buscaRaw);

      // Apenas a aba Pendentes carrega automaticamente; as demais exigem filtro aplicado
      if (abaAtual !== 'pendentes') {
        if (!temFiltro) {
          if (opts?.manual) {
            setOrdens([]);
            setAbaConsultada(false);
            showInfo('Informe ao menos um filtro (Período, Nota Fiscal ou Ordem / Cliente / Pedido) para consultar.');
          }
          return;
        }
        if (!opts?.manual && !abaConsultada) {
          return;
        }
      }

      const reqId = ++listRequestIdRef.current;

      try {
        setLoading(true);
        setAbaConsultada(true);
        const resp = await obterOrdensSeparacaoBasicCall(
          baseUrl,
          token,
          empresa,
          undefined,
          undefined,
          undefined,
          undefined,
          abaAtual,
          dIniIso ?? undefined,
          dFimIso ?? undefined,
          nfRaw || undefined,
          buscaRaw || undefined,
        );
        if (reqId !== listRequestIdRef.current) return;
        if (resp.succeeded && Array.isArray(resp.jsonBody)) {
          setOrdens(resp.jsonBody);
        } else {
          setOrdens([]);
          if (!resp.succeeded) {
            const errData: any = resp.jsonBody ?? resp.data;
            showError(errData?.message || errData?.error || 'Não foi possível carregar as ordens de separação.');
          }
        }
      } catch (err: any) {
        if (reqId !== listRequestIdRef.current) return;
        showError(err?.message || 'Erro ao carregar ordens de separação.');
        setOrdens([]);
      } finally {
        if (reqId === listRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [abaListagem, abaConsultada, filtroDataInicioBr, filtroDataFimBr, filtroNumNf, filtroBusca, showError, showInfo],
  );

  const selecionarAbaListagem = (novaAba: AbaListagem) => {
    setAbaListagem(novaAba);
    if (novaAba === 'pendentes') {
      setAbaConsultada(true);
      void carregarOrdens({ aba: 'pendentes', manual: true });
    } else {
      listRequestIdRef.current += 1;
      setLoading(false);
      setOrdens([]);
      setAbaConsultada(false);
    }
  };

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarCombos();
    void carregarOrdens({ aba: 'pendentes', manual: true });
  }, [permissaoStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field: OrdemSortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const ordensFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtradas = !term
      ? ordens
      : ordens.filter(
          (o) =>
            String(o.numSeparacao).includes(term) ||
            String(o.numPedido || '').toLowerCase().includes(term) ||
            String(o.numNotaFiscal || '').toLowerCase().includes(term) ||
            (o.nomeFantasia && o.nomeFantasia.toLowerCase().includes(term)) ||
            (o.codigoCFO && o.codigoCFO.toLowerCase().includes(term)) ||
            (o.descricaoCFO && o.descricaoCFO.toLowerCase().includes(term)),
        );

    return sortByComparator(filtradas, sortDirection, (a, b) => {
      switch (sortField) {
        case 'ordem':
          return compareSortNumber(a.numSeparacao, b.numSeparacao);
        case 'data':
          return parseSortTimestamp(a.dataSeparacao) - parseSortTimestamp(b.dataSeparacao);
        case 'hora':
          return compareSortText(parseIsoToTime(a.horaSeparacao), parseIsoToTime(b.horaSeparacao));
        case 'cliente':
          return compareSortText(a.nomeFantasia, b.nomeFantasia);
        case 'pedido':
          return compareSortText(a.numPedido, b.numPedido);
        case 'cfop':
          return compareSortText(a.codigoCFO, b.codigoCFO);
        case 'nf':
          return (
            compareSortNumber(a.numNotaFiscal, b.numNotaFiscal) ||
            compareSortText(a.serNotaFiscal, b.serNotaFiscal)
          );
        case 'usuario':
          return compareSortText(a.codigoUsuario, b.codigoUsuario);
        case 'situacao':
          return compareSortText(
            getSituacaoBadgeInfo(a.situacaoSeparacao, a.itensPendentesLiberacao).text,
            getSituacaoBadgeInfo(b.situacaoSeparacao, b.itensPendentesLiberacao).text,
          );
      }
    });
  }, [ordens, search, sortField, sortDirection]);

  const limparCamposInclusao = () => {
    setManualMaterial('');
    setManualMaterialDesc('');
    setMateriaisCombo([]);
    setManualQtd('');
    setManualUnid('PC');
    setManualPesoUnitario(0);
    setManualPesoTotal('');
    setManualLote('');
    setManualLocal(undefined);
    setLotesDisponiveisManual([]);
    setLotesManualCombo([]);
    setSerialPalete('');
    setPesoTotalPalete('');
    setSerialCaixa('');
    setPesoTotalCaixa('');
  };

  const sincronizarDetalheNaTela = (d: OrdemDetalhe) => {
    setFormOS(d);
    setObsClienteTexto(d.observacaoSeparacaoCliente || '');
    setDataSeparacaoBr(parseIsoToBrDate(d.dataSeparacao) || formatToday());
    setHoraSeparacaoStr(parseIsoToTime(d.horaSeparacao) || formatNowTime());
    setCapacidadeKg(d.capacidadeVeiculo ? Number(d.capacidadeVeiculo).toLocaleString('pt-BR') : '');
  };

  // Abrir detalhes da Ordem de Separação
  const abrirOrdemDetalhe = async (numSeparacao: number, abaInicial: 'geral' | 'itens' | 'obs' = 'geral') => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await obterOrdemSeparacaoDetalheCall(baseUrl, token, empresa, numSeparacao, usuario);
      if (resp.succeeded && resp.jsonBody) {
        const d: OrdemDetalhe = resp.jsonBody;
        sincronizarDetalheNaTela(d);
        setGeraSolicEmbalagem(false);
        limparCamposInclusao();
        setModoNovo(false);
        setActiveTab(abaInicial);
        setModalAberta(true);
      } else {
        showError('Não foi possível obter os detalhes da ordem de separação.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao abrir ordem de separação.');
    } finally {
      setSalvando(false);
    }
  };

  // Abrir nova Ordem de Separação
  const abrirNovaOrdem = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    let proximoNumero = 1;

    try {
      if (baseUrl && token) {
        const respProx = await obterProximoNumeroSeparacaoCall(baseUrl, token, empresa);
        if (respProx.succeeded && respProx.jsonBody?.proximoNumero) {
          proximoNumero = respProx.jsonBody.proximoNumero;
        }
      }
    } catch {
      // fallback
    }

    const hojeBr = formatToday();
    const horaAgora = formatNowTime();
    setDataSeparacaoBr(hojeBr);
    setHoraSeparacaoStr(horaAgora);
    setGeraSolicEmbalagem(false);
    setCapacidadeKg('');
    limparCamposInclusao();
    setFormOS({
      numSeparacao: proximoNumero,
      codigoEmpresa: empresa,
      codigoCliente: 0,
      dataSeparacao: parseBrDateToIso(hojeBr) || new Date().toISOString().substring(0, 10),
      horaSeparacao: horaAgora,
      codigoCFO: '',
      descricaoCFO: '',
      chapaVeiculo: '',
      codigoTransportadora: 0,
      respRedespacho: 0,
      tipoEntrega: 1,
      emiteNF: 1,
      localEntrega: '',
      observacao: '',
      situacaoSeparacao: 0,
      itens: [],
      pesoTotalMaterial: 0,
      pesoTotalEmbalagem: 0,
      pesoTotalMaterialEmb: 0,
      valorSeparacaoTotal: 0,
    });
    setModoNovo(true);
    setActiveTab('geral');
    setModalAberta(true);
  };

  // Auto-save do cabeçalho
  const salvarCabecalhoAutomatico = async (
    overrides?: Partial<OrdemDetalhe>,
    dataBrOverride?: string,
    horaOverride?: string,
    exibirToast = false,
  ): Promise<OrdemDetalhe | null> => {
    if (osReadOnly) return null;

    if (modoNovo && createInFlightRef.current) {
      return await createInFlightRef.current;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token) return null;

    const merged = { ...formOS, ...(overrides || {}) };
    if (!merged.codigoCliente || merged.codigoCliente <= 0) {
      if (exibirToast) {
        showError('Selecione o Cliente para continuar.');
      }
      return null;
    }

    const dataBrAtual = dataBrOverride ?? dataSeparacaoBr;
    const dataIso = parseBrDateToIso(dataBrAtual) || new Date().toISOString().substring(0, 10);
    const horaAtual = (horaOverride ?? horaSeparacaoStr) || '00:00';
    const horaPayload = isValidTime24h(horaAtual) ? `1899-12-30T${horaAtual.trim()}:00` : null;

    try {
      setSalvando(true);
      if (modoNovo) {
        const execCriar = async (): Promise<OrdemDetalhe | null> => {
          const payload = {
            codigoEmpresa: empresa,
            codigoCliente: merged.codigoCliente,
            dataSeparacao: `${dataIso}T00:00:00`,
            horaSeparacao: horaPayload,
            codigoCFO: merged.codigoCFO || null,
            chapaVeiculo: merged.chapaVeiculo || null,
            codigoTransportadora: merged.codigoTransportadora || null,
            respRedespacho: merged.respRedespacho || null,
            localEntrega: merged.localEntrega || null,
            emiteNF: merged.emiteNF ?? 1,
            tipoEntrega: merged.tipoEntrega ?? 1,
            observacao: merged.observacao || null,
            codigoUsuario: usuario,
          };
          const resp = await criarOrdemSeparacaoCall(baseUrl, token, payload);
          const body = resp.jsonBody ?? resp.data;
          if (resp.succeeded && body?.sucesso) {
            if (exibirToast) {
              showSuccess(body.mensagem || 'Ordem de separação criada com sucesso!');
            }
            const det: OrdemDetalhe | undefined = body.detalhe;
            if (det) {
              sincronizarDetalheNaTela(det);
              setModoNovo(false);
              void carregarOrdens();
              return det;
            }
            setModoNovo(false);
            void carregarOrdens();
          } else {
            showError(body?.mensagem || 'Falha ao criar ordem de separação.');
          }
          return null;
        };

        const p = execCriar();
        createInFlightRef.current = p;
        try {
          return await p;
        } finally {
          if (createInFlightRef.current === p) {
            createInFlightRef.current = null;
          }
        }
      } else if (merged.numSeparacao) {
        const payload = {
          codigoCliente: merged.codigoCliente,
          dataSeparacao: `${dataIso}T00:00:00`,
          horaSeparacao: horaPayload,
          codigoCFO: merged.codigoCFO || null,
          chapaVeiculo: merged.chapaVeiculo || null,
          codigoTransportadora: merged.codigoTransportadora || null,
          respRedespacho: merged.respRedespacho || null,
          localEntrega: merged.localEntrega || null,
          emiteNF: merged.emiteNF,
          tipoEntrega: merged.tipoEntrega,
          observacao: merged.observacao || null,
          usuario,
        };
        const resp = await atualizarOrdemSeparacaoCall(baseUrl, token, merged.numSeparacao, empresa, payload);
        const body = resp.jsonBody ?? resp.data;
        if (resp.succeeded && body?.sucesso) {
          if (exibirToast) {
            showSuccess(body.mensagem || 'Ordem de separação salva com sucesso!');
          }
          const det: OrdemDetalhe | undefined = body.detalhe;
          if (det) {
            sincronizarDetalheNaTela(det);
            void carregarOrdens();
            return det;
          }
          void carregarOrdens();
        } else if (exibirToast || body?.mensagem) {
          showError(body?.mensagem || 'Falha ao atualizar ordem de separação.');
          if (!resp.succeeded && merged.numSeparacao) {
            // Restaura valores consistentes do servidor
            const reload = await obterOrdemSeparacaoDetalheCall(baseUrl, token, empresa, merged.numSeparacao, usuario);
            if (reload.succeeded && reload.jsonBody) {
              sincronizarDetalheNaTela(reload.jsonBody);
            }
          }
        }
      }
    } catch (err: any) {
      if (exibirToast) {
        showError(err?.message || 'Erro ao salvar ordem de separação.');
      }
    } finally {
      setSalvando(false);
    }
    return null;
  };

  const handleTrocarAba = async (novaAba: 'geral' | 'itens' | 'obs') => {
    if (!osReadOnly && novaAba !== activeTab && formOS.codigoCliente && formOS.codigoCliente > 0) {
      await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
    }
    setActiveTab(novaAba);
  };

  // Seleção de Veículo auto-preenche Capacidade e sugere Transportadora vinculada
  const handleSelectVeiculo = async (chapa: string) => {
    const veic = veiculosRaw.find((v) => v.value === chapa);
    const novaCap = veic?.capacidadeCarga != null ? Number(veic.capacidadeCarga).toLocaleString('pt-BR') : '';
    setCapacidadeKg(novaCap);

    const overrides: Partial<OrdemDetalhe> = {
      chapaVeiculo: chapa,
      capacidadeVeiculo: veic?.capacidadeCarga ?? undefined,
    };

    if (veic?.codigoTransportadora && veic.codigoTransportadora > 0 && !formOS.codigoTransportadora) {
      overrides.codigoTransportadora = veic.codigoTransportadora;
    }

    setFormOS((p) => ({ ...p, ...overrides }));
    if (formOS.codigoCliente && formOS.codigoCliente > 0) {
      await salvarCabecalhoAutomatico(overrides, undefined, undefined, false);
    }
  };

  // Abrir Modal "Pedidos Pendentes"
  const abrirModalPedidos = async () => {
    if (osReadOnly) return;
    if (!formOS.codigoCliente || formOS.codigoCliente <= 0) {
      showError('Selecione um Cliente antes de consultar pedidos pendentes.');
      return;
    }

    let osAtual = formOS;
    if (modoNovo || !formOS.numSeparacao) {
      const detSalvo = await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
      if (!detSalvo) return;
      osAtual = detSalvo;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setLoadingPedidos(true);
      setPedidosSelecionados([]);
      setSearchPedido('');
      const dataIso = parseBrDateToIso(dataSeparacaoBr) || osAtual.dataSeparacao;
      const resp = await obterPedidosPendentesSeparacaoCall(
        baseUrl,
        token,
        empresa,
        osAtual.codigoCliente!,
        dataIso || undefined,
      );

      if (resp.succeeded && Array.isArray(resp.jsonBody)) {
        setPedidosPendentes(resp.jsonBody);
      } else {
        setPedidosPendentes([]);
      }
      setModalPedidosAberta(true);
    } catch (err: any) {
      showError(err?.message || 'Erro ao carregar pedidos pendentes.');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const pedidosPendentesFiltrados = useMemo(() => {
    const term = searchPedido.trim().toLowerCase();
    if (!term) return pedidosPendentes;
    return pedidosPendentes.filter(
      (p) =>
        String(p.numPedido).includes(term) ||
        (p.numPedidoCliente && p.numPedidoCliente.toLowerCase().includes(term)) ||
        p.codigoMaterial.toLowerCase().includes(term) ||
        (p.descricaoMaterial && p.descricaoMaterial.toLowerCase().includes(term)),
    );
  }, [pedidosPendentes, searchPedido]);

  const getPedidoKey = (p: PedidoPendente) => `${p.numPedido}-${p.numItem}`;

  const toggleSelecaoPedido = (key: string) => {
    setPedidosSelecionados((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleSelecionarTodosPedidos = () => {
    const keysVisiveis = pedidosPendentesFiltrados.map(getPedidoKey);
    const todosVisiveisMarcados =
      keysVisiveis.length > 0 && keysVisiveis.every((k) => pedidosSelecionados.includes(k));

    if (todosVisiveisMarcados) {
      setPedidosSelecionados((prev) => prev.filter((k) => !keysVisiveis.includes(k)));
    } else {
      setPedidosSelecionados((prev) => Array.from(new Set([...prev, ...keysVisiveis])));
    }
  };

  // Adicionar pedidos selecionados (com suporte a PARCIAL)
  const executarAdicionarPedidos = async (confirmarParcial = false) => {
    if (pedidosSelecionados.length === 0) {
      showError('Nenhum pedido selecionado para adicionar.');
      return;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token || !formOS.numSeparacao) return;

    const selSet = new Set(pedidosSelecionados);
    const itensParaAdicionar = pedidosPendentes
      .filter((p) => selSet.has(getPedidoKey(p)))
      .map((p) => ({
        numPedido: p.numPedido,
        numItem: p.numItem,
        numPedidoCliente: p.numPedidoCliente || '',
        codigoMaterial: p.codigoMaterial,
        qtd: p.saldo,
        unidMedida: p.unidMedVenda || 'PC',
        codigoCFO: p.codigoCFO || '',
        localEntrega: p.localEntrega || '',
        tipoPedido: p.tipoPedido,
      }));

    if (itensParaAdicionar.length === 0) {
      showError('Nenhum pedido selecionado para adicionar.');
      return;
    }

    try {
      setSalvando(true);
      const resp = await adicionarPedidosSeparacaoCall(baseUrl, token, formOS.numSeparacao, {
        codigoEmpresa: empresa,
        itens: itensParaAdicionar,
        confirmarParcial,
        usuario,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Pedidos adicionados à separação!');
        if (body.detalhe) {
          sincronizarDetalheNaTela(body.detalhe);
        }
        setModalPedidosAberta(false);
        void carregarOrdens();
      } else if (body?.codigoConfirmacao === 'PARCIAL') {
        setConfirmDialog({
          titulo: 'Saldo Parcial em Estoque',
          subtitulo: `Ordem #${String(formOS.numSeparacao).padStart(6, '0')}`,
          mensagem: body.mensagem || 'Saldo em estoque menor que o solicitado. Deseja separar parcialmente?',
          confirmLabel: 'Sim, separar parcial',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarAdicionarPedidos(true);
          },
        });
      } else {
        showError(body?.mensagem || body?.message || 'Falha ao adicionar pedidos.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao adicionar pedidos à separação.');
    } finally {
      setSalvando(false);
    }
  };

  // Lotes disponíveis para modal F3
  const lotesFiltrados = useMemo(() => {
    const term = filtroLote.trim().toLowerCase();
    if (!term) return lotesDisponiveis;
    return lotesDisponiveis.filter(
      (l) =>
        l.codigoLote.toLowerCase().includes(term) ||
        (l.loteFornecedor && l.loteFornecedor.toLowerCase().includes(term)) ||
        String(l.codigoLocal).includes(term),
    );
  }, [lotesDisponiveis, filtroLote]);

  const carregarLotesParaModal = async (codMat: string) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setLoadingLotes(true);
      setFiltroLote('');
      setModalLotesAberta(true);
      const resp = await obterLotesDisponiveisSeparacaoCall(
        baseUrl,
        token,
        empresa,
        codMat,
        formOS.numSeparacao,
        tipoFiltroLote === 1,
        formOS.codigoCliente || undefined,
      );
      if (resp.succeeded && Array.isArray(resp.jsonBody)) {
        setLotesDisponiveis(resp.jsonBody);
      } else {
        setLotesDisponiveis([]);
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao carregar lotes disponíveis.');
      setLotesDisponiveis([]);
    } finally {
      setLoadingLotes(false);
    }
  };

  // Material manual change
  const handleMaterialManualChange = async (codMat: string) => {
    setManualMaterial(codMat);
    const found = materiaisCombo.find((m) => m.value === codMat);
    if (found) setManualMaterialDesc(found.label);
    setManualLote('');
    setManualLocal(undefined);
    setLotesManualCombo([]);
    setLotesDisponiveisManual([]);
    setManualPesoUnitario(0);
    setManualPesoTotal('');
    if (!codMat) {
      setManualMaterialDesc('');
      return;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setCarregandoLotesManual(true);
      const [resInfo, resLotes] = await Promise.all([
        obterInfoMaterialSeparacaoCall(baseUrl, token, empresa, formOS.codigoCliente || 0, codMat),
        obterLotesDisponiveisSeparacaoCall(
          baseUrl,
          token,
          empresa,
          codMat,
          formOS.numSeparacao,
          tipoFiltroLote === 1,
          formOS.codigoCliente || undefined,
        ),
      ]);

      if (resInfo.succeeded && resInfo.jsonBody) {
        const info = resInfo.jsonBody;
        if (!info.valido && info.mensagem) {
          showError(info.mensagem);
        } else {
          if (info.descricaoMaterial) {
            setManualMaterialDesc(`${codMat} - ${info.descricaoMaterial}`);
          }
          setManualUnid(info.unidMedida || 'PC');
          const pUnit = Number(info.pesoUnitario || 0);
          setManualPesoUnitario(pUnit);
          const qtdNum = parseDecimalInput(manualQtd);
          if (qtdNum && qtdNum > 0 && pUnit > 0) {
            setManualPesoTotal((qtdNum * pUnit).toFixed(3));
          }
          if (!formOS.codigoCFO && info.codigoCFO) {
            setFormOS((prev) => ({
              ...prev,
              codigoCFO: info.codigoCFO,
              descricaoCFO: info.descricaoCFO || prev.descricaoCFO,
            }));
          }
        }
      }

      if (resLotes.succeeded && Array.isArray(resLotes.jsonBody)) {
        setLotesDisponiveisManual(resLotes.jsonBody);
        const options: SearchableSelectOption[] = [
          { value: '', label: 'Sem Lote (Alocação Automática)' },
          ...resLotes.jsonBody.map((l: LoteDisponivel) => ({
            value: l.codigoLote,
            label: `${l.codigoLote}${l.loteFornecedor ? ` [Forn: ${l.loteFornecedor}]` : ''} - Saldo: ${Number(l.qtdDisponivel).toLocaleString('pt-BR')} ${l.unidMedida || ''} (Local ${l.codigoLocal})`,
          })),
        ];
        setLotesManualCombo(options);
      }
    } catch {
      // Falha silenciosa
    } finally {
      setCarregandoLotesManual(false);
    }
  };

  const handleManualQtdChange = (val: string) => {
    setManualQtd(val);
    const qtdNum = parseDecimalInput(val);
    if (qtdNum && qtdNum > 0 && manualPesoUnitario > 0) {
      setManualPesoTotal((qtdNum * manualPesoUnitario).toFixed(3));
    } else if (!val.trim()) {
      setManualPesoTotal('');
    }
  };

  const abrirBuscaLotesManual = async () => {
    if (!manualMaterial) {
      showInfo('Selecione primeiro o material para consultar os lotes disponíveis.');
      return;
    }
    setItemParaAlterarLote(null);
    setModoLoteEditModal(false);
    setMaterialLotesConsultando(manualMaterial);
    setDescricaoLotesConsultando(manualMaterialDesc || manualMaterial);
    await carregarLotesParaModal(manualMaterial);
  };

  const abrirBuscaLoteParaItem = async (item: OrdemItem, fromEditModal = false) => {
    if (osReadOnly) return;
    setItemParaAlterarLote(item);
    setModoLoteEditModal(fromEditModal);
    setMaterialLotesConsultando(item.codigoMaterial);
    setDescricaoLotesConsultando(item.descricaoMaterial || '');
    await carregarLotesParaModal(item.codigoMaterial);
  };

  // Atualizar item na API (com LOTE_CLIENTE e PARCIAL)
  const executarAtualizacaoItem = async (
    numItem: number,
    req: {
      numLote?: string | null;
      codigoLocal?: number | null;
      qtdSeparar?: number | null;
      pesoMaterial?: number | null;
      pesoEmbReal?: number | null;
      qtdPorEmb?: number | null;
      qtdVolumes?: number | null;
      confirmarLoteOutroCliente?: boolean;
      confirmarParcial?: boolean;
    },
    onSuccess?: () => void,
  ) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token || !formOS.numSeparacao) return;

    try {
      setSalvando(true);
      const resp = await atualizarItemSeparacaoCall(baseUrl, token, formOS.numSeparacao, numItem, {
        codigoEmpresa: empresa,
        ...req,
        usuario,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || `Item #${numItem} atualizado!`);
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        void carregarOrdens();
        onSuccess?.();
      } else if (body?.codigoConfirmacao === 'LOTE_CLIENTE') {
        setConfirmDialog({
          titulo: 'Lote Exclusivo de Outro Cliente',
          subtitulo: `Item #${numItem}`,
          mensagem: body.mensagem || 'Lote pertence a outro cliente com Regra 23. Deseja utilizar mesmo assim?',
          confirmLabel: 'Sim, utilizar lote',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarAtualizacaoItem(numItem, { ...req, confirmarLoteOutroCliente: true }, onSuccess);
          },
        });
      } else if (body?.codigoConfirmacao === 'PARCIAL') {
        setConfirmDialog({
          titulo: 'Separação Parcial',
          subtitulo: `Item #${numItem}`,
          mensagem: body.mensagem || 'Saldo disponível menor que a quantidade informada. Continuar parcialmente?',
          confirmLabel: 'Sim, confirmar parcial',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarAtualizacaoItem(numItem, { ...req, confirmarParcial: true }, onSuccess);
          },
        });
      } else {
        showError(body?.mensagem || 'Falha ao atualizar item da separação.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao atualizar item.');
    } finally {
      setSalvando(false);
    }
  };

  const selecionarLote = async (lote: LoteDisponivel | null) => {
    if (modoLoteEditModal && itemEditando) {
      setEditLote(lote?.codigoLote || '');
      if (lote?.codigoLocal) setEditLocal(String(lote.codigoLocal));
      setModalLotesAberta(false);
      setItemParaAlterarLote(null);
      setModoLoteEditModal(false);
      return;
    }

    if (itemParaAlterarLote) {
      await executarAtualizacaoItem(
        itemParaAlterarLote.numItem,
        {
          numLote: lote?.codigoLote ?? '',
          codigoLocal: lote?.codigoLocal ?? itemParaAlterarLote.codigoLocal ?? null,
        },
        () => {
          setModalLotesAberta(false);
          setItemParaAlterarLote(null);
        },
      );
    } else {
      setManualLote(lote?.codigoLote || '');
      setManualLocal(lote?.codigoLocal);
      setModalLotesAberta(false);
    }
  };

  // Incluir Material manual (com PARCIAL e LOTE_CLIENTE)
  const executarAdicionarItemManual = async (opts?: {
    confirmarParcial?: boolean;
    confirmarLoteOutroCliente?: boolean;
  }) => {
    if (osReadOnly) return;
    if (!formOS.codigoCliente || formOS.codigoCliente <= 0) {
      showError('Selecione o Cliente no cabeçalho antes de incluir materiais.');
      return;
    }
    if (!manualMaterial) {
      showError('Selecione o material.');
      return;
    }
    const qtdNum = parseDecimalInput(manualQtd);
    if (!qtdNum || qtdNum <= 0) {
      showError('Informe uma quantidade válida maior que zero.');
      return;
    }

    let osAtual = formOS;
    if (modoNovo || !formOS.numSeparacao) {
      const detSalvo = await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
      if (!detSalvo) return;
      osAtual = detSalvo;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token || !osAtual.numSeparacao) return;

    const pesoTotNum = parseDecimalInput(manualPesoTotal);

    try {
      setSalvando(true);
      const payload = {
        codigoMaterial: manualMaterial,
        qtdSeparar: qtdNum,
        pesoTotal: pesoTotNum && pesoTotNum > 0 ? pesoTotNum : null,
        unidMedida: manualUnid || 'PC',
        numLote: manualLote || null,
        codigoLocal: manualLocal ?? null,
        confirmarParcial: Boolean(opts?.confirmarParcial),
        confirmarLoteOutroCliente: Boolean(opts?.confirmarLoteOutroCliente),
        usuario,
      };

      const resp = await adicionarItemManualSeparacaoCall(baseUrl, token, osAtual.numSeparacao, empresa, payload);
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Material incluído na separação!');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        limparCamposInclusao();
        void carregarOrdens();
      } else if (body?.codigoConfirmacao === 'PARCIAL') {
        setConfirmDialog({
          titulo: 'Saldo Parcial em Estoque',
          subtitulo: manualMaterial,
          mensagem: body.mensagem || 'Saldo insuficiente para quantidade total. Separar parcialmente?',
          confirmLabel: 'Sim, separar parcial',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarAdicionarItemManual({ ...opts, confirmarParcial: true });
          },
        });
      } else if (body?.codigoConfirmacao === 'LOTE_CLIENTE') {
        setConfirmDialog({
          titulo: 'Lote Exclusivo de Outro Cliente',
          subtitulo: `${manualMaterial} • Lote ${manualLote}`,
          mensagem: body.mensagem || 'Lote pertence a outro cliente. Deseja utilizá-lo?',
          confirmLabel: 'Sim, utilizar lote',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarAdicionarItemManual({ ...opts, confirmarLoteOutroCliente: true });
          },
        });
      } else {
        showError(body?.mensagem || body?.message || 'Falha ao incluir material.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao incluir material.');
    } finally {
      setSalvando(false);
    }
  };

  // Validar Pallet / Caixa
  const handleValidarEmbalagem = async (tipo: 1 | 2) => {
    const serial = (tipo === 1 ? serialPalete : serialCaixa).trim();
    if (!serial) {
      if (tipo === 1) setPesoTotalPalete('');
      else setPesoTotalCaixa('');
      return;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      const resp = await validarEmbalagemSeparacaoCall(
        baseUrl,
        token,
        empresa,
        formOS.codigoCliente || 0,
        formOS.numSeparacao || 0,
        serial,
        tipo,
      );
      if (resp.succeeded && resp.jsonBody) {
        if (resp.jsonBody.valido) {
          const pesoFmt = Number(resp.jsonBody.pesoTotal || 0).toFixed(3);
          if (tipo === 1) setPesoTotalPalete(pesoFmt);
          else setPesoTotalCaixa(pesoFmt);
        } else {
          if (tipo === 1) setPesoTotalPalete('');
          else setPesoTotalCaixa('');
          showError(resp.jsonBody.mensagem || 'Embalagem inválida.');
        }
      }
    } catch {
      // ignora erro de leitura
    }
  };

  // Incluir Pallet / Caixa
  const handleIncluirEmbalagem = async (tipo: 1 | 2) => {
    if (osReadOnly) return;
    if (!formOS.codigoCliente || formOS.codigoCliente <= 0) {
      showError('Selecione o Cliente no cabeçalho antes de incluir embalagens.');
      return;
    }

    const serial = (tipo === 1 ? serialPalete : serialCaixa).trim();
    const nomeTipo = tipo === 1 ? 'Pallet' : 'Caixa';
    if (!serial) {
      showError(`Informe o número do(a) ${nomeTipo}.`);
      return;
    }

    let osAtual = formOS;
    if (modoNovo || !formOS.numSeparacao) {
      const detSalvo = await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
      if (!detSalvo) return;
      osAtual = detSalvo;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token || !osAtual.numSeparacao) return;

    try {
      setSalvando(true);
      const resp = await incluirEmbalagemSeparacaoCall(baseUrl, token, osAtual.numSeparacao, {
        codigoEmpresa: empresa,
        serialEmbalagem: serial,
        tipoEmbalagem: tipo,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || `${nomeTipo} incluído(a) com sucesso!`);
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        if (tipo === 1) {
          setSerialPalete('');
          setPesoTotalPalete('');
        } else {
          setSerialCaixa('');
          setPesoTotalCaixa('');
        }
        void carregarOrdens();
      } else {
        showError(body?.mensagem || body?.message || `Falha ao incluir ${nomeTipo}.`);
      }
    } catch (err: any) {
      showError(err?.message || `Erro ao incluir ${nomeTipo}.`);
    } finally {
      setSalvando(false);
    }
  };

  // Editar item completo (Modal Editar Item)
  const abrirModalEditarItem = (item: OrdemItem) => {
    if (osReadOnly) return;
    setItemEditando(item);
    setEditLote(item.numLote || '');
    setEditLocal(item.codigoLocal ? String(item.codigoLocal) : '');
    setEditQtd(String(item.qtdSeparar ?? item.qtdSeparada ?? ''));
    setEditPesoMaterial(String(item.pesoMaterial ?? ''));
    setEditQtdPorEmb(String(item.qtdPorEmb ?? ''));
    setEditQtdVolumes(String(item.qtdVolumes ?? ''));
    setEditPesoEmbReal(String(item.pesoEmbReal ?? ''));
  };

  const salvarEdicaoItem = async () => {
    if (!itemEditando) return;
    const qtd = parseDecimalInput(editQtd);
    if (!qtd || qtd <= 0) {
      showError('Quantidade a separar deve ser maior que zero.');
      return;
    }
    const localNum = editLocal ? parseInt(editLocal, 10) : null;
    await executarAtualizacaoItem(
      itemEditando.numItem,
      {
        numLote: editLote.trim() || '',
        codigoLocal: localNum && !Number.isNaN(localNum) ? localNum : null,
        qtdSeparar: qtd,
        pesoMaterial: formOS.permiteAlterarPeso ? parseDecimalInput(editPesoMaterial) : undefined,
        qtdPorEmb: parseDecimalInput(editQtdPorEmb),
        qtdVolumes: parseDecimalInput(editQtdVolumes),
        pesoEmbReal: parseDecimalInput(editPesoEmbReal),
      },
      () => setItemEditando(null),
    );
  };

  // Detalhes de embalagem (Pallet/Caixa) por Item
  const abrirModalDetalhesItem = async (item: OrdemItem) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token || !formOS.numSeparacao) return;

    setModalDetalhesItem(item);
    setDetalhesItemLista([]);
    try {
      setCarregandoDetalhesItem(true);
      const resp = await obterDetalhesItemSeparacaoCall(baseUrl, token, formOS.numSeparacao, item.numItem, empresa);
      if (resp.succeeded && Array.isArray(resp.jsonBody)) {
        setDetalhesItemLista(resp.jsonBody);
      }
    } finally {
      setCarregandoDetalhesItem(false);
    }
  };

  const excluirDetalheEmbalagem = async (det: ItemDetalheEmb) => {
    if (osReadOnly || !formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setCarregandoDetalhesItem(true);
      const resp = await excluirItemSeparacaoCall(
        baseUrl,
        token,
        formOS.numSeparacao,
        det.numItem,
        empresa,
        det.numDetalhe,
      );
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Embalagem desvinculada com sucesso!');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        setDetalhesItemLista((prev) => prev.filter((x) => x.numDetalhe !== det.numDetalhe));
        void carregarOrdens();
      } else {
        showError(body?.mensagem || 'Não foi possível excluir detalhe.');
      }
    } finally {
      setCarregandoDetalhesItem(false);
    }
  };

  // Seriais por Item
  const abrirModalSeriais = async (item: OrdemItem) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token || !formOS.numSeparacao) return;

    setModalSeriaisItem(item);
    setSeriaisLista([]);
    setSeriaisSelecionados([]);
    try {
      setCarregandoSeriais(true);
      const resp = await listarSeriaisDisponiveisItemCall(
        baseUrl,
        token,
        formOS.numSeparacao,
        item.numItem,
        empresa,
        item.codigoMaterial,
        item.numLote || null,
      );
      if (resp.succeeded && Array.isArray(resp.jsonBody)) {
        const list: SerialDisponivel[] = resp.jsonBody;
        setSeriaisLista(list);
        setSeriaisSelecionados(list.filter((s) => s.selecionado).map((s) => s.numSerial));
      }
    } finally {
      setCarregandoSeriais(false);
    }
  };

  const salvarSeriaisItem = async () => {
    if (!modalSeriaisItem || !formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setCarregandoSeriais(true);
      const resp = await incluirSeriaisItemCall(baseUrl, token, formOS.numSeparacao, modalSeriaisItem.numItem, {
        codigoEmpresa: empresa,
        codigoMaterial: modalSeriaisItem.codigoMaterial,
        codigoLote: modalSeriaisItem.numLote || null,
        numSeriais: seriaisSelecionados,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Seriais vinculados com sucesso!');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        setModalSeriaisItem(null);
        void carregarOrdens();
      } else {
        showError(body?.mensagem || 'Falha ao salvar seriais.');
      }
    } finally {
      setCarregandoSeriais(false);
    }
  };

  // Liberar itens bloqueados (Situação 1)
  const handleLiberarItens = async (numSeparacaoTarget?: number, numItens?: number[]) => {
    const numSep = numSeparacaoTarget ?? formOS.numSeparacao;
    if (!numSep) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await liberarItensOrdemSeparacaoCall(baseUrl, token, numSep, {
        codigoEmpresa: empresa,
        usuario,
        numItens,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Itens liberados com sucesso!');
        if (body.detalhe && modalAberta && formOS.numSeparacao === numSep) {
          sincronizarDetalheNaTela(body.detalhe);
        }
        void carregarOrdens();
      } else {
        showError(body?.mensagem || 'Não foi possível liberar os itens.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao liberar itens.');
    } finally {
      setSalvando(false);
    }
  };

  // Leitor QR Code
  const abrirModalQrCode = () => {
    if (!formOS.itens || formOS.itens.length === 0) {
      showError('Adicione itens à Ordem de Separação antes de realizar a leitura de QR Code.');
      return;
    }
    setQrCodeInput('');
    if (formOS.situacaoSeparacao !== -1) {
      setEtiquetasLidas([]);
      setQtdLidaPorItemKey({});
    }
    setModalQrCodeAberta(true);
  };

  const handleLerEtiquetaQrCode = async () => {
    if (!qrCodeInput.trim() || !formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await validarQrCodeSeparacaoCall(baseUrl, token, formOS.numSeparacao, {
        codigoEmpresa: empresa,
        qrCodeTexto: qrCodeInput.trim(),
        etiquetasLidas,
      });

      if (resp.succeeded && resp.jsonBody?.sucesso) {
        const { codigoMaterial, numLote, qtdEtiqueta, numEtiqueta } = resp.jsonBody;
        const key = `${(codigoMaterial || '').trim().toUpperCase()}|${(numLote || '').trim().toUpperCase()}`;
        const itemAlvo = (formOS.itens || []).find(
          (i) =>
            i.codigoMaterial.trim().toUpperCase() === (codigoMaterial || '').trim().toUpperCase() &&
            (i.numLote || '').trim().toUpperCase() === (numLote || '').trim().toUpperCase(),
        );

        const qtdAtual = qtdLidaPorItemKey[key] || 0;
        const qtdMax = Number(itemAlvo?.qtdSeparar ?? itemAlvo?.qtdSeparada ?? 0);

        if (qtdMax > 0 && qtdAtual + Number(qtdEtiqueta) > qtdMax) {
          showError(
            `Quantidade lida (${qtdAtual + Number(qtdEtiqueta)}) ultrapassa a quantidade a separar (${qtdMax}) do material ${codigoMaterial}!`,
          );
          return;
        }

        setQtdLidaPorItemKey((prev) => ({
          ...prev,
          [key]: qtdAtual + Number(qtdEtiqueta),
        }));
        if (numEtiqueta) {
          setEtiquetasLidas((prev) => [...prev, numEtiqueta]);
        }
        setQrCodeInput('');
        showSuccess(`Etiqueta lida: ${codigoMaterial} (Lote: ${numLote || '-'}) +${qtdEtiqueta}`);
      } else {
        showError(resp.jsonBody?.mensagem || 'Etiqueta QR Code inválida.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao validar QR Code.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarQrCode = async () => {
    if (!formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await confirmarQrCodeSeparacaoCall(baseUrl, token, formOS.numSeparacao, empresa);
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Leitura de QR Code confirmada!');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        setModalQrCodeAberta(false);
        void carregarOrdens();
      } else {
        showError(body?.mensagem || body?.message || 'Falha ao confirmar leitura de QR Code.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao confirmar leitura de QR Code.');
    } finally {
      setSalvando(false);
    }
  };

  const executarResetQrCode = async () => {
    if (!formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await resetarQrCodeSeparacaoCall(baseUrl, token, formOS.numSeparacao, empresa);
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        setEtiquetasLidas([]);
        setQtdLidaPorItemKey({});
        setQrCodeInput('');
        showSuccess(body.mensagem || 'Leituras de QR Code resetadas.');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        void carregarOrdens();
      } else {
        showError(body?.mensagem || 'Falha ao resetar leitura de QR Code.');
      }
    } finally {
      setSalvando(false);
    }
  };

  // Observações
  const handleSalvarObservacoesSeparacao = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      if (formOS.codigoCliente && formOS.codigoCliente > 0) {
        await atualizarObservacaoClienteSeparacaoCall(baseUrl, token, formOS.codigoCliente, obsClienteTexto);
      }
      await salvarCabecalhoAutomatico({ observacaoSeparacaoCliente: obsClienteTexto }, undefined, undefined, true);
      setFormOS((prev) => ({ ...prev, observacaoSeparacaoCliente: obsClienteTexto }));
      setModalObsSeparacaoAberta(false);
    } catch (err: any) {
      showError(err?.message || 'Erro ao salvar observações.');
    } finally {
      setSalvando(false);
    }
  };

  // Modal Alterar Transportadora (unificação com pedidos / pós-conflito)
  const abrirModalAlterarTransportadora = async (
    preloaded?: TransportadoraOpcaoPedido[],
    sugestao?: number | null,
    mensagemConflito?: string,
  ) => {
    if (!formOS.numSeparacao) return;
    setTranspConflitoMensagem(mensagemConflito || '');
    setTranspSelecionadaModal(String(sugestao || formOS.codigoTransportadora || ''));
    setRedespSelecionadoModal(String(formOS.respRedespacho || ''));
    setModalTransportadoraAberta(true);

    if (preloaded && preloaded.length > 0) {
      setTranspOpcoesPedidos(preloaded);
      const optSug = preloaded.find((o) => o.codigoTransportadora === sugestao) ?? preloaded[0];
      if (optSug?.respRedespacho) {
        setRedespSelecionadoModal(String(optSug.respRedespacho));
      }
      return;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setCarregandoTranspPedidos(true);
      const resp = await obterTransportadorasPedidosSeparacaoCall(baseUrl, token, formOS.numSeparacao, empresa);
      if (resp.succeeded && Array.isArray(resp.jsonBody)) {
        setTranspOpcoesPedidos(resp.jsonBody);
      } else {
        setTranspOpcoesPedidos([]);
      }
    } finally {
      setCarregandoTranspPedidos(false);
    }
  };

  const handleConfirmarAlterarTransportadora = async () => {
    if (!formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token) return;

    const transpId = transpSelecionadaModal ? parseInt(transpSelecionadaModal, 10) : null;
    const redespId = redespSelecionadoModal ? parseInt(redespSelecionadoModal, 10) : null;

    try {
      setSalvando(true);
      const resp = await alterarTransportadoraSeparacaoCall(baseUrl, token, formOS.numSeparacao, {
        codigoEmpresa: empresa,
        codigoTransportadora: transpId,
        respRedespacho: redespId,
        usuario,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || 'Transportadora atualizada com sucesso!');
        if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
        setModalTransportadoraAberta(false);
        void carregarOrdens();
      } else {
        showError(body?.mensagem || 'Falha ao alterar transportadora.');
      }
    } finally {
      setSalvando(false);
    }
  };

  // Confirmar Ordem de Separação (com Capacidade, Valor Máximo, Itens Bloqueados, Conflito Transportadora)
  const executarConfirmarOrdemSeparacao = async (opts?: {
    confirmarCapacidadeVeiculo?: boolean;
    confirmarValorMaximo?: boolean;
  }) => {
    if (!formOS.codigoCliente || formOS.codigoCliente <= 0) {
      showError('Código do cliente não foi preenchido.');
      return;
    }
    if (!formOS.codigoTransportadora || formOS.codigoTransportadora <= 0) {
      showError('Código da transportadora não foi preenchido.');
      return;
    }
    if (!formOS.itens || formOS.itens.length === 0) {
      showError('Ordem de separação não possui itens cadastrados.');
      return;
    }

    let osAtual = formOS;
    if (modoNovo || !formOS.numSeparacao) {
      const detSalvo = await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
      if (!detSalvo) return;
      osAtual = detSalvo;
    } else if (!opts?.confirmarCapacidadeVeiculo && !opts?.confirmarValorMaximo) {
      const detSalvo = await salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
      if (detSalvo) osAtual = detSalvo;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token || !osAtual.numSeparacao) return;

    try {
      setSalvando(true);
      const resp = await confirmarOrdemSeparacaoCall(baseUrl, token, osAtual.numSeparacao, {
        codigoEmpresa: empresa,
        geraSolicEmbalagem,
        confirmarCapacidadeVeiculo: Boolean(opts?.confirmarCapacidadeVeiculo),
        confirmarValorMaximo: Boolean(opts?.confirmarValorMaximo),
        usuario,
      });
      const body = resp.jsonBody ?? resp.data;

      if (resp.succeeded && body?.sucesso) {
        setModalConfirmarOSAberta(false);
        void carregarOrdens();

        if (body.codigoConfirmacao === 'ITENS_BLOQUEADOS') {
          if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
          showError(body.mensagem || 'Ordem confirmada com itens bloqueados para expedição. Libere-os na aba Pendentes de Liberação.');
          setActiveTab('itens');
          return;
        }

        showSuccess(body.mensagem || 'Ordem de separação confirmada com sucesso!');

        if (body.codigoConfirmacao === 'CONFLITO_TRANSPORTADORA') {
          if (body.detalhe) sincronizarDetalheNaTela(body.detalhe);
          await abrirModalAlterarTransportadora(
            body.opcoesTransportadora || [],
            body.transportadoraSugerida,
            'A transportadora da Ordem de Separação diverge da transportadora informada nos pedidos vinculados. Deseja ajustar?',
          );
          return;
        }

        setModalAberta(false);
        return;
      }

      setModalConfirmarOSAberta(false);

      if (body?.codigoConfirmacao === 'CAPACIDADE_VEICULO') {
        const capFmt = Number(body.capacidadeVeiculo || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const pesoFmt = Number(body.pesoTotalCarga || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        setConfirmDialog({
          titulo: 'Capacidade do Veículo Excedida',
          subtitulo: `Ordem #${String(osAtual.numSeparacao).padStart(6, '0')}`,
          mensagem:
            body.mensagem ||
            `Peso total (${pesoFmt} kg) ultrapassa a capacidade do veículo (${capFmt} kg). Deseja confirmar mesmo assim?`,
          confirmLabel: 'Sim, confirmar carga',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarConfirmarOrdemSeparacao({ ...opts, confirmarCapacidadeVeiculo: true });
          },
        });
      } else if (body?.codigoConfirmacao === 'VALOR_MAXIMO') {
        setConfirmDialog({
          titulo: 'Valor Máximo de Faturamento Excedido',
          subtitulo: `Ordem #${String(osAtual.numSeparacao).padStart(6, '0')}`,
          mensagem: body.mensagem || 'O valor da separação ultrapassa o limite máximo configurado para a empresa.',
          confirmLabel: 'Sim, confirmar mesmo assim',
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarConfirmarOrdemSeparacao({ ...opts, confirmarValorMaximo: true });
          },
        });
      } else if (body?.codigoConfirmacao === 'ITENS_BLOQUEADOS') {
        if (osAtual.numSeparacao) {
          const detReload = await obterOrdemSeparacaoDetalheCall(
            baseUrl,
            token,
            empresa,
            osAtual.numSeparacao,
            usuario,
          );
          if (detReload.succeeded && detReload.jsonBody) {
            sincronizarDetalheNaTela(detReload.jsonBody);
          }
        }
        void carregarOrdens();
        showError(body.mensagem || 'Existem itens bloqueados para expedição.');
        setActiveTab('itens');
      } else {
        showError(body?.mensagem || body?.message || 'Não foi possível confirmar a ordem de separação.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao confirmar ordem de separação.');
    } finally {
      setSalvando(false);
    }
  };

  // Exclusão de item (com CONFIRMAR_KIT)
  const executarExclusaoItem = async (confirmarKit = false) => {
    if (!itemParaExcluir || !formOS.numSeparacao) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setSalvando(true);
      const resp = await excluirItemSeparacaoCall(
        baseUrl,
        token,
        formOS.numSeparacao,
        itemParaExcluir.numItem,
        empresa,
        undefined,
        confirmarKit,
      );
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(body.mensagem || `Item ${itemParaExcluir.numItem} removido com sucesso!`);
        if (body.detalhe) {
          sincronizarDetalheNaTela(body.detalhe);
        } else {
          setFormOS((prev) => ({
            ...prev,
            itens: prev.itens?.filter((i) => i.numItem !== itemParaExcluir.numItem),
          }));
        }
        setItemParaExcluir(null);
        void carregarOrdens();
      } else if (body?.codigoConfirmacao === 'CONFIRMAR_KIT') {
        const alvo = itemParaExcluir;
        setItemParaExcluir(null);
        setConfirmDialog({
          titulo: 'Exclusão de Item de KIT',
          subtitulo: `Material ${alvo.codigoMaterial}`,
          mensagem: body.mensagem || 'Este item pertence a um KIT. Todos os componentes do pedido podem ser afetados. Confirma a exclusão?',
          confirmLabel: 'Sim, remover KIT',
          danger: true,
          onConfirm: async () => {
            setConfirmDialog(null);
            setItemParaExcluir(alvo);
            // chama endpoint diretamente para evitar race de estado
            try {
              setSalvando(true);
              const rKit = await excluirItemSeparacaoCall(
                baseUrl,
                token,
                formOS.numSeparacao!,
                alvo.numItem,
                empresa,
                undefined,
                true,
              );
              const bKit = rKit.jsonBody ?? rKit.data;
              if (rKit.succeeded && bKit?.sucesso) {
                showSuccess(bKit.mensagem || 'Itens do KIT removidos com sucesso!');
                if (bKit.detalhe) sincronizarDetalheNaTela(bKit.detalhe);
                setItemParaExcluir(null);
                void carregarOrdens();
              } else {
                setItemParaExcluir(null);
                showError(bKit?.mensagem || 'Falha ao remover KIT.');
              }
            } finally {
              setSalvando(false);
            }
          },
        });
      } else {
        showError(body?.mensagem || 'Falha ao remover item.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao remover item.');
    } finally {
      setSalvando(false);
    }
  };

  // Cancelar (9) ou Estornar (0) Ordem de Separação (com PEDIDO_ENCERRADO)
  const executarCancelamentoOuEstorno = async (
    numSep: number,
    situacaoDestino: 0 | 9,
    ignorarProgEnc = false,
  ) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    const usuario = GlobalConfig.getUsuario() || 'ADMIN';
    if (!baseUrl || !token) return;

    try {
      setLoading(true);
      const resp = await cancelarOrdemSeparacaoCall(baseUrl, token, numSep, empresa, {
        situacao: situacaoDestino,
        ignorarProgEnc,
        usuario,
      });
      const body = resp.jsonBody ?? resp.data;
      if (resp.succeeded && body?.sucesso) {
        showSuccess(
          body.mensagem ||
            (situacaoDestino === 0
              ? `Ordem ${numSep} estornada para Em Digitação!`
              : `Ordem ${numSep} cancelada com sucesso!`),
        );
        setAcaoStatusOS(null);
        void carregarOrdens();
        if (modalAberta && formOS.numSeparacao === numSep) {
          if (situacaoDestino === 0 && body.detalhe) {
            sincronizarDetalheNaTela(body.detalhe);
          } else {
            setModalAberta(false);
          }
        }
      } else if (body?.codigoConfirmacao === 'PEDIDO_ENCERRADO') {
        setAcaoStatusOS(null);
        setConfirmDialog({
          titulo: 'Pedido / Programa Encerrado',
          subtitulo: `Ordem #${String(numSep).padStart(6, '0')}`,
          mensagem:
            body.mensagem ||
            'Existem pedidos/programas encerrados vinculados a esta Ordem. Deseja prosseguir mesmo assim?',
          confirmLabel: 'Sim, prosseguir',
          danger: situacaoDestino === 9,
          onConfirm: async () => {
            setConfirmDialog(null);
            await executarCancelamentoOuEstorno(numSep, situacaoDestino, true);
          },
        });
      } else {
        showError(body?.mensagem || 'Falha ao processar alteração da ordem de separação.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao cancelar/estornar ordem de separação.');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // RELATÓRIOS OFICIAIS (Lotes Separados & Lotes Disponíveis)
  // =========================================================================

  const formatarDataAccess = (val?: string | Date | null): string => {
    if (!val) return '';
    const str = String(val);
    const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      const [, ano, mes, dia] = matchIso;
      return `${dia}/${mes}/${ano.slice(-2)}`;
    }
    const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (matchBr) {
      const [, dia, mes, ano] = matchBr;
      return `${dia}/${mes}/${ano.slice(-2)}`;
    }
    return str;
  };

  const formatarHoraAccess = (val?: string | Date | null): string => {
    if (!val) return '';
    const str = String(val);
    const matchTime = str.match(/(\d{2}):(\d{2})/);
    if (matchTime) return `${matchTime[1]}:${matchTime[2]}`;
    return str.slice(0, 5);
  };

  const formatarDataHoraAgoraAccess = () => {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = String(d.getFullYear()).slice(-2);
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
  };

  const carregarRelatorio = async (tipo: 1 | 2) => {
    if (!formOS.numSeparacao) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const empresa = GlobalConfig.getCodEmpresa() ?? 1;
    if (!baseUrl || !token) return;

    try {
      setCarregandoRelatorio(true);
      const resp = await obterRelatorioOrdemSeparacaoCall(baseUrl, token, formOS.numSeparacao, empresa, tipo);
      if (resp.succeeded && resp.jsonBody) {
        setDadosRelatorio(resp.jsonBody);
      } else {
        setDadosRelatorio(null);
      }
    } catch {
      setDadosRelatorio(null);
    } finally {
      setCarregandoRelatorio(false);
    }
  };

  const gerarHtmlRelatorioSeparados = (rel: any, os: Partial<OrdemDetalhe>): string => {
    const numOS = escapeHtml(rel?.numSeparacao || os.numSeparacao || 0);
    const dataSep = escapeHtml(formatarDataAccess(rel?.dataSeparacao || os.dataSeparacao) || dataSeparacaoBr);
    const horaSep = escapeHtml(formatarHoraAccess(rel?.horaSeparacao || os.horaSeparacao) || horaSeparacaoStr || '00:00');
    const usuario = escapeHtml(rel?.codigoUsuario || os.codigoUsuario || 'ADMIN');
    const nomeCliente = escapeHtml(rel?.nomeCliente || os.nomeCliente || '-');
    const nomeTransp = escapeHtml(rel?.nomeTransportadora || os.nomeTransportadora || '-');
    const veiculo = escapeHtml(rel?.chapaVeiculo || os.chapaVeiculo || '');
    const agoraFmt = escapeHtml(formatarDataHoraAgoraAccess());

    let grupos: any[] = [];
    if (rel?.produtosSeparados && Array.isArray(rel.produtosSeparados) && rel.produtosSeparados.length > 0) {
      grupos = rel.produtosSeparados;
    } else {
      const mapGrupos = new Map<string, any>();
      (os.itens || []).forEach((it) => {
        const mat = it.codigoMaterial;
        if (!mapGrupos.has(mat)) {
          mapGrupos.set(mat, {
            codigoMaterial: mat,
            descricaoMaterial: it.descricaoMaterial || '',
            codigoProdutoCliente: it.codigoProdutoCliente || '',
            lotes: [],
          });
        }
        const g = mapGrupos.get(mat)!;
        const qtdSep = Number(it.qtdSeparar ?? it.qtdSeparada ?? 0);
        const qtdPorEmb = Number(it.qtdPorEmb || 1);
        const vols = it.qtdVolumes ? String(it.qtdVolumes).padStart(3, '0') : '001';
        const pesoProd = Number(it.pesoMaterial || 0) * qtdSep;
        const pesoEmb = Number(it.pesoEmbReal || 0);
        const pesoTot = pesoProd + pesoEmb;
        g.lotes.push({
          enderecoLocal: it.enderecoLocal || (it.codigoLocal ? `ID ${it.codigoLocal}` : ''),
          numLote: it.numLote || '',
          loteFornec: it.loteFornec || '',
          qtdSeparada: qtdSep,
          unidMedida: it.unidMedida || 'PC',
          qtdPorEmb,
          qtdVolumes: vols,
          pesoMaterial: pesoProd,
          pesoEmbalagem: pesoEmb,
          pesoTotal: pesoTot,
        });
      });
      grupos = Array.from(mapGrupos.values());
    }

    let qtdItensTotal = rel?.qtdItensSeparados || 0;
    let totalPesoMaterial = rel?.totalPesoMaterial || 0;
    let totalPesoEmbalagem = rel?.totalPesoEmbalagem || 0;
    let totalPesoGeral = rel?.totalPesoGeral || 0;

    if (!rel?.qtdItensSeparados) {
      qtdItensTotal = (os.itens || []).length;
      totalPesoMaterial = grupos.reduce(
        (acc, g) => acc + g.lotes.reduce((sum: number, l: any) => sum + Number(l.pesoMaterial || 0), 0),
        0,
      );
      totalPesoEmbalagem = grupos.reduce(
        (acc, g) => acc + g.lotes.reduce((sum: number, l: any) => sum + Number(l.pesoEmbalagem || 0), 0),
        0,
      );
      totalPesoGeral = totalPesoMaterial + totalPesoEmbalagem;
    }

    const linhasCorpo = grupos
      .map((g) => {
        const headerProd = `
        <tr style="background-color: #ffffff;">
          <td colspan="6" style="padding: 10px 4px 4px 4px; font-weight: bold; font-size: 11px;">
            Produto: &nbsp;&nbsp;&nbsp;&nbsp; <span style="display:inline-block; min-width: 90px;">${escapeHtml(g.codigoMaterial)}</span> &nbsp;&nbsp;&nbsp;&nbsp; <span>${escapeHtml(g.descricaoMaterial || '')}</span>
          </td>
          <td colspan="3" style="padding: 10px 4px 4px 4px; font-weight: bold; font-size: 11px; text-align: right;">
            Cod. Cliente: &nbsp; <span>${escapeHtml(g.codigoProdutoCliente || '')}</span>
          </td>
        </tr>
      `;

        const linhasLotes = (g.lotes || [])
          .map(
            (l: any) => `
        <tr style="background-color: #efefef; font-size: 10.5px;">
          <td style="padding: 4px 6px; text-align: center;">${escapeHtml(l.enderecoLocal || '')}</td>
          <td style="padding: 4px 6px; text-align: center; font-weight: bold;">${escapeHtml(l.numLote || '')}</td>
          <td style="padding: 4px 6px; text-align: center;">${escapeHtml(l.loteFornec || '')}</td>
          <td style="padding: 4px 6px; text-align: right;">${Number(l.qtdSeparada).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${escapeHtml(l.unidMedida || 'PC')}</td>
          <td style="padding: 4px 6px; text-align: right;">${Number(l.qtdPorEmb).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${escapeHtml(l.unidMedida || 'PC')}</td>
          <td style="padding: 4px 6px; text-align: center;">${escapeHtml(String(l.qtdVolumes || '001').padStart(3, '0'))}</td>
          <td style="padding: 4px 6px; text-align: right;">${Number(l.pesoMaterial).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
          <td style="padding: 4px 6px; text-align: right;">${Number(l.pesoEmbalagem).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
          <td style="padding: 4px 6px; text-align: right;">${Number(l.pesoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
        </tr>
      `,
          )
          .join('');

        return headerProd + linhasLotes;
      })
      .join('');

    return `
<div style="font-family: Arial, Helvetica, sans-serif; color: #000000; background: #ffffff; width: 100%; box-sizing: border-box; line-height: 1.35;">
  <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0 4px 0; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="font-size: 22px; font-weight: bold; letter-spacing: -0.2px;">Ordem de Separação - Lotes separados</div>
    <div style="text-align: right; font-size: 11px; font-style: italic; line-height: 1.25;">
      <div>${agoraFmt}</div>
      <div>Página: &nbsp;&nbsp;&nbsp; 1 de 1</div>
    </div>
  </div>
  <div style="display: flex; gap: 36px; font-size: 11.5px; margin-bottom: 4px;">
    <div><strong>Número:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${numOS}</div>
    <div><strong>Data:</strong> &nbsp; ${dataSep}</div>
    <div><strong>Hora:</strong> &nbsp; ${horaSep}</div>
    <div><strong>Emitida por:</strong> &nbsp; ${usuario}</div>
  </div>
  <div style="font-size: 11.5px; margin-bottom: 4px;">
    <strong>Cliente:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${nomeCliente}
  </div>
  <div style="font-size: 11.5px; margin-bottom: 4px;">
    <strong>Transportadora:</strong> &nbsp; ${nomeTransp}
  </div>
  <div style="font-size: 11.5px; margin-bottom: 8px;">
    <strong>Veículo:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${veiculo}
  </div>
  <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;">
    <thead>
      <tr style="background-color: #c0c0c0; border-top: 1px solid #777; border-bottom: 1px solid #777;">
        <th style="padding: 4px 6px; text-align: center; border-right: 1px solid #777; width: 85px;" rowspan="2">Local</th>
        <th style="padding: 4px 6px; text-align: center; border-right: 1px solid #777; width: 85px;" rowspan="2">Lote</th>
        <th style="padding: 4px 6px; text-align: center; border-right: 1px solid #777; width: 60px;" rowspan="2">Forn.</th>
        <th style="padding: 4px 6px; text-align: right; border-right: 1px solid #777; width: 95px;" rowspan="2">Qtd. Separada</th>
        <th style="padding: 4px 6px; text-align: right; border-right: 1px solid #777; width: 95px;" rowspan="2">Qtd. Por Emb.</th>
        <th style="padding: 4px 6px; text-align: center; border-right: 1px solid #777; width: 45px;" rowspan="2">Vol.</th>
        <th style="padding: 4px 6px; text-align: center; border-bottom: 1px solid #777;" colspan="3">Peso (KG)</th>
      </tr>
      <tr style="background-color: #c0c0c0; border-bottom: 1px solid #777;">
        <th style="padding: 3px 6px; text-align: right; border-right: 1px solid #777; width: 75px;">Produto</th>
        <th style="padding: 3px 6px; text-align: right; border-right: 1px solid #777; width: 75px;">Embalagem</th>
        <th style="padding: 3px 6px; text-align: right; width: 75px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${linhasCorpo || '<tr><td colspan="9" style="text-align:center; padding: 20px;">Nenhum item na ordem de separação.</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: bold; font-size: 11.5px;">
        <td colspan="6" style="padding: 6px 4px; text-align: right;">
          Quantidade de itens: &nbsp;&nbsp;&nbsp; <span style="display: inline-block; min-width: 50px; text-align: left;">${String(qtdItensTotal).padStart(3, '0')}</span>
        </td>
        <td style="padding: 6px 4px; text-align: right;">${Number(totalPesoMaterial).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
        <td style="padding: 6px 4px; text-align: right;">${Number(totalPesoEmbalagem).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
        <td style="padding: 6px 4px; text-align: right;">${Number(totalPesoGeral).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
      </tr>
    </tfoot>
  </table>
  <div style="display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px;">
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Separador &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Conferente &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Responsável &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
  </div>
</div>`;
  };

  const gerarHtmlRelatorioDisponiveis = (rel: any, os: Partial<OrdemDetalhe>): string => {
    const numOS = escapeHtml(rel?.numSeparacao || os.numSeparacao || 0);
    const dataSep = escapeHtml(formatarDataAccess(rel?.dataSeparacao || os.dataSeparacao) || dataSeparacaoBr);
    const horaSep = escapeHtml(formatarHoraAccess(rel?.horaSeparacao || os.horaSeparacao) || horaSeparacaoStr || '00:00');
    const usuario = escapeHtml(rel?.codigoUsuario || os.codigoUsuario || 'ADMIN');
    const nomeCliente = escapeHtml(rel?.nomeCliente || os.nomeCliente || '-');
    const nomeTransp = escapeHtml(rel?.nomeTransportadora || os.nomeTransportadora || '-');
    const veiculo = escapeHtml(rel?.chapaVeiculo || os.chapaVeiculo || '');
    const agoraFmt = escapeHtml(formatarDataHoraAgoraAccess());

    let produtos: any[] = [];
    if (rel?.produtosDisponiveis && Array.isArray(rel.produtosDisponiveis) && rel.produtosDisponiveis.length > 0) {
      produtos = rel.produtosDisponiveis;
    } else {
      const mapProds = new Map<string, any>();
      (os.itens || []).forEach((it) => {
        const mat = it.codigoMaterial;
        if (!mapProds.has(mat)) {
          mapProds.set(mat, {
            codigoMaterial: mat,
            descricaoMaterial: it.descricaoMaterial || '',
            codigoProdutoCliente: it.codigoProdutoCliente || '',
            qtdSepararTotal: 0,
            unidMedida: it.unidMedida || 'PC',
            volumesTotal: '001',
            pesoMaterial: 0,
            pesoEmbalagem: 0,
            pesoTotal: 0,
            lotesEstoque: [],
          });
        }
        const p = mapProds.get(mat)!;
        const qtd = Number(it.qtdSeparar ?? it.qtdSeparada ?? 0);
        p.qtdSepararTotal += qtd;
        p.pesoMaterial += Number(it.pesoMaterial || 0) * qtd;
        p.pesoEmbalagem += Number(it.pesoEmbReal || 0);
        p.pesoTotal = p.pesoMaterial + p.pesoEmbalagem;
        if (it.qtdVolumes) p.volumesTotal = String(it.qtdVolumes).padStart(3, '0');
        if (it.numLote) {
          p.lotesEstoque.push({
            enderecoLocal: it.enderecoLocal || (it.codigoLocal ? `ID ${it.codigoLocal}` : ''),
            codigoLote: it.numLote,
            loteFornecedor: it.loteFornec || '',
            qtdDisponivel: qtd,
            unidMedida: it.unidMedida || 'PC',
          });
        }
      });
      produtos = Array.from(mapProds.values());
    }

    const qtdItensTotal = rel?.qtdItensDisponiveis || produtos.length;
    let totalPesoMaterial = rel?.totalPesoMaterialDisponivel || 0;
    let totalPesoEmbalagem = rel?.totalPesoEmbalagemDisponivel || 0;
    let totalPesoGeral = rel?.totalPesoGeralDisponivel || 0;

    if (!rel?.totalPesoGeralDisponivel) {
      totalPesoMaterial = produtos.reduce((acc, p) => acc + Number(p.pesoMaterial || 0), 0);
      totalPesoEmbalagem = produtos.reduce((acc, p) => acc + Number(p.pesoEmbalagem || 0), 0);
      totalPesoGeral = totalPesoMaterial + totalPesoEmbalagem;
    }

    const linhasCorpo = produtos
      .map((p) => {
        const lotes = p.lotesEstoque && p.lotesEstoque.length > 0 ? p.lotesEstoque : [null];
        const rowspan = lotes.length;

        return lotes
          .map((lot: any, idx: number) => {
            const isFirst = idx === 0;
            const leftCols = isFirst
              ? `
              <td rowspan="${rowspan}" style="vertical-align: top; padding: 5px 6px; font-weight: bold; border-right: 1px solid #777;">
                ${escapeHtml(p.codigoMaterial)}
              </td>
              <td rowspan="${rowspan}" style="vertical-align: top; padding: 5px 6px; border-right: 1px solid #777;">
                <div>${escapeHtml(p.descricaoMaterial)}</div>
                <div style="margin-top: 2px;">${escapeHtml(p.codigoProdutoCliente || '')}</div>
              </td>
              <td rowspan="${rowspan}" style="vertical-align: top; padding: 4px; border-right: 1px solid #777;">
                <div style="border: 1px solid #000; padding: 3px 6px; text-align: right; font-weight: bold; background: #fff;">
                  ${Number(p.qtdSepararTotal).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${escapeHtml(p.unidMedida)}
                </div>
              </td>
              <td rowspan="${rowspan}" style="vertical-align: top; padding: 4px; border-right: 1px solid #777;">
                <div style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold; background: #fff;">
                  ${escapeHtml(p.volumesTotal)}
                </div>
              </td>`
              : '';

            const rightCols = lot
              ? `
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px; text-align: center; background: #fff;">${escapeHtml(lot.enderecoLocal || '-')}</div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold; background: #fff;">${escapeHtml(lot.codigoLote)}</div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px; min-height: 20px; background: #fff;">${escapeHtml(lot.loteFornecedor || '')}</div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px 4px; text-align: right; background: #fff;">${Number(lot.qtdDisponivel).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px 4px; text-align: right; min-height: 20px; background: #fff;">${escapeHtml(p.unidMedida)}</div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px; min-height: 20px; background: #fff;"></div>
              </td>
              <td style="padding: 2px 3px;">
                <div style="border: 1px solid #000; padding: 3px 4px; text-align: right; min-height: 20px; background: #fff;">kg</div>
              </td>`
              : `
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px; text-align: center; background: #fff;">-</div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px; text-align: center; background: #fff;">-</div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px; min-height: 20px; background: #fff;"></div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px 4px; text-align: right; background: #fff;">0,0000</div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px 4px; text-align: right; min-height: 20px; background: #fff;">${escapeHtml(p.unidMedida)}</div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px; min-height: 20px; background: #fff;"></div></td>
              <td style="padding: 2px 3px;"><div style="border: 1px solid #000; padding: 3px 4px; text-align: right; min-height: 20px; background: #fff;">kg</div></td>`;

            return `<tr>${leftCols}${rightCols}</tr>`;
          })
          .join('');
      })
      .join('');

    return `
<div style="font-family: Arial, Helvetica, sans-serif; color: #000000; background: #ffffff; width: 100%; box-sizing: border-box; line-height: 1.35;">
  <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0 4px 0; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="font-size: 22px; font-weight: bold; letter-spacing: -0.2px;">Ordem de Separação - Lotes disponíveis</div>
    <div style="text-align: right; font-size: 11px; font-style: italic; line-height: 1.25;">
      <div>${agoraFmt}</div>
      <div>Página: &nbsp;&nbsp;&nbsp; 1 de 1</div>
    </div>
  </div>
  <div style="display: flex; gap: 36px; font-size: 11.5px; margin-bottom: 4px;">
    <div><strong>Separação:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${numOS}</div>
    <div><strong>Data:</strong> &nbsp; ${dataSep}</div>
    <div><strong>Hora:</strong> &nbsp; ${horaSep}</div>
    <div><strong>Emitida por:</strong> &nbsp; ${usuario}</div>
  </div>
  <div style="font-size: 11.5px; margin-bottom: 4px;">
    <strong>Cliente:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${nomeCliente}
  </div>
  <div style="font-size: 11.5px; margin-bottom: 4px;">
    <strong>Transportadora:</strong> &nbsp; ${nomeTransp}
  </div>
  <div style="font-size: 11.5px; margin-bottom: 8px;">
    <strong>Veículo:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${veiculo}
  </div>
  <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
  <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 12px;">
    <thead>
      <tr style="background-color: #c0c0c0; border-top: 1px solid #777; border-bottom: 1px solid #777;">
        <th style="padding: 4px 6px; text-align: left; width: 95px; border-right: 1px solid #aaa;">Código</th>
        <th style="padding: 4px 6px; text-align: left; width: 170px; border-right: 1px solid #aaa;">Descrição</th>
        <th style="padding: 4px 6px; text-align: right; width: 95px; border-right: 1px solid #aaa;">Qtd. Separar</th>
        <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #aaa;">Vol</th>
        <th style="padding: 4px 6px; text-align: center; width: 75px; border-right: 1px solid #aaa;">Local</th>
        <th style="padding: 4px 6px; text-align: center; width: 75px; border-right: 1px solid #aaa;">Lote</th>
        <th style="padding: 4px 6px; text-align: center; width: 55px; border-right: 1px solid #aaa;">Forn.</th>
        <th style="padding: 4px 6px; text-align: right; width: 75px; border-right: 1px solid #aaa;">Qtd. Disp.</th>
        <th style="padding: 4px 6px; text-align: right; width: 65px; border-right: 1px solid #aaa;">Qtd Sep.</th>
        <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #aaa;">Vol.</th>
        <th style="padding: 4px 6px; text-align: right; width: 65px;">Peso Emb.</th>
      </tr>
    </thead>
    <tbody>
      ${linhasCorpo || '<tr><td colspan="11" style="text-align:center; padding: 20px;">Nenhum item na ordem de separação.</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: bold; font-size: 11px;">
        <td colspan="11" style="padding: 6px 4px;">
          Quantidade de itens: &nbsp;&nbsp;&nbsp; <strong>${String(qtdItensTotal).padStart(3, '0')}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          Peso total: &nbsp;&nbsp;&nbsp; <strong>${Number(totalPesoGeral).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          Produto: &nbsp;&nbsp;&nbsp; <strong>${Number(totalPesoMaterial).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          Embal.: &nbsp;&nbsp;&nbsp; <strong>${Number(totalPesoEmbalagem).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</strong>
        </td>
      </tr>
    </tfoot>
  </table>
  <div style="display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px;">
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Separador &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Conferente &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
    <div style="width: 28%; border-top: 1px solid #000; padding-top: 5px; text-align: left;">
      Responsável &nbsp; - &nbsp; Data: ___/ ___/ ___
    </div>
  </div>
</div>`;
  };

  const obterHtmlRelatorioParaExibicao = (dados: any, tipo: 1 | 2, os: Partial<OrdemDetalhe>): string =>
    tipo === 1 ? gerarHtmlRelatorioSeparados(dados, os) : gerarHtmlRelatorioDisponiveis(dados, os);

  const imprimirRelatorioOrdemSeparacao = (dados: any, tipo: 1 | 2, os: Partial<OrdemDetalhe>) => {
    const conteudoRelatorio = obterHtmlRelatorioParaExibicao(dados, tipo, os);
    const numOS = escapeHtml(dados?.numSeparacao || os.numSeparacao || 0);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ordem de Separação #${numOS}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.35; color: #000000; background: #ffffff; margin: 0; padding: 0; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  </style>
</head>
<body>${conteudoRelatorio}</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          iframe.remove();
        }, 60000);
      }
    };
  };

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page ordens-separacao-page">
        <section className="clientes-panel list-layout-panel">
          <p className="module-empty">Verificando permissão de acesso...</p>
        </section>
      </main>
    );
  }

  if (permissaoStatus === 'negado') {
    return null;
  }

  const valorTotalCalculado =
    formOS.valorSeparacaoTotal ??
    (formOS.itens || []).reduce(
      (acc, i) => acc + Math.round(Number(i.qtdSeparar ?? i.qtdSeparada ?? 0) * Number(i.precoSeparacao || 0) * 100) / 100,
      0,
    );

  return (
    <main className="clientes-page list-layout-page ordens-separacao-page">
      {/* CABEÇALHO PADRÃO DA PÁGINA */}
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(ROUTES.home)}
            aria-label="Voltar"
            title="Voltar"
          >
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Ordens de Separação</h1>
            <p>Consulta, criação, liberação, conferência QR Code e expedição de lotes.</p>
          </div>
        </div>
      </section>

      {/* PAINEL DA LISTAGEM */}
      <section className="clientes-panel list-layout-panel separacao-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>
              {abaListagem !== 'pendentes' && !abaConsultada
                ? 'Aguardando filtro'
                : `${ordensFiltradas.length} encontrados`}
            </span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Pesquisar"
              placeholder="Pesquisar por ordem, pedido, NF, cliente ou CFOP..."
              className="clientes-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarOrdens({ manual: true })}
              aria-label="Atualizar lista"
              title="Atualizar lista"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => void abrirNovaOrdem()}
              aria-label="Nova Ordem de Separação"
              title="Nova Ordem de Separação"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        {/* ABAS PRINCIPAIS Q4 */}
        <div className="tributacao-tabs separacao-menu-tabs" role="tablist" aria-label="Situação das ordens">
          <button
            type="button"
            role="tab"
            aria-selected={abaListagem === 'pendentes'}
            className={`tributacao-tab ${abaListagem === 'pendentes' ? 'tributacao-tab--active' : ''}`}
            onClick={() => selecionarAbaListagem('pendentes')}
          >
            Pendentes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaListagem === 'liberacao'}
            className={`tributacao-tab ${abaListagem === 'liberacao' ? 'tributacao-tab--active' : ''}`}
            onClick={() => selecionarAbaListagem('liberacao')}
          >
            Pendentes de Liberação
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaListagem === 'emitidas'}
            className={`tributacao-tab ${abaListagem === 'emitidas' ? 'tributacao-tab--active' : ''}`}
            onClick={() => selecionarAbaListagem('emitidas')}
          >
            Emitidas / Faturadas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaListagem === 'todas'}
            className={`tributacao-tab ${abaListagem === 'todas' ? 'tributacao-tab--active' : ''}`}
            onClick={() => selecionarAbaListagem('todas')}
          >
            Todas
          </button>
        </div>

        {/* FILTROS AVANÇADOS (PERÍODO, NF E BUSCA) */}
        <div className="separacao-menu-filters">
          <div className="separacao-filter-field">
            <span>Data Inicial</span>
            <CustomDatePicker
              value={filtroDataInicioBr}
              onChange={setFiltroDataInicioBr}
              placeholder="DD/MM/AAAA"
            />
          </div>
          <div className="separacao-filter-field">
            <span>Data Final</span>
            <CustomDatePicker
              value={filtroDataFimBr}
              onChange={setFiltroDataFimBr}
              placeholder="DD/MM/AAAA"
            />
          </div>
          <label className="separacao-filter-field">
            <span>Nota Fiscal</span>
            <input
              type="text"
              value={filtroNumNf}
              onChange={(e) => setFiltroNumNf(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregarOrdens({ manual: true });
              }}
              placeholder="Nº NF..."
            />
          </label>
          <label className="separacao-filter-field separacao-filter-field--wide">
            <span>Ordem / Cliente / Pedido</span>
            <input
              type="text"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregarOrdens({ manual: true });
              }}
              placeholder="Ordem, pedido, cliente, CFOP..."
            />
          </label>
          <div className="separacao-menu-actions-inline">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void carregarOrdens({ manual: true })}
              disabled={loading}
            >
              <IoSearchOutline size={15} />
              Filtrar
            </button>
            {(filtroDataInicioBr || filtroDataFimBr || filtroNumNf || filtroBusca) && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setFiltroDataInicioBr('');
                  setFiltroDataFimBr('');
                  setFiltroNumNf('');
                  setFiltroBusca('');
                  if (abaListagem === 'pendentes') {
                    setAbaConsultada(true);
                    void carregarOrdens({
                      aba: 'pendentes',
                      dataInicio: '',
                      dataFim: '',
                      numNf: '',
                      busca: '',
                      manual: true,
                    });
                  } else {
                    listRequestIdRef.current += 1;
                    setLoading(false);
                    setOrdens([]);
                    setAbaConsultada(false);
                  }
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* TABELA PRINCIPAL */}
        <div className="data-cards-region">
          <DataListSortBar
            options={[
              { field: 'ordem', label: 'Ordem' },
              { field: 'data', label: 'Data' },
              { field: 'hora', label: 'Hora' },
              { field: 'cliente', label: 'Cliente' },
              { field: 'pedido', label: 'Pedido' },
              { field: 'cfop', label: 'CFOP' },
              { field: 'nf', label: 'NF / Série' },
              { field: 'usuario', label: 'Usuário' },
              { field: 'situacao', label: 'Situação' },
            ]}
            active={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
          {loading ? (
            <p className="module-empty">Carregando ordens de separação...</p>
          ) : abaListagem !== 'pendentes' && !abaConsultada ? (
            <p className="module-empty">
              Informe ao menos um filtro (Período, Nota Fiscal ou Ordem / Cliente / Pedido) e clique em <strong>Filtrar</strong> para consultar.
            </p>
          ) : ordensFiltradas.length === 0 ? (
            <p className="module-empty">Nenhuma ordem de separação encontrada para os filtros selecionados.</p>
          ) : (
            <DataList ariaLabel="Ordens de separação">
              {ordensFiltradas.map((item) => {
                const badge = getSituacaoBadgeInfo(item.situacaoSeparacao, item.itensPendentesLiberacao);
                const podeEstornar = item.situacaoSeparacao === 2 || item.situacaoSeparacao === 7;
                const podeCancelar = item.situacaoSeparacao !== 9 && item.situacaoSeparacao !== 8;

                return (
                  <DataListItem
                    key={item.numSeparacao}
                    code={String(item.numSeparacao).padStart(6, '0')}
                    title={item.nomeFantasia || '-'}
                    details={[
                      { label: 'Data', value: `${parseIsoToBrDate(item.dataSeparacao) || '-'} ${parseIsoToTime(item.horaSeparacao) || ''}`.trim() },
                      { label: 'Pedido', value: item.numPedido || '-' },
                      { label: 'CFOP', value: item.codigoCFO || '-' },
                      {
                        label: 'NF',
                        value: item.numNotaFiscal
                          ? `${item.numNotaFiscal}${item.serNotaFiscal ? `/${item.serNotaFiscal}` : ''}`
                          : '-',
                      },
                      { label: 'Usuário', value: item.codigoUsuario || '-' },
                    ]}
                    status={<span className={`separacao-status-pill ${badge.cls}`}>{badge.text}</span>}
                    onOpen={() => void abrirOrdemDetalhe(item.numSeparacao)}
                    actions={
                      <>
                          <button
                            type="button"
                            className="icon-button"
                            title="Consultar / Editar"
                            aria-label="Consultar / Editar"
                            onClick={() => void abrirOrdemDetalhe(item.numSeparacao)}
                          >
                            <IoCreateOutline size={16} />
                          </button>
                          {item.situacaoSeparacao === 1 && (
                            <button
                              type="button"
                              className="icon-button"
                              title="Liberar Itens Bloqueados"
                              aria-label="Liberar Itens Bloqueados"
                              onClick={() => void handleLiberarItens(item.numSeparacao)}
                            >
                              <IoLockOpenOutline size={15} />
                            </button>
                          )}
                          {podeEstornar && (
                            <button
                              type="button"
                              className="icon-button"
                              title="Estornar p/ Em Digitação"
                              aria-label="Estornar p/ Em Digitação"
                              onClick={() =>
                                setAcaoStatusOS({
                                  numSeparacao: item.numSeparacao,
                                  situacaoAtual: item.situacaoSeparacao,
                                  situacaoDestino: 0,
                                })
                              }
                            >
                              <IoReturnDownBackOutline size={15} />
                            </button>
                          )}
                          {podeCancelar && (
                            <button
                              type="button"
                              className="icon-button icon-button--danger"
                              title="Cancelar Ordem"
                              aria-label="Cancelar Ordem"
                              onClick={() =>
                                setAcaoStatusOS({
                                  numSeparacao: item.numSeparacao,
                                  situacaoAtual: item.situacaoSeparacao,
                                  situacaoDestino: 9,
                                })
                              }
                            >
                              <IoTrashOutline size={16} />
                            </button>
                          )}
                      </>
                    }
                  />
                );
              })}
            </DataList>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL PRINCIPAL: ORDEM DE SEPARAÇÃO                                       */}
      {/* ========================================================================= */}
      {modalAberta && (
        <section className="modal-backdrop" onClick={() => setModalAberta(false)}>
          <article
            className="modal-card separacao-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-card__header">
              <div>
                <div className="separacao-header-meta">
                  <h2>
                    Ordem de Separação:{' '}
                    <span>
                      {formOS.numSeparacao ? String(formOS.numSeparacao).padStart(6, '0') : 'Nova'}
                    </span>
                  </h2>
                  {(() => {
                    const badge = getSituacaoBadgeInfo(formOS.situacaoSeparacao ?? 0);
                    return <span className={`separacao-status-pill ${badge.cls}`}>{badge.text}</span>;
                  })()}
                </div>
                <p>
                  {formOS.nomeCliente
                    ? `${formOS.nomeCliente}${formOS.razaoSocialCliente ? ` (${formOS.razaoSocialCliente})` : ''}`
                    : 'Preencha os dados do cabeçalho da separação'}
                </p>
              </div>

              <div className="separacao-header-meta">
                {!modoNovo && formOS.numSeparacao ? (
                  <button
                    type="button"
                    className="icon-button"
                    title="Alterar / Unificar Transportadora com Pedidos"
                    aria-label="Alterar Transportadora"
                    onClick={() => void abrirModalAlterarTransportadora()}
                  >
                    <IoSwapHorizontalOutline size={17} />
                  </button>
                ) : null}
                <ModalHeaderActions onClose={() => setModalAberta(false)} />
              </div>
            </header>

            <div className="tributacao-tabs separacao-modal-tabs">
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'geral' ? 'tributacao-tab--active' : ''}`}
                onClick={() => void handleTrocarAba('geral')}
              >
                Cabeçalho &amp; Transporte
              </button>
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'itens' ? 'tributacao-tab--active' : ''}`}
                onClick={() => void handleTrocarAba('itens')}
              >
                Itens da Separação ({formOS.itens?.length || 0})
              </button>
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'obs' ? 'tributacao-tab--active' : ''}`}
                onClick={() => void handleTrocarAba('obs')}
              >
                Observações
              </button>
            </div>

            <div className="modal-body">
              {osReadOnly && (
                <div className="separacao-alert-box separacao-alert-box--warning" style={{ marginBottom: '14px' }}>
                  Esta ordem encontra-se em situação <strong>{getSituacaoBadgeInfo(formOS.situacaoSeparacao ?? 0).text}</strong> e está somente leitura.
                  {(formOS.situacaoSeparacao === 2 || formOS.situacaoSeparacao === 7) &&
                    ' Para alterar itens ou quantidades, estorne para Em Digitação no rodapé.'}
                </div>
              )}

              {/* ABA 1: CABEÇALHO & TRANSPORTE */}
              {activeTab === 'geral' && (
                <div className="separacao-form-grid">
                  <label className="separacao-field">
                    <span>Número da Separação</span>
                    <input
                      type="text"
                      value={formOS.numSeparacao ? String(formOS.numSeparacao).padStart(6, '0') : ''}
                      disabled
                    />
                  </label>

                  <div className="separacao-field">
                    <span>Data da Separação</span>
                    <CustomDatePicker
                      value={dataSeparacaoBr}
                      disabled={osReadOnly}
                      onChange={(novaDataBr) => {
                        setDataSeparacaoBr(novaDataBr);
                        if (formOS.codigoCliente && formOS.codigoCliente > 0 && parseBrDateToIso(novaDataBr)) {
                          void salvarCabecalhoAutomatico(undefined, novaDataBr, undefined, false);
                        }
                      }}
                    />
                  </div>

                  <div className="separacao-field">
                    <span>Hora da Separação {formOS.utilizaSeppen ? '*' : ''}</span>
                    <CustomTimePicker
                      value={horaSeparacaoStr}
                      disabled={osReadOnly}
                      stepMinutes={15}
                      onChange={(novaHora) => {
                        setHoraSeparacaoStr(novaHora);
                        if (formOS.codigoCliente && formOS.codigoCliente > 0 && isValidTime24h(novaHora)) {
                          void salvarCabecalhoAutomatico(undefined, undefined, novaHora, false);
                        }
                      }}
                    />
                  </div>

                  <div className="separacao-field">
                    <span>Tipo de Entrega {formOS.regra114Ativa ? '(Regra 114)' : ''}</span>
                    <SearchableSelect
                      options={TIPOS_ENTREGA_OPTIONS}
                      value={String(formOS.tipoEntrega ?? 1)}
                      disabled={osReadOnly || Boolean(formOS.regra114Ativa)}
                      onChange={(val) => {
                        const novoTipo = parseInt(val, 10) || 1;
                        setFormOS((p) => ({ ...p, tipoEntrega: novoTipo }));
                        if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                          void salvarCabecalhoAutomatico({ tipoEntrega: novoTipo }, undefined, undefined, false);
                        }
                      }}
                      placeholder="Selecione o tipo..."
                    />
                  </div>

                  <div className="separacao-field separacao-span-2">
                    <span>Cliente {clienteBloqueado && !osReadOnly ? '(bloqueado com itens)' : ''}</span>
                    <SearchableSelect
                      options={clientesComboRender}
                      value={String(formOS.codigoCliente || '')}
                      disabled={clienteBloqueado}
                      onChange={(val) => {
                        const novoCliente = parseInt(val, 10) || 0;
                        setFormOS((p) => ({ ...p, codigoCliente: novoCliente }));
                        if (novoCliente > 0) {
                          void salvarCabecalhoAutomatico({ codigoCliente: novoCliente }, undefined, undefined, false);
                        }
                      }}
                      placeholder="Selecione o Cliente..."
                    />
                  </div>

                  <div className="separacao-field separacao-span-2">
                    <span>Nat. Operação (CFOP)</span>
                    <SearchableSelect
                      options={cfopsComboRender}
                      value={formOS.codigoCFO || ''}
                      disabled={osReadOnly}
                      onChange={(val) => {
                        const opt = cfopsComboRender.find((c) => c.value === val);
                        setFormOS((p) => ({
                          ...p,
                          codigoCFO: val,
                          descricaoCFO: opt?.label || p.descricaoCFO,
                        }));
                        if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                          void salvarCabecalhoAutomatico({ codigoCFO: val }, undefined, undefined, false);
                        }
                      }}
                      placeholder="Preenchido pelo pedido ou selecione o CFOP..."
                    />
                  </div>

                  <div className="separacao-field separacao-span-2">
                    <span>Transportadora</span>
                    <div className="separacao-field-row">
                      <div className="separacao-grow">
                        <SearchableSelect
                          options={transportadorasComboRender}
                          value={String(formOS.codigoTransportadora || '')}
                          disabled={osReadOnly}
                          onChange={(val) => {
                            const novaTransp = parseInt(val, 10) || 0;
                            setFormOS((p) => ({ ...p, codigoTransportadora: novaTransp }));
                            if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                              void salvarCabecalhoAutomatico(
                                { codigoTransportadora: novaTransp },
                                undefined,
                                undefined,
                                false,
                              );
                            }
                          }}
                          placeholder="Selecione a Transportadora..."
                        />
                      </div>
                      {!modoNovo && formOS.numSeparacao ? (
                        <button
                          type="button"
                          className="separacao-inline-icon-btn"
                          title="Consultar/Unificar Transportadoras dos Pedidos"
                          onClick={() => void abrirModalAlterarTransportadora()}
                        >
                          <IoSwapHorizontalOutline size={17} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="separacao-field separacao-span-2">
                    <span>Redespacho</span>
                    <SearchableSelect
                      options={transportadorasComboRender}
                      value={String(formOS.respRedespacho || '')}
                      disabled={osReadOnly || (!formOS.utilizaRedespacho && formOS.tipoEntrega !== 3)}
                      onChange={(val) => {
                        const novoRedesp = parseInt(val, 10) || 0;
                        setFormOS((p) => ({ ...p, respRedespacho: novoRedesp }));
                        if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                          void salvarCabecalhoAutomatico({ respRedespacho: novoRedesp }, undefined, undefined, false);
                        }
                      }}
                      placeholder={
                        formOS.utilizaRedespacho || formOS.tipoEntrega === 3
                          ? 'Selecione o Redespacho...'
                          : 'Cliente não utiliza redespacho'
                      }
                    />
                  </div>

                  <div className="separacao-field">
                    <span>Veículo (Placa)</span>
                    <SearchableSelect
                      options={veiculosCombo}
                      value={formOS.chapaVeiculo || ''}
                      disabled={osReadOnly}
                      onChange={(val) => void handleSelectVeiculo(val)}
                      placeholder="Selecione o Veículo..."
                    />
                  </div>

                  <label className="separacao-field">
                    <span>Capacidade (Kg)</span>
                    <input
                      type="text"
                      value={capacidadeKg}
                      readOnly
                      disabled
                      placeholder="0,00 Kg"
                    />
                  </label>

                  <label className="separacao-field separacao-span-2">
                    <span>Local de Entrega</span>
                    <input
                      type="text"
                      maxLength={40}
                      value={formOS.localEntrega || ''}
                      onChange={(e) => setFormOS((p) => ({ ...p, localEntrega: e.target.value }))}
                      onBlur={() => {
                        if (!osReadOnly && formOS.codigoCliente && formOS.codigoCliente > 0) {
                          void salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
                        }
                      }}
                      disabled={osReadOnly || ((formOS.itens?.length || 0) > 0 && Boolean(formOS.localEntrega))}
                      placeholder="Endereço / Local de descarga"
                    />
                  </label>

                  <div className="separacao-field separacao-span-4">
                    <span>Configurações da Separação</span>
                    <div className="separacao-checkbox-box separacao-checkbox-group">
                      <label className="separacao-checkbox-label">
                        <input
                          type="checkbox"
                          checked={(formOS.emiteNF ?? 1) !== 0}
                          disabled={
                            osReadOnly ||
                            formOS.osSituacaoFatur === 1 ||
                            formOS.osSituacaoFatur === 2 ||
                            (!modoNovo && formOS.podeAlterarEmiteNf === false)
                          }
                          onChange={(e) => {
                            const novoEmite = e.target.checked ? 1 : 0;
                            setFormOS((p) => ({ ...p, emiteNF: novoEmite }));
                            if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                              void salvarCabecalhoAutomatico({ emiteNF: novoEmite }, undefined, undefined, false);
                            }
                          }}
                        />
                        <span>
                          Separar para faturar (Emite NF)
                          {!modoNovo && formOS.podeAlterarEmiteNf === false && ' • Sem aprovação 22'}
                        </span>
                      </label>

                      <label className="separacao-checkbox-label">
                        <input
                          type="checkbox"
                          checked={geraSolicEmbalagem}
                          disabled={osReadOnly}
                          onChange={(e) => setGeraSolicEmbalagem(e.target.checked)}
                        />
                        <span>Gerar solicitação de NF para embalagens</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: ITENS DA SEPARAÇÃO */}
              {activeTab === 'itens' && (
                <div>
                  {temItensBloqueados && !osReadOnly && (
                    <div
                      className="separacao-alert-box separacao-alert-box--warning"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <span>
                        Existem itens marcados como <strong>Bloqueados para Expedição</strong> (Aprovação de Liberação necessária antes de confirmar).
                      </span>
                      <button
                        type="button"
                        className="primary-button separacao-action-btn-compact"
                        onClick={() => void handleLiberarItens()}
                        disabled={salvando}
                      >
                        <IoLockOpenOutline size={15} />
                        Liberar Itens Bloqueados
                      </button>
                    </div>
                  )}

                  {!osReadOnly && (
                    <div className="separacao-panel-box">
                      <div className="separacao-panel-box__header">
                        <div className="separacao-subtabs">
                          <button
                            type="button"
                            className={abaInclusao === 'material' ? 'primary-button' : 'secondary-button'}
                            onClick={() => setAbaInclusao('material')}
                          >
                            Material
                          </button>
                          <button
                            type="button"
                            className={abaInclusao === 'pallet' ? 'primary-button' : 'secondary-button'}
                            onClick={() => setAbaInclusao('pallet')}
                          >
                            Pallet
                          </button>
                          <button
                            type="button"
                            className={abaInclusao === 'caixa' ? 'primary-button' : 'secondary-button'}
                            onClick={() => setAbaInclusao('caixa')}
                          >
                            Caixa
                          </button>
                        </div>

                        <div className="separacao-panel-box__actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void abrirModalPedidos()}
                          >
                            <IoCartOutline size={16} />
                            Pedidos pendentes
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={abrirModalQrCode}
                            title="Leitor de QR Code (Regra 112)"
                          >
                            <IoQrCodeOutline size={16} />
                            QR Code
                          </button>

                          {formOS.situacaoSeparacao === -1 && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                setConfirmDialog({
                                  titulo: 'Resetar Leitura de QR Code',
                                  subtitulo: `Ordem #${String(formOS.numSeparacao || 0).padStart(6, '0')}`,
                                  mensagem: 'Deseja limpar a conferência de QR Code e retornar a separação para Pendente de Leitura?',
                                  confirmLabel: 'Resetar QR Code',
                                  danger: true,
                                  onConfirm: async () => {
                                    setConfirmDialog(null);
                                    await executarResetQrCode();
                                  },
                                })
                              }
                            >
                              Resetar QR
                            </button>
                          )}

                          {formOS.situacaoSeparacao === -1 ? (
                            <span className="separacao-status-pill separacao-status-pill--success">
                              QR Code Conferido
                            </span>
                          ) : formOS.regra112Ativa ? (
                            <span className="separacao-status-pill separacao-status-pill--danger">
                              QR Code Pendente
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* SUB-ABA MATERIAL */}
                      {abaInclusao === 'material' && (
                        <div className="separacao-add-material-grid">
                          <div className="separacao-field">
                            <span>Material</span>
                            <SearchableSelect
                              options={materiaisCombo}
                              value={manualMaterial}
                              displayValue={manualMaterialDesc || manualMaterial}
                              onChange={(val) => void handleMaterialManualChange(val)}
                              onSearchInputChange={handleBuscarMateriais}
                              placeholder="Selecione o produto..."
                              searchPlaceholder="Digite código ou descrição..."
                              emptyText={
                                carregandoMateriais
                                  ? 'Pesquisando produtos...'
                                  : 'Digite para pesquisar material...'
                              }
                            />
                          </div>

                          <label className="separacao-field">
                            <span>Quantidade</span>
                            <input
                              type="text"
                              value={manualQtd}
                              onChange={(e) => handleManualQtdChange(e.target.value)}
                              placeholder="0,000"
                            />
                          </label>

                          <label className="separacao-field">
                            <span>Unid.</span>
                            <input
                              type="text"
                              maxLength={3}
                              value={manualUnid}
                              readOnly
                              style={{ textAlign: 'center' }}
                            />
                          </label>

                          <label className="separacao-field">
                            <span>Peso total (kg)</span>
                            <input
                              type="text"
                              value={manualPesoTotal}
                              onChange={(e) => setManualPesoTotal(e.target.value)}
                              disabled={!formOS.permiteAlterarPeso && !modoNovo}
                              placeholder="0,000"
                            />
                          </label>

                          <div className="separacao-field">
                            <span>Lote (Opcional - F3)</span>
                            <div className="separacao-field-row">
                              <div className="separacao-grow">
                                <SearchableSelect
                                  options={lotesManualCombo}
                                  value={manualLote}
                                  onChange={(val) => {
                                    setManualLote(val);
                                    const loteObj = lotesDisponiveisManual.find((l) => l.codigoLote === val);
                                    setManualLocal(loteObj?.codigoLocal);
                                  }}
                                  placeholder={carregandoLotesManual ? 'Carregando...' : 'Automático ou selecione...'}
                                />
                              </div>
                              <button
                                type="button"
                                className="separacao-inline-icon-btn"
                                onClick={() => void abrirBuscaLotesManual()}
                                title="Consultar Lotes Disponíveis (F3)"
                              >
                                <IoSearchOutline size={16} />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="primary-button separacao-action-btn-compact"
                            onClick={() => void executarAdicionarItemManual()}
                            disabled={salvando || !manualMaterial || !manualQtd}
                          >
                            <IoAddOutline size={17} />
                            Incluir
                          </button>
                        </div>
                      )}

                      {/* SUB-ABA PALLET */}
                      {abaInclusao === 'pallet' && (
                        <div className="separacao-add-emb-grid">
                          <label className="separacao-field">
                            <span>Número do Pallet (Serial)</span>
                            <input
                              type="text"
                              value={serialPalete}
                              onChange={(e) => setSerialPalete(e.target.value)}
                              onBlur={() => void handleValidarEmbalagem(1)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleValidarEmbalagem(1);
                                }
                              }}
                              placeholder="Informe ou bipe o número do Pallet..."
                            />
                          </label>

                          <label className="separacao-field">
                            <span>Peso total (kg)</span>
                            <input type="text" value={pesoTotalPalete} readOnly disabled placeholder="0,000 kg" />
                          </label>

                          <button
                            type="button"
                            className="primary-button separacao-action-btn-compact"
                            onClick={() => void handleIncluirEmbalagem(1)}
                            disabled={salvando || !serialPalete.trim()}
                          >
                            <IoCubeOutline size={16} />
                            Incluir
                          </button>
                        </div>
                      )}

                      {/* SUB-ABA CAIXA */}
                      {abaInclusao === 'caixa' && (
                        <div className="separacao-add-emb-grid">
                          <label className="separacao-field">
                            <span>Número da Caixa (Serial)</span>
                            <input
                              type="text"
                              value={serialCaixa}
                              onChange={(e) => setSerialCaixa(e.target.value)}
                              onBlur={() => void handleValidarEmbalagem(2)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleValidarEmbalagem(2);
                                }
                              }}
                              placeholder="Informe ou bipe o número da Caixa..."
                            />
                          </label>

                          <label className="separacao-field">
                            <span>Peso total (kg)</span>
                            <input type="text" value={pesoTotalCaixa} readOnly disabled placeholder="0,000 kg" />
                          </label>

                          <button
                            type="button"
                            className="primary-button separacao-action-btn-compact"
                            onClick={() => void handleIncluirEmbalagem(2)}
                            disabled={salvando || !serialCaixa.trim()}
                          >
                            <IoCubeOutline size={16} />
                            Incluir
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TABELA DE ITENS */}
                  <div className="table-scroll clientes-table-wrap">
                    <table className="clientes-table">
                      <thead>
                        <tr>
                          <th style={{ width: '48px' }}>ITEM</th>
                          <th style={{ width: '110px' }}>CÓDIGO</th>
                          <th>DESCRIÇÃO</th>
                          <th style={{ width: '145px' }}>LOTE</th>
                          <th style={{ width: '90px' }}>LOCAL</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>QUANT.</th>
                          <th style={{ width: '52px', textAlign: 'center' }}>VOL.</th>
                          <th style={{ width: '45px' }}>UN</th>
                          <th style={{ width: '88px', textAlign: 'right' }}>PESO PROD.</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>PESO EMB.</th>
                          <th style={{ width: '42px', textAlign: 'center' }}>KIT</th>
                          <th style={{ width: '90px' }}>PEDIDO</th>
                          <th style={{ width: '115px', textAlign: 'center' }}>EMB / SERIAL</th>
                          <th style={{ width: '95px', textAlign: 'center' }}>AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!formOS.itens || formOS.itens.length === 0) ? (
                          <tr>
                            <td colSpan={14} style={{ textAlign: 'center', padding: '26px' }}>
                              Nenhum item adicionado a esta ordem de separação. Utilize{' '}
                              <strong>Pedidos pendentes</strong> ou as abas <strong>Material / Pallet / Caixa</strong> acima.
                            </td>
                          </tr>
                        ) : (
                          formOS.itens.map((item) => (
                            <tr key={item.numItem}>
                              <td>{item.numItem}</td>
                              <td>
                                <strong>{item.codigoMaterial}</strong>
                                {item.situacaoItem === 0 && (
                                  <div style={{ marginTop: '2px' }}>
                                    <span className="separacao-status-pill separacao-status-pill--danger">
                                      Bloqueado
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td>{item.descricaoMaterial || '-'}</td>
                              <td>
                                <div className="separacao-field-row" style={{ gap: '6px' }}>
                                  {item.numLote ? (
                                    <span className="separacao-lote-pill">{item.numLote}</span>
                                  ) : (
                                    <span className="separacao-lote-empty">Sem Lote</span>
                                  )}
                                  {!osReadOnly && (
                                    <button
                                      type="button"
                                      className="separacao-cell-btn"
                                      title={`Selecionar Lote (${item.codigoMaterial})`}
                                      onClick={() => void abrirBuscaLoteParaItem(item, false)}
                                    >
                                      <IoSearchOutline size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td>{item.enderecoLocal || (item.codigoLocal ? `ID ${item.codigoLocal}` : '-')}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {Number(item.qtdSeparar ?? item.qtdSeparada).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                              </td>
                              <td style={{ textAlign: 'center' }}>{String(item.qtdVolumes || 1).padStart(3, '0')}</td>
                              <td>{item.unidMedida || '-'}</td>
                              <td style={{ textAlign: 'right' }}>
                                {Number(item.pesoMaterial || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}{' '}
                                kg
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {Number(item.pesoEmbReal || item.pesoEmbPadrao || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 3,
                                })}{' '}
                                kg
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={Boolean(item.codigoMatKit)} readOnly disabled />
                              </td>
                              <td>
                                {item.numPedido
                                  ? `${item.numPedido}${item.numPedidoCliente ? ` (${item.numPedidoCliente})` : ''}`
                                  : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    className="separacao-cell-btn"
                                    title="Detalhes de Embalagens (Pallet / Caixa)"
                                    onClick={() => void abrirModalDetalhesItem(item)}
                                  >
                                    <IoLayersOutline size={12} />
                                    {Number(item.qtdDetalheItem || 0)}
                                  </button>
                                  {item.controleSerial && (
                                    <button
                                      type="button"
                                      className="separacao-cell-btn"
                                      title="Gerenciar Seriais do Item"
                                      onClick={() => void abrirModalSeriais(item)}
                                    >
                                      SN ({item.qtdSeriaisSelecionados || 0})
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="table-actions" style={{ justifyContent: 'center' }}>
                                  {!osReadOnly && (
                                    <>
                                      <button
                                        type="button"
                                        title="Editar Lote, Quantidade, Local e Peso"
                                        onClick={() => abrirModalEditarItem(item)}
                                      >
                                        <IoCreateOutline size={15} />
                                      </button>
                                      {item.situacaoItem === 0 && formOS.numSeparacao && (
                                        <button
                                          type="button"
                                          title="Liberar apenas este item"
                                          onClick={() => void handleLiberarItens(formOS.numSeparacao, [item.numItem])}
                                        >
                                          <IoLockOpenOutline size={14} />
                                        </button>
                                      )}
                                      <button className="icon-button--danger"
                                        type="button"
                                        title="Remover Item"
                                        onClick={() => setItemParaExcluir(item)}
                                      >
                                        <IoTrashOutline size={15} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* TOTAIS */}
                  <div className="separacao-totais-grid">
                    <div className="separacao-total-item">
                      <span>Quantidade de itens</span>
                      <strong>{String(formOS.itens?.length || 0).padStart(3, '0')}</strong>
                    </div>
                    <div className="separacao-total-item">
                      <span>Peso total</span>
                      <strong>{(formOS.pesoTotalMaterialEmb || 0).toFixed(1)} kg</strong>
                    </div>
                    <div className="separacao-total-item">
                      <span>Produto</span>
                      <strong>{(formOS.pesoTotalMaterial || 0).toFixed(1)} kg</strong>
                    </div>
                    <div className="separacao-total-item">
                      <span>Embalagem</span>
                      <strong>{(formOS.pesoTotalEmbalagem || 0).toFixed(1)} kg</strong>
                    </div>
                    <div className="separacao-total-item">
                      <span>Valor Separação</span>
                      <strong>
                        {valorTotalCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: OBSERVAÇÕES */}
              {activeTab === 'obs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label className="separacao-field-label">
                    <span>Observação da Ordem de Separação</span>
                    <textarea
                      rows={4}
                      className="separacao-textarea"
                      disabled={osReadOnly}
                      value={formOS.observacao || ''}
                      onChange={(e) => setFormOS((p) => ({ ...p, observacao: e.target.value }))}
                      onBlur={() => {
                        if (!osReadOnly && formOS.codigoCliente && formOS.codigoCliente > 0) {
                          void salvarCabecalhoAutomatico(undefined, undefined, undefined, false);
                        }
                      }}
                      placeholder="Observações que constarão na ordem de separação..."
                    />
                  </label>

                  <label className="separacao-field-label">
                    <span>Observações de Separação do Cliente (Cadastro de Clientes)</span>
                    <textarea
                      rows={4}
                      className="separacao-textarea"
                      value={obsClienteTexto}
                      onChange={(e) => setObsClienteTexto(e.target.value)}
                      onBlur={() => {
                        if (formOS.codigoCliente && formOS.codigoCliente > 0) {
                          const baseUrl = GlobalConfig.getBaseUrl();
                          const token = GlobalConfig.getJwToken();
                          if (baseUrl && token) {
                            void atualizarObservacaoClienteSeparacaoCall(
                              baseUrl,
                              token,
                              formOS.codigoCliente,
                              obsClienteTexto,
                            );
                          }
                        }
                      }}
                      placeholder="Instruções permanentes de separação deste cliente..."
                    />
                  </label>
                </div>
              )}
            </div>

            {/* RODAPÉ */}
            <div className="clientes-modal-actions separacao-footer-actions">
              <div className="separacao-footer-left">
                <div className="separacao-radio-group">
                  <label className="separacao-radio-label">
                    <input
                      type="radio"
                      name="tipoFiltroLote"
                      checked={tipoFiltroLote === 1}
                      onChange={() => setTipoFiltroLote(1)}
                    />
                    <span>Lotes separados</span>
                  </label>

                  <label className="separacao-radio-label">
                    <input
                      type="radio"
                      name="tipoFiltroLote"
                      checked={tipoFiltroLote === 2}
                      onChange={() => setTipoFiltroLote(2)}
                    />
                    <span>Lotes disponíveis</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setModalImprimirAberta(true);
                    void carregarRelatorio(tipoFiltroLote);
                  }}
                  disabled={!formOS.numSeparacao || modoNovo}
                >
                  <IoPrintOutline size={16} />
                  Imprimir
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setObsClienteTexto(formOS.observacaoSeparacaoCliente || '');
                    setModalObsSeparacaoAberta(true);
                  }}
                >
                  <IoDocumentTextOutline size={16} />
                  Observações Separação
                </button>
              </div>

              <div className="separacao-footer-right">
                {!modoNovo &&
                  formOS.numSeparacao &&
                  (formOS.situacaoSeparacao === 2 || formOS.situacaoSeparacao === 7) && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setAcaoStatusOS({
                          numSeparacao: formOS.numSeparacao!,
                          situacaoAtual: formOS.situacaoSeparacao!,
                          situacaoDestino: 0,
                        })
                      }
                      disabled={salvando}
                    >
                      <IoReturnDownBackOutline size={16} />
                      Estornar
                    </button>
                  )}

                <button
                  type="button"
                  className="secondary-button modal-card__close"
                  onClick={() => setModalAberta(false)}
                  disabled={salvando}
                >
                  Fechar
                </button>

                {!osReadOnly && (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void salvarCabecalhoAutomatico(undefined, undefined, undefined, true)}
                      disabled={salvando}
                    >
                      <IoCheckmarkOutline size={16} />
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setModalConfirmarOSAberta(true)}
                      disabled={salvando || !formOS.codigoCliente || (formOS.itens?.length || 0) === 0}
                    >
                      <IoCheckmarkDoneOutline size={17} />
                      Confirmar
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: PEDIDOS PENDENTES                                              */}
      {/* ========================================================================= */}
      {modalPedidosAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalPedidosAberta(false)}
          style={{ zIndex: 10010 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1150px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  Pedidos de Venda Pendentes:{' '}
                  <span>{formOS.nomeCliente || `Cliente ${formOS.codigoCliente}`}</span>
                </h2>
                <p>Selecione os pedidos para gerar a separação de lotes automaticamente</p>
              </div>
              <ModalHeaderActions onClose={() => setModalPedidosAberta(false)} />
            </header>

            <div className="modal-body">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ flex: '1 1 300px', maxWidth: '400px' }}>
                  <div className="clientes-cep-input">
                    <input
                      type="text"
                      value={searchPedido}
                      onChange={(e) => setSearchPedido(e.target.value)}
                      placeholder="Filtrar por código, descrição ou pedido..."
                    />
                    <button type="button" className="icon-button clientes-cep-search">
                      <IoSearchOutline size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={toggleSelecionarTodosPedidos}
                  >
                    {pedidosPendentesFiltrados.length > 0 &&
                    pedidosPendentesFiltrados.every((p) => pedidosSelecionados.includes(getPedidoKey(p)))
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos'}
                  </button>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-muted)' }}>
                    <strong>{pedidosSelecionados.length}</strong> selecionado(s)
                  </span>
                </div>
              </div>

              <div className="table-scroll clientes-table-wrap">
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            pedidosPendentesFiltrados.length > 0 &&
                            pedidosPendentesFiltrados.every((p) => pedidosSelecionados.includes(getPedidoKey(p)))
                          }
                          onChange={toggleSelecionarTodosPedidos}
                        />
                      </th>
                      <th style={{ width: '65px' }}>SEM</th>
                      <th style={{ width: '100px' }}>ENTREGA</th>
                      <th style={{ width: '110px' }}>PED. CLI</th>
                      <th style={{ width: '85px' }}>PEDIDO</th>
                      <th style={{ width: '120px' }}>MATERIAL</th>
                      <th>DESCRIÇÃO</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>SALDO</th>
                      <th style={{ width: '50px' }}>UN</th>
                      <th style={{ width: '75px' }}>CFOP</th>
                      <th style={{ width: '85px' }}>TIPO</th>
                      <th style={{ width: '95px' }}>LOCAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPedidos ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '30px' }}>
                          Carregando pedidos pendentes...
                        </td>
                      </tr>
                    ) : pedidosPendentesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '30px' }}>
                          Nenhum pedido pendente encontrado para este cliente até a data da separação.
                        </td>
                      </tr>
                    ) : (
                      pedidosPendentesFiltrados.map((item) => {
                        const pedKey = getPedidoKey(item);
                        const isSelected = pedidosSelecionados.includes(pedKey);
                        return (
                          <tr
                            key={pedKey}
                            onClick={() => toggleSelecaoPedido(pedKey)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'var(--color-primary-soft)' : undefined,
                            }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelecaoPedido(pedKey)}
                              />
                            </td>
                            <td>{item.semana || '-'}</td>
                            <td>{parseIsoToBrDate(item.dataEntrega) || '-'}</td>
                            <td>{item.numPedidoCliente || '-'}</td>
                            <td>
                              <strong>{item.numPedido}</strong>
                            </td>
                            <td>
                              <strong>{item.codigoMaterial}</strong>
                              {item.similarSugerido && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                                  Similar: {item.similarSugerido}
                                </div>
                              )}
                            </td>
                            <td>{item.descricaoMaterial || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {Number(item.saldo).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                            <td>{item.unidMedVenda || '-'}</td>
                            <td>{item.codigoCFO || '-'}</td>
                            <td>{item.destino || (item.tipoPedido === 3 ? 'Pedido' : 'Programa')}</td>
                            <td>{item.localEntrega || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalPedidosAberta(false)}
                disabled={salvando}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void executarAdicionarPedidos(false)}
                disabled={salvando || pedidosSelecionados.length === 0}
              >
                {salvando ? 'Adicionando...' : `Adicionar (${pedidosSelecionados.length})`}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: EDITAR ITEM DA SEPARAÇÃO                                       */}
      {/* ========================================================================= */}
      {itemEditando && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setItemEditando(null)}
          style={{ zIndex: 10025 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  Editar Item #{itemEditando.numItem}: <span>{itemEditando.codigoMaterial}</span>
                </h2>
                <p>{itemEditando.descricaoMaterial || 'Ajustar lote, local, quantidade e embalagem'}</p>
              </div>
              <ModalHeaderActions onClose={() => setItemEditando(null)} />
            </header>

            <div className="modal-body">
              <div className="separacao-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="separacao-field">
                  <span>Lote</span>
                  <div className="separacao-field-row">
                    <input
                      type="text"
                      value={editLote}
                      onChange={(e) => setEditLote(e.target.value)}
                      placeholder="Sem Lote"
                    />
                    <button
                      type="button"
                      className="separacao-inline-icon-btn"
                      title="Consultar Lotes Disponíveis"
                      onClick={() => void abrirBuscaLoteParaItem(itemEditando, true)}
                    >
                      <IoSearchOutline size={16} />
                    </button>
                  </div>
                </div>

                <div className="separacao-field">
                  <span>Local de Estocagem</span>
                  <SearchableSelect
                    options={locaisCombo}
                    value={editLocal}
                    onChange={setEditLocal}
                    placeholder="Selecione o local..."
                  />
                </div>

                <label className="separacao-field">
                  <span>Quantidade ({itemEditando.unidMedida || 'PC'})</span>
                  <input
                    type="text"
                    value={editQtd}
                    onChange={(e) => setEditQtd(e.target.value)}
                  />
                </label>

                <label className="separacao-field">
                  <span>Peso Material (kg) {!formOS.permiteAlterarPeso ? '(Bloqueado Regra 42)' : ''}</span>
                  <input
                    type="text"
                    value={editPesoMaterial}
                    disabled={!formOS.permiteAlterarPeso}
                    onChange={(e) => setEditPesoMaterial(e.target.value)}
                  />
                </label>

                <label className="separacao-field">
                  <span>Qtd. Por Embalagem</span>
                  <input
                    type="text"
                    value={editQtdPorEmb}
                    onChange={(e) => setEditQtdPorEmb(e.target.value)}
                  />
                </label>

                <label className="separacao-field">
                  <span>Volumes</span>
                  <input
                    type="text"
                    value={editQtdVolumes}
                    onChange={(e) => setEditQtdVolumes(e.target.value)}
                  />
                </label>

                <label className="separacao-field separacao-span-2">
                  <span>Peso Embalagem Real (kg)</span>
                  <input
                    type="text"
                    value={editPesoEmbReal}
                    onChange={(e) => setEditPesoEmbReal(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setItemEditando(null)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void salvarEdicaoItem()}
                disabled={salvando}
              >
                <IoCheckmarkOutline size={16} />
                {salvando ? 'Salvando...' : 'Salvar Item'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: DETALHES DE EMBALAGENS DO ITEM                                 */}
      {/* ========================================================================= */}
      {modalDetalhesItem && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalDetalhesItem(null)}
          style={{ zIndex: 10028 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  Embalagens do Item #{modalDetalhesItem.numItem}:{' '}
                  <span>{modalDetalhesItem.codigoMaterial}</span>
                </h2>
                <p>Pallets e Caixas vinculados a este item</p>
              </div>
              <ModalHeaderActions onClose={() => setModalDetalhesItem(null)} />
            </header>

            <div className="modal-body">
              <div className="table-scroll clientes-table-wrap">
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>DET.</th>
                      <th>SERIAL / EMBALAGEM</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>QTD EMB.</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>PESO EMB. (kg)</th>
                      {!osReadOnly && <th style={{ width: '70px', textAlign: 'center' }}>AÇÃO</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {carregandoDetalhesItem ? (
                      <tr>
                        <td colSpan={osReadOnly ? 4 : 5} style={{ textAlign: 'center', padding: '20px' }}>
                          Carregando embalagens...
                        </td>
                      </tr>
                    ) : detalhesItemLista.length === 0 ? (
                      <tr>
                        <td colSpan={osReadOnly ? 4 : 5} style={{ textAlign: 'center', padding: '20px' }}>
                          Nenhuma embalagem (Pallet/Caixa) vinculada a este item.
                        </td>
                      </tr>
                    ) : (
                      detalhesItemLista.map((det) => (
                        <tr key={det.numDetalhe}>
                          <td>#{det.numDetalhe}</td>
                          <td>
                            <strong>{det.serialEmbalagem || det.numEmbalagem || '-'}</strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>{Number(det.qtdEmb).toLocaleString('pt-BR')}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(det.pesoEmb).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
                          </td>
                          {!osReadOnly && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="icon-button--danger separacao-cell-btn"
                                title="Desvincular Embalagem"
                                onClick={() => void excluirDetalheEmbalagem(det)}
                              >
                                <IoTrashOutline size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalDetalhesItem(null)}
              >
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: SERIAIS DISPONÍVEIS DO ITEM                                    */}
      {/* ========================================================================= */}
      {modalSeriaisItem && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalSeriaisItem(null)}
          style={{ zIndex: 10029 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  Números de Série • Item #{modalSeriaisItem.numItem}
                </h2>
                <p>
                  {modalSeriaisItem.codigoMaterial} • Selecione{' '}
                  {Number(modalSeriaisItem.qtdSeparar ?? modalSeriaisItem.qtdSeparada ?? 0)} serial(is)
                </p>
              </div>
              <ModalHeaderActions onClose={() => setModalSeriaisItem(null)} />
            </header>

            <div className="modal-body">
              <div className="table-scroll clientes-table-wrap">
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px', textAlign: 'center' }}>SEL.</th>
                      <th>NÚMERO DE SÉRIE</th>
                      <th>LOTE</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>LOCAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregandoSeriais ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                          Consultando seriais disponíveis...
                        </td>
                      </tr>
                    ) : seriaisLista.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                          Nenhum serial disponível em estoque para este item/lote.
                        </td>
                      </tr>
                    ) : (
                      seriaisLista.map((s) => {
                        const checked = seriaisSelecionados.includes(s.numSerial);
                        return (
                          <tr
                            key={s.numSerial}
                            onClick={() => {
                              if (osReadOnly) return;
                              setSeriaisSelecionados((prev) =>
                                checked ? prev.filter((x) => x !== s.numSerial) : [...prev, s.numSerial],
                              );
                            }}
                            style={{ cursor: osReadOnly ? 'default' : 'pointer' }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={osReadOnly}
                                onChange={() =>
                                  setSeriaisSelecionados((prev) =>
                                    checked ? prev.filter((x) => x !== s.numSerial) : [...prev, s.numSerial],
                                  )
                                }
                              />
                            </td>
                            <td>
                              <strong>{s.numSerial}</strong>
                            </td>
                            <td>{s.codigoLote || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{s.codigoLocal}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="clientes-modal-actions">
              <span style={{ marginRight: 'auto', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Selecionados: <strong>{seriaisSelecionados.length}</strong> /{' '}
                {Number(modalSeriaisItem.qtdSeparar ?? modalSeriaisItem.qtdSeparada ?? 0)}
              </span>
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalSeriaisItem(null)}
              >
                Fechar
              </button>
              {!osReadOnly && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void salvarSeriaisItem()}
                  disabled={carregandoSeriais}
                >
                  Confirmar Seriais
                </button>
              )}
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: LEITOR QR CODE                                                 */}
      {/* ========================================================================= */}
      {modalQrCodeAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalQrCodeAberta(false)}
          style={{ zIndex: 10030 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '880px' }}
          >
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoQrCodeOutline size={24} />
                <div>
                  <h2>Ordem de Separação - Leitor QR Code</h2>
                  <p>Bipe ou digite o QR Code das etiquetas (Prod:...|Lote:...|Qtd:...|NumEtq:...)</p>
                </div>
              </div>
              <ModalHeaderActions onClose={() => setModalQrCodeAberta(false)} />
            </header>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleLerEtiquetaQrCode();
                    }
                  }}
                  placeholder="Ex: Prod:2001000394|Lote:26202290|Qtd:3|NumEtq:1"
                />
                <button
                  type="button"
                  className="primary-button separacao-action-btn-compact"
                  onClick={() => void handleLerEtiquetaQrCode()}
                  disabled={salvando || !qrCodeInput.trim()}
                >
                  Validar Leitura
                </button>
              </div>

              <div className="table-scroll clientes-table-wrap" style={{ maxHeight: '300px' }}>
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th>MATERIAL</th>
                      <th>DESCRIÇÃO</th>
                      <th>LOTE</th>
                      <th style={{ textAlign: 'right' }}>QTD SEPARADA</th>
                      <th style={{ textAlign: 'right' }}>QTD LIDA (QR)</th>
                      <th style={{ textAlign: 'center' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formOS.itens || []).map((it) => {
                      const key = `${it.codigoMaterial.trim().toUpperCase()}|${(it.numLote || '').trim().toUpperCase()}`;
                      const lida =
                        formOS.situacaoSeparacao === -1
                          ? Number(it.qtdSeparar ?? it.qtdSeparada)
                          : qtdLidaPorItemKey[key] || 0;
                      const alvo = Number(it.qtdSeparar ?? it.qtdSeparada);
                      const completo = lida >= alvo && alvo > 0;
                      return (
                        <tr key={it.numItem}>
                          <td>
                            <strong>{it.codigoMaterial}</strong>
                          </td>
                          <td>{it.descricaoMaterial || '-'}</td>
                          <td>{it.numLote || '-'}</td>
                          <td style={{ textAlign: 'right' }}>{alvo.toLocaleString('pt-BR')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{lida.toLocaleString('pt-BR')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`separacao-status-pill ${
                                completo ? 'separacao-status-pill--success' : 'separacao-status-pill--pending'
                              }`}
                            >
                              {completo ? 'Conferido' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="clientes-modal-actions">
              {formOS.situacaoSeparacao === -1 && (
                <button
                  type="button"
                  className="secondary-button secondary-button--danger" style={{ marginRight: 'auto' }}
                  onClick={() => void executarResetQrCode()}
                  disabled={salvando}
                >
                  Resetar Leituras
                </button>
              )}
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalQrCodeAberta(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleConfirmarQrCode()}
                disabled={salvando}
              >
                Confirmar Leitura
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: OBSERVAÇÕES SEPARAÇÃO                                          */}
      {/* ========================================================================= */}
      {modalObsSeparacaoAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalObsSeparacaoAberta(false)}
          style={{ zIndex: 10040 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>Observações da Separação</h2>
                <p>{formOS.nomeCliente || 'Observações do pedido e instruções permanentes do cliente'}</p>
              </div>
              <ModalHeaderActions onClose={() => setModalObsSeparacaoAberta(false)} />
            </header>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="separacao-field-label">
                <span>Observações de Separação do Cliente (Cadastro de Clientes)</span>
                <textarea
                  rows={4}
                  className="separacao-textarea"
                  value={obsClienteTexto}
                  onChange={(e) => setObsClienteTexto(e.target.value)}
                  placeholder="Instruções de separação específicas deste cliente..."
                />
              </label>

              <label className="separacao-field-label">
                <span>Observação desta Ordem de Separação</span>
                <textarea
                  rows={4}
                  className="separacao-textarea"
                  disabled={osReadOnly}
                  value={formOS.observacao || ''}
                  onChange={(e) => setFormOS((p) => ({ ...p, observacao: e.target.value }))}
                  placeholder="Observação específica desta ordem de separação..."
                />
              </label>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalObsSeparacaoAberta(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleSalvarObservacoesSeparacao()}
                disabled={salvando}
              >
                <IoCheckmarkOutline size={16} />
                Salvar Observações
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: IMPRIMIR ORDEM DE SEPARAÇÃO                                    */}
      {/* ========================================================================= */}
      {modalImprimirAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalImprimirAberta(false)}
          style={{ zIndex: 10045 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '980px', width: '95vw' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  Prévia de Impressão &bull; Ordem de Separação #{String(formOS.numSeparacao || 0).padStart(6, '0')}
                </h2>
                <div className="separacao-radio-group" style={{ marginTop: '8px' }}>
                  <label className="separacao-radio-label">
                    <input
                      type="radio"
                      name="modalFiltroLotePrint"
                      checked={tipoFiltroLote === 1}
                      onChange={() => {
                        setTipoFiltroLote(1);
                        void carregarRelatorio(1);
                      }}
                    />
                    <span>Lotes separados</span>
                  </label>
                  <label className="separacao-radio-label">
                    <input
                      type="radio"
                      name="modalFiltroLotePrint"
                      checked={tipoFiltroLote === 2}
                      onChange={() => {
                        setTipoFiltroLote(2);
                        void carregarRelatorio(2);
                      }}
                    />
                    <span>Lotes disponíveis</span>
                  </label>
                </div>
              </div>
              <ModalHeaderActions onClose={() => setModalImprimirAberta(false)} />
            </header>

            <div className="modal-body separacao-report-frame">
              {carregandoRelatorio ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                  Carregando dados do relatório...
                </div>
              ) : (
                <div
                  className="separacao-report-sheet"
                  dangerouslySetInnerHTML={{
                    __html: obterHtmlRelatorioParaExibicao(dadosRelatorio, tipoFiltroLote, formOS),
                  }}
                />
              )}
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalImprimirAberta(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => imprimirRelatorioOrdemSeparacao(dadosRelatorio, tipoFiltroLote, formOS)}
                disabled={carregandoRelatorio}
              >
                <IoPrintOutline size={16} />
                Imprimir Relatório
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: ALTERAR / CONFLITO DE TRANSPORTADORA                           */}
      {/* ========================================================================= */}
      {modalTransportadoraAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalTransportadoraAberta(false)}
          style={{ zIndex: 10048 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>Transportadora da Ordem #{String(formOS.numSeparacao || 0).padStart(6, '0')}</h2>
                <p>Selecione a transportadora conforme pedidos vinculados ou altere manualmente</p>
              </div>
              <ModalHeaderActions onClose={() => setModalTransportadoraAberta(false)} />
            </header>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {transpConflitoMensagem && (
                <div className="separacao-alert-box separacao-alert-box--warning">
                  {transpConflitoMensagem}
                </div>
              )}

              {carregandoTranspPedidos ? (
                <p style={{ color: 'var(--color-muted)', margin: 0 }}>Carregando transportadoras dos pedidos...</p>
              ) : transpOpcoesPedidos.length > 0 ? (
                <div className="table-scroll clientes-table-wrap" style={{ maxHeight: '190px' }}>
                  <table className="clientes-table">
                    <thead>
                      <tr>
                        <th>TRANSPORTADORA DO PEDIDO</th>
                        <th>REDESPACHO</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>PEDIDOS</th>
                        <th style={{ width: '95px', textAlign: 'center' }}>USAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transpOpcoesPedidos.map((op) => (
                        <tr key={`${op.codigoTransportadora}-${op.respRedespacho ?? 0}`}>
                          <td>
                            <strong>
                              {op.codigoTransportadora} - {op.nomeTransportadora || 'Transportadora'}
                            </strong>
                          </td>
                          <td>{op.respRedespacho ? `${op.respRedespacho} - ${op.nomeRedespacho || ''}` : '-'}</td>
                          <td style={{ textAlign: 'center' }}>{op.numPedidos.join(', ')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="separacao-cell-btn"
                              onClick={() => {
                                setTranspSelecionadaModal(String(op.codigoTransportadora));
                                setRedespSelecionadoModal(op.respRedespacho ? String(op.respRedespacho) : '');
                              }}
                            >
                              Selecionar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="separacao-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="separacao-field">
                  <span>Transportadora</span>
                  <SearchableSelect
                    options={transportadorasComboRender}
                    value={transpSelecionadaModal}
                    onChange={setTranspSelecionadaModal}
                    placeholder="Selecione..."
                  />
                </div>

                <div className="separacao-field">
                  <span>Redespacho</span>
                  <SearchableSelect
                    options={transportadorasComboRender}
                    value={redespSelecionadoModal}
                    onChange={setRedespSelecionadoModal}
                    placeholder="Opcional..."
                  />
                </div>
              </div>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalTransportadoraAberta(false)}
                disabled={salvando}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleConfirmarAlterarTransportadora()}
                disabled={salvando || !transpSelecionadaModal}
              >
                Aplicar Transportadora
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: CONSULTA DE LOTES DISPONÍVEIS (F3)                             */}
      {/* ========================================================================= */}
      {modalLotesAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => {
            setModalLotesAberta(false);
            setItemParaAlterarLote(null);
            setModoLoteEditModal(false);
          }}
          style={{ zIndex: 10050 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '850px' }}
          >
            <header className="modal-card__header">
              <div>
                <h2>
                  {tipoFiltroLote === 1 ? 'Lotes Separados:' : 'Lotes Disponíveis:'}{' '}
                  <span>
                    {materialLotesConsultando}
                    {descricaoLotesConsultando ? ` - ${descricaoLotesConsultando}` : ''}
                  </span>
                </h2>
                <p>
                  {itemParaAlterarLote
                    ? `Selecione um lote para o item ${itemParaAlterarLote.numItem} da ordem de separação`
                    : 'Selecione um lote em estoque para alocar neste item'}
                </p>
              </div>
              <ModalHeaderActions onClose={() => {
                  setModalLotesAberta(false);
                  setItemParaAlterarLote(null);
                  setModoLoteEditModal(false);
                }} />
            </header>

            <div className="modal-body">
              <div style={{ marginBottom: '14px' }}>
                <div className="clientes-cep-input">
                  <input
                    type="text"
                    value={filtroLote}
                    onChange={(e) => setFiltroLote(e.target.value)}
                    placeholder="Filtrar por número do lote, fornecedor ou local..."
                  />
                  <button type="button" className="icon-button clientes-cep-search">
                    <IoSearchOutline size={16} />
                  </button>
                </div>
              </div>

              <div className="table-scroll clientes-table-wrap" style={{ maxHeight: '320px' }}>
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th>LOTE</th>
                      <th>LOTE FORNECEDOR</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>LOCAL</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>DISPONÍVEL</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>UNID</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>VALIDADE</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLotes ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                          Consultando lotes em estoque...
                        </td>
                      </tr>
                    ) : lotesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                          Nenhum lote encontrado para o material {materialLotesConsultando}.
                        </td>
                      </tr>
                    ) : (
                      lotesFiltrados.map((lote) => (
                        <tr
                          key={`${lote.codigoLote}-${lote.codigoLocal}`}
                          onClick={() => void selecionarLote(lote)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <strong>{lote.codigoLote}</strong>
                          </td>
                          <td>{lote.loteFornecedor || '-'}</td>
                          <td style={{ textAlign: 'center' }}>{lote.codigoLocal}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {Number(lote.qtdDisponivel).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 3,
                            })}
                          </td>
                          <td style={{ textAlign: 'center' }}>{lote.unidMedida || 'PC'}</td>
                          <td style={{ textAlign: 'center' }}>{lote.dataValidade || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="separacao-cell-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                void selecionarLote(lote);
                              }}
                            >
                              Selecionar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="clientes-modal-actions">
              {itemParaAlterarLote && (
                <button
                  type="button"
                  className="secondary-button secondary-button--danger" style={{ marginRight: 'auto' }}
                  onClick={() => void selecionarLote(null)}
                  disabled={salvando}
                >
                  Remover Lote
                </button>
              )}
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => {
                  setModalLotesAberta(false);
                  setItemParaAlterarLote(null);
                  setModoLoteEditModal(false);
                }}
                disabled={salvando}
              >
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: CONFIRMAR ORDEM DE SEPARAÇÃO                                   */}
      {/* ========================================================================= */}
      {modalConfirmarOSAberta && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setModalConfirmarOSAberta(false)}
          style={{ zIndex: 10055 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoCheckmarkDoneOutline size={24} />
                <div>
                  <h2>Confirmar Ordem de Separação</h2>
                  <p>Ordem #{String(formOS.numSeparacao || 0).padStart(6, '0')}</p>
                </div>
              </div>
              <ModalHeaderActions onClose={() => setModalConfirmarOSAberta(false)} expandable={false} />
            </header>

            <div className="modal-body">
              <p style={{ color: 'var(--color-heading)', lineHeight: 1.5, margin: 0 }}>
                Deseja confirmar a Ordem de Separação{' '}
                <strong>#{String(formOS.numSeparacao || 0).padStart(6, '0')}</strong> para o cliente{' '}
                <strong>{formOS.nomeCliente}</strong>?
                <br />
                <br />
                {(formOS.emiteNF ?? 1) !== 0
                  ? 'Os lotes alocados serão reservados no estoque, os pedidos serão baixados em FIFO e a separação será liberada para faturamento.'
                  : 'A separação será confirmada e baixada sem emissão de NF (gerando movimentação de estoque e faturamento direto se aplicável).'}
              </p>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setModalConfirmarOSAberta(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void executarConfirmarOrdemSeparacao()}
                disabled={salvando}
              >
                {salvando ? 'Confirmando...' : 'Confirmar Separação'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO: CANCELAR OU ESTORNAR ORDEM                                       */}
      {/* ========================================================================= */}
      {acaoStatusOS !== null && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setAcaoStatusOS(null)}
          style={{ zIndex: 10060 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '490px' }}
          >
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoWarningOutline size={24} color="var(--color-danger)" />
                <div>
                  <h2>
                    {acaoStatusOS.situacaoDestino === 0
                      ? 'Estornar Ordem de Separação'
                      : 'Cancelar Ordem de Separação'}
                  </h2>
                  <p>Ordem #{String(acaoStatusOS.numSeparacao).padStart(6, '0')}</p>
                </div>
              </div>
              <ModalHeaderActions onClose={() => setAcaoStatusOS(null)} />
            </header>

            <div className="modal-body">
              <p style={{ color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>
                {acaoStatusOS.situacaoDestino === 0 ? (
                  <>
                    Deseja estornar esta ordem de separação para <strong>Em Digitação</strong>?
                    <br />
                    <br />
                    As reservas de estoque, movimentações e baixas de pedidos serão revertidas para permitir novos ajustes.
                  </>
                ) : (
                  <>
                    Deseja realmente <strong>cancelar</strong> esta ordem de separação?
                    <br />
                    <br />
                    Todos os itens alocados serão estornados e o saldo dos pedidos de venda será liberado novamente.
                  </>
                )}
              </p>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setAcaoStatusOS(null)}
              >
                Não
              </button>
              <button
                type="button"
                className={`primary-button ${acaoStatusOS.situacaoDestino === 9 ? 'separacao-danger-button' : ''}`}
                onClick={() =>
                  void executarCancelamentoOuEstorno(
                    acaoStatusOS.numSeparacao,
                    acaoStatusOS.situacaoDestino,
                  )
                }
              >
                {acaoStatusOS.situacaoDestino === 0 ? 'Confirmar Estorno' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO: REMOVER ITEM DA SEPARAÇÃO                                        */}
      {/* ========================================================================= */}
      {itemParaExcluir !== null && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setItemParaExcluir(null)}
          style={{ zIndex: 10070 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoWarningOutline size={24} color="var(--color-danger)" />
                <div>
                  <h2>Remover Item</h2>
                  <p>
                    Item #{itemParaExcluir.numItem} - {itemParaExcluir.codigoMaterial}
                  </p>
                </div>
              </div>
              <ModalHeaderActions onClose={() => setItemParaExcluir(null)} disabled={salvando} expandable={false} />
            </header>

            <div className="modal-body">
              <p style={{ color: 'var(--color-heading)', lineHeight: 1.5, margin: 0 }}>
                Deseja realmente remover o produto <strong>{itemParaExcluir.codigoMaterial}</strong>
                {itemParaExcluir.descricaoMaterial ? ` (${itemParaExcluir.descricaoMaterial})` : ''} desta ordem de separação?
              </p>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setItemParaExcluir(null)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button separacao-danger-button"
                onClick={() => void executarExclusaoItem(false)}
                disabled={salvando}
              >
                {salvando ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO GENÉRICO DE CONFIRMAÇÃO Q4                                        */}
      {/* ========================================================================= */}
      {confirmDialog && (
        <section
          className="modal-backdrop modal-backdrop--nested"
          onClick={() => setConfirmDialog(null)}
          style={{ zIndex: 10090 }}
        >
          <article
            className="modal-card separacao-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '510px' }}
          >
            <header className="modal-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IoWarningOutline size={24} color="var(--color-danger)" />
                <div>
                  <h2>{confirmDialog.titulo}</h2>
                  {confirmDialog.subtitulo && <p>{confirmDialog.subtitulo}</p>}
                </div>
              </div>
              <ModalHeaderActions onClose={() => setConfirmDialog(null)} expandable={false} />
            </header>

            <div className="modal-body">
              <div className={`separacao-alert-box ${confirmDialog.danger ? 'separacao-alert-box--danger' : 'separacao-alert-box--warning'}`}>
                {confirmDialog.mensagem}
              </div>
            </div>

            <div className="clientes-modal-actions">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`primary-button ${confirmDialog.danger ? 'separacao-danger-button' : ''}`}
                onClick={() => void confirmDialog.onConfirm()}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
