import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoCalculatorOutline,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoCopyOutline,
  IoCreateOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { useTransactionAccess } from '../../../hooks/useTransactionAccess';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  obterMateriaisTributacaoCall,
  listarMateriaisTributacaoCall,
  atualizarMateriaisTributacaoCall,
  duplicarMateriaisTributacaoCall,
  obterTributacoesCall,
  buscaMaterialCall,
  salvarConversoesUnidTribCall,
} from '../../../services/apiCalls';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { ListSearchField } from '../../../components/ListSearchField';

export interface MaterialListaItem {
  codigo_Material: string;
  descricao_Portug: string;
  codigo_CF?: string;
  origem_Mercadoria?: string;
  tributacao_ICMS?: string;
  tributacao_IPI?: string;
  aliquota_IPI?: number;
  possuiTributacao: boolean;
}

export interface TributacaoUF {
  codigo_Material: string;
  codigo_Estado: string;
  perc_Calculo_ICMS: number;
  aliquota_ICMS: number;
  aliquota_ICMS_Inter: number;
  tributacao_ICMS_ST: number;
  aliquota_ICMS_ST: number;
  perc_Valor_Agreg: number;
  perc_Reducao_ICMS_ST: number;
  perc_Valor_Agreg_SN: number;
  tributacao_ICMS?: string | null;
  codigo_CSOSN?: string | null;
  perc_Adic_ICMS_FCP: number;
}

export interface UnidConversaoItem {
  codigo_Material: string;
  uM_Converter: string;
  fator_Conv: number;
}

export interface TributacaoForm {
  codigo_Material: string;
  descricao_Material: string;
  origem_Mercadoria: string;
  codigo_CF?: string | null;
  tributacao_ICMS: string;
  descricao_ICMS?: string;
  tributacao_IPI: string;
  descricao_IPI?: string;
  codigo_CSOSN?: string | null;
  descricao_CSOSN?: string;
  codigo_CBenef?: string | null;
  codigo_CBenef_Mao_Obra?: string | null;
  regime_Est_Simplificado?: number | null;
  num_Documento_FCI?: string | null;
  perc_Impostos?: number | null;
  codificacao_NVE?: string | null;
  codigo_NVE?: string | null;
  tributacao_Retorno?: number | null;
  cst_IBS_CBS?: string | null;
  classtrib_IBS_CBS?: string | null;
  cst_IS?: string | null;
  classtrib_IS?: string | null;
  cst_IBS_CBS_Reg?: string | null;
  classtrib_IBS_CBS_Reg?: string | null;
  grava_Rastro_NFe?: number | null;
  unid_Tributaria?: string | null;
  fator_Conv_Trib?: number | null;
  codigo_Enquadramento_IPI?: string | null;
  aliquota_IPI?: number | null;
  tipo_Tributacao_PIS?: string | null;
  tipo_Tributacao_COFINS?: string | null;
  codigo_CEST?: string | null;
  ufs: TributacaoUF[];
  conversoes: UnidConversaoItem[];
}

const UFS_PADRAO = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

interface HelpTribItem {
  codigo: string;
  descricao: string;
}

export function TributacaoMaterialPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const permissaoStatus = useTransactionAccess('BAS003', 'Tributação do Material');

  const [loadingList, setLoadingList] = useState(false);
  const [materiais, setMateriais] = useState<MaterialListaItem[]>([]);
  const [totalMateriais, setTotalMateriais] = useState(0);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'federal' | 'reforma' | 'opcoes' | 'ufs'>('federal');
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState<TributacaoForm>({
    codigo_Material: '',
    descricao_Material: '',
    origem_Mercadoria: '0',
    tributacao_ICMS: '00',
    tributacao_IPI: '50',
    ufs: [],
    conversoes: [],
  });

  const [ufParaAdicionar, setUfParaAdicionar] = useState<string>('');

  const [conversaoOpen, setConversaoOpen] = useState(false);
  const [conversoesLista, setConversoesLista] = useState<UnidConversaoItem[]>([]);
  const [novaUM, setNovaUM] = useState('');
  const [novoFator, setNovoFator] = useState<number>(1);
  const [salvandoConversao, setSalvandoConversao] = useState(false);

  const [duplicaOpen, setDuplicaOpen] = useState(false);
  const [duplicaDestino, setDuplicaDestino] = useState('');
  const [duplicaDescricao, setDuplicaDescricao] = useState('');
  const [duplicando, setDuplicando] = useState(false);

  const [helpTrib, setHelpTrib] = useState<{
    open: boolean;
    titulo: string;
    loading: boolean;
    filtro: string;
    items: HelpTribItem[];
  }>({ open: false, titulo: '', loading: true, filtro: '', items: [] });
  const helpTribSelectRef = useRef<((codigo: string, descricao: string) => void) | null>(null);

  const abrirHelpTrib = useCallback(
    async (tipo: string, titulo: string, onSelect: (codigo: string, descricao: string) => void, origemParam?: string) => {
      helpTribSelectRef.current = onSelect;
      setHelpTrib({ open: true, titulo, loading: true, filtro: '', items: [] });

      try {
        const baseUrl = GlobalConfig.getBaseUrl();
        const token = GlobalConfig.getJwToken();
        const resp = await obterTributacoesCall(baseUrl, token, tipo, undefined, origemParam);

        if (resp.succeeded && Array.isArray(resp.data)) {
          const mapped: HelpTribItem[] = resp.data.map((item: any) => ({
            codigo: String(item.codigo || item.Codigo || ''),
            descricao: String(item.descricao || item.Descricao || ''),
          }));
          setHelpTrib((prev) => ({ ...prev, loading: false, items: mapped }));
        } else {
          setHelpTrib((prev) => ({ ...prev, loading: false, items: [] }));
          if (!resp.succeeded && (resp.data as any)?.message) {
            showToast((resp.data as any).message, 'info');
          }
        }
      } catch (err: any) {
        setHelpTrib((prev) => ({ ...prev, loading: false, items: [] }));
        showToast(err?.message || 'Falha ao buscar tributações.', 'error');
      }
    },
    [showToast]
  );

  const helpTribFiltrados = useMemo(() => {
    const f = helpTrib.filtro.trim().toLowerCase();
    if (!f) return helpTrib.items;
    return helpTrib.items.filter(
      (it) => it.codigo.toLowerCase().includes(f) || it.descricao.toLowerCase().includes(f)
    );
  }, [helpTrib.items, helpTrib.filtro]);

  const carregarMateriais = useCallback(
    async (termoBusca?: string) => {
      setLoadingList(true);
      try {
        const baseUrl = GlobalConfig.getBaseUrl();
        const token = GlobalConfig.getJwToken();
        const resp = await listarMateriaisTributacaoCall(baseUrl, token, termoBusca || undefined, 100);

        if (resp.succeeded && Array.isArray(resp.data)) {
          const formatados: MaterialListaItem[] = resp.data.map((m: any) => ({
            codigo_Material: m.codigo_Material || m.Codigo_Material || '',
            descricao_Portug: m.descricao_Material || m.Descricao_Material || m.descricao_Portug || m.Descricao_Portug || '',
            codigo_CF: m.classificacao_Fiscal || m.Classificacao_Fiscal || m.codigo_CF || m.Codigo_CF || '',
            origem_Mercadoria: m.origem_Mercadoria || m.Origem_Mercadoria || '',
            tributacao_ICMS: m.tributacao_ICMS || m.Tributacao_ICMS || '',
            tributacao_IPI: m.tributacao_IPI || m.Tributacao_IPI || '',
            aliquota_IPI: m.aliquota_IPI ?? m.Aliquota_IPI ?? 0,
            possuiTributacao: Boolean(m.temTributacao ?? m.TemTributacao ?? m.possuiTributacao ?? m.PossuiTributacao),
          }));
          setMateriais(formatados);
          setTotalMateriais(formatados.length);
        } else {
          setMateriais([]);
          setTotalMateriais(0);
        }
      } catch (err: any) {
        showToast(err?.message || 'Erro ao carregar lista de materiais.', 'error');
      } finally {
        setLoadingList(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (permissaoStatus !== 'autorizado') return;
    void carregarMateriais();
  }, [carregarMateriais, permissaoStatus]);

  const abrirModalEdicao = async (codigoMaterial: string, descricaoMaterial: string) => {
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const resp = await obterMateriaisTributacaoCall(baseUrl, token, codigoMaterial);

      if (resp.succeeded && resp.data) {
        const raw = resp.data;
        const t = raw.tributacao || raw.Tributacao || raw;

        const ufsFormatadas: TributacaoUF[] = Array.isArray(raw.ufs || raw.UFs)
          ? (raw.ufs || raw.UFs).map((u: any) => ({
              codigo_Material: u.codigo_Material || u.Codigo_Material || codigoMaterial,
              codigo_Estado: u.codigo_Estado || u.Codigo_Estado || '',
              perc_Calculo_ICMS: u.perc_Calculo_ICMS ?? u.Perc_Calculo_ICMS ?? 100,
              aliquota_ICMS: u.aliquota_ICMS ?? u.Aliquota_ICMS ?? 0,
              aliquota_ICMS_Inter: u.aliquota_ICMS_Inter ?? u.Aliquota_ICMS_Inter ?? 0,
              tributacao_ICMS_ST: u.tributacao_ICMS_ST ?? u.Tributacao_ICMS_ST ?? 0,
              aliquota_ICMS_ST: u.aliquota_ICMS_ST ?? u.Aliquota_ICMS_ST ?? 0,
              perc_Valor_Agreg: u.perc_Valor_Agreg ?? u.Perc_Valor_Agreg ?? 0,
              perc_Reducao_ICMS_ST: u.perc_Reducao_ICMS_ST ?? u.Perc_Reducao_ICMS_ST ?? 0,
              perc_Valor_Agreg_SN: u.perc_Valor_Agreg_SN ?? u.Perc_Valor_Agreg_SN ?? 0,
              tributacao_ICMS: u.tributacao_ICMS ?? u.Tributacao_ICMS ?? '',
              codigo_CSOSN: u.codigo_CSOSN ?? u.Codigo_CSOSN ?? '',
              perc_Adic_ICMS_FCP: u.perc_Adic_ICMS_FCP ?? u.Perc_Adic_ICMS_FCP ?? 0,
            }))
          : [];

        const convFormatadas: UnidConversaoItem[] = Array.isArray(raw.conversoes || raw.Conversoes)
          ? (raw.conversoes || raw.Conversoes).map((c: any) => ({
              codigo_Material: c.codigo_Material || c.Codigo_Material || codigoMaterial,
              uM_Converter: c.uM_Converter || c.UM_Converter || '',
              fator_Conv: c.fator_Conv ?? c.Fator_Conv ?? 1,
            }))
          : [];

        setForm({
          codigo_Material: codigoMaterial,
          descricao_Material: descricaoMaterial,
          origem_Mercadoria: String(t.origem_Mercadoria ?? t.Origem_Mercadoria ?? '0'),
          codigo_CF: t.classificacao_Fiscal || t.Classificacao_Fiscal || t.codigo_CF || t.Codigo_CF || raw.classificacao_Fiscal || raw.Classificacao_Fiscal || '',
          tributacao_ICMS: t.tributacao_ICMS || t.Tributacao_ICMS || '00',
          descricao_ICMS: t.descricao_ICMS || t.Descricao_ICMS || '',
          tributacao_IPI: t.tributacao_IPI || t.Tributacao_IPI || '50',
          descricao_IPI: t.descricao_IPI || t.Descricao_IPI || '',
          aliquota_IPI: t.aliquota_IPI ?? t.Aliquota_IPI ?? 0,
          codigo_CSOSN: t.codigo_CSOSN || t.Codigo_CSOSN || '',
          descricao_CSOSN: t.descricao_CSOSN || t.Descricao_CSOSN || '',
          codigo_CBenef: t.codigo_CBenef || t.Codigo_CBenef || '',
          codigo_CBenef_Mao_Obra: t.codigo_CBenef_Mao_Obra || t.Codigo_CBenef_Mao_Obra || '',
          regime_Est_Simplificado: t.regime_Est_Simplificado ?? t.Regime_Est_Simplificado ?? 0,
          num_Documento_FCI: t.num_Documento_FCI || t.Num_Documento_FCI || '',
          perc_Impostos: t.perc_Impostos ?? t.Perc_Impostos ?? 0,
          codificacao_NVE: t.codificacao_NVE || t.Codificacao_NVE || '',
          codigo_NVE: t.codigo_NVE || t.Codigo_NVE || '',
          tributacao_Retorno: t.origem_Trib_Retorno ?? t.Origem_Trib_Retorno ?? t.tributacao_Retorno ?? 0,
          cst_IBS_CBS: t.cst_IBS_CBS || t.Cst_IBS_CBS || t.csT_IBS_CBS || t.CST_IBS_CBS || '',
          classtrib_IBS_CBS: t.classtrib_IBS_CBS || t.Classtrib_IBS_CBS || '',
          cst_IS: t.cst_IS || t.Cst_IS || t.csT_IS || t.CST_IS || '',
          classtrib_IS: t.classtrib_IS || t.Classtrib_IS || '',
          cst_IBS_CBS_Reg: t.cst_IBS_CBS_Reg || t.Cst_IBS_CBS_Reg || t.csT_IBS_CBS_Reg || t.CST_IBS_CBS_Reg || '',
          classtrib_IBS_CBS_Reg: t.classtrib_IBS_CBS_Reg || t.Classtrib_IBS_CBS_Reg || '',
          grava_Rastro_NFe: t.gravar_Rastro_NFe ?? t.Gravar_Rastro_NFe ?? t.grava_Rastro_NFe ?? 0,
          unid_Tributaria: raw.unid_Tributaria || raw.Unid_Tributaria || t.unid_Tributaria || t.Unid_Tributaria || '',
          fator_Conv_Trib: t.fator_Conv_Trib ?? t.Fator_Conv_Trib ?? 1,
          codigo_Enquadramento_IPI: t.codigo_Enq_IPI || t.Codigo_Enq_IPI || t.codigo_Enquadramento_IPI || '',
          tipo_Tributacao_PIS: t.tributacao_PIS || t.Tributacao_PIS || t.tipo_Tributacao_PIS || '',
          tipo_Tributacao_COFINS: t.tributacao_COFINS || t.Tributacao_COFINS || t.tipo_Tributacao_COFINS || '',
          codigo_CEST: t.codigo_CEST || t.Codigo_CEST || '',
          ufs: ufsFormatadas,
          conversoes: convFormatadas,
        });
        setConversoesLista(convFormatadas);
        setUfParaAdicionar('');
        setActiveTab('federal');
        setModalOpen(true);
      } else {
        showToast('Não foi possível obter dados tributários do material.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar dados do material.', 'error');
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();

      const payload = {
        Codigo_Material: form.codigo_Material,
        Classificacao_Fiscal: form.codigo_CF || '',
        Aliquota_IPI: form.aliquota_IPI || 0,
        Origem_Mercadoria: form.origem_Mercadoria || '0',
        Tributacao_ICMS: form.tributacao_ICMS || '00',
        Tributacao_IPI: form.tributacao_IPI || '50',
        Codigo_CSOSN: form.codigo_CSOSN || null,
        Codigo_CBenef: form.codigo_CBenef || null,
        Codigo_CBenef_Mao_Obra: form.codigo_CBenef_Mao_Obra || null,
        Regime_Est_Simplificado: form.regime_Est_Simplificado || 0,
        Num_Documento_FCI: form.num_Documento_FCI || null,
        Perc_Impostos: form.perc_Impostos || 0,
        Codificacao_NVE: form.codificacao_NVE || null,
        Codigo_NVE: form.codigo_NVE || null,
        Codigo_Enq_IPI: form.codigo_Enquadramento_IPI || null,
        Codigo_CEST: form.codigo_CEST || null,
        Gravar_Rastro_NFe: form.grava_Rastro_NFe || 0,
        Fator_Conv_Trib: form.fator_Conv_Trib || 1,
        Origem_Trib_Retorno: form.tributacao_Retorno || 0,
        Tributacao_PIS: form.tipo_Tributacao_PIS || null,
        Tributacao_COFINS: form.tipo_Tributacao_COFINS || null,
        CST_IBS_CBS: form.cst_IBS_CBS || null,
        Classtrib_IBS_CBS: form.classtrib_IBS_CBS || null,
        CST_IS: form.cst_IS || null,
        Classtrib_IS: form.classtrib_IS || null,
        CST_IBS_CBS_Reg: form.cst_IBS_CBS_Reg || null,
        Classtrib_IBS_CBS_Reg: form.classtrib_IBS_CBS_Reg || null,
        UFs: form.ufs.map((u) => ({
          Codigo_Material: form.codigo_Material,
          Codigo_Estado: u.codigo_Estado,
          Perc_Calculo_ICMS: u.perc_Calculo_ICMS ?? 100,
          Aliquota_ICMS: u.aliquota_ICMS ?? 0,
          Aliquota_ICMS_Inter: u.aliquota_ICMS_Inter ?? 0,
          Tributacao_ICMS_ST: u.tributacao_ICMS_ST ?? 0,
          Aliquota_ICMS_ST: u.aliquota_ICMS_ST ?? 0,
          Perc_Valor_Agreg: u.perc_Valor_Agreg ?? 0,
          Perc_Reducao_ICMS_ST: u.perc_Reducao_ICMS_ST ?? 0,
          Perc_Valor_Agreg_SN: u.perc_Valor_Agreg_SN ?? 0,
          Tributacao_ICMS: u.tributacao_ICMS ?? form.tributacao_ICMS,
          Codigo_CSOSN: u.codigo_CSOSN ?? form.codigo_CSOSN,
          Perc_Adic_ICMS_FCP: u.perc_Adic_ICMS_FCP ?? 0,
        })),
      };

      const resp = await atualizarMateriaisTributacaoCall(baseUrl, token, payload);
      if (resp.succeeded) {
        showToast('Tributação atualizada com sucesso!', 'success');
        setModalOpen(false);
        carregarMateriais(search);
      } else {
        showToast((resp.data as any)?.message || 'Erro ao atualizar tributação.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao salvar tributação.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const updateUfField = (index: number, field: keyof TributacaoUF, value: any) => {
    setForm((prev) => {
      const novasUfs = [...prev.ufs];
      novasUfs[index] = { ...novasUfs[index], [field]: value };
      return { ...prev, ufs: novasUfs };
    });
  };

  const handleAdicionarUf = () => {
    if (!ufParaAdicionar) {
      showToast('Selecione uma UF para adicionar.', 'info');
      return;
    }

    const jaExiste = form.ufs.some((u) => u.codigo_Estado.toUpperCase() === ufParaAdicionar.toUpperCase());
    if (jaExiste) {
      showToast(`O estado ${ufParaAdicionar} já está cadastrado.`, 'info');
      return;
    }

    const novaUf: TributacaoUF = {
      codigo_Material: form.codigo_Material,
      codigo_Estado: ufParaAdicionar.toUpperCase(),
      perc_Calculo_ICMS: 100,
      aliquota_ICMS: 0,
      aliquota_ICMS_Inter: 0,
      tributacao_ICMS_ST: 0,
      aliquota_ICMS_ST: 0,
      perc_Valor_Agreg: 0,
      perc_Reducao_ICMS_ST: 0,
      perc_Valor_Agreg_SN: 0,
      tributacao_ICMS: form.tributacao_ICMS || '00',
      codigo_CSOSN: form.codigo_CSOSN || '101',
      perc_Adic_ICMS_FCP: 0,
    };

    setForm((prev) => ({
      ...prev,
      ufs: [...prev.ufs, novaUf].sort((a, b) => a.codigo_Estado.localeCompare(b.codigo_Estado)),
    }));
    setUfParaAdicionar('');
    showToast(`Estado ${novaUf.codigo_Estado} adicionado à configuração!`, 'success');
  };

  const handleRemoverUf = (codigoEstado: string) => {
    setForm((prev) => ({
      ...prev,
      ufs: prev.ufs.filter((u) => u.codigo_Estado.toUpperCase() !== codigoEstado.toUpperCase()),
    }));
    showToast(`Estado ${codigoEstado} removido.`, 'info');
  };

  const ufsDisponiveisOptions = useMemo<SearchableSelectOption[]>(() => {
    const adicionados = new Set(form.ufs.map((u) => u.codigo_Estado.toUpperCase()));
    return UFS_PADRAO.filter((sigla) => !adicionados.has(sigla)).map((sigla) => ({
      value: sigla,
      label: sigla,
    }));
  }, [form.ufs]);

  const handleSalvarConversoes = async () => {
    setSalvandoConversao(true);
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const payload = conversoesLista.map((c) => ({
        Codigo_Material: form.codigo_Material,
        UM_Converter: c.uM_Converter.toUpperCase(),
        Fator_Conv: Number(c.fator_Conv),
      }));

      const resp = await salvarConversoesUnidTribCall(baseUrl, token, form.codigo_Material, payload);
      if (resp.succeeded) {
        setForm((prev) => ({ ...prev, conversoes: conversoesLista }));
        showToast('Conversões de unidade salvas com sucesso!', 'success');
        setConversaoOpen(false);
      } else {
        showToast((resp.data as any)?.message || 'Erro ao salvar conversões.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao salvar conversões.', 'error');
    } finally {
      setSalvandoConversao(false);
    }
  };

  const handleAdicionarConversaoLinha = () => {
    if (!novaUM.trim()) {
      showToast('Informe a Unidade de Medida (ex: CX, UN, KG).', 'info');
      return;
    }
    if (!novoFator || novoFator <= 0) {
      showToast('Informe um fator de conversão válido maior que zero.', 'info');
      return;
    }

    const umUpper = novaUM.trim().toUpperCase();
    if (conversoesLista.some((c) => c.uM_Converter === umUpper)) {
      showToast(`A unidade ${umUpper} já está na lista.`, 'info');
      return;
    }

    setConversoesLista((prev) => [
      ...prev,
      { codigo_Material: form.codigo_Material, uM_Converter: umUpper, fator_Conv: novoFator },
    ]);
    setNovaUM('');
    setNovoFator(1);
  };

  const handleRemoverConversaoLinha = (um: string) => {
    setConversoesLista((prev) => prev.filter((c) => c.uM_Converter !== um));
  };

  const handleDuplicar = async () => {
    if (!duplicaDestino.trim()) {
      showToast('Selecione ou informe o material destino.', 'info');
      return;
    }

    setDuplicando(true);
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const resp = await duplicarMateriaisTributacaoCall(baseUrl, token, form.codigo_Material, duplicaDestino.trim());

      if (resp.succeeded) {
        showToast(`Tributação duplicada com sucesso para ${duplicaDestino}!`, 'success');
        setDuplicaOpen(false);
        carregarMateriais(search);
      } else {
        showToast((resp.data as any)?.message || 'Erro ao duplicar tributação.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao duplicar tributação.', 'error');
    } finally {
      setDuplicando(false);
    }
  };

  const handleBuscarMaterialDestino = async (cod: string) => {
    setDuplicaDestino(cod);
    if (!cod.trim()) {
      setDuplicaDescricao('');
      return;
    }
    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const resp = await buscaMaterialCall(baseUrl, token, cod.trim());
      if (resp.succeeded && resp.data) {
        setDuplicaDescricao(resp.data.Descricao_Portug || resp.data.descricao_Portug || '');
      } else {
        setDuplicaDescricao('');
      }
    } catch {
      setDuplicaDescricao('');
    }
  };

  const origemMercadoriaOptions: SearchableSelectOption[] = [
    { value: '0', label: '0 - Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8' },
    { value: '1', label: '1 - Estrangeira - Importação direta, exceto a indicada no código 6' },
    { value: '2', label: '2 - Estrangeira - Adquirida no mercado interno, exceto a indicada no cód 7' },
    { value: '3', label: '3 - Nacional, mercadoria/bem com Conteúdo de Importação > 40% e <= 70%' },
    { value: '4', label: '4 - Nacional, processos produtivos básicos (Decreto-Lei 288/67)' },
    { value: '5', label: '5 - Nacional, mercadoria/bem com Conteúdo de Importação <= 40%' },
    { value: '6', label: '6 - Estrangeira - Importação direta, sem similar nacional (Camex)' },
    { value: '7', label: '7 - Estrangeira - Adquirida mercado interno, sem similar (Camex)' },
    { value: '8', label: '8 - Nacional, mercadoria/bem com Conteúdo de Importação > 70%' },
  ];

  if (permissaoStatus === 'verificando') {
    return (
      <main className="clientes-page list-layout-page tributacao-page">
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
    <main className="clientes-page list-layout-page tributacao-page">
      {/* CABEÇALHO PRINCIPAL DO SISTEMA QSERPx */}
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
            <h1>Tributação do Material</h1>
            <p>Configuração de regras fiscais, ICMS/UF, cBenef e reforma tributária.</p>
          </div>
        </div>
      </section>

      {/* PAINEL PRINCIPAL COM RESUMO, FILTRO PADRÃO E DATATABLE */}
      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de materiais</strong>
            <span>{totalMateriais} registros listados</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={(val) => {
                setSearch(val);
                carregarMateriais(val);
              }}
              mobileLabel="Pesquisar"
              placeholder="Pesquisar código ou descrição"
              className="clientes-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarMateriais(search)}
              aria-label="Atualizar lista"
              title="Atualizar lista"
              disabled={loadingList}
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        {/* TABELA DE MATERIAIS */}
        {loadingList ? (
          <p className="module-empty">Carregando tributações dos materiais...</p>
        ) : materiais.length === 0 ? (
          <p className="module-empty">Nenhum material encontrado.</p>
        ) : (
          <div className="table-scroll clientes-table-wrap">
            <table className="clientes-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>CÓDIGO</th>
                  <th>DESCRIÇÃO</th>
                  <th style={{ width: '130px' }}>CLASS. FISCAL</th>
                  <th style={{ width: '90px' }}>ORIGEM</th>
                  <th style={{ width: '90px' }}>CST ICMS</th>
                  <th style={{ width: '90px' }}>CST IPI</th>
                  <th style={{ width: '100px' }}>ALÍQ. IPI</th>
                  <th style={{ width: '130px' }}>STATUS FISCAL</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((item) => (
                  <tr
                    key={item.codigo_Material}
                    onClick={() => abrirModalEdicao(item.codigo_Material, item.descricao_Portug)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong>{item.codigo_Material}</strong>
                    </td>
                    <td>{item.descricao_Portug}</td>
                    <td>{item.codigo_CF || '-'}</td>
                    <td>{item.origem_Mercadoria ?? '-'}</td>
                    <td>{item.tributacao_ICMS ?? '-'}</td>
                    <td>{item.tributacao_IPI ?? '-'}</td>
                    <td>{item.aliquota_IPI != null ? `${item.aliquota_IPI}%` : '-'}</td>
                    <td>
                      <span className={`status-badge ${item.possuiTributacao ? 'status-badge--active' : 'status-badge--inactive'}`}>
                        {item.possuiTributacao ? 'Configurada' : 'Pendente'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <div className="table-actions" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          title="Editar tributação"
                          aria-label="Editar"
                          onClick={() => abrirModalEdicao(item.codigo_Material, item.descricao_Portug)}
                        >
                          <IoCreateOutline size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL DE EDIÇÃO DA TRIBUTAÇÃO */}
      {modalOpen && (
        <section className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <article className="modal-card tributacao-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-card__header">
              <div>
                <h2>
                  Tributação do Material: <span>{form.codigo_Material}</span>
                </h2>
                <p>{form.descricao_Material}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDuplicaDestino('');
                    setDuplicaDescricao('');
                    setDuplicaOpen(true);
                  }}
                  title="Duplicar regras para outro material"
                  style={{ height: '40px', minWidth: 'auto', width: 'auto', padding: '0 14px' }}
                >
                  <IoCopyOutline size={16} />
                  <span>Duplicar</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar"
                  onClick={() => setModalOpen(false)}
                >
                  <IoCloseOutline size={18} />
                </button>
              </div>
            </header>

            {/* ABAS DO FORMULÁRIO */}
            <div className="tributacao-tabs">
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'federal' ? 'tributacao-tab--active' : ''}`}
                onClick={() => setActiveTab('federal')}
              >
                Tributos Federais & ICMS
              </button>
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'reforma' ? 'tributacao-tab--active' : ''}`}
                onClick={() => setActiveTab('reforma')}
              >
                Reforma Tributária (IBS/CBS/IS)
              </button>
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'opcoes' ? 'tributacao-tab--active' : ''}`}
                onClick={() => setActiveTab('opcoes')}
              >
                Opções & FCI
              </button>
              <button
                type="button"
                className={`tributacao-tab ${activeTab === 'ufs' ? 'tributacao-tab--active' : ''}`}
                onClick={() => setActiveTab('ufs')}
              >
                Tributação por UF ({form.ufs.length})
              </button>
            </div>

            <div className="tributacao-modal-body">
              {/* ABA 1: TRIBUTOS FEDERAIS & ICMS */}
              {activeTab === 'federal' && (
                <div className="module-form form-grid-3">
                  {/* Classificação Fiscal (NCM) com busca oficial F3 */}
                  <label>
                    <span>Classificação Fiscal (NCM)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.codigo_CF || ''}
                        onChange={(e) => setForm((p) => ({ ...p, codigo_CF: e.target.value }))}
                        placeholder="Ex: 85371090"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('ClassificacaoFiscal', 'Classificação Fiscal (NCM)', (cod) =>
                            setForm((p) => ({ ...p, codigo_CF: cod }))
                          )
                        }
                        title="Consultar Classificações Fiscais cadastradas no sistema (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Origem da Mercadoria */}
                  <label>
                    <span>Origem da Mercadoria</span>
                    <SearchableSelect
                      options={origemMercadoriaOptions}
                      value={form.origem_Mercadoria}
                      onChange={(val) => setForm((p) => ({ ...p, origem_Mercadoria: val }))}
                      placeholder="Origem"
                    />
                  </label>

                  {/* Tributação ICMS (CST) */}
                  <label>
                    <span>Tributação ICMS (CST)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.tributacao_ICMS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, tributacao_ICMS: e.target.value }))}
                        placeholder="00"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('ICMS', 'Tributação ICMS (CST)', (cod) =>
                            setForm((p) => ({ ...p, tributacao_ICMS: cod }))
                          )
                        }
                        title="Consultar CST ICMS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* CSOSN */}
                  <label>
                    <span>Código CSOSN (Simples Nacional)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.codigo_CSOSN || ''}
                        onChange={(e) => setForm((p) => ({ ...p, codigo_CSOSN: e.target.value }))}
                        placeholder="101"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('CSOSN', 'Código CSOSN', (cod) =>
                            setForm((p) => ({ ...p, codigo_CSOSN: cod }))
                          )
                        }
                        title="Consultar CSOSN (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Tributação IPI (CST) */}
                  <label>
                    <span>Tributação IPI (CST)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.tributacao_IPI || ''}
                        onChange={(e) => setForm((p) => ({ ...p, tributacao_IPI: e.target.value }))}
                        placeholder="50"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('IPI', 'Tributação IPI (CST)', (cod) =>
                            setForm((p) => ({ ...p, tributacao_IPI: cod }))
                          )
                        }
                        title="Consultar CST IPI (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Alíquota IPI (%) */}
                  <label>
                    <span>Alíquota IPI (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.aliquota_IPI ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, aliquota_IPI: parseFloat(e.target.value) || 0 }))}
                      placeholder="0,00"
                    />
                  </label>

                  {/* Enquadramento IPI */}
                  <label>
                    <span>Código Enquadramento IPI</span>
                    <input
                      type="text"
                      value={form.codigo_Enquadramento_IPI || ''}
                      onChange={(e) => setForm((p) => ({ ...p, codigo_Enquadramento_IPI: e.target.value }))}
                      placeholder="Ex: 999"
                    />
                  </label>

                  {/* PIS */}
                  <label>
                    <span>Tributação PIS (CST)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.tipo_Tributacao_PIS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, tipo_Tributacao_PIS: e.target.value }))}
                        placeholder="Ex: 01"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('PISCofins', 'Tributação PIS', (cod) =>
                            setForm((p) => ({ ...p, tipo_Tributacao_PIS: cod }))
                          )
                        }
                        title="Consultar CST PIS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* COFINS */}
                  <label>
                    <span>Tributação COFINS (CST)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.tipo_Tributacao_COFINS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, tipo_Tributacao_COFINS: e.target.value }))}
                        placeholder="Ex: 01"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('PISCofins', 'Tributação COFINS', (cod) =>
                            setForm((p) => ({ ...p, tipo_Tributacao_COFINS: cod }))
                          )
                        }
                        title="Consultar CST COFINS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* CEST */}
                  <label>
                    <span>Código CEST</span>
                    <input
                      type="text"
                      value={form.codigo_CEST || ''}
                      onChange={(e) => setForm((p) => ({ ...p, codigo_CEST: e.target.value }))}
                      placeholder="Ex: 0100100"
                    />
                  </label>

                  {/* cBenef filtrado por CST ICMS */}
                  <label>
                    <span>Código cBenef (ICMS)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.codigo_CBenef || ''}
                        onChange={(e) => setForm((p) => ({ ...p, codigo_CBenef: e.target.value }))}
                        placeholder="Benefício fiscal ICMS"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() => {
                          abrirHelpTrib(
                            'CBenef',
                            form.tributacao_ICMS
                              ? `cBenef (Filtrado CST ${form.tributacao_ICMS})`
                              : 'cBenef (Todos os Benefícios Fiscais)',
                            (cod) => setForm((p) => ({ ...p, codigo_CBenef: cod })),
                            form.tributacao_ICMS || ''
                          );
                        }}
                        title="Consultar cBenef por CST ICMS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* cBenef Mão de Obra (Busca CST 51) */}
                  <label>
                    <span>Código cBenef Mão de Obra</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.codigo_CBenef_Mao_Obra || ''}
                        onChange={(e) => setForm((p) => ({ ...p, codigo_CBenef_Mao_Obra: e.target.value }))}
                        placeholder="cBenef Mão de Obra (CST 51)"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('CBenef', 'Código cBenef Mão de Obra (CST 51)', (cod) =>
                            setForm((p) => ({ ...p, codigo_CBenef_Mao_Obra: cod })),
                            '51'
                          )
                        }
                        title="Consultar cBenef Mão de Obra - CST 51 (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>
                </div>
              )}

              {/* ABA 2: REFORMA TRIBUTÁRIA */}
              {activeTab === 'reforma' && (
                <div className="module-form form-grid-3">
                  {/* CST IBS/CBS */}
                  <label>
                    <span>CST IBS/CBS</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.cst_IBS_CBS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, cst_IBS_CBS: e.target.value }))}
                        placeholder="000"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('CBSIBS', 'CST IBS/CBS', (cod) =>
                            setForm((p) => ({ ...p, cst_IBS_CBS: cod }))
                          )
                        }
                        title="Consultar CST IBS/CBS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Classificação Tributária IBS/CBS */}
                  <label>
                    <span>Classificação Tributária IBS/CBS</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.classtrib_IBS_CBS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, classtrib_IBS_CBS: e.target.value }))}
                        placeholder="410019"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('ClassTribIBSCBS', 'Classificação Tributária IBS/CBS', (cod) =>
                            setForm((p) => ({ ...p, classtrib_IBS_CBS: cod }))
                          )
                        }
                        title="Consultar Classificação IBS/CBS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* CST Imposto Seletivo */}
                  <label>
                    <span>CST Imposto Seletivo (IS)</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.cst_IS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, cst_IS: e.target.value }))}
                        placeholder="000"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('IS', 'CST Imposto Seletivo', (cod) =>
                            setForm((p) => ({ ...p, cst_IS: cod }))
                          )
                        }
                        title="Consultar CST Imposto Seletivo (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Classificação Tributária IS */}
                  <label>
                    <span>Classificação Tributária IS</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.classtrib_IS || ''}
                        onChange={(e) => setForm((p) => ({ ...p, classtrib_IS: e.target.value }))}
                        placeholder="000001"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('ClassTribIS', 'Classificação Tributária IS', (cod) =>
                            setForm((p) => ({ ...p, classtrib_IS: cod }))
                          )
                        }
                        title="Consultar Classificação IS (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* CST IBS/CBS Regular */}
                  <label>
                    <span>CST IBS/CBS Regular</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.cst_IBS_CBS_Reg || ''}
                        onChange={(e) => setForm((p) => ({ ...p, cst_IBS_CBS_Reg: e.target.value }))}
                        placeholder="CST Regular"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('CBSIBS', 'CST IBS/CBS Regular', (cod) =>
                            setForm((p) => ({ ...p, cst_IBS_CBS_Reg: cod }))
                          )
                        }
                        title="Consultar CST IBS/CBS Regular (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>

                  {/* Classificação IBS/CBS Regular */}
                  <label>
                    <span>Classificação IBS/CBS Regular</span>
                    <div className="clientes-cep-input">
                      <input
                        type="text"
                        value={form.classtrib_IBS_CBS_Reg || ''}
                        onChange={(e) => setForm((p) => ({ ...p, classtrib_IBS_CBS_Reg: e.target.value }))}
                        placeholder="Classificação Regular"
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        onClick={() =>
                          abrirHelpTrib('ClassTribIBSCBS', 'Classificação Tributária IBS/CBS Regular', (cod) =>
                            setForm((p) => ({ ...p, classtrib_IBS_CBS_Reg: cod }))
                          )
                        }
                        title="Consultar Classificação IBS/CBS Regular (F3)"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    </div>
                  </label>
                </div>
              )}

              {/* ABA 3: OPÇÕES & FCI */}
              {activeTab === 'opcoes' && (
                <div className="module-form form-grid-3">
                  {/* Unidade Tributária com botão de Fator de Conversão */}
                  <label>
                    <span>Unid. Tributária</span>
                    <div className="tributacao-field-with-btn">
                      <input
                        type="text"
                        value={form.unid_Tributaria || ''}
                        onChange={(e) => setForm((p) => ({ ...p, unid_Tributaria: e.target.value }))}
                        placeholder="Ex: UN, KG"
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setConversaoOpen(true)}
                        title="Abrir Conversão de Unidade Tributária"
                        style={{ height: '44px', whiteSpace: 'nowrap', borderRadius: '10px' }}
                      >
                        <IoCalculatorOutline size={16} />
                        <span>Fator de conversão</span>
                      </button>
                    </div>
                  </label>

                  {/* Fator de Conversão Tributária */}
                  <label>
                    <span>Fator de Conversão Tributária</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.fator_Conv_Trib ?? 1}
                      onChange={(e) => setForm((p) => ({ ...p, fator_Conv_Trib: parseFloat(e.target.value) || 1 }))}
                      placeholder="1"
                    />
                  </label>

                  {/* % Aprox. Total Impostos (IBPT) */}
                  <label>
                    <span>% Aprox. Total Impostos (IBPT)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="tributacao-input-compact"
                      value={form.perc_Impostos ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, perc_Impostos: parseFloat(e.target.value) || 0 }))}
                      placeholder="0 a 100%"
                    />
                  </label>

                  {/* FCI */}
                  <label>
                    <span>Número Documento FCI (UUID)</span>
                    <input
                      type="text"
                      value={form.num_Documento_FCI || ''}
                      onChange={(e) => setForm((p) => ({ ...p, num_Documento_FCI: e.target.value }))}
                      placeholder="Ex: 123e4567-e89b-12d3-a456-426614174000"
                    />
                  </label>

                  {/* Codificação NVE */}
                  <label>
                    <span>Codificação NVE</span>
                    <input
                      type="text"
                      value={form.codificacao_NVE || ''}
                      onChange={(e) => setForm((p) => ({ ...p, codificacao_NVE: e.target.value }))}
                      placeholder="Codificação NVE"
                    />
                  </label>

                  {/* Tributação no Retorno */}
                  <label>
                    <span>Tributação no Retorno</span>
                    <SearchableSelect
                      options={[
                        { value: '0', label: '0 - Não tributar retorno' },
                        { value: '1', label: '1 - Tributar conforme remessa' },
                      ]}
                      value={String(form.tributacao_Retorno ?? 0)}
                      onChange={(val) => setForm((p) => ({ ...p, tributacao_Retorno: parseInt(val, 10) || 0 }))}
                      placeholder="Selecione"
                    />
                  </label>

                  {/* Checkboxes compactos em coluna no lado esquerdo */}
                  <div className="tributacao-checkbox-group">
                    <label className="tributacao-checkbox-item">
                      <input
                        type="checkbox"
                        checked={Number(form.regime_Est_Simplificado) === 1}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, regime_Est_Simplificado: e.target.checked ? 1 : 0 }))
                        }
                      />
                      <span>Utilizar Regime de Estimativa Simplificada</span>
                    </label>

                    <label className="tributacao-checkbox-item">
                      <input
                        type="checkbox"
                        checked={Number(form.grava_Rastro_NFe) === 1}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, grava_Rastro_NFe: e.target.checked ? 1 : 0 }))
                        }
                      />
                      <span>Gravar Rastro na NF-e</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ABA 4: TRIBUTAÇÃO POR UF */}
              {activeTab === 'ufs' && (
                <div>
                  <div className="tributacao-uf-bar">
                    <div style={{ flex: '0 1 240px' }}>
                      <SearchableSelect
                        options={ufsDisponiveisOptions}
                        value={ufParaAdicionar}
                        onChange={setUfParaAdicionar}
                        placeholder="Selecione um Estado..."
                      />
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleAdicionarUf}
                      disabled={!ufParaAdicionar}
                      style={{ height: '40px', width: 'auto', minWidth: 'auto', padding: '0 16px' }}
                    >
                      + Adicionar Estado
                    </button>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginLeft: 'auto' }}>
                      {form.ufs.length === 0
                        ? 'Nenhum estado configurado especificamente. O sistema usará as regras padrão gerais.'
                        : `${form.ufs.length} estado(s) configurado(s)`}
                    </span>
                  </div>

                  {form.ufs.length === 0 ? (
                    <p className="module-empty" style={{ margin: '30px 0' }}>
                      Nenhum estado cadastrado para este material. Selecione uma UF acima e clique em &quot;Adicionar Estado&quot;.
                    </p>
                  ) : (
                    <div className="tributacao-uf-table-wrap">
                      <table className="tributacao-uf-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>UF</th>
                            <th style={{ width: '90px' }}>CST ICMS</th>
                            <th style={{ width: '95px' }}>CSOSN</th>
                            <th style={{ width: '75px' }}>% BASE</th>
                            <th style={{ width: '75px' }}>% ICMS</th>
                            <th style={{ width: '75px' }}>% INTER</th>
                            <th style={{ width: '75px' }}>% FCP</th>
                            <th style={{ width: '50px', textAlign: 'center' }}>ST?</th>
                            <th style={{ width: '75px' }}>% MVA</th>
                            <th style={{ width: '75px' }}>% RED ST</th>
                            <th style={{ width: '75px' }}>% MVA SN</th>
                            <th style={{ width: '75px' }}>% ALÍQ ST</th>
                            <th style={{ width: '50px', textAlign: 'center' }}>AÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.ufs.map((u, i) => (
                            <tr key={u.codigo_Estado}>
                              <td>
                                <span className="tributacao-uf-badge">{u.codigo_Estado}</span>
                              </td>
                              {/* CST com busca */}
                              <td>
                                <div className="tributacao-uf-search-group">
                                  <input
                                    type="text"
                                    className="tributacao-uf-input"
                                    value={u.tributacao_ICMS || ''}
                                    onChange={(e) => updateUfField(i, 'tributacao_ICMS', e.target.value)}
                                    placeholder="00"
                                  />
                                  <button
                                    type="button"
                                    className="tributacao-uf-search-btn"
                                    onClick={() =>
                                      abrirHelpTrib('ICMS', `CST ICMS (${u.codigo_Estado})`, (cod) =>
                                        updateUfField(i, 'tributacao_ICMS', cod)
                                      )
                                    }
                                    title={`Consultar CST ICMS para ${u.codigo_Estado} (F3)`}
                                  >
                                    <IoSearchOutline size={13} />
                                  </button>
                                </div>
                              </td>
                              {/* CSOSN com busca */}
                              <td>
                                <div className="tributacao-uf-search-group">
                                  <input
                                    type="text"
                                    className="tributacao-uf-input"
                                    value={u.codigo_CSOSN || ''}
                                    onChange={(e) => updateUfField(i, 'codigo_CSOSN', e.target.value)}
                                    placeholder="101"
                                  />
                                  <button
                                    type="button"
                                    className="tributacao-uf-search-btn"
                                    onClick={() =>
                                      abrirHelpTrib('CSOSN', `CSOSN (${u.codigo_Estado})`, (cod) =>
                                        updateUfField(i, 'codigo_CSOSN', cod)
                                      )
                                    }
                                    title={`Consultar CSOSN para ${u.codigo_Estado} (F3)`}
                                  >
                                    <IoSearchOutline size={13} />
                                  </button>
                                </div>
                              </td>
                              {/* % Base */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  value={u.perc_Calculo_ICMS}
                                  onChange={(e) =>
                                    updateUfField(i, 'perc_Calculo_ICMS', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % ICMS */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  value={u.aliquota_ICMS}
                                  onChange={(e) =>
                                    updateUfField(i, 'aliquota_ICMS', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % Inter */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  value={u.aliquota_ICMS_Inter}
                                  onChange={(e) =>
                                    updateUfField(i, 'aliquota_ICMS_Inter', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % FCP */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  value={u.perc_Adic_ICMS_FCP}
                                  onChange={(e) =>
                                    updateUfField(i, 'perc_Adic_ICMS_FCP', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* ST? */}
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={Number(u.tributacao_ICMS_ST) === 1}
                                  onChange={(e) =>
                                    updateUfField(i, 'tributacao_ICMS_ST', e.target.checked ? 1 : 0)
                                  }
                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                              </td>
                              {/* % MVA */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  disabled={Number(u.tributacao_ICMS_ST) !== 1}
                                  value={u.perc_Valor_Agreg}
                                  onChange={(e) =>
                                    updateUfField(i, 'perc_Valor_Agreg', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % Red ST */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  disabled={Number(u.tributacao_ICMS_ST) !== 1}
                                  value={u.perc_Reducao_ICMS_ST}
                                  onChange={(e) =>
                                    updateUfField(i, 'perc_Reducao_ICMS_ST', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % MVA SN */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  disabled={Number(u.tributacao_ICMS_ST) !== 1}
                                  value={u.perc_Valor_Agreg_SN}
                                  onChange={(e) =>
                                    updateUfField(i, 'perc_Valor_Agreg_SN', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* % Alíq ST */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="tributacao-uf-input"
                                  disabled={Number(u.tributacao_ICMS_ST) !== 1}
                                  value={u.aliquota_ICMS_ST}
                                  onChange={(e) =>
                                    updateUfField(i, 'aliquota_ICMS_ST', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </td>
                              {/* Excluir UF */}
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => handleRemoverUf(u.codigo_Estado)}
                                  title={`Remover configuração de ${u.codigo_Estado}`}
                                >
                                  <IoTrashOutline size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* MODAL ACTIONS - PADRÃO EXATO QSERPx */}
            <div className="form-actions clientes-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalOpen(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSalvar}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* MODAL DE CONVERSÃO DE UNIDADE TRIBUTÁRIA */}
      {conversaoOpen && (
        <section className="modal-backdrop" onClick={() => setConversaoOpen(false)}>
          <article className="modal-card" style={{ width: 'min(580px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
            <header className="modal-card__header">
              <div>
                <h2>Conversão de Unidade Tributária</h2>
                <p>Material: {form.codigo_Material} - {form.descricao_Material}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setConversaoOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
                <label>
                  <span>UNIDADE A CONVERTER</span>
                  <input
                    type="text"
                    value={novaUM}
                    onChange={(e) => setNovaUM(e.target.value.toUpperCase())}
                    placeholder="Ex: CX, KG, RL"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </label>
                <label>
                  <span>FATOR DE CONVERSÃO</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={novoFator}
                    onChange={(e) => setNovoFator(parseFloat(e.target.value) || 0)}
                    placeholder="1"
                  />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAdicionarConversaoLinha}
                  style={{ height: '44px', width: 'auto', minWidth: 'auto', padding: '0 16px' }}
                >
                  Adicionar
                </button>
              </div>

              {conversoesLista.length === 0 ? (
                <p className="module-empty">Nenhum fator de conversão adicional configurado.</p>
              ) : (
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th>UNIDADE (UM)</th>
                      <th>FATOR MULTIPLICADOR</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversoesLista.map((c) => (
                      <tr key={c.uM_Converter}>
                        <td><strong>{c.uM_Converter}</strong></td>
                        <td>{c.fator_Conv}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="icon-button"
                            style={{ color: '#ef4444' }}
                            onClick={() => handleRemoverConversaoLinha(c.uM_Converter)}
                            title="Remover conversão"
                          >
                            <IoTrashOutline size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="form-actions clientes-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConversaoOpen(false)}
                disabled={salvandoConversao}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSalvarConversoes}
                disabled={salvandoConversao}
              >
                {salvandoConversao ? 'Salvando...' : 'Salvar Conversões'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* MODAL DE DUPLICAR TRIBUTAÇÃO */}
      {duplicaOpen && (
        <section className="modal-backdrop" onClick={() => setDuplicaOpen(false)}>
          <article className="modal-card" style={{ width: 'min(500px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
            <header className="modal-card__header">
              <h2>Duplicar Tributação</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setDuplicaOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Copiará todas as alíquotas federais, estaduais e reforma de <strong>{form.codigo_Material}</strong> para o material destino:
              </p>

              <label>
                <span>CÓDIGO MATERIAL DESTINO</span>
                <input
                  type="text"
                  value={duplicaDestino}
                  onChange={(e) => handleBuscarMaterialDestino(e.target.value)}
                  placeholder="Ex: 1001000002"
                  autoFocus
                />
              </label>

              {duplicaDescricao && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Material Selecionado:</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{duplicaDescricao}</p>
                </div>
              )}
            </div>

            <div className="form-actions clientes-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDuplicaOpen(false)}
                disabled={duplicando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleDuplicar}
                disabled={duplicando || !duplicaDestino.trim()}
              >
                {duplicando ? 'Duplicando...' : 'Confirmar Duplicação'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* MODAL DE CONSULTA F3 (CST, CSOSN, IPI, PIS/COFINS, NCM, CBENEF) */}
      {helpTrib.open && (
        <section className="modal-backdrop" onClick={() => setHelpTrib((p) => ({ ...p, open: false }))}>
          <article className="modal-card tributacao-help-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-card__header">
              <h2>{helpTrib.titulo}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setHelpTrib((p) => ({ ...p, open: false }))}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            {/* Input de filtro 100% no padrão CSS QSERPx */}
            <div className="tributacao-help-filter-box">
              <div className="global-list-search__input-wrap">
                <IoSearchOutline size={16} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Filtrar por código ou descrição..."
                  value={helpTrib.filtro}
                  onChange={(e) => setHelpTrib((p) => ({ ...p, filtro: e.target.value }))}
                  className="tributacao-help-search-input"
                  autoFocus
                />
                {helpTrib.filtro.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    onClick={() => setHelpTrib((p) => ({ ...p, filtro: '' }))}
                    aria-label="Limpar filtro"
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="tributacao-help-list-wrap">
              {helpTrib.loading ? (
                <p className="module-empty">Carregando opções...</p>
              ) : helpTribFiltrados.length === 0 ? (
                <p className="module-empty">Nenhum registro encontrado.</p>
              ) : (
                <table className="tributacao-help-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>CÓDIGO</th>
                      <th>DESCRIÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {helpTribFiltrados.map((it) => (
                      <tr
                        key={it.codigo}
                        onClick={() => {
                          helpTribSelectRef.current?.(it.codigo, it.descricao);
                          setHelpTrib((p) => ({ ...p, open: false }));
                        }}
                      >
                        <td>
                          <strong>{it.codigo}</strong>
                        </td>
                        <td>{it.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="form-actions clientes-modal-actions" style={{ padding: '12px 16px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHelpTrib((p) => ({ ...p, open: false }))}
              >
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
