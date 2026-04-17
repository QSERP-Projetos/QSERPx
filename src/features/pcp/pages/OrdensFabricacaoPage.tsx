import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoCloseCircleOutline, IoFilterOutline, IoRefreshOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { GlobalConfig } from '../../../services/globalConfig';
import { listOrdensFabricacaoCall } from '../../../services/apiCalls';
import { filterListByTerm } from '../../../utils/filterListByTerm';

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.listaOrdensFabricacao)) return payload.listaOrdensFabricacao;
  if (Array.isArray(payload?.ordensFabricacao)) return payload.ordensFabricacao;
  if (Array.isArray(payload?.listaOrdemFabricacao)) return payload.listaOrdemFabricacao;
  return [];
};

const parseNumber = (value: any) => {
  const normalized = String(value ?? '0').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getFirstValue = (row: any, keys: string[]) => {
  const candidates = [row, row?.raw, row?.item, row?.ordem, row?.dados, row?.registro];

  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }

  return undefined;
};

const getTextByKeys = (row: any, keys: string[], fallback = '-') => {
  const value = getFirstValue(row, keys);
  if (value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const getNumberByKeys = (row: any, keys: string[]) => {
  const value = getFirstValue(row, keys);
  return parseNumber(value);
};

const ORDEM_KEYS = ['num_Ordem', 'Num_Ordem', 'numOrdem', 'num_OF', 'Num_OF', 'numero_Ordem', 'Numero_Ordem'];
const PRODUTO_KEYS = ['cod_Produto', 'Cod_Produto', 'codigo_Produto', 'Codigo_Produto', 'codProduto', 'produto', 'Produto'];
const DESCRICAO_KEYS = [
  'descricaoPortug',
  'DescricaoPortug',
  'descricao_Portug',
  'Descricao_Portug',
  'descricao_Item',
  'Descricao_Item',
  'descricao_item',
  'descricao_Produto',
  'Descricao_Produto',
  'desc_Item',
  'Desc_Item',
  'desc_Produto',
  'Desc_Produto',
  'descricao',
  'Descricao',
  'nome_Produto',
  'Nome_Produto',
];
const DATA_KEYS = [
  'data_OrdFab',
  'Data_OrdFab',
  'dt_Ordem',
  'Dt_Ordem',
  'data_Ordem_Fabricacao',
  'Data_Ordem_Fabricacao',
  'data_Ordem',
  'Data_Ordem',
  'data_Emissao',
  'Data_Emissao',
  'emissao',
  'Emissao',
  'data_Inicio',
  'Data_Inicio',
  'data',
  'Data',
];
const QUANTIDADE_KEYS = [
  'qtd_OrdFab',
  'Qtd_OrdFab',
  'qtd_Produzida',
  'Qtd_Produzida',
  'qtd_Apontada',
  'Qtd_Apontada',
  'qtd_Ordem_Fabricacao',
  'Qtd_Ordem_Fabricacao',
  'qtd_Ordem',
  'Qtd_Ordem',
  'qtd_Produzir',
  'Qtd_Produzir',
  'qtdProduzir',
  'QtdProduzir',
  'quantidade_Ordem',
  'Quantidade_Ordem',
  'qtd',
  'Qtd',
  'quantidade',
  'Quantidade',
];
const SITUACAO_KEYS = ['situacao', 'Situacao', 'status', 'Status'];

const formatDateLabel = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '-';

  const shortDateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (shortDateMatch) {
    return `${shortDateMatch[1]}/${shortDateMatch[2]}/20${shortDateMatch[3]}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) {
    return text;
  }

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const parseDateForSort = (value: any) => {
  const raw = String(value ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);

  if (raw) {
    const year = raw[3].length === 2 ? 2000 + Number(raw[3]) : Number(raw[3]);
    const date = new Date(year, Number(raw[2]) - 1, Number(raw[1]));
    if (Number.isFinite(date.getTime())) return date.getTime();
  }

  const parsed = new Date(String(value ?? '').trim());
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
};

type SortField = 'numero' | 'produto' | 'descricao' | 'data' | 'quantidade' | 'situacao';
type SortDirection = 'asc' | 'desc';

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  produto?: string;
};

export function OrdensFabricacaoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [numOrdem, setNumOrdem] = useState('');
  const [produto, setProduto] = useState('');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const numeroA = getNumberByKeys(a, ORDEM_KEYS);
      const numeroB = getNumberByKeys(b, ORDEM_KEYS);
      const produtoA = getTextByKeys(a, PRODUTO_KEYS);
      const produtoB = getTextByKeys(b, PRODUTO_KEYS);
      const descricaoA = getTextByKeys(a, DESCRICAO_KEYS);
      const descricaoB = getTextByKeys(b, DESCRICAO_KEYS);
      const dataA = getTextByKeys(a, DATA_KEYS);
      const dataB = getTextByKeys(b, DATA_KEYS);
      const qtdA = getNumberByKeys(a, QUANTIDADE_KEYS);
      const qtdB = getNumberByKeys(b, QUANTIDADE_KEYS);
      const situacaoA = getTextByKeys(a, SITUACAO_KEYS);
      const situacaoB = getTextByKeys(b, SITUACAO_KEYS);

      let comparison = 0;
      if (sortField === 'numero') comparison = numeroA - numeroB;
      if (sortField === 'produto') comparison = collator.compare(produtoA, produtoB);
      if (sortField === 'descricao') comparison = collator.compare(descricaoA, descricaoB);
      if (sortField === 'data') comparison = parseDateForSort(dataA) - parseDateForSort(dataB);
      if (sortField === 'quantidade') comparison = qtdA - qtdB;
      if (sortField === 'situacao') comparison = collator.compare(situacaoA, situacaoB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

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

  const carregar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const dataInicioFiltro = dataInicio.trim() || formatToday();
    const dataFimFiltro = dataFim.trim() || formatToday();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para consultar Ordens de Fabricação.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listOrdensFabricacaoCall(baseUrl, token, {
        tipo: 1,
        codigoEmpresa,
        numOrdem,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        produto,
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar ordens de fabricação.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numOrdem, produto, showToast]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temProduto = Boolean(produto.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temProduto && !(temDataInicio && temDataFim)) {
      nextErrors.produto = 'Para filtrar por Produto, informe Data início e Data fim.';
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Produto.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Produto.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregar();
  }, [carregar, dataFim, dataInicio, produto]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Ordens de Fabricação</h1>
            <p>Consulta ordens de fabricação.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{rowsFiltradas.length} encontrados</span>
          </div>

          <div className="list-layout-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Ordens de Fabricação"
              placeholder="Pesquisar na lista de ordens"
              className="ordens-fabricacao-search"
            />

            <button
              className={`icon-button module-action-button${filtrosOpen ? ' module-action-button--primary' : ''}`}
              type="button"
              onClick={() => {
                setFiltroErrors({});
                setFiltrosOpen(true);
              }}
              title={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
              aria-label={filtrosOpen ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
            >
              <IoFilterOutline size={16} />
            </button>
            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregar()}
              title="Atualizar"
              aria-label="Atualizar"
              disabled={loading}
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        <AdvancedFiltersPanel
          open={filtrosOpen}
          onClose={() => {
            setFiltroErrors({});
            setFiltrosOpen(false);
          }}
          onApply={handleApplyFiltros}
          applyDisabled={loading}
        >
          <div className="list-layout-extra-filters ordens-fabricacao-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker
                className={filtroErrors.dataInicio ? 'pcp-date-error' : undefined}
                value={dataInicio}
                onChange={(nextDate) => {
                  setDataInicio(nextDate);
                  if (filtroErrors.dataInicio) {
                    setFiltroErrors((prev) => ({ ...prev, dataInicio: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error ordens-fabricacao-field__error-slot${
                  filtroErrors.dataInicio ? '' : ' ordens-fabricacao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>
            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker
                className={filtroErrors.dataFim ? 'pcp-date-error' : undefined}
                value={dataFim}
                onChange={(nextDate) => {
                  setDataFim(nextDate);
                  if (filtroErrors.dataFim) {
                    setFiltroErrors((prev) => ({ ...prev, dataFim: undefined }));
                  }
                }}
              />
              <small
                className={`module-field-error ordens-fabricacao-field__error-slot${
                  filtroErrors.dataFim ? '' : ' ordens-fabricacao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--lg list-layout-field--clearable">
              <span>Produto</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input
                  className={filtroErrors.produto ? 'module-input-error' : ''}
                  value={produto}
                  onChange={(event) => {
                    setProduto(event.target.value);
                    if (filtroErrors.produto) {
                      setFiltroErrors((prev) => ({ ...prev, produto: undefined }));
                    }
                  }}
                  placeholder="Pesquisar código ou descrição"
                />
                {produto.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar produto"
                    title="Limpar"
                    onClick={() => setProduto('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small
                className={`module-field-error ordens-fabricacao-field__error-slot${
                  filtroErrors.produto ? '' : ' ordens-fabricacao-field__error-slot--empty'
                }`}
              >
                {filtroErrors.produto || ' '}
              </small>
            </label>

            <div className="ordens-fabricacao-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número ordem</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input value={numOrdem} onChange={(event) => setNumOrdem(event.target.value)} placeholder="Pesquisar número da ordem" />
                {numOrdem.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da ordem"
                    title="Limpar"
                    onClick={() => setNumOrdem('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small className="module-field-error ordens-fabricacao-field__error-slot ordens-fabricacao-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
        {loading ? (
          <p className="module-empty">Carregando ordens...</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="module-empty">Nenhuma ordem encontrada.</p>
        ) : (
          <>
            <div className="table-scroll module-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('numero')}>
                        Número <span>{getSortIndicator('numero')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('produto')}>
                        Produto <span>{getSortIndicator('produto')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('descricao')}>
                        Descrição <span>{getSortIndicator('descricao')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                        Data <span>{getSortIndicator('data')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('quantidade')}>
                        Quantidade <span>{getSortIndicator('quantidade')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                        Situação <span>{getSortIndicator('situacao')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row, index) => {
                    const numero = getTextByKeys(row, ORDEM_KEYS);
                    const codigoProduto = getTextByKeys(row, PRODUTO_KEYS);
                    const descricao = getTextByKeys(row, DESCRICAO_KEYS);
                    const data = formatDateLabel(getFirstValue(row, DATA_KEYS));
                    const quantidade = getTextByKeys(row, QUANTIDADE_KEYS);
                    const situacao = getTextByKeys(row, SITUACAO_KEYS);

                    return (
                      <tr key={`of-${index}`}>
                        <td>{numero}</td>
                        <td>{codigoProduto}</td>
                        <td>{descricao}</td>
                        <td>{data}</td>
                        <td>{quantidade}</td>
                        <td>{situacao}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="module-cards">
              {rowsFiltradas.map((row, index) => {
                const numero = getTextByKeys(row, ORDEM_KEYS);
                const codigoProduto = getTextByKeys(row, PRODUTO_KEYS);
                const descricao = getTextByKeys(row, DESCRICAO_KEYS);
                const data = formatDateLabel(getFirstValue(row, DATA_KEYS));
                const quantidade = getTextByKeys(row, QUANTIDADE_KEYS);
                const situacao = getTextByKeys(row, SITUACAO_KEYS);

                return (
                  <article className="module-card" key={`card-of-${index}`}>
                    <div className="module-card__row">
                      <span>Número</span>
                      <strong>{numero}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Produto</span>
                      <strong>{codigoProduto}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Descrição</span>
                      <strong>{descricao}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Data</span>
                      <strong>{data}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Quantidade</span>
                      <strong>{quantidade}</strong>
                    </div>
                    <div className="module-card__row">
                      <span>Situação</span>
                      <strong>{situacao}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        </section>
      </section>
    </main>
  );
}
