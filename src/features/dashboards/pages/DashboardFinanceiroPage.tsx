import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import { DashboardChart } from '../components/DashboardChartPanel';
import { DashboardKpiCards } from '../components/DashboardKpiCards';
import { DashboardSummaryTable } from '../components/DashboardSummaryTable';
import { getDashboardFinanceiro, type DashboardFinanceiroResponse, type FinanceiroApiItem } from '../services/dashboardApi';
import type {
  DashboardChartType,
  DashboardDateErrors,
  DashboardKpiCard,
  DashboardRow,
  DashboardSeries,
  DashboardTableColumn,
  Option,
} from '../types';
import {
  groupSum,
  limitRowsForPie,
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

const chartTypeOptions: Option[] = [
  { value: 'bar', label: 'Barra' },
  { value: 'line', label: 'Linha' },
  { value: 'pie', label: 'Pizza' },
  { value: 'donut', label: 'Rosca' },
  { value: 'area', label: 'Área' },
  { value: 'bar-horizontal', label: 'Barra horizontal' },
  { value: 'cards', label: 'Cards de indicadores' },
  { value: 'table', label: 'Tabela resumida' },
];

const dataOptions: Option[] = [
  { value: 'receitas', label: 'Base: Receitas' },
  { value: 'despesas', label: 'Base: Despesas' },
  { value: 'comparativo', label: 'Base: Comparativo' },
];

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

const getBaseSource = (base: FinanceiroBase, payload: DashboardFinanceiroResponse): FinanceiroApiItem[] => {
  if (base === 'receitas') return payload.FluxoCaixaReceitas ?? [];
  if (base === 'despesas') return payload.FluxoCaixaDespesas ?? [];
  return [...(payload.FluxoCaixaReceitas ?? []), ...(payload.FluxoCaixaDespesas ?? [])];
};

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
  const [chartType, setChartType] = useState<DashboardChartType>('pie');
  const [selectedData, setSelectedData] = useState<FinanceiroBase>('comparativo');
  const [groupBy, setGroupBy] = useState<FinanceiroGroup>('mes');
  const [dependentValue, setDependentValue] = useState('todos');
  const [metric, setMetric] = useState<FinanceiroMetric>('saldo');
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

  const groupOptions = useMemo<Option[]>(() => {
    const baseItems = getBaseSource(selectedData, payload);

    return groupMetaList
      .filter((meta) => meta.fromBase.includes(selectedData))
      .filter((meta) => {
        if (!baseItems.length) return true;
        return baseItems.some((item) => Boolean((meta.getLabel(item) || '').trim()));
      })
      .map((meta) => ({ value: meta.key, label: meta.label }));
  }, [payload, selectedData]);

  const metricOptions = useMemo(() => metricOptionsByBase[selectedData], [selectedData]);

  const dependentMeta = useMemo(() => getGroupMeta(groupBy), [groupBy]);

  const dependentOptions = useMemo<Option[]>(() => {
    const source = getBaseSource(selectedData, payload);
    const labels = new Set<string>();

    for (const item of source) {
      const label = dependentMeta.getLabel(item).trim();
      if (label) labels.add(label);
    }

    return [
      { value: 'todos', label: dependentMeta.allLabel },
      ...Array.from(labels)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((label) => ({ value: label, label })),
    ];
  }, [dependentMeta, payload, selectedData]);

  useEffect(() => {
    if (!groupOptions.some((item) => item.value === groupBy)) {
      setGroupBy((groupOptions[0]?.value ?? 'mes') as FinanceiroGroup);
    }
  }, [groupBy, groupOptions]);

  useEffect(() => {
    if (!metricOptions.some((item) => item.value === metric)) {
      setMetric(metricOptions[0].value as FinanceiroMetric);
    }
  }, [metric, metricOptions]);

  useEffect(() => {
    if (!dependentOptions.some((item) => item.value === dependentValue)) {
      setDependentValue('todos');
    }
  }, [dependentOptions, dependentValue]);

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
    const receitas = filterByDependent(payload.FluxoCaixaReceitas ?? [], groupBy, dependentValue);
    const despesas = filterByDependent(payload.FluxoCaixaDespesas ?? [], groupBy, dependentValue);

    return {
      ...payload,
      FluxoCaixaReceitas: receitas,
      FluxoCaixaDespesas: despesas,
    };
  }, [dependentValue, groupBy, payload]);

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
    () => buildFinanceRows(selectedData, groupBy, metric, filteredPayload, dependentValue),
    [dependentValue, filteredPayload, groupBy, metric, selectedData],
  );

  const chartRows = useMemo(() => {
    if ((chartType === 'pie' || chartType === 'donut') && processed.series[0]) {
      return limitRowsForPie(processed.rows, processed.series[0].key, 8);
    }

    return processed.rows;
  }, [chartType, processed.rows, processed.series]);

  const secondaryChartRows = useMemo(() => {
    if (!processed.series[0]) return [] as DashboardRow[];
    const metricKey = processed.series[0].key;

    return [...processed.rows]
      .sort((a, b) => Number(b[metricKey] ?? 0) - Number(a[metricKey] ?? 0))
      .slice(0, 8);
  }, [processed.rows, processed.series]);

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
        <div className="dashboard-financeiro-advanced-grid">
          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data inicial</span>
            <CustomDatePicker value={draftDataDe} onChange={setDraftDataDe} className={errors.dataDe ? 'pcp-date-error' : undefined} />
            <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data final</span>
            <CustomDatePicker value={draftDataAte} onChange={setDraftDataAte} className={errors.dataAte ? 'pcp-date-error' : undefined} />
            <small className={`module-field-error${errors.dataAte ? '' : ' dashboard-error-empty'}`}>{errors.dataAte || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Tipo de gráfico</span>
            <SearchableSelect
              value={chartType}
              onChange={(value) => setChartType(value as DashboardChartType)}
              options={chartTypeOptions}
              searchPlaceholder="Pesquisar tipo"
              ariaLabel="Tipo de gráfico"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Dados a exibir</span>
            <SearchableSelect
              value={selectedData}
              onChange={(value) => setSelectedData(value as FinanceiroBase)}
              options={dataOptions}
              searchPlaceholder="Pesquisar base"
              ariaLabel="Dados a exibir"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Agrupar por</span>
            <SearchableSelect
              value={groupBy}
              onChange={(value) => setGroupBy(value as FinanceiroGroup)}
              options={groupOptions}
              searchPlaceholder="Pesquisar agrupamento"
              ariaLabel="Agrupar por"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>{dependentMeta.label}</span>
            <SearchableSelect
              value={dependentValue}
              onChange={setDependentValue}
              options={dependentOptions}
              searchPlaceholder={dependentMeta.placeholder}
              ariaLabel={dependentMeta.label}
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Tipo de valor</span>
            <SearchableSelect
              value={metric}
              onChange={(value) => setMetric(value as FinanceiroMetric)}
              options={metricOptions}
              searchPlaceholder="Pesquisar valor"
              ariaLabel="Tipo de valor"
            />
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
                    <h2>Visualização principal</h2>
                    <p>Os gráficos reagem ao tipo de visualização, agrupamento e filtro selecionado.</p>
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
                {!mainChartCollapsed ? <DashboardChart chartType={chartType} rows={chartRows} series={processed.series} xKey="label" /> : null}
              </article>

              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Top agrupamentos</h2>
                    <p>Resumo dos maiores valores do agrupamento atual.</p>
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
                  <DashboardChart chartType="bar-horizontal" rows={secondaryChartRows} series={processed.series} xKey="label" />
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
