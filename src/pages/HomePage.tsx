import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoAddOutline,
  IoBookmarkOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseOutline,
  IoNotificationsOutline,
  IoSearchOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { useToast } from '../contexts/ToastContext';
import { GlobalConfig } from '../services/globalConfig';
import { buscarLembretesQS, buscarNotificacoesQS, criarLembrete, deleteLembrete } from '../services/supabaseQueries';
import { listNotificacoesCall } from '../services/apiCalls';

const REMINDER_COLORS = ['#4A90E2', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
const HOME_AUTO_REFRESH_INTERVAL_MS = 120000;

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

export function HomePage() {
  const { showToast } = useToast();
  const refreshInProgressRef = useRef(false);

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
  const [lembretesCollapsed, setLembretesCollapsed] = useState(false);
  const [lembretesExpanded, setLembretesExpanded] = useState(false);
  const [lembreteSearch, setLembreteSearch] = useState('');
  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);
  const [selectedReminderColor, setSelectedReminderColor] = useState('#4A90E2');
  const [viewReminderOpen, setViewReminderOpen] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState(false);
  const [notificacoesQsCollapsed, setNotificacoesQsCollapsed] = useState(false);
  const [notificacoesSistemaCollapsed, setNotificacoesSistemaCollapsed] = useState(false);
  const [notificacaoQsSearch, setNotificacaoQsSearch] = useState('');
  const [notificacaoSistemaSearch, setNotificacaoSistemaSearch] = useState('');

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

    if (!lembreteTitle.trim() || !lembreteDescription.trim() || !lembreteDate.trim()) {
      showToast('Por favor, preencha título, descrição e data do lembrete.', 'error');
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

  const lembretesFiltrados = useMemo(() => {
    const term = lembreteSearch.trim().toLowerCase();
    if (!term) return lembretes;

    return lembretes.filter((item, index) => {
      const titulo = getReminderTitle(item, index).toLowerCase();
      const descricao = getReminderDescription(item).toLowerCase();
      const dataLabel = formatDateLabel(item?.data).toLowerCase();
      return titulo.includes(term) || descricao.includes(term) || dataLabel.includes(term);
    });
  }, [lembretes, lembreteSearch]);

  const lembretesVisiveis = useMemo(() => {
    if (lembretesExpanded) return lembretesFiltrados;
    return lembretesFiltrados.slice(0, 6);
  }, [lembretesExpanded, lembretesFiltrados]);

  const canExpandLembretes = lembretesFiltrados.length > 6;

  const notificacoesQsFiltradas = useMemo(() => {
    const term = notificacaoQsSearch.trim().toLowerCase();
    if (!term) return notificacoesQs;

    return notificacoesQs.filter((item, index) => {
      const text = getItemText(item, `Notificação QS ${index + 1}`).toLowerCase();
      const data = formatDateLabel(item?.data_notificacao ?? item?.data).toLowerCase();
      return text.includes(term) || data.includes(term);
    });
  }, [notificacaoQsSearch, notificacoesQs]);

  const notificacoesSistemaFiltradas = useMemo(() => {
    const term = notificacaoSistemaSearch.trim().toLowerCase();
    if (!term) return notificacoesSistema;

    return notificacoesSistema.filter((item, index) => {
      const text = getItemText(item, `Notificação Sistema ${index + 1}`).toLowerCase();
      const data = formatDateLabel(item?.data_Hora ?? item?.data_hora ?? item?.data).toLowerCase();
      return text.includes(term) || data.includes(term);
    });
  }, [notificacaoSistemaSearch, notificacoesSistema]);

  const selectedReminderTitle = selectedReminder ? getReminderTitle(selectedReminder, 0) : '';
  const selectedReminderDescription = selectedReminder ? getReminderDescription(selectedReminder) : '';
  const selectedReminderDate = selectedReminder ? formatDateLabel(selectedReminder?.data) : '';

  return (
    <section className="home-dashboard">
      <header className="home-dashboard__header">
        <div className="home-dashboard__title-group">
          <h1>Painel Principal</h1>
          <p>Resumo das suas atividades e notificações.</p>
        </div>

        <button
          className="home-dashboard__new-button"
          type="button"
          onClick={() => setCreateReminderOpen(true)}
        >
          <IoAddOutline size={18} />
          Novo Lembrete
        </button>
      </header>

      <section className="home-dashboard__grid" aria-label="Resumo principal">
        <article className={`home-dashboard-card home-dashboard-card--full${lembretesCollapsed ? ' is-line' : ''}`}>
          <header className="home-dashboard-card__header">
            <div className="home-dashboard-card__title-wrap">
              <span className="home-dashboard-card__accent home-dashboard-card__accent--blue" aria-hidden="true" />
              <h2>Lembretes</h2>
            </div>

            <div className="home-dashboard-card__header-actions">
              <span className="home-dashboard-card__badge home-dashboard-card__badge--blue">{lembretes.length}</span>
              <button
                type="button"
                className="home-dashboard-card__collapse"
                onClick={() => setLembretesCollapsed((prev) => !prev)}
                aria-label={lembretesCollapsed ? 'Expandir lembretes' : 'Encolher lembretes'}
                title={lembretesCollapsed ? 'Expandir lembretes' : 'Encolher lembretes'}
              >
                {lembretesCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
              </button>
            </div>
          </header>

          {!lembretesCollapsed ? (
            <div className="home-dashboard-card__content">
              <div className="home-dashboard-reminder-tools">
                <label className="home-dashboard-search" aria-label="Pesquisar lembretes">
                  <IoSearchOutline size={16} />
                  <input
                    value={lembreteSearch}
                    onChange={(event) => setLembreteSearch(event.target.value)}
                    placeholder="Pesquisar lembretes"
                  />
                </label>

                {canExpandLembretes ? (
                  <button
                    type="button"
                    className="home-dashboard-reminder-expand"
                    onClick={() => setLembretesExpanded((prev) => !prev)}
                  >
                    {lembretesExpanded ? 'Encolher cards' : 'Expandir cards'}
                  </button>
                ) : null}
              </div>

              {lembretesFiltrados.length === 0 ? (
                <div className="home-dashboard-empty">
                  <IoBookmarkOutline size={42} />
                  <p>
                    {loadingDashboard
                      ? 'Carregando lembretes...'
                      : lembreteSearch.trim()
                        ? 'Nenhum lembrete encontrado para a pesquisa'
                        : 'Nenhum lembrete cadastrado'}
                  </p>
                </div>
              ) : (
                <>
                  <ul className="home-dashboard-reminder-list">
                    {lembretesVisiveis.map((item, index) => {
                      const title = getReminderTitle(item, index);
                      const description = getReminderDescription(item);
                      const color = getReminderColor(item, index);
                      const dateLabel = formatDateLabel(item?.data);

                      return (
                        <li
                          key={`lembrete-${index}`}
                          className="home-dashboard-reminder-card"
                          style={{ borderLeftColor: color }}
                          role="button"
                          tabIndex={0}
                          onClick={() => openReminderViewModal(item, index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openReminderViewModal(item, index);
                            }
                          }}
                        >
                          <div className="home-dashboard-reminder-card__title-row">
                            <span
                              className="home-dashboard-reminder-card__dot"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <strong>{title}</strong>
                          </div>

                          {description ? <p>{description}</p> : null}

                          {dateLabel ? (
                            <div className="home-dashboard-reminder-card__date">
                              <IoTimeOutline size={13} />
                              <span>{dateLabel}</span>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {canExpandLembretes ? (
                    <button
                      type="button"
                      className="home-dashboard-reminder-expand home-dashboard-reminder-expand--bottom"
                      onClick={() => setLembretesExpanded((prev) => !prev)}
                    >
                      {lembretesExpanded
                        ? 'Mostrar menos lembretes'
                        : `Mostrar todos os lembretes (${lembretesFiltrados.length})`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </article>

        <article className={`home-dashboard-card${notificacoesQsCollapsed ? ' is-line' : ''}`}>
          <header className="home-dashboard-card__header">
            <div className="home-dashboard-card__title-wrap">
              <span className="home-dashboard-card__accent home-dashboard-card__accent--green" aria-hidden="true" />
              <h2>Notificações QS</h2>
            </div>

            <div className="home-dashboard-card__header-actions">
              <span className="home-dashboard-card__badge home-dashboard-card__badge--green">{notificacoesQs.length}</span>
              <button
                type="button"
                className="home-dashboard-card__collapse"
                onClick={() => setNotificacoesQsCollapsed((prev) => !prev)}
                aria-label={notificacoesQsCollapsed ? 'Expandir notificações QS' : 'Encolher notificações QS'}
                title={notificacoesQsCollapsed ? 'Expandir notificações QS' : 'Encolher notificações QS'}
              >
                {notificacoesQsCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
              </button>
            </div>
          </header>

          {!notificacoesQsCollapsed ? (
            <div className="home-dashboard-card__content home-dashboard-card__content--scroll">
              <div className="home-dashboard-reminder-tools home-dashboard-reminder-tools--compact">
                <label className="home-dashboard-search" aria-label="Pesquisar notificações QS">
                  <IoSearchOutline size={16} />
                  <input
                    value={notificacaoQsSearch}
                    onChange={(event) => setNotificacaoQsSearch(event.target.value)}
                    placeholder="Pesquisar notificações QS"
                  />
                </label>
              </div>

              {notificacoesQsFiltradas.length === 0 ? (
                <div className="home-dashboard-empty">
                  <IoNotificationsOutline size={42} />
                  <p>
                    {loadingDashboard
                      ? 'Carregando notificações QS...'
                      : notificacaoQsSearch.trim()
                        ? 'Nenhuma notificação QS encontrada para a pesquisa'
                        : 'Sem notificações QS'}
                  </p>
                </div>
              ) : (
                <ul className="home-dashboard-list">
                  {notificacoesQsFiltradas.map((item, index) => (
                    <li key={`not-qs-${index}`}>{getItemText(item, `Notificação QS ${index + 1}`)}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </article>

        <article className={`home-dashboard-card${notificacoesSistemaCollapsed ? ' is-line' : ''}`}>
          <header className="home-dashboard-card__header">
            <div className="home-dashboard-card__title-wrap">
              <span className="home-dashboard-card__accent home-dashboard-card__accent--violet" aria-hidden="true" />
              <h2>Notificações Sistema</h2>
            </div>

            <div className="home-dashboard-card__header-actions">
              <span className="home-dashboard-card__badge home-dashboard-card__badge--violet">
                {notificacoesSistema.length}
              </span>
              <button
                type="button"
                className="home-dashboard-card__collapse"
                onClick={() => setNotificacoesSistemaCollapsed((prev) => !prev)}
                aria-label={notificacoesSistemaCollapsed ? 'Expandir notificações do sistema' : 'Encolher notificações do sistema'}
                title={notificacoesSistemaCollapsed ? 'Expandir notificações do sistema' : 'Encolher notificações do sistema'}
              >
                {notificacoesSistemaCollapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
              </button>
            </div>
          </header>

          {!notificacoesSistemaCollapsed ? (
            <div className="home-dashboard-card__content home-dashboard-card__content--scroll">
              <div className="home-dashboard-reminder-tools home-dashboard-reminder-tools--compact">
                <label className="home-dashboard-search" aria-label="Pesquisar notificações do sistema">
                  <IoSearchOutline size={16} />
                  <input
                    value={notificacaoSistemaSearch}
                    onChange={(event) => setNotificacaoSistemaSearch(event.target.value)}
                    placeholder="Pesquisar notificações do sistema"
                  />
                </label>
              </div>

              {notificacoesSistemaFiltradas.length === 0 ? (
                <div className="home-dashboard-empty">
                  <IoNotificationsOutline size={42} />
                  <p>
                    {loadingDashboard
                      ? 'Carregando notificações...'
                      : notificacaoSistemaSearch.trim()
                        ? 'Nenhuma notificação do sistema encontrada para a pesquisa'
                        : 'Sem notificações'}
                  </p>
                </div>
              ) : (
                <ul className="home-dashboard-list">
                  {notificacoesSistemaFiltradas.map((item, index) => (
                    <li key={`not-sys-${index}`}>{getItemText(item, `Notificação ${index + 1}`)}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </article>
      </section>

      {createReminderOpen ? (
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
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={closeCreateReminderModal}
                disabled={savingReminder}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <section className="module-form home-reminder-form">
              <div className="form-grid-3 home-reminder-form-grid">
                <label className="form-grid-3__full">
                  <span>Título</span>
                  <input
                    value={lembreteTitle}
                    onChange={(event) => setLembreteTitle(event.target.value)}
                    placeholder="Digite o título do lembrete"
                    readOnly={savingReminder}
                  />
                </label>

                <label className="form-grid-3__full">
                  <span>Descrição</span>
                  <textarea
                    className="home-reminder-textarea"
                    value={lembreteDescription}
                    onChange={(event) => setLembreteDescription(event.target.value)}
                    placeholder="Digite a descrição do lembrete"
                    readOnly={savingReminder}
                  />
                </label>

                <label className="form-grid-3__full">
                  <span>Data</span>
                  <CustomDatePicker
                    value={lembreteDate}
                    onChange={setLembreteDate}
                    placeholder="DD/MM/AAAA"
                    disabled={savingReminder}
                    className="home-reminder-date"
                  />
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
                <button className="secondary-button" type="button" onClick={closeCreateReminderModal} disabled={savingReminder}>
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

      {viewReminderOpen && selectedReminder ? (
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
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={closeReminderViewModal}
                disabled={deletingReminder}
              >
                <IoCloseOutline size={18} />
              </button>
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
                className="secondary-button"
                type="button"
                onClick={closeReminderViewModal}
                disabled={deletingReminder}
              >
                Cancelar
              </button>
              <button
                className="primary-button home-reminder-delete-button"
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
