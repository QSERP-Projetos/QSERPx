import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAlertCircleOutline,
  IoArrowBack,
  IoChevronDownOutline,
  IoDownloadOutline,
  IoChevronUpOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import * as XLSX from 'xlsx';
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
import type { DashboardDateErrors, DashboardKpiCard, DashboardRow, DashboardSeries, DashboardTableColumn, Option } from '../types';
import {
  formatNumberBR,
  groupSum,
  normalizeText,
  parseDateStrict,
  sortRows,
  toApiDate,
  toNumber,
} from '../utils/dashboardUtils';

type FinanceiroBase = 'receitas' | 'despesas' | 'comparativo';
type FinanceiroGroup = 'mes' | 'banco' | 'pessoa' | 'tipo' | 'lancamento' | 'vendedor' | 'cliente' | 'regiao';
type FinanceiroPeriodMode = 'mensal' | 'anual';
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

const getContaFinanceiraLabel = (item: FinanceiroApiItem) => {
  const descricaoConta = String(
    item?.Descricao_Conta ?? item?.descricao_Conta ?? item?.descricaoConta ?? item?.Descricao_Conta_Financeira ?? item?.descricao_Conta_Financeira ?? '',
  ).trim();

  if (descricaoConta) {
    return descricaoConta;
  }

  const contaFinanceiraRaw =
    item?.Conta_Financeira ?? item?.conta_Financeira ?? item?.contaFinanceira ?? item?.Conta_Contabil ?? item?.conta_Contabil ?? item?.contaContabil;

  const contaFinanceiraNumero = toNumber(contaFinanceiraRaw);
  if (contaFinanceiraNumero <= 0) {
    return 'SEM CONTA FINANCEIRA';
  }

  const nomeConta = String(item?.Nome_Conta_Financeira ?? item?.nome_Conta_Financeira ?? item?.nomeContaFinanceira ?? '').trim();
  if (nomeConta) {
    return nomeConta;
  }

  return `Conta ${contaFinanceiraNumero}`;
};

const getValorAtrasoFinanceiro = (item: FinanceiroApiItem) =>
  toNumber(
    item?.Valor_Atraso ??
      item?.valor_Atraso ??
      item?.valorAtraso ??
      item?.Valor_Atrasado ??
      item?.valor_Atrasado ??
      item?.valorAtrasado ??
      item?.Valor_Vencido ??
      item?.valor_Vencido ??
      item?.valorVencido ??
      item?.Saldo_Vencido ??
      item?.saldo_Vencido ??
      item?.saldoVencido ??
      0,
  );

const parseFinanceDate = (value: unknown): Date | null => {
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

const getFinanceMonthDate = (item: FinanceiroApiItem): Date | null => {
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

  const mesAno = String(item?.Mes_Ano_Mov ?? item?.mes_Ano_Mov ?? item?.MesAnoMov ?? item?.mesAnoMov ?? '').trim();
  const match = mesAno.match(/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (!year || !month || month < 1 || month > 12) return null;

  return new Date(year, month - 1, 1);
};

const getFinanceItemDate = (item: FinanceiroApiItem, options?: { allowMonthFallback?: boolean }): Date | null => {
  const candidates = [
    item?.Data_Movimento,
    item?.data_Movimento,
    item?.dataMovimento,
    item?.Data_Mov,
    item?.data_Mov,
    item?.dataMov,
    item?.Data,
    item?.data,
    item?.Data_Lanc,
    item?.data_Lanc,
    item?.dataLanc,
    item?.Data_Lancamento,
    item?.data_Lancamento,
    item?.dataLancamento,
    item?.Data_Emissao,
    item?.data_Emissao,
    item?.dataEmissao,
    item?.Data_Vencimento,
    item?.data_Vencimento,
    item?.dataVencimento,
  ];

  for (const candidate of candidates) {
    const parsed = parseFinanceDate(candidate);
    if (parsed) return parsed;
  }

  if (options?.allowMonthFallback === false) {
    return null;
  }

  return getFinanceMonthDate(item);
};

const formatDayLabelPtBr = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const toPtBrDateString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
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
  const currentYear = new Date().getFullYear();

  const codigoEmpresa = useMemo(() => String(GlobalConfig.getCodEmpresa() ?? ''), []);

  const [appliedDataDe, setAppliedDataDe] = useState(() => toPtBrDateString(new Date(currentYear, 0, 1)));
  const [appliedDataAte, setAppliedDataAte] = useState(() => toPtBrDateString(new Date(currentYear, 11, 31)));
  const [appliedPeriodMode, setAppliedPeriodMode] = useState<FinanceiroPeriodMode>('anual');
  const [appliedAno, setAppliedAno] = useState(String(currentYear));
  const [draftDataDe, setDraftDataDe] = useState(() => toPtBrDateString(new Date(currentYear, 0, 1)));
  const [draftDataAte, setDraftDataAte] = useState(() => toPtBrDateString(new Date(currentYear, 11, 31)));
  const [draftPeriodMode, setDraftPeriodMode] = useState<FinanceiroPeriodMode>('anual');
  const [draftAno, setDraftAno] = useState(String(currentYear));
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mainChartCollapsed, setMainChartCollapsed] = useState(false);
  const [topChartCollapsed, setTopChartCollapsed] = useState(false);
  const [showAllTopReceitas, setShowAllTopReceitas] = useState(false);

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
    setDraftPeriodMode(appliedPeriodMode);
    setDraftAno(appliedAno);
    setErrors({});
  }, [advancedOpen, appliedAno, appliedDataAte, appliedDataDe, appliedPeriodMode]);

  const periodModeOptions = useMemo<Option[]>(() => {
    return [
      { value: 'mensal', label: 'Mensal (por data)' },
      { value: 'anual', label: 'Anual' },
    ];
  }, []);

  const anoOptions = useMemo<Option[]>(() => {
    const yearSet = new Set<number>();
    const currentYear = new Date().getFullYear();

    const draftYearNum = Number(draftAno);
    if (Number.isInteger(draftYearNum) && draftYearNum >= 1900 && draftYearNum <= 2999) {
      yearSet.add(draftYearNum);
    }

    const appliedYearNum = Number(appliedAno);
    if (Number.isInteger(appliedYearNum) && appliedYearNum >= 1900 && appliedYearNum <= 2999) {
      yearSet.add(appliedYearNum);
    }

    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) {
      yearSet.add(year);
    }

    return Array.from(yearSet)
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: String(year) }));
  }, [appliedAno, draftAno]);

  const resolveRangeByMode = useCallback((mode: FinanceiroPeriodMode, yearText: string, dataDe: string, dataAte: string) => {
    if (mode === 'anual') {
      const year = Number(yearText);
      if (!Number.isInteger(year) || year < 1900 || year > 2999) {
        return null;
      }

      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31);
      return {
        dataDe: toPtBrDateString(from),
        dataAte: toPtBrDateString(to),
      };
    }

    return { dataDe, dataAte };
  }, []);

  const validateFilters = useCallback(() => {
    const nextErrors: DashboardDateErrors = {};

    if (!String(codigoEmpresa).trim()) {
      nextErrors.codigoEmpresa = 'Empresa inválida para consultar o dashboard.';
    }

    if (draftPeriodMode === 'anual') {
      if (!/^\d{4}$/.test(String(draftAno).trim())) {
        nextErrors.ano = 'Ano inválido.';
      }
    }

    if (draftPeriodMode !== 'anual') {
      const parsedDe = parseDateStrict(draftDataDe);
      const parsedAte = parseDateStrict(draftDataAte);

      if (!parsedDe) nextErrors.dataDe = 'Data inicial inválida.';
      if (!parsedAte) nextErrors.dataAte = 'Data final inválida.';

      if (parsedDe && parsedAte && parsedDe.getTime() > parsedAte.getTime()) {
        nextErrors.dataDe = 'Data inicial não pode ser maior que Data final.';
        nextErrors.dataAte = 'Data final não pode ser menor que Data inicial.';
      }

    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [codigoEmpresa, draftAno, draftDataAte, draftDataDe, draftPeriodMode]);

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
    const totalReceitasEmAtraso = (filteredPayload.FluxoCaixaReceitas ?? []).reduce((acc, item) => acc + getValorAtrasoFinanceiro(item), 0);
    const totalDespesasEmAtraso = (filteredPayload.FluxoCaixaDespesas ?? []).reduce((acc, item) => acc + getValorAtrasoFinanceiro(item), 0);

    return [
      { key: 'total-receitas', label: 'Total de receitas', value: totalReceitas, format: 'currency' },
      { key: 'total-despesas', label: 'Total de despesas', value: totalDespesas, format: 'currency' },
      { key: 'saldo-periodo', label: 'Saldo do período', value: saldo, format: 'currency' },
      { key: 'receitas-atraso', label: 'Receitas em atraso', value: totalReceitasEmAtraso, format: 'currency' },
      { key: 'despesas-atraso', label: 'Despesas em atraso', value: totalDespesasEmAtraso, format: 'currency' },
    ];
  }, [filteredPayload]);

  const processed = useMemo(
    () => buildFinanceRows('comparativo', 'mes', 'saldo', filteredPayload, 'todos'),
    [filteredPayload],
  );

  const handleExportExcel = useCallback(() => {
    if (!processed.rows.length || !processed.columns.length) {
      showToast('Sem dados para exportar.', 'info');
      return;
    }

    try {
      const exportRows = processed.rows.map((row) => {
        const exportRow: Record<string, string | number> = {};

        for (const column of processed.columns) {
          if (column.format === 'currency' || column.format === 'number') {
            exportRow[column.label] = Number(row[column.key] ?? 0);
          } else {
            exportRow[column.label] = String(row[column.key] ?? '-');
          }
        }

        return exportRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Grade Resumo');

      const modeSuffix = appliedPeriodMode === 'anual' ? `ano-${appliedAno}` : `${appliedDataDe.replace(/\//g, '-')}-a-${appliedDataAte.replace(/\//g, '-')}`;
      XLSX.writeFile(workbook, `dashboard-financeiro-${modeSuffix}.xlsx`);
      showToast('Arquivo Excel exportado com sucesso.', 'success');
    } catch (error: any) {
      showToast(String(error?.message || 'Falha ao exportar Excel.'), 'error');
    }
  }, [appliedAno, appliedDataAte, appliedDataDe, appliedPeriodMode, processed.columns, processed.rows, showToast]);

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
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0));
  }, [filteredPayload.FluxoCaixaReceitas]);

  const topReceitasVisibleRows = useMemo(() => {
    if (showAllTopReceitas) return topReceitasRows;
    return topReceitasRows.slice(0, 10);
  }, [showAllTopReceitas, topReceitasRows]);

  const despesasPorContaRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    for (const rawItem of filteredPayload.FluxoCaixaDespesas ?? []) {
      const item = (rawItem ?? {}) as FinanceiroApiItem;
      const label = getContaFinanceiraLabel(item);
      const info = { key: normalizeText(label) || 'sem-conta', label };
      const current = grouped.get(info.key) || { key: info.key, label: info.label, valor: 0 };
      current.valor = Number(current.valor ?? 0) + toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);
      grouped.set(info.key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0))
      .slice(0, 10);
  }, [filteredPayload.FluxoCaixaDespesas]);

  const topReceitasSeries = useMemo<DashboardSeries[]>(() => [{ key: 'valor', label: 'Receitas', color: '#2563eb', format: 'currency' }], []);
  const topDespesasSeries = useMemo<DashboardSeries[]>(() => [{ key: 'valor', label: 'Despesas', color: '#ef4444', format: 'currency' }], []);

  const monthlyComparisonRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    const accumulate = (source: FinanceiroApiItem[], type: 'receitas' | 'despesas') => {
      for (const item of source) {
        const monthDate = getFinanceMonthDate(item);
        if (!monthDate) continue;

        const month = String(monthDate.getMonth() + 1).padStart(2, '0');
        const year = monthDate.getFullYear();
        const key = `${year}-${month}`;
        const label = `${month}/${year}`;
        const order = new Date(year, monthDate.getMonth(), 1).getTime();

        const current = grouped.get(key) || { key, label, order, receitas: 0, despesas: 0 };
        const value = toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);

        current[type] = Number(current[type] ?? 0) + value;
        grouped.set(key, current);
      }
    };

    accumulate(filteredPayload.FluxoCaixaReceitas ?? [], 'receitas');
    accumulate(filteredPayload.FluxoCaixaDespesas ?? [], 'despesas');

    if (appliedPeriodMode !== 'anual') {
      return sortRows(Array.from(grouped.values()));
    }

    const selectedYear = Number(appliedAno);
    if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > 2999) {
      return sortRows(Array.from(grouped.values()));
    }

    const rows: DashboardRow[] = [];
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const month = String(monthIndex + 1).padStart(2, '0');
      const key = `${selectedYear}-${month}`;
      const existing = grouped.get(key);

      rows.push(
        existing || {
          key,
          label: `${month}/${selectedYear}`,
          order: new Date(selectedYear, monthIndex, 1).getTime(),
          receitas: 0,
          despesas: 0,
        },
      );
    }

    return sortRows(rows);
  }, [appliedAno, appliedPeriodMode, filteredPayload.FluxoCaixaDespesas, filteredPayload.FluxoCaixaReceitas]);

  const dailyComparisonRows = useMemo<DashboardRow[]>(() => {
    const grouped = new Map<string, DashboardRow>();

    const accumulate = (source: FinanceiroApiItem[], type: 'receitas' | 'despesas') => {
      for (const item of source) {
        const date = getFinanceItemDate(item, { allowMonthFallback: false });
        if (!date) continue;

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        const key = `${year}-${month}-${day}`;
        const label = formatDayLabelPtBr(date);

        const current = grouped.get(key) || {
          key,
          label,
          order: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
          receitas: 0,
          despesas: 0,
        };

        const value = toNumber(item?.Valor_Mov ?? item?.valor_Mov ?? item?.valorMov ?? 0);
        current[type] = Number(current[type] ?? 0) + value;
        grouped.set(key, current);
      }
    };

    accumulate(filteredPayload.FluxoCaixaReceitas ?? [], 'receitas');
    accumulate(filteredPayload.FluxoCaixaDespesas ?? [], 'despesas');

    const parsedDe = parseDateStrict(appliedDataDe);
    const parsedAte = parseDateStrict(appliedDataAte);

    if (!parsedDe || !parsedAte || parsedDe.getTime() > parsedAte.getTime()) {
      return sortRows(Array.from(grouped.values()));
    }

    const rows: DashboardRow[] = [];
    const cursor = new Date(parsedDe.getFullYear(), parsedDe.getMonth(), parsedDe.getDate());
    const last = new Date(parsedAte.getFullYear(), parsedAte.getMonth(), parsedAte.getDate());

    while (cursor.getTime() <= last.getTime()) {
      const day = String(cursor.getDate()).padStart(2, '0');
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      const year = String(cursor.getFullYear());
      const key = `${year}-${month}-${day}`;

      rows.push(
        grouped.get(key) || {
          key,
          label: `${day}/${month}`,
          order: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()).getTime(),
          receitas: 0,
          despesas: 0,
        },
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    return sortRows(rows);
  }, [appliedDataAte, appliedDataDe, filteredPayload.FluxoCaixaDespesas, filteredPayload.FluxoCaixaReceitas]);

  const lineComparisonRows = appliedPeriodMode === 'anual' ? monthlyComparisonRows : dailyComparisonRows;

  const monthlyComparisonMax = useMemo(() => {
    return Math.max(
      1,
      ...lineComparisonRows.map((row) => Math.max(Math.abs(Number(row.receitas ?? 0)), Math.abs(Number(row.despesas ?? 0)))),
    );
  }, [lineComparisonRows]);

  const comparisonBarsMax = useMemo(() => {
    return Math.max(
      1,
      ...lineComparisonRows.map((row) => Math.max(Math.abs(Number(row.receitas ?? 0)), Math.abs(Number(row.despesas ?? 0)))),
    );
  }, [lineComparisonRows]);

  const monthlyAreaPoints = useMemo(() => {
    const width = Math.max(920, lineComparisonRows.length * 58);
    const height = 300;
    const padX = 74;
    const padY = 18;
    const stepX = lineComparisonRows.length > 1 ? (width - padX * 2) / (lineComparisonRows.length - 1) : 0;

    const receitasPoints = lineComparisonRows.map((row, index) => {
      const value = Math.max(0, Number(row.receitas ?? 0));
      const x = padX + index * stepX;
      const y = height - padY - (value / monthlyComparisonMax) * (height - padY * 2);
      return { x, y, value, key: row.key, label: row.label };
    });

    const despesasPoints = lineComparisonRows.map((row, index) => {
      const value = Math.max(0, Number(row.despesas ?? 0));
      const x = padX + index * stepX;
      const y = height - padY - (value / monthlyComparisonMax) * (height - padY * 2);
      return { x, y, value, key: row.key, label: row.label };
    });

    const receitasLine = receitasPoints.map((point) => `${point.x},${point.y}`).join(' ');
    const despesasLine = despesasPoints.map((point) => `${point.x},${point.y}`).join(' ');

    const receitasEndX = receitasPoints.length > 0 ? receitasPoints[receitasPoints.length - 1].x : padX;
    const despesasEndX = despesasPoints.length > 0 ? despesasPoints[despesasPoints.length - 1].x : padX;

    const receitasArea = `${padX},${height - padY} ${receitasLine} ${receitasEndX},${height - padY}`;
    const despesasArea = `${padX},${height - padY} ${despesasLine} ${despesasEndX},${height - padY}`;

    return {
      width,
      height,
      padX,
      padY,
      receitasPoints,
      despesasPoints,
      receitasLine,
      despesasLine,
      receitasArea,
      despesasArea,
    };
  }, [lineComparisonRows, monthlyComparisonMax]);

  const monthlyAreaTicks = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = (monthlyComparisonMax / steps) * (steps - index);
      const y = monthlyAreaPoints.padY + ((monthlyAreaPoints.height - monthlyAreaPoints.padY * 2) / steps) * index;
      return { value, y };
    });
  }, [monthlyAreaPoints.height, monthlyAreaPoints.padY, monthlyComparisonMax]);

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
          if (!validateFilters()) return;

          const resolvedRange = resolveRangeByMode(draftPeriodMode, draftAno, draftDataDe, draftDataAte);
          if (!resolvedRange) {
            setErrors((prev) => ({ ...prev, ano: 'Ano inválido.' }));
            return;
          }

          setAppliedPeriodMode(draftPeriodMode);
          setAppliedAno(draftAno);
          setAppliedDataDe(resolvedRange.dataDe);
          setAppliedDataAte(resolvedRange.dataAte);
          setAdvancedOpen(false);
          void fetchDashboard({ dataDe: resolvedRange.dataDe, dataAte: resolvedRange.dataAte });
        }}
        applyLabel="Aplicar"
        cancelLabel="Fechar"
      >
        <div className="dashboard-financeiro-advanced-grid dashboard-financeiro-advanced-grid--period">
          <label className="list-layout-field list-layout-field--md dashboard-field dashboard-financeiro-mode-field" aria-label="Periodicidade">
            <span>Periodicidade</span>
            <SearchableSelect
              value={draftPeriodMode}
              onChange={(value) => setDraftPeriodMode(value as FinanceiroPeriodMode)}
              options={periodModeOptions}
              enableSearch={false}
              ariaLabel="Periodicidade"
            />
          </label>

          <label className="list-layout-field list-layout-field--sm dashboard-field dashboard-financeiro-year-field" aria-label="Ano">
            <span>Ano</span>
            <SearchableSelect
              value={draftAno}
              onChange={(value) => setDraftAno(value)}
              options={anoOptions}
              enableSearch={false}
              disabled={draftPeriodMode !== 'anual'}
              ariaLabel="Ano"
            />
            <small className={`module-field-error${errors.ano ? '' : ' dashboard-error-empty'}`}>{errors.ano || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data de</span>
            <CustomDatePicker
              value={draftDataDe}
              onChange={setDraftDataDe}
              disabled={draftPeriodMode === 'anual'}
              className={errors.dataDe ? 'pcp-date-error' : undefined}
            />
            <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
          </label>

          <label className="list-layout-field list-layout-field--date dashboard-field dashboard-financeiro-date-field">
            <span>Data até</span>
            <CustomDatePicker
              value={draftDataAte}
              onChange={setDraftDataAte}
              disabled={draftPeriodMode === 'anual'}
              className={errors.dataAte ? 'pcp-date-error' : undefined}
            />
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

        <p className="dashboard-period-range">
          {appliedPeriodMode === 'anual' ? `Período: Ano ${appliedAno} (${appliedDataDe} - ${appliedDataAte})` : `Período: ${appliedDataDe} - ${appliedDataAte}`}
        </p>

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
                    <h2>Top receitas e despesas</h2>
                    <p>Top 10 receitas em barra horizontal e despesas por conta financeira em pizza.</p>
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
                  topReceitasRows.length === 0 && despesasPorContaRows.length === 0 ? (
                    <p className="module-empty">Sem dados para montar os rankings de receitas e despesas.</p>
                  ) : (
                    <div className="dashboard-financeiro-top-pies">
                      <article className="dashboard-financeiro-top-pies__card">
                        <div className="dashboard-financeiro-top-pies__card-header">
                          <h3>{showAllTopReceitas ? 'Receitas (todas)' : 'Top 10 receitas'}</h3>
                          {topReceitasRows.length > 10 ? (
                            <button
                              type="button"
                              className="secondary-button dashboard-financeiro-top-pies__toggle"
                              onClick={() => setShowAllTopReceitas((prev) => !prev)}
                            >
                              {showAllTopReceitas ? 'Mostrar top 10' : 'Ver todos'}
                            </button>
                          ) : null}
                        </div>

                        {topReceitasVisibleRows.length > 0 ? (
                          <DashboardChart chartType="bar-horizontal" rows={topReceitasVisibleRows} series={topReceitasSeries} xKey="label" />
                        ) : (
                          <p className="module-empty">Sem receitas no período.</p>
                        )}
                      </article>

                      <article className="dashboard-financeiro-top-pies__card">
                        <h3>Despesas por conta financeira</h3>
                        {despesasPorContaRows.length > 0 ? (
                          <DashboardChart chartType="pie" rows={despesasPorContaRows} series={topDespesasSeries} xKey="label" />
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
                    <h2>{appliedPeriodMode === 'anual' ? 'Receita x Despesa por mês' : 'Receita x Despesa por dia'}</h2>
                    <p>{appliedPeriodMode === 'anual' ? 'Comparativo mensal em linha com área para receitas e despesas.' : 'Comparativo diário em barras horizontais para receitas e despesas.'}</p>
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
                  lineComparisonRows.length === 0 ? (
                    <p className="module-empty">Sem dados para comparar receitas e despesas no período.</p>
                  ) : appliedPeriodMode === 'anual' ? (
                    <div className="dashboard-financeiro-area">
                      <div className="dashboard-native-svg-wrap dashboard-financeiro-area__chart-wrap">
                        <svg viewBox={`0 0 ${monthlyAreaPoints.width} ${monthlyAreaPoints.height}`} className="dashboard-native-svg">
                          <line
                            x1={monthlyAreaPoints.padX}
                            y1={monthlyAreaPoints.padY}
                            x2={monthlyAreaPoints.padX}
                            y2={monthlyAreaPoints.height - monthlyAreaPoints.padY}
                            className="dashboard-financeiro-area__axis"
                          />

                          {Array.from({ length: 5 }).map((_, index) => {
                            const y = monthlyAreaPoints.padY + ((monthlyAreaPoints.height - monthlyAreaPoints.padY * 2) / 4) * index;
                            return <line key={`grid-${index}`} x1={monthlyAreaPoints.padX} y1={y} x2={monthlyAreaPoints.width - monthlyAreaPoints.padX} y2={y} className="dashboard-financeiro-area__grid" />;
                          })}

                          {monthlyAreaTicks.map((tick, index) => (
                            <text key={`tick-${index}`} x={monthlyAreaPoints.padX - 8} y={tick.y + 3} textAnchor="end" className="dashboard-financeiro-area__tick-text">
                              {formatNumberBR(Math.round(tick.value))}
                            </text>
                          ))}

                          <polygon points={monthlyAreaPoints.receitasArea} className="dashboard-financeiro-area__fill is-receita" />
                          <polygon points={monthlyAreaPoints.despesasArea} className="dashboard-financeiro-area__fill is-despesa" />

                          <polyline points={monthlyAreaPoints.receitasLine} className="dashboard-financeiro-area__line is-receita" />
                          <polyline points={monthlyAreaPoints.despesasLine} className="dashboard-financeiro-area__line is-despesa" />

                          {monthlyAreaPoints.receitasPoints.map((point) => (
                            <circle key={`rec-${point.key}`} cx={point.x} cy={point.y} r="3.5" className="dashboard-financeiro-area__dot is-receita">
                              <title>{`Receita ${point.label}: ${Number(point.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</title>
                            </circle>
                          ))}

                          {monthlyAreaPoints.despesasPoints.map((point) => (
                            <circle key={`des-${point.key}`} cx={point.x} cy={point.y} r="3.5" className="dashboard-financeiro-area__dot is-despesa">
                              <title>{`Despesa ${point.label}: ${Number(point.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</title>
                            </circle>
                          ))}
                        </svg>

                        <div className="dashboard-native-xlabels">
                          {lineComparisonRows.map((row) => (
                            <span key={`label-${row.key}`}>{row.label}</span>
                          ))}
                        </div>
                      </div>

                      <div className="dashboard-financeiro-area__legend" aria-hidden="true">
                        <span className="dashboard-financeiro-area__legend-item is-receita">Receitas</span>
                        <span className="dashboard-financeiro-area__legend-item is-despesa">Despesas</span>
                      </div>
                    </div>
                  ) : (
                    <div className="dashboard-financeiro-compare-bars" role="img" aria-label="Comparativo diário de receitas e despesas em barras horizontais">
                      {lineComparisonRows.map((row) => {
                        const receitas = Math.max(0, Number(row.receitas ?? 0));
                        const despesas = Math.max(0, Number(row.despesas ?? 0));
                        const receitasSize = receitas > 0 ? Math.max(2, (receitas / comparisonBarsMax) * 100) : 0;
                        const despesasSize = despesas > 0 ? Math.max(2, (despesas / comparisonBarsMax) * 100) : 0;

                        return (
                          <article key={`bar-${row.key}`} className="dashboard-financeiro-compare-bars__row" title={`${row.label}: Receita ${formatNumberBR(receitas)} | Despesa ${formatNumberBR(despesas)}`}>
                            <header className="dashboard-financeiro-compare-bars__row-header">
                              <strong>{row.label}</strong>
                            </header>

                            <div className="dashboard-financeiro-compare-bars__metric is-receita">
                              <span className="dashboard-financeiro-compare-bars__metric-label">Receitas</span>
                              <div className="dashboard-financeiro-compare-bars__track" aria-hidden="true">
                                <div className="dashboard-financeiro-compare-bars__fill" style={{ width: `${receitasSize}%` }} />
                              </div>
                              <span className="dashboard-financeiro-compare-bars__value">{formatNumberBR(receitas)}</span>
                            </div>

                            <div className="dashboard-financeiro-compare-bars__metric is-despesa">
                              <span className="dashboard-financeiro-compare-bars__metric-label">Despesas</span>
                              <div className="dashboard-financeiro-compare-bars__track" aria-hidden="true">
                                <div className="dashboard-financeiro-compare-bars__fill" style={{ width: `${despesasSize}%` }} />
                              </div>
                              <span className="dashboard-financeiro-compare-bars__value">{formatNumberBR(despesas)}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )
                ) : null}
              </article>
            </section>

            <DashboardSummaryTable
              rows={processed.rows}
              columns={processed.columns}
              headerAction={(
                <button
                  className="icon-button module-action-button"
                  type="button"
                  onClick={handleExportExcel}
                  title="Exportar grade resumo para Excel"
                  aria-label="Exportar grade resumo para Excel"
                  disabled={loading || !processed.rows.length}
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
