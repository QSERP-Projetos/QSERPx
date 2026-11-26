import { useEffect, useId, useState } from 'react';
import {
  IoCheckmarkCircleOutline,
  IoDocumentTextOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { DecimalInput, formatDecimalBr } from '../../../components/DecimalInput';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';
import {
  confirmarEmissaoVenda,
  formatCurrencyBr,
  getNowHm,
  obterProximoNumeroSerie,
  prepararEmissaoVenda,
  salvarParcelasFinalizar,
  toBrDateFromIso,
  toIsoDateFromBr,
  type ComponenteTerceiroMatDto,
  type EmissaoVendaItemDto,
  type EmissaoVendaPrepDto,
  type FaturamentoCombosDto,
  type PagamentoAntecipadoDisponivelDto,
  type ParcelaDuplicataDto,
  type TerceiroSelecaoInputDto,
} from '../../../services/faturamentoApi';

interface Props {
  open: boolean;
  numSeparacao: number | null;
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
  { value: '9', label: '9 - Não presencial (Outros)' },
];

export function FaturamentoEmissaoVendaModal({ open, numSeparacao, combos, onClose, onEmitida }: Props) {
  const { showToast } = useToast();
  const titleId = useId();
  const formId = useId();
  const { validate, reset, wrapperClass, error } = useRequiredFields();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [prep, setPrep] = useState<EmissaoVendaPrepDto | null>(null);
  const [aba, setAba] = useState<'geral' | 'itens' | 'transporte' | 'antecipados' | 'terceiros'>('geral');

  // Campos editáveis
  const [serieNf, setSerieNf] = useState('');
  const [proximoNumero, setProximoNumero] = useState(0);
  const [destino, setDestino] = useState<'2' | '3'>('3');
  const [codigoCfo, setCodigoCfo] = useState('');
  const [dataSaida, setDataSaida] = useState('');
  const [horaSaida, setHoraSaida] = useState('');
  const [responsavelFrete, setResponsavelFrete] = useState('9');
  const [codigoTransportadora, setCodigoTransportadora] = useState('');
  const [respRedespacho, setRespRedespacho] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [qtdVolumes, setQtdVolumes] = useState(0);
  const [especieVolumes, setEspecieVolumes] = useState('');
  const [marcaVolumes, setMarcaVolumes] = useState('');
  const [numeracaoVolumes, setNumeracaoVolumes] = useState('');
  const [pesoBruto, setPesoBruto] = useState(0);
  const [pesoLiquido, setPesoLiquido] = useState(0);
  const [valorFrete, setValorFrete] = useState(0);
  const [valorSeguro, setValorSeguro] = useState(0);
  const [outrasDespesas, setOutrasDespesas] = useState(0);
  const [percDesconto, setPercDesconto] = useState(0);
  const [indicadorPresenca, setIndicadorPresenca] = useState('9');
  const [codigoLocalEmbarque, setCodigoLocalEmbarque] = useState('');
  const [observacao, setObservacao] = useState('');

  // Transporte Retenção
  const [valorTransporte, setValorTransporte] = useState(0);
  const [baseIcmsTranspRet, setBaseIcmsTranspRet] = useState(0);
  const [aliqIcmsTranspRet, setAliqIcmsTranspRet] = useState(0);
  const [valorIcmsTranspRet, setValorIcmsTranspRet] = useState(0);
  const [cfopTransporte, setCfopTransporte] = useState('');

  const [itens, setItens] = useState<EmissaoVendaItemDto[]>([]);
  const [antecipados, setAntecipados] = useState<PagamentoAntecipadoDisponivelDto[]>([]);
  const [autoTerceiros, setAutoTerceiros] = useState(true);
  const [componentesTerc, setComponentesTerc] = useState<ComponenteTerceiroMatDto[]>([]);
  const [msgConfirmaDiverg, setMsgConfirmaDiverg] = useState<string | null>(null);

  // Etapa pós-emissão: edição de parcelas
  const [etapaParcelas, setEtapaParcelas] = useState<{
    numNotaFiscal: string;
    serNotaFiscal: string;
    valorTotalNota: number;
    parcelas: ParcelaDuplicataDto[];
    mensagemCentavos?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !numSeparacao) return;
    let active = true;
    setLoading(true);
    setEtapaParcelas(null);
    setMsgConfirmaDiverg(null);
    setAba('geral');
    reset();

    void prepararEmissaoVenda(numSeparacao)
      .then((d) => {
        if (!active) return;
        setPrep(d);
        setSerieNf(d.serieSelecionada);
        setProximoNumero(d.proximoNumeroNf);
        setDestino(d.situacaoDestinoPadrao === 2 ? '2' : '3');
        setCodigoCfo(d.codigoCfo || '');
        setDataSaida(toBrDateFromIso(d.dataSaida || d.dataEmissao));
        setHoraSaida(d.horaSaida || getNowHm());
        setResponsavelFrete(String(d.responsavelFrete ?? 9));
        setCodigoTransportadora(d.codigoTransportadora ? String(d.codigoTransportadora) : '');
        setRespRedespacho(d.respRedespacho ? String(d.respRedespacho) : '');
        setPlacaVeiculo(d.placaVeiculo || '');
        setQtdVolumes(d.qtdVolumes);
        setEspecieVolumes(d.especieVolumes || '');
        setMarcaVolumes(d.marcaVolumes || '');
        setNumeracaoVolumes(d.numeracaoVolumes || '');
        setPesoBruto(d.pesoBruto);
        setPesoLiquido(d.pesoLiquido);
        setValorFrete(d.valorFrete);
        setValorSeguro(d.valorSeguro);
        setOutrasDespesas(d.outrasDespesas);
        setPercDesconto(d.percDesconto);
        setIndicadorPresenca(String(d.indicadorPresenca ?? 9));
        setCodigoLocalEmbarque(d.codigoLocalEmbarque ? String(d.codigoLocalEmbarque) : '');
        setObservacao(d.observacao || '');
        setValorTransporte(d.valorTransporte ?? 0);
        setBaseIcmsTranspRet(d.baseIcmsTranspRet ?? 0);
        setAliqIcmsTranspRet(d.aliquotaIcmsTranspRet ?? 0);
        setValorIcmsTranspRet(d.valorIcmsTranspRet ?? 0);
        setCfopTransporte(d.cfopTransporte || '');
        setItens(d.itens);
        setAntecipados(d.pagamentosAntecipados);
        setAutoTerceiros(!d.selecionarNfsRetorno);
        setComponentesTerc(d.componentesTerceiro);
      })
      .catch((err: any) => {
        if (active) showToast(err?.message || 'Erro ao carregar emissão de venda.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, numSeparacao, reset, showToast]);

  if (!open || !numSeparacao) return null;

  const trocarSerie = async (novaSerie: string) => {
    setSerieNf(novaSerie);
    try {
      const info = await obterProximoNumeroSerie(novaSerie);
      setProximoNumero(info.proximoNumero);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao buscar próximo número da série.', 'error');
    }
  };

  const natOpts = (combos?.naturezasSaida ?? []).map((n) => ({
    value: n.codigoCfo,
    label: `${n.codigoCfo} - ${n.descricaoCfo}`,
  }));

  const cfoSelecionadoValido = natOpts.some((o) => o.value === codigoCfo) ? codigoCfo : '';
  const transpObrigatoria = Number(indicadorPresenca) > 1;
  const localEmbObrigatorio =
    (prep?.estadoEntrega ?? '').trim().toUpperCase() === 'EX' ||
    itens.some((i) => (i.codigoFiscal ?? '').trim().startsWith('7'));

  const trocarNatureza = (novaCfo: string) => {
    setCodigoCfo(novaCfo);
    const nat = combos?.naturezasSaida.find((n) => n.codigoCfo === novaCfo);
    if (nat?.primeiroCfop) {
      setItens((prev) => prev.map((i) => ({ ...i, codigoFiscal: nat.primeiroCfop })));
    }
  };

  const atualizarTercQtd = (matIdx: number, nfIdx: number, val: number) => {
    setComponentesTerc((prev) =>
      prev.map((m, mi) =>
        mi !== matIdx
          ? m
          : {
              ...m,
              notasRecebimento: m.notasRecebimento.map((nr, ni) => (ni === nfIdx ? { ...nr, qtdRetornar: val } : nr)),
            },
      ),
    );
  };

  const emitirNota = async (confirmarDiverg = false) => {
    if (!prep) return;
    const reqs: unknown[] = [serieNf, cfoSelecionadoValido];
    if (transpObrigatoria) reqs.push(codigoTransportadora);
    if (localEmbObrigatorio) reqs.push(codigoLocalEmbarque);

    if (!validate(reqs)) {
      if ((transpObrigatoria && !codigoTransportadora) || (localEmbObrigatorio && !codigoLocalEmbarque)) {
        if (serieNf && cfoSelecionadoValido) setAba('transporte');
      }
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }

    const dtSaidaIso = toIsoDateFromBr(dataSaida);
    if (Boolean(dtSaidaIso) !== Boolean(horaSaida.trim())) {
      setAba('geral');
      showToast('Informe Data de Saída e Hora de Saída em conjunto.', 'error');
      return;
    }
    if (dtSaidaIso && prep.dataEmissao && dtSaidaIso < prep.dataEmissao.slice(0, 10)) {
      setAba('geral');
      showToast('A Data de Saída não pode ser anterior à Data de Emissão.', 'error');
      return;
    }
    if (percDesconto < 0 || percDesconto > 100) {
      setAba('geral');
      showToast('Desconto não pode ser maior que 100%!', 'error');
      return;
    }
    if (pesoBruto < 0 || pesoLiquido < 0) {
      setAba('transporte');
      showToast('Peso bruto e líquido não podem ser negativos.', 'error');
      return;
    }

    const terceirosSelecionados: TerceiroSelecaoInputDto[] = [];
    if (!autoTerceiros) {
      for (const comp of componentesTerc) {
        for (const nr of comp.notasRecebimento) {
          if (nr.qtdRetornar > 0) {
            terceirosSelecionados.push({
              codigoMaterial: comp.codigoMaterial,
              numReceb: nr.numReceb,
              qtdRetorno: nr.qtdRetornar,
            });
          }
        }
      }
    }

    setSalvando(true);
    try {
      const res = await confirmarEmissaoVenda({
        numSeparacao: prep.numSeparacao,
        serieNf,
        destino: Number(destino),
        tipoDanfe: (combos?.tipoDanfePadrao === 6 ? 6 : 5) as 5 | 6,
        dataSaida: toIsoDateFromBr(dataSaida) ?? null,
        horaSaida: horaSaida || null,
        codigoCfo: cfoSelecionadoValido,
        responsavelFrete: Number(responsavelFrete),
        codigoTransportadora: codigoTransportadora ? Number(codigoTransportadora) : null,
        respRedespacho: respRedespacho ? Number(respRedespacho) : null,
        placaVeiculo: placaVeiculo || null,
        qtdVolumes,
        especieVolumes: especieVolumes || null,
        marcaVolumes: marcaVolumes || null,
        numeracaoVolumes: numeracaoVolumes || null,
        pesoBruto,
        pesoLiquido,
        valorFrete,
        valorSeguro,
        outrasDespesas,
        percDesconto,
        indicadorPresenca: Number(indicadorPresenca),
        codigoLocalEmbarque: codigoLocalEmbarque ? Number(codigoLocalEmbarque) : null,
        observacao: observacao || null,
        valorTransporte,
        baseIcmsTranspRet,
        aliquotaIcmsTranspRet: aliqIcmsTranspRet,
        valorIcmsTranspRet,
        cfopTransporte: cfopTransporte || null,
        itensCfop: itens,
        pagamentosAntecipados: antecipados,
        selecionarTerceirosAutomaticamente: autoTerceiros,
        terceirosSelecionados,
        confirmarDivergenciaCompon: confirmarDiverg,
      });

      if (res.exigeConfirmacao) {
        setMsgConfirmaDiverg(res.mensagem);
        return;
      }

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
        res.mensagem || `NF ${res.numNotaFiscal}/${res.serNotaFiscal} gerada.`,
        sefazRejeitada ? 'error' : 'success',
      );
      onEmitida(res.numNotaFiscal, res.serNotaFiscal, res.mensagem, {
        autorizada: res.autorizadaSefaz,
        sefazOk: res.sefazOk,
        destino: Number(destino),
      });
    } catch (err: any) {
      showToast(err?.message || 'Erro ao emitir NF de Venda.', 'error');
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

  const totalProdutos = itens.reduce((acc, i) => acc + i.valorTotalItem, 0);

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <h2 id={titleId}>{`Emissão de NF de Venda - OS ${String(numSeparacao).padStart(6, '0')}`}</h2>
          <ModalHeaderActions onClose={onClose} disabled={salvando} />
        </header>

        {loading ? (
          <div className="module-form">
            <p className="module-empty">Carregando dados da Ordem de Separação...</p>
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
                {salvando
                  ? 'Finalizando...'
                  : etapaParcelas.mensagemCentavos
                    ? 'Sim, manter diferença de centavos'
                    : 'Salvar Parcelas e Transmitir NF-e'}
              </button>
              <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
                Fechar
              </button>
            </footer>
          </>
        ) : !prep ? (
          <div className="module-form">
            <p className="module-empty">Não foi possível preparar a emissão.</p>
          </div>
        ) : (
          <>
            <div className="contas-receber-tabs fat-modal-tabs" role="tablist" aria-label="Abas da emissão de venda">
              <button
                type="button"
                role="tab"
                aria-selected={aba === 'geral'}
                className={`contas-receber-tab${aba === 'geral' ? ' contas-receber-tab--active' : ''}`}
                onClick={() => setAba('geral')}
              >
                Dados Gerais
              </button>
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
                aria-selected={aba === 'transporte'}
                className={`contas-receber-tab${aba === 'transporte' ? ' contas-receber-tab--active' : ''}`}
                onClick={() => setAba('transporte')}
              >
                Transporte / Volumes
              </button>
              {antecipados.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={aba === 'antecipados'}
                  className={`contas-receber-tab${aba === 'antecipados' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setAba('antecipados')}
                >
                  {`Pgtos Antecipados (${antecipados.length})`}
                </button>
              )}
              {componentesTerc.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={aba === 'terceiros'}
                  className={`contas-receber-tab${aba === 'terceiros' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setAba('terceiros')}
                >
                  {`Terceiros (${componentesTerc.length})`}
                </button>
              )}
            </div>

            <form
              id={formId}
              className="module-form fat-modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                void emitirNota(Boolean(msgConfirmaDiverg));
              }}
              noValidate
            >
              {prep.avisoFaturamento && (
                <p className="fat-warning-box">
                  <IoWarningOutline size={16} />
                  <span>{prep.avisoFaturamento}</span>
                </p>
              )}

              {aba === 'geral' && (
                <div className="form-grid-3">
                  <label>
                    <span>Cliente</span>
                    <input type="text" value={`${prep.codigoCliente} - ${prep.nomeCliente}`} readOnly data-no-translate="" />
                  </label>
                  <label>
                    <span>Série NF-e *</span>
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
                    <span>Número NF a Gerar</span>
                    <input type="text" value={String(proximoNumero).padStart(6, '0')} readOnly />
                  </label>

                  <label>
                    <span>Destino da Emissão</span>
                    <SearchableSelect
                      value={destino}
                      onChange={(v) => setDestino(v === '2' ? '2' : '3')}
                      options={[
                        { value: '3', label: '3 - Transmitir NF-e (Definitiva)' },
                        { value: '2', label: '2 - Pré-Emissão (Aguardando Liberação)' },
                      ]}
                      searchPlaceholder="Pesquisar..."
                    />
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
                    <span>Data de Saída</span>
                    <CustomDatePicker value={dataSaida} onChange={setDataSaida} />
                  </label>
                  <label>
                    <span>Hora de Saída</span>
                    <CustomTimePicker value={horaSaida} onChange={setHoraSaida} />
                  </label>
                  <label>
                    <span>Condição de Pagamento</span>
                    <input
                      type="text"
                      value={prep.condicaoPagto ? `${prep.condicaoPagto} - ${prep.descricaoCondicaoPagto || ''}` : 'Sem condição financeira'}
                      readOnly
                    />
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
                    <DecimalInput decimals={2} value={outrasDespesas} onChange={setOutrasDespesas} />
                  </label>

                  <label>
                    <span>% Desconto Especial</span>
                    <DecimalInput decimals={2} value={percDesconto} onChange={setPercDesconto} />
                  </label>
                  <label>
                    <span>Indicador de Presença</span>
                    <SearchableSelect value={indicadorPresenca} onChange={setIndicadorPresenca} options={IND_PRES_OPTS} searchPlaceholder="Pesquisar..." />
                  </label>
                  <label>
                    <span>Total Produtos (Est.)</span>
                    <input type="text" value={formatCurrencyBr(totalProdutos)} readOnly />
                  </label>

                  <label className="form-grid-3__full">
                    <span>Observações Complementares</span>
                    <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                  </label>
                </div>
              )}

              {aba === 'itens' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Itens da Ordem de Separação">
                  <table className="clientes-table fat-table-compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>Pedido</th>
                        <th>Qtd</th>
                        <th>Unid</th>
                        <th>CFOP Item</th>
                        <th>Unitário</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it, idx) => (
                        <tr key={it.numItem}>
                          <td>{it.numItem}</td>
                          <td data-no-translate="">
                            <strong>{it.codigoMaterial}</strong>
                            <div className="fat-cell-sub">{it.descricaoMaterial}</div>
                          </td>
                          <td>{it.numPedido || '-'}</td>
                          <td>{formatDecimalBr(it.qtdSeparada, 3)}</td>
                          <td>{it.unidMedida}</td>
                          <td>
                            <input
                              type="text"
                              className="fat-cell-input"
                              value={it.codigoFiscal || ''}
                              onChange={(e) =>
                                setItens((prev) => prev.map((x, xi) => (xi === idx ? { ...x, codigoFiscal: e.target.value } : x)))
                              }
                            />
                          </td>
                          <td>{formatCurrencyBr(it.precoUnitario)}</td>
                          <td>{formatCurrencyBr(it.valorTotalItem)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aba === 'transporte' && (
                <div className="form-grid-3">
                  <label>
                    <span>Modalidade do Frete</span>
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
                    <span>Redespacho</span>
                    <SearchableSelect
                      value={respRedespacho}
                      onChange={setRespRedespacho}
                      options={[{ value: '', label: 'Nenhum' }, ...(combos?.transportadoras ?? [])]}
                      searchPlaceholder="Pesquisar..."
                    />
                  </label>
                  <label>
                    <span>Placa Veículo</span>
                    <input type="text" value={placaVeiculo} onChange={(e) => setPlacaVeiculo(e.target.value)} maxLength={8} />
                  </label>
                  <label>
                    <span>Qtd. Volumes</span>
                    <DecimalInput decimals={2} value={qtdVolumes} onChange={setQtdVolumes} />
                  </label>
                  <label>
                    <span>Espécie Volumes</span>
                    <input type="text" value={especieVolumes} onChange={(e) => setEspecieVolumes(e.target.value)} />
                  </label>
                  <label>
                    <span>Marca Volumes</span>
                    <input type="text" value={marcaVolumes} onChange={(e) => setMarcaVolumes(e.target.value)} />
                  </label>
                  <label>
                    <span>Numeração Volumes</span>
                    <input type="text" value={numeracaoVolumes} onChange={(e) => setNumeracaoVolumes(e.target.value)} />
                  </label>
                  <label>
                    <span>Peso Líquido (kg)</span>
                    <DecimalInput decimals={3} value={pesoLiquido} onChange={setPesoLiquido} />
                  </label>
                  <label>
                    <span>Peso Bruto (kg)</span>
                    <DecimalInput decimals={3} value={pesoBruto} onChange={setPesoBruto} />
                  </label>
                  <label>
                    <span>{localEmbObrigatorio ? 'Local Embarque (Exportação) *' : 'Local Embarque (Exportação)'}</span>
                    <SearchableSelect
                      className={localEmbObrigatorio ? wrapperClass(codigoLocalEmbarque) : undefined}
                      value={codigoLocalEmbarque}
                      onChange={setCodigoLocalEmbarque}
                      options={[{ value: '', label: 'Não informado' }, ...(combos?.locaisEmbarque ?? [])]}
                      searchPlaceholder="Pesquisar..."
                    />
                    {localEmbObrigatorio && error(codigoLocalEmbarque)}
                  </label>
                  <label>
                    <span>CFOP Retenção Transporte</span>
                    <input type="text" value={cfopTransporte} onChange={(e) => setCfopTransporte(e.target.value)} maxLength={4} />
                  </label>
                  <label>
                    <span>Valor Serviço Transp.</span>
                    <DecimalInput decimals={2} value={valorTransporte} onChange={setValorTransporte} />
                  </label>
                  <label>
                    <span>Base ICMS Transp. Ret.</span>
                    <DecimalInput decimals={2} value={baseIcmsTranspRet} onChange={setBaseIcmsTranspRet} />
                  </label>
                  <label>
                    <span>% Aliq. / Valor ICMS Ret.</span>
                    <div className="form-grid-2">
                      <DecimalInput decimals={2} value={aliqIcmsTranspRet} onChange={setAliqIcmsTranspRet} />
                      <DecimalInput decimals={2} value={valorIcmsTranspRet} onChange={setValorIcmsTranspRet} />
                    </div>
                  </label>
                </div>
              )}

              {aba === 'antecipados' && (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Notas de pagamento antecipado disponíveis">
                  <table className="clientes-table">
                    <thead>
                      <tr>
                        <th>Vincular</th>
                        <th>NF Antecipada</th>
                        <th>Emissão</th>
                        <th>Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {antecipados.map((pg, idx) => (
                        <tr key={`${pg.numNotaFiscal}-${pg.serNotaFiscal}`}>
                          <td>
                            <input
                              type="checkbox"
                              checked={pg.selecionado}
                              onChange={(e) =>
                                setAntecipados((prev) =>
                                  prev.map((x, xi) => (xi === idx ? { ...x, selecionado: e.target.checked } : x)),
                                )
                              }
                            />
                          </td>
                          <td>{`${pg.numNotaFiscal}/${pg.serNotaFiscal}`}</td>
                          <td>{toBrDateFromIso(pg.dataEmissao)}</td>
                          <td>{formatCurrencyBr(pg.valorTotalNota)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aba === 'terceiros' && (
                <div>
                  <label className="fat-checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoTerceiros}
                      onChange={(e) => setAutoTerceiros(e.target.checked)}
                    />
                    <span>Selecionar automaticamente notas de terceiros (PEPS)</span>
                  </label>
                  {!autoTerceiros &&
                    componentesTerc.map((mat, matIdx) => (
                      <div key={mat.codigoMaterial} className="fat-subpanel">
                        <strong>{`${mat.codigoMaterial} - ${mat.descricaoMaterial} (Necessário: ${formatDecimalBr(mat.qtdNecessaria, 3)} ${mat.unidMedida})`}</strong>
                        <div className="table-scroll">
                          <table className="clientes-table fat-table-compact">
                            <thead>
                              <tr>
                                <th>Recebimento</th>
                                <th>NF Origem</th>
                                <th>Data</th>
                                <th>Saldo Disp.</th>
                                <th>Qtd Retornar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mat.notasRecebimento.map((nr, nrIdx) => (
                                <tr key={nr.numReceb}>
                                  <td>{nr.numReceb}</td>
                                  <td>{`${nr.numNfReceb || '-'}/${nr.serNfReceb || '-'}`}</td>
                                  <td>{toBrDateFromIso(nr.dataReceb)}</td>
                                  <td>{formatDecimalBr(nr.saldoDisponivel, 3)}</td>
                                  <td>
                                    <DecimalInput
                                      decimals={3}
                                      className="fat-cell-input"
                                      value={nr.qtdRetornar}
                                      onChange={(val) => atualizarTercQtd(matIdx, nrIdx, val)}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {msgConfirmaDiverg && <p className="fat-warning-box">{msgConfirmaDiverg}</p>}

            </form>

            <footer className="modal-card__footer">
              <button type="submit" form={formId} className="primary-button" disabled={salvando}>
                <IoDocumentTextOutline size={16} />
                {salvando ? 'Emitindo NF...' : msgConfirmaDiverg ? 'Sim, emitir mesmo assim' : 'Confirmar e Emitir NF-e'}
              </button>
              <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={salvando}>
                Cancelar
              </button>
            </footer>
          </>
        )}
      </article>
    </section>
  );
}
