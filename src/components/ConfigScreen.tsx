import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCheckmarkCircle, IoCloseCircleOutline, IoCopyOutline, IoWarningOutline } from 'react-icons/io5';
import {
  adicionarLicencaCall,
  buscarNumeroHDCall,
  consultaLicencaCall,
  healthCheckCall,
  inserirOuAtualizarTransacaoCall,
  inserirTransacoesSistemaAcaoCall,
  tokenCall,
} from '../services/apiCalls';
import { buscaLicencaCliente, licencaPorHd, licencaTransacoesAcao } from '../services/supabaseQueries';
import { GlobalConfig } from '../services/globalConfig';
import { ROUTES } from '../constants/routes';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { LogoIcon } from './LogoIcon';

type TestStatus = 'success' | 'error' | null;

interface ConfigScreenProps {
  embedded?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  secondaryButtonLabel?: string;
  onSecondaryAction?: () => void;
  redirectToLoginAfterSave?: boolean;
  onSaveSuccess?: () => void;
}

export function ConfigScreen({
  embedded = false,
  showBackButton = false,
  onBack,
  secondaryButtonLabel,
  onSecondaryAction,
  redirectToLoginAfterSave = true,
  onSaveSuccess,
}: ConfigScreenProps = {}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<TestStatus>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [numHdValue, setNumHdValue] = useState('');
  const [copied, setCopied] = useState(false);

  // Carregar URL automaticamente ao abrir a tela
  useEffect(() => {
    const loadSavedUrl = async () => {
      await GlobalConfig.loadBaseUrl();
      const savedBaseUrl = GlobalConfig.getBaseUrl();
      
      if (savedBaseUrl) {
        // Extrair protocolo e URL
        const match = savedBaseUrl.match(/^(https?):\/\/(.+)$/);
        if (match) {
          setProtocol(match[1] as 'http' | 'https');
          setUrl(match[2]);
        }
      }
    };
    
    void loadSavedUrl();
  }, []);

  const hasUrl = useMemo(() => Boolean(url.trim()), [url]);

  const handleUrlChange = (value: string) => {
    const cleaned = value.replace(/^https?:\/\//, '');
    setUrl(cleaned);
    setStatus(null);
    setErrorMessage('');
    setStatusMessage('');
  };

  const handleClearUrl = () => {
    setUrl('');
    setStatus(null);
    setErrorMessage('');
    setStatusMessage('');
  };

  const handleCopyHd = async () => {
    if (!numHdValue) return;
    await navigator.clipboard.writeText(numHdValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleTestUrl = async () => {
    if (!hasUrl) {
      showToast('Informe a URL para continuar', 'error');
      return;
    }

    const baseUrl = `${protocol}://${url.trim()}`;

    setTesting(true);
    setStatus(null);
    setStatusMessage('');
    setErrorMessage('');
    setNumHdValue('');

    try {
      const health = await healthCheckCall(baseUrl);
      if (!health.succeeded) {
        setStatus('error');
        setErrorMessage('Falha ao comunicar-se com a API. Verifique se a URL está correta.');
        return;
      }

      await GlobalConfig.setBaseUrl(baseUrl);

      const tokenResp = await tokenCall(baseUrl, {
        usuario: undefined,
        nomeEmpresa: undefined,
        codigoEmpresa: 0,
        chaveApi: undefined,
        idGuid: undefined,
        tipo: 1,
      });

      const token =
        (tokenResp.data as any)?.token ||
        (tokenResp.data as any)?.Token ||
        (tokenResp.data as any)?.data?.token;

      if (!tokenResp.succeeded || !token) {
        setStatus('error');
        setErrorMessage('Falha ao gerar token.');
        return;
      }

      GlobalConfig.setJwToken(token);

      const hdResp = await buscarNumeroHDCall(baseUrl, token, false);
      const numHD = (hdResp.data as any)?.num_HD || (hdResp.data as any)?.num_hd;
      const chave = (hdResp.data as any)?.chave_Criptografada || (hdResp.data as any)?.chave_criptografada;

      if (!hdResp.succeeded || !numHD) {
        setStatus('error');
        setErrorMessage('Falha ao buscar número do HD.');
        return;
      }

      GlobalConfig.setNumHD(numHD);
      GlobalConfig.setChaveCriptoHD(chave || '');
      setNumHdValue(numHD);

      const licencas = await licencaPorHd({ numeroHd: numHD, idSistema: 1 });
      if (!licencas || licencas.length === 0) {
        setStatus('error');
        setErrorMessage(`Licença não encontrada. Informe ao suporte o HD: ${numHD}`);
        return;
      }

      const lic = licencas[0] as any;
      GlobalConfig.setNumAcessos(lic?.numero_acessos);
      GlobalConfig.setSituacaoLicenca(lic?.situacao_licenca);
      GlobalConfig.setDataValidadeLicenca(lic?.data_validade);

      const idLicenca = lic?.id;
      const idCliente = lic?.id_cliente;

      const consultaResp = await consultaLicencaCall(baseUrl, token, idLicenca, numHD);
      if (!consultaResp.succeeded) {
        const addResp = await adicionarLicencaCall(baseUrl, token, {
          id: lic?.id,
          situacao_licenca: lic?.situacao_licenca,
          data_validade: lic?.data_validade,
          mensagem_fim_validade: lic?.mensagem_fim_validade,
          dias_ant_mensagem_fim_validade: lic?.dias_ant_mensagem_fim_validade,
          numero_acessos: lic?.numero_acessos,
          numero_hd: numHD,
          instancia_sql: lic?.instancia_sql,
          nome_banco: lic?.nome_banco,
          versao_sistema: lic?.versao_sistema,
          usuario_sql: lic?.usuario_sql,
          senha_sql: lic?.senha_sql,
          versao_limite: lic?.versao_limite,
          tipo_licenca: lic?.tipo_licenca,
          tipo_banco: lic?.tipo_banco,
        });

        if (!addResp.succeeded) {
          setStatus('error');
          setErrorMessage('Falha ao inserir dados da licença no banco de dados.');
          return;
        }
      }

      const validade = lic?.data_validade ? new Date(lic.data_validade) : undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vencida = validade ? validade.getTime() < today.getTime() : false;
      const bloqueada = lic?.situacao_licenca === 9;

      if (vencida || bloqueada) {
        const msg = `${vencida ? 'Licença vencida' : ''}${vencida && bloqueada ? ' e ' : ''}${
          bloqueada ? 'Licença bloqueada' : ''
        }`;
        setStatus('error');
        setErrorMessage(msg || 'Licença inválida.');
        return;
      }

      const licencaCliente = await buscaLicencaCliente({
        idCliente: idCliente?.toString(),
        idLicenca: idLicenca?.toString(),
      });

      if (!licencaCliente || licencaCliente.length === 0) {
        setStatus('error');
        setErrorMessage(`Transações da licença não encontradas. HD: ${numHD}`);
        return;
      }

      const incluirResp = await inserirOuAtualizarTransacaoCall(baseUrl, token, licencaCliente);
      if (!incluirResp.succeeded) {
        setStatus('error');
        setErrorMessage('Falha ao sincronizar transações.');
        return;
      }

      const transacoesAcoes = await licencaTransacoesAcao({
        idLicenca: idLicenca?.toString(),
        idCliente: idCliente?.toString(),
      });

      if (!transacoesAcoes) {
        setStatus('error');
        setErrorMessage('Falha ao buscar ações de transações.');
        return;
      }

      const inserirAcoesResp = await inserirTransacoesSistemaAcaoCall(baseUrl, token, transacoesAcoes);
      if (!inserirAcoesResp.succeeded) {
        setStatus('error');
        setErrorMessage('Falha ao inserir ações de transações.');
        return;
      }

      setStatus('success');
      setStatusMessage(
        redirectToLoginAfterSave
          ? 'Configuração concluída. Redirecionando para o login...'
          : 'Configuração concluída com sucesso.',
      );
      showToast('URL validada e configuração salva.', 'success');

      if (redirectToLoginAfterSave) {
        // Redirecionar automaticamente para login após 2 segundos
        setTimeout(() => {
          navigate(ROUTES.login);
        }, 2000);
      } else {
        onSaveSuccess?.();
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.message || 'Erro inesperado ao configurar.');
    } finally {
      setTesting(false);
    }
  };

  const defaultSecondaryLabel = showBackButton ? 'Voltar' : 'Login';
  const finalSecondaryLabel = secondaryButtonLabel || defaultSecondaryLabel;

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
      return;
    }

    if (showBackButton) {
      onBack?.();
      return;
    }

    navigate(ROUTES.login);
  };

  const content = (
    <section className="auth-card">
        <div className="brand-center">
          <LogoIcon size={44} mode={theme} />
          <h1>{t('config.title')}</h1>
        </div>

        <label className="field-label">{t('config.protocol')}</label>
        <div className="protocol-group">
          <button
            type="button"
            className={`protocol-option ${protocol === 'http' ? 'is-active' : ''}`}
            onClick={() => setProtocol('http')}
          >
            http
          </button>
          <button
            type="button"
            className={`protocol-option ${protocol === 'https' ? 'is-active' : ''}`}
            onClick={() => setProtocol('https')}
          >
            https
          </button>
        </div>

        <label className="field-label">{t('config.url')}</label>
        <div className="url-field url-field--clearable">
          <span>{protocol}://</span>
          <input value={url} onChange={(event) => handleUrlChange(event.target.value)} disabled={testing} />
          {url.trim() && (
            <button
              type="button"
              className="field-clear-button"
              aria-label="Limpar URL"
              title="Limpar"
              onClick={handleClearUrl}
              disabled={testing}
            >
              <IoCloseCircleOutline size={16} />
            </button>
          )}
        </div>

        <div className="form-actions config-page-actions">
          <button className="primary-button" type="button" onClick={handleTestUrl} disabled={testing}>
            {testing ? 'Testando...' : 'Salvar'}
          </button>

          <button className="secondary-button" type="button" onClick={handleSecondaryAction} disabled={testing}>
            {finalSecondaryLabel}
          </button>
        </div>

        {status === 'success' && (
          <div className="status-box status-box--success">
            <IoCheckmarkCircle size={18} />
            <p>{statusMessage}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="status-box status-box--error">
            <IoWarningOutline size={18} />
            <p>{errorMessage}</p>
          </div>
        )}

        {numHdValue && (
          <div className="hd-box">
            <p>HD: {numHdValue}</p>
            <button type="button" onClick={handleCopyHd}>
              <IoCopyOutline size={16} />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}
      </section>
  );

  if (embedded) {
    return content;
  }

  return <main className="auth-screen">{content}</main>;
}
