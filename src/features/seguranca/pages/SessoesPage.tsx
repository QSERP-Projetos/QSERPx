import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoCloseOutline,
  IoFilterOutline,
  IoLogOutOutline,
  IoRefreshOutline,
  IoSyncOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  adicionarLicencaCall,
  adicionarUsuarioSistemaLogCall,
  buscaSessoesCall,
  inserirOuAtualizarTransacaoCall,
  listUsuariosCall,
  logoutCall,
  tokenCall,
} from '../../../services/apiCalls';
import { buscaLicencaCliente, licencaPorHd } from '../../../services/supabaseQueries';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type SelectOption = {
  value: string;
  label: string;
};

type SortField = 'usuario' | 'sessao' | 'dataLogin' | 'versao';
type SortDirection = 'asc' | 'desc';

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const cleaned = value.replace(/([+-]\d{2}:\d{2})$/, '');
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return value;

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

const formatSupabaseDate = (value?: string) => {
  if (!value) return undefined;
  const cleaned = value.replace(/([+-]\d{2}:\d{2})$/, '');
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return value;

  const year = String(parsed.getFullYear()).padStart(4, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveToken = (response: any) => {
  return String(response?.jsonBody?.token ?? response?.data?.token ?? response?.data?.Token ?? '').trim();
};

const formatToday = () => {
  return '';
};

const parseDateStamp = (value: string) => {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isFinite(date.getTime()) ? date.getTime() : null;
};

const parseLoginDateStamp = (row: any) => {
  const raw = String(row?.data_Hora_Login ?? row?.data_hora_login ?? '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;

  const normalized = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return normalized.getTime();
};

export function SessoesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [licencaLoading, setLicencaLoading] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<SelectOption[]>([]);
  const [selectedUser, setSelectedUser] = useState('');

  const [rows, setRows] = useState<any[]>([]);
  const [totalSessoes, setTotalSessoes] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sessaoSelecionada, setSessaoSelecionada] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>('dataLogin');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const initialLoadRef = useRef(false);

  const registrarAcoesUsuario = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !usuario) {
      throw new Error('Informações de sessão não encontradas.');
    }

    await acoesUsuariosCall(baseUrl, token, {
      codigoEmpresa: codigoEmpresa ?? undefined,
      idSessao: idSessao ?? undefined,
      codigoUsuario: usuario,
    });

    return { baseUrl, token, codigoEmpresa, usuario };
  }, []);

  const carregarUsuarios = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) {
      return;
    }

    setLoadingUsers(true);
    try {
      const resp = await listUsuariosCall(baseUrl, token);
      const options = getRows(resp.jsonBody || resp.data)
        .map((item: any) => ({
          value: String(item?.codigo_Usuario ?? '').trim(),
          label: String(item?.nome_Usuario ?? '').trim(),
        }))
        .filter((item: SelectOption) => item.value && item.label);

      setUsuarios(options);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar usuários.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  const carregarSessoes = useCallback(
    async (codigoUsuario?: string) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario();

      if (!baseUrl || !token || !usuario) {
        showToast('Informações de sessão não encontradas.', 'error');
        return;
      }

      setLoading(true);
      try {
        const resp = await buscaSessoesCall(baseUrl, token, {
          codigoUsuario: codigoUsuario ?? selectedUser ?? '',
          idSistema: 1,
        });

        setRows(getRows(resp.jsonBody || resp.data));
      } catch (error: any) {
        showToast(error?.message || 'Erro ao carregar sessões.', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedUser, showToast],
  );

  const carregarTotalSessoes = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) {
      return;
    }

    try {
      const resp = await buscaSessoesCall(baseUrl, token, {
        codigoUsuario: '',
        idSistema: 1,
      });

      setTotalSessoes(getRows(resp.jsonBody || resp.data).length);
    } catch {
      setTotalSessoes(0);
    }
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarUsuarios();
    void carregarSessoes('');
    void carregarTotalSessoes();
  }, [carregarSessoes, carregarTotalSessoes, carregarUsuarios]);

  const resolveSessaoId = (row: any) => {
    return Number(row?.iD_Sessao ?? row?.id_Sessao ?? row?.id_sessao ?? 0);
  };

  const resolveSessaoUsuario = (row: any) => {
    return String(row?.codigo_Usuario ?? row?.codigo_usuario ?? '').trim();
  };

  const abrirEncerrarSessao = (row: any) => {
    setSessaoSelecionada(row);
    setConfirmOpen(true);
  };

  const confirmarEncerrarSessao = async () => {
    if (!sessaoSelecionada) return;

    const sessaoId = resolveSessaoId(sessaoSelecionada);
    if (!sessaoId) {
      showToast('Id de sessão inválido.', 'error');
      return;
    }

    setEncerrando(true);
    try {
      const { baseUrl, token, codigoEmpresa, usuario } = await registrarAcoesUsuario();

      if (!codigoEmpresa) {
        showToast('Código da empresa não encontrado para logout.', 'error');
        return;
      }

      const logoutResp = await logoutCall(baseUrl, codigoEmpresa, sessaoId, token);
      if (!logoutResp.succeeded) {
        showToast('Falha ao encerrar sessão do usuário.', 'error');
        return;
      }

      await adicionarUsuarioSistemaLogCall(baseUrl, token, {
        usuario,
        menu: 'Sessões',
        acao: 'Encerrar Sessão',
        codigoTransacao: 'CFG008',
        nomeCampo: 'Id Sessão',
        valorAntigo: 'Conectado',
        valorNovo: 'Desconectado',
      });

      showToast('Sessão encerrada com sucesso.', 'success');
      setConfirmOpen(false);
      setSessaoSelecionada(null);
      await carregarSessoes(selectedUser);
      await carregarTotalSessoes();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao encerrar sessão.', 'error');
    } finally {
      setEncerrando(false);
    }
  };

  const atualizarLicenca = async () => {
    if (licencaLoading) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const chaveApi = GlobalConfig.getChaveApi();
    const guid = GlobalConfig.getGuidID();
    const numeroHd = GlobalConfig.getNumHD();

    if (!baseUrl || !token || !chaveApi || !guid || !numeroHd) {
      showToast('Informações de licença/sessão não encontradas.', 'error');
      return;
    }

    setLicencaLoading(true);
    try {
      const tokenResp = await tokenCall(baseUrl, {
        usuario: 'null',
        nomeEmpresa: 'null',
        codigoEmpresa: 0,
        chaveApi,
        idGuid: guid,
        tipo: 1,
      });

      if (!tokenResp.succeeded) {
        showToast('Falha ao gerar token de segurança.', 'error');
        return;
      }

      const tokenLicenca = resolveToken(tokenResp);
      if (tokenLicenca) {
        GlobalConfig.setJwToken(tokenLicenca);
      }

      const licencas = await licencaPorHd({ numeroHd, idSistema: 1 });
      if (!licencas || licencas.length === 0) {
        showToast('Licença não encontrada para este HD.', 'error');
        return;
      }

      const licenca: any = licencas[0];
      const idCliente = String(licenca?.id_cliente ?? licenca?.idCliente ?? '').trim();
      const idLicenca = String(licenca?.id ?? licenca?.idLicenca ?? '').trim();

      if (!idCliente || !idLicenca) {
        showToast('Dados de licença inválidos para atualização.', 'error');
        return;
      }

      const licencaView = await buscaLicencaCliente({ idCliente, idLicenca });
      if (!licencaView || licencaView.length === 0) {
        showToast('Não foi possível localizar transações da licença.', 'error');
        return;
      }

      const licencaPayload = {
        id: licenca?.id ?? licenca?.idLicenca,
        situacao_licenca: licenca?.situacao_licenca ?? licenca?.situacaoLicenca,
        data_validade: formatSupabaseDate(licenca?.data_validade ?? licenca?.dataValidade),
        mensagem_fim_validade: licenca?.mensagem_fim_validade ?? licenca?.mensagemFimValidade,
        dias_ant_mensagem_fim_validade: licenca?.dias_ant_mensagem_fim_validade ?? licenca?.diasAntMensagemFimValidade,
        numero_acessos: licenca?.numero_acessos ?? licenca?.numeroAcessos,
        numero_hd: licenca?.numero_hd ?? licenca?.numeroHd,
        instancia_sql: licenca?.instancia_sql ?? licenca?.instanciaSql,
        nome_banco: licenca?.nome_banco ?? licenca?.nomeBanco,
        versao_sistema: licenca?.versao_sistema ?? licenca?.versaoSistema,
        usuario_sql: licenca?.usuario_sql ?? licenca?.usuarioSql,
        senha_sql: licenca?.senha_sql ?? licenca?.senhaSql,
        versao_limite: licenca?.versao_limite ?? licenca?.versaoLimite,
        tipo_licenca: licenca?.tipo_licenca ?? licenca?.tipoLicenca,
        tipo_banco: licenca?.tipo_banco ?? licenca?.tipoBanco,
      };

      const licencaResp = await adicionarLicencaCall(baseUrl, tokenLicenca || token, licencaPayload);
      if (!licencaResp.succeeded) {
        showToast(getApiErrorMessage(licencaResp, 'Falha ao atualizar licença no servidor.'), 'error');
        return;
      }

      const transacaoResp = await inserirOuAtualizarTransacaoCall(baseUrl, tokenLicenca || token, licencaView as any[]);
      if (!transacaoResp.succeeded) {
        showToast(getApiErrorMessage(transacaoResp, 'Falha ao atualizar transações da licença.'), 'error');
        return;
      }

      showToast('Licença atualizada com sucesso.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao atualizar licença.', 'error');
    } finally {
      setLicencaLoading(false);
    }
  };

  const rowsFiltradas = useMemo(() => {
    const inicioStamp = parseDateStamp(dataInicio);
    const fimStamp = parseDateStamp(dataFim);

    return rows.filter((row) => {
      const loginStamp = parseLoginDateStamp(row);
      const withinInicio = inicioStamp === null || loginStamp === null || loginStamp >= inicioStamp;
      const withinFim = fimStamp === null || loginStamp === null || loginStamp <= fimStamp;
      return withinInicio && withinFim;
    });
  }, [dataFim, dataInicio, rows]);

  const usuarioOptions = useMemo(() => [{ value: '', label: 'Todos' }, ...usuarios], [usuarios]);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rowsFiltradas];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const usuarioA = resolveSessaoUsuario(a);
      const usuarioB = resolveSessaoUsuario(b);
      const sessaoA = resolveSessaoId(a);
      const sessaoB = resolveSessaoId(b);
      const dataA = new Date(String(a?.data_Hora_Login ?? a?.data_hora_login ?? '')).getTime();
      const dataB = new Date(String(b?.data_Hora_Login ?? b?.data_hora_login ?? '')).getTime();
      const safeDataA = Number.isFinite(dataA) ? dataA : 0;
      const safeDataB = Number.isFinite(dataB) ? dataB : 0;
      const versaoA = String(a?.versao_Sistema ?? a?.versao_sistema ?? '-');
      const versaoB = String(b?.versao_Sistema ?? b?.versao_sistema ?? '-');

      let comparison = 0;
      if (sortField === 'usuario') comparison = collator.compare(usuarioA, usuarioB);
      if (sortField === 'sessao') comparison = sessaoA - sessaoB;
      if (sortField === 'dataLogin') comparison = safeDataA - safeDataB;
      if (sortField === 'versao') comparison = collator.compare(versaoA, versaoB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rowsFiltradas, sortDirection, sortField]);

  const rowsPesquisa = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'dataLogin' ? 'desc' : 'asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Sessões QSERPX</h1>
            <p>Monitoramento e encerramento de sessões ativas.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{rowsPesquisa.length} encontrados de {totalSessoes}</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Sessões QSERPX"
              placeholder="Pesquisar na lista de sessões"
              className="sessoes-search"
            />

            <button
              className={`icon-button module-action-button${filtrosOpen ? ' module-action-button--primary' : ''}`}
              type="button"
              onClick={() => setFiltrosOpen(true)}
              title={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
              aria-label={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
            >
              <IoFilterOutline size={16} />
            </button>
            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarSessoes(selectedUser)}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => void atualizarLicenca()}
              title={licencaLoading ? 'Atualizando licença' : 'Atualizar licença'}
              aria-label={licencaLoading ? 'Atualizando licença' : 'Atualizar licença'}
              disabled={licencaLoading}
            >
              <IoSyncOutline size={16} />
            </button>
          </div>
        </div>

        <AdvancedFiltersPanel
          open={filtrosOpen}
          onClose={() => setFiltrosOpen(false)}
          onApply={() => {
            setFiltrosOpen(false);
            void carregarSessoes(selectedUser);
          }}
          applyDisabled={loading}
        >
          <div className="list-layout-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
            </label>
            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker value={dataFim} onChange={setDataFim} />
            </label>

            <label className="list-layout-field list-layout-field--lg">
              <span>Usuário</span>
              <SearchableSelect
                value={selectedUser}
                onChange={setSelectedUser}
                options={usuarioOptions}
                searchPlaceholder="Pesquisar usuário"
                ariaLabel="Usuário"
                disabled={loadingUsers}
              />
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando sessões...</p>
        ) : rowsPesquisa.length === 0 ? (
          <p className="module-empty">Nenhuma sessão encontrada.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('usuario')}>
                      Usuário <span>{getSortIndicator('usuario')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('sessao')}>
                      Sessão <span>{getSortIndicator('sessao')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('dataLogin')}>
                      Data login <span>{getSortIndicator('dataLogin')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('versao')}>
                      Versão <span>{getSortIndicator('versao')}</span>
                    </button>
                  </th>
                  <th className="module-table__actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rowsPesquisa.map((row, index) => {
                  const key = resolveSessaoId(row) || index;
                  const usuarioSessao = resolveSessaoUsuario(row) || '-';
                  const dataLogin = formatDateTime(String(row?.data_Hora_Login ?? row?.data_hora_login ?? ''));
                  const versao = String(row?.versao_Sistema ?? row?.versao_sistema ?? '-');

                  return (
                    <tr key={key}>
                      <td>{usuarioSessao}</td>
                      <td>{resolveSessaoId(row) || '-'}</td>
                      <td>{dataLogin}</td>
                      <td>{versao}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            title="Encerrar sessão"
                            aria-label="Encerrar sessão"
                            onClick={() => abrirEncerrarSessao(row)}
                          >
                            <IoLogOutOutline size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div className="module-cards">
              {rowsPesquisa.map((row, index) => {
                const key = resolveSessaoId(row) || index;
                const usuarioSessao = resolveSessaoUsuario(row) || '-';
                const dataLogin = formatDateTime(String(row?.data_Hora_Login ?? row?.data_hora_login ?? ''));
                const versao = String(row?.versao_Sistema ?? row?.versao_sistema ?? '-');

                return (
                  <article className="module-card" key={`card-${key}`}>
                    <div className="module-card__row">
                      <span>Usuário</span>
                      <strong>{usuarioSessao}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Sessão</span>
                      <strong>{resolveSessaoId(row) || '-'}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Data login</span>
                      <strong>{dataLogin}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Versão</span>
                      <strong>{versao}</strong>
                    </div>

                    <div className="module-card__actions">
                      <button
                        type="button"
                        title="Encerrar sessão"
                        aria-label="Encerrar sessão"
                        onClick={() => abrirEncerrarSessao(row)}
                      >
                        <IoLogOutOutline size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        </section>
      </section>

      {confirmOpen && sessaoSelecionada && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Encerrar sessão</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (encerrando) return;
                  setConfirmOpen(false);
                  setSessaoSelecionada(null);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <p className="module-empty">
              Deseja realmente encerrar a sessão <strong>{resolveSessaoId(sessaoSelecionada)}</strong> do usuário{' '}
              <strong>{resolveSessaoUsuario(sessaoSelecionada) || '-'}</strong>?
            </p>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (encerrando) return;
                  setConfirmOpen(false);
                  setSessaoSelecionada(null);
                }}
                disabled={encerrando}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void confirmarEncerrarSessao()} disabled={encerrando}>
                {encerrando ? 'Encerrando...' : 'Encerrar sessão'}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
