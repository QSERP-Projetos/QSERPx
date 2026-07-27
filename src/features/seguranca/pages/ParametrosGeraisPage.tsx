import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoCloseOutline, IoConstructOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import apiManager, { ApiCallType } from '../../../services/apiManager';
import { GlobalConfig } from '../../../services/globalConfig';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type ActiveTab = 'nfe' | 'faturamento';

type SerieNotaRow = {
  id: number;
  serie: string;
  ultNota: string;
  computador: string;
  emissao: string;
  modeloNota: string;
};

type ParametrosNfeResponse = {
  [key: string]: unknown;
};

type ParametrosNfePutPayload = {
  Codigo_Empresa: number;
  Tipo_Gerenciador_NFe: number | null;
  Versao_NFe: string;
  Qtd_Vias_Danfe: number | null;
  Tipo_Danfe: number;
  Diretorio_NFE: string;
  E_mail_NFe: string;
  E_mail_NFe_SMTP: string;
  E_mail_NFe_SMTP_Usuario: string;
  E_mail_NFe_SMTP_Senha: string;
  E_mail_NFe_SMTP_Porta: number;
  E_mail_NFe_SMTP_Nec_Aut: number | null;
  E_mail_NFe_SMTP_SSL: number | null;
  Diretorio_NFe_Rec: string;
  E_mail_NFe_Ent: string;
  E_mail_NFe_Ent_POP: string;
  E_mail_NFe_Ent_Usuario: string;
  E_mail_NFe_Ent_Senha: string;
  E_mail_NFe_Ent_SSL: number | null;
  NFe_Ultimo_NSU: string;
  Endereco_Certificado: string | null;
  Senha_Certificado: string | null;
  Data_Inicio_Validade: string | null;
  Data_Fim_Validade: string | null;
  Usuario: string;
};

const gerenciadorOptions: SearchableSelectOption[] = [
  { value: 'QSApi', label: 'QSApi' },
  { value: 'QS NFe', label: 'QS NFe' },
];

const versaoXmlOptions: SearchableSelectOption[] = [
  { value: '4.00', label: '4.00' },
  { value: '5.00', label: '5.00' },
];

const tipoImpressaoOptions: SearchableSelectOption[] = [
  { value: '1', label: 'Padrão Retrato' },
  { value: '2', label: 'Padrão Paisagem' },
  { value: '3', label: 'Customizado Retrato' },
  { value: '4', label: 'Customizado Paisagem' },
  { value: '5', label: 'Padrão Retrato Novo' },
  { value: '6', label: 'Padrão Paisagem Novo' },
];

const layoutOptions: SearchableSelectOption[] = [
  { value: '01', label: 'Padrão' },
  { value: '02', label: 'KPB' },
  { value: '03', label: 'Ziliani' },
  { value: '04', label: 'Driveway' },
  { value: '05', label: 'Grassi' },
  { value: '06', label: 'Bioskin' },
  { value: '07', label: 'Laser' },
  { value: '08', label: 'Aquarius' },
  { value: '09', label: 'Joal' },
  { value: '10', label: 'Sicamet' },
  { value: '11', label: 'Cassiopeia' },
  { value: '12', label: 'Yutaka' },
  { value: '13', label: 'Marbon' },
  { value: '14', label: 'RevestCar' },
  { value: '15', label: 'Granei' },
];

const layoutFormatos: Record<string, string> = {
  '01': 'A4 - 210 x 297 mm',
  '02': 'Fanfold - 8.5 x 12 in',
  '03': 'Letter - 8,5 x 11 in',
  '04': 'US - Fanfold',
  '05': 'User - 23,59 x 33,15 cm',
  '06': 'User - 21,30 x 30,05 cm',
  '07': 'A4 - Laser',
  '08': 'User - 25,80 x 31,20 cm',
  '09': 'User - 21,30 x 30,45 cm',
  '10': 'User - 21,30 x 30,50 cm',
  '11': 'User - 21,00 x 33,00 cm',
  '12': 'Fanfold - 8.5 x 12 in',
  '13': 'Fanfold - 8.5 x 12 in',
  '14': 'A4 - 210 x 297 mm',
  '15': 'A4 - 210 x 297 mm',
};

const loteOptions: SearchableSelectOption[] = [
  { value: '0', label: 'Não exibir' },
  { value: '2', label: 'Exibir todos os lotes agrupados no item' },
  { value: '1', label: 'Gerar um item por lote na NFe' },
  { value: '3', label: 'Não agrupar itens na NFe' },
];

const impressaoEtiquetasOptions: SearchableSelectOption[] = [
  { value: '0', label: 'Nenhuma' },
  { value: '1', label: 'Etiqueta de nota fiscal' },
  { value: '2', label: 'Etiqueta de expedição' },
  { value: '3', label: 'Ambas' },
];

const computadorOptions: SearchableSelectOption[] = [
  { value: 'ambas', label: 'Ambas' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'cliente', label: 'Cliente' },
];

const emissaoOptions: SearchableSelectOption[] = [
  { value: 'eletronica_hor', label: 'Eletrônica Hor.' },
  { value: 'eletronica_vert', label: 'Eletrônica Vert.' },
  { value: 'papel', label: 'Papel' },
];

const modeloNotaOptions: SearchableSelectOption[] = [
  { value: 'nfse_hom', label: 'NFS-e Hom.' },
  { value: 'nfe', label: 'NF-e' },
  { value: 'nfse', label: 'NFS-e' },
];

const baseComissaoOptions: SearchableSelectOption[] = [
  { value: '1', label: 'Valor total da nota fiscal' },
  { value: '2', label: 'Valor total dos produtos' },
  { value: '3', label: 'Valor total da nota fiscal sem ICMS ST' },
  { value: '4', label: 'Valor líquido de venda (descontar ICMS, PIS, COFINS)' },
];

const gnreFornecedorOptions: SearchableSelectOption[] = [
  { value: 'GNRE', label: 'GNRE' },
];

export function ParametrosGeraisPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('nfe');
  const certificadoInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingParametros, setLoadingParametros] = useState(false);
  const [modalCertificadoOpen, setModalCertificadoOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  // NF-e — topo
  const [gerenciador, setGerenciador] = useState('QSApi');
  const [versaoXml, setVersaoXml] = useState('5.00');

  // NF-e — DANFE
  const [qtdViasDanfe, setQtdViasDanfe] = useState('1');
  const [tipoImpressaoDanfe, setTipoImpressaoDanfe] = useState('6');

  // NF-e — Faturamento
  const [fatDirNfe, setFatDirNfe] = useState('');
  const [fatUsuario, setFatUsuario] = useState('');
  const [fatEmail, setFatEmail] = useState('');
  const [fatSenha, setFatSenha] = useState('');
  const [fatPorta, setFatPorta] = useState('');
  const [fatSmtp, setFatSmtp] = useState('');
  const [fatServidorAuth, setFatServidorAuth] = useState(false);
  const [fatServidorSsl, setFatServidorSsl] = useState(false);

  // NF-e — Recebimento
  const [recDirNfe, setRecDirNfe] = useState('');
  const [recUsuario, setRecUsuario] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recSenha, setRecSenha] = useState('');
  const [recPorta, setRecPorta] = useState('');
  const [recPop, setRecPop] = useState('');
  const [recServidorConexao, setRecServidorConexao] = useState(false);

  // NF-e — NSU
  const [ultimoNsu, setUltimoNsu] = useState('');

  // NF-e — Certificado digital
  const [certEndereco, setCertEndereco] = useState('');
  const [certSenha, setCertSenha] = useState('');
  const [certValidadeInicio, setCertValidadeInicio] = useState('');
  const [certValidadeFim, setCertValidadeFim] = useState('');

  // Faturamento — geral
  const [fatLayout, setFatLayout] = useState('');
  const [fatItens, setFatItens] = useState('');
  const [fatLotes, setFatLotes] = useState('0');
  const [fatCsll, setFatCsll] = useState('');
  const [fatIss, setFatIss] = useState('');
  const [fatIrrf, setFatIrrf] = useState('');
  const [fatImpressaoEtiquetas, setFatImpressaoEtiquetas] = useState('0');
  const [fatSerieNotas, setFatSerieNotas] = useState<SerieNotaRow[]>([]);
  const [fatCondicaoCce, setFatCondicaoCce] = useState('');
  const [fatGerarGnre, setFatGerarGnre] = useState(false);
  const [fatFornecedorGnre, setFatFornecedorGnre] = useState('GNRE');
  const [fatDiretorioGnre, setFatDiretorioGnre] = useState('');
  const [fatParticipaSimples, setFatParticipaSimples] = useState(false);
  const [fatAliqIcmsSn, setFatAliqIcmsSn] = useState('');

  // Faturamento — comissão / opções / valores
  const [fatPermitirAlterarComissao, setFatPermitirAlterarComissao] = useState(false);
  const [fatBaseComissao, setFatBaseComissao] = useState('2');
  const [fatVerificarMediaVenda, setFatVerificarMediaVenda] = useState(false);
  const [fatVerificarRateioEstoque, setFatVerificarRateioEstoque] = useState(false);
  const [fatValorMinBaseado, setFatValorMinBaseado] = useState<'pedido' | 'nota_fiscal'>('nota_fiscal');
  const [fatValorMinFaturamento, setFatValorMinFaturamento] = useState('');
  const [fatValorMinDuplicata, setFatValorMinDuplicata] = useState('');
  const [fatValorMaxFaturamento, setFatValorMaxFaturamento] = useState('');
  const [fatValorMaxDuplicata, setFatValorMaxDuplicata] = useState('');
  const [fatTipoDocContasReceber, setFatTipoDocContasReceber] = useState<'boleto' | 'duplicata'>('duplicata');

  const pickValue = (payload: ParametrosNfeResponse, keys: string[]) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] != null) {
        return payload[key];
      }
    }
    return undefined;
  };

  const toText = (value: unknown, fallback = '') => {
    if (value == null) return fallback;
    const text = String(value);
    return text.trim();
  };

  const toNumberText = (value: unknown, fallback = '') => {
    if (value == null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return String(parsed);
  };

  const toNumberOrNull = (value: string) => {
    const parsed = Number(String(value ?? '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toShortBool = (value: boolean) => (value ? 1 : 0);

  const toBoolFromNumeric = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed !== 0;
    return String(value ?? '').trim().toLowerCase() === 'true';
  };

  const toGerenciador = (value: unknown) => {
    const parsed = Number(value);
    if (parsed === 2) return 'QS NFe';
    return 'QSApi';
  };

  const formatDateShort = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = String(parsed.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const carregarParametrosNfe = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl) {
      showToast('URL da API não encontrada para carregar parâmetros de NF-e.', 'error');
      return;
    }

    if (!codigoEmpresa) {
      showToast('Empresa não encontrada na sessão atual.', 'error');
      return;
    }

    setLoadingParametros(true);
    try {
      const response = await apiManager.makeApiCall<ParametrosNfeResponse>(
        `${baseUrl.replace(/\/$/, '')}/api/v1/parametrosnfe`,
        ApiCallType.GET,
        token ? { Authorization: `Bearer ${token}` } : {},
        { CodigoEmpresa: codigoEmpresa },
      );

      if (!response.succeeded) {
        showToast(getApiErrorMessage(response, 'Não foi possível carregar os parâmetros de NF-e.'), 'error');
        return;
      }

      const payload = (response.jsonBody ?? response.data) as ParametrosNfeResponse;

      setGerenciador(toGerenciador(pickValue(payload, ['tipo_Gerenciador_NFe', 'Tipo_Gerenciador_NFe'])));
      setVersaoXml(toText(pickValue(payload, ['versao_NFe', 'Versao_NFe']), '5.00'));
      setQtdViasDanfe(toNumberText(pickValue(payload, ['qtd_Vias_Danfe', 'Qtd_Vias_Danfe']), '1'));
      setTipoImpressaoDanfe(toNumberText(pickValue(payload, ['tipo_Danfe', 'Tipo_Danfe']), '6'));

      setFatDirNfe(toText(pickValue(payload, ['diretorio_NFE', 'Diretorio_NFE'])));
      setFatEmail(toText(pickValue(payload, ['e_mail_NFe', 'E_mail_NFe'])));
      setFatSmtp(toText(pickValue(payload, ['e_mail_NFe_SMTP', 'E_mail_NFe_SMTP'])));
      setFatUsuario(toText(pickValue(payload, ['e_mail_NFe_SMTP_Usuario', 'E_mail_NFe_SMTP_Usuario'])));
      setFatSenha(toText(pickValue(payload, ['e_mail_NFe_SMTP_Senha', 'E_mail_NFe_SMTP_Senha'])));
      setFatPorta(toNumberText(pickValue(payload, ['e_mail_NFe_SMTP_Porta', 'E_mail_NFe_SMTP_Porta']), '587'));
      setFatServidorAuth(toBoolFromNumeric(pickValue(payload, ['e_mail_NFe_SMTP_Nec_Aut', 'E_mail_NFe_SMTP_Nec_Aut'])));
      setFatServidorSsl(toBoolFromNumeric(pickValue(payload, ['e_mail_NFe_SMTP_SSL', 'E_mail_NFe_SMTP_SSL'])));

      setRecDirNfe(toText(pickValue(payload, ['diretorio_NFe_Rec', 'Diretorio_NFe_Rec'])));
      setRecEmail(toText(pickValue(payload, ['e_mail_NFe_Ent', 'E_mail_NFe_Ent'])));
      setRecPop(toText(pickValue(payload, ['e_mail_NFe_Ent_POP', 'E_mail_NFe_Ent_POP'])));
      setRecUsuario(toText(pickValue(payload, ['e_mail_NFe_Ent_Usuario', 'E_mail_NFe_Ent_Usuario'])));
      setRecSenha(toText(pickValue(payload, ['e_mail_NFe_Ent_Senha', 'E_mail_NFe_Ent_Senha'])));
      setRecPorta(toNumberText(pickValue(payload, ['e_mail_NFe_Ent_Porta', 'E_mail_NFe_Ent_Porta']), '110'));
      setRecServidorConexao(toBoolFromNumeric(pickValue(payload, ['e_mail_NFe_Ent_SSL', 'E_mail_NFe_Ent_SSL'])));

      setUltimoNsu(toText(pickValue(payload, ['nFe_Ultimo_NSU', 'NFe_Ultimo_NSU'])));

      setCertEndereco(toText(pickValue(payload, ['endereco_Certificado', 'Endereco_Certificado'])));
      setCertSenha(toText(pickValue(payload, ['senha_Certificado', 'Senha_Certificado'])));
      setCertValidadeInicio(formatDateShort(pickValue(payload, ['data_Inicio_Validade', 'Data_Inicio_Validade', 'data_inicio_Validade'])));
      setCertValidadeFim(formatDateShort(pickValue(payload, ['data_Fim_Validade', 'Data_Fim_Validade', 'data_fim_Validade'])));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar os parâmetros de NF-e.', 'error');
    } finally {
      setLoadingParametros(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab !== 'nfe') return;
    void carregarParametrosNfe();
  }, [activeTab, carregarParametrosNfe]);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(ROUTES.home, { replace: true });
  };

  const handleSalvar = () => {
    if (!isEditing || loadingParametros) return;

    const confirmed = window.confirm('Deseja salvar os dados?');
    if (!confirmed) return;

    void salvarParametrosNFe();
  };

  const salvarParametrosNFe = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !codigoEmpresa || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    const payload: ParametrosNfePutPayload = {
      Codigo_Empresa: Number(codigoEmpresa),
      Tipo_Gerenciador_NFe: gerenciador === 'QS NFe' ? 2 : 3,
      Versao_NFe: versaoXml,
      Qtd_Vias_Danfe: toNumberOrNull(qtdViasDanfe),
      Tipo_Danfe: Number(tipoImpressaoDanfe) || 0,
      Diretorio_NFE: fatDirNfe,
      E_mail_NFe: fatEmail,
      E_mail_NFe_SMTP: fatSmtp,
      E_mail_NFe_SMTP_Usuario: fatUsuario,
      E_mail_NFe_SMTP_Senha: fatSenha,
      E_mail_NFe_SMTP_Porta: Number(fatPorta) || 0,
      E_mail_NFe_SMTP_Nec_Aut: toShortBool(fatServidorAuth),
      E_mail_NFe_SMTP_SSL: toShortBool(fatServidorSsl),
      Diretorio_NFe_Rec: recDirNfe,
      E_mail_NFe_Ent: recEmail,
      E_mail_NFe_Ent_POP: recPop,
      E_mail_NFe_Ent_Usuario: recUsuario,
      E_mail_NFe_Ent_Senha: recSenha,
      E_mail_NFe_Ent_SSL: toShortBool(recServidorConexao),
      NFe_Ultimo_NSU: ultimoNsu,
      Endereco_Certificado: null,
      Senha_Certificado: null,
      Data_Inicio_Validade: null,
      Data_Fim_Validade: null,
      Usuario: usuario,
    };

    setLoadingParametros(true);
    try {
      const response = await apiManager.makeApiCall<{ message?: string }>(
        `${baseUrl.replace(/\/$/, '')}/api/v1/parametrosnfeput`,
        ApiCallType.PUT,
        token ? { Authorization: `Bearer ${token}` } : {},
        {},
        payload,
      );

      const message = String(response.jsonBody?.message ?? response.data?.message ?? response.bodyText ?? '').trim();

      if (response.succeeded) {
        showToast(message || 'Parâmetros NFe atualizados com sucesso!', 'success');
        setIsEditing(false);
        await carregarParametrosNfe();
        return;
      }

      showToast(message || 'Erro ao atualizar os parâmetros NFe!', 'error');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao atualizar os parâmetros NFe.', 'error');
    } finally {
      setLoadingParametros(false);
    }
  }, [
    carregarParametrosNfe,
    fatDirNfe,
    fatEmail,
    fatPorta,
    fatServidorAuth,
    fatServidorSsl,
    fatSenha,
    fatSmtp,
    fatUsuario,
    gerenciador,
    qtdViasDanfe,
    recDirNfe,
    recEmail,
    recPorta,
    recPop,
    recServidorConexao,
    recSenha,
    recUsuario,
    showToast,
    tipoImpressaoDanfe,
    ultimoNsu,
    versaoXml,
  ]);

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    setIsEditing(false);
    setModalCertificadoOpen(false);
    setActiveTab(tab);
  };

  const handleSerieNotaChange = (id: number, field: keyof SerieNotaRow, value: string) => {
    setFatSerieNotas((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleAddSerieNota = () => {
    if (!isEditing) return;
    const newId = Math.max(0, ...fatSerieNotas.map((r) => r.id)) + 1;
    setFatSerieNotas((rows) => [
      ...rows,
      { id: newId, serie: '', ultNota: '', computador: 'ambas', emissao: 'eletronica_hor', modeloNota: 'nfse_hom' },
    ]);
  };

  const handleToggleEdicao = () => {
    if (isEditing) {
      setIsEditing(false);
      setModalCertificadoOpen(false);
      if (activeTab === 'nfe') void carregarParametrosNfe();
      return;
    }

    setIsEditing(true);
  };

  const handleOpenCertificadoModal = () => {
    if (!isEditing) return;
    setModalCertificadoOpen(true);
  };

  const handleCloseCertificadoModal = () => {
    setModalCertificadoOpen(false);
  };

  const handleOpenCertificadoExplorer = () => {
    certificadoInputRef.current?.click();
  };

  const handleCertificadoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setCertEndereco(selected.name);
    event.target.value = '';
  };

  const handleLimparCertificado = () => {
    setCertEndereco('');
    setCertSenha('');
    setCertValidadeInicio('');
    setCertValidadeFim('');
  };

  const handleImportarCertificado = () => {
    if (!isEditing) return;

    if (!certEndereco) {
      showToast('Selecione um certificado .pfx para importar.', 'error');
      return;
    }
    showToast('Certificado preparado para importação.', 'success');
    setModalCertificadoOpen(false);
  };

  const isFormLocked = !isEditing || loadingParametros;

  return (
    <>
      <main className="clientes-page list-layout-page params-gerais-page">
        {/* Cabeçalho */}
        <section className="clientes-page__header">
          <div className="clientes-page__title-wrap">
            <button
              className="icon-button"
              type="button"
              onClick={handleClose}
              aria-label="Voltar"
            >
              <IoArrowBack size={18} />
            </button>
            <div>
              <h1>Parâmetros Gerais</h1>
              <p>Configurações gerais do sistema.</p>
            </div>
          </div>
        </section>

        {/* Painel principal */}
        <section className="clientes-panel list-layout-panel params-gerais-panel">
          {/* Abas */}
          <div className="contas-receber-tabs">
            <button
              type="button"
              className={`contas-receber-tab${activeTab === 'nfe' ? ' contas-receber-tab--active' : ''}`}
              onClick={() => handleTabChange('nfe')}
            >
              NF-e
            </button>
            <button
              type="button"
              className={`contas-receber-tab${activeTab === 'faturamento' ? ' contas-receber-tab--active' : ''} contas-receber-tab--dev`}
              onClick={() => setDevModalOpen(true)}
              title="Em desenvolvimento"
            >
              Faturamento
            </button>
          </div>

          {/* Corpo da aba */}
          {activeTab === 'nfe' && (
            <div className="params-gerais-tab-body">
              <div className="nfe-params-form">

                {/* Linha 1: Gerenciador + Versão XML */}
                <div className="nfe-params-flds-row">
                  <div className="nfe-params-field">
                    <span>Gerenciador</span>
                    <SearchableSelect
                      options={gerenciadorOptions}
                      value={gerenciador}
                      onChange={setGerenciador}
                      enableSearch={false}
                      ariaLabel="Gerenciador"
                      disabled={isFormLocked}
                    />
                  </div>
                  <div className="nfe-params-field">
                    <span>Versão XML</span>
                    <SearchableSelect
                      options={versaoXmlOptions}
                      value={versaoXml}
                      onChange={setVersaoXml}
                      enableSearch={false}
                      ariaLabel="Versão XML"
                      disabled={isFormLocked}
                    />
                  </div>
                </div>

                {/* Linha 2: Botões de ação */}
                <div className="nfe-params-btns">
                  <button type="button" className="nfe-params-btn" onClick={handleOpenCertificadoModal} disabled={isFormLocked}>Certificado digital</button>
                  <button type="button" className="nfe-params-btn" disabled={isFormLocked}>Executar API&apos;s GOV</button>
                  <button type="button" className="nfe-params-btn" disabled={isFormLocked}>Verificar Status API&apos;s GOV</button>
                </div>

                {loadingParametros && <p className="nfe-params-loading">Carregando parâmetros de NF-e...</p>}

                {/* Linha 3: DANFE */}
                <div className="nfe-params-flds-row">
                  <div className="nfe-params-field">
                    <span>Quantidade de vias DANFE</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      className="text-field nfe-params-qty-input"
                      value={qtdViasDanfe}
                      onChange={(e) => setQtdViasDanfe(e.target.value)}
                      disabled={isFormLocked}
                    />
                  </div>
                  <div className="nfe-params-field">
                    <span>Tipo de impressão DANFE</span>
                    <SearchableSelect
                      options={tipoImpressaoOptions}
                      value={tipoImpressaoDanfe}
                      onChange={setTipoImpressaoDanfe}
                      enableSearch={false}
                      ariaLabel="Tipo de impressão DANFE"
                      disabled={isFormLocked}
                    />
                  </div>
                </div>

                <div className="nfe-params-fieldsets-row">
                  {/* Faturamento */}
                  <div className="nfe-params-fieldset">
                    <span className="nfe-params-fieldset__legend">Faturamento</span>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>Diretório NFe</span>
                        <input className="text-field" value={fatDirNfe} onChange={(e) => setFatDirNfe(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <label className="nfe-params-field">
                        <span>Usuário</span>
                        <input className="text-field" value={fatUsuario} onChange={(e) => setFatUsuario(e.target.value)} disabled={isFormLocked} />
                      </label>
                    </div>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>e-Mail</span>
                        <input type="email" className="text-field" value={fatEmail} onChange={(e) => setFatEmail(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <div className="nfe-params-email-row">
                        <label className="nfe-params-field">
                          <span>Senha</span>
                          <input type="password" className="text-field" value={fatSenha} onChange={(e) => setFatSenha(e.target.value)} disabled={isFormLocked} />
                        </label>
                        <label className="nfe-params-field nfe-params-field--porta">
                          <span>Porta</span>
                          <input className="text-field" style={{ textAlign: 'right' }} value={fatPorta} onChange={(e) => setFatPorta(e.target.value)} disabled={isFormLocked} />
                        </label>
                      </div>
                    </div>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>SMTP</span>
                        <input className="text-field" value={fatSmtp} onChange={(e) => setFatSmtp(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <div className="nfe-params-check-block">
                        <label className="nfe-params-check-row">
                          <input
                            type="checkbox"
                            checked={fatServidorAuth}
                            onChange={(e) => setFatServidorAuth(e.target.checked)}
                            disabled={isFormLocked}
                          />
                          <span>Servidor de saída requer autenticação</span>
                        </label>
                        <label className="nfe-params-check-row">
                          <input
                            type="checkbox"
                            checked={fatServidorSsl}
                            onChange={(e) => setFatServidorSsl(e.target.checked)}
                            disabled={isFormLocked}
                          />
                          <span>Servidor requer uma conexão SSL</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Recebimento */}
                  <div className="nfe-params-fieldset">
                    <span className="nfe-params-fieldset__legend">Recebimento</span>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>Diretório NFe</span>
                        <input className="text-field" value={recDirNfe} onChange={(e) => setRecDirNfe(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <label className="nfe-params-field">
                        <span>Usuário</span>
                        <input className="text-field" value={recUsuario} onChange={(e) => setRecUsuario(e.target.value)} disabled={isFormLocked} />
                      </label>
                    </div>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>e-Mail</span>
                        <input type="email" className="text-field" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <div className="nfe-params-email-row">
                        <label className="nfe-params-field">
                          <span>Senha</span>
                          <input type="password" className="text-field" value={recSenha} onChange={(e) => setRecSenha(e.target.value)} disabled={isFormLocked} />
                        </label>
                        <label className="nfe-params-field nfe-params-field--porta">
                          <span>Porta</span>
                          <input className="text-field" style={{ textAlign: 'right' }} value={recPorta} onChange={(e) => setRecPorta(e.target.value)} disabled={isFormLocked} />
                        </label>
                      </div>
                    </div>

                    <div className="nfe-params-flds-row">
                      <label className="nfe-params-field">
                        <span>POP</span>
                        <input className="text-field" value={recPop} onChange={(e) => setRecPop(e.target.value)} disabled={isFormLocked} />
                      </label>
                      <div className="nfe-params-check-block">
                        <label className="nfe-params-check-row">
                          <input
                            type="checkbox"
                            checked={recServidorConexao}
                            onChange={(e) => setRecServidorConexao(e.target.checked)}
                            disabled={isFormLocked}
                          />
                          <span>Servidor requer uma conexão</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé: NSU + ações */}
                <div className="nfe-params-bottom">
                  <label className="nfe-params-field">
                    <span>Último NSU</span>
                    <input className="text-field" value={ultimoNsu} onChange={(e) => setUltimoNsu(e.target.value)} disabled={isFormLocked} />
                  </label>
                  <div className="nfe-params-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleToggleEdicao}
                      disabled={loadingParametros}
                    >
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                    <button type="button" className="primary-button" onClick={handleSalvar} disabled={isFormLocked}>
                      Salvar
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
          {/* Aba Faturamento */}
          {activeTab === 'faturamento' && (
            <div className="params-gerais-tab-body">
              <div className="fat-form">
                <div className="fat-form__columns">

                  {/* Coluna esquerda */}
                  <div className="fat-form__col">

                    {/* Layout / Itens / Lotes + CSLL/ISS/IRRF */}
                    <div className="fat-form__top-grid">
                      {/* Coluna: Layout / Itens / Lotes */}
                      <div className="fat-form__group">
                        <div className="fat-form__field">
                          <span>Layout</span>
                          <SearchableSelect
                            options={layoutOptions}
                            value={fatLayout}
                            onChange={setFatLayout}
                            enableSearch={false}
                            ariaLabel="Layout"
                            disabled={!isEditing}
                            displayValue={
                              fatLayout
                                ? `${fatLayout} - ${layoutOptions.find((o) => o.value === fatLayout)?.label ?? ''}`
                                : undefined
                            }
                            minDropdownWidth={420}
                            listHeader={
                              <div className="fat-layout-opt fat-layout-opt--header">
                                <span className="fat-layout-opt__cod">Cod.</span>
                                <span className="fat-layout-opt__model">Modelo</span>
                                <span className="fat-layout-opt__fmt">Formato</span>
                              </div>
                            }
                            renderOption={(opt) => (
                              <div className="fat-layout-opt">
                                <span className="fat-layout-opt__cod">{opt.value}</span>
                                <span className="fat-layout-opt__model">{opt.label}</span>
                                <span className="fat-layout-opt__fmt">{layoutFormatos[opt.value] ?? ''}</span>
                              </div>
                            )}
                          />
                        </div>
                        <div className="fat-form__field">
                          <span>Itens</span>
                          <input
                            className="text-field fat-form__layout-num"
                            value={fatItens}
                            onChange={(e) => setFatItens(e.target.value)}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="fat-form__field">
                          <span>Lotes</span>
                          <SearchableSelect
                            options={loteOptions}
                            value={fatLotes}
                            onChange={setFatLotes}
                            enableSearch={false}
                            ariaLabel="Lotes"
                            disabled={!isEditing}
                          />
                        </div>
                      </div>

                      {/* Coluna: CSLL / ISS / IRRF */}
                      <div className="fat-form__group fat-form__group--taxes">
                        <div className="fat-form__tax-row">
                          <span>CSLL</span>
                          <input
                            className="text-field fat-form__tax-input"
                            value={fatCsll}
                            onChange={(e) => setFatCsll(e.target.value)}
                            disabled={!isEditing}
                          />
                          <span className="fat-form__aliq-pct">%</span>
                        </div>
                        <div className="fat-form__tax-row">
                          <span>ISS</span>
                          <input
                            className="text-field fat-form__tax-input"
                            value={fatIss}
                            onChange={(e) => setFatIss(e.target.value)}
                            disabled={!isEditing}
                          />
                          <span className="fat-form__aliq-pct">%</span>
                        </div>
                        <div className="fat-form__tax-row">
                          <span>IRRF</span>
                          <input
                            className="text-field fat-form__tax-input"
                            value={fatIrrf}
                            onChange={(e) => setFatIrrf(e.target.value)}
                            disabled={!isEditing}
                          />
                          <span className="fat-form__aliq-pct">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Impressão de etiquetas */}
                    <div className="fat-form__group">
                      <div className="fat-form__field">
                        <span>Impressão de etiquetas do faturamento somente após autorização</span>
                        <SearchableSelect
                          options={impressaoEtiquetasOptions}
                          value={fatImpressaoEtiquetas}
                          onChange={setFatImpressaoEtiquetas}
                          enableSearch={false}
                          ariaLabel="Impressão de etiquetas"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Tabela série/notas */}
                    <div className="fat-form__group">
                      <div className="fat-form__table-wrap">
                        <table className="fat-form__table">
                          <thead>
                            <tr>
                              <th></th>
                              <th>Série</th>
                              <th>Ult. Nota</th>
                              <th>Computador</th>
                              <th>Emissão</th>
                              <th>Modelo Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fatSerieNotas.map((row) => (
                              <tr key={row.id}>
                                <td className="fat-form__table-arrow">▶</td>
                                <td>
                                  <input
                                    className="text-field fat-form__table-input"
                                    value={row.serie}
                                    onChange={(e) => handleSerieNotaChange(row.id, 'serie', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="text-field fat-form__table-input"
                                    value={row.ultNota}
                                    onChange={(e) => handleSerieNotaChange(row.id, 'ultNota', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={computadorOptions}
                                    value={row.computador}
                                    onChange={(v) => handleSerieNotaChange(row.id, 'computador', v)}
                                    enableSearch={false}
                                    ariaLabel="Computador"
                                    disabled={!isEditing}
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={emissaoOptions}
                                    value={row.emissao}
                                    onChange={(v) => handleSerieNotaChange(row.id, 'emissao', v)}
                                    enableSearch={false}
                                    ariaLabel="Emissão"
                                    disabled={!isEditing}
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={modeloNotaOptions}
                                    value={row.modeloNota}
                                    onChange={(v) => handleSerieNotaChange(row.id, 'modeloNota', v)}
                                    enableSearch={false}
                                    ariaLabel="Modelo Nota"
                                    disabled={!isEditing}
                                  />
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td className="fat-form__table-arrow fat-form__table-new" colSpan={6}>
                                <button
                                  type="button"
                                  className="fat-form__table-add"
                                  onClick={handleAddSerieNota}
                                  disabled={!isEditing}
                                  title="Adicionar nova linha"
                                >
                                  *
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Condição de uso da CC-e */}
                    <div className="fat-form__group">
                      <div className="fat-form__field">
                        <span>Condição de uso da CC-e</span>
                        <textarea
                          className="text-field fat-form__textarea"
                          value={fatCondicaoCce}
                          onChange={(e) => setFatCondicaoCce(e.target.value)}
                          disabled={!isEditing}
                          rows={4}
                        />
                      </div>
                    </div>

                    {/* GNRE */}
                    <div className="fat-form__group fat-form__group--bordered">
                      <label className="nfe-params-check-row">
                        <input
                          type="checkbox"
                          checked={fatGerarGnre}
                          onChange={(e) => setFatGerarGnre(e.target.checked)}
                          disabled={!isEditing}
                        />
                        <span>Gerar registro da GNRE no faturamento</span>
                      </label>
                      {fatGerarGnre && (
                        <div className="fat-form__group-indent">
                          <div className="fat-form__row">
                            <div className="fat-form__field">
                              <span>Fornecedor</span>
                              <SearchableSelect
                                options={gnreFornecedorOptions}
                                value={fatFornecedorGnre}
                                onChange={setFatFornecedorGnre}
                                enableSearch={false}
                                ariaLabel="Fornecedor GNRE"
                                disabled={!isEditing}
                              />
                            </div>
                            <div className="fat-form__field">
                              <span>Diretório</span>
                              <input
                                className="text-field"
                                value={fatDiretorioGnre}
                                onChange={(e) => setFatDiretorioGnre(e.target.value)}
                                disabled={!isEditing}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Simples Nacional */}
                    <div className="fat-form__group fat-form__group--bordered">
                      <label className="nfe-params-check-row">
                        <input
                          type="checkbox"
                          checked={fatParticipaSimples}
                          onChange={(e) => setFatParticipaSimples(e.target.checked)}
                          disabled={!isEditing}
                        />
                        <span>Participante do Simples Nacional</span>
                      </label>
                      {fatParticipaSimples && (
                        <div className="fat-form__group-indent">
                          <div className="fat-form__row fat-form__row--aliq">
                            <div className="fat-form__field">
                              <span>Aliq. ICMS SN</span>
                              <div className="fat-form__aliq-wrap">
                                <input
                                  className="text-field fat-form__aliq-input"
                                  value={fatAliqIcmsSn}
                                  onChange={(e) => setFatAliqIcmsSn(e.target.value)}
                                  disabled={!isEditing}
                                />
                                <span className="fat-form__aliq-pct">%</span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={!isEditing}
                                >
                                  Alíquotas
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>{/* /col-left */}

                  {/* Coluna direita */}
                  <div className="fat-form__col fat-form__col--right">

                    {/* Comissão */}
                    <div className="fat-form__group">
                      <label className="nfe-params-check-row">
                        <input
                          type="checkbox"
                          checked={fatPermitirAlterarComissao}
                          onChange={(e) => setFatPermitirAlterarComissao(e.target.checked)}
                          disabled={!isEditing}
                        />
                        <span>Permitir alterar comissão no pedido</span>
                      </label>
                      <div className="fat-form__field">
                        <span>Base para cálculo da comissão</span>
                        <SearchableSelect
                          options={baseComissaoOptions}
                          value={fatBaseComissao}
                          onChange={setFatBaseComissao}
                          enableSearch={false}
                          ariaLabel="Base para cálculo da comissão"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Verificações */}
                    <div className="fat-form__group">
                      <label className="nfe-params-check-row">
                        <input
                          type="checkbox"
                          checked={fatVerificarMediaVenda}
                          onChange={(e) => setFatVerificarMediaVenda(e.target.checked)}
                          disabled={!isEditing}
                        />
                        <span>Verificar média de venda do cliente</span>
                      </label>
                      <label className="nfe-params-check-row">
                        <input
                          type="checkbox"
                          checked={fatVerificarRateioEstoque}
                          onChange={(e) => setFatVerificarRateioEstoque(e.target.checked)}
                          disabled={!isEditing}
                        />
                        <span>Verificar rateio de estoque do cliente</span>
                      </label>
                    </div>

                    {/* Valor mínimo baseado */}
                    <div className="fat-form__group">
                      <span className="fat-form__group-label">Valor mínimo de faturamento baseado</span>
                      <div className="fat-form__radio-row">
                        <label className="fat-form__radio-opt">
                          <input
                            type="radio"
                            name="fatValorMinBaseado"
                            value="pedido"
                            checked={fatValorMinBaseado === 'pedido'}
                            onChange={() => setFatValorMinBaseado('pedido')}
                            disabled={!isEditing}
                          />
                          <span>Pedido</span>
                        </label>
                        <label className="fat-form__radio-opt">
                          <input
                            type="radio"
                            name="fatValorMinBaseado"
                            value="nota_fiscal"
                            checked={fatValorMinBaseado === 'nota_fiscal'}
                            onChange={() => setFatValorMinBaseado('nota_fiscal')}
                            disabled={!isEditing}
                          />
                          <span>Nota fiscal</span>
                        </label>
                      </div>
                    </div>

                    {/* Valores mínimos e máximos */}
                    <div className="fat-form__group">
                      <div className="fat-form__values-grid">
                        <span>Valor Mínimo para Faturamento</span>
                        <input
                          className="text-field"
                          value={fatValorMinFaturamento}
                          onChange={(e) => setFatValorMinFaturamento(e.target.value)}
                          disabled={!isEditing}
                        />
                        <span>Valor Mínimo para Duplicata</span>
                        <input
                          className="text-field"
                          value={fatValorMinDuplicata}
                          onChange={(e) => setFatValorMinDuplicata(e.target.value)}
                          disabled={!isEditing}
                        />
                        <span>Valor Máximo para Faturamento</span>
                        <input
                          className="text-field"
                          value={fatValorMaxFaturamento}
                          onChange={(e) => setFatValorMaxFaturamento(e.target.value)}
                          disabled={!isEditing}
                        />
                        <span>Valor Máximo para Duplicata</span>
                        <input
                          className="text-field"
                          value={fatValorMaxDuplicata}
                          onChange={(e) => setFatValorMaxDuplicata(e.target.value)}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Tipo de documento contas a receber */}
                    <div className="fat-form__group">
                      <span className="fat-form__group-label">Tipo de documento do contas a receber</span>
                      <div className="fat-form__radio-row">
                        <label className="fat-form__radio-opt">
                          <input
                            type="radio"
                            name="fatTipoDoc"
                            value="boleto"
                            checked={fatTipoDocContasReceber === 'boleto'}
                            onChange={() => setFatTipoDocContasReceber('boleto')}
                            disabled={!isEditing}
                          />
                          <span>Boleto</span>
                        </label>
                        <label className="fat-form__radio-opt">
                          <input
                            type="radio"
                            name="fatTipoDoc"
                            value="duplicata"
                            checked={fatTipoDocContasReceber === 'duplicata'}
                            onChange={() => setFatTipoDocContasReceber('duplicata')}
                            disabled={!isEditing}
                          />
                          <span>Duplicata</span>
                        </label>
                      </div>
                    </div>

                  </div>{/* /col-right */}
                </div>{/* /columns */}

                {/* Rodapé: botões */}
                <div className="nfe-params-bottom">
                  <div className="nfe-params-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleToggleEdicao}
                    >
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!isEditing}
                    >
                      Salvar
                    </button>
                  </div>
                </div>

              </div>{/* /fat-form */}
            </div>
          )}

        </section>
      </main>

      {devModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Em desenvolvimento">
          <article className="modal-card modal-card--confirm">
            <header className="modal-card__header">
              <h2>Em Desenvolvimento</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setDevModalOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body modal-card__body--confirm">
              <IoConstructOutline size={36} className="modal-confirm__icon" style={{ color: 'var(--color-warning, #d97706)' }} />
              <p>Esse parâmetro está em desenvolvimento, aguarde novas atualizações!</p>
            </div>
            <footer className="nfs-nova-footer">
              <button
                type="button"
                className="primary-button"
                onClick={() => setDevModalOpen(false)}
              >
                OK
              </button>
            </footer>
          </article>
        </section>
      )}

      {modalCertificadoOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Certificado digital">
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>Certificado Digital</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={handleCloseCertificadoModal}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <section className="module-form">
              <div className="form-grid-3">
                <label className="form-grid-3__full">
                  <span>Endereço</span>
                  <div className="clientes-cep-input">
                    <input
                      className="text-field"
                      value={certEndereco}
                      onChange={(event) => setCertEndereco(event.target.value)}
                      disabled={!isEditing}
                    />
                    <button
                      type="button"
                      className="icon-button module-action-button clientes-cep-search"
                      onClick={handleOpenCertificadoExplorer}
                      aria-label="Selecionar certificado"
                      title="Selecionar certificado"
                      disabled={!isEditing}
                    >
                      ...
                    </button>
                  </div>

                  <input
                    ref={certificadoInputRef}
                    type="file"
                    accept=".pfx"
                    style={{ display: 'none' }}
                    onChange={handleCertificadoFileChange}
                  />
                </label>

                <label>
                  <span>Senha</span>
                  <input
                    type="password"
                    value={certSenha}
                    onChange={(event) => setCertSenha(event.target.value)}
                    disabled={!isEditing}
                  />
                </label>

                <label>
                  <span>Validade Início</span>
                  <input value={certValidadeInicio} readOnly />
                </label>

                <label>
                  <span>Validade Fim</span>
                  <input value={certValidadeFim} readOnly />
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={handleLimparCertificado} disabled={!isEditing}>
                  Limpar
                </button>
                <button type="button" className="secondary-button" onClick={handleCloseCertificadoModal}>
                  Fechar
                </button>
                <button type="button" className="primary-button" onClick={handleImportarCertificado} disabled={!isEditing}>
                  Importar
                </button>
              </div>
            </section>
          </article>
        </section>
      )}
    </>
  );
}
