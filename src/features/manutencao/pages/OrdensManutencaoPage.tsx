import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  incluirOrdemManutCall,
  listOrdensManutCall,
  listaMaquinasCall,
  obterUsuariosTransacoesSistemaAcaoCall,
} from '../../../services/apiCalls';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type SelectOption = {
  value: string;
  label: string;
};

type FormErrors = {
  numIdent?: string;
  motivoAbertura?: string;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  situacao?: string;
};

type SortField = 'om' | 'maquina' | 'abertura' | 'prioridade';
type SortDirection = 'asc' | 'desc';

const PRIORIDADE_OPTIONS: SelectOption[] = [
  { value: '1', label: 'Baixa' },
  { value: '2', label: 'Média' },
  { value: '3', label: 'Alta' },
];

const SITUACAO_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todas' },
  { value: '0', label: 'Pendente' },
  { value: '1', label: 'Impresso' },
  { value: '2', label: 'Em execução' },
  { value: '6', label: 'Finalizada' },
  { value: '8', label: 'Encerrada' },
  { value: '9', label: 'Cancelada' },
];

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

const toMaquinaOptions = (rows: any[]): SelectOption[] => {
  return rows
    .map((row) => {
      const numIdent = String(row?.num_Ident ?? row?.num_ident ?? '').trim();
      const descricao = String(row?.descricao_Portug ?? row?.descricao_portug ?? '').trim();
      if (!numIdent) return null;
      return {
        value: numIdent,
        label: descricao ? `${numIdent} - ${descricao}` : numIdent,
      };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

const parseDateTimeForSort = (dateValue: any, timeValue: any) => {
  const dateMatch = String(dateValue ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!dateMatch) return 0;

  const timeMatch = String(timeValue ?? '')
    .trim()
    .match(/^(\d{2}):(\d{2})/);

  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const date = new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]), hour, minute, 0, 0);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const prioridadePeso = (value: any) => {
  const normalized = String(value ?? '').trim();
  if (normalized === '1') return 1;
  if (normalized === '2') return 2;
  if (normalized === '3') return 3;
  return 99;
};

const getSituacaoOrdemCodigo = (row: any) => {
  const raw = row?.situacao_Ordem ?? row?.situacao_ordem ?? row?.situacaoOrdem ?? row?.situacao ?? row?.status ?? '';
  const normalized = String(raw ?? '').trim();

  if (/^\d+$/.test(normalized)) return normalized;

  const text = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (text === 'pendente') return '0';
  if (text === 'impresso') return '1';
  if (text === 'em execucao') return '2';
  if (text === 'finalizada') return '6';
  if (text === 'encerrada') return '8';
  if (text === 'cancelada') return '9';

  return '';
};

const obterDescricaoSituacaoOrdemManut = (situacaoOrdem: any) => {
  const codigo = String(situacaoOrdem ?? '').trim();

  if (codigo === '0') return 'Pendente';
  if (codigo === '1') return 'Impresso';
  if (codigo === '2') return 'Em execução';
  if (codigo === '6') return 'Finalizada';
  if (codigo === '8') return 'Encerrada';
  if (codigo === '9') return 'Cancelada';
  return '';
};

const obterCodigoSituacaoOrdemManut = (situacaoOrdem: string) => {
  const normalized = String(situacaoOrdem ?? '').trim();

  if (!normalized) return 99;
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const text = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (text === 'pendente') return 0;
  if (text === 'impresso') return 1;
  if (text === 'em execucao') return 2;
  if (text === 'finalizada') return 6;
  if (text === 'encerrada') return 8;
  if (text === 'cancelada') return 9;
  if (text === 'todas') return 99;

  return 99;
};

const situacaoBadgeClass = (value: any) => {
  const codigo = String(value ?? '').trim();

  if (codigo === '0') return 'warning';
  if (codigo === '1') return 'info';
  if (codigo === '2') return 'muted';
  if (codigo === '6') return 'success';
  if (codigo === '8') return 'success';
  if (codigo === '9') return 'danger';
  return 'muted';
};

const prioridadeTextoClass = (value: any) => {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized === '1' || normalized === 'baixa') return 'success';
  if (normalized === '2' || normalized === 'media') return 'warning';
  if (normalized === '3' || normalized === 'alta') return 'danger';
  return 'muted';
};

export function OrdensManutencaoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [numOrdem, setNumOrdem] = useState('');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [situacao, setSituacao] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});

  const [rows, setRows] = useState<any[]>([]);

  const [maquinas, setMaquinas] = useState<SelectOption[]>([]);

  const [incluirOpen, setIncluirOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>('om');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const initialLoadRef = useRef(false);

  const [form, setForm] = useState({
    numIdent: '',
    motivoAbertura: '',
    prioridade: '1',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const ordemA = Number(a?.num_Ordem ?? a?.num_ordem ?? 0);
      const ordemB = Number(b?.num_Ordem ?? b?.num_ordem ?? 0);
      const maquinaA = `${String(a?.num_Ident ?? a?.num_ident ?? '-')} ${String(a?.descricao_Portug ?? a?.descricao_portug ?? '-')}`;
      const maquinaB = `${String(b?.num_Ident ?? b?.num_ident ?? '-')} ${String(b?.descricao_Portug ?? b?.descricao_portug ?? '-')}`;
      const aberturaA = parseDateTimeForSort(a?.data_Abertura ?? a?.data_abertura ?? '', a?.hora_Abertura ?? a?.hora_abertura ?? '');
      const aberturaB = parseDateTimeForSort(b?.data_Abertura ?? b?.data_abertura ?? '', b?.hora_Abertura ?? b?.hora_abertura ?? '');
      const prioridadeA = prioridadePeso(a?.prioridade);
      const prioridadeB = prioridadePeso(b?.prioridade);

      let comparison = 0;
      if (sortField === 'om') comparison = ordemA - ordemB;
      if (sortField === 'maquina') comparison = collator.compare(maquinaA, maquinaB);
      if (sortField === 'abertura') comparison = aberturaA - aberturaB;
      if (sortField === 'prioridade') comparison = prioridadeA - prioridadeB;

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => {
    const rowsComSituacaoBusca = rowsOrdenadas.map((row) => ({
      ...row,
      situacaoDescricaoBusca: obterDescricaoSituacaoOrdemManut(getSituacaoOrdemCodigo(row)),
    }));

    return filterListByTerm(rowsComSituacaoBusca, searchTerm);
  }, [rowsOrdenadas, searchTerm]);

  const totalOrdens = useMemo(() => rowsFiltradas.length, [rowsFiltradas]);

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

  const carregarMaquinas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) return;

    const resp = await listaMaquinasCall(baseUrl, token);
    setMaquinas(toMaquinaOptions(getRows(resp.jsonBody || resp.data)));
  }, []);

  const carregarOrdens = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listOrdensManutCall(baseUrl, token, {
        tipo: 2,
        codigoEmpresa,
        numOrdem,
        numIdent: '',
        dataInicio,
        dataFim,
        situacaoOrdem: obterCodigoSituacaoOrdemManut(situacao),
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar ordens de manutenção.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numOrdem, showToast, situacao]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temSituacao = Boolean(situacao.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temSituacao && !(temDataInicio && temDataFim)) {
      nextErrors.situacao = 'Para filtrar por Situação, informe Data início e Data fim.';
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Situação.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Situação.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregarOrdens();
  }, [carregarOrdens, dataFim, dataInicio, situacao]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarOrdens();
    void carregarMaquinas();
  }, [carregarMaquinas, carregarOrdens]);

  const abrirInclusao = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !usuario || !codigoEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const permissionResp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, '25', '13');
      if (!permissionResp.succeeded) {
        showToast('Você não possui permissão para incluir manutenção.', 'error');
        return;
      }

      setForm({
        numIdent: '',
        motivoAbertura: '',
        prioridade: '1',
      });
      setFormErrors({});
      setIncluirOpen(true);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar permissão para inclusão.', 'error');
    }
  };

  const salvarOrdem = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !usuario || !codigoEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    const nextErrors: FormErrors = {};
    if (!form.numIdent) {
      nextErrors.numIdent = 'Máquina é obrigatória.';
    }

    if (!form.motivoAbertura.trim()) {
      nextErrors.motivoAbertura = 'Motivo é obrigatório.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const resp = await incluirOrdemManutCall(baseUrl, token, {
        codigoEmpresa,
        numIdent: form.numIdent,
        abertoPor: usuario,
        motivoAbertura: form.motivoAbertura.trim(),
        prioridade: form.prioridade,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível incluir a ordem de manutenção.'), 'error');
        return;
      }

      showToast('Ordem de manutenção incluída com sucesso.', 'success');
      setIncluirOpen(false);
      await carregarOrdens();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir ordem de manutenção.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const prioridadeLabel = (value: any) => {
    const normalized = String(value ?? '').trim();
    if (normalized === '1') return 'Baixa';
    if (normalized === '2') return 'Média';
    if (normalized === '3') return 'Alta';
    return normalized || '-';
  };

  return (
    <main className="clientes-page list-layout-page ordens-manutencao-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Ordens de Manutenção</h1>
            <p>Consulta e abertura de ordens de manutenção.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel ordens-manutencao-panel">
        <div className="clientes-panel__top list-layout-panel__top ordens-manutencao-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalOrdens} encontrados</span>
          </div>

          <div className="list-layout-controls ordens-manutencao-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Ordens de Manutenção"
              placeholder="Pesquisar na lista de OMs"
              className="ordens-manutencao-search"
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
              onClick={() => void carregarOrdens()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => void abrirInclusao()}
              title="Nova OM"
              aria-label="Nova OM"
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
          <div className="list-layout-extra-filters ordens-manutencao-extra-filters">
            <label className="ordens-manutencao-field ordens-manutencao-field--date">
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
                className={`module-field-error ordens-manutencao-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' ordens-manutencao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>
            <label className="ordens-manutencao-field ordens-manutencao-field--date">
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
                className={`module-field-error ordens-manutencao-field__error-slot${
                  filtroErrors.dataFim ? '' : ' ordens-manutencao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="ordens-manutencao-field ordens-manutencao-field--situacao">
              <span>Situação</span>
              <SearchableSelect
                value={situacao}
                onChange={(nextValue) => {
                  setSituacao(nextValue);
                  if (filtroErrors.situacao) {
                    setFiltroErrors((prev) => ({ ...prev, situacao: undefined }));
                  }
                }}
                options={SITUACAO_FILTER_OPTIONS}
                ariaLabel="Situação"
                searchPlaceholder="Pesquisar situação"
                className={filtroErrors.situacao ? 'is-error' : undefined}
              />
              <small
                className={`module-field-error ordens-manutencao-field__error-slot${
                  filtroErrors.situacao ? '' : ' ordens-manutencao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.situacao || ' '}
              </small>
            </label>

            <div className="ordens-manutencao-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="ordens-manutencao-field ordens-manutencao-field--num ordens-manutencao-field--clearable">
              <span>Número OM</span>
              <div className="ordens-manutencao-field__input-wrap">
                <input value={numOrdem} onChange={(event) => setNumOrdem(event.target.value)} placeholder="Pesquisar número da OM" />
                {numOrdem.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da OM"
                    title="Limpar"
                    onClick={() => setNumOrdem('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small className="module-field-error ordens-manutencao-field__error-slot ordens-manutencao-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table ordens-manutencao-table">
        {loading ? (
          <p className="module-empty">Carregando ordens...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhuma ordem encontrada.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('om')}>
                      OM <span>{getSortIndicator('om')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('maquina')}>
                      Máquina <span>{getSortIndicator('maquina')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('abertura')}>
                      Abertura <span>{getSortIndicator('abertura')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('prioridade')}>
                      Prioridade <span>{getSortIndicator('prioridade')}</span>
                    </button>
                  </th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row, index) => (
                  <tr
                    key={`${row?.num_Ordem ?? row?.num_ordem ?? index}`}
                    className="module-row-clickable"
                    onClick={() => {
                      setSelecionado(row);
                      setDetalhesOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelecionado(row);
                        setDetalhesOpen(true);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td>{String(row?.num_Ordem ?? row?.num_ordem ?? '-')}</td>
                    <td>
                      {String(row?.num_Ident ?? row?.num_ident ?? '-')} -{' '}
                      {String(row?.descricao_Portug ?? row?.descricao_portug ?? '-')}
                    </td>
                    <td>
                      {String(row?.data_Abertura ?? row?.data_abertura ?? '-')} {String(row?.hora_Abertura ?? row?.hora_abertura ?? '')}
                    </td>
                    <td>
                      <span className={`ordens-manutencao-prioridade ordens-manutencao-prioridade--${prioridadeTextoClass(row?.prioridade)}`}>
                        {prioridadeLabel(row?.prioridade)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${situacaoBadgeClass(getSituacaoOrdemCodigo(row))}`}>
                        {obterDescricaoSituacaoOrdemManut(getSituacaoOrdemCodigo(row)) || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="module-cards">
              {rowsFiltradas.map((row, index) => (
                <article
                  key={`card-${row?.num_Ordem ?? row?.num_ordem ?? index}`}
                  className="module-card module-row-clickable"
                  onClick={() => {
                    setSelecionado(row);
                    setDetalhesOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelecionado(row);
                      setDetalhesOpen(true);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="ordens-manutencao-card-top">
                    <div className="module-card__row">
                      <span>OM</span>
                      <strong>{String(row?.num_Ordem ?? row?.num_ordem ?? '-')}</strong>
                    </div>
                    <div className="module-card__row ordens-manutencao-card-prioridade">
                      <span>Prioridade</span>
                      <strong>
                        <span className={`ordens-manutencao-prioridade ordens-manutencao-prioridade--${prioridadeTextoClass(row?.prioridade)}`}>
                          {prioridadeLabel(row?.prioridade)}
                        </span>
                      </strong>
                    </div>
                  </div>
                  <div className="module-card__row">
                    <span>Máquina</span>
                    <strong>
                      {String(row?.num_Ident ?? row?.num_ident ?? '-')} - {String(row?.descricao_Portug ?? row?.descricao_portug ?? '-')}
                    </strong>
                  </div>
                  <div className="module-card__row">
                    <span>Abertura</span>
                    <strong>
                      {String(row?.data_Abertura ?? row?.data_abertura ?? '-')} {String(row?.hora_Abertura ?? row?.hora_abertura ?? '')}
                    </strong>
                  </div>
                  <div className="module-card__row">
                    <span>Situação</span>
                    <strong>
                      <span className={`badge ${situacaoBadgeClass(getSituacaoOrdemCodigo(row))}`}>
                        {obterDescricaoSituacaoOrdemManut(getSituacaoOrdemCodigo(row)) || '-'}
                      </span>
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        </section>
      </section>

      {incluirOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>Nova ordem de manutenção</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setIncluirOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label className="form-grid-3__full">
                <span>Máquina</span>
                <SearchableSelect
                  value={form.numIdent}
                  onChange={(nextValue) => {
                    setForm((prev) => ({ ...prev, numIdent: nextValue }));
                    if (formErrors.numIdent) {
                      setFormErrors((prev) => ({ ...prev, numIdent: undefined }));
                    }
                  }}
                  options={[{ value: '', label: 'Selecione' }, ...maquinas]}
                  ariaLabel="Máquina"
                  searchPlaceholder="Pesquisar máquina"
                  className={formErrors.numIdent ? 'is-error' : undefined}
                />
                {formErrors.numIdent ? <small className="module-field-error">{formErrors.numIdent}</small> : null}
              </label>
              <label>
                <span>Prioridade</span>
                <SearchableSelect
                  value={form.prioridade}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, prioridade: nextValue }))}
                  options={PRIORIDADE_OPTIONS}
                  ariaLabel="Prioridade"
                  searchPlaceholder="Pesquisar prioridade"
                />
              </label>
              <label className="form-grid-3__full">
                <span>Motivo</span>
                <textarea
                  className={`ordens-manutencao-motivo${formErrors.motivoAbertura ? ' module-input-error' : ''}`}
                  rows={4}
                  value={form.motivoAbertura}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, motivoAbertura: event.target.value }));
                    if (formErrors.motivoAbertura) {
                      setFormErrors((prev) => ({ ...prev, motivoAbertura: undefined }));
                    }
                  }}
                  placeholder="Descreva o motivo da manutenção"
                />
                {formErrors.motivoAbertura ? <small className="module-field-error">{formErrors.motivoAbertura}</small> : null}
              </label>
            </div>

            <div className="form-actions ordens-manutencao-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setIncluirOpen(false);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void salvarOrdem()} disabled={saving}>
                {saving ? 'Salvando...' : 'Incluir OM'}
              </button>
            </div>
          </article>
        </section>
      )}

      {detalhesOpen && selecionado && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>Detalhes da OM</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setDetalhesOpen(false);
                  setSelecionado(null);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label>
                <span>Número OM</span>
                <input value={String(selecionado?.num_Ordem ?? selecionado?.num_ordem ?? '-')} readOnly />
              </label>
              <label>
                <span>Identificação</span>
                <input value={String(selecionado?.num_Ident ?? selecionado?.num_ident ?? '-')} readOnly />
              </label>
              <label>
                <span>Descrição máquina</span>
                <input value={String(selecionado?.descricao_Portug ?? selecionado?.descricao_portug ?? '-')} readOnly />
              </label>
              <label>
                <span>Abertura</span>
                <input
                  value={`${String(selecionado?.data_Abertura ?? selecionado?.data_abertura ?? '-')}`.trim()}
                  readOnly
                />
              </label>
              <label>
                <span>Hora abertura</span>
                <input value={String(selecionado?.hora_Abertura ?? selecionado?.hora_abertura ?? '-')} readOnly />
              </label>
              <label>
                <span>Prioridade</span>
                <input value={prioridadeLabel(selecionado?.prioridade)} readOnly />
              </label>
              <label>
                <span>Situação</span>
                <input value={obterDescricaoSituacaoOrdemManut(getSituacaoOrdemCodigo(selecionado)) || '-'} readOnly />
              </label>
              <label className="form-grid-3__full">
                <span>Motivo abertura</span>
                <input value={String(selecionado?.motivo_Abertura ?? selecionado?.motivo_abertura ?? '-')} readOnly />
              </label>
              <label className="form-grid-3__full">
                <span>Problema</span>
                <input value={String(selecionado?.problema ?? '-')} readOnly />
              </label>
              <label className="form-grid-3__full">
                <span>Ação</span>
                <input value={String(selecionado?.acao ?? '-')} readOnly />
              </label>
            </div>

            <div className="form-actions ordens-manutencao-detalhes-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDetalhesOpen(false);
                  setSelecionado(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
