import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseOutline,
  IoCreateOutline,
  IoLocationOutline,
  IoPeopleOutline,
  IoPersonAddOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect } from '../../../components/SearchableSelect';

// ============================================================================
// Tipos de dados mapeados do esquema relacional (MS Access / API):
// Tabela: Almoxarifado (Codigo_Almox, Endereco_Almox, Descricao_Almox)
// Tabela: Almoxarifado_Usuario (Codigo_Almox, Codigo_Usuario)
// ============================================================================

export interface UsuarioAlmoxarifado {
  codigoUsuario: string;
  nomeUsuario: string;
}

export interface Almoxarifado {
  codigoAlmox: number;
  enderecoAlmox: string;
  descricaoAlmox: string;
  usuariosAutorizados: UsuarioAlmoxarifado[];
}

// Dados iniciais baseados nos cadastros reais do sistema Q4/MAPA
const ALMOXARIFADOS_INICIAIS: Almoxarifado[] = [
  {
    codigoAlmox: 1,
    enderecoAlmox: 'GALPAO-01-A',
    descricaoAlmox: 'Almoxarifado Central - Matéria-Prima',
    usuariosAutorizados: [
      { codigoUsuario: 'OPER01', nomeUsuario: 'Carlos Eduardo Silva' },
      { codigoUsuario: 'FISC02', nomeUsuario: 'Mariana Costa Ribeiro' },
    ],
  },
  {
    codigoAlmox: 2,
    enderecoAlmox: 'PRAT-04-B',
    descricaoAlmox: 'Almoxarifado de Componentes Eletrônicos',
    usuariosAutorizados: [
      { codigoUsuario: 'OPER03', nomeUsuario: 'Roberto Souza Ramos' },
    ],
  },
  {
    codigoAlmox: 3,
    enderecoAlmox: 'DOCA-EXP-02',
    descricaoAlmox: 'Almoxarifado de Produtos Acabados - Expedição',
    usuariosAutorizados: [
      { codigoUsuario: 'EXPED01', nomeUsuario: 'Fernanda Lima Santos' },
    ],
  },
  {
    codigoAlmox: 4,
    enderecoAlmox: 'QUADRA-C-TERC',
    descricaoAlmox: 'Estoque de Materiais em Terceiros (Industrialização)',
    usuariosAutorizados: [],
  },
];

// Lista de usuários globais para seleção/vínculo no subformulário
const USUARIOS_SISTEMA = [
  { codigo: 'OPER01', nome: 'Carlos Eduardo Silva' },
  { codigo: 'FISC02', nome: 'Mariana Costa Ribeiro' },
  { codigo: 'OPER03', nome: 'Roberto Souza Ramos' },
  { codigo: 'EXPED01', nome: 'Fernanda Lima Santos' },
  { codigo: 'ALMOX05', nome: 'João Pedro Oliveira' },
  { codigo: 'QUAL01', nome: 'Beatriz Vasconcelos' },
];

type SortField = 'codigo' | 'descricao' | 'endereco';
type SortDirection = 'asc' | 'desc';

export function AlmoxarifadoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [almoxarifados, setAlmoxarifados] = useState<Almoxarifado[]>(ALMOXARIFADOS_INICIAIS);
  const [search, setSearch] = useState('');

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Controle da Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState<Almoxarifado | null>(null);
  const [isNovoRegistro, setIsNovoRegistro] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Almoxarifado | null>(null);

  // Campos do formulário na modal
  const [codigoAlmox, setCodigoAlmox] = useState<number | ''>('');
  const [enderecoAlmox, setEnderecoAlmox] = useState('');
  const [descricaoAlmox, setDescricaoAlmox] = useState('');
  const [usuariosAutorizados, setUsuariosAutorizados] = useState<UsuarioAlmoxarifado[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');

  // ============================================================================
  // Handlers para carregar/recarregar dados (Pronto para conectar GET API)
  // ============================================================================
  const carregarAlmoxarifados = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Conectar à API de listagem (GET /api/almoxarifado)
      // Exemplo:
      // const resp = await listarAlmoxarifadosCall(baseUrl, token);
      // setAlmoxarifados(resp.data);
      showToast('Dados de almoxarifados atualizados.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar almoxarifados.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Filtro de pesquisa
  const almoxarifadosFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    let lista = almoxarifados;

    if (termo) {
      lista = lista.filter(
        (item) =>
          item.codigoAlmox.toString().includes(termo) ||
          item.enderecoAlmox.toLowerCase().includes(termo) ||
          item.descricaoAlmox.toLowerCase().includes(termo) ||
          item.usuariosAutorizados.some(
            (u) =>
              u.codigoUsuario.toLowerCase().includes(termo) ||
              u.nomeUsuario.toLowerCase().includes(termo)
          )
      );
    }

    return [...lista].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'codigo') {
        comparison = a.codigoAlmox - b.codigoAlmox;
      } else if (sortField === 'descricao') {
        comparison = a.descricaoAlmox.localeCompare(b.descricaoAlmox);
      } else if (sortField === 'endereco') {
        comparison = a.enderecoAlmox.localeCompare(b.enderecoAlmox);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [almoxarifados, search, sortField, sortDirection]);

  // Abrir Modal para Novo Registro
  const handleNovo = () => {
    const proximoCodigo =
      almoxarifados.length > 0
        ? Math.max(...almoxarifados.map((a) => a.codigoAlmox)) + 1
        : 1;

    setCodigoAlmox(proximoCodigo);
    setEnderecoAlmox('');
    setDescricaoAlmox('');
    setUsuariosAutorizados([]);
    setUsuarioSelecionado('');
    setRegistroEdicao(null);
    setIsNovoRegistro(true);
    setIsModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleAbrirEditar = (item: Almoxarifado) => {
    setRegistroEdicao(item);
    setCodigoAlmox(item.codigoAlmox);
    setEnderecoAlmox(item.enderecoAlmox);
    setDescricaoAlmox(item.descricaoAlmox);
    setUsuariosAutorizados([...item.usuariosAutorizados]);
    setUsuarioSelecionado('');
    setIsNovoRegistro(false);
    setIsModalOpen(true);
  };

  // Fechar Modal
  const handleFecharModal = () => {
    setIsModalOpen(false);
    setRegistroEdicao(null);
  };

  // Salvar alterações ou inclusão (Pronto para conectar POST / PUT API)
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!descricaoAlmox.trim()) {
      showToast('A Descrição do Almoxarifado é obrigatória.', 'info');
      return;
    }

    const itemSalvo: Almoxarifado = {
      codigoAlmox: Number(codigoAlmox),
      enderecoAlmox: enderecoAlmox.trim(),
      descricaoAlmox: descricaoAlmox.trim(),
      usuariosAutorizados,
    };

    try {
      if (isNovoRegistro) {
        // TODO: Conectar à API de inclusão (POST /api/almoxarifado)
        // const resp = await incluirAlmoxarifadoCall(baseUrl, token, itemSalvo);
        setAlmoxarifados((prev) => [...prev, itemSalvo]);
        showToast(`Almoxarifado #${itemSalvo.codigoAlmox} cadastrado com sucesso!`, 'success');
      } else {
        // TODO: Conectar à API de alteração (PUT /api/almoxarifado)
        // const resp = await atualizarAlmoxarifadoCall(baseUrl, token, itemSalvo);
        setAlmoxarifados((prev) =>
          prev.map((a) => (a.codigoAlmox === itemSalvo.codigoAlmox ? itemSalvo : a))
        );
        showToast(`Almoxarifado #${itemSalvo.codigoAlmox} atualizado com sucesso!`, 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar almoxarifado.', 'error');
    }
  };

  // Confirmar exclusão (Pronto para conectar DELETE API)
  const handleConfirmarExcluir = (item: Almoxarifado) => {
    setDeleteConfirm(item);
  };

  const handleExcluir = async () => {
    if (!deleteConfirm) return;

    try {
      // TODO: Conectar à API de exclusão (DELETE /api/almoxarifado/{codigo})
      // await deletarAlmoxarifadoCall(baseUrl, token, deleteConfirm.codigoAlmox);
      setAlmoxarifados((prev) =>
        prev.filter((a) => a.codigoAlmox !== deleteConfirm.codigoAlmox)
      );
      showToast(`Almoxarifado #${deleteConfirm.codigoAlmox} removido com sucesso.`, 'success');
      setDeleteConfirm(null);
      if (isModalOpen && registroEdicao?.codigoAlmox === deleteConfirm.codigoAlmox) {
        setIsModalOpen(false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir almoxarifado.', 'error');
    }
  };

  // Adicionar usuário ao subformulário (Almoxarifado_Usuario)
  const handleAdicionarUsuario = () => {
    if (!usuarioSelecionado) return;
    const usrObj = USUARIOS_SISTEMA.find((u) => u.codigo === usuarioSelecionado);
    if (!usrObj) return;

    if (usuariosAutorizados.some((u) => u.codigoUsuario === usrObj.codigo)) {
      showToast('Usuário já está vinculado a este almoxarifado.', 'info');
      return;
    }

    setUsuariosAutorizados((prev) => [
      ...prev,
      { codigoUsuario: usrObj.codigo, nomeUsuario: usrObj.nome },
    ]);
    setUsuarioSelecionado('');
  };

  // Remover usuário do subformulário
  const handleRemoverUsuario = (codigoUsr: string) => {
    setUsuariosAutorizados((prev) =>
      prev.filter((u) => u.codigoUsuario !== codigoUsr)
    );
  };

  const usuarioOptions = useMemo(
    () =>
      USUARIOS_SISTEMA.map((u) => ({
        value: u.codigo,
        label: `${u.codigo} - ${u.nome}`,
      })),
    []
  );

  return (
    <main className="clientes-page list-layout-page almoxarifado-page">
      {/* CABEÇALHO PRINCIPAL */}
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(ROUTES.home)}
            aria-label="Voltar"
          >
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Almoxarifados</h1>
            <p>Gestão de galpões e posições de estocagem.</p>
          </div>
        </div>
      </section>

      {/* PAINEL PRINCIPAL COM FILTROS E DATATABLE */}
      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{almoxarifadosFiltrados.length} encontrados</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Almoxarifados"
              placeholder="Pesquisar código, descrição ou endereço"
              className="clientes-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarAlmoxarifados()}
              aria-label="Atualizar"
              title="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={handleNovo}
              aria-label="Novo almoxarifado"
              title="Novo almoxarifado"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        {/* TABELA DE REGISTROS */}
        {loading ? (
          <p className="module-empty">Carregando almoxarifados...</p>
        ) : almoxarifadosFiltrados.length === 0 ? (
          <p className="module-empty">Nenhum almoxarifado encontrado.</p>
        ) : (
          <>
            <div className="table-scroll clientes-table-wrap">
              <table className="clientes-table">
                <thead>
                  <tr>
                    <th style={{ width: '110px' }}>
                      <button
                        type="button"
                        className="clientes-table__sort"
                        onClick={() => handleSort('codigo')}
                      >
                        CÓDIGO <span>{getSortIndicator('codigo')}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="clientes-table__sort"
                        onClick={() => handleSort('descricao')}
                      >
                        DESCRIÇÃO DO ALMOXARIFADO <span>{getSortIndicator('descricao')}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="clientes-table__sort"
                        onClick={() => handleSort('endereco')}
                      >
                        ENDEREÇO / GALPÃO <span>{getSortIndicator('endereco')}</span>
                      </button>
                    </th>
                    <th style={{ width: '200px' }}>USUÁRIOS AUTORIZADOS</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {almoxarifadosFiltrados.map((item) => (
                    <tr
                      key={item.codigoAlmox}
                      onClick={() => handleAbrirEditar(item)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAbrirEditar(item);
                        }
                      }}
                    >
                      <td>
                        <strong>#{item.codigoAlmox}</strong>
                      </td>
                      <td>{item.descricaoAlmox}</td>
                      <td>
                        <span className="almoxarifado-tag-endereco">
                          <IoLocationOutline size={14} />
                          {item.enderecoAlmox || 'SEM ENDEREÇO'}
                        </span>
                      </td>
                      <td>
                        <span className="almoxarifado-tag-operadores">
                          <IoPeopleOutline size={14} />
                          {item.usuariosAutorizados.length} operador(es)
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => handleAbrirEditar(item)}
                          >
                            <IoCreateOutline size={16} />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            aria-label="Excluir"
                            onClick={() => handleConfirmarExcluir(item)}
                          >
                            <IoTrashOutline size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CARDS RESPONSIVOS PARA MOBILE */}
            <div className="clientes-cards">
              {almoxarifadosFiltrados.map((item) => (
                <article
                  key={`card-${item.codigoAlmox}`}
                  className="clientes-card"
                  onClick={() => handleAbrirEditar(item)}
                  tabIndex={0}
                >
                  <div className="clientes-card__row">
                    <span>CÓDIGO</span>
                    <strong>#{item.codigoAlmox}</strong>
                  </div>
                  <div className="clientes-card__row">
                    <span>DESCRIÇÃO</span>
                    <strong>{item.descricaoAlmox}</strong>
                  </div>
                  <div className="clientes-card__row">
                    <span>ENDEREÇO</span>
                    <strong>{item.enderecoAlmox || '-'}</strong>
                  </div>
                  <div className="clientes-card__row">
                    <span>USUÁRIOS AUTORIZADOS</span>
                    <strong>{item.usuariosAutorizados.length} operador(es)</strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* MODAL DE EDIÇÃO / INCLUSÃO */}
      {isModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide almoxarifado-modal">
            <header className="modal-card__header">
              <h2>{isNovoRegistro ? 'Novo Almoxarifado' : `Almoxarifado #${codigoAlmox}`}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={handleFecharModal}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <form onSubmit={handleSalvar} className="module-form">
              {/* DADOS PRINCIPAIS */}
              <div className="form-grid-3">
                <label>
                  <span>Código</span>
                  <input type="text" value={codigoAlmox} readOnly disabled />
                </label>

                <label style={{ gridColumn: 'span 2' }}>
                  <span>Endereço / Galpão</span>
                  <input
                    type="text"
                    value={enderecoAlmox}
                    onChange={(e) => setEnderecoAlmox(e.target.value)}
                    placeholder="Ex: GALPAO-01-A"
                  />
                </label>

                <label className="form-grid-3__full">
                  <span>Descrição do Almoxarifado *</span>
                  <input
                    type="text"
                    required
                    value={descricaoAlmox}
                    onChange={(e) => setDescricaoAlmox(e.target.value)}
                    placeholder="Ex: Almoxarifado Central - Matéria-Prima"
                  />
                </label>
              </div>

              {/* SUBFORMULÁRIO DE USUÁRIOS (Tabela Almoxarifado_Usuario) */}
              <div className="almoxarifado-subform">
                <div className="almoxarifado-subform__header">
                  <h3>
                    <IoPeopleOutline size={16} />
                    Usuários Autorizados (Almoxarifado_Usuario)
                  </h3>
                </div>

                {/* ADICIONAR NOVO USUÁRIO */}
                <div className="almoxarifado-subform__controls">
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <SearchableSelect
                      options={usuarioOptions}
                      value={usuarioSelecionado}
                      onChange={setUsuarioSelecionado}
                      placeholder="Selecione um usuário do sistema..."
                      searchPlaceholder="Pesquisar código ou nome..."
                      ariaLabel="Usuários do sistema"
                    />
                  </div>

                  <button
                    type="button"
                    className="secondary-button almoxarifado-btn-vincular"
                    onClick={handleAdicionarUsuario}
                    disabled={!usuarioSelecionado}
                  >
                    <IoPersonAddOutline size={16} />
                    Vincular
                  </button>
                </div>

                {/* TABELA DO SUBFORMULÁRIO */}
                <div className="table-scroll almoxarifado-subform__table-wrap">
                  <table className="clientes-table almoxarifado-subform__table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Código Usuário</th>
                        <th>Nome do Usuário</th>
                        <th style={{ width: '70px', textAlign: 'center' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosAutorizados.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              textAlign: 'center',
                              padding: '18px',
                              color: 'var(--color-muted)',
                            }}
                          >
                            Nenhum usuário vinculado a este almoxarifado.
                          </td>
                        </tr>
                      ) : (
                        usuariosAutorizados.map((u) => (
                          <tr key={u.codigoUsuario}>
                            <td>
                              <strong>{u.codigoUsuario}</strong>
                            </td>
                            <td>{u.nomeUsuario}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="icon-button"
                                title="Desvincular Usuário"
                                onClick={() => handleRemoverUsuario(u.codigoUsuario)}
                                style={{ color: 'var(--color-danger)' }}
                              >
                                <IoTrashOutline size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="form-actions clientes-modal-actions">
                {!isNovoRegistro && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleConfirmarExcluir(registroEdicao!)}
                    style={{ color: 'var(--color-danger)', marginRight: 'auto' }}
                  >
                    <IoTrashOutline size={15} style={{ marginRight: '6px' }} />
                    Excluir
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleFecharModal}
                >
                  Cancelar
                </button>

                <button type="submit" className="primary-button">
                  Salvar
                </button>
              </div>
            </form>
          </article>
        </section>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirm && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Confirmar exclusão</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeleteConfirm(null)}
                aria-label="Fechar"
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <section className="module-form">
              <p>
                Tem certeza que deseja excluir o Almoxarifado{' '}
                <strong>#{deleteConfirm.codigoAlmox} - {deleteConfirm.descricaoAlmox}</strong>?
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleExcluir()}
                  style={{
                    backgroundColor: 'var(--color-danger)',
                    borderColor: 'var(--color-danger)',
                    color: '#ffffff',
                  }}
                >
                  Excluir
                </button>
              </div>
            </section>
          </article>
        </section>
      )}
    </main>
  );
}

