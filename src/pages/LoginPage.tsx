import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAlertCircleOutline,
  IoArrowForwardOutline,
  IoCloseOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoLockClosedOutline,
  IoPersonOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
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

const LOGIN_LANGUAGES = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'ja', label: '日本語' },
] as const;
import { useToast } from '../contexts/ToastContext';
import { LogoIcon } from '../components/LogoIcon';
import { ModalHeaderActions } from '../components/ModalHeaderActions';

export function LoginPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const versao = APP_VERSION;
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [hdSemLicenca, setHdSemLicenca] = useState<string | null>(null);
  const [licencaBloqueadaMensagem, setLicencaBloqueadaMensagem] = useState<string | null>(null);

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
      const loginJsonBody = (loginResp.jsonBody as any) || {};
      const loginMessage = loginData?.message || loginJsonBody?.message;

      if (!loginResp.succeeded || loginMessage) {
        showToast(loginMessage || 'Falha na autenticação.', 'error');
        return;
      }

      const codigoUsuarioDetalhe = String(
        loginData?.codigo_Usuario ??
        loginData?.codigo_usuario ??
        loginJsonBody?.codigo_Usuario ??
        loginJsonBody?.codigo_usuario ??
        usuarioUpper,
      )
        .trim()
        .toUpperCase();

      // Busca detalhes do usuário para obter nivel_Usuario
      let nivelUsuarioLogin = 0;
      try {
        const userDetUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/usuarios/${codigoUsuarioDetalhe}`;
        const userDetRes = await fetch(userDetUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tokenTipo1}`, 'Content-Type': 'application/json' },
        });
        if (userDetRes.ok) {
          const det = await userDetRes.json() as Record<string, unknown>;
          nivelUsuarioLogin = Number(
            det?.nivel_Usuario ?? det?.nivel_usuario ?? det?.Nivel_Usuario ?? 0
          ) || 0;
        }
      } catch {
        // Não bloquear login por falha pontual.
      }
      // Tipo de menu e preferencia local do front-end (por usuario), nao vem do banco.
      GlobalConfig.aplicarTipoMenuUsuario(codigoUsuarioDetalhe);

      // Busca código de licença
      let codigoLicencaAtual: number | null = null;
      try {
        const authHeader = { 'Authorization': `Bearer ${tokenTipo1}`, 'Content-Type': 'application/json' };
        const licencaRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/buscaLicencaAtual`, { method: 'GET', headers: authHeader });
        if (licencaRes.ok) {
          const licencaData = await licencaRes.json() as { codigoLicenca?: number; tipo?: string };
          if (licencaData.codigoLicenca != null) {
            codigoLicencaAtual = typeof licencaData.codigoLicenca === 'number'
              ? licencaData.codigoLicenca
              : parseInt(String(licencaData.codigoLicenca), 10);
            if (!Number.isNaN(codigoLicencaAtual)) GlobalConfig.setCodigoLicenca(codigoLicencaAtual);
            else codigoLicencaAtual = null;
          }
          if (licencaData.tipo) GlobalConfig.setTipoLicenca(licencaData.tipo);
        }
      } catch {
        // silently ignore
      }

      // Verifica se a licença está bloqueada
      if (codigoLicencaAtual != null) {
        try {
          const verificaUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/verificalicencabloqueada` +
            `?CodigoLicenca=${codigoLicencaAtual}&codigoUsuario=${codigoUsuarioDetalhe}&nivelUsuario=${nivelUsuarioLogin}`;
          const verificaRes = await fetch(verificaUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenTipo1}`, 'Content-Type': 'application/json' },
          });
          if (!verificaRes.ok) {
            const errData = await verificaRes.json().catch(() => ({})) as { message?: string };
            setLicencaBloqueadaMensagem(errData?.message || 'Sistema inacessível. Entre em contato com o suporte.');
            return;
          }
        } catch {
          // silently ignore — se não conseguir verificar, prossegue
        }
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
    <main className="auth-screen auth-screen--login login-split">
      <aside className="login-split__brand">
        <div className="login-split__logo">
          <LogoIcon size={40} mode="dark" />
          <span>{APP_NAME}</span>
        </div>

        <div className="login-split__headline">
          <h1>Sua operação, em um só lugar.</h1>
          <p>Vendas, compras, PCP, serviço, financeiro e qualidade integrados no {APP_NAME}.</p>
        </div>

        <span className="login-split__version">Versão {versao}</span>
      </aside>

      <section className="login-split__panel">
        <form
          className="login-split__form"
          autoComplete="off"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <div className="login-split__mobile-logo">
            <LogoIcon size={32} mode={theme} />
            <span>{APP_NAME}</span>
          </div>

          <header className="login-split__header">
            <h2>Acessar conta</h2>
            <p>Informe suas credenciais para continuar.</p>
          </header>

          <div className="login-split__field">
            <label className="field-label" htmlFor="login-usuario">
              Usuário
            </label>
            <div className={`login-split__input ${emailError ? 'has-error' : ''}`}>
              <IoPersonOutline size={18} aria-hidden="true" />
              <input
                id="login-usuario"
                type="text"
                value={email}
                name="qserpx_manual_user"
                autoComplete="off"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError('');
                }}
                placeholder="Informe o usuário"
                autoCapitalize="none"
              />
              {email.trim() && (
                <button
                  type="button"
                  className="login-split__input-action"
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
          </div>

          <div className="login-split__field">
            <label className="field-label" htmlFor="login-senha">
              Senha
            </label>
            <div className={`login-split__input ${passwordError ? 'has-error' : ''}`}>
              <IoLockClosedOutline size={18} aria-hidden="true" />
              <input
                id="login-senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                name="qserpx_manual_password"
                autoComplete="new-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="Informe a senha"
              />
              <button
                type="button"
                className="login-split__input-action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
              </button>
            </div>
            {passwordError && <small className="field-error">{passwordError}</small>}
          </div>

          <button className="primary-button login-split__submit" type="submit" disabled={loading}>
            {loading ? (
              'Entrando...'
            ) : (
              <>
                Entrar
                <IoArrowForwardOutline size={18} />
              </>
            )}
          </button>

          <div className="login-split__footer">
            <button
              type="button"
              className="login-split__reset"
              onClick={() => void handleResetConnection()}
              disabled={loading}
            >
              <IoSettingsOutline size={14} />
              Configurar conexão
            </button>
            <div className="login-split__langs" role="group" aria-label="Idioma" data-no-translate>
              {LOGIN_LANGUAGES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  className={`login-split__lang${language === item.value ? ' is-active' : ''}`}
                  aria-pressed={language === item.value}
                  onClick={() => setLanguage(item.value)}
                >
                  {item.value.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="login-split__footer-version">v{versao}</span>
          </div>
        </form>
      </section>

      {licencaBloqueadaMensagem && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Sistema inacessível">
          <article className="modal-card">
            <header
              className="modal-card__header"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <IoAlertCircleOutline size={22} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
                <h2>Sistema Inacessível</h2>
              </div>
              <ModalHeaderActions onClose={() => setLicencaBloqueadaMensagem(null)} expandable={false} />
            </header>
            <div className="modal-card__body" style={{ padding: '1rem 0.25rem 0.5rem' }}>
              <p style={{ lineHeight: '1.7', fontSize: '0.925rem' }}>{licencaBloqueadaMensagem}</p>
            </div>
            <footer
              className="modal-card__footer"
            >
              <button
                type="button"
                className="primary-button"
                onClick={() => setLicencaBloqueadaMensagem(null)}
              >
                OK
              </button>
            </footer>
          </article>
        </section>
      )}

      {hdSemLicenca && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Licença não encontrada</h2>
              <ModalHeaderActions onClose={() => setHdSemLicenca(null)} expandable={false} />
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
              <button className="secondary-button modal-card__close" type="button" onClick={() => setHdSemLicenca(null)}>
                Cancelar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
