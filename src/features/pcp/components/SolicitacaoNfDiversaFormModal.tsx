import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoAddOutline,
  IoBarcodeOutline,
  IoCalculatorOutline,
  IoCheckmarkDoneOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoLockClosedOutline,
  IoSaveOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';
import {
  adicionarItemSolicitacaoNfDiversa,
  adicionarServicoSolicitacaoNfDiversa,
  atualizarItemSolicitacaoNfDiversa,
  atualizarServicoSolicitacaoNfDiversa,
  atualizarSolicitacaoNfDiversa,
  buscarMateriaisSolicitacaoNfDiversa,
  calcularPesoSolicitacaoNfDiversa,
  cancelarSolicitacaoNfDiversa,
  confirmarSolicitacaoNfDiversa,
  criarSolicitacaoNfDiversa,
  excluirItemSolicitacaoNfDiversa,
  excluirServicoSolicitacaoNfDiversa,
  formatCurrencyBr,
  formatNumberBr,
  getTodayBr,
  incluirEmbalagemSolicitacaoNfDiversa,
  obterDetalheSolicitacaoNfDiversa,
  obterInfoMaterialSolicitacaoNfDiversa,
  obterLotesSolicitacaoNfDiversa,
  parseDecimalInput,
  toBrDateFromIso,
  toIsoDateFromBr,
  type SolicitacaoNfDiversaCombos,
  type SolicitacaoNfDiversaComboOpcao,
  type SolicitacaoNfDiversaDetalhe,
  type SolicitacaoNfDiversaItem,
  type SolicitacaoNfDiversaLoteDisponivel,
  type SolicitacaoNfDiversaMaterialInfo,
} from '../../../services/solicitacaoNfDiversaApi';
import { SolicitacaoNfDiversaItemDetalhesModal } from './SolicitacaoNfDiversaItemDetalhesModal';

type ModalTab = 'geral' | 'itens' | 'servicos' | 'transporte' | 'observacoes' | 'origem';

type SolicitacaoNfDiversaFormModalProps = {
  open: boolean;
  numSolicitacaoInicial: number | null;
  somenteLeituraInicial: boolean;
  combos: SolicitacaoNfDiversaCombos | null;
  onClose: () => void;
  onChanged: () => void;
};

const ENTRADA_SAIDA_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: '1 - Entrada' },
  { value: '2', label: '2 - Saída' },
  { value: '3', label: '3 - Serviços' },
];

const TIPO_MOV_ESTOQUE_OPTIONS: SearchableSelectOption[] = [
  { value: '0', label: '0 - Sem movimento' },
  { value: '1', label: '1 - Baixar disponível' },
  { value: '2', label: '2 - Baixar bloqueado' },
];

const RESPONSAVEL_FRETE_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: '0 - Remetente' },
  { value: '2', label: '1 - Destinatário' },
  { value: '3', label: '2 - Terceiro' },
  { value: '4', label: '3 - Remetente - transporte próprio' },
  { value: '5', label: '4 - Destinatário - transporte próprio' },
  { value: '9', label: '9 - Sem transporte' },
];

const TIPO_EMBALAGEM_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: 'Pallet' },
  { value: '2', label: 'Caixa' },
];

type ConfirmacaoPendente = {
  tipo:
    | 'confirmar'
    | 'confirmar_sem_saldo'
    | 'cancelar'
    | 'excluir_item_estorno'
    | 'remover_caixa_pallet'
    | 'limpar_detalhes_lote';
  titulo: string;
  mensagem: string;
  erros?: string[];
  payload?: any;
};

export function SolicitacaoNfDiversaFormModal({
  open,
  numSolicitacaoInicial,
  somenteLeituraInicial,
  combos,
  onClose,
  onChanged,
}: SolicitacaoNfDiversaFormModalProps) {
  const { showToast } = useToast();
  const obrigCabecalho = useRequiredFields();
  const obrigItem = useRequiredFields();
  const obrigServico = useRequiredFields();

  // Refs para callbacks do pai / resets para nunca reiniciar o formulário ao digitar
  const { reset: resetObrigCabecalho } = obrigCabecalho;
  const { reset: resetObrigItem } = obrigItem;
  const { reset: resetObrigServico } = obrigServico;
  const onCloseRef = useRef(onClose);
  const showToastRef = useRef(showToast);
  onCloseRef.current = onClose;
  showToastRef.current = showToast;

  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<SolicitacaoNfDiversaDetalhe | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');

  // Campos do cabeçalho
  const [entradaSaida, setEntradaSaida] = useState<number>(2);
  const [dataSolicitacaoBr, setDataSolicitacaoBr] = useState<string>(getTodayBr());
  const [destinatarioChave, setDestinatarioChave] = useState<string>('');
  const [codigoCfo, setCodigoCfo] = useState<string>('');
  const [tipoMovimentoEstoque, setTipoMovimentoEstoque] = useState<string>('1');
  const [motivoSolicitacao, setMotivoSolicitacao] = useState<string>('');
  const [codigoTransportadora, setCodigoTransportadora] = useState<string>('');
  const [responsavelFrete, setResponsavelFrete] = useState<string>('1');
  const [placaVeiculo, setPlacaVeiculo] = useState<string>('');
  const [qtdVolumes, setQtdVolumes] = useState<string>('');
  const [especieVolumes, setEspecieVolumes] = useState<string>('');
  const [marcaVolumes, setMarcaVolumes] = useState<string>('');
  const [numeracaoVolumes, setNumeracaoVolumes] = useState<string>('');
  const [pesoBruto, setPesoBruto] = useState<string>('');
  const [pesoLiquido, setPesoLiquido] = useState<string>('');
  const [observSolicitacao, setObservSolicitacao] = useState<string>('');

  // Embalagem (Pallet/Caixa)
  const [tipoEmbalagem, setTipoEmbalagem] = useState<'1' | '2'>('1');
  const [serialEmbalagem, setSerialEmbalagem] = useState<string>('');

  // Formulário de item
  const [editandoNumItem, setEditandoNumItem] = useState<number | null>(null);
  const [itemMaterial, setItemMaterial] = useState<string>('');
  const [itemDescricaoComplem, setItemDescricaoComplem] = useState<string>('');
  const [itemLote, setItemLote] = useState<string>('');
  const [itemQtd, setItemQtd] = useState<string>('');
  const [itemUnid, setItemUnid] = useState<string>('');
  const [itemValorUnit, setItemValorUnit] = useState<string>('');
  const [itemMatInfo, setItemMatInfo] = useState<SolicitacaoNfDiversaMaterialInfo | null>(null);
  const [materiaisOpcoes, setMateriaisOpcoes] = useState<SolicitacaoNfDiversaComboOpcao[]>([]);
  const [lotesDisponiveis, setLotesDisponiveis] = useState<SolicitacaoNfDiversaLoteDisponivel[]>([]);
  const matSearchTimerRef = useRef<number | null>(null);

  // Formulário de serviço
  const [editandoNumServ, setEditandoNumServ] = useState<number | null>(null);
  const [servDescricao, setServDescricao] = useState<string>('');
  const [servQtd, setServQtd] = useState<string>('1');
  const [servValorUnit, setServValorUnit] = useState<string>('');

  // Submodal de detalhes do item (Bloqueios / Seriais / Embalagens)
  const [itemDetalhesNum, setItemDetalhesNum] = useState<number | null>(null);

  // Confirmações / avisos do Q4
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoPendente | null>(null);

  const somenteLeitura = useMemo(() => {
    if (somenteLeituraInicial) return true;
    if (!detalhe) return false;
    return detalhe.situacaoSolicitacao > 0 || !detalhe.podeEditar;
  }, [somenteLeituraInicial, detalhe]);

  const parsedDestinatario = useMemo(() => {
    if (!destinatarioChave) return { tipo: '', codigo: 0 };
    const [tipo, cod] = destinatarioChave.split(':');
    return { tipo: tipo || '', codigo: Number(cod || 0) };
  }, [destinatarioChave]);

  const preencherDoDetalhe = useCallback((d: SolicitacaoNfDiversaDetalhe) => {
    setDetalhe(d);
    setEntradaSaida(d.entradaSaida || 2);
    setDataSolicitacaoBr(toBrDateFromIso(d.dataSolicitacao) || getTodayBr());
    setDestinatarioChave(
      d.tipoDestinatario && d.codigoDestinatario ? `${d.tipoDestinatario}:${d.codigoDestinatario}` : '',
    );
    setCodigoCfo(d.codigoCfo || '');
    setTipoMovimentoEstoque(d.entradaSaida === 2 ? String(d.tipoMovimentoEstoque ?? 1) : '');
    setMotivoSolicitacao(d.motivoSolicitacao || '');
    setCodigoTransportadora(d.codigoTransportadora ? String(d.codigoTransportadora) : '');
    setResponsavelFrete(d.responsavelFrete ? String(d.responsavelFrete) : '1');
    setPlacaVeiculo(d.placaVeiculo || '');
    setQtdVolumes(d.qtdVolumes != null ? String(d.qtdVolumes).replace('.', ',') : '');
    setEspecieVolumes(d.especieVolumes || '');
    setMarcaVolumes(d.marcaVolumes || '');
    setNumeracaoVolumes(d.numeracaoVolumes || '');
    setPesoBruto(d.pesoBruto != null ? String(d.pesoBruto).replace('.', ',') : '');
    setPesoLiquido(d.pesoLiquido != null ? String(d.pesoLiquido).replace('.', ',') : '');
    setObservSolicitacao(d.observSolicitacao || '');
  }, []);

  const limparFormNovo = useCallback(() => {
    setDetalhe(null);
    setEntradaSaida(2);
    setDataSolicitacaoBr(getTodayBr());
    setDestinatarioChave('');
    setCodigoCfo('');
    setTipoMovimentoEstoque('1');
    setMotivoSolicitacao('');
    setCodigoTransportadora('');
    setResponsavelFrete('1');
    setPlacaVeiculo('');
    setQtdVolumes('');
    setEspecieVolumes('');
    setMarcaVolumes('');
    setNumeracaoVolumes('');
    setPesoBruto('');
    setPesoLiquido('');
    setObservSolicitacao('');
    setSerialEmbalagem('');
    setTipoEmbalagem('1');
  }, []);

  const limparFormItem = useCallback(() => {
    setEditandoNumItem(null);
    setItemMaterial('');
    setItemDescricaoComplem('');
    setItemLote('');
    setItemQtd('');
    setItemUnid('');
    setItemValorUnit('');
    setItemMatInfo(null);
    setLotesDisponiveis([]);
    resetObrigItem();
  }, [resetObrigItem]);

  const limparFormServico = useCallback(() => {
    setEditandoNumServ(null);
    setServDescricao('');
    setServQtd('1');
    setServValorUnit('');
    resetObrigServico();
  }, [resetObrigServico]);

  useEffect(() => {
    if (!open) return;
    resetObrigCabecalho();
    limparFormItem();
    limparFormServico();
    setActiveTab('geral');
    setConfirmacao(null);
    setItemDetalhesNum(null);

    void buscarMateriaisSolicitacaoNfDiversa('').then((lista) => setMateriaisOpcoes(lista));

    if (numSolicitacaoInicial && numSolicitacaoInicial > 0) {
      setLoadingDetalhe(true);
      void obterDetalheSolicitacaoNfDiversa(numSolicitacaoInicial)
        .then((d) => preencherDoDetalhe(d))
        .catch((err: any) => {
          showToastRef.current(err?.message || 'Erro ao carregar solicitação.', 'error');
          onCloseRef.current();
        })
        .finally(() => setLoadingDetalhe(false));
    } else {
      limparFormNovo();
    }
  }, [open, numSolicitacaoInicial, resetObrigCabecalho, limparFormItem, limparFormServico, preencherDoDetalhe, limparFormNovo]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !salvando && itemDetalhesNum === null) {
        if (confirmacao) {
          setConfirmacao(null);
        } else {
          onCloseRef.current();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, salvando, itemDetalhesNum, confirmacao]);

  const destinatariosOptions = useMemo<SearchableSelectOption[]>(() => {
    return (combos?.destinatarios ?? []).map((d) => ({
      value: d.chave,
      label: `[${d.tipoDestinatario === 'C' ? 'Cliente' : 'Fornecedor'}] ${d.nomeFantasia} (${d.codigoDestinatario})`,
    }));
  }, [combos]);

  const cfosOptions = useMemo<SearchableSelectOption[]>(() => {
    const lista = (combos?.naturezasOperacao ?? []).filter((c) => {
      if (c.entradaSaidaCfop === 0) return true;
      if (entradaSaida === 1) return c.entradaSaidaCfop === 1;
      return c.entradaSaidaCfop === 2;
    });
    return [
      { value: '', label: 'Selecione (opcional)' },
      ...lista.map((c) => ({
        value: c.codigoCfo,
        label: `${c.codigoCfo} - ${c.descricaoCfo}`,
      })),
    ];
  }, [combos, entradaSaida]);

  const transportadorasOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: 'Sem transportadora' },
      ...(combos?.transportadoras ?? []).map((t) => ({
        value: t.codigo,
        label: `${t.codigo} - ${t.descricao}`,
      })),
    ];
  }, [combos]);

  const unidadesOptions = useMemo<SearchableSelectOption[]>(() => {
    return (combos?.unidadesMedida ?? []).map((u) => ({
      value: u.codigo,
      label: `${u.codigo} - ${u.descricao}`,
    }));
  }, [combos]);

  const materiaisSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    const base: SearchableSelectOption[] = [
      { value: 'S/N', label: 'S/N - Item sem código cadastrado (descrição livre)' },
    ];
    const map = new Set<string>(['S/N']);
    for (const m of materiaisOpcoes) {
      if (!map.has(m.codigo)) {
        map.add(m.codigo);
        base.push({ value: m.codigo, label: `${m.codigo} - ${m.descricao}` });
      }
    }
    if (itemMaterial && !map.has(itemMaterial)) {
      base.unshift({
        value: itemMaterial,
        label: `${itemMaterial}${itemMatInfo?.descricaoPortug ? ` - ${itemMatInfo.descricaoPortug}` : ''}`,
      });
    }
    return base;
  }, [materiaisOpcoes, itemMaterial, itemMatInfo]);

  const lotesSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [{ value: '', label: 'Sem lote' }];
    const tipoMovNum = Number(tipoMovimentoEstoque || 0);
    for (const l of lotesDisponiveis) {
      const saldo = tipoMovNum === 2 ? l.qtdBloqueada : l.qtdDisponivel;
      const valTxt = l.dataValidade ? ` · Val. ${toBrDateFromIso(l.dataValidade)}` : '';
      opts.push({
        value: l.codigoLote,
        label: `${l.codigoLote} (Saldo: ${formatNumberBr(saldo)} ${l.unidMedEstq || ''}${valTxt})`,
      });
    }
    if (itemLote && !opts.some((o) => o.value === itemLote)) {
      opts.push({ value: itemLote, label: itemLote });
    }
    return opts;
  }, [lotesDisponiveis, tipoMovimentoEstoque, itemLote]);

  const montarPayloadCabecalho = () => ({
    entradaSaida,
    dataSolicitacao: toIsoDateFromBr(dataSolicitacaoBr) ?? null,
    motivoSolicitacao: motivoSolicitacao.trim() || null,
    codigoCfo: codigoCfo.trim() || null,
    tipoDestinatario: parsedDestinatario.tipo,
    codigoDestinatario: parsedDestinatario.codigo,
    codigoTransportadora: codigoTransportadora ? Number(codigoTransportadora) : null,
    responsavelFrete: responsavelFrete ? Number(responsavelFrete) : 1,
    placaVeiculo: placaVeiculo.trim().toUpperCase() || null,
    qtdVolumes: parseDecimalInput(qtdVolumes),
    especieVolumes: especieVolumes.trim() || null,
    pesoBruto: parseDecimalInput(pesoBruto),
    pesoLiquido: parseDecimalInput(pesoLiquido),
    tipoMovimentoEstoque: entradaSaida === 2 ? Number(tipoMovimentoEstoque || 1) : null,
    observSolicitacao: observSolicitacao.trim() || null,
    marcaVolumes: marcaVolumes.trim() || null,
    numeracaoVolumes: numeracaoVolumes.trim() || null,
  });

  const salvarCabecalho = async (
    silencioso = false,
    validarMotivo = true,
  ): Promise<SolicitacaoNfDiversaDetalhe | null> => {
    const camposObrigatorios = validarMotivo
      ? [destinatarioChave, dataSolicitacaoBr, motivoSolicitacao]
      : [destinatarioChave, dataSolicitacaoBr];
    if (!obrigCabecalho.validate(camposObrigatorios)) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      setActiveTab('geral');
      return null;
    }

    setSalvando(true);
    try {
      const payload = montarPayloadCabecalho();
      const res = detalhe
        ? await atualizarSolicitacaoNfDiversa(detalhe.numSolicitacao, payload)
        : await criarSolicitacaoNfDiversa(payload);

      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível salvar a solicitação.', 'error');
        return null;
      }

      if (res.detalhe) {
        preencherDoDetalhe(res.detalhe);
      }
      if (!silencioso) {
        showToast(res.mensagem || 'Solicitação salva com sucesso.', 'success');
      }
      onChanged();
      return res.detalhe ?? detalhe;
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar solicitação.', 'error');
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const garantirSolicitacaoCriada = async (): Promise<SolicitacaoNfDiversaDetalhe | null> => {
    if (detalhe) return detalhe;
    return salvarCabecalho(true, false);
  };

  const handleTrocarDestinatario = (novaChave: string) => {
    if (detalhe?.possuiEmbalagens) {
      showToast('Não é possível alterar o destinatário dessa solicitação porque existem embalagens selecionadas!', 'error');
      return;
    }
    setDestinatarioChave(novaChave);
    const dest = combos?.destinatarios.find((d) => d.chave === novaChave);
    if (dest) {
      if (dest.codigoTransportadora && dest.codigoTransportadora > 0) {
        setCodigoTransportadora(String(dest.codigoTransportadora));
      }
      if (dest.fretePorConta && dest.fretePorConta > 0) {
        setResponsavelFrete(String(dest.fretePorConta));
      }
    }
  };

  const handleTrocarEntradaSaida = (novoValorStr: string) => {
    const novoEs = Number(novoValorStr);
    if (detalhe?.possuiEmbalagens && novoEs !== 2) {
      showToast('Não é possível alterar essa opção porque existem embalagens selecionadas!', 'error');
      return;
    }
    if (novoEs === 3 && (detalhe?.itens.length ?? 0) > 0) {
      showToast('Notas de serviço não pode ter itens. Antes de alterar exclua os itens!', 'error');
      return;
    }
    if (codigoCfo && ((entradaSaida === 1 && novoEs !== 1) || (entradaSaida !== 1 && novoEs === 1))) {
      setCodigoCfo('');
      showToast('A Natureza de Operação foi limpa por ser incompatível com o novo tipo.', 'info');
    }
    setEntradaSaida(novoEs);
    if (novoEs === 2) {
      setTipoMovimentoEstoque((prev) => (prev ? prev : '1'));
    } else {
      setTipoMovimentoEstoque('');
    }
  };

  const handleTrocarTipoMovEstoque = (novoValor: string) => {
    if (detalhe?.possuiEmbalagens && novoValor !== '1') {
      showToast('Não é possível alterar essa opção porque existem embalagens selecionadas!', 'error');
      return;
    }
    setTipoMovimentoEstoque(novoValor);
  };

  const handlePesquisarMateriais = (termo: string) => {
    if (matSearchTimerRef.current) window.clearTimeout(matSearchTimerRef.current);
    matSearchTimerRef.current = window.setTimeout(() => {
      void buscarMateriaisSolicitacaoNfDiversa(termo).then((lista) => setMateriaisOpcoes(lista));
    }, 250);
  };

  const carregarInfoMaterialELotes = async (matCod: string, loteCod?: string) => {
    if (!matCod) {
      setItemMatInfo(null);
      setLotesDisponiveis([]);
      return;
    }
    try {
      const info = await obterInfoMaterialSolicitacaoNfDiversa({
        codigoMaterial: matCod,
        tipoDestinatario: parsedDestinatario.tipo || null,
        codigoDestinatario: parsedDestinatario.codigo || null,
        codigoCfo: codigoCfo || null,
        tipoMovimentoEstoque: entradaSaida === 2 ? Number(tipoMovimentoEstoque || 1) : null,
        numSolicitacao: detalhe?.numSolicitacao ?? null,
        codigoLote: loteCod || null,
      });

      if (!info.encontrado) {
        showToast(info.mensagem || 'Material não encontrado.', 'error');
        setItemMatInfo(null);
        return;
      }

      setItemMatInfo(info);
      if (!loteCod) {
        if (info.unidMedVenda) setItemUnid(info.unidMedVenda);
        if (info.codigoCfoPadrao && !codigoCfo) {
          setCodigoCfo(info.codigoCfoPadrao);
        }
      }
      if (info.valorUnitarioSugerido > 0) {
        setItemValorUnit(String(info.valorUnitarioSugerido).replace('.', ','));
      }

      if (info.controlarEstoque && info.controlarLote) {
        const lotes = await obterLotesSolicitacaoNfDiversa(
          matCod,
          entradaSaida === 2 ? Number(tipoMovimentoEstoque || 1) : null,
        );
        setLotesDisponiveis(lotes);
      } else {
        setLotesDisponiveis([]);
        if (!loteCod) setItemLote('');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar material.', 'error');
    }
  };

  const handleSelecionarMaterial = (matCod: string) => {
    setItemMaterial(matCod);
    setItemLote('');
    if (matCod === 'S/N') {
      setItemMatInfo(null);
      setLotesDisponiveis([]);
      if (!itemUnid) setItemUnid('UN');
      return;
    }
    void carregarInfoMaterialELotes(matCod);
  };

  const handleSelecionarLote = (novoLote: string) => {
    setItemLote(novoLote);
    if (itemMaterial && itemMaterial !== 'S/N' && novoLote) {
      void carregarInfoMaterialELotes(itemMaterial, novoLote);
    }
  };

  const handleSalvarItem = async (confirmarLimparDetalhes = false) => {
    if (!obrigItem.validate([itemMaterial, itemQtd, itemUnid, itemValorUnit])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }

    const qtdNum = parseDecimalInput(itemQtd);
    const valNum = parseDecimalInput(itemValorUnit);
    if (qtdNum === null || qtdNum < 0) {
      showToast('Informe uma quantidade válida!', 'error');
      return;
    }
    if (valNum === null || valNum <= 0) {
      showToast('Informe o valor do material!', 'error');
      return;
    }

    const solicAtual = await garantirSolicitacaoCriada();
    if (!solicAtual) return;

    setSalvando(true);
    try {
      const payload = {
        codigoMaterial: itemMaterial.trim().toUpperCase(),
        descricaoComplem: itemDescricaoComplem.trim() || null,
        codigoLote: itemLote.trim().toUpperCase() || null,
        qtdMaterial: qtdNum,
        unidMedida: itemUnid.trim().toUpperCase(),
        valorUnitario: valNum,
        confirmarLimparDetalhes,
      };

      const res =
        editandoNumItem !== null
          ? await atualizarItemSolicitacaoNfDiversa(solicAtual.numSolicitacao, editandoNumItem, payload)
          : await adicionarItemSolicitacaoNfDiversa(solicAtual.numSolicitacao, payload);

      if (!res.sucesso && res.codigoConfirmacao === 'CONFIRMAR_LIMPAR_DETALHES') {
        setConfirmacao({
          tipo: 'limpar_detalhes_lote',
          titulo: 'Confirmar alteração de lote',
          mensagem: res.mensagem,
        });
        return;
      }

      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível salvar o item.', 'error');
        return;
      }

      setConfirmacao(null);
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      limparFormItem();
      showToast(res.mensagem || 'Item salvo com sucesso.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar item.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleIniciarEdicaoItem = (it: SolicitacaoNfDiversaItem) => {
    setEditandoNumItem(it.numItem);
    setItemMaterial(it.codigoMaterial);
    setItemDescricaoComplem(it.descricaoComplem || '');
    setItemLote(it.codigoLote || '');
    setItemQtd(String(it.qtdMaterial).replace('.', ','));
    setItemUnid(it.unidMedida || '');
    setItemValorUnit(String(it.valorUnitario).replace('.', ','));
    resetObrigItem();
    if (it.codigoMaterial !== 'S/N' && it.controlarLote) {
      void obterLotesSolicitacaoNfDiversa(
        it.codigoMaterial,
        entradaSaida === 2 ? Number(tipoMovimentoEstoque || 1) : null,
      ).then((lotes) => setLotesDisponiveis(lotes));
    }
  };

  const handleExcluirItem = async (numItem: number, confirmarEstorno = false) => {
    if (!detalhe) return;
    setSalvando(true);
    try {
      const res = await excluirItemSolicitacaoNfDiversa(detalhe.numSolicitacao, numItem, confirmarEstorno);
      if (!res.sucesso && res.codigoConfirmacao === 'CONFIRMAR_ESTORNO_EMBALAGEM') {
        setConfirmacao({
          tipo: 'excluir_item_estorno',
          titulo: 'Confirmar estorno de embalagem',
          mensagem: res.mensagem,
          payload: { numItem },
        });
        return;
      }
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível excluir o item.', 'error');
        return;
      }
      setConfirmacao(null);
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      if (editandoNumItem === numItem) limparFormItem();
      showToast(res.mensagem || 'Item excluído.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir item.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleIncluirEmbalagem = async (confirmarRemoverPallet = false) => {
    if (!serialEmbalagem.trim()) {
      showToast('Informe o número do pallet ou caixa.', 'error');
      return;
    }
    const solicAtual = await garantirSolicitacaoCriada();
    if (!solicAtual) return;

    setSalvando(true);
    try {
      const res = await incluirEmbalagemSolicitacaoNfDiversa(
        solicAtual.numSolicitacao,
        serialEmbalagem.trim(),
        tipoEmbalagem === '2' ? 2 : 1,
        confirmarRemoverPallet,
      );

      if (!res.sucesso && res.codigoConfirmacao === 'REMOVER_CAIXA_PALLET') {
        setConfirmacao({
          tipo: 'remover_caixa_pallet',
          titulo: 'Caixa vinculada a pallet',
          mensagem: res.mensagem,
        });
        return;
      }

      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível incluir a embalagem.', 'error');
        return;
      }

      setConfirmacao(null);
      setSerialEmbalagem('');
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      showToast(res.mensagem || 'Embalagem incluída com sucesso.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao incluir embalagem.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarServico = async () => {
    if (!obrigServico.validate([servDescricao, servValorUnit])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }
    const valNum = parseDecimalInput(servValorUnit);
    const qtdNum = parseDecimalInput(servQtd) ?? 1;
    if (valNum === null || valNum <= 0) {
      showToast('Valor do serviço deve ser maior que zero!', 'error');
      return;
    }
    const solicAtual = await garantirSolicitacaoCriada();
    if (!solicAtual) return;

    setSalvando(true);
    try {
      const payload = {
        descrServico: servDescricao.trim(),
        qtdServico: qtdNum > 0 ? qtdNum : 1,
        valorUnitario: valNum,
      };
      const res =
        editandoNumServ !== null
          ? await atualizarServicoSolicitacaoNfDiversa(solicAtual.numSolicitacao, editandoNumServ, payload)
          : await adicionarServicoSolicitacaoNfDiversa(solicAtual.numSolicitacao, payload);

      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível salvar o serviço.', 'error');
        return;
      }
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      limparFormServico();
      showToast(res.mensagem || 'Serviço salvo com sucesso.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar serviço.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirServico = async (numItem: number) => {
    if (!detalhe) return;
    setSalvando(true);
    try {
      const res = await excluirServicoSolicitacaoNfDiversa(detalhe.numSolicitacao, numItem);
      if (!res.sucesso) {
        showToast(res.mensagem || 'Erro ao excluir serviço.', 'error');
        return;
      }
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      if (editandoNumServ === numItem) limparFormServico();
      showToast(res.mensagem || 'Serviço excluído.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir serviço.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleCalcularPeso = async () => {
    if (!detalhe) {
      showToast('Salve a solicitação e inclua os itens antes de calcular o peso.', 'info');
      return;
    }
    setSalvando(true);
    try {
      const res = await calcularPesoSolicitacaoNfDiversa(detalhe.numSolicitacao);
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível calcular o peso.', 'error');
        return;
      }
      if (res.detalhe) preencherDoDetalhe(res.detalhe);
      showToast(res.mensagem || 'Pesos calculados com sucesso.', 'success');
      onChanged();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao calcular pesos.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleExecutarConfirmacaoSolicitacao = async (confirmarSemSaldo = false) => {
    const salvo = await salvarCabecalho(true, true);
    if (!salvo) return;

    setSalvando(true);
    try {
      const res = await confirmarSolicitacaoNfDiversa(salvo.numSolicitacao, confirmarSemSaldo);
      if (!res.sucesso && res.codigoConfirmacao === 'CONFIRMAR_SEM_SALDO') {
        setConfirmacao({
          tipo: 'confirmar_sem_saldo',
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

      setConfirmacao(null);
      showToast(res.mensagem || 'Solicitação confirmada e liberada para faturamento!', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao confirmar solicitação.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleExecutarCancelamento = async () => {
    if (!detalhe) return;
    setSalvando(true);
    try {
      const res = await cancelarSolicitacaoNfDiversa(detalhe.numSolicitacao);
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível cancelar a solicitação.', 'error');
        return;
      }
      setConfirmacao(null);
      showToast(res.mensagem || 'Solicitação cancelada e reaberta para digitação.', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cancelar solicitação.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const itemSelecionadoDetalhes = useMemo(() => {
    if (itemDetalhesNum === null || !detalhe) return null;
    return detalhe.itens.find((i) => i.numItem === itemDetalhesNum) ?? null;
  }, [itemDetalhesNum, detalhe]);

  const podeIncluirEmbalagem =
    !somenteLeitura &&
    entradaSaida === 2 &&
    tipoMovimentoEstoque === '1' &&
    parsedDestinatario.tipo === 'C';

  if (!open) return null;

  const tituloCabecalho = detalhe
    ? `${somenteLeitura ? 'Consultar' : 'Editar'} Solicitação de NF Diversa #${String(detalhe.numSolicitacao).padStart(6, '0')}`
    : 'Nova Solicitação de NF Diversa';

  return (
    <>
      <section
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snfd-form-modal-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !salvando && !confirmacao && itemDetalhesNum === null) {
            onClose();
          }
        }}
      >
        <article className="modal-card modal-card--wide snfd-form-modal">
          <header className="modal-card__header">
            <div className="snfd-modal-title-wrap">
              <h2 id="snfd-form-modal-title">{tituloCabecalho}</h2>
              {detalhe ? <StatusBadge label={detalhe.situacaoDescricao} /> : null}
            </div>
            <ModalHeaderActions onClose={onClose} disabled={salvando} />
          </header>

          {loadingDetalhe ? (
            <p className="module-empty">Carregando solicitação...</p>
          ) : (
            <div className="snfd-modal-content">
              <div className="contas-receber-tabs snfd-tabs" role="tablist" aria-label="Seções da solicitação">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'geral'}
                  className={`contas-receber-tab${activeTab === 'geral' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setActiveTab('geral')}
                >
                  Geral
                </button>
                {entradaSaida !== 3 ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'itens'}
                    className={`contas-receber-tab${activeTab === 'itens' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setActiveTab('itens')}
                  >
                    {`Itens (${detalhe?.itens.length ?? 0})`}
                  </button>
                ) : null}
                {entradaSaida === 3 || (detalhe?.servicos.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'servicos'}
                    className={`contas-receber-tab${activeTab === 'servicos' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setActiveTab('servicos')}
                  >
                    {`Serviços (${detalhe?.servicos.length ?? 0})`}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'transporte'}
                  className={`contas-receber-tab${activeTab === 'transporte' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setActiveTab('transporte')}
                >
                  Transporte e Volumes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'observacoes'}
                  className={`contas-receber-tab${activeTab === 'observacoes' ? ' contas-receber-tab--active' : ''}`}
                  onClick={() => setActiveTab('observacoes')}
                >
                  Observações
                </button>
                {(detalhe?.origens.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'origem'}
                    className={`contas-receber-tab${activeTab === 'origem' ? ' contas-receber-tab--active' : ''}`}
                    onClick={() => setActiveTab('origem')}
                  >
                    {`Origem (${detalhe?.origens.length ?? 0})`}
                  </button>
                ) : null}
              </div>

              {/* ABA: GERAL */}
              {activeTab === 'geral' ? (
                <form
                  className="module-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!somenteLeitura) void salvarCabecalho(false, true);
                  }}
                >
                  <div className="form-grid-3">
                    <label className="snfd-span-2">
                      <span>Destinatário *</span>
                      <SearchableSelect
                        name="destinatario"
                        ariaLabel="Destinatário"
                        options={destinatariosOptions}
                        value={destinatarioChave}
                        onChange={handleTrocarDestinatario}
                        placeholder="Selecione o cliente ou fornecedor"
                        searchPlaceholder="Pesquisar..."
                        disabled={somenteLeitura || Boolean(detalhe?.possuiEmbalagens)}
                        className={obrigCabecalho.wrapperClass(destinatarioChave)}
                      />
                      {obrigCabecalho.error(destinatarioChave)}
                    </label>

                    <label>
                      <span>Data da solicitação *</span>
                      <CustomDatePicker
                        name="dataSolicitacao"
                        value={dataSolicitacaoBr}
                        onChange={setDataSolicitacaoBr}
                        disabled={somenteLeitura}
                        className={obrigCabecalho.wrapperClass(dataSolicitacaoBr)}
                      />
                      {obrigCabecalho.error(dataSolicitacaoBr)}
                    </label>

                    <label>
                      <span>Entrada / Saída *</span>
                      <SearchableSelect
                        name="entradaSaida"
                        ariaLabel="Entrada ou Saída"
                        options={ENTRADA_SAIDA_OPTIONS}
                        value={String(entradaSaida)}
                        onChange={handleTrocarEntradaSaida}
                        enableSearch={false}
                        disabled={somenteLeitura || Boolean(detalhe?.possuiEmbalagens)}
                      />
                    </label>

                    {entradaSaida === 2 ? (
                      <label>
                        <span>Movimento de estoque *</span>
                        <SearchableSelect
                          name="tipoMovimentoEstoque"
                          ariaLabel="Movimento de estoque"
                          options={TIPO_MOV_ESTOQUE_OPTIONS}
                          value={tipoMovimentoEstoque}
                          onChange={handleTrocarTipoMovEstoque}
                          enableSearch={false}
                          disabled={somenteLeitura || Boolean(detalhe?.possuiEmbalagens)}
                        />
                      </label>
                    ) : null}

                    <label className={entradaSaida === 2 ? '' : 'snfd-span-2'}>
                      <span>Natureza de operação (CFO)</span>
                      <SearchableSelect
                        name="codigoCfo"
                        ariaLabel="Natureza de operação"
                        options={cfosOptions}
                        value={codigoCfo}
                        onChange={setCodigoCfo}
                        placeholder="Selecione (opcional)"
                        searchPlaceholder="Pesquisar..."
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label className="form-grid-3__full">
                      <span>Motivo da solicitação *</span>
                      <input
                        name="motivoSolicitacao"
                        type="text"
                        maxLength={255}
                        value={motivoSolicitacao}
                        onChange={(e) => setMotivoSolicitacao(e.target.value)}
                        placeholder="Digite o motivo da solicitação"
                        disabled={somenteLeitura}
                        className={obrigCabecalho.inputClass(motivoSolicitacao)}
                      />
                      {obrigCabecalho.error(motivoSolicitacao)}
                    </label>
                  </div>

                  {detalhe ? (
                    <div className="snfd-meta-grid">
                      <div>
                        <span className="snfd-meta-label">Solicitante</span>
                        <strong>{detalhe.codigoSolicitante || '-'}</strong>
                      </div>
                      <div>
                        <span className="snfd-meta-label">Valor total</span>
                        <strong>
                          {formatCurrencyBr(
                            detalhe.entradaSaida === 3 ? detalhe.valorTotalServicos : detalhe.valorTotalItens,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="snfd-meta-label">Nota fiscal emitida</span>
                        <strong>
                          {detalhe.numNotaFiscal
                            ? `${detalhe.numNotaFiscal}${detalhe.serNotaFiscal ? ` / ${detalhe.serNotaFiscal}` : ''}`
                            : 'Não emitida'}
                        </strong>
                      </div>
                      {detalhe.numSeparacao ? (
                        <div>
                          <span className="snfd-meta-label">Ordem de separação</span>
                          <strong>{`#${String(detalhe.numSeparacao).padStart(6, '0')}`}</strong>
                        </div>
                      ) : null}
                      {detalhe.numRnc ? (
                        <div>
                          <span className="snfd-meta-label">RNC vinculada</span>
                          <strong>{`#${detalhe.numRnc}`}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </form>
              ) : null}

              {/* ABA: ITENS */}
              {activeTab === 'itens' && entradaSaida !== 3 ? (
                <div className="snfd-detalhe-stack">
                  {podeIncluirEmbalagem ? (
                    <div className="almoxarifado-subform">
                      <div className="almoxarifado-subform__header">
                        <h3>
                          <IoCubeOutline size={16} aria-hidden="true" /> Incluir embalagem (Pallet / Caixa)
                        </h3>
                      </div>
                      <div className="almoxarifado-subform__controls">
                        <div className="snfd-emb-tipo">
                          <SearchableSelect
                            name="tipoEmbalagem"
                            ariaLabel="Tipo de embalagem"
                            options={TIPO_EMBALAGEM_OPTIONS}
                            value={tipoEmbalagem}
                            onChange={(v) => setTipoEmbalagem(v === '2' ? '2' : '1')}
                            enableSearch={false}
                            disabled={salvando}
                          />
                        </div>
                        <div className="snfd-emb-serial">
                          <input
                            type="text"
                            maxLength={12}
                            value={serialEmbalagem}
                            onChange={(e) => setSerialEmbalagem(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                void handleIncluirEmbalagem(false);
                              }
                            }}
                            placeholder="Digite ou bipe o serial da embalagem"
                            aria-label="Número do pallet ou caixa"
                            disabled={salvando}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void handleIncluirEmbalagem(false)}
                          disabled={salvando}
                        >
                          <IoAddOutline size={16} /> Incluir embalagem
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!somenteLeitura ? (
                    <form
                      className="module-form almoxarifado-subform"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSalvarItem(false);
                      }}
                    >
                      <div className="almoxarifado-subform__header">
                        <h3>{editandoNumItem !== null ? `Editar item #${editandoNumItem}` : 'Adicionar item'}</h3>
                        {editandoNumItem !== null ? (
                          <button type="button" className="secondary-button" onClick={limparFormItem}>
                            Cancelar edição
                          </button>
                        ) : null}
                      </div>

                      <div className="form-grid-3">
                        <label className="snfd-span-2">
                          <span>Material *</span>
                          <SearchableSelect
                            name="codigoMaterial"
                            ariaLabel="Material"
                            options={materiaisSelectOptions}
                            value={itemMaterial}
                            onChange={handleSelecionarMaterial}
                            onSearchInputChange={handlePesquisarMateriais}
                            placeholder="Selecione o material"
                            searchPlaceholder="Pesquisar..."
                            className={obrigItem.wrapperClass(itemMaterial)}
                          />
                          {obrigItem.error(itemMaterial)}
                        </label>

                        <label>
                          <span>Lote</span>
                          {lotesDisponiveis.length > 0 ? (
                            <SearchableSelect
                              name="codigoLote"
                              ariaLabel="Lote"
                              options={lotesSelectOptions}
                              value={itemLote}
                              onChange={handleSelecionarLote}
                              placeholder="Selecione o lote"
                              searchPlaceholder="Pesquisar..."
                            />
                          ) : (
                            <input
                              type="text"
                              maxLength={8}
                              value={itemLote}
                              onChange={(e) => setItemLote(e.target.value.toUpperCase())}
                              onBlur={() => {
                                if (itemMaterial && itemMaterial !== 'S/N' && itemLote) {
                                  void carregarInfoMaterialELotes(itemMaterial, itemLote);
                                }
                              }}
                              placeholder={
                                itemMatInfo && !itemMatInfo.controlarLote ? 'Não controla lote' : 'Digite o lote'
                              }
                              disabled={Boolean(itemMatInfo && itemMatInfo.controlarEstoque && !itemMatInfo.controlarLote)}
                              autoComplete="off"
                              spellCheck={false}
                            />
                          )}
                        </label>

                        <label>
                          <span>Quantidade *</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={itemQtd}
                            onChange={(e) => setItemQtd(e.target.value)}
                            placeholder="Ex: 10,000"
                            className={obrigItem.inputClass(itemQtd)}
                          />
                          {obrigItem.error(itemQtd)}
                        </label>

                        <label>
                          <span>Unidade *</span>
                          <SearchableSelect
                            name="unidMedida"
                            ariaLabel="Unidade de medida"
                            options={unidadesOptions}
                            value={itemUnid}
                            onChange={setItemUnid}
                            placeholder="Selecione"
                            searchPlaceholder="Pesquisar..."
                            className={obrigItem.wrapperClass(itemUnid)}
                          />
                          {obrigItem.error(itemUnid)}
                        </label>

                        <label>
                          <span>Valor unitário *</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={itemValorUnit}
                            onChange={(e) => setItemValorUnit(e.target.value)}
                            placeholder="Ex: 25,00"
                            className={obrigItem.inputClass(itemValorUnit)}
                          />
                          {obrigItem.error(itemValorUnit)}
                        </label>

                        <label className="form-grid-3__full">
                          <span>{itemMaterial === 'S/N' ? 'Descrição complementar *' : 'Descrição complementar'}</span>
                          <input
                            type="text"
                            maxLength={255}
                            value={itemDescricaoComplem}
                            onChange={(e) => setItemDescricaoComplem(e.target.value)}
                            placeholder="Digite uma descrição complementar para a nota fiscal"
                          />
                        </label>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="secondary-button" disabled={salvando}>
                          {editandoNumItem !== null ? (
                            <>
                              <IoSaveOutline size={16} /> Atualizar item
                            </>
                          ) : (
                            <>
                              <IoAddOutline size={16} /> Adicionar item
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="snfd-resumo-strip">
                    <span>
                      <strong>Itens:</strong> {detalhe?.itens.length ?? 0} / {detalhe?.limiteItensNf ?? combos?.limiteItensNf ?? 99}
                    </span>
                    <span>
                      <strong>Total dos itens:</strong> {formatCurrencyBr(detalhe?.valorTotalItens ?? 0)}
                    </span>
                  </div>

                  {!detalhe || detalhe.itens.length === 0 ? (
                    <p className="module-empty">Nenhum item incluído nesta solicitação.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Itens da solicitação">
                      <table className="clientes-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Material</th>
                            <th>Descrição</th>
                            <th>Lote</th>
                            <th>Qtd.</th>
                            <th>Unid.</th>
                            <th>Valor unit.</th>
                            <th>Total</th>
                            <th>Detalhes</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalhe.itens.map((it) => (
                            <tr key={it.numItem}>
                              <td>{it.numItem}</td>
                              <td>{it.codigoMaterial}</td>
                              <td data-no-translate="">
                                <div>{it.descricaoExibida || it.descricaoMaterial || '-'}</div>
                                {it.descricaoComplem && it.codigoMaterial !== 'S/N' && !detalhe.regra64Ativa ? (
                                  <small className="snfd-cell-sub">{it.descricaoComplem}</small>
                                ) : null}
                              </td>
                              <td>{it.codigoLote || '-'}</td>
                              <td>{formatNumberBr(it.qtdMaterial)}</td>
                              <td>{it.unidMedida || '-'}</td>
                              <td>{formatNumberBr(it.valorUnitario, 6)}</td>
                              <td>{formatCurrencyBr(it.valorTotal)}</td>
                              <td>
                                {it.tipoDetalhe === 'situacao' ? (
                                  <StatusBadge
                                    label={`Bloq: ${formatNumberBr(it.qtdBloqueiosSelecionados)}`}
                                    tone={it.qtdBloqueiosSelecionados === it.qtdMaterial ? 'success' : 'warning'}
                                  />
                                ) : it.tipoDetalhe === 'serial' ? (
                                  <StatusBadge
                                    label={`Seriais: ${it.qtdSeriais}`}
                                    tone={it.qtdSeriais === it.qtdMaterial ? 'success' : 'warning'}
                                  />
                                ) : it.qtdEmbalagens > 0 ? (
                                  <StatusBadge label={`Emb: ${it.qtdEmbalagens}`} tone="info" />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>
                                <div className="snfd-row-actions">
                                  {it.permiteDetalhes ? (
                                    <button
                                      type="button"
                                      className="icon-button"
                                      onClick={() => {
                                        if (!it.codigoLote && it.controlarLote) {
                                          showToast('É necessário informar o lote!', 'error');
                                          return;
                                        }
                                        setItemDetalhesNum(it.numItem);
                                      }}
                                      title={
                                        it.tipoDetalhe === 'situacao'
                                          ? 'Selecionar bloqueios'
                                          : it.tipoDetalhe === 'serial'
                                            ? 'Gerenciar seriais'
                                            : 'Ver embalagens'
                                      }
                                      aria-label="Detalhes do item"
                                    >
                                      {it.tipoDetalhe === 'situacao' ? (
                                        <IoLockClosedOutline size={16} />
                                      ) : it.tipoDetalhe === 'serial' ? (
                                        <IoBarcodeOutline size={16} />
                                      ) : (
                                        <IoCubeOutline size={16} />
                                      )}
                                    </button>
                                  ) : null}
                                  {!somenteLeitura ? (
                                    <>
                                      <button
                                        type="button"
                                        className="icon-button"
                                        onClick={() => handleIniciarEdicaoItem(it)}
                                        title="Editar item"
                                        aria-label="Editar item"
                                      >
                                        <IoCreateOutline size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-button icon-button--danger"
                                        onClick={() => void handleExcluirItem(it.numItem, false)}
                                        disabled={salvando}
                                        title="Excluir item"
                                        aria-label="Excluir item"
                                      >
                                        <IoTrashOutline size={16} />
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* ABA: SERVIÇOS */}
              {activeTab === 'servicos' ? (
                <div className="snfd-detalhe-stack">
                  {!somenteLeitura ? (
                    <form
                      className="module-form almoxarifado-subform"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSalvarServico();
                      }}
                    >
                      <div className="almoxarifado-subform__header">
                        <h3>{editandoNumServ !== null ? `Editar serviço #${editandoNumServ}` : 'Adicionar serviço'}</h3>
                        {editandoNumServ !== null ? (
                          <button type="button" className="secondary-button" onClick={limparFormServico}>
                            Cancelar edição
                          </button>
                        ) : null}
                      </div>

                      <div className="form-grid-3">
                        <label className="form-grid-3__full">
                          <span>Descrição do serviço *</span>
                          <textarea
                            rows={2}
                            value={servDescricao}
                            onChange={(e) => setServDescricao(e.target.value)}
                            placeholder="Digite a descrição do serviço prestado"
                            className={obrigServico.inputClass(servDescricao)}
                          />
                          {obrigServico.error(servDescricao)}
                        </label>
                        <label>
                          <span>Quantidade</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={servQtd}
                            onChange={(e) => setServQtd(e.target.value)}
                            placeholder="1"
                          />
                        </label>
                        <label>
                          <span>Valor unitário *</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={servValorUnit}
                            onChange={(e) => setServValorUnit(e.target.value)}
                            placeholder="Ex: 150,00"
                            className={obrigServico.inputClass(servValorUnit)}
                          />
                          {obrigServico.error(servValorUnit)}
                        </label>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="secondary-button" disabled={salvando}>
                          {editandoNumServ !== null ? (
                            <>
                              <IoSaveOutline size={16} /> Atualizar serviço
                            </>
                          ) : (
                            <>
                              <IoAddOutline size={16} /> Adicionar serviço
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="snfd-resumo-strip">
                    <span>
                      <strong>Serviços:</strong> {detalhe?.servicos.length ?? 0}
                    </span>
                    <span>
                      <strong>Total dos serviços:</strong> {formatCurrencyBr(detalhe?.valorTotalServicos ?? 0)}
                    </span>
                  </div>

                  {!detalhe || detalhe.servicos.length === 0 ? (
                    <p className="module-empty">Nenhum serviço incluído nesta solicitação.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Serviços da solicitação">
                      <table className="clientes-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Descrição do serviço</th>
                            <th>Qtd.</th>
                            <th>Valor unitário</th>
                            <th>Total</th>
                            {!somenteLeitura ? <th>Ações</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {detalhe.servicos.map((s) => (
                            <tr key={s.numItem}>
                              <td>{s.numItem}</td>
                              <td data-no-translate="">{s.descrServico}</td>
                              <td>{formatNumberBr(s.qtdServico ?? 1, 2)}</td>
                              <td>{formatCurrencyBr(s.valorUnitario)}</td>
                              <td>{formatCurrencyBr(s.valorTotal)}</td>
                              {!somenteLeitura ? (
                                <td>
                                  <div className="snfd-row-actions">
                                    <button
                                      type="button"
                                      className="icon-button"
                                      onClick={() => {
                                        setEditandoNumServ(s.numItem);
                                        setServDescricao(s.descrServico);
                                        setServQtd(String(s.qtdServico ?? 1).replace('.', ','));
                                        setServValorUnit(String(s.valorUnitario).replace('.', ','));
                                        resetObrigServico();
                                      }}
                                      title="Editar serviço"
                                      aria-label="Editar serviço"
                                    >
                                      <IoCreateOutline size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-button icon-button--danger"
                                      onClick={() => void handleExcluirServico(s.numItem)}
                                      disabled={salvando}
                                      title="Excluir serviço"
                                      aria-label="Excluir serviço"
                                    >
                                      <IoTrashOutline size={16} />
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* ABA: TRANSPORTE E VOLUMES */}
              {activeTab === 'transporte' ? (
                <div className="module-form">
                  <div className="form-grid-3">
                    <label className="snfd-span-2">
                      <span>Transportadora</span>
                      <SearchableSelect
                        name="codigoTransportadora"
                        ariaLabel="Transportadora"
                        options={transportadorasOptions}
                        value={codigoTransportadora}
                        onChange={setCodigoTransportadora}
                        placeholder="Selecione a transportadora"
                        searchPlaceholder="Pesquisar..."
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Responsável pelo frete</span>
                      <SearchableSelect
                        name="responsavelFrete"
                        ariaLabel="Responsável pelo frete"
                        options={RESPONSAVEL_FRETE_OPTIONS}
                        value={responsavelFrete}
                        onChange={setResponsavelFrete}
                        enableSearch={false}
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Placa do veículo</span>
                      <input
                        type="text"
                        maxLength={7}
                        value={placaVeiculo}
                        onChange={(e) => setPlacaVeiculo(e.target.value.toUpperCase())}
                        placeholder="Ex: ABC1D23"
                        disabled={somenteLeitura}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label>
                      <span>Qtd. volumes</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qtdVolumes}
                        onChange={(e) => setQtdVolumes(e.target.value)}
                        placeholder="0"
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Espécie dos volumes</span>
                      <input
                        type="text"
                        maxLength={15}
                        value={especieVolumes}
                        onChange={(e) => setEspecieVolumes(e.target.value)}
                        placeholder="Ex: CAIXA, PALLET"
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Marca dos volumes</span>
                      <input
                        type="text"
                        maxLength={60}
                        value={marcaVolumes}
                        onChange={(e) => setMarcaVolumes(e.target.value)}
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Numeração dos volumes</span>
                      <input
                        type="text"
                        maxLength={60}
                        value={numeracaoVolumes}
                        onChange={(e) => setNumeracaoVolumes(e.target.value)}
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Peso bruto (kg)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pesoBruto}
                        onChange={(e) => setPesoBruto(e.target.value)}
                        placeholder="0,000"
                        disabled={somenteLeitura}
                      />
                    </label>

                    <label>
                      <span>Peso líquido (kg)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pesoLiquido}
                        onChange={(e) => setPesoLiquido(e.target.value)}
                        placeholder="0,000"
                        disabled={somenteLeitura}
                      />
                    </label>
                  </div>

                  {!somenteLeitura && entradaSaida !== 3 ? (
                    <div className="form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleCalcularPeso()}
                        disabled={salvando || !detalhe || detalhe.itens.length === 0}
                      >
                        <IoCalculatorOutline size={16} /> Calcular peso pelos itens
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* ABA: OBSERVAÇÕES */}
              {activeTab === 'observacoes' ? (
                <div className="module-form">
                  <div className="form-grid-2">
                    <label className="form-grid-2__full">
                      <span>Observações da solicitação</span>
                      <textarea
                        rows={6}
                        value={observSolicitacao}
                        onChange={(e) => setObservSolicitacao(e.target.value)}
                        placeholder="Digite as observações gerais que serão levadas para a Nota Fiscal"
                        disabled={somenteLeitura}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {/* ABA: ORIGEM (ORÇAMENTO DE SERVIÇO) */}
              {activeTab === 'origem' && detalhe ? (
                <div className="snfd-detalhe-stack">
                  <h3 className="snfd-section-title">
                    <IoDocumentTextOutline size={16} aria-hidden="true" /> Orçamentos de serviço vinculados
                  </h3>
                  <div className="table-scroll" tabIndex={0} role="region" aria-label="Origens da solicitação">
                    <table className="clientes-table">
                      <thead>
                        <tr>
                          <th>Orçamento de serviço</th>
                          <th>Item do orçamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhe.origens.map((o) => (
                          <tr key={`${o.numOrcServ}-${o.numItemServ}`}>
                            <td>{`#${String(o.numOrcServ).padStart(6, '0')}`}</td>
                            <td>{o.numItemServ}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Bloco inline de confirmação de ações críticas */}
              {confirmacao ? (
                <div className="snfd-confirm-inline" role="alert">
                  <strong>{confirmacao.titulo}</strong>
                  <p>{confirmacao.mensagem}</p>
                  {confirmacao.erros && confirmacao.erros.length > 1 ? (
                    <ul className="snfd-confirm-inline__list">
                      {confirmacao.erros.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="snfd-confirm-inline__actions">
                    <button
                      type="button"
                      className={
                        confirmacao.tipo === 'cancelar' || confirmacao.tipo === 'excluir_item_estorno'
                          ? 'primary-button primary-button--danger'
                          : 'primary-button'
                      }
                      disabled={salvando}
                      onClick={() => {
                        if (confirmacao.tipo === 'confirmar') {
                          void handleExecutarConfirmacaoSolicitacao(false);
                        } else if (confirmacao.tipo === 'confirmar_sem_saldo') {
                          void handleExecutarConfirmacaoSolicitacao(true);
                        } else if (confirmacao.tipo === 'cancelar') {
                          void handleExecutarCancelamento();
                        } else if (confirmacao.tipo === 'excluir_item_estorno') {
                          void handleExcluirItem(confirmacao.payload.numItem, true);
                        } else if (confirmacao.tipo === 'remover_caixa_pallet') {
                          void handleIncluirEmbalagem(true);
                        } else if (confirmacao.tipo === 'limpar_detalhes_lote') {
                          void handleSalvarItem(true);
                        }
                      }}
                    >
                      {salvando ? 'Processando...' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={salvando}
                      onClick={() => setConfirmacao(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <footer className="modal-card__footer">
            {!somenteLeitura ? (
              detalhe ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      setConfirmacao({
                        tipo: 'confirmar',
                        titulo: 'Confirmar solicitação de nota fiscal',
                        mensagem: 'Deseja confirmar esta solicitação de nota fiscal e liberá-la para o faturamento?',
                      })
                    }
                    disabled={salvando || loadingDetalhe}
                  >
                    <IoCheckmarkDoneOutline size={16} /> Confirmar solicitação
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void salvarCabecalho(false, true)}
                    disabled={salvando || loadingDetalhe}
                  >
                    <IoSaveOutline size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void salvarCabecalho(false, true)}
                  disabled={salvando || loadingDetalhe}
                >
                  <IoSaveOutline size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              )
            ) : detalhe?.podeCancelar ? (
              <button
                type="button"
                className="secondary-button secondary-button--danger"
                onClick={() =>
                  setConfirmacao({
                    tipo: 'cancelar',
                    titulo: 'Confirmar cancelamento',
                    mensagem:
                      'Deseja cancelar essa solicitação? Ela voltará para Em digitação e liberará eventuais embalagens e seriais reservados.',
                  })
                }
                disabled={salvando || loadingDetalhe}
              >
                <IoCloseCircleOutline size={16} /> Cancelar solicitação
              </button>
            ) : null}

            <button
              type="button"
              className="secondary-button modal-card__close"
              onClick={onClose}
              disabled={salvando}
            >
              Fechar
            </button>
          </footer>
        </article>
      </section>

      {detalhe && itemSelecionadoDetalhes ? (
        <SolicitacaoNfDiversaItemDetalhesModal
          open={itemDetalhesNum !== null}
          numSolicitacao={detalhe.numSolicitacao}
          item={itemSelecionadoDetalhes}
          somenteLeitura={somenteLeitura}
          onClose={() => setItemDetalhesNum(null)}
          onDetalheAtualizado={(novoDetalhe) => {
            preencherDoDetalhe(novoDetalhe);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
