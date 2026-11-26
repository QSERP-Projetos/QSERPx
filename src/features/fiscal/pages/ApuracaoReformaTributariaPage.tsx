import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoCloudDownloadOutline,
  IoDocumentTextOutline,
  IoFilterOutline,
  IoKeyOutline,
  IoRefreshOutline,
  IoSyncOutline,
} from 'react-icons/io5';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { BetaHelpBadge } from '../../../components/BetaHelpBadge';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { StatusBadge, type StatusTone } from '../../../components/StatusBadge';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess } from '../../../hooks/useTransactionAccess';
import {
  ApuracaoCredenciaisModal,
} from '../components/ApuracaoCredenciaisModal';
import {
  ApuracaoDetalheModal,
  type DetalheModalState,
} from '../components/ApuracaoDetalheModal';
import {
  ApuracaoNovaSolicitacaoModal,
} from '../components/ApuracaoNovaSolicitacaoModal';
import {
  baixarSolicitacao,
  consultarSituacaoSolicitacao,
  executarProcessamentoPendentes,
  formatDateTimeBr,
  getFirstDayYearBr,
  listarCreditosApuracao,
  listarDebitosApuracao,
  listarPagamentosApuracao,
  listarRecolhimentosApuracao,
  listarSolicitacoesApuracao,
  obterCredenciaisApuracao,
  obterResumoApuracao,
  type ApuracaoCreditoItemDto,
  type ApuracaoDebitoItemDto,
  type ApuracaoPagamentoItemDto,
  type ApuracaoRecolhimentoItemDto,
  type CredenciaisApuracaoDto,
  type ResumoApuracaoCbsDto,
  type SolicitacaoApuracaoDto,
} from '../../../services/apuracaoReformaApi';
import {
  formatCurrencyBr,
  formatDecimal,
  getTodayBr,
  toBrDateFromIso,
  toIsoDateFromBr,
} from '../../../services/faturamentoApi';
import {
  compareSortNumber,
  compareSortText,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';

type AbaApuracao = 'solicitacoes' | 'debitos' | 'creditos' | 'pagamentos' | 'recolhimentos';
type SortField = 'data' | 'codigo' | 'descricao' | 'valor' | 'situacao';

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Pendente', tone: 'warning' },
  EM_PROCESSAMENTO: { label: 'Em processamento', tone: 'info' },
  CONCLUIDA: { label: 'Concluída', tone: 'accent' },
  BAIXADA: { label: 'Baixada', tone: 'success' },
  ERRO: { label: 'Erro', tone: 'danger' },
  EXPIRADA: { label: 'Expirada', tone: 'danger' },
};

const TIPO_LABELS: Record<string, string> = {
  DEBITOS: 'Débitos CBS',
  CREDITOS: 'Créditos CBS',
  PAGAMENTOS: 'Pagamentos (PCONT/RAD)',
  RECOLHIMENTOS: 'Recolhimentos (RAD)',
};

const SITUACAO_OPTIONS = [
  { value: '', label: 'Todas as situações' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_PROCESSAMENTO', label: 'Em processamento' },
  { value: 'CONCLUIDA', label: 'Concluída (aguardando download)' },
  { value: 'BAIXADA', label: 'Baixada e consolidada' },
  { value: 'ERRO', label: 'Erro' },
  { value: 'EXPIRADA', label: 'Expirada' },
];

const TIPO_APURACAO_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'DEBITOS', label: 'Débitos CBS' },
  { value: 'CREDITOS', label: 'Créditos CBS' },
  { value: 'PAGAMENTOS', label: 'Pagamentos CBS' },
  { value: 'RECOLHIMENTOS', label: 'Recolhimentos (RAD)' },
];

const MODALIDADE_PAG_OPTIONS = [
  { value: '', label: 'Todas as modalidades' },
  { value: 'PCONT', label: 'PCONT (Pagamento próprio)' },
  { value: 'RAD', label: 'RAD (Adquirente)' },
];

const AMBIENTE_NOMES: Record<number, string> = {
  '-1': 'Homologação (SERPRO)',
  0: 'Produção (RFB)',
  1: 'Produção Restrita (RFB)',
};

export function ApuracaoReformaTributariaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const permissaoStatus = useTransactionAccess('DOC002', 'Apuração Reforma Tributária');

  const [aba, setAba] = useState<AbaApuracao>('solicitacoes');
  const [search, setSearch] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Filtros aplicados (padrão: 01/01 do ano corrente até hoje)
  const [dataInicio, setDataInicio] = useState(getFirstDayYearBr);
  const [dataFim, setDataFim] = useState(getTodayBr);
  const [filtroCst, setFiltroCst] = useState('');
  const [filtroTipoOper, setFiltroTipoOper] = useState('');
  const [filtroTipoPag, setFiltroTipoPag] = useState('');
  const [filtroTipoSolicitacao, setFiltroTipoSolicitacao] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  // Rascunho do painel de filtros
  const [draftInicio, setDraftInicio] = useState(dataInicio);
  const [draftFim, setDraftFim] = useState(dataFim);
  const [draftCst, setDraftCst] = useState('');
  const [draftTipoOper, setDraftTipoOper] = useState('');
  const [draftTipoPag, setDraftTipoPag] = useState('');
  const [draftTipoSolicitacao, setDraftTipoSolicitacao] = useState('');
  const [draftSituacao, setDraftSituacao] = useState('');

  const [sortField, setSortField] = useState<SortField>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [loading, setLoading] = useState(false);
  const [processandoWorker, setProcessandoWorker] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  const [credenciais, setCredenciais] = useState<CredenciaisApuracaoDto | null>(null);
  const [resumo, setResumo] = useState<ResumoApuracaoCbsDto | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoApuracaoDto[]>([]);
  const [debitos, setDebitos] = useState<ApuracaoDebitoItemDto[]>([]);
  const [creditos, setCreditos] = useState<ApuracaoCreditoItemDto[]>([]);
  const [pagamentos, setPagamentos] = useState<ApuracaoPagamentoItemDto[]>([]);
  const [recolhimentos, setRecolhimentos] = useState<ApuracaoRecolhimentoItemDto[]>([]);

  const [credenciaisModalOpen, setCredenciaisModalOpen] = useState(false);
  const [novaSolicitacaoOpen, setNovaSolicitacaoOpen] = useState(false);
  const [detalheModal, setDetalheModal] = useState<DetalheModalState>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const filtroApi = {
        dataInicio: toIsoDateFromBr(dataInicio),
        dataFim: toIsoDateFromBr(dataFim),
        cst: filtroCst.trim() || undefined,
        tipoOperacao: filtroTipoOper.trim() || undefined,
        tipoPagamento: filtroTipoPag.trim() || undefined,
      };

      const [cred, res, sols, debs, creds, pags, recs] = await Promise.all([
        obterCredenciaisApuracao(),
        obterResumoApuracao({ dataInicio: filtroApi.dataInicio, dataFim: filtroApi.dataFim }),
        listarSolicitacoesApuracao(filtroTipoSolicitacao || undefined, filtroSituacao || undefined),
        listarDebitosApuracao(filtroApi),
        listarCreditosApuracao(filtroApi),
        listarPagamentosApuracao(filtroApi),
        listarRecolhimentosApuracao(filtroApi),
      ]);

      setCredenciais(cred);
      setResumo(res);
      setSolicitacoes(sols);
      setDebitos(debs);
      setCreditos(creds);
      setPagamentos(pags);
      setRecolhimentos(recs);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar dados da Apuração CBS.', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    dataInicio,
    dataFim,
    filtroCst,
    filtroTipoOper,
    filtroTipoPag,
    filtroTipoSolicitacao,
    filtroSituacao,
    showToast,
  ]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarDados();
  }, [carregarDados, permissaoStatus]);

  const abrirFiltros = () => {
    setDraftInicio(dataInicio);
    setDraftFim(dataFim);
    setDraftCst(filtroCst);
    setDraftTipoOper(filtroTipoOper);
    setDraftTipoPag(filtroTipoPag);
    setDraftTipoSolicitacao(filtroTipoSolicitacao);
    setDraftSituacao(filtroSituacao);
    setFiltrosOpen(true);
  };

  const aplicarFiltros = () => {
    setDataInicio(draftInicio || getFirstDayYearBr());
    setDataFim(draftFim || getTodayBr());
    setFiltroCst(draftCst);
    setFiltroTipoOper(draftTipoOper);
    setFiltroTipoPag(draftTipoPag);
    setFiltroTipoSolicitacao(draftTipoSolicitacao);
    setFiltroSituacao(draftSituacao);
    setFiltrosOpen(false);
  };

  const limparFiltros = () => {
    const ini = getFirstDayYearBr();
    const fim = getTodayBr();
    setDraftInicio(ini);
    setDraftFim(fim);
    setDraftCst('');
    setDraftTipoOper('');
    setDraftTipoPag('');
    setDraftTipoSolicitacao('');
    setDraftSituacao('');
    setDataInicio(ini);
    setDataFim(fim);
    setFiltroCst('');
    setFiltroTipoOper('');
    setFiltroTipoPag('');
    setFiltroTipoSolicitacao('');
    setFiltroSituacao('');
    setFiltrosOpen(false);
  };

  const temFiltrosAtivos = Boolean(
    filtroCst ||
      filtroTipoOper ||
      filtroTipoPag ||
      filtroTipoSolicitacao ||
      filtroSituacao ||
      dataInicio !== getFirstDayYearBr() ||
      dataFim !== getTodayBr(),
  );

  const handleSort = (field: SortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const handleVerificarPendentes = async () => {
    setProcessandoWorker(true);
    try {
      const qtd = await executarProcessamentoPendentes();
      showToast(
        qtd > 0
          ? `${qtd} solicitação(ões) pendente(s) verificada(s) na Receita Federal.`
          : 'Nenhuma solicitação pendente aguardando verificação no momento.',
        'info',
      );
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao verificar solicitações pendentes.', 'error');
    } finally {
      setProcessandoWorker(false);
    }
  };

  const handleConsultarRow = async (item: SolicitacaoApuracaoDto) => {
    setRowBusyId(item.id);
    try {
      const resp = await consultarSituacaoSolicitacao(item.id, true);
      showToast(resp.message, 'success');
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar situação na RFB.', 'error');
    } finally {
      setRowBusyId(null);
    }
  };

  const handleBaixarRow = async (item: SolicitacaoApuracaoDto) => {
    setRowBusyId(item.id);
    try {
      const resp = await baixarSolicitacao(item.id);
      showToast(resp.message, 'success');
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao baixar arquivo da RFB.', 'error');
    } finally {
      setRowBusyId(null);
    }
  };

  const termNorm = search.trim().toLowerCase();

  const solicitacoesFiltradas = useMemo(() => {
    const base = !termNorm
      ? solicitacoes
      : solicitacoes.filter((s) =>
          [s.id, s.tipoApuracao, s.tiqueteSolicitacao, s.situacao, s.usuarioSolicitante, s.mensagemErro]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(termNorm)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'codigo':
          return compareSortNumber(a.id, b.id);
        case 'descricao':
          return compareSortText(a.tipoApuracao, b.tipoApuracao);
        case 'valor':
          return compareSortNumber(a.qtdRegistros, b.qtdRegistros);
        case 'situacao':
          return compareSortText(a.situacao, b.situacao);
        default:
          return compareSortNumber(
            parseSortTimestamp(a.dataSolicitacao),
            parseSortTimestamp(b.dataSolicitacao),
          );
      }
    });
  }, [solicitacoes, termNorm, sortDirection, sortField]);

  const debitosFiltrados = useMemo(() => {
    const base = !termNorm
      ? debitos
      : debitos.filter((d) =>
          [d.chEletr, d.cst, d.tpOper, d.tpDocumento, d.niContribuinte]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(termNorm)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'codigo':
          return compareSortText(a.cst, b.cst);
        case 'descricao':
          return compareSortText(a.chEletr, b.chEletr);
        case 'valor':
          return compareSortNumber(a.valorCbsExigivel, b.valorCbsExigivel);
        case 'situacao':
          return compareSortText(a.tpOper, b.tpOper);
        default:
          return compareSortNumber(
            parseSortTimestamp(a.dataEmissao || a.dataAtualizacao),
            parseSortTimestamp(b.dataEmissao || b.dataAtualizacao),
          );
      }
    });
  }, [debitos, termNorm, sortDirection, sortField]);

  const creditosFiltrados = useMemo(() => {
    const base = !termNorm
      ? creditos
      : creditos.filter((c) =>
          [c.chEletr, c.cst, c.tpOper, c.tpDocumento, c.niContribuinte]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(termNorm)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'codigo':
          return compareSortText(a.cst, b.cst);
        case 'descricao':
          return compareSortText(a.chEletr, b.chEletr);
        case 'valor':
          return compareSortNumber(a.valorCbsApropriada, b.valorCbsApropriada);
        case 'situacao':
          return compareSortText(a.tpOper, b.tpOper);
        default:
          return compareSortNumber(
            parseSortTimestamp(a.dataEmissao || a.dataAtualizacao),
            parseSortTimestamp(b.dataEmissao || b.dataAtualizacao),
          );
      }
    });
  }, [creditos, termNorm, sortDirection, sortField]);

  const pagamentosFiltrados = useMemo(() => {
    const base = !termNorm
      ? pagamentos
      : pagamentos.filter((p) =>
          [p.numeroPagamento, p.tipoPagamento, p.chEletr, p.niAdquirente, p.niFornecedor]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(termNorm)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'codigo':
          return compareSortText(a.numeroPagamento, b.numeroPagamento);
        case 'descricao':
          return compareSortText(a.chEletr || a.niFornecedor, b.chEletr || b.niFornecedor);
        case 'valor':
          return compareSortNumber(a.valorTotal, b.valorTotal);
        case 'situacao':
          return compareSortText(a.tipoPagamento, b.tipoPagamento);
        default:
          return compareSortNumber(
            parseSortTimestamp(a.dataArrecadacao || a.dataAtualizacao),
            parseSortTimestamp(b.dataArrecadacao || b.dataAtualizacao),
          );
      }
    });
  }, [pagamentos, termNorm, sortDirection, sortField]);

  const recolhimentosFiltrados = useMemo(() => {
    const base = !termNorm
      ? recolhimentos
      : recolhimentos.filter((r) =>
          [r.numeroPagamento, r.chEletr, r.niFornecedor]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(termNorm)),
        );

    return sortByComparator(base, sortDirection, (a, b) => {
      switch (sortField) {
        case 'codigo':
          return compareSortText(a.numeroPagamento, b.numeroPagamento);
        case 'descricao':
          return compareSortText(a.chEletr || a.niFornecedor, b.chEletr || b.niFornecedor);
        case 'valor':
          return compareSortNumber(a.valorTotal, b.valorTotal);
        case 'situacao':
          return compareSortText(a.niFornecedor, b.niFornecedor);
        default:
          return compareSortNumber(
            parseSortTimestamp(a.dataArrecadacao || a.dataAtualizacao),
            parseSortTimestamp(b.dataArrecadacao || b.dataAtualizacao),
          );
      }
    });
  }, [recolhimentos, termNorm, sortDirection, sortField]);

  const totalAtivo =
    aba === 'solicitacoes'
      ? solicitacoesFiltradas.length
      : aba === 'debitos'
        ? debitosFiltrados.length
        : aba === 'creditos'
          ? creditosFiltrados.length
          : aba === 'pagamentos'
            ? pagamentosFiltrados.length
            : recolhimentosFiltrados.length;

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page apuracao-reforma-page">
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
    <main className="clientes-page list-layout-page apuracao-reforma-page">
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
              <h1>Apuração Reforma Tributária</h1>
              <BetaHelpBadge
                description="Esta rotina não existe no sistema Q4 e ainda está em processo de desenvolvimento e testes tanto pela SEFAZ quanto pelo sistema, podendo apresentar erros ou inconsistências."
              />
            </div>
            <p>
              {`Solicitações assíncronas sem webhook (RFB v2) e histórico consolidado da CBS (${dataInicio} a ${dataFim}).`}
            </p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>{TIPO_LABELS[aba.toUpperCase()] || 'Solicitações RFB'}</strong>
            <span>{`${totalAtivo} registros`}</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Apuração CBS"
              placeholder="Pesquisar chave NF-e, tíquete, CST ou pagamento"
              className="clientes-search"
            />

            <button
              type="button"
              className={`icon-button module-action-button${!credenciais?.configurado ? ' module-action-button--active' : ''}`}
              onClick={() => setCredenciaisModalOpen(true)}
              title="Configurar credenciais Receita Federal"
              aria-label="Configurar credenciais Receita Federal"
            >
              <IoKeyOutline size={16} />
            </button>

            <button
              type="button"
              className={`icon-button module-action-button${temFiltrosAtivos ? ' module-action-button--active' : ''}`}
              onClick={abrirFiltros}
              title="Filtros avançados"
              aria-label="Filtros avançados"
            >
              <IoFilterOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              onClick={() => void handleVerificarPendentes()}
              disabled={processandoWorker || loading}
              title="Verificar solicitações pendentes na RFB"
              aria-label="Verificar solicitações pendentes na RFB"
            >
              <IoSyncOutline size={16} />
            </button>

            <button
              type="button"
              className="icon-button module-action-button"
              onClick={() => void carregarDados()}
              disabled={loading}
              title="Atualizar dados"
              aria-label="Atualizar dados"
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => setNovaSolicitacaoOpen(true)}
            >
              <IoCloudDownloadOutline size={16} />
              Nova Solicitação
            </button>
          </div>
        </div>

        {/* Cards de resumo consolidado do período */}
        <div className="apuracao-summary-grid">
          <div className="apuracao-summary-card">
            <small>{`Débitos CBS Exigível (${resumo?.qtdDebitos ?? 0})`}</small>
            <strong>{formatCurrencyBr(resumo?.totalDebitosExigivel)}</strong>
            <span>{`Apurado: ${formatCurrencyBr(resumo?.totalDebitosApurado)}`}</span>
          </div>
          <div className="apuracao-summary-card">
            <small>{`Créditos CBS Apropriados (${resumo?.qtdCreditos ?? 0})`}</small>
            <strong>{formatCurrencyBr(resumo?.totalCreditosApropriada)}</strong>
            <span>{`Não utilizado: ${formatCurrencyBr(resumo?.totalCreditosNaoUtilizada)}`}</span>
          </div>
          <div className="apuracao-summary-card">
            <small>{`Pagamentos PCONT/RAD (${resumo?.qtdPagamentos ?? 0})`}</small>
            <strong>{formatCurrencyBr(resumo?.totalPagamentos)}</strong>
            <span>{`Saldo remanescente: ${formatCurrencyBr(resumo?.totalPagamentosSaldo)}`}</span>
          </div>
          <div className="apuracao-summary-card">
            <small>{`Recolhimentos RAD (${resumo?.qtdRecolhimentos ?? 0})`}</small>
            <strong>{formatCurrencyBr(resumo?.totalRecolhimentos)}</strong>
            <span>
              {`Crédito: ${formatCurrencyBr(resumo?.totalRecolhimentosCredito)}`}
              {resumo?.solicitacoesPendentes ? ` • ${resumo.solicitacoesPendentes} pendente(s)` : ''}
            </span>
          </div>
        </div>

        <div className="data-cards-region">
          <div className="contas-receber-tabs fat-tabs" role="tablist" aria-label="Visões da Apuração CBS">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'solicitacoes'}
              className={`contas-receber-tab${aba === 'solicitacoes' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('solicitacoes')}
            >
              {`Solicitações e Tíquetes (${solicitacoes.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'debitos'}
              className={`contas-receber-tab${aba === 'debitos' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('debitos')}
            >
              {`Débitos (${debitos.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'creditos'}
              className={`contas-receber-tab${aba === 'creditos' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('creditos')}
            >
              {`Créditos (${creditos.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'pagamentos'}
              className={`contas-receber-tab${aba === 'pagamentos' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('pagamentos')}
            >
              {`Pagamentos (${pagamentos.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'recolhimentos'}
              className={`contas-receber-tab${aba === 'recolhimentos' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => setAba('recolhimentos')}
            >
              {`Recolhimentos RAD (${recolhimentos.length})`}
            </button>
          </div>

          {loading ? (
            <p className="module-empty">Carregando dados da apuração...</p>
          ) : totalAtivo === 0 ? (
            <p className="module-empty">
              {aba === 'solicitacoes'
                ? 'Nenhuma solicitação enviada ainda. Clique em "Nova Solicitação" para abrir um tíquete na Receita Federal.'
                : 'Nenhum registro encontrado no histórico local para o período selecionado.'}
            </p>
          ) : (
            <>
              <DataListSortBar
                options={[
                  { field: 'data', label: 'Data' },
                  { field: 'codigo', label: aba === 'solicitacoes' ? 'ID' : 'Código / CST' },
                  { field: 'descricao', label: aba === 'solicitacoes' ? 'API' : 'Chave / Documento' },
                  { field: 'valor', label: aba === 'solicitacoes' ? 'Registros' : 'Valor' },
                  { field: 'situacao', label: aba === 'solicitacoes' ? 'Situação' : 'Operação' },
                ]}
                active={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />

              {aba === 'solicitacoes' ? (
                <DataList ariaLabel="Solicitações e tíquetes RFB">
                  {solicitacoesFiltradas.map((sol) => {
                    const meta = STATUS_META[sol.situacao] ?? { label: sol.situacao, tone: 'neutral' as StatusTone };
                    const busy = rowBusyId === sol.id;

                    return (
                      <DataListItem
                        key={sol.id}
                        code={`#${sol.id}`}
                        title={`${TIPO_LABELS[sol.tipoApuracao] || sol.tipoApuracao} • Tíquete ${sol.tiqueteSolicitacao || '-'}`}
                        subtitle={`${AMBIENTE_NOMES[sol.ambiente] || 'RFB'} • Solicitante: ${sol.usuarioSolicitante || '-'}${sol.mensagemErro ? ` • ${sol.mensagemErro}` : ''}`}
                        details={[
                          { label: 'Solicitado', value: formatDateTimeBr(sol.dataSolicitacao) },
                          sol.dataUltimaConsulta
                            ? { label: 'Última consulta', value: formatDateTimeBr(sol.dataUltimaConsulta) }
                            : null,
                          sol.periodoIni || sol.periodoFim
                            ? {
                                label: 'Período JSON',
                                value: `${toBrDateFromIso(sol.periodoIni)} a ${toBrDateFromIso(sol.periodoFim)}`,
                              }
                            : null,
                          sol.expirandoEmBreve
                            ? { label: 'Atenção', value: 'Expira em breve na RFB (48h)' }
                            : null,
                        ]}
                        status={<StatusBadge tone={meta.tone} label={meta.label} />}
                        aside={
                          sol.downloadRealizado
                            ? `${sol.qtdRegistros} reg.`
                            : sol.teaSegundos
                              ? `TEA ${sol.teaSegundos}s`
                              : undefined
                        }
                        onOpen={() => setDetalheModal({ tipo: 'SOLICITACAO', item: sol })}
                        actions={
                          <>
                            {!sol.downloadRealizado && sol.situacao !== 'ERRO' && sol.situacao !== 'EXPIRADA' ? (
                              <button
                                type="button"
                                className="icon-button"
                                disabled={busy}
                                title="Consultar situação na RFB"
                                aria-label="Consultar situação na RFB"
                                onClick={() => void handleConsultarRow(sol)}
                              >
                                <IoSyncOutline size={16} />
                              </button>
                            ) : null}
                            {sol.situacao === 'CONCLUIDA' && !sol.downloadRealizado ? (
                              <button
                                type="button"
                                className="icon-button"
                                disabled={busy}
                                title="Baixar e consolidar arquivo"
                                aria-label="Baixar e consolidar arquivo"
                                onClick={() => void handleBaixarRow(sol)}
                              >
                                <IoCloudDownloadOutline size={16} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="icon-button"
                              title="Ver detalhes e JSON"
                              aria-label="Ver detalhes e JSON"
                              onClick={() => setDetalheModal({ tipo: 'SOLICITACAO', item: sol })}
                            >
                              <IoDocumentTextOutline size={16} />
                            </button>
                          </>
                        }
                      />
                    );
                  })}
                </DataList>
              ) : null}

              {aba === 'debitos' ? (
                <DataList ariaLabel="Débitos de CBS consolidados">
                  {debitosFiltrados.map((deb) => (
                    <DataListItem
                      key={deb.id}
                      code={deb.cst ? `CST ${deb.cst}` : `#${deb.id}`}
                      title={deb.chEletr || 'Documento sem chave eletrônica'}
                      subtitle={`${deb.tpOper || 'Operação não informada'}${deb.tpDocumento ? ` • ${deb.tpDocumento}` : ''}`}
                      details={[
                        { label: 'Emissão', value: toBrDateFromIso(deb.dataEmissao) || '-' },
                        { label: 'vBC', value: formatCurrencyBr(deb.valorBc) },
                        { label: 'pCBS', value: `${formatDecimal(deb.aliqCbs, 2)}%` },
                        { label: 'Apurado', value: formatCurrencyBr(deb.valorCbsApurado) },
                      ]}
                      status={<StatusBadge label={deb.valorCbsExigivel > 0 ? 'Exigível' : 'Quitado'} />}
                      aside={formatCurrencyBr(deb.valorCbsExigivel || deb.valorCbsDevido)}
                      onOpen={() => setDetalheModal({ tipo: 'DEBITO', item: deb })}
                    />
                  ))}
                </DataList>
              ) : null}

              {aba === 'creditos' ? (
                <DataList ariaLabel="Créditos de CBS consolidados">
                  {creditosFiltrados.map((cred) => (
                    <DataListItem
                      key={cred.id}
                      code={cred.cst ? `CST ${cred.cst}` : `#${cred.id}`}
                      title={cred.chEletr || 'Documento sem chave eletrônica'}
                      subtitle={`${cred.tpOper || 'Crédito CBS'}${cred.tpDocumento ? ` • ${cred.tpDocumento}` : ''}`}
                      details={[
                        { label: 'Emissão', value: toBrDateFromIso(cred.dataEmissao) || '-' },
                        { label: 'vBC', value: formatCurrencyBr(cred.valorBc) },
                        { label: 'Utilizado', value: formatCurrencyBr(cred.valorCbsUtilizada) },
                        { label: 'Saldo não util.', value: formatCurrencyBr(cred.valorCbsNaoUtilizada) },
                      ]}
                      status={
                        <StatusBadge
                          tone={cred.valorCbsNaoUtilizada > 0 ? 'info' : 'success'}
                          label={cred.valorCbsNaoUtilizada > 0 ? 'Com saldo' : 'Utilizado'}
                        />
                      }
                      aside={formatCurrencyBr(cred.valorCbsApropriada)}
                      onOpen={() => setDetalheModal({ tipo: 'CREDITO', item: cred })}
                    />
                  ))}
                </DataList>
              ) : null}

              {aba === 'pagamentos' ? (
                <DataList ariaLabel="Pagamentos de CBS">
                  {pagamentosFiltrados.map((pag) => (
                    <DataListItem
                      key={pag.id}
                      code={pag.tipoPagamento || 'PAG'}
                      title={pag.numeroPagamento ? `Pagamento ${pag.numeroPagamento}` : `Registro #${pag.id}`}
                      subtitle={`${pag.chEletr ? `Chave: ${pag.chEletr}` : 'Sem chave vinculada'}${pag.niAdquirente ? ` • Adquirente ${pag.niAdquirente}` : ''}`}
                      details={[
                        { label: 'Arrecadação', value: toBrDateFromIso(pag.dataArrecadacao) || '-' },
                        { label: 'Principal', value: formatCurrencyBr(pag.valorPrincipal) },
                        { label: 'Utilizado', value: formatCurrencyBr(pag.valorUtilizado) },
                        { label: 'Saldo', value: formatCurrencyBr(pag.valorSaldo) },
                      ]}
                      status={<StatusBadge label={pag.tipoPagamento || 'PCONT'} />}
                      aside={formatCurrencyBr(pag.valorTotal)}
                      onOpen={() => setDetalheModal({ tipo: 'PAGAMENTO', item: pag })}
                    />
                  ))}
                </DataList>
              ) : null}

              {aba === 'recolhimentos' ? (
                <DataList ariaLabel="Recolhimentos como Adquirente RAD">
                  {recolhimentosFiltrados.map((rec) => (
                    <DataListItem
                      key={rec.id}
                      code="RAD"
                      title={rec.numeroPagamento ? `Recolhimento ${rec.numeroPagamento}` : `Registro #${rec.id}`}
                      subtitle={`${rec.niFornecedor ? `Fornecedor ${rec.niFornecedor}` : 'Fornecedor não informado'}${rec.chEletr ? ` • ${rec.chEletr}` : ''}`}
                      details={[
                        { label: 'Arrecadação', value: toBrDateFromIso(rec.dataArrecadacao) || '-' },
                        { label: 'Principal', value: formatCurrencyBr(rec.valorPrincipal) },
                        { label: 'Crédito aprop.', value: formatCurrencyBr(rec.valorCreditoApropriado) },
                      ]}
                      status={<StatusBadge tone="success" label="Recolhido" />}
                      aside={formatCurrencyBr(rec.valorTotal)}
                      onOpen={() => setDetalheModal({ tipo: 'RECOLHIMENTO', item: rec })}
                    />
                  ))}
                </DataList>
              ) : null}
            </>
          )}
        </div>
      </section>

      <AdvancedFiltersPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        onApply={aplicarFiltros}
      >
        <div className="module-form">
          <div className="form-grid-2">
            <label>
              <span>Data inicial</span>
              <CustomDatePicker value={draftInicio} onChange={setDraftInicio} />
            </label>
            <label>
              <span>Data final</span>
              <CustomDatePicker value={draftFim} onChange={setDraftFim} />
            </label>

            <label>
              <span>CST (Débitos/Créditos)</span>
              <input
                type="text"
                value={draftCst}
                onChange={(e) => setDraftCst(e.target.value)}
                placeholder="Ex.: 000"
              />
            </label>
            <label>
              <span>Tipo de operação</span>
              <input
                type="text"
                value={draftTipoOper}
                onChange={(e) => setDraftTipoOper(e.target.value)}
                placeholder="Ex.: VENDA"
              />
            </label>

            <label className="form-grid-2__full">
              <span>Modalidade de pagamento</span>
              <SearchableSelect
                ariaLabel="Modalidade de pagamento"
                value={draftTipoPag}
                onChange={setDraftTipoPag}
                options={MODALIDADE_PAG_OPTIONS}
              />
            </label>

            <label>
              <span>Tipo de solicitação</span>
              <SearchableSelect
                ariaLabel="Tipo de solicitação"
                value={draftTipoSolicitacao}
                onChange={setDraftTipoSolicitacao}
                options={TIPO_APURACAO_OPTIONS}
              />
            </label>
            <label>
              <span>Situação da solicitação</span>
              <SearchableSelect
                ariaLabel="Situação da solicitação"
                value={draftSituacao}
                onChange={setDraftSituacao}
                options={SITUACAO_OPTIONS}
              />
            </label>
          </div>

          <button type="button" className="secondary-button" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      </AdvancedFiltersPanel>

      <ApuracaoCredenciaisModal
        open={credenciaisModalOpen}
        credenciais={credenciais}
        onClose={() => setCredenciaisModalOpen(false)}
        onSaved={(atualizadas) => {
          setCredenciais(atualizadas);
          void carregarDados();
        }}
      />

      <ApuracaoNovaSolicitacaoModal
        open={novaSolicitacaoOpen}
        configurado={Boolean(credenciais?.configurado)}
        resumo={resumo}
        onClose={() => setNovaSolicitacaoOpen(false)}
        onOpenCredenciais={() => setCredenciaisModalOpen(true)}
        onSolicitado={() => {
          setAba('solicitacoes');
          void carregarDados();
        }}
      />

      <ApuracaoDetalheModal
        detalhe={detalheModal}
        onClose={() => setDetalheModal(null)}
        onRefresh={carregarDados}
      />
    </main>
  );
}
