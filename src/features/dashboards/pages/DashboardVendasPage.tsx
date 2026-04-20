import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAlertCircleOutline, IoArrowBack, IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { DashboardChart } from '../components/DashboardChart';
import { DashboardConfigurator } from '../components/DashboardConfigurator';
import { DashboardFiltersBar } from '../components/DashboardFiltersBar';
import { DashboardKpiCards } from '../components/DashboardKpiCards';
import { DashboardSummaryTable } from '../components/DashboardSummaryTable';
import { getDashboardVendas, type DashboardVendasResponse } from '../services/dashboardApi';
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

type VendasBase = 'faturamento' | 'atraso' | 'forecast' | 'consolidado';
type VendasGroup = 'mes' | 'vendedor' | 'regiao' | 'tipoDestinatario' | 'cliente' | 'destino' | 'resumo';
type VendasMetric =
  | 'valorTotal'
  | 'valorMercadoria'
  | 'valorImpostos'
  | 'quantidadeRegistros'
  | 'valorAtraso'
  | 'clientesAtraso'
  | 'valorPrevisto'
  | 'comparativoFatForecast'
  | 'comparativoAtrasoForecast';

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
  { value: 'faturamento', label: 'Bloco: Faturamento' },
  { value: 'atraso', label: 'Bloco: Atraso' },
  { value: 'forecast', label: 'Bloco: Forecast' },
  { value: 'consolidado', label: 'Bloco: Visão consolidada' },
];

const groupOptionsByBase: Record<VendasBase, Option[]> = {
  faturamento: [
    { value: 'mes', label: 'Mês de faturamento' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'regiao', label: 'Região' },
    { value: 'tipoDestinatario', label: 'Tipo de destinatário' },
  ],
  atraso: [
    { value: 'cliente', label: 'Cliente' },
    { value: 'destino', label: 'Destino do pedido' },
    { value: 'tipoDestinatario', label: 'Tipo de pedido' },
  ],
  forecast: [{ value: 'mes', label: 'Mês de entrega' }],
  consolidado: [
    { value: 'mes', label: 'Comparativo por mês' },
    { value: 'resumo', label: 'Resumo consolidado' },
  ],
};

const metricOptionsByBase: Record<VendasBase, Option[]> = {
  faturamento: [
    { value: 'valorTotal', label: 'Valor total de faturamento' },
    { value: 'valorMercadoria', label: 'Valor de mercadoria' },
    { value: 'valorImpostos', label: 'Impostos e adicionais' },
    { value: 'quantidadeRegistros', label: 'Quantidade de registros' },
  ],
  atraso: [
    { value: 'valorAtraso', label: 'Valor total em atraso' },
    { value: 'clientesAtraso', label: 'Clientes com atraso (qtd registros)' },
  ],
  forecast: [{ value: 'valorPrevisto', label: 'Valor previsto no forecast' }],
  consolidado: [
    { value: 'comparativoFatForecast', label: 'Comparação faturamento x forecast' },
    { value: 'comparativoAtrasoForecast', label: 'Comparação atraso x forecast' },
  ],
};

const getMesInfo = (item: Record<string, any>, prefix: 'faturamento' | 'forecast') => {
  if (prefix === 'faturamento') {
    const label = String(item?.Mes_Faturamento ?? item?.mes_Faturamento ?? item?.mesFaturamento ?? '-').trim() || '-';
    return {
      key: normalizeText(label) || '-',
      label,
      order: toNumber(item?.Ordenacao_Mes_Ano ?? item?.ordenacao_Mes_Ano ?? 0),
    };
  }

  const label = String(item?.Mes_Ano_Entrega ?? item?.mes_Ano_Entrega ?? item?.mesAnoEntrega ?? '-').trim() || '-';
  return {
    key: normalizeText(label) || '-',
    label,
    order: toNumber(item?.Ordenacao_Mes_Ano_Entrega ?? item?.ordenacao_Mes_Ano_Entrega ?? 0),
  };
};

const buildVendasRows = (
  base: VendasBase,
  groupBy: VendasGroup,
  metric: VendasMetric,
  payload: DashboardVendasResponse,
): {
  rows: DashboardRow[];
  series: DashboardSeries[];
  columns: DashboardTableColumn[];
} => {
  const faturamento = payload.Faturamento ?? [];
  const atraso = payload.Atraso ?? [];
  const forecast = payload.Forecast ?? [];

  if (base === 'faturamento') {
    const rows = groupSum(
      faturamento,
      (item) => {
        if (groupBy === 'mes') return getMesInfo(item, 'faturamento').key;
        if (groupBy === 'vendedor') return normalizeText(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? 'sem-vendedor') || 'sem-vendedor';
        if (groupBy === 'regiao') return normalizeText(item?.Nome_Regiao ?? item?.nome_Regiao ?? 'sem-regiao') || 'sem-regiao';
        return normalizeText(item?.Tipo_Destinatario ?? item?.tipo_Destinatario ?? 'sem-tipo') || 'sem-tipo';
      },
      (item) => {
        if (groupBy === 'mes') return getMesInfo(item, 'faturamento').label;
        if (groupBy === 'vendedor') return String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? 'Sem vendedor').trim() || 'Sem vendedor';
        if (groupBy === 'regiao') return String(item?.Nome_Regiao ?? item?.nome_Regiao ?? 'Sem região').trim() || 'Sem região';
        return String(item?.Tipo_Destinatario ?? item?.tipo_Destinatario ?? 'Sem tipo').trim() || 'Sem tipo';
      },
      (item) => (groupBy === 'mes' ? getMesInfo(item, 'faturamento').order : 0),
      {
        valorTotal: (item) => toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0),
        valorMercadoria: (item) => toNumber(item?.Valor_Mercadoria ?? item?.valor_Mercadoria ?? item?.valorMercadoria ?? 0),
        valorImpostos: (item) =>
          toNumber(item?.Valor_Impostos_E_Adicionais ?? item?.valor_Impostos_E_Adicionais ?? item?.valorImpostosEAdicionais ?? 0),
        quantidadeRegistros: () => 1,
      },
    );

    const format = metric === 'quantidadeRegistros' ? 'number' : 'currency';

    return {
      rows: sortRows(rows, metric),
      series: [{ key: metric, label: metricOptionsByBase.faturamento.find((item) => item.value === metric)?.label || 'Valor', color: '#2563eb', format }],
      columns: [
        { key: 'label', label: 'Agrupamento', format: 'text' },
        { key: metric, label: metricOptionsByBase.faturamento.find((item) => item.value === metric)?.label || 'Valor', format },
      ],
    };
  }

  if (base === 'atraso') {
    const rows = groupSum(
      atraso,
      (item) => {
        if (groupBy === 'cliente') return normalizeText(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'sem-cliente') || 'sem-cliente';
        if (groupBy === 'destino') return normalizeText(item?.Destino_Pedido ?? item?.destino_Pedido ?? 'sem-destino') || 'sem-destino';
        return normalizeText(item?.Tipo_Pedido ?? item?.tipo_Pedido ?? 'sem-tipo') || 'sem-tipo';
      },
      (item) => {
        if (groupBy === 'cliente') return String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'Sem cliente').trim() || 'Sem cliente';
        if (groupBy === 'destino') return String(item?.Destino_Pedido ?? item?.destino_Pedido ?? 'Sem destino').trim() || 'Sem destino';
        return String(item?.Tipo_Pedido ?? item?.tipo_Pedido ?? 'Sem tipo').trim() || 'Sem tipo';
      },
      () => 0,
      {
        valorAtraso: (item) => toNumber(item?.Valor_Atraso_Periodo ?? item?.valor_Atraso_Periodo ?? item?.valorAtrasoPeriodo ?? 0),
        clientesAtraso: () => 1,
      },
    );

    const format = metric === 'clientesAtraso' ? 'number' : 'currency';

    return {
      rows: sortRows(rows, metric),
      series: [{ key: metric, label: metricOptionsByBase.atraso.find((item) => item.value === metric)?.label || 'Valor', color: '#ef4444', format }],
      columns: [
        { key: 'label', label: 'Agrupamento', format: 'text' },
        { key: metric, label: metricOptionsByBase.atraso.find((item) => item.value === metric)?.label || 'Valor', format },
      ],
    };
  }

  if (base === 'forecast') {
    const rows = groupSum(
      forecast,
      (item) => getMesInfo(item, 'forecast').key,
      (item) => getMesInfo(item, 'forecast').label,
      (item) => getMesInfo(item, 'forecast').order,
      {
        valorPrevisto: (item) => toNumber(item?.Valor_Previsto_Periodo ?? item?.valor_Previsto_Periodo ?? item?.valorPrevistoPeriodo ?? 0),
      },
    );

    return {
      rows: sortRows(rows, 'valorPrevisto'),
      series: [{ key: 'valorPrevisto', label: 'Valor previsto', color: '#0ea5e9', format: 'currency' }],
      columns: [
        { key: 'label', label: 'Mês', format: 'text' },
        { key: 'valorPrevisto', label: 'Valor previsto', format: 'currency' },
      ],
    };
  }

  if (groupBy === 'mes' && metric === 'comparativoFatForecast') {
    const grouped = new Map<string, DashboardRow>();

    for (const item of faturamento) {
      const info = getMesInfo(item, 'faturamento');
      const row = grouped.get(info.key) || { key: info.key, label: info.label, order: info.order, faturamento: 0, forecast: 0 };
      row.faturamento = Number(row.faturamento ?? 0) + toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
      if (!row.order && info.order) row.order = info.order;
      grouped.set(info.key, row);
    }

    for (const item of forecast) {
      const info = getMesInfo(item, 'forecast');
      const row = grouped.get(info.key) || { key: info.key, label: info.label, order: info.order, faturamento: 0, forecast: 0 };
      row.forecast = Number(row.forecast ?? 0) + toNumber(item?.Valor_Previsto_Periodo ?? item?.valor_Previsto_Periodo ?? 0);
      if (!row.order && info.order) row.order = info.order;
      grouped.set(info.key, row);
    }

    const rows = sortRows(Array.from(grouped.values()), 'faturamento');

    return {
      rows,
      series: [
        { key: 'faturamento', label: 'Faturamento', color: '#2563eb', format: 'currency' },
        { key: 'forecast', label: 'Forecast', color: '#0ea5e9', format: 'currency' },
      ],
      columns: [
        { key: 'label', label: 'Mês', format: 'text' },
        { key: 'faturamento', label: 'Faturamento', format: 'currency' },
        { key: 'forecast', label: 'Forecast', format: 'currency' },
      ],
    };
  }

  const totalFaturamento = faturamento.reduce(
    (acc, item) => acc + toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0),
    0,
  );
  const totalAtraso = atraso.reduce(
    (acc, item) => acc + toNumber(item?.Valor_Atraso_Periodo ?? item?.valor_Atraso_Periodo ?? item?.valorAtrasoPeriodo ?? 0),
    0,
  );
  const totalForecast = forecast.reduce(
    (acc, item) => acc + toNumber(item?.Valor_Previsto_Periodo ?? item?.valor_Previsto_Periodo ?? item?.valorPrevistoPeriodo ?? 0),
    0,
  );

  const rows: DashboardRow[] =
    metric === 'comparativoAtrasoForecast'
      ? [
          { key: 'atraso', label: 'Atraso', valor: totalAtraso },
          { key: 'forecast', label: 'Forecast', valor: totalForecast },
        ]
      : [
          { key: 'faturamento', label: 'Faturamento', valor: totalFaturamento },
          { key: 'forecast', label: 'Forecast', valor: totalForecast },
        ];

  return {
    rows,
    series: [{ key: 'valor', label: 'Valor', color: '#2563eb', format: 'currency' }],
    columns: [
      { key: 'label', label: 'Indicador', format: 'text' },
      { key: 'valor', label: 'Valor', format: 'currency' },
    ],
  };
};

export function DashboardVendasPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [codigoEmpresa, setCodigoEmpresa] = useState(() => String(GlobalConfig.getCodEmpresa() ?? ''));
  const [dataDe, setDataDe] = useState(monthStartPtBr());
  const [dataAte, setDataAte] = useState(todayPtBr());
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [chartType, setChartType] = useState<DashboardChartType>('bar');
  const [selectedData, setSelectedData] = useState<VendasBase>('consolidado');
  const [groupBy, setGroupBy] = useState<VendasGroup>('mes');
  const [metric, setMetric] = useState<VendasMetric>('comparativoFatForecast');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardVendasResponse>({
    MoedasSemCotacao: [],
    Faturamento: [],
    Atraso: [],
    Forecast: [],
  });
  const requestIdRef = useRef(0);

  const groupOptions = useMemo(() => groupOptionsByBase[selectedData], [selectedData]);
  const metricOptions = useMemo(() => metricOptionsByBase[selectedData], [selectedData]);

  useEffect(() => {
    if (!groupOptions.some((item) => item.value === groupBy)) {
      setGroupBy(groupOptions[0].value as VendasGroup);
    }
  }, [groupBy, groupOptions]);

  useEffect(() => {
    if (!metricOptions.some((item) => item.value === metric)) {
      setMetric(metricOptions[0].value as VendasMetric);
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
      setErrorMessage('Sessão inválida para consultar o dashboard de vendas.');
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setErrorMessage('');

      const result = await getDashboardVendas({
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
      const message = String(error?.message || 'Erro ao carregar dashboard de vendas.');
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
    const totalFaturamento = payload.Faturamento.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0),
      0,
    );

    const totalAtraso = payload.Atraso.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Atraso_Periodo ?? item?.valor_Atraso_Periodo ?? item?.valorAtrasoPeriodo ?? 0),
      0,
    );

    const totalForecast = payload.Forecast.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Previsto_Periodo ?? item?.valor_Previsto_Periodo ?? item?.valorPrevistoPeriodo ?? 0),
      0,
    );

    const vendedores = new Set(
      payload.Faturamento.map((item) => String(item?.Codigo_Vendedor ?? item?.codigo_Vendedor ?? item?.codigoVendedor ?? '').trim()),
    );

    const regioes = new Set(payload.Faturamento.map((item) => String(item?.Nome_Regiao ?? item?.nome_Regiao ?? '').trim()));
    const clientesAtraso = new Set(payload.Atraso.map((item) => String(item?.Codigo_Cliente ?? item?.codigo_Cliente ?? '').trim()));

    return [
      { key: 'total-faturamento', label: 'Faturamento total', value: totalFaturamento, format: 'currency' },
      { key: 'total-atraso', label: 'Total em atraso', value: totalAtraso, format: 'currency' },
      { key: 'total-forecast', label: 'Total previsto (forecast)', value: totalForecast, format: 'currency' },
      { key: 'qtd-vendedores', label: 'Quantidade de vendedores', value: vendedores.size, format: 'number' },
      { key: 'qtd-regioes', label: 'Quantidade de regiões', value: regioes.size, format: 'number' },
      { key: 'qtd-clientes-atraso', label: 'Clientes com atraso', value: clientesAtraso.size, format: 'number' },
    ];
  }, [payload]);

  const processed = useMemo(() => buildVendasRows(selectedData, groupBy, metric, payload), [groupBy, metric, payload, selectedData]);

  const chartRows = useMemo(() => {
    if ((chartType === 'pie' || chartType === 'donut') && processed.series[0]) {
      return limitRowsForPie(processed.rows, processed.series[0].key, 8);
    }

    return processed.rows;
  }, [chartType, processed.rows, processed.series]);

  const hasAnyData = payload.Faturamento.length > 0 || payload.Atraso.length > 0 || payload.Forecast.length > 0;

  return (
    <main className="clientes-page list-layout-page dashboard-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>

          <div>
            <h1>Dashboard - Vendas</h1>
            <p>Visão dinâmica de faturamento, atraso e forecast com comparativos configuráveis.</p>
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

      {payload.MoedasSemCotacao.length > 0 ? (
        <p className="status-box status-box--error dashboard-alert-row">
          <IoAlertCircleOutline size={18} />
          Existem moedas sem cotação no período. Verifique antes de tomar decisões baseadas nos totais.
        </p>
      ) : null}

      {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
      {loading ? <p className="module-empty">Carregando dashboard de vendas...</p> : null}
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
            onSelectedDataChange={(value) => setSelectedData(value as VendasBase)}
            onGroupByChange={(value) => setGroupBy(value as VendasGroup)}
            onMetricChange={(value) => setMetric(value as VendasMetric)}
          />

          <section className="card dashboard-chart-card">
            <header className="dashboard-section-header">
              <h2>Visualização principal</h2>
              <p>Troque entre blocos de faturamento, atraso, forecast e visão consolidada sem recarregar a página.</p>
            </header>
            <DashboardChart chartType={chartType} rows={chartRows} series={processed.series} xKey="label" />
          </section>

          <DashboardSummaryTable rows={processed.rows} columns={processed.columns} />
        </>
      ) : null}
    </main>
  );
}
