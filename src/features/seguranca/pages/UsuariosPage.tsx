import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddCircleOutline,
  IoArrowBack,
  IoCloseOutline,
  IoListOutline,
  IoRefreshOutline,
  IoSettingsOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { ListSearchField } from '../../../components/ListSearchField';
import {
  acoesUsuariosCall,
  adicionarUsuariosTransacoesSistemaAcaoCall,
  adicionarUsuariosTransacoesSistemaCall,
  alterarParamUsuariosCall,
  deletarUsuarioTransacaoSistemaAcaoCall,
  deletarUsuarioTransacaoSistemaCall,
  listUsuariosCall,
  obterTransacoesSistemaAcaoCall,
  obterTransacoesSistemaCall,
  obterUsuariosTransacoesSistemaAcaoCall,
  obterUsuariosTransacoesSistemaCall,
} from '../../../services/apiCalls';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type SelectOption = {
  label: string;
  value: string;
};

const NIVEL_OPTIONS: SelectOption[] = [
  { label: 'Colaborador', value: '0' },
  { label: 'Coordenador', value: '1' },
  { label: 'Supervisor', value: '2' },
  { label: 'Gerente', value: '3' },
  { label: 'Diretor', value: '4' },
  { label: 'Administrador', value: '9' },
];

const MODULOS: SelectOption[] = [
  { label: 'Todos', value: '' },
  { label: 'Ativo Fixo', value: 'AFIX' },
  { label: 'Básico', value: 'BAS' },
  { label: 'Compras', value: 'COM' },
  { label: 'Configurações', value: 'CFG' },
  { label: 'Contabilidade', value: 'CON' },
  { label: 'Custo', value: 'CUS' },
  { label: 'Engenharia', value: 'ENG' },
  { label: 'Financeiro', value: 'FIN' },
  { label: 'Fiscal', value: 'FIS' },
  { label: 'Manutenção', value: 'MAN' },
  { label: 'PCP', value: 'PCP' },
  { label: 'Qualidade', value: 'QLD' },
  { label: 'Segurança', value: 'SEG' },
  { label: 'Serviço', value: 'SER' },
  { label: 'Vendas', value: 'VEN' },
];

const TIPO_USUARIO_OPTIONS: SelectOption[] = [
  { label: 'Interno', value: 'Interno' },
  { label: 'Externo', value: 'Externo' },
];

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const asText = (value: any) => String(value ?? '').trim();

const getNivelLabel = (nivel: any) => {
  const value = String(Number(nivel ?? 0));
  return NIVEL_OPTIONS.find((item) => item.value === value)?.label ?? value;
};

type SortField = 'codigo' | 'usuario' | 'email' | 'nivel';
type SortDirection = 'asc' | 'desc';

export function UsuariosPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [savingParametros, setSavingParametros] = useState(false);
  const [loadingTransacoes, setLoadingTransacoes] = useState(false);
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  const [search, setSearch] = useState('');
  const [usuarios, setUsuarios] = useState<any[]>([]);

  const [usuarioSelecionado, setUsuarioSelecionado] = useState<any | null>(null);
  const [parametrosOpen, setParametrosOpen] = useState(false);
  const [transacoesOpen, setTransacoesOpen] = useState(false);
  const [acoesOpen, setAcoesOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [paramNome, setParamNome] = useState('');
  const [paramCodigo, setParamCodigo] = useState('');
  const [paramSenha, setParamSenha] = useState('');
  const [paramNivel, setParamNivel] = useState('0');
  const [paramEmail, setParamEmail] = useState('');
  const [paramSenhaEmail, setParamSenhaEmail] = useState('');
  const [paramTipoUsuario, setParamTipoUsuario] = useState<'Interno' | 'Externo'>('Interno');

  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [transacoesUsuario, setTransacoesUsuario] = useState<any[]>([]);
  const [transacoesSearch, setTransacoesSearch] = useState('');
  const [moduloFilter, setModuloFilter] = useState('');

  const [transacaoSelecionada, setTransacaoSelecionada] = useState<any | null>(null);
  const [acoesSistema, setAcoesSistema] = useState<any[]>([]);
  const [acoesUsuario, setAcoesUsuario] = useState<any[]>([]);

  const usuarioSelecionadoCodigo = asText(
    usuarioSelecionado?.codigo_Usuario ?? usuarioSelecionado?.codigo_usuario ?? '',
  );
  const usuarioSelecionadoNivel = Number(
    usuarioSelecionado?.nivel_Usuario ?? usuarioSelecionado?.nivel_usuario ?? 0,
  );

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
    setLoadingUsuarios(true);
    try {
      const { baseUrl, token, usuario } = await registrarAcoesUsuario();

      let resp = await listUsuariosCall(baseUrl, token);
      if (!resp.succeeded && usuario) {
        resp = await listUsuariosCall(baseUrl, token, usuario);
      }

      if (!resp.succeeded) {
        setUsuarios([]);
        showToast('Não foi possível carregar os usuários.', 'error');
        return;
      }

      setUsuarios(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      setUsuarios([]);
      showToast(error?.message || 'Erro ao carregar usuários.', 'error');
    } finally {
      setLoadingUsuarios(false);
    }
  }, [registrarAcoesUsuario, showToast]);

  useEffect(() => {
    const nivel = Number(GlobalConfig.getNivelUsuario() ?? 0);
    if (nivel < 9) {
      showToast('Acesso restrito a administradores.', 'error');
      navigate(ROUTES.home, { replace: true });
      return;
    }

    void carregarUsuarios();
  }, [carregarUsuarios, navigate, showToast]);

  const usuariosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();

    return usuarios.filter((item) => {
      const codigo = asText(item?.codigo_Usuario ?? item?.codigo_usuario).toLowerCase();
      const nome = asText(item?.nome_Usuario ?? item?.nome_usuario).toLowerCase();
      const email = asText(item?.e_mail_Usuario ?? item?.e_mail_usuario).toLowerCase();
      return !term || codigo.includes(term) || nome.includes(term) || email.includes(term);
    });
  }, [search, usuarios]);

  const totalEncontrados = useMemo(() => usuariosFiltrados.length, [usuariosFiltrados]);

  const usuariosOrdenados = useMemo(() => {
    const list = [...usuariosFiltrados];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const codigoA = asText(a?.codigo_Usuario ?? a?.codigo_usuario);
      const codigoB = asText(b?.codigo_Usuario ?? b?.codigo_usuario);
      const nomeA = asText(a?.nome_Usuario ?? a?.nome_usuario);
      const nomeB = asText(b?.nome_Usuario ?? b?.nome_usuario);
      const emailA = asText(a?.e_mail_Usuario ?? a?.e_mail_usuario);
      const emailB = asText(b?.e_mail_Usuario ?? b?.e_mail_usuario);
      const nivelA = asText(a?.nivel_Usuario ?? a?.nivel_usuario);
      const nivelB = asText(b?.nivel_Usuario ?? b?.nivel_usuario);

      let comparison = 0;
      if (sortField === 'codigo') comparison = collator.compare(codigoA, codigoB);
      if (sortField === 'usuario') comparison = collator.compare(nomeA, nomeB);
      if (sortField === 'email') comparison = collator.compare(emailA, emailB);
      if (sortField === 'nivel') comparison = Number(nivelA || 0) - Number(nivelB || 0);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [sortDirection, sortField, usuariosFiltrados]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const abrirParametros = (usuario: any) => {
    const codigo = asText(usuario?.codigo_Usuario ?? usuario?.codigo_usuario);
    const nome = asText(usuario?.nome_Usuario ?? usuario?.nome_usuario);
    const senha = asText(usuario?.senha_Usuario ?? usuario?.senha_usuario);
    const nivel = asText((usuario?.nivel_Usuario ?? usuario?.nivel_usuario) || '0');
    const email = asText(usuario?.e_mail_Usuario ?? usuario?.e_mail_usuario);
    const senhaEmail = asText(usuario?.e_mail_Senha ?? usuario?.e_mail_senha);
    const externo = asText((usuario?.usuario_Externo ?? usuario?.usuario_externo) || '0');

    setUsuarioSelecionado(usuario);
    setParamCodigo(codigo);
    setParamNome(nome);
    setParamSenha(senha);
    setParamNivel(nivel || '0');
    setParamEmail(email);
    setParamSenhaEmail(senhaEmail);
    setParamTipoUsuario(externo === '0' ? 'Interno' : 'Externo');
    setParametrosOpen(true);
  };

  const salvarParametrosUsuario = async () => {
    if (savingParametros) return;

    if (!paramCodigo) {
      showToast('Código do usuário não encontrado.', 'error');
      return;
    }

    const nivelNumero = Number(paramNivel);
    if (!Number.isFinite(nivelNumero)) {
      showToast('Nível do usuário inválido.', 'error');
      return;
    }

    setSavingParametros(true);
    try {
      const { baseUrl, token } = await registrarAcoesUsuario();
      const resp = await alterarParamUsuariosCall(baseUrl, token, paramCodigo, {
        nomeUsuario: paramNome,
        senhaUsuario: paramSenha,
        nivelUsuario: nivelNumero,
        eMailUsuario: paramEmail,
        eMailSenha: paramSenhaEmail,
        usuarioExterno: paramTipoUsuario === 'Interno' ? 0 : -1,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível salvar os parâmetros do usuário.'), 'error');
        return;
      }

      showToast('Parâmetros do usuário atualizados.', 'success');
      setParametrosOpen(false);
      await carregarUsuarios();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar parâmetros do usuário.', 'error');
    } finally {
      setSavingParametros(false);
    }
  };

  const carregarTransacoes = useCallback(
    async (codigoUsuario: string) => {
      setLoadingTransacoes(true);
      try {
        const { baseUrl, token } = await registrarAcoesUsuario();

        const [respTransacoes, respUsuario] = await Promise.all([
          obterTransacoesSistemaCall(baseUrl, token, false),
          obterUsuariosTransacoesSistemaCall(baseUrl, token, codigoUsuario, '', false),
        ]);

        setTransacoes(getRows(respTransacoes.jsonBody || respTransacoes.data));
        setTransacoesUsuario(getRows(respUsuario.jsonBody || respUsuario.data));
      } catch (error: any) {
        setTransacoes([]);
        setTransacoesUsuario([]);
        showToast(error?.message || 'Erro ao carregar transações do usuário.', 'error');
      } finally {
        setLoadingTransacoes(false);
      }
    },
    [registrarAcoesUsuario, showToast],
  );

  const abrirTransacoes = async (usuario: any) => {
    const codigo = asText(usuario?.codigo_Usuario ?? usuario?.codigo_usuario);
    if (!codigo) {
      showToast('Código de usuário inválido.', 'error');
      return;
    }

    setUsuarioSelecionado(usuario);
    setTransacoesSearch('');
    setModuloFilter('');
    setTransacaoSelecionada(null);
    setAcoesSistema([]);
    setAcoesUsuario([]);
    setTransacoesOpen(true);
    await carregarTransacoes(codigo);
  };

  const transacoesNomeMap = useMemo(() => {
    const map = new Map<string, string>();
    const moduloMap = new Map<string, string>();

    transacoes.forEach((item) => {
      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
      const nome = asText(item?.nome_Formulario ?? item?.nome_formulario);
      const modulo = asText(item?.modulo_Transacao ?? item?.modulo_transacao).toUpperCase();
      if (codigo) {
        map.set(codigo, nome);
        moduloMap.set(codigo, modulo);
      }
    });

    return { name: map, module: moduloMap };
  }, [transacoes]);

  const usuarioTransacoesSet = useMemo(() => {
    const set = new Set<string>();
    transacoesUsuario.forEach((item) => {
      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
      if (codigo) set.add(codigo);
    });
    return set;
  }, [transacoesUsuario]);

  const usuarioAcoesSet = useMemo(() => {
    const set = new Set<string>();
    acoesUsuario.forEach((item) => {
      const codigo = asText(item?.id_Transacao_Acao ?? item?.id_transacao_acao);
      if (codigo) set.add(codigo);
    });
    return set;
  }, [acoesUsuario]);

  const transacoesSistemaFiltradas = useMemo(() => {
    const term = transacoesSearch.trim().toLowerCase();
    return transacoes.filter((item) => {
      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
      const nome = asText(item?.nome_Formulario ?? item?.nome_formulario).toLowerCase();
      const modulo = asText(item?.modulo_Transacao ?? item?.modulo_transacao).toUpperCase();
      const matchSearch = !term || codigo.toLowerCase().includes(term) || nome.includes(term);
      const matchModule = !moduloFilter || modulo === moduloFilter;
      const notLinked = !usuarioTransacoesSet.has(codigo);
      return matchSearch && matchModule && notLinked;
    });
  }, [moduloFilter, transacoes, transacoesSearch, usuarioTransacoesSet]);

  const transacoesUsuarioFiltradas = useMemo(() => {
    const term = transacoesSearch.trim().toLowerCase();
    return transacoesUsuario.filter((item) => {
      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
      const nome = asText(transacoesNomeMap.name.get(codigo) || codigo).toLowerCase();
      const modulo = asText(transacoesNomeMap.module.get(codigo)).toUpperCase();
      const matchSearch = !term || codigo.toLowerCase().includes(term) || nome.includes(term);
      const matchModule = !moduloFilter || modulo === moduloFilter;
      return matchSearch && matchModule;
    });
  }, [moduloFilter, transacoesNomeMap, transacoesSearch, transacoesUsuario]);

  const vincularTransacao = async (transacao: any) => {
    const codigoTransacao = asText(transacao?.codigo_Transacao ?? transacao?.codigo_transacao).toUpperCase();
    const nomeTransacao = asText(transacao?.nome_Formulario ?? transacao?.nome_formulario);
    const idTransacao = Number(transacao?.id_Transacao ?? transacao?.id_transacao ?? 0);

    if (!usuarioSelecionadoCodigo || !codigoTransacao || !idTransacao) {
      showToast('Dados da transação inválidos.', 'error');
      return;
    }

    if (nomeTransacao === 'Usuários' && usuarioSelecionadoNivel < 9) {
      showToast('Não é necessário vincular esta transação para usuário sem perfil administrador.', 'info');
      return;
    }

    try {
      const { baseUrl, token } = await registrarAcoesUsuario();
      const resp = await adicionarUsuariosTransacoesSistemaCall(baseUrl, token, {
        idTransacao,
        codigoUsuario: usuarioSelecionadoCodigo.toUpperCase(),
        codigoTransacao,
        transacaoFavorita: 0,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível vincular a transação.'), 'error');
        return;
      }

      await carregarTransacoes(usuarioSelecionadoCodigo);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao vincular transação.', 'error');
    }
  };

  const desvincularTransacao = async (transacao: any) => {
    const codigoTransacao = asText(transacao?.codigo_Transacao ?? transacao?.codigo_transacao).toUpperCase();
    if (!usuarioSelecionadoCodigo || !codigoTransacao) {
      showToast('Dados da transação inválidos.', 'error');
      return;
    }

    try {
      const { baseUrl, token } = await registrarAcoesUsuario();
      const resp = await deletarUsuarioTransacaoSistemaCall(baseUrl, token, usuarioSelecionadoCodigo, codigoTransacao);

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível desvincular a transação.'), 'error');
        return;
      }

      await carregarTransacoes(usuarioSelecionadoCodigo);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao desvincular transação.', 'error');
    }
  };

  const carregarAcoesTransacao = useCallback(
    async (idTransacao: string, codigoUsuario: string, idUsuarioTransacao: number) => {
      setLoadingAcoes(true);
      try {
        const { baseUrl, token } = await registrarAcoesUsuario();

        const [respSistema, respUsuario] = await Promise.all([
          obterTransacoesSistemaAcaoCall(baseUrl, token, idTransacao),
          obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, codigoUsuario, '', ''),
        ]);

        const sistema = getRows(respSistema.jsonBody || respSistema.data);
        const usuario = getRows(respUsuario.jsonBody || respUsuario.data).filter((item: any) => {
          const itemId = Number(item?.id_Usuario_Transacao ?? item?.id_usuario_transacao ?? 0);
          return itemId === idUsuarioTransacao;
        });

        setAcoesSistema(sistema);
        setAcoesUsuario(usuario);
        return { sistema, usuario };
      } catch (error: any) {
        setAcoesSistema([]);
        setAcoesUsuario([]);
        showToast(error?.message || 'Erro ao carregar ações da transação.', 'error');
        return { sistema: [], usuario: [] };
      } finally {
        setLoadingAcoes(false);
      }
    },
    [registrarAcoesUsuario, showToast],
  );

  const abrirAcoes = async (transacao: any) => {
    const idTransacao = asText(transacao?.id_Transacao ?? transacao?.id_transacao);
    const idUsuarioTransacao = Number(
      transacao?.id_Usuario_Transacao ?? transacao?.id_usuario_transacao ?? 0,
    );

    if (!idTransacao || !usuarioSelecionadoCodigo || !idUsuarioTransacao) {
      showToast('Dados da transação inválidos para gestão de ações.', 'error');
      return;
    }

    setTransacaoSelecionada(transacao);
    const result = await carregarAcoesTransacao(idTransacao, usuarioSelecionadoCodigo, idUsuarioTransacao);
    if (result.sistema.length === 0) {
      showToast('Essa transação não possui ações cadastradas.', 'info');
      return;
    }

    setAcoesOpen(true);
  };

  const vincularAcao = async (acao: any) => {
    if (!transacaoSelecionada || !usuarioSelecionadoCodigo) {
      showToast('Transação selecionada inválida.', 'error');
      return;
    }

    const idUsuarioTransacao = Number(
      transacaoSelecionada?.id_Usuario_Transacao ?? transacaoSelecionada?.id_usuario_transacao ?? 0,
    );
    const idTransacao = asText(transacaoSelecionada?.id_Transacao ?? transacaoSelecionada?.id_transacao);
    const idTransacaoAcao = Number(acao?.id_Transacao_Acao ?? acao?.id_transacao_acao ?? 0);

    if (!idUsuarioTransacao || !idTransacao || !idTransacaoAcao) {
      showToast('Ação inválida para vincular.', 'error');
      return;
    }

    const jaVinculada = acoesUsuario.some((item) => {
      const acaoId = Number(item?.id_Transacao_Acao ?? item?.id_transacao_acao ?? 0);
      const usuarioTransacaoId = Number(item?.id_Usuario_Transacao ?? item?.id_usuario_transacao ?? 0);
      return acaoId === idTransacaoAcao && usuarioTransacaoId === idUsuarioTransacao;
    });

    if (jaVinculada) {
      showToast('Esta ação já está vinculada.', 'info');
      return;
    }

    try {
      const { baseUrl, token } = await registrarAcoesUsuario();
      const resp = await adicionarUsuariosTransacoesSistemaAcaoCall(baseUrl, token, {
        idUsuarioTransacao,
        idTransacaoAcao,
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível vincular a ação.'), 'error');
        return;
      }

      await carregarAcoesTransacao(idTransacao, usuarioSelecionadoCodigo, idUsuarioTransacao);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao vincular ação.', 'error');
    }
  };

  const desvincularAcao = async (acao: any) => {
    if (!transacaoSelecionada || !usuarioSelecionadoCodigo) {
      showToast('Transação selecionada inválida.', 'error');
      return;
    }

    const idUsuarioTransacao = Number(
      transacaoSelecionada?.id_Usuario_Transacao ?? transacaoSelecionada?.id_usuario_transacao ?? 0,
    );
    const idTransacao = asText(transacaoSelecionada?.id_Transacao ?? transacaoSelecionada?.id_transacao);
    const idUsuarioTransacaoAcao = Number(
      acao?.id_Usuario_Transacao_Acao ?? acao?.id_usuario_transacao_acao ?? 0,
    );

    if (!idUsuarioTransacaoAcao || !idUsuarioTransacao || !idTransacao) {
      showToast('Ação inválida para exclusão.', 'error');
      return;
    }

    try {
      const { baseUrl, token } = await registrarAcoesUsuario();
      const resp = await deletarUsuarioTransacaoSistemaAcaoCall(baseUrl, token, idUsuarioTransacaoAcao);

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Não foi possível desvincular a ação.'), 'error');
        return;
      }

      await carregarAcoesTransacao(idTransacao, usuarioSelecionadoCodigo, idUsuarioTransacao);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao desvincular ação.', 'error');
    }
  };

  return (
    <main className="clientes-page list-layout-page usuarios-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Usuários</h1>
            <p>Consulta de usuários e gestão de permissões de transação/ação.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalEncontrados} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Usuários"
              placeholder="Pesquisar código, nome ou e-mail"
              className="usuarios-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarUsuarios()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loadingUsuarios}
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        <section className="module-table list-layout-table">
          {loadingUsuarios ? (
            <p className="module-empty">Carregando usuários...</p>
          ) : usuariosFiltrados.length === 0 ? (
            <p className="module-empty">Nenhum usuário encontrado.</p>
          ) : (
            <>
              <div className="table-scroll module-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('codigo')}>
                          Código <span>{getSortIndicator('codigo')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('usuario')}>
                          Usuário <span>{getSortIndicator('usuario')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('email')}>
                          E-mail <span>{getSortIndicator('email')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('nivel')}>
                          Nível <span>{getSortIndicator('nivel')}</span>
                        </button>
                      </th>
                      <th className="module-table__actions-col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosOrdenados.map((item, index) => {
                      const codigo = asText(item?.codigo_Usuario ?? item?.codigo_usuario);
                      const nome = asText(item?.nome_Usuario ?? item?.nome_usuario);
                      const email = asText(item?.e_mail_Usuario ?? item?.e_mail_usuario);
                      const nivel = asText(item?.nivel_Usuario ?? item?.nivel_usuario);

                      return (
                        <tr key={`${codigo || 'usuario'}-${index}`}>
                          <td>{codigo || '-'}</td>
                          <td>{nome || '-'}</td>
                          <td>{email || '-'}</td>
                          <td>{getNivelLabel(nivel)}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                title="Parâmetros do usuário"
                                aria-label="Parâmetros do usuário"
                                onClick={() => abrirParametros(item)}
                              >
                                <IoSettingsOutline size={16} />
                              </button>
                              <button
                                type="button"
                                title="Transações do usuário"
                                aria-label="Transações do usuário"
                                onClick={() => void abrirTransacoes(item)}
                              >
                                <IoListOutline size={16} />
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
                {usuariosOrdenados.map((item, index) => {
                  const codigo = asText(item?.codigo_Usuario ?? item?.codigo_usuario);
                  const nome = asText(item?.nome_Usuario ?? item?.nome_usuario);
                  const email = asText(item?.e_mail_Usuario ?? item?.e_mail_usuario);
                  const nivel = asText(item?.nivel_Usuario ?? item?.nivel_usuario);

                  return (
                    <article className="module-card" key={`card-${codigo || 'usuario'}-${index}`}>
                      <div className="module-card__row">
                        <span>Código</span>
                        <strong>{codigo || '-'}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Usuário</span>
                        <strong>{nome || '-'}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>E-mail</span>
                        <strong>{email || '-'}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Nível</span>
                        <strong>{getNivelLabel(nivel)}</strong>
                      </div>

                      <div className="module-card__actions">
                        <button
                          type="button"
                          title="Parâmetros do usuário"
                          aria-label="Parâmetros do usuário"
                          onClick={() => abrirParametros(item)}
                        >
                          <IoSettingsOutline size={16} />
                        </button>
                        <button
                          type="button"
                          title="Transações do usuário"
                          aria-label="Transações do usuário"
                          onClick={() => void abrirTransacoes(item)}
                        >
                          <IoListOutline size={16} />
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

      {parametrosOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide usuarios-parametros-modal">
            <header className="modal-card__header">
              <h2>Parâmetros do usuário</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (savingParametros) return;
                  setParametrosOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <section className="module-form">
              <div className="form-grid-3">
                <label>
                  <span>Código</span>
                  <input value={paramCodigo} readOnly />
                </label>

                <label className="form-grid-3__full">
                  <span>Nome</span>
                  <input value={paramNome} onChange={(event) => setParamNome(event.target.value)} />
                </label>

                <label>
                  <span>Senha login</span>
                  <input
                    type="password"
                    value={paramSenha}
                    onChange={(event) => setParamSenha(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  <span>Nível</span>
                  <SearchableSelect
                    value={paramNivel}
                    onChange={setParamNivel}
                    options={NIVEL_OPTIONS}
                    ariaLabel="Nível"
                    searchPlaceholder="Pesquisar nível"
                  />
                </label>

                <label>
                  <span>Tipo usuário</span>
                  <SearchableSelect
                    value={paramTipoUsuario}
                    onChange={(nextValue) => setParamTipoUsuario(nextValue as 'Interno' | 'Externo')}
                    options={TIPO_USUARIO_OPTIONS}
                    ariaLabel="Tipo usuário"
                    searchPlaceholder="Pesquisar tipo"
                  />
                </label>

                <label className="form-grid-3__full">
                  <span>E-mail</span>
                  <input value={paramEmail} onChange={(event) => setParamEmail(event.target.value)} />
                </label>

                <label className="form-grid-3__full">
                  <span>Senha e-mail</span>
                  <input
                    type="password"
                    value={paramSenhaEmail}
                    onChange={(event) => setParamSenhaEmail(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setParametrosOpen(false)}
                  disabled={savingParametros}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void salvarParametrosUsuario()}
                  disabled={savingParametros}
                >
                  {savingParametros ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </section>
          </article>
        </section>
      )}

      {transacoesOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide usuarios-permissoes-modal">
            <header className="modal-card__header">
              <h2>Transações do usuário {usuarioSelecionadoCodigo || '-'}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setTransacoesOpen(false);
                  setTransacaoSelecionada(null);
                  setAcoesSistema([]);
                  setAcoesUsuario([]);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="permission-toolbar">
              <label>
                <span>Pesquisar transação</span>
                <input
                  className="permission-toolbar__search-input"
                  value={transacoesSearch}
                  onChange={(event) => setTransacoesSearch(event.target.value)}
                  placeholder="Pesquisar código ou nome"
                />
              </label>

              <label>
                <span>Módulo</span>
                <SearchableSelect
                  value={moduloFilter}
                  onChange={setModuloFilter}
                  options={MODULOS}
                  ariaLabel="Módulo"
                  searchPlaceholder="Pesquisar módulo"
                />
              </label>
            </div>

            <div className="permission-grid">
              <section className="permission-column">
                <h3>Sistema</h3>
                <div className="permission-box">
                  {loadingTransacoes ? (
                    <p className="module-empty">Carregando transações...</p>
                  ) : transacoesSistemaFiltradas.length === 0 ? (
                    <p className="module-empty">Nenhuma transação encontrada.</p>
                  ) : (
                    transacoesSistemaFiltradas.map((item, index) => {
                      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
                      const nome = asText(item?.nome_Formulario ?? item?.nome_formulario) || codigo;
                      const modulo = asText(item?.modulo_Transacao ?? item?.modulo_transacao).toUpperCase();

                      return (
                        <div className="permission-row" key={`${codigo || 'sistema'}-${index}`}>
                          <div className="permission-row__meta">
                            <strong title={nome}>{nome}</strong>
                            <small>{[codigo, modulo].filter(Boolean).join(' • ') || '-'}</small>
                          </div>
                          <div className="permission-row__actions">
                            <button
                              type="button"
                              title="Vincular transação"
                              aria-label="Vincular transação"
                              onClick={() => void vincularTransacao(item)}
                            >
                              <IoAddCircleOutline size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="permission-column">
                <h3>Usuário</h3>
                <div className="permission-box">
                  {loadingTransacoes ? (
                    <p className="module-empty">Carregando transações...</p>
                  ) : transacoesUsuarioFiltradas.length === 0 ? (
                    <p className="module-empty">Nenhuma transação vinculada.</p>
                  ) : (
                    transacoesUsuarioFiltradas.map((item, index) => {
                      const codigo = asText(item?.codigo_Transacao ?? item?.codigo_transacao).toUpperCase();
                      const nome = asText(transacoesNomeMap.name.get(codigo) || codigo);

                      return (
                        <div className="permission-row" key={`${codigo || 'usuario'}-${index}`}>
                          <div className="permission-row__meta">
                            <strong title={nome}>{nome}</strong>
                            <small>{codigo || '-'}</small>
                          </div>
                          <div className="permission-row__actions">
                            <button
                              type="button"
                              title="Gerenciar ações"
                              aria-label="Gerenciar ações"
                              onClick={() => void abrirAcoes(item)}
                            >
                              <IoSettingsOutline size={16} />
                            </button>
                            <button
                              className="danger"
                              type="button"
                              title="Desvincular transação"
                              aria-label="Desvincular transação"
                              onClick={() => void desvincularTransacao(item)}
                            >
                              <IoTrashOutline size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </article>
        </section>
      )}

      {acoesOpen && transacaoSelecionada && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide usuarios-permissoes-modal">
            <header className="modal-card__header">
              <h2>Ações da transação {asText(transacaoSelecionada?.codigo_Transacao ?? transacaoSelecionada?.codigo_transacao)}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setAcoesOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="permission-grid">
              <section className="permission-column">
                <h3>Sistema</h3>
                <div className="permission-box">
                  {loadingAcoes ? (
                    <p className="module-empty">Carregando ações...</p>
                  ) : acoesSistema.filter((item) => !usuarioAcoesSet.has(asText(item?.id_Transacao_Acao ?? item?.id_transacao_acao))).length === 0 ? (
                    <p className="module-empty">Nenhuma ação disponível.</p>
                  ) : (
                    acoesSistema
                      .filter((item) => !usuarioAcoesSet.has(asText(item?.id_Transacao_Acao ?? item?.id_transacao_acao)))
                      .map((item, index) => {
                        const idAcao = asText(item?.id_Transacao_Acao ?? item?.id_transacao_acao);
                        const descricao = asText(item?.descricao_Acao ?? item?.descricao_acao) || idAcao;

                        return (
                          <div className="permission-row" key={`${idAcao || 'acao'}-${index}`}>
                            <div className="permission-row__meta">
                              <strong title={descricao}>{descricao}</strong>
                              <small>{idAcao || '-'}</small>
                            </div>
                            <div className="permission-row__actions">
                              <button
                                type="button"
                                title="Vincular ação"
                                aria-label="Vincular ação"
                                onClick={() => void vincularAcao(item)}
                              >
                                <IoAddCircleOutline size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </section>

              <section className="permission-column">
                <h3>Usuário</h3>
                <div className="permission-box">
                  {loadingAcoes ? (
                    <p className="module-empty">Carregando ações...</p>
                  ) : acoesUsuario.length === 0 ? (
                    <p className="module-empty">Nenhuma ação vinculada.</p>
                  ) : (
                    acoesUsuario.map((item, index) => {
                      const descricao = asText(item?.descricao_Acao ?? item?.descricao_acao);
                      const idAcaoUsuario = asText(
                        item?.id_Usuario_Transacao_Acao ?? item?.id_usuario_transacao_acao,
                      );

                      return (
                        <div className="permission-row" key={`${idAcaoUsuario || 'acao-usuario'}-${index}`}>
                          <div className="permission-row__meta">
                            <strong title={descricao}>{descricao || idAcaoUsuario || '-'}</strong>
                            <small>{idAcaoUsuario || '-'}</small>
                          </div>
                          <div className="permission-row__actions">
                            <button
                              className="danger"
                              type="button"
                              title="Desvincular ação"
                              aria-label="Desvincular ação"
                              onClick={() => void desvincularAcao(item)}
                            >
                              <IoTrashOutline size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
