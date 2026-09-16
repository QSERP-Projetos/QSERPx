import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  alterarParadaMaquinaCronometroCall,
  buscaOFCall,
  incluirParadaMaquinaCronometroCall,
  incluirParadaMaquinaPadraoCall,
  listMotivoParadaMaquinaCall,
  listParadasMaquinaCall,
  listaMaquinasCall,
} from '../../../services/apiCalls';
import { filterListByTerm } from '../../../utils/filterListByTerm';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

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
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.Content)) return payload.Content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.Items)) return payload.Items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.Rows)) return payload.Rows;
  if (Array.isArray(payload?.lista)) return payload.lista;
  if (Array.isArray(payload?.Lista)) return payload.Lista;
  if (Array.isArray(payload?.retorno)) return payload.retorno;
  if (Array.isArray(payload?.Retorno)) return payload.Retorno;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  if (Array.isArray(payload?.Resultado)) return payload.Resultado;

  if (payload && typeof payload === 'object') {
    const hasMotivoShape =
      getFirstFilledValue(payload, [
        'codigo_Motivo',
        'Codigo_Motivo',
        'codigo_motivo',
        'codigoMotivo',
        'CodigoMotivo',
        'cod_Motivo',
        'codMotivo',
        'codigo',
      ]) != null;

    if (hasMotivoShape) return [payload];
  }

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

type SortField = 'ordem' | 'maquina';
type SortDirection = 'asc' | 'desc';
type SelectOption = { value: string; label: string };
type FormErrors = {
  numOrdem?: string;
  codigoMotivo?: string;
};
type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  numMaquina?: string;
};

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
  if (!Number.isFinite(parsed.getTime())) return text;

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const splitDateTimeValue = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return { date: '', time: '' };

  const match = text.match(/^(\d{2}\/\d{2}\/\d{2,4})(?:\s+(\d{2}:\d{2})(?::\d{2})?)?$/);
  if (!match) {
    return { date: formatDateLabel(text), time: '' };
  }

  return {
    date: formatDateLabel(match[1]),
    time: match[2] || '',
  };
};

const resolveParadaListRow = (row: any) => {
  const inicioDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraInicApont', 'dataHora_InicApont']));
  const fimDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraFimApont', 'dataHora_FimApont']));

  return {
    ordem: String(row?.num_Ordem ?? row?.Num_Ordem ?? '-'),
    maquina: String(row?.num_Maquina ?? row?.Num_Maquina ?? '-'),
    motivo: String(getFirstFilledValue(row, ['motivo_Parada', 'Motivo_Parada', 'descricao_Motivo', 'Descricao_Motivo']) ?? '-'),
    inicioData: inicioDataHora.date || formatDateLabel(getFirstFilledValue(row, ['data_Inicio', 'Data_Inicio', 'data_Apont', 'Data_Apont'])),
    inicioHora: inicioDataHora.time || String(getFirstFilledValue(row, ['hora_Inicio', 'Hora_Inicio']) ?? '').trim(),
    fimData: fimDataHora.date || formatDateLabel(getFirstFilledValue(row, ['data_Fim', 'Data_Fim'])),
    fimHora: fimDataHora.time || String(getFirstFilledValue(row, ['hora_Fim', 'Hora_Fim']) ?? '').trim(),
  };
};

const normalizeTipoApontamento = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isCronometroTipo = (value?: string) => {
  const normalized = normalizeTipoApontamento(value);
  return normalized === 'apontamento cronometro' || normalized === 'apontamento por cronometro';
};

// Origem_Parada = 7 identifica uma parada de máquina registrada por cronômetro.
const isParadaCronometroTipo = (row: any) =>
  String(
    getFirstFilledValue(row, ['origem_Parada', 'Origem_Parada', 'origemParada', 'origem_Apont', 'Origem_Apont', 'origemApont']) ?? '',
  ).trim() === '7';

// Cronômetro ainda em aberto: sem data/hora fim, pendente de finalização.
const isParadaCronometroAberta = (row: any) => {
  if (!isParadaCronometroTipo(row)) return false;
  const { fimData, fimHora } = resolveParadaListRow(row);
  return !fimHora.trim() && (fimData === '-' || !fimData.trim());
};

type CronometroStatus = 'pendente' | 'concluido' | null;

const getParadaCronometroStatus = (row: any): CronometroStatus => {
  if (!isParadaCronometroTipo(row)) return null;
  return isParadaCronometroAberta(row) ? 'pendente' : 'concluido';
};

export function ParadasMaquinaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<any[]>([]);
  const [maquinas, setMaquinas] = useState<SelectOption[]>([]);

  const [numOrdem, setNumOrdem] = useState('');
  const [numMaquina, setNumMaquina] = useState('');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('ordem');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    numOrdem: '',
    numMaquina: '',
    dataInicio: formatToday(),
    horaInicio: '',
    dataFim: formatToday(),
    horaFim: '',
    codigoMotivo: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [semOF, setSemOF] = useState(false);
  const [codigoProduto, setCodigoProduto] = useState('');
  const [descricaoPortugues, setDescricaoPortugues] = useState('');

  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [finalizarRow, setFinalizarRow] = useState<any | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const paradaCronometro = isCronometroTipo(GlobalConfig.getTipoParadaMaquina());

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const rowA = resolveParadaListRow(a);
      const rowB = resolveParadaListRow(b);
      const ordemA = Number(rowA.ordem || 0);
      const ordemB = Number(rowB.ordem || 0);
      const maquinaA = rowA.maquina;
      const maquinaB = rowB.maquina;

      let comparison = 0;
      if (sortField === 'ordem') comparison = ordemA - ordemB;
      if (sortField === 'maquina') comparison = collator.compare(maquinaA, maquinaB);

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

  const motivoOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'Selecione' },
      ...motivos
        .map((motivo) => {
          const value = String(
            getFirstFilledValue(motivo, [
              'codigo_Parada',
              'Codigo_Parada',
              'codigo_Motivo',
              'Codigo_Motivo',
              'codigo_motivo',
              'codigoMotivo',
              'CodigoMotivo',
              'cod_Motivo',
              'codMotivo',
              'codigo',
              'Codigo',
              'id',
              'ID',
            ]) ?? '',
          ).trim();

          const labelText = String(
            getFirstFilledValue(motivo, [
              'codMotivoParada',
              'motivo_Parada',
              'Motivo_Parada',
              'descricao_Motivo',
              'Descricao_Motivo',
              'descricao_motivo',
              'descricaoMotivo',
              'DescricaoMotivo',
              'descricao',
              'Descricao',
              'desc_Motivo',
              'desc_motivo',
              'descMotivo',
              'nome',
              'Nome',
            ]) ?? value,
          ).trim();

          // se o label já contém o código (ex: "1 - TROCA DE MOLDE"), usa direto
          const startsWithValue = labelText.startsWith(`${value} -`) || labelText.startsWith(`${value}-`);
          return {
            value,
            label: startsWithValue ? labelText : labelText ? `${value} - ${labelText}` : value,
          };
        })
        .filter((option) => option.value.length > 0),
    ];
  }, [motivos]);

  const maquinaOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'Selecione' },
      ...maquinas,
    ];
  }, [maquinas]);

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

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para consultar paradas de máquina.', 'error');
      return;
    }

    setLoading(true);
    try {
      const [paradasResp, motivosResp, maqResp] = await Promise.all([
        listParadasMaquinaCall(baseUrl, token, {
          codigoEmpresa,
          numOrdem,
          dataInicio,
          dataFim,
          numMaquina,
          usuario: GlobalConfig.getUsuario(),
          origem: undefined,
        }),
        listMotivoParadaMaquinaCall(baseUrl, token, { codigoEmpresa }),
        listaMaquinasCall(baseUrl, token),
      ]);

      setRows(getRows(paradasResp.jsonBody || paradasResp.data));

      const motivosPayload = motivosResp.jsonBody || motivosResp.data;
      const motivosRows = getRows(motivosPayload);
      setMotivos(motivosRows);

      if (!motivosResp.succeeded) {
        showToast(getApiErrorMessage(motivosResp, 'Falha ao carregar motivos de parada.'), 'error');
      }

      setMaquinas(
        getRows(maqResp.jsonBody || maqResp.data)
          .map((row) => {
            const value = String(row?.num_Ident ?? row?.num_ident ?? row?.num_Maquina ?? row?.num_maquina ?? '').trim();
            const descricao = String(row?.desc_Maquinas ?? row?.desc_maquinas ?? row?.descricao ?? row?.descricao_Maquina ?? '').trim();

            if (!value) return null;
            return {
              value,
              label: descricao ? `${value} - ${descricao}` : value,
            };
          })
          .filter((item): item is SelectOption => Boolean(item)),
      );
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar paradas de máquina.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataFim, dataInicio, numMaquina, numOrdem, showToast]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temMaquina = Boolean(numMaquina.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temMaquina && !(temDataInicio && temDataFim)) {
      nextErrors.numMaquina = 'Para filtrar por Máquina, informe Data início e Data fim.';
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Máquina.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Máquina.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregar();
  }, [carregar, dataFim, dataInicio, numMaquina]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  const handleBlurOF = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const ordem = form.numOrdem.trim();

    if (!baseUrl || !token || !codigoEmpresa || !ordem || semOF) return;

    try {
      const resp = await buscaOFCall(baseUrl, token, codigoEmpresa, ordem);

      if (!resp.succeeded) {
        setCodigoProduto('');
        setDescricaoPortugues('');
        showToast(getApiErrorMessage(resp, 'OF inválida.'), 'error');
        return;
      }

      const list = getRows(resp.jsonBody || resp.data);
      const data = list[0] ?? resp.jsonBody ?? resp.data;

      const produto = String(
        getFirstFilledValue(data, ['codigoProduto', 'codigo_produto', 'codigo_Produto', 'codigo_Prod']) ?? '',
      ).trim();
      const descricao = String(
        getFirstFilledValue(data, [
          'descricaoPortug',
          'descricao_portug',
          'descricao_Portug',
          'descricao_Produto',
          'descricao_produto',
          'descricao_Item',
        ]) ?? '',
      ).trim();

      setCodigoProduto(produto);
      setDescricaoPortugues(descricao);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar OF.', 'error');
    }
  }, [form.numOrdem, semOF, showToast]);

  const handleSalvar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para inclusão de parada.', 'error');
      return;
    }

    const nextErrors: FormErrors = {};
    if (!semOF && !form.numOrdem.trim()) {
      nextErrors.numOrdem = 'Número da OF é obrigatório.';
    }

    if (!form.codigoMotivo) {
      nextErrors.codigoMotivo = 'Motivo é obrigatório.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const resp = paradaCronometro
        ? await incluirParadaMaquinaCronometroCall(baseUrl, token, {
          codigoEmpresa,
          numOrdem: semOF ? 0 : Number(form.numOrdem) || 0,
          numMaquina: form.numMaquina,
          codigoMotivo: form.codigoMotivo,
          usuario: GlobalConfig.getUsuario(),
        })
        : await incluirParadaMaquinaPadraoCall(baseUrl, token, {
          codigoEmpresa,
          numOrdem: semOF ? 0 : Number(form.numOrdem) || 0,
          numMaquina: form.numMaquina,
          dataInicio: form.dataInicio,
          horaInicio: form.horaInicio,
          dataFim: form.dataFim,
          horaFim: form.horaFim,
          codigoMotivo: form.codigoMotivo,
          usuario: GlobalConfig.getUsuario(),
        });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Falha ao incluir parada de máquina.'), 'error');
        return;
      }

      showToast('Parada de máquina incluída com sucesso.', 'success');
      setModalOpen(false);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir parada de máquina.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [detalheOpen, setDetalheOpen] = useState(false);
  const [detalheRow, setDetalheRow] = useState<any | null>(null);

  const abrirConsulta = (row: any) => {
    setDetalheRow(row);
    setDetalheOpen(true);
  };

  const abrirFinalizarCronometro = (row: any) => {
    setFinalizarRow(row);
    setFinalizarOpen(true);
  };

  const handleFinalizarCronometroParada = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa || !finalizarRow) {
      showToast('Sessão inválida para finalizar parada.', 'error');
      return;
    }

    const numOrdem = String(getFirstFilledValue(finalizarRow, ['num_Ordem', 'Num_Ordem', 'numOrdem']) ?? '').trim();

    setFinalizando(true);
    try {
      const resp = await alterarParadaMaquinaCronometroCall(baseUrl, token, {
        codigoEmpresa,
        numOrdem,
        usuario: GlobalConfig.getUsuario(),
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Falha ao finalizar parada de máquina.'), 'error');
        return;
      }

      showToast('Parada de máquina cronômetro finalizada com sucesso.', 'success');
      setFinalizarOpen(false);
      setFinalizarRow(null);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao finalizar parada de máquina.', 'error');
    } finally {
      setFinalizando(false);
    }
  };

  const finalizarAtual = useMemo(() => (finalizarRow ? resolveParadaListRow(finalizarRow) : null), [finalizarRow]);
  const detalheAtual = useMemo(() => (detalheRow ? resolveParadaListRow(detalheRow) : null), [detalheRow]);

  return (
    <main className="clientes-page list-layout-page paradas-maquina-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Paradas de Máquina</h1>
            <p>Consulta e inclusão de paradas de máquinas.</p>
            <p className="apontamento-producao-subtitle">Modo configurado: {paradaCronometro ? 'Cronômetro' : 'Normal'}</p>
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
              mobileLabel="Paradas de Máquina"
              placeholder="Pesquisar na lista de paradas"
              className="paradas-maquina-search"
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
            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => {
                setForm({
                  numOrdem: '',
                  numMaquina: '',
                  dataInicio: formatToday(),
                  horaInicio: '',
                  dataFim: formatToday(),
                  horaFim: '',
                  codigoMotivo: '',
                });
                setFormErrors({});
                setSemOF(false);
                setCodigoProduto('');
                setDescricaoPortugues('');
                setModalOpen(true);
              }}
              title="Incluir"
              aria-label="Incluir"
              disabled={loading}
            >
              <IoAddOutline size={16} />
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
          <div className="list-layout-extra-filters paradas-maquina-extra-filters">
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
                className={`module-field-error paradas-maquina-field__error-slot${filtroErrors.dataInicio ? '' : ' paradas-maquina-field__error-slot--empty'
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
                className={`module-field-error paradas-maquina-field__error-slot${filtroErrors.dataFim ? '' : ' paradas-maquina-field__error-slot--empty'
                  }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="list-layout-field list-layout-field--md">
              <span>Máquina</span>
              <SearchableSelect
                value={numMaquina}
                onChange={(nextValue) => {
                  setNumMaquina(nextValue);
                  if (filtroErrors.numMaquina) {
                    setFiltroErrors((prev) => ({ ...prev, numMaquina: undefined }));
                  }
                }}
                options={maquinaOptions}
                ariaLabel="Máquina"
                searchPlaceholder="Pesquisar máquina"
                className={filtroErrors.numMaquina ? 'is-error' : undefined}
              />
              <small
                className={`module-field-error paradas-maquina-field__error-slot${filtroErrors.numMaquina ? '' : ' paradas-maquina-field__error-slot--empty'
                  }`}
              >
                {filtroErrors.numMaquina || ' '}
              </small>
            </label>

            <div className="paradas-maquina-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número ordem</span>
              <div className="paradas-maquina-field__input-wrap">
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
              <small className="module-field-error paradas-maquina-field__error-slot paradas-maquina-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
          {loading ? (
            <p className="module-empty">Carregando paradas...</p>
          ) : rowsFiltradas.length === 0 ? (
            <p className="module-empty">Nenhuma parada encontrada.</p>
          ) : (
            <>
              <div className="table-scroll module-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="paradas-maquina-status-col">Status</th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('ordem')}>
                          Ordem <span>{getSortIndicator('ordem')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('maquina')}>
                          Máquina <span>{getSortIndicator('maquina')}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsFiltradas.map((row, index) => {
                      const current = resolveParadaListRow(row);
                      const cronometroAberta = isParadaCronometroAberta(row);
                      const cronometroStatus = getParadaCronometroStatus(row);

                      return (
                        <tr
                          key={`pm-${index}`}
                          className={`module-row-clickable${cronometroAberta ? ' paradas-maquina-row--cronometro' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => (cronometroAberta ? abrirFinalizarCronometro(row) : abrirConsulta(row))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (cronometroAberta) {
                                abrirFinalizarCronometro(row);
                              } else {
                                abrirConsulta(row);
                              }
                            }
                          }}
                        >
                          <td className="paradas-maquina-status-col">
                            {cronometroStatus ? (
                              <IoTimeOutline
                                size={18}
                                className={`paradas-maquina-status-icon paradas-maquina-status-icon--${cronometroStatus}`}
                                title={
                                  cronometroStatus === 'pendente'
                                    ? 'Parada cronômetro pendente de finalização'
                                    : 'Parada cronômetro concluída'
                                }
                              />
                            ) : null}
                          </td>
                          <td>{current.ordem}</td>
                          <td>{current.maquina}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="module-cards">
                {rowsFiltradas.map((row, index) => {
                  const current = resolveParadaListRow(row);
                  const cronometroAberta = isParadaCronometroAberta(row);
                  const cronometroStatus = getParadaCronometroStatus(row);

                  return (
                    <article
                      className={`module-card module-row-clickable${cronometroAberta ? ' paradas-maquina-row--cronometro' : ''}`}
                      key={`card-pm-${index}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => (cronometroAberta ? abrirFinalizarCronometro(row) : abrirConsulta(row))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (cronometroAberta) {
                            abrirFinalizarCronometro(row);
                          } else {
                            abrirConsulta(row);
                          }
                        }
                      }}
                    >
                      <div className="module-card__row module-card__row--split">
                        <div className="module-card__row-stack">
                          <span>Ordem</span>
                          <strong>{current.ordem}</strong>
                        </div>
                        {cronometroStatus ? (
                          <IoTimeOutline
                            size={18}
                            className={`paradas-maquina-status-icon paradas-maquina-status-icon--${cronometroStatus}`}
                            title={
                              cronometroStatus === 'pendente'
                                ? 'Parada cronômetro pendente de finalização'
                                : 'Parada cronômetro concluída'
                            }
                          />
                        ) : null}
                      </div>
                      <div className="module-card__row">
                        <span>Máquina</span>
                        <strong>{current.maquina}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </section>

      {modalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide paradas-maquina-modal">
            <header className="modal-card__header">
              <h2>Nova parada de máquina ({paradaCronometro ? 'Cronômetro' : 'Normal'})</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setModalOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <div className="form-grid-3__full paradas-maquina-modal__of-row">
                <label className="paradas-maquina-modal__of-field">
                  <span>Número da OF</span>
                  <div className="pcp-modal-field pcp-modal-field--clearable">
                    <input
                      className={formErrors.numOrdem ? 'module-input-error' : ''}
                      value={semOF ? 'SEM OF' : form.numOrdem}
                      onChange={(event) => {
                        if (semOF) return;
                        setForm((prev) => ({ ...prev, numOrdem: event.target.value }));
                        if (formErrors.numOrdem) setFormErrors((prev) => ({ ...prev, numOrdem: undefined }));
                        setCodigoProduto('');
                        setDescricaoPortugues('');
                      }}
                      onBlur={() => {
                        if (semOF) return;
                        void handleBlurOF();
                      }}
                      readOnly={semOF}
                      aria-label="Número da OF"
                    />
                    {!semOF && form.numOrdem.trim() ? (
                      <button
                        type="button"
                        className="field-clear-button"
                        aria-label="Limpar número da ordem"
                        title="Limpar"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, numOrdem: '' }));
                          setCodigoProduto('');
                          setDescricaoPortugues('');
                        }}
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                  {formErrors.numOrdem && !semOF ? <small className="module-field-error">{formErrors.numOrdem}</small> : null}
                </label>

                <div className="paradas-maquina-modal__semof-toggle">
                  <span>Sem OF</span>
                  <button
                    type="button"
                    className={`paradas-maquina-modal__semof-button${semOF ? ' is-active' : ''}`}
                    onClick={() => {
                      const next = !semOF;
                      setSemOF(next);
                      if (next && formErrors.numOrdem) {
                        setFormErrors((prev) => ({ ...prev, numOrdem: undefined }));
                      }
                      if (next) {
                        setForm((prev) => ({ ...prev, numOrdem: '' }));
                        setCodigoProduto('');
                        setDescricaoPortugues('');
                      }
                    }}
                    aria-label="Alternar sem OF"
                  >
                    {semOF ? 'SIM' : 'NAO'}
                  </button>
                </div>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Código Produto</span>
                <strong>{codigoProduto || '-'}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Descrição em Português</span>
                <strong>{descricaoPortugues || '-'}</strong>
              </div>
              <label>
                <span>Máquina</span>
                <SearchableSelect
                  value={form.numMaquina}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, numMaquina: nextValue }))}
                  options={maquinaOptions}
                  ariaLabel="Máquina"
                  searchPlaceholder="Pesquisar máquina"
                />
              </label>
              <label>
                <span>Motivo *</span>
                <SearchableSelect
                  value={form.codigoMotivo}
                  onChange={(nextValue) => {
                    setForm((prev) => ({ ...prev, codigoMotivo: nextValue }));
                    if (formErrors.codigoMotivo) setFormErrors((prev) => ({ ...prev, codigoMotivo: undefined }));
                  }}
                  options={motivoOptions}
                  ariaLabel="Motivo"
                  searchPlaceholder="Pesquisar motivo"
                  className={formErrors.codigoMotivo ? 'is-error' : undefined}
                />
                {formErrors.codigoMotivo ? <small className="module-field-error">{formErrors.codigoMotivo}</small> : null}
              </label>
              {!paradaCronometro ? (
                <>
                  <label>
                    <span>Data início</span>
                    <CustomDatePicker
                      value={form.dataInicio}
                      onChange={(nextDate) => setForm((prev) => ({ ...prev, dataInicio: nextDate }))}
                    />
                  </label>
                  <label>
                    <span>Hora início</span>
                    <CustomTimePicker value={form.horaInicio} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaInicio: nextValue }))} />
                  </label>
                  <label>
                    <span>Data fim</span>
                    <CustomDatePicker
                      value={form.dataFim}
                      onChange={(nextDate) => setForm((prev) => ({ ...prev, dataFim: nextDate }))}
                    />
                  </label>
                  <label>
                    <span>Hora fim</span>
                    <CustomTimePicker value={form.horaFim} onChange={(nextValue) => setForm((prev) => ({ ...prev, horaFim: nextValue }))} />
                  </label>
                </>
              ) : (
                <div className="form-grid-3__full">
                  <p className="module-empty">
                    Modo cronômetro: a data e hora de início serão registradas automaticamente no momento da confirmação. Para finalizar, clique na parada pendente na listagem.
                  </p>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSalvar()} disabled={saving}>
                {saving ? 'Salvando...' : 'Incluir parada'}
              </button>
            </div>
          </article>
        </section>
      )}

      {finalizarOpen && finalizarRow && finalizarAtual && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card paradas-maquina-modal">
            <header className="modal-card__header">
              <h2>Finalizar Parada Cronômetro</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setFinalizarOpen(false);
                  setFinalizarRow(null);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <div className="apontamento-producao-modal__read-only">
                <span>OF</span>
                <strong>{finalizarAtual.ordem}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Máquina</span>
                <strong>{finalizarAtual.maquina}</strong>
              </div>
              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Motivo</span>
                <strong>{finalizarAtual.motivo}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Data início</span>
                <strong>{finalizarAtual.inicioData || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Hora início</span>
                <strong>{finalizarAtual.inicioHora || '-'}</strong>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setFinalizarOpen(false);
                  setFinalizarRow(null);
                }}
              >
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleFinalizarCronometroParada()} disabled={finalizando}>
                {finalizando ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </article>
        </section>
      )}

      {detalheOpen && detalheRow && detalheAtual && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card paradas-maquina-modal">
            <header className="modal-card__header">
              <h2>Consulta de Parada de Máquina</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  setDetalheOpen(false);
                  setDetalheRow(null);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <div className="apontamento-producao-modal__read-only">
                <span>OF</span>
                <strong>{detalheAtual.ordem}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Máquina</span>
                <strong>{detalheAtual.maquina}</strong>
              </div>
              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Motivo</span>
                <strong>{detalheAtual.motivo}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Data início</span>
                <strong>{detalheAtual.inicioData || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Hora início</span>
                <strong>{detalheAtual.inicioHora || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Data fim</span>
                <strong>{detalheAtual.fimData || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Hora fim</span>
                <strong>{detalheAtual.fimHora || '-'}</strong>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDetalheOpen(false);
                  setDetalheRow(null);
                }}
              >
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
