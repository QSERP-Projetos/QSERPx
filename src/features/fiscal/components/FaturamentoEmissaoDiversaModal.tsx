import { useEffect, useId, useState } from 'react';
import {
  IoAddOutline,
  IoCheckmarkCircleOutline,
  IoDocumentTextOutline,
  IoSaveOutline,
  IoSearchOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { DecimalInput, formatDecimalBr } from '../../../components/DecimalInput';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';
import { FaturamentoTribHelpModal, type TipoHelpTrib } from './FaturamentoTribHelpModal';
import {
  confirmarEmissaoDiversa,
  formatCurrencyBr,
  getNowHm,
  listarNotasReferenciadasDisponiveis,
  listarSaldosDevolucaoRecebimento,
  listarSaldosTerceirosDisponiveis,
  obterProximoNumeroSerie,
  prepararEmissaoDiversa,
  salvarParcelasFinalizar,
  salvarRascunhoDiversa,
  toBrDateFromIso,
  toIsoDateFromBr,
  type ConfirmarEmissaoDiversaRequest,
  type EmissaoDiversaPrepDto,
  type FaturamentoCombosDto,
  type NotaFiscalItemComplemDto,
  type NotaFiscalItemDeDto,
  type NotaFiscalItemDevDto,
  type NotaFiscalItemDiDto,
  type NotaFiscalItemDiversaDto,
  type NotaFiscalReferenciadaDto,
  type NotaFiscalServicoDto,
  type ParcelaDuplicataDto,
  type RecebimentoTerceiroSaldoDto,
  type TerceiroSelecaoInputDto,
} from '../../../services/faturamentoApi';

interface Props {
  open: boolean;
  numSolicitacao: number | null;
  combos: FaturamentoCombosDto | null;
  onClose: () => void;
  onEmitida: (
    numNota: string,
    serNota: string,
    mensagem: string,
    info?: { autorizada?: boolean; sefazOk?: boolean; destino?: number },
  ) => void;
}

const RESP_FRETE_OPTS = [
  { value: '1', label: '0 - Contratação do Frete por conta do Remetente (CIF)' },
  { value: '2', label: '1 - Contratação do Frete por conta do Destinatário (FOB)' },
  { value: '3', label: '2 - Contratação do Frete por conta de Terceiros' },
  { value: '4', label: '3 - Transporte Próprio por conta do Remetente' },
  { value: '5', label: '4 - Transporte Próprio por conta do Destinatário' },
  { value: '9', label: '9 - Sem Ocorrência de Transporte' },
];

const IND_PRES_OPTS = [
  { value: '0', label: '0 - Não se aplica' },
  { value: '1', label: '1 - Operação presencial' },
  { value: '2', label: '2 - Não presencial (Internet)' },
  { value: '3', label: '3 - Teleatendimento' },
  { value: '4', label: '4 - NFC-e entrega domicílio' },
  { value: '9', label: '9 - Não presencial (Outros)' },
];

const VIA_TRANSPORTE_OPTS = [
  { value: '1', label: '1 - Marítima' },
  { value: '2', label: '2 - Fluvial' },
  { value: '3', label: '3 - Lacustre' },
  { value: '4', label: '4 - Aérea' },
  { value: '5', label: '5 - Postal' },
  { value: '6', label: '6 - Ferroviária' },
  { value: '7', label: '7 - Rodoviária' },
  { value: '8', label: '8 - Conduto / Rede Transmissão' },
  { value: '9', label: '9 - Meios Próprios' },
  { value: '10', label: '10 - Entrada / Saída Ficta' },
  { value: '11', label: '11 - Courier' },
  { value: '12', label: '12 - Em Mãos' },
];

const TIPO_INTERMEDIO_OPTS = [
  { value: '1', label: '1 - Importação por conta própria' },
  { value: '2', label: '2 - Importação por conta e ordem' },
  { value: '3', label: '3 - Importação por encomenda' },
];

export function FaturamentoEmissaoDiversaModal({ open, numSolicitacao, combos, onClose, onEmitida }: Props) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, wrapperClass, error } = useRequiredFields();
  const [tribHelp, setTribHelp] = useState<{
    open: boolean;
    tipo: TipoHelpTrib | null;
    titulo: string;
    campo: keyof NotaFiscalItemDiversaDto;
    itemIndex: number;
    origemParam?: string;
  }>({
    open: false,
    tipo: null,
    titulo: '',
    campo: 'tributacaoIcms',
    itemIndex: 0,
  });

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [prep, setPrep] = useState<EmissaoDiversaPrepDto | null>(null);
  const [aba, setAba] = useState<
    'geral' | 'itens' | 'tributos' | 'transporte' | 'referencias' | 'servicos'
  >('geral');

  // Cabeçalho
  const [serieNf, setSerieNf] = useState('');
  const [proximoNumero, setProximoNumero] = useState(0);
  const [destino, setDestino] = useState<'2' | '3'>('3');
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [horaEntrega, setHoraEntrega] = useState(getNowHm);
  const [codigoCfo, setCodigoCfo] = useState('');
  const [condicaoPagto, setCondicaoPagto] = useState('');
  const [responsavelFrete, setResponsavelFrete] = useState('9');
  const [codigoTransportadora, setCodigoTransportadora] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [qtdVolumes, setQtdVolumes] = useState(0);
  const [especieVolumes, setEspecieVolumes] = useState('');
  const [marcaVolumes, setMarcaVolumes] = useState('');
  const [numeracaoVolumes, setNumeracaoVolumes] = useState('');
  const [pesoBruto, setPesoBruto] = useState(0);
  const [pesoLiquido, setPesoLiquido] = useState(0);
  const [valorFrete, setValorFrete] = useState(0);
  const [valorSeguro, setValorSeguro] = useState(0);
  const [valorOutrasDesp, setValorOutrasDesp] = useState(0);
  const [percDescEspec, setPercDescEspec] = useState(0);
  const [baseIcmsInf, setBaseIcmsInf] = useState<number>(0);
  const [valorIcmsInf, setValorIcmsInf] = useState<number>(0);
  const [baseIpiInf, setBaseIpiInf] = useState<number>(0);
  const [valorItensInf, setValorItensInf] = useState<number>(0);
  const [valorNotaInf, setValorNotaInf] = useState<number>(0);
  const [aliqIss, setAliqIss] = useState(0);
  const [aliqIrrf, setAliqIrrf] = useState(0);
  const [aliqCsll, setAliqCsll] = useState(0);
  const [indicadorPresenca, setIndicadorPresenca] = useState('9');
  const [codigoLocalEmbarque, setCodigoLocalEmbarque] = useState('');
  const [tipoNotaCred, setTipoNotaCred] = useState('');
  const [observacao, setObservacao] = useState('');
  const [autoTerceiros, setAutoTerceiros] = useState(true);
  const [manterValoresRetorno, setManterValoresRetorno] = useState(true);

  // Coleções
  const [itens, setItens] = useState<NotaFiscalItemDiversaDto[]>([]);
  const [itemEditIdx, setItemEditIdx] = useState(0);
  const [servicos, setServicos] = useState<NotaFiscalServicoDto[]>([]);
  const [dis, setDis] = useState<NotaFiscalItemDiDto[]>([]);
  const [des, setDes] = useState<NotaFiscalItemDeDto[]>([]);
  const [notasRef, setNotasRef] = useState<NotaFiscalReferenciadaDto[]>([]);
  const [itensComplem, setItensComplem] = useState<NotaFiscalItemComplemDto[]>([]);
  const [itensDev, setItensDev] = useState<NotaFiscalItemDevDto[]>([]);
  const [itensTerc, setItensTerc] = useState<TerceiroSelecaoInputDto[]>([]);

  // Auxiliares sob demanda / Notas Referenciadas (Q4)
  const [notasRefDisp, setNotasRefDisp] = useState<NotaFiscalReferenciadaDto[]>([]);
  const [devDisp, setDevDisp] = useState<NotaFiscalItemDevDto[]>([]);
  const [tercDisp, setTercDisp] = useState<RecebimentoTerceiroSaldoDto[]>([]);
  const [refSelKey, setRefSelKey] = useState('');
  const [refNumNf, setRefNumNf] = useState('');
  const [refSerNf, setRefSerNf] = useState('');

  // Parcelas editáveis
  const [etapaParcelas, setEtapaParcelas] = useState<{
    numNotaFiscal: string;
    serNotaFiscal: string;
    valorTotalNota: number;
    parcelas: ParcelaDuplicataDto[];
    mensagemCentavos?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !numSolicitacao) return;
    let active = true;
    setLoading(true);
    setEtapaParcelas(null);
    setAba('geral');
    setItemEditIdx(0);
    setNotasRefDisp([]);
    setDevDisp([]);
    setTercDisp([]);
    setRefSelKey('');
    setRefNumNf('');
    setRefSerNf('');
    reset();

    void prepararEmissaoDiversa(numSolicitacao)
      .then((d) => {
        if (!active) return;
        setPrep(d);
        setSerieNf(d.serieSelecionada);
        setProximoNumero(d.proximoNumeroNf);
        setDestino(d.situacaoDestinoPadrao === 2 ? '2' : '3');
        setDataEmissao(toBrDateFromIso(d.dataEmissao));
        setDataEntrega(toBrDateFromIso(d.dataEntrega || d.dataEmissao));
        setHoraEntrega(d.horaEntrega || getNowHm());
        setCodigoCfo(d.codigoCfo || '');
        setCondicaoPagto(d.condicaoPagto ? String(d.condicaoPagto) : '');
        setResponsavelFrete(String(d.responsavelFrete ?? 9));
        setCodigoTransportadora(d.codigoTransportadora ? String(d.codigoTransportadora) : '');
        setPlacaVeiculo(d.placaVeiculo || '');
        setQtdVolumes(d.qtdVolumes ?? 0);
        setEspecieVolumes(d.especieVolumes || '');
        setMarcaVolumes(d.marcaVolumes || '');
        setNumeracaoVolumes(d.numeracaoVolumes || '');
        setPesoBruto(d.pesoBruto ?? 0);
        setPesoLiquido(d.pesoLiquido ?? 0);
        setValorFrete(d.valorFrete);
        setValorSeguro(d.valorSeguro);
        setValorOutrasDesp(d.valorOutrasDesp);
        setPercDescEspec(d.percDescEspec);
        setBaseIcmsInf(d.baseIcms);
        setValorIcmsInf(d.valorIcms);
        setBaseIpiInf(d.baseIpi);
        setValorItensInf(d.valorTotalItens);
        setValorNotaInf(d.valorTotalNota);
        setAliqIss(d.aliquotaIss);
        setAliqIrrf(d.aliquotaIrrf);
        setAliqCsll(d.aliquotaCsll);
        setIndicadorPresenca(String(d.indicadorPresenca ?? 9));
        setCodigoLocalEmbarque(d.codigoLocalEmbarque ? String(d.codigoLocalEmbarque) : '');
        setTipoNotaCred(d.tipoNotaCred ? String(d.tipoNotaCred) : '');
        setObservacao(d.observacao || '');
        setItens(d.itens);
        setServicos(d.servicos);
        setDis(d.declaracoesImportacao);
        setDes(d.declaracoesExportacao);
        setNotasRef(d.notasReferenciadas);
        setItensComplem(d.itensComplem);
        setItensDev(d.itensDevolucao);
        setItensTerc(d.itensTerceiro);
      })
      .catch((err: any) => {
        if (active) showToast(err?.message || 'Erro ao carregar solicitação diversa.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, numSolicitacao, reset, showToast]);

  if (!open || !numSolicitacao) return null;

  const trocarSerie = async (novaSerie: string) => {
    setSerieNf(novaSerie);
    try {
      const info = await obterProximoNumeroSerie(novaSerie);
      setProximoNumero(info.proximoNumero);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao buscar próximo número.', 'error');
    }
  };

  const natList = prep?.entradaSaida === 'E' ? combos?.naturezasEntrada ?? [] : combos?.naturezasSaida ?? [];
  const natOpts = natList.map((n) => ({
    value: n.codigoCfo,
    label: `${n.codigoCfo} - ${n.descricaoCfo}`,
  }));
  const cfoSelecionadoValido = natOpts.some((o) => o.value === codigoCfo) ? codigoCfo : '';

  const isEntrada = prep?.entradaSaida === 'E';
  const natAtual = natList.find((n) => n.codigoCfo === codigoCfo);
  const tipoOp = natAtual?.tipoOperacao ?? 0;
  const isDevolucaoSaida = !isEntrada && (tipoOp === 6 || tipoOp === 7);
  const isTerceirosSaida = !isEntrada && (tipoOp === 3 || tipoOp === 4);
  const transpObrigatoria = !isEntrada && Number(indicadorPresenca) > 1;
  const condPagtoObrigatoria = !isEntrada && Boolean(natAtual?.geraOperFinanc) && tipoOp !== 6 && tipoOp !== 7;
  const volumesObrigatorios = !isEntrada && prep?.tipoMovimentoEstoque !== 3 && ![5, 7, 9, 10, 12].includes(tipoOp);
  const localEmbObrigatorio = !isEntrada && itens.some((i) => (i.codigoFiscal ?? '').trim().startsWith('7'));
  const exigeReferencia =
    isEntrada || tipoOp === 5 || tipoOp === 6 || tipoOp === 7 || tipoOp === 9 || Boolean(tipoNotaCred);
  const exibeAbaReferencias = exigeReferencia || isDevolucaoSaida || isTerceirosSaida;

  const trocarNatureza = (novaCfo: string) => {
    setCodigoCfo(novaCfo);
    const nat = natList.find((n) => n.codigoCfo === novaCfo);
    if (nat?.primeiroCfop) {
      setItens((prev) => prev.map((it) => ({ ...it, codigoFiscal: nat.primeiroCfop })));
    }
    const op = nat?.tipoOperacao ?? 0;
    const precisaRef =
      isEntrada ||
      op === 5 ||
      op === 6 ||
      op === 7 ||
      op === 9 ||
      op === 3 ||
      op === 4 ||
      Boolean(tipoNotaCred);
    if (aba === 'referencias' && !precisaRef) {
      setAba('geral');
    }
  };

  const carregarAuxiliaresRef = async () => {
    if (!prep) return;
    try {
      const refsPromise = exigeReferencia
        ? listarNotasReferenciadasDisponiveis(prep.tipoDestinatario, prep.codigoDestinatario)
        : Promise.resolve<NotaFiscalReferenciadaDto[]>([]);
      const devsPromise = isDevolucaoSaida
        ? listarSaldosDevolucaoRecebimento(prep.tipoDestinatario, prep.codigoDestinatario)
        : Promise.resolve<NotaFiscalItemDevDto[]>([]);

      const [refs, devs] = await Promise.all([refsPromise, devsPromise]);
      setNotasRefDisp(refs);
      setDevDisp(devs);

      if (isTerceirosSaida && itens.length > 0) {
        const tercs = await listarSaldosTerceirosDisponiveis(
          itens[itemEditIdx]?.codigoMaterial ?? itens[0].codigoMaterial,
          prep.tipoDestinatario,
          prep.codigoDestinatario,
        );
        setTercDisp(tercs);
      } else {
        setTercDisp([]);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar saldos/notas do destinatário.', 'error');
    }
  };

  const adicionarNotaRefManual = () => {
    const numLimpo = refNumNf.trim();
    const serLimpo = (refSerNf.trim() || '1').trim();
    if (!numLimpo) {
      showToast('Informe o número da Nota Fiscal de origem.', 'error');
      return;
    }
    if ((tipoNotaCred === '1' || tipoNotaCred === '2') && notasRef.length >= 1) {
      showToast('Nota de crédito por recusa aceita apenas 1 NF referenciada.', 'error');
      return;
    }
    if (notasRef.some((x) => x.numNfOrigem.trim() === numLimpo && x.serNfOrigem.trim() === serLimpo)) {
      showToast(`NF ${numLimpo}/${serLimpo} já está referenciada.`, 'info');
      return;
    }
    const existente = notasRefDisp.find(
      (d) => d.numNfOrigem.trim() === numLimpo && d.serNfOrigem.trim() === serLimpo,
    );
    setNotasRef((prev) => [
      ...prev,
      existente ?? {
        numNfOrigem: numLimpo,
        serNfOrigem: serLimpo,
        dataEmissao: null,
        chaveAcessoNfe: null,
      },
    ]);
    setRefNumNf('');
    setRefSerNf('');
    setRefSelKey('');
  };

  const buildPayload = (): ConfirmarEmissaoDiversaRequest => ({
    numSolicitacao: prep!.numSolicitacao,
    numNotaTmp: prep!.numNotaTmp,
    serieNf,
    destino: Number(destino),
    tipoDanfe: (combos?.tipoDanfePadrao === 6 ? 6 : 5) as 5 | 6,
    dataEmissao: toIsoDateFromBr(dataEmissao) || new Date().toISOString().slice(0, 10),
    dataEntrega: toIsoDateFromBr(dataEntrega) ?? null,
    horaEntrega: horaEntrega || null,
    codigoCfo,
    condicaoPagto: condicaoPagto ? Number(condicaoPagto) : null,
    responsavelFrete: Number(responsavelFrete),
    codigoTransportadora: codigoTransportadora ? Number(codigoTransportadora) : null,
    placaVeiculo: placaVeiculo || null,
    qtdVolumes,
    especieVolumes: especieVolumes || null,
    marcaVolumes: marcaVolumes || null,
    numeracaoVolumes: numeracaoVolumes || null,
    pesoBruto,
    pesoLiquido,
    valorFrete,
    valorSeguro,
    valorOutrasDesp,
    percDescEspec,
    baseIcmsInformada: prep?.permiteEditarTotaisManual ? baseIcmsInf : null,
    valorIcmsInformado: prep?.permiteEditarTotaisManual ? valorIcmsInf : null,
    baseIpiInformada: prep?.permiteEditarTotaisManual ? baseIpiInf : null,
    valorTotalItensInformado: prep?.permiteEditarTotaisManual ? valorItensInf : null,
    valorTotalNotaInformado: prep?.permiteEditarTotaisManual ? valorNotaInf : null,
    aliquotaIss: aliqIss,
    aliquotaIrrf: aliqIrrf,
    aliquotaCsll: aliqCsll,
    indicadorPresenca: Number(indicadorPresenca),
    codigoLocalEmbarque: codigoLocalEmbarque ? Number(codigoLocalEmbarque) : null,
    tipoNotaCred: tipoNotaCred ? Number(tipoNotaCred) : null,
    observacao: observacao || null,
    selecionarTerceirosAutomaticamente: autoTerceiros,
    manterValoresOrigemRetorno: manterValoresRetorno,
    itens,
    servicos,
    declaracoesImportacao: dis,
    declaracoesExportacao: des,
    notasReferenciadas: notasRef,
    itensComplem,
    itensDevolucao: itensDev,
    itensTerceiro: itensTerc,
  });

  const salvarRascunho = async () => {
    if (!prep) return;
    setSalvando(true);
    try {
      const msg = await salvarRascunhoDiversa(buildPayload());
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar rascunho.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarEmissao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prep) return;
    const reqs: unknown[] = [serieNf, dataEmissao, cfoSelecionadoValido];
    if (condPagtoObrigatoria) reqs.push(condicaoPagto);
    if (transpObrigatoria) reqs.push(codigoTransportadora);
    if (volumesObrigatorios) reqs.push(especieVolumes);
    if (localEmbObrigatorio) reqs.push(codigoLocalEmbarque);

    if (!validate(reqs)) {
      const faltaTransporte =
        (transpObrigatoria && !codigoTransportadora) ||
        (volumesObrigatorios && !especieVolumes.trim()) ||
        (localEmbObrigatorio && !codigoLocalEmbarque);
      if (faltaTransporte && serieNf && dataEmissao && cfoSelecionadoValido && (!condPagtoObrigatoria || condicaoPagto)) {
        setAba('transporte');
      }
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }

    const dtEmiIso = toIsoDateFromBr(dataEmissao);
    const dtEntIso = toIsoDateFromBr(dataEntrega);
    if (Boolean(dtEntIso) !== Boolean(horaEntrega.trim())) {
      setAba('geral');
      showToast('Informe Data e Hora de Saída/Entrega em conjunto.', 'error');
      return;
    }
    if (dtEntIso && dtEmiIso && dtEntIso < dtEmiIso) {
      setAba('geral');
      showToast('A Data de Saída/Entrega não pode ser anterior à Data de Emissão.', 'error');
      return;
    }
    if (volumesObrigatorios && qtdVolumes <= 0) {
      setAba('transporte');
      showToast('Informe a Quantidade de Volumes e a Espécie dos Volumes.', 'error');
      return;
    }
    if (percDescEspec < 0 || percDescEspec > 100) {
      setAba('transporte');
      showToast('Desconto não pode ser maior que 100%!', 'error');
      return;
    }
    if (pesoBruto < 0 || pesoLiquido < 0) {
      setAba('transporte');
      showToast('Peso bruto e líquido não podem ser negativos.', 'error');
      return;
    }

    setSalvando(true);
    try {
      const res = await confirmarEmissaoDiversa({ ...buildPayload(), codigoCfo: cfoSelecionadoValido });
      if (res.requerEdicaoParcelas) {
        showToast(res.mensagem, 'info');
        setEtapaParcelas({
          numNotaFiscal: res.numNotaFiscal,
          serNotaFiscal: res.serNotaFiscal,
          valorTotalNota: res.valorTotalNota,
          parcelas: res.parcelas,
        });
        return;
      }
      const sefazRejeitada =
        Number(destino) === 3 &&
        !res.autorizadaSefaz &&
        (res.sefazOk === false || /rejei|erro/i.test(res.mensagem || ''));
      showToast(
        res.mensagem || `NF ${res.numNotaFiscal}/${res.serNotaFiscal} emitida.`,
        sefazRejeitada ? 'error' : 'success',
      );
      onEmitida(res.numNotaFiscal, res.serNotaFiscal, res.mensagem, {
        autorizada: res.autorizadaSefaz,
        sefazOk: res.sefazOk,
        destino: Number(destino),
      });
    } catch (err: any) {
      showToast(err?.message || 'Erro ao emitir NF diversa.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const finalizarParcelas = async (confirmarCentavos = false) => {
    if (!etapaParcelas) return;
    setSalvando(true);
    try {
      const res = await salvarParcelasFinalizar({
        numNotaFiscal: etapaParcelas.numNotaFiscal,
        serNotaFiscal: etapaParcelas.serNotaFiscal,
        destino: Number(destino),
        tipoDanfe: (combos?.tipoDanfePadrao === 6 ? 6 : 5) as 5 | 6,
        confirmarDiferencaCentavos: confirmarCentavos,
        parcelas: etapaParcelas.parcelas,
      });
      if (res.exigeConfirmacao) {
        setEtapaParcelas((prev) => (prev ? { ...prev, mensagemCentavos: res.mensagem } : null));
        return;
      }
      const sefazRejeitada =
        Number(destino) === 3 &&
        !res.autorizadaSefaz &&
        (res.sefazOk === false || /rejei|erro/i.test(res.mensagem || ''));
      showToast(
        res.mensagem || 'Parcelas salvas e NF-e finalizada.',
        sefazRejeitada ? 'error' : 'success',
      );
      onEmitida(res.numNotaFiscal, res.serNotaFiscal, res.mensagem, {
        autorizada: res.autorizadaSefaz,
        sefazOk: res.sefazOk,
        destino: Number(destino),
      });
    } catch (err: any) {
      showToast(err?.message || 'Erro ao finalizar parcelas.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const itemAtual = itens[itemEditIdx];
  const itemEhImportacaoDi = Boolean(isEntrada && itemAtual?.codigoFiscal?.trim().startsWith('3'));
  const atualizarItem = (idx: number, patch: Partial<NotaFiscalItemDiversaDto>) => {
    setItens((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const titulo = prep?.isServico
    ? `Nota Fiscal de Serviço - Solic. ${String(numSolicitacao).padStart(6, '0')}`
    : prep?.entradaSaida === 'E'
      ? `Nota Fiscal de Entrada - Solic. ${String(numSolicitacao).padStart(6, '0')}`
      : `Nota Fiscal de Saída - Solic. ${String(numSolicitacao).padStart(6, '0')}`;

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>{titulo}</h2>
          <ModalHeaderActions onClose={onClose} disabled={salvando} />
        </header>

        {loading ? (
          <div className="module-form">
            <p className="module-empty">Preparando solicitação para emissão...</p>
          </div>
        ) : etapaParcelas ? (
          <>
            <div className="module-form fat-modal-body fat-stack">
              <div className="fat-subpanel__head">
                <strong>{`Alterar Vencimentos e Parcelas — NF ${etapaParcelas.numNotaFiscal}/${etapaParcelas.serNotaFiscal}`}</strong>
                <span className="fat-hint-text">
                  {`Total da NF: ${formatCurrencyBr(etapaParcelas.valorTotalNota)} • Soma das parcelas: ${formatCurrencyBr(etapaParcelas.parcelas.reduce((acc, p) => acc + p.valorReceber, 0))}`}
                </span>
              </div>
              <div className="fat-stack">
                {etapaParcelas.parcelas.map((p, idx) => (
                  <div key={p.numLanc} className="fat-subcard form-grid-3">
                    <label>
                      <span>Documento</span>
                      <input type="text" value={p.numDocumento ?? ''} readOnly data-no-translate="" />
                    </label>
                    <label>
                      <span>Vencimento</span>
                      <CustomDatePicker
                        value={toBrDateFromIso(p.dataVencimento)}
                        onChange={(br) => {
                          const iso = toIsoDateFromBr(br);
                          setEtapaParcelas((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mensagemCentavos: null,
                                  parcelas: prev.parcelas.map((x, xi) =>
                                    xi === idx ? { ...x, dataVencimento: iso ?? x.dataVencimento } : x,
                                  ),
                                }
                              : null,
                          );
                        }}
                      />
                    </label>
                    <label>
                      <span>Valor (R$)</span>
                      <DecimalInput
                        decimals={2}
                        min={0.01}
                        value={p.valorReceber}
                        onChange={(val) => {
                          setEtapaParcelas((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mensagemCentavos: null,
                                  parcelas: prev.parcelas.map((x, xi) => (xi === idx ? { ...x, valorReceber: val } : x)),
                                }
                              : null,
                          );
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
              {etapaParcelas.mensagemCentavos && <p className="fat-warning-box">{etapaParcelas.mensagemCentavos}</p>}
            </div>
            <footer className="modal-card__footer">
              <button
                type="button"
                className="primary-button"
                disabled={salvando}
                onClick={() => void finalizarParcelas(Boolean(etapaParcelas.mensagemCentavos))}
              >
                <IoCheckmarkCircleOutline size={16} />
                {salvando ? 'Finalizando...' : etapaParcelas.mensagemCentavos ? 'Sim, confirmar diferença' : 'Salvar Parcelas e Transmitir'}
              </button>
              <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
                Fechar
              </button>
            </footer>
          </>
        ) : !prep ? (
          <div className="module-form">
            <p className="module-empty">Solicitação não encontrada.</p>
          </div>
        ) : (
          <>
            <div className="contas-receber-tabs fat-modal-tabs" role="tablist" aria-label="Abas da Nota Fiscal Diversa">
              <button
                type="button"
                role="tab"
                aria-selected={aba === 'geral'}
                className={`contas-receber-tab${aba === 'geral' ? ' contas-receber-tab--active' : ''}`}
                onClick={() => setAba('geral')}
              >
                Cabeçalho
              </button>
              {!prep.isServico && (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={aba === 'itens'}
                    className={`contas-receber-tab${aba === 'itens' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setAba('itens')}
                  >
                    {`Itens (${itens.length})`}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={aba === 'tributos'}
                    className={`contas-receber-tab${aba === 'tributos' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setAba('tributos')}
                  >
                    Tributação / IBS-CBS
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={aba === 'transporte'}
                    className={`contas-receber-tab${aba === 'transporte' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setAba('transporte')}
                  >
                    Transporte / Despesas
                  </button>
                  {exibeAbaReferencias && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={aba === 'referencias'}
                      className={`contas-receber-tab${aba === 'referencias' ? ' contas-receber-tab--active' : ''}`}
                      onClick={() => {
                        setAba('referencias');
                        void carregarAuxiliaresRef();
                      }}
                    >
                      {isDevolucaoSaida
                        ? 'Devolução / Referências'
                        : isTerceirosSaida
                          ? 'Terceiros'
                          : 'Notas Referenciadas'}
                    </button>
                  )}
                </>
              )}
              {prep.isServico && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={aba === 'servicos'}
                  className={`contas-receber-tab${aba === 'servicos' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setAba('servicos')}
                >
                  {`Serviços e Retenções (${servicos.length})`}
                </button>
              )}
            </div>

            <form id={formId} className="module-form fat-modal-body" onSubmit={confirmarEmissao} noValidate>
              {aba === 'geral' && (
                <div className="form-grid-3">
                  <label>
                    <span>Destinatário</span>
                    <input
                      type="text"
                      value={`${prep.tipoDestinatario} ${prep.codigoDestinatario} - ${prep.nomeDestinatario}`}
                      readOnly
                      data-no-translate=""
                    />
                  </label>
                  <label>
                    <span>Série *</span>
                    <SearchableSelect
                      className={wrapperClass(serieNf)}
                      value={serieNf}
                      onChange={(v) => void trocarSerie(v)}
                      options={prep.seriesDisponiveis.map((s) => ({
                        value: s.serieNf,
                        label: `Série ${s.serieNf} (Próx: ${s.proximoNumero} | ${s.tipoNotaDescricao})`,
                      }))}
                      searchPlaceholder="Pesquisar..."
                    />
                    {error(serieNf)}
                  </label>
                  <label>
                    <span>Próximo Número NF</span>
                    <input type="text" value={String(proximoNumero).padStart(6, '0')} readOnly />
                  </label>

                  <label>
                    <span>Data Emissão *</span>
                    <CustomDatePicker className={wrapperClass(dataEmissao)} value={dataEmissao} onChange={setDataEmissao} />
                    {error(dataEmissao)}
                  </label>
                  <label>
                    <span>{prep.entradaSaida === 'E' ? 'Data Entrada' : 'Data Saída'}</span>
                    <CustomDatePicker value={dataEntrega} onChange={setDataEntrega} />
                  </label>
                  <label>
                    <span>{prep.entradaSaida === 'E' ? 'Hora Entrada' : 'Hora Saída'}</span>
                    <CustomTimePicker value={horaEntrega} onChange={setHoraEntrega} />
                  </label>

                  <label className="form-grid-3__span2">
                    <span>Natureza de Operação (CFO) *</span>
                    <SearchableSelect
                      className={wrapperClass(cfoSelecionadoValido)}
                      value={cfoSelecionadoValido}
                      onChange={trocarNatureza}
                      options={natOpts}
                      searchPlaceholder="Pesquisar..."
                    />
                    {error(cfoSelecionadoValido)}
                  </label>
                  <label>
                    <span>Destino</span>
                    <SearchableSelect
                      value={destino}
                      onChange={(v) => setDestino(v === '2' ? '2' : '3')}
                      options={[
                        { value: '3', label: '3 - Transmitir NF-e' },
                        { value: '2', label: '2 - Pré-Emissão' },
                      ]}
                      searchPlaceholder="Pesquisar..."
                    />
                  </label>

                  <label className="form-grid-3__span2">
                    <span>{condPagtoObrigatoria ? 'Condição de Pagamento *' : 'Condição de Pagamento'}</span>
                    <SearchableSelect
                      className={condPagtoObrigatoria ? wrapperClass(condicaoPagto) : undefined}
                      value={condicaoPagto}
                      onChange={setCondicaoPagto}
                      options={[{ value: '', label: 'Sem condição financeira' }, ...(combos?.condicoesPagto ?? [])]}
                      searchPlaceholder="Pesquisar..."
                    />
                    {condPagtoObrigatoria && error(condicaoPagto)}
                  </label>
                  <label>
                    <span>Nota de Crédito (IBS/CBS Recusa)</span>
                    <SearchableSelect
                      value={tipoNotaCred}
                      onChange={setTipoNotaCred}
                      options={[
                        { value: '', label: 'Não se aplica' },
                        { value: '1', label: '1 - Recusa Parcial (03)' },
                        { value: '2', label: '2 - Recusa Total (06)' },
                      ]}
                      searchPlaceholder="Pesquisar..."
                    />
                  </label>

                  {prep.permiteEditarTotaisManual && (
                    <>
                      <label>
                        <span>Base ICMS Manual</span>
                        <DecimalInput decimals={2} value={baseIcmsInf} onChange={setBaseIcmsInf} />
                      </label>
                      <label>
                        <span>Valor ICMS Manual</span>
                        <DecimalInput decimals={2} value={valorIcmsInf} onChange={setValorIcmsInf} />
                      </label>
                      <label>
                        <span>Valor Total NF Manual</span>
                        <DecimalInput decimals={2} value={valorNotaInf} onChange={setValorNotaInf} />
                      </label>
                    </>
                  )}

                  <label className="form-grid-3__full">
                    <span>Observações da NF-e</span>
                    <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                  </label>
                </div>
              )}

              {aba === 'itens' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Itens da Nota Fiscal Diversa">
                  <table className="clientes-table fat-table-compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>CFOP</th>
                        <th>NCM</th>
                        <th>Qtd</th>
                        <th>Unitário</th>
                        <th>Total</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, idx) => (
                        <tr key={it.numItem}>
                          <td>{it.numItem}</td>
                          <td data-no-translate="">
                            <strong>{it.codigoMaterial}</strong>
                            <div className="fat-cell-sub">{it.descricaoMaterial || it.descricaoComplem || '-'}</div>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="fat-cell-input"
                              value={it.codigoFiscal || ''}
                              onChange={(e) => atualizarItem(idx, { codigoFiscal: e.target.value })}
                            />
                          </td>
                          <td>
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                className="fat-cell-input"
                                value={it.classificacaoFiscal || ''}
                                onChange={(e) => atualizarItem(idx, { classificacaoFiscal: e.target.value })}
                              />
                              <button
                                type="button"
                                className="icon-button module-action-button clientes-cep-search"
                                title="Consultar NCM / Classificação Fiscal (F3)"
                                aria-label="Consultar NCM"
                                onClick={() =>
                                  setTribHelp({
                                    open: true,
                                    tipo: 'ClassificacaoFiscal',
                                    titulo: 'Consultar NCM / Classificação Fiscal',
                                    campo: 'classificacaoFiscal',
                                    itemIndex: idx,
                                  })
                                }
                              >
                                <IoSearchOutline size={14} />
                              </button>
                            </div>
                          </td>
                          <td>{formatDecimalBr(it.qtdMaterial, 3)}</td>
                          <td>
                            <DecimalInput
                              decimals={4}
                              minDecimals={2}
                              className="fat-cell-input"
                              value={it.valorUnitario}
                              onChange={(unit) => {
                                atualizarItem(idx, { valorUnitario: unit, valorTotalItem: unit * it.qtdMaterial });
                              }}
                            />
                          </td>
                          <td>{formatCurrencyBr(it.valorTotalItem)}</td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setItemEditIdx(idx);
                                setAba('tributos');
                              }}
                            >
                              Tributos
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aba === 'tributos' && itemAtual && (
                <div className="fat-stack">
                  <div className="form-grid-3">
                    <label className="form-grid-3__full">
                      <span>Item em Edição</span>
                      <SearchableSelect
                        value={String(itemEditIdx)}
                        onChange={(v) => setItemEditIdx(Number(v))}
                        options={itens.map((x, xi) => ({
                          value: String(xi),
                          label: `#${x.numItem} - ${x.codigoMaterial} (${x.descricaoMaterial || x.descricaoComplem || ''})`,
                        }))}
                        searchPlaceholder="Pesquisar..."
                      />
                    </label>
                  </div>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">Dados Fiscais do Item</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>NCM (Classificação Fiscal)</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={10}
                            value={itemAtual.classificacaoFiscal || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { classificacaoFiscal: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar NCM (F3)"
                            aria-label="Consultar NCM"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'ClassificacaoFiscal',
                                titulo: 'Consultar NCM / Classificação Fiscal',
                                campo: 'classificacaoFiscal',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>Número FCI</span>
                        <input
                          type="text"
                          value={itemAtual.numDocFci || ''}
                          onChange={(e) => atualizarItem(itemEditIdx, { numDocFci: e.target.value })}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">ICMS</legend>
                    <div className="form-grid-3">
                      <label>
                        <span>Origem</span>
                        <input
                          type="text"
                          maxLength={1}
                          value={itemAtual.origemMercadoria || '0'}
                          onChange={(e) => atualizarItem(itemEditIdx, { origemMercadoria: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>CST ICMS</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={3}
                            value={itemAtual.tributacaoIcms || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { tributacaoIcms: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CST ICMS (F3)"
                            aria-label="Consultar CST ICMS"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'ICMS',
                                titulo: 'Consultar Tributação ICMS',
                                campo: 'tributacaoIcms',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>CSOSN</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={3}
                            value={itemAtual.codigoCsosn || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { codigoCsosn: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CSOSN (F3)"
                            aria-label="Consultar CSOSN"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'CSOSN',
                                titulo: 'Consultar CSOSN',
                                campo: 'codigoCsosn',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>Aliq. ICMS (%)</span>
                        <DecimalInput decimals={2} value={itemAtual.aliquotaIcms} onChange={(v) => atualizarItem(itemEditIdx, { aliquotaIcms: v })} />
                      </label>
                      <label>
                        <span>% Base ICMS</span>
                        <DecimalInput decimals={2} value={itemAtual.percBaseIcms} onChange={(v) => atualizarItem(itemEditIdx, { percBaseIcms: v })} />
                      </label>
                      <label>
                        <span>cBenef</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            value={itemAtual.codigoCbenef || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { codigoCbenef: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar Código Benefício Fiscal (F3)"
                            aria-label="Consultar cBenef"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'CBenef',
                                titulo: 'Consultar Código Benefício Fiscal (cBenef)',
                                campo: 'codigoCbenef',
                                itemIndex: itemEditIdx,
                                origemParam: itemAtual.tributacaoIcms || undefined,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">IPI</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>CST IPI</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={2}
                            value={itemAtual.tributacaoIpi || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { tributacaoIpi: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CST IPI (F3)"
                            aria-label="Consultar CST IPI"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'IPI',
                                titulo: 'Consultar Tributação IPI',
                                campo: 'tributacaoIpi',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>Aliq. IPI (%)</span>
                        <DecimalInput decimals={2} value={itemAtual.aliquotaIpi} onChange={(v) => atualizarItem(itemEditIdx, { aliquotaIpi: v })} />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">Imposto de Importação (II)</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>Aliq. II / Desp. Adu. (Import.)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} value={itemAtual.aliquotaIi ?? 0} onChange={(v) => atualizarItem(itemEditIdx, { aliquotaIi: v })} />
                          <DecimalInput decimals={2} value={itemAtual.valorDespAdu ?? 0} onChange={(v) => atualizarItem(itemEditIdx, { valorDespAdu: v })} />
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">PIS / COFINS</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>CST PIS</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={2}
                            value={itemAtual.tributacaoPis || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { tributacaoPis: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CST PIS (F3)"
                            aria-label="Consultar CST PIS"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'PISCofins',
                                titulo: 'Consultar Tributação PIS',
                                campo: 'tributacaoPis',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>CST COFINS</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={2}
                            value={itemAtual.tributacaoCofins || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { tributacaoCofins: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CST COFINS (F3)"
                            aria-label="Consultar CST COFINS"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'PISCofins',
                                titulo: 'Consultar Tributação COFINS',
                                campo: 'tributacaoCofins',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">IBS / CBS</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>CST IBS / CBS</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={3}
                            value={itemAtual.cstIbsCbs || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { cstIbsCbs: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar CST IBS/CBS (F3)"
                            aria-label="Consultar CST IBS/CBS"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'CBSIBS',
                                titulo: 'Consultar Tributação IBS / CBS',
                                campo: 'cstIbsCbs',
                                itemIndex: itemEditIdx,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>cClassTrib IBS / CBS</span>
                        <div className="clientes-cep-input">
                          <input
                            type="text"
                            maxLength={6}
                            value={itemAtual.classTribIbsCbs || ''}
                            onChange={(e) => atualizarItem(itemEditIdx, { classTribIbsCbs: e.target.value })}
                          />
                          <button
                            type="button"
                            className="icon-button module-action-button clientes-cep-search"
                            title="Consultar cClassTrib IBS/CBS (F3)"
                            aria-label="Consultar cClassTrib IBS/CBS"
                            onClick={() =>
                              setTribHelp({
                                open: true,
                                tipo: 'ClassTribIBSCBS',
                                titulo: 'Consultar Classificação Tributária IBS/CBS',
                                campo: 'classTribIbsCbs',
                                itemIndex: itemEditIdx,
                                origemParam: itemAtual.cstIbsCbs || undefined,
                              })
                            }
                          >
                            <IoSearchOutline size={16} />
                          </button>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="fat-trib-group">
                    <legend className="fat-trib-group__legend">Imposto Seletivo (IS)</legend>
                    <div className="form-grid-2">
                      <label>
                        <span>CST / cClassTrib IS</span>
                        <div className="form-grid-2">
                          <div className="clientes-cep-input">
                            <input
                              type="text"
                              maxLength={3}
                              placeholder="CST IS"
                              value={itemAtual.cstIs || ''}
                              onChange={(e) => atualizarItem(itemEditIdx, { cstIs: e.target.value })}
                            />
                            <button
                              type="button"
                              className="icon-button module-action-button clientes-cep-search"
                              title="Consultar CST IS (F3)"
                              aria-label="Consultar CST IS"
                              onClick={() =>
                                setTribHelp({
                                  open: true,
                                  tipo: 'IS',
                                  titulo: 'Consultar Tributação IS (Imposto Seletivo)',
                                  campo: 'cstIs',
                                  itemIndex: itemEditIdx,
                                })
                              }
                            >
                              <IoSearchOutline size={14} />
                            </button>
                          </div>
                          <div className="clientes-cep-input">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="cClassTrib IS"
                              value={itemAtual.classTribIs || ''}
                              onChange={(e) => atualizarItem(itemEditIdx, { classTribIs: e.target.value })}
                            />
                            <button
                              type="button"
                              className="icon-button module-action-button clientes-cep-search"
                              title="Consultar cClassTrib IS (F3)"
                              aria-label="Consultar cClassTrib IS"
                              onClick={() =>
                                setTribHelp({
                                  open: true,
                                  tipo: 'ClassTribIS',
                                  titulo: 'Consultar Classificação Tributária IS',
                                  campo: 'classTribIs',
                                  itemIndex: itemEditIdx,
                                  origemParam: itemAtual.cstIs || undefined,
                                })
                              }
                            >
                              <IoSearchOutline size={14} />
                            </button>
                          </div>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  {itemEhImportacaoDi && (
                    <div className="fat-subpanel">
                      <div className="fat-subpanel__head">
                        <strong>{`Declaração de Importação (DI) — Item #${itemAtual.numItem}`}</strong>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            setDis((prev) => [
                              ...prev,
                              {
                                numItem: itemAtual.numItem,
                                numeroDi: '',
                                dataRegistroDi: '',
                                codigoLocalDesembaraco: undefined,
                                dataDesembaraco: '',
                                codigoExportador: '',
                                viaTransporte: 1,
                                valorAfrmm: 0,
                                tipoIntermedio: 1,
                                adicoes: [],
                              },
                            ])
                          }
                        >
                          <IoAddOutline size={15} />
                          Adicionar DI
                        </button>
                      </div>

                      {dis.filter((d) => d.numItem === itemAtual.numItem).length === 0 ? (
                        <p className="fat-hint-text">Nenhuma DI vinculada a este item de importação.</p>
                      ) : (
                        dis.map((di, diIdx) => {
                          if (di.numItem !== itemAtual.numItem) return null;
                          return (
                            <div key={`${di.numItem}-${diIdx}`} className="fat-subcard fat-stack">
                              <div className="fat-subpanel__head">
                                <strong>{`DI #${diIdx + 1}`}</strong>
                                <button
                                  type="button"
                                  className="icon-button icon-button--danger"
                                  aria-label="Remover DI"
                                  onClick={() => setDis((prev) => prev.filter((_, i) => i !== diIdx))}
                                >
                                  <IoTrashOutline size={14} />
                                </button>
                              </div>
                              <div className="form-grid-3">
                                <label>
                                  <span>Número DI</span>
                                  <input
                                    type="text"
                                    value={di.numeroDi}
                                    onChange={(e) =>
                                      setDis((prev) => prev.map((x, i) => (i === diIdx ? { ...x, numeroDi: e.target.value } : x)))
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Data Registro DI</span>
                                  <CustomDatePicker
                                    value={toBrDateFromIso(di.dataRegistroDi)}
                                    onChange={(v) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, dataRegistroDi: toIsoDateFromBr(v) ?? '' } : x)),
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Local Desembaraço</span>
                                  <SearchableSelect
                                    value={di.codigoLocalDesembaraco ? String(di.codigoLocalDesembaraco) : ''}
                                    onChange={(v) =>
                                      setDis((prev) =>
                                        prev.map((x, i) =>
                                          i === diIdx ? { ...x, codigoLocalDesembaraco: v ? Number(v) : undefined } : x,
                                        ),
                                      )
                                    }
                                    options={[{ value: '', label: 'Não informado' }, ...(combos?.locaisEmbarque ?? [])]}
                                    searchPlaceholder="Pesquisar..."
                                  />
                                </label>
                                <label>
                                  <span>Data Desembaraço</span>
                                  <CustomDatePicker
                                    value={toBrDateFromIso(di.dataDesembaraco)}
                                    onChange={(v) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, dataDesembaraco: toIsoDateFromBr(v) ?? '' } : x)),
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Exportador</span>
                                  <input
                                    type="text"
                                    value={di.codigoExportador}
                                    onChange={(e) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, codigoExportador: e.target.value } : x)),
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  <span>AFRMM (R$)</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={di.valorAfrmm ?? 0}
                                    onChange={(e) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, valorAfrmm: Number(e.target.value || 0) } : x)),
                                      )
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Via de Transporte</span>
                                  <SearchableSelect
                                    value={String(di.viaTransporte || 1)}
                                    onChange={(v) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, viaTransporte: Number(v || 1) } : x)),
                                      )
                                    }
                                    options={VIA_TRANSPORTE_OPTS}
                                    searchPlaceholder="Pesquisar..."
                                  />
                                </label>
                                <label className="form-grid-3__span2">
                                  <span>Tipo Intermédio</span>
                                  <SearchableSelect
                                    value={String(di.tipoIntermedio || 1)}
                                    onChange={(v) =>
                                      setDis((prev) =>
                                        prev.map((x, i) => (i === diIdx ? { ...x, tipoIntermedio: Number(v || 1) } : x)),
                                      )
                                    }
                                    options={TIPO_INTERMEDIO_OPTS}
                                    searchPlaceholder="Pesquisar..."
                                  />
                                </label>
                              </div>

                              <div className="fat-subpanel__head">
                                <span>Adições da DI</span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    setDis((prev) =>
                                      prev.map((x, i) =>
                                        i === diIdx
                                          ? {
                                              ...x,
                                              adicoes: [
                                                ...x.adicoes,
                                                {
                                                  numAdicao: x.adicoes.length + 1,
                                                  numSeqAdicao: 1,
                                                  codigoFabricante: '',
                                                  valorDesconto: 0,
                                                  numeroDrawback: '',
                                                },
                                              ],
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  <IoAddOutline size={14} />
                                  Adicionar Adição
                                </button>
                              </div>

                              {di.adicoes.map((ad, adIdx) => (
                                <div key={adIdx} className="form-grid-3">
                                  <label>
                                    <span>Nº Adição / Seq.</span>
                                    <div className="form-grid-2">
                                      <input
                                        type="number"
                                        value={ad.numAdicao}
                                        onChange={(e) =>
                                          setDis((prev) =>
                                            prev.map((x, i) =>
                                              i === diIdx
                                                ? {
                                                    ...x,
                                                    adicoes: x.adicoes.map((a, ai) =>
                                                      ai === adIdx ? { ...a, numAdicao: Number(e.target.value || 1) } : a,
                                                    ),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                      <input
                                        type="number"
                                        value={ad.numSeqAdicao}
                                        onChange={(e) =>
                                          setDis((prev) =>
                                            prev.map((x, i) =>
                                              i === diIdx
                                                ? {
                                                    ...x,
                                                    adicoes: x.adicoes.map((a, ai) =>
                                                      ai === adIdx ? { ...a, numSeqAdicao: Number(e.target.value || 1) } : a,
                                                    ),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                    </div>
                                  </label>
                                  <label>
                                    <span>Fabricante</span>
                                    <input
                                      type="text"
                                      value={ad.codigoFabricante}
                                      onChange={(e) =>
                                        setDis((prev) =>
                                          prev.map((x, i) =>
                                            i === diIdx
                                              ? {
                                                  ...x,
                                                  adicoes: x.adicoes.map((a, ai) =>
                                                    ai === adIdx ? { ...a, codigoFabricante: e.target.value } : a,
                                                  ),
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Desconto (R$) / Drawback</span>
                                    <div className="form-grid-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={ad.valorDesconto ?? 0}
                                        onChange={(e) =>
                                          setDis((prev) =>
                                            prev.map((x, i) =>
                                              i === diIdx
                                                ? {
                                                    ...x,
                                                    adicoes: x.adicoes.map((a, ai) =>
                                                      ai === adIdx ? { ...a, valorDesconto: Number(e.target.value || 0) } : a,
                                                    ),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                      <div className="clientes-cep-input">
                                        <input
                                          type="text"
                                          placeholder="Drawback"
                                          value={ad.numeroDrawback ?? ''}
                                          onChange={(e) =>
                                            setDis((prev) =>
                                              prev.map((x, i) =>
                                                i === diIdx
                                                  ? {
                                                      ...x,
                                                      adicoes: x.adicoes.map((a, ai) =>
                                                        ai === adIdx ? { ...a, numeroDrawback: e.target.value } : a,
                                                      ),
                                                    }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="icon-button icon-button--danger"
                                          aria-label="Remover adição"
                                          onClick={() =>
                                            setDis((prev) =>
                                              prev.map((x, i) =>
                                                i === diIdx
                                                  ? { ...x, adicoes: x.adicoes.filter((_, ai) => ai !== adIdx) }
                                                  : x,
                                              ),
                                            )
                                          }
                                        >
                                          <IoTrashOutline size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {aba === 'transporte' && (
                <div className="form-grid-3">
                  <label>
                    <span>Modalidade Frete</span>
                    <SearchableSelect value={responsavelFrete} onChange={setResponsavelFrete} options={RESP_FRETE_OPTS} searchPlaceholder="Pesquisar..." />
                  </label>
                  <label>
                    <span>{transpObrigatoria ? 'Transportadora *' : 'Transportadora'}</span>
                    <SearchableSelect
                      className={transpObrigatoria ? wrapperClass(codigoTransportadora) : undefined}
                      value={codigoTransportadora}
                      onChange={setCodigoTransportadora}
                      options={[{ value: '', label: 'Selecione' }, ...(combos?.transportadoras ?? [])]}
                      searchPlaceholder="Pesquisar..."
                    />
                    {transpObrigatoria && error(codigoTransportadora)}
                  </label>
                  <label>
                    <span>Placa Veículo</span>
                    <input type="text" value={placaVeiculo} onChange={(e) => setPlacaVeiculo(e.target.value)} maxLength={8} />
                  </label>
                  <label>
                    <span>{volumesObrigatorios ? 'Qtd. Volumes *' : 'Qtd. Volumes'}</span>
                    <DecimalInput decimals={2} value={qtdVolumes} onChange={setQtdVolumes} />
                  </label>
                  <label>
                    <span>{volumesObrigatorios ? 'Espécie Volumes *' : 'Espécie Volumes'}</span>
                    <input
                      className={volumesObrigatorios ? wrapperClass(especieVolumes) : undefined}
                      type="text"
                      value={especieVolumes}
                      onChange={(e) => setEspecieVolumes(e.target.value)}
                    />
                    {volumesObrigatorios && error(especieVolumes)}
                  </label>
                  <label>
                    <span>Pesos Bruto / Líquido (kg)</span>
                    <div className="form-grid-2">
                      <DecimalInput decimals={3} value={pesoBruto} onChange={setPesoBruto} />
                      <DecimalInput decimals={3} value={pesoLiquido} onChange={setPesoLiquido} />
                    </div>
                  </label>
                  <label>
                    <span>Valor Frete (R$)</span>
                    <DecimalInput decimals={2} value={valorFrete} onChange={setValorFrete} />
                  </label>
                  <label>
                    <span>Valor Seguro (R$)</span>
                    <DecimalInput decimals={2} value={valorSeguro} onChange={setValorSeguro} />
                  </label>
                  <label>
                    <span>Outras Despesas (R$)</span>
                    <DecimalInput decimals={2} value={valorOutrasDesp} onChange={setValorOutrasDesp} />
                  </label>
                  <label>
                    <span>% Desconto Especial</span>
                    <DecimalInput decimals={2} value={percDescEspec} onChange={setPercDescEspec} />
                  </label>
                  <label>
                    <span>Indicador Presença</span>
                    <SearchableSelect
                      value={indicadorPresenca}
                      onChange={setIndicadorPresenca}
                      options={IND_PRES_OPTS}
                      searchPlaceholder="Pesquisar..."
                    />
                  </label>
                  <label>
                    <span>{localEmbObrigatorio ? 'Local Embarque (Export.) *' : 'Local Embarque (Export.)'}</span>
                    <SearchableSelect
                      className={localEmbObrigatorio ? wrapperClass(codigoLocalEmbarque) : undefined}
                      value={codigoLocalEmbarque}
                      onChange={setCodigoLocalEmbarque}
                      options={[{ value: '', label: 'Não informado' }, ...(combos?.locaisEmbarque ?? [])]}
                      searchPlaceholder="Pesquisar..."
                    />
                    {localEmbObrigatorio && error(codigoLocalEmbarque)}
                  </label>
                </div>
              )}

              {aba === 'referencias' && (
                <div className="fat-stack">
                  {(isDevolucaoSaida || isTerceirosSaida) && (
                    <div className="form-grid-2">
                      {isTerceirosSaida && (
                        <label className="fat-checkbox-row">
                          <input
                            type="checkbox"
                            checked={autoTerceiros}
                            onChange={(e) => setAutoTerceiros(e.target.checked)}
                          />
                          <span>Selecionar recebimentos de terceiros automaticamente</span>
                        </label>
                      )}
                      {isDevolucaoSaida && (
                        <label className="fat-checkbox-row">
                          <input
                            type="checkbox"
                            checked={manterValoresRetorno}
                            onChange={(e) => setManterValoresRetorno(e.target.checked)}
                          />
                          <span>Manter IPI / ICMS de origem em devoluções</span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Notas Referenciadas (Q4: Entrada ou Saída Tipo_Operacao IN 5,6,7,9 ou Nota de Crédito) */}
                  {exigeReferencia && (
                    <div className="fat-subpanel fat-stack">
                      <div className="fat-subpanel__head">
                        <strong>Notas Fiscais Referenciadas</strong>
                        {(tipoNotaCred === '1' || tipoNotaCred === '2') && (
                          <span className="fat-hint-text">Nota de crédito por recusa permite 1 NF referenciada.</span>
                        )}
                      </div>

                      <div className="form-grid-3">
                        {notasRefDisp.length > 0 && (
                          <label className="form-grid-3__full">
                            <span>Selecionar NF do Destinatário (opcional)</span>
                            <SearchableSelect
                              value={refSelKey}
                              onChange={(v) => {
                                setRefSelKey(v);
                                const found = notasRefDisp.find((r) => `${r.numNfOrigem}|${r.serNfOrigem}` === v);
                                if (found) {
                                  setRefNumNf(found.numNfOrigem);
                                  setRefSerNf(found.serNfOrigem);
                                }
                              }}
                              options={[
                                { value: '', label: 'Informar manualmente abaixo...' },
                                ...notasRefDisp.map((r) => ({
                                  value: `${r.numNfOrigem}|${r.serNfOrigem}`,
                                  label: `NF ${r.numNfOrigem}/${r.serNfOrigem}${r.dataEmissao ? ` (${toBrDateFromIso(r.dataEmissao)})` : ''}`,
                                })),
                              ]}
                              searchPlaceholder="Pesquisar NF..."
                            />
                          </label>
                        )}
                        <label>
                          <span>Nº NF Origem</span>
                          <input
                            type="text"
                            maxLength={9}
                            placeholder="Ex: 046353"
                            value={refNumNf}
                            onChange={(e) => setRefNumNf(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Série Origem</span>
                          <input
                            type="text"
                            maxLength={3}
                            placeholder="Ex: 1"
                            value={refSerNf}
                            onChange={(e) => setRefSerNf(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Ação</span>
                          <button type="button" className="secondary-button" onClick={adicionarNotaRefManual}>
                            <IoAddOutline size={15} />
                            Adicionar Referência
                          </button>
                        </label>
                      </div>

                      {notasRef.length === 0 ? (
                        <p className="fat-hint-text">Nenhuma nota referenciada vinculada.</p>
                      ) : (
                        <ul className="fat-chip-list">
                          {notasRef.map((r, ri) => (
                            <li key={`${r.numNfOrigem}-${r.serNfOrigem}`} className="fat-chip">
                              <span>{`NF ${r.numNfOrigem}/${r.serNfOrigem}`}</span>
                              <button
                                type="button"
                                className="icon-button icon-button--danger"
                                aria-label="Remover referência"
                                onClick={() => setNotasRef((prev) => prev.filter((_, xi) => xi !== ri))}
                              >
                                <IoTrashOutline size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Devoluções de Recebimento (apenas Saída com Tipo_Operacao 6 ou 7) */}
                  {isDevolucaoSaida && (
                    <div className="fat-subpanel">
                      <strong>Saldos de Recebimento para Devolução</strong>
                      {devDisp.length === 0 ? (
                        <p className="fat-hint-text">Nenhum saldo de recebimento disponível para devolução.</p>
                      ) : (
                        <div className="table-scroll">
                          <table className="clientes-table fat-table-compact">
                            <thead>
                              <tr>
                                <th>Receb.</th>
                                <th>NF</th>
                                <th>Material</th>
                                <th>Disp.</th>
                                <th>Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {devDisp.map((d) => {
                                const jaAdded = itensDev.some((x) => x.numReceb === d.numReceb && x.numItem === d.numItem);
                                return (
                                  <tr key={`${d.numReceb}-${d.numItem}-${d.codigoMaterial}`}>
                                    <td>{d.numReceb}</td>
                                    <td>{d.numNfOrigem || '-'}</td>
                                    <td>{d.codigoMaterial}</td>
                                    <td>{d.qtdDevolvida}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() =>
                                          setItensDev((prev) =>
                                            jaAdded
                                              ? prev.filter((x) => !(x.numReceb === d.numReceb && x.numItem === d.numItem))
                                              : [...prev, d],
                                          )
                                        }
                                      >
                                        {jaAdded ? 'Remover' : 'Adicionar'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Terceiros manual (apenas Saída com Tipo_Operacao 3 ou 4) */}
                  {isTerceirosSaida && !autoTerceiros && (
                    <div className="fat-subpanel">
                      <strong>Saldos em Poder de Terceiros (Remessa)</strong>
                      {tercDisp.length === 0 ? (
                        <p className="fat-hint-text">Nenhum saldo em poder de terceiros disponível.</p>
                      ) : (
                        <div className="table-scroll">
                          <table className="clientes-table fat-table-compact">
                            <thead>
                              <tr>
                                <th>Receb.</th>
                                <th>NF</th>
                                <th>Saldo</th>
                                <th>Qtd Retornar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tercDisp.map((t) => {
                                const match = itensTerc.find((x) => x.numReceb === t.numReceb && x.codigoMaterial === t.codigoMaterial);
                                return (
                                  <tr key={`${t.numReceb}-${t.codigoMaterial}`}>
                                    <td>{t.numReceb}</td>
                                    <td>{`${t.numNfReceb || '-'}/${t.serNfReceb || '-'}`}</td>
                                    <td>{formatDecimalBr(t.saldoDevolver, 3)}</td>
                                    <td>
                                      <DecimalInput
                                        decimals={3}
                                        className="fat-cell-input"
                                        value={match?.qtdRetorno ?? 0}
                                        onChange={(val) => {
                                          setItensTerc((prev) => {
                                            const rest = prev.filter((x) => !(x.numReceb === t.numReceb && x.codigoMaterial === t.codigoMaterial));
                                            return val > 0 ? [...rest, { codigoMaterial: t.codigoMaterial, numReceb: t.numReceb, qtdRetorno: val }] : rest;
                                          });
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {aba === 'servicos' && (
                <div className="fat-stack">
                  <div className="form-grid-3">
                    <label>
                      <span>% Alíquota ISS</span>
                      <DecimalInput decimals={2} value={aliqIss} onChange={setAliqIss} />
                    </label>
                    <label>
                      <span>% IRRF Retido</span>
                      <DecimalInput decimals={2} value={aliqIrrf} onChange={setAliqIrrf} />
                    </label>
                    <label>
                      <span>% CSLL Retida</span>
                      <DecimalInput decimals={2} value={aliqCsll} onChange={setAliqCsll} />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table className="clientes-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Descrição do Serviço</th>
                          <th>Qtd</th>
                          <th>Unitário</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicos.map((s) => (
                          <tr key={s.numItem}>
                            <td>{s.numItem}</td>
                            <td data-no-translate="">{s.descricaoServico}</td>
                            <td>{s.qtdServico}</td>
                            <td>{formatCurrencyBr(s.valorUnitario)}</td>
                            <td>{formatCurrencyBr(s.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </form>

            <footer className="modal-card__footer">
              <button type="submit" form={formId} className="primary-button" disabled={salvando}>
                <IoDocumentTextOutline size={16} />
                {salvando ? 'Emitindo NF...' : 'Confirmar e Emitir NF-e'}
              </button>
              <button type="button" className="secondary-button" disabled={salvando} onClick={() => void salvarRascunho()}>
                <IoSaveOutline size={16} />
                Salvar Rascunho
              </button>
              <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
                Cancelar
              </button>
            </footer>
          </>
        )}
      </article>

      <FaturamentoTribHelpModal
        open={tribHelp.open}
        tipo={tribHelp.tipo}
        titulo={tribHelp.titulo}
        origemParam={tribHelp.origemParam}
        onSelect={(codigo) => {
          atualizarItem(tribHelp.itemIndex, { [tribHelp.campo]: codigo });
          setTribHelp((prev) => ({ ...prev, open: false }));
        }}
        onClose={() => setTribHelp((prev) => ({ ...prev, open: false }))}
      />
    </section>
  );
}
