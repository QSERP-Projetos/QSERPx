import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoAddCircleOutline,
  IoArrowBack,
  IoCheckmarkCircle,
  IoCheckmarkDoneOutline,
  IoCloseCircle,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoHelpCircleOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  alterarLaudoInspecaoCall,
  healthCheckCall,
  incluirFichaInspecaoCall,
  incluirValoresLaudoInspecaoCall,
  listFichaInspecaoCall,
  listMotivoBloqueioCall,
  listMotivoDemeritoCall,
  listaInspetoresCall,
  obterUsuariosTransacoesSistemaAcaoCall,
  tokenCall,
} from '../../../services/apiCalls';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type TipoLaudo = 'Processo' | 'Recebimento';

type SelectOption = {
  value: string;
  label: string;
};

type NovaFichaErrors = {
  codigoLote?: string;
  dataInspecao?: string;
  codigoInspetor?: string;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  pesquisaMaterial?: string;
  situacaoLaudo?: string;
};

type LaudoItemUi = {
  id: string;
  numItem: number;
  numItemExib: string;
  descricao: string;
  equipamento: string;
  resultado: number;
  aceitaMedicoes: boolean;
  valorMinimo: string;
  valorMaximo: string;
  dataInspecao: string;
  qtdRecebida: string;
};

type ItemState = {
  equipamento: string;
  resultado: number;
};

type FichaInspecaoPageProps = {
  tipoLaudo: TipoLaudo;
  titulo: string;
  subtitulo: string;
  includePermission: { acao: string; transacao: string };
  laudoPermission: { acao: string; transacao: string };
};

type SortField = 'data' | 'material' | 'descricao' | 'lote' | 'situacao';
type SortDirection = 'asc' | 'desc';

const SITUACAO_OPTIONS: SelectOption[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendente', value: '0' },
  { label: 'Liberado', value: '1' },
  { label: 'Apontando', value: '2' },
  { label: 'Finalizado', value: '3' },
  { label: 'Erro', value: '4' },
  { label: 'Cancelado', value: '9' },
];

const RESULTADO_OPTIONS: SelectOption[] = [
  { label: 'Inspeção', value: '0' },
  { label: 'Aprovado', value: '1' },
  { label: 'Reprovado', value: '2' },
  { label: 'Skip Lote', value: '3' },
];

const getSituacaoLaudoLabel = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';

  const numeric = Number(text);
  if (!Number.isNaN(numeric)) {
    if (numeric === 0) return 'Pendente';
    if (numeric === 1) return 'Liberado';
    if (numeric === 2) return 'Apontando';
    if (numeric === 3) return 'Finalizado';
    if (numeric === 4) return 'Erro';
    if (numeric === 9) return 'Cancelado';
    if (numeric === 99) return 'Todos';
  }

  return text;
};

const getResultadoIcon = (resultado: number) => {
  if (resultado === 1) return <IoCheckmarkCircle size={20} color="#22c55e" />;
  if (resultado === 2) return <IoCloseCircle size={20} color="#ef4444" />;
  if (resultado === 3) return <IoCheckmarkCircle size={20} color="#64748b" />;
  return <IoHelpCircleOutline size={20} color="#f59e0b" />;
};

const formatToday = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatCurrentDate = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const parseDecimal = (value: string) => {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveToken = (response: any) => {
  return String(response?.jsonBody?.token ?? response?.data?.token ?? response?.data?.Token ?? '').trim();
};

const parseDateForSort = (value: any) => {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return 0;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const getFirstFilledValue = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return value;
  }

  return undefined;
};

const getCandidateItemRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;

  const candidateKeys = [
    'itens',
    'Itens',
    'itensLaudo',
    'itens_Laudo',
    'listaItens',
    'ListaItens',
    'resultadosItens',
    'resultados_Itens',
    'itensInspecao',
    'itens_Inspecao',
    'items',
    'Items',
    'data',
    'content',
  ];

  for (const key of candidateKeys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

const resolveLaudoItem = (item: any, index: number) => {
  const numItem = Number(getFirstFilledValue(item, ['num_Item', 'Num_Item', 'codigo_Item', 'Codigo_Item']) ?? index + 1);
  const numItemExib = String(getFirstFilledValue(item, ['num_Item_Exib', 'num_item_exib', 'numItemExib']) ?? numItem).trim();
  const descricao = String(
    getFirstFilledValue(item, [
      'descricao_Item',
      'Descricao_Item',
      'descricaoCaracteristica',
      'descricao_Caracteristica',
      'descricao',
      'Descricao',
    ]) ?? '-',
  ).trim();
  const equipamento = String(
    getFirstFilledValue(item, [
      'num_Equipamento',
      'num_equipamento',
      'equipamento',
      'Equipamento',
      'descricao_Equipamento',
      'Descricao_Equipamento',
      'cod_Equipamento',
      'Cod_Equipamento',
    ]) ?? '-',
  ).trim();
  const resultado = Number(
    getFirstFilledValue(item, [
      'amostra_Aprovada',
      'amostra_aprovada',
      'resultado',
      'Resultado',
      'resultado_Item',
      'resultado_item',
      'status_Resultado',
      'statusResultado',
    ]) ?? 0,
  );

  const valorMinimo = String(getFirstFilledValue(item, ['valor_Minimo', 'valor_minimo']) ?? '').trim();
  const valorMaximo = String(getFirstFilledValue(item, ['valor_Maximo', 'valor_maximo']) ?? '').trim();
  const aceitaMedicoes = Boolean(
    getFirstFilledValue(item, ['aceita_Medicoes', 'aceita_medicoes', 'aceita_Medicao', 'aceita_medicao']) ||
      valorMinimo ||
      valorMaximo,
  );

  return {
    id: `${numItem}-${index}`,
    numItem: Number.isFinite(numItem) ? numItem : index + 1,
    numItemExib: numItemExib || String(index + 1),
    descricao: descricao || '-',
    equipamento: equipamento || '',
    resultado: Number.isFinite(resultado) ? resultado : 0,
    aceitaMedicoes,
    valorMinimo,
    valorMaximo,
    dataInspecao: String(getFirstFilledValue(item, ['data_Inspecao', 'data_inspecao']) ?? '').trim(),
    qtdRecebida: String(getFirstFilledValue(item, ['qtd_Recebida', 'qtd_recebida']) ?? '').trim(),
  };
};

const resolveLaudoItens = (payload: any) => {
  const rows = getCandidateItemRows(payload);

  const itemRows = rows.filter((item) => {
    return (
      getFirstFilledValue(item, ['num_Item', 'Num_Item', 'codigo_Item', 'Codigo_Item']) != null ||
      getFirstFilledValue(item, ['descricao_Item', 'Descricao_Item', 'descricaoCaracteristica', 'descricao_Caracteristica']) != null
    );
  });

  return itemRows.map(resolveLaudoItem);
};

const toSelectOptions = (rows: any[], valueKeys: string[], labelKeys: string[]): SelectOption[] => {
  return rows
    .map((item) => {
      const value = valueKeys
        .map((key) => item?.[key])
        .find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim().length > 0);
      const label = labelKeys
        .map((key) => item?.[key])
        .find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim().length > 0);

      if (value === undefined || value === null || label === undefined || label === null) {
        return null;
      }

      return {
        value: String(value).trim(),
        label: String(label).trim(),
      };
    })
    .filter((item): item is SelectOption => Boolean(item?.value && item?.label));
};

export function FichaInspecaoPage({
  tipoLaudo,
  titulo,
  subtitulo,
  includePermission,
  laudoPermission,
}: FichaInspecaoPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [searchTerm, setSearchTerm] = useState('');
  const [pesquisaMaterial, setPesquisaMaterial] = useState('');
  const [situacaoLaudo, setSituacaoLaudo] = useState('');
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [sortField, setSortField] = useState<SortField>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const initialLoadRef = useRef(false);
  const [novaFichaOpen, setNovaFichaOpen] = useState(false);
  const [laudoOpen, setLaudoOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [laudoItens, setLaudoItens] = useState<LaudoItemUi[]>([]);
  const [laudoItensLoading, setLaudoItensLoading] = useState(false);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [medicoesOpen, setMedicoesOpen] = useState(false);
  const [medicoesItem, setMedicoesItem] = useState<LaudoItemUi | null>(null);
  const [medicoesInicial, setMedicoesInicial] = useState<string[]>([]);
  const [medicoesValores, setMedicoesValores] = useState<string[]>([]);
  const [medicaoAtual, setMedicaoAtual] = useState('');
  const [savingMedicoes, setSavingMedicoes] = useState(false);

  const [inspetores, setInspetores] = useState<SelectOption[]>([]);
  const [motivosBloqueio, setMotivosBloqueio] = useState<SelectOption[]>([]);
  const [motivosDemerito, setMotivosDemerito] = useState<SelectOption[]>([]);

  const [novaFicha, setNovaFicha] = useState({
    codigoLote: '',
    dataInspecao: formatToday(),
    codigoInspetor: '',
    observacao: '',
  });
  const [novaFichaErrors, setNovaFichaErrors] = useState<NovaFichaErrors>({});

  const [laudo, setLaudo] = useState({
    qtdAprovada: '',
    qtdReprovada: '',
    qtdDestruida: '',
    codigoInspetor: '',
    motivoBloqueio: '',
    motivoSucata: '',
    motivoDemerito: '',
  });

  const inspetorOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...inspetores], [inspetores]);
  const motivoBloqueioOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...motivosBloqueio], [motivosBloqueio]);
  const motivoDemeritoOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...motivosDemerito], [motivosDemerito]);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const dataA = String(a?.data_Inspecao ?? a?.data_inspecao ?? '-');
      const dataB = String(b?.data_Inspecao ?? b?.data_inspecao ?? '-');
      const materialA = String(a?.codigo_Material ?? a?.codigo_material ?? '-');
      const materialB = String(b?.codigo_Material ?? b?.codigo_material ?? '-');
      const descricaoA = String(a?.descricao_Portug ?? a?.descricao_portug ?? '-');
      const descricaoB = String(b?.descricao_Portug ?? b?.descricao_portug ?? '-');
      const loteA = String(a?.codigo_Lote ?? a?.codigo_lote ?? '-');
      const loteB = String(b?.codigo_Lote ?? b?.codigo_lote ?? '-');
      const situacaoA = getSituacaoLaudoLabel(a?.situacao_Laudo ?? a?.situacao_laudo ?? '-');
      const situacaoB = getSituacaoLaudoLabel(b?.situacao_Laudo ?? b?.situacao_laudo ?? '-');

      let comparison = 0;
      if (sortField === 'data') comparison = parseDateForSort(dataA) - parseDateForSort(dataB);
      if (sortField === 'material') comparison = collator.compare(materialA, materialB);
      if (sortField === 'descricao') comparison = collator.compare(descricaoA, descricaoB);
      if (sortField === 'lote') comparison = collator.compare(loteA, loteB);
      if (sortField === 'situacao') comparison = collator.compare(situacaoA, situacaoB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

  const totalFichas = useMemo(() => rowsFiltradas.length, [rowsFiltradas]);

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

  const registrarAcoesUsuario = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      throw new Error('Informações de sessão não encontradas.');
    }

    await acoesUsuariosCall(baseUrl, token, {
      codigoEmpresa,
      idSessao: idSessao ?? undefined,
      codigoUsuario: usuario,
    });

    return { baseUrl, token, codigoEmpresa, usuario };
  }, []);

  const validarPermissao = useCallback(
    async (acao: string, transacao: string, mensagemNegada: string) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario();

      if (!baseUrl || !token || !usuario) {
        throw new Error('Informações de sessão não encontradas.');
      }

      const resp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, acao, transacao);
      if (!resp.succeeded) {
        showToast(mensagemNegada, 'error');
        return false;
      }

      return true;
    },
    [showToast],
  );

  const carregarInspetores = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) return;

    const resp = await listaInspetoresCall(baseUrl, token);
    const options = toSelectOptions(getRows(resp.jsonBody || resp.data), ['codigo_Inspetor', 'codigo_inspetor'], [
      'descricao_Inspetor',
      'descricao_inspetor',
    ]);
    setInspetores(options);
  }, []);

  const carregarMotivos = useCallback(async () => {
    if (tipoLaudo !== 'Recebimento') {
      setMotivosBloqueio([]);
      setMotivosDemerito([]);
      return;
    }

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) return;

    const [bloqueioResp, demeritoResp] = await Promise.all([
      listMotivoBloqueioCall(baseUrl, token),
      listMotivoDemeritoCall(baseUrl, token),
    ]);

    const bloqueioOptions = toSelectOptions(
      getRows(bloqueioResp.jsonBody || bloqueioResp.data),
      ['codigo_Bloqueio', 'codigo_bloqueio'],
      ['codDescricaoBloq', 'cod_descricao_bloq', 'descricao'],
    );

    const demeritoOptions = toSelectOptions(
      getRows(demeritoResp.jsonBody || demeritoResp.data),
      ['codigo_Demerito', 'codigo_demerito'],
      ['codDescricaoDemerito', 'cod_descricao_demerito', 'descricao'],
    );

    setMotivosBloqueio(bloqueioOptions);
    setMotivosDemerito(demeritoOptions);
  }, [tipoLaudo]);

  const carregarFichas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      await registrarAcoesUsuario();

      const resp = await listFichaInspecaoCall(baseUrl, token, {
        tipoLaudo,
        tipoListagem: 2,
        codigoEmpresa,
        usuarioAtual: usuario,
        codigoMaterial: pesquisaMaterial,
        codigoLote: '',
        dataInicio,
        dataFim,
        numLaudo: 0,
        situacaoLaudo: situacaoLaudo.trim() ? Number(situacaoLaudo) : null,
        numItem: 0,
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || `Erro ao carregar fichas de inspeção de ${tipoLaudo.toLowerCase()}.`, 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, pesquisaMaterial, registrarAcoesUsuario, showToast, situacaoLaudo, tipoLaudo]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarFichas();
  }, [carregarFichas]);

  const abrirNovaFicha = async () => {
    try {
      const ok = await validarPermissao(
        includePermission.acao,
        includePermission.transacao,
        `Você não possui permissão para incluir ficha de inspeção de ${tipoLaudo.toLowerCase()}.`,
      );
      if (!ok) return;

      await carregarInspetores();
      setNovaFicha({
        codigoLote: '',
        dataInspecao: formatToday(),
        codigoInspetor: '',
        observacao: '',
      });
      setNovaFichaErrors({});
      setNovaFichaOpen(true);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar permissão de inclusão.', 'error');
    }
  };

  const salvarNovaFicha = async () => {
    const codigoLote = novaFicha.codigoLote.trim();

    const nextErrors: NovaFichaErrors = {};
    if (!codigoLote) {
      nextErrors.codigoLote = 'Código do lote é obrigatório.';
    }

    if (!novaFicha.dataInspecao.trim()) {
      nextErrors.dataInspecao = 'Data da inspeção é obrigatória.';
    }

    if (!novaFicha.codigoInspetor) {
      nextErrors.codigoInspetor = 'Inspetor é obrigatório.';
    }

    setNovaFichaErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const { baseUrl, token, codigoEmpresa, usuario } = await registrarAcoesUsuario();

      const healthResp = await healthCheckCall(baseUrl);
      if (!healthResp.succeeded) {
        showToast('Falha na comunicação com o servidor.', 'error');
        return;
      }

      const tokenResp = await tokenCall(baseUrl, {
        usuario,
        nomeEmpresa: GlobalConfig.getNomeEmpresa(),
        codigoEmpresa,
        chaveApi: GlobalConfig.getChaveApi(),
        idGuid: GlobalConfig.getGuidID(),
        tipo: 2,
      });

      if (!tokenResp.succeeded) {
        showToast('Falha ao gerar token para abertura da ficha.', 'error');
        return;
      }

      const tokenNovaFicha = resolveToken(tokenResp);
      if (tokenNovaFicha) {
        GlobalConfig.setJwToken(tokenNovaFicha);
      }

      const resp = await incluirFichaInspecaoCall(baseUrl, tokenNovaFicha || token, {
        codigoEmpresa,
        usuarioAtual: usuario,
        codigoLote,
        dataInspecao: novaFicha.dataInspecao.trim(),
        codigoInspetor: Number(novaFicha.codigoInspetor) || 0,
        tipoLaudo,
        obsInspecao: novaFicha.observacao.trim(),
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível abrir a ficha.'), 'error');
        return;
      }

      showToast('Laudo de inspeção aberto com sucesso.', 'success');
      setNovaFichaOpen(false);
      await carregarFichas();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao abrir ficha de inspeção.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const abrirLaudo = async (row: any) => {
    try {
      const ok = await validarPermissao(
        laudoPermission.acao,
        laudoPermission.transacao,
        `Você não possui permissão para apontar fichas de inspeção de ${tipoLaudo.toLowerCase()}.`,
      );
      if (!ok) return;

      await Promise.all([carregarInspetores(), carregarMotivos()]);

      setLaudoItensLoading(true);

      let itens = resolveLaudoItens(row);
      const numLaudo = Number(row?.num_Laudo ?? row?.num_laudo ?? 0);

      if (itens.length === 0 && numLaudo > 0) {
        const baseUrl = GlobalConfig.getBaseUrl();
        const token = GlobalConfig.getJwToken();
        const codigoEmpresa = GlobalConfig.getCodEmpresa();
        const usuario = GlobalConfig.getUsuario();

        if (baseUrl && token && codigoEmpresa && usuario) {
          const tiposListagemDetalhe = [3, 4, 2];

          for (const tipoListagem of tiposListagemDetalhe) {
            const detalheResp = await listFichaInspecaoCall(baseUrl, token, {
              tipoLaudo,
              tipoListagem,
              codigoEmpresa,
              usuarioAtual: usuario,
              codigoMaterial: '',
              codigoLote: '',
              dataInicio: '',
              dataFim: '',
              numLaudo,
              situacaoLaudo: null,
              numItem: 0,
            });

            if (!detalheResp.succeeded) continue;

            const payload = detalheResp.jsonBody || detalheResp.data;
            const fromPayload = resolveLaudoItens(payload);
            if (fromPayload.length > 0) {
              itens = fromPayload;
              break;
            }

            const rootRows = getRows(payload);
            if (rootRows.length > 0) {
              const fromFirstRow = resolveLaudoItens(rootRows[0]);
              if (fromFirstRow.length > 0) {
                itens = fromFirstRow;
                break;
              }
            }
          }
        }
      }

      setLaudoItens(itens);
      const nextItemState: Record<string, ItemState> = {};
      itens.forEach((item) => {
        const key = String(item.numItem);
        nextItemState[key] = {
          equipamento: item.equipamento || '',
          resultado: Number(item.resultado || 0),
        };
      });
      setItemState(nextItemState);

      setSelecionado(row);
      setLaudo({
        qtdAprovada: String(row?.qtd_Aprovada ?? row?.qtd_aprovada ?? ''),
        qtdReprovada: String(row?.qtd_Reprovada ?? row?.qtd_reprovada ?? ''),
        qtdDestruida: String(row?.qtd_Destruida ?? row?.qtd_destruida ?? ''),
        codigoInspetor: String(row?.codigo_Inspetor ?? row?.codigo_inspetor ?? ''),
        motivoBloqueio: String(row?.motivo_Bloqueio ?? row?.motivo_bloqueio ?? ''),
        motivoSucata: String(row?.motivo_Sucata ?? row?.motivo_sucata ?? ''),
        motivoDemerito: String(row?.codigo_Demerito ?? row?.codigo_demerito ?? ''),
      });

      setLaudoOpen(true);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao abrir laudo de inspeção.', 'error');
    } finally {
      setLaudoItensLoading(false);
    }
  };

  const updateItemField = (numItem: number, field: keyof ItemState, value: string | number) => {
    const key = String(numItem);
    setItemState((prev) => ({
      ...prev,
      [key]: {
        equipamento: field === 'equipamento' ? String(value) : prev[key]?.equipamento ?? '',
        resultado: field === 'resultado' ? Number(value) : prev[key]?.resultado ?? 0,
      },
    }));
  };

  const buildResultadosPayload = () => {
    const equipamentos = laudoItens.map((item) => itemState[String(item.numItem)]?.equipamento ?? item.equipamento ?? '');
    const resultados = laudoItens.map((item) => itemState[String(item.numItem)]?.resultado ?? Number(item.resultado || 0));
    return [{ Num_Equipamento: equipamentos, Resultado_Item: resultados }];
  };

  const abrirMedicoes = async (item: LaudoItemUi) => {
    if (!selecionado) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const numLaudo = Number(selecionado?.num_Laudo ?? selecionado?.num_laudo ?? 0);

    if (!baseUrl || !token || !codigoEmpresa || !usuario || !numLaudo) return;

    try {
      const resp = await listFichaInspecaoCall(baseUrl, token, {
        tipoLaudo,
        tipoListagem: 4,
        codigoEmpresa,
        usuarioAtual: usuario,
        codigoMaterial: '',
        codigoLote: '',
        dataInicio: '',
        dataFim: '',
        numLaudo,
        situacaoLaudo: 0,
        numItem: item.numItem,
      });

      const list = Array.isArray(resp.jsonBody) ? resp.jsonBody.map((value: any) => String(value)) : [];
      setMedicoesInicial(list);
      setMedicoesValores(list);
    } catch {
      setMedicoesInicial([]);
      setMedicoesValores([]);
    }

    setMedicaoAtual('');
    setMedicoesItem(item);
    setMedicoesOpen(true);
  };

  const salvarMedicoes = async () => {
    if (!medicoesItem || !selecionado) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const numLaudo = Number(selecionado?.num_Laudo ?? selecionado?.num_laudo ?? 0);

    if (!baseUrl || !token || !codigoEmpresa || !usuario || !numLaudo) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    if (medicoesValores.length === 0) {
      showToast('Informe ao menos um valor.', 'error');
      return;
    }

    setSavingMedicoes(true);
    try {
      const resp = await incluirValoresLaudoInspecaoCall(baseUrl, token, {
        valoresMedicaoList: medicoesValores,
        codigoEmpresa,
        numLaudo,
        numItem: medicoesItem.numItem,
        usuarioAtual: usuario,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível salvar as medições.'), 'error');
        return;
      }

      showToast('Medições salvas com sucesso.', 'success');
      setMedicoesOpen(false);
      setMedicoesItem(null);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar medições.', 'error');
    } finally {
      setSavingMedicoes(false);
    }
  };

  const salvarLaudo = async (tipoAcao: 'Salvar' | 'Confirmar') => {
    if (!selecionado) return;

    const numLaudo = Number(selecionado?.num_Laudo ?? selecionado?.num_laudo ?? 0);
    if (!numLaudo) {
      showToast('Laudo inválido para alteração.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { baseUrl, token, codigoEmpresa, usuario } = await registrarAcoesUsuario();

      const qtdReprovada = parseDecimal(laudo.qtdReprovada) ?? 0;
      const qtdDestruida = parseDecimal(laudo.qtdDestruida) ?? 0;

      const resp = await alterarLaudoInspecaoCall(baseUrl, token, {
        tipoLaudo,
        tipoAcao,
        unidadeMedida: String(
          selecionado?.unidade_Medida ??
            selecionado?.unidade_medida ??
            selecionado?.unid_Med_Estq ??
            selecionado?.unid_med_estq ??
            '',
        ),
        codigoEmpresa,
        usuarioAtual: usuario,
        dataConfirmacao: formatCurrentDate(),
        numLaudo,
        qtdAprovada: parseDecimal(laudo.qtdAprovada),
        qtdReprovada: parseDecimal(laudo.qtdReprovada),
        qtdDestruida: parseDecimal(laudo.qtdDestruida),
        codigoInspetor: laudo.codigoInspetor ? Number(laudo.codigoInspetor) : null,
        motivoBloqueio: tipoLaudo === 'Recebimento' && qtdReprovada > 0 && laudo.motivoBloqueio
          ? Number(laudo.motivoBloqueio)
          : null,
        motivoSucata: tipoLaudo === 'Recebimento' && qtdDestruida > 0 && laudo.motivoSucata
          ? Number(laudo.motivoSucata)
          : null,
        codigoDemerito: tipoLaudo === 'Recebimento' && qtdDestruida > 0 && laudo.motivoDemerito
          ? Number(laudo.motivoDemerito)
          : null,
        observacaoConfirmacao: '',
        resultadosItensJson: buildResultadosPayload(),
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, `Não foi possível ${tipoAcao.toLowerCase()} o laudo.`), 'error');
        return;
      }

      showToast(
        tipoAcao === 'Confirmar' ? 'Laudo confirmado com sucesso.' : 'Informações do laudo salvas com sucesso.',
        'success',
      );
      setLaudoOpen(false);
      setSelecionado(null);
      await carregarFichas();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao alterar laudo de inspeção.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temMaterial = Boolean(pesquisaMaterial.trim());
    const temSituacao = situacaoLaudo.trim() !== '';
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if ((temMaterial || temSituacao) && !(temDataInicio && temDataFim)) {
      if (temMaterial) {
        nextErrors.pesquisaMaterial = 'Para filtrar por Código material, informe Data início e Data fim.';
      }

      if (temSituacao) {
        nextErrors.situacaoLaudo = 'Para filtrar por Situação, informe Data início e Data fim.';
      }

      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória para este filtro.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória para este filtro.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregarFichas();
  }, [carregarFichas, dataFim, dataInicio, pesquisaMaterial, situacaoLaudo]);

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalFichas} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel={titulo}
              placeholder="Pesquisar na lista de fichas"
              className="ficha-inspecao-search"
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
              onClick={() => void carregarFichas()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => void abrirNovaFicha()}
              title="Abrir ficha"
              aria-label="Abrir ficha"
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
          <div className="list-layout-extra-filters ficha-inspecao-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker
                className={filtroErrors.dataInicio ? 'ficha-inspecao-date-error' : undefined}
                value={dataInicio}
                onChange={(nextDate) => {
                  setDataInicio(nextDate);
                  if (filtroErrors.dataInicio) {
                    setFiltroErrors((prev) => ({ ...prev, dataInicio: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error ficha-inspecao-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' ficha-inspecao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>
            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker
                className={filtroErrors.dataFim ? 'ficha-inspecao-date-error' : undefined}
                value={dataFim}
                onChange={(nextDate) => {
                  setDataFim(nextDate);
                  if (filtroErrors.dataFim) {
                    setFiltroErrors((prev) => ({ ...prev, dataFim: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error ficha-inspecao-field__error-slot${
                  filtroErrors.dataFim ? '' : ' ficha-inspecao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--lg list-layout-field--clearable">
              <span>Código material</span>
              <div className="ficha-inspecao-field__input-wrap">
                <input
                  value={pesquisaMaterial}
                  onChange={(event) => {
                    setPesquisaMaterial(event.target.value);
                    if (filtroErrors.pesquisaMaterial) {
                      setFiltroErrors((prev) => ({ ...prev, pesquisaMaterial: undefined }));
                    }
                  }}
                  placeholder="Pesquisar código material"
                />
                {pesquisaMaterial.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar material"
                    title="Limpar"
                    onClick={() => setPesquisaMaterial('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small
                className={`module-field-error ficha-inspecao-field__error-slot${
                  filtroErrors.pesquisaMaterial ? '' : ' ficha-inspecao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.pesquisaMaterial || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Situação</span>
              <SearchableSelect
                value={situacaoLaudo}
                onChange={(nextValue) => {
                  setSituacaoLaudo(nextValue || '');
                  if (filtroErrors.situacaoLaudo) {
                    setFiltroErrors((prev) => ({ ...prev, situacaoLaudo: undefined }));
                  }
                }}
                options={SITUACAO_OPTIONS}
                searchPlaceholder="Pesquisar situação"
                ariaLabel="Situação"
                className={filtroErrors.situacaoLaudo ? 'is-error' : undefined}
              />
              <small
                className={`module-field-error ficha-inspecao-field__error-slot${
                  filtroErrors.situacaoLaudo ? '' : ' ficha-inspecao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.situacaoLaudo || ' '}
              </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando fichas...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhuma ficha encontrada.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                      Data <span>{getSortIndicator('data')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('material')}>
                      Material <span>{getSortIndicator('material')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('descricao')}>
                      Descrição <span>{getSortIndicator('descricao')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('lote')}>
                      Lote <span>{getSortIndicator('lote')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                      Situação <span>{getSortIndicator('situacao')}</span>
                    </button>
                  </th>
                  <th className="module-table__actions-col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row, index) => {
                  const data = String(row?.data_Inspecao ?? row?.data_inspecao ?? '-');
                  const material = String(row?.codigo_Material ?? row?.codigo_material ?? '-');
                  const descricao = String(row?.descricao_Portug ?? row?.descricao_portug ?? '-');
                  const lote = String(row?.codigo_Lote ?? row?.codigo_lote ?? '-');
                  const situacao = getSituacaoLaudoLabel(row?.situacao_Laudo ?? row?.situacao_laudo ?? '-');
                  const key = String(row?.num_Laudo ?? row?.num_laudo ?? `${material}-${lote}-${index}`);

                  return (
                    <tr key={key}>
                      <td>{data}</td>
                      <td>{material}</td>
                      <td>{descricao}</td>
                      <td>{lote}</td>
                      <td>{situacao}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-button module-action-button module-action-button--primary"
                            onClick={() => void abrirLaudo(row)}
                            aria-label="Abrir laudo"
                            title="Abrir laudo"
                          >
                            <IoCheckmarkDoneOutline size={16} />
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
              {rowsFiltradas.map((row, index) => {
                const data = String(row?.data_Inspecao ?? row?.data_inspecao ?? '-');
                const material = String(row?.codigo_Material ?? row?.codigo_material ?? '-');
                const descricao = String(row?.descricao_Portug ?? row?.descricao_portug ?? '-');
                const lote = String(row?.codigo_Lote ?? row?.codigo_lote ?? '-');
                const situacao = getSituacaoLaudoLabel(row?.situacao_Laudo ?? row?.situacao_laudo ?? '-');
                const key = String(row?.num_Laudo ?? row?.num_laudo ?? `${material}-${lote}-${index}`);

                return (
                  <article key={`card-${key}`} className="module-card">
                    <div className="module-card__row">
                      <span>Data</span>
                      <strong>{data}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Produto</span>
                      <strong className="module-card__product-inline">
                        {material !== '-' && descricao !== '-' ? `${material} - ${descricao}` : material !== '-' ? material : descricao}
                      </strong>
                    </div>
                    <div className="module-card__row">
                      <span>Lote</span>
                      <strong>{lote}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Situação</span>
                      <strong>{situacao}</strong>
                    </div>

                    <div className="module-card__actions">
                      <button
                        type="button"
                        onClick={() => void abrirLaudo(row)}
                        aria-label="Abrir laudo"
                        title="Abrir laudo"
                      >
                        <IoCheckmarkDoneOutline size={16} />
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

      {novaFichaOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>Nova ficha de inspeção - {tipoLaudo.toLowerCase()}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setNovaFichaOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label>
                <span>Código lote</span>
                <div className="ficha-inspecao-field ficha-inspecao-field--clearable">
                  <input
                    className={novaFichaErrors.codigoLote ? 'module-input-error' : ''}
                    value={novaFicha.codigoLote}
                    onChange={(event) => {
                      setNovaFicha((prev) => ({ ...prev, codigoLote: event.target.value }));
                      if (novaFichaErrors.codigoLote) {
                        setNovaFichaErrors((prev) => ({ ...prev, codigoLote: undefined }));
                      }
                    }}
                  />
                  {novaFicha.codigoLote.trim() ? (
                    <button
                      type="button"
                      className="field-clear-button"
                      aria-label="Limpar código lote"
                      title="Limpar"
                      onClick={() => setNovaFicha((prev) => ({ ...prev, codigoLote: '' }))}
                    >
                      <IoCloseCircleOutline size={16} />
                    </button>
                  ) : null}
                </div>
                {novaFichaErrors.codigoLote ? <small className="module-field-error">{novaFichaErrors.codigoLote}</small> : null}
              </label>
              <label className={novaFichaErrors.dataInspecao ? 'ficha-inspecao-date-error' : ''}>
                <span>Data inspeção</span>
                <CustomDatePicker
                  value={novaFicha.dataInspecao}
                  onChange={(nextDate) => {
                    setNovaFicha((prev) => ({ ...prev, dataInspecao: nextDate }));
                    if (novaFichaErrors.dataInspecao) {
                      setNovaFichaErrors((prev) => ({ ...prev, dataInspecao: undefined }));
                    }
                  }}
                />
                {novaFichaErrors.dataInspecao ? <small className="module-field-error">{novaFichaErrors.dataInspecao}</small> : null}
              </label>
              <label>
                <span>Inspetor</span>
                <SearchableSelect
                  value={novaFicha.codigoInspetor}
                  onChange={(nextValue) => {
                    setNovaFicha((prev) => ({ ...prev, codigoInspetor: nextValue }));
                    if (novaFichaErrors.codigoInspetor) {
                      setNovaFichaErrors((prev) => ({ ...prev, codigoInspetor: undefined }));
                    }
                  }}
                  options={inspetorOptions}
                  ariaLabel="Inspetor"
                  searchPlaceholder="Pesquisar inspetor"
                  className={novaFichaErrors.codigoInspetor ? 'is-error' : undefined}
                />
                {novaFichaErrors.codigoInspetor ? <small className="module-field-error">{novaFichaErrors.codigoInspetor}</small> : null}
              </label>
              <label className="form-grid-3__full">
                <span>Observação</span>
                <div className="ficha-inspecao-field ficha-inspecao-field--clearable ficha-inspecao-field--textarea">
                  <textarea
                    className="ficha-inspecao-textarea"
                    value={novaFicha.observacao}
                    onChange={(event) => setNovaFicha((prev) => ({ ...prev, observacao: event.target.value }))}
                    rows={4}
                  />
                  {novaFicha.observacao.trim() ? (
                    <button
                      type="button"
                      className="field-clear-button"
                      aria-label="Limpar observação"
                      title="Limpar"
                      onClick={() => setNovaFicha((prev) => ({ ...prev, observacao: '' }))}
                    >
                      <IoCloseCircleOutline size={16} />
                    </button>
                  ) : null}
                </div>
              </label>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setNovaFichaOpen(false);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void salvarNovaFicha()} disabled={saving}>
                {saving ? 'Salvando...' : 'Abrir ficha'}
              </button>
            </div>
          </article>
        </section>
      )}

      {laudoOpen && selecionado && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide ficha-inspecao-laudo-modal">
            <header className="modal-card__header">
              <h2>Laudo de inspeção - {tipoLaudo.toLowerCase()}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setLaudoOpen(false);
                  setSelecionado(null);
                  setLaudoItens([]);
                  setItemState({});
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label>
                <span>Número laudo</span>
                <input value={String(selecionado?.num_Laudo ?? selecionado?.num_laudo ?? '-')} readOnly />
              </label>
              <label>
                <span>Lote</span>
                <input value={String(selecionado?.codigo_Lote ?? selecionado?.codigo_lote ?? '-')} readOnly />
              </label>
              <label>
                <span>Material</span>
                <input value={String(selecionado?.codigo_Material ?? selecionado?.codigo_material ?? '-')} readOnly />
              </label>
              <label>
                <span>Quantidade aprovada</span>
                <input
                  value={laudo.qtdAprovada}
                  onChange={(event) => setLaudo((prev) => ({ ...prev, qtdAprovada: event.target.value }))}
                />
              </label>
              <label>
                <span>Quantidade reprovada</span>
                <input
                  value={laudo.qtdReprovada}
                  onChange={(event) => setLaudo((prev) => ({ ...prev, qtdReprovada: event.target.value }))}
                />
              </label>
              <label>
                <span>Quantidade destruída</span>
                <input
                  value={laudo.qtdDestruida}
                  onChange={(event) => setLaudo((prev) => ({ ...prev, qtdDestruida: event.target.value }))}
                />
              </label>
              <label>
                <span>Inspetor</span>
                <SearchableSelect
                  value={laudo.codigoInspetor}
                  onChange={(nextValue) => setLaudo((prev) => ({ ...prev, codigoInspetor: nextValue }))}
                  options={inspetorOptions}
                  ariaLabel="Inspetor"
                  searchPlaceholder="Pesquisar inspetor"
                />
              </label>

              {tipoLaudo === 'Recebimento' ? (
                <>
                  <label>
                    <span>Motivo bloqueio</span>
                    <SearchableSelect
                      value={laudo.motivoBloqueio}
                      onChange={(nextValue) => setLaudo((prev) => ({ ...prev, motivoBloqueio: nextValue }))}
                      options={motivoBloqueioOptions}
                      ariaLabel="Motivo bloqueio"
                      searchPlaceholder="Pesquisar motivo bloqueio"
                    />
                  </label>
                  <label>
                    <span>Motivo sucata</span>
                    <SearchableSelect
                      value={laudo.motivoSucata}
                      onChange={(nextValue) => setLaudo((prev) => ({ ...prev, motivoSucata: nextValue }))}
                      options={motivoBloqueioOptions}
                      ariaLabel="Motivo sucata"
                      searchPlaceholder="Pesquisar motivo sucata"
                    />
                  </label>
                  <label>
                    <span>Demerito</span>
                    <SearchableSelect
                      value={laudo.motivoDemerito}
                      onChange={(nextValue) => setLaudo((prev) => ({ ...prev, motivoDemerito: nextValue }))}
                      options={motivoDemeritoOptions}
                      ariaLabel="Demerito"
                      searchPlaceholder="Pesquisar demérito"
                    />
                  </label>
                </>
              ) : null}

              <div className="form-grid-3__full">
                <span>Itens para apontamento</span>
                {laudoItensLoading ? (
                  <p className="module-empty">Carregando itens...</p>
                ) : laudoItens.length === 0 ? (
                  <p className="module-empty">Nenhum item de apontamento encontrado para este laudo.</p>
                ) : (
                  <div className="pedido-liberacao-itens-list ficha-inspecao-laudo-itens-list">
                    {laudoItens.map((item, index) => {
                      const state = itemState[String(item.numItem)] || { equipamento: '', resultado: 0 };
                      return (
                        <article className="pedido-liberacao-item-card ficha-inspecao-laudo-item-card" key={item.id || `laudo-item-${index}`}>
                          <div className="pedido-liberacao-item-row ficha-inspecao-laudo-item-card__header">
                            <h3 className="ficha-inspecao-laudo-item-card__title">Item {item.numItemExib || item.numItem}</h3>
                            <button
                              type="button"
                              className="secondary-button ficha-inspecao-laudo-item-card__measure-button"
                              onClick={() => void abrirMedicoes(item)}
                              disabled={!item.aceitaMedicoes}
                            >
                              <IoAddCircleOutline size={16} /> Medições
                            </button>
                          </div>

                          <p className="ficha-inspecao-laudo-item-card__description">{item.descricao}</p>

                          <div className="pedido-liberacao-item-row ficha-inspecao-laudo-item-card__fields">
                            <label className="ficha-inspecao-laudo-item-card__field">
                              <span>Equipamento</span>
                              <input
                                value={state.equipamento}
                                onChange={(event) => updateItemField(item.numItem, 'equipamento', event.target.value)}
                                placeholder="Equipamento"
                              />
                            </label>

                            <label className="ficha-inspecao-laudo-item-card__field">
                              <span>Resultado</span>
                              <SearchableSelect
                                value={String(state.resultado)}
                                onChange={(nextValue) => updateItemField(item.numItem, 'resultado', Number(nextValue || '0'))}
                                options={RESULTADO_OPTIONS}
                                ariaLabel={`Resultado item ${item.numItemExib || item.numItem}`}
                                searchPlaceholder="Pesquisar resultado"
                              />
                            </label>

                            <div className="ficha-inspecao-laudo-item-card__result-icon">{getResultadoIcon(state.resultado)}</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setLaudoOpen(false);
                  setSelecionado(null);
                  setLaudoItens([]);
                  setItemState({});
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="secondary-button" type="button" onClick={() => void salvarLaudo('Salvar')} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="primary-button" type="button" onClick={() => void salvarLaudo('Confirmar')} disabled={saving}>
                {saving ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </article>
        </section>
      )}

      {medicoesOpen && medicoesItem ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card ficha-inspecao-medicoes-modal">
            <header className="modal-card__header">
              <h2>Medições do item {medicoesItem.numItemExib || medicoesItem.numItem}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (savingMedicoes) return;
                  setMedicoesOpen(false);
                  setMedicoesItem(null);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="ficha-inspecao-medicoes-modal__input-row">
              <input
                className="ficha-inspecao-medicoes-modal__value-input"
                value={medicaoAtual}
                onChange={(event) => setMedicaoAtual(event.target.value)}
                placeholder="Valor"
              />
              <button
                className="secondary-button ficha-inspecao-medicoes-modal__add-button"
                type="button"
                onClick={() => {
                  const value = medicaoAtual.trim();
                  if (!value) return;
                  setMedicoesValores((prev) => [...prev, value]);
                  setMedicaoAtual('');
                }}
              >
                Adicionar
              </button>
            </div>

            <div className="ficha-inspecao-medicoes-modal__list-wrapper">
              <strong className="ficha-inspecao-medicoes-modal__list-title">Valores adicionados</strong>
              <div className="pedido-liberacao-itens-list ficha-inspecao-medicoes-modal__list">
              {medicoesValores.length === 0 ? (
                <p className="module-empty">Nenhuma medição informada.</p>
              ) : (
                medicoesValores.map((valor, index) => (
                  <div className="ficha-inspecao-medicoes-modal__chip" key={`medicao-${index}`}>
                    <strong>{valor}</strong>
                    <button
                      type="button"
                      className="icon-button ficha-inspecao-medicoes-modal__chip-remove"
                      aria-label="Remover medição"
                      onClick={() => setMedicoesValores((prev) => prev.filter((_, idx) => idx !== index))}
                    >
                      <IoCloseCircleOutline size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
            </div>

            <div className="form-actions ficha-inspecao-medicoes-modal__actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (savingMedicoes) return;
                  setMedicoesOpen(false);
                  setMedicoesItem(null);
                  setMedicoesValores(medicoesInicial);
                }}
                disabled={savingMedicoes}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void salvarMedicoes()} disabled={savingMedicoes}>
                {savingMedicoes ? 'Salvando...' : 'Salvar medições'}
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
