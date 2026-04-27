import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAlertCircleOutline,
  IoArrowBack,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { GlobalConfig } from '../../../services/globalConfig';
import { DashboardChart } from '../components/DashboardChartPanel';
import { DashboardKpiCards } from '../components/DashboardKpiCards';
import { DashboardSummaryTable } from '../components/DashboardSummaryTable';
import { getDashboardFinanceiro, type DashboardFinanceiroResponse, type FinanceiroApiItem } from '../services/dashboardApi';
import type { DashboardDateErrors, DashboardKpiCard, DashboardRow, DashboardSeries, DashboardTableColumn, Option } from '../types';
import {
  formatNumberBR,
  groupSum,
  monthEndPtBr,
  monthStartPtBr,
  normalizeText,
  parseDateStrict,
  sortRows,
  toApiDate,
  toNumber,
} from '../utils/dashboardUtils';

type FinanceiroBase = 'receitas' | 'despesas' | 'comparativo';
type FinanceiroGroup = 'mes' | 'banco' | 'pessoa' | 'tipo' | 'lancamento' | 'vendedor' | 'cliente' | 'regiao';
type FinanceiroMetric =
  | 'valorMov'
  | 'valorPrincipal'
  | 'valorDesconto'
  | 'valorJuros'
  | 'valorOutras'
  | 'valorPisCofins'
  | 'quantidade'
  | 'receitas'
  | 'despesas'
  | 'saldo'
  | 'comparacao';

const metricOptionsByBase: Record<FinanceiroBase, Option[]> = {
  receitas: [
    { value: 'valorMov', label: 'Valor movimentado' },
    { value: 'valorPrincipal', label: 'Valor principal' },
    { value: 'valorDesconto', label: 'Desconto' },
    { value: 'valorJuros', label: 'Juros' },
    { value: 'valorOutras', label: 'Outras despesas' },
    { value: 'valorPisCofins', label: 'PIS + Cofins' },
    { value: 'quantidade', label: 'Quantidade de lançamentos' },
  ],
  despesas: [
    { value: 'valorMov', label: 'Valor movimentado' },
    { value: 'valorPrincipal', label: 'Valor principal' },
    { value: 'valorDesconto', label: 'Desconto' },
    { value: 'valorJuros', label: 'Juros' },
    { value: 'valorOutras', label: 'Outras despesas' },
    { value: 'valorPisCofins', label: 'PIS + Cofins' },
    { value: 'quantidade', label: 'Quantidade de lançamentos' },
  ],
  comparativo: [
    { value: 'receitas', label: 'Receitas' },
    { value: 'despesas', label: 'Despesas' },
    { value: 'saldo', label: 'Saldo (Receitas - Despesas)' },
    { value: 'comparacao', label: 'Comparação receitas x despesas' },
  ],
};

type GroupMeta = {
  key: FinanceiroGroup;
  label: string;
  placeholder: string;
  allLabel: string;
  fromBase: Array<FinanceiroBase>;
  getLabel: (item: FinanceiroApiItem) => string;
  getOrder?: (item: FinanceiroApiItem) => number;
};

const groupMetaList: GroupMeta[] = [
  {
    key: 'mes',
    label: 'Mês/Ano',
    placeholder: 'Pesquisar mês/ano',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Mes_Ano_Mov ?? item?.mes_Ano_Mov ?? item?.MesAnoMov ?? item?.mesAnoMov ?? '-').trim() || '-',
    getOrder: (item) => toNumber(item?.Ordenacao_Mes_Ano ?? item?.ordenacao_Mes_Ano ?? item?.OrdenacaoMesAno ?? 0),
  },
  {
    key: 'vendedor',
    label: 'Vendedor',
    placeholder: 'Pesquisar vendedor',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? item?.nomeVendedor ?? '').trim(),
  },
  {
    key: 'cliente',
    label: 'Cliente',
    placeholder: 'Pesquisar cliente',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? item?.nomeFantasia ?? '').trim(),
  },
  {
    key: 'regiao',
    label: 'Região',
    placeholder: 'Pesquisar região',
    allLabel: 'Todas',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => {
      const nome = String(item?.Nome_Regiao ?? item?.nome_Regiao ?? item?.nomeRegiao ?? '').trim();
      if (nome) return nome;
      const codigo = String(item?.Regiao_Destinatario ?? item?.regiao_Destinatario ?? item?.regiaoDestinatario ?? '').trim();
      return codigo ? `Região ${codigo}` : '';
    },
  },
  {
    key: 'banco',
    label: 'Banco/Portador',
    placeholder: 'Pesquisar banco',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Nome_Banco ?? item?.nome_Banco ?? item?.nomeBanco ?? '').trim(),
  },
  {
    key: 'pessoa',
    label: 'Pessoa',
    placeholder: 'Pesquisar pessoa',
    allLabel: 'Todas',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? item?.nomeFantasia ?? '').trim(),
  },
  {
    key: 'tipo',
    label: 'Tipo de documento',
    placeholder: 'Pesquisar tipo',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas', 'comparativo'],
    getLabel: (item) => String(item?.Tipo_Documento ?? item?.tipo_Documento ?? item?.tipoDocumento ?? '').trim(),
  },
  {
    key: 'lancamento',
    label: 'Lançamento',
    placeholder: 'Pesquisar lançamento',
    allLabel: 'Todos',
    fromBase: ['receitas', 'despesas'],
    getLabel: (item) => String(item?.Descricao_Lanc ?? item?.descricao_Lanc ?? item?.descricaoLanc ?? '').trim(),
  },
];

const getGroupMeta = (groupBy: FinanceiroGroup) => groupMetaList.find((item) => item.key === groupBy) ?? groupMetaList[0];

const getGroupInfo = (item: FinanceiroApiItem, groupBy: FinanceiroGroup) => {
  const meta = getGroupMeta(groupBy);
  const label = meta.getLabel(item) || 'Não informado';
  const order = meta.getOrder ? meta.getOrder(item) : 0;
  return {
    key: normalizeText(label) || 'nao-informado',
    label,
    order,
  };
};

const filterByDependent = (source: FinanceiroApiItem[], groupBy: FinanceiroGroup, dependentValue: string) => {
  const selected = normalizeText(dependentValue);
  if (!selected || selected === 'todos') return source;

  const meta = getGroupMeta(groupBy);
  return source.filter((item) => normalizeText(meta.getLabel(item) || 'Não informado') === selected);
};

const buildFinanceRows = (
  base: FinanceiroBase,
  groupBy: FinanceiroGroup,
  metric: FinanceiroMetric,
  payload: DashboardFinanceiroResponse,
  dependentValue: string,
): {
  rows: DashboardRow[];
  series: DashboardSeries[];
  columns: DashboardTableColumn[];
} => {
  const receitas = filterByDependent(payload.FluxoCaixaReceitas ?? [], groupBy, dependentValue);
  const despesas = filterByDependent(payload.FluxoCaixaDespesas ?? [], groupBy, dependentValue);

  if (base === 'comparativo') {
    const grouped = new Map<string, DashboardRow>();

    const accumulate = (source: FinanceiroApiItem[], type: 'receitas' | 'despesas') => {
      for (const item of source) {
        const info = getGroupInfo(item, groupBy);
        const current = grouped.get(info.key) || { key: info.key, label: info.label, order: info.order, receitas: 0, despesas: 0, saldo: 0 };
        const value = toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);

        current[type] = Number(current[type] ?? 0) + value;
        current.saldo = Number(current.receitas ?? 0) - Number(current.despesas ?? 0);
        if (!current.order && info.order) current.order = info.order;

        grouped.set(info.key, current);
      }
    };

    accumulate(receitas, 'receitas');
    accumulate(despesas, 'despesas');

    const sorted = sortRows(Array.from(grouped.values()), metric === 'comparacao' ? 'saldo' : metric);

    let series: DashboardSeries[] = [{ key: 'saldo', label: 'Saldo', color: '#16a34a', format: 'currency' }];
    if (metric === 'comparacao') {
      series = [
        { key: 'receitas', label: 'Receitas', color: '#2563eb', format: 'currency' },
        { key: 'despesas', label: 'Despesas', color: '#ef4444', format: 'currency' },
      ];
    }
    if (metric === 'receitas') {
      series = [{ key: 'receitas', label: 'Receitas', color: '#2563eb', format: 'currency' }];
    }
    if (metric === 'despesas') {
      series = [{ key: 'despesas', label: 'Despesas', color: '#ef4444', format: 'currency' }];
    }

    return {
      rows: sorted,
      series,
      columns: [
        { key: 'label', label: getGroupMeta(groupBy).label, format: 'text' },
        { key: 'receitas', label: 'Receitas', format: 'currency' },
        { key: 'despesas', label: 'Despesas', format: 'currency' },
        { key: 'saldo', label: 'Saldo', format: 'currency' },
      ],
    };
  }

  const source = base === 'receitas' ? receitas : despesas;

  const rows = groupSum(
    source,
    (item) => getGroupInfo(item, groupBy).key,
    (item) => getGroupInfo(item, groupBy).label,
    (item) => getGroupInfo(item, groupBy).order,
    {
      valorMov: (item) => toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0),
      valorPrincipal: (item) =>
        base === 'receitas'
          ? toNumber(item?.Valor_Receber ?? item?.valor_Receber ?? item?.valorReceber ?? 0)
          : toNumber(item?.Valor_Pagar ?? item?.valor_Pagar ?? item?.valorPagar ?? 0),
      valorDesconto: (item) => toNumber(item?.Valor_Desconto ?? item?.valor_Desconto ?? item?.valorDesconto ?? 0),
      valorJuros: (item) => toNumber(item?.Valor_Juros ?? item?.valor_Juros ?? item?.valorJuros ?? 0),
      valorOutras: (item) => toNumber(item?.Valor_Outras_Desp ?? item?.valor_Outras_Desp ?? item?.valorOutrasDesp ?? 0),
      valorPisCofins: (item) =>
        toNumber(item?.Valor_PIS ?? item?.valor_PIS ?? item?.valorPis ?? 0) +
        toNumber(item?.Valor_Cofins ?? item?.valor_Cofins ?? item?.valorCofins ?? 0),
      quantidade: () => 1,
    },
  );

  const metricFormat = metric === 'quantidade' ? 'number' : 'currency';
  const sorted = sortRows(rows, metric);

  const series: DashboardSeries[] = [
    {
      key: metric,
      label: metricOptionsByBase[base].find((item) => item.value === metric)?.label || 'Valor',
      color: '#2563eb',
      format: metricFormat,
    },
  ];

  return {
    rows: sorted,
    series,
    columns: [
      { key: 'label', label: getGroupMeta(groupBy).label, format: 'text' },
      { key: metric, label: series[0].label, format: metricFormat },
    ],
  };
};

export function DashboardFinanceiroPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const codigoEmpresa = useMemo(() => String(GlobalConfig.getCodEmpresa() ?? ''), []);

  const [appliedDataDe, setAppliedDataDe] = useState(monthStartPtBr());
  const [appliedDataAte, setAppliedDataAte] = useState(monthEndPtBr());
  const [draftDataDe, setDraftDataDe] = useState(monthStartPtBr());
  const [draftDataAte, setDraftDataAte] = useState(monthEndPtBr());
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mainChartCollapsed, setMainChartCollapsed] = useState(false);
  const [topChartCollapsed, setTopChartCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardFinanceiroResponse>({
    MoedasSemCotacao: [],
    FluxoCaixaReceitas: [],
    FluxoCaixaDespesas: [],
  });

  const initialFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!advancedOpen) return;
    setDraftDataDe(appliedDataDe);
    setDraftDataAte(appliedDataAte);
    setErrors({});
  }, [advancedOpen, appliedDataAte, appliedDataDe]);

  const validateDates = useCallback(() => {
    const nextErrors: DashboardDateErrors = {};

    if (!String(codigoEmpresa).trim()) {
      nextErrors.codigoEmpresa = 'Empresa inválida para consultar o dashboard.';
    }

    const parsedDe = parseDateStrict(draftDataDe);
    const parsedAte = parseDateStrict(draftDataAte);

    if (!parsedDe) nextErrors.dataDe = 'Data inicial inválida.';
    if (!parsedAte) nextErrors.dataAte = 'Data final inválida.';

    if (parsedDe && parsedAte && parsedDe.getTime() > parsedAte.getTime()) {
      nextErrors.dataDe = 'Data inicial não pode ser maior que Data final.';
      nextErrors.dataAte = 'Data final não pode ser menor que Data inicial.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [codigoEmpresa, draftDataAte, draftDataDe]);

  const fetchDashboard = useCallback(
    async (params: { dataDe: string; dataAte: string }) => {
      const parsedDe = parseDateStrict(params.dataDe);
      const parsedAte = parseDateStrict(params.dataAte);
      if (!parsedDe || !parsedAte) return;

      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();

      if (!baseUrl || !token) {
        setErrorMessage('Sessão inválida para consultar o dashboard financeiro.');
        return;
      }

      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);
        setErrorMessage('');

        const result = await getDashboardFinanceiro({
          baseUrl,
          token,
          codigoEmpresa: codigoEmpresa.trim(),
          dataDe: toApiDate(params.dataDe),
          dataAte: toApiDate(params.dataAte),
        });

        if (requestIdRef.current !== requestId) return;
        setPayload(result);
      } catch (error: any) {
        if (requestIdRef.current !== requestId) return;
        const message = String(error?.message || 'Erro ao carregar dashboard financeiro.');
        setErrorMessage(message);
        showToast(message, 'error');
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setHasFetched(true);
        }
      }
    },
    [codigoEmpresa, showToast],
  );

  useEffect(() => {
    if (initialFetchRef.current) return;
    if (!appliedDataDe || !appliedDataAte) return;

    initialFetchRef.current = true;
    void fetchDashboard({ dataDe: appliedDataDe, dataAte: appliedDataAte });
  }, [appliedDataAte, appliedDataDe, fetchDashboard]);

  const filteredPayload = useMemo<DashboardFinanceiroResponse>(() => {
    return {
      ...payload,
      FluxoCaixaReceitas: payload.FluxoCaixaReceitas ?? [],
      FluxoCaixaDespesas: payload.FluxoCaixaDespesas ?? [],
    };
  }, [payload]);

  const kpis = useMemo<DashboardKpiCard[]>(() => {
    const totalReceitas = (filteredPayload.FluxoCaixaReceitas ?? []).reduce(
      (acc, item) => acc + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0),
      0,
    );

    const totalDespesas = (filteredPayload.FluxoCaixaDespesas ?? []).reduce(
      (acc, item) => acc + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0),
      0,
    );

    const saldo = totalReceitas - totalDespesas;

    return [
      { key: 'total-receitas', label: 'Total de receitas', value: totalReceitas, format: 'currency' },
      { key: 'total-despesas', label: 'Total de despesas', value: totalDespesas, format: 'currency' },
      { key: 'saldo-periodo', label: 'Saldo do período', value: saldo, format: 'currency' },
      {
        key: 'qtd-receitas',
        label: 'Lançamentos de receitas',
        value: filteredPayload.FluxoCaixaReceitas.length,
        format: 'number',
      },
      {
        key: 'qtd-despesas',
        label: 'Lançamentos de despesas',
        value: filteredPayload.FluxoCaixaDespesas.length,
        format: 'number',
      },
    ];
  }, [filteredPayload]);

  const processed = useMemo(
    () => buildFinanceRows('comparativo', 'mes', 'saldo', filteredPayload, 'todos'),
    [filteredPayload],
  );

  const topReceitasRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    for (const rawItem of filteredPayload.FluxoCaixaReceitas ?? []) {
      const item = (rawItem ?? {}) as FinanceiroApiItem;
      const info = getGroupInfo(item, 'cliente');
      const current = grouped.get(info.key) || { key: info.key, label: info.label, valor: 0 };
      current.valor = Number(current.valor ?? 0) + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);
      grouped.set(info.key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0))
      .slice(0, 5);
  }, [filteredPayload.FluxoCaixaReceitas]);

  const topDespesasRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    for (const rawItem of filteredPayload.FluxoCaixaDespesas ?? []) {
      const item = (rawItem ?? {}) as FinanceiroApiItem;
      const info = getGroupInfo(item, 'cliente');
      const current = grouped.get(info.key) || { key: info.key, label: info.label, valor: 0 };
      current.valor = Number(current.valor ?? 0) + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);
      grouped.set(info.key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0))
      .slice(0, 5);
  }, [filteredPayload.FluxoCaixaDespesas]);

  const topReceitasSeries = useMemo<DashboardSeries[]>(() => [{ key: 'valor', label: 'Receitas', color: '#2563eb', format: 'currency' }], []);
  const topDespesasSeries = useMemo<DashboardSeries[]>(() => [{ key: 'valor', label: 'Despesas', color: '#ef4444', format: 'currency' }], []);

  const monthlyComparisonRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    const accumulate = (source: FinanceiroApiItem[], type: 'receitas' | 'despesas') => {
      for (const item of source) {
        const info = getGroupInfo(item, 'mes');
        const current = grouped.get(info.key) || { key: info.key, label: info.label, order: info.order, receitas: 0, despesas: 0 };
        const value = toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);

        current[type] = Number(current[type] ?? 0) + value;
        if (!current.order && info.order) current.order = info.order;

        grouped.set(info.key, current);
      }
    };

    accumulate(filteredPayload.FluxoCaixaReceitas ?? [], 'receitas');
    accumulate(filteredPayload.FluxoCaixaDespesas ?? [], 'despesas');

    return sortRows(Array.from(grouped.values()));
  }, [filteredPayload.FluxoCaixaDespesas, filteredPayload.FluxoCaixaReceitas]);

  const monthlyComparisonMax = useMemo(() => {
    return Math.max(
      1,
      ...monthlyComparisonRows.map((row) => Math.max(Math.abs(Number(row.receitas ?? 0)), Math.abs(Number(row.despesas ?? 0)))),
    );
  }, [monthlyComparisonRows]);

  const monthlyAxisTicks = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = (monthlyComparisonMax / steps) * (steps - index);
      const topPercent = (index / steps) * 100;
      return { value, topPercent };
    });
  }, [monthlyComparisonMax]);

  const hasAnyData = filteredPayload.FluxoCaixaReceitas.length > 0 || filteredPayload.FluxoCaixaDespesas.length > 0;
  const hasDataAfterFilters = processed.rows.length > 0;

  return (
    <main className="clientes-page list-layout-page dashboard-page dashboard-financeiro-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>

          <div>
            <h1>Dashboard - Financeiro</h1>
            <p>Visão dinâmica de receitas, despesas e saldo com agregações configuráveis.</p>
          </div>
        </div>
      </section>

      <AdvancedFiltersPanel
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        onApply={() => {
          if (!validateDates()) return;
          setAppliedDataDe(draftDataDe);
          setAppliedDataAte(draftDataAte);
          setAdvancedOpen(false);
          void fetchDashboard({ dataDe: draftDataDe, dataAte: draftDataAte });
        }}
        applyLabel="Aplicar"
        cancelLabel="Fechar"
      >
        <div className="dashboard-financeiro-advanced-grid dashboard-financeiro-advanced-grid--dates-only">
          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data de</span>
            <CustomDatePicker value={draftDataDe} onChange={setDraftDataDe} className={errors.dataDe ? 'pcp-date-error' : undefined} />
            <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data até</span>
            <CustomDatePicker value={draftDataAte} onChange={setDraftDataAte} className={errors.dataAte ? 'pcp-date-error' : undefined} />
            <small className={`module-field-error${errors.dataAte ? '' : ' dashboard-error-empty'}`}>{errors.dataAte || ' '}</small>
          </label>
        </div>
      </AdvancedFiltersPanel>

      <section className="card dashboard-financeiro-results">
        <div className="dashboard-vendas-controls-inline dashboard-financeiro-results__actions">
          <button
            className={`icon-button module-action-button${advancedOpen ? ' module-action-button--primary' : ''}`}
            type="button"
            onClick={() => setAdvancedOpen(true)}
            title="Filtros avançados"
            aria-label="Filtros avançados"
          >
            <IoFilterOutline size={16} />
          </button>

          <button
            className="icon-button module-action-button"
            type="button"
            onClick={() => {
              if (!appliedDataDe || !appliedDataAte) {
                setAdvancedOpen(true);
                return;
              }

              void fetchDashboard({ dataDe: appliedDataDe, dataAte: appliedDataAte });
            }}
            title="Atualizar"
            aria-label="Atualizar"
            disabled={loading}
          >
            <IoRefreshOutline size={16} />
          </button>
        </div>

        <p className="dashboard-period-range">Período: {appliedDataDe} - {appliedDataAte}</p>

        {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
        {loading ? <p className="module-empty">Carregando dashboard financeiro...</p> : null}

        {!loading && !errorMessage && !hasFetched ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Preencha os filtros e clique em atualizar para visualizar os gráficos</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && (!hasAnyData || !hasDataAfterFilters) ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Nenhum dado encontrado para os filtros informados</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && hasAnyData && hasDataAfterFilters ? (
          <>
            <DashboardKpiCards cards={kpis} />

            <section className="dashboard-chart-grid">
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Top 5 receitas e top 5 despesas</h2>
                    <p>Ranking em pizza dos maiores clientes de receitas e despesas no período.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setMainChartCollapsed((prev) => !prev)}
                    aria-label={mainChartCollapsed ? 'Expandir visualização principal' : 'Encolher visualização principal'}
                    title={mainChartCollapsed ? 'Expandir visualização principal' : 'Encolher visualização principal'}
                  >
                    {mainChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>
                {!mainChartCollapsed ? (
                  topReceitasRows.length === 0 && topDespesasRows.length === 0 ? (
                    <p className="module-empty">Sem dados para montar o top 5 de receitas e despesas.</p>
                  ) : (
                    <div className="dashboard-financeiro-top-pies">
                      <article className="dashboard-financeiro-top-pies__card">
                        <h3>Top 5 receitas</h3>
                        {topReceitasRows.length > 0 ? (
                          <DashboardChart chartType="pie" rows={topReceitasRows} series={topReceitasSeries} xKey="label" />
                        ) : (
                          <p className="module-empty">Sem receitas no período.</p>
                        )}
                      </article>

                      <article className="dashboard-financeiro-top-pies__card">
                        <h3>Top 5 despesas</h3>
                        {topDespesasRows.length > 0 ? (
                          <DashboardChart chartType="pie" rows={topDespesasRows} series={topDespesasSeries} xKey="label" />
                        ) : (
                          <p className="module-empty">Sem despesas no período.</p>
                        )}
                      </article>
                    </div>
                  )
                ) : null}
              </article>

              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Receita x Despesa por mês</h2>
                    <p>Duas barras verticais por mês para comparar receitas e despesas.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setTopChartCollapsed((prev) => !prev)}
                    aria-label={topChartCollapsed ? 'Expandir top agrupamentos' : 'Encolher top agrupamentos'}
                    title={topChartCollapsed ? 'Expandir top agrupamentos' : 'Encolher top agrupamentos'}
                  >
                    {topChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>
                {!topChartCollapsed ? (
                  monthlyComparisonRows.length === 0 ? (
                    <p className="module-empty">Sem dados mensais para comparar receitas e despesas.</p>
                  ) : (
                    <div className="dashboard-financeiro-classic">
                      <div className="dashboard-financeiro-classic__plot">
                        <div className="dashboard-financeiro-classic__y-axis" aria-hidden="true">
                          {monthlyAxisTicks.map((tick) => (
                            <span key={`tick-${tick.topPercent}`} style={{ top: `${tick.topPercent}%` }}>
                              {formatNumberBR(Math.round(tick.value))}
                            </span>
                          ))}
                        </div>

                        <div className="dashboard-financeiro-classic__chart">
                          {monthlyAxisTicks.map((tick) => (
                            <span key={`grid-${tick.topPercent}`} className="dashboard-financeiro-classic__grid-line" style={{ top: `${tick.topPercent}%` }} />
                          ))}

                          <div className="dashboard-financeiro-classic__groups">
                            {monthlyComparisonRows.map((row) => {
                              const receitas = Number(row.receitas ?? 0);
                              const despesas = Number(row.despesas ?? 0);
                              const receitaHeight = Math.max(2, (Math.abs(receitas) / monthlyComparisonMax) * 100);
                              const despesaHeight = Math.max(2, (Math.abs(despesas) / monthlyComparisonMax) * 100);

                              return (
                                <article key={row.key} className="dashboard-financeiro-classic__group">
                                  <div className="dashboard-financeiro-classic__bars">
                                    <div
                                      className="dashboard-financeiro-classic__bar is-receita"
                                      style={{ '--bar-size': `${receitaHeight}%` } as CSSProperties}
                                      title={`Receita: ${Number(receitas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                                    />
                                    <div
                                      className="dashboard-financeiro-classic__bar is-despesa"
                                      style={{ '--bar-size': `${despesaHeight}%` } as CSSProperties}
                                      title={`Despesa: ${Number(despesas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                                    />
                                  </div>
                                  <strong className="dashboard-financeiro-classic__label">{row.label}</strong>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="dashboard-financeiro-classic__legend" aria-hidden="true">
                        <span className="dashboard-financeiro-classic__legend-item is-receita">Receitas</span>
                        <span className="dashboard-financeiro-classic__legend-item is-despesa">Despesas</span>
                      </div>
                    </div>
                  )
                ) : null}
              </article>
            </section>

            <DashboardSummaryTable rows={processed.rows} columns={processed.columns} />
          </>
        ) : null}

        {payload.MoedasSemCotacao.length > 0 ? (
          <p className="status-box status-box--error dashboard-alert-row dashboard-alert-row--bottom">
            <IoAlertCircleOutline size={18} />
            Existem moedas sem cotação no período. Verifique antes de tomar decisões baseadas nos totais.
          </p>
        ) : null}
      </section>
    </main>
  );
}
