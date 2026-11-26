import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoBanOutline,
  IoCodeSlashOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoEllipsisHorizontalOutline,
  IoFilterOutline,
  IoMailOutline,
  IoPaperPlaneOutline,
  IoPrintOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { BetaHelpBadge } from '../../../components/BetaHelpBadge';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';
import { ListSearchField } from '../../../components/ListSearchField';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { StatusBadge } from '../../../components/StatusBadge';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess, verificarAcaoTransacao } from '../../../hooks/useTransactionAccess';
import {
  consultarNfeSefaz,
  enviarEmailNotaFiscal,
  formatCurrencyBr,
  getFirstDayMonthBr,
  getTodayBr,
  listarNotasGerenciador,
  obterCombosFaturamento,
  reenviarXmlNotaFiscal,
  toBrDateFromIso,
  toIsoDateFromBr,
  type AbaGerenciadorNfe,
  type FaturamentoCombosDto,
  type NotaFiscalGerenciadorItemDto,
} from '../../../services/faturamentoApi';
import {
  compareSortNumber,
  compareSortText,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';
import { FaturamentoEmissaoDiversaModal } from '../components/FaturamentoEmissaoDiversaModal';
import { FaturamentoEmissaoVendaModal } from '../components/FaturamentoEmissaoVendaModal';
import { FaturamentoFilaModal } from '../components/FaturamentoFilaModal';
import {
  FaturamentoCancelarNotaModal,
  FaturamentoCceModal,
  FaturamentoContingenciaModal,
  FaturamentoDanfeEscolhaModal,
  FaturamentoDetalheNotaModal,
  FaturamentoInutilizarModal,
  FaturamentoXmlModal,
} from '../components/FaturamentoGerenciadorModais';

type SortField = 'nota' | 'data' | 'tipo' | 'destinatario' | 'valor' | 'situacao';

const ENTRADA_SAIDA_OPTS = [
  { value: '', label: 'Todas (Entrada e Saída)' },
  { value: 'S', label: 'Saída (S)' },
  { value: 'E', label: 'Entrada (E)' },
];

const SITUACAO_OPTS = [
  { value: '', label: 'Todas as situações' },
  { value: '0', label: '0 - Pendente / Aguardando' },
  { value: '1', label: '1 - Autorizada / Emitida' },
  { value: '2', label: '2 - Denegada / Erro' },
  { value: '5', label: '5 - Pré-Emitida' },
  { value: '9', label: '9 - Cancelada' },
];

export function FaturamentoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const acoesTitleId = useId();
  const permissaoStatus = useTransactionAccess('DOC003', 'Faturamento');

  const [combos, setCombos] = useState<FaturamentoCombosDto | null>(null);
  const [rows, setRows] = useState<NotaFiscalGerenciadorItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  const [aba, setAba] = useState<AbaGerenciadorNfe>('emitidas');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nota');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filtros avançados (disparam busca na API)
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState(getFirstDayMonthBr);
  const [filtroDataFim, setFiltroDataFim] = useState(getTodayBr);
  const [filtroDestinatario, setFiltroDestinatario] = useState('');
  const [filtroNumNota, setFiltroNumNota] = useState('');
  const [filtroEntradaSaida, setFiltroEntradaSaida] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  const [aplicados, setAplicados] = useState(() => ({
    dataInicio: getFirstDayMonthBr(),
    dataFim: getTodayBr(),
    destinatario: '',
    numNota: '',
    entradaSaida: '',
    situacao: '',
  }));

  // Modais Gerenciador NF-e
  const [notaDanfe, setNotaDanfe] = useState<{ numNotaFiscal: string; serNotaFiscal: string; tipoDanfePadrao?: number } | null>(null);
  const [notaXml, setNotaXml] = useState<NotaFiscalGerenciadorItemDto | null>(null);
  const [notaDetalhe, setNotaDetalhe] = useState<{
    nota: NotaFiscalGerenciadorItemDto;
    aba: 'dados' | 'ocorrencias' | 'cce';
    somenteLeitura: boolean;
    permitirOcorrenciasCce: boolean;
  } | null>(null);
  const [notaCce, setNotaCce] = useState<NotaFiscalGerenciadorItemDto | null>(null);
  const [notaCancelar, setNotaCancelar] = useState<NotaFiscalGerenciadorItemDto | null>(null);
  const [notaMaisAcoes, setNotaMaisAcoes] = useState<NotaFiscalGerenciadorItemDto | null>(null);
  const [inutilizarOpen, setInutilizarOpen] = useState(false);
  const [contingenciaOpen, setContingenciaOpen] = useState(false);

  // Fila de Faturamento + Modais de Emissão
  const [filaOpen, setFilaOpen] = useState(false);
  const [validandoAcaoFaturamento, setValidandoAcaoFaturamento] = useState(false);
  const [filaRefreshTrigger, setFilaRefreshTrigger] = useState(0);
  const [vendaOsNum, setVendaOsNum] = useState<number | null>(null);
  const [diversaSolicNum, setDiversaSolicNum] = useState<number | null>(null);

  const carregarCombos = useCallback(async () => {
    try {
      const data = await obterCombosFaturamento();
      setCombos(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar parâmetros de faturamento.', 'error');
    }
  }, [showToast]);

  const carregarNotas = useCallback(async () => {
    setLoading(true);
    try {
      let tipoDest: string | undefined;
      let codDest: number | undefined;
      if (aplicados.destinatario) {
        const [t, c] = aplicados.destinatario.split(':');
        if (t && c) {
          tipoDest = t;
          codDest = Number(c);
        }
      }

      const data = await listarNotasGerenciador({
        aba,
        dataInicio: toIsoDateFromBr(aplicados.dataInicio),
        dataFim: toIsoDateFromBr(aplicados.dataFim),
        tipoDestinatario: tipoDest,
        codigoDestinatario: codDest,
        numNota: aplicados.numNota || undefined,
        entradaSaida: aplicados.entradaSaida || undefined,
        situacaoNota: aplicados.situacao !== '' ? Number(aplicados.situacao) : undefined,
      });
      setRows(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar notas fiscais.', 'error');
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
    void carregarNotas();
  }, [carregarNotas, permissaoStatus]);

  const aplicarFiltros = (e?: React.FormEvent) => {
    e?.preventDefault();
    const di = toIsoDateFromBr(filtroDataInicio);
    const df = toIsoDateFromBr(filtroDataFim);
    if (di && df && di > df) {
      showToast('A Data início não pode ser maior que a Data fim.', 'info');
      return;
    }
    setAplicados({
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim,
      destinatario: filtroDestinatario,
      numNota: filtroNumNota,
      entradaSaida: filtroEntradaSaida,
      situacao: filtroSituacao,
    });
    setFiltrosOpen(false);
  };

  const limparFiltros = () => {
    const ini = getFirstDayMonthBr();
    const fim = getTodayBr();
    setFiltroDataInicio(ini);
    setFiltroDataFim(fim);
    setFiltroDestinatario('');
    setFiltroNumNota('');
    setFiltroEntradaSaida('');
    setFiltroSituacao('');
    setAplicados({
      dataInicio: ini,
      dataFim: fim,
      destinatario: '',
      numNota: '',
      entradaSaida: '',
      situacao: '',
    });
    setFiltrosOpen(false);
  };

  const temFiltrosAtivos = Boolean(
    aplicados.destinatario || aplicados.numNota || aplicados.entradaSaida || aplicados.situacao,
  );

  const handleSort = (field: SortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const sortedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtradas = !q
      ? rows
      : rows.filter((r) => {
          const doc = `${r.numNotaFiscal}/${r.serNotaFiscal}`.toLowerCase();
          return (
            doc.includes(q) ||
            r.nomeDestinatario.toLowerCase().includes(q) ||
            (r.codigoCfo ?? '').toLowerCase().includes(q) ||
            (r.chaveAcessoNfe ?? '').toLowerCase().includes(q) ||
            r.ultimoRetorno.toLowerCase().includes(q)
          );
        });

    return sortByComparator(filtradas, sortDirection, (a, b) => {
      switch (sortField) {
        case 'nota':
          return compareSortNumber(Number(a.numNotaFiscal), Number(b.numNotaFiscal));
        case 'data':
          return compareSortNumber(parseSortTimestamp(a.dataEmissao), parseSortTimestamp(b.dataEmissao));
        case 'tipo':
          return compareSortText(a.tipoNotaDescricao, b.tipoNotaDescricao);
        case 'destinatario':
          return compareSortText(a.nomeDestinatario, b.nomeDestinatario);
        case 'valor':
          return compareSortNumber(a.valorTotalNota, b.valorTotalNota);
        case 'situacao':
          return compareSortText(a.situacaoDescricao, b.situacaoDescricao);
        default:
          return 0;
      }
    });
  }, [rows, search, sortField, sortDirection]);

  const executarConsultarSefaz = async (nota: NotaFiscalGerenciadorItemDto) => {
    setProcessandoAcao(true);
    try {
      const msg = await consultarNfeSefaz(nota.numNotaFiscal, nota.serNotaFiscal);
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar NF-e na SEFAZ.', 'error');
    } finally {
      setProcessandoAcao(false);
      setNotaMaisAcoes(null);
      void carregarNotas();
    }
  };

  const executarReenviarXml = async (nota: NotaFiscalGerenciadorItemDto) => {
    setProcessandoAcao(true);
    try {
      const msg = await reenviarXmlNotaFiscal(nota.numNotaFiscal, nota.serNotaFiscal);
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar/reenviar XML NF-e.', 'error');
    } finally {
      setProcessandoAcao(false);
      setNotaMaisAcoes(null);
      void carregarNotas();
    }
  };

  const executarEnviarEmail = async (nota: NotaFiscalGerenciadorItemDto) => {
    setProcessandoAcao(true);
    try {
      const msg = await enviarEmailNotaFiscal(nota.numNotaFiscal, nota.serNotaFiscal);
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao enviar e-mail da NF-e.', 'error');
    } finally {
      setProcessandoAcao(false);
      setNotaMaisAcoes(null);
    }
  };

  const handleNotaEmitida = (
    numNota: string,
    serNota: string,
    info?: { autorizada?: boolean; sefazOk?: boolean; destino?: number },
  ) => {
    setVendaOsNum(null);
    setDiversaSolicNum(null);
    setFilaRefreshTrigger((x) => x + 1);
    void carregarNotas();
    void carregarCombos();
    const podeImprimirDanfe = info?.autorizada === true || (info?.destino === 2 && info?.sefazOk !== false);
    if (podeImprimirDanfe) {
      setNotaDanfe({
        numNotaFiscal: numNota,
        serNotaFiscal: serNota,
        tipoDanfePadrao: 5,
      });
    }
  };

  const isNotaAutorizada = (row: NotaFiscalGerenciadorItemDto) =>
    row.situacaoNota !== 9 && (row.situacaoNota === 1 || Boolean(row.autorizacaoNfe?.trim()));

  const validarAcaoGerenciador = async (codigoAcao: number, mensagemNegada: string): Promise<boolean> => {
    if (validandoAcaoFaturamento) return false;
    setValidandoAcaoFaturamento(true);
    try {
      const { permitido, mensagem } = await verificarAcaoTransacao('DOC003', codigoAcao);
      if (!permitido) {
        showToast(mensagem || mensagemNegada, 'error');
        return false;
      }
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Erro ao validar permissão no Faturamento.', 'error');
      return false;
    } finally {
      setValidandoAcaoFaturamento(false);
    }
  };

  const abrirFilaFaturamento = async () => {
    if (await validarAcaoGerenciador(34, 'Você não possui permissão para realizar faturamento.')) {
      setFilaOpen(true);
    }
  };

  const abrirContingencia = async () => {
    if (await validarAcaoGerenciador(39, 'Você não possui permissão para alterar contingência.')) {
      setContingenciaOpen(true);
    }
  };

  const abrirInutilizar = async () => {
    if (await validarAcaoGerenciador(39, 'Você não possui permissão para inutilizar numeração.')) {
      setInutilizarOpen(true);
    }
  };

  const abrirMaisAcoes = async (row: NotaFiscalGerenciadorItemDto) => {
    if (await validarAcaoGerenciador(39, 'Você não possui permissão para executar ações adicionais na NF-e.')) {
      setNotaMaisAcoes(row);
    }
  };

  const abrirCancelarNota = async (row: NotaFiscalGerenciadorItemDto) => {
    const msg =
      row.situacaoNota === 9
        ? 'Você não possui permissão para excluir NF-e cancelada.'
        : 'Você não possui permissão para cancelar NF-e.';
    if (await validarAcaoGerenciador(39, msg)) {
      setNotaCancelar(row);
    }
  };

  const abrirDetalheNota = async (row: NotaFiscalGerenciadorItemDto) => {
    if (validandoAcaoFaturamento) return;
    setValidandoAcaoFaturamento(true);
    try {
      const { permitido, mensagem } = await verificarAcaoTransacao('DOC003', 39);
      if (permitido) {
        setNotaDetalhe({ nota: row, aba: 'dados', somenteLeitura: false, permitirOcorrenciasCce: true });
        return;
      }
      if (isNotaAutorizada(row)) {
        setNotaDetalhe({ nota: row, aba: 'dados', somenteLeitura: true, permitirOcorrenciasCce: false });
        return;
      }
      showToast(
        mensagem || 'Você não possui permissão para alterar ou consultar notas fiscais não autorizadas.',
        'error',
      );
    } catch (err: any) {
      showToast(err?.message || 'Erro ao validar permissão no Faturamento.', 'error');
    } finally {
      setValidandoAcaoFaturamento(false);
    }
  };

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page faturamento-page">
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
    <main className="clientes-page list-layout-page faturamento-page">
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
            <div className="page-title-beta-row">
              <h1>Faturamento</h1>
              <BetaHelpBadge />
            </div>
            <p>Gerenciador de NF-e de Entrada e Saída e fila de faturamento eletrônico.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Notas Fiscais</strong>
            <span>{`${sortedRows.length} encontradas`}</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Faturamento"
              placeholder="Pesquisar NF, destinatário, CFO ou chave"
              className="clientes-search"
            />

            <button
              type="button"
              className={`icon-button module-action-button${temFiltrosAtivos ? ' module-action-button--active' : ''}`}
              onClick={() => setFiltrosOpen(true)}
              title="Filtros avançados"
              aria-label="Filtros avançados"
            >
              <IoFilterOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              disabled={validandoAcaoFaturamento}
              onClick={() => void abrirContingencia()}
              title="Alterar contingência"
              aria-label="Alterar contingência"
            >
              <IoShieldCheckmarkOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              disabled={validandoAcaoFaturamento}
              onClick={() => void abrirInutilizar()}
              title="Inutilizar numeração"
              aria-label="Inutilizar numeração"
            >
              <IoBanOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              onClick={() => void carregarNotas()}
              disabled={loading}
              title="Atualizar"
              aria-label="Atualizar"
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={validandoAcaoFaturamento}
              onClick={() => void abrirFilaFaturamento()}
            >
              <IoDocumentTextOutline size={16} />
              Faturamento
            </button>
          </div>
        </div>

        <div className="data-cards-region">
          <div className="contas-receber-tabs fat-tabs" role="tablist" aria-label="Abas do Gerenciador NF-e">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'emitidas'}
              className={`contas-receber-tab${aba === 'emitidas' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('emitidas')}
            >
              Emitidas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'canc_divergentes'}
              className={`contas-receber-tab${aba === 'canc_divergentes' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('canc_divergentes')}
            >
              Cancelamentos Divergentes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'pre_emitidas'}
              className={`contas-receber-tab${aba === 'pre_emitidas' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('pre_emitidas')}
            >
              NF Pré-Emitidas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'todas'}
              className={`contas-receber-tab${aba === 'todas' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('todas')}
            >
              Todas
            </button>
          </div>

          {loading ? (
            <p className="module-empty">Carregando notas fiscais...</p>
          ) : sortedRows.length === 0 ? (
            <p className="module-empty">Nenhuma nota fiscal encontrada para os filtros selecionados.</p>
          ) : (
            <>
              <DataListSortBar
                options={[
                  { field: 'nota', label: 'Número' },
                  { field: 'data', label: 'Emissão' },
                  { field: 'destinatario', label: 'Destinatário' },
                  { field: 'tipo', label: 'Tipo' },
                  { field: 'valor', label: 'Valor' },
                  { field: 'situacao', label: 'Situação' },
                ]}
                active={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <DataList ariaLabel="Notas fiscais de Entrada e Saída">
                {sortedRows.map((row) => (
                  <DataListItem
                    key={`${row.numNotaFiscal}-${row.serNotaFiscal}`}
                    code={`${row.numNotaFiscal}/${row.serNotaFiscal}`}
                    title={row.nomeDestinatario || 'Destinatário não identificado'}
                    subtitle={`${row.entradaSaida === 'E' ? 'Entrada' : 'Saída'} • ${row.tipoNotaDescricao}${row.codigoCfo ? ` • CFO ${row.codigoCfo}` : ''}`}
                    details={[
                      { label: 'Emissão', value: toBrDateFromIso(row.dataEmissao) || '-' },
                      row.autorizacaoNfe ? { label: 'Protocolo', value: row.autorizacaoNfe } : null,
                      row.ultimoRetorno ? { label: 'SEFAZ', value: row.ultimoRetorno } : null,
                    ]}
                    status={<StatusBadge label={row.situacaoDescricao} />}
                    aside={formatCurrencyBr(row.valorTotalNota)}
                    onOpen={() => void abrirDetalheNota(row)}
                    actions={
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          title="Imprimir DANFE"
                          aria-label="Imprimir DANFE"
                          onClick={() =>
                            setNotaDanfe({
                              numNotaFiscal: row.numNotaFiscal,
                              serNotaFiscal: row.serNotaFiscal,
                              tipoDanfePadrao: combos?.tipoDanfePadrao ?? 5,
                            })
                          }
                        >
                          <IoPrintOutline size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Visualizar XML"
                          aria-label="Visualizar XML"
                          onClick={() => setNotaXml(row)}
                        >
                          <IoCodeSlashOutline size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Mais ações"
                          aria-label="Mais ações"
                          disabled={validandoAcaoFaturamento}
                          onClick={() => void abrirMaisAcoes(row)}
                        >
                          <IoEllipsisHorizontalOutline size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          title={row.situacaoNota === 9 ? 'Excluir NF-e cancelada' : 'Cancelar NF-e'}
                          aria-label={row.situacaoNota === 9 ? 'Excluir NF-e cancelada' : 'Cancelar NF-e'}
                          disabled={validandoAcaoFaturamento}
                          onClick={() => void abrirCancelarNota(row)}
                        >
                          <IoTrashOutline size={16} />
                        </button>
                      </>
                    }
                  />
                ))}
              </DataList>
            </>
          )}
        </div>
      </section>

      {/* Painel de Filtros Avançados */}
      <AdvancedFiltersPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        onApply={() => aplicarFiltros()}
      >
        <div className="module-form">
          <div className="form-grid-2">
            <label>
              <span>Data início</span>
              <CustomDatePicker value={filtroDataInicio} onChange={setFiltroDataInicio} />
            </label>
            <label>
              <span>Data fim</span>
              <CustomDatePicker value={filtroDataFim} onChange={setFiltroDataFim} />
            </label>
            <label className="form-grid-2__full">
              <span>Destinatário</span>
              <SearchableSelect
                value={filtroDestinatario}
                onChange={setFiltroDestinatario}
                options={[{ value: '', label: 'Todos os destinatários' }, ...(combos?.destinatarios ?? [])]}
                searchPlaceholder="Pesquisar..."
              />
            </label>
            <label>
              <span>Número da NF</span>
              <input
                type="text"
                value={filtroNumNota}
                onChange={(e) => setFiltroNumNota(e.target.value)}
                placeholder="Ex: 012345"
              />
            </label>
            <label>
              <span>Entrada / Saída</span>
              <SearchableSelect
                value={filtroEntradaSaida}
                onChange={setFiltroEntradaSaida}
                options={ENTRADA_SAIDA_OPTS}
                searchPlaceholder="Pesquisar..."
              />
            </label>
            <label className="form-grid-2__full">
              <span>Situação</span>
              <SearchableSelect
                value={filtroSituacao}
                onChange={setFiltroSituacao}
                options={SITUACAO_OPTS}
                searchPlaceholder="Pesquisar..."
              />
            </label>
          </div>
          {temFiltrosAtivos && (
            <button type="button" className="secondary-button" onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>
      </AdvancedFiltersPanel>

      {/* Modal Ações Extras da Nota (SEFAZ / XML / CC-e / E-mail / Histórico / Alterar) */}
      {notaMaisAcoes && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={acoesTitleId}>
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2 id={acoesTitleId}>{`Ações - NF ${notaMaisAcoes.numNotaFiscal}/${notaMaisAcoes.serNotaFiscal}`}</h2>
              <ModalHeaderActions onClose={() => setNotaMaisAcoes(null)} expandable={false} disabled={processandoAcao} />
            </header>
            <div className="module-form fat-modal-body">
              <p className="fat-hint-text" data-no-translate="">{notaMaisAcoes.nomeDestinatario}</p>
              <div className="fat-actions-grid">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => void executarConsultarSefaz(notaMaisAcoes)}
                >
                  <IoSearchOutline size={16} />
                  Consultar SEFAZ
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => void executarReenviarXml(notaMaisAcoes)}
                >
                  <IoPaperPlaneOutline size={16} />
                  Gerar / Reenviar XML
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => {
                    const target = notaMaisAcoes;
                    setNotaMaisAcoes(null);
                    setNotaCce(target);
                  }}
                >
                  <IoDocumentTextOutline size={16} />
                  Carta de Correção (CC-e)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => {
                    const target = notaMaisAcoes;
                    setNotaMaisAcoes(null);
                    setNotaDetalhe({
                      nota: target,
                      aba: 'ocorrencias',
                      somenteLeitura: false,
                      permitirOcorrenciasCce: true,
                    });
                  }}
                >
                  <IoTimeOutline size={16} />
                  Histórico de Ocorrências
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => void executarEnviarEmail(notaMaisAcoes)}
                >
                  <IoMailOutline size={16} />
                  Enviar E-mail NF-e
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processandoAcao}
                  onClick={() => {
                    const target = notaMaisAcoes;
                    setNotaMaisAcoes(null);
                    setNotaDetalhe({
                      nota: target,
                      aba: 'dados',
                      somenteLeitura: false,
                      permitirOcorrenciasCce: true,
                    });
                  }}
                >
                  <IoCreateOutline size={16} />
                  Alterar / Ver Dados
                </button>
              </div>
            </div>
            <footer className="modal-card__footer">
              <button type="button" className="secondary-button modal-card__close" onClick={() => setNotaMaisAcoes(null)} disabled={processandoAcao}>
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modais do Gerenciador NF-e */}
      <FaturamentoXmlModal
        open={notaXml !== null}
        nota={notaXml}
        onClose={() => setNotaXml(null)}
      />

      <FaturamentoDetalheNotaModal
        open={notaDetalhe !== null}
        nota={notaDetalhe?.nota ?? null}
        combos={combos}
        abaInicial={notaDetalhe?.aba}
        somenteLeitura={notaDetalhe?.somenteLeitura}
        permitirOcorrenciasCce={notaDetalhe?.permitirOcorrenciasCce ?? true}
        onClose={() => setNotaDetalhe(null)}
        onSaved={() => void carregarNotas()}
      />

      <FaturamentoCceModal
        open={notaCce !== null}
        nota={notaCce}
        onClose={() => setNotaCce(null)}
        onSuccess={() => void carregarNotas()}
      />

      <FaturamentoCancelarNotaModal
        open={notaCancelar !== null}
        nota={notaCancelar}
        combos={combos}
        onClose={() => setNotaCancelar(null)}
        onSuccess={() => void carregarNotas()}
      />

      <FaturamentoInutilizarModal
        open={inutilizarOpen}
        combos={combos}
        onClose={() => setInutilizarOpen(false)}
        onSuccess={() => void carregarNotas()}
      />

      <FaturamentoContingenciaModal
        open={contingenciaOpen}
        combos={combos}
        onClose={() => setContingenciaOpen(false)}
        onSuccess={() => {
          void carregarCombos();
          void carregarNotas();
        }}
      />

      {/* Fila de Faturamento & Emissões (Venda OS + Entrada/Saída/Serviço Diversos) */}
      <FaturamentoFilaModal
        open={filaOpen}
        onClose={() => setFilaOpen(false)}
        onAbrirVendaOs={(numSep) => setVendaOsNum(numSep)}
        onAbrirDiversa={(numSol) => setDiversaSolicNum(numSol)}
        refreshTrigger={filaRefreshTrigger}
      />

      <FaturamentoEmissaoVendaModal
        open={vendaOsNum !== null}
        numSeparacao={vendaOsNum}
        combos={combos}
        onClose={() => setVendaOsNum(null)}
        onEmitida={(numNf, serNf, _msg, info) => handleNotaEmitida(numNf, serNf, info)}
      />

      <FaturamentoEmissaoDiversaModal
        open={diversaSolicNum !== null}
        numSolicitacao={diversaSolicNum}
        combos={combos}
        onClose={() => setDiversaSolicNum(null)}
        onEmitida={(numNf, serNf, _msg, info) => handleNotaEmitida(numNf, serNf, info)}
      />

      <FaturamentoDanfeEscolhaModal
        open={notaDanfe !== null}
        nota={notaDanfe}
        onClose={() => setNotaDanfe(null)}
      />
    </main>
  );
}
