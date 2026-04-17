import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  incluirOrdemServicoCall,
  listOrdensServicosCall,
  buscaMaterialCall,
  listaCentroCustoCall,
  listaClientesV1Call,
  listaTipoOrdemServicoCall,
  listaUnidadeMedidaCall,
} from '../../../services/apiCalls';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type SelectOption = { value: string; label: string };
type MaterialItem = { codigo: string; descricao: string };

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
  if (Array.isArray(payload?.ordensServico)) return payload.ordensServico;
  if (Array.isArray(payload?.listaOrdensServico)) return payload.listaOrdensServico;
  if (Array.isArray(payload?.listaTipoOrdemServico)) return payload.listaTipoOrdemServico;
  if (Array.isArray(payload?.tiposOrdemServico)) return payload.tiposOrdemServico;
  if (Array.isArray(payload?.listaCentroCusto)) return payload.listaCentroCusto;
  if (Array.isArray(payload?.centrosCusto)) return payload.centrosCusto;
  if (Array.isArray(payload?.listaClientes)) return payload.listaClientes;
  if (Array.isArray(payload?.clientes)) return payload.clientes;
  if (Array.isArray(payload?.listaUnidadeMedida)) return payload.listaUnidadeMedida;
  if (Array.isArray(payload?.unidades)) return payload.unidades;
  if (Array.isArray(payload?.listaMateriais)) return payload.listaMateriais;
  if (Array.isArray(payload?.materiais)) return payload.materiais;
  return [];
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

  const date = new Date(
    Number(dateMatch[3]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[1]),
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
  );

  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

type SortField = 'os' | 'abertura' | 'cliente' | 'tipo' | 'centroCusto' | 'situacao';
type SortDirection = 'asc' | 'desc';
type FormErrors = {
  descricaoServico?: string;
  qtdServico?: string;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  numIdent?: string;
};

const createInitialForm = () => ({
  tipoOrdem: '',
  centroCusto: '',
  codigoCliente: '',
  descricaoServico: '',
  qtdServico: '',
  unidMedida: '',
  identEquipamento: '',
  codigoProduto: '',
  dataInicioPrev: formatToday(),
  dataFimPrev: formatToday(),
});

const toOptions = (list: any[], candidates: Array<[string, string]>): SelectOption[] => {
  return list
    .map((item) => {
      let value = '';
      let label = '';

      for (const [valueKey, labelKey] of candidates) {
        if (!value) value = String(item?.[valueKey] ?? '');
        if (!label) label = String(item?.[labelKey] ?? '');
      }

      value = value.trim();
      label = label.trim();
      if (!value || !label) return null;

      return { value, label };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

export function OrdensServicoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [numOrdem, setNumOrdem] = useState('');
  const [numIdent, setNumIdent] = useState('');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [sortField, setSortField] = useState<SortField>('os');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [materialFiltroCodDesc, setMaterialFiltroCodDesc] = useState('');
  const [materialBuscaRealizada, setMaterialBuscaRealizada] = useState(false);
  const [materiais, setMateriais] = useState<MaterialItem[]>([]);
  const [tiposServico, setTiposServico] = useState<SelectOption[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<SelectOption[]>([]);
  const [clientes, setClientes] = useState<SelectOption[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<SelectOption[]>([]);

  const [form, setForm] = useState(createInitialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const tipoOrdemOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...tiposServico], [tiposServico]);
  const centroCustoOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...centrosCusto], [centrosCusto]);
  const clienteOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...clientes], [clientes]);
  const unidadeOptions = useMemo(() => [{ value: '', label: 'Selecione' }, ...unidadesMedida], [unidadesMedida]);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const osA = Number(a?.num_Ordem ?? a?.numOrdem ?? 0);
      const osB = Number(b?.num_Ordem ?? b?.numOrdem ?? 0);
      const aberturaA = parseDateTimeForSort(a?.data_Abertura ?? a?.dataAbertura ?? '', a?.hora_Abertura ?? a?.horaAbertura ?? '');
      const aberturaB = parseDateTimeForSort(b?.data_Abertura ?? b?.dataAbertura ?? '', b?.hora_Abertura ?? b?.horaAbertura ?? '');
      const clienteA = String(a?.nome_Fantasia ?? a?.nomeFantasia ?? '-');
      const clienteB = String(b?.nome_Fantasia ?? b?.nomeFantasia ?? '-');
      const tipoA = String(a?.descricao_Tipo ?? a?.descricaoTipo ?? '-');
      const tipoB = String(b?.descricao_Tipo ?? b?.descricaoTipo ?? '-');
      const centroA = String(a?.descricao_CCusto ?? a?.descricaoCCusto ?? '-');
      const centroB = String(b?.descricao_CCusto ?? b?.descricaoCCusto ?? '-');
      const situacaoA = String(a?.situacaoOS ?? a?.situacao_Os ?? a?.situacao ?? '-');
      const situacaoB = String(b?.situacaoOS ?? b?.situacao_Os ?? b?.situacao ?? '-');

      let comparison = 0;
      if (sortField === 'os') comparison = osA - osB;
      if (sortField === 'abertura') comparison = aberturaA - aberturaB;
      if (sortField === 'cliente') comparison = collator.compare(clienteA, clienteB);
      if (sortField === 'tipo') comparison = collator.compare(tipoA, tipoB);
      if (sortField === 'centroCusto') comparison = collator.compare(centroA, centroB);
      if (sortField === 'situacao') comparison = collator.compare(situacaoA, situacaoB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

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

  const carregarListas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) return;

    try {
      const [tipoResp, centroResp, clienteResp, unidadeResp] = await Promise.all([
        listaTipoOrdemServicoCall(baseUrl, token),
        listaCentroCustoCall(baseUrl, token),
        listaClientesV1Call(baseUrl, token),
        listaUnidadeMedidaCall(baseUrl, token),
      ]);

      setTiposServico(
        toOptions(getRows(tipoResp.jsonBody || tipoResp.data), [
          ['codigo_Tipo', 'descricao_Tipo'],
          ['codigo_tipo', 'descricao_tipo'],
          ['cod_Tipo', 'descTipo'],
          ['id_Tipo', 'descricao'],
        ]),
      );

      setCentrosCusto(
        toOptions(getRows(centroResp.jsonBody || centroResp.data), [
          ['id_CCusto', 'descricao_CCusto'],
          ['id_ccusto', 'descricao_ccusto'],
          ['codigo_CCusto', 'descCCusto'],
          ['codigo_ccusto', 'descricao'],
        ]),
      );

      setClientes(
        toOptions(getRows(clienteResp.jsonBody || clienteResp.data), [
          ['codigo_Cliente', 'nome_Fantasia'],
          ['Codigo_Cliente', 'nome_fantasia'],
          ['codigo_cliente', 'razao_Social'],
          ['codCliente', 'nome_Cliente'],
        ]),
      );

      setUnidadesMedida(
        toOptions(getRows(unidadeResp.jsonBody || unidadeResp.data), [
          ['unidade_Medida', 'descr_Unid_Medida'],
          ['unidade_medida', 'descr_unid_medida'],
          ['codigo_Unidade', 'descricao_Unidade'],
          ['sigla', 'descricao'],
        ]),
      );
    } catch {
      // carregamento auxiliar: manter tela funcional mesmo com falhas de lista
    }
  }, []);

  const carregar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();
    const dataInicioFiltro = dataInicio.trim() || formatToday();
    const dataFimFiltro = dataFim.trim() || formatToday();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      showToast('Sessão inválida para consultar ordens de serviço.', 'error');
      return;
    }

    setLoading(true);
    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const resp = await listOrdensServicosCall(baseUrl, token, {
        codigoEmpresa,
        codigoUsuario: usuario,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        numOrdem,
        numIdent,
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar ordens de serviço.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numIdent, numOrdem, showToast]);

  const carregarMateriais = useCallback(async (codDescMaterial: string) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) {
      showToast('Sessão inválida para consultar materiais.', 'error');
      return;
    }

    setLoadingMateriais(true);
    try {
      const resp = await buscaMaterialCall(baseUrl, token, codDescMaterial);
      if (!resp.succeeded) {
        showToast('Não foi possível consultar materiais.', 'error');
        setMateriais([]);
        setMaterialBuscaRealizada(true);
        return;
      }

      const rowsMaterial = getRows(resp.jsonBody || resp.data);
      const normalized = rowsMaterial
        .map((item) => {
          const codigo = String(
            item?.codigo_Material ?? item?.codigo_material ?? item?.Codigo_Material ?? item?.codMaterial ?? '',
          ).trim();
          const descricao = String(
            item?.descricao_Material ??
              item?.descricao_material ??
              item?.Descricao_Material ??
              item?.descricao_Portug ??
              item?.descricao_portug ??
              item?.descricao ??
              item?.desc_Material ??
              item?.desc_material ??
              item?.descricao_Item ??
              item?.descricao_item ??
              item?.descricaoProduto ??
              item?.produto ??
              '',
          ).trim();

          if (!codigo && !descricao) return null;

          return {
            codigo,
            descricao,
          };
        })
        .filter((item): item is MaterialItem => Boolean(item));

      setMateriais(normalized);
      setMaterialBuscaRealizada(true);
    } catch (error: any) {
      setMateriais([]);
      setMaterialBuscaRealizada(true);
      showToast(error?.message || 'Erro ao consultar materiais.', 'error');
    } finally {
      setLoadingMateriais(false);
    }
  }, [showToast]);

  const handleAbrirConsultaMateriais = () => {
    setMaterialFiltroCodDesc('');
    setMaterialBuscaRealizada(false);
    setMateriais([]);
    setMaterialModalOpen(true);
  };

  const handlePesquisarMateriais = () => {
    const codDescMaterial = materialFiltroCodDesc.trim();

    if (!codDescMaterial) {
      showToast('Informe Código ou Descrição para pesquisar materiais.', 'info');
      return;
    }

    void carregarMateriais(codDescMaterial);
  };

  const handleSelecionarMaterial = (item: MaterialItem) => {
    setForm((prev) => ({
      ...prev,
      codigoProduto: item.codigo,
    }));
    setMaterialModalOpen(false);
  };

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
    void carregarListas();
  }, [carregar, carregarListas]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temIdentificacao = Boolean(numIdent.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temIdentificacao && !(temDataInicio && temDataFim)) {
      nextErrors.numIdent = 'Para filtrar por Identificação, informe Data início e Data fim.';
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Identificação.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Identificação.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregar();
  }, [carregar, dataFim, dataInicio, numIdent]);

  const handleSalvar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      showToast('Sessão inválida para incluir ordem de serviço.', 'error');
      return;
    }

    const nextErrors: FormErrors = {};

    if (!form.descricaoServico.trim()) {
      nextErrors.descricaoServico = 'Descrição serviço é obrigatória.';
    }

    if (!form.qtdServico.trim()) {
      nextErrors.qtdServico = 'Quantidade é obrigatória.';
    } else {
      const qtdNumero = Number(form.qtdServico);
      if (!Number.isFinite(qtdNumero) || qtdNumero <= 0) {
        nextErrors.qtdServico = 'Quantidade deve ser um número maior que zero.';
      }
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

      const resp = await incluirOrdemServicoCall(baseUrl, token, {
        empresa: Number(codigoEmpresa),
        tipoOrdem: form.tipoOrdem ? Number(form.tipoOrdem) : undefined,
        centroCusto: form.centroCusto ? Number(form.centroCusto) : undefined,
        codigoCliente: form.codigoCliente ? Number(form.codigoCliente) : undefined,
        descricaoServico: form.descricaoServico.trim(),
        qtdServico: form.qtdServico.trim(),
        unidMedida: form.unidMedida.trim(),
        identEquipamento: form.identEquipamento.trim(),
        codigoProduto: form.codigoProduto.trim(),
        dataInicioPrev: form.dataInicioPrev,
        dataFimPrev: form.dataFimPrev,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível incluir a ordem de serviço.'), 'error');
        return;
      }

      showToast('Ordem de serviço incluída com sucesso.', 'success');
      setModalOpen(false);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir ordem de serviço.', 'error');
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
            <h1>Ordens de Serviço</h1>
            <p>Consulta e inclusão de ordens de serviço.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalOrdens} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Ordens de Serviço"
              placeholder="Pesquisar na lista de OS"
              className="ordens-servico-search"
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
                setForm(createInitialForm());
                setFormErrors({});
                setModalOpen(true);
              }}
              title="Nova OS"
              aria-label="Nova OS"
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
          <div className="list-layout-extra-filters ordens-servico-extra-filters">
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
                className={`module-field-error ordens-servico-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' ordens-servico-field__error-slot--empty'
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
                className={`module-field-error ordens-servico-field__error-slot${
                  filtroErrors.dataFim ? '' : ' ordens-servico-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--lg list-layout-field--clearable">
              <span>Identificação</span>
              <div className="ordens-servico-field__input-wrap">
                <input
                  className={filtroErrors.numIdent ? 'module-input-error' : ''}
                  value={numIdent}
                  onChange={(event) => {
                    setNumIdent(event.target.value);
                    if (filtroErrors.numIdent) {
                      setFiltroErrors((prev) => ({ ...prev, numIdent: undefined }));
                    }
                  }}
                  placeholder="Pesquisar identificação"
                />
                {numIdent.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar identificação"
                    title="Limpar"
                    onClick={() => setNumIdent('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small
                className={`module-field-error ordens-servico-field__error-slot${
                  filtroErrors.numIdent ? '' : ' ordens-servico-field__error-slot--empty'
                }`}
              >
                {filtroErrors.numIdent || ' '}
              </small>
            </label>

            <div className="ordens-servico-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número OS</span>
              <div className="ordens-servico-field__input-wrap">
                <input value={numOrdem} onChange={(event) => setNumOrdem(event.target.value)} placeholder="Pesquisar número da OS" />
                {numOrdem.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da OS"
                    title="Limpar"
                    onClick={() => setNumOrdem('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small className="module-field-error ordens-servico-field__error-slot ordens-servico-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando ordens...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhuma ordem de serviço encontrada.</p>
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
                      <button className="module-table__sort" type="button" onClick={() => handleSort('abertura')}>
                        Abertura <span>{getSortIndicator('abertura')}</span>
                      </button>
                    </th>
                    <th>
                      Código produto
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('cliente')}>
                        Cliente <span>{getSortIndicator('cliente')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('tipo')}>
                        Tipo <span>{getSortIndicator('tipo')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('centroCusto')}>
                        Centro Custo <span>{getSortIndicator('centroCusto')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                        Situação <span>{getSortIndicator('situacao')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row, index) => {
                    const os = String(row?.num_Ordem ?? row?.numOrdem ?? '-');
                    const aberturaData = String(row?.data_Abertura ?? row?.dataAbertura ?? '-');
                    const aberturaHora = String(row?.hora_Abertura ?? row?.horaAbertura ?? '');
                    const codigoProduto = String(row?.codigo_Produto ?? row?.codigoProduto ?? row?.cod_Prod ?? row?.codProd ?? '-');
                    const cliente = String(row?.nome_Fantasia ?? row?.nomeFantasia ?? '-');
                    const tipo = String(row?.descricao_Tipo ?? row?.descricaoTipo ?? '-');
                    const centroCusto = String(row?.descricao_CCusto ?? row?.descricaoCCusto ?? '-');
                    const situacao = String(row?.situacaoOS ?? row?.situacao_Os ?? row?.situacao ?? '-');

                    return (
                      <tr key={`os-${index}`}>
                        <td>{os}</td>
                        <td>
                          {aberturaData} {aberturaHora}
                        </td>
                        <td>{codigoProduto}</td>
                        <td>{cliente}</td>
                        <td>{tipo}</td>
                        <td>{centroCusto}</td>
                        <td>{situacao}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="module-cards">
              {rowsFiltradas.map((row, index) => {
                const os = String(row?.num_Ordem ?? row?.numOrdem ?? '-');
                const aberturaData = String(row?.data_Abertura ?? row?.dataAbertura ?? '-');
                const aberturaHora = String(row?.hora_Abertura ?? row?.horaAbertura ?? '');
                const codigoProduto = String(row?.codigo_Produto ?? row?.codigoProduto ?? row?.cod_Prod ?? row?.codProd ?? '-');
                const cliente = String(row?.nome_Fantasia ?? row?.nomeFantasia ?? '-');
                const tipo = String(row?.descricao_Tipo ?? row?.descricaoTipo ?? '-');
                const centroCusto = String(row?.descricao_CCusto ?? row?.descricaoCCusto ?? '-');
                const situacao = String(row?.situacaoOS ?? row?.situacao_Os ?? row?.situacao ?? '-');

                return (
                  <article className="module-card" key={`card-os-${index}`}>
                    <div className="module-card__row">
                      <span>OS</span>
                      <strong>{os}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Abertura</span>
                      <strong>
                        {aberturaData} {aberturaHora}
                      </strong>
                    </div>
                    <div className="module-card__row">
                      <span>Código produto</span>
                      <strong>{codigoProduto}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Cliente</span>
                      <strong>{cliente}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Tipo</span>
                      <strong>{tipo}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Centro Custo</span>
                      <strong>{centroCusto}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Situação</span>
                      <strong>{situacao}</strong>
                    </div>
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
              <h2>Nova ordem de serviço</h2>
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
                <span>Tipo de ordem</span>
                <SearchableSelect
                  value={form.tipoOrdem}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, tipoOrdem: nextValue }))}
                  options={tipoOrdemOptions}
                  ariaLabel="Tipo de ordem"
                  searchPlaceholder="Pesquisar tipo de ordem"
                />
              </label>
              <label>
                <span>Centro de custo</span>
                <SearchableSelect
                  value={form.centroCusto}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, centroCusto: nextValue }))}
                  options={centroCustoOptions}
                  ariaLabel="Centro de custo"
                  searchPlaceholder="Pesquisar centro de custo"
                />
              </label>
              <label>
                <span>Cliente</span>
                <SearchableSelect
                  value={form.codigoCliente}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, codigoCliente: nextValue }))}
                  options={clienteOptions}
                  ariaLabel="Cliente"
                  searchPlaceholder="Pesquisar cliente"
                />
              </label>
              <label className="form-grid-3__full">
                <span>Descrição serviço *</span>
                <textarea
                  className={`ordens-servico-descricao-textarea ${formErrors.descricaoServico ? 'ordens-servico-input-error' : ''}`}
                  rows={4}
                  value={form.descricaoServico}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((prev) => ({ ...prev, descricaoServico: nextValue }));
                    if (formErrors.descricaoServico) {
                      setFormErrors((prev) => ({ ...prev, descricaoServico: undefined }));
                    }
                  }}
                />
                {formErrors.descricaoServico ? <small className="ordens-servico-field-error">{formErrors.descricaoServico}</small> : null}
              </label>
              <label>
                <span>Quantidade *</span>
                <input
                  className={formErrors.qtdServico ? 'ordens-servico-input-error' : ''}
                  value={form.qtdServico}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((prev) => ({ ...prev, qtdServico: nextValue }));
                    if (formErrors.qtdServico) {
                      setFormErrors((prev) => ({ ...prev, qtdServico: undefined }));
                    }
                  }}
                />
                {formErrors.qtdServico ? <small className="ordens-servico-field-error">{formErrors.qtdServico}</small> : null}
              </label>
              <label>
                <span>Unid. medida</span>
                <SearchableSelect
                  value={form.unidMedida}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, unidMedida: nextValue }))}
                  options={unidadeOptions}
                  ariaLabel="Unidade de medida"
                  searchPlaceholder="Pesquisar unidade"
                />
              </label>
              <label>
                <span>Identificação equipamento</span>
                <input
                  value={form.identEquipamento}
                  onChange={(event) => setForm((prev) => ({ ...prev, identEquipamento: event.target.value }))}
                />
              </label>
              <label>
                <span>Código produto</span>
                <div className="ordens-servico-produto-input">
                  <input
                    value={form.codigoProduto}
                    onChange={(event) => setForm((prev) => ({ ...prev, codigoProduto: event.target.value }))}
                    placeholder="Informe ou pesquise o código"
                  />
                  <button
                    className="icon-button module-action-button ordens-servico-produto-search"
                    type="button"
                    onClick={() => void handleAbrirConsultaMateriais()}
                    disabled={saving}
                    aria-label="Consultar materiais"
                    title="Consultar materiais"
                  >
                    <IoSearchOutline size={16} />
                  </button>
                </div>
              </label>
              <label>
                <span>Início previsto</span>
                <CustomDatePicker
                  value={form.dataInicioPrev}
                  onChange={(nextDate) => setForm((prev) => ({ ...prev, dataInicioPrev: nextDate }))}
                />
              </label>
              <label>
                <span>Fim previsto</span>
                <CustomDatePicker
                  value={form.dataFimPrev}
                  onChange={(nextDate) => setForm((prev) => ({ ...prev, dataFimPrev: nextDate }))}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSalvar()} disabled={saving}>
                {saving ? 'Salvando...' : 'Incluir OS'}
              </button>
            </div>
          </article>
        </section>
      )}

      {materialModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Consulta de materiais">
          <article className="modal-card modal-card--wide ordens-servico-material-modal">
            <header className="modal-card__header">
              <h2>Consulta de materiais</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (loadingMateriais) return;
                  setMaterialModalOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="ordens-servico-material-filters">
              <label className="list-layout-field list-layout-field--xl" aria-label="Código ou descrição do material">
                <span>Código/Descrição</span>
                <div className="ordens-servico-material-filter-input-wrap">
                  <input
                    value={materialFiltroCodDesc}
                    onChange={(event) => setMaterialFiltroCodDesc(event.target.value)}
                    placeholder="Informe código ou descrição"
                  />
                  {materialFiltroCodDesc.trim() ? (
                    <button
                      type="button"
                      className="field-clear-button"
                      onClick={() => setMaterialFiltroCodDesc('')}
                      aria-label="Limpar pesquisa"
                      title="Limpar"
                    >
                      <IoCloseCircleOutline size={16} />
                    </button>
                  ) : null}
                </div>
              </label>

              <button
                className="icon-button module-action-button module-action-button--primary ordens-servico-material-filter-search"
                type="button"
                onClick={handlePesquisarMateriais}
                disabled={loadingMateriais}
                aria-label="Pesquisar materiais"
                title="Pesquisar"
              >
                <IoSearchOutline size={16} />
              </button>
            </div>

            {loadingMateriais ? (
              <p className="module-empty">Carregando materiais...</p>
            ) : !materialBuscaRealizada ? (
              <p className="module-empty">Informe Código ou Descrição e clique na lupa para pesquisar.</p>
            ) : materiais.length === 0 ? (
              <p className="module-empty">Nenhum material encontrado.</p>
            ) : (
              <>
                <div className="module-table ordens-servico-material-table">
                  <div className="table-scroll ordens-servico-material-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Descrição</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materiais.map((item, index) => (
                          <tr key={`material-${item.codigo || 'sem-codigo'}-${index}`}>
                            <td>{item.codigo || '-'}</td>
                            <td>{item.descricao || 'Sem descrição'}</td>
                            <td>
                              <button
                                className="icon-button module-action-button module-action-button--primary ordens-servico-material-add"
                                type="button"
                                onClick={() => handleSelecionarMaterial(item)}
                                aria-label={`Incluir material ${item.codigo || ''}`}
                                title="Incluir"
                              >
                                <IoAddOutline size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ordens-servico-material-cards">
                  {materiais.map((item, index) => (
                    <article className="module-card" key={`material-card-${item.codigo || 'sem-codigo'}-${index}`}>
                      <div className="module-card__row">
                        <span>Código</span>
                        <strong>{item.codigo || '-'}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Descrição</span>
                        <strong>{item.descricao || 'Sem descrição'}</strong>
                      </div>
                      <div className="module-card__actions">
                        <button
                          className="icon-button module-action-button module-action-button--primary ordens-servico-material-add"
                          type="button"
                          onClick={() => handleSelecionarMaterial(item)}
                          aria-label={`Incluir material ${item.codigo || ''}`}
                          title="Incluir"
                        >
                          <IoAddOutline size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
