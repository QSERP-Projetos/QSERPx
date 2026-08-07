import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoAlertCircleOutline, IoCloseOutline, IoHelpCircleOutline, IoWarningOutline, IoInformationCircleOutline, IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { GlobalConfig } from '../../../services/globalConfig';
import { SearchableSelect, type SearchableSelectOption } from '../../../components/SearchableSelect';
import { buscarVersoesPorSistema, type SistemaVersao } from '../../../services/supabaseQueries';
import apiManager, { ApiCallType } from '../../../services/apiManager';
import { useToast } from '../../../contexts/ToastContext';

type ActiveTab = 'qserp' | 'qsapi' | 'qserpx';
type ActiveEnv = 'producao' | 'teste';

const ID_SISTEMA_MAP: Record<ActiveTab, number> = {
  qserp: 3,
  qsapi: 5,
  qserpx: 1,
};

const TIPO_AMBIENTE_MAP: Record<ActiveEnv, number> = {
  producao: 1,
  teste: 2,
};

const TAB_LABEL: Record<ActiveTab, string> = {
  qserp: 'QSERP',
  qsapi: 'QS API',
  qserpx: 'QS ERPX',
};

interface IISBinding { protocolo: string; porta: number; endereco: string; host: string; }
interface IISSite { id: number; nome: string; estado: string; caminhoFisico: string; pool: string; bindings: IISBinding[]; }

const isNaoVazio = (value: string | null | undefined) =>
  value != null && String(value).trim() !== '';

/** Compara duas versões no formato "x.y.z.w". Retorna negativo se a < b, 0 se iguais, positivo se a > b. */
const compareVersions = (a: string, b: string): number => {
  const partsA = String(a).split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = String(b).split('.').map((p) => parseInt(p, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? 0;
    const pb = partsB[i] ?? 0;
    if (pa !== pb) return pa - pb;
  }
  return 0;
};

const getLogColor = (msg: string): string => {
  if (msg.includes('ERRO:') || msg.includes('FINALIZADO: FALHA') || msg.includes('SQL: [FALHA]')) return '#f87171';
  if (msg.includes('FINALIZADO: SUCESSO')) return '#4ade80';
  if (msg.includes('SQL: [OK]')) return '#86efac';
  if (msg.includes('ARQUIVO:')) return '#93c5fd';
  return '#d4d4d4';
};

export function VersoesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('qserp');
  const [activeEnv, setActiveEnv] = useState<ActiveEnv>('producao');

  // — Bloco de cadastro —
  const [caminhoExtracao, setCaminhoExtracao] = useState('');
  const [caminhoDestino, setCaminhoDestino] = useState('');
  const [caminhoBackup, setCaminhoBackup] = useState('');
  const [urlApi, setUrlApi] = useState('');
  const [prefixoHttp, setPrefixoHttp] = useState<'http' | 'https'>('http');
  const [caminhoLog, setCaminhoLog] = useState('');

  // — Estados de configuração —
  const [isEditing, setIsEditing] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState('');

  // — Bloco de versões —
  const [versoes, setVersoes] = useState<SistemaVersao[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [erroVersoes, setErroVersoes] = useState('');
  const [versaoSelecionada, setVersaoSelecionada] = useState('');

  // — Verificação de versão QSAPI —
  const [versaoApiQsApi, setVersaoApiQsApi] = useState<string | null>(null);
  const [loadingVerificacao, setLoadingVerificacao] = useState(false);

  // — Status do teste de URL API —
  type UrlStatus = 'ok' | 'erro' | 'testando' | null;
  const [urlApiStatus, setUrlApiStatus] = useState<UrlStatus>(null);

  // — IIS Sites —
  const [iisSites, setIisSites] = useState<IISSite[]>([]);
  const [loadingIIS, setLoadingIIS] = useState(false);
  const [erroIIS, setErroIIS] = useState('');
  const [iisSiteSelected, setIisSiteSelected] = useState('');
  const [camposErro, setCamposErro] = useState<Record<string, boolean>>({});

  // — Credenciais IIS (QS API / QS ERPX) —
  const [usuarioIIS, setUsuarioIIS] = useState('');
  const [senhaIIS, setSenhaIIS] = useState('');
  const [servidorIIS, setServidorIIS] = useState('');

  // — Controle de atualização —
  const [loadingAtualizar, setLoadingAtualizar] = useState(() => GlobalConfig.isAtualizando());

  // — Status de bloqueio de licença (verificado ao carregar a página) —
  const [licencaBloqueada, setLicencaBloqueada] = useState(false);
  const [mensagemBloqueioAtual, setMensagemBloqueioAtual] = useState<string | null>(null);
  const [loadingDesbloquearManual, setLoadingDesbloquearManual] = useState(false);
  const [modalConfirmAtualizarOpen, setModalConfirmAtualizarOpen] = useState(false);
  const [ultimaVersao, setUltimaVersao] = useState<string | null>(null);

  // — Modais de ajuda —
  const [modalCaminhoOpen, setModalCaminhoOpen] = useState<'destino' | 'backup' | null>(null);

  // — Bloqueio de licença / derrubada de sessões —
  type BloquearStep = 'confirmar' | 'mensagem' | 'confirmarDerrubar';
  const [bloquearStep, setBloquearStep] = useState<BloquearStep | null>(null);
  const [mensagemBloqueio, setMensagemBloqueio] = useState('Sistema bloqueado para atualização. Tempo estimado de 60 minutos.');
  const [loadingBloquear, setLoadingBloquear] = useState(false);
  const [sessoesDerrubadas, setSessoesDerrubadas] = useState(false);

  // — Progresso SSE —
  const sseSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressLogs, setProgressLogs] = useState<Array<{ hora: string; mensagem: string }>>([]);
  const [progressStatus, setProgressStatus] = useState<'running' | 'success' | 'error'>('running');

  // Pré-preenche URL e prefixo global
  useEffect(() => {
    const base = GlobalConfig.getBaseUrl();
    if (!base) return;
    const match = base.match(/^(https?):\/\/(.+)$/i);
    if (match) {
      setPrefixoHttp(match[1].toLowerCase() as 'http' | 'https');
      setUrlApi(match[2]);
    } else {
      setUrlApi(base);
    }
  }, []);

  const carregarVersoes = useCallback(async (idSistema: number) => {
    setVersoes([]);
    setLoadingVersoes(true);
    setErroVersoes('');
    setVersaoSelecionada('');
    setVersaoApiQsApi(null);
    try {
      const data = await buscarVersoesPorSistema(idSistema);
      setVersoes(data);
    } catch {
      setErroVersoes('Não foi possível carregar as versões. Verifique a conexão com o Supabase.');
    } finally {
      setLoadingVersoes(false);
    }
  }, []);

  const carregarSitesIIS = useCallback(async () => {
    const baseUrlAtualiza = GlobalConfig.getBaseUrlQSAtualiza();
    const token = GlobalConfig.getJwToken();
    if (!baseUrlAtualiza) {
      setErroIIS('URL do QS Atualiza não configurada. Acesse Configuração URL para definir.');
      return;
    }
    setLoadingIIS(true);
    setErroIIS('');
    try {
      const url = `${baseUrlAtualiza.replace(/\/$/, '')}/api/v1/IIS/Sites`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        setErroIIS('Não foi possível carregar os sites IIS.');
        return;
      }
      const data = await res.json() as { sucesso?: boolean; sites?: IISSite[] };
      if (data?.sites) {
        setIisSites(data.sites);
      } else {
        setErroIIS('Não foi possível carregar os sites IIS.');
      }
    } catch {
      setErroIIS('Erro ao carregar sites IIS.');
    } finally {
      setLoadingIIS(false);
    }
  }, []);

  const testarUrlApi = useCallback(async (prefixo: string, host: string) => {
    const host_ = host.trim();
    if (!host_) { setUrlApiStatus(null); return; }
    const endpoint = `${prefixo}://${host_.replace(/\/$/, '')}/api/v1/url`;
    setUrlApiStatus('testando');
    try {
      const resp = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(10000) });
      setUrlApiStatus(resp.ok ? 'ok' : 'erro');
    } catch (err) {
      if (err instanceof TypeError) {
        try {
          await fetch(endpoint, { method: 'GET', mode: 'no-cors', signal: AbortSignal.timeout(10000) });
          setUrlApiStatus('ok'); // resposta opaca = servidor acessível
        } catch {
          setUrlApiStatus('erro');
        }
      } else {
        setUrlApiStatus('erro');
      }
    }
  }, []);

  const carregarConfiguracoes = useCallback(async (idSistema: number, tipoAmbiente: number) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;

    // fallback global
    const globalMatch = baseUrl.match(/^(https?):\/\/(.+)$/i);
    const globalPref = globalMatch ? (globalMatch[1].toLowerCase() as 'http' | 'https') : 'https';
    const globalHost = globalMatch ? globalMatch[2] : baseUrl;

    // Limpa os campos antes de carregar para não exibir dados da aba anterior
    setCaminhoExtracao('');
    setCaminhoDestino('');
    setCaminhoBackup('');
    setCaminhoLog('');
    setUltimaVersao(null);
    setUrlApiStatus(null);

    setLoadingConfig(true);
    setErroConfig('');
    try {
      const response = await apiManager.makeApiCall<unknown>(
        `${baseUrl.replace(/\/$/, '')}/api/v1/parametrosatualizacao?idSistema=${idSistema}&tipoAmbiente=${tipoAmbiente}`,
        ApiCallType.GET,
        token ? { Authorization: `Bearer ${token}` } : {},
        {},
      );

      if (response.succeeded) {
        const data = response.jsonBody ?? response.data;
        if (data && typeof data === 'object' && 'caminho_Extracao' in data) {
          const config = data as Record<string, unknown>;
          setCaminhoExtracao(String(config.caminho_Extracao ?? '').trim());
          setCaminhoDestino(String(config.caminho_Destino ?? '').trim());
          setCaminhoBackup(String(config.caminho_Backup ?? '').trim());
          setCaminhoLog(String(config.caminho_Log ?? '').trim());
          const uv = String(config.ultima_Versao ?? '').trim();
          setUltimaVersao(uv || null);
          // prefixo_Http e url: usar retorno se válido
          // Em Teste (tipoAmbiente=2) não aplica fallback para a URL global
          const isTest = tipoAmbiente === 2;
          const respPref = String(config.prefixo_Http ?? '').trim().toLowerCase();
          const respUrl = String(config.url ?? '').trim();
          const finalPref = (respPref === 'http' || respPref === 'https') ? respPref as 'http' | 'https' : (isTest ? 'http' : globalPref);
          const finalHost = respUrl || (isTest ? '' : globalHost);
          setPrefixoHttp(finalPref);
          setUrlApi(finalHost);
          void testarUrlApi(finalPref, finalHost);

          setHasConfig(true);
          setIsEditing(false);
        } else {
          const isTest2 = tipoAmbiente === 2;
          setPrefixoHttp(isTest2 ? 'http' : globalPref);
          setUrlApi(isTest2 ? '' : globalHost);
          void testarUrlApi(isTest2 ? 'http' : globalPref, isTest2 ? '' : globalHost);
          setHasConfig(false);
          setIsEditing(true);
        }
      } else {
        const isTest3 = tipoAmbiente === 2;
        setPrefixoHttp(isTest3 ? 'http' : globalPref);
        setUrlApi(isTest3 ? '' : globalHost);
        void testarUrlApi(isTest3 ? 'http' : globalPref, isTest3 ? '' : globalHost);
        setHasConfig(false);
        setIsEditing(true);
      }
    } catch {
      setErroConfig('Erro ao carregar configurações.');
      setHasConfig(false);
      setIsEditing(true);
    } finally {
      setLoadingConfig(false);
    }
  }, [testarUrlApi]);

  const salvarConfiguracoes = useCallback(async (idSistema: number, tipoAmbiente: number) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;

    // Validação de campos obrigatórios
    const erros: Record<string, boolean> = {};
    if (!caminhoExtracao.trim()) erros['caminhoExtracao'] = true;
    if (!caminhoDestino.trim()) erros['caminhoDestino'] = true;
    if (!caminhoBackup.trim()) erros['caminhoBackup'] = true;
    if (!caminhoLog.trim()) erros['caminhoLog'] = true;
    if (Object.keys(erros).length > 0) {
      setCamposErro(erros);
      showToast('Preencha todos os campos obrigatórios antes de salvar.', 'error');
      return;
    }
    setCamposErro({});

    setSavingConfig(true);
    try {
      const payload = {
        id_Sistema: idSistema,
        caminho_Extracao: caminhoExtracao.trim() || null,
        caminho_Destino: caminhoDestino.trim() || null,
        caminho_Backup: caminhoBackup.trim() || null,
        caminho_Log: caminhoLog.trim() || null,
        tipo_Ambiente: tipoAmbiente,
        prefixo_Http: prefixoHttp,
        url: urlApi.trim() || null,
        ultima_Versao: null,
        codigo_Licenca: tipoAmbiente === TIPO_AMBIENTE_MAP.producao ? GlobalConfig.getCodigoLicenca() : null,
      };

      const response = await apiManager.makeApiCall<unknown>(
        `${baseUrl.replace(/\/$/, '')}/api/v1/adicionaparametrosatualizacao`,
        ApiCallType.POST,
        token ? { Authorization: `Bearer ${token}` } : {},
        {},
        payload,
      );

      if (response.succeeded) {
        const msg = (response.jsonBody as Record<string, unknown>)?.message;
        showToast(msg ? String(msg) : 'Configurações salvas com sucesso!', 'success');
        setHasConfig(true);
        setIsEditing(false);
      } else {
        const msg = (response.jsonBody as Record<string, unknown>)?.message;
        showToast(msg ? String(msg) : `Erro ao salvar configurações. (${response.statusCode})`, 'error');
        setErroConfig('Erro ao salvar configurações.');
      }
    } catch {
      showToast('Erro ao salvar configurações.', 'error');
      setErroConfig('Erro ao salvar configurações.');
    } finally {
      setSavingConfig(false);
    }
  }, [caminhoExtracao, caminhoDestino, caminhoBackup, caminhoLog, prefixoHttp, urlApi]);

  const handleCancelar = () => {
    if (!hasConfig) {
      setCaminhoExtracao('');
      setCaminhoDestino('');
      setCaminhoBackup('');
      setCaminhoLog('');
    }
    setIsEditing(false);
    void carregarConfiguracoes(ID_SISTEMA_MAP[activeTab], TIPO_AMBIENTE_MAP[activeEnv]);
  };

  useEffect(() => {
    setIisSiteSelected('');
    setCamposErro({});
    setUsuarioIIS('');
    setSenhaIIS('');
    setServidorIIS('');
    setSessoesDerrubadas(false);
    setBloquearStep(null);
    void carregarConfiguracoes(ID_SISTEMA_MAP[activeTab], TIPO_AMBIENTE_MAP[activeEnv]);
    void carregarVersoes(ID_SISTEMA_MAP[activeTab]);
    if (activeTab !== 'qserp') {
      void carregarSitesIIS();
    }
  }, [activeTab, activeEnv, carregarVersoes, carregarConfiguracoes, carregarSitesIIS]);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(ROUTES.home, { replace: true });
  };

  // Verifica ao carregar se a licença está bloqueada (ex.: update interrompido por fechamento do navegador)
  useEffect(() => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoLicenca = GlobalConfig.getCodigoLicenca();
    if (!baseUrl || !codigoLicenca) return;

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const codigoUsuario = GlobalConfig.getUsuario() ?? '';
    const params = new URLSearchParams({ CodigoLicenca: String(codigoLicenca), CodigoUsuario: codigoUsuario, nivelUsuario: '0' });

    fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/verificalicencabloqueada?${params.toString()}`, {
      method: 'GET',
      headers,
    })
      .then(async (res) => {
        if (res.ok) {
          // Não está bloqueado — se o sessionStorage dizia atualizando, o update terminou
          if (GlobalConfig.isAtualizando()) {
            GlobalConfig.setAtualizando(false);
            setLoadingAtualizar(false);
          }
          setLicencaBloqueada(false);
          setMensagemBloqueioAtual(null);
        } else {
          // Sistema ainda bloqueado
          const body = await res.json().catch(() => ({})) as { message?: string; mensagem?: string };
          const msg = body?.message ?? body?.mensagem ?? 'Sistema bloqueado.';
          setLicencaBloqueada(true);
          setMensagemBloqueioAtual(msg);
        }
      })
      .catch(() => { /* ignora erros de rede silenciosamente */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloqueia fechamento/refresh do navegador enquanto uma atualização estiver em andamento
  useEffect(() => {
    if (!loadingAtualizar) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loadingAtualizar]);

  // Notifica o AppShell sobre o estado de atualização para bloquear a navegação lateral
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('qserpx:atualizando', { detail: { active: loadingAtualizar } }));
  }, [loadingAtualizar]);

  // Fecha a conexão SSE ao desmontar o componente
  useEffect(() => {
    return () => { sseSourceRef.current?.close(); };
  }, []);

  // Auto-scroll do container de logs SSE ao receber novas mensagens
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progressLogs]);

  const versaoAtual = versoes.find((v) => v.num_versao === versaoSelecionada) ?? null;
  const precisaScript = versaoAtual
    ? isNaoVazio(versaoAtual.script_sql) || isNaoVazio(versaoAtual.script_postgres)
    : false;
  const dependencia = versaoAtual?.sistema_dependencia ?? null;

  const logErroAtualizacao = useCallback(async (infComplem: string) => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/LogApi`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          CodigoEmpresa: GlobalConfig.getCodEmpresa() ?? null,
          DescricaoErro: 'Erro ao atualizar',
          InfComplem: infComplem,
        }),
      });
    } catch {
      // silently ignore log failures
    }
  }, []);

  const executarAtualizacao = useCallback(async () => {
    const baseUrlAtualiza = GlobalConfig.getBaseUrlQSAtualiza();
    const token = GlobalConfig.getJwToken();
    if (!baseUrlAtualiza || !versaoAtual) return;

    GlobalConfig.setAtualizando(true);
    setLoadingAtualizar(true);
    setModalConfirmAtualizarOpen(false);
    setProgressLogs([]);
    setProgressStatus('running');
    setProgressModalOpen(true);
    let usouSSE = false;
    try {
      const urlBase = baseUrlAtualiza.replace(/\/$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const selectedSite = iisSites.find(s => String(s.id) === iisSiteSelected);
      let endpoint: string;
      let body: Record<string, unknown>;

      if (activeTab === 'qserp') {
        endpoint = `${urlBase}/api/v1/update/q4`;
        body = {
          versao: versaoAtual.num_versao,
          urlDownload: versaoAtual.url_download,
          caminhoExtrair: caminhoExtracao.trim() || null,
          caminhoDestino: caminhoDestino.trim() || null,
          fazerBackup: precisaScript,
          caminhoBackup: caminhoBackup.trim() || null,
          scriptSQL: versaoAtual.script_sql ?? null,
          scriptPostgres: versaoAtual.script_postgres ?? null,
          codigoInstalacao: GlobalConfig.getCodigoLicenca(),
          urlApiLocal: urlApi.trim() || null,
          prefixoHttp: prefixoHttp,
          caminhoLog: caminhoLog.trim() || null,
        };
      } else if (activeTab === 'qsapi') {
        endpoint = `${urlBase}/api/v1/update/qsapi`;
        body = {
          versao: versaoAtual.num_versao,
          urlDownload: versaoAtual.url_download,
          caminhoExtrair: caminhoExtracao.trim() || null,
          caminhoDestino: caminhoDestino.trim() || null,
          caminhoBackup: caminhoBackup.trim() || null,
          caminhoLog: caminhoLog.trim() || null,
          usuarioIIS: usuarioIIS.trim() || null,
          senhaIIS: senhaIIS.trim() || null,
          servidorIIS: servidorIIS.trim() || null,
          nomeSiteIIS: selectedSite?.nome ?? null,
          nomeAppPool: selectedSite?.pool ?? null,
        };
      } else {
        endpoint = `${urlBase}/api/v1/update/qserpx`;
        body = {
          versao: versaoAtual.num_versao,
          urlDownload: versaoAtual.url_download,
          caminhoExtrair: caminhoExtracao.trim() || null,
          caminhoDestino: caminhoDestino.trim() || null,
          caminhoBackup: caminhoBackup.trim() || null,
          caminhoLog: caminhoLog.trim() || null,
          usuarioIIS: usuarioIIS.trim() || null,
          senhaIIS: senhaIIS.trim() || null,
          servidorIIS: servidorIIS.trim() || null,
          nomeSiteIIS: selectedSite?.nome ?? null,
        };
      }

      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const erroMsg = `Erro ao iniciar atualização: ${res.status}${errText ? ' — ' + errText : ''}`;
        setProgressStatus('error');
        showToast(erroMsg, 'error');
        void logErroAtualizacao(`[${res.status}] ${errText || 'Sem detalhes'}`);
        return;
      }

      const result = await res.json().catch(() => null) as Record<string, unknown> | null;

      // — Fluxo SSE: qualquer 2xx com operacaoId (aceita camelCase e PascalCase) —
      const rawOpId = result?.operacaoId ?? result?.OperacaoId;
      const operacaoIdSSE = rawOpId ? String(rawOpId).trim() : null;
      if (operacaoIdSSE) {
        usouSSE = true;
        const operacaoId = operacaoIdSSE;

        const pathMap: Record<ActiveTab, string> = { qserp: 'q4', qsapi: 'qsapi', qserpx: 'qserpx' };
        const streamUrl = `${baseUrlAtualiza.replace(/\/$/, '')}/api/v1/update/${pathMap[activeTab]}/stream/${operacaoId}`;

        let finalSuccess = false;
        let finalizado = false;
        if (sseSourceRef.current) sseSourceRef.current.close();
        const source = new EventSource(streamUrl);
        sseSourceRef.current = source;

        const finalizarAtualizacao = (sucesso: boolean) => {
          if (finalizado) return;
          finalizado = true;
          source.close();
          sseSourceRef.current = null;
          GlobalConfig.setAtualizando(false);
          setLoadingAtualizar(false);
          setLicencaBloqueada(false);
          setProgressStatus(sucesso ? 'success' : 'error');
          // DesbloquearLicenca (fire-and-forget)
          const bu = GlobalConfig.getBaseUrl();
          const tk = GlobalConfig.getJwToken();
          if (bu) {
            const dh: Record<string, string> = {};
            if (tk) dh['Authorization'] = `Bearer ${tk}`;
            const dp = new URLSearchParams({ CodigoLicencaBanco: String(GlobalConfig.getCodigoLicenca() ?? '') });
            fetch(`${bu.replace(/\/$/, '')}/api/v1/DesbloquearLicenca?${dp.toString()}`, { method: 'PUT', headers: dh })
              .catch(() => { /* silently ignore */ });
          }
          if (sucesso) {
            showToast('Atualização concluída com sucesso!', 'success');
            const buReg = GlobalConfig.getBaseUrl();
            const tkReg = GlobalConfig.getJwToken();
            if (buReg && versaoAtual) {
              const idSistema = ID_SISTEMA_MAP[activeTab];
              const tipoAmb = TIPO_AMBIENTE_MAP[activeEnv];
              const lh: Record<string, string> = { 'Content-Type': 'application/json' };
              if (tkReg) lh['Authorization'] = `Bearer ${tkReg}`;
              fetch(`${buReg.replace(/\/$/, '')}/api/v1/adicionaparametrosatualizacao`, {
                method: 'POST',
                headers: lh,
                body: JSON.stringify({
                  id_Sistema: idSistema,
                  caminho_Extracao: caminhoExtracao.trim() || null,
                  caminho_Destino: caminhoDestino.trim() || null,
                  caminho_Backup: caminhoBackup.trim() || null,
                  caminho_Log: caminhoLog.trim() || null,
                  tipo_Ambiente: tipoAmb,
                  prefixo_Http: prefixoHttp,
                  url: urlApi.trim() || null,
                  ultima_Versao: versaoAtual.num_versao,
                  codigo_Licenca: tipoAmb === TIPO_AMBIENTE_MAP.producao ? GlobalConfig.getCodigoLicenca() : null,
                }),
              })
                .then((r) => { if (r.ok) setUltimaVersao(versaoAtual.num_versao); })
                .catch(() => { /* silently ignore */ });
            }
          } else {
            showToast('Atualização encerrada com erro. Verifique os logs.', 'error');
          }
        };

        source.onmessage = (event: MessageEvent) => {
          try {
            const dados = JSON.parse(String(event.data)) as { hora: string; mensagem: string };
            if (dados.mensagem.trim() === '[CONCLUIDO]') {
              finalizarAtualizacao(finalSuccess);
              return;
            }
            if (dados.mensagem.includes('FINALIZADO: SUCESSO')) {
              finalSuccess = true;
              setProgressStatus('success');
            } else if (dados.mensagem.includes('FINALIZADO: FALHA')) {
              setProgressStatus('error');
            }
            setProgressLogs((prev) => [...prev, dados]);
          } catch {
            // ignore parse errors
          }
        };

        source.onerror = () => {
          finalizarAtualizacao(finalSuccess);
        };

        return; // cleanup feito pelos handlers SSE
      }

      // — Fluxo legado (200 sem SSE) —
      const msg = result?.message ? String(result.message) : 'Atualização iniciada com sucesso!';
      setProgressStatus('success');
      showToast(msg, 'success');

      // Registra a versão atualizada no cadastro de configurações
      const baseUrl = GlobalConfig.getBaseUrl();
      const mainToken = GlobalConfig.getJwToken();
      if (baseUrl && versaoAtual) {
        const idSistema = ID_SISTEMA_MAP[activeTab];
        const tipoAmb = TIPO_AMBIENTE_MAP[activeEnv];
        const logHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (mainToken) logHeaders['Authorization'] = `Bearer ${mainToken}`;
        const logPayload = {
          id_Sistema: idSistema,
          caminho_Extracao: caminhoExtracao.trim() || null,
          caminho_Destino: caminhoDestino.trim() || null,
          caminho_Backup: caminhoBackup.trim() || null,
          caminho_Log: caminhoLog.trim() || null,
          tipo_Ambiente: tipoAmb,
          prefixo_Http: prefixoHttp,
          url: urlApi.trim() || null,
          ultima_Versao: versaoAtual.num_versao,
          codigo_Licenca: tipoAmb === TIPO_AMBIENTE_MAP.producao ? GlobalConfig.getCodigoLicenca() : null,
        };
        fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/adicionaparametrosatualizacao`, {
          method: 'POST', headers: logHeaders, body: JSON.stringify(logPayload),
        })
          .then((r) => { if (r.ok) setUltimaVersao(versaoAtual.num_versao); })
          .catch(() => { /* silently ignore */ });
      }
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setProgressStatus('error');
      showToast('Erro ao chamar o serviço de atualização.', 'error');
      void logErroAtualizacao(erroMsg);
    } finally {
      if (!usouSSE) {
        // Desbloqueia a licença após qualquer resultado (sucesso ou erro)
        const baseUrlDesbloq = GlobalConfig.getBaseUrl();
        const tokenDesbloq = GlobalConfig.getJwToken();
        if (baseUrlDesbloq) {
          const desbloqHeaders: Record<string, string> = {};
          if (tokenDesbloq) desbloqHeaders['Authorization'] = `Bearer ${tokenDesbloq}`;
          const desbloqParams = new URLSearchParams({ CodigoLicencaBanco: String(GlobalConfig.getCodigoLicenca() ?? '') });
          fetch(`${baseUrlDesbloq.replace(/\/$/, '')}/api/v1/DesbloquearLicenca?${desbloqParams.toString()}`, {
            method: 'PUT',
            headers: desbloqHeaders,
          })
            .then((r) => { if (r.ok) showToast('Sistema desbloqueado com sucesso.', 'success'); })
            .catch(() => { /* silently ignore */ });
        }
        GlobalConfig.setAtualizando(false);
        setLoadingAtualizar(false);
      }
    }
  }, [activeTab, activeEnv, versaoAtual, caminhoExtracao, caminhoDestino, caminhoBackup, caminhoLog, prefixoHttp, urlApi, usuarioIIS, senhaIIS, servidorIIS, iisSiteSelected, iisSites, precisaScript, showToast, logErroAtualizacao, setProgressLogs, setProgressStatus, setProgressModalOpen, setLicencaBloqueada]);

  const desbloquearManual = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;
    setLoadingDesbloquearManual(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const params = new URLSearchParams({ CodigoLicencaBanco: String(GlobalConfig.getCodigoLicenca() ?? '') });
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/DesbloquearLicenca?${params.toString()}`, {
        method: 'PUT',
        headers,
      });
      if (res.ok) {
        setLicencaBloqueada(false);
        setMensagemBloqueioAtual(null);
        showToast('Sistema desbloqueado com sucesso.', 'success');
      } else {
        showToast('Não foi possível desbloquear o sistema.', 'error');
      }
    } catch {
      showToast('Erro ao desbloquear o sistema.', 'error');
    } finally {
      setLoadingDesbloquearManual(false);
    }
  }, [showToast]);

  const executarBloqueio = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;
    setLoadingBloquear(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const params = new URLSearchParams({
        CodigoLicencaBanco: String(GlobalConfig.getCodigoLicenca() ?? ''),
        MensagemBloqueio: mensagemBloqueio,
        DataHoraBloqueio: new Date().toISOString(),
      });
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/BloquearLicenca?${params.toString()}`, {
        method: 'PUT',
        headers,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string };
        showToast(errData?.message || `Erro ao bloquear licença (${res.status})`, 'error');
        setBloquearStep(null);
        return;
      }
      setLicencaBloqueada(true);
      setMensagemBloqueioAtual(mensagemBloqueio);
      setBloquearStep('confirmarDerrubar');
    } catch {
      showToast('Erro ao bloquear licença.', 'error');
      setBloquearStep(null);
    } finally {
      setLoadingBloquear(false);
    }
  }, [mensagemBloqueio, showToast]);

  const executarDerrubarSessoes = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;
    setLoadingBloquear(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const codigoUsuario = GlobalConfig.getUsuario() ?? '';
      const derrubarParams = new URLSearchParams({ CodigoUsuario: codigoUsuario });
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/DerrubarSessoesAll?${derrubarParams.toString()}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setSessoesDerrubadas(true);
        showToast('Sessões derrubadas com sucesso! O botão Atualizar foi liberado.', 'success');
      } else {
        setSessoesDerrubadas(false);
        showToast('Não foi possível derrubar as sessões. O botão Atualizar permanece bloqueado.', 'error');
      }
    } catch {
      setSessoesDerrubadas(false);
      showToast('Erro ao derrubar sessões.', 'error');
    } finally {
      setLoadingBloquear(false);
      setBloquearStep(null);
    }
  }, [showToast]);

  // Chama VerificaVersao sempre que a versão selecionada mudar e tiver dependência
  useEffect(() => {
    if (!versaoAtual || !isNaoVazio(dependencia)) {
      setVersaoApiQsApi(null);
      return;
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl) return;

    setLoadingVerificacao(true);
    setVersaoApiQsApi(null);

    apiManager
      .makeApiCall<unknown>(
        `${baseUrl.replace(/\/$/, '')}/api/v1/VerificaVersao`,
        ApiCallType.GET,
        token ? { Authorization: `Bearer ${token}` } : {},
        {},
      )
      .then((resp) => {
        const body = resp.jsonBody ?? resp.data;
        const raw =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as Record<string, unknown>).message ?? '')
            : typeof body === 'string'
              ? body
              : String(resp.bodyText ?? '').trim();
        setVersaoApiQsApi(raw.replace(/"/g, '').trim() || null);
      })
      .catch(() => setVersaoApiQsApi(null))
      .finally(() => setLoadingVerificacao(false));
  }, [versaoSelecionada, dependencia]);

  /**
   * depOk = true  → versão atual >= dependência  → botão verde, habilitado
   * depOk = false → versão atual < dependência   → botão vermelho, bloqueado
   * depOk = null  → sem dependência ou ainda carregando
   */
  const depOk: boolean | null =
    isNaoVazio(dependencia) && versaoApiQsApi != null && !loadingVerificacao
      ? compareVersions(versaoApiQsApi, dependencia!) >= 0
      : null;

  const btnDisabled = loadingConfig || savingConfig || loadingVerificacao || loadingAtualizar;
  const envTabColor = activeEnv === 'producao' ? '#10b981' : '#2563eb';
  const iisSiteRequired = (activeTab !== 'qserp') && !!versaoSelecionada && !iisSiteSelected;
  const btnAtualizarDisabled =
    !versaoAtual ||
    loadingVerificacao ||
    loadingAtualizar ||
    depOk === false ||
    !hasConfig ||
    (activeTab !== 'qserp' && !iisSiteSelected) ||
    (precisaScript && !sessoesDerrubadas);
  const readyToUpdate =
    !!versaoSelecionada &&
    hasConfig &&
    !iisSiteRequired &&
    depOk !== false &&
    !loadingVerificacao &&
    (!precisaScript || sessoesDerrubadas);
  const btnAtualizarStyle: React.CSSProperties =
    !hasConfig
      ? { backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'not-allowed' }
      : depOk === false
        ? { backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'not-allowed', opacity: 0.85 }
        : iisSiteRequired
          ? { backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'not-allowed' }
          : precisaScript && !sessoesDerrubadas
            ? { backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'not-allowed', opacity: 0.85 }
            : readyToUpdate
              ? { backgroundColor: '#10b981', color: '#fff', border: 'none' }
              : {};

  const iisOptions: SearchableSelectOption[] = useMemo(() => {
    if (activeTab === 'qserp') return [];
    const keyword = activeTab === 'qsapi' ? 'qsapi' : 'erpx';
    return iisSites
      .filter(s => {
        const n = s.nome.toLowerCase().replace(/\s+/g, '');
        if (activeEnv === 'teste') {
          return n.includes(keyword) && n.includes('teste');
        }
        return n.includes(keyword) && !n.includes('teste');
      })
      .map(s => ({
        value: String(s.id),
        label: s.nome,
      }));
  }, [iisSites, activeTab, activeEnv]);

  const versoesOptions: SearchableSelectOption[] = versoes.map((v) => ({
    value: v.num_versao,
    label: v.num_versao,
  }));

  return (
    <>
      <main className="clientes-page list-layout-page">
        <section className="clientes-page__header">
          <div className="clientes-page__title-wrap">
            <button className="icon-button" type="button" onClick={handleClose} aria-label="Voltar">
              <IoArrowBack size={18} />
            </button>
            <div>
              <h1>Versões</h1>
              <p>QS Atualiza — versões dos componentes.</p>
            </div>
          </div>
        </section>

        <section className="clientes-panel list-layout-panel">
          {/* Agrupamento das duas linhas de abas sem gap entre elas */}
          <div>
            {/* Abas de ambiente: Produção / Teste */}
            <div className="contas-receber-tabs" style={{ borderBottom: `2px solid ${envTabColor}`, marginBottom: 0 }}>
              <button
                type="button"
                className={`contas-receber-tab${activeEnv === 'producao' ? ' contas-receber-tab--active' : ''}`}
                style={activeEnv === 'producao' ? { borderBottomColor: envTabColor } : undefined}
                disabled={loadingAtualizar}
                onClick={() => { setActiveEnv('producao'); setActiveTab('qserp'); }}
              >
                Produção
              </button>
              <button
                type="button"
                className={`contas-receber-tab${activeEnv === 'teste' ? ' contas-receber-tab--active' : ''}`}
                style={activeEnv === 'teste' ? { borderBottomColor: envTabColor } : undefined}
                disabled={loadingAtualizar}
                onClick={() => { setActiveEnv('teste'); setActiveTab('qserp'); }}
              >
                Teste
              </button>
            </div>

            {/* Abas internas: QS ERP / QS API / QS ERPX */}
            <div className="contas-receber-tabs" style={{ marginTop: 0, borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className={`contas-receber-tab${activeTab === 'qserp' ? ' contas-receber-tab--active' : ''}`}
                style={activeTab === 'qserp' ? { borderBottomColor: envTabColor } : undefined}
                disabled={loadingAtualizar}
                onClick={() => setActiveTab('qserp')}
              >
                {activeEnv === 'teste' ? 'QS ERP Teste' : 'QS ERP'}
              </button>
              <button
                type="button"
                className={`contas-receber-tab${activeTab === 'qsapi' ? ' contas-receber-tab--active' : ''}`}
                style={activeTab === 'qsapi' ? { borderBottomColor: envTabColor } : undefined}
                disabled={loadingAtualizar}
                onClick={() => setActiveTab('qsapi')}
              >
                {activeEnv === 'teste' ? 'QS API Teste' : 'QS API'}
              </button>
              <button
                type="button"
                className={`contas-receber-tab${activeTab === 'qserpx' ? ' contas-receber-tab--active' : ''}`}
                style={activeTab === 'qserpx' ? { borderBottomColor: envTabColor } : undefined}
                disabled={loadingAtualizar}
                onClick={() => setActiveTab('qserpx')}
              >
                {activeEnv === 'teste' ? 'QS ERPX Teste' : 'QS ERPX'}
              </button>
            </div>
          </div>

          <div className="params-gerais-tab-body">
            <div className="nfe-params-form">

              {/* BLOCO 1: Configurações de atualização */}
              <div className="nfe-params-fieldset">
                <span className="nfe-params-fieldset__legend">Configurações de atualização {TAB_LABEL[activeTab]}</span>

                {erroConfig && (
                  <div className="status-box status-box--error" style={{ marginBottom: '1rem' }}>
                    <IoWarningOutline size={16} />
                    <p>{erroConfig}</p>
                  </div>
                )}

                {Object.values(camposErro).some(Boolean) && (
                  <div className="status-box status-box--error" style={{ marginBottom: '1rem' }}>
                    <IoWarningOutline size={16} />
                    <p>
                      Campos obrigatórios não preenchidos:{' '}
                      {[
                        camposErro['caminhoExtracao'] ? 'Caminho de extração' : '',
                        camposErro['caminhoDestino'] ? 'Caminho de destino' : '',
                        camposErro['caminhoBackup'] ? 'Caminho de backup' : '',
                        camposErro['caminhoLog'] ? 'Caminho de log' : '',
                      ].filter(s => s !== '').join(', ')}
                    </p>
                  </div>
                )}

                <div className="nfe-params-flds-row">
                  <label className="nfe-params-field">
                    <span>Caminho de extração</span>
                    <div className="clientes-cep-input">
                      <input
                        className="text-field"
                        value={caminhoExtracao}
                        onChange={(e) => { setCaminhoExtracao(e.target.value); if (camposErro['caminhoExtracao']) setCamposErro(p => ({ ...p, caminhoExtracao: false })); }}
                        placeholder="Ex: \\servidor\extracao"
                        disabled={!isEditing}
                        style={camposErro['caminhoExtracao'] ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        title="Informações sobre caminho de extração"
                        aria-label="Ajuda caminho de extração"
                        onClick={() => setModalCaminhoOpen('destino')}
                      >
                        <IoHelpCircleOutline size={20} />
                      </button>
                    </div>
                  </label>

                  <label className="nfe-params-field">
                    <span>Caminho de destino</span>
                    <div className="clientes-cep-input">
                      <input
                        className="text-field"
                        value={caminhoDestino}
                        onChange={(e) => { setCaminhoDestino(e.target.value); if (camposErro['caminhoDestino']) setCamposErro(p => ({ ...p, caminhoDestino: false })); }}
                        placeholder="Ex: \\servidor\qserp"
                        disabled={!isEditing}
                        style={camposErro['caminhoDestino'] ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        title="Informações sobre caminho de destino"
                        aria-label="Ajuda caminho de destino"
                        onClick={() => setModalCaminhoOpen('destino')}
                      >
                        <IoHelpCircleOutline size={20} />
                      </button>
                    </div>
                  </label>
                </div>

                <div className="nfe-params-flds-row">
                  <label className="nfe-params-field">
                    <span>Caminho de backup</span>
                    <div className="clientes-cep-input">
                      <input
                        className="text-field"
                        value={caminhoBackup}
                        onChange={(e) => { setCaminhoBackup(e.target.value); if (camposErro['caminhoBackup']) setCamposErro(p => ({ ...p, caminhoBackup: false })); }}
                        placeholder="Ex: \\servidor\backup"
                        disabled={!isEditing}
                        style={camposErro['caminhoBackup'] ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        title="Informações sobre caminho de backup"
                        aria-label="Ajuda caminho de backup"
                        onClick={() => setModalCaminhoOpen('backup')}
                      >
                        <IoHelpCircleOutline size={20} />
                      </button>
                    </div>
                  </label>

                  <label className="nfe-params-field">
                    <span>Caminho de log</span>
                    <div className="clientes-cep-input">
                      <input
                        className="text-field"
                        value={caminhoLog}
                        onChange={(e) => { setCaminhoLog(e.target.value); if (camposErro['caminhoLog']) setCamposErro(p => ({ ...p, caminhoLog: false })); }}
                        placeholder="Ex: \\servidor\logs"
                        disabled={!isEditing}
                        style={camposErro['caminhoLog'] ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
                      />
                      <button
                        type="button"
                        className="icon-button module-action-button clientes-cep-search"
                        title="Informações sobre caminho de log"
                        aria-label="Ajuda caminho de log"
                        onClick={() => setModalCaminhoOpen('destino')}
                      >
                        <IoHelpCircleOutline size={20} />
                      </button>
                    </div>
                  </label>
                </div>

                <div className="nfe-params-flds-row">
                  <div className="nfe-params-field">
                    <span>Prefixo HTTP</span>
                    <div className="protocol-group">
                      <button
                        type="button"
                        className={`protocol-option ${prefixoHttp === 'http' ? 'is-active' : ''}`}
                        onClick={() => setPrefixoHttp('http')}
                        disabled={!isEditing}
                      >
                        http
                      </button>
                      <button
                        type="button"
                        className={`protocol-option ${prefixoHttp === 'https' ? 'is-active' : ''}`}
                        onClick={() => setPrefixoHttp('https')}
                        disabled={!isEditing}
                      >
                        https
                      </button>
                    </div>
                  </div>

                  <label className="nfe-params-field">
                    <span>URL API</span>
                    <div className="clientes-cep-input">
                      <div className="url-field">
                        <span>{prefixoHttp}://</span>
                        <input
                          value={urlApi}
                          onChange={(e) => setUrlApi(e.target.value.replace(/^https?:\/\//, ''))}
                          disabled={!isEditing}
                        />
                      </div>
                      {urlApiStatus === 'testando' && (
                        <span className="icon-button module-action-button clientes-cep-search" style={{ color: 'var(--color-muted)', fontSize: '0.7rem', width: 'auto', padding: '0 6px' }}>...</span>
                      )}
                      {urlApiStatus === 'ok' && (
                        <span className="icon-button module-action-button clientes-cep-search" title="URL acessível" style={{ color: '#10b981', cursor: 'default' }}>
                          <IoCheckmarkCircle size={20} />
                        </span>
                      )}
                      {urlApiStatus === 'erro' && (
                        <span className="icon-button module-action-button clientes-cep-search" title="URL inacessível" style={{ color: '#ef4444', cursor: 'default' }}>
                          <IoCloseCircle size={20} />
                        </span>
                      )}
                    </div>
                  </label>
                </div>

                {/* Botões Salvar/Editar e Cancelar */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => (isEditing ? void salvarConfiguracoes(ID_SISTEMA_MAP[activeTab], TIPO_AMBIENTE_MAP[activeEnv]) : setIsEditing(true))}
                    disabled={btnDisabled}
                    style={{ width: 'auto' }}
                  >
                    {savingConfig ? 'Salvando...' : isEditing ? 'Salvar' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelar}
                    disabled={btnDisabled || !isEditing}
                    style={{ width: 'auto' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Bloco de aviso: sistema bloqueado (visível apenas quando não está atualizando e a licença está bloqueada) */}
              {!loadingAtualizar && licencaBloqueada && (
                <div className="nfe-params-fieldset" style={{ borderColor: '#f59e0b', marginTop: '1.5rem' }}>
                  <span className="nfe-params-fieldset__legend" style={{ color: '#92400e' }}>Sistemas Bloqueados</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <IoWarningOutline size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>
                        A licença está bloqueada para acesso dos demais usuários.
                      </p>
                      {mensagemBloqueioAtual && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                          {mensagemBloqueioAtual}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: 'auto', backgroundColor: '#d97706', borderColor: '#d97706' }}
                      disabled={loadingDesbloquearManual}
                      onClick={() => void desbloquearManual()}
                    >
                      {loadingDesbloquearManual ? 'Desbloqueando...' : 'Desbloquear Sistema'}
                    </button>
                  </div>
                </div>
              )}

              {/* BLOCOS IIS + Versões — lado a lado */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', alignItems: 'flex-start' }}>

                {/* BLOCO IIS: Informações Site IIS */}
                {(activeTab === 'qsapi' || activeTab === 'qserpx') && (
                  <div className="nfe-params-fieldset" style={{ flex: 1, minWidth: 0 }}>
                    <span className="nfe-params-fieldset__legend">Informações Site IIS</span>

                    {loadingIIS && (
                      <p className="nfe-params-loading">Carregando sites IIS...</p>
                    )}

                    {erroIIS && (
                      <div className="status-box status-box--error" style={{ marginBottom: '1rem' }}>
                        <IoWarningOutline size={16} />
                        <p>{erroIIS}</p>
                      </div>
                    )}

                    {!loadingIIS && !erroIIS && (
                      <div className="nfe-params-field" style={iisSiteRequired ? { border: '2px solid #ef4444', borderRadius: '8px', padding: '6px' } : undefined}>
                        <span>Site IIS</span>
                        <SearchableSelect
                          options={iisOptions}
                          value={iisSiteSelected}
                          onChange={setIisSiteSelected}
                          ariaLabel="Site IIS"
                          enableSearch={iisOptions.length > 5}
                          placeholder={iisOptions.length === 0 ? 'Nenhum site encontrado' : 'Selecione o site IIS...'}
                          minDropdownWidth={480}
                          listHeader={
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', padding: '0.25rem 0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <span>Nome Site</span>
                              <span>Porta Http</span>
                              <span>Porta Https</span>
                            </div>
                          }
                          renderOption={(option) => {
                            const site = iisSites.find(s => String(s.id) === option.value);
                            const httpPort = site?.bindings.find(b => b.protocolo === 'http')?.porta;
                            const httpsPort = site?.bindings.find(b => b.protocolo === 'https')?.porta;
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', width: '100%' }}>
                                <span>{option.label}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{httpPort ?? '—'}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{httpsPort ?? '—'}</span>
                              </div>
                            );
                          }}
                        />
                      </div>
                    )}
                    {iisSiteRequired && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: 0 }}>
                        Selecione um site IIS para continuar
                      </p>
                    )}
                  </div>
                )}

                {/* BLOCO 2: Versões disponíveis */}
                <div className="nfe-params-fieldset" style={{ flex: 1, minWidth: 0 }}>
                  <span className="nfe-params-fieldset__legend">Versões disponíveis</span>

                  {loadingVersoes && (
                    <p className="nfe-params-loading">Carregando versões...</p>
                  )}

                  {erroVersoes && (
                    <div className="status-box status-box--error" style={{ marginBottom: '1rem' }}>
                      <IoWarningOutline size={16} />
                      <p>{erroVersoes}</p>
                    </div>
                  )}

                  {!loadingVersoes && !erroVersoes && (
                    <>
                      {!hasConfig && (
                        <div className="status-box status-box--error" style={{ marginBottom: '1rem' }}>
                          <IoWarningOutline size={16} />
                          <p>Primeiro é preciso realizar cadastro das configurações</p>
                        </div>
                      )}

                      <div className="nfe-params-field" style={!hasConfig ? { border: '2px solid #ef4444', borderRadius: '4px', padding: '6px' } : undefined}>
                        <span>Versão para atualizar</span>
                        <SearchableSelect
                          options={versoesOptions}
                          value={versaoSelecionada}
                          disabled={loadingAtualizar}
                          onChange={(val) => {
                            if (!hasConfig) {
                              alert('Primeiro é preciso realizar cadastro das configurações');
                              return;
                            }
                            setVersaoSelecionada(val);
                            setSessoesDerrubadas(false);
                          }}
                          ariaLabel="Versão"
                          enableSearch={versoesOptions.length > 6}
                          placeholder={versoesOptions.length === 0 ? 'Nenhuma versão disponível' : 'Selecione a versão...'}
                        />
                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        style={{ ...btnAtualizarStyle, whiteSpace: 'nowrap', marginTop: '0.75rem' }}
                        disabled={btnAtualizarDisabled}
                        onClick={() => setModalConfirmAtualizarOpen(true)}
                      >
                        {loadingAtualizar ? 'Atualizando...' : loadingVerificacao ? 'Verificando...' : 'Atualizar'}
                      </button>

                      {ultimaVersao && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', marginTop: '0.5rem', backgroundColor: 'var(--color-primary-soft, #eff6ff)', border: '1px solid var(--color-primary-border, #93c5fd)', borderRadius: '6px', fontSize: '0.82rem' }}>
                          <IoCheckmarkCircle size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span style={{ color: 'var(--color-text)' }}>
                            Última atualização:{' '}
                            <strong style={{ fontFamily: 'monospace' }}>{ultimaVersao}</strong>
                          </span>
                        </div>
                      )}

                      {/* Mensagens de aviso — dentro do fieldset apenas para qsapi/qserpx */}
                      {activeTab !== 'qserp' && versaoAtual && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                          {precisaScript && (
                            <div style={{
                              backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                              border: '1px solid var(--color-warning-border, #fbbf24)',
                              borderRadius: '6px',
                              padding: '1rem 1.25rem',
                              display: 'flex',
                              gap: '0.75rem',
                              alignItems: 'flex-start',
                            }}>
                              <IoWarningOutline size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
                              <div>
                                <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                                  Atenção: esta versão possui script de banco de dados
                                </p>
                                <p style={{ color: '#78350f', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                  Antes de atualizar é obrigatório realizar o <strong>backup do banco de dados</strong> e
                                  garantir que todos os <strong>usuários estejam offline</strong> no sistema.
                                </p>
                                {!loadingAtualizar && !sessoesDerrubadas && (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    style={{ width: 'auto', marginTop: '0.75rem', backgroundColor: '#d97706', borderColor: '#d97706', color: '#fff' }}
                                    onClick={() => setBloquearStep('confirmar')}
                                  >
                                    Bloquear / Derrubar Sessões
                                  </button>
                                )}
                                {!loadingAtualizar && sessoesDerrubadas && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>
                                    <IoCheckmarkCircle size={16} style={{ flexShrink: 0 }} />
                                    Sessões derrubadas — Atualização liberada
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {isNaoVazio(dependencia) && (
                            <div style={{
                              backgroundColor: depOk === false ? '#fef2f2' : depOk === true ? '#f0fdf4' : 'var(--color-info-bg, #eff6ff)',
                              border: `1px solid ${depOk === false ? '#fca5a5' : depOk === true ? '#86efac' : 'var(--color-info-border, #93c5fd)'}`,
                              borderRadius: '6px',
                              padding: '1rem 1.25rem',
                              display: 'flex',
                              gap: '0.75rem',
                              alignItems: 'flex-start',
                            }}>
                              <IoInformationCircleOutline
                                size={20}
                                style={{
                                  color: depOk === false ? '#dc2626' : depOk === true ? '#16a34a' : '#2563eb',
                                  flexShrink: 0,
                                  marginTop: '1px',
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <p style={{
                                  fontWeight: 600,
                                  color: depOk === false ? '#991b1b' : depOk === true ? '#166534' : '#1e40af',
                                  marginBottom: '0.35rem',
                                }}>
                                  Dependência da versão QSAPI:{' '}
                                  <code style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.03em' }}>{dependencia}</code>
                                </p>

                                {loadingVerificacao && (
                                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Verificando versão instalada...</p>
                                )}

                                {!loadingVerificacao && versaoApiQsApi != null && (
                                  <p style={{
                                    fontSize: '0.875rem',
                                    color: depOk === false ? '#b91c1c' : '#374151',
                                    marginBottom: '0.25rem',
                                  }}>
                                    Versão atual:{' '}
                                    <strong style={{ fontFamily: 'monospace' }}>{versaoApiQsApi}</strong>
                                    {depOk === true && (
                                      <span style={{ marginLeft: '0.5rem', color: '#16a34a' }}>— dependência satisfeita ✓</span>
                                    )}
                                    {depOk === false && (
                                      <span style={{ marginLeft: '0.5rem', color: '#dc2626' }}>— versão insuficiente ✗</span>
                                    )}
                                  </p>
                                )}

                                {!loadingVerificacao && depOk === false && (
                                  <p style={{ color: '#b91c1c', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                    Atualize a QSAPI para a versão <strong>{dependencia}</strong> ou superior antes de continuar.
                                  </p>
                                )}

                                {!loadingVerificacao && depOk !== false && (
                                  <p style={{ color: depOk === true ? '#166534' : '#1d4ed8', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                    Para atualizar para esta versão é necessário verificar se a versão de
                                    dependência indicada acima já está instalada no ambiente.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* BLOCO 3: Avisos de script/dependência — apenas para qserp, exibido à direita */}
                {activeTab === 'qserp' && (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!loadingVersoes && !erroVersoes && versaoAtual && precisaScript && (
                      <div style={{
                        backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                        border: '1px solid var(--color-warning-border, #fbbf24)',
                        borderRadius: '6px',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                      }}>
                        <IoWarningOutline size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
                        <div>
                          <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                            Atenção: esta versão possui script de banco de dados
                          </p>
                          <p style={{ color: '#78350f', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Antes de atualizar é obrigatório realizar o <strong>backup do banco de dados</strong> e
                            garantir que todos os <strong>usuários estejam offline</strong> no sistema.
                          </p>
                          {!loadingAtualizar && !sessoesDerrubadas && (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ width: 'auto', marginTop: '0.75rem', backgroundColor: '#d97706', borderColor: '#d97706', color: '#fff' }}
                              onClick={() => setBloquearStep('confirmar')}
                            >
                              Bloquear / Derrubar Sessões
                            </button>
                          )}
                          {!loadingAtualizar && sessoesDerrubadas && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>
                              <IoCheckmarkCircle size={16} style={{ flexShrink: 0 }} />
                              Sessões derrubadas — Atualização liberada
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!loadingVersoes && !erroVersoes && versaoAtual && isNaoVazio(dependencia) && (
                      <div style={{
                        backgroundColor: depOk === false ? '#fef2f2' : depOk === true ? '#f0fdf4' : 'var(--color-info-bg, #eff6ff)',
                        border: `1px solid ${depOk === false ? '#fca5a5' : depOk === true ? '#86efac' : 'var(--color-info-border, #93c5fd)'}`,
                        borderRadius: '6px',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                      }}>
                        <IoInformationCircleOutline
                          size={20}
                          style={{
                            color: depOk === false ? '#dc2626' : depOk === true ? '#16a34a' : '#2563eb',
                            flexShrink: 0,
                            marginTop: '1px',
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontWeight: 600,
                            color: depOk === false ? '#991b1b' : depOk === true ? '#166534' : '#1e40af',
                            marginBottom: '0.35rem',
                          }}>
                            Dependência da versão QSAPI:{' '}
                            <code style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.03em' }}>{dependencia}</code>
                          </p>

                          {loadingVerificacao && (
                            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Verificando versão instalada...</p>
                          )}

                          {!loadingVerificacao && versaoApiQsApi != null && (
                            <p style={{
                              fontSize: '0.875rem',
                              color: depOk === false ? '#b91c1c' : '#374151',
                              marginBottom: '0.25rem',
                            }}>
                              Versão atual:{' '}
                              <strong style={{ fontFamily: 'monospace' }}>{versaoApiQsApi}</strong>
                              {depOk === true && (
                                <span style={{ marginLeft: '0.5rem', color: '#16a34a' }}>— dependência satisfeita ✓</span>
                              )}
                              {depOk === false && (
                                <span style={{ marginLeft: '0.5rem', color: '#dc2626' }}>— versão insuficiente ✗</span>
                              )}
                            </p>
                          )}

                          {!loadingVerificacao && depOk === false && (
                            <p style={{ color: '#b91c1c', fontSize: '0.875rem', lineHeight: '1.5' }}>
                              Atualize a QSAPI para a versão <strong>{dependencia}</strong> ou superior antes de continuar.
                            </p>
                          )}

                          {!loadingVerificacao && depOk !== false && (
                            <p style={{ color: depOk === true ? '#166534' : '#1d4ed8', fontSize: '0.875rem', lineHeight: '1.5' }}>
                              Para atualizar para esta versão é necessário verificar se a versão de
                              dependência indicada acima já está instalada no ambiente.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Modal: ajuda caminho de destino */}
      {modalCaminhoOpen === 'destino' && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Caminho de destino">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Caminho de destino</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setModalCaminhoOpen(null)}>
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body" style={{ padding: '1.5rem 2rem' }}>
              <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                O caminho de destino deve ser obrigatoriamente um <strong>caminho de rede</strong>.
                Caminhos locais <strong>não são permitidos</strong> pois o processo de atualização é
                executado pelo servidor e precisa ter acesso ao diretório.
              </p>

              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>✅ Exemplos válidos (rede):</p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '1.25rem', lineHeight: '2', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-alt, #f5f5f5)', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <li><code>\\servidor\qserp</code></li>
                <li><code>\\192.168.1.100\sistemas\qserp</code></li>
                <li><code>\\SERVIDOR01\Compartilhado\QsErp</code></li>
              </ul>

              <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#dc2626' }}>❌ Exemplos inválidos (local):</p>
              <ul style={{ marginLeft: '1.5rem', lineHeight: '2', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-alt, #f5f5f5)', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <li><code>C:\QsErp</code></li>
                <li><code>D:\Sistemas\QsErp</code></li>
              </ul>
            </div>
            <footer className="modal-card__footer">
              <button type="button" className="primary-button" onClick={() => setModalCaminhoOpen(null)}>Entendido</button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: ajuda caminho de backup */}
      {modalCaminhoOpen === 'backup' && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Caminho de backup">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Caminho de backup</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setModalCaminhoOpen(null)}>
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body" style={{ padding: '1.5rem 2rem' }}>
              <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                O caminho de backup deve ser um <strong>caminho de rede</strong> e preferencialmente
                localizado no mesmo servidor onde está o banco de dados, garantindo velocidade e
                integridade do backup.
              </p>

              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>✅ Exemplos válidos (rede):</p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '1.25rem', lineHeight: '2', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-alt, #f5f5f5)', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <li><code>\\servidor\backup\qserp</code></li>
                <li><code>\\192.168.1.100\backups</code></li>
                <li><code>\\SERVIDOR-BD\Backup\Diario</code></li>
              </ul>

              <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#dc2626' }}>❌ Exemplos inválidos (local):</p>
              <ul style={{ marginLeft: '1.5rem', lineHeight: '2', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-alt, #f5f5f5)', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <li><code>C:\Backup</code></li>
                <li><code>D:\Backup\QsErp</code></li>
              </ul>
            </div>
            <footer className="modal-card__footer">
              <button type="button" className="primary-button" onClick={() => setModalCaminhoOpen(null)}>Entendido</button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: confirmar atualização */}
      {modalConfirmAtualizarOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar atualização">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Confirmar atualização</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setModalConfirmAtualizarOpen(false)}>
                <IoCloseOutline size={18} />
              </button>
            </header>
            <div className="modal-card__body" style={{ padding: '1.5rem 2rem' }}>
              <p style={{ lineHeight: '1.6' }}>
                Deseja realmente atualizar o <strong>{TAB_LABEL[activeTab]}</strong> para a versão{' '}
                <strong>{versaoSelecionada}</strong>?
              </p>
              {precisaScript && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px' }}>
                  <p style={{ color: '#92400e', fontWeight: 600, fontSize: '0.9rem' }}>
                    ⚠️ Esta versão possui script de banco de dados. Certifique-se de que o backup foi realizado antes de continuar.
                  </p>
                </div>
              )}
            </div>
            <footer className="modal-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="secondary-button" onClick={() => setModalConfirmAtualizarOpen(false)} disabled={loadingAtualizar} style={{ width: 'auto' }}>
                Não
              </button>
              <button type="button" className="primary-button" onClick={() => { void executarAtualizacao(); }} disabled={loadingAtualizar} style={{ width: 'auto' }}>
                {loadingAtualizar ? 'Atualizando...' : 'Sim, atualizar'}
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: progresso de atualização (SSE) */}
      {progressModalOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Progresso da atualização">
          <article className="modal-card" style={{ width: 'min(680px, 96vw)', display: 'flex', flexDirection: 'column' }}>
            <header className="modal-card__header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                {progressStatus === 'running' && (
                  <span className="loading-spinner" style={{ width: 18, height: 18, border: '2.5px solid var(--color-border)', borderTopColor: '#d97706', flexShrink: 0, margin: 0 }} />
                )}
                {progressStatus === 'success' && <IoCheckmarkCircle size={20} style={{ color: '#10b981', flexShrink: 0 }} />}
                {progressStatus === 'error' && <IoCloseCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    Atualizando {TAB_LABEL[activeTab]}{versaoSelecionada ? ` — v${versaoSelecionada}` : ''}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    {progressStatus === 'running'
                      ? 'Atualização em andamento…'
                      : progressStatus === 'success'
                        ? 'Concluído com sucesso!'
                        : 'Encerrado com erro.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                disabled={progressStatus === 'running'}
                onClick={() => setProgressModalOpen(false)}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <div
              ref={logContainerRef}
              style={{
                backgroundColor: 'var(--color-code-bg, #1a1a1a)',
                color: '#d4d4d4',
                fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
                fontSize: '0.78rem',
                lineHeight: 1.75,
                padding: '0.875rem 1rem',
                borderRadius: '6px',
                minHeight: '120px',
                height: '340px',
                overflowY: 'auto',
                margin: '0.875rem 0',
              }}
            >
              {progressLogs.length === 0 && progressStatus === 'running' && (
                <span style={{ color: '#6a9955' }}>Conectando ao servidor de atualização…</span>
              )}
              {progressLogs.map((log, i) => (
                <div key={i}>
                  <span style={{ color: '#6a9955', userSelect: 'none' }}>[{log.hora}]</span>
                  {' '}
                  <span style={{ color: getLogColor(log.mensagem) }}>{log.mensagem}</span>
                </div>
              ))}
              {progressStatus === 'running' && progressLogs.length > 0 && (
                <span style={{ color: '#d97706' }}>&#9607;</span>
              )}
            </div>

            <footer className="modal-card__footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-button"
                style={{ width: 'auto' }}
                disabled={progressStatus === 'running'}
                onClick={() => setProgressModalOpen(false)}
              >
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: confirmar bloqueio */}
      {bloquearStep === 'confirmar' && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Bloquear sistema">
          <article className="modal-card">
            <header className="modal-card__header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <IoAlertCircleOutline size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Bloquear sistema</h2>
              </div>
            </header>
            <div className="modal-card__body" style={{ padding: '1rem 0.25rem 0.5rem' }}>
              <p style={{ lineHeight: '1.7', fontSize: '0.925rem' }}>
                Deseja realmente <strong>derrubar os usuários e bloquear o sistema</strong> antes da atualização?
              </p>
            </div>
            <footer className="modal-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
              <button type="button" className="secondary-button" onClick={() => setBloquearStep(null)} style={{ width: 'auto' }}>Não</button>
              <button type="button" className="primary-button" onClick={() => setBloquearStep('mensagem')} style={{ width: 'auto' }}>Sim</button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: mensagem de bloqueio */}
      {bloquearStep === 'mensagem' && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mensagem de bloqueio">
          <article className="modal-card" style={{ width: 'min(520px, 100%)' }}>
            <header className="modal-card__header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.875rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Mensagem de bloqueio</h2>
            </header>
            <div className="modal-card__body" style={{ padding: '1rem 0.25rem 0.5rem' }}>
              <label className="nfe-params-field">
                <span style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>Mensagem exibida aos usuários</span>
                <textarea
                  className="text-field"
                  rows={4}
                  value={mensagemBloqueio}
                  onChange={(e) => setMensagemBloqueio(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
                />
              </label>
            </div>
            <footer className="modal-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
              <button type="button" className="secondary-button" onClick={() => setBloquearStep(null)} disabled={loadingBloquear} style={{ width: 'auto' }}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => void executarBloqueio()} disabled={loadingBloquear} style={{ width: 'auto' }}>
                {loadingBloquear ? 'Bloqueando...' : 'Confirmar'}
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* Modal: confirmar derrubar sessões */}
      {bloquearStep === 'confirmarDerrubar' && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Derrubar sessões">
          <article className="modal-card">
            <header className="modal-card__header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <IoAlertCircleOutline size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Derrubar sessões</h2>
              </div>
            </header>
            <div className="modal-card__body" style={{ padding: '1rem 0.25rem 0.5rem' }}>
              <p style={{ lineHeight: '1.7', fontSize: '0.925rem' }}>
                Sistema bloqueado com sucesso. Deseja <strong>derrubar todos os usuários de todos os sistemas</strong>?
              </p>
            </div>
            <footer className="modal-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
              <button type="button" className="secondary-button" onClick={() => setBloquearStep(null)} disabled={loadingBloquear} style={{ width: 'auto' }}>Não</button>
              <button type="button" className="primary-button" onClick={() => void executarDerrubarSessoes()} disabled={loadingBloquear} style={{ width: 'auto' }}>
                {loadingBloquear ? 'Derrubando...' : 'Sim, derrubar'}
              </button>
            </footer>
          </article>
        </section>
      )}
    </>
  );
}

