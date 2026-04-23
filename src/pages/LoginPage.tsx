import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCloseOutline, IoEyeOffOutline, IoEyeOutline, IoLogInOutline } from 'react-icons/io5';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import { ROUTES } from '../constants/routes';
import { GlobalConfig } from '../services/globalConfig';
import {
  healthCheckCall,
  loginCall,
  loginUsuarioCall,
  tokenCall,
} from '../services/apiCalls';
import { completeCompanySession } from '../services/authFlow';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { LogoIcon } from '../components/LogoIcon';

export function LoginPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const versao = APP_VERSION;
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [hdSemLicenca, setHdSemLicenca] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se há URL configurada
    const checkBaseUrl = async () => {
      await GlobalConfig.loadBaseUrl();
      const baseUrl = GlobalConfig.getBaseUrl();
      
      if (!baseUrl || baseUrl.trim() === '') {
        navigate(ROUTES.configInicial, { replace: true });
        return;
      }
    };

    void checkBaseUrl();
  }, [navigate]);

  const handleLogin = async () => {
    const emailTrimmed = email.trim();
    let hasError = false;

    if (!emailTrimmed) {
      setEmailError(t('login.errorUser'));
      hasError = true;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError(t('login.errorPassword'));
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) return;

    setLoading(true);

    try {
      const baseUrl = GlobalConfig.getBaseUrl();
      if (!baseUrl) {
        showToast('URL do servidor não configurada.', 'error');
        navigate(ROUTES.configInicial);
        return;
      }

      const health = await healthCheckCall(baseUrl);
      if (!health.succeeded) {
        showToast('Problemas para se comunicar com a API.', 'error');
        return;
      }

      const tokenTipo1Resp = await tokenCall(baseUrl, {
        usuario: '',
        nomeEmpresa: '',
        codigoEmpresa: 0,
        chaveApi: '',
        idGuid: '',
        tipo: 1,
      });

      const tokenTipo1 =
        (tokenTipo1Resp.data as any)?.token ||
        (tokenTipo1Resp.data as any)?.Token ||
        (tokenTipo1Resp.data as any)?.data?.token;

      if (!tokenTipo1Resp.succeeded || !tokenTipo1) {
        showToast('Falha ao gerar token.', 'error');
        return;
      }

      GlobalConfig.setJwToken(tokenTipo1);

      const usuarioUpper = emailTrimmed.toUpperCase();
      GlobalConfig.setUsuario(usuarioUpper);

      const loginResp = await loginCall(baseUrl, tokenTipo1, usuarioUpper, password);
      const loginData = (loginResp.data as any) || {};
      const loginMessage = loginData?.message || (loginResp.jsonBody as any)?.message;

      if (!loginResp.succeeded || loginMessage) {
        showToast(loginMessage || 'Falha na autenticação.', 'error');
        return;
      }

      const loginUsuarioResp = await loginUsuarioCall(baseUrl, tokenTipo1, usuarioUpper);
      const empresas = (loginUsuarioResp.data as any) || [];

      if (!Array.isArray(empresas) || empresas.length === 0) {
        showToast('Nenhuma empresa retornada para este usuário.', 'error');
        return;
      }

      if (empresas.length > 1) {
        navigate(ROUTES.selectCompany, {
          state: {
            usuario: usuarioUpper,
            senha: password,
            baseUrl,
            token: tokenTipo1,
            empresas,
            versao,
          },
        });
        return;
      }

      const result = await completeCompanySession({
        baseUrl,
        tokenTipo1,
        usuario: usuarioUpper,
        versao,
        empresa: empresas[0],
      });

      if (!result.success) {
        if (result.hdSemLicenca) {
          setHdSemLicenca(result.hdSemLicenca);
        } else {
          showToast(result.message || 'Falha ao concluir login.', 'error');
        }
        return;
      }

      navigate(ROUTES.home, { replace: true });
    } catch (error: any) {
      showToast(error?.message || 'Não foi possível comunicar com o servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConnection = async () => {
    await GlobalConfig.clearBaseUrl();
    showToast('URL removida. Configure uma nova conexão.', 'info');
    navigate(ROUTES.configInicial, { replace: true });
  };

  return (
    <main className="auth-screen auth-screen--login">
      <section className="auth-card auth-card--login">
        <div className="brand-center brand-center--login">
          <div className="login-brand-row">
            <LogoIcon size={40} mode={theme} />
            <h1>{APP_NAME}</h1>
          </div>
          <p className="version">v{versao}</p>
        </div>

        <label className="field-label">E-mail</label>
        <div className={`login-password-field ${emailError ? 'has-error' : ''}`}>
          <input
            className="text-field"
            type="text"
            value={email}
            name="qserpx_manual_user"
            autoComplete="off"
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError('');
            }}
            placeholder="Usuario"
            autoCapitalize="none"
          />
          {email.trim() && (
            <button
              type="button"
              className="login-password-toggle"
              tabIndex={-1}
              onClick={() => {
                setEmail('');
                if (emailError) setEmailError('');
              }}
              aria-label="Limpar usuário"
              title="Limpar"
            >
              <IoCloseOutline size={18} />
            </button>
          )}
        </div>
        {emailError && <small className="field-error">{emailError}</small>}

        <label className="field-label">Senha</label>
        <div className={`login-password-field ${passwordError ? 'has-error' : ''}`}>
          <input
            className="text-field"
            type={showPassword ? 'text' : 'password'}
            value={password}
            name="qserpx_manual_password"
            autoComplete="new-password"
            onChange={(event) => {
              setPassword(event.target.value);
              if (passwordError) setPasswordError('');
            }}
            placeholder="********"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleLogin();
              }
            }}
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
          </button>
        </div>
        {passwordError && <small className="field-error">{passwordError}</small>}

        <button className="primary-button primary-button--login" type="button" onClick={handleLogin} disabled={loading}>
          {loading ? 'Entrando...' : <IoLogInOutline size={18} />}
        </button>

        <button className="secondary-button" type="button" onClick={() => void handleResetConnection()} disabled={loading}>
          Resetar URL e nova conexão
        </button>
      </section>

      {hdSemLicenca && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Licença não encontrada</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setHdSemLicenca(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <p>Entre em contato com o suporte e informe o número do HD:</p>
            <strong>{hdSemLicenca}</strong>
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(hdSemLicenca);
                  showToast('HD copiado para a área de transferência.', 'info');
                }}
              >
                Copiar HD
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setHdSemLicenca(null);
                  GlobalConfig.setNumHD('');
                  GlobalConfig.setChaveCriptoHD('');
                  navigate(ROUTES.configInicial, { replace: true });
                }}
              >
                Resetar HD e configurar
              </button>
              <button className="secondary-button" type="button" onClick={() => setHdSemLicenca(null)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
