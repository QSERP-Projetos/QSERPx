import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  buscaOFCall,
  incluirPreparacaoMaquinaCall,
  listPreparacaoMaquinaCall,
  listaFuncionariosCall,
  listaMaquinasCall,
} from '../../../services/apiCalls';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const parseDateTimeForSort = (dateValue: any, timeValue: any) => {
  const dateText = String(dateValue ?? '').trim();
  const fullMatch = dateText.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s*-\s*(\d{2}):(\d{2})(?::\d{2})?)?$/);

  let day = 0;
  let month = 0;
  let year = 0;
  let embeddedHour = 0;
  let embeddedMinute = 0;

  if (fullMatch) {
    day = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    const rawYear = Number(fullMatch[3]);
    year = fullMatch[3].length === 2 ? 2000 + rawYear : rawYear;
    embeddedHour = fullMatch[4] ? Number(fullMatch[4]) : 0;
    embeddedMinute = fullMatch[5] ? Number(fullMatch[5]) : 0;
  } else {
    const parsed = new Date(dateText);
    if (!Number.isFinite(parsed.getTime())) return 0;

    day = parsed.getDate();
    month = parsed.getMonth() + 1;
    year = parsed.getFullYear();
    embeddedHour = parsed.getHours();
    embeddedMinute = parsed.getMinutes();
  }

  const timeMatch = String(timeValue ?? '').trim().match(/^(\d{2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : embeddedHour;
  const minute = timeMatch ? Number(timeMatch[2]) : embeddedMinute;

  const date = new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
  );

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

type SortField = 'ordem' | 'operacao' | 'maquina' | 'situacao' | 'inicio' | 'fim' | 'usuario';
type SortDirection = 'asc' | 'desc';
type SelectOption = { value: string; label: string };
type FormErrors = {
  numOrdem?: string;
  numOperacao?: string;
};
type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  numMaquina?: string;
  situacaoApont?: string;
};

const SITUACAO_APONT_OPTIONS: SelectOption[] = [
  { value: '99', label: 'Todas' },
  { value: '1', label: 'Aberta' },
  { value: '2', label: 'Impressa' },
  { value: '7', label: 'Suspensa' },
  { value: '8', label: 'Encerrada' },
  { value: '9', label: 'Cancelada' },
];

const getSituacaoApontLabel = (situacaoValue: any) => {
  const code = Number(situacaoValue);
  if (code === 1) return 'Aberta';
  if (code === 2) return 'Impressa';
  if (code === 7) return 'Suspensa';
  if (code === 8) return 'Encerrada';
  if (code === 9) return 'Cancelada';
  return '-';
};

const formatDateLabel = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';

  const shortDateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (shortDateMatch) {
    return `${shortDateMatch[1]}/${shortDateMatch[2]}/20${shortDateMatch[3]}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  return text;
};

const splitDateTimeValue = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return { date: '', time: '' };

  const match = text.match(/^(\d{2}\/\d{2}\/\d{2,4})(?:\s*-\s*(\d{2}:\d{2})(?::\d{2})?)?$/);
  if (!match) {
    return { date: formatDateLabel(text), time: '' };
  }

  return {
    date: formatDateLabel(match[1]),
    time: match[2] || '',
  };
};

const resolvePreparacaoListRow = (row: any) => {
  const inicioDataHora = splitDateTimeValue(
    getFirstFilledValue(row, ['dataHoraInicSetup', 'dataHora_InicSetup', 'dataHoraInicioSetup']),
  );
  const fimDataHora = splitDateTimeValue(
    getFirstFilledValue(row, ['dataHpraFimSetup', 'dataHoraFimSetup', 'dataHora_FimSetup']),
  );

  return {
    ordem: String(getFirstFilledValue(row, ['num_Ordem', 'Num_Ordem']) ?? '-'),
    operacao: String(getFirstFilledValue(row, ['num_Operacao', 'Num_Operacao']) ?? '-'),
    maquina: String(getFirstFilledValue(row, ['num_Maquina', 'Num_Maquina']) ?? '-'),
    inicioData:
      inicioDataHora.date || formatDateLabel(getFirstFilledValue(row, ['data_Inicio', 'Data_Inicio', 'data_Apont', 'Data_Apont'])),
    inicioHora: inicioDataHora.time || String(getFirstFilledValue(row, ['hora_Inicio', 'Hora_Inicio']) ?? '').trim(),
    fimData: fimDataHora.date || formatDateLabel(getFirstFilledValue(row, ['data_Fim', 'Data_Fim', 'data_Apont', 'Data_Apont'])),
    fimHora: fimDataHora.time || String(getFirstFilledValue(row, ['hora_Fim', 'Hora_Fim']) ?? '').trim(),
    usuario: String(getFirstFilledValue(row, ['nome_Func', 'nomeFunc', 'usuario', 'Usuario']) ?? '-'),
    situacaoCodigo: Number(getFirstFilledValue(row, ['situacao_Apont', 'Situacao_Apont']) ?? 0),
  };
};

const toMaquinaOptions = (payload: any): SelectOption[] => {
  const rows = getRows(payload);

  return rows
    .map((row) => {
      const value = String(row?.num_Ident ?? row?.num_ident ?? row?.num_Maquina ?? row?.num_maquina ?? '').trim();
      const descricao = String(row?.desc_Maquinas ?? row?.desc_maquinas ?? row?.descricao ?? row?.descricao_Maquina ?? '').trim();

      if (!value) return null;
      return {
        value,
        label: descricao ? `${value} - ${descricao}` : value,
      };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

const toFuncionarioOptions = (payload: any): SelectOption[] => {
  const rows = getRows(payload);

  return rows
    .map((row) => {
      const value = String(
        row?.num_Registro ?? row?.num_registro ?? row?.codigo_Funcionario ?? row?.codigo_funcionario ?? row?.codigo ?? '',
      ).trim();
      const label = String(
        row?.nome_Func ?? row?.nome_func ?? row?.nome_Funcionario ?? row?.nome_funcionario ?? row?.nome ?? '',
      ).trim();

      if (!value) return null;
      return { value, label: label || value };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

export function PreparacaoMaquinaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [maquinas, setMaquinas] = useState<SelectOption[]>([]);
  const [funcionarios, setFuncionarios] = useState<SelectOption[]>([]);

  const [numOrdem, setNumOrdem] = useState('');
  const [numMaquina, setNumMaquina] = useState('');
  const [situacaoApont, setSituacaoApont] = useState('99');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [expandedPreparacaoCards, setExpandedPreparacaoCards] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('ordem');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    numOrdem: '',
    numMaquina: '',
    numOperacao: '',
    numRegistro: '',
    dataInicio: formatToday(),
    horaInicio: '',
    dataFim: formatToday(),
    horaFim: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [codigoProduto, setCodigoProduto] = useState('');
  const [descricaoPortugues, setDescricaoPortugues] = useState('');

  const maquinaOptions = useMemo<SelectOption[]>(() => [{ value: '', label: 'Selecione' }, ...maquinas], [maquinas]);
  const situacaoApontOptions = useMemo<SelectOption[]>(() => SITUACAO_APONT_OPTIONS, []);
  const funcionarioOptions = useMemo<SelectOption[]>(() => [{ value: '', label: 'Selecione' }, ...funcionarios], [funcionarios]);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const rowA = resolvePreparacaoListRow(a);
      const rowB = resolvePreparacaoListRow(b);

      const ordemA = Number(rowA.ordem || 0);
      const ordemB = Number(rowB.ordem || 0);
      const operacaoA = Number(rowA.operacao || 0);
      const operacaoB = Number(rowB.operacao || 0);
      const maquinaA = rowA.maquina;
      const maquinaB = rowB.maquina;
      const situacaoA = rowA.situacaoCodigo;
      const situacaoB = rowB.situacaoCodigo;
      const inicioA = parseDateTimeForSort(rowA.inicioData, rowA.inicioHora);
      const inicioB = parseDateTimeForSort(rowB.inicioData, rowB.inicioHora);
      const fimA = parseDateTimeForSort(rowA.fimData, rowA.fimHora);
      const fimB = parseDateTimeForSort(rowB.fimData, rowB.fimHora);
      const usuarioA = rowA.usuario;
      const usuarioB = rowB.usuario;

      let comparison = 0;
      if (sortField === 'ordem') comparison = ordemA - ordemB;
      if (sortField === 'operacao') comparison = operacaoA - operacaoB;
      if (sortField === 'maquina') comparison = collator.compare(maquinaA, maquinaB);
      if (sortField === 'situacao') comparison = situacaoA - situacaoB;
      if (sortField === 'inicio') comparison = inicioA - inicioB;
      if (sortField === 'fim') comparison = fimA - fimB;
      if (sortField === 'usuario') comparison = collator.compare(usuarioA, usuarioB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

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

  const carregar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para consultar preparação de máquina.', 'error');
      return;
    }

    setLoading(true);
    try {
      const [prepResp, maqResp] = await Promise.all([
        listPreparacaoMaquinaCall(baseUrl, token, {
          codigoEmpresa,
          numOrdem,
          dataInicio: dataInicio.trim() || formatToday(),
          dataFim: dataFim.trim() || formatToday(),
          numMaquina,
          situacaoOF: Number(situacaoApont || '99') || 99,
          usuario: GlobalConfig.getUsuario(),
        }),
        listaMaquinasCall(baseUrl, token),
      ]);

      setRows(getRows(prepResp.jsonBody || prepResp.data));
      setMaquinas(toMaquinaOptions(maqResp.jsonBody || maqResp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar preparação de máquina.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numMaquina, numOrdem, showToast, situacaoApont]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temMaquina = Boolean(numMaquina.trim());
    const temSituacao = situacaoApont.trim() !== '' && situacaoApont !== '99';
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if ((temMaquina || temSituacao) && !(temDataInicio && temDataFim)) {
      if (temMaquina) {
        nextErrors.numMaquina = 'Para filtrar por Máquina, informe Data início e Data fim.';
      }
      if (temSituacao) {
        nextErrors.situacaoApont = 'Para filtrar por Situação, informe Data início e Data fim.';
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
    void carregar();
  }, [carregar, dataFim, dataInicio, numMaquina, situacaoApont]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  const carregarFuncionariosModal = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !usuario) return;

    try {
      const funcResp = await listaFuncionariosCall(baseUrl, token, usuario);
      const funcionariosPayload =
        (funcResp.jsonBody as any)?.listaFuncionarios ??
        (funcResp.data as any)?.listaFuncionarios ??
        funcResp.jsonBody ??
        funcResp.data;

      setFuncionarios(toFuncionarioOptions(funcionariosPayload));
    } catch {
      setFuncionarios([]);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    void carregarFuncionariosModal();
  }, [carregarFuncionariosModal, modalOpen]);

  const handleBlurOF = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const ordem = form.numOrdem.trim();

    if (!baseUrl || !token || !codigoEmpresa || !ordem) return;

    try {
      const resp = await buscaOFCall(baseUrl, token, codigoEmpresa, ordem);

      if (!resp.succeeded) {
        setCodigoProduto('');
        setDescricaoPortugues('');
        showToast(getApiErrorMessage(resp, 'OF inválida.'), 'error');
        return;
      }

      const list = getRows(resp.jsonBody || resp.data);
      const data = list[0] ?? resp.jsonBody ?? resp.data;

      const produto = String(
        getFirstFilledValue(data, ['codigoProduto', 'codigo_produto', 'codigo_Produto', 'codigo_Prod']) ?? '',
      ).trim();
      const descricao = String(
        getFirstFilledValue(data, [
          'descricaoPortug',
          'descricao_portug',
          'descricao_Portug',
          'descricao_Produto',
          'descricao_produto',
          'descricao_Item',
        ]) ?? '',
      ).trim();

      setCodigoProduto(produto);
      setDescricaoPortugues(descricao);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar OF.', 'error');
    }
  }, [form.numOrdem, showToast]);

  const handleSalvar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para inclusão de preparação.', 'error');
      return;
    }

    const nextErrors: FormErrors = {};
    if (!form.numOrdem.trim()) {
      nextErrors.numOrdem = 'Número da OF é obrigatório.';
    }
    if (!form.numOperacao.trim()) {
      nextErrors.numOperacao = 'Operação é obrigatória.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const resp = await incluirPreparacaoMaquinaCall(baseUrl, token, {
        codigoEmpresa,
        numOrdem: form.numOrdem,
        numOperacao: Number(form.numOperacao) || 0,
        dataInicSetup: form.dataInicio,
        horaInicSetup: form.horaInicio,
        dataFimSetup: form.dataFim,
        horaFimSetup: form.horaFim,
        numRegistro: form.numRegistro,
        numMaquina: form.numMaquina,
        usuario: GlobalConfig.getUsuario(),
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Falha ao incluir preparação de máquina.'), 'error');
        return;
      }

      showToast('Preparação de máquina incluída com sucesso.', 'success');
      setModalOpen(false);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir preparação de máquina.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Preparação de Máquina</h1>
            <p>Consulta e inclusão de preparação de máquinas.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{rowsFiltradas.length} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Preparação de Máquina"
              placeholder="Pesquisar na lista de preparações"
              className="preparacao-maquina-search"
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
              onClick={() => void carregar()}
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
                setForm({
                  numOrdem: '',
                  numMaquina: '',
                  numOperacao: '',
                  numRegistro: '',
                  dataInicio: formatToday(),
                  horaInicio: '',
                  dataFim: formatToday(),
                  horaFim: '',
                });
                setFormErrors({});
                setCodigoProduto('');
                setDescricaoPortugues('');
                setModalOpen(true);
              }}
              title="Incluir"
              aria-label="Incluir"
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
          <div className="list-layout-extra-filters preparacao-maquina-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
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
                className={`module-field-error preparacao-maquina-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' preparacao-maquina-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>
            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
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
                className={`module-field-error preparacao-maquina-field__error-slot${
                  filtroErrors.dataFim ? '' : ' preparacao-maquina-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Máquina</span>
              <SearchableSelect
                value={numMaquina}
                onChange={(nextValue) => {
                  setNumMaquina(nextValue);
                  if (filtroErrors.numMaquina) {
                    setFiltroErrors((prev) => ({ ...prev, numMaquina: undefined }));
                  }
                }}
                options={maquinaOptions}
                ariaLabel="Máquina"
                searchPlaceholder="Pesquisar máquina"
                className={filtroErrors.numMaquina ? 'is-error' : undefined}
              />
              <small
                className={`module-field-error preparacao-maquina-field__error-slot${
                  filtroErrors.numMaquina ? '' : ' preparacao-maquina-field__error-slot--empty'
                }`}
              >
                {filtroErrors.numMaquina || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Situação</span>
              <SearchableSelect
                value={situacaoApont}
                onChange={(nextValue) => {
                  setSituacaoApont(nextValue || '99');
                  if (filtroErrors.situacaoApont) {
                    setFiltroErrors((prev) => ({ ...prev, situacaoApont: undefined }));
                  }
                }}
                options={situacaoApontOptions}
                ariaLabel="Situação do apontamento"
                searchPlaceholder="Pesquisar situação"
                className={filtroErrors.situacaoApont ? 'is-error' : undefined}
              />
              <small
                className={`module-field-error preparacao-maquina-field__error-slot${
                  filtroErrors.situacaoApont ? '' : ' preparacao-maquina-field__error-slot--empty'
                }`}
              >
                {filtroErrors.situacaoApont || ' '}
              </small>
            </label>

            <div className="preparacao-maquina-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número ordem</span>
              <div className="preparacao-maquina-field__input-wrap">
                <input value={numOrdem} onChange={(event) => setNumOrdem(event.target.value)} placeholder="Pesquisar número da ordem" />
                {numOrdem.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da ordem"
                    title="Limpar"
                    onClick={() => setNumOrdem('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small className="module-field-error preparacao-maquina-field__error-slot preparacao-maquina-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando preparações...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhuma preparação encontrada.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('ordem')}>
                        Ordem <span>{getSortIndicator('ordem')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('operacao')}>
                        Operação <span>{getSortIndicator('operacao')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('maquina')}>
                        Máquina <span>{getSortIndicator('maquina')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                        Situação <span>{getSortIndicator('situacao')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('inicio')}>
                        Início <span>{getSortIndicator('inicio')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('fim')}>
                        Fim <span>{getSortIndicator('fim')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('usuario')}>
                        Usuário <span>{getSortIndicator('usuario')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row, index) => {
                    const current = resolvePreparacaoListRow(row);
                    const situacao = getSituacaoApontLabel(current.situacaoCodigo);

                    return (
                      <tr key={`prep-${index}`}>
                        <td>{current.ordem}</td>
                        <td>{current.operacao}</td>
                        <td>{current.maquina}</td>
                        <td>{situacao}</td>
                        <td>
                          {current.inicioData} {current.inicioHora}
                        </td>
                        <td>
                          {current.fimData} {current.fimHora}
                        </td>
                        <td>{current.usuario}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="module-cards">
              {rowsFiltradas.map((row, index) => {
                const current = resolvePreparacaoListRow(row);
                const situacao = getSituacaoApontLabel(current.situacaoCodigo);
                const cardKey = `${current.ordem || `idx-${index}`}-${current.maquina}`;
                const isExpandedCard = Boolean(expandedPreparacaoCards[cardKey]);

                return (
                  <article className="module-card" key={`card-prep-${index}`}>
                    <div className="module-card__row module-card__row--split">
                      <div className="module-card__row-stack">
                        <span>Ordem</span>
                        <strong>{current.ordem}</strong>
                      </div>
                      <button
                        type="button"
                        className="module-card__expand-toggle"
                        onClick={() =>
                          setExpandedPreparacaoCards((prev) => ({
                            ...prev,
                            [cardKey]: !prev[cardKey],
                          }))
                        }
                        aria-label={isExpandedCard ? 'Recolher detalhes da preparação' : 'Expandir detalhes da preparação'}
                        title={isExpandedCard ? 'Recolher detalhes' : 'Expandir detalhes'}
                      >
                        {isExpandedCard ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                      </button>
                    </div>

                    <div className="module-card__row">
                      <span>Máquina</span>
                      <strong>{current.maquina}</strong>
                    </div>

                    {isExpandedCard ? (
                      <>
                        <div className="module-card__row">
                          <span>Operação</span>
                          <strong>{current.operacao}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Situação</span>
                          <strong>{situacao}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Início</span>
                          <strong>
                            {current.inicioData} {current.inicioHora}
                          </strong>
                        </div>
                        <div className="module-card__row">
                          <span>Fim</span>
                          <strong>
                            {current.fimData} {current.fimHora}
                          </strong>
                        </div>
                        <div className="module-card__row">
                          <span>Usuário</span>
                          <strong>{current.usuario}</strong>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
        </section>
      </section>

      {modalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide preparacao-maquina-modal">
            <header className="modal-card__header">
              <h2>Nova preparação de máquina</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setModalOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <div className="form-grid-3__full preparacao-maquina-modal__of-row">
                <label className="preparacao-maquina-modal__of-field">
                  <span>Número da OF</span>
                  <div className="pcp-modal-field pcp-modal-field--clearable">
                    <input
                      className={formErrors.numOrdem ? 'module-input-error' : ''}
                      value={form.numOrdem}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, numOrdem: event.target.value }));
                        if (formErrors.numOrdem) setFormErrors((prev) => ({ ...prev, numOrdem: undefined }));
                        setCodigoProduto('');
                        setDescricaoPortugues('');
                      }}
                      onBlur={() => {
                        void handleBlurOF();
                      }}
                      aria-label="Número da OF"
                    />
                    {form.numOrdem.trim() ? (
                      <button
                        type="button"
                        className="field-clear-button"
                        aria-label="Limpar número da ordem"
                        title="Limpar"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, numOrdem: '' }));
                          setCodigoProduto('');
                          setDescricaoPortugues('');
                        }}
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                  {formErrors.numOrdem ? <small className="module-field-error">{formErrors.numOrdem}</small> : null}
                </label>

                <label>
                  <span>Operação *</span>
                  <div className="pcp-modal-field pcp-modal-field--clearable">
                    <input
                      className={formErrors.numOperacao ? 'module-input-error' : ''}
                      value={form.numOperacao}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, numOperacao: event.target.value }));
                        if (formErrors.numOperacao) setFormErrors((prev) => ({ ...prev, numOperacao: undefined }));
                      }}
                    />
                    {form.numOperacao.trim() ? (
                      <button
                        type="button"
                        className="field-clear-button"
                        aria-label="Limpar operação"
                        title="Limpar"
                        onClick={() => setForm((prev) => ({ ...prev, numOperacao: '' }))}
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                  {formErrors.numOperacao ? <small className="module-field-error">{formErrors.numOperacao}</small> : null}
                </label>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Código Produto</span>
                <strong>{codigoProduto || '-'}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Descrição em Português</span>
                <strong>{descricaoPortugues || '-'}</strong>
              </div>

              <div className="form-grid-3__full preparacao-maquina-modal__maquina-func-row">
                <label>
                  <span>Máquina</span>
                  <SearchableSelect
                    value={form.numMaquina}
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, numMaquina: nextValue }))}
                    options={maquinaOptions}
                    ariaLabel="Máquina"
                    searchPlaceholder="Pesquisar máquina"
                  />
                </label>

                <label>
                  <span>Funcionário</span>
                  <SearchableSelect
                    value={form.numRegistro}
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, numRegistro: nextValue }))}
                    options={funcionarioOptions}
                    ariaLabel="Funcionário"
                    searchPlaceholder="Pesquisar funcionário"
                  />
                </label>
              </div>

              <label>
                <span>Data início</span>
                <CustomDatePicker
                  value={form.dataInicio}
                  onChange={(nextDate) => setForm((prev) => ({ ...prev, dataInicio: nextDate }))}
                />
              </label>
              <label>
                <span>Hora início</span>
                <CustomTimePicker value={form.horaInicio} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaInicio: nextValue }))} />
              </label>
              <label>
                <span>Data fim</span>
                <CustomDatePicker
                  value={form.dataFim}
                  onChange={(nextDate) => setForm((prev) => ({ ...prev, dataFim: nextDate }))}
                />
              </label>
              <label>
                <span>Hora fim</span>
                <CustomTimePicker value={form.horaFim} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaFim: nextValue }))} />
              </label>
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSalvar()} disabled={saving}>
                {saving ? 'Salvando...' : 'Incluir preparação'}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
