import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAlertCircleOutline,
  IoArrowBack,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoDownloadOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import * as XLSX from 'xlsx';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { DashboardKpiCards } from '../components/DashboardKpiCards';
import { DashboardSummaryTable } from '../components/DashboardSummaryTable';
import { getDashboardVendas, type DashboardVendasResponse } from '../services/dashboardApi';
import type { DashboardDateErrors, DashboardKpiCard, DashboardRow, DashboardTableColumn } from '../types';
import { chartPalette, formatCurrencyBRL, monthEndPtBr, monthStartPtBr, normalizeText, parseDateStrict, toApiDate, toNumber } from '../utils/dashboardUtils';

type RegionSlice = {
  key: string;
  label: string;
  total: number;
  topClients: Array<{ label: string; total: number }>;
};

type ClientItemTop = {
  key: string;
  label: string;
  total: number;
};

type TopClientByBillingType = {
  key: string;
  client: string;
  billingType: string;
  total: number;
  topItems: ClientItemTop[];
};

const getText = (value: unknown) => String(value ?? '').trim();

const pickFirstText = (item: Record<string, any>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = getText(item?.[key]);
    if (value) return value;
  }
  return fallback;
};

const getRegionLabel = (item: Record<string, any>) =>
  pickFirstText(item, ['Nome_Regiao', 'nome_Regiao', 'nomeRegiao', 'Regiao', 'regiao'], 'Sem região');

const getClientLabel = (item: Record<string, any>) =>
  pickFirstText(
    item,
    [
      'Nome_Destinatario',
      'nome_Destinatario',
      'nomeDestinatario',
      'Nome_Fantasia',
      'nome_Fantasia',
      'nomeFantasia',
      'Razao_Social',
      'razao_Social',
    ],
    'Sem cliente',
  );

const getBillingTypeLabel = (item: Record<string, any>) =>
  pickFirstText(
    item,
    [
      'Tipo_Faturamento',
      'tipo_Faturamento',
      'tipoFaturamento',
      'Tipo_Destinatario',
      'tipo_Destinatario',
      'tipoDestinatario',
      'Tipo_Cliente',
      'tipo_Cliente',
      'tipoCliente',
    ],
    'Sem tipo',
  );

const formatBillingTypeDisplay = (value: string) => {
  const normalized = normalizeText(value);

  if (normalized === 'c' || normalized === 'cliente' || normalized.startsWith('c ') || normalized.startsWith('cliente')) {
    return 'Cliente';
  }

  if (normalized === 'f' || normalized === 'fornecedor' || normalized.startsWith('f ') || normalized.startsWith('fornecedor')) {
    return 'Fornecedor';
  }

  return value || 'Sem tipo';
};

const getAtrasoValue = (item: Record<string, any>) =>
  toNumber(
    item?.Valor_Atraso_Periodo ??
      item?.valor_Atraso_Periodo ??
      item?.valorAtrasoPeriodo ??
      item?.Valor_Atraso ??
      item?.valor_Atraso ??
      item?.valorAtraso ??
      item?.Valor_Total ??
      item?.valor_Total ??
      item?.valorTotal ??
      0,
  );

const getForecastValue = (item: Record<string, any>) =>
  toNumber(
    item?.Valor_Previsto_Periodo ??
      item?.valor_Previsto_Periodo ??
      item?.valorPrevistoPeriodo ??
      item?.Valor_Forecast ??
      item?.valor_Forecast ??
      item?.valorForecast ??
      item?.Valor_Total ??
      item?.valor_Total ??
      item?.valorTotal ??
      0,
  );

const getMaterials = (item: Record<string, any>) => {
  const value = item?.Materiais ?? item?.materiais;
  return Array.isArray(value) ? value : [];
};

const readImpostosAdicionais = (item: Record<string, any>) => {
  const directValue =
    item?.Valor_Impostos_E_Adicionais ??
    item?.valor_Impostos_E_Adicionais ??
    item?.valor_Impostos_e_Adicionais ??
    item?.valor_impostos_e_adicionais ??
    item?.valorImpostosEAdicionais;

  if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
    return toNumber(directValue);
  }

  for (const [key, rawValue] of Object.entries(item ?? {})) {
    const normalizedKey = normalizeText(key).replace(/[^a-z0-9]/g, '');
    if (normalizedKey.includes('imposto') && normalizedKey.includes('adicion')) {
      return toNumber(rawValue);
    }
  }

  return 0;
};

const getProductLabel = (item: Record<string, any>) => {
  const codigo = pickFirstText(item, ['Codigo_Material', 'codigo_Material', 'codigoMaterial', 'Codigo_Produto', 'codigo_Produto', 'codigoProduto']);
  const descricao = pickFirstText(
    item,
    [
      'Descricao_Material',
      'descricao_Material',
      'descricaoMaterial',
      'Descricao_Produto',
      'descricao_Produto',
      'descricaoProduto',
      'Nome_Produto',
      'nome_Produto',
      'nomeProduto',
    ],
  );

  if (codigo && descricao) return `${codigo} - ${descricao}`;
  if (descricao) return descricao;
  if (codigo) return codigo;

  return pickFirstText(item, ['Produto', 'produto'], 'Sem produto');
};

export function DashboardVendasPage() {
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
  const [activeRegionKey, setActiveRegionKey] = useState<string | null>(null);
  const [expandedTopClients, setExpandedTopClients] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardVendasResponse>({
    MoedasSemCotacao: [],
    Faturamento: [],
    Atraso: [],
    Forecast: [],
  });

  const initialFetchRef = useRef(false);
  const requestIdRef = useRef(0);

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

  useEffect(() => {
    if (initialFetchRef.current) return;
    if (!appliedDataDe || !appliedDataAte) return;

    initialFetchRef.current = true;
    void fetchDashboard({ dataDe: appliedDataDe, dataAte: appliedDataAte });
  }, [appliedDataAte, appliedDataDe, fetchDashboard]);

  const kpis = useMemo<DashboardKpiCard[]>(() => {
    const faturamento = payload.Faturamento ?? [];
    const atraso = payload.Atraso ?? [];
    const forecast = payload.Forecast ?? [];

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

    const totalPorProduto = faturamento.reduce(
      (acc, item) =>
        acc +
        toNumber(
          item?.Valor_Mercadoria ??
            item?.valor_Mercadoria ??
            item?.valorMercadoria ??
            item?.Valor_Produto ??
            item?.valor_Produto ??
            item?.valorProduto ??
            0,
        ),
      0,
    );

    const totalImpostos = faturamento.reduce((acc, rawItem) => {
      const item = (rawItem ?? {}) as Record<string, any>;
      const impostosLinha = readImpostosAdicionais(item);

      if (impostosLinha !== 0) {
        return acc + impostosLinha;
      }

      const materiais = getMaterials(item);
      if (!materiais.length) return acc;

      const impostosMateriais = materiais.reduce((materialAcc, materialRaw) => {
        const material = (materialRaw ?? {}) as Record<string, any>;
        return materialAcc + readImpostosAdicionais(material);
      }, 0);

      return acc + impostosMateriais;
    }, 0);

    const clientesFaturados = new Set(
      faturamento.map((item) => getClientLabel(item)).filter((label) => normalizeText(label) !== normalizeText('Sem cliente')),
    );

    return [
      { key: 'total-faturamento', label: 'Faturamento total', value: totalFaturamento, format: 'currency' },
      { key: 'total-por-produto', label: 'Total por produto', value: totalPorProduto, format: 'currency' },
      { key: 'total-impostos', label: 'Total de impostos', value: totalImpostos, format: 'currency' },
      { key: 'total-atraso', label: 'Total em atraso', value: totalAtraso, format: 'currency' },
      { key: 'total-forecast', label: 'Total previsto (forecast)', value: totalForecast, format: 'currency' },
      { key: 'qtd-clientes-faturados', label: 'Clientes faturados', value: clientesFaturados.size, format: 'number' },
    ];
  }, [payload]);

  const regionSlices = useMemo<RegionSlice[]>(() => {
    const regionMap = new Map<string, { label: string; total: number; clients: Map<string, number> }>();

    for (const rawItem of payload.Faturamento ?? []) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const regionLabel = getRegionLabel(item);
      const clientLabel = getClientLabel(item);
      const value = toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
      const regionKey = normalizeText(regionLabel) || 'sem-regiao';

      const region = regionMap.get(regionKey) || { label: regionLabel, total: 0, clients: new Map<string, number>() };
      region.total += value;
      region.clients.set(clientLabel, (region.clients.get(clientLabel) ?? 0) + value);
      regionMap.set(regionKey, region);
    }

    return Array.from(regionMap.entries())
      .map(([key, region]) => ({
        key,
        label: region.label,
        total: region.total,
        topClients: Array.from(region.clients.entries())
          .map(([label, total]) => ({ label, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total);
  }, [payload.Faturamento]);

  const topClientsByBillingType = useMemo<TopClientByBillingType[]>(() => {
    const topClientMap = new Map<string, { client: string; billingType: string; total: number; topItems: Map<string, { label: string; total: number }> }>();

    for (const rawItem of payload.Faturamento ?? []) {
      const faturamentoItem = (rawItem ?? {}) as Record<string, any>;
      const client = getClientLabel(faturamentoItem);
      const billingType = getBillingTypeLabel(faturamentoItem);
      const rowValue = toNumber(faturamentoItem?.Valor_Total ?? faturamentoItem?.valor_Total ?? faturamentoItem?.valorTotal ?? 0);
      const rowKey = `${normalizeText(billingType) || 'sem-tipo'}::${normalizeText(client) || 'sem-cliente'}`;
      const rowCurrent =
        topClientMap.get(rowKey) || {
          client,
          billingType,
          total: 0,
          topItems: new Map<string, { label: string; total: number }>(),
        };

      rowCurrent.total += rowValue;

      const materiais = getMaterials(faturamentoItem);

      if (materiais.length > 0) {
        for (const materialRaw of materiais) {
          const materialItem = (materialRaw ?? {}) as Record<string, any>;
          const label = getProductLabel(materialItem);
          const key = normalizeText(label) || 'sem-produto';
          const value = toNumber(
            materialItem?.Valor_Total ?? materialItem?.valor_Total ?? materialItem?.valorTotal ?? materialItem?.Valor_Mercadoria ?? materialItem?.valor_Mercadoria ?? 0,
          );

          const topItemCurrent = rowCurrent.topItems.get(key) || { label, total: 0 };
          topItemCurrent.total += value;
          rowCurrent.topItems.set(key, topItemCurrent);
        }
        topClientMap.set(rowKey, rowCurrent);
        continue;
      }

      const fallbackLabel = getProductLabel(faturamentoItem);
      const fallbackKey = normalizeText(fallbackLabel) || 'sem-produto';
      const fallbackValue = toNumber(
        faturamentoItem?.Valor_Total ?? faturamentoItem?.valor_Total ?? faturamentoItem?.valorTotal ?? faturamentoItem?.Valor_Mercadoria ?? faturamentoItem?.valor_Mercadoria ?? 0,
      );

      const topItemCurrent = rowCurrent.topItems.get(fallbackKey) || { label: fallbackLabel, total: 0 };
      topItemCurrent.total += fallbackValue;
      rowCurrent.topItems.set(fallbackKey, topItemCurrent);

      topClientMap.set(rowKey, rowCurrent);
    }

    return Array.from(topClientMap.entries())
      .map(([key, item]) => ({
        key,
        client: item.client,
        billingType: item.billingType,
        total: item.total,
        topItems: Array.from(item.topItems.entries())
          .map(([itemKey, topItem]) => ({ key: itemKey, label: topItem.label, total: topItem.total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [payload.Faturamento]);

  useEffect(() => {
    setExpandedTopClients((prev) => prev.filter((key) => topClientsByBillingType.some((item) => item.key === key)));
  }, [topClientsByBillingType]);

  const summaryRows = useMemo<DashboardRow[]>(() => {
    const clientMap = new Map<string, { cliente: string; faturado: number; regiaoPrincipal: string; atrasoTotal: number; forecastTotal: number; regioes: Map<string, number> }>();
    const atrasoByClient = new Map<string, number>();
    const forecastByClient = new Map<string, number>();

    for (const rawItem of payload.Atraso ?? []) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const client = getClientLabel(item);
      const key = normalizeText(client) || 'sem-cliente';
      atrasoByClient.set(key, (atrasoByClient.get(key) ?? 0) + getAtrasoValue(item));
    }

    for (const rawItem of payload.Forecast ?? []) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const client = getClientLabel(item);
      const key = normalizeText(client) || 'sem-cliente';
      forecastByClient.set(key, (forecastByClient.get(key) ?? 0) + getForecastValue(item));
    }

    for (const rawItem of payload.Faturamento ?? []) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const cliente = getClientLabel(item);
      const regiao = getRegionLabel(item);
      const valor = toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
      const key = normalizeText(cliente) || 'sem-cliente';

      const current = clientMap.get(key) || {
        cliente,
        faturado: 0,
        regiaoPrincipal: '-',
        atrasoTotal: atrasoByClient.get(key) ?? 0,
        forecastTotal: forecastByClient.get(key) ?? 0,
        regioes: new Map<string, number>(),
      };

      current.faturado += valor;
      current.regioes.set(regiao, (current.regioes.get(regiao) ?? 0) + valor);
      clientMap.set(key, current);
    }

    return Array.from(clientMap.entries())
      .map(([key, item]) => {
        const regiaoPrincipal = Array.from(item.regioes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

        return {
          key: `cliente-${key}`,
          label: item.cliente,
          cliente: item.cliente,
          regiao: regiaoPrincipal,
          faturado: item.faturado,
          totalAtraso: item.atrasoTotal,
          totalForecast: item.forecastTotal,
        } as DashboardRow;
      })
      .sort((a, b) => Number(b.faturado ?? 0) - Number(a.faturado ?? 0));
  }, [payload.Atraso, payload.Faturamento, payload.Forecast]);

  const summaryColumns = useMemo<DashboardTableColumn[]>(() => {
    return [
      { key: 'cliente', label: 'Cliente', format: 'text' },
      { key: 'regiao', label: 'Região principal', format: 'text' },
      { key: 'faturado', label: 'Total faturado', format: 'currency' },
      { key: 'totalAtraso', label: 'Total em atraso', format: 'currency' },
      { key: 'totalForecast', label: 'Total forecast', format: 'currency' },
    ];
  }, []);

  const totalRegiao = useMemo(() => {
    return Math.max(1, regionSlices.reduce((acc, item) => acc + Math.max(0, item.total), 0));
  }, [regionSlices]);

  const activeRegion = useMemo(() => {
    if (!regionSlices.length) return null;
    const byActive = regionSlices.find((item) => item.key === activeRegionKey);
    return byActive ?? regionSlices[0];
  }, [activeRegionKey, regionSlices]);

  const hasAnyData = (payload.Faturamento?.length ?? 0) > 0 || (payload.Atraso?.length ?? 0) > 0 || (payload.Forecast?.length ?? 0) > 0;

  const toggleTopClient = (key: string) => {
    setExpandedTopClients((prev) => (prev.includes(key) ? prev.filter((currentKey) => currentKey !== key) : [...prev, key]));
  };

  const handleExportExcel = () => {
    if (!summaryRows.length) {
      showToast('Sem dados para exportar.', 'info');
      return;
    }

    try {
      const exportRows = summaryRows.map((row) => ({
        Cliente: String(row.cliente ?? '-'),
        Regiao_Principal: String(row.regiao ?? '-'),
        Total_Faturado: Number(row.faturado ?? 0),
        Total_Em_Atraso: Number(row.totalAtraso ?? 0),
        Total_Forecast: Number(row.totalForecast ?? 0),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Faturados por Cliente');

      const fileDateDe = String(appliedDataDe || '').replace(/\//g, '-');
      const fileDateAte = String(appliedDataAte || '').replace(/\//g, '-');
      XLSX.writeFile(workbook, `dashboard-vendas-${fileDateDe}-a-${fileDateAte}.xlsx`);
      showToast('Arquivo Excel exportado com sucesso.', 'success');
    } catch (error: any) {
      showToast(String(error?.message || 'Falha ao exportar Excel.'), 'error');
    }
  };

  return (
    <main className="clientes-page list-layout-page dashboard-page dashboard-vendas-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>

          <div>
            <h1>Dashboard - Vendas</h1>
            <p>Faturamento por região, top clientes por tipo e consolidado por cliente faturado.</p>
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
        <div className="dashboard-vendas-advanced-grid dashboard-vendas-advanced-grid--dates-only">
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

        <p className="dashboard-period-range">Período: {appliedDataDe} - {appliedDataAte}</p>

        {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
        {loading ? <p className="module-empty">Carregando dashboard de vendas...</p> : null}

        {!loading && !errorMessage && !hasFetched ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Selecione as datas e clique em atualizar para visualizar os gráficos</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && !hasAnyData ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Nenhum dado encontrado para o período informado</p>
          </div>
        ) : null}

        {!loading && !errorMessage && hasFetched && hasAnyData ? (
          <>
            <DashboardKpiCards cards={kpis} />

            <section className="dashboard-chart-grid">
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Faturamento por região</h2>
                    <p>Passe o mouse na região para visualizar os 3 clientes mais vendidos.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setMainChartCollapsed((prev) => !prev)}
                    aria-label={mainChartCollapsed ? 'Expandir gráfico por região' : 'Encolher gráfico por região'}
                    title={mainChartCollapsed ? 'Expandir gráfico por região' : 'Encolher gráfico por região'}
                  >
                    {mainChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!mainChartCollapsed ? (
                  regionSlices.length === 0 ? (
                    <p className="module-empty">Sem dados de faturamento por região.</p>
                  ) : (
                    <div className="dashboard-native-pie-wrap dashboard-vendas-region-pie-wrap">
                      <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico de pizza de faturamento por região">
                        {(() => {
                          let offset = 0;
                          const circleRadius = 42;
                          const circleLength = 2 * Math.PI * circleRadius;

                          return regionSlices.map((region, index) => {
                            const value = Math.max(0, region.total);
                            const slice = (value / totalRegiao) * circleLength;
                            const dashArray = `${slice} ${circleLength - slice}`;
                            const dashOffset = -offset;
                            offset += slice;

                            return (
                              <circle
                                key={region.key}
                                cx="60"
                                cy="60"
                                r={circleRadius}
                                fill="none"
                                stroke={chartPalette[index % chartPalette.length]}
                                strokeWidth={28}
                                strokeDasharray={dashArray}
                                strokeDashoffset={dashOffset}
                                transform="rotate(-90 60 60)"
                                onMouseEnter={() => setActiveRegionKey(region.key)}
                              >
                                <title>{`${region.label}: ${formatCurrencyBRL(region.total)}`}</title>
                              </circle>
                            );
                          });
                        })()}
                      </svg>

                      <div className="dashboard-native-legend dashboard-vendas-region-legend">
                        {regionSlices.map((region, index) => (
                          <button
                            type="button"
                            key={region.key}
                            className={`dashboard-native-legend-item dashboard-vendas-region-legend__item${activeRegion?.key === region.key ? ' is-active' : ''}`}
                            onMouseEnter={() => setActiveRegionKey(region.key)}
                            onFocus={() => setActiveRegionKey(region.key)}
                          >
                            <span style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                            <strong>{region.label}</strong>
                            <small>{formatCurrencyBRL(region.total)}</small>
                          </button>
                        ))}

                        {activeRegion ? (
                          <div className="dashboard-vendas-region-tooltip" role="status" aria-live="polite">
                            <p>{`Top 3 clientes - ${activeRegion.label}`}</p>
                            <ol>
                              {activeRegion.topClients.length > 0 ? (
                                activeRegion.topClients.map((client) => (
                                  <li key={`${activeRegion.key}-${client.label}`}>
                                    <span>{client.label}</span>
                                    <strong>{formatCurrencyBRL(client.total)}</strong>
                                  </li>
                                ))
                              ) : (
                                <li>
                                  <span>Sem clientes para esta região</span>
                                </li>
                              )}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                ) : null}
              </article>

              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Top 10 clientes por tipo de faturamento</h2>
                    <p>Expanda um cliente para visualizar os 5 itens com maior valor faturado.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setTopChartCollapsed((prev) => !prev)}
                    aria-label={topChartCollapsed ? 'Expandir top 10 clientes' : 'Encolher top 10 clientes'}
                    title={topChartCollapsed ? 'Expandir top 10 clientes' : 'Encolher top 10 clientes'}
                  >
                    {topChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!topChartCollapsed ? (
                  topClientsByBillingType.length === 0 ? (
                    <p className="module-empty">Sem clientes faturados no período.</p>
                  ) : (
                    <div className="dashboard-native-bars is-horizontal dashboard-vendas-top-client-bars">
                      {(() => {
                        const max = Math.max(1, ...topClientsByBillingType.map((item) => Math.abs(item.total)));

                        return topClientsByBillingType.map((item, index) => {
                          const sizePercent = Math.max(2, (Math.abs(item.total) / max) * 100);
                          const isExpanded = expandedTopClients.includes(item.key);

                          return (
                            <article key={item.key} className={`dashboard-vendas-top-client${isExpanded ? ' is-expanded' : ''}`}>
                              <button
                                type="button"
                                className="dashboard-native-row dashboard-vendas-top-client__trigger"
                                title={`${item.client} (${item.billingType}): ${formatCurrencyBRL(item.total)}`}
                                onClick={() => toggleTopClient(item.key)}
                                aria-expanded={isExpanded}
                              >
                                <div className="dashboard-native-row-label dashboard-vendas-top-client__label">
                                  <strong className="dashboard-vendas-top-client__name">{item.client}</strong>
                                  <small className="dashboard-vendas-top-client__type">{formatBillingTypeDisplay(item.billingType)}</small>
                                </div>
                                <div className="dashboard-native-track" aria-hidden="true">
                                  <div
                                    className="dashboard-native-fill"
                                    style={{ width: `${sizePercent}%`, backgroundColor: chartPalette[index % chartPalette.length] }}
                                  />
                                </div>
                                <div className="dashboard-native-row-value dashboard-vendas-top-client__value">
                                  <span>{formatCurrencyBRL(item.total)}</span>
                                  {isExpanded ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
                                </div>
                              </button>

                              {isExpanded ? (
                                <div className="dashboard-vendas-top-client__details">
                                  <p>Top 5 itens do faturamento</p>
                                  {item.topItems.length > 0 ? (
                                    <ol>
                                      {item.topItems.map((topItem, topItemIndex) => (
                                        <li key={`${item.key}-${topItem.key}`}>
                                          <span className="dashboard-vendas-top-client__rank">{String(topItemIndex + 1).padStart(2, '0')}</span>
                                          <span>{topItem.label}</span>
                                          <strong>{formatCurrencyBRL(topItem.total)}</strong>
                                        </li>
                                      ))}
                                    </ol>
                                  ) : (
                                    <p className="dashboard-vendas-top-client__empty">Sem itens associados para este cliente.</p>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          );
                        });
                      })()}
                    </div>
                  )
                ) : null}
              </article>
            </section>

            <DashboardSummaryTable
              rows={summaryRows}
              columns={summaryColumns}
              headerAction={(
                <button
                  className="icon-button module-action-button"
                  type="button"
                  onClick={handleExportExcel}
                  title="Exportar grade resumo para Excel"
                  aria-label="Exportar grade resumo para Excel"
                  disabled={loading || !summaryRows.length}
                >
                  <IoDownloadOutline size={16} />
                </button>
              )}
            />
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
