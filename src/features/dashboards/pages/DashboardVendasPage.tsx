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
import { SearchableSelect } from '../../../components/SearchableSelect';
import { DashboardKpiCards } from '../components/DashboardKpiCards';
import { DashboardSummaryTable } from '../components/DashboardSummaryTable';
import { getDashboardVendas, type DashboardVendasResponse } from '../services/dashboardApi';
import type { DashboardDateErrors, DashboardKpiCard, DashboardRow, DashboardTableColumn, Option } from '../types';
import { chartPalette, formatCurrencyBRL, normalizeText, parseDateStrict, toApiDate, toNumber } from '../utils/dashboardUtils';

type RegionSlice = {
  key: string;
  label: string;
  total: number;
  topClients: Array<{ label: string; total: number }>;
};

type SellerSlice = {
  key: string;
  label: string;
  total: number;
  topClients: Array<{ key: string; label: string; total: number }>;
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

type AccumulatedBillingRow = {
  key: string;
  label: string;
  order: number;
  total: number;
  topClients: Array<{ label: string; total: number }>;
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

const getSellerLabel = (item: Record<string, any>) =>
  pickFirstText(
    item,
    [
      'Nome_Vendedor',
      'nome_Vendedor',
      'nomeVendedor',
      'Vendedor',
      'vendedor',
      'Nome_Representante',
      'nome_Representante',
      'nomeRepresentante',
    ],
    'Sem vendedor',
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

const isFornecedorItem = (item: Record<string, any>) => {
  const billingType = normalizeText(getBillingTypeLabel(item));
  if (billingType === 'f' || billingType === 'fornecedor' || billingType.startsWith('fornecedor')) {
    return true;
  }

  const region = normalizeText(item?.Nome_Regiao ?? item?.nome_Regiao ?? item?.nomeRegiao ?? item?.Regiao ?? item?.regiao ?? '');
  return region === 'fornecedor';
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

const parseVendasDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const ptBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ptBr) {
    const day = Number(ptBr[1]);
    const month = Number(ptBr[2]) - 1;
    const year = Number(ptBr[3]);
    const parsed = new Date(year, month, day);

    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed;
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const parsed = new Date(year, month, day);

    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed;
    }
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getVendasMonthDate = (item: Record<string, any>): Date | null => {
  const orderRaw = toNumber(item?.Ordenacao_Mes_Ano ?? item?.ordenacao_Mes_Ano ?? item?.OrdenacaoMesAno ?? 0);
  if (orderRaw > 0) {
    const asText = String(Math.trunc(orderRaw));
    if (asText.length === 6) {
      const year = Number(asText.slice(0, 4));
      const month = Number(asText.slice(4, 6));
      if (year >= 1900 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
  }

  const monthYearText = String(
    item?.Mes_Ano_Faturamento ??
      item?.mes_Ano_Faturamento ??
      item?.mesAnoFaturamento ??
      item?.Mes_Ano_Mov ??
      item?.mes_Ano_Mov ??
      item?.MesAnoMov ??
      item?.mesAnoMov ??
      '',
  ).trim();

  const match = monthYearText.match(/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (!year || !month || month < 1 || month > 12) return null;

  return new Date(year, month - 1, 1);
};

const getVendasItemDate = (item: Record<string, any>, options?: { allowMonthFallback?: boolean }): Date | null => {
  const candidates = [
    item?.Data_Emissao,
    item?.data_Emissao,
    item?.dataEmissao,
    item?.Dt_Emissao,
    item?.dt_Emissao,
    item?.dtEmissao,
    item?.Data_Movimento,
    item?.data_Movimento,
    item?.dataMovimento,
    item?.Data_Mov,
    item?.data_Mov,
    item?.dataMov,
    item?.Data,
    item?.data,
    item?.Data_Faturamento,
    item?.data_Faturamento,
    item?.dataFaturamento,
    item?.Data_Fat,
    item?.data_Fat,
    item?.dataFat,
    item?.Data_Nota,
    item?.data_Nota,
    item?.dataNota,
    item?.Data_Pedido,
    item?.data_Pedido,
    item?.dataPedido,
  ];

  for (const candidate of candidates) {
    const parsed = parseVendasDate(candidate);
    if (parsed) return parsed;
  }

  // Fallback para cenario de mudanca de contrato em campos de data.
  for (const [key, rawValue] of Object.entries(item ?? {})) {
    const normalizedKey = normalizeText(key).replace(/[^a-z0-9]/g, '');
    if (!normalizedKey.includes('data') && !normalizedKey.includes('dt')) {
      continue;
    }

    const parsed = parseVendasDate(rawValue);
    if (parsed) return parsed;
  }

  if (options?.allowMonthFallback === false) {
    return null;
  }

  return getVendasMonthDate(item);
};

const toPtBrDateString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

export function DashboardVendasPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const today = new Date();
  const currentYearStart = new Date(today.getFullYear(), 0, 1);
  const currentYearEnd = new Date(today.getFullYear(), 11, 31);

  const codigoEmpresa = useMemo(() => String(GlobalConfig.getCodEmpresa() ?? ''), []);

  const [appliedDataDe, setAppliedDataDe] = useState(() => toPtBrDateString(currentYearStart));
  const [appliedDataAte, setAppliedDataAte] = useState(() => toPtBrDateString(currentYearEnd));
  const [draftDataDe, setDraftDataDe] = useState(() => toPtBrDateString(currentYearStart));
  const [draftDataAte, setDraftDataAte] = useState(() => toPtBrDateString(currentYearEnd));
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mainChartCollapsed, setMainChartCollapsed] = useState(false);
  const [topChartCollapsed, setTopChartCollapsed] = useState(false);
  const [activeRegionKey, setActiveRegionKey] = useState<string | null>(null);
  const [activeSellerKey, setActiveSellerKey] = useState<string | null>(null);
  const [activeAccumulatedKey, setActiveAccumulatedKey] = useState<string | null>(null);
  const [expandedTopClients, setExpandedTopClients] = useState<string[]>([]);
  const [destinatarioScope, setDestinatarioScope] = useState<'todos' | 'clientes'>('todos');

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardVendasResponse>({
    MoedasSemCotacao: [],
    Faturamento: [],
    Atraso: [],
    Forecast: [],
    FaturamentoAcumulado: null,
  });

  const initialFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  const destinatarioOptions = useMemo<Option[]>(
    () => [
      { value: 'todos', label: 'Todos' },
      { value: 'clientes', label: 'Clientes' },
    ],
    [],
  );

  useEffect(() => {
    if (!advancedOpen) return;
    setDraftDataDe(appliedDataDe);
    setDraftDataAte(appliedDataAte);
    setErrors({});
  }, [advancedOpen, appliedDataAte, appliedDataDe]);

  const filteredFaturamento = useMemo(() => {
    const source = payload.Faturamento ?? [];
    if (destinatarioScope === 'todos') return source;
    return source.filter((item) => !isFornecedorItem(item));
  }, [destinatarioScope, payload.Faturamento]);

  const filteredAtraso = useMemo(() => {
    const source = payload.Atraso ?? [];
    if (destinatarioScope === 'todos') return source;
    return source.filter((item) => !isFornecedorItem(item));
  }, [destinatarioScope, payload.Atraso]);

  const filteredForecast = useMemo(() => {
    const source = payload.Forecast ?? [];
    if (destinatarioScope === 'todos') return source;
    return source.filter((item) => !isFornecedorItem(item));
  }, [destinatarioScope, payload.Forecast]);

  const validateFilters = useCallback(() => {
    const nextErrors: DashboardDateErrors = {};

    const parsedDe = parseDateStrict(draftDataDe);
    const parsedAte = parseDateStrict(draftDataAte);

    if (!parsedDe) nextErrors.dataDe = 'Data de inválida.';
    if (!parsedAte) nextErrors.dataAte = 'Data até inválida.';

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
    const faturamento = filteredFaturamento;
    const atraso = filteredAtraso;
    const forecast = filteredForecast;

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
      { key: 'total-por-produto', label: 'Total mercadoria', value: totalPorProduto, format: 'currency' },
      { key: 'total-impostos', label: 'Total de impostos', value: totalImpostos, format: 'currency' },
      { key: 'total-atraso', label: 'Total em atraso', value: totalAtraso, format: 'currency' },
      { key: 'total-forecast', label: 'Total previsto (forecast)', value: totalForecast, format: 'currency' },
      { key: 'qtd-clientes-faturados', label: 'Clientes faturados', value: clientesFaturados.size, format: 'number' },
    ];
  }, [filteredAtraso, filteredFaturamento, filteredForecast]);

  const faturamentoAcumuladoTipo = useMemo(() => {
    const api = payload.FaturamentoAcumulado as Record<string, any> | null | undefined;
    const tipo = String(api?.periodicidade ?? api?.Periodicidade ?? '').trim();
    return tipo || 'Mensal';
  }, [payload.FaturamentoAcumulado]);

  const faturamentoAcumuladoRows = useMemo<AccumulatedBillingRow[]>(() => {
    const faturamentoAcumuladoApi = payload.FaturamentoAcumulado as Record<string, any> | null | undefined;
    const acumuladoApiRaw = faturamentoAcumuladoApi?.acumulado ?? faturamentoAcumuladoApi?.Acumulado;

    if (Array.isArray(acumuladoApiRaw) && acumuladoApiRaw.length > 0) {
      const top3ApiRaw = faturamentoAcumuladoApi?.top3Clientes ?? faturamentoAcumuladoApi?.Top3Clientes;
      const top3Clientes = Array.isArray(top3ApiRaw)
        ? top3ApiRaw
            .map((item) => ({
              label: String(item?.nome_Cliente ?? item?.nomeCliente ?? item?.Nome_Cliente ?? item?.nome_Fantasia ?? item?.nomeFantasia ?? 'Sem cliente').trim() || 'Sem cliente',
              total: toNumber(item?.valor_Acumulado ?? item?.valorAcumulado ?? item?.Valor_Acumulado ?? item?.valor_Total ?? item?.valorTotal ?? 0),
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 3)
        : [];

      return acumuladoApiRaw
        .map((rawItem, index) => {
          const item = (rawItem ?? {}) as Record<string, any>;
          const label = String(item?.periodo ?? item?.Periodo ?? item?.label ?? item?.Label ?? `Período ${index + 1}`).trim() || `Período ${index + 1}`;
          const startDate = parseVendasDate(item?.data_Inicial ?? item?.dataInicial ?? item?.Data_Inicial ?? item?.DataInicial);
          const endDate = parseVendasDate(item?.data_Final ?? item?.dataFinal ?? item?.Data_Final ?? item?.DataFinal);
          const fallbackMonthDate = parseVendasDate(`01/${label}`);
          const order = startDate?.getTime() ?? endDate?.getTime() ?? fallbackMonthDate?.getTime() ?? index + 1;

          return {
            key: `${order}-${index}`,
            label,
            order,
            total: toNumber(item?.valor_Acumulado ?? item?.valorAcumulado ?? item?.Valor_Acumulado ?? item?.valor_Total ?? item?.valorTotal ?? 0),
            topClients: top3Clientes,
          } as AccumulatedBillingRow;
        })
        .sort((a, b) => a.order - b.order);
    }

    const parsedDe = parseDateStrict(appliedDataDe);
    const parsedAte = parseDateStrict(appliedDataAte);

    const grouped = new Map<string, { key: string; label: string; order: number; total: number; clients: Map<string, number> }>();

    const buildTopClients = (clientsMap: Map<string, number>) => {
      return Array.from(clientsMap.entries())
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);
    };

    const includeItemInBucket = (bucket: { key: string; label: string; order: number }, item: Record<string, any>, value: number) => {
      const clientLabel = getClientLabel(item);
      const current = grouped.get(bucket.key) || { ...bucket, total: 0, clients: new Map<string, number>() };
      current.total += value;
      current.clients.set(clientLabel, (current.clients.get(clientLabel) ?? 0) + value);
      grouped.set(bucket.key, current);
    };

    if (!parsedDe || !parsedAte || parsedDe.getTime() > parsedAte.getTime()) {
      return [];
    }

    const start = new Date(parsedDe.getFullYear(), parsedDe.getMonth(), parsedDe.getDate()).getTime();
    const end = new Date(parsedAte.getFullYear(), parsedAte.getMonth(), parsedAte.getDate()).getTime();

    for (const rawItem of payload.Faturamento ?? []) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const value = toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
      if (value === 0) continue;

      const date = getVendasItemDate(item, { allowMonthFallback: true });
      if (!date) continue;

      const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (current < start || current > end) continue;

      const year = date.getFullYear();
      const month = date.getMonth();
      const monthText = String(month + 1).padStart(2, '0');

      includeItemInBucket(
        {
          key: `${year}-${monthText}`,
          label: `${monthText}/${year}`,
          order: new Date(year, month, 1).getTime(),
        },
        item,
        value,
      );
    }

    const rows: AccumulatedBillingRow[] = [];
    const monthCursor = new Date(parsedDe.getFullYear(), parsedDe.getMonth(), 1);
    const monthLast = new Date(parsedAte.getFullYear(), parsedAte.getMonth(), 1);

    while (monthCursor.getTime() <= monthLast.getTime()) {
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      const monthText = String(month + 1).padStart(2, '0');

      const key = `${year}-${monthText}`;
      const existing = grouped.get(key);

      rows.push(
        existing
          ? { key: existing.key, label: existing.label, order: existing.order, total: existing.total, topClients: buildTopClients(existing.clients) }
          : {
              key,
              label: `${monthText}/${year}`,
              order: new Date(year, month, 1).getTime(),
              total: 0,
              topClients: [],
            },
      );

      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    return rows.sort((a, b) => a.order - b.order);
  }, [appliedDataAte, appliedDataDe, payload.Faturamento, payload.FaturamentoAcumulado]);

  const faturamentoAcumuladoMax = useMemo(() => {
    return Math.max(1, ...faturamentoAcumuladoRows.map((row) => Math.abs(Number(row.total ?? 0))));
  }, [faturamentoAcumuladoRows]);

  const faturamentoAcumuladoChart = useMemo(() => {
    const minWidth = 1280;
    const minStepBetweenPoints = 160;
    const dynamicWidth =
      faturamentoAcumuladoRows.length > 1
        ? (faturamentoAcumuladoRows.length - 1) * minStepBetweenPoints + 300
        : minWidth;
    const width = Math.max(minWidth, dynamicWidth);
    const height = 300;
    const padX = 150;
    const padY = 18;
    const stepX = faturamentoAcumuladoRows.length > 1 ? (width - padX * 2) / (faturamentoAcumuladoRows.length - 1) : 0;

    const points = faturamentoAcumuladoRows.map((row, index) => {
      const value = Math.max(0, Number(row.total ?? 0));
      const x = padX + index * stepX;
      const y = height - padY - (value / faturamentoAcumuladoMax) * (height - padY * 2);
      return { x, y, value, key: row.key, label: row.label };
    });

    const line = points.map((point) => `${point.x},${point.y}`).join(' ');
    const endX = points.length > 0 ? points[points.length - 1].x : padX;
    const area = `${padX},${height - padY} ${line} ${endX},${height - padY}`;

    return {
      width,
      height,
      padX,
      padY,
      points,
      line,
      area,
    };
  }, [faturamentoAcumuladoMax, faturamentoAcumuladoRows]);

  const faturamentoAcumuladoTicks = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = (faturamentoAcumuladoMax / steps) * (steps - index);
      const y = faturamentoAcumuladoChart.padY + ((faturamentoAcumuladoChart.height - faturamentoAcumuladoChart.padY * 2) / steps) * index;
      return { value, y };
    });
  }, [faturamentoAcumuladoChart.height, faturamentoAcumuladoChart.padY, faturamentoAcumuladoMax]);

  useEffect(() => {
    if (!faturamentoAcumuladoRows.length) {
      setActiveAccumulatedKey(null);
      return;
    }

    const hasActive = activeAccumulatedKey && faturamentoAcumuladoRows.some((row) => row.key === activeAccumulatedKey);
    if (hasActive) return;

    const firstWithValue = faturamentoAcumuladoRows.find((row) => Number(row.total ?? 0) > 0) ?? faturamentoAcumuladoRows[0];
    setActiveAccumulatedKey(firstWithValue.key);
  }, [activeAccumulatedKey, faturamentoAcumuladoRows]);

  const activeAccumulatedRow = useMemo(() => {
    if (!faturamentoAcumuladoRows.length) return null;
    const found = faturamentoAcumuladoRows.find((row) => row.key === activeAccumulatedKey);
    return found ?? faturamentoAcumuladoRows[0];
  }, [activeAccumulatedKey, faturamentoAcumuladoRows]);

  const regionSlices = useMemo<RegionSlice[]>(() => {
    const regionMap = new Map<string, { label: string; total: number; clients: Map<string, number> }>();

    for (const rawItem of filteredFaturamento) {
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
  }, [filteredFaturamento]);

  const sellerSlices = useMemo<SellerSlice[]>(() => {
    const sellerMap = new Map<string, { label: string; total: number; clients: Map<string, { key: string; label: string; total: number }> }>();

    for (const rawItem of filteredFaturamento) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const sellerLabel = getSellerLabel(item);
      const sellerKey = normalizeText(sellerLabel) || 'sem-vendedor';
      const clientLabel = getClientLabel(item);
      const clientKey = normalizeText(clientLabel) || 'sem-cliente';
      const rowValue = toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
      const current = sellerMap.get(sellerKey) || { label: sellerLabel, total: 0, clients: new Map<string, { key: string; label: string; total: number }>() };

      current.total += rowValue;

      const existingClient = current.clients.get(clientKey) || { key: clientKey, label: clientLabel, total: 0 };
      existingClient.total += rowValue;
      current.clients.set(clientKey, existingClient);

      sellerMap.set(sellerKey, current);
    }

    return Array.from(sellerMap.entries())
      .map(([key, seller]) => ({
        key,
        label: seller.label,
        total: seller.total,
        topClients: Array.from(seller.clients.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredFaturamento]);

  const topClientsByBillingType = useMemo<TopClientByBillingType[]>(() => {
    const topClientMap = new Map<string, { client: string; billingType: string; total: number; topItems: Map<string, { label: string; total: number }> }>();

    for (const rawItem of filteredFaturamento) {
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
  }, [filteredFaturamento]);

  useEffect(() => {
    setExpandedTopClients((prev) => prev.filter((key) => topClientsByBillingType.some((item) => item.key === key)));
  }, [topClientsByBillingType]);

  const summaryRows = useMemo<DashboardRow[]>(() => {
    const clientMap = new Map<string, { cliente: string; faturado: number; regiaoPrincipal: string; atrasoTotal: number; forecastTotal: number; regioes: Map<string, number> }>();
    const atrasoByClient = new Map<string, number>();
    const forecastByClient = new Map<string, number>();

    for (const rawItem of filteredAtraso) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const client = getClientLabel(item);
      const key = normalizeText(client) || 'sem-cliente';
      atrasoByClient.set(key, (atrasoByClient.get(key) ?? 0) + getAtrasoValue(item));
    }

    for (const rawItem of filteredForecast) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const client = getClientLabel(item);
      const key = normalizeText(client) || 'sem-cliente';
      forecastByClient.set(key, (forecastByClient.get(key) ?? 0) + getForecastValue(item));
    }

    for (const rawItem of filteredFaturamento) {
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
  }, [filteredAtraso, filteredFaturamento, filteredForecast]);

  const summaryMaterialsByClient = useMemo(() => {
    const materialsByClient = new Map<string, Map<string, { key: string; label: string; total: number }>>();

    for (const rawItem of filteredFaturamento) {
      const item = (rawItem ?? {}) as Record<string, any>;
      const clientKey = normalizeText(getClientLabel(item)) || 'sem-cliente';
      const rowKey = `cliente-${clientKey}`;
      const current = materialsByClient.get(rowKey) || new Map<string, { key: string; label: string; total: number }>();

      const materiais = getMaterials(item);
      if (materiais.length > 0) {
        for (const materialRaw of materiais) {
          const material = (materialRaw ?? {}) as Record<string, any>;
          const label = getProductLabel(material);
          const key = normalizeText(label) || 'sem-produto';
          const total = toNumber(
            material?.Valor_Total ?? material?.valor_Total ?? material?.valorTotal ?? material?.Valor_Mercadoria ?? material?.valor_Mercadoria ?? 0,
          );

          const existing = current.get(key) || { key, label, total: 0 };
          existing.total += total;
          current.set(key, existing);
        }
      } else {
        const fallbackLabel = getProductLabel(item);
        const fallbackKey = normalizeText(fallbackLabel) || 'sem-produto';
        const fallbackTotal = toNumber(item?.Valor_Total ?? item?.valor_Total ?? item?.valorTotal ?? 0);
        const existing = current.get(fallbackKey) || { key: fallbackKey, label: fallbackLabel, total: 0 };
        existing.total += fallbackTotal;
        current.set(fallbackKey, existing);
      }

      materialsByClient.set(rowKey, current);
    }

    return new Map(
      Array.from(materialsByClient.entries()).map(([rowKey, materialMap]) => [
        rowKey,
        Array.from(materialMap.values()).sort((a, b) => b.total - a.total),
      ]),
    );
  }, [filteredFaturamento]);

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

  const totalSeller = useMemo(() => {
    return Math.max(1, sellerSlices.reduce((acc, item) => acc + Math.max(0, item.total), 0));
  }, [sellerSlices]);

  const activeRegion = useMemo(() => {
    if (!regionSlices.length) return null;
    const byActive = regionSlices.find((item) => item.key === activeRegionKey);
    return byActive ?? regionSlices[0];
  }, [activeRegionKey, regionSlices]);

  const activeSeller = useMemo(() => {
    if (!sellerSlices.length) return null;
    const byActive = sellerSlices.find((item) => item.key === activeSellerKey);
    return byActive ?? sellerSlices[0];
  }, [activeSellerKey, sellerSlices]);

  const hasAnyData = filteredFaturamento.length > 0 || filteredAtraso.length > 0 || filteredForecast.length > 0;

  const toggleTopClient = (key: string) => {
    setExpandedTopClients((prev) => (prev.includes(key) ? prev.filter((currentKey) => currentKey !== key) : [...prev, key]));
  };

  const getSummaryRowSearchText = useCallback((row: DashboardRow) => {
    const materials = summaryMaterialsByClient.get(row.key) ?? [];
    return materials.map((item) => item.label).join(' ');
  }, [summaryMaterialsByClient]);

  const renderSummaryRowDetails = useCallback((row: DashboardRow) => {
    const materials = summaryMaterialsByClient.get(row.key) ?? [];
    if (!materials.length) {
      return <p className="dashboard-summary-table__details-empty">Sem materiais faturados para este cliente no período.</p>;
    }

    return (
      <ol className="dashboard-summary-table__materials-list">
        {materials.map((material, index) => (
          <li key={`${row.key}-${material.key}`}>
            <span className="dashboard-summary-table__materials-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>{material.label}</span>
            <strong>{formatCurrencyBRL(material.total)}</strong>
          </li>
        ))}
      </ol>
    );
  }, [summaryMaterialsByClient]);

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
      const modeSuffix = `${fileDateDe}-a-${fileDateAte}`;
      XLSX.writeFile(workbook, `dashboard-vendas-${modeSuffix}.xlsx`);
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
            <CustomDatePicker
              value={draftDataDe}
              onChange={setDraftDataDe}
              className={errors.dataDe ? 'pcp-date-error' : undefined}
            />
            <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-vendas-date-field">
            <span>Data até</span>
            <CustomDatePicker
              value={draftDataAte}
              onChange={setDraftDataAte}
              className={errors.dataAte ? 'pcp-date-error' : undefined}
            />
            <small className={`module-field-error${errors.dataAte ? '' : ' dashboard-error-empty'}`}>{errors.dataAte || ' '}</small>
          </label>
        </div>
      </AdvancedFiltersPanel>

      <section className="card dashboard-vendas-results">
        <div className="dashboard-vendas-controls-inline dashboard-vendas-results__actions">
          <label className="list-layout-field list-layout-field--sm dashboard-field dashboard-vendas-scope-filter" aria-label="Filtrar destinatário">
            <span>Destinatário</span>
            <SearchableSelect
              value={destinatarioScope}
              onChange={(value) => setDestinatarioScope(value as 'todos' | 'clientes')}
              options={destinatarioOptions}
              enableSearch={false}
              searchPlaceholder="Pesquisar destinatário"
              ariaLabel="Filtrar destinatário"
            />
          </label>

          <div className="dashboard-vendas-controls-inline__buttons">
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
        </div>

        <p className="dashboard-period-range">{`Período: ${appliedDataDe} - ${appliedDataAte}`}</p>

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

            <article className="card dashboard-chart-card dashboard-vendas-acumulado-card">
              <header className="dashboard-section-header dashboard-section-header--collapsible">
                <div>
                  <h2>Faturamento acumulado de clientes por mês</h2>
                  <p>{`Total faturado acumulado de clientes (${String(faturamentoAcumuladoTipo).toLowerCase()}) no intervalo selecionado.`}</p>
                </div>
              </header>

              {faturamentoAcumuladoRows.length === 0 ? (
                <p className="module-empty">Sem dados para montar o faturamento acumulado.</p>
              ) : (
                <div className="dashboard-vendas-acumulado">
                  <div className="dashboard-native-svg-wrap dashboard-vendas-acumulado__chart-wrap">
                      <svg
                        viewBox={`0 0 ${faturamentoAcumuladoChart.width} ${faturamentoAcumuladoChart.height}`}
                        className="dashboard-native-svg"
                        style={{ width: '100%', minWidth: `${faturamentoAcumuladoChart.width}px` }}
                      >
                        <line
                          x1={faturamentoAcumuladoChart.padX}
                          y1={faturamentoAcumuladoChart.padY}
                          x2={faturamentoAcumuladoChart.padX}
                          y2={faturamentoAcumuladoChart.height - faturamentoAcumuladoChart.padY}
                          className="dashboard-vendas-acumulado__axis"
                        />

                        {Array.from({ length: 5 }).map((_, index) => {
                          const y = faturamentoAcumuladoChart.padY + ((faturamentoAcumuladoChart.height - faturamentoAcumuladoChart.padY * 2) / 4) * index;
                          return (
                            <line
                              key={`grid-${index}`}
                              x1={faturamentoAcumuladoChart.padX}
                              y1={y}
                              x2={faturamentoAcumuladoChart.width - faturamentoAcumuladoChart.padX}
                              y2={y}
                              className="dashboard-vendas-acumulado__grid"
                            />
                          );
                        })}

                        {faturamentoAcumuladoTicks.map((tick, index) => (
                          <text
                            key={`tick-${index}`}
                            x={faturamentoAcumuladoChart.padX - 8}
                            y={tick.y + 3}
                            textAnchor="end"
                            className="dashboard-vendas-acumulado__tick-text"
                          >
                            {formatCurrencyBRL(tick.value)}
                          </text>
                        ))}

                        <polygon points={faturamentoAcumuladoChart.area} className="dashboard-vendas-acumulado__fill" />
                        <polyline points={faturamentoAcumuladoChart.line} className="dashboard-vendas-acumulado__line" />

                        {faturamentoAcumuladoChart.points.map((point) => {
                          const row = faturamentoAcumuladoRows.find((item) => item.key === point.key);
                          const topClients = row?.topClients ?? [];
                          const topClientsTooltip =
                            topClients.length > 0
                              ? topClients.map((client, index) => `${index + 1}. ${client.label} (${formatCurrencyBRL(Number(client.total ?? 0))})`).join(' | ')
                              : 'Sem clientes no período';

                          return (
                            <g key={`fat-${point.key}`}>
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                className={`dashboard-vendas-acumulado__dot${activeAccumulatedRow?.key === point.key ? ' is-active' : ''}`}
                                onMouseEnter={() => setActiveAccumulatedKey(point.key)}
                                onFocus={() => setActiveAccumulatedKey(point.key)}
                                tabIndex={0}
                              >
                                <title>{`${point.label}: ${formatCurrencyBRL(point.value)} | Top 3 clientes: ${topClientsTooltip}`}</title>
                              </circle>
                            </g>
                          );
                        })}
                      </svg>

                    <div
                      className="dashboard-native-xlabels"
                      style={{ width: '100%', minWidth: `${faturamentoAcumuladoChart.width}px` }}
                    >
                      {faturamentoAcumuladoChart.points.map((point, index) => {
                        const row = faturamentoAcumuladoRows[index];
                        if (!row) return null;

                        return (
                          <span
                            key={`xlabel-${row.key}`}
                            className="dashboard-vendas-acumulado__xlabel-item"
                            style={{ left: `${point.x}px` }}
                          >
                            <strong className="dashboard-vendas-acumulado__xlabel-value">{formatCurrencyBRL(point.value)}</strong>
                            <small className="dashboard-vendas-acumulado__xlabel-date">{row.label}</small>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {activeAccumulatedRow ? (
                    <div className="dashboard-vendas-region-tooltip dashboard-vendas-acumulado-tooltip" role="status" aria-live="polite">
                      <p>{`Top 3 clientes - ${String(activeAccumulatedRow.label ?? '-')}`}</p>
                      <ol>
                        {activeAccumulatedRow.topClients.length > 0 ? (
                          activeAccumulatedRow.topClients.map((client) => (
                            <li key={`${activeAccumulatedRow.key}-${client.label}`}>
                              <span>{client.label}</span>
                              <strong>{formatCurrencyBRL(Number(client.total ?? 0))}</strong>
                            </li>
                          ))
                        ) : (
                          <li>
                            <span>Sem clientes para este período</span>
                          </li>
                        )}
                      </ol>
                    </div>
                  ) : null}
                </div>
              )}
            </article>

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
                    <div className="dashboard-vendas-pie-stack">
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

                      {sellerSlices.length > 0 ? (
                        <div className="dashboard-vendas-seller-pie-block">
                          <header className="dashboard-vendas-seller-pie-block__header">
                            <h3>Faturamento por vendedor</h3>
                            <p>Passe o mouse no vendedor para visualizar os 3 clientes com maior faturamento.</p>
                          </header>

                          <div className="dashboard-native-pie-wrap dashboard-vendas-region-pie-wrap">
                            <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico de pizza de faturamento por vendedor">
                              {(() => {
                                let offset = 0;
                                const circleRadius = 42;
                                const circleLength = 2 * Math.PI * circleRadius;

                                return sellerSlices.map((seller, index) => {
                                  const value = Math.max(0, seller.total);
                                  const slice = (value / totalSeller) * circleLength;
                                  const dashArray = `${slice} ${circleLength - slice}`;
                                  const dashOffset = -offset;
                                  offset += slice;

                                  return (
                                    <circle
                                      key={seller.key}
                                      cx="60"
                                      cy="60"
                                      r={circleRadius}
                                      fill="none"
                                      stroke={chartPalette[index % chartPalette.length]}
                                      strokeWidth={28}
                                      strokeDasharray={dashArray}
                                      strokeDashoffset={dashOffset}
                                      transform="rotate(-90 60 60)"
                                      onMouseEnter={() => setActiveSellerKey(seller.key)}
                                    >
                                      <title>{`${seller.label}: ${formatCurrencyBRL(seller.total)}`}</title>
                                    </circle>
                                  );
                                });
                              })()}
                            </svg>

                            <div className="dashboard-native-legend dashboard-vendas-region-legend">
                              {sellerSlices.map((seller, index) => (
                                <button
                                  type="button"
                                  key={seller.key}
                                  className={`dashboard-native-legend-item dashboard-vendas-region-legend__item${activeSeller?.key === seller.key ? ' is-active' : ''}`}
                                  onMouseEnter={() => setActiveSellerKey(seller.key)}
                                  onFocus={() => setActiveSellerKey(seller.key)}
                                >
                                  <span style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                                  <strong>{seller.label}</strong>
                                  <small>{formatCurrencyBRL(seller.total)}</small>
                                </button>
                              ))}

                              {activeSeller ? (
                                <div className="dashboard-vendas-region-tooltip" role="status" aria-live="polite">
                                  <p>{`Top 3 clientes - ${activeSeller.label}`}</p>
                                  <ol>
                                    {activeSeller.topClients.length > 0 ? (
                                      activeSeller.topClients.map((client) => (
                                        <li key={`${activeSeller.key}-${client.key}`}>
                                          <span>{client.label}</span>
                                          <strong>{formatCurrencyBRL(client.total)}</strong>
                                        </li>
                                      ))
                                    ) : (
                                      <li>
                                        <span>Sem clientes para este vendedor</span>
                                      </li>
                                    )}
                                  </ol>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
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
              searchEnabled
              searchPlaceholder="Pesquisar cliente, região ou material"
              initialSortColumnKey="faturado"
              initialSortDirection="desc"
              rowSearchText={getSummaryRowSearchText}
              renderRowDetails={renderSummaryRowDetails}
              rowDetailsTitle="Materiais faturados"
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
