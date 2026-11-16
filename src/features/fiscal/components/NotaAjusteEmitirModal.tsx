import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoAddOutline,
  IoCalculatorOutline,
  IoCloseOutline,
  IoCodeSlashOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoPaperPlaneOutline,
  IoSaveOutline,
  IoSearchOutline,
  IoTrashOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { APP_VERSION } from '../../../constants/appInfo';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  buscarDestinatariosAjuste,
  buscarNotaReferenciaPorNumero,
  createEmptyItem,
  emitirNotaAjuste,
  formatCurrencyBr,
  formatDecimalBr,
  getTodayBr,
  obterDetalheNotaAjuste,
  obterItensNotaReferenciaAjuste,
  obterItensRecebimentoAjuste,
  obterProximoNumeroNotaAjuste,
  recalcularTributosItem,
  round2,
  simularXmlNotaAjuste,
  toBrDateFromIso,
  toIsoDateFromBr,
  type AdiantamentoDisponivel,
  type DestinatarioOpcao,
  type NotaAjusteCombos,
  type NotaAjusteEmitirRequest,
  type NotaAjusteItemInput,
  type NotaAjusteListItem,
  type NotaAjusteSubtipoInfo,
  type NotaOriginalResumo,
  type RecebimentoResumo,
} from '../../../services/notaAjusteApi';
import { NotaAjusteItemModal } from './NotaAjusteItemModal';
import { NotaAjusteRateioModal } from './NotaAjusteRateioModal';
import { NotaAjusteSelecaoModal, type ModoSelecaoOrigem } from './NotaAjusteSelecaoModal';
import { NotaAjusteXmlModal } from './NotaAjusteXmlModal';

interface NotaAjusteEmitirModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  combos: NotaAjusteCombos | null;
  notaEditar: NotaAjusteListItem | null;
  somenteLeitura?: boolean;
}

type DigitoCfop = '1' | '2' | '3' | '5' | '6' | '7';

function calcularDigitoCfopEsperado(params: {
  finalidade?: string;
  autoEmissao?: boolean;
  ufEmpresa?: string;
  ufDestinatario?: string;
  codigoPais?: number;
}): DigitoCfop | null {
  const fin = params.finalidade === 'C' ? 'C' : 'D';
  if (params.autoEmissao) return fin === 'C' ? '1' : '5';

  const ufEmit = (params.ufEmpresa || '').trim().toUpperCase();
  const ufDest = (params.ufDestinatario || '').trim().toUpperCase();
  const ehExterior =
    ufDest === 'EX' || (params.codigoPais != null && params.codigoPais !== 0 && params.codigoPais !== 1058);

  if (ehExterior) return fin === 'C' ? '3' : '7';
  if (!ufEmit || !ufDest) return null;

  const mesmaUf = ufEmit === ufDest;
  return fin === 'C' ? (mesmaUf ? '1' : '2') : mesmaUf ? '5' : '6';
}

function adaptarCfopParaDigito(
  cfopAtual: string,
  digito: DigitoCfop | null,
  cfops: { codigoCfo: string }[],
): string {
  if (!digito) return cfopAtual;
  const digits = (cfopAtual || '').replace(/\D+/g, '');
  if (digits.startsWith(digito)) {
    const canon = cfops.find((c) => c.codigoCfo.replace(/\D+/g, '') === digits);
    return canon?.codigoCfo ?? cfopAtual;
  }
  if (digits.length >= 4) {
    const alvoDigits = `${digito}${digits.slice(1)}`;
    const equiv = cfops.find((c) => c.codigoCfo.replace(/\D+/g, '') === alvoDigits);
    if (equiv) return equiv.codigoCfo;
  }
  return cfops.find((c) => c.codigoCfo.replace(/\D+/g, '').startsWith(digito))?.codigoCfo ?? cfopAtual;
}

export function NotaAjusteEmitirModal({
  open,
  onClose,
  onSuccess,
  combos,
  notaEditar,
  somenteLeitura = false,
}: NotaAjusteEmitirModalProps) {
  const { showToast } = useToast();

  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [submitting, setSubmitting] = useState<'draft' | 'sefaz' | 'simular' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Cabeçalho
  const [subtipoCodigo, setSubtipoCodigo] = useState('ND-04');
  const [serie, setSerie] = useState('');
  const [numNotaFiscal, setNumNotaFiscal] = useState('');
  const [dataEmissao, setDataEmissao] = useState(getTodayBr);
  const [dataPrevEntrega, setDataPrevEntrega] = useState('');
  const [codigoCfo, setCodigoCfo] = useState('');
  const [tipoDestinatario, setTipoDestinatario] = useState<'C' | 'F' | 'E'>('C');
  const [codigoDestinatario, setCodigoDestinatario] = useState<number | null>(null);
  const [destinatarioLabel, setDestinatarioLabel] = useState('');
  const [destinatarioUf, setDestinatarioUf] = useState('');
  const [destinatarioPais, setDestinatarioPais] = useState<number>(1058);

  // Referências e vínculos
  const [chaveNfRefPrincipal, setChaveNfRefPrincipal] = useState('');
  const [chavesAdicionais, setChavesAdicionais] = useState<string[]>([]);
  const [novaChaveInput, setNovaChaveInput] = useState('');
  const [numNotaOrigem, setNumNotaOrigem] = useState('');
  const [serNotaOrigem, setSerNotaOrigem] = useState('');
  const [buscaNumNfRef, setBuscaNumNfRef] = useState('');
  const [buscaSerNfRef, setBuscaSerNfRef] = useState('');
  const [buscandoChavePorNf, setBuscandoChavePorNf] = useState(false);
  const [numLancAdiantamento, setNumLancAdiantamento] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');

  // Itens
  const [itens, setItens] = useState<NotaAjusteItemInput[]>([]);
  const [itemEditando, setItemEditando] = useState<NotaAjusteItemInput | null>(null);
  const [itemEditIndex, setItemEditIndex] = useState<number | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  // Modais auxiliares
  const [selecaoOpen, setSelecaoOpen] = useState(false);
  const [selecaoModo, setSelecaoModo] = useState<ModoSelecaoOrigem>('nf-original');
  const [rateioOpen, setRateioOpen] = useState(false);

  const [xmlSimuladoModalOpen, setXmlSimuladoModalOpen] = useState(false);
  const [xmlSimuladoData, setXmlSimuladoData] = useState<{
    sucesso: boolean;
    mensagem: string;
    xml: string;
    avisos: string[];
  }>({ sucesso: true, mensagem: '', xml: '', avisos: [] });

  // Destinatários (busca sob demanda)
  const [destOpcoes, setDestOpcoes] = useState<DestinatarioOpcao[]>([]);
  const destTimerRef = useRef<number | null>(null);

  // Confirmação ao alterar subtipo fiscal
  const [pendingSubtipoCodigo, setPendingSubtipoCodigo] = useState<string | null>(null);
  const confirmSubtipoDialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelSubtipoBtnRef = useRef<HTMLButtonElement | null>(null);

  const subtipoAtual: NotaAjusteSubtipoInfo | null = useMemo(
    () => combos?.subtipos.find((s) => s.codigo === subtipoCodigo) ?? null,
    [combos, subtipoCodigo],
  );

  const carregarDestinatarios = useCallback(async (termo: string) => {
    try {
      const lista = await buscarDestinatariosAjuste(termo);
      setDestOpcoes(lista);
    } catch {
      setDestOpcoes([]);
    }
  }, []);

  const handleDestinatarioSearch = useCallback(
    (q: string) => {
      if (destTimerRef.current != null) window.clearTimeout(destTimerRef.current);
      destTimerRef.current = window.setTimeout(() => {
        void carregarDestinatarios(q);
      }, 260);
    },
    [carregarDestinatarios],
  );

  const carregarProximoNumero = useCallback(async (ser: string) => {
    if (!ser) return;
    try {
      const res = await obterProximoNumeroNotaAjuste(ser);
      setNumNotaFiscal(res.proximoNumero || '');
    } catch {
      // Mantém vazio caso usuário digite ou série não configurada
    }
  }, []);

  // Inicializa ao abrir
  useEffect(() => {
    if (!open) {
      setPendingSubtipoCodigo(null);
      return;
    }
    setPendingSubtipoCodigo(null);
    setSubmitted(false);
    setNovaChaveInput('');
    void carregarDestinatarios('');

    if (notaEditar) {
      setLoadingDetalhe(true);
      void obterDetalheNotaAjuste(notaEditar.numNotaFiscal, notaEditar.serNotaFiscal)
        .then((det) => {
          setSubtipoCodigo(det.subtipo || 'ND-04');
          setSerie(det.serNotaFiscal || '');
          setNumNotaFiscal(det.numNotaFiscal || '');
          setDataEmissao(toBrDateFromIso(det.dataEmissao) || getTodayBr());
          setDataPrevEntrega(toBrDateFromIso(det.dataPrevEntrega));
          setCodigoCfo(det.codigoCfo || '');
          const tDest = det.tipoDestinatario === 'F' ? 'F' : det.tipoDestinatario === 'E' ? 'E' : 'C';
          const ufDet = (det.ufDestinatario || '').trim().toUpperCase();
          setTipoDestinatario(tDest);
          setCodigoDestinatario(det.codigoDestinatario ?? null);
          setDestinatarioUf(ufDet);
          setDestinatarioPais(1058);
          setDestinatarioLabel(
            det.codigoDestinatario && det.nomeDestinatario
              ? `${det.codigoDestinatario} - ${det.nomeDestinatario}${ufDet ? ` | ${ufDet}` : ''}`
              : det.nomeDestinatario || '',
          );

          const chaves = det.chavesNfRefAdicionais || [];
          setChaveNfRefPrincipal(chaves[0] || '');
          setChavesAdicionais(chaves.slice(1));
          setNumNotaOrigem(det.numNotaOrigem || '');
          setSerNotaOrigem(det.serNotaOrigem || '');
          setBuscaNumNfRef(det.numNotaOrigem || '');
          setBuscaSerNfRef(det.serNotaOrigem || '');
          setNumLancAdiantamento(det.numLancAdiantamento ?? null);
          setObservacao(det.observacao || '');
          setItens(det.itens || []);
        })
        .catch((err: any) => {
          showToast(err?.message || 'Erro ao carregar detalhes da Nota Fiscal de Ajuste.', 'error');
        })
        .finally(() => setLoadingDetalhe(false));
      return;
    }

    // Nova Nota Fiscal de Ajuste
    const defaultSub = combos?.subtipos.find((s) => s.codigo === 'ND-04') ?? combos?.subtipos[0] ?? null;
    const defaultSerie = combos?.series[0]?.serNotaFiscal ?? '';
    const defaultCfop = combos?.cfops.find((c) => c.codigoCfo.startsWith('5'))?.codigoCfo ?? combos?.cfops[0]?.codigoCfo ?? '';

    setSubtipoCodigo(defaultSub?.codigo || 'ND-04');
    setSerie(defaultSerie);
    setNumNotaFiscal('');
    setDataEmissao(getTodayBr());
    setDataPrevEntrega('');
    setCodigoCfo(defaultCfop);
    setTipoDestinatario(defaultSub?.autoEmissao ? 'E' : 'C');
    setCodigoDestinatario(null);
    setDestinatarioLabel('');
    setDestinatarioUf('');
    setDestinatarioPais(1058);
    setChaveNfRefPrincipal('');
    setChavesAdicionais([]);
    setNumNotaOrigem('');
    setSerNotaOrigem('');
    setBuscaNumNfRef('');
    setBuscaSerNfRef('');
    setNumLancAdiantamento(null);
    setObservacao('');
    setItens([]);

    if (defaultSerie) {
      void carregarProximoNumero(defaultSerie);
    }
  }, [open, notaEditar, combos, carregarDestinatarios, carregarProximoNumero, showToast]);

  // Sincroniza <dialog> nativo de confirmação ao trocar subtipo
  useEffect(() => {
    const dlg = confirmSubtipoDialogRef.current;
    if (!dlg) return;
    if (pendingSubtipoCodigo !== null) {
      if (!dlg.open) {
        dlg.showModal();
        window.requestAnimationFrame(() => cancelSubtipoBtnRef.current?.focus());
      }
    } else if (dlg.open) {
      dlg.close();
      dlg.returnValue = '';
    }
  }, [pendingSubtipoCodigo]);

  // Escape para fechar somente se não houver modal filho aberto
  useEffect(() => {
    if (!open || itemModalOpen || selecaoOpen || rateioOpen || xmlSimuladoModalOpen || pendingSubtipoCodigo !== null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, itemModalOpen, selecaoOpen, rateioOpen, xmlSimuladoModalOpen, pendingSubtipoCodigo, onClose]);

  const handleSubtipoChange = (novoCodigo: string) => {
    if (somenteLeitura || !novoCodigo || novoCodigo === subtipoCodigo) return;
    setPendingSubtipoCodigo(novoCodigo);
  };

  const handleCancelarAlteracaoSubtipo = () => {
    const dlg = confirmSubtipoDialogRef.current;
    if (dlg?.open) {
      dlg.close();
      dlg.returnValue = '';
    }
    setPendingSubtipoCodigo(null);
  };

  const handleConfirmarAlteracaoSubtipo = () => {
    const novoCodigo = pendingSubtipoCodigo;
    handleCancelarAlteracaoSubtipo();
    if (!novoCodigo) return;

    const novoSub = combos?.subtipos.find((s) => s.codigo === novoCodigo) ?? null;
    const isDevolucao = novoSub?.codigo === 'NC-03' || novoSub?.codigo === 'NC-06';
    const defaultCfop = isDevolucao
      ? combos?.cfops.find((c) => c.codigoCfo.startsWith('1') || c.codigoCfo.startsWith('2'))?.codigoCfo ??
        combos?.cfops[0]?.codigoCfo ??
        ''
      : combos?.cfops.find((c) => c.codigoCfo.startsWith('5'))?.codigoCfo ??
        combos?.cfops[0]?.codigoCfo ??
        '';

    setSubmitted(false);
    setSubtipoCodigo(novoCodigo);

    if (!notaEditar) {
      const defaultSerie = combos?.series[0]?.serNotaFiscal ?? '';
      setSerie(defaultSerie);
      setNumNotaFiscal('');
      if (defaultSerie) {
        void carregarProximoNumero(defaultSerie);
      }
    }

    setDataEmissao(getTodayBr());
    setDataPrevEntrega('');
    setCodigoCfo(defaultCfop);
    setTipoDestinatario(novoSub?.autoEmissao ? 'E' : 'C');
    setCodigoDestinatario(null);
    setDestinatarioLabel(novoSub?.autoEmissao ? 'Empresa Emitente (Autoemissão)' : '');
    setDestinatarioUf('');
    setDestinatarioPais(1058);
    setChaveNfRefPrincipal('');
    setChavesAdicionais([]);
    setNovaChaveInput('');
    setNumNotaOrigem('');
    setSerNotaOrigem('');
    setBuscaNumNfRef('');
    setBuscaSerNfRef('');
    setNumLancAdiantamento(null);
    setObservacao('');
    setItens([]);
  };

  const pendingSubtipoInfo = useMemo(
    () => (pendingSubtipoCodigo ? combos?.subtipos.find((s) => s.codigo === pendingSubtipoCodigo) ?? null : null),
    [combos, pendingSubtipoCodigo],
  );

  const subtipoOptions = useMemo(
    () =>
      (combos?.subtipos || []).map((s) => ({
        value: s.codigo,
        label: `[${s.finalidade === 'D' ? 'DÉBITO' : 'CRÉDITO'}] ${s.codigo} — ${s.titulo}`,
      })),
    [combos],
  );

  const serieOptions = useMemo(
    () =>
      (combos?.series || []).map((s) => ({
        value: s.serNotaFiscal,
        label: `Série ${s.serNotaFiscal} (${s.tipoNota === 2 ? 'Homologação' : 'Produção'})`,
      })),
    [combos],
  );

  const serieSelecionada = useMemo(
    () => combos?.series.find((s) => s.serNotaFiscal === serie) ?? null,
    [combos, serie],
  );

  const cfopOptions = useMemo(
    () =>
      (combos?.cfops || []).map((c) => ({
        value: c.codigoCfo,
        label: `${c.codigoCfo} — ${c.descricaoCfo} [${c.codigoCfo.startsWith('1') || c.codigoCfo.startsWith('2') || c.codigoCfo.startsWith('3') ? 'Entrada' : 'Saída'}]`,
      })),
    [combos],
  );

  const destinatarioOptions = useMemo(() => {
    const opts = destOpcoes.map((d) => ({ value: d.value, label: d.label }));
    if (codigoDestinatario && tipoDestinatario !== 'E') {
      const val = `${tipoDestinatario}-${codigoDestinatario}`;
      if (!opts.some((o) => o.value === val)) {
        opts.unshift({ value: val, label: destinatarioLabel || `${codigoDestinatario} (${tipoDestinatario})` });
      }
    }
    return opts;
  }, [destOpcoes, codigoDestinatario, tipoDestinatario, destinatarioLabel]);

  const digitoCfopEsperado = useMemo(
    () =>
      calcularDigitoCfopEsperado({
        finalidade: subtipoAtual?.finalidade,
        autoEmissao: subtipoAtual?.autoEmissao,
        ufEmpresa: combos?.ufEmpresa,
        ufDestinatario: destinatarioUf,
        codigoPais: destinatarioPais,
      }),
    [subtipoAtual, combos?.ufEmpresa, destinatarioUf, destinatarioPais],
  );

  const cfopCabecalhoIncompativel = useMemo(() => {
    const digits = (codigoCfo || '').replace(/\D+/g, '');
    return Boolean(digitoCfopEsperado && digits && !digits.startsWith(digitoCfopEsperado));
  }, [codigoCfo, digitoCfopEsperado]);

  const sincronizarCfopPorDestino = useCallback(
    (novoUf: string, novoPais = 1058, atualizarCabecalho = true): string => {
      const cfops = combos?.cfops || [];
      const digito = calcularDigitoCfopEsperado({
        finalidade: subtipoAtual?.finalidade,
        autoEmissao: subtipoAtual?.autoEmissao,
        ufEmpresa: combos?.ufEmpresa,
        ufDestinatario: novoUf,
        codigoPais: novoPais,
      });
      if (!digito || cfops.length === 0) return codigoCfo;

      const cfoAtualDigits = (codigoCfo || '').replace(/\D+/g, '');
      const proximoCfo = atualizarCabecalho
        ? adaptarCfopParaDigito(codigoCfo, digito, cfops)
        : codigoCfo;

      if (atualizarCabecalho && cfoAtualDigits && !cfoAtualDigits.startsWith(digito) && proximoCfo !== codigoCfo) {
        setCodigoCfo(proximoCfo);
      }

      let alterouItens = false;
      setItens((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map((it) => {
          const itDigits = (it.cfop || '').replace(/\D+/g, '');
          if (itDigits && !itDigits.startsWith(digito)) {
            const novoItemCfo = adaptarCfopParaDigito(it.cfop || proximoCfo, digito, cfops);
            if (novoItemCfo !== it.cfop) {
              alterouItens = true;
              return { ...it, cfop: novoItemCfo };
            }
          }
          return it;
        });
        return alterouItens ? next : prev;
      });

      if ((atualizarCabecalho && cfoAtualDigits && !cfoAtualDigits.startsWith(digito)) || alterouItens) {
        const ufEmit = (combos?.ufEmpresa || '').trim().toUpperCase();
        const opDesc =
          digito === '3' || digito === '7'
            ? 'operação com o exterior'
            : digito === '2' || digito === '6'
              ? `operação interestadual (${ufEmit} → ${novoUf})`
              : `operação interna (${ufEmit} → ${novoUf})`;
        showToast(`CFOP ajustado para série ${digito}xxx (${opDesc}).`, 'info');
      }
      return proximoCfo;
    },
    [combos, subtipoAtual, codigoCfo, showToast],
  );

  const construirItensImportadosNfOrigem = useCallback(
    (
      nf: NotaOriginalResumo,
      rawItens: NotaAjusteItemInput[],
      chaveOrig: string,
      ufEfetiva: string,
      paisEfetivo: number,
    ): NotaAjusteItemInput[] => {
      const cfops = combos?.cfops || [];
      const digito = calcularDigitoCfopEsperado({
        finalidade: subtipoAtual?.finalidade,
        autoEmissao: subtipoAtual?.autoEmissao,
        ufEmpresa: combos?.ufEmpresa,
        ufDestinatario: ufEfetiva,
        codigoPais: paisEfetivo,
      });

      let cfoCabecalhoResolvido = codigoCfo;
      if (nf.codigoCfo) {
        cfoCabecalhoResolvido = adaptarCfopParaDigito(nf.codigoCfo, digito, cfops);
      } else if (codigoCfo) {
        cfoCabecalhoResolvido = adaptarCfopParaDigito(codigoCfo, digito, cfops);
      }

      if (cfoCabecalhoResolvido && cfoCabecalhoResolvido !== codigoCfo) {
        setCodigoCfo(cfoCabecalhoResolvido);
      }

      return rawItens.map((it, idx) => {
        const baseCfop = it.cfop || cfoCabecalhoResolvido || codigoCfo;
        const cfopItem = adaptarCfopParaDigito(baseCfop, digito, cfops);
        const adaptado: NotaAjusteItemInput = {
          ...it,
          numItem: idx + 1,
          cfop: cfopItem,
          chaveDfeRef: chaveOrig || it.chaveDfeRef || '',
          numItemRefAjuste: subtipoAtual?.permiteNItemDFeRef === false ? null : (it.numItemRefAjuste ?? it.numItem),
          cstIbsCbs: subtipoAtual?.modoTributacao === 'gIBSCBS' && it.cstIbsCbs ? it.cstIbsCbs : (subtipoAtual?.cstPadrao || it.cstIbsCbs),
          classTribIbsCbs:
            subtipoAtual?.modoTributacao === 'gIBSCBS' && it.classTribIbsCbs
              ? it.classTribIbsCbs
              : (subtipoAtual?.classTribPadrao || it.classTribIbsCbs),
        };
        return recalcularTributosItem(adaptado, subtipoAtual, true);
      });
    },
    [combos, subtipoAtual, codigoCfo],
  );

  // Totais calculados
  const totais = useMemo(() => {
    let totalItens = 0;
    let totalIbs = 0;
    let totalCbs = 0;
    let totalEstorno = 0;
    let totalZfm = 0;

    for (const it of itens) {
      totalItens += Number(it.valorTotalItem || 0);
      totalIbs += Number(it.valorIbsUf || 0) + Number(it.valorIbsMun || 0);
      totalCbs += Number(it.valorCbs || 0);
      totalEstorno += Number(it.valorIbsEstCred || 0) + Number(it.valorCbsEstCred || 0);
      totalZfm += Number(it.valorCredPresIbsZfm || 0);
    }

    return {
      totalItens: round2(totalItens),
      totalNota: subtipoAtual?.compoeTotal === false ? 0 : round2(totalItens),
      totalIbs: round2(totalIbs),
      totalCbs: round2(totalCbs),
      totalEstorno: round2(totalEstorno),
      totalZfm: round2(totalZfm),
    };
  }, [itens, subtipoAtual]);

  const handleImportarNotaOriginal = async (nf: NotaOriginalResumo) => {
    setSelecaoOpen(false);
    try {
      const importados = await obterItensNotaReferenciaAjuste(nf.numNotaFiscal, nf.serNotaFiscal);
      const chaveOrig = nf.chaveAcessoNfe || '';

      setNumNotaOrigem(nf.numNotaFiscal);
      setSerNotaOrigem(nf.serNotaFiscal);
      if (chaveOrig) {
        if (!chaveNfRefPrincipal) {
          setChaveNfRefPrincipal(chaveOrig);
        } else if (chaveNfRefPrincipal !== chaveOrig && !chavesAdicionais.includes(chaveOrig)) {
          setChavesAdicionais((prev) => [...prev, chaveOrig]);
        }
      }

      let ufEfetiva = destinatarioUf;
      let paisEfetivo = destinatarioPais;
      if (!subtipoAtual?.autoEmissao && nf.codigoDestinatario && nf.tipoDestinatario !== 'E') {
        const t = nf.tipoDestinatario === 'F' ? 'F' : 'C';
        const matched = destOpcoes.find((d) => d.tipo === t && d.codigo === nf.codigoDestinatario);
        ufEfetiva = (nf.ufDestinatario || matched?.uf || '').trim().toUpperCase();
        paisEfetivo = matched?.codigoPais ?? 1058;
        setTipoDestinatario(t);
        setCodigoDestinatario(nf.codigoDestinatario);
        setDestinatarioUf(ufEfetiva);
        setDestinatarioPais(paisEfetivo);
        setDestinatarioLabel(`${nf.codigoDestinatario} - ${nf.nomeDestinatario}${ufEfetiva ? ` | ${ufEfetiva}` : ''}`);
      }

      const mapeados = construirItensImportadosNfOrigem(nf, importados, chaveOrig, ufEfetiva, paisEfetivo);

      setItens(mapeados);
      showToast(
        `${mapeados.length} item(ns) importado(s) da NF ${nf.numNotaFiscal}/${nf.serNotaFiscal}.`,
        'success',
      );
    } catch (err: any) {
      showToast(err?.message || 'Erro ao importar itens da NF selecionada.', 'error');
    }
  };

  const handleBuscarChavePorNumero = async (importarItensForcado = false) => {
    const num = buscaNumNfRef.trim();
    if (!num) {
      showToast('Informe o Número da NF de origem para buscar a chave.', 'info');
      return;
    }

    setBuscandoChavePorNf(true);
    try {
      const res = await buscarNotaReferenciaPorNumero(num, buscaSerNfRef.trim() || undefined);
      const nf = res.nota;
      const chave = (nf.chaveAcessoNfe || '').replace(/\D+/g, '');

      setNumNotaOrigem(nf.numNotaFiscal);
      setSerNotaOrigem(nf.serNotaFiscal);
      setBuscaNumNfRef(nf.numNotaFiscal);
      setBuscaSerNfRef(nf.serNotaFiscal);

      if (chave) {
        if (!chaveNfRefPrincipal) {
          setChaveNfRefPrincipal(chave);
        } else if (chaveNfRefPrincipal !== chave && !chavesAdicionais.includes(chave)) {
          setChavesAdicionais((prev) => [...prev, chave]);
        }
      }

      let ufEfetiva = destinatarioUf;
      let paisEfetivo = destinatarioPais;
      if (!subtipoAtual?.autoEmissao && !codigoDestinatario && nf.codigoDestinatario && nf.tipoDestinatario !== 'E') {
        const t = nf.tipoDestinatario === 'F' ? 'F' : 'C';
        const matched = destOpcoes.find((d) => d.tipo === t && d.codigo === nf.codigoDestinatario);
        ufEfetiva = (nf.ufDestinatario || matched?.uf || '').trim().toUpperCase();
        paisEfetivo = matched?.codigoPais ?? 1058;
        setTipoDestinatario(t);
        setCodigoDestinatario(nf.codigoDestinatario);
        setDestinatarioUf(ufEfetiva);
        setDestinatarioPais(paisEfetivo);
        setDestinatarioLabel(`${nf.codigoDestinatario} - ${nf.nomeDestinatario}${ufEfetiva ? ` | ${ufEfetiva}` : ''}`);
      }

      if ((importarItensForcado || itens.length === 0) && res.itens.length > 0) {
        const mapeados = construirItensImportadosNfOrigem(nf, res.itens, chave, ufEfetiva, paisEfetivo);
        setItens(mapeados);
        showToast(
          `NF ${nf.numNotaFiscal}/${nf.serNotaFiscal} localizada: ${chave ? 'chave vinculada e ' : ''}${mapeados.length} item(ns) importado(s).`,
          'success',
        );
      } else if (chave) {
        showToast(`Chave da NF ${nf.numNotaFiscal}/${nf.serNotaFiscal} vinculada com sucesso.`, 'success');
      } else {
        showToast(
          `NF ${nf.numNotaFiscal}/${nf.serNotaFiscal} encontrada, mas sem Chave de Acesso (44 dígitos) gravada.`,
          'info',
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'NF-e de referência não encontrada para este número/série.', 'error');
    } finally {
      setBuscandoChavePorNf(false);
    }
  };

  const handleImportarRecebimento = async (rec: RecebimentoResumo) => {
    setSelecaoOpen(false);
    try {
      const importados = await obterItensRecebimentoAjuste(rec.numeroDocto);
      if (rec.chaveAcessoNfe) {
        if (!chaveNfRefPrincipal) {
          setChaveNfRefPrincipal(rec.chaveAcessoNfe);
        } else if (chaveNfRefPrincipal !== rec.chaveAcessoNfe && !chavesAdicionais.includes(rec.chaveAcessoNfe)) {
          setChavesAdicionais((prev) => [...prev, rec.chaveAcessoNfe!]);
        }
      }

      const mapeados = importados.map((it, idx) => {
        const ehEstorno = subtipoAtual?.modoTributacao === 'gEstornoCred';
        const adaptado: NotaAjusteItemInput = {
          ...it,
          numItem: idx + 1,
          cfop: codigoCfo || it.cfop,
          cstIbsCbs: subtipoAtual?.cstPadrao || it.cstIbsCbs || '410',
          classTribIbsCbs: subtipoAtual?.classTribPadrao || it.classTribIbsCbs || '410030',
          valorIbsEstCred: ehEstorno
            ? round2((it.valorIbsEstCred ?? 0) > 0 ? Number(it.valorIbsEstCred) : Number(it.valorIbsUf || 0) + Number(it.valorIbsMun || 0))
            : it.valorIbsEstCred,
          valorCbsEstCred: ehEstorno
            ? round2((it.valorCbsEstCred ?? 0) > 0 ? Number(it.valorCbsEstCred) : Number(it.valorCbs || 0))
            : it.valorCbsEstCred,
        };
        return recalcularTributosItem(adaptado, subtipoAtual, true);
      });

      setItens(mapeados);
      if (!observacao.trim()) {
        setObservacao(`Estorno de crédito ref. recebimento docto ${rec.numeroDocto}/${rec.serie}.`);
      }
      showToast(`${mapeados.length} item(ns) importado(s) do recebimento ${rec.numeroDocto}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao importar itens do recebimento.', 'error');
    }
  };

  const handleVincularAdiantamento = (ad: AdiantamentoDisponivel) => {
    setSelecaoOpen(false);
    setNumLancAdiantamento(ad.numLanc);
    let cfoParaNovoItem = codigoCfo;
    if (!subtipoAtual?.autoEmissao) {
      const tDest = ad.tipoCedente === 'F' ? 'F' : 'C';
      const matched = destOpcoes.find((d) => d.tipo === tDest && d.codigo === ad.codigoCedente);
      const ufCed = (matched?.uf || '').trim().toUpperCase();
      const paisCed = matched?.codigoPais ?? 1058;
      setTipoDestinatario(tDest);
      setCodigoDestinatario(ad.codigoCedente);
      setDestinatarioUf(ufCed);
      setDestinatarioPais(paisCed);
      setDestinatarioLabel(`${ad.codigoCedente} - ${ad.nomeCedente}${ufCed ? ` | ${ufCed}` : ''}`);
      if (ufCed) {
        cfoParaNovoItem = sincronizarCfopPorDestino(ufCed, paisCed);
      }
    }
    if (!observacao.trim()) {
      setObservacao(`Débito ref. adiantamento lançamento nº ${ad.numLanc} (Docto ${ad.numDocumento}).`);
    }

    if (itens.length === 0) {
      const novo = recalcularTributosItem(
        {
          ...createEmptyItem(1, subtipoAtual, cfoParaNovoItem),
          descricaoMaterial: `Adiantamento Ref. Lançamento ${ad.numLanc} - Docto ${ad.numDocumento}`,
          valorUnitario: round2(ad.valorSaldo),
          valorTotalItem: round2(ad.valorSaldo),
          valorBaseIbsCbs: round2(ad.valorSaldo),
        },
        subtipoAtual,
        true,
      );
      setItens([novo]);
    }
    showToast(`Adiantamento #${ad.numLanc} vinculado.`, 'success');
  };

  const buildRequestPayload = (transmitirSefaz: boolean): NotaAjusteEmitirRequest => ({
    codigoEmpresa: GlobalConfig.getCodEmpresa() ?? 1,
    numNotaFiscal: notaEditar ? notaEditar.numNotaFiscal : (numNotaFiscal.trim() || null),
    serNotaFiscal: serie.trim(),
    subtipo: subtipoCodigo,
    codigoCfo: codigoCfo.trim(),
    tipoDestinatario: subtipoAtual?.autoEmissao ? 'E' : tipoDestinatario,
    codigoDestinatario: subtipoAtual?.autoEmissao ? null : codigoDestinatario,
    dataEmissao: toIsoDateFromBr(dataEmissao) || null,
    dataPrevEntrega: subtipoAtual?.permiteDataPrevEntrega ? (toIsoDateFromBr(dataPrevEntrega) || null) : null,
    chaveNfRefPrincipal: chaveNfRefPrincipal.trim() || null,
    chavesNfRefAdicionais: chavesAdicionais,
    numNotaOrigem: numNotaOrigem.trim() || null,
    serNotaOrigem: serNotaOrigem.trim() || null,
    numLancAdiantamento,
    observacao: observacao.trim() || null,
    codigoUsuario: GlobalConfig.getUsuario() || 'QSERPX',
    tipoAmbiente: serieSelecionada?.tipoNota ?? 2,
    versaoSistema: APP_VERSION,
    transmitirSefaz,
    itens: itens.map((it, idx) => ({ ...it, numItem: idx + 1 })),
  });

  const validarFormulario = (validacaoCompleta = true): boolean => {
    setSubmitted(validacaoCompleta);
    if (!serie.trim()) {
      showToast('Selecione a série da Nota Fiscal.', 'info');
      return false;
    }
    if (!validacaoCompleta) {
      return true;
    }
    if (!codigoCfo.trim()) {
      showToast('Selecione o CFOP da operação.', 'info');
      return false;
    }
    if (!subtipoAtual?.autoEmissao && (!codigoDestinatario || codigoDestinatario <= 0)) {
      showToast('Selecione o destinatário (Cliente ou Fornecedor).', 'info');
      return false;
    }
    if (subtipoAtual?.permiteDataPrevEntrega && !toIsoDateFromBr(dataPrevEntrega)) {
      showToast('Para ND-06 (Pagamento Antecipado), informe a Data Prevista de Entrega (dPrevEntrega).', 'info');
      return false;
    }
    if (itens.length === 0) {
      showToast('Adicione ou importe ao menos 1 item antes de continuar.', 'info');
      return false;
    }
    if (digitoCfopEsperado) {
      const cfoCabDigits = codigoCfo.replace(/\D+/g, '');
      if (cfoCabDigits && !cfoCabDigits.startsWith(digitoCfopEsperado)) {
        const opTipo =
          digitoCfopEsperado === '1' || digitoCfopEsperado === '5'
            ? 'operação interna'
            : digitoCfopEsperado === '3' || digitoCfopEsperado === '7'
              ? 'operação com o exterior'
              : 'operação interestadual';
        showToast(
          `CFOP '${codigoCfo}' incompatível com ${opTipo} (${combos?.ufEmpresa || 'Emit'} → ${destinatarioUf || 'EX'}). Utilize CFOP iniciado em '${digitoCfopEsperado}'.`,
          'error',
        );
        return false;
      }
      const itemInvalido = itens.find((it) => {
        const d = (it.cfop || '').replace(/\D+/g, '');
        return Boolean(d && !d.startsWith(digitoCfopEsperado));
      });
      if (itemInvalido) {
        showToast(
          `CFOP '${itemInvalido.cfop}' do item #${itemInvalido.numItem} deve iniciar em '${digitoCfopEsperado}' para a UF do destinatário (${destinatarioUf || 'EX'}).`,
          'error',
        );
        return false;
      }
    }
    return true;
  };

  const handleSimularXml = async () => {
    if (!validarFormulario(true)) return;
    setSubmitting('simular');
    try {
      const res = await simularXmlNotaAjuste(buildRequestPayload(false));
      setXmlSimuladoData({
        sucesso: res.sucesso,
        mensagem: res.mensagem,
        xml: res.xml,
        avisos: res.avisos || [],
      });
      setXmlSimuladoModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao simular XML.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handlePersistir = async (transmitirSefaz: boolean) => {
    if (!validarFormulario(transmitirSefaz)) return;
    setSubmitting(transmitirSefaz ? 'sefaz' : 'draft');
    try {
      const res = await emitirNotaAjuste(buildRequestPayload(transmitirSefaz));
      if (res.sucesso) {
        showToast(res.mensagem || 'Nota Fiscal de Ajuste processada com sucesso!', 'success');
        onSuccess();
      } else {
        showToast(res.mensagem || 'SEFAZ rejeitou a emissão. Verifique os avisos e ocorrências.', 'error');
        onSuccess();
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gravar/emitir Nota Fiscal de Ajuste.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handleAddChaveAdicional = () => {
    const clean = novaChaveInput.replace(/\D+/g, '');
    if (clean.length !== 44) {
      showToast('A chave de acesso deve conter exatamente 44 dígitos numéricos.', 'info');
      return;
    }
    if (clean === chaveNfRefPrincipal || chavesAdicionais.includes(clean)) {
      showToast('Esta chave já está vinculada.', 'info');
      return;
    }
    if (!chaveNfRefPrincipal) {
      setChaveNfRefPrincipal(clean);
    } else {
      setChavesAdicionais((prev) => [...prev, clean]);
    }
    setNovaChaveInput('');
  };

  if (!open) return null;

  const isMultaJuros = subtipoCodigo === 'ND-04' || subtipoCodigo === 'NC-01';

  return (
    <section
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfa-emitir-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <article className="modal-card nfa-modal nfa-modal--xxl">
        <header className="modal-card__header">
          <div className="nfa-modal-title-group">
            <h2 id="nfa-emitir-modal-title">
              {somenteLeitura
                ? `Visualizar NF de Ajuste ${notaEditar?.numNotaFiscal}/${notaEditar?.serNotaFiscal}`
                : notaEditar
                  ? `Editar NF de Ajuste ${notaEditar.numNotaFiscal}/${notaEditar.serNotaFiscal}`
                  : 'Nova Nota Fiscal de Ajuste (IBS/CBS — NT 2025.002-RTC)'}
            </h2>
            {serieSelecionada && (
              <span className={`nfa-badge ${serieSelecionada.tipoNota === 2 ? 'nfa-badge--warning' : 'nfa-badge--success'}`}>
                {serieSelecionada.tipoNota === 2 ? 'HOMOLOGAÇÃO (tpAmb=2)' : 'PRODUÇÃO (tpAmb=1)'}
              </span>
            )}
          </div>

          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={Boolean(submitting)}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <div className="nfa-modal__body">
          {loadingDetalhe ? (
            <p className="module-empty">Carregando dados da Nota Fiscal de Ajuste...</p>
          ) : (
            <>
              {/* Seleção do Subtipo & Regras Fiscais */}
              <div className="nfa-grid nfa-grid--3">
                <label className="nfa-field nfa-field--span2">
                  <span>Subtipo Fiscal (tpNFDebito / tpNFCredito) *</span>
                  <SearchableSelect
                    options={subtipoOptions}
                    value={subtipoCodigo}
                    onChange={handleSubtipoChange}
                    disabled={somenteLeitura}
                    placeholder="Selecione o subtipo..."
                  />
                </label>

                <div className="nfa-metric-box">
                  <span>Finalidade XML (finNFe)</span>
                  <strong>
                    {subtipoAtual?.finalidade === 'C'
                      ? `5 — Nota de Crédito (tpNFCredito=${subtipoAtual.tpDebCred})`
                      : `6 — Nota de Débito (tpNFDebito=${subtipoAtual?.tpDebCred || '04'})`}
                  </strong>
                </div>
              </div>

              {subtipoAtual && (
                <div className="nfa-rule-strip">
                  <div className="nfa-rule-strip__desc">
                    <IoInformationCircleOutline size={18} />
                    <span>{subtipoAtual.descricaoFiscal}</span>
                  </div>
                  <div className="nfa-rule-strip__tags">
                    <span className="nfa-tag">Modo: {subtipoAtual.modoTributacao}</span>
                    <span className="nfa-tag">CST Padrão: {subtipoAtual.cstPadrao}/{subtipoAtual.classTribPadrao}</span>
                    <span className="nfa-tag">{subtipoAtual.autoEmissao ? 'Autoemissão (Emit=Dest)' : 'Terceiro'}</span>
                    <span className="nfa-tag">{subtipoAtual.compoeTotal ? 'Compõe vNF' : 'Escritural (vNF=0)'}</span>
                    {subtipoAtual.exigeRefCabecalho && <span className="nfa-tag nfa-tag--accent">Exige &lt;NFref&gt;</span>}
                    {subtipoAtual.exigeDFeRefItem && (
                      <span className="nfa-tag nfa-tag--accent">
                        Exige &lt;DFeReferenciado&gt; {subtipoAtual.permiteNItemDFeRef ? 'c/ nItem' : 'sem nItem'}
                      </span>
                    )}
                    {subtipoAtual.permiteDataPrevEntrega && <span className="nfa-tag nfa-tag--accent">Exige &lt;dPrevEntrega&gt;</span>}
                  </div>
                </div>
              )}

              {/* Dados Principais */}
              <div className="nfa-grid nfa-grid--6">
                <label className="nfa-field nfa-field--span2">
                  <span>Série NF *</span>
                  <SearchableSelect
                    options={serieOptions}
                    value={serie}
                    onChange={(val) => {
                      setSerie(val);
                      if (!notaEditar) void carregarProximoNumero(val);
                    }}
                    disabled={somenteLeitura || Boolean(notaEditar)}
                    placeholder="Selecione série..."
                  />
                </label>

                <label className="nfa-field">
                  <span>Número NF</span>
                  <input
                    className="nfa-mono"
                    value={numNotaFiscal}
                    onChange={(e) => setNumNotaFiscal(e.target.value)}
                    disabled={somenteLeitura || Boolean(notaEditar)}
                    placeholder="Automático"
                  />
                </label>

                <label className="nfa-field">
                  <span>Data Emissão</span>
                  <CustomDatePicker value={dataEmissao} onChange={setDataEmissao} disabled={somenteLeitura} />
                </label>

                {subtipoAtual?.permiteDataPrevEntrega ? (
                  <label className="nfa-field" title="Data Prevista de Entrega (dPrevEntrega)">
                    <span>Prev. Entrega *</span>
                    <CustomDatePicker
                      value={dataPrevEntrega}
                      onChange={setDataPrevEntrega}
                      disabled={somenteLeitura}
                    />
                  </label>
                ) : (
                  <div className="nfa-field">
                    <span>Vínculo Origem</span>
                    <input
                      readOnly
                      value={
                        numNotaOrigem
                          ? `NF ${numNotaOrigem}/${serNotaOrigem}`
                          : numLancAdiantamento
                            ? `Adiant. #${numLancAdiantamento}`
                            : '-'
                      }
                    />
                  </div>
                )}

                <label className="nfa-field">
                  <span>CFOP *</span>
                  <SearchableSelect
                    options={cfopOptions}
                    value={codigoCfo}
                    onChange={setCodigoCfo}
                    disabled={somenteLeitura}
                    placeholder="CFOP..."
                  />
                  {cfopCabecalhoIncompativel && (
                    <small className="nfa-error-text">
                      UF {combos?.ufEmpresa} → {destinatarioUf || 'EX'}: use CFOP {digitoCfopEsperado}xxx.
                    </small>
                  )}
                </label>
              </div>

              {/* Destinatário */}
              <div className="nfa-grid nfa-grid--2">
                {subtipoAtual?.autoEmissao ? (
                  <div className="nfa-field nfa-field--span2">
                    <span>Destinatário (&lt;dest&gt;)</span>
                    <div className="nfa-banner nfa-banner--info">
                      <IoInformationCircleOutline size={16} />
                      <span>
                        <strong>Autoemissão ativa:</strong> o destinatário no XML será preenchido automaticamente com o
                        CNPJ e endereço da empresa emitente selecionada.
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="nfa-field nfa-field--span2">
                    <span>Destinatário (Cliente / Fornecedor) *</span>
                    <SearchableSelect
                      options={destinatarioOptions}
                      value={codigoDestinatario ? `${tipoDestinatario}-${codigoDestinatario}` : ''}
                      displayValue={destinatarioLabel || undefined}
                      onChange={(val) => {
                        const found = destOpcoes.find((d) => d.value === val);
                        if (found) {
                          const ufFound = (found.uf || '').trim().toUpperCase();
                          const paisFound = found.codigoPais ?? 1058;
                          setTipoDestinatario(found.tipo);
                          setCodigoDestinatario(found.codigo);
                          setDestinatarioLabel(found.label);
                          setDestinatarioUf(ufFound);
                          setDestinatarioPais(paisFound);
                          sincronizarCfopPorDestino(ufFound, paisFound);
                        }
                      }}
                      onSearchInputChange={handleDestinatarioSearch}
                      disabled={somenteLeitura}
                      placeholder="Pesquisar cliente ou fornecedor por nome, código ou CNPJ..."
                    />
                    {submitted && !codigoDestinatario && (
                      <small className="nfa-error-text">Selecione um destinatário válido.</small>
                    )}
                  </label>
                )}
              </div>

              {/* Referências NFref no cabeçalho */}
              <fieldset className="nfa-fieldset">
                <legend>Notas Fiscais Referenciadas (&lt;NFref&gt; no &lt;ide&gt;)</legend>
                {!somenteLeitura && (
                  <div className="nfa-ref-lookup">
                    <label className="nfa-field nfa-ref-lookup__num">
                      <span>Buscar por Nº da NF</span>
                      <input
                        className="nfa-mono"
                        value={buscaNumNfRef}
                        maxLength={9}
                        onChange={(e) => setBuscaNumNfRef(e.target.value.replace(/\D+/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleBuscarChavePorNumero(false);
                          }
                        }}
                        placeholder="Ex: 1234"
                      />
                    </label>
                    <label className="nfa-field nfa-ref-lookup__ser">
                      <span>Série</span>
                      <input
                        className="nfa-mono"
                        value={buscaSerNfRef}
                        maxLength={3}
                        onChange={(e) => setBuscaSerNfRef(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleBuscarChavePorNumero(false);
                          }
                        }}
                        placeholder="Ex: 1"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button nfa-btn-inline"
                      disabled={buscandoChavePorNf}
                      onClick={() => void handleBuscarChavePorNumero(false)}
                    >
                      <IoSearchOutline size={15} />
                      <span>{buscandoChavePorNf ? 'Buscando...' : 'Buscar Chave'}</span>
                    </button>
                  </div>
                )}

                <div className="nfa-grid nfa-grid--3">
                  <label className="nfa-field nfa-field--span2">
                    <span>Chave NF-e Principal Referenciada (44 dígitos)</span>
                    <input
                      className="nfa-mono"
                      value={chaveNfRefPrincipal}
                      maxLength={44}
                      disabled={somenteLeitura}
                      onChange={(e) => setChaveNfRefPrincipal(e.target.value.replace(/\D+/g, ''))}
                      placeholder="44 dígitos da NF-e original (ou busque pelo número acima)..."
                    />
                  </label>

                  {!somenteLeitura && (
                    <div className="nfa-field">
                      <span>Chave Adicional (múltiplas NFref)</span>
                      <div className="nfa-inline-group">
                        <input
                          className="nfa-mono"
                          value={novaChaveInput}
                          maxLength={44}
                          onChange={(e) => setNovaChaveInput(e.target.value.replace(/\D+/g, ''))}
                          placeholder="44 dígitos..."
                        />
                        <button type="button" className="secondary-button nfa-btn-inline" onClick={handleAddChaveAdicional}>
                          + Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {chavesAdicionais.length > 0 && (
                  <div className="nfa-chips">
                    {chavesAdicionais.map((ch) => (
                      <span key={ch} className="nfa-chip nfa-mono">
                        {ch}
                        {!somenteLeitura && (
                          <button
                            type="button"
                            aria-label="Remover chave"
                            onClick={() => setChavesAdicionais((prev) => prev.filter((x) => x !== ch))}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </fieldset>

              {/* Barra de Importação e Ferramentas */}
              {!somenteLeitura && (
                <div className="nfa-toolbar">
                  <button
                    type="button"
                    className="secondary-button nfa-btn-sm"
                    onClick={() => {
                      setSelecaoModo('nf-original');
                      setSelecaoOpen(true);
                    }}
                  >
                    <IoDocumentTextOutline size={16} />
                    <span>Importar NF Original</span>
                  </button>

                  {subtipoCodigo === 'ND-07' && (
                    <button
                      type="button"
                      className="secondary-button nfa-btn-sm nfa-btn-accent"
                      onClick={() => {
                        setSelecaoModo('recebimento');
                        setSelecaoOpen(true);
                      }}
                    >
                      <IoDocumentTextOutline size={16} />
                      <span>Importar Recebimento (Perda/Estoque)</span>
                    </button>
                  )}

                  {subtipoCodigo === 'ND-06' && (
                    <button
                      type="button"
                      className="secondary-button nfa-btn-sm nfa-btn-accent"
                      onClick={() => {
                        setSelecaoModo('adiantamento');
                        setSelecaoOpen(true);
                      }}
                    >
                      <IoDocumentTextOutline size={16} />
                      <span>Vincular Adiantamento (CR)</span>
                    </button>
                  )}

                  {isMultaJuros && (
                    <button
                      type="button"
                      className="secondary-button nfa-btn-sm nfa-btn-accent"
                      disabled={itens.length === 0}
                      onClick={() => setRateioOpen(true)}
                    >
                      <IoCalculatorOutline size={16} />
                      <span>Ratear Multa / Juros nos Itens</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="primary-button nfa-btn-sm nfa-toolbar__right"
                    onClick={() => {
                      const prox = itens.length + 1;
                      setItemEditando(createEmptyItem(prox, subtipoAtual, codigoCfo));
                      setItemEditIndex(null);
                      setItemModalOpen(true);
                    }}
                  >
                    <IoAddOutline size={16} />
                    <span>Adicionar Item</span>
                  </button>
                </div>
              )}

              {/* Tabela de Itens */}
              <div className="table-scroll nfa-table-wrap nfa-table-wrap--items">
                {itens.length === 0 ? (
                  <p className="module-empty">
                    Nenhum item informado. Use "Importar NF Original" ou "Adicionar Item".
                  </p>
                ) : (
                  <table className="nfa-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item / Descrição</th>
                        <th>CFOP / NCM</th>
                        <th>CST / cClass</th>
                        <th className="nfa-num">Qtd × Unit.</th>
                        <th className="nfa-num">Vlr Item</th>
                        <th className="nfa-num">IBS</th>
                        <th className="nfa-num">CBS</th>
                        <th>Ref Item</th>
                        {!somenteLeitura && <th>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, idx) => (
                        <tr key={`${it.numItem}-${idx}`}>
                          <td className="nfa-mono">{idx + 1}</td>
                          <td>
                            <strong>{it.codigoMaterial}</strong>
                            <div className="nfa-subtext">{it.descricaoMaterial || '-'}</div>
                          </td>
                          <td className="nfa-mono">
                            {it.cfop} / {it.ncm || '00'}
                          </td>
                          <td className="nfa-mono">
                            {it.cstIbsCbs}/{it.classTribIbsCbs}
                          </td>
                          <td className="nfa-num">
                            {formatDecimalBr(it.quantidade, 2)} × {formatDecimalBr(it.valorUnitario, 2)}
                          </td>
                          <td className="nfa-num">{formatCurrencyBr(it.valorTotalItem)}</td>
                          <td className="nfa-num">
                            {subtipoAtual?.modoTributacao === 'gEstornoCred'
                              ? formatCurrencyBr(it.valorIbsEstCred)
                              : subtipoAtual?.modoTributacao === 'gCredPresIBSZFM'
                                ? formatCurrencyBr(it.valorCredPresIbsZfm)
                                : formatCurrencyBr(Number(it.valorIbsUf || 0) + Number(it.valorIbsMun || 0))}
                          </td>
                          <td className="nfa-num">
                            {subtipoAtual?.modoTributacao === 'gEstornoCred'
                              ? formatCurrencyBr(it.valorCbsEstCred)
                              : formatCurrencyBr(it.valorCbs)}
                          </td>
                          <td className="nfa-mono">
                            {it.chaveDfeRef
                              ? `${it.chaveDfeRef.slice(-6)}${it.numItemRefAjuste ? ` #${it.numItemRefAjuste}` : ''}`
                              : '-'}
                          </td>
                          {!somenteLeitura && (
                            <td className="nfa-actions-cell">
                              <div className="table-actions">
                                <button
                                  type="button"
                                  title="Editar item"
                                  aria-label="Editar item"
                                  onClick={() => {
                                    setItemEditando({ ...it, numItem: idx + 1 });
                                    setItemEditIndex(idx);
                                    setItemModalOpen(true);
                                  }}
                                >
                                  <IoCreateOutline size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  title="Remover item"
                                  aria-label="Remover item"
                                  onClick={() =>
                                    setItens((prev) =>
                                      prev.filter((_, i) => i !== idx).map((x, n) => ({ ...x, numItem: n + 1 })),
                                    )
                                  }
                                >
                                  <IoTrashOutline size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totais & Informações Complementares */}
              <div className="nfa-summary-grid">
                <label className="nfa-field nfa-field--grow">
                  <span>Informações Complementares (infAdic)</span>
                  <textarea
                    rows={2}
                    value={observacao}
                    disabled={somenteLeitura}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Observações fiscais adicionais para constar no XML e DANFE..."
                  />
                </label>

                <div className="nfa-totals-panel">
                  <div>
                    <span>Total Itens</span>
                    <strong>{formatCurrencyBr(totais.totalItens)}</strong>
                  </div>
                  <div>
                    <span>Valor Nota (vNF)</span>
                    <strong>{formatCurrencyBr(totais.totalNota)}</strong>
                  </div>
                  {subtipoAtual?.modoTributacao === 'gEstornoCred' ? (
                    <div>
                      <span>Estorno IBS/CBS</span>
                      <strong>{formatCurrencyBr(totais.totalEstorno)}</strong>
                    </div>
                  ) : subtipoAtual?.modoTributacao === 'gCredPresIBSZFM' ? (
                    <div>
                      <span>Créd. ZFM</span>
                      <strong>{formatCurrencyBr(totais.totalZfm)}</strong>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span>Total IBS</span>
                        <strong>{formatCurrencyBr(totais.totalIbs)}</strong>
                      </div>
                      <div>
                        <span>Total CBS</span>
                        <strong>{formatCurrencyBr(totais.totalCbs)}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="nfa-modal__footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={Boolean(submitting)}>
            {somenteLeitura ? 'Fechar' : 'Cancelar'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleSimularXml()}
            disabled={loadingDetalhe || Boolean(submitting)}
          >
            <IoCodeSlashOutline size={16} />
            <span>{submitting === 'simular' ? 'Simulando...' : 'Simular & Validar XML'}</span>
          </button>

          {!somenteLeitura && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handlePersistir(false)}
                disabled={loadingDetalhe || Boolean(submitting)}
              >
                <IoSaveOutline size={16} />
                <span>{submitting === 'draft' ? 'Salvando...' : 'Salvar Rascunho'}</span>
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => void handlePersistir(true)}
                disabled={loadingDetalhe || Boolean(submitting)}
              >
                <IoPaperPlaneOutline size={16} />
                <span>{submitting === 'sefaz' ? 'Transmitindo...' : 'Emitir e Transmitir SEFAZ'}</span>
              </button>
            </>
          )}
        </footer>
      </article>

      <NotaAjusteItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        item={itemEditando}
        subtipo={subtipoAtual}
        combos={combos}
        onSave={(saved) => {
          setItens((prev) => {
            if (itemEditIndex != null) {
              return prev.map((it, i) => (i === itemEditIndex ? { ...saved, numItem: i + 1 } : it));
            }
            return [...prev, { ...saved, numItem: prev.length + 1 }];
          });
          setItemModalOpen(false);
        }}
      />

      <NotaAjusteSelecaoModal
        open={selecaoOpen}
        modo={selecaoModo}
        codigoClienteFiltro={tipoDestinatario === 'C' ? codigoDestinatario : null}
        onClose={() => setSelecaoOpen(false)}
        onSelectNotaOriginal={handleImportarNotaOriginal}
        onSelectRecebimento={handleImportarRecebimento}
        onSelectAdiantamento={handleVincularAdiantamento}
      />

      <NotaAjusteRateioModal
        open={rateioOpen}
        onClose={() => setRateioOpen(false)}
        itens={itens}
        combos={combos}
        subtipo={subtipoAtual}
        onAplicar={(novosItens, totalRateado) => {
          setItens(novosItens);
          setRateioOpen(false);
          showToast(
            `Multa/juros de ${formatCurrencyBr(totalRateado)} rateado proporcionalmente em ${novosItens.length} item(ns).`,
            'success',
          );
        }}
      />

      <NotaAjusteXmlModal
        open={xmlSimuladoModalOpen}
        onClose={() => setXmlSimuladoModalOpen(false)}
        title="Prévia e Validação XML — NF-e de Ajuste (NT 2025.002-RTC)"
        xml={xmlSimuladoData.xml}
        sucesso={xmlSimuladoData.sucesso}
        mensagem={xmlSimuladoData.mensagem}
        avisos={xmlSimuladoData.avisos}
        fileName={`Simulacao_${subtipoCodigo}_${numNotaFiscal || 'S-N'}.xml`}
        simulacao={true}
        podeImprimirDanfe={Boolean(xmlSimuladoData.xml?.trim())}
        numNotaFiscal={numNotaFiscal || undefined}
        serNotaFiscal={serie || undefined}
      />

      <dialog
        ref={confirmSubtipoDialogRef}
        className="nfa-confirm-dialog"
        aria-labelledby="nfa-confirm-subtipo-title"
        onCancel={(e) => {
          e.preventDefault();
          handleCancelarAlteracaoSubtipo();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) handleCancelarAlteracaoSubtipo();
        }}
      >
        <article className="modal-card modal-card--confirm">
          <header className="modal-card__header">
            <h2 id="nfa-confirm-subtipo-title">Alterar Subtipo Fiscal</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar"
              onClick={handleCancelarAlteracaoSubtipo}
            >
              <IoCloseOutline size={18} />
            </button>
          </header>

          <div className="modal-card__body modal-card__body--confirm">
            <IoWarningOutline size={36} className="modal-confirm__icon" />
            <p>Ao alterar o tipo de Nota todos os dados digitados serão perdidos, deseja continuar?</p>
            {pendingSubtipoInfo && (
              <p className="nfa-confirm-subtipo-hint">
                Novo subtipo: <strong>{pendingSubtipoInfo.codigo}</strong> — {pendingSubtipoInfo.titulo}
              </p>
            )}
          </div>

          <footer className="nfa-modal__footer">
            <button
              ref={cancelSubtipoBtnRef}
              type="button"
              className="secondary-button"
              onClick={handleCancelarAlteracaoSubtipo}
            >
              Não
            </button>
            <button type="button" className="primary-button" onClick={handleConfirmarAlteracaoSubtipo}>
              Sim
            </button>
          </footer>
        </article>
      </dialog>
    </section>
  );
}
