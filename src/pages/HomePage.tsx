import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseCircle,
  IoNotificationsOutline,
  IoSearchOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { ROUTES } from '../constants/routes';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GlobalConfig } from '../services/globalConfig';
import { buscarLembretesQS, buscarNotificacoesQS, criarLembrete, deleteLembrete } from '../services/supabaseQueries';
import { listNotificacoesCall } from '../services/apiCalls';
import { useDynamicMenu } from '../hooks/useDynamicMenu';
import { ModalHeaderActions } from '../components/ModalHeaderActions';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../hooks/useRequiredFields';

const REMINDER_COLORS = ['#4A90E2', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
const HOME_AUTO_REFRESH_INTERVAL_MS = 120000;
const MENU_MODULE_COLORS: Record<string, string> = {
  dashboards: '#4A90E2',
  'ativo-fixo': '#0EA5E9',
  basico: '#22C55E',
  compras: '#F59E0B',
  contabilidade: '#6366F1',
  custo: '#E11D48',
  engenharia: '#14B8A6',
  financeiro: '#2563EB',
  fiscal: '#8B5CF6',
  manutencao: '#F97316',
  pcp: '#06B6D4',
  qualidade: '#10B981',
  servico: '#EC4899',
  'documentos-fiscais': '#0F766E',
  vendas: '#3B82F6',
  seguranca: '#64748B',
};

const parseDisplayDate = (value: string) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
};

const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR');
  }

  return text;
};

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
    VEN001: ROUTES.pedidoVendaRepresentantes,
    VEN002: ROUTES.pedidoVenda,
    VEN003: ROUTES.pedidoVenda,
    BAS001: ROUTES.basicoClientes,
    BAS002: ROUTES.basicoServicos,
    BAS003: ROUTES.basicoTributacaoMaterial,
    COM001: ROUTES.comprasPedidoLiberacao,
    COM002: ROUTES.comprasPedidoLiberacao,
    SEG001: ROUTES.segurancaUsuarios,
    SEG002: ROUTES.segurancaTipoApontamento,
    CFG007: ROUTES.segurancaHistoricoAlteracoes,
    CFG008: ROUTES.segurancaSessoes,
    CFG009: ROUTES.segurancaTipoApontamento,
    PCP001: ROUTES.pcpApontamentoProducao,
    PCP002: ROUTES.pcpOrdensFabricacao,
    PCP003: ROUTES.pcpParadasMaquina,
    PCP004: ROUTES.pcpPreparacaoMaquina,
    PCP008: ROUTES.pcpOrdensSeparacao,
    PCP009: ROUTES.pcpSolicitacaoNfDiversa,
    SER001: ROUTES.servicoApontamentoMaoObra,
    SER002: ROUTES.servicoOrdens,
    SER003: ROUTES.servicoNotaFiscal,
    DOC001: ROUTES.fiscalNotaAjuste,
    DOC002: ROUTES.fiscalApuracaoReformaTributaria,
    DOC003: ROUTES.fiscalFaturamento,
    MAN001: ROUTES.manutencaoOrdens,
  };

  const dashboardRouteByTitle =
    isDashboardCode && normalizedTitle.includes('finance')
      ? ROUTES.dashboardFinanceiro
      : isDashboardCode && normalizedTitle.includes('venda')
        ? ROUTES.dashboardVendas
        : isDashboardCode && normalizedTitle.includes('pcp')
          ? ROUTES.dashboardPcp
          : undefined;

  const routeByCode = codeRouteMap[normalizedCode];
  const routeByTitle =
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('finance')
      ? ROUTES.dashboardFinanceiro
      : undefined) ||
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('venda') ? ROUTES.dashboardVendas : undefined) ||
    (normalizedTitle.includes('dashboard') && normalizedTitle.includes('pcp') ? ROUTES.dashboardPcp : undefined) ||
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
    (normalizedTitle.includes('almoxarif') ? ROUTES.basicoAlmoxarifado : undefined) ||
    ((normalizedTitle.includes('tributacao') || normalizedTitle.includes('tributa')) && normalizedTitle.includes('material')
      ? ROUTES.basicoTributacaoMaterial
      : undefined) ||
    (normalizedTitle.includes('servico') && !normalizedTitle.includes('ordem') && !normalizedTitle.includes('apont') && !normalizedTitle.includes('mao')
      ? ROUTES.basicoServicos
      : undefined) ||
    (normalizedTitle.includes('solicitacao') && normalizedTitle.includes('diversa')
      ? ROUTES.pcpSolicitacaoNfDiversa
      : undefined) ||
    (normalizedTitle.includes('nota') && normalizedTitle.includes('ajuste')
      ? ROUTES.fiscalNotaAjuste
      : undefined) ||
    (normalizedTitle.includes('faturamento') ? ROUTES.fiscalFaturamento : undefined) ||
    (normalizedTitle.includes('apuracao') &&
    (normalizedTitle.includes('reforma') || normalizedTitle.includes('cbs') || normalizedTitle.includes('ibs'))
      ? ROUTES.fiscalApuracaoReformaTributaria
      : undefined) ||
    (normalizedTitle.includes('nota') && normalizedTitle.includes('fiscal')
      ? ROUTES.servicoNotaFiscal
      : undefined) ||
    (normalizedTitle.includes('usuario') ? ROUTES.segurancaUsuarios : undefined) ||
    (normalizedTitle.includes('historico') && normalizedTitle.includes('altera')
      ? ROUTES.segurancaHistoricoAlteracoes
      : undefined) ||
    (normalizedTitle.includes('tipo') && normalizedTitle.includes('apont')
      ? ROUTES.segurancaTipoApontamento
      : undefined) ||
    (normalizedTitle.includes('sess') ? ROUTES.segurancaSessoes : undefined) ||
    (normalizedTitle.includes('separa') ? ROUTES.pcpOrdensSeparacao : undefined) ||
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
      : undefined);

  return dashboardRouteByTitle || routeByCode || routeByTitle;
};

type HomeFeedTab = 'todos' | 'lembretes' | 'qs' | 'sistema';

type HomeFeedItem = {
  key: string;
  kind: Exclude<HomeFeedTab, 'todos'>;
  kindLabel: string;
  color: string;
  title: string;
  description: string;
  date: string;
  onOpen?: () => void;
};

const HOME_FEED_PAGE_SIZE = 8;
const HOME_FEED_COLOR_SISTEMA = '#6f73ff';
const HOME_FEED_COLOR_QS = '#1dd18d';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getDisplayFirstName = (usuario: string) => {
  const first = String(usuario || '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)[0];
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

const DATE_LOCALES: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', ja: 'ja-JP' };

const formatTodayLabel = (language: string) => {
  const label = new Date().toLocaleDateString(DATE_LOCALES[language] ?? 'pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function HomePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const obrig = useRequiredFields();
  const { menus, loading: loadingMenus } = useDynamicMenu();
  const refreshInProgressRef = useRef(false);
  const [menuSimplificadoPreferencia, setMenuSimplificadoPreferencia] = useState(() => GlobalConfig.isMenuSimplificado());
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1024px)').matches;
  });

  useEffect(() => {
    const onTipoMenuChanged = () => setMenuSimplificadoPreferencia(GlobalConfig.isMenuSimplificado());
    window.addEventListener('qserpx:tipo-menu-changed', onTipoMenuChanged);
    return () => window.removeEventListener('qserpx:tipo-menu-changed', onTipoMenuChanged);
  }, []);

  const [notificacoesSistema, setNotificacoesSistema] = useState<any[]>([]);
  const [notificacoesQs, setNotificacoesQs] = useState<any[]>([]);
  const [lembretes, setLembretes] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [createReminderOpen, setCreateReminderOpen] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [lembreteTitle, setLembreteTitle] = useState('');
  const [lembreteDescription, setLembreteDescription] = useState('');
  const [lembreteDate, setLembreteDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('#4A90E2');
  const [feedTab, setFeedTab] = useState<HomeFeedTab>('todos');
  const [feedSearch, setFeedSearch] = useState('');
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);
  const [selectedReminderColor, setSelectedReminderColor] = useState('#4A90E2');
  const [viewReminderOpen, setViewReminderOpen] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState(false);
  const [expandedSimplifiedModules, setExpandedSimplifiedModules] = useState<Set<string>>(new Set());
  // Preferencia de menu simplificado vale para qualquer tamanho de tela, nao apenas mobile.
  const menuSimplificado = menuSimplificadoPreferencia;

  const getItemText = (item: any, fallback: string) => {
    const keys = [
      'descricao',
      'mensagem',
      'titulo',
      'title',
      'descricao_notificacao',
      'descricao_lembrete',
      'assunto',
      'mensagem_Notificacao',
      'mensagem_notificacao',
      'nome_Usuario',
      'nome_usuario',
    ];

    for (const key of keys) {
      const value = String(item?.[key] ?? '').trim();
      if (value) return value;
    }

    return fallback;
  };

  const getReminderTitle = (item: any, index: number) => {
    const title = String(item?.titulo ?? item?.title ?? item?.assunto ?? '').trim();
    return title || `Lembrete ${index + 1}`;
  };

  const getReminderDescription = (item: any) => {
    return String(item?.conteudo ?? item?.descricao ?? item?.mensagem ?? '').trim();
  };

  const getReminderColor = (item: any, index: number) => {
    const color = String(item?.cor ?? '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return REMINDER_COLORS[index % REMINDER_COLORS.length];
  };

  const closeCreateReminderModal = () => {
    if (savingReminder) return;
    setCreateReminderOpen(false);
    setLembreteTitle('');
    setLembreteDescription('');
    setLembreteDate('');
    setSelectedColor('#4A90E2');
  };

  const closeReminderViewModal = () => {
    if (deletingReminder) return;
    setViewReminderOpen(false);
    setSelectedReminder(null);
    setSelectedReminderColor('#4A90E2');
  };

  const openReminderViewModal = (item: any, index: number) => {
    setSelectedReminder(item);
    setSelectedReminderColor(getReminderColor(item, index));
    setViewReminderOpen(true);
  };

  const handleDeleteReminder = async () => {
    if (deletingReminder || !selectedReminder) return;

    const cnpj = GlobalConfig.getCnpj();
    const usuario = GlobalConfig.getUsuario();
    const reminderId = Number(selectedReminder?.id ?? 0);

    if (!cnpj || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    if (!Number.isFinite(reminderId) || reminderId <= 0) {
      showToast('Não foi possível identificar o lembrete para exclusão.', 'error');
      return;
    }

    setDeletingReminder(true);
    try {
      await deleteLembrete({
        id: reminderId,
        cnpj_empresa: cnpj,
        codigo_usuario: usuario,
      });

      showToast('Lembrete removido com sucesso!', 'success');
      closeReminderViewModal();
      await refreshDashboard();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao deletar lembrete. Tente novamente.', 'error');
    } finally {
      setDeletingReminder(false);
    }
  };

  const handleCreateReminder = async () => {
    if (savingReminder) return;

    const cnpj = GlobalConfig.getCnpj();
    const usuario = GlobalConfig.getUsuario();

    if (!obrig.validate([lembreteTitle, lembreteDescription, lembreteDate])) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return;
    }

    const parsedDate = parseDisplayDate(lembreteDate);
    if (!parsedDate) {
      showToast('Data inválida. Informe no formato DD/MM/AAAA.', 'error');
      return;
    }

    if (!cnpj || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setSavingReminder(true);
    try {
      await criarLembrete({
        titulo: lembreteTitle.trim(),
        conteudo: lembreteDescription.trim(),
        data: formatApiDate(parsedDate),
        cnpj_empresa: cnpj,
        codigo_usuario: usuario,
        cor: selectedColor,
      });

      showToast('Lembrete adicionado com sucesso!', 'success');
      closeCreateReminderModal();
      await refreshDashboard();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao criar lembrete. Tente novamente.', 'error');
    } finally {
      setSavingReminder(false);
    }
  };

  const refreshDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (refreshInProgressRef.current) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoUsuario = GlobalConfig.getUsuario();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const cnpj = GlobalConfig.getCnpj();

    if (!baseUrl || !token || !codigoUsuario || !codigoEmpresa) {
      return;
    }

    refreshInProgressRef.current = true;
    setLoadingDashboard(true);
    try {
      const notResp = await listNotificacoesCall(baseUrl, codigoEmpresa, codigoUsuario, token, true);
      const notData = Array.isArray(notResp.jsonBody)
        ? notResp.jsonBody
        : Array.isArray((notResp.jsonBody as any)?.content)
          ? (notResp.jsonBody as any).content
          : [];
      setNotificacoesSistema(notData);

      const notQs = await buscarNotificacoesQS();
      setNotificacoesQs(notQs || []);

      if (cnpj) {
        const lemb = await buscarLembretesQS({ cnpjEmpresa: cnpj, codigoUsuario });
        setLembretes(lemb || []);
      }
    } catch (error: any) {
      if (!options?.silent) {
        showToast(error?.message || 'Falha ao carregar dados da Home.', 'error');
      }
    } finally {
      refreshInProgressRef.current = false;
      setLoadingDashboard(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      void refreshDashboard({ silent: true });
    }, HOME_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshDashboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsMobileViewport(event ? event.matches : mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const feedItems = useMemo<HomeFeedItem[]>(() => {
    const items: HomeFeedItem[] = [];

    lembretes.forEach((item, index) => {
      items.push({
        key: `lembrete-${String(item?.id ?? index)}`,
        kind: 'lembretes',
        kindLabel: 'Lembrete',
        color: getReminderColor(item, index),
        title: getReminderTitle(item, index),
        description: getReminderDescription(item),
        date: formatDateLabel(item?.data),
        onOpen: menuSimplificado ? undefined : () => openReminderViewModal(item, index),
      });
    });

    notificacoesSistema.forEach((item, index) => {
      items.push({
        key: `sistema-${index}`,
        kind: 'sistema',
        kindLabel: 'Sistema',
        color: HOME_FEED_COLOR_SISTEMA,
        title: getItemText(item, `Notificação ${index + 1}`),
        description: '',
        date: formatDateLabel(item?.data_Hora ?? item?.data_hora ?? item?.data),
      });
    });

    notificacoesQs.forEach((item, index) => {
      items.push({
        key: `qs-${index}`,
        kind: 'qs',
        kindLabel: 'Notificação QS',
        color: HOME_FEED_COLOR_QS,
        title: getItemText(item, `Notificação QS ${index + 1}`),
        description: '',
        date: formatDateLabel(item?.data_notificacao ?? item?.data),
      });
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lembretes, notificacoesSistema, notificacoesQs, menuSimplificado]);

  const feedCounts = useMemo(
    () => ({
      todos: feedItems.length,
      lembretes: lembretes.length,
      qs: notificacoesQs.length,
      sistema: notificacoesSistema.length,
    }),
    [feedItems.length, lembretes.length, notificacoesQs.length, notificacoesSistema.length],
  );

  const feedFiltrado = useMemo(() => {
    const term = feedSearch.trim().toLowerCase();
    return feedItems.filter((item) => {
      if (feedTab !== 'todos' && item.kind !== feedTab) return false;
      if (!term) return true;
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.date.toLowerCase().includes(term)
      );
    });
  }, [feedItems, feedTab, feedSearch]);

  const feedVisivel = feedExpanded ? feedFiltrado : feedFiltrado.slice(0, HOME_FEED_PAGE_SIZE);
  const canExpandFeed = feedFiltrado.length > HOME_FEED_PAGE_SIZE;

  const feedTabs: Array<{ id: HomeFeedTab; label: string }> = [
    { id: 'todos', label: 'Tudo' },
    { id: 'lembretes', label: 'Lembretes' },
    { id: 'qs', label: 'Notificações QS' },
    { id: 'sistema', label: 'Sistema' },
  ];

  const primeiroNome = getDisplayFirstName(GlobalConfig.getUsuario() || '');
  const totalNotificacoes = notificacoesQs.length + notificacoesSistema.length;

  const feedEmptyMessage = loadingDashboard
    ? 'Carregando...'
    : feedSearch.trim()
      ? 'Nada encontrado para a pesquisa.'
      : feedTab === 'lembretes'
        ? 'Nenhum lembrete cadastrado.'
        : feedTab === 'todos'
          ? 'Nada por aqui no momento.'
          : 'Sem notificações.';

  const simplifiedModules = useMemo(() => {
    return menus.map((menu, menuIndex) => ({
      ...menu,
      color: MENU_MODULE_COLORS[menu.id] || REMINDER_COLORS[menuIndex % REMINDER_COLORS.length],
    }));
  }, [menus]);

  const toggleSimplifiedModule = (moduleId: string) => {
    setExpandedSimplifiedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const selectedReminderTitle = selectedReminder ? getReminderTitle(selectedReminder, 0) : '';
  const selectedReminderDescription = selectedReminder ? getReminderDescription(selectedReminder) : '';
  const selectedReminderDate = selectedReminder ? formatDateLabel(selectedReminder?.data) : '';

  const handleSimplifiedMenuNavigate = (transactionCode: string, title: string) => {
    const route = resolveRouteFromTransaction(transactionCode, title);
    if (!route) {
      showToast(`Módulo ${title} em migração para web.`, 'info');
      return;
    }

    navigate(route);
  };

  return (
    <section className="home-dashboard">
      <header className="home-hero">
        <div className="home-hero__text">
          <span className="home-hero__date">{formatTodayLabel(language)}</span>
          <h1>
            {getGreeting()}
            {primeiroNome ? `, ${primeiroNome}` : ''}
          </h1>
          <p>
            {`Você tem ${lembretes.length} ${lembretes.length === 1 ? 'lembrete' : 'lembretes'} e ${totalNotificacoes} ${
              totalNotificacoes === 1 ? 'notificação' : 'notificações'
            }.`}
          </p>
        </div>

        {!menuSimplificado ? (
          <button className="home-hero__new-button" type="button" onClick={() => {
              obrig.reset();
              setCreateReminderOpen(true);
            }}>
            <IoAddOutline size={18} />
            Novo lembrete
          </button>
        ) : null}
      </header>

      {menuSimplificado ? (
        <article className="home-dashboard-card home-dashboard-card--full">
          <div className="home-dashboard-card__content">
            {loadingMenus ? (
              <p className="module-empty">Carregando opções do menu...</p>
            ) : simplifiedModules.length === 0 ? (
              <p className="module-empty">Nenhuma opção de menu liberada para este usuário.</p>
            ) : (
              <div className="home-simple-menu-modules">
                {simplifiedModules.map((module) => {
                  const expanded = expandedSimplifiedModules.has(module.id);

                  return (
                    <article key={module.id} className="home-simple-menu-module" style={{ borderLeftColor: module.color }}>
                      <header className="home-simple-menu-module__header">
                        <div className="home-simple-menu-module__title-wrap">
                          <span className="home-simple-menu-module__dot" style={{ backgroundColor: module.color }} aria-hidden="true" />
                          <h3>{module.title}</h3>
                        </div>

                        <div className="home-simple-menu-module__actions">
                          <button
                            type="button"
                            className="home-dashboard-card__collapse"
                            onClick={() => toggleSimplifiedModule(module.id)}
                            aria-label={expanded ? `Encolher módulo ${module.title}` : `Expandir módulo ${module.title}`}
                            title={expanded ? `Encolher módulo ${module.title}` : `Expandir módulo ${module.title}`}
                          >
                            {expanded ? <IoChevronUpOutline size={18} /> : <IoChevronDownOutline size={18} />}
                          </button>
                        </div>
                      </header>

                      {expanded ? (
                        <ul className="home-dashboard-reminder-list home-dashboard-reminder-list--menu">
                          {module.subitems.map((subitem) => (
                            <li
                              key={`${module.id}-${subitem.transactionCode}-${subitem.title}`}
                              className="home-dashboard-reminder-card home-dashboard-reminder-card--menu"
                              style={{ borderLeftColor: module.color }}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSimplifiedMenuNavigate(subitem.transactionCode, subitem.title)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleSimplifiedMenuNavigate(subitem.transactionCode, subitem.title);
                                }
                              }}
                            >
                              <div className="home-dashboard-reminder-card__title-row">
                                <span
                                  className="home-dashboard-reminder-card__dot"
                                  style={{ backgroundColor: module.color }}
                                  aria-hidden="true"
                                />
                                <strong>{subitem.title}</strong>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      ) : null}

      {!(menuSimplificado && isMobileViewport) ? (
        <section className="home-feed" aria-label="Lembretes e notificações">
          <div className="home-feed__toolbar">
            <div className="home-feed__tabs" role="tablist" aria-label="Filtrar por tipo">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={feedTab === tab.id}
                  className={`home-feed__tab${feedTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setFeedTab(tab.id);
                    setFeedExpanded(false);
                  }}
                >
                  {tab.label}
                  <span className="home-feed__tab-count">{feedCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            <label className="home-feed__search" aria-label="Pesquisar">
              <IoSearchOutline size={16} aria-hidden="true" />
              <input value={feedSearch} onChange={(event) => setFeedSearch(event.target.value)} placeholder="Pesquisar" />
              {feedSearch ? (
                <button type="button" className="home-feed__search-clear" onClick={() => setFeedSearch('')} aria-label="Limpar pesquisa">
                  <IoCloseCircle size={16} />
                </button>
              ) : null}
            </label>
          </div>

          <div className="home-feed__card">
            {feedFiltrado.length === 0 ? (
              <div className="home-feed__empty">
                <IoNotificationsOutline size={36} aria-hidden="true" />
                <p>{feedEmptyMessage}</p>
              </div>
            ) : (
              <ul className="home-feed__list">
                {feedVisivel.map((item) => {
                  const content = (
                    <>
                      <span className="home-feed__kind">{item.kindLabel}</span>
                      <span className="home-feed__dot" style={{ background: item.color }} aria-hidden="true" />
                      <span className="home-feed__body">
                        <strong>{item.title}</strong>
                        {item.description ? <span>{item.description}</span> : null}
                      </span>
                      {item.date ? (
                        <span className="home-feed__date">
                          <IoTimeOutline size={13} aria-hidden="true" />
                          {item.date}
                        </span>
                      ) : null}
                    </>
                  );

                  return (
                    <li key={item.key}>
                      {item.onOpen ? (
                        <button type="button" className="home-feed__item home-feed__item--action" onClick={item.onOpen}>
                          {content}
                        </button>
                      ) : (
                        <div className="home-feed__item">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canExpandFeed ? (
              <button type="button" className="home-feed__more" onClick={() => setFeedExpanded((prev) => !prev)}>
                {feedExpanded ? 'Mostrar menos' : `Mostrar todos (${feedFiltrado.length})`}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {!menuSimplificado && createReminderOpen ? (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Novo lembrete"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              closeCreateReminderModal();
            }
          }}
        >
          <article className="modal-card home-reminder-modal">
            <header className="modal-card__header">
              <h2>Novo Lembrete</h2>
              <ModalHeaderActions onClose={closeCreateReminderModal} disabled={savingReminder} />
            </header>

            <section className="module-form home-reminder-form">
              <div className="form-grid-3 home-reminder-form-grid">
                <label className="form-grid-3__full">
                  <span>Título *</span>
                  <input
                    className={obrig.inputClass(lembreteTitle)}
                    value={lembreteTitle}
                    onChange={(event) => setLembreteTitle(event.target.value)}
                    placeholder="Digite o título do lembrete"
                    readOnly={savingReminder}
                  />
                  {obrig.error(lembreteTitle)}
                </label>

                <label className="form-grid-3__full">
                  <span>Descrição *</span>
                  <textarea
                    className={obrig.inputClass(lembreteDescription, 'home-reminder-textarea')}
                    value={lembreteDescription}
                    onChange={(event) => setLembreteDescription(event.target.value)}
                    placeholder="Digite a descrição do lembrete"
                    readOnly={savingReminder}
                  />
                  {obrig.error(lembreteDescription)}
                </label>

                <label className="form-grid-3__full">
                  <span>Data *</span>
                  <CustomDatePicker
                    value={lembreteDate}
                    onChange={setLembreteDate}
                    placeholder="DD/MM/AAAA"
                    disabled={savingReminder}
                    className={obrig.wrapperClass(lembreteDate, 'home-reminder-date')}
                  />
                  {obrig.error(lembreteDate)}
                </label>

                <label className="form-grid-3__full">
                  <span>Cor</span>
                  <div className="home-reminder-colors">
                    {REMINDER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`home-reminder-color-chip${selectedColor === color ? ' is-active' : ''}`}
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color }}
                        aria-label={`Selecionar cor ${color}`}
                        title={color}
                      />
                    ))}
                  </div>
                </label>
              </div>

              <div className="form-actions home-reminder-form-actions">
                <button className="secondary-button modal-card__close" type="button" onClick={closeCreateReminderModal} disabled={savingReminder}>
                  Cancelar
                </button>
                <button className="primary-button" type="button" onClick={() => void handleCreateReminder()} disabled={savingReminder}>
                  {savingReminder ? 'Salvando...' : 'Criar'}
                </button>
              </div>
            </section>
          </article>
        </section>
      ) : null}

      {!menuSimplificado && viewReminderOpen && selectedReminder ? (
        <section
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Consultar lembrete"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              closeReminderViewModal();
            }
          }}
        >
          <article className="modal-card home-reminder-view-modal">
            <header className="modal-card__header">
              <h2>Consultar lembrete</h2>
              <ModalHeaderActions onClose={closeReminderViewModal} disabled={deletingReminder} expandable={false} />
            </header>

            <section className="home-reminder-view">
              <div className="home-reminder-view__title-row">
                <span className="home-reminder-view__dot" style={{ backgroundColor: selectedReminderColor }} aria-hidden="true" />
                <h3>{selectedReminderTitle}</h3>
              </div>

              {selectedReminderDescription ? (
                <p className="home-reminder-view__description">{selectedReminderDescription}</p>
              ) : (
                <p className="home-reminder-view__description home-reminder-view__description--empty">
                  Este lembrete não possui descrição.
                </p>
              )}

              {selectedReminderDate ? (
                <div className="home-reminder-view__meta">
                  <IoTimeOutline size={14} />
                  <span>{selectedReminderDate}</span>
                </div>
              ) : null}
            </section>

            <div className="form-actions home-reminder-view-actions">
              <button
                className="secondary-button modal-card__close"
                type="button"
                onClick={closeReminderViewModal}
                disabled={deletingReminder}
              >
                Cancelar
              </button>
              <button
                className="icon-button--danger primary-button home-reminder-delete-button"
                type="button"
                onClick={() => void handleDeleteReminder()}
                disabled={deletingReminder}
              >
                <IoTrashOutline size={16} />
                {deletingReminder ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
