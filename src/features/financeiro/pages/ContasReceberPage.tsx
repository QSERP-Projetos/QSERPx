import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack,
  IoCloseCircleOutline,
  IoFilterOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { listContasReceberCall, listContasReceberNCCall, obterClientesFornecedoresCall, contasReceberSaldoAbaterCall, listContasReceberAbatimentoCall, abatimentoDocCall } from '../../../services/apiCalls';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { filterListByTerm } from '../../../utils/filterListByTerm';

type ContaReceber = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  data_Prev?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  situacao_Pag?: string | null;
  situacao_Docum?: number | null;
  tipo_Documento?: number | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Bordero_Desc?: string | number | null;
  valor_Abatido?: number | null;
  tipo_Cedente?: string | null;
  codigo_Cedente?: number | string | null;
  num_Nota_Fiscal?: string | number | null;
  ser_Nota_Fiscal?: string | number | null;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
};

type SortField = 'prev' | 'venc' | 'tipoDoc' | 'numero' | 'emissao' | 'valor' | 'sacado' | 'situacao';
type SortDirection = 'asc' | 'desc';
type ActiveTab = 'contas-receber' | 'nota-debito';

type NotaDebito = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  data_Prev?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  situacao_Pag?: string | null;
  situacao_Docum?: number | null;
  tipo_Documento?: number | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Bordero_Desc?: string | number | null;
};

type AbatimentoItem = {
  codigo_Empresa?: number | null;
  num_Lanc?: number | null;
  tipoDoc?: string | null;
  num_Documento?: string | null;
  data_Emissao?: string | null;
  data_Vencimento?: string | null;
  valor_Saldo?: number | null;
  nome_Fantasia?: string | null;
  situacao?: string | null;
  codigo_Portador?: number | null;
  descricao_Lanc?: string | null;
  num_Nota_Fiscal?: string | null;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatFirstDayOfMonth = () => {
  const now = new Date();
  const day = '01';
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatDateDdMmYy = (isoOrBrDate: string | null | undefined): string => {
  if (!isoOrBrDate) return '-';
  const str = String(isoOrBrDate).trim();

  // ISO format: 2026-05-13T00:00:00
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yy = isoMatch[1].slice(2);
    return `${isoMatch[3]}/${isoMatch[2]}/${yy}`;
  }

  // Already dd/mm/yyyy or dd/mm/yy
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (brMatch) {
    const yy = brMatch[3].length === 4 ? brMatch[3].slice(2) : brMatch[3];
    return `${brMatch[1]}/${brMatch[2]}/${yy}`;
  }

  return str;
};

const parseDateForSort = (isoOrBrDate: string | null | undefined): number => {
  if (!isoOrBrDate) return 0;
  const str = String(isoOrBrDate).trim();

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (brMatch) {
    const year = brMatch[3].length === 2 ? 2000 + Number(brMatch[3]) : Number(brMatch[3]);
    const d = new Date(year, Number(brMatch[2]) - 1, Number(brMatch[1]));
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  return 0;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Convert dd/mm/yyyy (DatePicker format) to dd/mm/yy (API format)
const toApiDateFormat = (ddMmYyyy: string): string => {
  const match = String(ddMmYyyy ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return ddMmYyyy;
  return `${match[1]}/${match[2]}/${match[3].slice(2)}`;
};

export function ContasReceberPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<ContaReceber[]>([]);

  const [dataInicio, setDataInicio] = useState(formatFirstDayOfMonth());
  const [dataFim, setDataFim] = useState(formatToday());
  const [numNf, setNumNf] = useState('');
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('venc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const [saldoDebito, setSaldoDebito] = useState<number | null>(null);
  const [saldoAdiantamento, setSaldoAdiantamento] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('contas-receber');
  const [notaDebitoRows, setNotaDebitoRows] = useState<NotaDebito[]>([]);

  const [abatimentoModalOpen, setAbatimentoModalOpen] = useState(false);
  const [abatimentoRegistro, setAbatimentoRegistro] = useState<ContaReceber | null>(null);
  const [abatimentoRows, setAbatimentoRows] = useState<AbatimentoItem[]>([]);
  const [abatimentoLoading, setAbatimentoLoading] = useState(false);
  const [abatimentoSelectedLanc, setAbatimentoSelectedLanc] = useState<number | null>(null);
  const [valorAbater, setValorAbater] = useState('');
  const [abatimentoConfirmOpen, setAbatimentoConfirmOpen] = useState(false);
  const [abatimentoExecutando, setAbatimentoExecutando] = useState(false);

  const [sacadoValue, setSacadoValue] = useState('');
  const [sacadoNome, setSacadoNome] = useState('');
  const [sacadoCodigo, setSacadoCodigo] = useState<string>('');
  const [sacadoTipo, setSacadoTipo] = useState<string>('');
  const [sacadoOptions, setSacadoOptions] = useState<SearchableSelectOption[]>([]);
  const sacadoRawRef = useRef<any[]>([]);
  const sacadoTimerRef = useRef<number | null>(null);

  const initialLoadRef = useRef(false);

  const carregarContas = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listContasReceberCall(baseUrl, token, {
        codigoEmpresa,
        dataInicio: toApiDateFormat(dataInicio),
        dataFim: toApiDateFormat(dataFim),
        numNf: numNf.trim(),
        ...(sacadoCodigo ? { codCedente: sacadoCodigo, tipoCedente: sacadoTipo } : {}),
      });

      if (!resp.succeeded) {
        setRows([]);
        showToast('Não foi possível carregar as contas a receber.', 'error');
        return;
      }

      setRows(getRows(resp.jsonBody || resp.data));
      setSelectedRows(new Set());

      // Busca saldo para abater quando sacado selecionado
      if (sacadoCodigo) {
        try {
          const saldoResp = await contasReceberSaldoAbaterCall(baseUrl, token, {
            codigoEmpresa,
            codigoCedente: sacadoCodigo,
            tipoCedente: sacadoTipo,
          });
          if (saldoResp.succeeded) {
            const body = saldoResp.jsonBody ?? saldoResp.data;
            const saldo = body?.saldoAbater ?? body;
            setSaldoDebito(saldo?.debito ?? null);
            setSaldoAdiantamento(saldo?.adiantamento ?? null);
          } else {
            setSaldoDebito(null);
            setSaldoAdiantamento(null);
          }
        } catch {
          setSaldoDebito(null);
          setSaldoAdiantamento(null);
        }
      } else {
        setSaldoDebito(null);
        setSaldoAdiantamento(null);
      }

      // Busca Notas de Crédito/Débito para a guia Nota de Débito
      try {
        const ncResp = await listContasReceberNCCall(baseUrl, token, {
          codigoEmpresa,
          ...(sacadoCodigo ? { codCedente: sacadoCodigo, tipoCedente: sacadoTipo } : {}),
        });
        if (ncResp.succeeded) {
          setNotaDebitoRows(getRows(ncResp.jsonBody ?? ncResp.data));
        } else {
          setNotaDebitoRows([]);
        }
      } catch {
        setNotaDebitoRows([]);
      }
    } catch (error: any) {
      setRows([]);
      showToast(error?.message || 'Erro ao carregar contas a receber.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numNf, sacadoCodigo, sacadoTipo, showToast]);

  const carregarSacados = useCallback(async (term: string) => {
    const query = term.trim();
    if (query.length < 3) {
      sacadoRawRef.current = [];
      setSacadoOptions([{ value: '', label: 'Digite ao menos 3 letras...' }]);
      return;
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    try {
      const res = await obterClientesFornecedoresCall(baseUrl, token);
      if (!res.succeeded) {
        sacadoRawRef.current = [];
        setSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
        return;
      }
      const body = res.jsonBody ?? res.data;
      const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const queryNorm = normalizeText(query);
      const filtrados = lista.filter((c: any) => {
        const nome = normalizeText(String(c.nome_Fantasia ?? c.razao_Social ?? ''));
        const doc = normalizeText(String(c.num_CGC ?? ''));
        return nome.includes(queryNorm) || doc.includes(queryNorm);
      });
      sacadoRawRef.current = filtrados;
      setSacadoOptions([
        { value: '', label: filtrados.length > 0 ? 'Selecione...' : 'Nenhum encontrado' },
        ...filtrados.map((c: any) => ({
          value: `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}`,
          label: String(c.nome_Fantasia ?? c.razao_Social ?? ''),
        })),
      ]);
    } catch {
      sacadoRawRef.current = [];
      setSacadoOptions([{ value: '', label: 'Erro ao buscar sacados' }]);
    }
  }, []);

  const handleSacadoSearch = useCallback((query: string) => {
    if (sacadoTimerRef.current != null) window.clearTimeout(sacadoTimerRef.current);
    sacadoTimerRef.current = window.setTimeout(() => { void carregarSacados(query); }, 250);
  }, [carregarSacados]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio && !temDataFim) {
      nextErrors.dataFim = 'Informe a Data fim.';
    }
    if (!temDataInicio && temDataFim) {
      nextErrors.dataInicio = 'Informe a Data início.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregarContas();
  }, [carregarContas, dataFim, dataInicio]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregarContas();
  }, [carregarContas]);

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

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'prev') {
        comparison = parseDateForSort(a.data_Prev) - parseDateForSort(b.data_Prev);
      } else if (sortField === 'venc') {
        comparison = parseDateForSort(a.data_Vencimento) - parseDateForSort(b.data_Vencimento);
      } else if (sortField === 'tipoDoc') {
        comparison = collator.compare(String(a.tipoDoc ?? ''), String(b.tipoDoc ?? ''));
      } else if (sortField === 'numero') {
        comparison = collator.compare(String(a.num_Documento ?? ''), String(b.num_Documento ?? ''));
      } else if (sortField === 'emissao') {
        comparison = parseDateForSort(a.data_Emissao) - parseDateForSort(b.data_Emissao);
      } else if (sortField === 'valor') {
        comparison = (a.valor_Saldo ?? 0) - (b.valor_Saldo ?? 0);
      } else if (sortField === 'sacado') {
        comparison = collator.compare(String(a.nome_Fantasia ?? ''), String(b.nome_Fantasia ?? ''));
      } else if (sortField === 'situacao') {
        comparison = collator.compare(String(a.situacao ?? ''), String(b.situacao ?? ''));
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortField, sortDirection]);

  const rowsFiltradas = useMemo(() => {
    let result = filterListByTerm(rowsOrdenadas, searchTerm);
    if (sacadoNome.trim()) {
      const norm = normalizeText(sacadoNome.trim());
      result = result.filter((row) => normalizeText(String(row.nome_Fantasia ?? '')).includes(norm));
    }
    return result;
  }, [rowsOrdenadas, searchTerm, sacadoNome]);

  const totalRegistros = rowsFiltradas.length;

  // Apenas registros visíveis que têm num_Lanc válido
  const allFilteredWithLanc = useMemo(
    () => rowsFiltradas.filter((r): r is ContaReceber & { num_Lanc: number } => r.num_Lanc != null),
    [rowsFiltradas],
  );
  const allSelected =
    allFilteredWithLanc.length > 0 && allFilteredWithLanc.every((r) => selectedRows.has(r.num_Lanc));
  const someSelected = !allSelected && allFilteredWithLanc.some((r) => selectedRows.has(r.num_Lanc));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredWithLanc.forEach((r) => next.delete(r.num_Lanc));
      } else {
        allFilteredWithLanc.forEach((r) => next.add(r.num_Lanc));
      }
      return next;
    });
  }, [allSelected, allFilteredWithLanc]);

  // Lista para envio à API: { CodigoEmpresa, NumLanc, TipoDoc }
  const selectedList = useMemo(() => {
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    return rows
      .filter((row) => row.num_Lanc != null && selectedRows.has(row.num_Lanc))
      .map((row) => ({
        CodigoEmpresa: Number(codigoEmpresa),
        NumLanc: row.num_Lanc as number,
        TipoDoc: row.tipo_Documento ?? 0,
      }));
  }, [rows, selectedRows]);

  // Suprime aviso de variável não usada durante desenvolvimento
  void selectedList;

  const handleAbrirAbatimento = useCallback(async () => {
    if (selectedRows.size == 0) {
      showToast('Selecione ao menos um registro para abatimento!', 'error');
      return;
    }
    if (selectedRows.size !== 1) {
      showToast('Selecione apenas um registro para abatimento!', 'error');
      return;
    }

    const numLanc = Array.from(selectedRows)[0];
    const registro = rows.find((r) => r.num_Lanc === numLanc) ?? null;
    if (!registro) return;

    setAbatimentoRegistro(registro);
    setAbatimentoRows([]);
    setAbatimentoSelectedLanc(null);
    setValorAbater('');
    setAbatimentoModalOpen(true);

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codigoEmpresa) return;

    setAbatimentoLoading(true);
    try {
      const resp = await listContasReceberAbatimentoCall(baseUrl, token, {
        codigoEmpresa,
        codigoCedente: registro.codigo_Cedente ?? '',
        tipoCedente: String(registro.tipo_Cedente ?? ''),
      });
      if (resp.succeeded) {
        const body = resp.jsonBody ?? resp.data;
        const items: AbatimentoItem[] = Array.isArray(body?.abatimento)
          ? body.abatimento
          : getRows(body);
        setAbatimentoRows(items);
      } else {
        setAbatimentoRows([]);
      }
    } catch {
      setAbatimentoRows([]);
    } finally {
      setAbatimentoLoading(false);
    }
  }, [selectedRows, rows, showToast]);

  const handleConfirmarAbatimento = useCallback(() => {
    if (selectedRows.size == 0 || abatimentoSelectedLanc == null) {
      showToast('Selecione ao menos um registro para abatimento!', 'error');
      return;
    }
    if (abatimentoSelectedLanc == null) {
      showToast('Selecione apenas um registro para abatimento!', 'error');
      return;
    }
    const valorStr = valorAbater.trim().replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    if (isNaN(valorNum) || valorNum <= 0) {
      showToast('O valor a abater deve ser maior que zero.', 'error');
      return;
    }
    setAbatimentoConfirmOpen(true);
  }, [abatimentoSelectedLanc, valorAbater, showToast]);

  const handleExecutarAbatimento = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !codigoEmpresa || !abatimentoRegistro || abatimentoSelectedLanc == null) return;

    const valorStr = valorAbater.trim().replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorStr);
    const valorSaldo = abatimentoRegistro.valor_Saldo ?? 0;
    const valorCalculado = valorSaldo - (abatimentoRegistro.valor_Abatido ?? 0);

    setAbatimentoExecutando(true);
    setAbatimentoConfirmOpen(false);
    try {
      const resp = await abatimentoDocCall(baseUrl, token, {
        CodigoEmpresa: Number(codigoEmpresa),
        NumLanc: abatimentoRegistro.num_Lanc as number,
        NumLancAbatimento: abatimentoSelectedLanc,
        ValorAbatimento: valorNum,
        ValorSaldo: valorSaldo,
        ValorCalculado: valorCalculado,
        Usuario: usuario,
      });
      if (resp.succeeded) {
        showToast('Abatimento realizado com sucesso!', 'success');
        setAbatimentoModalOpen(false);
        void carregarContas();
      } else {
        showToast('Erro ao realizar abatimento.', 'error');
      }
    } catch {
      showToast('Erro ao realizar abatimento.', 'error');
    } finally {
      setAbatimentoExecutando(false);
    }
  }, [abatimentoRegistro, abatimentoSelectedLanc, valorAbater, showToast, carregarContas]);

  const toggleSelectRow = (numLanc: number | null | undefined) => {
    if (numLanc == null) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(numLanc)) {
        next.delete(numLanc);
      } else {
        next.add(numLanc);
      }
      return next;
    });
  };

  return (
    <main className="clientes-page list-layout-page contas-receber-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Contas a Receber</h1>
            <p>Consulta de títulos a receber.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel contas-receber-panel">
        <div className="clientes-panel__top list-layout-panel__top contas-receber-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{totalRegistros} encontrados</span>
          </div>

          <div className="list-layout-controls contas-receber-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              mobileLabel="Contas a Receber"
              placeholder="Pesquisar na lista"
              className="contas-receber-search"
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
              onClick={() => void carregarContas()}
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
          <div className="list-layout-extra-filters contas-receber-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
              {filtroErrors.dataInicio ? (
                <small className="module-field-error">{filtroErrors.dataInicio}</small>
              ) : null}
            </label>

            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker value={dataFim} onChange={setDataFim} />
              {filtroErrors.dataFim ? (
                <small className="module-field-error">{filtroErrors.dataFim}</small>
              ) : null}
            </label>

            <label className="list-layout-field list-layout-field--lg">
              <span>Sacado</span>
              <SearchableSelect
                options={sacadoOptions.length > 0 ? sacadoOptions : [{ value: '', label: 'Digite ao menos 3 letras...' }]}
                value={sacadoValue}
                onChange={(v) => {
                  setSacadoValue(v);
                  const found = sacadoRawRef.current.find(
                    (c: any) => `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}` === v,
                  );
                  setSacadoNome(found ? String(found.nome_Fantasia ?? found.razao_Social ?? '') : '');
                  setSacadoCodigo(found ? String(found.codigo ?? '') : '');
                  setSacadoTipo(found ? String(found.tipo ?? '').toUpperCase() : '');
                }}
                enableSearch
                searchPlaceholder="Digite ao menos 3 letras para buscar..."
                placeholder="Todos"
                displayValue={sacadoNome || undefined}
                onSearchInputChange={handleSacadoSearch}
              />
            </label>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Num Nota</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input
                  value={numNf}
                  onChange={(event) => setNumNf(event.target.value)}
                  placeholder="Número da nota"
                />
                {numNf.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar número da nota"
                    title="Limpar"
                    onClick={() => setNumNf('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        </AdvancedFiltersPanel>

        {/* Barra Selecionar todas */}
        <div className={`contas-receber-select-all${activeTab !== 'contas-receber' ? ' contas-receber-select-all--disabled' : ''}`}>
          <label className="contas-receber-select-all__label">
            <span>Selecionar todas:</span>
            <input
              type="checkbox"
              className="contas-receber-select-all__checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              aria-label="Selecionar todas as contas"
              disabled={activeTab !== 'contas-receber'}
            />
          </label>
          {selectedRows.size > 0 && activeTab === 'contas-receber' && (
            <span className="contas-receber-select-all__count">
              {selectedRows.size} selecionado{selectedRows.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Navegação por guias */}
        <div className="contas-receber-tabs">
          <button
            type="button"
            className={`contas-receber-tab${activeTab === 'contas-receber' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setActiveTab('contas-receber')}
          >
            Contas a Receber
          </button>
          <button
            type="button"
            className={`contas-receber-tab${activeTab === 'nota-debito' ? ' contas-receber-tab--active' : ''}`}
            onClick={() => setActiveTab('nota-debito')}
          >
            Notas de Débito
          </button>
        </div>

        {activeTab === 'contas-receber' ? (
          <section className="module-table list-layout-table contas-receber-table">
            {loading ? (
              <p className="module-empty">Carregando contas a receber...</p>
            ) : rowsFiltradas.length === 0 ? (
              <p className="module-empty">Nenhum registro encontrado.</p>
            ) : (
              <>
                <div className="table-scroll module-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('prev')}>
                            Previsão <span>{getSortIndicator('prev')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('venc')}>
                            Venc. <span>{getSortIndicator('venc')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('tipoDoc')}>
                            Tipo Doc. <span>{getSortIndicator('tipoDoc')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('numero')}>
                            Número <span>{getSortIndicator('numero')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('emissao')}>
                            Emissão <span>{getSortIndicator('emissao')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('valor')}>
                            Valor Liq. <span>{getSortIndicator('valor')}</span>
                          </button>
                        </th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('sacado')}>
                            Sacado <span>{getSortIndicator('sacado')}</span>
                          </button>
                        </th>
                        <th>Observação</th>
                        <th>
                          <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                            Sit. <span>{getSortIndicator('situacao')}</span>
                          </button>
                        </th>
                        <th>B.Desc.</th>
                        <th>Sit. Pagto</th>
                        <th>Sel.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsFiltradas.map((row, index) => {
                        const key = row.num_Lanc ?? index;
                        const isSelected = row.num_Lanc != null && selectedRows.has(row.num_Lanc);
                        return (
                          <tr key={key} className={isSelected ? 'module-row-selected' : undefined}>
                            <td>{formatDateDdMmYy(row.data_Prev)}</td>
                            <td>{formatDateDdMmYy(row.data_Vencimento)}</td>
                            <td>{String(row.tipoDoc ?? '-')}</td>
                            <td>{String(row.num_Documento ?? '-')}</td>
                            <td>{formatDateDdMmYy(row.data_Emissao)}</td>
                            <td>{formatCurrency(row.valor_Saldo)}</td>
                            <td>{String(row.nome_Fantasia ?? '-')}</td>
                            <td>{String(row.descricao_Lanc ?? '-')}</td>
                            <td>{String(row.situacao ?? '-')}</td>
                            <td>{row.num_Bordero_Desc != null ? String(row.num_Bordero_Desc) : '-'}</td>
                            <td>{String(row.situacao_Pag ?? '-')}</td>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Selecionar lançamento ${row.num_Lanc ?? index}`}
                                checked={isSelected}
                                onChange={() => toggleSelectRow(row.num_Lanc)}
                                style={{ width: '0.75rem', height: '0.75rem', cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="module-cards">
                  {rowsFiltradas.map((row, index) => {
                    const key = `card-${row.num_Lanc ?? index}`;
                    const isSelected = row.num_Lanc != null && selectedRows.has(row.num_Lanc);
                    return (
                      <article key={key} className={`module-card${isSelected ? ' module-row-selected' : ''}`}>
                        <div className="module-card__row">
                          <span>Sacado</span>
                          <strong>{String(row.nome_Fantasia ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Número</span>
                          <strong>{String(row.num_Documento ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Tipo Doc.</span>
                          <strong>{String(row.tipoDoc ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Venc.</span>
                          <strong>{formatDateDdMmYy(row.data_Vencimento)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Previsão</span>
                          <strong>{formatDateDdMmYy(row.data_Prev)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Emissão</span>
                          <strong>{formatDateDdMmYy(row.data_Emissao)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Valor Liq.</span>
                          <strong>{formatCurrency(row.valor_Saldo)}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sit.</span>
                          <strong>{String(row.situacao ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sit. Pagto</span>
                          <strong>{String(row.situacao_Pag ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>B.Desc.</span>
                          <strong>{row.num_Bordero_Desc != null ? String(row.num_Bordero_Desc) : '-'}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Observação</span>
                          <strong>{String(row.descricao_Lanc ?? '-')}</strong>
                        </div>
                        <div className="module-card__row">
                          <span>Sel.</span>
                          <strong>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar lançamento ${row.num_Lanc ?? index}`}
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.num_Lanc)}
                              style={{ width: '0.75rem', height: '0.75rem', cursor: 'pointer' }}
                            />
                          </strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="module-table list-layout-table contas-receber-table">
            {notaDebitoRows.length === 0 ? (
              <p className="module-empty">Nenhum registro encontrado.</p>
            ) : (
              <div className="table-scroll module-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Venc.</th>
                      <th>Número</th>
                      <th>Emissão</th>
                      <th>Valor Liq.</th>
                      <th>Sacado</th>
                      <th>Observação</th>
                      <th>Sit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notaDebitoRows.map((row, index) => (
                      <tr key={row.num_Lanc ?? index}>
                        <td>{formatDateDdMmYy(row.data_Vencimento)}</td>
                        <td>{String(row.num_Documento ?? '-')}</td>
                        <td>{formatDateDdMmYy(row.data_Emissao)}</td>
                        <td>{formatCurrency(row.valor_Saldo)}</td>
                        <td>{String(row.nome_Fantasia ?? '-')}</td>
                        <td>{String(row.descricao_Lanc ?? '-')}</td>
                        <td>{String(row.situacao ?? '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Rodapé de ações */}
        <footer className="contas-receber-footer">

          {/* Container com borda: Saldo para abater */}
          <fieldset className="contas-receber-footer__saldo-box">
            <legend className="contas-receber-footer__saldo-legend">Saldo para abater:</legend>

            <div className="contas-receber-footer__saldo-inner">
              <div className="contas-receber-footer__saldo-grid">
                <span className="contas-receber-footer__saldo-label-text">Nota de débito:</span>
                <input type="text" readOnly className="contas-receber-footer__input contas-receber-footer__input--saldo" value={saldoDebito != null ? formatCurrency(saldoDebito) : ''} />
                <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--saldo" onClick={() => void handleAbrirAbatimento()}>Abater</button>

                <span className="contas-receber-footer__saldo-label-text">Adiantamento:</span>
                <input type="text" readOnly className="contas-receber-footer__input contas-receber-footer__input--saldo" value={saldoAdiantamento != null ? formatCurrency(saldoAdiantamento) : ''} />
                <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--saldo">Estornar</button>
              </div>

              <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--adiant">
                Adiantamentos<br />recebidos
              </button>
            </div>
          </fieldset>

          {/* Data da baixa em lote */}
          <fieldset className="contas-receber-footer__saldo-box">
            <label className="contas-receber-footer__field contas-receber-footer__field--stack">
              <span>Data da baixa em lote:</span>
              <input type="text" className="contas-receber-footer__input" />
            </label>
          </fieldset>

          {/* Botões de ação */}
          <div className="contas-receber-footer__actions">
            <div className="contas-receber-footer__actions-row">
              <button type="button" className="secondary-button contas-receber-footer__btn">Baixar</button>
              <button type="button" className="secondary-button contas-receber-footer__btn">Alterar</button>
              <button type="button" className="secondary-button contas-receber-footer__btn">Cancelar</button>
            </div>
            <div className="contas-receber-footer__actions-row">
              <button type="button" className="secondary-button contas-receber-footer__btn">Imprimir</button>
              <button type="button" className="secondary-button contas-receber-footer__btn contas-receber-footer__btn--wide">Remessa de cobrança</button>
            </div>
          </div>
        </footer>
      </section>

      {/* Modal de Abatimento */}
      {abatimentoConfirmOpen && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true" aria-label="Confirmar abatimento">
          <article className="modal-card" style={{ width: 'min(400px, 92vw)', gap: 20 }}>
            <header className="modal-card__header">
              <h2>Confirmar Abatimento</h2>
            </header>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Deseja realmente abater esse documento?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => setAbatimentoConfirmOpen(false)}
              >
                Não
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto', minWidth: 80 }}
                onClick={() => void handleExecutarAbatimento()}
              >
                Sim
              </button>
            </div>
          </article>
        </section>
      )}

      {abatimentoModalOpen && abatimentoRegistro && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Abatimento">
          <article className="modal-card modal-card--abatimento">
            <header className="modal-card__header">
              <h2>Abatimento</h2>
            </header>

            {/* Cabeçalho com dados do título */}
            <div className="abatimento-info">
              <div className="abatimento-info__left">
                {/* Linha 1: Sacado ocupa toda a largura */}
                <div className="abatimento-field-row">
                  <span className="abatimento-field-row__label">Sacado:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--wide" readOnly value={String(abatimentoRegistro.nome_Fantasia ?? '')} />
                </div>
                {/* Linhas 2-3: grade com colunas fixas para alinhar Emissão x Vencimento */}
                <div className="abatimento-info__grid">
                  <span className="abatimento-field-row__label">Nota Fiscal:</span>
                  <div className="abatimento-field-row__nf-group">
                    <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(abatimentoRegistro.num_Nota_Fiscal ?? '')} />
                    <span className="abatimento-field-row__sep">/</span>
                    <input className="abatimento-field-row__input abatimento-field-row__input--xs" readOnly value={String(abatimentoRegistro.ser_Nota_Fiscal ?? '')} />
                  </div>
                  <span className="abatimento-field-row__label">Emissão:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(abatimentoRegistro.data_Emissao)} />

                  <span className="abatimento-field-row__label">Num. doc.:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--sm" readOnly value={String(abatimentoRegistro.num_Documento ?? '')} />
                  <span className="abatimento-field-row__label">Vencimento:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--date" readOnly value={formatDateDdMmYy(abatimentoRegistro.data_Vencimento)} />
                </div>
              </div>

              <div className="abatimento-info__right">
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor documento:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={abatimentoRegistro.valor_Saldo != null
                      ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(abatimentoRegistro.valor_Saldo)
                      : ''}
                  />
                </div>
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor abatido:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(abatimentoRegistro.valor_Abatido ?? 0)}
                  />
                </div>
                <div className="abatimento-valor-row">
                  <span className="abatimento-valor-row__label">Valor receber:</span>
                  <input className="abatimento-field-row__input abatimento-field-row__input--valor" readOnly
                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(
                      (abatimentoRegistro.valor_Saldo ?? 0) - (abatimentoRegistro.valor_Abatido ?? 0)
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Tabela de itens disponíveis para abatimento */}
            <div className="abatimento-table-wrap">
              {abatimentoLoading ? (
                <p className="module-empty">Carregando...</p>
              ) : (
                <table className="abatimento-table">
                  <thead>
                    <tr>
                      <th>Vencto</th>
                      <th>Docum.</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Sacado</th>
                      <th>Observação</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {abatimentoRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>Nenhum item encontrado.</td></tr>
                    ) : abatimentoRows.map((item, idx) => (
                      <tr
                        key={item.num_Lanc ?? idx}
                        className={abatimentoSelectedLanc === item.num_Lanc ? 'module-row-selected' : undefined}
                        onClick={() => setAbatimentoSelectedLanc((prev) => prev === item.num_Lanc ? null : (item.num_Lanc ?? null))}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDateDdMmYy(item.data_Vencimento)}</td>
                        <td>{String(item.num_Documento ?? '-')}</td>
                        <td>{String(item.tipoDoc ?? '-')}</td>
                        <td>{formatCurrency(item.valor_Saldo)}</td>
                        <td>{String(item.nome_Fantasia ?? '-')}</td>
                        <td>{String(item.descricao_Lanc ?? '-')}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={abatimentoSelectedLanc === item.num_Lanc}
                            onChange={() => setAbatimentoSelectedLanc((prev) => prev === item.num_Lanc ? null : (item.num_Lanc ?? null))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Selecionar ${item.num_Documento}`}
                            style={{ width: '0.75rem', height: '0.75rem', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé */}
            <div className="abatimento-footer">
              <div className="abatimento-footer__left">
                <input
                  type="text"
                  className="abatimento-field-row__input abatimento-field-row__input--valor"
                  value={valorAbater}
                  onChange={(e) => setValorAbater(e.target.value)}
                  placeholder="0,00"
                  aria-label="Valor a abater"
                />
                <button type="button" className="secondary-button" onClick={handleConfirmarAbatimento} disabled={abatimentoExecutando}>
                  Abater
                </button>
              </div>
              <button type="button" className="secondary-button abatimento-footer__fechar" onClick={() => setAbatimentoModalOpen(false)}>
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
