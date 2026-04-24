import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoCheckmarkDoneOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { ListSearchField } from '../../../components/ListSearchField';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  healthCheckCall,
  listPedidosCompraCall,
  obterUsuariosTransacoesSistemaAcaoCall,
  pedidoCompraPutCall,
  tokenCall,
} from '../../../services/apiCalls';
import { filterListByTerm } from '../../../utils/filterListByTerm';

type PedidoCompra = {
  numPedido: string;
  dataPedido?: string;
  tipoPedido?: string;
  fornecedor?: string;
  codigoMaterial?: string;
  quantidade?: string;
  condPagto?: string;
  incoterms?: string;
  endereco?: string;
  valorFrete?: string;
  moeda?: string;
  itens: any[];
  itensServico: any[];
  itensAberto: any[];
  raw?: any;
};

type CredenciaisLiberacao = {
  usuario: string;
  senha: string;
};

type SortField = 'pedido' | 'data' | 'tipo' | 'fornecedor';
type SortDirection = 'asc' | 'desc';

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const getFirstFilledValue = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return value;
  }

  return undefined;
};

const resolveItemReferencia = (item: any) => {
  return {
    codigoMaterial: String(
      getFirstFilledValue(item, [
        'codigo_Produto',
        'codigoProduto',
        'cod_Produto',
        'codProduto',
        'cod_Material',
        'codMaterial',
        'material',
        'Material',
        'codigo_Material',
        'codigoMaterial',
        'codigo',
      ]) ?? '',
    ).trim(),
    quantidade: String(
      getFirstFilledValue(item, [
        'quantidade',
        'qtd',
        'qtd_Compra',
        'qtdCompra',
        'quantidadeCompra',
        'qtdSolicitada',
        'qtdEntregar',
        'QtdEntregar',
        'qtd_Entregar',
        'qtsEntregar',
        'QtsEntregar',
        'qts_Entregar',
      ]) ?? '',
    ).trim(),
  };
};

const normalizePedido = (item: any): PedidoCompra => ({
  ...resolveItemReferencia(item),
  numPedido: String(item?.numPedido ?? item?.num_Pedido ?? ''),
  dataPedido: String(item?.dataPedido ?? item?.data_Pedido ?? ''),
  tipoPedido: String(item?.tipoPedido ?? item?.tipo_Pedido ?? ''),
  fornecedor: String(item?.fornecedor ?? item?.nome_Fantasia ?? item?.fornecedorNome ?? ''),
  condPagto: String(item?.condPagto ?? item?.cond_Pagto ?? ''),
  incoterms: String(item?.incoterms ?? ''),
  endereco: String(
    getFirstFilledValue(item, ['endereco', 'Endereco', 'endereco_Entrega', 'enderecoEntrega', 'endereco_Entregar', 'logradouro']) ?? '',
  ),
  valorFrete: String(item?.valorFrete ?? item?.valor_Frete ?? ''),
  moeda: String(item?.moeda ?? ''),
  itens: Array.isArray(item?.itens) ? item.itens : [],
  itensServico: Array.isArray(item?.itensServico) ? item.itensServico : [],
  itensAberto: Array.isArray(item?.itensAberto) ? item.itensAberto : [],
  raw: item,
});

const resolveItens = (pedido: PedidoCompra | null): any[] => {
  if (!pedido) return [];
  if (Array.isArray(pedido.itens) && pedido.itens.length > 0) return pedido.itens;
  if (Array.isArray(pedido.itensServico) && pedido.itensServico.length > 0) return pedido.itensServico;
  if (Array.isArray(pedido.itensAberto) && pedido.itensAberto.length > 0) return pedido.itensAberto;
  if (Array.isArray(pedido.raw?.itensPedido) && pedido.raw.itensPedido.length > 0) return pedido.raw.itensPedido;
  if (Array.isArray(pedido.raw?.itens_Pedido) && pedido.raw.itens_Pedido.length > 0) return pedido.raw.itens_Pedido;
  if (Array.isArray(pedido.raw?.listaItens) && pedido.raw.listaItens.length > 0) return pedido.raw.listaItens;
  if (Array.isArray(pedido.raw?.Itens) && pedido.raw.Itens.length > 0) return pedido.raw.Itens;
  return [];
};

const resolvePedidoMaterialInfo = (pedido: PedidoCompra) => {
  const fromPedido = {
    codigoMaterial: String(pedido.codigoMaterial ?? '').trim(),
    quantidade: String(pedido.quantidade ?? '').trim(),
  };

  if (fromPedido.codigoMaterial || fromPedido.quantidade) {
    return {
      codigoMaterial: fromPedido.codigoMaterial || '-',
      quantidade: fromPedido.quantidade || '-',
    };
  }

  const itens = resolveItens(pedido);
  if (itens.length === 0) {
    return { codigoMaterial: '-', quantidade: '-' };
  }

  const itemRef = resolveItemReferencia(itens[0]);
  return {
    codigoMaterial: itemRef.codigoMaterial || '-',
    quantidade: itemRef.quantidade || '-',
  };
};

const resolveToken = (payload: any): string => {
  return String(payload?.jsonBody?.token ?? payload?.data?.token ?? payload?.data?.Token ?? '').trim();
};

const parseDateForSort = (value: any) => {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return 0;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

export function PedidoCompraLiberacaoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);

  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [estornoConfirmOpen, setEstornoConfirmOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<PedidoCompra | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1024px)').matches;
  });
  const [expandedPedidoCards, setExpandedPedidoCards] = useState<Record<string, boolean>>({});
  const [detalhesHeaderExpanded, setDetalhesHeaderExpanded] = useState(false);
  const [expandedDetalheItens, setExpandedDetalheItens] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('pedido');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [credenciais, setCredenciais] = useState<CredenciaisLiberacao>({
    usuario: '',
    senha: '',
  });
  const [showSenhaLiberacao, setShowSenhaLiberacao] = useState(false);

  const itensSelecionados = useMemo(() => resolveItens(selecionado), [selecionado]);

  const pedidosOrdenados = useMemo(() => {
    const list = [...pedidos];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const pedidoA = Number(a.numPedido || 0);
      const pedidoB = Number(b.numPedido || 0);
      const dataA = String(a.dataPedido || '-');
      const dataB = String(b.dataPedido || '-');
      const tipoA = String(a.tipoPedido || '-');
      const tipoB = String(b.tipoPedido || '-');
      const fornecedorA = String(a.fornecedor || '-');
      const fornecedorB = String(b.fornecedor || '-');

      let comparison = 0;
      if (sortField === 'pedido') comparison = pedidoA - pedidoB;
      if (sortField === 'data') comparison = parseDateForSort(dataA) - parseDateForSort(dataB);
      if (sortField === 'tipo') comparison = collator.compare(tipoA, tipoB);
      if (sortField === 'fornecedor') comparison = collator.compare(fornecedorA, fornecedorB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [pedidos, sortDirection, sortField]);

  const pedidosFiltrados = useMemo(() => filterListByTerm(pedidosOrdenados, searchTerm), [pedidosOrdenados, searchTerm]);

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

  const carregarPedidos = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const resp = await listPedidosCompraCall(
        baseUrl,
        {
          codigoEmpresa,
        },
        token,
      );

      setPedidos(getRows(resp.jsonBody || resp.data).map(normalizePedido));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar pedidos de compra.', 'error');
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarPedidos();
  }, [carregarPedidos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      const isMobile = event ? event.matches : mediaQuery.matches;
      setIsMobileViewport(isMobile);
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const handleAbrirDetalhes = async (pedido: PedidoCompra) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();
    const nivel = GlobalConfig.getNivelUsuario() ?? 0;

    if (!baseUrl || !token || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    if (nivel < 3) {
      try {
        const permissionResp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, '22', '8');
        if (!permissionResp.succeeded) {
          showToast('Você não possui permissão para liberar pedidos de compra.', 'error');
          return;
        }
      } catch (error: any) {
        showToast(error?.message || 'Erro ao verificar permissão de liberação.', 'error');
        return;
      }
    }

    setSelecionado(pedido);
    setDetalhesHeaderExpanded(!isMobileViewport);
    setExpandedDetalheItens({});
    setDetalhesOpen(true);
  };

  const handleEstornar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !usuario || !selecionado?.numPedido) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setEstornoConfirmOpen(false);

    setSaving(true);
    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const resp = await pedidoCompraPutCall(
        baseUrl,
        {
          numPedido: Number(selecionado.numPedido),
          codigoEmpresa,
          tipoAcao: 3,
          tipoPedido: 3,
          usuario: 'null',
          senha: 'null',
        },
        token,
      );

      if (!resp.succeeded) {
        const message = (resp.jsonBody as any)?.message || 'Falha ao estornar liberação do pedido.';
        showToast(String(message), 'error');
        return;
      }

      const message = (resp.jsonBody as any)?.message || 'Liberação estornada com sucesso.';
      showToast(String(message), 'success');
      setDetalhesOpen(false);
      setEstornoConfirmOpen(false);
      setSelecionado(null);
      await carregarPedidos();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao estornar liberação do pedido.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLiberar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const tokenAtual = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    const usuario = credenciais.usuario.trim();
    const senha = credenciais.senha;

    if (!baseUrl || !tokenAtual || !codigoEmpresa || !selecionado?.numPedido) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    if (!usuario || !senha) {
      showToast('Informe usuário e senha para liberar o pedido.', 'error');
      return;
    }

    setSaving(true);
    try {
      await acoesUsuariosCall(baseUrl, tokenAtual, {
        codigoEmpresa,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      const healthResp = await healthCheckCall(baseUrl);
      if (!healthResp.succeeded) {
        showToast('Serviço indisponível para liberação neste momento.', 'error');
        return;
      }

      const tokenResp = await tokenCall(baseUrl, {
        usuario,
        nomeEmpresa: GlobalConfig.getNomeEmpresa() || '',
        codigoEmpresa,
        chaveApi: GlobalConfig.getChaveApi(),
        idGuid: GlobalConfig.getGuidID(),
        tipo: 2,
      });

      if (!tokenResp.succeeded) {
        showToast('Falha ao gerar token para liberar pedido.', 'error');
        return;
      }

      const tokenLiberacao = resolveToken(tokenResp);
      if (tokenLiberacao) {
        GlobalConfig.setJwToken(tokenLiberacao);
      }

      const resp = await pedidoCompraPutCall(
        baseUrl,
        {
          numPedido: Number(selecionado.numPedido),
          codigoEmpresa,
          tipoAcao: 4,
          tipoPedido: 3,
          usuario,
          senha,
        },
        tokenLiberacao || tokenAtual,
      );

      if (!resp.succeeded) {
        const message = (resp.jsonBody as any)?.message || 'Falha ao liberar pedido.';
        showToast(String(message), 'error');
        return;
      }

      const message = (resp.jsonBody as any)?.message || 'Pedido liberado com sucesso.';
      showToast(String(message), 'success');
      setLiberarOpen(false);
      setDetalhesOpen(false);
      setSelecionado(null);
      setCredenciais({ usuario: '', senha: '' });
      await carregarPedidos();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao liberar pedido.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="clientes-page list-layout-page pedido-liberacao-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Pedido de Compra para Liberação</h1>
            <p>Consulta e liberação de pedidos de compra.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel pedido-liberacao-panel">
        <div className="clientes-panel__top list-layout-panel__top pedido-liberacao-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{pedidosFiltrados.length} encontrados</span>
          </div>

          <div className="list-layout-controls pedido-liberacao-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Pedido de Compra para Liberação"
              placeholder="Pesquisar na lista de pedidos"
              className="pedido-liberacao-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarPedidos()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        <section className="module-table list-layout-table pedido-liberacao-table">
          {loading ? (
            <p className="module-empty">Carregando pedidos...</p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="module-empty">Nenhum pedido encontrado.</p>
          ) : (
            <>
              <div className="table-scroll module-table-wrap">
                <table>
              <thead>
                <tr>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('pedido')}>
                      Pedido <span>{getSortIndicator('pedido')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                      Data <span>{getSortIndicator('data')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('tipo')}>
                      Tipo <span>{getSortIndicator('tipo')}</span>
                    </button>
                  </th>
                  <th>
                    <button className="module-table__sort" type="button" onClick={() => handleSort('fornecedor')}>
                      Fornecedor <span>{getSortIndicator('fornecedor')}</span>
                    </button>
                  </th>
                  <th>Código material</th>
                  <th className="module-table__actions-col pedido-liberacao-table__actions-col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((pedido, index) => {
                  const materialInfo = resolvePedidoMaterialInfo(pedido);
                  return (
                    <tr key={`${pedido.numPedido}-${index}`}>
                      <td>{pedido.numPedido || '-'}</td>
                      <td>{pedido.dataPedido || '-'}</td>
                      <td>{pedido.tipoPedido || '-'}</td>
                      <td>{pedido.fornecedor || '-'}</td>
                      <td>{materialInfo.codigoMaterial}</td>
                      <td className="pedido-liberacao-table__action-cell">
                        <button
                          className="icon-button module-action-button module-action-button--primary"
                          type="button"
                          onClick={() => void handleAbrirDetalhes(pedido)}
                          aria-label="Detalhes"
                          title="Detalhes"
                        >
                          <IoCheckmarkDoneOutline size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              </div>

              <div className="module-cards">
                {pedidosFiltrados.map((pedido, index) => {
                  const materialInfo = resolvePedidoMaterialInfo(pedido);
                  const cardKey = `${pedido.numPedido || `idx-${index}`}`;
                  const isExpandedCard = Boolean(expandedPedidoCards[cardKey]);
                  return (
                    <article key={`card-${pedido.numPedido}-${index}`} className="module-card">
                      <div className="module-card__row module-card__row--split">
                        <div className="module-card__row-stack">
                          <span>Pedido</span>
                          <strong>{pedido.numPedido || '-'}</strong>
                        </div>
                        <button
                          type="button"
                          className="module-card__expand-toggle"
                          onClick={() =>
                            setExpandedPedidoCards((prev) => ({
                              ...prev,
                              [cardKey]: !prev[cardKey],
                            }))
                          }
                          aria-label={isExpandedCard ? 'Recolher detalhes do pedido' : 'Expandir detalhes do pedido'}
                          title={isExpandedCard ? 'Recolher detalhes' : 'Expandir detalhes'}
                        >
                          {isExpandedCard ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                        </button>
                      </div>
                      <div className="module-card__row">
                        <span>Data</span>
                        <strong>{pedido.dataPedido || '-'}</strong>
                      </div>

                      {isExpandedCard ? (
                        <>
                          <div className="module-card__row">
                            <span>Tipo</span>
                            <strong>{pedido.tipoPedido || '-'}</strong>
                          </div>
                          <div className="module-card__row">
                            <span>Fornecedor</span>
                            <strong>{pedido.fornecedor || '-'}</strong>
                          </div>
                          <div className="module-card__row">
                            <span>Código material</span>
                            <strong>{materialInfo.codigoMaterial}</strong>
                          </div>
                        </>
                      ) : null}

                      <div className="module-card__actions pedido-liberacao-card-actions">
                        <button
                          type="button"
                          onClick={() => void handleAbrirDetalhes(pedido)}
                          aria-label="Detalhes"
                          title="Detalhes"
                        >
                          <IoCheckmarkDoneOutline size={16} />
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

      {detalhesOpen && selecionado && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide pedido-liberacao-details-modal">
            <header className="modal-card__header">
              <div>
                <h2>Pedido de compra - Detalhes</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar detalhes"
                onClick={() => {
                  if (saving) return;
                  setDetalhesOpen(false);
                  setEstornoConfirmOpen(false);
                  setSelecionado(null);
                  setDetalhesHeaderExpanded(false);
                  setExpandedDetalheItens({});
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="pedido-liberacao-detalhes-head">
              <div className="pedido-liberacao-detalhes-head__top">
                <strong>Dados do pedido</strong>
                {isMobileViewport ? (
                  <button
                    type="button"
                    className="module-card__expand-toggle"
                    onClick={() => setDetalhesHeaderExpanded((prev) => !prev)}
                    aria-label={detalhesHeaderExpanded ? 'Recolher dados do pedido' : 'Expandir dados do pedido'}
                    title={detalhesHeaderExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                  >
                    {detalhesHeaderExpanded ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                  </button>
                ) : null}
              </div>

              <div className="pedido-liberacao-detalhes-grid pedido-liberacao-detalhes-grid--summary">
                <article className="pedido-liberacao-detalhes-item">
                  <span>Pedido</span>
                  <strong>{selecionado.numPedido || '-'}</strong>
                </article>

                <article className="pedido-liberacao-detalhes-item">
                  <span>Data</span>
                  <strong>{selecionado.dataPedido || '-'}</strong>
                </article>

                <article className="pedido-liberacao-detalhes-item">
                  <span>Tipo</span>
                  <strong>{selecionado.tipoPedido || '-'}</strong>
                </article>

                <article className="pedido-liberacao-detalhes-item">
                  <span>Fornecedor</span>
                  <strong>{selecionado.fornecedor || '-'}</strong>
                </article>
              </div>

              {(!isMobileViewport || detalhesHeaderExpanded) ? (
                <div className="pedido-liberacao-detalhes-grid pedido-liberacao-detalhes-grid--extra">
                  <article className="pedido-liberacao-detalhes-item">
                    <span>Condição pagto</span>
                    <strong>{selecionado.condPagto || '-'}</strong>
                  </article>

                  <article className="pedido-liberacao-detalhes-item">
                    <span>Endereço entrega</span>
                    <strong>{selecionado.endereco || '-'}</strong>
                  </article>

                  <article className="pedido-liberacao-detalhes-item">
                    <span>Frete</span>
                    <strong>{selecionado.valorFrete || '-'}</strong>
                  </article>

                  <article className="pedido-liberacao-detalhes-item">
                    <span>Incoterms</span>
                    <strong>{selecionado.incoterms || '-'}</strong>
                  </article>

                  <article className="pedido-liberacao-detalhes-item">
                    <span>Moeda</span>
                    <strong>{selecionado.moeda || '-'}</strong>
                  </article>
                </div>
              ) : null}
            </div>

            <div className="module-items-header">
              <h2>Itens do pedido</h2>
            </div>

            {itensSelecionados.length === 0 ? (
              <p className="module-empty">Nenhum item encontrado.</p>
            ) : (
              <div className="pedido-liberacao-itens-list">
                {itensSelecionados.map((item, index) => {
                  const codigo =
                    item?.material ??
                    item?.Material ??
                    item?.codigo_Produto ??
                    item?.codigoProduto ??
                    item?.cod_Material ??
                    item?.codMaterial ??
                    item?.codigo ??
                    '-';
                  const descricao = item?.descricao_Portug ?? item?.descricaoPortug ?? item?.descricao ?? '-';
                  const quantidade =
                    item?.qtdEntregar ??
                    item?.QtdEntregar ??
                    item?.qtsEntregar ??
                    item?.QtsEntregar ??
                    item?.quantidade ??
                    item?.qtd ??
                    item?.qtd_Compra ??
                    item?.qtdCompra ??
                    '-';
                  const unidade = item?.unidade ?? item?.unidade_Medida ?? '-';
                  const saldo = item?.saldo ?? item?.saldo_Compra ?? '-';
                  const preco = item?.preco ?? item?.valor ?? item?.preco_Unitario ?? '-';
                  const itemKey = `item-${index}-${String(codigo)}-${String(descricao)}`;
                  const isExpandedItem = Boolean(expandedDetalheItens[itemKey]);
                  const showExpandedItem = !isMobileViewport || isExpandedItem;

                  return (
                    <article className="pedido-liberacao-item-card" key={`item-${index}`}>
                      <div className="pedido-liberacao-item-card__top">
                        {itensSelecionados.length > 1 ? <h3>Item {index + 1}</h3> : <h3>Item</h3>}
                        {isMobileViewport ? (
                          <button
                            type="button"
                            className="module-card__expand-toggle"
                            onClick={() =>
                              setExpandedDetalheItens((prev) => ({
                                ...prev,
                                [itemKey]: !prev[itemKey],
                              }))
                            }
                            aria-label={isExpandedItem ? 'Recolher detalhes do item' : 'Expandir detalhes do item'}
                            title={isExpandedItem ? 'Recolher detalhes' : 'Expandir detalhes'}
                          >
                            {isExpandedItem ? <IoChevronDownOutline size={16} /> : <IoChevronForwardOutline size={16} />}
                          </button>
                        ) : null}
                      </div>

                      <div className="pedido-liberacao-item-row">
                        <span>Código</span>
                        <strong>{String(codigo)}</strong>
                      </div>
                      <div className="pedido-liberacao-item-row">
                        <span>Descrição</span>
                        <strong>{String(descricao)}</strong>
                      </div>

                      {showExpandedItem ? (
                        <>
                          <div className="pedido-liberacao-item-row">
                            <span>Quantidade</span>
                            <strong>{String(quantidade)}</strong>
                          </div>
                          <div className="pedido-liberacao-item-row">
                            <span>Unidade</span>
                            <strong>{String(unidade)}</strong>
                          </div>
                          <div className="pedido-liberacao-item-row">
                            <span>Saldo</span>
                            <strong>{String(saldo)}</strong>
                          </div>
                          <div className="pedido-liberacao-item-row">
                            <span>Preço</span>
                            <strong>{String(preco)}</strong>
                          </div>
                        </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="form-actions pedido-liberacao-details-actions">
              <button
                className="secondary-button pedido-liberacao-details-actions__button pedido-liberacao-details-actions__button--estornar"
                type="button"
                onClick={() => setEstornoConfirmOpen(true)}
                disabled={saving}
              >
                {saving ? 'Processando...' : 'Estornar liberação'}
              </button>
              <button
                className="secondary-button pedido-liberacao-details-actions__button"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setDetalhesOpen(false);
                  setEstornoConfirmOpen(false);
                  setSelecionado(null);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="primary-button pedido-liberacao-details-actions__button"
                type="button"
                onClick={() => {
                  setCredenciais({ usuario: '', senha: '' });
                  setShowSenhaLiberacao(false);
                  setLiberarOpen(true);
                }}
                disabled={saving}
              >
                Confirmar
              </button>
            </div>
          </article>
        </section>
      )}

      {estornoConfirmOpen && selecionado && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Confirmar</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar confirmação de estorno"
                onClick={() => {
                  if (saving) return;
                  setEstornoConfirmOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <p className="module-empty">
              Deseja estornar a liberação do pedido <strong>{selecionado.numPedido || '-'}</strong>?
            </p>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEstornoConfirmOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleEstornar()} disabled={saving}>
                {saving ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </article>
        </section>
      )}

      {liberarOpen && selecionado && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Liberar pedido</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setCredenciais({ usuario: '', senha: '' });
                  setShowSenhaLiberacao(false);
                  setLiberarOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <p className="module-empty">Pedido: {selecionado.numPedido || '-'}</p>

            <div className="form-grid-3">
              <label className="form-grid-3__full">
                <span>Usuário</span>
                <div className="login-password-field">
                  <input
                    className="text-field"
                    type="text"
                    name="liberacao_usuario_novo"
                    autoComplete="off"
                    value={credenciais.usuario}
                    onChange={(event) => setCredenciais((prev) => ({ ...prev, usuario: event.target.value }))}
                    placeholder="Usuário"
                  />
                  {credenciais.usuario.trim() ? (
                    <button
                      type="button"
                      className="login-password-toggle"
                      tabIndex={-1}
                      onClick={() => setCredenciais((prev) => ({ ...prev, usuario: '' }))}
                      aria-label="Limpar usuário"
                      title="Limpar"
                    >
                      <IoCloseCircleOutline size={18} />
                    </button>
                  ) : null}
                </div>
              </label>
              <label className="form-grid-3__full">
                <span>Senha</span>
                <div className="login-password-field">
                  <input
                    className="text-field"
                    type={showSenhaLiberacao ? 'text' : 'password'}
                    name="liberacao_senha_nova"
                    autoComplete="new-password"
                    value={credenciais.senha}
                    onChange={(event) => setCredenciais((prev) => ({ ...prev, senha: event.target.value }))}
                    placeholder="Senha"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowSenhaLiberacao((prev) => !prev)}
                    aria-label={showSenhaLiberacao ? 'Ocultar senha' : 'Mostrar senha'}
                    title={showSenhaLiberacao ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showSenhaLiberacao ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
                  </button>
                </div>
              </label>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setCredenciais({ usuario: '', senha: '' });
                  setShowSenhaLiberacao(false);
                  setLiberarOpen(false);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleLiberar()} disabled={saving}>
                {saving ? 'Liberando...' : 'Confirmar'}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
