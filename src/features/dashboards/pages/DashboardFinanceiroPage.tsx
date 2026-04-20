import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { DashboardChart } from '../components/DashboardChart';
import { DashboardConfigurator } from '../components/DashboardConfigurator';
import { DashboardFiltersBar } from '../components/DashboardFiltersBar';
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
  monthStartPtBr,
  normalizeText,
  parseDateStrict,
  sortRows,
  toApiDate,
  toNumber,
  todayPtBr,
} from '../utils/dashboardUtils';

type FinanceiroBase = 'receitas' | 'despesas' | 'comparativo';
type FinanceiroGroup = 'mes' | 'banco' | 'pessoa' | 'tipo' | 'lancamento';
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
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linhas' },
  { value: 'pie', label: 'Pizza' },
  { value: 'donut', label: 'Rosca' },
  { value: 'area', label: 'Área' },
  { value: 'bar-horizontal', label: 'Coluna horizontal' },
  { value: 'cards', label: 'Cards de indicadores' },
  { value: 'table', label: 'Tabela resumida' },
];

const dataOptions: Option[] = [
  { value: 'receitas', label: 'Base: Receitas' },
  { value: 'despesas', label: 'Base: Despesas' },
  { value: 'comparativo', label: 'Base: Comparativo' },
];

const groupOptionsByBase: Record<FinanceiroBase, Option[]> = {
  receitas: [
    { value: 'mes', label: 'Mês/Ano' },
    { value: 'banco', label: 'Banco/Portador' },
    { value: 'pessoa', label: 'Cliente/Fornecedor' },
    { value: 'tipo', label: 'Tipo de documento' },
    { value: 'lancamento', label: 'Descrição de lançamento' },
  ],
  despesas: [
    { value: 'mes', label: 'Mês/Ano' },
    { value: 'banco', label: 'Banco/Portador' },
    { value: 'pessoa', label: 'Cliente/Fornecedor' },
    { value: 'tipo', label: 'Tipo de documento' },
    { value: 'lancamento', label: 'Descrição de lançamento' },
  ],
  comparativo: [
    { value: 'mes', label: 'Mês/Ano' },
    { value: 'banco', label: 'Banco/Portador' },
    { value: 'pessoa', label: 'Cliente/Fornecedor' },
    { value: 'tipo', label: 'Tipo de documento' },
  ],
};

const metricOptionsByBase: Record<FinanceiroBase, Option[]> = {
  receitas: [
    { value: 'valorMov', label: 'Valor movimentado' },
    { value: 'valorPrincipal', label: 'Valor a receber' },
    { value: 'valorDesconto', label: 'Desconto' },
    { value: 'valorJuros', label: 'Juros' },
    { value: 'valorOutras', label: 'Outras despesas' },
    { value: 'valorPisCofins', label: 'PIS + Cofins' },
    { value: 'quantidade', label: 'Quantidade de lançamentos' },
  ],
  despesas: [
    { value: 'valorMov', label: 'Valor movimentado' },
    { value: 'valorPrincipal', label: 'Valor a pagar' },
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

const getFinanceGroupInfo = (item: FinanceiroApiItem, groupBy: FinanceiroGroup) => {
  if (groupBy === 'mes') {
    const label = String(item?.Mes_Ano_Mov ?? item?.mes_Ano_Mov ?? item?.MesAnoMov ?? item?.mesAnoMov ?? '-').trim() || '-';
    return {
      key: normalizeText(label) || '-',
      label,
      order: toNumber(item?.Ordenacao_Mes_Ano ?? item?.ordenacao_Mes_Ano ?? item?.OrdenacaoMesAno ?? 0),
    };
  }

  if (groupBy === 'banco') {
    const label = String(item?.Nome_Banco ?? item?.nome_Banco ?? item?.nomeBanco ?? 'Sem banco').trim() || 'Sem banco';
    return { key: normalizeText(label) || 'sem-banco', label, order: 0 };
  }

  if (groupBy === 'pessoa') {
    const label = String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? item?.nomeFantasia ?? 'Não informado').trim() || 'Não informado';
    return { key: normalizeText(label) || 'nao-informado', label, order: 0 };
  }

  if (groupBy === 'tipo') {
    const label = String(item?.Tipo_Documento ?? item?.tipo_Documento ?? item?.tipoDocumento ?? 'Não informado').trim() || 'Não informado';
    return { key: normalizeText(label) || 'nao-informado', label, order: 0 };
  }

  const label = String(item?.Descricao_Lanc ?? item?.descricao_Lanc ?? item?.descricaoLanc ?? 'Não informado').trim() || 'Não informado';
  return { key: normalizeText(label) || 'nao-informado', label, order: 0 };
};

const buildFinanceRows = (
  base: FinanceiroBase,
  groupBy: FinanceiroGroup,
  metric: FinanceiroMetric,
  payload: DashboardFinanceiroResponse,
): {
  rows: DashboardRow[];
  series: DashboardSeries[];
  columns: DashboardTableColumn[];
} => {
  const receitas = payload.FluxoCaixaReceitas ?? [];
  const despesas = payload.FluxoCaixaDespesas ?? [];

  if (base === 'comparativo') {
    const grouped = new Map<string, DashboardRow>();

    const accumulate = (source: FinanceiroApiItem[], type: 'receitas' | 'despesas') => {
      for (const item of source) {
        const info = getFinanceGroupInfo(item, groupBy);
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

    const columns: DashboardTableColumn[] = [
      { key: 'label', label: 'Agrupamento', format: 'text' },
      { key: 'receitas', label: 'Receitas', format: 'currency' },
      { key: 'despesas', label: 'Despesas', format: 'currency' },
      { key: 'saldo', label: 'Saldo', format: 'currency' },
    ];

    return { rows: sorted, series, columns };
  }

  const source = base === 'receitas' ? receitas : despesas;

  const rows = groupSum(
    source,
    (item) => getFinanceGroupInfo(item, groupBy).key,
    (item) => getFinanceGroupInfo(item, groupBy).label,
    (item) => getFinanceGroupInfo(item, groupBy).order,
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

  const columns: DashboardTableColumn[] = [
    { key: 'label', label: 'Agrupamento', format: 'text' },
    { key: metric, label: series[0].label, format: metricFormat },
  ];

  return { rows: sorted, series, columns };
};

export function DashboardFinanceiroPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [codigoEmpresa, setCodigoEmpresa] = useState(() => String(GlobalConfig.getCodEmpresa() ?? ''));
  const [dataDe, setDataDe] = useState(monthStartPtBr());
  const [dataAte, setDataAte] = useState(todayPtBr());
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [chartType, setChartType] = useState<DashboardChartType>('bar');
  const [selectedData, setSelectedData] = useState<FinanceiroBase>('comparativo');
  const [groupBy, setGroupBy] = useState<FinanceiroGroup>('mes');
  const [metric, setMetric] = useState<FinanceiroMetric>('saldo');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardFinanceiroResponse>({ FluxoCaixaReceitas: [], FluxoCaixaDespesas: [] });
  const requestIdRef = useRef(0);

  const groupOptions = useMemo(() => groupOptionsByBase[selectedData], [selectedData]);
  const metricOptions = useMemo(() => metricOptionsByBase[selectedData], [selectedData]);

  useEffect(() => {
    if (!groupOptions.some((item) => item.value === groupBy)) {
      setGroupBy(groupOptions[0].value as FinanceiroGroup);
    }
  }, [groupBy, groupOptions]);

  useEffect(() => {
    if (!metricOptions.some((item) => item.value === metric)) {
      setMetric(metricOptions[0].value as FinanceiroMetric);
    }
  }, [metric, metricOptions]);

  const validateFilters = useCallback(
    (showErrors: boolean) => {
      const nextErrors: DashboardDateErrors = {};

      if (!String(codigoEmpresa).trim()) {
        nextErrors.codigoEmpresa = 'Informe a empresa para consultar.';
      }

      const parsedDe = parseDateStrict(dataDe);
      const parsedAte = parseDateStrict(dataAte);

      if (!parsedDe) nextErrors.dataDe = 'Data de inválida.';
      if (!parsedAte) nextErrors.dataAte = 'Data até inválida.';

      if (parsedDe && parsedAte && parsedDe.getTime() > parsedAte.getTime()) {
        nextErrors.dataDe = 'Data de não pode ser maior que Data até.';
        nextErrors.dataAte = 'Data até não pode ser menor que Data de.';
      }

      if (showErrors) setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [codigoEmpresa, dataAte, dataDe],
  );

  const fetchDashboard = useCallback(async () => {
    if (!validateFilters(true)) return;

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
        dataDe: toApiDate(dataDe),
        dataAte: toApiDate(dataAte),
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
      }
    }
  }, [codigoEmpresa, dataAte, dataDe, showToast, validateFilters]);

  useEffect(() => {
    if (!validateFilters(false)) return;

    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [codigoEmpresa, dataAte, dataDe, fetchDashboard, validateFilters]);

  const kpis = useMemo<DashboardKpiCard[]>(() => {
    const totalReceitas = (payload.FluxoCaixaReceitas ?? []).reduce(
      (acc, item) => acc + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0),
      0,
    );

    const totalDespesas = (payload.FluxoCaixaDespesas ?? []).reduce(
      (acc, item) => acc + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0),
      0,
    );

    return [
      { key: 'total-receitas', label: 'Total de receitas', value: totalReceitas, format: 'currency' },
      { key: 'total-despesas', label: 'Total de despesas', value: totalDespesas, format: 'currency' },
      { key: 'saldo-periodo', label: 'Saldo do período', value: totalReceitas - totalDespesas, format: 'currency' },
      { key: 'qtd-receitas', label: 'Lançamentos de receitas', value: payload.FluxoCaixaReceitas.length, format: 'number' },
      { key: 'qtd-despesas', label: 'Lançamentos de despesas', value: payload.FluxoCaixaDespesas.length, format: 'number' },
    ];
  }, [payload]);

  const processed = useMemo(() => buildFinanceRows(selectedData, groupBy, metric, payload), [groupBy, metric, payload, selectedData]);

  const chartRows = useMemo(() => {
    if ((chartType === 'pie' || chartType === 'donut') && processed.series[0]) {
      return limitRowsForPie(processed.rows, processed.series[0].key, 8);
    }

    return processed.rows;
  }, [chartType, processed.rows, processed.series]);

  const hasAnyData = payload.FluxoCaixaReceitas.length > 0 || payload.FluxoCaixaDespesas.length > 0;

  return (
    <main className="clientes-page list-layout-page dashboard-page">
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

        <div className="dashboard-header-actions">
          <button className="icon-button module-action-button" type="button" onClick={() => void fetchDashboard()} title="Atualizar" aria-label="Atualizar">
            <IoRefreshOutline size={16} />
          </button>
          <button
            className="icon-button module-action-button"
            type="button"
            onClick={() => {
              setCodigoEmpresa(String(GlobalConfig.getCodEmpresa() ?? ''));
              setDataDe(monthStartPtBr());
              setDataAte(todayPtBr());
              setErrors({});
              setErrorMessage('');
            }}
            title="Limpar filtros"
            aria-label="Limpar filtros"
          >
            <IoTrashOutline size={16} />
          </button>
        </div>
      </section>

      <DashboardFiltersBar
        codigoEmpresa={codigoEmpresa}
        dataDe={dataDe}
        dataAte={dataAte}
        errors={errors}
        loading={loading}
        onCodigoEmpresaChange={setCodigoEmpresa}
        onDataDeChange={setDataDe}
        onDataAteChange={setDataAte}
        onRefresh={() => void fetchDashboard()}
        onClear={() => {
          setCodigoEmpresa(String(GlobalConfig.getCodEmpresa() ?? ''));
          setDataDe(monthStartPtBr());
          setDataAte(todayPtBr());
          setErrors({});
          setErrorMessage('');
        }}
      />

      {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
      {loading ? <p className="module-empty">Carregando dashboard financeiro...</p> : null}
      {!loading && !errorMessage && !hasAnyData ? (
        <p className="module-empty">Nenhum dado encontrado para os filtros informados.</p>
      ) : null}

      {!loading && !errorMessage && hasAnyData ? (
        <>
          <DashboardKpiCards cards={kpis} />

          <DashboardConfigurator
            chartType={chartType}
            selectedData={selectedData}
            groupBy={groupBy}
            metric={metric}
            chartTypeOptions={chartTypeOptions}
            dataOptions={dataOptions}
            groupOptions={groupOptions}
            metricOptions={metricOptions}
            onChartTypeChange={setChartType}
            onSelectedDataChange={(value) => setSelectedData(value as FinanceiroBase)}
            onGroupByChange={(value) => setGroupBy(value as FinanceiroGroup)}
            onMetricChange={(value) => setMetric(value as FinanceiroMetric)}
          />

          <section className="card dashboard-chart-card">
            <header className="dashboard-section-header">
              <h2>Visualização principal</h2>
              <p>Os dados são reprocessados no frontend sempre que você altera base, agrupamento ou medida.</p>
            </header>
            <DashboardChart chartType={chartType} rows={chartRows} series={processed.series} xKey="label" />
          </section>

          <DashboardSummaryTable rows={processed.rows} columns={processed.columns} />
        </>
      ) : null}
    </main>
  );
}
