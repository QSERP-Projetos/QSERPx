import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCheckmarkDoneOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoEyeOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { BetaHelpBadge } from '../../../components/BetaHelpBadge';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';
import { ListSearchField } from '../../../components/ListSearchField';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { StatusBadge } from '../../../components/StatusBadge';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess } from '../../../hooks/useTransactionAccess';
import {
  cancelarSolicitacaoNfDiversa,
  confirmarSolicitacaoNfDiversa,
  excluirSolicitacaoNfDiversa,
  formatCurrencyBr,
  getFirstDayMonthBr,
  getTodayBr,
  listarSolicitacoesNfDiversa,
  obterCombosSolicitacaoNfDiversa,
  toBrDateFromIso,
  toIsoDateFromBr,
  type SolicitacaoNfDiversaCombos,
  type SolicitacaoNfDiversaListItem,
} from '../../../services/solicitacaoNfDiversaApi';
import {
  compareSortNumber,
  compareSortText,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';
import { SolicitacaoNfDiversaFormModal } from '../components/SolicitacaoNfDiversaFormModal';

type AbaSolicitacao = 'em_digitacao' | 'pendentes' | 'emitidas' | 'todas';
type SortField = 'numero' | 'data' | 'destinatario' | 'tipo' | 'valor' | 'situacao';

type ConfirmacaoLista = {
  acao: 'excluir' | 'cancelar' | 'confirmar' | 'confirmar_sem_saldo';
  item: SolicitacaoNfDiversaListItem;
  titulo: string;
  mensagem: string;
  erros?: string[];
};

const TIPO_FILTRO_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'Todos os tipos' },
  { value: '1', label: 'Entrada' },
  { value: '2', label: 'Saída' },
  { value: '3', label: 'Serviço' },
];

export function SolicitacaoNfDiversaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const permissaoStatus = useTransactionAccess('PCP009', 'Solicitação de NF Diversa');

  const [aba, setAba] = useState<AbaSolicitacao>('em_digitacao');
  const [rows, setRows] = useState<SolicitacaoNfDiversaListItem[]>([]);
  const [combos, setCombos] = useState<SolicitacaoNfDiversaCombos | null>(null);
  const [loading, setLoading] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  // Busca e filtros avançados
  const [search, setSearch] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDestinatarioChave, setFiltroDestinatarioChave] = useState('');
  const [filtroEntradaSaida, setFiltroEntradaSaida] = useState('');
  const [filtroNumSolic, setFiltroNumSolic] = useState('');

  // Filtros aplicados
  const [aplicados, setAplicados] = useState({
    dataInicio: '',
    dataFim: '',
    destinatarioChave: '',
    entradaSaida: '',
    numSolic: '',
  });

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal de edição / consulta
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNumSolic, setModalNumSolic] = useState<number | null>(null);
  const [modalSomenteLeitura, setModalSomenteLeitura] = useState(false);

  // Modal de confirmação na listagem
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoLista | null>(null);

  const carregarCombos = useCallback(async () => {
    try {
      const data = await obterCombosSolicitacaoNfDiversa();
      setCombos(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar cadastros auxiliares.', 'error');
    }
  }, [showToast]);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    try {
      let tipoDest: string | undefined;
      let codDest: number | undefined;
      if (aplicados.destinatarioChave) {
        const [t, c] = aplicados.destinatarioChave.split(':');
        tipoDest = t || undefined;
        codDest = Number(c || 0) || undefined;
      }

      const numSolic = Number(aplicados.numSolic.replace(/\D/g, '')) || undefined;
      const entradaSaida = Number(aplicados.entradaSaida) || undefined;

      const data = await listarSolicitacoesNfDiversa({
        aba,
        dataInicio: aplicados.dataInicio || undefined,
        dataFim: aplicados.dataFim || undefined,
        tipoDestinatario: tipoDest,
        codigoDestinatario: codDest,
        numSolicitacao: numSolic,
        entradaSaida,
      });
      setRows(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar solicitações de NF Diversa.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [aba, aplicados, showToast]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarCombos();
  }, [carregarCombos, permissaoStatus]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarLista();
  }, [carregarLista, permissaoStatus]);

  const handleTrocarAba = (novaAba: AbaSolicitacao) => {
    setAba(novaAba);
    if (novaAba !== 'em_digitacao' && !aplicados.dataInicio && !aplicados.dataFim && !aplicados.numSolic) {
      const ini = getFirstDayMonthBr();
      const fim = getTodayBr();
      setFiltroDataInicio(ini);
      setFiltroDataFim(fim);
      setAplicados((prev) => ({ ...prev, dataInicio: ini, dataFim: fim }));
    } else if (novaAba === 'em_digitacao' && aplicados.dataInicio && aplicados.dataFim) {
      setFiltroDataInicio('');
      setFiltroDataFim('');
      setAplicados((prev) => ({ ...prev, dataInicio: '', dataFim: '' }));
    }
  };

  const destinatariosFiltroOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: 'Todos os destinatários' },
      ...(combos?.destinatarios ?? []).map((d) => ({
        value: d.chave,
        label: `[${d.tipoDestinatario === 'C' ? 'Cliente' : 'Fornecedor'}] ${d.nomeFantasia} (${d.codigoDestinatario})`,
      })),
    ];
  }, [combos]);

  const filteredRows = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((r) => {
      const numFmt = String(r.numSolicitacao).padStart(6, '0');
      return (
        String(r.numSolicitacao).includes(termo) ||
        numFmt.includes(termo) ||
        (r.nomeDestinatario || '').toLowerCase().includes(termo) ||
        (r.motivoSolicitacao || '').toLowerCase().includes(termo) ||
        (r.codigoCfo || '').toLowerCase().includes(termo) ||
        (r.descricaoCfo || '').toLowerCase().includes(termo) ||
        (r.codigoSolicitante || '').toLowerCase().includes(termo) ||
        (r.numNotaFiscal || '').toLowerCase().includes(termo)
      );
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return sortByComparator(filteredRows, sortDirection, (a, b) => {
      switch (sortField) {
        case 'numero':
          return compareSortNumber(a.numSolicitacao, b.numSolicitacao);
        case 'data':
          return compareSortNumber(parseSortTimestamp(a.dataSolicitacao), parseSortTimestamp(b.dataSolicitacao));
        case 'destinatario':
          return compareSortText(a.nomeDestinatario, b.nomeDestinatario);
        case 'tipo':
          return compareSortText(a.entradaSaidaDescricao, b.entradaSaidaDescricao);
        case 'valor':
          return compareSortNumber(a.valorTotal, b.valorTotal);
        case 'situacao':
          return compareSortText(a.situacaoDescricao, b.situacaoDescricao);
        default:
          return 0;
      }
    });
  }, [filteredRows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const handleAplicarFiltros = () => {
    const di = toIsoDateFromBr(filtroDataInicio);
    const df = toIsoDateFromBr(filtroDataFim);
    if (di && df && df < di) {
      showToast('Data Final deve ser maior ou igual a Data Inicial!', 'error');
      return;
    }
    setAplicados({
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim,
      destinatarioChave: filtroDestinatarioChave,
      entradaSaida: filtroEntradaSaida,
      numSolic: filtroNumSolic,
    });
    setFiltrosOpen(false);
  };

  const handleLimparFiltros = () => {
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroDestinatarioChave('');
    setFiltroEntradaSaida('');
    setFiltroNumSolic('');
    setAplicados({
      dataInicio: '',
      dataFim: '',
      destinatarioChave: '',
      entradaSaida: '',
      numSolic: '',
    });
    setFiltrosOpen(false);
  };

  const temFiltrosAtivos = Boolean(
    aplicados.dataInicio ||
      aplicados.dataFim ||
      aplicados.destinatarioChave ||
      aplicados.entradaSaida ||
      aplicados.numSolic,
  );

  const abrirNova = () => {
    setModalNumSolic(null);
    setModalSomenteLeitura(false);
    setModalOpen(true);
  };

  const abrirRegistro = (row: SolicitacaoNfDiversaListItem, forcarConsulta = false) => {
    setModalNumSolic(row.numSolicitacao);
    setModalSomenteLeitura(forcarConsulta || row.situacaoSolicitacao > 0 || !row.podeEditar);
    setModalOpen(true);
  };

  const executarConfirmacaoLista = async () => {
    if (!confirmacao) return;
    setProcessandoAcao(true);
    try {
      const { acao, item } = confirmacao;
      if (acao === 'excluir') {
        const res = await excluirSolicitacaoNfDiversa(item.numSolicitacao);
        if (!res.sucesso) {
          showToast(res.mensagem || 'Não foi possível excluir a solicitação.', 'error');
          return;
        }
        showToast(res.mensagem || 'Solicitação excluída com sucesso.', 'success');
      } else if (acao === 'cancelar') {
        const res = await cancelarSolicitacaoNfDiversa(item.numSolicitacao);
        if (!res.sucesso) {
          showToast(res.mensagem || 'Não foi possível cancelar a solicitação.', 'error');
          return;
        }
        showToast(res.mensagem || 'Solicitação cancelada e reaberta para digitação.', 'success');
      } else if (acao === 'confirmar' || acao === 'confirmar_sem_saldo') {
        const res = await confirmarSolicitacaoNfDiversa(item.numSolicitacao, acao === 'confirmar_sem_saldo');
        if (!res.sucesso && res.codigoConfirmacao === 'CONFIRMAR_SEM_SALDO') {
          setConfirmacao({
            acao: 'confirmar_sem_saldo',
            item,
            titulo: 'Saldo insuficiente em estoque disponível',
            mensagem: res.mensagem,
            erros: res.erros ?? undefined,
          });
          return;
        }
        if (!res.sucesso) {
          const msgDetalhada = res.erros && res.erros.length > 1 ? res.erros.join(' | ') : res.mensagem;
          showToast(msgDetalhada || 'Não foi possível confirmar a solicitação.', 'error');
          setConfirmacao(null);
          return;
        }
        showToast(res.mensagem || 'Solicitação confirmada com sucesso!', 'success');
      }

      setConfirmacao(null);
      void carregarLista();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao executar ação.', 'error');
    } finally {
      setProcessandoAcao(false);
    }
  };

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page solicitacao-nf-diversa-page">
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
    <main className="clientes-page list-layout-page solicitacao-nf-diversa-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(ROUTES.home)}
            aria-label="Voltar para o início"
          >
            <IoArrowBack size={18} />
          </button>
          <div>
            <div className="page-title-beta-row">
              <h1>Solicitação de NF Diversa</h1>
              <BetaHelpBadge />
            </div>
            <p>Gerencie rascunhos, confirmações e consultas de solicitações de NF diversa.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Solicitações</strong>
            <span>{`${sortedRows.length} encontradas`}</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Pesquisar"
              placeholder="Pesquisar número, destinatário, motivo ou CFO"
              className="clientes-search"
            />

            <button
              className={`icon-button module-action-button${temFiltrosAtivos ? ' module-action-button--active' : ''}`}
              type="button"
              onClick={() => setFiltrosOpen(true)}
              title="Filtros avançados"
              aria-label="Filtros avançados"
            >
              <IoFilterOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarLista()}
              disabled={loading}
              title="Atualizar"
              aria-label="Atualizar"
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={abrirNova}
              title="Nova solicitação"
              aria-label="Nova solicitação"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        <div className="data-cards-region">
          <div className="contas-receber-tabs snfd-tabs" role="tablist" aria-label="Situação das solicitações">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'em_digitacao'}
              className={`contas-receber-tab${aba === 'em_digitacao' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => handleTrocarAba('em_digitacao')}
            >
              Em digitação
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'pendentes'}
              className={`contas-receber-tab${aba === 'pendentes' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => handleTrocarAba('pendentes')}
            >
              Pendentes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'emitidas'}
              className={`contas-receber-tab${aba === 'emitidas' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => handleTrocarAba('emitidas')}
            >
              Emitidas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'todas'}
              className={`contas-receber-tab${aba === 'todas' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => handleTrocarAba('todas')}
            >
              Todas
            </button>
          </div>

          {loading ? (
            <p className="module-empty">Carregando solicitações...</p>
          ) : sortedRows.length === 0 ? (
            <p className="module-empty">Nenhuma solicitação encontrada para os filtros selecionados.</p>
          ) : (
            <>
              <DataListSortBar
                options={[
                  { field: 'numero', label: 'Número' },
                  { field: 'data', label: 'Data' },
                  { field: 'destinatario', label: 'Destinatário' },
                  { field: 'tipo', label: 'Tipo' },
                  { field: 'valor', label: 'Valor' },
                  { field: 'situacao', label: 'Situação' },
                ]}
                active={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />

              <DataList ariaLabel="Solicitações de NF Diversa">
                {sortedRows.map((row) => {
                  const numFmt = `#${String(row.numSolicitacao).padStart(6, '0')}`;
                  const destPrefix = row.tipoDestinatario === 'F' ? 'Fornecedor' : 'Cliente';
                  const qtdLabel =
                    row.entradaSaida === 3 ? `${row.qtdServicos} serviço(s)` : `${row.qtdItens} item(ns)`;

                  return (
                    <DataListItem
                      key={row.numSolicitacao}
                      code={numFmt}
                      title={row.nomeDestinatario || 'Destinatário não informado'}
                      subtitle={row.motivoSolicitacao || 'Sem motivo informado'}
                      details={[
                        { label: 'Data', value: toBrDateFromIso(row.dataSolicitacao) },
                        { label: 'Tipo', value: row.entradaSaidaDescricao },
                        { label: destPrefix, value: row.codigoDestinatario ?? '-' },
                        row.codigoCfo ? { label: 'CFO', value: row.codigoCfo } : null,
                        { label: 'Qtd.', value: qtdLabel },
                        row.numNotaFiscal
                          ? {
                              label: 'NF',
                              value: `${row.numNotaFiscal}${row.serNotaFiscal ? `/${row.serNotaFiscal}` : ''}`,
                            }
                          : null,
                      ]}
                      status={<StatusBadge label={row.situacaoDescricao} />}
                      aside={formatCurrencyBr(row.valorTotal)}
                      onOpen={() => abrirRegistro(row)}
                      actions={
                        <>
                          {row.situacaoSolicitacao === 0 && row.podeEditar ? (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => abrirRegistro(row, false)}
                                title="Editar solicitação"
                                aria-label="Editar solicitação"
                              >
                                <IoCreateOutline size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  setConfirmacao({
                                    acao: 'confirmar',
                                    item: row,
                                    titulo: `Confirmar solicitação ${numFmt}`,
                                    mensagem: `Deseja confirmar a solicitação ${numFmt} e liberá-la para o faturamento?`,
                                  })
                                }
                                title="Confirmar solicitação"
                                aria-label="Confirmar solicitação"
                              >
                                <IoCheckmarkDoneOutline size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--danger"
                                onClick={() =>
                                  setConfirmacao({
                                    acao: 'excluir',
                                    item: row,
                                    titulo: 'Confirmar exclusão',
                                    mensagem: `Deseja realmente excluir a solicitação ${numFmt}?`,
                                  })
                                }
                                title="Excluir solicitação"
                                aria-label="Excluir solicitação"
                              >
                                <IoTrashOutline size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => abrirRegistro(row, true)}
                                title="Consultar solicitação"
                                aria-label="Consultar solicitação"
                              >
                                <IoEyeOutline size={16} />
                              </button>
                              {row.podeCancelar ? (
                                <button
                                  type="button"
                                  className="icon-button icon-button--danger"
                                  onClick={() =>
                                    setConfirmacao({
                                      acao: 'cancelar',
                                      item: row,
                                      titulo: 'Confirmar cancelamento',
                                      mensagem: `Deseja cancelar a solicitação ${numFmt}? Ela voltará para Em digitação.`,
                                    })
                                  }
                                  title="Cancelar solicitação"
                                  aria-label="Cancelar solicitação"
                                >
                                  <IoCloseCircleOutline size={16} />
                                </button>
                              ) : null}
                            </>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </DataList>
            </>
          )}
        </div>
      </section>

      {/* Filtros avançados */}
      <AdvancedFiltersPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        onApply={handleAplicarFiltros}
        title="Filtros avançados"
      >
        <div className="module-form">
          <div className="form-grid-2">
            <label>
              <span>Número da solicitação</span>
              <input
                type="text"
                inputMode="numeric"
                value={filtroNumSolic}
                onChange={(e) => setFiltroNumSolic(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 1234"
              />
            </label>

            <label>
              <span>Entrada / Saída</span>
              <SearchableSelect
                name="filtroEntradaSaida"
                ariaLabel="Entrada ou Saída"
                options={TIPO_FILTRO_OPTIONS}
                value={filtroEntradaSaida}
                onChange={setFiltroEntradaSaida}
                enableSearch={false}
              />
            </label>

            <label>
              <span>Data início</span>
              <CustomDatePicker
                value={filtroDataInicio}
                onChange={setFiltroDataInicio}
                placeholder="DD/MM/AAAA"
              />
            </label>

            <label>
              <span>Data fim</span>
              <CustomDatePicker
                value={filtroDataFim}
                onChange={setFiltroDataFim}
                placeholder="DD/MM/AAAA"
              />
            </label>

            <label className="form-grid-2__full">
              <span>Destinatário</span>
              <SearchableSelect
                name="filtroDestinatario"
                ariaLabel="Destinatário"
                options={destinatariosFiltroOptions}
                value={filtroDestinatarioChave}
                onChange={setFiltroDestinatarioChave}
                placeholder="Todos os destinatários"
                searchPlaceholder="Pesquisar..."
              />
            </label>
          </div>

          {temFiltrosAtivos ? (
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={handleLimparFiltros}>
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>
      </AdvancedFiltersPanel>

      {/* Modal de cadastro / edição / consulta */}
      <SolicitacaoNfDiversaFormModal
        open={modalOpen}
        numSolicitacaoInicial={modalNumSolic}
        somenteLeituraInicial={modalSomenteLeitura}
        combos={combos}
        onClose={() => setModalOpen(false)}
        onChanged={() => void carregarLista()}
      />

      {/* Popup de confirmação da listagem */}
      {confirmacao ? (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snfd-confirm-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processandoAcao) {
              setConfirmacao(null);
            }
          }}
        >
          <article className="modal-card">
            <header className="modal-card__header">
              <h2 id="snfd-confirm-title">{confirmacao.titulo}</h2>
              <ModalHeaderActions
                onClose={() => setConfirmacao(null)}
                disabled={processandoAcao}
                expandable={false}
              />
            </header>
            <p className="snfd-confirm-text">{confirmacao.mensagem}</p>
            {confirmacao.erros && confirmacao.erros.length > 1 ? (
              <ul className="snfd-confirm-inline__list">
                {confirmacao.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
            <footer className="modal-card__footer">
              <button
                type="button"
                className={
                  confirmacao.acao === 'excluir' || confirmacao.acao === 'cancelar'
                    ? 'primary-button primary-button--danger'
                    : 'primary-button'
                }
                onClick={() => void executarConfirmacaoLista()}
                disabled={processandoAcao}
              >
                {processandoAcao
                  ? 'Processando...'
                  : confirmacao.acao === 'excluir'
                    ? 'Sim, excluir'
                    : confirmacao.acao === 'cancelar'
                      ? 'Sim, cancelar'
                      : 'Confirmar'}
              </button>
              <button
                type="button"
                className="secondary-button modal-card__close"
                onClick={() => setConfirmacao(null)}
                disabled={processandoAcao}
              >
                Cancelar
              </button>
            </footer>
          </article>
        </section>
      ) : null}
    </main>
  );
}
