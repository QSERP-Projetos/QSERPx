import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCheckmarkCircle, IoCloseCircleOutline, IoCopyOutline, IoWarningOutline } from 'react-icons/io5';
import { healthCheckCall } from '../services/apiCalls';
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
      const savedHd = GlobalConfig.getNumHD();

      if (savedHd) {
        setNumHdValue(savedHd);
      }
      
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

      setStatus('success');
      setStatusMessage(
        redirectToLoginAfterSave
          ? 'Conexão validada! Faça login para sincronizar licença e acessar o sistema.'
          : 'Conexão validada com sucesso.',
      );
      showToast('URL validada e configuração salva.', 'success');

      if (redirectToLoginAfterSave) {
        setTimeout(() => {
          navigate(ROUTES.login);
        }, 1500);
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
