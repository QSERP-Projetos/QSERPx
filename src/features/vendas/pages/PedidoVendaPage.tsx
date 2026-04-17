import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoCloseCircleOutline,
  IoCopyOutline,
  IoCreateOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { obterUsuariosTransacoesSistemaAcaoCall } from '../../../services/apiCalls';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { EditarPedidoVendaFormPanel, NovoPedidoVendaFormPanel } from './NovoPedidoVendaPage';
import {
  deletarPedidoVenda,
  duplicarPedidoVenda,
  listPedidosVenda,
  type PedidoVenda,
} from '../../../services/pedidoVendaApi';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { filterListByTerm } from '../../../utils/filterListByTerm';

const situacaoSelectOptions = [
  { value: 'Elaboração', label: 'Elaboração' },
  { value: 'Em aberto', label: 'Em aberto' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Encerrado', label: 'Encerrado' },
  { value: 'Todos', label: 'Todos' },
];

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const parseCurrencyNumber = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/[^\d,.-]/g, '');
  const hasComma = sanitized.includes(',');
  const hasDot = sanitized.includes('.');

  let normalized = sanitized;
  if (hasComma && hasDot) {
    normalized = sanitized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = sanitized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPedidoValorRaw = (pedido: any) => {
  return (
    pedido?.totalPreco ??
    pedido?.totalPrecoItens ??
    pedido?.totalPrecoDouble ??
    pedido?.totalPrecoItensDouble ??
    pedido?.total_Preco ??
    pedido?.total_preco ??
    pedido?.valor_Total ??
    pedido?.valorTotal ??
    0
  );
};

const formatCurrencyBRL = (value: any) => {
  const parsed = parseCurrencyNumber(value);
  return parsed.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const normalizeText = (value: any) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const SITUACAO_MAP_BY_CODE: Record<string, { label: string; badgeClass: string; weight: number }> = {
  '-1': { label: 'Elaboração', badgeClass: 'warning', weight: 1 },
  '1': { label: 'Em aberto', badgeClass: 'info', weight: 2 },
  '0': { label: 'Pendente', badgeClass: 'warning', weight: 3 },
  '2': { label: 'Encerrado', badgeClass: 'success', weight: 4 },
  '999': { label: 'Todos', badgeClass: 'muted', weight: 99 },
};

const SITUACAO_WEIGHT_BY_BADGE: Record<string, number> = {
  warning: 1,
  info: 2,
  success: 3,
  danger: 4,
  muted: 5,
};

const inferSituacaoByText = (text: string) => {
  const normalized = normalizeText(text);

  if (!normalized) return null;
  if (normalized.includes('elaborac')) {
    return SITUACAO_MAP_BY_CODE['-1'];
  }
  if (normalized.includes('aberto')) return SITUACAO_MAP_BY_CODE['1'];
  if (normalized.includes('pendente')) return SITUACAO_MAP_BY_CODE['0'];
  if (normalized.includes('encerrad')) return SITUACAO_MAP_BY_CODE['2'];
  if (normalized.includes('todos')) return SITUACAO_MAP_BY_CODE['999'];

  // Compatibilidade com descricoes legadas.
  if (normalized.includes('liberad') || normalized.includes('aprovad')) return SITUACAO_MAP_BY_CODE['1'];
  if (normalized.includes('faturad')) return SITUACAO_MAP_BY_CODE['2'];
  if (normalized.includes('cancelad') || normalized.includes('reprovad')) return SITUACAO_MAP_BY_CODE['2'];
  if (normalized.includes('bloquead') || normalized.includes('suspens')) return SITUACAO_MAP_BY_CODE['0'];

  return null;
};

const isSituacaoElaboracao = (situacao: string) => normalizeText(situacao).includes('elaborac');

const getSituacaoInfo = (pedido: any) => {
  const situacaoTextoRaw = String(
    pedido?.situacaoPedido ??
      pedido?.descricao_Situacao ??
      pedido?.descricaoSituacao ??
      pedido?.situacao_Descricao ??
      pedido?.situacaoDescricao ??
      pedido?.desc_Situacao_Pedido ??
      pedido?.descSituacaoPedido ??
      '',
  ).trim();

  if (situacaoTextoRaw) {
    const inferred = inferSituacaoByText(situacaoTextoRaw);
    if (inferred) {
      return {
        label: situacaoTextoRaw,
        badgeClass: inferred.badgeClass,
        weight: SITUACAO_WEIGHT_BY_BADGE[inferred.badgeClass] ?? inferred.weight,
      };
    }

    return { label: situacaoTextoRaw, badgeClass: 'muted', weight: 90 };
  }

  const codigoRaw = String(
    pedido?.situacao_Pedido ?? pedido?.situacao ?? pedido?.status ?? pedido?.status_Pedido ?? '',
  ).trim();

  if (codigoRaw && SITUACAO_MAP_BY_CODE[codigoRaw]) {
    return SITUACAO_MAP_BY_CODE[codigoRaw];
  }

  if (codigoRaw) {
    const inferred = inferSituacaoByText(codigoRaw);
    if (inferred) return inferred;
  }

  return {
    label: codigoRaw || '-',
    badgeClass: 'muted',
    weight: 99,
  };
};

const parseDateForSort = (value: any) => {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return 0;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

type SortField = 'numero' | 'data' | 'cliente' | 'vendedor' | 'situacao' | 'valor';
type SortDirection = 'asc' | 'desc';
type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
};

type PedidoVendaPageProps = {
  isRepresentantes?: boolean;
};

export function PedidoVendaPage({ isRepresentantes = false }: PedidoVendaPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const tituloPagina = isRepresentantes ? 'Pedidos de Venda Representantes' : 'Pedidos de Venda';
  const subtituloPagina = isRepresentantes
    ? 'Consulta e inclusão de pedidos de venda representantes.'
    : 'Consulta e inclusão de pedidos de venda.';
  const mobileLabel = isRepresentantes ? 'Pedidos de Venda Representantes' : 'Pedidos de Venda';
  const tituloNovoPedido = isRepresentantes ? 'Novo pedido de venda representantes' : 'Novo pedido';

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dataInicio, setDataInicio] = useState(() => (isRepresentantes ? '' : formatToday()));
  const [dataFim, setDataFim] = useState(() => (isRepresentantes ? '' : formatToday()));
  const [situacao, setSituacao] = useState(() => (isRepresentantes ? 'Elaboração' : 'Todos'));
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [pedidoFormOpen, setPedidoFormOpen] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState<number | null>(null);
  const [pedidoSituacaoSelecionada, setPedidoSituacaoSelecionada] = useState('');
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any | null>(null);
  const [pedidoModo, setPedidoModo] = useState<'create' | 'edit' | 'view'>('create');
  const [pedidoFormKey, setPedidoFormKey] = useState(0);
  const [pedidoExcluirConfirm, setPedidoExcluirConfirm] = useState<number | null>(null);
  const [emptyMessage, setEmptyMessage] = useState('Nenhum pedido de venda encontrado.');
  const [expandedPedidoCards, setExpandedPedidoCards] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const initialLoadRef = useRef(false);
  const PedidoFormComponent = pedidoModo === 'edit' ? EditarPedidoVendaFormPanel : NovoPedidoVendaFormPanel;

  const pedidosOrdenados = useMemo(() => {
    const list = [...pedidos];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const numeroA = Number((a as any).num_Pedido || (a as any).numPedido || 0);
      const numeroB = Number((b as any).num_Pedido || (b as any).numPedido || 0);
      const dataA = String((a as any).data_Pedido || (a as any).dataPedido || '-');
      const dataB = String((b as any).data_Pedido || (b as any).dataPedido || '-');
      const clienteA = String((a as any).nome_Fantasia || (a as any).nome_Cliente || (a as any).nomeCliente || '-');
      const clienteB = String((b as any).nome_Fantasia || (b as any).nome_Cliente || (b as any).nomeCliente || '-');
      const vendedorA = String((a as any).nome_Vendedor || (a as any).nomeVendedor || '-');
      const vendedorB = String((b as any).nome_Vendedor || (b as any).nomeVendedor || '-');
      const situacaoA = getSituacaoInfo(a as any);
      const situacaoB = getSituacaoInfo(b as any);
      const valorA = parseCurrencyNumber(getPedidoValorRaw(a as any));
      const valorB = parseCurrencyNumber(getPedidoValorRaw(b as any));

      let comparison = 0;
      if (sortField === 'numero') comparison = numeroA - numeroB;
      if (sortField === 'data') comparison = parseDateForSort(dataA) - parseDateForSort(dataB);
      if (sortField === 'cliente') comparison = collator.compare(clienteA, clienteB);
      if (sortField === 'vendedor') comparison = collator.compare(vendedorA, vendedorB);
      if (sortField === 'situacao') {
        comparison = situacaoA.weight - situacaoB.weight;
        if (comparison === 0) comparison = collator.compare(situacaoA.label, situacaoB.label);
      }
      if (sortField === 'valor') comparison = valorA - valorB;

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [pedidos, sortDirection, sortField]);

  const pedidosFiltrados = useMemo(() => filterListByTerm(pedidosOrdenados, searchTerm), [pedidosOrdenados, searchTerm]);

  const totalPedidos = useMemo(() => pedidosFiltrados.length, [pedidosFiltrados]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const parseDateStrict = (value: string) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
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

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const checkAcao = async (codigoAcao: string, deniedMessage: string) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario() || '';

    const resp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, codigoAcao, 24);
    if (!resp.succeeded) {
      const msg = (resp.jsonBody as any)?.message || deniedMessage;
      showToast(String(msg), 'error');
      return false;
    }

    return true;
  };

  const carregarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const usuario = GlobalConfig.getUsuario() || '';
      const nivelUsuario = Number(GlobalConfig.getNivelUsuario() ?? 0);
      const isNivel9 = nivelUsuario === 9;
      const tipoPedidoVenda = isRepresentantes ? 2 : 1;

      const params: any = {
        tipo: 1,
        tipoPedidoVenda,
        situacaoPedido: situacao || (isRepresentantes ? 'Elaboração' : 'Todos'),
        dataDe: dataInicio,
        dataAte: dataFim,
      };

      if (isRepresentantes && !isNivel9 && usuario) {
        params.emitente = usuario;
      }

      if (searchText.trim()) {
        params.numPedido = searchText.trim();
      }

      const response = await listPedidosVenda(params);
      const messageFromApi = String(
        (response as any)?.message ?? (response as any)?.Message ?? 'Nenhum pedido de venda encontrado.',
      ).trim();

      if (Array.isArray(response)) {
        setPedidos(response);
        setEmptyMessage(response.length === 0 ? messageFromApi : 'Nenhum pedido de venda encontrado.');
      } else if (Array.isArray(response?.data)) {
        setPedidos(response.data);
        setEmptyMessage(response.data.length === 0 ? messageFromApi : 'Nenhum pedido de venda encontrado.');
      } else {
        setPedidos([]);
        setEmptyMessage(messageFromApi || 'Nenhum pedido de venda encontrado.');
      }
    } catch (error: any) {
      const message = String(error?.message || '').trim();
      if (message.toLowerCase().includes('nenhum pedido de venda encontrado')) {
        setPedidos([]);
        setEmptyMessage(message);
      } else {
        showToast(message || 'Erro ao carregar pedidos.', 'error');
        setEmptyMessage('Nenhum pedido de venda encontrado.');
      }
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, isRepresentantes, searchText, showToast, situacao]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data de e Data até juntas.';
      nextErrors.dataFim = 'Preencha Data de e Data até juntas.';
    }

    if (temDataInicio && temDataFim) {
      const parsedInicio = parseDateStrict(dataInicio);
      const parsedFim = parseDateStrict(dataFim);

      if (!parsedInicio) {
        nextErrors.dataInicio = 'Data de inválida.';
      }
      if (!parsedFim) {
        nextErrors.dataFim = 'Data até inválida.';
      }

      if (parsedInicio && parsedFim && parsedInicio.getTime() > parsedFim.getTime()) {
        nextErrors.dataInicio = 'Data de não pode ser maior que Data até.';
        nextErrors.dataFim = 'Data até não pode ser menor que Data de.';
      }
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregarPedidos();
  }, [carregarPedidos, dataFim, dataInicio]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarPedidos();
  }, [carregarPedidos]);

  const handleConsultar = async (pedido: any, situacaoPedido = '') => {
    const allowed = await checkAcao('3', 'Você não possui permissão para consultar pedidos.');
    if (!allowed) return;

    const numPedido = Number((pedido as any)?.num_Pedido || (pedido as any)?.numPedido || 0);

    setPedidoModo('view');
    setPedidoEditando(numPedido);
    setPedidoSituacaoSelecionada(String(situacaoPedido || '').trim());
    setPedidoSelecionado(pedido ?? null);
    setPedidoFormKey((prev) => prev + 1);
    setPedidoFormOpen(true);
  };

  const handleEditar = async (pedido: any, situacaoPedido = '') => {
    if (!isSituacaoElaboracao(situacaoPedido)) {
      showToast('Apenas pedidos em Elaboração podem ser editados.', 'info');
      return;
    }

    const allowed = await checkAcao('2', 'Você não possui permissão para editar pedidos.');
    if (!allowed) return;

    const numPedido = Number((pedido as any)?.num_Pedido || (pedido as any)?.numPedido || 0);

    setPedidoModo('edit');
    setPedidoEditando(numPedido);
    setPedidoSituacaoSelecionada(String(situacaoPedido || '').trim());
    setPedidoSelecionado(pedido ?? null);
    setPedidoFormKey((prev) => prev + 1);
    setPedidoFormOpen(true);
  };

  const handleDuplicar = async (numPedido: number) => {
    const allowed = await checkAcao('6', 'Você não possui permissão para duplicar pedidos.');
    if (!allowed) return;

    try {
      setLoading(true);
      await duplicarPedidoVenda(numPedido, { Codigo_Empresa: GlobalConfig.getCodEmpresa() });

      const usuario = GlobalConfig.getUsuario() || '';
      const nivelUsuario = Number(GlobalConfig.getNivelUsuario() ?? 0);
      const isNivel9 = nivelUsuario === 9;
      const tipoPedidoVenda = isRepresentantes ? 2 : 1;
      const consultaParams: any = {
        tipo: 1,
        tipoPedidoVenda,
        numPedido: String(numPedido),
        situacaoPedido: 'Todos',
      };

      if (isRepresentantes && !isNivel9 && usuario) {
        consultaParams.emitente = usuario;
      }

      const detalheResp = await listPedidosVenda(consultaParams);
      const detalheRows = Array.isArray(detalheResp)
        ? detalheResp
        : Array.isArray((detalheResp as any)?.data)
          ? (detalheResp as any).data
          : [];
      const pedidoDuplicado = detalheRows[0] ?? null;

      setPedidoModo('create');
      setPedidoEditando(null);
      setPedidoSituacaoSelecionada('');
      setPedidoSelecionado(pedidoDuplicado);
      setPedidoFormKey((prev) => prev + 1);
      setPedidoFormOpen(true);

      showToast('Pedido duplicado com sucesso.', 'success');
      await carregarPedidos();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao duplicar pedido.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async (numPedido: number) => {
    const allowed = await checkAcao('4', 'Você não possui permissão para excluir pedidos.');
    if (!allowed) return;

    setPedidoExcluirConfirm(numPedido);
  };

  const confirmarExcluirPedido = async () => {
    if (!pedidoExcluirConfirm) return;

    try {
      setLoading(true);
      await deletarPedidoVenda(pedidoExcluirConfirm, GlobalConfig.getCodEmpresa(), GlobalConfig.getUsuario());
      showToast('Pedido excluído com sucesso.', 'success');
      setPedidoExcluirConfirm(null);
      await carregarPedidos();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao excluir pedido.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="clientes-page list-layout-page pedido-venda-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>{tituloPagina}</h1>
            <p>{subtituloPagina}</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel pedido-venda-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalPedidos} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel={mobileLabel}
              placeholder="Pesquisar na lista de pedidos"
              className="pedido-venda-search"
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
              onClick={() => {
                void carregarPedidos();
              }}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => {
                setPedidoModo('create');
                setPedidoEditando(null);
                setPedidoSelecionado(null);
                setPedidoFormKey((prev) => prev + 1);
                setPedidoFormOpen(true);
              }}
              title={tituloNovoPedido}
              aria-label={tituloNovoPedido}
              disabled={loading}
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
          <div className="list-layout-extra-filters pedido-venda-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data de</span>
              <CustomDatePicker
                className={filtroErrors.dataInicio ? 'pcp-date-error' : undefined}
                value={dataInicio}
                onChange={(nextDate) => {
                  setDataInicio(nextDate);
                  if (filtroErrors.dataInicio) {
                    setFiltroErrors((prev) => ({ ...prev, dataInicio: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error pedido-venda-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' pedido-venda-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--date">
              <span>Data até</span>
              <CustomDatePicker
                className={filtroErrors.dataFim ? 'pcp-date-error' : undefined}
                value={dataFim}
                onChange={(nextDate) => {
                  setDataFim(nextDate);
                  if (filtroErrors.dataFim) {
                    setFiltroErrors((prev) => ({ ...prev, dataFim: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error pedido-venda-field__error-slot${
                  filtroErrors.dataFim ? '' : ' pedido-venda-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Pesquisar número do pedido"
              />
              {searchText.trim() ? (
                <button
                  type="button"
                  className="field-clear-button"
                  aria-label="Limpar número do pedido"
                  title="Limpar"
                  onClick={() => setSearchText('')}
                >
                  <IoCloseCircleOutline size={16} />
                </button>
              ) : null}
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Situação</span>
              <SearchableSelect
                value={situacao}
                onChange={setSituacao}
                options={situacaoSelectOptions}
                searchPlaceholder="Pesquisar situação"
                ariaLabel="Situação"
              />
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando pedidos...</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p className="module-empty">{emptyMessage}</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('numero')}>
                      Número <span>{getSortIndicator('numero')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                      Data <span>{getSortIndicator('data')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('cliente')}>
                      Cliente <span>{getSortIndicator('cliente')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('vendedor')}>
                      Vendedor <span>{getSortIndicator('vendedor')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                      Situação <span>{getSortIndicator('situacao')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('valor')}>
                      Valor <span>{getSortIndicator('valor')}</span>
                    </button>
                  </th>
                  <th className="module-table__actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((pedido) => {
                  const numPedido = Number((pedido as any).num_Pedido || (pedido as any).numPedido || 0);
                  const data = String((pedido as any).data_Pedido || (pedido as any).dataPedido || '-');
                  const cliente =
                    String((pedido as any).nome_Fantasia || (pedido as any).nome_Cliente || (pedido as any).nomeCliente || '-');
                  const vendedor = String((pedido as any).nome_Vendedor || (pedido as any).nomeVendedor || '-');
                  const situ = getSituacaoInfo(pedido as any);
                  const valor = getPedidoValorRaw(pedido as any);
                  const podeEditar = isSituacaoElaboracao(situ.label);

                  return (
                    <tr
                      key={numPedido}
                      className="module-row-clickable"
                      onClick={() => void handleConsultar(pedido, situ.label)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void handleConsultar(pedido, situ.label);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>{numPedido}</td>
                      <td>{data}</td>
                      <td>{cliente}</td>
                      <td>{vendedor}</td>
                      <td>
                        <span className={`badge ${situ.badgeClass}`}>{situ.label}</span>
                      </td>
                      <td>
                        {formatCurrencyBRL(valor)}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            disabled={!podeEditar}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleEditar(pedido, situ.label);
                            }}
                            title={podeEditar ? 'Editar' : 'Somente pedidos em Elaboração podem ser editados'}
                          >
                            <IoCreateOutline size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDuplicar(numPedido);
                            }}
                            title="Duplicar"
                          >
                            <IoCopyOutline size={16} />
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleExcluir(numPedido);
                            }}
                            title="Excluir"
                          >
                            <IoTrashOutline size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div className="module-cards">
              {pedidosFiltrados.map((pedido) => {
                const numPedido = Number((pedido as any).num_Pedido || (pedido as any).numPedido || 0);
                const data = String((pedido as any).data_Pedido || (pedido as any).dataPedido || '-');
                const cliente =
                  String((pedido as any).nome_Fantasia || (pedido as any).nome_Cliente || (pedido as any).nomeCliente || '-');
                const vendedor = String((pedido as any).nome_Vendedor || (pedido as any).nomeVendedor || '-');
                const situ = getSituacaoInfo(pedido as any);
                const valor = getPedidoValorRaw(pedido as any);
                const podeEditar = isSituacaoElaboracao(situ.label);
                const cardKey = String(numPedido || `idx-${cliente}-${data}`);
                const isExpandedCard = Boolean(expandedPedidoCards[cardKey]);

                return (
                  <article
                    key={`card-${numPedido}`}
                    className="module-card module-row-clickable"
                    onClick={() => void handleConsultar(pedido, situ.label)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleConsultar(pedido, situ.label);
                      }
                    }}
                    tabIndex={0}
                  >
                    <div className="module-card__row module-card__row--split">
                      <div className="module-card__row-stack">
                        <span>Número</span>
                        <strong>{numPedido}</strong>
                      </div>
                      <button
                        type="button"
                        className="module-card__expand-toggle"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedPedidoCards((prev) => ({
                            ...prev,
                            [cardKey]: !prev[cardKey],
                          }));
                        }}
                        aria-label={isExpandedCard ? 'Recolher detalhes do pedido' : 'Expandir detalhes do pedido'}
                        title={isExpandedCard ? 'Recolher detalhes' : 'Expandir detalhes'}
                      >
                        {isExpandedCard ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                      </button>
                    </div>
                    <div className="module-card__row">
                      <span>Cliente</span>
                      <strong>{cliente}</strong>
                    </div>
                    {isExpandedCard ? (
                      <>
                        <div className="module-card__row">
                          <span>Data</span>
                          <strong>{data}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Vendedor</span>
                          <strong>{vendedor}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Situação</span>
                          <strong>
                            <span className={`badge ${situ.badgeClass}`}>{situ.label}</span>
                          </strong>
                        </div>
                        <div className="module-card__row">
                          <span>Valor</span>
                          <strong>{formatCurrencyBRL(valor)}</strong>
                        </div>
                      </>
                    ) : null}

                    <div className="module-card__actions">
                      {!isExpandedCard ? (
                        <span className={`badge ${situ.badgeClass} pedido-venda-mobile-card-situacao`}>{situ.label}</span>
                      ) : null}
                      <button
                        type="button"
                            disabled={!podeEditar}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleEditar(pedido, situ.label);
                        }}
                            title={podeEditar ? 'Editar' : 'Somente pedidos em Elaboração podem ser editados'}
                      >
                        <IoCreateOutline size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDuplicar(numPedido);
                        }}
                        title="Duplicar"
                      >
                        <IoCopyOutline size={16} />
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleExcluir(numPedido);
                        }}
                        title="Excluir"
                      >
                        <IoTrashOutline size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        </section>
      </section>

      <PedidoFormComponent
        key={`${pedidoModo}-${pedidoEditando ?? 'new'}-${pedidoFormKey}`}
        open={pedidoFormOpen}
        numPedido={pedidoEditando}
        situacaoPedido={pedidoSituacaoSelecionada}
        initialPedido={pedidoSelecionado}
        readOnly={pedidoModo === 'view'}
        isRepresentantes={isRepresentantes}
        onClose={() => {
          setPedidoFormOpen(false);
          setPedidoEditando(null);
          setPedidoSituacaoSelecionada('');
          setPedidoSelecionado(null);
          setPedidoModo('create');
        }}
        onSaved={async () => {
          await carregarPedidos();
        }}
      />

      {pedidoExcluirConfirm ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar exclusão de pedido">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Confirmar exclusão</h2>
            </header>
            <section className="module-form">
              <p>Deseja excluir o pedido {pedidoExcluirConfirm}?</p>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setPedidoExcluirConfirm(null)}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void confirmarExcluirPedido()}
                  disabled={loading}
                >
                  Excluir
                </button>
              </div>
            </section>
          </article>
        </section>
      ) : null}
    </main>
  );
}
