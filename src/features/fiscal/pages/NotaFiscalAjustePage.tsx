import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoAlertCircleOutline,
  IoArrowBack,
  IoBanOutline,
  IoCloseOutline,
  IoCodeSlashOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
  IoFilterOutline,
  IoPaperPlaneOutline,
  IoPrintOutline,
  IoRefreshOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { APP_VERSION } from '../../../constants/appInfo';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess, verificarAcaoTransacao } from '../../../hooks/useTransactionAccess';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  abrirBlobPdf,
  cancelarNotaAjuste,
  excluirNotaAjuste,
  formatCurrencyBr,
  gerarDanfeNotaAjustePdf,
  getFirstDayMonthBr,
  getTodayBr,
  listarNotasAjuste,
  obterCombosNotaAjuste,
  obterDetalheNotaAjuste,
  obterXmlNotaAjuste,
  retransmitirNotaAjuste,
  round2,
  toBrDateFromIso,
  type NotaAjusteCombos,
  type NotaAjusteListItem,
  type NotaAjusteOcorrencia,
} from '../../../services/notaAjusteApi';
import { NotaAjusteEmitirModal } from '../components/NotaAjusteEmitirModal';
import { NotaAjusteXmlModal } from '../components/NotaAjusteXmlModal';
import {
  compareSortNumber,
  compareSortText,
  getAriaSort,
  getSortIndicator,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';

type SortField = 'nota' | 'data' | 'subtipo' | 'cfop' | 'destinatario' | 'valor' | 'impostos' | 'situacao';

const getImpostosTotal = (row: NotaAjusteListItem): number => {
  const ibs = Number(row.subtipo === 'ND-07' ? row.valorTotalIbsEstCred ?? 0 : row.valorTotalIbs ?? 0);
  const cbs = Number(row.subtipo === 'ND-07' ? row.valorTotalCbsEstCred ?? 0 : row.valorTotalCbs ?? 0);
  return ibs + cbs;
};

const getSituacaoClass = (situacao?: number | null, autorizacaoNfe?: string | null, ultRetorno?: string | null): string => {
  const sit = Number(situacao ?? 0);
  if (sit === 9) return 'nfs-situacao--cancelada';
  if (sit === 1 || Boolean(autorizacaoNfe?.trim())) return 'nfs-situacao--entregue';
  if (sit === 3 || sit === 4 || sit === 8) return 'nfs-situacao--devolvida';
  if (
    ultRetorno &&
    (ultRetorno.toUpperCase().includes('REPROVADA') ||
      ultRetorno.toLowerCase().includes('rejei'))
  ) {
    return 'nfs-situacao--devolvida';
  }
  return 'nfs-situacao--emitida';
};

export function NotaFiscalAjustePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Controle de acesso por transação (DOC001)
  const permissaoStatus = useTransactionAccess('DOC001', 'Notas Fiscais de Ajuste');

  // Parâmetros e listas base
  const [combos, setCombos] = useState<NotaAjusteCombos | null>(null);
  const [rows, setRows] = useState<NotaAjusteListItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [finalidadeFiltro, setFinalidadeFiltro] = useState<'' | 'D' | 'C'>('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState(getFirstDayMonthBr);
  const [dataFim, setDataFim] = useState(getTodayBr);
  const [subtipoFiltro, setSubtipoFiltro] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState('');

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('nota');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modais principais
  const [emitirModalOpen, setEmitirModalOpen] = useState(false);
  const [validandoNovaNota, setValidandoNovaNota] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState<NotaAjusteListItem | null>(null);
  const [somenteLeituraModal, setSomenteLeituraModal] = useState(false);

  // XML Modal
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [xmlModalData, setXmlModalData] = useState({
    title: '',
    xml: '',
    fileName: 'nota-ajuste.xml',
    numNotaFiscal: '',
    serNotaFiscal: '',
    isAutorizada: false,
  });
  const [loadingXml, setLoadingXml] = useState(false);

  // DANFE PDF Modal
  const [danfeRow, setDanfeRow] = useState<NotaAjusteListItem | null>(null);
  const [tipoDanfe, setTipoDanfe] = useState<5 | 6>(5);
  const [danfeLoading, setDanfeLoading] = useState(false);

  // Ocorrências Modal
  const [ocorrenciasRow, setOcorrenciasRow] = useState<NotaAjusteListItem | null>(null);
  const [ocorrenciasList, setOcorrenciasList] = useState<NotaAjusteOcorrencia[]>([]);
  const [ocorrenciasLoading, setOcorrenciasLoading] = useState(false);

  // Retransmissão Modal
  const [retransmitirRow, setRetransmitirRow] = useState<NotaAjusteListItem | null>(null);
  const [retransmitirLoading, setRetransmitirLoading] = useState(false);

  // Cancelamento Modal (notas autorizadas na SEFAZ)
  const [cancelarRow, setCancelarRow] = useState<NotaAjusteListItem | null>(null);
  const [codigoMotivoCancel, setCodigoMotivoCancel] = useState('');
  const [cancelarLoading, setCancelarLoading] = useState(false);

  // Exclusão Modal (notas não autorizadas na SEFAZ)
  const [excluirRow, setExcluirRow] = useState<NotaAjusteListItem | null>(null);
  const [codigoMotivoExcluir, setCodigoMotivoExcluir] = useState('');
  const [excluirLoading, setExcluirLoading] = useState(false);

  const carregarCombos = useCallback(async () => {
    try {
      const data = await obterCombosNotaAjuste();
      setCombos(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar parâmetros de Nota Fiscal de Ajuste.', 'error');
    }
  }, [showToast]);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarNotasAjuste({
        dataInicio,
        dataFim,
        finalidade: finalidadeFiltro || undefined,
        subtipo: subtipoFiltro || undefined,
        situacao: situacaoFiltro || undefined,
        busca: searchTerm || undefined,
      });
      setRows(data);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar Notas Fiscais de Ajuste.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, finalidadeFiltro, subtipoFiltro, situacaoFiltro, searchTerm, showToast]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarCombos();
  }, [carregarCombos, permissaoStatus]);

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarLista();
  }, [finalidadeFiltro, permissaoStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowsOrdenadas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtradas = q
      ? rows.filter((r) =>
          [
            r.numNotaFiscal,
            r.serNotaFiscal,
            r.subtipo,
            r.descricaoSubtipo,
            r.nomeDestinatario,
            r.cnpjCpfDestinatario,
            r.chaveAcessoNfe,
            r.ultimoRetorno,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : rows;

    return sortByComparator(filtradas, sortDirection, (a, b) => {
      switch (sortField) {
        case 'nota':
          return (
            compareSortNumber(a.numNotaFiscal, b.numNotaFiscal) ||
            compareSortText(a.serNotaFiscal, b.serNotaFiscal)
          );
        case 'data':
          return parseSortTimestamp(a.dataEmissao) - parseSortTimestamp(b.dataEmissao);
        case 'subtipo':
          return compareSortText(a.subtipo, b.subtipo);
        case 'cfop':
          return compareSortText(a.codigoCfo, b.codigoCfo);
        case 'destinatario':
          return compareSortText(a.nomeDestinatario, b.nomeDestinatario);
        case 'valor':
          return compareSortNumber(a.valorTotalNota, b.valorTotalNota);
        case 'impostos':
          return getImpostosTotal(a) - getImpostosTotal(b);
        case 'situacao':
          return (
            compareSortNumber(a.situacaoNota, b.situacaoNota) ||
            compareSortText(a.situacaoDescricao, b.situacaoDescricao)
          );
      }
    });
  }, [rows, searchTerm, sortField, sortDirection]);

  const resumo = useMemo(() => {
    let autorizadas = 0;
    let totalValor = 0;
    let totalIbs = 0;
    let totalCbs = 0;
    let totalEstorno = 0;
    for (const r of rowsOrdenadas) {
      const sit = Number(r.situacaoNota ?? 0);
      const canc = sit === 9;
      const aut = !canc && (sit === 1 || Boolean(r.autorizacaoNfe?.trim()));
      if (aut) autorizadas += 1;
      if (!canc && sit !== 3) {
        totalValor += Number(r.valorTotalNota || 0);
        totalIbs += Number(r.valorTotalIbs || 0);
        totalCbs += Number(r.valorTotalCbs || 0);
        totalEstorno += Number(r.valorTotalIbsEstCred || 0) + Number(r.valorTotalCbsEstCred || 0);
      }
    }
    return {
      totalRegistros: rowsOrdenadas.length,
      autorizadas,
      totalValor: round2(totalValor),
      totalIbs: round2(totalIbs),
      totalCbs: round2(totalCbs),
      totalEstorno: round2(totalEstorno),
    };
  }, [rowsOrdenadas]);

  const handleSort = (field: SortField) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const renderSortHeader = (label: string, field: SortField, className?: string) => (
    <th scope="col" className={className} aria-sort={getAriaSort(sortField, sortDirection, field)}>
      <button className="module-table__sort" type="button" onClick={() => handleSort(field)}>
        {label} <span aria-hidden="true">{getSortIndicator(sortField, sortDirection, field)}</span>
      </button>
    </th>
  );

  const handleVerXml = async (e: React.MouseEvent, row: NotaAjusteListItem) => {
    e.stopPropagation();
    const sit = Number(row.situacaoNota ?? 0);
    const isCancelada = sit === 9;
    const isAutorizada = !isCancelada && (sit === 1 || Boolean(row.autorizacaoNfe?.trim()));

    setLoadingXml(true);
    try {
      const xml = await obterXmlNotaAjuste(row.numNotaFiscal, row.serNotaFiscal);
      setXmlModalData({
        title: `XML NF-e de Ajuste — ${row.numNotaFiscal}/${row.serNotaFiscal} (${row.subtipo})`,
        xml,
        fileName: row.chaveAcessoNfe ? `${row.chaveAcessoNfe}-nfe.xml` : `NFe_Ajuste_${row.numNotaFiscal}_${row.serNotaFiscal}.xml`,
        numNotaFiscal: row.numNotaFiscal,
        serNotaFiscal: row.serNotaFiscal,
        isAutorizada,
      });
      setXmlModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível obter o XML desta nota.', 'error');
    } finally {
      setLoadingXml(false);
    }
  };

  const handleAbrirOcorrencias = async (e: React.MouseEvent, row: NotaAjusteListItem) => {
    e.stopPropagation();
    if (!(await validarAcaoNotaAjuste(38, 'Você não possui permissão para consultar o histórico de ocorrências.'))) {
      return;
    }
    setOcorrenciasRow(row);
    setOcorrenciasList([]);
    setOcorrenciasLoading(true);
    try {
      const det = await obterDetalheNotaAjuste(row.numNotaFiscal, row.serNotaFiscal);
      setOcorrenciasList(det.ocorrencias || []);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar ocorrências.', 'error');
    } finally {
      setOcorrenciasLoading(false);
    }
  };

  const handleConfirmarDanfe = async () => {
    if (!danfeRow) return;
    setDanfeLoading(true);
    try {
      const sit = Number(danfeRow.situacaoNota ?? 0);
      const autorizada = sit !== 9 && (sit === 1 || Boolean(danfeRow.autorizacaoNfe?.trim()));
      const pdfBlob = await gerarDanfeNotaAjustePdf(
        danfeRow.numNotaFiscal,
        danfeRow.serNotaFiscal,
        tipoDanfe,
        undefined,
        { simulacao: !autorizada },
      );
      abrirBlobPdf(pdfBlob);
      setDanfeRow(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar PDF da DANFE.', 'error');
    } finally {
      setDanfeLoading(false);
    }
  };

  const handleConfirmarRetransmissao = async () => {
    if (!retransmitirRow) return;
    setRetransmitirLoading(true);
    try {
      const serCombo = combos?.series.find((s) => s.serNotaFiscal === retransmitirRow.serNotaFiscal);
      const res = await retransmitirNotaAjuste({
        codigoEmpresa: GlobalConfig.getCodEmpresa() ?? retransmitirRow.codigoEmpresa,
        numNotaFiscal: retransmitirRow.numNotaFiscal,
        serNotaFiscal: retransmitirRow.serNotaFiscal,
        tipoAmbiente: serCombo?.tipoNota ?? 2,
        versaoSistema: APP_VERSION,
      });
      showToast(res.mensagem || 'Retransmissão concluída.', res.sucesso ? 'success' : 'error');
      setRetransmitirRow(null);
      void carregarLista();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao retransmitir para SEFAZ.', 'error');
    } finally {
      setRetransmitirLoading(false);
    }
  };

  const handleConfirmarCancelamento = async () => {
    if (!cancelarRow) return;
    const motivo = Number(codigoMotivoCancel);
    if (!motivo) {
      showToast('Selecione o motivo de cancelamento.', 'info');
      return;
    }
    setCancelarLoading(true);
    try {
      const res = await cancelarNotaAjuste({
        numNotaFiscal: cancelarRow.numNotaFiscal,
        serNotaFiscal: cancelarRow.serNotaFiscal,
        codigoMotivo: motivo,
      });
      showToast(res.message || 'Nota Fiscal de Ajuste cancelada com sucesso.', 'success');
      setCancelarRow(null);
      setCodigoMotivoCancel('');
      void carregarLista();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cancelar Nota Fiscal de Ajuste.', 'error');
    } finally {
      setCancelarLoading(false);
    }
  };

  const validarAcaoNotaAjuste = async (codigoAcao: number, mensagemNegada: string): Promise<boolean> => {
    if (validandoNovaNota) return false;
    setValidandoNovaNota(true);
    try {
      const { permitido, mensagem } = await verificarAcaoTransacao('DOC001', codigoAcao);
      if (!permitido) {
        showToast(mensagem || mensagemNegada, 'error');
        return false;
      }
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Erro ao validar permissão na Nota Fiscal de Ajuste.', 'error');
      return false;
    } finally {
      setValidandoNovaNota(false);
    }
  };

  const abrirNotaAjusteEdicaoOuConsulta = async (
    row: NotaAjusteListItem,
    isSomenteLeitura: boolean,
    isAutorizada: boolean,
  ) => {
    if (!isSomenteLeitura || !isAutorizada) {
      const msg = !isSomenteLeitura
        ? 'Você não possui permissão para editar Notas Fiscais de Ajuste.'
        : 'Você não possui permissão para consultar notas fiscais não autorizadas.';
      if (!(await validarAcaoNotaAjuste(38, msg))) {
        return;
      }
    }
    setNotaSelecionada(row);
    setSomenteLeituraModal(isSomenteLeitura);
    setEmitirModalOpen(true);
  };

  const abrirNovaNotaAjuste = async () => {
    if (!(await validarAcaoNotaAjuste(35, 'Você não possui permissão para incluir Nota Fiscal de Ajuste.'))) {
      return;
    }
    setNotaSelecionada(null);
    setSomenteLeituraModal(false);
    setEmitirModalOpen(true);
  };

  const abrirRetransmitirNotaAjuste = async (row: NotaAjusteListItem) => {
    if (!(await validarAcaoNotaAjuste(38, 'Você não possui permissão para transmitir ou retransmitir Notas Fiscais de Ajuste.'))) {
      return;
    }
    setRetransmitirRow(row);
  };

  const abrirExcluirNotaAjuste = async (row: NotaAjusteListItem) => {
    if (!(await validarAcaoNotaAjuste(38, 'Você não possui permissão para excluir Notas Fiscais de Ajuste.'))) {
      return;
    }
    setCodigoMotivoExcluir(
      combos?.motivosCancelamento[0] ? String(combos.motivosCancelamento[0].codigoMotivo) : '',
    );
    setExcluirRow(row);
  };

  const abrirCancelarNotaAjuste = async (row: NotaAjusteListItem) => {
    if (!(await validarAcaoNotaAjuste(38, 'Você não possui permissão para cancelar Notas Fiscais de Ajuste.'))) {
      return;
    }
    setCodigoMotivoCancel(
      combos?.motivosCancelamento[0] ? String(combos.motivosCancelamento[0].codigoMotivo) : '',
    );
    setCancelarRow(row);
  };

  const handleConfirmarExclusao = async () => {
    if (!excluirRow) return;
    const motivo = Number(codigoMotivoExcluir);
    if (motivosCancelOptions.length > 0 && !motivo) {
      showToast('Selecione o motivo para confirmar a exclusão.', 'info');
      return;
    }
    setExcluirLoading(true);
    try {
      const res = await excluirNotaAjuste({
        numNotaFiscal: excluirRow.numNotaFiscal,
        serNotaFiscal: excluirRow.serNotaFiscal,
        codigoMotivo: motivo || 0,
      });
      if (res.sucesso) {
        showToast(res.mensagem || 'Nota Fiscal de Ajuste excluída com sucesso.', 'success');
        setExcluirRow(null);
        setCodigoMotivoExcluir('');
        void carregarLista();
      } else {
        showToast(res.mensagem || 'Não foi possível excluir a Nota Fiscal de Ajuste.', 'error');
        if (res.bloqueadaPorAutorizacao) {
          setExcluirRow(null);
          setCodigoMotivoExcluir('');
          void carregarLista();
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir Nota Fiscal de Ajuste.', 'error');
    } finally {
      setExcluirLoading(false);
    }
  };

  const subtipoFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todos os subtipos' },
      ...(combos?.subtipos || []).map((s) => ({
        value: s.codigo,
        label: `[${s.finalidade === 'D' ? 'Déb' : 'Créd'}] ${s.codigo} - ${s.titulo}`,
      })),
    ],
    [combos],
  );

  const situacaoFilterOptions = [
    { value: '', label: 'Todas as situações' },
    { value: '0', label: '0 - Em Digitação / Pendente SEFAZ' },
    { value: '1', label: '1 - Autorizada SEFAZ' },
    { value: '9', label: '9 - Cancelada' },
  ];

  const motivosCancelOptions = useMemo(
    () =>
      (combos?.motivosCancelamento || []).map((m) => ({
        value: String(m.codigoMotivo),
        label: `${m.codigoMotivo} — ${m.descricaoMotivo}`,
      })),
    [combos],
  );

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page nfa-page">
        <section className="clientes-panel list-layout-panel nfa-panel">
          <p className="module-empty">Verificando permissão de acesso...</p>
        </section>
      </main>
    );
  }

  if (permissaoStatus === 'negado') {
    return null;
  }

  return (
    <main className="clientes-page list-layout-page nfa-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Notas Fiscais de Ajuste (IBS / CBS)</h1>
            <p>
              Emissão de Notas de Débito (<code>finNFe=6</code>) e Crédito (<code>finNFe=5</code>) — Reforma Tributária
              NT 2025.002-RTC.
            </p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel nfa-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="nfa-top-left">
            <div className="clientes-panel__summary">
              <strong>Notas de Ajuste</strong>
              <span>
                {resumo.totalRegistros} registro(s) · {resumo.autorizadas} autorizada(s)
              </span>
            </div>

            <div className="nfa-radio-pills">
              <button
                type="button"
                className={`nfa-pill ${finalidadeFiltro === '' ? 'is-active' : ''}`}
                onClick={() => setFinalidadeFiltro('')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`nfa-pill ${finalidadeFiltro === 'D' ? 'is-active' : ''}`}
                onClick={() => setFinalidadeFiltro('D')}
              >
                Débito (finNFe=6)
              </button>
              <button
                type="button"
                className={`nfa-pill ${finalidadeFiltro === 'C' ? 'is-active' : ''}`}
                onClick={() => setFinalidadeFiltro('C')}
              >
                Crédito (finNFe=5)
              </button>
            </div>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Pesquisar NF, subtipo, destinatário, chave..."
            />

            <button
              className={`icon-button module-action-button${filtrosOpen ? ' module-action-button--primary' : ''}`}
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
              title="Atualizar lista"
              aria-label="Atualizar lista"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              disabled={validandoNovaNota}
              onClick={() => void abrirNovaNotaAjuste()}
              title="Nova Nota Fiscal de Ajuste"
              aria-label="Nova Nota Fiscal de Ajuste"
            >
              <IoAddOutline size={18} />
            </button>
          </div>
        </div>

        {/* Cartões Resumo */}
        <div className="nfa-kpi-strip">
          <div className="nfa-kpi">
            <span>Valor Total Notas</span>
            <strong>{formatCurrencyBr(resumo.totalValor)}</strong>
          </div>
          <div className="nfa-kpi">
            <span>Total IBS (UF + Mun)</span>
            <strong>{formatCurrencyBr(resumo.totalIbs)}</strong>
          </div>
          <div className="nfa-kpi">
            <span>Total CBS</span>
            <strong>{formatCurrencyBr(resumo.totalCbs)}</strong>
          </div>
          <div className="nfa-kpi">
            <span>Estorno Crédito (ND-07)</span>
            <strong>{formatCurrencyBr(resumo.totalEstorno)}</strong>
          </div>
        </div>

        <AdvancedFiltersPanel
          open={filtrosOpen}
          onClose={() => setFiltrosOpen(false)}
          onApply={() => {
            setFiltrosOpen(false);
            void carregarLista();
          }}
          applyDisabled={loading}
        >
          <div className="list-layout-extra-filters nfs-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
            </label>

            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker value={dataFim} onChange={setDataFim} />
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Subtipo Fiscal</span>
              <SearchableSelect
                options={subtipoFilterOptions}
                value={subtipoFiltro}
                onChange={setSubtipoFiltro}
                placeholder="Todos..."
              />
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Situação SEFAZ</span>
              <SearchableSelect
                options={situacaoFilterOptions}
                value={situacaoFiltro}
                onChange={setSituacaoFiltro}
                placeholder="Todas..."
              />
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
          {loading ? (
            <p className="module-empty">Carregando Notas Fiscais de Ajuste...</p>
          ) : rowsOrdenadas.length === 0 ? (
            <p className="module-empty">
              Nenhuma Nota Fiscal de Ajuste encontrada para os filtros selecionados. Clique em "+" (Nova Nota Fiscal de Ajuste) para emitir.
            </p>
          ) : (
            <div className="table-scroll module-table-wrap">
              <table>
                <thead>
                  <tr>
                    {renderSortHeader('NF / Série', 'nota')}
                    {renderSortHeader('Emissão', 'data')}
                    {renderSortHeader('Subtipo', 'subtipo')}
                    {renderSortHeader('CFOP', 'cfop')}
                    {renderSortHeader('Destinatário', 'destinatario')}
                    {renderSortHeader('Valor NF', 'valor', 'nfa-num')}
                    {renderSortHeader('IBS / CBS', 'impostos', 'nfa-num')}
                    {renderSortHeader('Situação', 'situacao')}
                    <th scope="col">Último Retorno / Chave</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsOrdenadas.map((row) => {
                    const sit = Number(row.situacaoNota ?? 0);
                    const isCancelada = sit === 9;
                    const isAutorizada = !isCancelada && (sit === 1 || Boolean(row.autorizacaoNfe?.trim()));
                    const isSomenteLeitura = isAutorizada || isCancelada || sit === 3 || sit === 4;
                    const ibsDisplay =
                      row.subtipo === 'ND-07' ? row.valorTotalIbsEstCred : row.valorTotalIbs;
                    const cbsDisplay =
                      row.subtipo === 'ND-07' ? row.valorTotalCbsEstCred : row.valorTotalCbs;

                    return (
                      <tr
                        key={`${row.numNotaFiscal}-${row.serNotaFiscal}`}
                        onClick={() => void abrirNotaAjusteEdicaoOuConsulta(row, isSomenteLeitura, isAutorizada)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="nfa-mono">
                          <strong>{row.numNotaFiscal}</strong>/{row.serNotaFiscal}
                        </td>
                        <td>{toBrDateFromIso(row.dataEmissao) || '-'}</td>
                        <td>
                          <span
                            className={`nfa-badge ${
                              row.finalidade === 'C' ? 'nfa-badge--credito' : 'nfa-badge--debito'
                            }`}
                          >
                            {row.subtipo}
                          </span>
                          <div className="nfa-subtext">{row.descricaoSubtipo}</div>
                        </td>
                        <td className="nfa-mono">{row.codigoCfo || '-'}</td>
                        <td>
                          <div>{row.nomeDestinatario || '-'}</div>
                          {row.cnpjCpfDestinatario && (
                            <div className="nfa-subtext nfa-mono">{row.cnpjCpfDestinatario}</div>
                          )}
                        </td>
                        <td className="nfa-num">{formatCurrencyBr(row.valorTotalNota)}</td>
                        <td className="nfa-num">
                          <div>{formatCurrencyBr(ibsDisplay)}</div>
                          <div className="nfa-subtext">{formatCurrencyBr(cbsDisplay)}</div>
                        </td>
                        <td>
                          <span className={`nfs-situacao ${getSituacaoClass(sit, row.autorizacaoNfe, row.ultimoRetorno)}`}>
                            {row.situacaoDescricao || `Situação ${sit}`}
                          </span>
                        </td>
                        <td>
                          <div className="nfa-subtext" title={row.ultimoRetorno || ''}>
                            {row.ultimoRetorno
                              ? row.ultimoRetorno.length > 42
                                ? `${row.ultimoRetorno.slice(0, 42)}…`
                                : row.ultimoRetorno
                              : '-'}
                          </div>
                          {row.chaveAcessoNfe && (
                            <div className="nfa-subtext nfa-mono" title={row.chaveAcessoNfe}>
                              Chave: ...{row.chaveAcessoNfe.slice(-10)}
                            </div>
                          )}
                        </td>
                        <td className="nfa-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button
                              type="button"
                              title={isSomenteLeitura ? 'Visualizar nota' : 'Editar rascunho / ajustar'}
                              aria-label={isSomenteLeitura ? 'Visualizar nota' : 'Editar rascunho'}
                              disabled={validandoNovaNota}
                              onClick={() => void abrirNotaAjusteEdicaoOuConsulta(row, isSomenteLeitura, isAutorizada)}
                            >
                              {isSomenteLeitura ? <IoEyeOutline size={16} /> : <IoCreateOutline size={16} />}
                            </button>

                            <button
                              type="button"
                              title="Visualizar / Baixar XML"
                              aria-label="Visualizar ou baixar XML"
                              disabled={loadingXml}
                              onClick={(e) => void handleVerXml(e, row)}
                            >
                              <IoCodeSlashOutline size={16} />
                            </button>

                            <button
                              type="button"
                              title={
                                isAutorizada
                                  ? 'Imprimir DANFE (PDF)'
                                  : 'Imprimir prévia da DANFE (PDF — Layout Reforma Tributária)'
                              }
                              aria-label="Imprimir DANFE PDF"
                              onClick={() => {
                                setTipoDanfe(5);
                                setDanfeRow(row);
                              }}
                            >
                              <IoPrintOutline size={16} />
                            </button>

                            <button
                              type="button"
                              title="Histórico de ocorrências SEFAZ"
                              aria-label="Histórico de ocorrências"
                              disabled={validandoNovaNota}
                              onClick={(e) => void handleAbrirOcorrencias(e, row)}
                            >
                              <IoTimeOutline size={16} />
                            </button>

                            {!isAutorizada && !isCancelada && (
                              <>
                                <button
                                  type="button"
                                  title="Transmitir / Retransmitir SEFAZ"
                                  aria-label="Retransmitir SEFAZ"
                                  disabled={validandoNovaNota}
                                  onClick={() => void abrirRetransmitirNotaAjuste(row)}
                                >
                                  <IoPaperPlaneOutline size={16} />
                                </button>

                                <button
                                  type="button"
                                  className="danger"
                                  title="Excluir registro (nota não autorizada)"
                                  aria-label="Excluir Nota Fiscal de Ajuste"
                                  disabled={validandoNovaNota}
                                  onClick={() => void abrirExcluirNotaAjuste(row)}
                                >
                                  <IoTrashOutline size={16} />
                                </button>
                              </>
                            )}

                            {isAutorizada && (
                              <button
                                type="button"
                                className="danger"
                                title="Cancelar NF-e na SEFAZ"
                                aria-label="Cancelar NF-e"
                                disabled={validandoNovaNota}
                                onClick={() => void abrirCancelarNotaAjuste(row)}
                              >
                                <IoBanOutline size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {/* Modal Criação / Edição */}
      <NotaAjusteEmitirModal
        open={emitirModalOpen}
        onClose={() => setEmitirModalOpen(false)}
        onSuccess={() => {
          setEmitirModalOpen(false);
          void carregarLista();
          void carregarCombos();
        }}
        combos={combos}
        notaEditar={notaSelecionada}
        somenteLeitura={somenteLeituraModal}
      />

      {/* Modal XML */}
      <NotaAjusteXmlModal
        open={xmlModalOpen}
        onClose={() => setXmlModalOpen(false)}
        title={xmlModalData.title}
        xml={xmlModalData.xml}
        fileName={xmlModalData.fileName}
        simulacao={false}
        podeImprimirDanfe={xmlModalData.isAutorizada}
        numNotaFiscal={xmlModalData.numNotaFiscal}
        serNotaFiscal={xmlModalData.serNotaFiscal}
      />

      {/* Modal DANFE */}
      {danfeRow && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfa-danfe-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !danfeLoading) setDanfeRow(null);
          }}
        >
          <article className="modal-card modal-card--confirm">
            <header className="modal-card__header">
              <h2 id="nfa-danfe-title">Imprimir DANFE — NF {danfeRow.numNotaFiscal}/{danfeRow.serNotaFiscal}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                disabled={danfeLoading}
                onClick={() => setDanfeRow(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body nfa-modal__body">
              <p>Escolha a orientação do layout da DANFE (Reforma Tributária / NT 2026.010):</p>
              <div className="nfa-radio-pills">
                <button
                  type="button"
                  className={`nfa-pill ${tipoDanfe === 5 ? 'is-active' : ''}`}
                  onClick={() => setTipoDanfe(5)}
                >
                  <IoDocumentTextOutline size={16} /> Retrato (Padrão)
                </button>
                <button
                  type="button"
                  className={`nfa-pill ${tipoDanfe === 6 ? 'is-active' : ''}`}
                  onClick={() => setTipoDanfe(6)}
                >
                  <IoDocumentTextOutline size={16} /> Paisagem
                </button>
              </div>
            </div>
            <footer className="nfa-modal__footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDanfeRow(null)}
                disabled={danfeLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleConfirmarDanfe()}
                disabled={danfeLoading}
              >
                <IoPrintOutline size={16} />
                <span>{danfeLoading ? 'Gerando PDF...' : 'Gerar DANFE'}</span>
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal Ocorrências */}
      {ocorrenciasRow && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfa-ocorr-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOcorrenciasRow(null);
          }}
        >
          <article className="modal-card nfa-modal nfa-modal--lg">
            <header className="modal-card__header">
              <h2 id="nfa-ocorr-title">
                Histórico de Ocorrências — NF {ocorrenciasRow.numNotaFiscal}/{ocorrenciasRow.serNotaFiscal}
              </h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setOcorrenciasRow(null)}>
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="nfa-modal__body">
              {ocorrenciasLoading ? (
                <p className="module-empty">Carregando ocorrências...</p>
              ) : ocorrenciasList.length === 0 ? (
                <p className="module-empty">Nenhuma ocorrência registrada para esta nota fiscal.</p>
              ) : (
                <div className="table-scroll nfa-table-wrap">
                  <table className="nfa-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Data / Hora</th>
                        <th>Situação</th>
                        <th>Usuário</th>
                        <th>Descrição / Retorno SEFAZ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocorrenciasList.map((oc, idx) => (
                        <tr key={`${oc.numOcorrencia ?? idx}-${idx}`}>
                          <td className="nfa-mono">{oc.numOcorrencia ?? idx + 1}</td>
                          <td>
                            {oc.dataOcorrencia
                              ? new Date(oc.dataOcorrencia).toLocaleString('pt-BR')
                              : '-'}
                          </td>
                          <td>{oc.situacaoNota ?? '-'}</td>
                          <td>{oc.codigoUsuario || '-'}</td>
                          <td>{oc.descricaoOcorrencia || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <footer className="nfa-modal__footer">
              <button type="button" className="primary-button" onClick={() => setOcorrenciasRow(null)}>
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal Retransmissão */}
      {retransmitirRow && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfa-retrans-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !retransmitirLoading) setRetransmitirRow(null);
          }}
        >
          <article className="modal-card modal-card--confirm">
            <header className="modal-card__header">
              <h2 id="nfa-retrans-title">Retransmitir NF de Ajuste</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                disabled={retransmitirLoading}
                onClick={() => setRetransmitirRow(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body modal-card__body--confirm">
              <IoAlertCircleOutline size={36} className="modal-confirm__icon" />
              <p>
                Confirma a geração e transmissão XML para a SEFAZ da Nota Fiscal de Ajuste{' '}
                <strong>
                  {retransmitirRow.numNotaFiscal}/{retransmitirRow.serNotaFiscal}
                </strong>{' '}
                ({retransmitirRow.subtipo})?
              </p>
            </div>
            <footer className="nfa-modal__footer">
              <button
                type="button"
                className="secondary-button"
                disabled={retransmitirLoading}
                onClick={() => setRetransmitirRow(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={retransmitirLoading}
                onClick={() => void handleConfirmarRetransmissao()}
              >
                <IoPaperPlaneOutline size={16} />
                <span>{retransmitirLoading ? 'Transmitindo...' : 'Transmitir SEFAZ'}</span>
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal Cancelamento */}
      {cancelarRow && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfa-cancel-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cancelarLoading) setCancelarRow(null);
          }}
        >
          <article className="modal-card nfa-modal">
            <header className="modal-card__header">
              <h2 id="nfa-cancel-title">
                Cancelar NF-e {cancelarRow.numNotaFiscal}/{cancelarRow.serNotaFiscal}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                disabled={cancelarLoading}
                onClick={() => setCancelarRow(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="nfa-modal__body">
              <div className="nfa-banner nfa-banner--warning">
                <IoAlertCircleOutline size={18} />
                <span>
                  Esta ação enviará o evento oficial de cancelamento (110111) para a SEFAZ. Selecione um motivo
                  cadastrado com no mínimo 15 caracteres na justificativa.
                </span>
              </div>

              <label className="nfa-field">
                <span>Motivo do Cancelamento *</span>
                <SearchableSelect
                  options={motivosCancelOptions}
                  value={codigoMotivoCancel}
                  onChange={setCodigoMotivoCancel}
                  placeholder="Selecione o motivo..."
                />
              </label>
            </div>
            <footer className="nfa-modal__footer">
              <button
                type="button"
                className="secondary-button"
                disabled={cancelarLoading}
                onClick={() => setCancelarRow(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="primary-button nfa-btn-danger"
                disabled={cancelarLoading || !codigoMotivoCancel}
                onClick={() => void handleConfirmarCancelamento()}
              >
                <IoBanOutline size={16} />
                <span>{cancelarLoading ? 'Cancelando...' : 'Confirmar Cancelamento SEFAZ'}</span>
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal Exclusão (notas sem autorização na SEFAZ) */}
      {excluirRow && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfa-excluir-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !excluirLoading) setExcluirRow(null);
          }}
        >
          <article className="modal-card nfa-modal">
            <header className="modal-card__header">
              <h2 id="nfa-excluir-title">
                Excluir NF de Ajuste {excluirRow.numNotaFiscal}/{excluirRow.serNotaFiscal}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                disabled={excluirLoading}
                onClick={() => setExcluirRow(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="nfa-modal__body">
              <div className="nfa-banner nfa-banner--warning">
                <IoAlertCircleOutline size={18} />
                <span>
                  Deseja realmente excluir este registro do sistema? Antes de remover, o sistema consultará a situação na
                  SEFAZ para garantir que a NF-e não esteja autorizada. Caso tenha sido autorizada, ela será atualizada e
                  a exclusão será bloqueada.
                </span>
              </div>

              {motivosCancelOptions.length > 0 && (
                <label className="nfa-field">
                  <span>Motivo da Exclusão / Cancelamento *</span>
                  <SearchableSelect
                    options={motivosCancelOptions}
                    value={codigoMotivoExcluir}
                    onChange={setCodigoMotivoExcluir}
                    placeholder="Selecione o motivo..."
                  />
                </label>
              )}
            </div>
            <footer className="nfa-modal__footer">
              <button
                type="button"
                className="secondary-button"
                disabled={excluirLoading}
                onClick={() => setExcluirRow(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="primary-button nfa-btn-danger"
                disabled={excluirLoading || (motivosCancelOptions.length > 0 && !codigoMotivoExcluir)}
                onClick={() => void handleConfirmarExclusao()}
              >
                <IoTrashOutline size={16} />
                <span>{excluirLoading ? 'Consultando SEFAZ e excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </footer>
          </article>
        </section>
      )}
    </main>
  );
}
