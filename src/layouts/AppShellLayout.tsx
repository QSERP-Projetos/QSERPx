import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IoCloseOutline, IoHomeOutline, IoLogOutOutline, IoMenuOutline } from 'react-icons/io5';
import { createPortal } from 'react-dom';
import { Sidebar } from '../components/Sidebar';
import { ConfigScreen } from '../components/ConfigScreen';
import { QsAtualizaPage } from '../features/qs-atualiza/pages/QsAtualizaPage';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import { ROUTES } from '../constants/routes';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { useDynamicMenu } from '../hooks/useDynamicMenu';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalConfig } from '../services/globalConfig';
import { verificarSessaoCall, logoutCall } from '../services/apiCalls';

const resolveRouteFromTransaction = (transactionCode: string, title: string): string | undefined => {
  const normalizedCode = String(transactionCode || '').toUpperCase();
  const normalizedTitle = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const isDashboardCode = normalizedCode.startsWith('DSB');

  const codeRouteMap: Record<string, string> = {
    DSB002: ROUTES.dashboardFinanceiro,
    DSB003: ROUTES.dashboardVendas,
    DSB004: ROUTES.dashboardPcp,
    DSB005: ROUTES.dashboardServicos,
    VEN001: ROUTES.pedidoVendaRepresentantes,
    VEN002: ROUTES.pedidoVenda,
    VEN003: ROUTES.pedidoVenda,
    BAS001: ROUTES.basicoClientes,
    BAS002: ROUTES.basicoServicos,
    COM001: ROUTES.comprasPedidoLiberacao,
    COM002: ROUTES.comprasPedidoLiberacao,
    SEG001: ROUTES.segurancaUsuarios,
    SEG002: ROUTES.segurancaTipoApontamento,
    CFG009: ROUTES.segurancaParametrosGerais,
    CFG008: ROUTES.segurancaSessoes,
    PCP001: ROUTES.pcpApontamentoProducao,
    PCP002: ROUTES.pcpOrdensFabricacao,
    PCP003: ROUTES.pcpParadasMaquina,
    PCP004: ROUTES.pcpPreparacaoMaquina,
    SER001: ROUTES.servicoApontamentoMaoObra,
    SER002: ROUTES.servicoOrdens,
    SER003: ROUTES.servicoNotaFiscal,
    MAN001: ROUTES.manutencaoOrdens,
    FIN001: ROUTES.financeiroContasReceber,
    QSA001: ROUTES.qsAtualiza,
    QSA002: ROUTES.qsAtualizaVersoes,
  };

  const dashboardRouteByTitle =
    isDashboardCode && normalizedTitle.includes('finance')
      ? ROUTES.dashboardFinanceiro
      : isDashboardCode && normalizedTitle.includes('venda')
        ? ROUTES.dashboardVendas
        : isDashboardCode && normalizedTitle.includes('pcp')
          ? ROUTES.dashboardPcp
          : isDashboardCode && normalizedTitle.includes('servic')
            ? ROUTES.dashboardServicos
            : undefined;

  const routeByCode = codeRouteMap[normalizedCode];
  const routeByTitle =
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('finance')
      ? ROUTES.dashboardFinanceiro
      : undefined) ||
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('venda') ? ROUTES.dashboardVendas : undefined) ||
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('pcp') ? ROUTES.dashboardPcp : undefined) ||
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('servic') ? ROUTES.dashboardServicos : undefined) ||
    (normalizedTitle.includes('pedido') &&
      normalizedTitle.includes('venda') &&
      (normalizedTitle.includes('representante') || normalizedTitle.includes('represent'))
      ? ROUTES.pedidoVendaRepresentantes
      : undefined) ||
    (normalizedTitle.includes('pedido') && normalizedTitle.includes('venda') ? ROUTES.pedidoVenda : undefined) ||
    (normalizedTitle.includes('pedido') && normalizedTitle.includes('compra') && normalizedTitle.includes('liber')
      ? ROUTES.comprasPedidoLiberacao
      : undefined) ||
    (normalizedTitle.includes('cliente') ? ROUTES.basicoClientes : undefined) ||
    (normalizedTitle.includes('nota') && normalizedTitle.includes('fiscal')
      ? ROUTES.servicoNotaFiscal
      : undefined) ||
    (normalizedTitle.includes('servico') && !normalizedTitle.includes('ordem') && !normalizedTitle.includes('apont') && !normalizedTitle.includes('mao')
      ? ROUTES.basicoServicos
      : undefined) ||
    (normalizedTitle.includes('usuario') ? ROUTES.segurancaUsuarios : undefined) ||
    (normalizedTitle.includes('tipo') && normalizedTitle.includes('apont')
      ? ROUTES.segurancaTipoApontamento
      : undefined) ||
    (normalizedTitle.includes('sess') ? ROUTES.segurancaSessoes : undefined) ||
    (normalizedTitle.includes('ordem') && normalizedTitle.includes('fabricacao') ? ROUTES.pcpOrdensFabricacao : undefined) ||
    (normalizedTitle.includes('apont') && normalizedTitle.includes('produc')
      ? ROUTES.pcpApontamentoProducao
      : undefined) ||
    (normalizedTitle.includes('parada') && normalizedTitle.includes('maquina') ? ROUTES.pcpParadasMaquina : undefined) ||
    (normalizedTitle.includes('preparacao') && normalizedTitle.includes('maquina')
      ? ROUTES.pcpPreparacaoMaquina
      : undefined) ||
    (normalizedTitle.includes('ordem') && normalizedTitle.includes('servico') ? ROUTES.servicoOrdens : undefined) ||
    (normalizedTitle.includes('apontamento') && normalizedTitle.includes('mao') && normalizedTitle.includes('obra')
      ? ROUTES.servicoApontamentoMaoObra
      : undefined) ||
    (normalizedTitle.includes('ordem') && normalizedTitle.includes('manutenc')
      ? ROUTES.manutencaoOrdens
      : undefined) ||
    (normalizedTitle.includes('ficha') && normalizedTitle.includes('inspec') && normalizedTitle.includes('process')
      ? ROUTES.qualidadeFichaProcesso
      : undefined) ||
    (normalizedTitle.includes('ficha') && normalizedTitle.includes('inspec') && normalizedTitle.includes('receb')
      ? ROUTES.qualidadeFichaRecebimento
      : undefined) ||
    (normalizedTitle.includes('conta') && normalizedTitle.includes('receber')
      ? ROUTES.financeiroContasReceber
      : undefined);

  return dashboardRouteByTitle || routeByCode || routeByTitle;
};

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { menus, loading } = useDynamicMenu();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEYS.sidenavCollapsed);
    return saved === '1';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1024px)').matches;
  });
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [qsAtualizaModalOpen, setQsAtualizaModalOpen] = useState(false);
  const [atualizandoAtivo, setAtualizandoAtivo] = useState(() => GlobalConfig.isAtualizando());

  const userName = useMemo(() => GlobalConfig.getUsuario() || '', []);
  const companyName = useMemo(() => GlobalConfig.getNomeEmpresa() || '', []);
  const nivelUsuario = useMemo(() => Number(GlobalConfig.getNivelUsuario() ?? 0), []);
  const menuSimplificadoPreferencia = useMemo(() => GlobalConfig.isMenuSimplificado(), []);
  const menuSimplificadoAtivo = menuSimplificadoPreferencia && isMobileViewport;

  useEffect(() => {
    const verificarSessao = async () => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const idSessao = GlobalConfig.getIdSessaoUsuario();
      if (!baseUrl || !token || !idSessao) return;
      try {
        const resp = await verificarSessaoCall(baseUrl, token, idSessao);
        if (!resp.succeeded) {
          await GlobalConfig.clearConfig();
          navigate(ROUTES.login, { replace: true });
        }
      } catch {
        // ignora erros de rede para não derrubar a sessão por instabilidade
      }
    };

    const interval = setInterval(() => { void verificarSessao(); }, 10_000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.sidenavCollapsed, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onOpenMobileMenu = () => {
      setMobileNavOpen(true);
    };
    const onToggleMobileMenu = () => {
      setMobileNavOpen((prev) => !prev);
    };

    window.addEventListener('qserpx:open-mobile-menu', onOpenMobileMenu);
    window.addEventListener('qserpx:toggle-mobile-menu', onToggleMobileMenu);
    return () => {
      window.removeEventListener('qserpx:open-mobile-menu', onOpenMobileMenu);
      window.removeEventListener('qserpx:toggle-mobile-menu', onToggleMobileMenu);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      const isMobile = event ? event.matches : mediaQuery.matches;
      setIsMobileViewport(isMobile);
      if (!isMobile) {
        setMobileNavOpen(false);
      }
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const isApontamentoProducaoRoute = location.pathname === ROUTES.pcpApontamentoProducao;
  const isHomeRoute = location.pathname === ROUTES.home;

  const handleLogout = async () => {
    if (logoutPending) return;
    if (GlobalConfig.isAtualizando()) {
      showToast('Não é possível sair durante uma atualização em andamento.', 'error');
      return;
    }

    setLogoutPending(true);

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    try {
      if (baseUrl && token && codigoEmpresa && idSessao) {
        await logoutCall(baseUrl, codigoEmpresa, idSessao, token);
      }
    } catch {
      showToast('Não foi possível finalizar a sessão no servidor. Encerrando localmente.', 'info');
    } finally {
      await GlobalConfig.clearConfig();
      setMobileNavOpen(false);
      setLogoutConfirmOpen(false);
      navigate(ROUTES.login, { replace: true });
    }
  };

  useEffect(() => {
    const onForceLogout = () => {
      void handleLogout();
    };

    window.addEventListener('qserpx:logout-now', onForceLogout);
    return () => {
      window.removeEventListener('qserpx:logout-now', onForceLogout);
    };
  }, [handleLogout]);

  // Rastreia atualização em andamento via evento do VersoesPage
  useEffect(() => {
    const onAtualizando = (e: Event) => {
      setAtualizandoAtivo((e as CustomEvent<{ active: boolean }>).detail.active);
    };
    window.addEventListener('qserpx:atualizando', onAtualizando);
    return () => window.removeEventListener('qserpx:atualizando', onAtualizando);
  }, []);

  // Bloqueia navegação fora do QS Atualiza durante uma atualização em andamento
  useEffect(() => {
    if (GlobalConfig.isAtualizando() && !location.pathname.startsWith(ROUTES.qsAtualiza)) {
      navigate(ROUTES.qsAtualizaVersoes, { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleNavigateTransaction = (transactionCode: string, title: string) => {
    const normalizedCode = String(transactionCode || '').toUpperCase();
    const normalizedTitle = String(title || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const isDashboardCode = normalizedCode.startsWith('DSB');

    if (normalizedCode === 'QSA001') {
      setMobileNavOpen(false);
      setQsAtualizaModalOpen(true);
      return;
    }

    if (
      (isDashboardCode && normalizedTitle.includes('compr')) ||
      normalizedCode === 'DSB001'
    ) {
      setMobileNavOpen(false);
      showToast('Este dashboard ainda não existe na web.', 'info');
      return;
    }

    const route = resolveRouteFromTransaction(transactionCode, title);

    if (route) {
      setMobileNavOpen(false);
      navigate(route);
      return;
    }

    showToast(`Módulo ${title} em migração para web.`, 'info');
  };

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
      data-mobile-nav-open={mobileNavOpen ? 'true' : 'false'}
      data-route={isApontamentoProducaoRoute ? 'pcp-apontamento-producao' : 'default'}
      data-menu-mode={menuSimplificadoAtivo ? 'simplificado' : 'padrao'}
    >
      {!menuSimplificadoAtivo && mobileNavOpen ? <div className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} aria-hidden="true" /> : null}

      {atualizandoAtivo && !menuSimplificadoAtivo && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 'var(--sidebar-width)',
            bottom: 0,
            zIndex: 200,
            cursor: 'not-allowed',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {!menuSimplificadoAtivo ? (
        <Sidebar
          userName={userName}
          companyName={companyName}
          menus={menus}
          loadingMenus={loading}
          expandedMenu={expandedMenu}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          onToggleMenu={(menuId) => setExpandedMenu((prev) => (prev === menuId ? null : menuId))}
          onNavigateTransaction={handleNavigateTransaction}
          onNavigateHome={() => {
            setMobileNavOpen(false);
            navigate(ROUTES.home);
          }}
          onLogout={() => {
            setLogoutConfirmOpen(true);
          }}
          themeMode={theme}
          onSelectThemeMode={(mode) => {
            if (mode !== theme) {
              toggleTheme();
            }
          }}
          canOpenConfigScreen={nivelUsuario >= 9}
          onOpenConfigScreen={() => {
            setMobileNavOpen(false);
            setConfigModalOpen(true);
          }}
          onShowInfo={(message) => showToast(message, 'info')}
        />
      ) : null}

      <main className="app-shell__main">
        {!menuSimplificadoAtivo ? (
          <header className="app-shell__topbar">
            {!mobileNavOpen ? (
              <button
                type="button"
                className="icon-button app-shell__menu-trigger"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
                title="Abrir menu"
              >
                <IoMenuOutline aria-hidden="true" />
              </button>
            ) : null}
            <div className="app-shell__topbar-brand">
              <div className="app-shell__topbar-title">{APP_NAME}</div>
              <div className="app-shell__topbar-description">v{APP_VERSION}</div>
            </div>
          </header>
        ) : null}

        <div className="app-shell__content">
          {atualizandoAtivo && (
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              backgroundColor: '#d97706',
              color: '#fff',
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              letterSpacing: '0.01em',
            }}>
              ⏳ Atualização em andamento — módulos bloqueados até a conclusão.
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {isMobileViewport && !mobileNavOpen && !menuSimplificadoAtivo ? (
        <button
          type="button"
          className="icon-button app-shell__floating-menu-trigger"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          <IoMenuOutline aria-hidden="true" />
        </button>
      ) : null}

      {menuSimplificadoAtivo ? (
        <div className="app-shell__simplified-actions" aria-label="Ações rápidas">
          {!isHomeRoute ? (
            <button
              type="button"
              className="secondary-button app-shell__simplified-action-button"
              onClick={() => navigate(ROUTES.home)}
            >
              <IoHomeOutline size={16} />
              Início
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button app-shell__simplified-action-button"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            <IoLogOutOutline size={16} />
            Sair
          </button>
        </div>
      ) : null}

      {logoutConfirmOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
          <article className="modal-card app-shell-logout-modal">
            <header className="modal-card__header">
              <h2 id="logout-confirm-title">Deseja realmente sair do sistema?</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (logoutPending) return;
                  setLogoutConfirmOpen(false);
                }}
                disabled={logoutPending}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <p>Você será desconectado da sessão atual.</p>
            {userName ? <p className="module-empty">Usuário: {userName}</p> : null}

            <div className="form-actions logout-confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (logoutPending) return;
                  setLogoutConfirmOpen(false);
                }}
                disabled={logoutPending}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleLogout()} disabled={logoutPending}>
                {logoutPending ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {qsAtualizaModalOpen
        ? createPortal(
          <section
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Configuração Site QS Atualiza"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setQsAtualizaModalOpen(false);
              }
            }}
          >
            <QsAtualizaPage
              embedded
              onClose={() => setQsAtualizaModalOpen(false)}
            />
          </section>,
          document.body,
        )
        : null}

      {configModalOpen
        ? createPortal(
          <section
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Tela de configuração"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setConfigModalOpen(false);
              }
            }}
          >
            <ConfigScreen
              embedded
              secondaryButtonLabel="Fechar"
              onSecondaryAction={() => setConfigModalOpen(false)}
              redirectToLoginAfterSave={false}
              onSaveSuccess={() => setConfigModalOpen(false)}
            />
          </section>,
          document.body,
        )
        : null}

    </div>
  );
}
