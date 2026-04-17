import {
  IoAlbumsOutline,
  IoBagHandleOutline,
  IoBriefcaseOutline,
  IoChevronBackOutline,
  IoCloseOutline,
  IoChevronDown,
  IoChevronForward,
  IoBuildOutline,
  IoBusinessOutline,
  IoCalculatorOutline,
  IoCartOutline,
  IoCashOutline,
  IoCheckmarkDoneOutline,
  IoConstructOutline,
  IoDocumentTextOutline,
  IoListOutline,
  IoLogOutOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoChevronForwardOutline,
  IoStatsChartOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { createPortal } from 'react-dom';
import type { MenuItem } from '../types/menu';
import { LogoIcon } from './LogoIcon';
import { ThemeIcon } from './ThemeIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { APP_VERSION } from '../constants/appInfo';

type SidebarProps = {
  userName: string;
  companyName: string;
  menus: MenuItem[];
  loadingMenus: boolean;
  expandedMenu: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleMenu: (menuId: string) => void;
  onNavigateTransaction: (transactionCode: string, title: string) => void;
  onNavigateHome: () => void;
  onLogout: () => void;
  themeMode: 'light' | 'dark';
  onSelectThemeMode: (mode: 'light' | 'dark') => void;
  canOpenConfigScreen: boolean;
  onOpenConfigScreen: () => void;
  onShowInfo?: (message: string) => void;
};

const iconMap: Record<string, ComponentType<{ size?: number }>> = {
  'stats-chart-outline': IoStatsChartOutline,
  'albums-outline': IoAlbumsOutline,
  'list-outline': IoListOutline,
  'bag-handle-outline': IoBagHandleOutline,
  'calculator-outline': IoCalculatorOutline,
  'cash-outline': IoCashOutline,
  'construct-outline': IoConstructOutline,
  'wallet-outline': IoWalletOutline,
  'document-text-outline': IoDocumentTextOutline,
  'build-outline': IoBuildOutline,
  'business-outline': IoBusinessOutline,
  'checkmark-done-outline': IoCheckmarkDoneOutline,
  'briefcase-outline': IoBriefcaseOutline,
  'cart-outline': IoCartOutline,
  'shield-checkmark-outline': IoShieldCheckmarkOutline,
};

const languageOptions = [
  { value: 'pt', label: 'Portugues' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'ja', label: 'Japanese' },
] as const;

type SidebarFlyoutState =
  | {
      type: 'menu';
      menu: MenuItem;
      rect: DOMRect;
    }
  | {
      type: 'settings';
      rect: DOMRect;
    };

export function Sidebar({
  userName,
  companyName,
  menus,
  loadingMenus,
  expandedMenu,
  collapsed,
  onToggleCollapsed,
  onToggleMenu,
  onNavigateTransaction,
  onNavigateHome,
  onLogout,
  themeMode,
  onSelectThemeMode,
  canOpenConfigScreen,
  onOpenConfigScreen,
  onShowInfo,
}: SidebarProps) {
  const { language, setLanguage } = useLanguage();
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  const [activeFlyout, setActiveFlyout] = useState<SidebarFlyoutState | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const closeFlyoutTimeoutRef = useRef<number | null>(null);
  const flyoutEnabled = collapsed && !isCompactViewport;
  const showInlineSections = !flyoutEnabled;

  const currentLanguageLabel =
    languageOptions.find((item) => item.value === language)?.label || String(language || '').toUpperCase();

  useEffect(() => {
    return () => {
      if (closeFlyoutTimeoutRef.current) {
        window.clearTimeout(closeFlyoutTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
      if (event.matches) {
        setActiveFlyout(null);
      }
    };

    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!languageModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [languageModalOpen]);

  const cancelFlyoutClose = () => {
    if (closeFlyoutTimeoutRef.current) {
      window.clearTimeout(closeFlyoutTimeoutRef.current);
      closeFlyoutTimeoutRef.current = null;
    }
  };

  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    closeFlyoutTimeoutRef.current = window.setTimeout(() => setActiveFlyout(null), 140);
  };

  const openMenuFlyout = (menu: MenuItem, element: HTMLElement | null) => {
    if (!flyoutEnabled || !element) return;
    cancelFlyoutClose();
    const rect = element.getBoundingClientRect();
    setActiveFlyout({ type: 'menu', menu, rect });
  };

  const openSettingsFlyout = (element: HTMLElement | null) => {
    if (!flyoutEnabled || !element) return;
    cancelFlyoutClose();
    const rect = element.getBoundingClientRect();
    setActiveFlyout({ type: 'settings', rect });
  };

  const flyoutStyle = useMemo(() => {
    if (!activeFlyout || typeof window === 'undefined') return undefined;
    const left = Math.min(activeFlyout.rect.right + 12, window.innerWidth - 12 - 280);
    const maxHeight = activeFlyout.type === 'settings' ? 420 : 360;
    const top = Math.max(12, Math.min(activeFlyout.rect.top, window.innerHeight - 12 - maxHeight));
    return { left, top };
  }, [activeFlyout]);

  const handleOpenLanguageSelector = () => {
    setLanguageModalOpen(true);
    setActiveFlyout(null);
  };

  const handleSetLanguage = (value: (typeof languageOptions)[number]['value']) => {
    const nextLanguage = languageOptions.find((item) => item.value === value);
    setLanguage(value);
    setLanguageModalOpen(false);
    if (nextLanguage) {
      onShowInfo?.(`Idioma definido para ${nextLanguage.label}.`);
    }
  };

  const handleToggleMenuOnOpen = () => {
    const nextLabel = collapsed ? 'Expandido' : 'Recolhido';
    setActiveFlyout(null);
    onToggleCollapsed();
    onShowInfo?.(`Menu ao abrir: ${nextLabel}.`);
  };

  const handleToggleTheme = () => {
    setActiveFlyout(null);
    onSelectThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  const handleOpenConfigScreen = () => {
    setActiveFlyout(null);
    onOpenConfigScreen();
  };

  const renderSettingsItems = (fromFlyout = false) => {
    const buttonClass = fromFlyout ? 'nav-link nav-link--full nav-link--child' : 'nav-link nav-link--child';

    return (
      <>
        {canOpenConfigScreen ? (
          <li>
            <button className={buttonClass} type="button" onClick={handleOpenConfigScreen}>
              <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
              <span className="nav-link__title">Tela de configuração</span>
            </button>
          </li>
        ) : null}

        <li>
          <button className={buttonClass} type="button" onClick={handleOpenLanguageSelector}>
            <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
            <span className="nav-link__title">Idioma</span>
            <span className="nav-link__value">{currentLanguageLabel}</span>
          </button>
        </li>

        <li>
          <button className={buttonClass} type="button" onClick={handleToggleMenuOnOpen}>
            <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
            <span className="nav-link__title">Menu ao abrir</span>
            <span className="nav-link__value">{collapsed ? 'Recolhido' : 'Expandido'}</span>
          </button>
        </li>

        <li>
          <button className={buttonClass} type="button" onClick={handleToggleTheme}>
            <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
            <span className="nav-link__title">Tema</span>
            <span className="nav-link__value nav-link__value--icon">
              <ThemeIcon mode={themeMode} size={16} />
            </span>
          </button>
        </li>
      </>
    );
  };

  return (
    <aside className="sidebar" data-collapsed={collapsed ? 'true' : 'false'} aria-label="Menu principal">
      <div className="sidebar__brand">
        <div className="sidebar__brand-row">
          <button
            type="button"
            onClick={onNavigateHome}
            className="sidebar__brand-home"
            aria-label="Ir para Home"
            title="Ir para Home"
          >
            <div className="sidebar__brand-home-content">
              <LogoIcon size={40} mode={themeMode} />
              <div className="sidebar__brand-text">
                <p className="sidebar__brand-title">Bem vindo ao QSERPx</p>
                <p className="sidebar__brand-subtitle">v{APP_VERSION}</p>
              </div>
            </div>
          </button>
        </div>

        <div className="sidebar__meta-group">
          <p className="sidebar__meta">
            <span className="sidebar__meta-label">Usuario:</span> {userName || '-'}
          </p>
          <p className="sidebar__meta">
            <span className="sidebar__meta-label">Empresa:</span> {companyName || '-'}
          </p>
        </div>
      </div>

      <div className="sidebar__scroll" aria-label="Módulos" onScroll={() => flyoutEnabled && setActiveFlyout(null)}>
        {loadingMenus && <p className="sidebar__status">Carregando menus...</p>}

        {!loadingMenus && menus.length === 0 && (
          <p className="sidebar__status">Nenhum menu liberado para este usuário.</p>
        )}

        {menus.map((menu) => {
          const Icon = iconMap[menu.icon] || IoListOutline;
          const isExpanded = expandedMenu === menu.id;

          return (
            <section className="sidebar__section" key={menu.id}>
              <button
                className="nav-link"
                type="button"
                onClick={(event) => {
                  if (flyoutEnabled) {
                    const single = menu.subitems.length === 1 ? menu.subitems[0] : null;
                    if (single) {
                      onNavigateTransaction(single.transactionCode, single.title);
                      return;
                    }
                    openMenuFlyout(menu, event.currentTarget);
                    return;
                  }

                  onToggleMenu(menu.id);
                }}
                onMouseEnter={(event) => openMenuFlyout(menu, event.currentTarget)}
                onMouseLeave={() => flyoutEnabled && scheduleFlyoutClose()}
                onFocus={(event) => openMenuFlyout(menu, event.currentTarget)}
                onBlur={() => flyoutEnabled && scheduleFlyoutClose()}
                aria-expanded={isExpanded}
                title={menu.title}
              >
                <Icon size={18} />
                <span className="nav-link__title">{menu.title}</span>
                <span className="nav-link__right">{isExpanded ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}</span>
              </button>

              {showInlineSections && isExpanded && (
                <ul className="nav-list nav-list--nested">
                  {menu.subitems.map((sub) => (
                    <li key={`${menu.id}-${sub.transactionCode}-${sub.title}`}>
                      <button
                        className="nav-link nav-link--child"
                        type="button"
                        onClick={() => onNavigateTransaction(sub.transactionCode, sub.title)}
                      >
                        <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
                        <span className="nav-link__title">{sub.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="sidebar__section sidebar__section--settings">
          <button
            className="nav-link"
            type="button"
            onClick={(event) => {
              if (flyoutEnabled) {
                openSettingsFlyout(event.currentTarget);
                return;
              }
              setSettingsExpanded((prev) => !prev);
            }}
            onMouseEnter={(event) => openSettingsFlyout(event.currentTarget)}
            onMouseLeave={() => flyoutEnabled && scheduleFlyoutClose()}
            onFocus={(event) => openSettingsFlyout(event.currentTarget)}
            onBlur={() => flyoutEnabled && scheduleFlyoutClose()}
            aria-expanded={settingsExpanded}
            title="Configurações"
          >
            <IoSettingsOutline size={18} />
            <span className="nav-link__title">Configurações</span>
            <span className="nav-link__right">
              {settingsExpanded ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}
            </span>
          </button>

          {showInlineSections && settingsExpanded && <ul className="nav-list nav-list--nested">{renderSettingsItems()}</ul>}
        </section>
      </div>

      <div className="sidebar__footer">
        <button className="nav-link sidebar__footer-logout" type="button" onClick={onLogout}>
          <IoLogOutOutline size={18} />
          <span className="nav-link__title">Sair</span>
        </button>

        <button
          type="button"
          className="nav-link sidebar__footer-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <IoChevronForwardOutline size={18} /> : <IoChevronBackOutline size={18} />}
        </button>
      </div>

      {flyoutEnabled && activeFlyout && flyoutStyle
        ? createPortal(
            <div
              className="sidebar-flyout"
              style={flyoutStyle}
              onMouseEnter={cancelFlyoutClose}
              onMouseLeave={scheduleFlyoutClose}
            >
              <div className="sidebar-flyout__header">
                {activeFlyout.type === 'settings' ? 'Configurações' : activeFlyout.menu.title}
              </div>
              <ul className="nav-list">
                {activeFlyout.type === 'settings'
                  ? renderSettingsItems(true)
                  : activeFlyout.menu.subitems.map((item) => (
                      <li key={`${activeFlyout.menu.id}-${item.transactionCode}`}>
                        <button
                          type="button"
                          className="nav-link nav-link--full nav-link--child"
                          onClick={() => {
                            onNavigateTransaction(item.transactionCode, item.title);
                            setActiveFlyout(null);
                          }}
                        >
                          <span className="nav-link__subicon nav-link__subicon--round" aria-hidden="true" />
                          <span className="nav-link__title">{item.title}</span>
                        </button>
                      </li>
                    ))}
              </ul>
            </div>,
            document.body,
          )
        : null}

      {languageModalOpen
        ? createPortal(
            <section
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Selecionar idioma"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setLanguageModalOpen(false);
                }
              }}
            >
              <article className="modal-card modal-card--language">
                <header className="modal-card__header">
                  <h2>Selecionar idioma</h2>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Fechar"
                    onClick={() => setLanguageModalOpen(false)}
                  >
                    <IoCloseOutline size={18} />
                  </button>
                </header>
                <p>Escolha o idioma para traducao da interface.</p>

                <ul className="sidebar-language-list">
                  {languageOptions.map((option) => (
                    <li key={option.value}>
                      <button
                        type="button"
                        className={`sidebar-language-option ${language === option.value ? 'is-active' : ''}`}
                        onClick={() => handleSetLanguage(option.value)}
                      >
                        <span>{option.label}</span>
                        {language === option.value ? <IoCheckmarkDoneOutline size={16} /> : null}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="sidebar-language-actions">
                  <button className="secondary-button" type="button" onClick={() => setLanguageModalOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </article>
            </section>,
            document.body,
          )
        : null}
    </aside>
  );
}
