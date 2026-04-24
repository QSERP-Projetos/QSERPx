import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCheckmarkDoneOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  finalizarApontamentoMaoDeObraCall,
  incluirApontamentoMaoDeObraCall,
  listApontamentoMaoDeObraCall,
  listaCentroTrabalhoCall,
  listaFuncionariosCall,
  obterUsuariosTransacoesSistemaAcaoCall,
} from '../../../services/apiCalls';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type SelectOption = { value: string; label: string };

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  codigoFuncionario?: string;
};

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
  if (Array.isArray(payload?.apontamentosMaoDeObra)) return payload.apontamentosMaoDeObra;
  if (Array.isArray(payload?.listaApontamentos)) return payload.listaApontamentos;
  if (Array.isArray(payload?.listaFuncionarios)) return payload.listaFuncionarios;
  if (Array.isArray(payload?.funcionarios)) return payload.funcionarios;
  if (Array.isArray(payload?.listaCentroTrabalho)) return payload.listaCentroTrabalho;
  if (Array.isArray(payload?.centrosTrabalho)) return payload.centrosTrabalho;
  return [];
};

const parseDateForSort = (dateValue: any) => {
  const dateMatch = String(dateValue ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!dateMatch) return 0;

  const date = new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const parseTimeForSort = (timeValue: any) => {
  const timeMatch = String(timeValue ?? '')
    .trim()
    .match(/^(\d{2}):(\d{2})/);

  if (!timeMatch) return 0;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
};

type SortField = 'os' | 'data' | 'inicio' | 'fim' | 'centroTrabalho' | 'funcionario' | 'situacao';
type SortDirection = 'asc' | 'desc';

const normalizeTipoApontamento = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isCronometroTipo = (value?: string) => {
  const normalized = normalizeTipoApontamento(value);
  return normalized === 'apontamento cronometro' || normalized === 'apontamento por cronometro';
};

export function ApontamentoMaoObraPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [searchTerm, setSearchTerm] = useState('');
  const [codigoFuncionario, setCodigoFuncionario] = useState('');
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('os');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [funcionarios, setFuncionarios] = useState<SelectOption[]>([]);
  const [centrosTrabalho, setCentrosTrabalho] = useState<SelectOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);

  const [form, setForm] = useState({
    numOS: '',
    numOperacao: '',
    codigoFuncionario: '',
    codigoCTrab: '',
    encerrarOS: false,
    dataServico: formatToday(),
    horaInicio: '',
    horaFim: '',
  });

  const [formConcluir, setFormConcluir] = useState({
    horaFim: '',
    encerrarOS: false,
  });
  const apontamentoCronometro = isCronometroTipo(GlobalConfig.getTipoApontMaoObra());

  const funcionarioOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...funcionarios], [funcionarios]);
  const centroTrabalhoOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...centrosTrabalho], [centrosTrabalho]);

  const funcionarioFilterOptions = useMemo(() => [{ value: '', label: 'Todos' }, ...funcionarios], [funcionarios]);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const osA = Number(a?.num_Ordem ?? a?.numOrdem ?? 0);
      const osB = Number(b?.num_Ordem ?? b?.numOrdem ?? 0);
      const dataA = parseDateForSort(a?.data_Servico ?? a?.dataServico ?? '');
      const dataB = parseDateForSort(b?.data_Servico ?? b?.dataServico ?? '');
      const inicioA = parseTimeForSort(a?.hora_Inicio ?? a?.horaInicio ?? '');
      const inicioB = parseTimeForSort(b?.hora_Inicio ?? b?.horaInicio ?? '');
      const fimA = parseTimeForSort(a?.hora_Fim ?? a?.horaFim ?? '');
      const fimB = parseTimeForSort(b?.hora_Fim ?? b?.horaFim ?? '');
      const centroA = String(a?.descricao_CTrab ?? a?.descricaoCTrab ?? '-');
      const centroB = String(b?.descricao_CTrab ?? b?.descricaoCTrab ?? '-');
      const funcionarioA = String(a?.nome_Func ?? a?.nomeFunc ?? '-');
      const funcionarioB = String(b?.nome_Func ?? b?.nomeFunc ?? '-');
      const situacaoA = (a?.apont_Concluido ?? a?.apontConcluido ?? false) ? 'Concluído' : 'Pendente';
      const situacaoB = (b?.apont_Concluido ?? b?.apontConcluido ?? false) ? 'Concluído' : 'Pendente';

      let comparison = 0;
      if (sortField === 'os') comparison = osA - osB;
      if (sortField === 'data') comparison = dataA - dataB;
      if (sortField === 'inicio') comparison = inicioA - inicioB;
      if (sortField === 'fim') comparison = fimA - fimB;
      if (sortField === 'centroTrabalho') comparison = collator.compare(centroA, centroB);
      if (sortField === 'funcionario') comparison = collator.compare(funcionarioA, funcionarioB);
      if (sortField === 'situacao') comparison = collator.compare(situacaoA, situacaoB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

  const totalApontamentos = useMemo(() => rowsFiltradas.length, [rowsFiltradas]);

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

  const carregarListas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !usuario) return;

    try {
      const [funcResp, ctrabResp] = await Promise.all([
        listaFuncionariosCall(baseUrl, token, usuario),
        listaCentroTrabalhoCall(baseUrl, token),
      ]);

      const funcRows = getRows(funcResp.jsonBody || funcResp.data);
      setFuncionarios(
        funcRows
          .map((item) => ({
            value: String(item?.num_Registro ?? item?.num_registro ?? item?.codigo_Funcionario ?? item?.codigo ?? '').trim(),
            label: String(item?.nome_Funcionario ?? item?.nome_funcionario ?? item?.nome_Func ?? item?.nome ?? '').trim(),
          }))
          .filter((item) => item.value && item.label),
      );

      const ctrabRows = getRows(ctrabResp.jsonBody || ctrabResp.data);
      setCentrosTrabalho(
        ctrabRows
          .map((item) => ({
            value: String(item?.codigo_CTrab ?? item?.codigo_ctrab ?? item?.codigo ?? '').trim(),
            label: String(item?.descricao_CTrab ?? item?.descricao_ctrab ?? item?.descricao ?? '').trim(),
          }))
          .filter((item) => item.value && item.label),
      );
    } catch {
      // telas seguem operando mesmo com falha de listas auxiliares
    }
  }, []);

  const carregar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const dataInicioFiltro = dataInicio.trim() || formatToday();
    const dataFimFiltro = dataFim.trim() || formatToday();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para consultar apontamentos.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listApontamentoMaoDeObraCall(baseUrl, token, {
        codigoEmpresa,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        codigoFuncionario,
        codigoCTrab: null,
        apenasPendentes,
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar apontamentos de mão de obra.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apenasPendentes, codigoFuncionario, dataFim, dataInicio, showToast]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temFuncionario = Boolean(codigoFuncionario.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temFuncionario && !(temDataInicio && temDataFim)) {
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Funcionário.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Funcionário.';

      if (temFuncionario) {
        nextErrors.codigoFuncionario = 'Para filtrar por Funcionário, informe Data início e Data fim.';
      }
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregar();
  }, [carregar, codigoFuncionario, dataFim, dataInicio]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
    void carregarListas();
  }, [carregar, carregarListas]);

  const handleSalvar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      showToast('Sessão inválida para inclusão de apontamento.', 'error');
      return;
    }

    if (!form.numOS || !form.numOperacao || !form.codigoFuncionario) {
      showToast('OS, operação e funcionário são obrigatórios.', 'error');
      return;
    }

    if (!form.dataServico || !form.horaInicio) {
      showToast('Data de serviço e hora início são obrigatórias.', 'error');
      return;
    }

    setSaving(true);
    try {
      const tipo = apontamentoCronometro ? 'Cronometro' : 'Padrao';
      const tipoApont = apontamentoCronometro ? 2 : 1;

      const resp = await incluirApontamentoMaoDeObraCall(baseUrl, token, tipo, {
        codigoEmpresa,
        numRegistro: form.codigoFuncionario,
        numOrdem: Number(form.numOS) || 0,
        numSequencia: Number(form.numOperacao) || 0,
        encerrarOS: form.encerrarOS,
        codigoCTrab: form.codigoCTrab,
        dataServico: form.dataServico,
        horaInicio: form.horaInicio,
        horaFim: apontamentoCronometro ? '' : form.horaFim,
        tipoApont,
        usuarioAtual: usuario,
        id: 0,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível incluir o apontamento.'), 'error');
        return;
      }

      showToast(
        apontamentoCronometro
          ? 'Apontamento incluído em modo cronômetro com sucesso.'
          : 'Apontamento incluído com sucesso.',
        'success',
      );
      setModalOpen(false);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir apontamento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const abrirConcluir = async (item: any) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !usuario) {
      showToast('Sessão inválida para concluir apontamento.', 'error');
      return;
    }

    const permissionResp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, '15', '22');
    if (!permissionResp.succeeded) {
      showToast('Você não possui permissão para concluir apontamentos.', 'error');
      return;
    }

    setItemSelecionado(item);
    setFormConcluir({
      horaFim: String(item?.hora_Fim ?? item?.horaFim ?? ''),
      encerrarOS: false,
    });
    setConcluirOpen(true);
  };

  const handleConcluir = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    const numOrdem = Number(itemSelecionado?.num_Ordem ?? itemSelecionado?.numOrdem ?? 0);
    const idApont = Number(itemSelecionado?.id_Apont ?? itemSelecionado?.idApont ?? itemSelecionado?.id ?? 0);

    if (!baseUrl || !token || !codigoEmpresa || !usuario || !numOrdem || !idApont || !formConcluir.horaFim) {
      showToast('Dados inválidos para concluir apontamento.', 'error');
      return;
    }

    setFinalizando(true);
    try {
      const resp = await finalizarApontamentoMaoDeObraCall(baseUrl, token, {
        codigoEmpresa,
        numOrdem,
        idApont,
        horaFim: formConcluir.horaFim,
        usuarioAtual: usuario,
        encerrarOS: formConcluir.encerrarOS,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível concluir o apontamento.'), 'error');
        return;
      }

      showToast('Apontamento concluído com sucesso.', 'success');
      setConcluirOpen(false);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao concluir apontamento.', 'error');
    } finally {
      setFinalizando(false);
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
            <h1>Apontamento de Mão de Obra</h1>
            <p>Consulta, inclusão e conclusão de apontamentos de mão de obra.</p>
            <p>Modo configurado: {apontamentoCronometro ? 'Cronômetro' : 'Normal'}</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalApontamentos} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Apontamento de Mão de Obra"
              placeholder="Pesquisar na lista de apontamentos"
              className="apontamento-mao-obra-search"
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
              onClick={() => setModalOpen(true)}
              title="Novo apontamento"
              aria-label="Novo apontamento"
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
          <div className="list-layout-extra-filters">
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
                className={`module-field-error apontamento-mao-obra-field-error-slot${
                  filtroErrors.dataInicio ? '' : ' apontamento-mao-obra-field-error-slot--empty'
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
                className={`module-field-error apontamento-mao-obra-field-error-slot${
                  filtroErrors.dataFim ? '' : ' apontamento-mao-obra-field-error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--lg">
              <span>Funcionário</span>
              <SearchableSelect
                value={codigoFuncionario}
                onChange={(nextValue) => {
                  setCodigoFuncionario(nextValue);
                  if (filtroErrors.codigoFuncionario) {
                    setFiltroErrors((prev) => ({ ...prev, codigoFuncionario: undefined }));
                  }
                }}
                options={funcionarioFilterOptions}
                searchPlaceholder="Pesquisar funcionário"
                ariaLabel="Funcionário"
              />
              <small
                className={`module-field-error apontamento-mao-obra-field-error-slot${
                  filtroErrors.codigoFuncionario ? '' : ' apontamento-mao-obra-field-error-slot--empty'
                }`}
              >
                {filtroErrors.codigoFuncionario || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--sm">
              <span>&nbsp;</span>
              <div className="list-layout-checkbox apontamento-mao-obra-pendentes-control">
                <span>Pendentes</span>
                <input
                  type="checkbox"
                  checked={apenasPendentes}
                  onChange={(event) => setApenasPendentes(event.target.checked)}
                  aria-label="Apenas pendentes"
                />
              </div>
              <small className="module-field-error apontamento-mao-obra-field-error-slot apontamento-mao-obra-field-error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando apontamentos...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhum apontamento encontrado.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('os')}>
                        OS <span>{getSortIndicator('os')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                        Data <span>{getSortIndicator('data')}</span>
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
                      <button className="module-table__sort" type="button" onClick={() => handleSort('centroTrabalho')}>
                        Centro de Trabalho <span>{getSortIndicator('centroTrabalho')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('funcionario')}>
                        Funcionário <span>{getSortIndicator('funcionario')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                        Situação <span>{getSortIndicator('situacao')}</span>
                      </button>
                    </th>
                    <th className="module-table__actions-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row, index) => {
                    const concluido = Boolean(row?.apont_Concluido ?? row?.apontConcluido ?? false);
                    const os = String(row?.num_Ordem ?? row?.numOrdem ?? '-');
                    const data = String(row?.data_Servico ?? row?.dataServico ?? '-');
                    const inicio = String(row?.hora_Inicio ?? row?.horaInicio ?? '-');
                    const fim = String(row?.hora_Fim ?? row?.horaFim ?? '-');
                    const centroTrabalho = String(row?.descricao_CTrab ?? row?.descricaoCTrab ?? '-');
                    const funcionarioNome = String(row?.nome_Func ?? row?.nomeFunc ?? '-');

                    return (
                      <tr key={`amo-${index}`}>
                        <td>{os}</td>
                        <td>{data}</td>
                        <td>{inicio}</td>
                        <td>{fim}</td>
                        <td>{centroTrabalho}</td>
                        <td>{funcionarioNome}</td>
                        <td>{concluido ? 'Concluído' : 'Pendente'}</td>
                        <td>
                          <div className="table-actions">
                            {!concluido && (
                              <button type="button" title="Concluir" onClick={() => void abrirConcluir(row)}>
                                <IoCheckmarkDoneOutline size={16} />
                              </button>
                            )}
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
                const concluido = Boolean(row?.apont_Concluido ?? row?.apontConcluido ?? false);
                const os = String(row?.num_Ordem ?? row?.numOrdem ?? '-');
                const data = String(row?.data_Servico ?? row?.dataServico ?? '-');
                const inicio = String(row?.hora_Inicio ?? row?.horaInicio ?? '-');
                const fim = String(row?.hora_Fim ?? row?.horaFim ?? '-');
                const centroTrabalho = String(row?.descricao_CTrab ?? row?.descricaoCTrab ?? '-');
                const funcionarioNome = String(row?.nome_Func ?? row?.nomeFunc ?? '-');

                return (
                  <article className="module-card" key={`card-amo-${index}`}>
                    <div className="module-card__row">
                      <span>OS</span>
                      <strong>{os}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Data</span>
                      <strong>{data}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Início</span>
                      <strong>{inicio}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Fim</span>
                      <strong>{fim}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Centro de Trabalho</span>
                      <strong>{centroTrabalho}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Funcionário</span>
                      <strong>{funcionarioNome}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Situação</span>
                      <strong>{concluido ? 'Concluído' : 'Pendente'}</strong>
                    </div>

                    {!concluido && (
                      <div className="module-card__actions">
                        <button type="button" title="Concluir" onClick={() => void abrirConcluir(row)}>
                          <IoCheckmarkDoneOutline size={16} />
                        </button>
                      </div>
                    )}
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
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>Novo apontamento de mão de obra ({apontamentoCronometro ? 'Cronômetro' : 'Normal'})</h2>
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
              <label>
                <span>Número OS *</span>
                <input value={form.numOS} onChange={(event) => setForm((prev) => ({ ...prev, numOS: event.target.value }))} />
              </label>
              <label>
                <span>Operação *</span>
                <input value={form.numOperacao} onChange={(event) => setForm((prev) => ({ ...prev, numOperacao: event.target.value }))} />
              </label>
              <label className="form-grid-3__full"></label>
              <label>
                <span>Funcionário *</span>
                <SearchableSelect
                  value={form.codigoFuncionario}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, codigoFuncionario: nextValue }))}
                  options={funcionarioOptions}
                  ariaLabel="Funcionário"
                  searchPlaceholder="Pesquisar funcionário"
                />
              </label>
              <label>
                <span>Centro trabalho</span>
                <SearchableSelect
                  value={form.codigoCTrab}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, codigoCTrab: nextValue }))}
                  options={centroTrabalhoOptions}
                  ariaLabel="Centro trabalho"
                  searchPlaceholder="Pesquisar centro trabalho"
                />
              </label>
              <label className="checkbox-field">
                <span>Encerrar OS</span>
                <input
                  type="checkbox"
                  checked={form.encerrarOS}
                  onChange={(event) => setForm((prev) => ({ ...prev, encerrarOS: event.target.checked }))}
                />
              </label>
              <label>
                <span>Data serviço *</span>
                <CustomDatePicker
                  value={form.dataServico}
                  onChange={(nextDate) => setForm((prev) => ({ ...prev, dataServico: nextDate }))}
                />
              </label>
              <label>
                <span>Hora início *</span>
                <CustomTimePicker value={form.horaInicio} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaInicio: nextValue }))} />
              </label>

              {apontamentoCronometro ? (
                <div className="form-grid-3__full">
                  <p className="module-empty">Modo cronômetro: informe início agora e conclua depois na ação Concluir.</p>
                </div>
              ) : (
                <label>
                  <span>Hora fim</span>
                  <CustomTimePicker value={form.horaFim} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaFim: nextValue }))} />
                </label>
              )}
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSalvar()} disabled={saving}>
                {saving ? 'Salvando...' : 'Incluir apontamento'}
              </button>
            </div>
          </article>
        </section>
      )}

      {concluirOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Concluir apontamento</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (finalizando) return;
                  setConcluirOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label className="form-grid-3__full">
                <span>Hora fim *</span>
                <CustomTimePicker
                  value={formConcluir.horaFim}
                  onChange={(nextValue) => setFormConcluir((prev) => ({ ...prev, horaFim: nextValue }))}
                />
              </label>
              <label className="checkbox-field form-grid-3__full">
                <span>Encerrar OS</span>
                <input
                  type="checkbox"
                  checked={formConcluir.encerrarOS}
                  onChange={(event) => setFormConcluir((prev) => ({ ...prev, encerrarOS: event.target.checked }))}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setConcluirOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleConcluir()} disabled={finalizando}>
                {finalizando ? 'Concluindo...' : 'Concluir'}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
