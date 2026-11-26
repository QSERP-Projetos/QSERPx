import { useEffect, useId, useState } from 'react';
import {
  IoBanOutline,
  IoCalculatorOutline,
  IoCheckmarkOutline,
  IoCodeDownloadOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
  IoPrintOutline,
  IoSearchOutline,
  IoSendOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { DecimalInput, formatDecimalBr } from '../../../components/DecimalInput';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';
import { FaturamentoTribHelpModal, type TipoHelpTrib } from './FaturamentoTribHelpModal';
import {
  abrirBlobPdf,
  alterarContingenciaNfe,
  alterarNotaFiscal,
  cancelarNotaFiscal,
  emitirCartaCorrecao,
  formatCurrencyBr,
  gerarDanfeFaturamentoPdf,
  getNowHm,
  getTodayBr,
  inutilizarNumeracao,
  obterDetalheNotaFiscal,
  obterXmlNotaFiscal,
  toBrDateFromIso,
  toIsoDateFromBr,
  type FaturamentoCombosDto,
  type NotaFiscalDetalheCompletoDto,
  type NotaFiscalGerenciadorItemDto,
  type NotaFiscalItemAlteracaoDto,
} from '../../../services/faturamentoApi';

// ---------------------------------------------------------------------------
// 1. MODAL ESCOLHA DE IMPRESSÃO DANFE (RETRATO COMO PADRÃO OU PAISAGEM)
// ---------------------------------------------------------------------------
interface DanfeEscolhaModalProps {
  open: boolean;
  nota: { numNotaFiscal: string; serNotaFiscal: string; tipoDanfePadrao?: number } | null;
  onClose: () => void;
}

export function FaturamentoDanfeEscolhaModal({ open, nota, onClose }: DanfeEscolhaModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const [tipoDanfe, setTipoDanfe] = useState<5 | 6>(5);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (open && nota) {
      setTipoDanfe(5);
    }
  }, [open, nota]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gerando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, gerando, onClose]);

  if (!open || !nota) return null;

  const imprimir = async (modelo: 5 | 6) => {
    setGerando(true);
    setTipoDanfe(modelo);
    try {
      const pdf = await gerarDanfeFaturamentoPdf(nota.numNotaFiscal, nota.serNotaFiscal, modelo);
      abrirBlobPdf(pdf);
      showToast('DANFE gerada com sucesso.', 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar PDF da DANFE.', 'error');
    } finally {
      setGerando(false);
    }
  };

  return (
    <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card fat-modal-narrow">
        <header className="modal-card__header">
          <h2 id={titleId}>{`Imprimir DANFE - NF ${nota.numNotaFiscal}/${nota.serNotaFiscal}`}</h2>
          <ModalHeaderActions onClose={onClose} expandable={false} disabled={gerando} />
        </header>

        <div className="module-form">
          <p className="fat-hint-text">Selecione a orientação de impressão da DANFE:</p>
          <div className="form-grid-2">
            <button
              type="button"
              className={tipoDanfe === 5 ? 'primary-button' : 'secondary-button'}
              disabled={gerando}
              onClick={() => void imprimir(5)}
            >
              <IoPrintOutline size={16} />
              {gerando && tipoDanfe === 5 ? 'Gerando...' : 'Retrato'}
            </button>
            <button
              type="button"
              className={tipoDanfe === 6 ? 'primary-button' : 'secondary-button'}
              disabled={gerando}
              onClick={() => void imprimir(6)}
            >
              <IoPrintOutline size={16} />
              {gerando && tipoDanfe === 6 ? 'Gerando...' : 'Paisagem'}
            </button>
          </div>
        </div>

        <footer className="modal-card__footer">
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={gerando}>
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. MODAL VISUALIZAR / BAIXAR XML
// ---------------------------------------------------------------------------
interface XmlModalProps {
  open: boolean;
  nota: { numNotaFiscal: string; serNotaFiscal: string } | null;
  onClose: () => void;
}

export function FaturamentoXmlModal({ open, nota, onClose }: XmlModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const [loadedKey, setLoadedKey] = useState('');
  const [xml, setXml] = useState('');

  const notaKey = open && nota ? `${nota.numNotaFiscal}-${nota.serNotaFiscal}` : '';
  const loading = Boolean(notaKey) && loadedKey !== notaKey;

  useEffect(() => {
    if (!open || !nota) return;
    let active = true;
    const currentKey = `${nota.numNotaFiscal}-${nota.serNotaFiscal}`;
    void obterXmlNotaFiscal(nota.numNotaFiscal, nota.serNotaFiscal)
      .then((content) => {
        if (active) setXml(content);
      })
      .catch((err: any) => {
        if (active) {
          setXml('');
          showToast(err?.message || 'Erro ao carregar XML da NF-e.', 'error');
        }
      })
      .finally(() => {
        if (active) setLoadedKey(currentKey);
      });
    return () => {
      active = false;
    };
  }, [open, nota, showToast]);

  if (!open || !nota) return null;

  const baixarXml = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe-${nota.numNotaFiscal}-${nota.serNotaFiscal}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    showToast('Download do XML iniciado.', 'success');
  };

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>{`XML NF-e ${nota.numNotaFiscal}/${nota.serNotaFiscal}`}</h2>
          <ModalHeaderActions onClose={onClose} />
        </header>

        <div className="module-form fat-modal-body">
          {loading ? (
            <p className="module-empty">Carregando XML...</p>
          ) : !xml ? (
            <p className="module-empty">XML não disponível para esta nota fiscal.</p>
          ) : (
            <pre className="fat-xml-preview" data-no-translate="">
              {xml}
            </pre>
          )}
        </div>

        <footer className="modal-card__footer">
          <button type="button" className="primary-button" onClick={baixarXml} disabled={!xml || loading}>
            <IoCodeDownloadOutline size={16} />
            Baixar XML
          </button>
          <button type="button" className="secondary-button modal-card__close" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. MODAL DETALHE / ALTERAR NF / HISTÓRICO / CC-E (COMPLETO IGUAL AO Q4)
// ---------------------------------------------------------------------------
interface DetalheAlterarModalProps {
  open: boolean;
  nota: NotaFiscalGerenciadorItemDto | null;
  combos?: FaturamentoCombosDto | null;
  abaInicial?: 'dados' | 'ocorrencias' | 'cce';
  somenteLeitura?: boolean;
  permitirOcorrenciasCce?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const DET_RESP_FRETE_OPTS = [
  { value: '1', label: '0 - Contratação do Frete por conta do Remetente (CIF)' },
  { value: '2', label: '1 - Contratação do Frete por conta do Destinatário (FOB)' },
  { value: '3', label: '2 - Contratação do Frete por conta de Terceiros' },
  { value: '4', label: '3 - Transporte Próprio por conta do Remetente' },
  { value: '5', label: '4 - Transporte Próprio por conta do Destinatário' },
  { value: '9', label: '9 - Sem Ocorrência de Transporte' },
];

const DET_IND_PRES_OPTS = [
  { value: '0', label: '0 - Não se aplica' },
  { value: '1', label: '1 - Operação presencial' },
  { value: '2', label: '2 - Não presencial (Internet)' },
  { value: '3', label: '3 - Teleatendimento' },
  { value: '4', label: '4 - NFC-e entrega domicílio' },
  { value: '5', label: '5 - Operação presencial fora estab.' },
  { value: '9', label: '9 - Não presencial (Outros)' },
];

type DetTribHelpState = {
  open: boolean;
  tipo: TipoHelpTrib | null;
  titulo: string;
  campo: keyof NotaFiscalItemAlteracaoDto;
  itemIndex: number;
  origemParam?: string;
};

export function FaturamentoDetalheNotaModal({
  open,
  nota,
  combos = null,
  abaInicial = 'dados',
  somenteLeitura = false,
  permitirOcorrenciasCce = true,
  onClose,
  onSaved,
}: DetalheAlterarModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const tribTitleId = useId();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<'dados' | 'transporte' | 'itens' | 'ocorrencias' | 'cce'>('dados');
  const [detalhe, setDetalhe] = useState<NotaFiscalDetalheCompletoDto | null>(null);
  const [itemTribIdx, setItemTribIdx] = useState<number | null>(null);
  const [tribHelp, setTribHelp] = useState<DetTribHelpState>({
    open: false,
    tipo: null,
    titulo: '',
    campo: 'classificacaoFiscal',
    itemIndex: 0,
  });

  // Cabeçalho & Operação
  const [situacaoNota, setSituacaoNota] = useState(0);
  const [zerarAutPreNota, setZerarAutPreNota] = useState(false);
  const [dataEntrega, setDataEntrega] = useState('');
  const [horaEntrega, setHoraEntrega] = useState('');
  const [codigoCfo, setCodigoCfo] = useState('');
  const [condicaoPagto, setCondicaoPagto] = useState('');
  const [indicadorPresenca, setIndicadorPresenca] = useState('9');
  const [observacao, setObservacao] = useState('');
  const [obsEntrega, setObsEntrega] = useState('');

  // Transporte & Volumes
  const [responsavelFrete, setResponsavelFrete] = useState('9');
  const [codigoTransportadora, setCodigoTransportadora] = useState('');
  const [respRedespacho, setRespRedespacho] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [codigoLocalEmbarque, setCodigoLocalEmbarque] = useState('');
  const [qtdVolumes, setQtdVolumes] = useState(0);
  const [especieVolumes, setEspecieVolumes] = useState('');
  const [marcaVolumes, setMarcaVolumes] = useState('');
  const [numeracaoVolumes, setNumeracaoVolumes] = useState('');
  const [pesoBruto, setPesoBruto] = useState(0);
  const [pesoLiquido, setPesoLiquido] = useState(0);
  const [valorTransporte, setValorTransporte] = useState(0);
  const [baseIcmsTranspRet, setBaseIcmsTranspRet] = useState(0);
  const [aliquotaIcmsTranspRet, setAliquotaIcmsTranspRet] = useState(0);
  const [valorIcmsTranspRet, setValorIcmsTranspRet] = useState(0);
  const [cfopTransporte, setCfopTransporte] = useState('');

  // Totais & Impostos
  const [valorTotalItens, setValorTotalItens] = useState(0);
  const [valorFrete, setValorFrete] = useState(0);
  const [valorSeguro, setValorSeguro] = useState(0);
  const [valorOutrasDesp, setValorOutrasDesp] = useState(0);
  const [valorDesconto, setValorDesconto] = useState(0);
  const [valorDescIcms, setValorDescIcms] = useState(0);
  const [valorTotalNota, setValorTotalNota] = useState(0);
  const [baseIcms, setBaseIcms] = useState(0);
  const [valorIcms, setValorIcms] = useState(0);
  const [baseIcmsSubst, setBaseIcmsSubst] = useState(0);
  const [valorIcmsSubst, setValorIcmsSubst] = useState(0);
  const [baseIpi, setBaseIpi] = useState(0);
  const [valorTotalIpi, setValorTotalIpi] = useState(0);
  const [valorBaseIcmsDest, setValorBaseIcmsDest] = useState(0);
  const [valorIcmsDest, setValorIcmsDest] = useState(0);
  const [valorIcmsRemet, setValorIcmsRemet] = useState(0);
  const [valorIcmsFcp, setValorIcmsFcp] = useState(0);
  const [valorBaseIbsCbs, setValorBaseIbsCbs] = useState(0);
  const [valorTotalIbs, setValorTotalIbs] = useState(0);
  const [valorTotalCbs, setValorTotalCbs] = useState(0);
  const [valorBaseIs, setValorBaseIs] = useState(0);
  const [valorIs, setValorIs] = useState(0);

  const [itens, setItens] = useState<NotaFiscalItemAlteracaoDto[]>([]);

  useEffect(() => {
    if (!open || !nota) return;
    setAba(abaInicial);
    setItemTribIdx(null);
    let active = true;
    setLoading(true);
    void obterDetalheNotaFiscal(nota.numNotaFiscal, nota.serNotaFiscal)
      .then((d) => {
        if (!active) return;
        setDetalhe(d);
        setSituacaoNota(d.situacaoNota);
        setZerarAutPreNota(false);
        setDataEntrega(toBrDateFromIso(d.dataEntrega));
        setHoraEntrega(d.horaEntrega ?? '');
        setCodigoCfo(d.codigoCfo?.trim() ?? '');
        setCondicaoPagto(d.condicaoPagto != null ? String(d.condicaoPagto) : '');
        setIndicadorPresenca(String(d.indicadorPresenca ?? 9));
        setObservacao(d.observacao ?? '');
        setObsEntrega(d.obsEntrega ?? '');

        setResponsavelFrete(String(d.responsavelFrete ?? 9));
        setCodigoTransportadora(d.codigoTransportadora ? String(d.codigoTransportadora) : '');
        setRespRedespacho(d.respRedespacho ? String(d.respRedespacho) : '');
        setPlacaVeiculo(d.placaVeiculo ?? '');
        setCodigoLocalEmbarque(d.codigoLocalEmbarque ? String(d.codigoLocalEmbarque) : '');
        setQtdVolumes(d.qtdVolumes ?? 0);
        setEspecieVolumes(d.especieVolumes ?? '');
        setMarcaVolumes(d.marcaVolumes ?? '');
        setNumeracaoVolumes(d.numeracaoVolumes ?? '');
        setPesoBruto(d.pesoBruto ?? 0);
        setPesoLiquido(d.pesoLiquido ?? 0);
        setValorTransporte(d.valorTransporte ?? 0);
        setBaseIcmsTranspRet(d.baseIcmsTranspRet ?? 0);
        setAliquotaIcmsTranspRet(d.aliquotaIcmsTranspRet ?? 0);
        setValorIcmsTranspRet(d.valorIcmsTranspRet ?? 0);
        setCfopTransporte(d.cfopTransporte ?? '');

        setValorTotalItens(d.valorTotalItens ?? 0);
        setValorFrete(d.valorFrete ?? 0);
        setValorSeguro(d.valorSeguro ?? 0);
        setValorOutrasDesp(d.valorOutrasDesp ?? 0);
        setValorDesconto(d.valorDesconto ?? 0);
        setValorDescIcms(d.valorDescIcms ?? 0);
        setValorTotalNota(d.valorTotalNota ?? 0);
        setBaseIcms(d.baseIcms ?? 0);
        setValorIcms(d.valorIcms ?? 0);
        setBaseIcmsSubst(d.baseIcmsSubst ?? 0);
        setValorIcmsSubst(d.valorIcmsSubst ?? 0);
        setBaseIpi(d.baseIpi ?? 0);
        setValorTotalIpi(d.valorTotalIpi ?? 0);
        setValorBaseIcmsDest(d.valorBaseIcmsDest ?? 0);
        setValorIcmsDest(d.valorIcmsDest ?? 0);
        setValorIcmsRemet(d.valorIcmsRemet ?? 0);
        setValorIcmsFcp(d.valorIcmsFcp ?? 0);
        setValorBaseIbsCbs(d.valorBaseIbsCbs ?? 0);
        setValorTotalIbs(d.valorTotalIbs ?? 0);
        setValorTotalCbs(d.valorTotalCbs ?? 0);
        setValorBaseIs(d.valorBaseIs ?? 0);
        setValorIs(d.valorIs ?? 0);
        setItens(d.itens);
      })
      .catch((err: any) => {
        if (active) showToast(err?.message || 'Erro ao carregar dados da nota.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, nota, abaInicial, showToast]);

  if (!open || !nota) return null;

  const podeEditar =
    !somenteLeitura &&
    detalhe != null &&
    (detalhe.situacaoNota === 5 || (!detalhe.autorizacaoNfe?.trim() && detalhe.situacaoNota !== 9));

  const natListDetalhe =
    detalhe?.entradaSaida === 'E' ? combos?.naturezasEntrada ?? [] : combos?.naturezasSaida ?? [];
  const cfoOptsDetalhe = natListDetalhe.map((n) => ({
    value: n.codigoCfo,
    label: `${n.codigoCfo} - ${n.descricaoCfo}`,
  }));
  if (codigoCfo && !cfoOptsDetalhe.some((o) => o.value === codigoCfo)) {
    cfoOptsDetalhe.unshift({
      value: codigoCfo,
      label: `${codigoCfo}${detalhe?.naturezaOperacao ? ` - ${detalhe.naturezaOperacao}` : ''}`,
    });
  }

  const atualizarItem = (idx: number, patch: Partial<NotaFiscalItemAlteracaoDto>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const recalcularTotaisPelosItens = () => {
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const sumItens = round2(itens.reduce((acc, i) => acc + (i.valorTotalItem ?? i.qtdMaterial * i.valorUnitario), 0));
    const sumBaseIcms = round2(itens.reduce((acc, i) => acc + (i.valorBaseIcms ?? 0), 0));
    const sumIcms = round2(itens.reduce((acc, i) => acc + (i.valorIcms ?? 0), 0));
    const sumBaseSt = round2(itens.reduce((acc, i) => acc + (i.valorBaseIcmsSubst ?? 0), 0));
    const sumSt = round2(itens.reduce((acc, i) => acc + (i.valorIcmsSubst ?? 0), 0));
    const sumBaseIpi = round2(itens.reduce((acc, i) => acc + (i.valorBaseIpi ?? 0), 0));
    const sumIpi = round2(itens.reduce((acc, i) => acc + (i.valorIpi ?? 0), 0));
    const sumBaseDifal = round2(itens.reduce((acc, i) => acc + (i.valorBaseIcmsDest ?? 0), 0));
    const sumIcmsDest = round2(itens.reduce((acc, i) => acc + (i.valorIcmsDest ?? 0), 0));
    const sumIcmsRemet = round2(itens.reduce((acc, i) => acc + (i.valorIcmsRemet ?? 0), 0));
    const sumFcp = round2(itens.reduce((acc, i) => acc + (i.valorIcmsFcp ?? 0), 0));
    const sumBaseIbsCbs = round2(itens.reduce((acc, i) => acc + (i.valorBaseIbsCbs ?? 0), 0));
    const sumIbs = round2(itens.reduce((acc, i) => acc + (i.valorIbsUf ?? 0) + (i.valorIbsMun ?? 0), 0));
    const sumCbs = round2(itens.reduce((acc, i) => acc + (i.valorCbs ?? 0), 0));
    const sumBaseIs = round2(itens.reduce((acc, i) => acc + (i.valorBaseIs ?? 0), 0));
    const sumIs = round2(itens.reduce((acc, i) => acc + (i.valorIs ?? 0), 0));
    const totalNotaCalc = round2(
      sumItens + valorFrete + valorSeguro + valorOutrasDesp + sumIpi + sumSt - valorDesconto - valorDescIcms,
    );

    setValorTotalItens(sumItens);
    setBaseIcms(sumBaseIcms);
    setValorIcms(sumIcms);
    setBaseIcmsSubst(sumBaseSt);
    setValorIcmsSubst(sumSt);
    setBaseIpi(sumBaseIpi);
    setValorTotalIpi(sumIpi);
    setValorBaseIcmsDest(sumBaseDifal);
    setValorIcmsDest(sumIcmsDest);
    setValorIcmsRemet(sumIcmsRemet);
    setValorIcmsFcp(sumFcp);
    setValorBaseIbsCbs(sumBaseIbsCbs);
    setValorTotalIbs(sumIbs);
    setValorTotalCbs(sumCbs);
    setValorBaseIs(sumBaseIs);
    setValorIs(sumIs);
    setValorTotalNota(totalNotaCalc);
    showToast('Totais recalculados com base nos itens.', 'info');
  };

  const abrirTribHelp = (
    idx: number,
    tipo: TipoHelpTrib,
    titulo: string,
    campo: keyof NotaFiscalItemAlteracaoDto,
    origemParam?: string,
  ) => {
    setTribHelp({ open: true, tipo, titulo, campo, itemIndex: idx, origemParam });
  };

  const salvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalhe || !podeEditar) return;
    setSalvando(true);
    try {
      const msg = await alterarNotaFiscal({
        numNotaFiscal: detalhe.numNotaFiscal,
        serNotaFiscal: detalhe.serNotaFiscal,
        tipoNotaFiscal: detalhe.tipoNotaFiscal,
        situacaoNota,
        zerarAutorizacaoPreNota: zerarAutPreNota,
        dataEntrega: dataEntrega ? toIsoDateFromBr(dataEntrega) : null,
        horaEntrega: horaEntrega || null,
        codigoCfo: codigoCfo || null,
        condicaoPagto: condicaoPagto ? Number(condicaoPagto) : null,
        responsavelFrete: Number(responsavelFrete),
        codigoTransportadora: codigoTransportadora ? Number(codigoTransportadora) : null,
        respRedespacho: respRedespacho ? Number(respRedespacho) : null,
        placaVeiculo: placaVeiculo || null,
        indicadorPresenca: Number(indicadorPresenca),
        codigoLocalEmbarque: codigoLocalEmbarque ? Number(codigoLocalEmbarque) : null,
        qtdVolumes,
        especieVolumes: especieVolumes || null,
        marcaVolumes: marcaVolumes || null,
        numeracaoVolumes: numeracaoVolumes || null,
        pesoBruto,
        pesoLiquido,
        obsEntrega: obsEntrega || null,
        valorTransporte,
        baseIcmsTranspRet,
        aliquotaIcmsTranspRet,
        valorIcmsTranspRet,
        cfopTransporte: cfopTransporte || null,
        valorTotalItens,
        valorFrete,
        valorSeguro,
        valorOutrasDesp,
        valorDesconto,
        valorTotalNota,
        baseIcms,
        valorIcms,
        baseIcmsSubst,
        valorIcmsSubst,
        valorDescIcms,
        baseIpi,
        valorTotalIpi,
        valorIcmsFcp,
        valorBaseIcmsDest,
        valorIcmsDest,
        valorIcmsRemet,
        valorBaseIbsCbs,
        valorTotalIbs,
        valorTotalCbs,
        valorBaseIs,
        valorIs,
        observacao,
        itens,
      });
      showToast(msg, 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar alterações na nota fiscal.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>{`NF-e ${nota.numNotaFiscal}/${nota.serNotaFiscal} - ${nota.nomeDestinatario}`}</h2>
          <ModalHeaderActions onClose={onClose} disabled={salvando} />
        </header>

        <div className="contas-receber-tabs fat-modal-tabs" role="tablist" aria-label="Seções da nota fiscal">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'dados'}
            className={`contas-receber-tab${aba === 'dados' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setAba('dados')}
          >
            Cabeçalho e Totais
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'transporte'}
            className={`contas-receber-tab${aba === 'transporte' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setAba('transporte')}
          >
            Transporte / Volumes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'itens'}
            className={`contas-receber-tab${aba === 'itens' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setAba('itens')}
          >
            {`Itens e Tributação (${itens.length})`}
          </button>
          {permitirOcorrenciasCce && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={aba === 'ocorrencias'}
                className={`contas-receber-tab${aba === 'ocorrencias' ? ' contas-receber-tab--active' : ''}`}
                onClick={() => setAba('ocorrencias')}
              >
                {`Ocorrências (${detalhe?.ocorrencias.length ?? 0})`}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={aba === 'cce'}
                className={`contas-receber-tab${aba === 'cce' ? ' contas-receber-tab--active' : ''}`}
                onClick={() => setAba('cce')}
              >
                {`Cartas de Correção (${detalhe?.cartasCorrecao.length ?? 0})`}
              </button>
            </>
          )}
        </div>

        <form id={formId} className="module-form fat-modal-body" onSubmit={salvarAlteracoes} noValidate>
          {loading ? (
            <p className="module-empty">Carregando detalhes da nota fiscal...</p>
          ) : !detalhe ? (
            <p className="module-empty">Nota fiscal não encontrada.</p>
          ) : (
            <>
              {aba === 'dados' && (
                <div className="fat-stack">
                  <div className="form-grid-3">
                    <label className="form-grid-3__span2">
                      <span>Destinatário</span>
                      <input
                        type="text"
                        value={`${detalhe.tipoDestinatario ?? ''} ${detalhe.codigoDestinatario ?? ''} - ${detalhe.nomeDestinatario}`.trim()}
                        readOnly
                        data-no-translate=""
                      />
                    </label>
                    <label>
                      <span>Operação / Tipo Nota</span>
                      <input
                        type="text"
                        value={`${detalhe.entradaSaida === 'E' ? 'Entrada' : 'Saída'} • ${detalhe.tipoNotaDescricao || detalhe.tipoNotaFiscal}`}
                        readOnly
                      />
                    </label>
                    <label>
                      <span>Emissão</span>
                      <input type="text" value={toBrDateFromIso(detalhe.dataEmissao)} readOnly />
                    </label>
                    <label>
                      <span>Data Saída / Entrega</span>
                      {podeEditar ? (
                        <CustomDatePicker value={dataEntrega} onChange={setDataEntrega} />
                      ) : (
                        <input type="text" value={dataEntrega || '-'} readOnly />
                      )}
                    </label>
                    <label>
                      <span>Hora Saída / Entrega</span>
                      {podeEditar ? (
                        <CustomTimePicker value={horaEntrega} onChange={setHoraEntrega} />
                      ) : (
                        <input type="text" value={horaEntrega || '-'} readOnly />
                      )}
                    </label>
                    <label className="form-grid-3__span2">
                      <span>CFO / Natureza de Operação</span>
                      {podeEditar && cfoOptsDetalhe.length > 0 ? (
                        <SearchableSelect
                          value={codigoCfo}
                          onChange={setCodigoCfo}
                          options={cfoOptsDetalhe}
                          searchPlaceholder="Pesquisar..."
                        />
                      ) : (
                        <input
                          type="text"
                          value={`${codigoCfo || '-'}${detalhe.naturezaOperacao ? ` - ${detalhe.naturezaOperacao}` : ''}`}
                          readOnly
                          data-no-translate=""
                        />
                      )}
                    </label>
                    <label>
                      <span>Situação</span>
                      {detalhe.situacaoNota === 5 && podeEditar ? (
                        <SearchableSelect
                          value={String(situacaoNota)}
                          onChange={(v) => setSituacaoNota(Number(v))}
                          options={[
                            { value: '5', label: 'Pré-Emitida (5)' },
                            { value: '0', label: 'Liberar para NF-e (0)' },
                          ]}
                          searchPlaceholder="Pesquisar..."
                        />
                      ) : (
                        <input type="text" value={nota.situacaoDescricao} readOnly />
                      )}
                    </label>
                    <label>
                      <span>Condição de Pagamento</span>
                      {podeEditar && (combos?.condicoesPagto?.length ?? 0) > 0 ? (
                        <SearchableSelect
                          value={condicaoPagto}
                          onChange={setCondicaoPagto}
                          options={[{ value: '', label: 'Sem condição' }, ...(combos?.condicoesPagto ?? [])]}
                          searchPlaceholder="Pesquisar..."
                        />
                      ) : (
                        <input type="text" value={detalhe.descricaoCondicaoPagto || '-'} readOnly data-no-translate="" />
                      )}
                    </label>
                    <label>
                      <span>Indicador de Presença</span>
                      {podeEditar ? (
                        <SearchableSelect
                          value={indicadorPresenca}
                          onChange={setIndicadorPresenca}
                          options={DET_IND_PRES_OPTS}
                          searchPlaceholder="Pesquisar..."
                        />
                      ) : (
                        <input
                          type="text"
                          value={DET_IND_PRES_OPTS.find((o) => o.value === indicadorPresenca)?.label ?? indicadorPresenca}
                          readOnly
                        />
                      )}
                    </label>
                    <label>
                      <span>Nº Ordem / Pedido / Solic.</span>
                      <input type="text" value={detalhe.numPedido != null ? String(detalhe.numPedido) : '-'} readOnly />
                    </label>
                    <label>
                      <span>Usuário / Financeiro / Estoque</span>
                      <input
                        type="text"
                        value={`${detalhe.codigoUsuario || '-'} • Fin: ${detalhe.geraOperFin ? 'Sim' : 'Não'} • Est: ${detalhe.atualizaEstoque ? 'Sim' : 'Não'}`}
                        readOnly
                      />
                    </label>
                    <label className="form-grid-3__span2">
                      <span>Chave de Acesso NF-e</span>
                      <input type="text" value={detalhe.chaveAcessoNfe || 'Ainda não gerada'} readOnly data-no-translate="" />
                    </label>
                    <label>
                      <span>Protocolo Autorização</span>
                      <input type="text" value={detalhe.autorizacaoNfe || '-'} readOnly data-no-translate="" />
                    </label>
                    {detalhe.situacaoNota === 5 && situacaoNota === 0 && (
                      <label className="fat-checkbox-row form-grid-3__full">
                        <input
                          type="checkbox"
                          checked={zerarAutPreNota}
                          onChange={(e) => setZerarAutPreNota(e.target.checked)}
                        />
                        <span>Zerar protocolo de pré-nota ao liberar</span>
                      </label>
                    )}
                  </div>

                  <div className="fat-subcard fat-stack">
                    <div className="fat-subpanel__head">
                      <strong>Totais e Impostos (R$)</strong>
                      {podeEditar && (
                        <button type="button" className="secondary-button" onClick={recalcularTotaisPelosItens}>
                          <IoCalculatorOutline size={15} />
                          Recalcular totais pelos itens
                        </button>
                      )}
                    </div>
                    <div className="form-grid-3">
                      <label>
                        <span>Total dos Produtos (R$)</span>
                        <DecimalInput decimals={2} value={valorTotalItens} readOnly={!podeEditar} onChange={setValorTotalItens} />
                      </label>
                      <label>
                        <span>Valor Frete (R$)</span>
                        <DecimalInput decimals={2} value={valorFrete} readOnly={!podeEditar} onChange={setValorFrete} />
                      </label>
                      <label>
                        <span>Valor Seguro (R$)</span>
                        <DecimalInput decimals={2} value={valorSeguro} readOnly={!podeEditar} onChange={setValorSeguro} />
                      </label>
                      <label>
                        <span>Outras Despesas (R$)</span>
                        <DecimalInput decimals={2} value={valorOutrasDesp} readOnly={!podeEditar} onChange={setValorOutrasDesp} />
                      </label>
                      <label>
                        <span>Valor Desconto (R$)</span>
                        <DecimalInput decimals={2} value={valorDesconto} readOnly={!podeEditar} onChange={setValorDesconto} />
                      </label>
                      <label>
                        <span>Desconto ICMS (R$)</span>
                        <DecimalInput decimals={2} value={valorDescIcms} readOnly={!podeEditar} onChange={setValorDescIcms} />
                      </label>
                      <label>
                        <span>Base ICMS (R$)</span>
                        <DecimalInput decimals={2} value={baseIcms} readOnly={!podeEditar} onChange={setBaseIcms} />
                      </label>
                      <label>
                        <span>Valor ICMS (R$)</span>
                        <DecimalInput decimals={2} value={valorIcms} readOnly={!podeEditar} onChange={setValorIcms} />
                      </label>
                      <label>
                        <span>Base / Valor ICMS ST (R$)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} ariaLabel="Base ICMS ST" value={baseIcmsSubst} readOnly={!podeEditar} onChange={setBaseIcmsSubst} />
                          <DecimalInput decimals={2} ariaLabel="Valor ICMS ST" value={valorIcmsSubst} readOnly={!podeEditar} onChange={setValorIcmsSubst} />
                        </div>
                      </label>
                      <label>
                        <span>Base IPI (R$)</span>
                        <DecimalInput decimals={2} value={baseIpi} readOnly={!podeEditar} onChange={setBaseIpi} />
                      </label>
                      <label>
                        <span>Valor IPI (R$)</span>
                        <DecimalInput decimals={2} value={valorTotalIpi} readOnly={!podeEditar} onChange={setValorTotalIpi} />
                      </label>
                      <label>
                        <span>Total da Nota (R$)</span>
                        <DecimalInput decimals={2} value={valorTotalNota} readOnly={!podeEditar} onChange={setValorTotalNota} />
                      </label>
                      <label>
                        <span>Base DIFAL / FCP (R$)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} ariaLabel="Base ICMS Destino" value={valorBaseIcmsDest} readOnly={!podeEditar} onChange={setValorBaseIcmsDest} />
                          <DecimalInput decimals={2} ariaLabel="Valor FCP" value={valorIcmsFcp} readOnly={!podeEditar} onChange={setValorIcmsFcp} />
                        </div>
                      </label>
                      <label>
                        <span>ICMS Destino / Remetente (R$)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} ariaLabel="ICMS Destino" value={valorIcmsDest} readOnly={!podeEditar} onChange={setValorIcmsDest} />
                          <DecimalInput decimals={2} ariaLabel="ICMS Remetente" value={valorIcmsRemet} readOnly={!podeEditar} onChange={setValorIcmsRemet} />
                        </div>
                      </label>
                      <label>
                        <span>Base IBS / CBS (R$)</span>
                        <DecimalInput decimals={2} value={valorBaseIbsCbs} readOnly={!podeEditar} onChange={setValorBaseIbsCbs} />
                      </label>
                      <label>
                        <span>Total IBS / CBS (R$)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} ariaLabel="Total IBS" value={valorTotalIbs} readOnly={!podeEditar} onChange={setValorTotalIbs} />
                          <DecimalInput decimals={2} ariaLabel="Total CBS" value={valorTotalCbs} readOnly={!podeEditar} onChange={setValorTotalCbs} />
                        </div>
                      </label>
                      <label>
                        <span>Base / Valor IS (R$)</span>
                        <div className="form-grid-2">
                          <DecimalInput decimals={2} ariaLabel="Base IS" value={valorBaseIs} readOnly={!podeEditar} onChange={setValorBaseIs} />
                          <DecimalInput decimals={2} ariaLabel="Valor IS" value={valorIs} readOnly={!podeEditar} onChange={setValorIs} />
                        </div>
                      </label>
                      <label>
                        <span>Observação Entrega</span>
                        <input
                          type="text"
                          maxLength={40}
                          value={obsEntrega}
                          readOnly={!podeEditar}
                          onChange={(e) => setObsEntrega(e.target.value)}
                        />
                      </label>
                      <label className="form-grid-3__full">
                        <span>Observações / Informações Complementares</span>
                        <textarea
                          rows={4}
                          value={observacao}
                          readOnly={!podeEditar}
                          onChange={(e) => setObservacao(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {aba === 'transporte' && (
                <div className="form-grid-3">
                  <label>
                    <span>Responsável pelo Frete</span>
                    {podeEditar ? (
                      <SearchableSelect
                        value={responsavelFrete}
                        onChange={setResponsavelFrete}
                        options={DET_RESP_FRETE_OPTS}
                        searchPlaceholder="Pesquisar..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={DET_RESP_FRETE_OPTS.find((o) => o.value === responsavelFrete)?.label ?? responsavelFrete}
                        readOnly
                      />
                    )}
                  </label>
                  <label>
                    <span>Transportadora</span>
                    {podeEditar && (combos?.transportadoras?.length ?? 0) > 0 ? (
                      <SearchableSelect
                        value={codigoTransportadora}
                        onChange={setCodigoTransportadora}
                        options={[{ value: '', label: 'Nenhuma' }, ...(combos?.transportadoras ?? [])]}
                        searchPlaceholder="Pesquisar..."
                      />
                    ) : (
                      <input type="text" value={detalhe.nomeTransportadora || '-'} readOnly data-no-translate="" />
                    )}
                  </label>
                  <label>
                    <span>Redespacho</span>
                    {podeEditar && (combos?.transportadoras?.length ?? 0) > 0 ? (
                      <SearchableSelect
                        value={respRedespacho}
                        onChange={setRespRedespacho}
                        options={[{ value: '', label: 'Nenhum' }, ...(combos?.transportadoras ?? [])]}
                        searchPlaceholder="Pesquisar..."
                      />
                    ) : (
                      <input type="text" value={respRedespacho || '-'} readOnly />
                    )}
                  </label>
                  <label>
                    <span>Placa Veículo</span>
                    <input
                      type="text"
                      maxLength={7}
                      value={placaVeiculo}
                      readOnly={!podeEditar}
                      onChange={(e) => setPlacaVeiculo(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label>
                    <span>Local Embarque (Exportação)</span>
                    {podeEditar && (combos?.locaisEmbarque?.length ?? 0) > 0 ? (
                      <SearchableSelect
                        value={codigoLocalEmbarque}
                        onChange={setCodigoLocalEmbarque}
                        options={[{ value: '', label: 'Não informado' }, ...(combos?.locaisEmbarque ?? [])]}
                        searchPlaceholder="Pesquisar..."
                      />
                    ) : (
                      <input type="text" value={codigoLocalEmbarque || '-'} readOnly />
                    )}
                  </label>
                  <label>
                    <span>Qtd. Volumes</span>
                    <DecimalInput decimals={2} value={qtdVolumes} readOnly={!podeEditar} onChange={setQtdVolumes} />
                  </label>
                  <label>
                    <span>Espécie Volumes</span>
                    <input
                      type="text"
                      maxLength={15}
                      value={especieVolumes}
                      readOnly={!podeEditar}
                      onChange={(e) => setEspecieVolumes(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Marca Volumes</span>
                    <input
                      type="text"
                      maxLength={60}
                      value={marcaVolumes}
                      readOnly={!podeEditar}
                      onChange={(e) => setMarcaVolumes(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Numeração Volumes</span>
                    <input
                      type="text"
                      maxLength={60}
                      value={numeracaoVolumes}
                      readOnly={!podeEditar}
                      onChange={(e) => setNumeracaoVolumes(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Peso Bruto (kg)</span>
                    <DecimalInput decimals={3} value={pesoBruto} readOnly={!podeEditar} onChange={setPesoBruto} />
                  </label>
                  <label>
                    <span>Peso Líquido (kg)</span>
                    <DecimalInput decimals={3} value={pesoLiquido} readOnly={!podeEditar} onChange={setPesoLiquido} />
                  </label>
                  <label>
                    <span>CFOP Retenção Transporte</span>
                    <input
                      type="text"
                      maxLength={4}
                      value={cfopTransporte}
                      readOnly={!podeEditar}
                      onChange={(e) => setCfopTransporte(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Valor Serviço Transp. (R$)</span>
                    <DecimalInput decimals={2} value={valorTransporte} readOnly={!podeEditar} onChange={setValorTransporte} />
                  </label>
                  <label>
                    <span>Base ICMS Transp. Ret. (R$)</span>
                    <DecimalInput decimals={2} value={baseIcmsTranspRet} readOnly={!podeEditar} onChange={setBaseIcmsTranspRet} />
                  </label>
                  <label>
                    <span>% Alíq. / Valor ICMS Ret.</span>
                    <div className="form-grid-2">
                      <DecimalInput decimals={2} ariaLabel="Alíquota ICMS Retenção Transp." value={aliquotaIcmsTranspRet} readOnly={!podeEditar} onChange={setAliquotaIcmsTranspRet} />
                      <DecimalInput decimals={2} ariaLabel="Valor ICMS Retenção Transp." value={valorIcmsTranspRet} readOnly={!podeEditar} onChange={setValorIcmsTranspRet} />
                    </div>
                  </label>
                </div>
              )}

              {aba === 'itens' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Itens da nota fiscal">
                  <table className="clientes-table fat-table-compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>CFOP</th>
                        <th>NCM</th>
                        <th>Lote</th>
                        <th>Qtd</th>
                        <th>Unid.</th>
                        <th>Unitário</th>
                        <th>Total Item</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, idx) => {
                        const descItem = it.descricaoMaterial || it.descricaoComplem || '-';
                        const totalItem = it.valorTotalItem ?? it.qtdMaterial * it.valorUnitario;
                        return (
                          <tr key={it.numItem}>
                            <td>{it.numItem}</td>
                            <td data-no-translate="">
                              <strong>{it.codigoMaterial}</strong>
                              {it.numPedidoCliente ? <div className="fat-cell-sub">{`Ped. ${it.numPedidoCliente}`}</div> : null}
                            </td>
                            <td data-no-translate="">{descItem}</td>
                            <td>
                              {podeEditar ? (
                                <input
                                  type="text"
                                  maxLength={4}
                                  className="fat-cell-input"
                                  value={it.codigoFiscal || ''}
                                  onChange={(e) => atualizarItem(idx, { codigoFiscal: e.target.value })}
                                />
                              ) : (
                                it.codigoFiscal || '-'
                              )}
                            </td>
                            <td>
                              {podeEditar ? (
                                <div className="clientes-cep-input">
                                  <input
                                    type="text"
                                    maxLength={10}
                                    className="fat-cell-input"
                                    value={it.classificacaoFiscal || ''}
                                    onChange={(e) => atualizarItem(idx, { classificacaoFiscal: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    className="icon-button module-action-button clientes-cep-search"
                                    title="Consultar NCM (F3)"
                                    aria-label="Consultar NCM"
                                    onClick={() =>
                                      abrirTribHelp(idx, 'ClassificacaoFiscal', 'Consultar NCM / Classificação Fiscal', 'classificacaoFiscal')
                                    }
                                  >
                                    <IoSearchOutline size={14} />
                                  </button>
                                </div>
                              ) : (
                                it.classificacaoFiscal || '-'
                              )}
                            </td>
                            <td data-no-translate="">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  maxLength={8}
                                  className="fat-cell-input"
                                  value={it.codigoLote || ''}
                                  onChange={(e) => atualizarItem(idx, { codigoLote: e.target.value })}
                                />
                              ) : (
                                it.codigoLote || '-'
                              )}
                            </td>
                            <td>{formatDecimalBr(it.qtdMaterial, 3)}</td>
                            <td>{it.unidMedida || '-'}</td>
                            <td>
                              {podeEditar ? (
                                <DecimalInput
                                  decimals={4}
                                  minDecimals={2}
                                  className="fat-cell-input"
                                  value={it.valorUnitario}
                                  onChange={(unit) =>
                                    atualizarItem(idx, {
                                      valorUnitario: unit,
                                      valorTotalItem: Math.round(it.qtdMaterial * unit * 100) / 100,
                                    })
                                  }
                                />
                              ) : (
                                formatDecimalBr(it.valorUnitario, 4, 2)
                              )}
                            </td>
                            <td>{formatCurrencyBr(totalItem)}</td>
                            <td>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setItemTribIdx(idx)}
                              >
                                <IoEyeOutline size={15} />
                                Tributação
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {aba === 'ocorrencias' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Histórico de ocorrências SEFAZ">
                  <table className="clientes-table">
                    <thead>
                      <tr>
                        <th>Seq.</th>
                        <th>Data / Hora</th>
                        <th>Código</th>
                        <th>Descrição SEFAZ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.ocorrencias.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Nenhuma ocorrência registrada para esta nota.</td>
                        </tr>
                      ) : (
                        detalhe.ocorrencias.map((oc) => (
                          <tr key={oc.numOcorrencia}>
                            <td>{oc.numOcorrencia}</td>
                            <td>{`${toBrDateFromIso(oc.dataOcorrencia)} ${oc.horaOcorrencia ?? ''}`}</td>
                            <td>{oc.codigoOcorrencia}</td>
                            <td data-no-translate="">{oc.descrOcorrencia}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {aba === 'cce' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Cartas de correção emitidas">
                  <table className="clientes-table">
                    <thead>
                      <tr>
                        <th>Seq.</th>
                        <th>Data</th>
                        <th>Protocolo</th>
                        <th>Texto da Correção</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.cartasCorrecao.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Nenhuma Carta de Correção registrada.</td>
                        </tr>
                      ) : (
                        detalhe.cartasCorrecao.map((cc) => (
                          <tr key={cc.numCorrecao}>
                            <td>{cc.numCorrecao}</td>
                            <td>{toBrDateFromIso(cc.dataCorrecao)}</td>
                            <td data-no-translate="">{cc.protocoloCce || '-'}</td>
                            <td data-no-translate="">{cc.motivoCorrecao || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </form>

        <footer className="modal-card__footer">
          {podeEditar && (
            <button type="submit" form={formId} className="primary-button" disabled={salvando || loading}>
              <IoCheckmarkOutline size={16} />
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
            Fechar
          </button>
        </footer>
      </article>

      {itemTribIdx !== null && itens[itemTribIdx] && (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tribTitleId}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setItemTribIdx(null);
          }}
        >
          {(() => {
            const it = itens[itemTribIdx];
            const setField = (patch: Partial<NotaFiscalItemAlteracaoDto>) => atualizarItem(itemTribIdx, patch);
            return (
              <article className="modal-card modal-card--wide">
                <header className="modal-card__header">
                  <h2 id={tribTitleId}>
                    {`Tributação do Item #${it.numItem} — ${it.codigoMaterial}`}
                  </h2>
                  <ModalHeaderActions onClose={() => setItemTribIdx(null)} />
                </header>
                <div className="module-form fat-modal-body">
                  <div className="fat-stack">
                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">Dados do Item e Valores Acessórios</legend>
                      <div className="form-grid-3">
                        <label className="form-grid-3__span2">
                          <span>Descrição Complementar / Material</span>
                          <input
                            type="text"
                            maxLength={60}
                            value={it.descricaoComplem ?? it.descricaoMaterial ?? ''}
                            readOnly={!podeEditar}
                            onChange={(e) => setField({ descricaoComplem: e.target.value })}
                            data-no-translate=""
                          />
                        </label>
                        <label>
                          <span>Qtd × Unitário = Total</span>
                          <input
                            type="text"
                            value={`${formatDecimalBr(it.qtdMaterial, 3)} ${it.unidMedida || ''} × ${formatCurrencyBr(it.valorUnitario)} = ${formatCurrencyBr(it.valorTotalItem ?? it.qtdMaterial * it.valorUnitario)}`}
                            readOnly
                          />
                        </label>

                        <label>
                          <span>CFOP</span>
                          <input
                            type="text"
                            maxLength={4}
                            value={it.codigoFiscal ?? ''}
                            readOnly={!podeEditar}
                            onChange={(e) => setField({ codigoFiscal: e.target.value })}
                          />
                        </label>
                        <label>
                          <span>NCM (Classificação Fiscal)</span>
                          <div className="clientes-cep-input">
                            <input
                              type="text"
                              maxLength={10}
                              value={it.classificacaoFiscal ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ classificacaoFiscal: e.target.value })}
                            />
                            {podeEditar && (
                              <button
                                type="button"
                                className="icon-button module-action-button clientes-cep-search"
                                title="Consultar NCM (F3)"
                                aria-label="Consultar NCM"
                                onClick={() =>
                                  abrirTribHelp(itemTribIdx, 'ClassificacaoFiscal', 'Consultar NCM / Classificação Fiscal', 'classificacaoFiscal')
                                }
                              >
                                <IoSearchOutline size={16} />
                              </button>
                            )}
                          </div>
                        </label>
                        <label>
                          <span>CEST / NVE / FCI</span>
                          <div className="form-grid-3">
                            <input
                              type="text"
                              maxLength={7}
                              placeholder="CEST"
                              aria-label="CEST"
                              value={it.codigoCest ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ codigoCest: e.target.value })}
                            />
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="NVE"
                              aria-label="NVE"
                              value={it.codificacaoNve ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ codificacaoNve: e.target.value })}
                            />
                            <input
                              type="text"
                              maxLength={36}
                              placeholder="FCI"
                              aria-label="FCI"
                              value={it.numDocumentoFci ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ numDocumentoFci: e.target.value })}
                            />
                          </div>
                        </label>

                        <label>
                          <span>Ped. Cliente / Lote</span>
                          <div className="form-grid-2">
                            <input
                              type="text"
                              maxLength={22}
                              placeholder="Pedido"
                              aria-label="Pedido do Cliente"
                              value={it.numPedidoCliente ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ numPedidoCliente: e.target.value })}
                            />
                            <input
                              type="text"
                              maxLength={8}
                              placeholder="Lote"
                              aria-label="Lote"
                              value={it.codigoLote ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ codigoLote: e.target.value })}
                            />
                          </div>
                        </label>
                        <label className="form-grid-3__span2">
                          <span>Frete / Seguro / Outras / Desc. Item</span>
                          <div className="form-grid-4">
                            <DecimalInput decimals={2} ariaLabel="Frete Item" value={it.valorFrete ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorFrete: v })} />
                            <DecimalInput decimals={2} ariaLabel="Seguro Item" value={it.valorSeguro ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorSeguro: v })} />
                            <DecimalInput decimals={2} ariaLabel="Outras Despesas Item" value={it.valorOutrasDesp ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorOutrasDesp: v })} />
                            <DecimalInput decimals={2} ariaLabel="Desconto Item" value={it.valorDesconto ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorDesconto: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">ICMS</legend>
                      <div className="form-grid-3">
                        <label>
                          <span>Origem / CSOSN</span>
                          <div className="form-grid-2">
                            <input
                              type="text"
                              maxLength={1}
                              aria-label="Origem"
                              value={it.origemMercadoria ?? '0'}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ origemMercadoria: e.target.value })}
                            />
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                maxLength={3}
                                aria-label="CSOSN"
                                value={it.codigoCsosn ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ codigoCsosn: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CSOSN (F3)"
                                  aria-label="Consultar CSOSN"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'CSOSN', 'Consultar CSOSN', 'codigoCsosn')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </label>
                        <label>
                          <span>cBenef</span>
                          <div className="clientes-cep-input">
                            <input
                              type="text"
                              value={it.codigoCbenef ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ codigoCbenef: e.target.value })}
                            />
                            {podeEditar && (
                              <button
                                type="button"
                                className="icon-button module-action-button clientes-cep-search"
                                title="Consultar cBenef (F3)"
                                aria-label="Consultar cBenef"
                                onClick={() =>
                                  abrirTribHelp(itemTribIdx, 'CBenef', 'Consultar Código Benefício Fiscal (cBenef)', 'codigoCbenef', it.tributacaoIcms || undefined)
                                }
                              >
                                <IoSearchOutline size={16} />
                              </button>
                            )}
                          </div>
                        </label>
                        <label>
                          <span>CST ICMS / % Base ICMS</span>
                          <div className="form-grid-2">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                maxLength={2}
                                aria-label="CST ICMS"
                                value={it.tributacaoIcms ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ tributacaoIcms: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST ICMS (F3)"
                                  aria-label="Consultar CST ICMS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'ICMS', 'Consultar Tributação ICMS', 'tributacaoIcms')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <DecimalInput decimals={2} ariaLabel="% Base ICMS" value={it.percBaseIcms} readOnly={!podeEditar} onChange={(v) => setField({ percBaseIcms: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Base ICMS / Alíq. (%)</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="Base ICMS" value={it.valorBaseIcms} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIcms: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíquota ICMS" value={it.aliquotaIcms} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIcms: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Valor ICMS / Desonerado</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="Valor ICMS" value={it.valorIcms} readOnly={!podeEditar} onChange={(v) => setField({ valorIcms: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor ICMS Desonerado" value={it.valorIcmsDeson ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIcmsDeson: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">ICMS ST</legend>
                      <div className="form-grid-2">
                        <label>
                          <span>MVA (%) / Alíq. ICMS ST (%)</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="MVA (%)" value={it.percMva ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ percMva: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíquota ICMS ST (%)" value={it.aliquotaIcmsSubst ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIcmsSubst: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Base / Valor ICMS ST</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="Base ICMS ST" value={it.valorBaseIcmsSubst} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIcmsSubst: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor ICMS ST" value={it.valorIcmsSubst} readOnly={!podeEditar} onChange={(v) => setField({ valorIcmsSubst: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">DIFAL / FCP</legend>
                      <div className="form-grid-3">
                        <label>
                          <span>DIFAL Dest. / Remet. / FCP</span>
                          <div className="form-grid-3">
                            <DecimalInput decimals={2} ariaLabel="ICMS Destino" value={it.valorIcmsDest ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIcmsDest: v })} />
                            <DecimalInput decimals={2} ariaLabel="ICMS Remetente" value={it.valorIcmsRemet ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIcmsRemet: v })} />
                            <DecimalInput decimals={2} ariaLabel="ICMS FCP" value={it.valorIcmsFcp ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIcmsFcp: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Alíq. Inter. / Dest. / Partilha (%)</span>
                          <div className="form-grid-3">
                            <DecimalInput decimals={2} ariaLabel="Alíq. Inter" value={it.aliquotaIcmsInter ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIcmsInter: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíq. Dest" value={it.aliquotaIcmsDest ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIcmsDest: v })} />
                            <DecimalInput decimals={2} ariaLabel="% Partilha" value={it.percPartilhaIcms ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ percPartilhaIcms: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Base DIFAL / % FCP</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="Base ICMS Destino" value={it.valorBaseIcmsDest ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIcmsDest: v })} />
                            <DecimalInput decimals={2} ariaLabel="% Adic. FCP" value={it.percAdicIcmsFcp ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ percAdicIcmsFcp: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">IPI</legend>
                      <div className="form-grid-2">
                        <label>
                          <span>CST IPI / Enq. / Alíq. (%)</span>
                          <div className="fat-trib-group__cst-row">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                maxLength={2}
                                aria-label="CST IPI"
                                value={it.tributacaoIpi ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ tributacaoIpi: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST IPI (F3)"
                                  aria-label="Consultar CST IPI"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'IPI', 'Consultar Tributação IPI', 'tributacaoIpi')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              maxLength={3}
                              aria-label="Enquadramento IPI"
                              value={it.codigoEnqIpi ?? ''}
                              readOnly={!podeEditar}
                              onChange={(e) => setField({ codigoEnqIpi: e.target.value })}
                            />
                            <DecimalInput decimals={2} ariaLabel="Alíquota IPI (%)" value={it.aliquotaIpi} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIpi: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Base IPI / Valor IPI</span>
                          <div className="form-grid-2">
                            <DecimalInput decimals={2} ariaLabel="Base IPI" value={it.valorBaseIpi} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIpi: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor IPI" value={it.valorIpi} readOnly={!podeEditar} onChange={(v) => setField({ valorIpi: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">PIS / COFINS</legend>
                      <div className="form-grid-2">
                        <label>
                          <span>CST PIS / Base / Alíq. (%)</span>
                          <div className="fat-trib-group__cst-row">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                maxLength={2}
                                aria-label="CST PIS"
                                value={it.tributacaoPis ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ tributacaoPis: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST PIS (F3)"
                                  aria-label="Consultar CST PIS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'PISCofins', 'Consultar Tributação PIS', 'tributacaoPis')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <DecimalInput decimals={2} ariaLabel="Base PIS" value={it.valorBasePis} readOnly={!podeEditar} onChange={(v) => setField({ valorBasePis: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíquota PIS (%)" value={it.aliquotaPis} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaPis: v })} />
                          </div>
                        </label>
                        <label>
                          <span>CST COFINS / Base / Alíq. (%)</span>
                          <div className="fat-trib-group__cst-row">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                maxLength={2}
                                aria-label="CST COFINS"
                                value={it.tributacaoCofins ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ tributacaoCofins: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST COFINS (F3)"
                                  aria-label="Consultar CST COFINS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'PISCofins', 'Consultar Tributação COFINS', 'tributacaoCofins')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <DecimalInput decimals={2} ariaLabel="Base COFINS" value={it.valorBaseCofins} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseCofins: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíquota COFINS (%)" value={it.aliquotaCofins} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaCofins: v })} />
                          </div>
                        </label>
                        <label>
                          <span>Valor PIS</span>
                          <DecimalInput decimals={2} ariaLabel="Valor PIS" value={it.valorPis ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorPis: v })} />
                        </label>
                        <label>
                          <span>Valor COFINS</span>
                          <DecimalInput decimals={2} ariaLabel="Valor COFINS" value={it.valorCofins ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorCofins: v })} />
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">Imposto de Importação (II)</legend>
                      <div className="form-grid-2">
                        <label className="form-grid-2__full">
                          <span>II: Alíq. / Base / Valor / Desp. Adu.</span>
                          <div className="form-grid-4">
                            <DecimalInput decimals={2} ariaLabel="Alíquota II" value={it.aliquotaIi ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIi: v })} />
                            <DecimalInput decimals={2} ariaLabel="Base II" value={it.valorBaseIi ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIi: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor II" value={it.valorIi ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIi: v })} />
                            <DecimalInput decimals={2} ariaLabel="Desp. Aduaneiras" value={it.valorDespAdu ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorDespAdu: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">IBS / CBS</legend>
                      <div className="form-grid-3">
                        <label>
                          <span>CST / cClassTrib IBS-CBS</span>
                          <div className="form-grid-2">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                aria-label="CST IBS/CBS"
                                value={it.cstIbsCbs ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ cstIbsCbs: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST IBS/CBS (F3)"
                                  aria-label="Consultar CST IBS/CBS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'CBSIBS', 'Consultar CST IBS/CBS', 'cstIbsCbs')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                aria-label="cClassTrib IBS/CBS"
                                value={it.classTribIbsCbs ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ classTribIbsCbs: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar cClassTrib IBS/CBS (F3)"
                                  aria-label="Consultar cClassTrib IBS/CBS"
                                  onClick={() =>
                                    abrirTribHelp(itemTribIdx, 'ClassTribIBSCBS', 'Consultar ClassTrib IBS/CBS', 'classTribIbsCbs', it.cstIbsCbs || undefined)
                                  }
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </label>
                        <label>
                          <span>Base IBS-CBS / IBS UF (Alíq. • Valor)</span>
                          <div className="form-grid-3">
                            <DecimalInput decimals={2} ariaLabel="Base IBS-CBS" value={it.valorBaseIbsCbs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIbsCbs: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíq. IBS UF" value={it.aliquotaIbsUf ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIbsUf: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor IBS UF" value={it.valorIbsUf ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIbsUf: v })} />
                          </div>
                        </label>
                        <label>
                          <span>IBS Mun (Alíq. • Valor) / CBS (Alíq. • Valor)</span>
                          <div className="form-grid-4">
                            <DecimalInput decimals={2} ariaLabel="Alíq. IBS Mun" value={it.aliquotaIbsMun ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIbsMun: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor IBS Mun" value={it.valorIbsMun ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIbsMun: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíq. CBS" value={it.aliquotaCbs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaCbs: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor CBS" value={it.valorCbs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorCbs: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="fat-trib-group">
                      <legend className="fat-trib-group__legend">Imposto Seletivo (IS)</legend>
                      <div className="form-grid-3">
                        <label>
                          <span>CST / cClassTrib IS</span>
                          <div className="form-grid-2">
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                aria-label="CST IS"
                                value={it.cstIs ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ cstIs: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar CST IS (F3)"
                                  aria-label="Consultar CST IS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'IS', 'Consultar CST IS', 'cstIs')}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                            <div className="clientes-cep-input">
                              <input
                                type="text"
                                aria-label="cClassTrib IS"
                                value={it.classTribIs ?? ''}
                                readOnly={!podeEditar}
                                onChange={(e) => setField({ classTribIs: e.target.value })}
                              />
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="icon-button module-action-button clientes-cep-search"
                                  title="Consultar cClassTrib IS (F3)"
                                  aria-label="Consultar cClassTrib IS"
                                  onClick={() => abrirTribHelp(itemTribIdx, 'ClassTribIS', 'Consultar ClassTrib IS', 'classTribIs', it.cstIs || undefined)}
                                >
                                  <IoSearchOutline size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </label>
                        <label className="form-grid-3__span2">
                          <span>IS: Base / Alíq. (%) / Valor</span>
                          <div className="form-grid-3">
                            <DecimalInput decimals={2} ariaLabel="Base IS" value={it.valorBaseIs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorBaseIs: v })} />
                            <DecimalInput decimals={2} ariaLabel="Alíquota IS" value={it.aliquotaIs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ aliquotaIs: v })} />
                            <DecimalInput decimals={2} ariaLabel="Valor IS" value={it.valorIs ?? 0} readOnly={!podeEditar} onChange={(v) => setField({ valorIs: v })} />
                          </div>
                        </label>
                      </div>
                    </fieldset>
                  </div>
                </div>
                <footer className="modal-card__footer">
                  <button type="button" className="secondary-button modal-card__close" onClick={() => setItemTribIdx(null)}>
                    Fechar
                  </button>
                </footer>
              </article>
            );
          })()}
        </section>
      )}

      <FaturamentoTribHelpModal
        open={tribHelp.open}
        tipo={tribHelp.tipo}
        titulo={tribHelp.titulo}
        origemParam={tribHelp.origemParam}
        onSelect={(codigo) => {
          atualizarItem(tribHelp.itemIndex, { [tribHelp.campo]: codigo } as Partial<NotaFiscalItemAlteracaoDto>);
          setTribHelp((prev) => ({ ...prev, open: false }));
        }}
        onClose={() => setTribHelp((prev) => ({ ...prev, open: false }))}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. MODAL CARTA DE CORREÇÃO ELETRÔNICA (CC-E)
// ---------------------------------------------------------------------------
interface CceModalProps {
  open: boolean;
  nota: NotaFiscalGerenciadorItemDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FaturamentoCceModal({ open, nota, onClose, onSuccess }: CceModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, inputClass, error } = useRequiredFields();
  const [dataCorrecao, setDataCorrecao] = useState(getTodayBr);
  const [horaCorrecao, setHoraCorrecao] = useState(getNowHm);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msgConfirmaMenor, setMsgConfirmaMenor] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const now = new Date();
      setDataCorrecao(getTodayBr());
      setHoraCorrecao(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setTexto('');
      setMsgConfirmaMenor(null);
      reset();
    }
  }, [open, reset]);

  if (!open || !nota) return null;

  const enviar = async (confirmarMenor = false) => {
    if (!validate([dataCorrecao, texto])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }
    if (texto.trim().length < 15) {
      showToast('A correção deve conter ao menos 15 caracteres.', 'info');
      return;
    }

    setSalvando(true);
    try {
      const res = await emitirCartaCorrecao({
        numNotaFiscal: nota.numNotaFiscal,
        serNotaFiscal: nota.serNotaFiscal,
        dataCorrecao: toIsoDateFromBr(dataCorrecao) || new Date().toISOString().slice(0, 10),
        horaCorrecao,
        textoCorrecao: texto.trim(),
        confirmarSubstituicaoMenor: confirmarMenor,
      });
      if (res.exigeConfirmacao) {
        setMsgConfirmaMenor(res.mensagem);
        return;
      }
      showToast(res.mensagem || 'Carta de Correção transmitida com sucesso.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao emitir Carta de Correção.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>{`Carta de Correção (CC-e) - NF ${nota.numNotaFiscal}/${nota.serNotaFiscal}`}</h2>
          <ModalHeaderActions onClose={onClose} expandable={false} disabled={salvando} />
        </header>

        <form
          id={formId}
          className="module-form fat-modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(Boolean(msgConfirmaMenor));
          }}
          noValidate
        >
          <div className="form-grid-2">
            <label>
              <span>Data do Evento *</span>
              <CustomDatePicker value={dataCorrecao} onChange={setDataCorrecao} />
              {error(dataCorrecao)}
            </label>
            <label>
              <span>Hora</span>
              <CustomTimePicker value={horaCorrecao} onChange={setHoraCorrecao} />
            </label>
            <label className="form-grid-2__full">
              <span>Texto da Correção (mínimo 15 caracteres) *</span>
              <textarea
                rows={4}
                value={texto}
                className={inputClass(texto)}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setMsgConfirmaMenor(null);
                }}
                placeholder="Digite o texto completo da correção fiscal..."
              />
              {error(texto)}
            </label>
          </div>

          {msgConfirmaMenor && <p className="fat-warning-box">{msgConfirmaMenor}</p>}

        </form>

        <footer className="modal-card__footer">
          <button type="submit" form={formId} className="primary-button" disabled={salvando}>
            <IoSendOutline size={16} />
            {salvando ? 'Transmitindo...' : msgConfirmaMenor ? 'Sim, substituir CC-e anterior' : 'Transmitir CC-e'}
          </button>
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
        </footer>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. MODAL INUTILIZAR NUMERAÇÃO
// ---------------------------------------------------------------------------
interface InutilizarModalProps {
  open: boolean;
  combos: FaturamentoCombosDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FaturamentoInutilizarModal({ open, combos, onClose, onSuccess }: InutilizarModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, wrapperClass, inputClass, error } = useRequiredFields();
  const [serie, setSerie] = useState('');
  const [numInicial, setNumInicial] = useState('');
  const [numFinal, setNumFinal] = useState('');
  const [codMotivo, setCodMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setSerie(combos?.seriesNfe[0]?.serieNf ?? '');
      setNumInicial('');
      setNumFinal('');
      setCodMotivo('');
      setJustificativa('');
      reset();
    }
  }, [open, combos, reset]);

  if (!open) return null;

  const seriesOpts = (combos?.seriesNfe ?? []).map((s) => ({
    value: s.serieNf,
    label: `Série ${s.serieNf} (${s.tipoNotaDescricao})`,
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate([serie, numInicial, numFinal, codMotivo, justificativa])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }
    if (justificativa.trim().length < 15) {
      showToast('A justificativa na SEFAZ precisa ter ao menos 15 caracteres.', 'info');
      return;
    }

    setEnviando(true);
    try {
      const msg = await inutilizarNumeracao({
        serNotaFiscal: serie,
        numInicial: Number(numInicial),
        numFinal: Number(numFinal),
        codigoMotivo: Number(codMotivo),
        justificativa: justificativa.trim(),
      });
      showToast(msg, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao inutilizar numeração.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>Inutilizar Numeração de NF-e</h2>
          <ModalHeaderActions onClose={onClose} expandable={false} disabled={enviando} />
        </header>

        <form id={formId} className="module-form fat-modal-body" onSubmit={submit} noValidate>
          <div className="form-grid-3">
            <label>
              <span>Série NF-e *</span>
              <SearchableSelect
                className={wrapperClass(serie)}
                value={serie}
                onChange={setSerie}
                options={seriesOpts}
                searchPlaceholder="Pesquisar..."
              />
              {error(serie)}
            </label>
            <label>
              <span>Número Inicial *</span>
              <input
                type="number"
                className={inputClass(numInicial)}
                value={numInicial}
                onChange={(e) => setNumInicial(e.target.value)}
                placeholder="Ex: 1050"
              />
              {error(numInicial)}
            </label>
            <label>
              <span>Número Final *</span>
              <input
                type="number"
                className={inputClass(numFinal)}
                value={numFinal}
                onChange={(e) => setNumFinal(e.target.value)}
                placeholder="Ex: 1050"
              />
              {error(numFinal)}
            </label>
            <label className="form-grid-3__full">
              <span>Motivo *</span>
              <SearchableSelect
                className={wrapperClass(codMotivo)}
                value={codMotivo}
                onChange={(v) => {
                  setCodMotivo(v);
                  const found = combos?.motivosCancelamento.find((m) => m.value === v);
                  if (found && !justificativa.trim()) setJustificativa(found.label);
                }}
                options={combos?.motivosCancelamento ?? []}
                searchPlaceholder="Pesquisar..."
              />
              {error(codMotivo)}
            </label>
            <label className="form-grid-3__full">
              <span>Justificativa SEFAZ *</span>
              <textarea
                rows={3}
                className={inputClass(justificativa)}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Digite a justificativa da quebra de numeração (mín. 15 caracteres)..."
              />
              {error(justificativa)}
            </label>
          </div>

        </form>

        <footer className="modal-card__footer">
          <button type="submit" form={formId} className="primary-button" disabled={enviando}>
            <IoBanOutline size={16} />
            {enviando ? 'Inutilizando...' : 'Inutilizar Numeração'}
          </button>
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
        </footer>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. MODAL ALTERAR CONTINGÊNCIA SEFAZ
// ---------------------------------------------------------------------------
interface ContingenciaModalProps {
  open: boolean;
  combos: FaturamentoCombosDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CONTINGENCIA_OPTS = [
  { value: '1', label: '1 - Normal' },
  { value: '6', label: '6 - Contingência SVC-AN' },
  { value: '7', label: '7 - Contingência SVC-RS' },
  { value: '2', label: '2 - Contingência do emissor' },
  { value: '5', label: '5 - Contingência FS-DA' },
];

export function FaturamentoContingenciaModal({ open, combos, onClose, onSuccess }: ContingenciaModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, wrapperClass, error } = useRequiredFields();
  const [tipo, setTipo] = useState('1');
  const [codMotivo, setCodMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      const atual = String(combos?.contingenciaAtual ?? 1);
      setTipo(atual);
      setCodMotivo(
        Number(atual) > 1 && combos?.contingenciaMotivoAtual ? String(combos.contingenciaMotivoAtual) : '',
      );
      reset();
    }
  }, [open, combos, reset]);

  if (!open) return null;

  const isNormal = Number(tipo) <= 1;
  const motivoSelecionado = (combos?.motivosContingencia ?? []).find((m) => m.value === codMotivo);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTipo = Number(tipo);
    if (numTipo > 1 && !validate([codMotivo])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }
    setSalvando(true);
    try {
      const msg = await alterarContingenciaNfe({
        tipoContingencia: numTipo,
        codigoMotivo: numTipo > 1 && codMotivo ? Number(codMotivo) : null,
      });
      showToast(msg, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alterar contingência.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>Alterar Modo de Contingência NF-e</h2>
          <ModalHeaderActions onClose={onClose} expandable={false} disabled={salvando} />
        </header>

        <form id={formId} className="module-form fat-modal-body" onSubmit={submit} noValidate>
          <div className="form-grid-2">
            <label>
              <span>Modo de Emissão *</span>
              <SearchableSelect
                value={tipo}
                onChange={(v) => {
                  setTipo(v);
                  if (Number(v) <= 1) {
                    setCodMotivo('');
                    reset();
                  }
                }}
                options={CONTINGENCIA_OPTS}
                disabled={salvando}
                searchPlaceholder="Pesquisar..."
              />
            </label>

            <label>
              <span>{isNormal ? 'Motivo' : 'Motivo *'}</span>
              <SearchableSelect
                className={isNormal ? undefined : wrapperClass(codMotivo)}
                value={codMotivo}
                onChange={setCodMotivo}
                options={combos?.motivosContingencia ?? []}
                disabled={isNormal || salvando}
                searchPlaceholder="Pesquisar..."
              />
              {!isNormal && error(codMotivo)}
            </label>

            <label className="form-grid-2__full">
              <span>Descrição do Motivo</span>
              <textarea
                rows={4}
                readOnly
                disabled={isNormal}
                value={motivoSelecionado?.label ?? ''}
                placeholder={
                  isNormal
                    ? 'Disponível apenas quando um modo de contingência estiver selecionado.'
                    : 'Selecione um motivo acima...'
                }
                data-no-translate=""
              />
            </label>
          </div>
        </form>

        <footer className="modal-card__footer">
          <button type="submit" form={formId} className="primary-button" disabled={salvando}>
            <IoShieldCheckmarkOutline size={16} />
            {salvando ? 'Salvando...' : 'Confirmar contingência'}
          </button>
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
        </footer>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7. MODAL CANCELAR / EXCLUIR NF-E (COM CONFIRMAÇÕES DE LOTE/CP/SEM SEFAZ)
// ---------------------------------------------------------------------------
interface CancelarModalProps {
  open: boolean;
  nota: NotaFiscalGerenciadorItemDto | null;
  combos: FaturamentoCombosDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FaturamentoCancelarNotaModal({ open, nota, combos, onClose, onSuccess }: CancelarModalProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, wrapperClass, inputClass, error } = useRequiredFields();
  const [codMotivo, setCodMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [verificandoCancelada, setVerificandoCancelada] = useState(false);
  const [confirmContabil, setConfirmContabil] = useState(false);
  const [confirmCp, setConfirmCp] = useState(false);
  const [tipoConfirmacao, setTipoConfirmacao] = useState<string | null>(null);
  const [avisoConfirm, setAvisoConfirm] = useState<string | null>(null);
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);

  const jaCancelada = nota?.situacaoNota === 9;

  useEffect(() => {
    if (!open || !nota) return;
    setCodMotivo('');
    setJustificativa('');
    setConfirmContabil(false);
    setConfirmCp(false);
    setTipoConfirmacao(null);
    setAvisoConfirm(null);
    setErroBloqueio(null);
    reset();

    if (nota.situacaoNota === 9) {
      let active = true;
      setVerificandoCancelada(true);
      cancelarNotaFiscal({
        numNotaFiscal: nota.numNotaFiscal,
        serNotaFiscal: nota.serNotaFiscal,
        codigoMotivo: 0,
        justificativa: '',
        confirmarExcluirSemSefaz: false,
        apenasCancelarSemExcluir: false,
        confirmarMesmoComIntegracaoContabil: false,
        confirmarMesmoComCpQuitada: false,
      })
        .then((res) => {
          if (!active) return;
          if (res.exigeConfirmacao) {
            setTipoConfirmacao(res.tipoConfirmacao ?? 'EXCLUIR_CANCELADA');
            setAvisoConfirm(res.mensagem);
          } else if (!res.sucesso) {
            setErroBloqueio(res.mensagem || 'Esta NF-e já está cancelada e não pode ser excluída.');
          }
        })
        .catch((err: any) => {
          if (active) setErroBloqueio(err?.message || 'Esta NF-e já está cancelada e não pode ser excluída.');
        })
        .finally(() => {
          if (active) setVerificandoCancelada(false);
        });
      return () => {
        active = false;
      };
    }
  }, [open, nota, reset]);

  if (!open || !nota) return null;

  const executarCancelamento = async (opts?: { excluirSemSefaz?: boolean; apenasCancelar?: boolean }) => {
    if (!jaCancelada && !validate([codMotivo, justificativa])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }

    const excluirSemSefaz = Boolean(opts?.excluirSemSefaz);
    const apenasCancelar = Boolean(opts?.apenasCancelar);
    let nextContabil = confirmContabil;
    let nextCp = confirmCp;

    if (tipoConfirmacao === 'LOTE_CONTABIL' || tipoConfirmacao === 'CONFIRMAR_CONTABIL') nextContabil = true;
    if (tipoConfirmacao === 'CP_QUITADA' || tipoConfirmacao === 'CONFIRMAR_CP_QUITADA') nextCp = true;

    setCancelando(true);
    try {
      const res = await cancelarNotaFiscal({
        numNotaFiscal: nota.numNotaFiscal,
        serNotaFiscal: nota.serNotaFiscal,
        codigoMotivo: jaCancelada ? 0 : Number(codMotivo),
        justificativa: jaCancelada ? '' : justificativa.trim(),
        confirmarExcluirSemSefaz: excluirSemSefaz,
        apenasCancelarSemExcluir: apenasCancelar,
        confirmarMesmoComIntegracaoContabil: nextContabil,
        confirmarMesmoComCpQuitada: nextCp,
      });

      if (res.exigeConfirmacao) {
        if (res.tipoConfirmacao === 'LOTE_CONTABIL' || res.tipoConfirmacao === 'CONFIRMAR_CONTABIL') {
          setConfirmContabil(true);
        }
        if (res.tipoConfirmacao === 'CP_QUITADA' || res.tipoConfirmacao === 'CONFIRMAR_CP_QUITADA') {
          setConfirmCp(true);
        }
        setTipoConfirmacao(res.tipoConfirmacao ?? null);
        setAvisoConfirm(res.mensagem);
        return;
      }

      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível cancelar a nota fiscal.', 'error');
        return;
      }

      showToast(res.mensagem || 'Nota fiscal cancelada com sucesso.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cancelar nota fiscal.', 'error');
    } finally {
      setCancelando(false);
    }
  };

  const confirmar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (jaCancelada) {
      await executarCancelamento({ excluirSemSefaz: true, apenasCancelar: false });
      return;
    }
    await executarCancelamento();
  };

  const perguntaExcluirSemAuth = tipoConfirmacao === 'EXCLUIR_SEM_AUTORIZACAO';
  const perguntaExcluirCancelada = jaCancelada && tipoConfirmacao === 'EXCLUIR_CANCELADA';

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>
            {jaCancelada
              ? `Excluir NF-e Cancelada ${nota.numNotaFiscal}/${nota.serNotaFiscal}`
              : `Cancelar NF-e ${nota.numNotaFiscal}/${nota.serNotaFiscal}`}
          </h2>
          <ModalHeaderActions onClose={onClose} expandable={false} disabled={cancelando} />
        </header>

        <form id={formId} className="module-form fat-modal-body" onSubmit={confirmar} noValidate>
          <div className="fat-subpanel__head">
            <p className="fat-hint-text">
              {`Destinatário: ${nota.nomeDestinatario} • Valor: ${formatCurrencyBr(nota.valorTotalNota)}`}
            </p>
            <StatusBadge label={nota.situacaoDescricao} />
          </div>

          {!jaCancelada && (
            <div className="form-grid-2">
              <label className="form-grid-2__full">
                <span>Motivo do Cancelamento *</span>
                <SearchableSelect
                  className={wrapperClass(codMotivo)}
                  value={codMotivo}
                  onChange={(v) => {
                    setCodMotivo(v);
                    setConfirmContabil(false);
                    setConfirmCp(false);
                    setTipoConfirmacao(null);
                    setAvisoConfirm(null);
                    const found = combos?.motivosCancelamento.find((m) => m.value === v);
                    if (found && !justificativa.trim()) setJustificativa(found.label);
                  }}
                  options={combos?.motivosCancelamento ?? []}
                  searchPlaceholder="Pesquisar..."
                />
                {error(codMotivo)}
              </label>
              <label className="form-grid-2__full">
                <span>Justificativa SEFAZ *</span>
                <textarea
                  rows={3}
                  className={inputClass(justificativa)}
                  value={justificativa}
                  onChange={(e) => {
                    setJustificativa(e.target.value);
                  }}
                  placeholder="Digite a justificativa (mín. 15 caracteres para cancelamento na SEFAZ)..."
                />
                {error(justificativa)}
              </label>
            </div>
          )}

          {verificandoCancelada && <p className="fat-hint-text">Verificando situação da NF-e...</p>}
          {erroBloqueio && <p className="fat-warning-box">{erroBloqueio}</p>}
          {avisoConfirm && <p className="fat-warning-box">{avisoConfirm}</p>}
        </form>

        <footer className="modal-card__footer">
          {perguntaExcluirSemAuth ? (
            <>
              <button
                type="button"
                className="primary-button primary-button--danger"
                onClick={() => executarCancelamento({ excluirSemSefaz: true, apenasCancelar: false })}
                disabled={cancelando}
              >
                <IoDocumentTextOutline size={16} />
                {cancelando ? 'Processando...' : 'Sim, cancelar e excluir'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => executarCancelamento({ excluirSemSefaz: false, apenasCancelar: true })}
                disabled={cancelando}
              >
                <IoBanOutline size={16} />
                Não, apenas cancelar
              </button>
            </>
          ) : perguntaExcluirCancelada ? (
            <button type="submit" form={formId} className="primary-button primary-button--danger" disabled={cancelando}>
              <IoDocumentTextOutline size={16} />
              {cancelando ? 'Excluindo...' : 'Sim, excluir NF-e'}
            </button>
          ) : (
            !jaCancelada && (
              <button type="submit" form={formId} className="primary-button primary-button--danger" disabled={cancelando}>
                <IoDocumentTextOutline size={16} />
                {cancelando ? 'Cancelando...' : avisoConfirm ? 'Sim, confirmar cancelamento' : 'Cancelar NF-e'}
              </button>
            )
          )}
          <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={cancelando}>
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}
