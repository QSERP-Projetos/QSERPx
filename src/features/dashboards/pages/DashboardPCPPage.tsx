import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
import { getDashboardPCP, type DashboardPCPResponse } from '../services/dashboardApi';
import type { DashboardDateErrors, DashboardKpiCard } from '../types';
import { formatNumberBR, normalizeText, parseDateStrict, toApiDate } from '../utils/dashboardUtils';

const toPtBrDateString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

export function DashboardPCPPage() {
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
  const [centerChartCollapsed, setCenterChartCollapsed] = useState(false);
  const [pecasChartCollapsed, setPecasChartCollapsed] = useState(false);
  const [temposChartCollapsed, setTemposChartCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardPCPResponse>({
    resumo: {
      totalApontamentos: 0,
      totalOrdens: 0,
      quantidadeApontada: 0,
      horasApontadas: 0,
      totalParadas: 0,
      horasParadas: 0,
    },
    dadosProducao: {
      tempoProgramadoHoras: 0,
      tempoProgramadoMinutos: 0,
      paradasDescansoMinutos: 0,
      paradasRefeicaoMinutos: 0,
      paradasQuebraMinutos: 0,
      producaoIdealPPM: 0,
      totalProduzidoPecas: 0,
      totalRefugoPecas: 0,
    },
    variaveisSuporte: {
      tempoProducaoPlanejadaMinutos: 0,
      tempoOperacionalMinutos: 0,
      pecasBoas: 0,
    },
    fatoresOEE: {
      disponibilidade: 0,
      performance: 0,
      qualidade: 0,
      oee: 0,
    },
    dashboardFrontend: {
      filtros: {
        maquinaSelecionada: null,
        metaSelecionada: 70,
        mesInicio: 'jan./26',
        numeroMeses: 12,
        maquinasDisponiveis: [],
      },
      cards: {
        oee: 0,
        disponibilidade: 0,
        performance: 0,
        qualidade: 0,
      },
      evolucaoMensal: [],
      pecasMensal: [],
      temposMensal: [],
    },
    worldClass: {
      disponibilidade: 0,
      performance: 0,
      qualidade: 0,
      oee: 0,
    },
    producaoPorMaquina: [],
    producaoPorCentroTrabalho: [],
    paradasPorMotivo: [],
  });

  const initialFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!advancedOpen) return;
    setDraftDataDe(appliedDataDe);
    setDraftDataAte(appliedDataAte);
    setErrors({});
  }, [advancedOpen, appliedDataAte, appliedDataDe]);

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
      setErrorMessage('Sessão inválida para consultar o dashboard PCP.');
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setErrorMessage('');

      const result = await getDashboardPCP({
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
      const message = String(error?.message || 'Erro ao carregar dashboard PCP.');
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
    const resumo = payload.resumo;

    return [
      {
        key: 'totalApontamentos',
        label: 'Total de Apontamentos',
        value: resumo.totalApontamentos,
        format: 'number',
      },
      {
        key: 'totalOrdens',
        label: 'Total de Ordens',
        value: resumo.totalOrdens,
        format: 'number',
      },
      {
        key: 'horasApontadas',
        label: 'Horas Apontadas',
        value: resumo.horasApontadas,
        format: 'number',
      },
      {
        key: 'totalParadas',
        label: 'Total de Paradas',
        value: resumo.totalParadas,
        format: 'number',
      },
      {
        key: 'horasParadas',
        label: 'Horas Paradas',
        value: resumo.horasParadas,
        format: 'number',
      },
    ];
  }, [payload.resumo]);

  const producaoMaquinaTop = useMemo<any[]>(() => {
    return (payload.producaoPorMaquina ?? [])
      .sort((a: any, b: any) => b.horasApontadas - a.horasApontadas)
      .slice(0, 5);
  }, [payload.producaoPorMaquina]);

  const centrosTrabalhoTop = useMemo<any[]>(() => {
    return (payload.producaoPorCentroTrabalho ?? [])
      .sort((a: any, b: any) => b.horasApontadas - a.horasApontadas)
      .slice(0, 5);
  }, [payload.producaoPorCentroTrabalho]);

  const paradasTop = useMemo<any[]>(() => {
    return (payload.paradasPorMotivo ?? [])
      .sort((a: any, b: any) => b.horasParadas - a.horasParadas)
      .slice(0, 10);
  }, [payload.paradasPorMotivo]);

  const hasAnyData = payload.producaoPorMaquina.length > 0 || payload.producaoPorCentroTrabalho.length > 0 || payload.paradasPorMotivo.length > 0;

  const handleApplyFilters = () => {
    if (!validateFilters()) return;

    setAppliedDataDe(draftDataDe);
    setAppliedDataAte(draftDataAte);
    setAdvancedOpen(false);

    void fetchDashboard({ dataDe: draftDataDe, dataAte: draftDataAte });
  };

  const handleRefresh = () => {
    void fetchDashboard({ dataDe: appliedDataDe, dataAte: appliedDataAte });
  };

  const handleExportExcel = () => {
    if (!hasAnyData) {
      showToast('Sem dados para exportar.', 'info');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Export Resumo
      const resumoData = [
        { Métrica: 'Total de Apontamentos', Valor: payload.resumo.totalApontamentos },
        { Métrica: 'Total de Ordens', Valor: payload.resumo.totalOrdens },
        { Métrica: 'Quantidade Apontada', Valor: payload.resumo.quantidadeApontada },
        { Métrica: 'Horas Apontadas', Valor: payload.resumo.horasApontadas },
        { Métrica: 'Total de Paradas', Valor: payload.resumo.totalParadas },
        { Métrica: 'Horas Paradas', Valor: payload.resumo.horasParadas },
      ];
      const resumoSheet = XLSX.utils.json_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo');

      // Export Produção por Máquina
      if ((payload.producaoPorMaquina?.length ?? 0) > 0) {
        const machineData = (payload.producaoPorMaquina ?? []).map((item: any) => ({
          Maquina: String(item.num_Maquina ?? '-'),
          Total_Apontamentos: Number(item.totalApontamentos ?? 0),
          Quantidade_Apontada: Number(item.quantidadeApontada ?? 0),
          Horas_Apontadas: Number(item.horasApontadas ?? 0),
        }));
        const machineSheet = XLSX.utils.json_to_sheet(machineData);
        XLSX.utils.book_append_sheet(workbook, machineSheet, 'Produção por Máquina');
      }

      // Export Produção por Centro de Trabalho
      if ((payload.producaoPorCentroTrabalho?.length ?? 0) > 0) {
        const centroData = (payload.producaoPorCentroTrabalho ?? []).map((item: any) => ({
          Codigo: String(item.codigo_CTrab ?? '-'),
          Descricao: String(item.descricao_CTrab ?? '-'),
          Total_Apontamentos: Number(item.totalApontamentos ?? 0),
          Quantidade_Apontada: Number(item.quantidadeApontada ?? 0),
          Horas_Apontadas: Number(item.horasApontadas ?? 0),
        }));
        const centroSheet = XLSX.utils.json_to_sheet(centroData);
        XLSX.utils.book_append_sheet(workbook, centroSheet, 'Produção por Centro');
      }

      // Export Paradas por Motivo
      if ((payload.paradasPorMotivo?.length ?? 0) > 0) {
        const paradaData = (payload.paradasPorMotivo ?? []).map((item: any) => ({
          Motivo: String(item.motivo_Parada ?? '-'),
          Total_Ocorrencias: Number(item.totalOcorrencias ?? 0),
          Horas_Paradas: Number(item.horasParadas ?? 0),
          Programada: String(item.parada_Programada ? 'Sim' : 'Não'),
        }));
        const paradaSheet = XLSX.utils.json_to_sheet(paradaData);
        XLSX.utils.book_append_sheet(workbook, paradaSheet, 'Paradas por Motivo');
      }

      const fileDateDe = String(appliedDataDe || '').replace(/\//g, '-');
      const fileDateAte = String(appliedDataAte || '').replace(/\//g, '-');
      const modeSuffix = `${fileDateDe}-a-${fileDateAte}`;
      XLSX.writeFile(workbook, `dashboard-pcp-${modeSuffix}.xlsx`);
      showToast('Arquivo Excel exportado com sucesso.', 'success');
    } catch (error: any) {
      showToast(String(error?.message || 'Falha ao exportar Excel.'), 'error');
    }
  };

  const renderGauge = (value: number, label: string, max: number = 100, color: string = '#3B82F6') => {
    const percentage = Math.min(Math.max(value, 0), max) / max;
    const circumference = 2 * Math.PI * 42;
    const offset = circumference * (1 - percentage);

    return (
      <div className="dashboard-gauge-container">
        <svg viewBox="0 0 120 120" className="dashboard-gauge">
          <circle cx="60" cy="60" r="42" fill="none" stroke="var(--color-border)" strokeWidth="12" opacity="0.2" />
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="bold" fill="var(--color-text)">
            {formatNumberBR(value)}%
          </text>
          <text x="60" y="75" textAnchor="middle" fontSize="12" fill="var(--color-muted)">
            {label}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <main className="clientes-page list-layout-page dashboard-page dashboard-pcp-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>

          <div>
            <h1>Dashboard - PCP</h1>
            <p>Análise de produção por máquina, centros de trabalho e paradas.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-pcp-controls">
        <button
          className="icon-button"
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Atualizar"
          title="Atualizar dados"
        >
          <IoRefreshOutline size={18} />
        </button>

        <button
          className="icon-button"
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          aria-label="Filtros avançados"
          title="Filtros avançados"
        >
          <IoFilterOutline size={18} />
        </button>

        <button
          className="icon-button"
          type="button"
          onClick={handleExportExcel}
          disabled={loading || !hasFetched}
          aria-label="Exportar para Excel"
          title="Exportar para Excel"
        >
          <IoDownloadOutline size={18} />
        </button>
      </section>

      <AdvancedFiltersPanel
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        onApply={() => {
          if (!validateFilters()) return;
          handleApplyFilters();
          setAdvancedOpen(false);
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

      <section className="card dashboard-pcp-results">
        <p className="dashboard-period-range">{`Período: ${appliedDataDe} - ${appliedDataAte}`}</p>

        {errorMessage && <p className="status-box status-box--error">{errorMessage}</p>}
        {loading && <p className="module-empty">Carregando dashboard PCP...</p>}

        {!loading && !errorMessage && !hasFetched && (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Selecione as datas e clique em atualizar para visualizar os gráficos</p>
          </div>
        )}

        {!loading && !errorMessage && hasFetched && !hasAnyData && (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <IoStatsChartOutline size={24} aria-hidden="true" />
            <p>Nenhum dado encontrado para o período informado</p>
          </div>
        )}

        {!loading && !errorMessage && hasFetched && hasAnyData && (
          <>
            <DashboardKpiCards cards={kpis} />

            {/* Medidores OEE, Disponibilidade, Performance, Qualidade */}
            <section className="dashboard-gauges-section">
              <article className="card dashboard-gauges-card">
                <header className="dashboard-section-header">
                  <div>
                    <h2>Indicadores de Produção</h2>
                    <p>OEE, Disponibilidade, Performance e Qualidade</p>
                  </div>
                </header>

                <div className="dashboard-gauges-grid">
                  {renderGauge(payload.dashboardFrontend.cards.oee, 'OEE', 100, '#8B5CF6')}
                  {renderGauge(payload.dashboardFrontend.cards.disponibilidade, 'Disponibilidade', 100, '#3B82F6')}
                  {renderGauge(payload.dashboardFrontend.cards.performance, 'Performance', 100, '#10B981')}
                  {renderGauge(payload.dashboardFrontend.cards.qualidade, 'Qualidade', 100, '#F59E0B')}
                </div>
              </article>
            </section>

            {/* Evolução Mensal */}
            {(payload.dashboardFrontend.evolucaoMensal?.length ?? 0) > 0 && (
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header">
                  <div>
                    <h2>Evolução Mensal - Disponibilidade vs Meta</h2>
                    <p>Acompanhamento da disponibilidade ao longo dos meses</p>
                  </div>
                </header>

                <div className="dashboard-monthly-chart">
                  <svg viewBox="0 0 900 300" className="dashboard-evolution-chart">
                    <defs>
                      <linearGradient id="grad-disp" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="grad-meta" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Linhas de conexão */}
                    <polyline
                      points={payload.dashboardFrontend.evolucaoMensal
                        .map((item: any, index: number) => {
                          const x = 30 + (index * 850) / Math.max(1, payload.dashboardFrontend.evolucaoMensal.length - 1 || 1);
                          const dispY = 250 - (item.disponibilidade * 250) / 100;
                          return `${x},${dispY}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    <polyline
                      points={payload.dashboardFrontend.evolucaoMensal
                        .map((item: any, index: number) => {
                          const x = 30 + (index * 850) / Math.max(1, payload.dashboardFrontend.evolucaoMensal.length - 1 || 1);
                          const metaY = 250 - (item.meta * 250) / 100;
                          return `${x},${metaY}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />

                    {payload.dashboardFrontend.evolucaoMensal.map((item: any, index: number) => {
                      const x = 30 + (index * 850) / Math.max(1, payload.dashboardFrontend.evolucaoMensal.length - 1 || 1);
                      const dispY = 250 - (item.disponibilidade * 250) / 100;
                      const metaY = 250 - (item.meta * 250) / 100;

                      return (
                        <g key={`evo-${item.mes}`}>
                          <text x={x} y="280" fontSize="10" textAnchor="middle" fill="var(--color-muted)">
                            {item.mes}
                          </text>
                          <circle cx={x} cy={dispY} r="4" fill="#3B82F6" />
                          <circle cx={x} cy={metaY} r="4" fill="#F59E0B" />
                        </g>
                      );
                    })}

                    {/* Linhas de base */}
                    <line x1="20" y1="250" x2="880" y2="250" stroke="var(--color-border-soft)" strokeWidth="1" />
                  </svg>

                  <div className="dashboard-evolution-legend">
                    <div className="dashboard-evolution-legend-item">
                      <span style={{ backgroundColor: '#3B82F6' }} />
                      <strong>Disponibilidade</strong>
                    </div>
                    <div className="dashboard-evolution-legend-item">
                      <span style={{ backgroundColor: '#F59E0B' }} />
                      <strong>Meta</strong>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* Quantidades Mensais e Tempos Mensais */}
            <section className="dashboard-chart-grid">
              {/* Quantidades Mensais */}
              {(payload.dashboardFrontend.pecasMensal?.length ?? 0) > 0 && (
                <article className="card dashboard-chart-card">
                  <header className="dashboard-section-header dashboard-section-header--collapsible">
                    <div>
                      <h2>Quantidades Mensais</h2>
                      <p>Evolução de quantidades boas vs ruins ao longo dos meses</p>
                    </div>
                    <button
                      type="button"
                      className="home-dashboard-card__collapse"
                      onClick={() => setPecasChartCollapsed((prev) => !prev)}
                      aria-label={pecasChartCollapsed ? 'Expandir gráfico de peças' : 'Encolher gráfico de peças'}
                    >
                      {pecasChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                    </button>
                  </header>

                  {!pecasChartCollapsed && (

                    <div className="dashboard-stacked-bars">
                      <svg viewBox={`0 0 700 ${payload.dashboardFrontend.pecasMensal.length * 28 + 40}`} className="dashboard-stacked-bars-chart">
                        {payload.dashboardFrontend.pecasMensal.map((item: any, index: number) => {
                          const barY = 20 + index * 28;
                          const maxWidth = 400;
                          const totalPecas = (item.pecasBoas ?? 0) + (item.pecasRuins ?? 0) || 1;
                          const boasWidth = ((item.pecasBoas ?? 0) / totalPecas) * maxWidth;
                          const ruinsWidth = ((item.pecasRuins ?? 0) / totalPecas) * maxWidth;

                          return (
                            <g key={`pecas-${item.mes}`}>
                              <rect x="140" y={barY + 2} width={boasWidth} height="16" fill="#10B981" opacity="0.8" />
                              <rect x={140 + boasWidth} y={barY + 2} width={ruinsWidth} height="16" fill="#EF4444" opacity="0.8" />
                              <text x="10" y={barY + 12} textAnchor="start" fontSize="12" fontWeight="bold" fill="var(--color-text)">
                                {item.mes}
                              </text>
                              <text x={140 + boasWidth + ruinsWidth + 5} y={barY + 12} textAnchor="start" fontSize="13" fontWeight="bold" fill="var(--color-text)">
                                {formatNumberBR(item.pecasBoas + item.pecasRuins)}
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      <div className="dashboard-stacked-legend">
                        <div className="dashboard-stacked-legend-item">
                          <span style={{ backgroundColor: '#10B981' }} />
                          <strong>Quantidades Boas</strong>
                        </div>
                        <div className="dashboard-stacked-legend-item">
                          <span style={{ backgroundColor: '#EF4444' }} />
                          <strong>Quantidades Ruins</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )}

              {/* Tempos Mensais */}
              {(payload.dashboardFrontend.temposMensal?.length ?? 0) > 0 && (
                <article className="card dashboard-chart-card">
                  <header className="dashboard-section-header dashboard-section-header--collapsible">
                    <div>
                      <h2>Tempos Mensais</h2>
                      <p>Tempo produtivo vs parado ao longo dos meses</p>
                    </div>
                    <button
                      type="button"
                      className="home-dashboard-card__collapse"
                      onClick={() => setTemposChartCollapsed((prev) => !prev)}
                      aria-label={temposChartCollapsed ? 'Expandir gráfico de tempos' : 'Encolher gráfico de tempos'}
                    >
                      {temposChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                    </button>
                  </header>

                  {!temposChartCollapsed && (

                    <div className="dashboard-stacked-bars">
                      <svg viewBox={`0 0 700 ${payload.dashboardFrontend.temposMensal.length * 28 + 40}`} className="dashboard-stacked-bars-chart">
                        {payload.dashboardFrontend.temposMensal.map((item: any, index: number) => {
                          const barY = 20 + index * 28;
                          const maxWidth = 400;
                          const totalTempos = (item.tempoProdutivo ?? 0) + (item.naoQualidade ?? 0) + (item.tempoParado ?? 0) || 1;
                          const prodWidth = ((item.tempoProdutivo ?? 0) / totalTempos) * maxWidth;
                          const naQualWidth = ((item.naoQualidade ?? 0) / totalTempos) * maxWidth;
                          const paradoWidth = ((item.tempoParado ?? 0) / totalTempos) * maxWidth;

                          return (
                            <g key={`tempos-${item.mes}`}>
                              <rect x="140" y={barY + 2} width={prodWidth} height="16" fill="#3B82F6" opacity="0.8" />
                              <rect x={140 + prodWidth} y={barY + 2} width={naQualWidth} height="16" fill="#F59E0B" opacity="0.8" />
                              <rect x={140 + prodWidth + naQualWidth} y={barY + 2} width={paradoWidth} height="16" fill="#EF4444" opacity="0.8" />
                              <text x="10" y={barY + 12} textAnchor="start" fontSize="12" fontWeight="bold" fill="var(--color-text)">
                                {item.mes}
                              </text>
                              <text x={140 + prodWidth + naQualWidth + paradoWidth + 5} y={barY + 12} textAnchor="start" fontSize="13" fontWeight="bold" fill="var(--color-text)">
                                {formatNumberBR((item.tempoProdutivo + item.naoQualidade + item.tempoParado) / 60)}h
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      <div className="dashboard-stacked-legend">
                        <div className="dashboard-stacked-legend-item">
                          <span style={{ backgroundColor: '#3B82F6' }} />
                          <strong>Tempo Produtivo</strong>
                        </div>
                        <div className="dashboard-stacked-legend-item">
                          <span style={{ backgroundColor: '#F59E0B' }} />
                          <strong>Não Qualidade</strong>
                        </div>
                        <div className="dashboard-stacked-legend-item">
                          <span style={{ backgroundColor: '#EF4444' }} />
                          <strong>Tempo Parado</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )}
            </section>

            <section className="dashboard-chart-grid">
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Produção por Máquina (Top 5)</h2>
                    <p>Horas apontadas nas 5 máquinas com maior produção.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setMainChartCollapsed((prev) => !prev)}
                    aria-label={mainChartCollapsed ? 'Expandir gráfico de máquinas' : 'Encolher gráfico de máquinas'}
                  >
                    {mainChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!mainChartCollapsed && (
                  producaoMaquinaTop.length === 0 ? (
                    <p className="module-empty">Sem dados de produção por máquina.</p>
                  ) : (
                    <div className="dashboard-vendas-pie-stack">
                      <div className="dashboard-native-pie-wrap dashboard-vendas-region-pie-wrap">
                        <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico de pizza de produção por máquina">
                          {(() => {
                            let offset = 0;
                            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
                            const circleRadius = 42;
                            const circleLength = 2 * Math.PI * circleRadius;
                            const totalHoras = producaoMaquinaTop.reduce((acc: number, item: any) => acc + (item.horasApontadas ?? 0), 0);

                            return producaoMaquinaTop.map((item: any, index: number) => {
                              const value = Math.max(0, item.horasApontadas ?? 0);
                              const slice = (value / totalHoras) * circleLength;
                              const dashArray = `${slice} ${circleLength - slice}`;
                              const dashOffset = -offset;
                              const pct = ((value / totalHoras) * 100).toFixed(0);

                              // Calcular ângulo para posicionar o texto
                              const sliceAngle = (slice / circleLength) * 360;
                              const middleAngle = (offset / circleLength) * 360 + sliceAngle / 2 - 90;
                              const textRad = (middleAngle * Math.PI) / 180;
                              const textRadius = 22;
                              const textX = 60 + textRadius * Math.cos(textRad);
                              const textY = 60 + textRadius * Math.sin(textRad);

                              offset += slice;

                              return (
                                <g key={`pizza-${item.num_Maquina}`}>
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r={circleRadius}
                                    fill="none"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={28}
                                    strokeDasharray={dashArray}
                                    strokeDashoffset={dashOffset}
                                    transform="rotate(-90 60 60)"
                                  >
                                    <title>{`${item.descricao_Maquina || item.num_Maquina}: ${formatNumberBR(item.horasApontadas)}`}</title>
                                  </circle>
                                  {pct !== '0' && (
                                    <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="bold" fill="var(--color-text)" style={{ pointerEvents: 'none' }}>
                                      {pct}%
                                    </text>
                                  )}
                                </g>
                              );
                            });
                          })()}
                        </svg>
                      </div>

                      <div className="dashboard-native-legend dashboard-vendas-region-legend">
                        {producaoMaquinaTop.map((item: any, index: number) => {
                          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
                          return (
                            <div key={`legend-${item.num_Maquina}`} className="dashboard-native-legend-item dashboard-vendas-region-legend__item">
                              <span style={{ backgroundColor: colors[index % colors.length] }} />
                              <strong>{item.descricao_Maquina || item.num_Maquina}</strong>
                              <small>{formatNumberBR(item.horasApontadas)}h</small>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </article>

              {/* Gráfico Produção por Centro de Trabalho */}
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Produção por Centro de trabalho (Top 5)</h2>
                    <p>Horas apontadas nos 5 centros de trabalho com maior produção.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setCenterChartCollapsed((prev) => !prev)}
                    aria-label={centerChartCollapsed ? 'Expandir gráfico de centros' : 'Encolher gráfico de centros'}
                  >
                    {centerChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!centerChartCollapsed && (
                  centrosTrabalhoTop.length === 0 ? (
                    <p className="module-empty">Sem dados de produção por centro.</p>
                  ) : (
                    <div className="dashboard-vendas-pie-stack">
                      <div className="dashboard-native-pie-wrap dashboard-vendas-region-pie-wrap">
                        <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico de pizza de produção por centro">
                          {(() => {
                            let offset = 0;
                            const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
                            const circleRadius = 42;
                            const circleLength = 2 * Math.PI * circleRadius;
                            const totalHoras = centrosTrabalhoTop.reduce((acc: number, item: any) => acc + (item.horasApontadas ?? 0), 0);

                            return centrosTrabalhoTop.map((item: any, index: number) => {
                              const value = Math.max(0, item.horasApontadas ?? 0);
                              const slice = (value / totalHoras) * circleLength;
                              const dashArray = `${slice} ${circleLength - slice}`;
                              const dashOffset = -offset;
                              const pct = ((value / totalHoras) * 100).toFixed(0);

                              // Calcular ângulo para posicionar o texto
                              const sliceAngle = (slice / circleLength) * 360;
                              const middleAngle = (offset / circleLength) * 360 + sliceAngle / 2 - 90;
                              const textRad = (middleAngle * Math.PI) / 180;
                              const textRadius = 22;
                              const textX = 60 + textRadius * Math.cos(textRad);
                              const textY = 60 + textRadius * Math.sin(textRad);

                              offset += slice;

                              return (
                                <g key={`pizza-${item.codigo_CTrab}`}>
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r={circleRadius}
                                    fill="none"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={28}
                                    strokeDasharray={dashArray}
                                    strokeDashoffset={dashOffset}
                                    transform="rotate(-90 60 60)"
                                  >
                                    <title>{`${item.descricao_CTrab || item.codigo_CTrab}: ${formatNumberBR(item.horasApontadas)}`}</title>
                                  </circle>
                                  {pct !== '0' && (
                                    <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="bold" fill="var(--color-text)" style={{ pointerEvents: 'none' }}>
                                      {pct}%
                                    </text>
                                  )}
                                </g>
                              );
                            });
                          })()}
                        </svg>
                      </div>

                      <div className="dashboard-native-legend dashboard-vendas-region-legend">
                        {centrosTrabalhoTop.map((item: any, index: number) => {
                          const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
                          return (
                            <div key={`legend-${item.codigo_CTrab}`} className="dashboard-native-legend-item dashboard-vendas-region-legend__item">
                              <span style={{ backgroundColor: colors[index % colors.length] }} />
                              <strong>{item.descricao_CTrab || item.codigo_CTrab}</strong>
                              <small>{formatNumberBR(item.horasApontadas)}h</small>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </article>
            </section>

            {/* Paradas por Motivo */}
            <article className="card dashboard-chart-card">
              <header className="dashboard-section-header">
                <div>
                  <h2>Paradas por Motivo (Top 10)</h2>
                  <p>10 motivos com maior tempo de parada.</p>
                </div>
              </header>

              {paradasTop.length === 0 ? (
                <p className="module-empty">Sem dados de paradas.</p>
              ) : (
                <div className="dashboard-paradas-list">
                  <div className="dashboard-paradas-header">
                    <span className="dashboard-paradas-header-item">Nº</span>
                    <span className="dashboard-paradas-header-item">Motivo</span>
                    <span className="dashboard-paradas-header-item">Horas</span>
                    <span className="dashboard-paradas-header-item">Ocorrências</span>
                    <span className="dashboard-paradas-header-item">Programada</span>
                  </div>
                  {paradasTop.map((item: any, index: number) => (
                    <div key={`parada-${item.codigo_Parada}`} className="dashboard-parada-row">
                      <span className="dashboard-parada-number">{index + 1}</span>
                      <span className="dashboard-parada-motivo">{item.motivo_Parada}</span>
                      <span className="dashboard-parada-info">{formatNumberBR(item.horasParadas)}</span>
                      <span className="dashboard-parada-info">{item.totalOcorrencias}</span>
                      <span className="dashboard-parada-info">{item.parada_Programada ? 'Sim' : 'Não'}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            {/* Tabela Completa Máquinas */}
            <DashboardSummaryTable
              rows={(payload.producaoPorMaquina ?? []).map((item: any, index: number) => ({
                key: `maquina-${normalizeText(item.num_Maquina)}`,
                label: item.num_Maquina,
                order: index,
                maquina: item.num_Maquina,
                totalApontamentos: item.totalApontamentos,
                quantidadeApontada: item.quantidadeApontada,
                horasApontadas: item.horasApontadas,
              }))}
              columns={[
                { key: 'maquina', label: 'Máquina', format: 'text' },
                { key: 'totalApontamentos', label: 'Apontamentos', format: 'number' },
                { key: 'quantidadeApontada', label: 'Quantidade', format: 'number' },
                { key: 'horasApontadas', label: 'Horas', format: 'number' },
              ]}
              title="Todas as Máquinas"
              subtitle={`${payload.producaoPorMaquina.length} máquinas`}
            />

            {/* Tabela Completa Centros de Trabalho */}
            <DashboardSummaryTable
              rows={(payload.producaoPorCentroTrabalho ?? []).map((item: any, index: number) => ({
                key: `centro-${normalizeText(item.codigo_CTrab)}`,
                label: item.descricao_CTrab,
                order: index,
                codigo: item.codigo_CTrab,
                descricao: item.descricao_CTrab,
                totalApontamentos: item.totalApontamentos,
                quantidadeApontada: item.quantidadeApontada,
                horasApontadas: item.horasApontadas,
              }))}
              columns={[
                { key: 'codigo', label: 'Código', format: 'text' },
                { key: 'descricao', label: 'Descrição', format: 'text' },
                { key: 'totalApontamentos', label: 'Apontamentos', format: 'number' },
                { key: 'quantidadeApontada', label: 'Quantidade', format: 'number' },
                { key: 'horasApontadas', label: 'Horas', format: 'number' },
              ]}
              title="Todos os Centros de Trabalho"
              subtitle={`${payload.producaoPorCentroTrabalho.length} centros`}
            />

            {/* Tabela Completa Paradas */}
            <DashboardSummaryTable
              rows={(payload.paradasPorMotivo ?? [])
                .sort((a: any, b: any) => b.horasParadas - a.horasParadas)
                .map((item: any, index: number) => ({
                  key: `parada-${item.codigo_Parada}`,
                  label: item.motivo_Parada,
                  order: index,
                  motivo: item.motivo_Parada,
                  totalOcorrencias: item.totalOcorrencias,
                  horasParadas: item.horasParadas,
                  programada: item.parada_Programada ? 'Sim' : 'Não',
                }))}
              columns={[
                { key: 'motivo', label: 'Motivo', format: 'text' },
                { key: 'totalOcorrencias', label: 'Ocorrências', format: 'number' },
                { key: 'horasParadas', label: 'Horas', format: 'number' },
                { key: 'programada', label: 'Programada', format: 'text' },
              ]}
              title="Todos os Motivos de Parada"
              subtitle={`${payload.paradasPorMotivo.length} motivos`}
            />
          </>
        )}
      </section>
    </main>
  );
}
