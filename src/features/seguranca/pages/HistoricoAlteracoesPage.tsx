import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoEyeOutline,
  IoFilterOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';
import { ListSearchField } from '../../../components/ListSearchField';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess } from '../../../hooks/useTransactionAccess';
import { getTodayBr, toBrDateFromIso, toIsoDateFromBr } from '../../../services/faturamentoApi';
import {
  listarHistoricoAlteracoes,
  obterFiltrosHistoricoAlteracoes,
  type HistoricoAlteracaoItemDto,
  type HistoricoTransacaoFiltroDto,
  type HistoricoUsuarioFiltroDto,
} from '../../../services/historicoAlteracoesApi';
import {
  compareSortNumber,
  compareSortText,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';

type SortField = 'data' | 'transacao' | 'chave' | 'campo' | 'usuario';

const PAGE_SIZE = 100;

const getDaysAgoBr = (days: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export function HistoricoAlteracoesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const detalheTitleId = useId();
  const permissaoStatus = useTransactionAccess('CFG007', 'Histórico de Alterações', true);

  const [itens, setItens] = useState<HistoricoAlteracaoItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [transacoesDisp, setTransacoesDisp] = useState<HistoricoTransacaoFiltroDto[]>([]);
  const [usuariosDisp, setUsuariosDisp] = useState<HistoricoUsuarioFiltroDto[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => getDaysAgoBr(30));
  const [dataFim, setDataFim] = useState(() => getTodayBr());
  const [filtroTransacao, setFiltroTransacao] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroChave, setFiltroChave] = useState('');
  const [filtroCampo, setFiltroCampo] = useState('');

  const [draftInicio, setDraftInicio] = useState(dataInicio);
  const [draftFim, setDraftFim] = useState(dataFim);
  const [draftTransacao, setDraftTransacao] = useState('');
  const [draftUsuario, setDraftUsuario] = useState('');
  const [draftChave, setDraftChave] = useState('');
  const [draftCampo, setDraftCampo] = useState('');

  const [sortField, setSortField] = useState<SortField>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [detalheItem, setDetalheItem] = useState<HistoricoAlteracaoItemDto | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    let cancelled = false;
    const loadFiltros = async () => {
      try {
        const res = await obterFiltrosHistoricoAlteracoes();
        if (cancelled) return;
        setTransacoesDisp(res.transacoes);
        setUsuariosDisp(res.usuarios);
      } catch (err: any) {
        if (!cancelled) {
          showToast(err?.message || 'Erro ao carregar filtros do histórico.', 'error');
        }
      }
    };
    void loadFiltros();
    return () => {
      cancelled = true;
    };
  }, [permissaoStatus, showToast]);

  const carregarHistorico = useCallback(async () => {
    if (permissaoStatus !== 'autorizado') return;
    setLoading(true);
    try {
      const res = await listarHistoricoAlteracoes({
        dataInicio: toIsoDateFromBr(dataInicio),
        dataFim: toIsoDateFromBr(dataFim),
        codigoTransacao: filtroTransacao || undefined,
        codigoUsuario: filtroUsuario || undefined,
        chaveRegistro: filtroChave || undefined,
        nomeCampo: filtroCampo || undefined,
        termo: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItens(res.itens);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar histórico de alterações.', 'error');
      setItens([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    dataFim,
    dataInicio,
    debouncedSearch,
    filtroCampo,
    filtroChave,
    filtroTransacao,
    filtroUsuario,
    page,
    permissaoStatus,
    showToast,
  ]);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const transacaoOptions = useMemo(
    () => [
      { value: '', label: 'Todas as transações' },
      ...transacoesDisp.map((t) => ({
        value: t.codigoTransacao,
        label: `${t.codigoTransacao} — ${t.nomeFormulario || t.codigoTransacao}`,
      })),
    ],
    [transacoesDisp],
  );

  const usuarioOptions = useMemo(
    () => [
      { value: '', label: 'Todos os usuários' },
      ...usuariosDisp.map((u) => ({
        value: u.codigoUsuario,
        label: u.nomeUsuario ? `${u.codigoUsuario} — ${u.nomeUsuario}` : u.codigoUsuario,
      })),
    ],
    [usuariosDisp],
  );

  const abrirFiltros = () => {
    setDraftInicio(dataInicio);
    setDraftFim(dataFim);
    setDraftTransacao(filtroTransacao);
    setDraftUsuario(filtroUsuario);
    setDraftChave(filtroChave);
    setDraftCampo(filtroCampo);
    setFiltrosOpen(true);
  };

  const aplicarFiltros = () => {
    setDataInicio(draftInicio);
    setDataFim(draftFim);
    setFiltroTransacao(draftTransacao);
    setFiltroUsuario(draftUsuario);
    setFiltroChave(draftChave.trim());
    setFiltroCampo(draftCampo.trim());
    setPage(1);
    setFiltrosOpen(false);
  };

  const limparFiltros = () => {
    const ini = getDaysAgoBr(30);
    const fim = getTodayBr();
    setDraftInicio(ini);
    setDraftFim(fim);
    setDraftTransacao('');
    setDraftUsuario('');
    setDraftChave('');
    setDraftCampo('');
    setDataInicio(ini);
    setDataFim(fim);
    setFiltroTransacao('');
    setFiltroUsuario('');
    setFiltroChave('');
    setFiltroCampo('');
    setPage(1);
    setFiltrosOpen(false);
  };

  const temFiltrosAtivos = Boolean(
    filtroTransacao ||
      filtroUsuario ||
      filtroChave ||
      filtroCampo ||
      dataInicio !== getDaysAgoBr(30) ||
      dataFim !== getTodayBr(),
  );

  const handleSort = (field: SortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const itensOrdenados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = !term
      ? itens
      : itens.filter((item) =>
          [
            item.codigoTransacao,
            item.nomeTransacao,
            item.chaveRegistro,
            item.nomeCampo,
            item.codigoUsuario,
            item.valorAntigo,
            item.valorNovo,
          ].some((v) => String(v || '').toLowerCase().includes(term)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'transacao':
          return compareSortText(a.nomeTransacao || a.codigoTransacao, b.nomeTransacao || b.codigoTransacao);
        case 'chave':
          return compareSortText(a.chaveRegistro, b.chaveRegistro);
        case 'campo':
          return compareSortText(a.nomeCampo, b.nomeCampo);
        case 'usuario':
          return compareSortText(a.codigoUsuario, b.codigoUsuario);
        default: {
          const tsA = parseSortTimestamp(`${a.dataAlteracao}T${a.horaAlteracao || '00:00:00'}`);
          const tsB = parseSortTimestamp(`${b.dataAlteracao}T${b.horaAlteracao || '00:00:00'}`);
          if (tsA !== tsB) return compareSortNumber(tsA, tsB);
          return compareSortNumber(a.codigoAlteracao, b.codigoAlteracao);
        }
      }
    });
  }, [itens, search, sortDirection, sortField]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page historico-alteracoes-page">
        <section className="clientes-panel list-layout-panel">
          <p className="module-empty">Verificando permissão de acesso...</p>
        </section>
      </main>
    );
  }

  if (permissaoStatus === 'negado') {
    return null;
  }

  return (
    <main className="clientes-page list-layout-page historico-alteracoes-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(ROUTES.home)}
            aria-label="Voltar"
          >
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Histórico de Alterações</h1>
            <p>Auditoria de inclusões, alterações e exclusões das rotinas habilitadas no QSERPx.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Registros de Auditoria</strong>
            <span>{`${total} encontrados`}</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar chave, campo, valor, usuário ou transação"
            />

            <button
              type="button"
              className={`icon-button module-action-button${temFiltrosAtivos ? ' is-active' : ''}`}
              title="Filtros avançados"
              aria-label="Filtros avançados"
              onClick={abrirFiltros}
            >
              <IoFilterOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
              onClick={() => void carregarHistorico()}
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        <section className="module-table list-layout-table">
          {loading ? (
            <p className="module-empty">Carregando histórico de alterações...</p>
          ) : itensOrdenados.length === 0 ? (
            <p className="module-empty">Nenhum registro de alteração encontrado.</p>
          ) : (
            <div className="data-cards-region">
              <DataListSortBar
                options={[
                  { field: 'data', label: 'Data / Hora' },
                  { field: 'transacao', label: 'Transação' },
                  { field: 'chave', label: 'Chave' },
                  { field: 'campo', label: 'Campo' },
                  { field: 'usuario', label: 'Usuário' },
                ]}
                active={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />

              <DataList ariaLabel="Histórico de Alterações">
                {itensOrdenados.map((item) => {
                  const dataBr = toBrDateFromIso(item.dataAlteracao);
                  const dataHora = [dataBr, item.horaAlteracao].filter(Boolean).join(' • ');

                  return (
                    <DataListItem
                      key={item.codigoAlteracao}
                      code={item.codigoTransacao || '-'}
                      title={<span data-no-translate="">{item.chaveRegistro || '—'}</span>}
                      subtitle={
                        <span data-no-translate="">
                          {item.nomeTransacao || item.codigoTransacao}
                        </span>
                      }
                      details={[
                        { label: 'Campo', value: <span data-no-translate="">{item.nomeCampo || '-'}</span> },
                        {
                          label: 'Anterior',
                          value: (
                            <span data-no-translate="">
                              {item.valorAntigo !== '' ? item.valorAntigo : '""'}
                            </span>
                          ),
                        },
                        {
                          label: 'Novo',
                          value: (
                            <span data-no-translate="">
                              {item.valorNovo !== '' ? item.valorNovo : '""'}
                            </span>
                          ),
                        },
                        { label: 'Usuário', value: <span data-no-translate="">{item.codigoUsuario || '-'}</span> },
                      ]}
                      aside={dataHora || '-'}
                      onOpen={() => setDetalheItem(item)}
                      actions={
                        <button
                          type="button"
                          className="icon-button"
                          title="Visualizar detalhes"
                          aria-label="Visualizar detalhes"
                          onClick={() => setDetalheItem(item)}
                        >
                          <IoEyeOutline size={16} />
                        </button>
                      }
                    />
                  );
                })}
              </DataList>

              {totalPaginas > 1 && (
                <div className="clientes-panel__top" style={{ marginTop: 12 }}>
                  <span>{`Página ${page} de ${totalPaginas}`}</span>
                  <div className="list-layout-controls">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <IoChevronBackOutline size={16} />
                      <span>Anterior</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={page >= totalPaginas || loading}
                      onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                    >
                      <span>Próxima</span>
                      <IoChevronForwardOutline size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      <AdvancedFiltersPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        onApply={aplicarFiltros}
        applyLabel="Aplicar filtros"
        title="Filtros do Histórico"
      >
        <div className="module-form">
          <div className="form-grid-2">
            <label>
              <span>Data início</span>
              <CustomDatePicker value={draftInicio} onChange={setDraftInicio} />
            </label>
            <label>
              <span>Data fim</span>
              <CustomDatePicker value={draftFim} onChange={setDraftFim} />
            </label>
            <label className="form-grid-2__full">
              <span>Transação (QSERPx com histórico ativo)</span>
              <SearchableSelect
                options={transacaoOptions}
                value={draftTransacao}
                onChange={setDraftTransacao}
                placeholder="Todas as transações"
                searchPlaceholder="Pesquisar transação..."
              />
            </label>
            <label className="form-grid-2__full">
              <span>Usuário</span>
              <SearchableSelect
                options={usuarioOptions}
                value={draftUsuario}
                onChange={setDraftUsuario}
                placeholder="Todos os usuários"
                searchPlaceholder="Pesquisar usuário..."
              />
            </label>
            <label>
              <span>Chave do registro</span>
              <input
                type="text"
                value={draftChave}
                onChange={(e) => setDraftChave(e.target.value)}
                placeholder="Ex.: NF, OS, cliente..."
              />
            </label>
            <label>
              <span>Campo / Evento</span>
              <input
                type="text"
                value={draftCampo}
                onChange={(e) => setDraftCampo(e.target.value)}
                placeholder="Ex.: Valor_Total_Nota..."
              />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="secondary-button" onClick={limparFiltros}>
              Limpar filtros
            </button>
          </div>
        </div>
      </AdvancedFiltersPanel>

      {detalheItem && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={detalheTitleId}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetalheItem(null);
          }}
        >
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2 id={detalheTitleId}>{`Detalhes da Alteração #${detalheItem.codigoAlteracao}`}</h2>
              <ModalHeaderActions onClose={() => setDetalheItem(null)} expandable={false} />
            </header>
            <div className="module-form fat-modal-body">
              <div className="form-grid-3">
                <label className="form-grid-3__span2">
                  <span>Transação</span>
                  <input
                    type="text"
                    readOnly
                    value={`${detalheItem.codigoTransacao} — ${detalheItem.nomeTransacao}`}
                    data-no-translate=""
                  />
                </label>
                <label>
                  <span>Código Empresa</span>
                  <input
                    type="text"
                    readOnly
                    value={detalheItem.codigoEmpresa != null ? String(detalheItem.codigoEmpresa) : '-'}
                  />
                </label>
                <label>
                  <span>Data da Alteração</span>
                  <input type="text" readOnly value={toBrDateFromIso(detalheItem.dataAlteracao) || '-'} />
                </label>
                <label>
                  <span>Hora da Alteração</span>
                  <input type="text" readOnly value={detalheItem.horaAlteracao || '-'} />
                </label>
                <label>
                  <span>Usuário</span>
                  <input type="text" readOnly value={detalheItem.codigoUsuario || '-'} data-no-translate="" />
                </label>
                <label className="form-grid-3__span2">
                  <span>Chave do Registro</span>
                  <input type="text" readOnly value={detalheItem.chaveRegistro || '-'} data-no-translate="" />
                </label>
                <label>
                  <span>Campo / Evento</span>
                  <input type="text" readOnly value={detalheItem.nomeCampo || '-'} data-no-translate="" />
                </label>
                <label className="form-grid-3__span2">
                  <span>Valor Anterior</span>
                  <input
                    type="text"
                    readOnly
                    value={detalheItem.valorAntigo !== '' ? detalheItem.valorAntigo : '""'}
                    data-no-translate=""
                  />
                </label>
                <label>
                  <span>Código do Campo</span>
                  <input
                    type="text"
                    readOnly
                    value={detalheItem.codigoCampo != null ? String(detalheItem.codigoCampo) : '-'}
                  />
                </label>
                <label className="form-grid-3__full">
                  <span>Valor Novo</span>
                  <input
                    type="text"
                    readOnly
                    value={detalheItem.valorNovo !== '' ? detalheItem.valorNovo : '""'}
                    data-no-translate=""
                  />
                </label>
              </div>
            </div>
            <footer className="modal-card__footer">
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setDetalheItem(null)}
              >
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}
    </main>
  );
}
