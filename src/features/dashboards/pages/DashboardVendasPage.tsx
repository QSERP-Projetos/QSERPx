import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAlertCircleOutline,
  IoArrowBack,
  IoFilterOutline,
  IoRefreshOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { DashboardChart } from '../components/DashboardChartPanel';
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
  normalizeText,
  parseDateStrict,
  sortRows,
  toApiDate,
  toNumber,
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
  { value: 'faturamento', label: 'Bloco: Faturamento' },
  { value: 'atraso', label: 'Bloco: Atraso' },
  { value: 'forecast', label: 'Bloco: Forecast' },
  { value: 'consolidado', label: 'Bloco: Visão consolidada' },
];

const agrupamentoPrincipalOptions: Option[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'regiao', label: 'Região' },
  { value: 'cliente', label: 'Cliente' },
];

const metricOptionsByBase: Record<VendasBase, Option[]> = {
  faturamento: [
    { value: 'valorTotal', label: 'Faturamento total' },
    { value: 'valorMercadoria', label: 'Mercadoria' },
    { value: 'valorImpostos', label: 'Impostos/adicionais' },
    { value: 'quantidadeRegistros', label: 'Quantidade de registros' },
  ],
  atraso: [
    { value: 'valorAtraso', label: 'Total em atraso' },
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
        if (groupBy === 'cliente') return normalizeText(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'sem-cliente') || 'sem-cliente';
        return normalizeText(item?.Tipo_Destinatario ?? item?.tipo_Destinatario ?? 'sem-tipo') || 'sem-tipo';
      },
      (item) => {
        if (groupBy === 'mes') return getMesInfo(item, 'faturamento').label;
        if (groupBy === 'vendedor') return String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? 'Sem vendedor').trim() || 'Sem vendedor';
        if (groupBy === 'regiao') return String(item?.Nome_Regiao ?? item?.nome_Regiao ?? 'Sem região').trim() || 'Sem região';
        if (groupBy === 'cliente') return String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'Sem cliente').trim() || 'Sem cliente';
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
    const metricLabel = metricOptionsByBase.faturamento.find((item) => item.value === metric)?.label || 'Valor';

    return {
      rows: sortRows(rows, metric),
      series: [{ key: metric, label: metricLabel, color: '#2563eb', format }],
      columns: [
        { key: 'label', label: 'Agrupamento', format: 'text' },
        { key: metric, label: metricLabel, format },
      ],
    };
  }

  if (base === 'atraso') {
    const rows = groupSum(
      atraso,
      (item) => {
        if (groupBy === 'cliente') return normalizeText(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'sem-cliente') || 'sem-cliente';
        if (groupBy === 'regiao') return normalizeText(item?.Nome_Regiao ?? item?.nome_Regiao ?? 'sem-regiao') || 'sem-regiao';
        if (groupBy === 'vendedor') return normalizeText(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? 'sem-vendedor') || 'sem-vendedor';
        if (groupBy === 'destino') return normalizeText(item?.Destino_Pedido ?? item?.destino_Pedido ?? 'sem-destino') || 'sem-destino';
        return normalizeText(item?.Tipo_Pedido ?? item?.tipo_Pedido ?? 'sem-tipo') || 'sem-tipo';
      },
      (item) => {
        if (groupBy === 'cliente') return String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? 'Sem cliente').trim() || 'Sem cliente';
        if (groupBy === 'regiao') return String(item?.Nome_Regiao ?? item?.nome_Regiao ?? 'Sem região').trim() || 'Sem região';
        if (groupBy === 'vendedor') return String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? 'Sem vendedor').trim() || 'Sem vendedor';
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
    const metricLabel = metricOptionsByBase.atraso.find((item) => item.value === metric)?.label || 'Valor';

    return {
      rows: sortRows(rows, metric),
      series: [{ key: metric, label: metricLabel, color: '#ef4444', format }],
      columns: [
        { key: 'label', label: 'Agrupamento', format: 'text' },
        { key: metric, label: metricLabel, format },
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

  const codigoEmpresa = useMemo(() => String(GlobalConfig.getCodEmpresa() ?? ''), []);

  const [appliedDataDe, setAppliedDataDe] = useState('');
  const [appliedDataAte, setAppliedDataAte] = useState('');
  const [draftDataDe, setDraftDataDe] = useState('');
  const [draftDataAte, setDraftDataAte] = useState('');
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [chartType, setChartType] = useState<DashboardChartType>('bar');
  const [selectedData, setSelectedData] = useState<VendasBase>('consolidado');
  const [groupBy, setGroupBy] = useState<VendasGroup>('vendedor');
  const [metric, setMetric] = useState<VendasMetric>('comparativoFatForecast');
  const [filtroDependente, setFiltroDependente] = useState('todos');

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardVendasResponse>({
    MoedasSemCotacao: [],
    Faturamento: [],
    Atraso: [],
    Forecast: [],
  });
  const requestIdRef = useRef(0);

  const groupOptions = useMemo(() => agrupamentoPrincipalOptions, []);
  const metricOptions = useMemo(() => metricOptionsByBase[selectedData], [selectedData]);

  const filtroDependenteMeta = useMemo(
    () => ({
      label: groupBy === 'regiao' ? 'Região' : groupBy === 'cliente' ? 'Cliente' : 'Vendedor',
      allLabel: groupBy === 'regiao' ? 'Todas' : 'Todos',
      placeholder: groupBy === 'regiao' ? 'Pesquisar região' : groupBy === 'cliente' ? 'Pesquisar cliente' : 'Pesquisar vendedor',
    }),
    [groupBy],
  );

  const filtroDependenteOptions = useMemo<Option[]>(() => {
    const labels = new Set<string>();

    if (groupBy === 'cliente') {
      for (const item of payload.Atraso) {
        const label = String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? '').trim();
        if (label) labels.add(label);
      }
    } else if (groupBy === 'regiao') {
      for (const item of payload.Faturamento) {
        const label = String(item?.Nome_Regiao ?? item?.nome_Regiao ?? '').trim();
        if (label) labels.add(label);
      }
    } else {
      for (const item of payload.Faturamento) {
        const label = String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? '').trim();
        if (label) labels.add(label);
      }
    }

    return [
      { value: 'todos', label: filtroDependenteMeta.allLabel },
      ...Array.from(labels)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((label) => ({ value: label, label })),
    ];
  }, [filtroDependenteMeta.allLabel, groupBy, payload.Atraso, payload.Faturamento]);

  useEffect(() => {
    if (!metricOptions.some((item) => item.value === metric)) {
      setMetric(metricOptions[0].value as VendasMetric);
    }
  }, [metric, metricOptions]);

  useEffect(() => {
    if (groupBy === 'cliente' && selectedData !== 'atraso') {
      setSelectedData('atraso');
    }
  }, [groupBy, selectedData]);

  useEffect(() => {
    if (!filtroDependenteOptions.some((item) => item.value === filtroDependente)) {
      setFiltroDependente('todos');
    }
  }, [filtroDependente, filtroDependenteOptions]);

  useEffect(() => {
    if (!advancedOpen) return;

    setDraftDataDe(appliedDataDe);
    setDraftDataAte(appliedDataAte);
    setErrors({});
  }, [advancedOpen, appliedDataAte, appliedDataDe]);

  const validateFilters = useCallback(() => {
    const nextErrors: DashboardDateErrors = {};

    if (!String(draftDataDe).trim()) {
      nextErrors.dataDe = 'Informe Data de.';
    }

    if (!String(draftDataAte).trim()) {
      nextErrors.dataAte = 'Informe Data até.';
    }

    const parsedDe = parseDateStrict(draftDataDe);
    const parsedAte = parseDateStrict(draftDataAte);

    if (draftDataDe.trim() && !parsedDe) nextErrors.dataDe = 'Data de inválida.';
    if (draftDataAte.trim() && !parsedAte) nextErrors.dataAte = 'Data até inválida.';

    if (parsedDe && parsedAte && parsedDe.getTime() > parsedAte.getTime()) {
      nextErrors.dataDe = 'Data de não pode ser maior que Data até.';
      nextErrors.dataAte = 'Data até não pode ser menor que Data de.';
    }

    if (!codigoEmpresa.trim()) {
      setErrorMessage('Empresa inválida para o dashboard. Faça login novamente.');
      setErrors(nextErrors);
      return false;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return false;

    return true;
  }, [codigoEmpresa, draftDataAte, draftDataDe]);

  const fetchDashboard = useCallback(async (filters: { dataDe: string; dataAte: string }) => {
    const parsedDe = parseDateStrict(filters.dataDe);
    const parsedAte = parseDateStrict(filters.dataAte);
    if (!parsedDe || !parsedAte) return;

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
        dataDe: toApiDate(filters.dataDe),
        dataAte: toApiDate(filters.dataAte),
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
        setHasFetched(true);
      }
    }
  }, [codigoEmpresa, showToast]);

  const kpis = useMemo<DashboardKpiCard[]>(() => {
    const matchesFilter = (value: string, selected: string) => {
      const selectedNormalized = normalizeText(selected);
      if (!selectedNormalized || selectedNormalized === 'todos') return true;
      return normalizeText(value) === selectedNormalized;
    };

    const filteredFaturamento = payload.Faturamento.filter((item) => {
      if (groupBy === 'cliente') return true;
      const target = groupBy === 'regiao' ? String(item?.Nome_Regiao ?? item?.nome_Regiao ?? '').trim() : String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? '').trim();
      return matchesFilter(target, filtroDependente);
    });

    const filteredAtraso = payload.Atraso.filter((item) => {
      if (groupBy !== 'cliente') return true;
      const cliente = String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? '').trim();
      return matchesFilter(cliente, filtroDependente);
    });

    const totalFaturamento = filteredFaturamento.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0),
      0,
    );

    const totalAtraso = filteredAtraso.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Atraso_Periodo ?? item?.valor_Atraso_Periodo ?? item?.valorAtrasoPeriodo ?? 0),
      0,
    );

    const totalForecast = payload.Forecast.reduce(
      (acc, item) => acc + toNumber(item?.Valor_Previsto_Periodo ?? item?.valor_Previsto_Periodo ?? item?.valorPrevistoPeriodo ?? 0),
      0,
    );

    const vendedores = new Set(
      filteredFaturamento.map((item) => String(item?.Codigo_Vendedor ?? item?.codigo_Vendedor ?? item?.codigoVendedor ?? '').trim()),
    );

    const regioes = new Set(filteredFaturamento.map((item) => String(item?.Nome_Regiao ?? item?.nome_Regiao ?? '').trim()));
    const clientesAtraso = new Set(filteredAtraso.map((item) => String(item?.Codigo_Cliente ?? item?.codigo_Cliente ?? '').trim()));

    return [
      { key: 'total-faturamento', label: 'Faturamento total', value: totalFaturamento, format: 'currency' },
      { key: 'total-atraso', label: 'Total em atraso', value: totalAtraso, format: 'currency' },
      { key: 'total-forecast', label: 'Total previsto (forecast)', value: totalForecast, format: 'currency' },
      { key: 'qtd-vendedores', label: 'Quantidade de vendedores', value: vendedores.size, format: 'number' },
      { key: 'qtd-regioes', label: 'Quantidade de regiões', value: regioes.size, format: 'number' },
      { key: 'qtd-clientes-atraso', label: 'Clientes com atraso', value: clientesAtraso.size, format: 'number' },
    ];
  }, [filtroDependente, groupBy, payload]);

  const filteredPayload = useMemo<DashboardVendasResponse>(() => {
    const matchesFilter = (value: string, selected: string) => {
      const selectedNormalized = normalizeText(selected);
      if (!selectedNormalized || selectedNormalized === 'todos') return true;
      return normalizeText(value) === selectedNormalized;
    };

    const filteredFaturamento = payload.Faturamento.filter((item) => {
      if (groupBy === 'cliente') return true;
      const target = groupBy === 'regiao' ? String(item?.Nome_Regiao ?? item?.nome_Regiao ?? '').trim() : String(item?.Nome_Vendedor ?? item?.nome_Vendedor ?? '').trim();
      return matchesFilter(target, filtroDependente);
    });

    const filteredAtraso = payload.Atraso.filter((item) => {
      if (groupBy !== 'cliente') return true;
      const cliente = String(item?.Nome_Fantasia ?? item?.nome_Fantasia ?? '').trim();
      return matchesFilter(cliente, filtroDependente);
    });

    return {
      ...payload,
      Faturamento: filteredFaturamento,
      Atraso: filteredAtraso,
    };
  }, [filtroDependente, groupBy, payload]);

  const processed = useMemo(
    () => buildVendasRows(selectedData, groupBy, metric, filteredPayload),
    [filteredPayload, groupBy, metric, selectedData],
  );

  const displayedRows = processed.rows;

  const chartRows = useMemo(() => {
    if ((chartType === 'pie' || chartType === 'donut') && processed.series[0]) {
      return limitRowsForPie(displayedRows, processed.series[0].key, 8);
    }

    return displayedRows;
  }, [chartType, displayedRows, processed.series]);

  const secondaryChartRows = useMemo(() => {
    if (!processed.series[0]) return [] as DashboardRow[];
    const metricKey = processed.series[0].key;
    return [...displayedRows]
      .sort((a, b) => Number(b[metricKey] ?? 0) - Number(a[metricKey] ?? 0))
      .slice(0, 8);
  }, [displayedRows, processed.series]);

  const hasAnyData = filteredPayload.Faturamento.length > 0 || filteredPayload.Atraso.length > 0 || filteredPayload.Forecast.length > 0;
  const hasDataAfterSearch = displayedRows.length > 0;

  return (
    <main className="clientes-page list-layout-page dashboard-page dashboard-vendas-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>

          <div>
            <h1>Dashboard - Vendas</h1>
            <p>Visão dinâmica de faturamento, atraso e forecast com visualizações configuráveis.</p>
          </div>
        </div>
      </section>

      <AdvancedFiltersPanel
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        onApply={() => {
          if (!validateFilters()) return;

          setAppliedDataDe(draftDataDe);
          setAppliedDataAte(draftDataAte);

          setAdvancedOpen(false);
          void fetchDashboard({ dataDe: draftDataDe, dataAte: draftDataAte });
        }}
        applyLabel="Aplicar"
        cancelLabel="Fechar"
      >
        <div className="dashboard-vendas-advanced-grid">
          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-vendas-date-field">
            <span>Data de</span>
            <CustomDatePicker value={draftDataDe} onChange={setDraftDataDe} className={errors.dataDe ? 'pcp-date-error' : undefined} />
            <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-vendas-date-field">
            <span>Data até</span>
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
              onChange={(value) => setSelectedData(value as VendasBase)}
              options={dataOptions}
              searchPlaceholder="Pesquisar bloco"
              ariaLabel="Dados a exibir"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Agrupar por</span>
            <SearchableSelect
              value={groupBy}
              onChange={(value) => setGroupBy(value as VendasGroup)}
              options={groupOptions}
              searchPlaceholder="Pesquisar agrupamento"
              ariaLabel="Agrupar por"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>{filtroDependenteMeta.label}</span>
            <SearchableSelect
              value={filtroDependente}
              onChange={setFiltroDependente}
              options={filtroDependenteOptions}
              searchPlaceholder={filtroDependenteMeta.placeholder}
              ariaLabel={filtroDependenteMeta.label}
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field">
            <span>Tipo de valor</span>
            <SearchableSelect
              value={metric}
              onChange={(value) => setMetric(value as VendasMetric)}
              options={metricOptions}
              searchPlaceholder="Pesquisar métrica"
              ariaLabel="Tipo de valor"
            />
          </label>

        </div>
      </AdvancedFiltersPanel>

      <section className="card dashboard-vendas-results">
        <div className="dashboard-vendas-controls-inline dashboard-vendas-results__actions">
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

        {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
        {loading ? <p className="module-empty">Carregando dashboard de vendas...</p> : null}

        {!loading && !errorMessage && !hasFetched ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Preencha os filtros e clique em atualizar para visualizar os gráficos</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && (!hasAnyData || !hasDataAfterSearch) ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Nenhum dado encontrado para os filtros informados</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && hasAnyData && hasDataAfterSearch ? (
          <>
            <DashboardKpiCards cards={kpis} />

            <section className="dashboard-chart-grid">
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header">
                  <h2>Visualização principal</h2>
                  <p>Altere o tipo de gráfico e os agrupamentos nos filtros avançados.</p>
                </header>
                <DashboardChart chartType={chartType} rows={chartRows} series={processed.series} xKey="label" />
              </article>

              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header">
                  <h2>Top agrupamentos</h2>
                  <p>Resumo dos principais grupos para leitura rápida.</p>
                </header>
                <DashboardChart chartType="bar-horizontal" rows={secondaryChartRows} series={processed.series} xKey="label" />
              </article>
            </section>

            <DashboardSummaryTable rows={displayedRows} columns={processed.columns} />
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
