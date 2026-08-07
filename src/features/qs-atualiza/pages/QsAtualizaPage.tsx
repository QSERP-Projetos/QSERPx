import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoCheckmarkCircle, IoCloseCircle, IoCloseCircleOutline } from 'react-icons/io5';
import { LogoIcon } from '../../../components/LogoIcon';
import { useTheme } from '../../../contexts/ThemeContext';
import { GlobalConfig } from '../../../services/globalConfig';

interface QsAtualizaPageProps {
  embedded?: boolean;
  onClose?: () => void;
}

type ApiStatus = 'success' | 'error' | null;

export function QsAtualizaPage({ embedded = false, onClose }: QsAtualizaPageProps = {}) {
  const { theme } = useTheme();

  const [protocol, setProtocol] = useState<'http' | 'https'>('https');
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(null);

  const buildBaseUrl = () => `${protocol}://${url.trim()}`;

  const verificarApi = useCallback(async (baseUrl: string) => {
    if (!baseUrl) return;
    setChecking(true);
    setApiStatus(null);
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/status`;
    try {
      // Tentativa normal — funciona se o servidor tiver CORS configurado
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      setApiStatus(response.ok ? 'success' : 'error');
    } catch (firstError) {
      // TypeError geralmente indica bloqueio por CORS no navegador.
      // Tenta no-cors: se o servidor responder (sem erro de rede), está acessível.
      if (firstError instanceof TypeError) {
        try {
          await fetch(endpoint, {
            method: 'GET',
            mode: 'no-cors',
            signal: AbortSignal.timeout(10000),
          });
          // Resposta opaca — servidor acessível, CORS apenas não configurado
          setApiStatus('success');
        } catch {
          setApiStatus('error');
        }
      } else {
        setApiStatus('error');
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const raw = GlobalConfig.getBaseUrlQSAtualiza();
    if (!raw) return;
    const normalized = raw.replace(/\\/g, '/');
    const match = normalized.match(/^(https?):?\/\/(.+)$/i);
    let detectedProtocol: 'http' | 'https' = 'https';
    let detectedUrl = normalized;
    if (match) {
      detectedProtocol = match[1].toLowerCase() as 'http' | 'https';
      detectedUrl = match[2];
    }
    setProtocol(detectedProtocol);
    setUrl(detectedUrl);
    // Verifica status automaticamente ao abrir
    void verificarApi(`${detectedProtocol}://${detectedUrl}`);
  }, [verificarApi]);

  const hasUrl = useMemo(() => Boolean(url.trim()), [url]);

  const handleUrlChange = (value: string) => {
    const cleaned = value.replace(/^https?:\/\//, '');
    setUrl(cleaned);
    setApiStatus(null);
  };

  const handleClearUrl = () => {
    setUrl('');
    setApiStatus(null);
  };

  const handleSalvar = () => {
    if (!hasUrl) return;
    const fullUrl = buildBaseUrl();
    GlobalConfig.setBaseUrlQSAtualiza(fullUrl);
    void verificarApi(fullUrl);
  };

  const content = (
    <section className="auth-card">
      <div className="brand-center">
        <LogoIcon size={44} mode={theme} />
        <h1>Configuração Site QS Atualiza</h1>
      </div>

      <label className="field-label">CONEXÃO</label>
      <div className="protocol-group">
        <button
          type="button"
          className={`protocol-option ${protocol === 'http' ? 'is-active' : ''}`}
          onClick={() => { setProtocol('http'); setApiStatus(null); }}
        >
          http
        </button>
        <button
          type="button"
          className={`protocol-option ${protocol === 'https' ? 'is-active' : ''}`}
          onClick={() => { setProtocol('https'); setApiStatus(null); }}
        >
          https
        </button>
      </div>

      <label className="field-label">URL</label>
      <div className="url-field url-field--clearable">
        <span>{protocol}://</span>
        <input
          value={url}
          onChange={(event) => handleUrlChange(event.target.value)}
          placeholder=""
          disabled={checking}
        />
        {hasUrl && !checking && (
          <button
            type="button"
            className="field-clear-button"
            aria-label="Limpar URL"
            title="Limpar"
            onClick={handleClearUrl}
          >
            <IoCloseCircleOutline size={16} />
          </button>
        )}
      </div>

      <div className="form-actions config-page-actions">
        <button
          className="primary-button"
          type="button"
          onClick={handleSalvar}
          disabled={checking || !hasUrl}
        >
          {checking ? 'Verificando...' : 'Salvar'}
        </button>
        <button className="secondary-button" type="button" onClick={onClose} disabled={checking}>
          Fechar
        </button>
      </div>

      {apiStatus === 'success' && (
        <div className="status-box status-box--success">
          <IoCheckmarkCircle size={18} />
          <p>API QS Atualiza respondendo normalmente.</p>
        </div>
      )}
      {apiStatus === 'error' && (
        <div className="status-box status-box--error">
          <IoCloseCircle size={18} />
          <p>Não foi possível conectar à API QS Atualiza.</p>
        </div>
      )}
    </section>
  );

  if (embedded) {
    return content;
  }

  return <main className="auth-screen">{content}</main>;
}
