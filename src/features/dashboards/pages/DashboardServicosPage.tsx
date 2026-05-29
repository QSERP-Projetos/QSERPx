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
import { getDashboardServicos, type DashboardServicosResponse } from '../services/dashboardApi';
import type { DashboardDateErrors, DashboardKpiCard, DashboardRow, DashboardTableColumn } from '../types';
import { chartPalette, formatCurrencyBRL, parseDateStrict, toApiDate, todayPtBr, yearStartPtBr } from '../utils/dashboardUtils';

// ─── helpers ────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// ─── component ──────────────────────────────────────────────────────────────

export function DashboardServicosPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const codigoEmpresa = useMemo(() => String(GlobalConfig.getCodEmpresa() ?? ''), []);

  const [appliedDataDe, setAppliedDataDe] = useState(yearStartPtBr());
  const [appliedDataAte, setAppliedDataAte] = useState(todayPtBr());
  const [draftDataDe, setDraftDataDe] = useState(yearStartPtBr());
  const [draftDataAte, setDraftDataAte] = useState(todayPtBr());
  const [errors, setErrors] = useState<DashboardDateErrors>({});

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [destChartCollapsed, setDestChartCollapsed] = useState(false);
  const [svcChartCollapsed, setSvcChartCollapsed] = useState(false);
  const [expandedSvc, setExpandedSvc] = useState<Set<number>>(new Set());
  const [hoveredDestCod, setHoveredDestCod] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<DashboardServicosResponse>({
    totalFaturado: 0,
    totalImpostos: 0,
    destinatarios: [],
  });

  const initialFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  // ── validation ──────────────────────────────────────────────────────────

  const validateFilters = useCallback(() => {
    const nextErrors: DashboardDateErrors = {};
    if (!String(draftDataDe).trim()) nextErrors.dataDe = 'Informe Data de.';
    if (!String(draftDataAte).trim()) nextErrors.dataAte = 'Informe Data até.';
    const parsedDe = parseDateStrict(draftDataDe);
    const parsedAte = parseDateStrict(draftDataAte);
    if (draftDataDe.trim() && !parsedDe) nextErrors.dataDe = 'Data de inválida.';
    if (draftDataAte.trim() && !parsedAte) nextErrors.dataAte = 'Data até inválida.';
    if (parsedDe && parsedAte && parsedDe.getTime() > parsedAte.getTime()) {
      nextErrors.dataDe = 'Data de não pode ser maior que Data até.';
      nextErrors.dataAte = 'Data até não pode ser menor que Data de.';
    }
    if (!codigoEmpresa.trim()) {
      setErrorMessage('Empresa inválida. Faça login novamente.');
      setErrors(nextErrors);
      return false;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [codigoEmpresa, draftDataAte, draftDataDe]);

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async (filters: { dataDe: string; dataAte: string }) => {
    const parsedDe = parseDateStrict(filters.dataDe);
    const parsedAte = parseDateStrict(filters.dataAte);
    if (!parsedDe || !parsedAte) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) {
      setErrorMessage('Sessão inválida para consultar o dashboard de serviços.');
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setErrorMessage('');
      const result = await getDashboardServicos({
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
      const message = String(error?.message || 'Erro ao carregar dashboard de serviços.');
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

  // ── derived data ─────────────────────────────────────────────────────────

  const kpis = useMemo<DashboardKpiCard[]>(() => {
    const destinatarios = payload.destinatarios ?? [];
    const totalDestinatarios = destinatarios.length;
    return [
      { key: 'total-faturado', label: 'Total faturado', value: toNum(payload.totalFaturado), format: 'currency' },
      { key: 'total-impostos', label: 'Total de impostos', value: toNum(payload.totalImpostos), format: 'currency' },
      { key: 'total-destinatarios', label: 'Clientes / Destinatários', value: totalDestinatarios, format: 'number' },
    ];
  }, [payload]);

  // destinatários ordenados por total faturado
  const sortedDestinatarios = useMemo(() => {
    return [...(payload.destinatarios ?? [])].sort((a, b) => toNum(b.totalFaturado) - toNum(a.totalFaturado));
  }, [payload.destinatarios]);

  // agrupamento de serviços (soma entre destinatários)
  const servicoSlices = useMemo(() => {
    const map = new Map<number, { nome: string; faturado: number; impostos: number }>();
    for (const dest of payload.destinatarios ?? []) {
      for (const svc of dest.servicos ?? []) {
        const existing = map.get(svc.codigoServico) ?? { nome: svc.nomeServico, faturado: 0, impostos: 0 };
        existing.faturado += toNum(svc.totalFaturado);
        existing.impostos += toNum(svc.totalImpostos);
        map.set(svc.codigoServico, existing);
      }
    }
    return Array.from(map.entries())
      .map(([codigo, item]) => ({ codigo, ...item }))
      .sort((a, b) => b.faturado - a.faturado);
  }, [payload.destinatarios]);

  const totalDestFaturado = useMemo(
    () => Math.max(1, sortedDestinatarios.reduce((acc, d) => acc + toNum(d.totalFaturado), 0)),
    [sortedDestinatarios],
  );

  const totalSvcFaturado = useMemo(
    () => Math.max(1, servicoSlices.reduce((acc, s) => acc + s.faturado, 0)),
    [servicoSlices],
  );

  const servicoDestMap = useMemo(() => {
    const map = new Map<number, Array<{ codigo: number; nome: string; total: number }>>();
    for (const dest of sortedDestinatarios) {
      for (const svc of dest.servicos ?? []) {
        const existing = map.get(svc.codigoServico);
        if (existing) {
          const destEntry = existing.find((d) => d.codigo === dest.codigoDestinatario);
          if (destEntry) {
            destEntry.total += toNum(svc.totalFaturado);
          } else {
            existing.push({ codigo: dest.codigoDestinatario, nome: dest.nomeDestinatario.trim(), total: toNum(svc.totalFaturado) });
          }
        } else {
          map.set(svc.codigoServico, [{ codigo: dest.codigoDestinatario, nome: dest.nomeDestinatario.trim(), total: toNum(svc.totalFaturado) }]);
        }
      }
    }
    for (const [key, dests] of map.entries()) {
      map.set(key, dests.sort((a, b) => b.total - a.total));
    }
    return map;
  }, [sortedDestinatarios]);

  const hasAnyData = (payload.destinatarios?.length ?? 0) > 0;

  const summaryRows = useMemo<DashboardRow[]>(() => {
    return sortedDestinatarios.map((dest) => ({
      key: String(dest.codigoDestinatario),
      label: dest.nomeDestinatario.trim(),
      destinatario: dest.nomeDestinatario.trim(),
      faturado: toNum(dest.totalFaturado),
      impostos: toNum(dest.totalImpostos),
    }));
  }, [sortedDestinatarios]);

  const summaryColumns = useMemo<DashboardTableColumn[]>(() => [
    { key: 'destinatario', label: 'Destinatário', format: 'text' },
    { key: 'faturado', label: 'Total faturado', format: 'currency' },
    { key: 'impostos', label: 'Total impostos', format: 'currency' },
  ], []);

  const summaryServicesByDest = useMemo(() => {
    const map = new Map<string, Array<{ key: string; label: string; total: number }>>();
    for (const dest of sortedDestinatarios) {
      const rowKey = String(dest.codigoDestinatario);
      const services = (dest.servicos ?? []).map((svc) => ({
        key: String(svc.codigoServico),
        label: svc.nomeServico?.trim() || 'Sem descrição',
        total: toNum(svc.totalFaturado),
      }));
      map.set(rowKey, services);
    }
    return map;
  }, [sortedDestinatarios]);

  const renderRowDetails = useCallback((row: DashboardRow) => {
    const services = summaryServicesByDest.get(row.key) ?? [];
    if (!services.length) {
      return <p className="dashboard-summary-table__details-empty">Sem serviços faturados para este destinatário no período.</p>;
    }
    return (
      <ol className="dashboard-summary-table__materials-list">
        {services.map((svc, index) => (
          <li key={`${row.key}-${svc.key}`}>
            <span className="dashboard-summary-table__materials-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>{svc.label}</span>
            <strong>{formatCurrencyBRL(svc.total)}</strong>
          </li>
        ))}
      </ol>
    );
  }, [summaryServicesByDest]);

  // ── actions ──────────────────────────────────────────────────────────────
  const toggleSvc = (cod: number) => {
    setExpandedSvc((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) { next.delete(cod); } else { next.add(cod); }
      return next;
    });
  };
  const handleExportExcel = () => {
    if (!sortedDestinatarios.length) { showToast('Sem dados para exportar.', 'info'); return; }
    try {
      const rows: Record<string, unknown>[] = [];
      for (const dest of sortedDestinatarios) {
        for (const svc of dest.servicos) {
          rows.push({
            Destinatario: dest.nomeDestinatario,
            Servico: svc.nomeServico,
            Total_Faturado: toNum(svc.totalFaturado),
            Total_Impostos: toNum(svc.totalImpostos),
          });
        }
      }
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Serviços Faturados');
      const fileDe = String(appliedDataDe || '').replace(/\//g, '-');
      const fileAte = String(appliedDataAte || '').replace(/\//g, '-');
      XLSX.writeFile(workbook, `dashboard-servicos-${fileDe}-a-${fileAte}.xlsx`);
      showToast('Arquivo Excel exportado com sucesso.', 'success');
    } catch (err: any) {
      showToast(String(err?.message || 'Falha ao exportar Excel.'), 'error');
    }
  };

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <main className="clientes-page list-layout-page dashboard-page dashboard-vendas-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Dashboard - Serviços</h1>
            <p>Faturamento de notas fiscais de serviço por destinatário e tipo de serviço.</p>
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
                if (!appliedDataDe || !appliedDataAte) { setAdvancedOpen(true); return; }
                void fetchDashboard({ dataDe: appliedDataDe, dataAte: appliedDataAte });
              }}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
            {hasAnyData && (
              <button
                className="icon-button module-action-button"
                type="button"
                onClick={handleExportExcel}
                title="Exportar Excel"
                aria-label="Exportar Excel"
              >
                <IoDownloadOutline size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="dashboard-period-range">Período: {appliedDataDe} - {appliedDataAte}</p>

        {errorMessage ? <p className="status-box status-box--error">{errorMessage}</p> : null}
        {loading ? <p className="module-empty">Carregando dashboard de serviços...</p> : null}

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
            {/* KPIs */}
            <DashboardKpiCards cards={kpis} />

            <section className="dashboard-chart-grid">
              {/* ── Gráfico pizza destinatários ─────────────────────────── */}
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Faturamento por destinatário</h2>
                    <p>Distribuição do valor faturado entre os destinatários no período.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setDestChartCollapsed((prev) => !prev)}
                    aria-label={destChartCollapsed ? 'Expandir' : 'Encolher'}
                  >
                    {destChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!destChartCollapsed && (
                  <div className="dashboard-vendas-pie-stack">
                    {/* pizza */}
                    <div className="dashboard-native-pie-wrap dashboard-vendas-region-pie-wrap">
                      <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico pizza destinatários">
                        {(() => {
                          let offset = 0;
                          const radius = 42;
                          const circ = 2 * Math.PI * radius;
                          return sortedDestinatarios.slice(0, 8).map((dest, idx) => {
                            const value = Math.max(0, toNum(dest.totalFaturado));
                            const slice = (value / totalDestFaturado) * circ;
                            const dashOffset = -offset;
                            offset += slice;
                            return (
                              <circle
                                key={dest.codigoDestinatario}
                                cx="60" cy="60" r={radius}
                                fill="none"
                                stroke={chartPalette[idx % chartPalette.length]}
                                strokeWidth="16"
                                strokeDasharray={`${slice} ${circ - slice}`}
                                strokeDashoffset={dashOffset}
                                style={{ transition: 'stroke-dasharray 0.4s ease' }}
                              />
                            );
                          });
                        })()}
                        <circle cx="60" cy="60" r="32" fill="var(--color-surface)" />
                        <text x="60" y="56" textAnchor="middle" fontSize="6" fill="var(--color-muted)">Total</text>
                        <text x="60" y="65" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="var(--color-text)">
                          {formatCurrencyBRL(payload.totalFaturado)}
                        </text>
                      </svg>

                      {/* painel de hover — coluna 2 do pie-wrap */}
                      <div className="dashboard-vendas-region-tooltip">
                        {hoveredDestCod === null ? (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                            Passe o mouse sobre um destinatário para ver os serviços faturados.
                          </p>
                        ) : (() => {
                          const dest = sortedDestinatarios.find((d) => d.codigoDestinatario === hoveredDestCod);
                          const top3 = (summaryServicesByDest.get(String(hoveredDestCod)) ?? []).slice(0, 3);
                          return (
                            <>
                              <p style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                {dest?.nomeDestinatario.trim() ?? ''}
                              </p>
                              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--color-muted)' }}>Top serviços faturados:</p>
                              {top3.length > 0 ? (
                                <ol>
                                  {top3.map((svc) => (
                                    <li key={svc.key}>
                                      <span>{svc.label}</span>
                                      <strong>{formatCurrencyBRL(svc.total)}</strong>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sem serviços registrados.</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* legenda */}
                    <div className="dashboard-native-legend dashboard-vendas-region-legend">
                      {sortedDestinatarios.slice(0, 8).map((dest, idx) => {
                        const pct = totalDestFaturado > 0 ? ((toNum(dest.totalFaturado) / totalDestFaturado) * 100).toFixed(1) : '0.0';
                        return (
                          <div
                            key={dest.codigoDestinatario}
                            className={`dashboard-native-legend-item dashboard-vendas-region-legend__item${hoveredDestCod === dest.codigoDestinatario ? ' is-active' : ''}`}
                            style={{ gridTemplateColumns: '12px minmax(0, 1fr) auto auto' }}
                            onMouseEnter={() => setHoveredDestCod(dest.codigoDestinatario)}
                            onMouseLeave={() => setHoveredDestCod(null)}
                          >
                            <span style={{ backgroundColor: chartPalette[idx % chartPalette.length] }} />
                            <strong>{dest.nomeDestinatario.trim()}</strong>
                            <small>{formatCurrencyBRL(toNum(dest.totalFaturado))}</small>
                            <small style={{ minWidth: 44, textAlign: 'right' }}>{pct}%</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>

              {/* ── Gráfico pizza serviços ───────────────────────────────── */}
              <article className="card dashboard-chart-card">
                <header className="dashboard-section-header dashboard-section-header--collapsible">
                  <div>
                    <h2>Faturamento por serviço</h2>
                    <p>Distribuição do valor faturado por tipo de serviço no período.</p>
                  </div>
                  <button
                    type="button"
                    className="home-dashboard-card__collapse"
                    onClick={() => setSvcChartCollapsed((prev) => !prev)}
                    aria-label={svcChartCollapsed ? 'Expandir' : 'Encolher'}
                  >
                    {svcChartCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
                  </button>
                </header>

                {!svcChartCollapsed && (
                  servicoSlices.length === 0 ? (
                    <p className="module-empty">Sem serviços faturados no período.</p>
                  ) : (
                    <div className="dashboard-native-bars is-horizontal dashboard-vendas-top-client-bars" style={{ alignContent: 'start' }}>
                      {servicoSlices.map((svc, index) => {
                        const sizePercent = Math.max(2, (svc.faturado / totalSvcFaturado) * 100);
                        const isExpanded = expandedSvc.has(svc.codigo);
                        const dests = servicoDestMap.get(svc.codigo) ?? [];
                        return (
                          <article key={svc.codigo} className={`dashboard-vendas-top-client${isExpanded ? ' is-expanded' : ''}`}>
                            <button
                              type="button"
                              className="dashboard-native-row dashboard-vendas-top-client__trigger"
                              title={`${svc.nome || 'Sem descrição'}: ${formatCurrencyBRL(svc.faturado)}`}
                              onClick={() => toggleSvc(svc.codigo)}
                              aria-expanded={isExpanded}
                            >
                              <div className="dashboard-native-row-label dashboard-vendas-top-client__label">
                                <strong className="dashboard-vendas-top-client__name">{svc.nome || 'Sem descrição'}</strong>
                              </div>
                              <div className="dashboard-native-track" aria-hidden="true">
                                <div
                                  className="dashboard-native-fill"
                                  style={{ width: `${sizePercent}%`, backgroundColor: chartPalette[index % chartPalette.length] }}
                                />
                              </div>
                              <div className="dashboard-native-row-value dashboard-vendas-top-client__value">
                                <span>{formatCurrencyBRL(svc.faturado)}</span>
                                {isExpanded ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="dashboard-vendas-top-client__details">
                                {dests.length > 0 ? (
                                  <ol>
                                    {dests.map((dest) => (
                                      <li key={`${svc.codigo}-${dest.codigo}`} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                                        <span>{dest.nome}</span>
                                        <strong>{formatCurrencyBRL(dest.total)}</strong>
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="dashboard-vendas-top-client__empty">Sem destinatários associados.</p>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )
                )}
              </article>
            </section>

            {/* ── Tabela detalhada por destinatário ────────────────────── */}
            <DashboardSummaryTable
              rows={summaryRows}
              columns={summaryColumns}
              searchEnabled
              searchPlaceholder="Pesquisar destinatário"
              initialSortColumnKey="faturado"
              initialSortDirection="desc"
              renderRowDetails={renderRowDetails}
              rowDetailsTitle="Serviços faturados"
              headerAction={(
                <button
                  className="icon-button module-action-button"
                  type="button"
                  onClick={handleExportExcel}
                  title="Exportar Excel"
                  aria-label="Exportar Excel"
                >
                  <IoDownloadOutline size={16} />
                </button>
              )}
            />
          </>
        )}
      </section>
    </main>
  );
}
