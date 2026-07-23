import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoCloseOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import apiManager, { ApiCallType } from '../../../services/apiManager';
import { GlobalConfig } from '../../../services/globalConfig';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type ActiveTab = 'nfe';

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

export function ParametrosGeraisPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab] = useState<ActiveTab>('nfe');
  const certificadoInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingParametros, setLoadingParametros] = useState(false);
  const [modalCertificadoOpen, setModalCertificadoOpen] = useState(false);

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

  const handleToggleEdicao = () => {
    if (isEditing) {
      setIsEditing(false);
      setModalCertificadoOpen(false);
      void carregarParametrosNfe();
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
            >
              NF-e
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
        </section>
      </main>

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
