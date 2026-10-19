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
  alterarApontProdCronometroCall,
  buscaOFCall,
  buscaOperCall,
  incluirApontProdCronometroCall,
  incluirApontProdPadraoCall,
  listApontamentosProducaoCall,
  listaFuncionariosCall,
  listaMaquinasCall,
  listMotivoBloqueioCall,
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
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const parseNumber = (value: any) => {
  const normalized = String(value ?? '0').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateTimeForSort = (dateValue: any, timeValue: any) => {
  const dateText = String(dateValue ?? '').trim();
  const fullMatch = dateText.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?$/);

  let day = 0;
  let month = 0;
  let year = 0;
  let embeddedHour = 0;
  let embeddedMinute = 0;

  if (fullMatch) {
    day = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    const rawYear = Number(fullMatch[3]);
    year = fullMatch[3].length === 2 ? 2000 + rawYear : rawYear;
    embeddedHour = fullMatch[4] ? Number(fullMatch[4]) : 0;
    embeddedMinute = fullMatch[5] ? Number(fullMatch[5]) : 0;
  } else {
    const parsed = new Date(dateText);
    if (!Number.isFinite(parsed.getTime())) return 0;

    day = parsed.getDate();
    month = parsed.getMonth() + 1;
    year = parsed.getFullYear();
    embeddedHour = parsed.getHours();
    embeddedMinute = parsed.getMinutes();
  }

  const timeMatch = String(timeValue ?? '').trim().match(/^(\d{2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : embeddedHour;
  const minute = timeMatch ? Number(timeMatch[2]) : embeddedMinute;

  const date = new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
  );

  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

type SelectOption = {
  value: string;
  label: string;
};

const isValidHour = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value ?? '').trim());

const getFirstFilledValue = (source: any, keys: string[]) => {
  const candidates = [source, source?.raw, source?.item, source?.apontamento, source?.dados, source?.registro];

  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate?.[key];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return value;
    }
  }

  return undefined;
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
  if (!Number.isFinite(parsed.getTime())) {
    return text;
  }

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

const getRowText = (row: any, keys: string[], fallback = '-'): string => {
  const value = getFirstFilledValue(row, keys);
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
};

// Quando descricao_Bloqueio vem preenchido, a qtd_Apontada refere-se a uma rejeição, não a produção.
const resolveQuantidades = (row: any) => {
  const descricaoBloqueio = getRowText(row, ['descricao_Bloqueio', 'Descricao_Bloqueio', 'descricaoBloqueio'], '');
  const isRejeicao = Boolean(descricaoBloqueio);
  const qtdApontada = getRowText(row, ['qtd_Apontada', 'Qtd_Apontada', 'qtdApontada', 'qtd_apontada'], '0');

  return {
    descricaoBloqueio,
    qtdProduzida: isRejeicao
      ? '0'
      : getRowText(
        row,
        [
          'qtd_Produzida',
          'Qtd_Produzida',
          'qtdProduzida',
          'qtd_Apontada',
          'Qtd_Apontada',
          'qtdApontada',
          'quantidade_Produzida',
          'Quantidade_Produzida',
          'quantidadeProduzida',
          'qtd_Boa',
          'Qtd_Boa',
        ],
        '0',
      ),
    qtdRejeitada: isRejeicao
      ? qtdApontada
      : getRowText(
        row,
        ['qtd_Rejeitada', 'Qtd_Rejeitada', 'qtdRejeitada', 'quantidade_Rejeitada', 'Quantidade_Rejeitada', 'qtd_Sucata', 'Qtd_Sucata'],
        '0',
      ),
  };
};

const resolveListRow = (row: any) => {
  const inicioDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraInicApont', 'dataHora_InicApont', 'data_Hora_Inic_Apont']));
  const fimDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraFimApont', 'dataHora_FimApont', 'data_Hora_Fim_Apont']));

  const inicioData = formatDateLabel(
    getFirstFilledValue(row, [
      'data_Inicio',
      'Data_Inicio',
      'dataInicio',
      'dataInicioApontamento',
      'data_Inic_Apont',
      'Data_Inic_Apont',
      'data_Apontamento',
      'Data_Apontamento',
      'data_Servico',
      'Data_Servico',
      'data_Apont',
      'Data_Apont',
      'data',
      'Data',
    ]),
  );
  const inicioHora = getRowText(
    row,
    ['hora_Inicio', 'Hora_Inicio', 'horaInicio', 'horaInicioApontamento', 'hora_Inic_Apont', 'Hora_Inic_Apont', 'hora'],
    '',
  );
  const fimData = formatDateLabel(
    getFirstFilledValue(row, [
      'data_Fim',
      'Data_Fim',
      'dataFim',
      'dataFimApontamento',
      'data_Fim_Apont',
      'Data_Fim_Apont',
      'data_Final',
      'Data_Final',
    ]),
  );
  const fimHora = getRowText(
    row,
    ['hora_Fim', 'Hora_Fim', 'horaFim', 'horaFimApontamento', 'hora_Fim_Apont', 'Hora_Fim_Apont', 'horaFinal'],
    '',
  );

  return {
    apontamento: getRowText(row, ['num_Apontamento', 'Num_Apontamento', 'numApontamento']),
    ordem: getRowText(row, ['num_Ordem', 'Num_Ordem', 'numOrdem']),
    operacao: getRowText(row, ['num_Operacao', 'Num_Operacao', 'numOperacao', 'operacao']),
    maquina: getRowText(row, ['num_Maquina', 'Num_Maquina', 'numMaquina']),
    produto: getRowText(row, ['codigo_Produto', 'codigoProduto', 'cod_Prod', 'codProd', 'produto']),
    descricaoProduto: getRowText(
      row,
      ['descricao_Portug', 'descricaoPortug', 'descricao_Produto', 'descricaoProduto', 'descricao_Item', 'descricao'],
      '-',
    ),
    funcionario: getRowText(row, ['num_Registro', 'numRegistro', 'nome_Func', 'nomeFunc', 'funcionario']),
    inicioData: inicioDataHora.date || inicioData,
    inicioHora: inicioDataHora.time || inicioHora,
    fimData: fimDataHora.date || fimData,
    fimHora: fimDataHora.time || fimHora,
    ...resolveQuantidades(row),
  };
};

const resolveDetalheRow = (row: any) => {
  const inicioDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraInicApont', 'dataHora_InicApont', 'data_Hora_Inic_Apont']));
  const fimDataHora = splitDateTimeValue(getFirstFilledValue(row, ['dataHoraFimApont', 'dataHora_FimApont', 'data_Hora_Fim_Apont']));

  return {
    numOrdem: getRowText(row, ['num_Ordem', 'Num_Ordem', 'numOrdem']),
    numOperacao: getRowText(row, ['num_Operacao', 'Num_Operacao', 'numOperacao', 'operacao']),
    numMaquina: getRowText(row, ['num_Maquina', 'Num_Maquina', 'numMaquina']),
    numRegistro: getRowText(row, ['num_Registro', 'numRegistro', 'nome_Func', 'nomeFunc', 'funcionario']),
    dataInicio:
      inicioDataHora.date ||
      formatDateLabel(
        getFirstFilledValue(row, [
          'data_Inicio',
          'Data_Inicio',
          'dataInicio',
          'dataInicioApontamento',
          'data_Inic_Apont',
          'Data_Inic_Apont',
          'data_Apontamento',
          'Data_Apontamento',
          'data_Servico',
          'Data_Servico',
          'data_Apont',
          'Data_Apont',
          'data',
          'Data',
        ]),
      ),
    horaInicio:
      inicioDataHora.time ||
      getRowText(
        row,
        ['hora_Inicio', 'Hora_Inicio', 'horaInicio', 'horaInicioApontamento', 'hora_Inic_Apont', 'Hora_Inic_Apont', 'hora'],
        '-',
      ),
    dataFim:
      fimDataHora.date ||
      formatDateLabel(
        getFirstFilledValue(row, [
          'data_Fim',
          'Data_Fim',
          'dataFim',
          'dataFimApontamento',
          'data_Fim_Apont',
          'Data_Fim_Apont',
          'data_Final',
          'Data_Final',
        ]),
      ),
    horaFim:
      fimDataHora.time ||
      getRowText(
        row,
        ['hora_Fim', 'Hora_Fim', 'horaFim', 'horaFimApontamento', 'hora_Fim_Apont', 'Hora_Fim_Apont', 'horaFinal'],
        '-',
      ),
    ...resolveQuantidades(row),
    parcial: getRowText(row, ['parcial', 'Parcial', 'ehParcial'], 'Não'),
    codigoProduto: getRowText(row, ['codigo_Produto', 'codigoProduto', 'cod_Prod', 'codProd', 'produto']),
    descricaoPortugues: getRowText(
      row,
      ['descricao_Portug', 'descricaoPortug', 'descricao_Produto', 'descricaoProduto', 'descricao_Item', 'descricao'],
      '-',
    ),
    descricaoOperacao: getRowText(row, ['descricao_Operacao', 'descricaoOperacao', 'operacao_Descricao', 'operacaoDescricao'], '-'),
    mensagem: getRowText(row, ['mensagem', 'Mensagem', 'msg', 'message'], '-'),
    loteApont: getRowText(row, ['lote_Apont', 'Lote_Apont', 'loteApont'], '-'),
    obsApontProd: getRowText(row, ['obs_Apont_Prod', 'Obs_Apont_Prod', 'obsApontProd'], ''),
  };
};

const formatDateTimeLabel = (dateValue: string, timeValue: string) => {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();
  if (!date && !time) return '-';
  return `${date || '-'} ${time}`.trim();
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseQuantidade = (value: string): number => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toApiQuantidade = (value: string): string => {
  const parsed = parseQuantidade(value);
  if (!Number.isFinite(parsed)) return '0';
  return String(parsed);
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

// Origem_Apont = 7 identifica um apontamento por cronômetro.
const isApontCronometroTipo = (row: any) =>
  String(getFirstFilledValue(row, ['origem_Apont', 'Origem_Apont', 'origemApont', 'Origem_apont']) ?? '').trim() === '7';

// Cronômetro ainda em aberto: nenhuma quantidade informada ainda, pendente de finalização.
const isApontCronometroAberto = (row: any) => {
  if (!isApontCronometroTipo(row)) return false;

  const qtdProduzida = parseNumber(
    getFirstFilledValue(row, ['qtd_Produzida', 'Qtd_Produzida', 'qtdProduzida', 'qtd_Apontada', 'Qtd_Apontada', 'qtdApontada']),
  );
  const qtdRejeitada = parseNumber(getFirstFilledValue(row, ['qtd_Rejeitada', 'Qtd_Rejeitada', 'qtdRejeitada']));

  return qtdProduzida <= 0 && qtdRejeitada <= 0;
};

type CronometroStatus = 'pendente' | 'concluido' | null;

const getCronometroStatus = (row: any): CronometroStatus => {
  if (!isApontCronometroTipo(row)) return null;
  return isApontCronometroAberto(row) ? 'pendente' : 'concluido';
};

const toFuncionarioOptions = (payload: any): SelectOption[] => {
  const rows = getRows(payload);

  return rows
    .map((row) => {
      const value = String(
        row?.num_Registro ?? row?.num_registro ?? row?.codigo_Funcionario ?? row?.codigo_funcionario ?? row?.codigo ?? '',
      ).trim();
      const label = String(
        row?.nome_Func ?? row?.nome_func ?? row?.nome_Funcionario ?? row?.nome_funcionario ?? row?.nome ?? '',
      ).trim();

      if (!value) return null;
      return { value, label: label || value };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

const toMaquinaOptions = (payload: any): SelectOption[] => {
  const rows = getRows(payload);

  return rows
    .map((row) => {
      const value = String(row?.num_Ident ?? row?.num_ident ?? row?.num_Maquina ?? row?.num_maquina ?? '').trim();
      const descricao = String(row?.desc_Maquinas ?? row?.desc_maquinas ?? row?.descricao ?? row?.descricao_Maquina ?? '').trim();

      if (!value) return null;
      return {
        value,
        label: descricao ? `${value} - ${descricao}` : value,
      };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

const toMotivoOptions = (payload: any, type: 'rej' | 'bloq'): SelectOption[] => {
  const rows = getRows(payload);

  return rows
    .map((row) => {
      const value =
        type === 'rej'
          ? String(row?.codigo_Rejeicao ?? row?.codigo_rejeicao ?? row?.codigo ?? row?.Codigo ?? '').trim()
          : String(row?.codigo_Bloqueio ?? row?.codigo_bloqueio ?? row?.codigo ?? row?.Codigo ?? '').trim();

      const descricaoCombinada =
        type === 'rej'
          ? String(row?.codDescricaoRej ?? row?.cod_descricao_rej ?? '').trim()
          : String(row?.codDescricaoBloq ?? row?.cod_descricao_bloq ?? '').trim();

      const descricao = String(row?.descricao ?? row?.Descricao ?? '').trim();

      if (!value) return null;
      return {
        value,
        label: descricaoCombinada || (descricao ? `${value} - ${descricao}` : value),
      };
    })
    .filter((item): item is SelectOption => Boolean(item));
};

const createInitialForm = () => ({
  numOrdem: '',
  numOperacao: '',
  numMaquina: '',
  numRegistro: '',
  dataInicio: formatToday(),
  horaInicio: '',
  dataFim: formatToday(),
  horaFim: '',
  codigoBloqueio: '',
  qtdProduzida: '0,000',
  qtdRejeitada: '0,000',
  parcial: false,
  loteApont: '',
});

type FormErrors = {
  numOrdem?: string;
  numOperacao?: string;
  numRegistro?: string;
  numMaquina?: string;
  dataInicio?: string;
  dataFim?: string;
  horaInicio?: string;
  horaFim?: string;
  qtdProduzida?: string;
  qtdRejeitada?: string;
  codigoBloqueio?: string;
};

type FiltroErrors = {
  dataInicio?: string;
  dataFim?: string;
  codProd?: string;
};

type SortField =
  | 'apontamento'
  | 'ordem'
  | 'operacao'
  | 'maquina'
  | 'inicio'
  | 'fim'
  | 'qtdProduzida'
  | 'qtdRejeitada';
type SortDirection = 'asc' | 'desc';

export function ApontamentoProducaoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [numOrdem, setNumOrdem] = useState('');
  const [codProd, setCodProd] = useState('');
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('apontamento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const initialLoadRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [detalheRow, setDetalheRow] = useState<any | null>(null);
  const [form, setForm] = useState(createInitialForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [filtroErrors, setFiltroErrors] = useState<FiltroErrors>({});

  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [obsApontProd, setObsApontProd] = useState('');
  const [obsApontProdDraft, setObsApontProdDraft] = useState('');
  const [obsConsultaOpen, setObsConsultaOpen] = useState(false);

  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [finalizarRow, setFinalizarRow] = useState<any | null>(null);
  const [finalizarForm, setFinalizarForm] = useState({ qtdProduzida: '', qtdRejeitada: '', codigoBloqueio: '' });
  const [finalizarErrors, setFinalizarErrors] = useState<{
    qtdProduzida?: string;
    qtdRejeitada?: string;
    codigoBloqueio?: string;
  }>({});
  const [finalizarConfirmacao, setFinalizarConfirmacao] = useState({ data: '', hora: '' });
  const [finalizando, setFinalizando] = useState(false);

  const [funcionarios, setFuncionarios] = useState<SelectOption[]>([]);
  const [maquinas, setMaquinas] = useState<SelectOption[]>([]);
  const [motivosBloqueio, setMotivosBloqueio] = useState<SelectOption[]>([]);

  const [codigoProduto, setCodigoProduto] = useState('');
  const [descricaoPortugues, setDescricaoPortugues] = useState('');
  const [descricaoOperacao, setDescricaoOperacao] = useState('');
  const [processoOF, setProcessoOF] = useState<number | undefined>(undefined);
  const [revisaoOF, setRevisaoOF] = useState<number | undefined>(undefined);
  const [situacaoOF, setSituacaoOF] = useState<number | undefined>(undefined);
  const permitirApontSemOperacao = GlobalConfig.getPermitirApontamentoSemOperacao();
  const apontamentoCronometro = isCronometroTipo(GlobalConfig.getTipoApontProd());

  const rowsOrdenadas = useMemo(() => {
    const list = [...rows];
    const collator = new Intl.Collator('pt-BR');

    list.sort((a, b) => {
      const apontA = Number(a?.num_Apontamento ?? a?.Num_Apontamento ?? a?.numApontamento ?? 0);
      const apontB = Number(b?.num_Apontamento ?? b?.Num_Apontamento ?? b?.numApontamento ?? 0);
      const ordemA = Number(a?.num_Ordem ?? a?.Num_Ordem ?? a?.numOrdem ?? 0);
      const ordemB = Number(b?.num_Ordem ?? b?.Num_Ordem ?? b?.numOrdem ?? 0);
      const operacaoA = Number(a?.num_Operacao ?? a?.Num_Operacao ?? a?.numOperacao ?? 0);
      const operacaoB = Number(b?.num_Operacao ?? b?.Num_Operacao ?? b?.numOperacao ?? 0);
      const maquinaA = String(a?.num_Maquina ?? a?.Num_Maquina ?? a?.numMaquina ?? '-');
      const maquinaB = String(b?.num_Maquina ?? b?.Num_Maquina ?? b?.numMaquina ?? '-');
      const inicioA = parseDateTimeForSort(
        getFirstFilledValue(a, ['dataHoraInicApont', 'dataHora_InicApont', 'data_Hora_Inic_Apont']) ?? (a?.data_Inicio ?? a?.Data_Inicio ?? ''),
        a?.hora_Inicio ?? a?.Hora_Inicio ?? '',
      );
      const inicioB = parseDateTimeForSort(
        getFirstFilledValue(b, ['dataHoraInicApont', 'dataHora_InicApont', 'data_Hora_Inic_Apont']) ?? (b?.data_Inicio ?? b?.Data_Inicio ?? ''),
        b?.hora_Inicio ?? b?.Hora_Inicio ?? '',
      );
      const fimA = parseDateTimeForSort(
        getFirstFilledValue(a, ['dataHoraFimApont', 'dataHora_FimApont', 'data_Hora_Fim_Apont']) ?? (a?.data_Fim ?? a?.Data_Fim ?? ''),
        a?.hora_Fim ?? a?.Hora_Fim ?? '',
      );
      const fimB = parseDateTimeForSort(
        getFirstFilledValue(b, ['dataHoraFimApont', 'dataHora_FimApont', 'data_Hora_Fim_Apont']) ?? (b?.data_Fim ?? b?.Data_Fim ?? ''),
        b?.hora_Fim ?? b?.Hora_Fim ?? '',
      );
      const qtdProdA = parseNumber(a?.qtd_Produzida ?? a?.Qtd_Produzida ?? 0);
      const qtdProdB = parseNumber(b?.qtd_Produzida ?? b?.Qtd_Produzida ?? 0);
      const qtdRejA = parseNumber(a?.qtd_Rejeitada ?? a?.Qtd_Rejeitada ?? 0);
      const qtdRejB = parseNumber(b?.qtd_Rejeitada ?? b?.Qtd_Rejeitada ?? 0);

      let comparison = 0;
      if (sortField === 'apontamento') comparison = apontA - apontB;
      if (sortField === 'ordem') comparison = ordemA - ordemB;
      if (sortField === 'operacao') comparison = operacaoA - operacaoB;
      if (sortField === 'maquina') comparison = collator.compare(maquinaA, maquinaB);
      if (sortField === 'inicio') comparison = inicioA - inicioB;
      if (sortField === 'fim') comparison = fimA - fimB;
      if (sortField === 'qtdProduzida') comparison = qtdProdA - qtdProdB;
      if (sortField === 'qtdRejeitada') comparison = qtdRejA - qtdRejB;

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [rows, sortDirection, sortField]);

  const rowsFiltradas = useMemo(() => filterListByTerm(rowsOrdenadas, searchTerm), [rowsOrdenadas, searchTerm]);

  const funcionarioOptions = useMemo<SelectOption[]>(() => [{ value: '', label: 'Selecione' }, ...funcionarios], [funcionarios]);
  const maquinaOptions = useMemo<SelectOption[]>(() => [{ value: '', label: 'Selecione' }, ...maquinas], [maquinas]);
  const motivoBloqueioOptions = useMemo<SelectOption[]>(() => [{ value: '', label: 'Selecione' }, ...motivosBloqueio], [motivosBloqueio]);

  const qtdRejeitadaInformada = useMemo(() => parseQuantidade(form.qtdRejeitada) > 0, [form.qtdRejeitada]);

  const detalheAtual = useMemo(() => (detalheRow ? resolveDetalheRow(detalheRow) : null), [detalheRow]);

  const finalizarAtual = useMemo(() => (finalizarRow ? resolveListRow(finalizarRow) : null), [finalizarRow]);
  const qtdRejeitadaInformadaFinalizar = useMemo(() => parseQuantidade(finalizarForm.qtdRejeitada) > 0, [finalizarForm.qtdRejeitada]);

  const resetModalState = useCallback(() => {
    setForm(createInitialForm());
    setFormErrors({});
    setCodigoProduto('');
    setDescricaoPortugues('');
    setDescricaoOperacao('');
    setProcessoOF(undefined);
    setRevisaoOF(undefined);
    setSituacaoOF(undefined);
    setObsApontProd('');
    setObsApontProdDraft('');
  }, []);

  const handleAbrirModal = () => {
    resetModalState();
    setModalOpen(true);
  };

  const carregarListasModal = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();

    if (!baseUrl || !token || !usuario) return;

    try {
      const [funcResp, maqResp, bloqResp] = await Promise.all([
        listaFuncionariosCall(baseUrl, token, usuario),
        listaMaquinasCall(baseUrl, token),
        listMotivoBloqueioCall(baseUrl, token),
      ]);

      const funcionariosPayload =
        (funcResp.jsonBody as any)?.listaFuncionarios ??
        (funcResp.data as any)?.listaFuncionarios ??
        funcResp.jsonBody ??
        funcResp.data;

      setFuncionarios(toFuncionarioOptions(funcionariosPayload));
      setMaquinas(toMaquinaOptions(maqResp.jsonBody || maqResp.data));
      setMotivosBloqueio(toMotivoOptions(bloqResp.jsonBody || bloqResp.data, 'bloq'));
    } catch {
      // Mantém a tela funcional mesmo se uma lista auxiliar falhar.
    }
  }, []);

  useEffect(() => {
    if (!modalOpen && !finalizarOpen) return;
    void carregarListasModal();
  }, [carregarListasModal, finalizarOpen, modalOpen]);

  const handleBlurOF = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const ordem = form.numOrdem.trim();

    if (!baseUrl || !token || !codigoEmpresa || !ordem) return;

    try {
      const resp = await buscaOFCall(baseUrl, token, codigoEmpresa, ordem);

      if (!resp.succeeded) {
        setForm((prev) => ({ ...prev, numOperacao: '' }));
        setDescricaoOperacao('');
        setCodigoProduto('');
        setDescricaoPortugues('');
        setProcessoOF(undefined);
        setRevisaoOF(undefined);
        setSituacaoOF(undefined);
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
      setDescricaoOperacao('');
      setProcessoOF(toOptionalNumber(getFirstFilledValue(data, ['processo', 'num_Processo', 'numProcesso'])));
      setRevisaoOF(toOptionalNumber(getFirstFilledValue(data, ['revisao', 'num_Revisao', 'numRevisao'])));
      setSituacaoOF(toOptionalNumber(getFirstFilledValue(data, ['situacao_Ordem', 'situacao_ordem', 'situacaoOF'])));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar OF.', 'error');
    }
  }, [form.numOrdem, showToast]);

  const handleBlurOperacao = useCallback(async (): Promise<boolean> => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const operacaoTexto = form.numOperacao.trim();

    if (!operacaoTexto) {
      if (permitirApontSemOperacao) {
        setDescricaoOperacao('');
        return true;
      }
      return false;
    }

    const operacaoNumero = Number(operacaoTexto);
    if (!Number.isFinite(operacaoNumero)) {
      showToast('Informe uma operação válida.', 'error');
      setForm((prev) => ({ ...prev, numOperacao: '' }));
      setDescricaoOperacao('');
      return false;
    }

    if (!baseUrl || !token || !codigoProduto) {
      showToast('Informe uma OF válida antes da operação.', 'error');
      setForm((prev) => ({ ...prev, numOperacao: '' }));
      setDescricaoOperacao('');
      return false;
    }

    try {
      const resp = await buscaOperCall(baseUrl, token, {
        codigoProduto,
        numProcesso: processoOF,
        numRevisao: revisaoOF,
        numOperacao: operacaoNumero,
        situacaoOF,
        tipoApont: apontamentoCronometro ? 'Cronometro' : 'Padrao',
      });

      if (!resp.succeeded) {
        setForm((prev) => ({ ...prev, numOperacao: '' }));
        setDescricaoOperacao('');
        showToast(getApiErrorMessage(resp, 'Operação inválida.'), 'error');
        return false;
      }

      const list = getRows(resp.jsonBody || resp.data);
      const data = list[0] ?? resp.jsonBody ?? resp.data;
      const descricao = String(
        getFirstFilledValue(data, ['descricaoOperacao', 'descricao_operacao', 'descricao_Operacao']) ?? '',
      ).trim();

      setDescricaoOperacao(descricao);
      return true;
    } catch (error: any) {
      showToast(error?.message || 'Erro ao validar operação.', 'error');
      return false;
    }
  }, [apontamentoCronometro, codigoProduto, form.numOperacao, permitirApontSemOperacao, processoOF, revisaoOF, showToast, situacaoOF]);

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
      showToast('Sessão inválida para consultar apontamentos.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listApontamentosProducaoCall(baseUrl, token, {
        codigoEmpresa,
        numOrdem,
        dataInicio: dataInicioFiltro,
        dataFim: dataFimFiltro,
        codProd,
        usuario: GlobalConfig.getUsuario(),
      });

      setRows(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar apontamentos de produção.', 'error');
    } finally {
      setLoading(false);
    }
  }, [codProd, dataFim, dataInicio, numOrdem, showToast]);

  const handleApplyFiltros = useCallback(() => {
    const temDataInicio = Boolean(dataInicio.trim());
    const temDataFim = Boolean(dataFim.trim());
    const temCodProd = Boolean(codProd.trim());
    const nextErrors: FiltroErrors = {};

    if (temDataInicio !== temDataFim) {
      nextErrors.dataInicio = 'Preencha Data início e Data fim juntas.';
      nextErrors.dataFim = 'Preencha Data início e Data fim juntas.';
    }

    if (temCodProd && !(temDataInicio && temDataFim)) {
      nextErrors.codProd = 'Para filtrar por Código produto, informe Data início e Data fim.';
      nextErrors.dataInicio = nextErrors.dataInicio || 'Data início é obrigatória ao filtrar por Código produto.';
      nextErrors.dataFim = nextErrors.dataFim || 'Data fim é obrigatória ao filtrar por Código produto.';
    }

    setFiltroErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFiltroErrors({});
    setFiltrosOpen(false);
    void carregar();
  }, [codProd, carregar, dataFim, dataInicio]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  const handleSalvar = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa) {
      showToast('Sessão inválida para inclusão de apontamento.', 'error');
      return;
    }

    const nextErrors: FormErrors = {};

    if (!form.numOrdem.trim()) {
      nextErrors.numOrdem = 'OF é obrigatória.';
    }

    if (!permitirApontSemOperacao && !form.numOperacao.trim()) {
      nextErrors.numOperacao = 'Operação é obrigatória.';
    }

    if (!codigoProduto) {
      nextErrors.numOrdem = nextErrors.numOrdem || 'Informe uma OF válida para carregar produto e descrição.';
    }

    if (!form.numRegistro) {
      nextErrors.numRegistro = 'Funcionário é obrigatório.';
    }

    if (!form.numMaquina) {
      nextErrors.numMaquina = 'Máquina é obrigatória.';
    }

    if (!apontamentoCronometro) {
      if (!form.dataInicio) {
        nextErrors.dataInicio = 'Data início é obrigatória.';
      }

      if (!isValidHour(form.horaInicio)) {
        nextErrors.horaInicio = 'Hora início inválida.';
      }

      if (!form.dataFim) {
        nextErrors.dataFim = 'Data fim é obrigatória.';
      }

      if (!isValidHour(form.horaFim)) {
        nextErrors.horaFim = 'Hora fim inválida.';
      }

      const qtdProduzidaNum = parseQuantidade(form.qtdProduzida);
      const qtdRejeitadaNum = parseQuantidade(form.qtdRejeitada);

      if (qtdProduzidaNum <= 0 && qtdRejeitadaNum <= 0) {
        nextErrors.qtdProduzida = 'Informe ao menos uma quantidade maior que zero.';
        nextErrors.qtdRejeitada = 'Informe ao menos uma quantidade maior que zero.';
      }

      if (qtdRejeitadaNum > 0 && !form.codigoBloqueio) {
        nextErrors.codigoBloqueio = 'Motivo bloqueio é obrigatório.';
      }
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!permitirApontSemOperacao) {
      const operacaoValida = await handleBlurOperacao();
      if (!operacaoValida) {
        return;
      }
    }

    setSaving(true);
    try {
      const resp = apontamentoCronometro
        ? await incluirApontProdCronometroCall(baseUrl, token, {
          codigoEmpresa,
          numOrdem: form.numOrdem.trim(),
          numOperacao: Number(form.numOperacao.trim()) || 0,
          numMaquina: form.numMaquina.trim(),
          numRegistro: form.numRegistro.trim(),
          usuario: GlobalConfig.getUsuario(),
        })
        : await incluirApontProdPadraoCall(baseUrl, token, {
          codigoEmpresa,
          numApontamento: 0,
          numOrdem: form.numOrdem.trim(),
          numOperacao: Number(form.numOperacao.trim()) || 0,
          numMaquina: form.numMaquina.trim(),
          numRegistro: form.numRegistro.trim(),
          dataInicio: form.dataInicio,
          horaInicio: form.horaInicio,
          dataFim: form.dataFim,
          horaFim: form.horaFim,
          codigoBloqueio: form.codigoBloqueio.trim(),
          usuario: GlobalConfig.getUsuario(),
          qtdProduzida: toApiQuantidade(form.qtdProduzida),
          qtdRejeitada: toApiQuantidade(form.qtdRejeitada),
          permitirApontamentoSemOperacao: permitirApontSemOperacao,
          loteApont: form.loteApont.trim(),
          obsApontProd: obsApontProd.trim(),
        });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Falha ao incluir apontamento.'), 'error');
        return;
      }

      showToast(
        apontamentoCronometro
          ? 'Apontamento incluído em modo cronômetro com sucesso.'
          : 'Apontamento incluído com sucesso.',
        'success',
      );
      setModalOpen(false);
      resetModalState();
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir apontamento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const abrirConsulta = (row: any) => {
    setDetalheRow(row);
    setDetalheOpen(true);
  };

  const abrirFinalizarCronometro = (row: any) => {
    setFinalizarRow(row);
    setFinalizarForm({ qtdProduzida: '', qtdRejeitada: '', codigoBloqueio: '' });
    setFinalizarErrors({});
    const now = new Date();
    setFinalizarConfirmacao({
      data: formatToday(),
      hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    });
    setFinalizarOpen(true);
  };

  const handleFinalizarCronometro = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codigoEmpresa || !finalizarRow) {
      showToast('Sessão inválida para finalizar apontamento.', 'error');
      return;
    }

    const qtdProduzidaNum = parseQuantidade(finalizarForm.qtdProduzida);
    const qtdRejeitadaNum = parseQuantidade(finalizarForm.qtdRejeitada);
    const nextErrors: typeof finalizarErrors = {};

    if (qtdProduzidaNum <= 0 && qtdRejeitadaNum <= 0) {
      nextErrors.qtdProduzida = 'Informe ao menos uma quantidade maior que zero.';
      nextErrors.qtdRejeitada = 'Informe ao menos uma quantidade maior que zero.';
    }

    if (qtdRejeitadaNum > 0) {
      if (!finalizarForm.codigoBloqueio) nextErrors.codigoBloqueio = 'Motivo bloqueio é obrigatório.';
    }

    setFinalizarErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const numApontamento = Number(
      getFirstFilledValue(finalizarRow, ['num_Apontamento', 'Num_Apontamento', 'numApontamento']) ?? 0,
    );
    const numOrdem = String(getFirstFilledValue(finalizarRow, ['num_Ordem', 'Num_Ordem', 'numOrdem']) ?? '').trim();
    const dadosFinalizar = resolveListRow(finalizarRow);
    const agora = new Date();
    const dataFim = formatToday();
    const horaFim = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    setFinalizando(true);
    try {
      const resp = await alterarApontProdCronometroCall(baseUrl, token, {
        codigoEmpresa,
        numApontamento,
        numOrdem,
        numOperacao: Number(dadosFinalizar.operacao) || undefined,
        numMaquina: dadosFinalizar.maquina !== '-' ? dadosFinalizar.maquina : '',
        numRegistro: dadosFinalizar.funcionario !== '-' ? dadosFinalizar.funcionario : '',
        dataInicio: dadosFinalizar.inicioData !== '-' ? dadosFinalizar.inicioData : '',
        horaInicio: dadosFinalizar.inicioHora,
        dataFim,
        horaFim,
        codigoBloqueio: finalizarForm.codigoBloqueio.trim(),
        qtdProduzida: toApiQuantidade(finalizarForm.qtdProduzida),
        qtdRejeitada: toApiQuantidade(finalizarForm.qtdRejeitada),
        usuario: GlobalConfig.getUsuario(),
      });

      if (!resp.succeeded) {
        showToast(getApiErrorMessage(resp, 'Falha ao finalizar apontamento.'), 'error');
        return;
      }

      showToast('Apontamento cronômetro finalizado com sucesso.', 'success');
      setFinalizarOpen(false);
      setFinalizarRow(null);
      void carregar();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao finalizar apontamento.', 'error');
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <main className="clientes-page list-layout-page apontamento-producao-page">
      <section className="clientes-page__header apontamento-producao-header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button apontamento-producao-back" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Apontamento de Produção</h1>
            <p className="apontamento-producao-subtitle">
              Incluir e consultar apontamentos de produção. Modo configurado: {apontamentoCronometro ? 'Cronômetro' : 'Normal'}
            </p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel apontamento-producao-panel">
        <div className="clientes-panel__top list-layout-panel__top apontamento-producao-panel__top">
          <div className="clientes-panel__summary apontamento-producao-summary">
            <strong>Total de registros</strong>
            <span>{rowsFiltradas.length} encontrados</span>
          </div>

          <div className="list-layout-controls apontamento-producao-controls">
            <ListSearchField
              value={searchTerm}
              onChange={setSearchTerm}
              label="Pesquisar"
              mobileLabel="Apontamento de Produção"
              placeholder="Pesquisar"
              className="apontamento-producao-search"
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
              onClick={handleAbrirModal}
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
          <div className="list-layout-extra-filters apontamento-producao-extra-filters">
            <label className="apontamento-producao-field apontamento-producao-field--date">
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
                className={`module-field-error apontamento-producao-field__error-slot${filtroErrors.dataInicio ? '' : ' apontamento-producao-field__error-slot--empty'
                  }`}
              >
                {filtroErrors.dataInicio || ' '}
              </small>
            </label>
            <label className="apontamento-producao-field apontamento-producao-field--date">
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
                className={`module-field-error apontamento-producao-field__error-slot${filtroErrors.dataFim ? '' : ' apontamento-producao-field__error-slot--empty'
                  }`}
              >
                {filtroErrors.dataFim || ' '}
              </small>
            </label>

            <label className="apontamento-producao-field apontamento-producao-field--produto apontamento-producao-field--clearable">
              <span>Código produto</span>
              <div className="apontamento-producao-field__input-wrap">
                <input
                  className={filtroErrors.codProd ? 'module-input-error' : ''}
                  value={codProd}
                  onChange={(event) => {
                    setCodProd(event.target.value);
                    if (filtroErrors.codProd) {
                      setFiltroErrors((prev) => ({ ...prev, codProd: undefined }));
                    }
                  }}
                  placeholder="Pesquisar código do produto"
                />
                {codProd.trim() ? (
                  <button
                    type="button"
                    className="field-clear-button"
                    aria-label="Limpar código do produto"
                    title="Limpar"
                    onClick={() => setCodProd('')}
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
              <small
                className={`module-field-error apontamento-producao-field__error-slot${filtroErrors.codProd ? '' : ' apontamento-producao-field__error-slot--empty'
                  }`}
              >
                {filtroErrors.codProd || ' '}
              </small>
            </label>

            <div className="apontamento-producao-filters-separator" aria-hidden="true">
              ou
            </div>

            <label className="apontamento-producao-field apontamento-producao-field--ordem apontamento-producao-field--clearable">
              <span>Número ordem</span>
              <div className="apontamento-producao-field__input-wrap">
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
              <small className="module-field-error apontamento-producao-field__error-slot apontamento-producao-field__error-slot--empty"> </small>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table apontamento-producao-table">
          {loading ? (
            <p className="module-empty">Carregando apontamentos...</p>
          ) : rowsFiltradas.length === 0 ? (
            <p className="module-empty">Nenhum apontamento encontrado.</p>
          ) : (
            <>
              <div className="table-scroll module-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="apontamento-producao-status-col">Status</th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('ordem')}>
                          Ordem <span>{getSortIndicator('ordem')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('operacao')}>
                          Operação <span>{getSortIndicator('operacao')}</span>
                        </button>
                      </th>
                      <th>Produto</th>
                      <th>Funcionário</th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('maquina')}>
                          Máquina <span>{getSortIndicator('maquina')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('inicio')}>
                          Início <span>{getSortIndicator('inicio')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('fim')}>
                          Fim <span>{getSortIndicator('fim')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('qtdProduzida')}>
                          Qtd produzida <span>{getSortIndicator('qtdProduzida')}</span>
                        </button>
                      </th>
                      <th>
                        <button className="module-table__sort" type="button" onClick={() => handleSort('qtdRejeitada')}>
                          Qtd rejeitada <span>{getSortIndicator('qtdRejeitada')}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsFiltradas.map((row, index) => {
                      const current = resolveListRow(row);
                      const cronometroAberto = isApontCronometroAberto(row);
                      const cronometroStatus = getCronometroStatus(row);

                      return (
                        <tr
                          key={`ap-${index}`}
                          className={`module-row-clickable${cronometroAberto ? ' apontamento-producao-row--cronometro' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => (cronometroAberto ? abrirFinalizarCronometro(row) : abrirConsulta(row))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (cronometroAberto) {
                                abrirFinalizarCronometro(row);
                              } else {
                                abrirConsulta(row);
                              }
                            }
                          }}
                        >
                          <td className="apontamento-producao-status-col">
                            {cronometroStatus ? (
                              <IoTimeOutline
                                size={18}
                                className={`apontamento-producao-status-icon apontamento-producao-status-icon--${cronometroStatus}`}
                                title={
                                  cronometroStatus === 'pendente'
                                    ? 'Apontamento cronômetro pendente de finalização'
                                    : 'Apontamento cronômetro concluído'
                                }
                              />
                            ) : null}
                          </td>
                          <td>{current.ordem}</td>
                          <td>{current.operacao}</td>
                          <td>{current.produto}</td>
                          <td>{current.funcionario}</td>
                          <td>{current.maquina}</td>
                          <td className="apontamento-producao-datetime-cell">{formatDateTimeLabel(current.inicioData, current.inicioHora)}</td>
                          <td className="apontamento-producao-datetime-cell">{formatDateTimeLabel(current.fimData, current.fimHora)}</td>
                          <td>{current.qtdProduzida}</td>
                          <td>{current.qtdRejeitada}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="module-cards">
                {rowsFiltradas.map((row, index) => {
                  const current = resolveListRow(row);
                  const cronometroAberto = isApontCronometroAberto(row);
                  const cronometroStatus = getCronometroStatus(row);
                  const produtoLinha =
                    current.produto !== '-' && current.descricaoProduto !== '-'
                      ? `${current.produto} - ${current.descricaoProduto}`
                      : current.produto !== '-'
                        ? current.produto
                        : current.descricaoProduto;

                  return (
                    <article
                      className={`module-card module-row-clickable${cronometroAberto ? ' apontamento-producao-row--cronometro' : ''}`}
                      key={`card-ap-${index}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => (cronometroAberto ? abrirFinalizarCronometro(row) : abrirConsulta(row))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (cronometroAberto) {
                            abrirFinalizarCronometro(row);
                          } else {
                            abrirConsulta(row);
                          }
                        }
                      }}
                    >
                      {cronometroStatus ? (
                        <IoTimeOutline
                          size={18}
                          className={`apontamento-producao-status-icon apontamento-producao-status-icon--${cronometroStatus} apontamento-producao-status-icon--card`}
                          title={
                            cronometroStatus === 'pendente'
                              ? 'Apontamento cronômetro pendente de finalização'
                              : 'Apontamento cronômetro concluído'
                          }
                        />
                      ) : null}
                      <div className="module-card__row">
                        <span>Ordem</span>
                        <strong>{current.ordem}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Operação</span>
                        <strong>{current.operacao}</strong>
                      </div>
                      <div className="module-card__row">
                        <span>Produto</span>
                        <strong className="module-card__product-inline">{produtoLinha}</strong>
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
          <article className="modal-card modal-card--wide apontamento-producao-modal">
            <header className="modal-card__header">
              <h2>Apontamento de Produção ({apontamentoCronometro ? 'Cronômetro' : 'Normal'})</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setModalOpen(false);
                  resetModalState();
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label>
                <span>OF</span>
                <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                  <input
                    className={formErrors.numOrdem ? 'module-input-error' : ''}
                    value={form.numOrdem}
                    inputMode="numeric"
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, numOrdem: event.target.value }));
                      if (formErrors.numOrdem) setFormErrors((prev) => ({ ...prev, numOrdem: undefined }));
                      setCodigoProduto('');
                      setDescricaoPortugues('');
                      setDescricaoOperacao('');
                      setProcessoOF(undefined);
                      setRevisaoOF(undefined);
                      setSituacaoOF(undefined);
                    }}
                    onBlur={() => {
                      void handleBlurOF();
                    }}
                    placeholder="Número da OF"
                  />
                  {form.numOrdem.trim() ? (
                    <button
                      type="button"
                      className="field-clear-button"
                      aria-label="Limpar OF"
                      title="Limpar"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, numOrdem: '' }));
                        setCodigoProduto('');
                        setDescricaoPortugues('');
                        setDescricaoOperacao('');
                        setProcessoOF(undefined);
                        setRevisaoOF(undefined);
                        setSituacaoOF(undefined);
                      }}
                    >
                      <IoCloseCircleOutline size={16} />
                    </button>
                  ) : null}
                </div>
                {formErrors.numOrdem ? <small className="module-field-error">{formErrors.numOrdem}</small> : null}
              </label>

              <label>
                <span>{permitirApontSemOperacao ? 'Operação' : 'Operação *'}</span>
                <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                  <input
                    className={formErrors.numOperacao ? 'module-input-error' : ''}
                    value={form.numOperacao}
                    inputMode="numeric"
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, numOperacao: event.target.value }));
                      if (formErrors.numOperacao) setFormErrors((prev) => ({ ...prev, numOperacao: undefined }));
                      setDescricaoOperacao('');
                    }}
                    onBlur={() => {
                      void handleBlurOperacao();
                    }}
                    placeholder={permitirApontSemOperacao ? 'Operação (opcional)' : 'Operação'}
                  />
                  {form.numOperacao.trim() ? (
                    <button
                      type="button"
                      className="field-clear-button"
                      aria-label="Limpar operação"
                      title="Limpar"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, numOperacao: '' }));
                        setDescricaoOperacao('');
                      }}
                    >
                      <IoCloseCircleOutline size={16} />
                    </button>
                  ) : null}
                </div>
                {formErrors.numOperacao ? <small className="module-field-error">{formErrors.numOperacao}</small> : null}
                {descricaoOperacao ? <small className="apontamento-producao-modal__hint">{descricaoOperacao}</small> : null}
                {permitirApontSemOperacao ? (
                  <small className="apontamento-producao-modal__hint">Flag ativa: apontamento pode ser salvo sem operação.</small>
                ) : null}
              </label>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Código Produto</span>
                <strong>{codigoProduto || '-'}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Descrição em Português</span>
                <strong>{descricaoPortugues || '-'}</strong>
              </div>

              <label>
                <span>Lote Apont</span>
                <input
                  value={form.loteApont}
                  maxLength={25}
                  onChange={(event) => setForm((prev) => ({ ...prev, loteApont: event.target.value.slice(0, 25) }))}
                  placeholder="Lote Apont"
                />
              </label>

              <label>
                <span>Funcionário</span>
                <SearchableSelect
                  value={form.numRegistro}
                  onChange={(nextValue) => {
                    setForm((prev) => ({ ...prev, numRegistro: nextValue }));
                    if (formErrors.numRegistro) setFormErrors((prev) => ({ ...prev, numRegistro: undefined }));
                  }}
                  options={funcionarioOptions}
                  ariaLabel="Funcionário"
                  searchPlaceholder="Pesquisar funcionário"
                  className={formErrors.numRegistro ? 'is-error' : undefined}
                />
                {formErrors.numRegistro ? <small className="module-field-error">{formErrors.numRegistro}</small> : null}
              </label>

              <label>
                <span>Máquina</span>
                <SearchableSelect
                  value={form.numMaquina}
                  onChange={(nextValue) => {
                    setForm((prev) => ({ ...prev, numMaquina: nextValue }));
                    if (formErrors.numMaquina) setFormErrors((prev) => ({ ...prev, numMaquina: undefined }));
                  }}
                  options={maquinaOptions}
                  ariaLabel="Máquina"
                  searchPlaceholder="Pesquisar máquina"
                  className={formErrors.numMaquina ? 'is-error' : undefined}
                />
                {formErrors.numMaquina ? <small className="module-field-error">{formErrors.numMaquina}</small> : null}
              </label>

              {!apontamentoCronometro ? (
                <>
                  <label>
                    <span>Data início</span>
                    <CustomDatePicker
                      className={formErrors.dataInicio ? 'pcp-date-error' : undefined}
                      value={form.dataInicio}
                      onChange={(nextDate) => {
                        setForm((prev) => ({ ...prev, dataInicio: nextDate }));
                        if (formErrors.dataInicio) setFormErrors((prev) => ({ ...prev, dataInicio: undefined }));
                      }}
                    />
                    {formErrors.dataInicio ? <small className="module-field-error">{formErrors.dataInicio}</small> : null}
                  </label>

                  <label>
                    <span>Hora início</span>
                    <CustomTimePicker
                      className={formErrors.horaInicio ? 'pcp-time-error' : undefined}
                      value={form.horaInicio}
                      onChange={(nextValue) => {
                        setForm((prev) => ({ ...prev, horaInicio: nextValue }));
                        if (formErrors.horaInicio) setFormErrors((prev) => ({ ...prev, horaInicio: undefined }));
                      }}
                    />
                    {formErrors.horaInicio ? <small className="module-field-error">{formErrors.horaInicio}</small> : null}
                  </label>
                </>
              ) : null}

              {apontamentoCronometro ? (
                <div className="form-grid-3__full">
                  <p className="module-empty">
                    Modo cronômetro: a data e hora de início serão registradas automaticamente no momento da confirmação.
                  </p>
                </div>
              ) : null}

              {!apontamentoCronometro ? (
                <>
                  <label>
                    <span>Data fim</span>
                    <CustomDatePicker
                      className={formErrors.dataFim ? 'pcp-date-error' : undefined}
                      value={form.dataFim}
                      onChange={(nextDate) => {
                        setForm((prev) => ({ ...prev, dataFim: nextDate }));
                        if (formErrors.dataFim) setFormErrors((prev) => ({ ...prev, dataFim: undefined }));
                      }}
                    />
                    {formErrors.dataFim ? <small className="module-field-error">{formErrors.dataFim}</small> : null}
                  </label>

                  <label>
                    <span>Hora fim</span>
                    <CustomTimePicker
                      className={formErrors.horaFim ? 'pcp-time-error' : undefined}
                      value={form.horaFim}
                      onChange={(nextValue) => {
                        setForm((prev) => ({ ...prev, horaFim: nextValue }));
                        if (formErrors.horaFim) setFormErrors((prev) => ({ ...prev, horaFim: undefined }));
                      }}
                    />
                    {formErrors.horaFim ? <small className="module-field-error">{formErrors.horaFim}</small> : null}
                  </label>

                  <div className="form-grid-3__full apontamento-producao-modal__quantidades">
                    <label>
                      <span>Qtd. produzida</span>
                      <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                        <input
                          className={formErrors.qtdProduzida ? 'module-input-error' : ''}
                          value={form.qtdProduzida}
                          inputMode="decimal"
                          onChange={(event) => {
                            setForm((prev) => ({ ...prev, qtdProduzida: event.target.value }));
                            if (formErrors.qtdProduzida) setFormErrors((prev) => ({ ...prev, qtdProduzida: undefined }));
                          }}
                        />
                        {form.qtdProduzida.trim() ? (
                          <button
                            type="button"
                            className="field-clear-button"
                            aria-label="Limpar quantidade produzida"
                            title="Limpar"
                            onClick={() => setForm((prev) => ({ ...prev, qtdProduzida: '' }))}
                          >
                            <IoCloseCircleOutline size={16} />
                          </button>
                        ) : null}
                      </div>
                      {formErrors.qtdProduzida ? <small className="module-field-error">{formErrors.qtdProduzida}</small> : null}
                    </label>

                    <label>
                      <span>Qtd. rejeitada</span>
                      <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                        <input
                          className={formErrors.qtdRejeitada ? 'module-input-error' : ''}
                          value={form.qtdRejeitada}
                          inputMode="decimal"
                          onChange={(event) => {
                            setForm((prev) => ({ ...prev, qtdRejeitada: event.target.value }));
                            if (formErrors.qtdRejeitada) setFormErrors((prev) => ({ ...prev, qtdRejeitada: undefined }));
                          }}
                        />
                        {form.qtdRejeitada.trim() ? (
                          <button
                            type="button"
                            className="field-clear-button"
                            aria-label="Limpar quantidade rejeitada"
                            title="Limpar"
                            onClick={() => setForm((prev) => ({ ...prev, qtdRejeitada: '' }))}
                          >
                            <IoCloseCircleOutline size={16} />
                          </button>
                        ) : null}
                      </div>
                      {formErrors.qtdRejeitada ? <small className="module-field-error">{formErrors.qtdRejeitada}</small> : null}
                    </label>

                    <label className="apontamento-producao-modal__parcial">
                      <span>Parcial</span>
                      <select
                        value={form.parcial ? 'true' : 'false'}
                        onChange={(event) => setForm((prev) => ({ ...prev, parcial: event.target.value === 'true' }))}
                      >
                        <option value="false">Não</option>
                        <option value="true">Sim</option>
                      </select>
                    </label>
                  </div>

                  {qtdRejeitadaInformada ? (
                    <div className="form-grid-3__full">
                      <label>
                        <span>Motivo bloqueio</span>
                        <SearchableSelect
                          value={form.codigoBloqueio}
                          onChange={(nextValue) => {
                            setForm((prev) => ({ ...prev, codigoBloqueio: nextValue }));
                            if (formErrors.codigoBloqueio) setFormErrors((prev) => ({ ...prev, codigoBloqueio: undefined }));
                          }}
                          options={motivoBloqueioOptions}
                          ariaLabel="Motivo bloqueio"
                          searchPlaceholder="Pesquisar motivo de bloqueio"
                          className={formErrors.codigoBloqueio ? 'is-error' : undefined}
                          dropUp
                        />
                        {formErrors.codigoBloqueio ? <small className="module-field-error">{formErrors.codigoBloqueio}</small> : null}
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="form-actions apontamento-producao-modal__actions apontamento-producao-modal__actions--split">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setObsApontProdDraft(obsApontProd);
                  setObsModalOpen(true);
                }}
              >
                Observações
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSalvar()} disabled={saving}>
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </article>
        </section>
      )}

      {obsModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card apontamento-producao-modal">
            <header className="modal-card__header">
              <h2>Observações do Apontamento</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setObsModalOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <label className="form-grid-3__full">
                <span>Observação</span>
                <textarea
                  rows={5}
                  value={obsApontProdDraft}
                  maxLength={255}
                  onChange={(event) => setObsApontProdDraft(event.target.value.slice(0, 255))}
                  placeholder="Digite a observação do apontamento"
                />
              </label>
            </div>

            <div className="form-actions apontamento-producao-modal__actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setObsApontProd(obsApontProdDraft);
                  setObsModalOpen(false);
                }}
              >
                Confirmar
              </button>
            </div>
          </article>
        </section>
      )}

      {detalheOpen && detalheRow && detalheAtual && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide apontamento-producao-modal">
            <header className="modal-card__header">
              <h2>Consulta de Apontamento de Produção</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar consulta"
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
                <strong>{detalheAtual.numOrdem}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Operação</span>
                <strong>{detalheAtual.numOperacao}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Descrição operação</span>
                <strong>{detalheAtual.descricaoOperacao}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Código Produto</span>
                <strong>{detalheAtual.codigoProduto}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Descrição em Português</span>
                <strong>{detalheAtual.descricaoPortugues}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only">
                <span>Lote Apont</span>
                <strong>{detalheAtual.loteApont}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only">
                <span>Funcionário</span>
                <strong>{detalheAtual.numRegistro}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Máquina</span>
                <strong>{detalheAtual.numMaquina}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Parcial</span>
                <strong>{detalheAtual.parcial}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-mobile">
                <span>Data início</span>
                <strong>{detalheAtual.dataInicio}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-mobile">
                <span>Hora início</span>
                <strong>{detalheAtual.horaInicio}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-mobile">
                <span>Data fim</span>
                <strong>{detalheAtual.dataFim}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-mobile">
                <span>Hora fim</span>
                <strong>{detalheAtual.horaFim}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-desktop">
                <span>Início</span>
                <strong>{formatDateTimeLabel(detalheAtual.dataInicio, detalheAtual.horaInicio)}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only apontamento-producao-modal__date-time-desktop">
                <span>Fim</span>
                <strong>{formatDateTimeLabel(detalheAtual.dataFim, detalheAtual.horaFim)}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Motivo bloqueio</span>
                <strong>{detalheAtual.descricaoBloqueio || '-'}</strong>
              </div>

              <div className="apontamento-producao-modal__read-only">
                <span>Qtd. produzida</span>
                <strong>{detalheAtual.qtdProduzida}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Qtd. rejeitada</span>
                <strong>{detalheAtual.qtdRejeitada}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Mensagem</span>
                <strong>{detalheAtual.mensagem}</strong>
              </div>
            </div>

            <div className="form-actions apontamento-producao-modal__actions apontamento-producao-modal__actions--split">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setObsConsultaOpen(true)}
              >
                Observações
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDetalheOpen(false);
                  setDetalheRow(null);
                  setObsConsultaOpen(false);
                }}
              >
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {obsConsultaOpen && detalheAtual && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card apontamento-producao-modal">
            <header className="modal-card__header">
              <h2>Observações do Apontamento</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setObsConsultaOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="form-grid-3">
              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Observação</span>
                <strong>{detalheAtual.obsApontProd || '-'}</strong>
              </div>
            </div>

            <div className="form-actions apontamento-producao-modal__actions">
              <button className="secondary-button" type="button" onClick={() => setObsConsultaOpen(false)}>
                Fechar
              </button>
            </div>
          </article>
        </section>
      )}

      {finalizarOpen && finalizarRow && finalizarAtual && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide apontamento-producao-modal">
            <header className="modal-card__header">
              <h2>Finalizar Apontamento Cronômetro</h2>
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
                <span>Operação</span>
                <strong>{finalizarAtual.operacao}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Máquina</span>
                <strong>{finalizarAtual.maquina}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Funcionário</span>
                <strong>{finalizarAtual.funcionario}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__read-only">
                <span>Produto</span>
                <strong>
                  {finalizarAtual.produto !== '-' && finalizarAtual.descricaoProduto !== '-'
                    ? `${finalizarAtual.produto} - ${finalizarAtual.descricaoProduto}`
                    : finalizarAtual.produto}
                </strong>
              </div>

              <div className="apontamento-producao-modal__read-only">
                <span>Data início</span>
                <strong>{finalizarAtual.inicioData || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Hora início</span>
                <strong>{finalizarAtual.inicioHora || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Data fim</span>
                <strong>{finalizarConfirmacao.data || '-'}</strong>
              </div>
              <div className="apontamento-producao-modal__read-only">
                <span>Hora fim</span>
                <strong>{finalizarConfirmacao.hora || '-'}</strong>
              </div>

              <div className="form-grid-3__full apontamento-producao-modal__quantidades">
                <label>
                  <span>Qtd. produzida</span>
                  <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                    <input
                      className={finalizarErrors.qtdProduzida ? 'module-input-error' : ''}
                      value={finalizarForm.qtdProduzida}
                      inputMode="decimal"
                      onChange={(event) => {
                        setFinalizarForm((prev) => ({ ...prev, qtdProduzida: event.target.value }));
                        if (finalizarErrors.qtdProduzida) setFinalizarErrors((prev) => ({ ...prev, qtdProduzida: undefined }));
                      }}
                    />
                    {finalizarForm.qtdProduzida.trim() ? (
                      <button
                        type="button"
                        className="field-clear-button"
                        aria-label="Limpar quantidade produzida"
                        title="Limpar"
                        onClick={() => setFinalizarForm((prev) => ({ ...prev, qtdProduzida: '' }))}
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                  {finalizarErrors.qtdProduzida ? <small className="module-field-error">{finalizarErrors.qtdProduzida}</small> : null}
                </label>

                <label>
                  <span>Qtd. rejeitada</span>
                  <div className="apontamento-producao-modal-field apontamento-producao-modal-field--clearable">
                    <input
                      className={finalizarErrors.qtdRejeitada ? 'module-input-error' : ''}
                      value={finalizarForm.qtdRejeitada}
                      inputMode="decimal"
                      onChange={(event) => {
                        setFinalizarForm((prev) => ({ ...prev, qtdRejeitada: event.target.value }));
                        if (finalizarErrors.qtdRejeitada) setFinalizarErrors((prev) => ({ ...prev, qtdRejeitada: undefined }));
                      }}
                    />
                    {finalizarForm.qtdRejeitada.trim() ? (
                      <button
                        type="button"
                        className="field-clear-button"
                        aria-label="Limpar quantidade rejeitada"
                        title="Limpar"
                        onClick={() => setFinalizarForm((prev) => ({ ...prev, qtdRejeitada: '' }))}
                      >
                        <IoCloseCircleOutline size={16} />
                      </button>
                    ) : null}
                  </div>
                  {finalizarErrors.qtdRejeitada ? <small className="module-field-error">{finalizarErrors.qtdRejeitada}</small> : null}
                </label>
              </div>

              {qtdRejeitadaInformadaFinalizar ? (
                <div className="form-grid-3__full">
                  <label>
                    <span>Motivo bloqueio</span>
                    <SearchableSelect
                      value={finalizarForm.codigoBloqueio}
                      onChange={(nextValue) => {
                        setFinalizarForm((prev) => ({ ...prev, codigoBloqueio: nextValue }));
                        if (finalizarErrors.codigoBloqueio) setFinalizarErrors((prev) => ({ ...prev, codigoBloqueio: undefined }));
                      }}
                      options={motivoBloqueioOptions}
                      ariaLabel="Motivo bloqueio"
                      searchPlaceholder="Pesquisar motivo de bloqueio"
                      className={finalizarErrors.codigoBloqueio ? 'is-error' : undefined}
                      dropUp
                    />
                    {finalizarErrors.codigoBloqueio ? <small className="module-field-error">{finalizarErrors.codigoBloqueio}</small> : null}
                  </label>
                </div>
              ) : null}
            </div>

            <div className="form-actions apontamento-producao-modal__actions">
              <button className="primary-button" type="button" onClick={() => void handleFinalizarCronometro()} disabled={finalizando}>
                {finalizando ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
