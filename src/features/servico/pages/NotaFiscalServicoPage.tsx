import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoAlertCircleOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoCodeSlashOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { APP_VERSION } from '../../../constants/appInfo';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { obterNotasFiscaisServicoCall, obterNotaFiscalServicoModCall, enviarDPSCall, obterOcorrenciasNotaFiscalCall, listaCondicaoPagtoCall, listaServicosCall, obterClientesFornecedoresCall, obterEmpresasSeriesNFCall } from '../../../services/apiCalls';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { AdvancedFiltersPanel } from '../../../components/AdvancedFiltersPanel';
import { ListSearchField } from '../../../components/ListSearchField';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { CustomTimePicker } from '../../../components/CustomTimePicker';

type NotaFiscal = {
  num_Nota_Fiscal?: string | number | null;
  serie?: string | null;
  data_Emissao?: string | null;
  nome_Fantasia?: string | null;
  situacao_Nota?: number | null;
  autorizado?: string | null;
  ultimaOcorrencia?: string | null;
  [key: string]: any;
};

type NovaNotaFiscalForm = {
  tipo: string;
  serie: string;
  numNotaFiscal: string;
  dataEmissao: string;
  horaEmissao: string;
  codigoDestinatario: string;
  tipoDestinatario: string;
  nomeDestinatario: string;
  condPagto: string;
  codigoServico: string;
  nomeServico: string;
  descricao: string;
  tipoServ: string;
  atividade: string;
  codTribNac: string;
  tribISSQN: string;
  retISSQN: string;
  valorServico: string;
  inssBase: string;
  inssValor: string;
  inssValorSubcontratados: string;
  inssValorNaoRetido: string;
  inssAdicionalValor: string;
  inssAdicionalNaoRetido: string;
  tipoRetencao: string;
  irrf: string;
  iss: string;
  pis: string;
  cofins: string;
  csll: string;
  pisRetido: string;
  cofinsRetido: string;
  csllRetido: string;
  valor15anos: string;
  valor20anos: string;
  valor25anos: string;
  alterarValorReceber: boolean;
  valorReceber: string;
};

const formatToday = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const makeFormNova = (): NovaNotaFiscalForm => ({
  tipo: 'nfse_nacional',
  serie: '',
  numNotaFiscal: '',
  dataEmissao: formatToday(),
  horaEmissao: formatCurrentTime(),
  codigoDestinatario: '',
  tipoDestinatario: '',
  nomeDestinatario: '',
  condPagto: '',
  codigoServico: '',
  nomeServico: '',
  descricao: '',
  tipoServ: '',
  atividade: '',
  codTribNac: '',
  tribISSQN: '',
  retISSQN: '',
  valorServico: '',
  inssBase: '',
  inssValor: '',
  inssValorSubcontratados: '',
  inssValorNaoRetido: '',
  inssAdicionalValor: '',
  inssAdicionalNaoRetido: '',
  tipoRetencao: '',
  irrf: '',
  iss: '',
  pis: '',
  cofins: '',
  csll: '',
  pisRetido: '',
  cofinsRetido: '',
  csllRetido: '',
  valor15anos: '',
  valor20anos: '',
  valor25anos: '',
  alterarValorReceber: false,
  valorReceber: '',
});

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const asText = (value: any) => String(value ?? '');

const getSituacaoLabel = (situacao: number | null | undefined): string => {
  switch (situacao) {
    case 0:
    case 1:
      return 'Emitida';
    case 2:
      return 'Enviada';
    case 3:
      return 'Gerada';
    case 4:
      return 'Entregue';
    case 8:
      return 'Devolvida';
    case 9:
      return 'Cancelada';
    default:
      return ' ';
  }
};

const getSituacaoClass = (situacao: number | null | undefined): string => {
  switch (situacao) {
    case 0:
    case 1:
      return 'nfs-situacao--emitida';
    case 2:
      return 'nfs-situacao--enviada';
    case 3:
      return 'nfs-situacao--gerada';
    case 4:
      return 'nfs-situacao--entregue';
    case 8:
      return 'nfs-situacao--devolvida';
    case 9:
      return 'nfs-situacao--cancelada';
    default:
      return '';
  }
};

const OPTIONS_TRIB_ISSQN = [
  { value: '', label: 'Selecione...' },
  { value: '1', label: 'Tributável' },
  { value: '2', label: 'Imune' },
  { value: '3', label: 'Exportação' },
  { value: '4', label: 'Não Incidência' },
];

const OPTIONS_RET_ISSQN = [
  { value: '', label: 'Selecione...' },
  { value: '1', label: 'Não Retido' },
  { value: '2', label: 'Retido na Fonte' },
  { value: '3', label: 'Não Incidente' },
];

const OPTIONS_TIPO_RETENCAO = [
  { value: '', label: 'Selecione...' },
  { value: '0', label: 'PIS/COFINS/CSLL Não Retidos' },
  { value: '3', label: 'PIS/COFINS/CSLL Retidos' },
  { value: '4', label: 'PIS/COFINS Retidos, CSLL Não Retido' },
  { value: '5', label: 'PIS Retido, COFINS/CSLL Não Retidos' },
  { value: '6', label: 'COFINS Retido, PIS/CSLL Não Retidos' },
  { value: '7', label: 'PIS Não Retido, COFINS/CSLL Retidos' },
  { value: '8', label: 'PIS/COFINS Não Retidos, CSLL Retido' },
  { value: '9', label: 'COFINS Não Retido, PIS/CSLL Retidos' },
];

const normalizeText = (value: any) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const parseDateForSort = (value: any) => {
  const d = new Date(String(value ?? '').trim());
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
};

const isoToDisplay = (value: any): string => {
  const s = String(value ?? '').slice(0, 10);
  const [y, m, d] = s.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

type SortField = 'nota' | 'serie' | 'data' | 'destinatario' | 'situacao';
type SortDirection = 'asc' | 'desc';

type OcorrenciaItem = {
  num_Ocorrencia: number;
  codigo_Ocorrencia: number;
  descricao: string;
  data_Ocorrencia: string;
  hora_Ocorrencia: string;
};

const fmtOcorrenciaData = (iso: string): string => {
  const s = String(iso ?? '').slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y.slice(2)}`;
};

const fmtOcorrenciaHora = (iso: string): string => {
  const s = String(iso ?? '');
  const t = s.includes('T') ? (s.split('T')[1] ?? '') : s;
  return t.slice(0, 8);
};

export function NotaFiscalServicoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotaFiscal[]>([]);
  const [novaNotaOpen, setNovaNotaOpen] = useState(false);
  const [formNova, setFormNova] = useState<NovaNotaFiscalForm>(makeFormNova);
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [formErrors, setFormErrors] = useState<Set<string>>(new Set());
  const [clientesFornRaw, setClientesFornRaw] = useState<any[]>([]);
  const [servicosRaw, setServicosRaw] = useState<any[]>([]);
  const [clientesFornOptions, setClientesFornOptions] = useState<{ value: string; label: string }[]>([]);
  const [condPagtoOptions, setCondPagtoOptions] = useState<{ value: string; label: string }[]>([]);
  const [servicosOptions, setServicosOptions] = useState<{ value: string; label: string }[]>([]);
  const [seriesRaw, setSeriesRaw] = useState<{ serie_NF: string; tipo_Nota: string; ultima_NF: number }[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<{ value: string; label: string }[]>([]);
  const [carregandoListas, setCarregandoListas] = useState(false);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [consultaForm, setConsultaForm] = useState<NovaNotaFiscalForm>(makeFormNova);
  const [carregandoConsulta, setCarregandoConsulta] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [reenvioConfirmRow, setReenvioConfirmRow] = useState<NotaFiscal | null>(null);
  const [reenvioLoading, setReenvioLoading] = useState(false);
  const [historicoRow, setHistoricoRow] = useState<NotaFiscal | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoChaveAcesso, setHistoricoChaveAcesso] = useState('');
  const [historicoOcorrencias, setHistoricoOcorrencias] = useState<OcorrenciaItem[]>([]);
  const [ocorrenciaDetalhe, setOcorrenciaDetalhe] = useState<OcorrenciaItem | null>(null);

  // Filtros
  const [dataInicio, setDataInicio] = useState(formatToday());
  const [dataFim, setDataFim] = useState(formatToday());
  const [numNF, setNumNF] = useState('');
  const [serie, setSerie] = useState('');

  const initialLoadRef = useRef(false);

  const carregar = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token || !codEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await obterNotasFiscaisServicoCall(baseUrl, token, {
        codigoEmpresa: codEmpresa,
        dataInicio: dataInicio.trim() || formatToday(),
        dataFim: dataFim.trim() || formatToday(),
        tipoNota: 'S',
        numNotaFiscal: numNF.trim() || undefined,
        serie: serie.trim() || undefined,
      });

      if (!resp.succeeded) {
        setRows([]);
        showToast('Não foi possível carregar as notas fiscais.', 'error');
        return;
      }

      const lista: NotaFiscal[] = getRows(resp.jsonBody ?? resp.data);
      setRows(lista);
    } catch (err: any) {
      setRows([]);
      showToast(err?.message || 'Erro ao carregar notas fiscais.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, numNF, serie, showToast]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  const handleApplyFiltros = useCallback(() => {
    setFiltrosOpen(false);
    void carregar();
  }, [carregar]);

  const handleFieldNova = useCallback((field: keyof NovaNotaFiscalForm, value: string | boolean) => {
    setFormNova((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => { if (!prev.has(field as string)) return prev; const next = new Set(prev); next.delete(field as string); return next; });
  }, []);

  const handleSerieNova = useCallback((serieNF: string) => {
    setFormErrors((prev) => { if (!prev.has('serie')) return prev; const next = new Set(prev); next.delete('serie'); return next; });
    setFormNova((prev) => {
      const found = seriesRaw.find((s) => s.serie_NF === serieNF);
      const proxNF = found ? String(found.ultima_NF + 1).padStart(6, '0') : prev.numNotaFiscal;
      return { ...prev, serie: serieNF, numNotaFiscal: proxNF };
    });
  }, [seriesRaw]);

  const carregarListasComuns = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) return;
    const codEmpresa = GlobalConfig.getCodEmpresa();
    setCarregandoListas(true);
    try {
      const [resCliForn, resCond, resServicos, resSeries] = await Promise.allSettled([
        obterClientesFornecedoresCall(baseUrl, token),
        listaCondicaoPagtoCall(baseUrl, token),
        listaServicosCall(baseUrl, token, { tipoServico: 'Faturamento' }),
        obterEmpresasSeriesNFCall(baseUrl, token, { codigoEmpresa: codEmpresa as number, tipoNota: 'S' }),
      ]);

      // Clientes/Fornecedores
      if (resCliForn.status === 'fulfilled' && resCliForn.value.succeeded) {
        const body = resCliForn.value.jsonBody ?? resCliForn.value.data;
        const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setClientesFornRaw(lista);
        setClientesFornOptions([
          { value: '', label: 'Selecione...' },
          ...lista.map((c: any) => {
            const tipo = String(c.tipo ?? '').toUpperCase();
            const tipoLabel = tipo === 'C' ? 'Cliente' : tipo === 'F' ? 'Fornecedor' : tipo;
            const cgc = c.num_CGC ? ` | ${c.num_CGC}` : '';
            return {
              value: `${tipo}-${c.codigo ?? ''}`,
              label: `${c.nome_Fantasia ?? c.razao_Social ?? ''}${cgc} | ${tipoLabel}`,
            };
          }),
        ]);
      }

      // Cond. pagto
      if (resCond.status === 'fulfilled' && resCond.value.succeeded) {
        const body = resCond.value.jsonBody ?? resCond.value.data;
        const lista: any[] = Array.isArray(body) ? body
          : Array.isArray(body?.data) ? body.data
            : Array.isArray(body?.listaCondicaoPagto) ? body.listaCondicaoPagto
              : Array.isArray(body?.ListaCondicaoPagto) ? body.ListaCondicaoPagto
                : Array.isArray(body?.condicaoPagto) ? body.condicaoPagto
                  : Array.isArray(body?.CondicaoPagto) ? body.CondicaoPagto
                    : Array.isArray(body?.condicoes) ? body.condicoes
                      : Array.isArray(body?.Condicoes) ? body.Condicoes
                        : [];
        const condCandidates: [string, string][] = [
          ['condicao_Pagamento', 'descr_Condicao'],
          ['Condicao_Pagamento', 'Descr_Condicao'],
          ['condicao_Pagto', 'descr_Condicao'],
          ['Condicao_Pagto', 'Descr_Condicao'],
          ['condicao_Pagto', 'descricao_Condicao'],
          ['Condicao_Pagto', 'Descricao_Condicao'],
          ['CondicaoPagto', 'Descricao_Condicao'],
          ['condicaoPagto', 'descricao_Condicao'],
          ['CondicaoPagto', 'Descricao'],
          ['condicaoPagto', 'descricao'],
          ['codigo', 'descricao_Condicao'],
          ['Codigo', 'Descricao_Condicao'],
          ['codigo', 'descricao'],
          ['Codigo', 'Descricao'],
          ['id', 'descricao'],
        ];
        // Replica o toOptions do NovoPedidoVendaPage: dois passes
        const buildOption = (c: any): { value: string; label: string } | null => {
          // 1ª passagem: exige value E label não-vazios
          for (const [vk, lk] of condCandidates) {
            const v = String(c[vk] ?? '').trim();
            const l = String(c[lk] ?? '').trim();
            if (v && l) return { value: v, label: l };
          }
          // 2ª passagem: aceita só value, usa value como label se necessário
          for (const [vk, lk] of condCandidates) {
            const v = String(c[vk] ?? '').trim();
            const l = String(c[lk] ?? '').trim();
            if (v) return { value: v, label: l || v };
          }
          return null;
        };
        setCondPagtoOptions([
          { value: '', label: 'Selecione...' },
          ...lista.map(buildOption).filter((o): o is { value: string; label: string } => o !== null),
        ]);
      }

      // Serviços
      if (resServicos.status === 'fulfilled' && resServicos.value.succeeded) {
        const body = resServicos.value.jsonBody ?? resServicos.value.data;
        const lista: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setServicosRaw(lista);
        setServicosOptions([
          { value: '', label: 'Selecione...' },
          ...lista.map((s: any) => ({
            value: String(s.codigo_Servico ?? s.Codigo_Servico ?? ''),
            label: String(s.descr_Resumida ?? s.Descr_Resumida ?? ''),
          })),
        ]);
      }

      // Séries
      if (resSeries.status === 'fulfilled' && resSeries.value.succeeded) {
        const body = resSeries.value.jsonBody ?? resSeries.value.data;
        const lista: { serie_NF: string; tipo_Nota: string; ultima_NF: number }[] =
          Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setSeriesRaw(lista);
        setSeriesOptions(
          lista.map((s) => ({
            value: s.serie_NF,
            label: `${s.serie_NF} - ${s.tipo_Nota} - ${String(s.ultima_NF).padStart(6, '0')}`,
          })),
        );
      }
    } finally {
      setCarregandoListas(false);
    }
  }, []);

  const abrirNovaNotaFiscal = useCallback(async () => {
    setFormNova(makeFormNova());
    setNovaNotaOpen(true);
    await carregarListasComuns();
  }, [carregarListasComuns]);

  const abrirConsulta = useCallback(async (numNota: string, serNota: string, dataEmissao: string) => {
    setConsultaOpen(true);
    setCarregandoConsulta(true);
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codEmpresa) {
      setCarregandoConsulta(false);
      return;
    }
    try {
      const [, resNF] = await Promise.allSettled([
        carregarListasComuns(),
        obterNotaFiscalServicoModCall(baseUrl, token, { codigoEmpresa: codEmpresa, numNota, serNota }),
      ]);
      if (resNF.status === 'fulfilled' && resNF.value.succeeded) {
        const d = resNF.value.jsonBody ?? resNF.value.data;

        // Garante que o serviço da nota está nas opções (pode não estar no filtro por tipo)
        let nomeServicoDaNota = '';
        if (d.codServico != null) {
          const resServico = await listaServicosCall(baseUrl, token, { codigoServico: Number(d.codServico) });
          if (resServico.succeeded) {
            const svcBody = resServico.jsonBody ?? resServico.data;
            const svcLista: any[] = Array.isArray(svcBody) ? svcBody : Array.isArray(svcBody?.data) ? svcBody.data : [];
            if (svcLista.length > 0) {
              const svc = svcLista[0];
              const svcValue = String(svc.codigo_Servico ?? '');
              nomeServicoDaNota = String(svc.descr_Resumida ?? svcValue);
              setServicosOptions((prev) => {
                if (prev.some((o) => o.value === svcValue)) return prev;
                return [...prev, { value: svcValue, label: nomeServicoDaNota }];
              });
            }
          }
        }

        const fmtNum = (v: any): string => {
          if (v == null) return '';
          const n = Number(v);
          return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '';
        };
        setConsultaForm({
          tipo: d.tipoNFServico === 1 ? 'nfse_nacional' : 'nf_servico',
          serie: String(d.serNota ?? ''),
          numNotaFiscal: String(d.numNota ?? ''),
          dataEmissao: isoToDisplay(dataEmissao),
          horaEmissao: '',
          codigoDestinatario: `${String(d.tipoDestinatario ?? '')}-${String(d.codDestinatario ?? '')}`,
          tipoDestinatario: String(d.tipoDestinatario ?? ''),
          nomeDestinatario: '',
          condPagto: String(d.condPagamento ?? ''),
          codigoServico: String(d.codServico ?? ''),
          nomeServico: nomeServicoDaNota || String(d.descricaoServico ?? ''),
          descricao: String(d.descricaoServico ?? ''),
          tipoServ: String(d.classServMOEmp ?? ''),
          atividade: String(d.codAtivEconomica ?? ''),
          codTribNac: String(d.cTribNacional ?? ''),
          tribISSQN: String(d.tribISSQN ?? ''),
          retISSQN: String(d.retISSQN ?? ''),
          valorServico: fmtNum(d.valorServico),
          inssBase: fmtNum(d.valorBaseINSS),
          inssValor: fmtNum(d.valorINSS),
          inssValorSubcontratados: fmtNum(d.valorINSSsUB),
          inssValorNaoRetido: fmtNum(d.valorINSSNaoRet),
          inssAdicionalValor: fmtNum(d.valorINSSAdic),
          inssAdicionalNaoRetido: fmtNum(d.valorINSSAdicNaoRet),
          tipoRetencao: String(d.tpRetPisCofins ?? ''),
          irrf: fmtNum(d.valorIRRF),
          iss: fmtNum(d.valorISS),
          pis: fmtNum(d.valorPIS),
          cofins: fmtNum(d.valorCOFINS),
          csll: fmtNum(d.valorCSLL),
          pisRetido: fmtNum(d.valorPISRet),
          cofinsRetido: fmtNum(d.valorCOFINSRet),
          csllRetido: fmtNum(d.valorCSLLRet),
          valor15anos: fmtNum(d.valorServ15),
          valor20anos: fmtNum(d.valorServ20),
          valor25anos: fmtNum(d.valorServ25),
          alterarValorReceber: Boolean(d.alteraValor),
          valorReceber: fmtNum(d.valorReceber),
        });
      } else {
        showToast('Não foi possível carregar a nota fiscal.', 'error');
        setConsultaOpen(false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar nota fiscal.', 'error');
      setConsultaOpen(false);
    } finally {
      setCarregandoConsulta(false);
    }
  }, [carregarListasComuns, showToast]);

  const handleEmitirNF = useCallback(async () => {
    const isNfse = formNova.tipo === 'nfse_nacional';
    const isNfServico = formNova.tipo === 'nf_servico';

    const parseNum = (v: string): number => {
      const s = String(v ?? '').replace(/\./g, '').replace(',', '.').trim();
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };
    const parseIntSafe = (v: string): number => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    };

    const invalidFields = new Set<string>();
    if (!formNova.serie.trim()) invalidFields.add('serie');
    if (!formNova.numNotaFiscal.trim()) invalidFields.add('numNotaFiscal');
    if (!formNova.codigoDestinatario) invalidFields.add('codigoDestinatario');
    if (!formNova.condPagto) invalidFields.add('condPagto');
    if (!formNova.codigoServico) invalidFields.add('codigoServico');
    if (!formNova.descricao.trim()) invalidFields.add('descricao');
    if (isNfse) {
      if (!formNova.codTribNac.trim()) invalidFields.add('codTribNac');
      if (!formNova.tribISSQN) invalidFields.add('tribISSQN');
      if (!formNova.retISSQN) invalidFields.add('retISSQN');
      if (!formNova.tipoRetencao) invalidFields.add('tipoRetencao');
    }
    if (isNfServico) {
      if (!formNova.tipoServ.trim()) invalidFields.add('tipoServ');
      if (!formNova.atividade.trim()) invalidFields.add('atividade');
    }
    if (invalidFields.size > 0) {
      setFormErrors(invalidFields);
      return;
    }
    setFormErrors(new Set());

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    const codDest = parseIntSafe(formNova.codigoDestinatario.split('-')[1] ?? '');

    setSalvandoNova(true);
    try {
      const resp = await enviarDPSCall(baseUrl, token, {
        CodigoEmpresa: codEmpresa,
        TipoNFServico: isNfse ? 1 : 2,
        ReenvioXML: false,
        NumNota: formNova.numNotaFiscal.trim(),
        SerNota: formNova.serie.trim(),
        CodDestinatario: codDest,
        TipoDestinatario: formNova.tipoDestinatario,
        CondPagamento: parseIntSafe(formNova.condPagto),
        CodServico: parseIntSafe(formNova.codigoServico),
        DescricaoServico: formNova.descricao.trim(),
        ClassServMOEmp: formNova.tipoServ.trim(),
        CodAtivEconomica: formNova.atividade.trim(),
        CTribNacional: formNova.codTribNac.trim(),
        ValorServico: parseNum(formNova.valorServico),
        ValorBaseINSS: parseNum(formNova.inssBase),
        ValorINSS: parseNum(formNova.inssValor),
        ValorINSSsUB: parseNum(formNova.inssValorSubcontratados),
        ValorINSSNaoRet: parseNum(formNova.inssValorNaoRetido),
        ValorINSSAdic: parseNum(formNova.inssAdicionalValor),
        ValorINSSAdicNaoRet: parseNum(formNova.inssAdicionalNaoRetido),
        ValorServ15: parseNum(formNova.valor15anos),
        ValorServ20: parseNum(formNova.valor20anos),
        ValorServ25: parseNum(formNova.valor25anos),
        ValorIRRF: parseNum(formNova.irrf),
        ValorISS: parseNum(formNova.iss),
        ValorCSLL: parseNum(formNova.csll),
        ValorPIS: parseNum(formNova.pis),
        ValorCOFINS: parseNum(formNova.cofins),
        AlteraValor: formNova.alterarValorReceber,
        ValorReceber: parseNum(formNova.valorReceber),
        TribISSQN: parseIntSafe(formNova.tribISSQN),
        RetISSQN: parseIntSafe(formNova.retISSQN),
        AliqISSQN: 0,
        TpRetPisCofins: parseIntSafe(formNova.tipoRetencao),
        ValorPISRet: parseNum(formNova.pisRetido),
        ValorCOFINSRet: parseNum(formNova.cofinsRetido),
        ValorCSLLRet: parseNum(formNova.csllRetido),
        Usuario: GlobalConfig.getUsuario(),
        versao: APP_VERSION,
      });
      if (resp.succeeded) {
        showToast('Nota fiscal emitida com sucesso!', 'success');
      } else {
        const msg = resp.jsonBody?.message ?? resp.jsonBody?.Message ?? 'Erro ao emitir nota fiscal.';
        showToast(String(msg), 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao emitir nota fiscal.', 'error');
    } finally {
      setSalvandoNova(false);
      setNovaNotaOpen(false);
      void carregar();
    }
  }, [formNova, showToast, carregar]);

  const handleReenvioClick = useCallback((e: React.MouseEvent, row: NotaFiscal) => {
    e.stopPropagation();
    const autNorm = String(row.autorizado ?? '').trim().toUpperCase();
    const isAutorizado = autNorm === 'S' || autNorm === 'SIM' || autNorm === 'Y' || autNorm === 'YES' || autNorm === '1' || autNorm === 'TRUE';
    if (isAutorizado) {
      showToast('Essa nota já está autorizada!', 'info');
      return;
    }
    setReenvioConfirmRow(row);
  }, [showToast]);

  const handleConfirmarReenvio = useCallback(async () => {
    if (!reenvioConfirmRow) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codEmpresa) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }
    setReenvioLoading(true);
    try {
      const resNF = await obterNotaFiscalServicoModCall(baseUrl, token, {
        codigoEmpresa: codEmpresa,
        numNota: String(reenvioConfirmRow.num_Nota_Fiscal ?? ''),
        serNota: String(reenvioConfirmRow.serie ?? ''),
      });
      if (!resNF.succeeded) {
        showToast('Não foi possível carregar os dados da nota fiscal.', 'error');
        return;
      }
      const d = resNF.jsonBody ?? resNF.data;
      const resp = await enviarDPSCall(baseUrl, token, {
        CodigoEmpresa: codEmpresa,
        TipoNFServico: d.tipoNFServico ?? 1,
        ReenvioXML: true,
        NumNota: String(d.numNota ?? ''),
        SerNota: String(d.serNota ?? ''),
        CodDestinatario: Number(d.codDestinatario ?? 0),
        TipoDestinatario: String(d.tipoDestinatario ?? ''),
        CondPagamento: Number(d.condPagamento ?? 0),
        CodServico: Number(d.codServico ?? 0),
        DescricaoServico: String(d.descricaoServico ?? ''),
        ClassServMOEmp: String(d.classServMOEmp ?? ''),
        CodAtivEconomica: String(d.codAtivEconomica ?? ''),
        CTribNacional: String(d.cTribNacional ?? ''),
        ValorServico: Number(d.valorServico ?? 0),
        ValorBaseINSS: Number(d.valorBaseINSS ?? 0),
        ValorINSS: Number(d.valorINSS ?? 0),
        ValorINSSsUB: Number(d.valorINSSsUB ?? 0),
        ValorINSSNaoRet: Number(d.valorINSSNaoRet ?? 0),
        ValorINSSAdic: Number(d.valorINSSAdic ?? 0),
        ValorINSSAdicNaoRet: Number(d.valorINSSAdicNaoRet ?? 0),
        ValorServ15: Number(d.valorServ15 ?? 0),
        ValorServ20: Number(d.valorServ20 ?? 0),
        ValorServ25: Number(d.valorServ25 ?? 0),
        ValorIRRF: Number(d.valorIRRF ?? 0),
        ValorISS: Number(d.valorISS ?? 0),
        ValorCSLL: Number(d.valorCSLL ?? 0),
        ValorPIS: Number(d.valorPIS ?? 0),
        ValorCOFINS: Number(d.valorCOFINS ?? 0),
        AlteraValor: Boolean(d.alteraValor ?? false),
        ValorReceber: Number(d.valorReceber ?? 0),
        TribISSQN: Number(d.tribISSQN ?? 0),
        RetISSQN: Number(d.retISSQN ?? 0),
        AliqISSQN: 0,
        TpRetPisCofins: Number(d.tpRetPisCofins ?? 0),
        ValorPISRet: Number(d.valorPISRet ?? 0),
        ValorCOFINSRet: Number(d.valorCOFINSRet ?? 0),
        ValorCSLLRet: Number(d.valorCSLLRet ?? 0),
        Usuario: GlobalConfig.getUsuario(),
        versao: APP_VERSION,
      });
      if (resp.succeeded) {
        showToast('XML reenviado com sucesso!', 'success');
      } else {
        const msg = resp.jsonBody?.message ?? resp.jsonBody?.Message ?? 'Erro ao reenviar XML.';
        showToast(String(msg), 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao reenviar XML.', 'error');
    } finally {
      setReenvioLoading(false);
      setReenvioConfirmRow(null);
      void carregar();
    }
  }, [reenvioConfirmRow, showToast, carregar]);

  const abrirHistorico = useCallback(async (e: React.MouseEvent, row: NotaFiscal) => {
    e.stopPropagation();
    setHistoricoRow(row);
    setHistoricoChaveAcesso(String(row.chave_Acesso_NFe ?? row.chaveAcessoNFe ?? ''));
    setHistoricoOcorrencias([]);
    setHistoricoLoading(true);
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codEmpresa = GlobalConfig.getCodEmpresa();
    if (!baseUrl || !token || !codEmpresa) {
      setHistoricoLoading(false);
      return;
    }
    try {
      const resOcorr = await obterOcorrenciasNotaFiscalCall(baseUrl, token, {
        codigoEmpresa: codEmpresa,
        numNota: String(row.num_Nota_Fiscal ?? ''),
        serNota: String(row.serie ?? ''),
        ultimaOcorrencia: false,
      });
      if (resOcorr.succeeded) {
        const body = resOcorr.jsonBody ?? resOcorr.data;
        const lista: OcorrenciaItem[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setHistoricoOcorrencias(lista);
      }
    } finally {
      setHistoricoLoading(false);
    }
  }, []);

  const rowsFiltradas = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    const filtered = !term
      ? rows
      : rows.filter((r) =>
        normalizeText(r.num_Nota_Fiscal).includes(term) ||
        normalizeText(r.serie).includes(term) ||
        normalizeText(r.nome_Fantasia).includes(term) ||
        normalizeText(getSituacaoLabel(r.situacao_Nota)).includes(term),
      );

    const collator = new Intl.Collator('pt-BR');
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'nota') comparison = Number(a.num_Nota_Fiscal ?? 0) - Number(b.num_Nota_Fiscal ?? 0);
      if (sortField === 'serie') comparison = collator.compare(String(a.serie ?? ''), String(b.serie ?? ''));
      if (sortField === 'data') comparison = parseDateForSort(a.data_Emissao) - parseDateForSort(b.data_Emissao);
      if (sortField === 'destinatario') comparison = collator.compare(String(a.nome_Fantasia ?? ''), String(b.nome_Fantasia ?? ''));
      if (sortField === 'situacao') comparison = (a.situacao_Nota ?? 0) - (b.situacao_Nota ?? 0);
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [rows, searchTerm, sortField, sortDirection]);

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

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Nota Fiscal de Serviço</h1>
            <p>Consulta de notas fiscais de serviço.</p>
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
              placeholder="Pesquisar nota, série, destinatário..."
            />

            <button
              className={`icon-button module-action-button${filtrosOpen ? ' module-action-button--primary' : ''}`}
              type="button"
              onClick={() => setFiltrosOpen(true)}
              title="Mostrar filtros avançados"
              aria-label="Mostrar filtros avançados"
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
              onClick={abrirNovaNotaFiscal}
              title="Nova nota fiscal"
              aria-label="Nova nota fiscal"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        <AdvancedFiltersPanel
          open={filtrosOpen}
          onClose={() => setFiltrosOpen(false)}
          onApply={handleApplyFiltros}
          applyDisabled={loading}
        >
          <div className="list-layout-extra-filters nfs-extra-filters">
            <label className="list-layout-field list-layout-field--date">
              <span>Data início</span>
              <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
            </label>

            <label className="list-layout-field list-layout-field--date">
              <span>Data fim</span>
              <CustomDatePicker value={dataFim} onChange={setDataFim} />
            </label>

            <label className="list-layout-field list-layout-field--md list-layout-field--clearable">
              <span>Número NF</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input
                  value={numNF}
                  onChange={(e) => setNumNF(e.target.value)}
                  placeholder="Número da nota fiscal"
                />
                {numNF.trim() ? (
                  <button type="button" className="field-clear-button" aria-label="Limpar" onClick={() => setNumNF('')}>
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>

            <label className="list-layout-field list-layout-field--sm list-layout-field--clearable">
              <span>Série</span>
              <div className="ordens-fabricacao-field__input-wrap">
                <input
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  placeholder="Série"
                />
                {serie.trim() ? (
                  <button type="button" className="field-clear-button" aria-label="Limpar" onClick={() => setSerie('')}>
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        </AdvancedFiltersPanel>

        <section className="module-table list-layout-table">
          {loading ? (
            <p className="module-empty">Carregando notas fiscais...</p>
          ) : rowsFiltradas.length === 0 ? (
            <p className="module-empty">Nenhuma nota fiscal encontrada.</p>
          ) : (
            <div className="table-scroll module-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('nota')}>
                        Nota <span>{getSortIndicator('nota')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('serie')}>
                        Série <span>{getSortIndicator('serie')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('data')}>
                        Data <span>{getSortIndicator('data')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('destinatario')}>
                        Destinatário <span>{getSortIndicator('destinatario')}</span>
                      </button>
                    </th>
                    <th>
                      <button className="module-table__sort" type="button" onClick={() => handleSort('situacao')}>
                        Situação <span>{getSortIndicator('situacao')}</span>
                      </button>
                    </th>
                    <th>Último retorno</th>
                    <th>Aut.</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltradas.map((row, idx) => {
                    const situacaoNum = row.situacao_Nota != null ? Number(row.situacao_Nota) : null;
                    return (
                      <tr
                        key={`${asText(row.num_Nota_Fiscal)}-${idx}`}
                        onClick={() => void abrirConsulta(String(row.num_Nota_Fiscal ?? ''), String(row.serie ?? ''), String(row.data_Emissao ?? ''))}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{asText(row.num_Nota_Fiscal) || '-'}</td>
                        <td>{asText(row.serie) || '-'}</td>
                        <td>{asText(row.data_Emissao)?.slice(0, 10).split('-').reverse().join('/') || '-'}</td>
                        <td>{asText(row.nome_Fantasia) || '-'}</td>
                        <td>
                          <span className={`nfs-situacao ${getSituacaoClass(situacaoNum)}`}>
                            {getSituacaoLabel(situacaoNum)}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const txt = asText(row.ultimaOcorrencia);
                            if (!txt) return '-';
                            const truncated = txt.length > 50 ? txt.slice(0, 50) + '…' : txt;
                            return <span title={txt.length > 50 ? txt : undefined}>{truncated}</span>;
                          })()}
                        </td>
                        <td>{asText(row.autorizado) || '-'}</td>
                        <td className="nfs-table-actions">
                          <button
                            type="button"
                            className="icon-button"
                            title="Reenviar Xml"
                            aria-label="Reenviar Xml"
                            onClick={(e) => handleReenvioClick(e, row)}
                          >
                            <IoCodeSlashOutline size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            title="Histórico de operações"
                            aria-label="Histórico de operações"
                            onClick={(e) => void abrirHistorico(e, row)}
                          >
                            <IoTimeOutline size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {novaNotaOpen && (() => {
        const isNfse = formNova.tipo === 'nfse_nacional';
        const isNfServico = formNova.tipo === 'nf_servico';
        return (
          <section className="modal-backdrop" role="dialog" aria-modal="true">
            <article className="modal-card modal-card--nfs-nova">
              <header className="modal-card__header">
                <h2>Nova Nota Fiscal de Serviço</h2>
                <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setNovaNotaOpen(false)}>
                  <IoCloseOutline size={18} />
                </button>
              </header>

              <div className="nfs-nova-body">
                <style>{`.searchable-select.nfs-error .searchable-select__control { border-color: #e53e3e !important; box-shadow: 0 0 0 2px rgba(229,62,62,.2) !important; }`}</style>
                {/* Tipo */}
                <div className="nfs-nova-radio-row">
                  <label>
                    <input
                      type="radio"
                      name="nfs-tipo"
                      value="nfse_nacional"
                      checked={formNova.tipo === 'nfse_nacional'}
                      onChange={() => handleFieldNova('tipo', 'nfse_nacional')}
                    />
                    NFSe Nacional
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="nfs-tipo"
                      value="nf_servico"
                      checked={formNova.tipo === 'nf_servico'}
                      onChange={() => handleFieldNova('tipo', 'nf_servico')}
                    />
                    NF Serviço
                  </label>
                </div>

                {/* Cabeçalho: Série | Nota Fiscal | Emissão */}
                <div className="nfs-nova-row nfs-nova-row--cabecalho">
                  <div className="nfs-nova-label">
                    <span>Série</span>
                    <SearchableSelect
                      options={seriesOptions}
                      value={formNova.serie}
                      onChange={handleSerieNova}
                      enableSearch={false}
                      disabled={carregandoListas}
                      className={formErrors.has('serie') ? 'nfs-error' : ''}
                      displayValue={formNova.serie || undefined}
                      minDropdownWidth={320}
                      listHeader={
                        <div className="searchable-select__col-row" style={{ gridTemplateColumns: '50px 1fr 72px' }}>
                          <span>Série</span>
                          <span>Tipo Nota</span>
                          <span style={{ textAlign: 'right' }}>Ult. NF</span>
                        </div>
                      }
                      renderOption={(opt) => {
                        const raw = seriesRaw.find((s) => s.serie_NF === opt.value);
                        return (
                          <div className="searchable-select__col-row" style={{ gridTemplateColumns: '50px 1fr 72px' }}>
                            <span>{raw?.serie_NF ?? opt.value}</span>
                            <span>{raw?.tipo_Nota ?? ''}</span>
                            <span style={{ textAlign: 'right' }}>{raw !== undefined ? String(raw.ultima_NF).padStart(6, '0') : ''}</span>
                          </div>
                        );
                      }}
                    />
                  </div>
                  <label className="nfs-nova-label">
                    <span>Nota Fiscal</span>
                    <input
                      value={formNova.numNotaFiscal}
                      onChange={(e) => handleFieldNova('numNotaFiscal', e.target.value)}
                      style={formErrors.has('numNotaFiscal') ? { borderColor: '#e53e3e' } : undefined}
                    />
                  </label>
                  <div className="nfs-nova-label">
                    <span>Emissão</span>
                    <div className="nfs-nova-emissao-group">
                      <CustomDatePicker value={formNova.dataEmissao} onChange={(v) => handleFieldNova('dataEmissao', v)} />
                      <span>ás</span>
                      <CustomTimePicker value={formNova.horaEmissao} onChange={(v) => handleFieldNova('horaEmissao', v)} stepMinutes={1} />
                    </div>
                  </div>
                </div>

                {/* Destinatário */}
                <div className="nfs-nova-row nfs-nova-row--destinatario">
                  <div className="nfs-nova-label">
                    <span>Destinatário</span>
                    <SearchableSelect
                      options={clientesFornOptions}
                      value={formNova.codigoDestinatario}
                      onChange={(v) => {
                        handleFieldNova('codigoDestinatario', v);
                        const tipo = v.split('-')[0] ?? '';
                        handleFieldNova('tipoDestinatario', tipo);
                        const found = clientesFornRaw.find((c: any) => `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}` === v);
                        handleFieldNova('nomeDestinatario', found ? String(found.nome_Fantasia ?? found.razao_Social ?? '') : '');
                      }}
                      enableSearch
                      searchPlaceholder="Pesquisar..."
                      disabled={carregandoListas}
                      className={formErrors.has('codigoDestinatario') ? 'nfs-error' : ''}
                      displayValue={formNova.nomeDestinatario || undefined}
                      listHeader={
                        <div className="searchable-select__col-row" style={{ gridTemplateColumns: '1fr 140px 90px' }}>
                          <span>Nome</span>
                          <span>CNPJ/CPF</span>
                          <span>Tipo</span>
                        </div>
                      }
                      renderOption={(opt) => {
                        const raw = clientesFornRaw.find((c) => `${String(c.tipo ?? '').toUpperCase()}-${c.codigo ?? ''}` === opt.value);
                        return (
                          <div className="searchable-select__col-row" style={{ gridTemplateColumns: '1fr 140px 90px' }}>
                            <span>{raw?.nome_Fantasia ?? raw?.razao_Social ?? opt.label}</span>
                            <span>{raw?.num_CGC ?? ''}</span>
                            <span>{raw?.tipo?.toUpperCase() === 'C' ? 'Cliente' : raw?.tipo?.toUpperCase() === 'F' ? 'Fornecedor' : ''}</span>
                          </div>
                        );
                      }}
                    />
                  </div>
                  <label className="nfs-nova-label">
                    <span>Tipo</span>
                    <input
                      readOnly
                      value={
                        formNova.tipoDestinatario === 'C' ? 'Cliente'
                          : formNova.tipoDestinatario === 'F' ? 'Fornecedor'
                            : ''
                      }
                    />
                  </label>
                </div>

                {/* Cond. pagto */}
                <div className="nfs-nova-label">
                  <span>Cond. pagto</span>
                  <SearchableSelect
                    options={condPagtoOptions}
                    value={formNova.condPagto}
                    onChange={(v) => handleFieldNova('condPagto', v)}
                    enableSearch
                    searchPlaceholder="Pesquisar..."
                    disabled={carregandoListas}
                    className={formErrors.has('condPagto') ? 'nfs-error' : ''}
                  />
                </div>

                {/* Serviço */}
                <div className="nfs-nova-label">
                  <span>Serviço</span>
                  <SearchableSelect
                    options={servicosOptions}
                    value={formNova.codigoServico}
                    onChange={(v) => {
                      handleFieldNova('codigoServico', v);
                      const found = servicosRaw.find((s: any) => String(s.codigo_Servico ?? s.Codigo_Servico ?? '') === v);
                      if (found) {
                        const descCompleta = String(found.descr_Completa ?? found.Descr_Completa ?? '').trim();
                        if (descCompleta) handleFieldNova('descricao', descCompleta);
                      }
                    }}
                    enableSearch
                    searchPlaceholder="Pesquisar..."
                    disabled={carregandoListas || isNfServico}
                    className={formErrors.has('codigoServico') ? 'nfs-error' : ''}
                  />
                </div>

                {/* Descrição */}
                <label className="nfs-nova-label">
                  <span>Descrição</span>
                  <textarea
                    rows={3}
                    value={formNova.descricao}
                    onChange={(e) => handleFieldNova('descricao', e.target.value)}
                    style={formErrors.has('descricao') ? { borderColor: '#e53e3e' } : undefined}
                  />
                </label>

                {/* Tipo serv. | Atividade | Cód.Trib.Nac */}
                <div className="nfs-nova-row nfs-nova-row--tipo3">
                  <label className="nfs-nova-label">
                    <span>Tipo serv.</span>
                    <input value={formNova.tipoServ} onChange={(e) => handleFieldNova('tipoServ', e.target.value)} disabled={isNfse} style={formErrors.has('tipoServ') ? { borderColor: '#e53e3e' } : undefined} />
                  </label>
                  <label className="nfs-nova-label">
                    <span>Atividade</span>
                    <input value={formNova.atividade} onChange={(e) => handleFieldNova('atividade', e.target.value)} disabled={isNfse} style={formErrors.has('atividade') ? { borderColor: '#e53e3e' } : undefined} />
                  </label>
                  <label className="nfs-nova-label">
                    <span>Cód. Trib. Nac</span>
                    <input value={formNova.codTribNac} onChange={(e) => handleFieldNova('codTribNac', e.target.value)} disabled={isNfServico} style={formErrors.has('codTribNac') ? { borderColor: '#e53e3e' } : undefined} />
                  </label>
                </div>

                {/* Trib. ISSQN | Ret. ISSQN | Valor serviço */}
                <div className="nfs-nova-row nfs-nova-row--tipo3">
                  <div className="nfs-nova-label">
                    <span>Trib. ISSQN</span>
                    <SearchableSelect
                      enableSearch={false}
                      options={OPTIONS_TRIB_ISSQN}
                      value={formNova.tribISSQN}
                      onChange={(v) => handleFieldNova('tribISSQN', v)}
                      disabled={isNfServico}
                      className={formErrors.has('tribISSQN') ? 'nfs-error' : ''}
                    />
                  </div>
                  <div className="nfs-nova-label">
                    <span>Ret. ISSQN</span>
                    <SearchableSelect
                      enableSearch={false}
                      options={OPTIONS_RET_ISSQN}
                      value={formNova.retISSQN}
                      onChange={(v) => handleFieldNova('retISSQN', v)}
                      disabled={isNfServico}
                      className={formErrors.has('retISSQN') ? 'nfs-error' : ''}
                    />
                  </div>
                  <label className="nfs-nova-label">
                    <span>Valor serviço</span>
                    <input
                      className="nfs-nova-input--right"
                      value={formNova.valorServico}
                      onChange={(e) => handleFieldNova('valorServico', e.target.value)}
                      placeholder="0,00"
                    />
                  </label>
                </div>

                {/* INSS + INSS adicional lado a lado */}
                <div className="nfs-nova-inss-outer">
                  <div className="nfs-nova-fieldset">
                    <div className="nfs-nova-fieldset__title">INSS</div>
                    <div className="nfs-nova-value-row">
                      <span>Base</span>
                      <input value={formNova.inssBase} onChange={(e) => handleFieldNova('inssBase', e.target.value)} placeholder="0,00" disabled={isNfse} />
                    </div>
                    <div className="nfs-nova-value-row">
                      <span>Valor</span>
                      <input value={formNova.inssValor} onChange={(e) => handleFieldNova('inssValor', e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="nfs-nova-value-row">
                      <span>Valor subcontratados</span>
                      <input value={formNova.inssValorSubcontratados} onChange={(e) => handleFieldNova('inssValorSubcontratados', e.target.value)} placeholder="0,00" disabled={isNfse} />
                    </div>
                    <div className="nfs-nova-value-row">
                      <span>Valor não retido</span>
                      <input value={formNova.inssValorNaoRetido} onChange={(e) => handleFieldNova('inssValorNaoRetido', e.target.value)} placeholder="0,00" disabled={isNfse} />
                    </div>
                  </div>
                  <div className="nfs-nova-fieldset">
                    <div className="nfs-nova-fieldset__title">INSS adicional</div>
                    <div className="nfs-nova-value-row">
                      <span>Valor</span>
                      <input value={formNova.inssAdicionalValor} onChange={(e) => handleFieldNova('inssAdicionalValor', e.target.value)} placeholder="0,00" disabled={isNfse} />
                    </div>
                    <div className="nfs-nova-value-row">
                      <span>Não retido</span>
                      <input value={formNova.inssAdicionalNaoRetido} onChange={(e) => handleFieldNova('inssAdicionalNaoRetido', e.target.value)} placeholder="0,00" disabled={isNfse} />
                    </div>
                  </div>
                </div>

                {/* PIS/Cofins/CSLL */}
                <div className="nfs-nova-fieldset">
                  <div className="nfs-nova-fieldset__title">PIS/Cofins/CSLL</div>
                  <div className="nfs-nova-label">
                    <span>Tipo Retenção</span>
                    <SearchableSelect
                      enableSearch={false}
                      options={OPTIONS_TIPO_RETENCAO}
                      value={formNova.tipoRetencao}
                      onChange={(v) => handleFieldNova('tipoRetencao', v)}
                      disabled={isNfServico}
                      className={formErrors.has('tipoRetencao') ? 'nfs-error' : ''}
                    />
                  </div>
                  <div className="nfs-nova-pis-bottom">
                    {/* Coluna 1: valores retidos na fonte */}
                    <div className="nfs-nova-pis-col">
                      <div className="nfs-nova-value-row">
                        <span>IRRF</span>
                        <input value={formNova.irrf} onChange={(e) => handleFieldNova('irrf', e.target.value)} placeholder="0,00" />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>ISS</span>
                        <input value={formNova.iss} onChange={(e) => handleFieldNova('iss', e.target.value)} placeholder="0,00" />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>PIS</span>
                        <input value={formNova.pis} onChange={(e) => handleFieldNova('pis', e.target.value)} placeholder="0,00" />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>Cofins</span>
                        <input value={formNova.cofins} onChange={(e) => handleFieldNova('cofins', e.target.value)} placeholder="0,00" />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>CSLL</span>
                        <input value={formNova.csll} onChange={(e) => handleFieldNova('csll', e.target.value)} placeholder="0,00" />
                      </div>
                    </div>
                    {/* Coluna 2: Tributos Retidos */}
                    <div className="nfs-nova-pis-col">
                      <div className="nfs-nova-pis-col__title">Tributos Retidos</div>
                      <div className="nfs-nova-value-row">
                        <span>PIS</span>
                        <input value={formNova.pisRetido} onChange={(e) => handleFieldNova('pisRetido', e.target.value)} placeholder="0,00" disabled={isNfServico} />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>Cofins</span>
                        <input value={formNova.cofinsRetido} onChange={(e) => handleFieldNova('cofinsRetido', e.target.value)} placeholder="0,00" disabled={isNfServico} />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>CSLL</span>
                        <input value={formNova.csllRetido} onChange={(e) => handleFieldNova('csllRetido', e.target.value)} placeholder="0,00" disabled={isNfServico} />
                      </div>
                    </div>
                    {/* Coluna 3: Condições especiais */}
                    <div className="nfs-nova-pis-col">
                      <div className="nfs-nova-pis-col__title">Val. serv. condições especiais</div>
                      <div className="nfs-nova-value-row">
                        <span>15 anos</span>
                        <input value={formNova.valor15anos} onChange={(e) => handleFieldNova('valor15anos', e.target.value)} placeholder="0,00" disabled={isNfse} />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>20 anos</span>
                        <input value={formNova.valor20anos} onChange={(e) => handleFieldNova('valor20anos', e.target.value)} placeholder="0,00" disabled={isNfse} />
                      </div>
                      <div className="nfs-nova-value-row">
                        <span>25 anos</span>
                        <input value={formNova.valor25anos} onChange={(e) => handleFieldNova('valor25anos', e.target.value)} placeholder="0,00" disabled={isNfse} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alterar valor a receber */}
                <div className="nfs-nova-alterar-row">
                  <label className="nfs-nova-alterar-check">
                    <input
                      type="checkbox"
                      checked={formNova.alterarValorReceber}
                      onChange={(e) => handleFieldNova('alterarValorReceber', e.target.checked)}
                    />
                    Alterar valor a receber
                  </label>
                  <div className="nfs-nova-label" style={{ flex: 1 }}>
                    <span>Valor a receber</span>
                    <input
                      className="nfs-nova-input--right"
                      value={formNova.valorReceber}
                      onChange={(e) => handleFieldNova('valorReceber', e.target.value)}
                      placeholder="0,00"
                      disabled={!formNova.alterarValorReceber}
                    />
                  </div>
                </div>
              </div>

              <footer className="nfs-nova-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setNovaNotaOpen(false)}
                  disabled={salvandoNova}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleEmitirNF()}
                  disabled={salvandoNova}
                >
                  {salvandoNova ? 'Emitindo...' : 'Emitir'}
                </button>
              </footer>
            </article>
          </section>
        )
      })()}

      {consultaOpen && (() => {
        const isNfse = consultaForm.tipo === 'nfse_nacional';
        const isNfServico = consultaForm.tipo === 'nf_servico';
        return (
          <section className="modal-backdrop" role="dialog" aria-modal="true">
            <article className="modal-card modal-card--nfs-nova">
              <header className="modal-card__header">
                <h2>Consulta Nota Fiscal de Serviço</h2>
                <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setConsultaOpen(false)}>
                  <IoCloseOutline size={18} />
                </button>
              </header>

              {carregandoConsulta ? (
                <div className="nfs-nova-body">
                  <p className="module-empty">Carregando dados da nota fiscal...</p>
                </div>
              ) : (
                <div className="nfs-nova-body">
                  {/* Tipo */}
                  <div className="nfs-nova-radio-row">
                    <label>
                      <input type="radio" name="consulta-nfs-tipo" value="nfse_nacional" checked={consultaForm.tipo === 'nfse_nacional'} disabled readOnly />
                      NFSe Nacional
                    </label>
                    <label>
                      <input type="radio" name="consulta-nfs-tipo" value="nf_servico" checked={consultaForm.tipo === 'nf_servico'} disabled readOnly />
                      NF Serviço
                    </label>
                  </div>

                  {/* Cabeçalho: Série | Nota Fiscal | Emissão */}
                  <div className="nfs-nova-row nfs-nova-row--cabecalho">
                    <div className="nfs-nova-label">
                      <span>Série</span>
                      <SearchableSelect
                        options={seriesOptions}
                        value={consultaForm.serie}
                        onChange={() => { }}
                        enableSearch={false}
                        disabled
                        displayValue={consultaForm.serie || undefined}
                        minDropdownWidth={320}
                        listHeader={
                          <div className="searchable-select__col-row" style={{ gridTemplateColumns: '50px 1fr 72px' }}>
                            <span>Série</span>
                            <span>Tipo Nota</span>
                            <span style={{ textAlign: 'right' }}>Ult. NF</span>
                          </div>
                        }
                        renderOption={(opt) => {
                          const raw = seriesRaw.find((s) => s.serie_NF === opt.value);
                          return (
                            <div className="searchable-select__col-row" style={{ gridTemplateColumns: '50px 1fr 72px' }}>
                              <span>{raw?.serie_NF ?? opt.value}</span>
                              <span>{raw?.tipo_Nota ?? ''}</span>
                              <span style={{ textAlign: 'right' }}>{raw !== undefined ? String(raw.ultima_NF).padStart(6, '0') : ''}</span>
                            </div>
                          );
                        }}
                      />
                    </div>
                    <label className="nfs-nova-label">
                      <span>Nota Fiscal</span>
                      <input value={consultaForm.numNotaFiscal} readOnly />
                    </label>
                    <div className="nfs-nova-label">
                      <span>Emissão</span>
                      <div className="nfs-nova-emissao-group">
                        <CustomDatePicker value={consultaForm.dataEmissao} onChange={() => { }} disabled />
                      </div>
                    </div>
                  </div>

                  {/* Destinatário */}
                  <div className="nfs-nova-row nfs-nova-row--destinatario">
                    <div className="nfs-nova-label">
                      <span>Destinatário</span>
                      <SearchableSelect
                        options={clientesFornOptions}
                        value={consultaForm.codigoDestinatario}
                        onChange={() => { }}
                        enableSearch
                        searchPlaceholder="Pesquisar..."
                        disabled
                      />
                    </div>
                    <label className="nfs-nova-label">
                      <span>Tipo</span>
                      <input
                        readOnly
                        value={
                          consultaForm.tipoDestinatario === 'C' ? 'Cliente'
                            : consultaForm.tipoDestinatario === 'F' ? 'Fornecedor'
                              : ''
                        }
                      />
                    </label>
                  </div>

                  {/* Cond. pagto */}
                  <div className="nfs-nova-label">
                    <span>Cond. pagto</span>
                    <SearchableSelect
                      options={condPagtoOptions}
                      value={consultaForm.condPagto}
                      onChange={() => { }}
                      enableSearch
                      searchPlaceholder="Pesquisar..."
                      disabled
                    />
                  </div>

                  {/* Serviço */}
                  <div className="nfs-nova-label">
                    <span>Serviço</span>
                    <SearchableSelect
                      options={servicosOptions}
                      value={consultaForm.codigoServico}
                      onChange={() => { }}
                      enableSearch
                      searchPlaceholder="Pesquisar..."
                      disabled
                      displayValue={consultaForm.nomeServico || undefined}
                    />
                  </div>

                  {/* Descrição */}
                  <label className="nfs-nova-label">
                    <span>Descrição</span>
                    <textarea rows={3} value={consultaForm.descricao} readOnly />
                  </label>

                  {/* Tipo serv. | Atividade | Cód.Trib.Nac */}
                  <div className="nfs-nova-row nfs-nova-row--tipo3">
                    <label className="nfs-nova-label">
                      <span>Tipo serv.</span>
                      <input value={consultaForm.tipoServ} readOnly disabled={isNfse} />
                    </label>
                    <label className="nfs-nova-label">
                      <span>Atividade</span>
                      <input value={consultaForm.atividade} readOnly disabled={isNfse} />
                    </label>
                    <label className="nfs-nova-label">
                      <span>Cód. Trib. Nac</span>
                      <input value={consultaForm.codTribNac} readOnly disabled={isNfServico} />
                    </label>
                  </div>

                  {/* Trib. ISSQN | Ret. ISSQN | Valor serviço */}
                  <div className="nfs-nova-row nfs-nova-row--tipo3">
                    <div className="nfs-nova-label">
                      <span>Trib. ISSQN</span>
                      <SearchableSelect
                        enableSearch={false}
                        options={OPTIONS_TRIB_ISSQN}
                        value={consultaForm.tribISSQN}
                        onChange={() => { }}
                        disabled
                      />
                    </div>
                    <div className="nfs-nova-label">
                      <span>Ret. ISSQN</span>
                      <SearchableSelect
                        enableSearch={false}
                        options={OPTIONS_RET_ISSQN}
                        value={consultaForm.retISSQN}
                        onChange={() => { }}
                        disabled
                      />
                    </div>
                    <label className="nfs-nova-label">
                      <span>Valor serviço</span>
                      <input className="nfs-nova-input--right" value={consultaForm.valorServico} readOnly />
                    </label>
                  </div>

                  {/* INSS + INSS adicional lado a lado */}
                  <div className="nfs-nova-inss-outer">
                    <div className="nfs-nova-fieldset">
                      <div className="nfs-nova-fieldset__title">INSS</div>
                      <div className="nfs-nova-value-row"><span>Base</span><input value={consultaForm.inssBase} readOnly /></div>
                      <div className="nfs-nova-value-row"><span>Valor</span><input value={consultaForm.inssValor} readOnly /></div>
                      <div className="nfs-nova-value-row"><span>Valor subcontratados</span><input value={consultaForm.inssValorSubcontratados} readOnly /></div>
                      <div className="nfs-nova-value-row"><span>Valor não retido</span><input value={consultaForm.inssValorNaoRetido} readOnly /></div>
                    </div>
                    <div className="nfs-nova-fieldset">
                      <div className="nfs-nova-fieldset__title">INSS adicional</div>
                      <div className="nfs-nova-value-row"><span>Valor</span><input value={consultaForm.inssAdicionalValor} readOnly /></div>
                      <div className="nfs-nova-value-row"><span>Não retido</span><input value={consultaForm.inssAdicionalNaoRetido} readOnly /></div>
                    </div>
                  </div>

                  {/* PIS/Cofins/CSLL */}
                  <div className="nfs-nova-fieldset">
                    <div className="nfs-nova-fieldset__title">PIS/Cofins/CSLL</div>
                    <div className="nfs-nova-label">
                      <span>Tipo Retenção</span>
                      <SearchableSelect
                        enableSearch={false}
                        options={OPTIONS_TIPO_RETENCAO}
                        value={consultaForm.tipoRetencao}
                        onChange={() => { }}
                        disabled
                      />
                    </div>
                    <div className="nfs-nova-pis-bottom">
                      <div className="nfs-nova-pis-col">
                        <div className="nfs-nova-value-row"><span>IRRF</span><input value={consultaForm.irrf} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>ISS</span><input value={consultaForm.iss} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>PIS</span><input value={consultaForm.pis} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>Cofins</span><input value={consultaForm.cofins} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>CSLL</span><input value={consultaForm.csll} readOnly /></div>
                      </div>
                      <div className="nfs-nova-pis-col">
                        <div className="nfs-nova-pis-col__title">Tributos Retidos</div>
                        <div className="nfs-nova-value-row"><span>PIS</span><input value={consultaForm.pisRetido} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>Cofins</span><input value={consultaForm.cofinsRetido} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>CSLL</span><input value={consultaForm.csllRetido} readOnly /></div>
                      </div>
                      <div className="nfs-nova-pis-col">
                        <div className="nfs-nova-pis-col__title">Val. serv. condições especiais</div>
                        <div className="nfs-nova-value-row"><span>15 anos</span><input value={consultaForm.valor15anos} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>20 anos</span><input value={consultaForm.valor20anos} readOnly /></div>
                        <div className="nfs-nova-value-row"><span>25 anos</span><input value={consultaForm.valor25anos} readOnly /></div>
                      </div>
                    </div>
                  </div>

                  {/* Alterar valor a receber */}
                  <div className="nfs-nova-alterar-row">
                    <label className="nfs-nova-alterar-check">
                      <input type="checkbox" checked={consultaForm.alterarValorReceber} disabled readOnly />
                      Alterar valor a receber
                    </label>
                    <div className="nfs-nova-label" style={{ flex: 1 }}>
                      <span>Valor a receber</span>
                      <input className="nfs-nova-input--right" value={consultaForm.valorReceber} readOnly />
                    </div>
                  </div>
                </div>
              )}

              <footer className="nfs-nova-footer">
                <button type="button" className="secondary-button" onClick={() => setConsultaOpen(false)}>
                  Fechar
                </button>
              </footer>
            </article>
          </section>
        );
      })()}

      {reenvioConfirmRow && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--confirm">
            <header className="modal-card__header">
              <h2>Reenviar XML</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setReenvioConfirmRow(null)}
                disabled={reenvioLoading}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body modal-card__body--confirm">
              <IoAlertCircleOutline size={36} className="modal-confirm__icon" />
              <p>
                A nota <strong>{asText(reenvioConfirmRow.num_Nota_Fiscal)}</strong> série{' '}
                <strong>{asText(reenvioConfirmRow.serie)}</strong> não está autorizada.<br />
                Deseja reenviar o XML novamente?
              </p>
            </div>
            <footer className="nfs-nova-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReenvioConfirmRow(null)}
                disabled={reenvioLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleConfirmarReenvio()}
                disabled={reenvioLoading}
              >
                {reenvioLoading ? 'Reenviando...' : 'Reenviar'}
              </button>
            </footer>
          </article>
        </section>
      )}

      {historicoRow && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--historico">
            <header className="modal-card__header">
              <h2>Histórico de Operações - NFS-e</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setHistoricoRow(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div className="nfs-historico-fields">
              <label className="nfs-nova-label">
                <span>Num NF</span>
                <input readOnly value={asText(historicoRow.num_Nota_Fiscal)} />
              </label>
              <label className="nfs-nova-label">
                <span>Série</span>
                <input readOnly value={asText(historicoRow.serie)} />
              </label>
              <label className="nfs-nova-label nfs-historico-fields__chave">
                <span>Chave</span>
                <input readOnly value={historicoChaveAcesso} placeholder={historicoLoading ? 'Carregando...' : '-'} />
              </label>
              <label className="nfs-nova-label nfs-historico-fields__chave">
                <span>Chave NFS-e</span>
                <input readOnly value="" placeholder="-" />
              </label>
            </div>

            <div className="nfs-historico-table-wrap">
              {historicoLoading ? (
                <p className="module-empty">Carregando histórico...</p>
              ) : historicoOcorrencias.length === 0 ? (
                <p className="module-empty">Nenhuma ocorrência encontrada.</p>
              ) : (
                <table className="nfs-historico-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Hora</th>
                      <th>Ocorrência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoOcorrencias.map((oc) => (
                      <tr
                        key={oc.num_Ocorrencia}
                        className="nfs-historico-table__row"
                        onClick={() => setOcorrenciaDetalhe(oc)}
                        title="Clique para ver detalhes"
                      >
                        <td className="nfs-historico-table__data">{fmtOcorrenciaData(oc.data_Ocorrencia)}</td>
                        <td className="nfs-historico-table__hora">{fmtOcorrenciaHora(oc.hora_Ocorrencia)}</td>
                        <td className="nfs-historico-table__descricao">{oc.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="nfs-nova-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHistoricoRow(null)}
              >
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}

      {ocorrenciaDetalhe && (
        <section className="modal-backdrop modal-backdrop--nested" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--ocorrencia-detalhe">
            <header className="modal-card__header">
              <h2>Detalhes do Histórico</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setOcorrenciaDetalhe(null)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="nfs-ocorrencia-detalhe-body">
              <p>{ocorrenciaDetalhe.descricao}</p>
            </div>
            <footer className="nfs-nova-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOcorrenciaDetalhe(null)}
              >
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}
    </main>
  );
}
