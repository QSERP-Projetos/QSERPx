type SessionData = {
  jwToken: string;
  numHD: string;
  chaveCriptoHD: string;
  numAcessos?: number;
  situacaoLicenca?: number;
  dataValidadeLicenca?: string;
  usuario: string;
  codEmpresa?: number;
  nomeEmpresa: string;
  cnpj: string;
  uuidNavegador: string;
  idSessaoUsuario?: number;
  listaTransacaoUsuarioQSERPx: Array<Record<string, unknown>>;
  nivelUsuario?: number;
  tipoApontProd: string;
  tipoApontMaoObra: string;
  permitirApontamentoSemOperacao: boolean;
};

declare global {
  interface Window {
    __QSERPX_CONFIG__?: { baseUrl?: string };
  }
}

const STORAGE_KEYS = {
  baseUrl: 'baseUrl',
  baseUrlPersistent: 'qserpx_baseUrl_persistent',
  session: 'sessionData',
  uuid: 'uuidNavegador',
} as const;

const defaultSession: SessionData = {
  jwToken: '',
  numHD: '',
  chaveCriptoHD: '',
  numAcessos: undefined,
  situacaoLicenca: undefined,
  dataValidadeLicenca: undefined,
  usuario: '',
  codEmpresa: undefined,
  nomeEmpresa: '',
  cnpj: '',
  uuidNavegador: '',
  idSessaoUsuario: undefined,
  listaTransacaoUsuarioQSERPx: [],
  nivelUsuario: undefined,
  tipoApontProd: 'Apontamento Padrão',
  tipoApontMaoObra: 'Apontamento Padrão',
  permitirApontamentoSemOperacao: false,
};

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage issues
  }
};

const safeRemove = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage issues
  }
};

export class GlobalConfig {
  private static session: SessionData = { ...defaultSession };
  private static baseUrl = '';

  /**
   * Salva URL com persistência robusta (sessionStorage + localStorage)
   */
  static async setBaseUrl(url: string): Promise<void> {
    const cleanUrl = url?.trim();
    if (!cleanUrl) return;

    this.baseUrl = cleanUrl;
    
    // Salvar no sessionStorage (cache)
    safeSet(STORAGE_KEYS.baseUrl, cleanUrl);
    
    // Salvar no localStorage (persistente)
    try {
      window.localStorage.setItem(STORAGE_KEYS.baseUrlPersistent, cleanUrl);
    } catch {
      // ignore storage issues
    }
  }

  /**
   * Carrega URL com fallback em múltiplas fontes
   * Ordem de prioridade: window.__QSERPX_CONFIG__ > env > sessionStorage > localStorage
   */
  static async loadBaseUrl(): Promise<void> {
    // 1. Tentar window config
    const serverUrl = window.__QSERPX_CONFIG__?.baseUrl;
    if (serverUrl) {
      this.baseUrl = serverUrl;
      return;
    }

    // 2. Tentar variável de ambiente
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
      this.baseUrl = envUrl;
      return;
    }

    // 3. Tentar sessionStorage (cache)
    const cachedUrl = safeGet(STORAGE_KEYS.baseUrl);
    if (cachedUrl) {
      this.baseUrl = cachedUrl;
      return;
    }

    // 4. Tentar localStorage (persistente)
    try {
      const persistentUrl = window.localStorage.getItem(STORAGE_KEYS.baseUrlPersistent);
      if (persistentUrl) {
        this.baseUrl = persistentUrl;
        // Restaurar no cache
        safeSet(STORAGE_KEYS.baseUrl, persistentUrl);
        return;
      }
    } catch {
      // ignore storage issues
    }
  }

  /**
   * Retorna URL base para uso nas chamadas de API
   */
  static getBaseUrl(): string {
    const serverUrl = window.__QSERPX_CONFIG__?.baseUrl;
    if (serverUrl) return serverUrl;
    return this.baseUrl;
  }

  static async loadSession(): Promise<void> {
    const raw = safeGet(STORAGE_KEYS.session);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<SessionData>;
      this.session = {
        ...defaultSession,
        ...parsed,
        tipoApontProd: parsed.tipoApontProd || parsed.tipoApontProd || 'Apontamento Padrão',
        tipoApontMaoObra: parsed.tipoApontMaoObra || parsed.tipoApontMaoObra || 'Apontamento Padrão',
        permitirApontamentoSemOperacao: Boolean(parsed.permitirApontamentoSemOperacao),
      };
    } catch {
      this.session = { ...defaultSession };
    }
  }

  static async saveSession(): Promise<void> {
    safeSet(STORAGE_KEYS.session, JSON.stringify(this.session));
  }

  static async clearConfig(): Promise<void> {
    this.session = { ...defaultSession };
    safeRemove(STORAGE_KEYS.session);
  }

  static async ensureUuidNavegador(): Promise<string> {
    if (this.session.uuidNavegador) return this.session.uuidNavegador;

    const stored = safeGet(STORAGE_KEYS.uuid);
    if (stored) {
      this.setUuidNavegador(stored);
      return stored;
    }

    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `uuid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    this.setUuidNavegador(generated);
    safeSet(STORAGE_KEYS.uuid, generated);
    return generated;
  }

  static setJwToken(token: string): void {
    this.session.jwToken = token;
    void this.saveSession();
  }

  static getJwToken(): string {
    return this.session.jwToken;
  }

  static setNumHD(value: string): void {
    this.session.numHD = value;
    void this.saveSession();
  }

  static getNumHD(): string {
    return this.session.numHD;
  }

  static setChaveCriptoHD(value: string): void {
    this.session.chaveCriptoHD = value;
    void this.saveSession();
  }

  static getChaveCriptoHD(): string {
    return this.session.chaveCriptoHD;
  }

  static getChaveApi(): string {
    return this.session.chaveCriptoHD;
  }

  static setNumAcessos(value?: number): void {
    this.session.numAcessos = value;
    void this.saveSession();
  }

  static getNumAcessos(): number | undefined {
    return this.session.numAcessos;
  }

  static setSituacaoLicenca(value?: number): void {
    this.session.situacaoLicenca = value;
    void this.saveSession();
  }

  static getSituacaoLicenca(): number | undefined {
    return this.session.situacaoLicenca;
  }

  static setDataValidadeLicenca(value?: string): void {
    this.session.dataValidadeLicenca = value;
    void this.saveSession();
  }

  static getDataValidadeLicenca(): string | undefined {
    return this.session.dataValidadeLicenca;
  }

  static setUsuario(value: string): void {
    this.session.usuario = value;
    void this.saveSession();
  }

  static getUsuario(): string {
    return this.session.usuario;
  }

  static setCodEmpresa(value?: number): void {
    this.session.codEmpresa = value;
    void this.saveSession();
  }

  static getCodEmpresa(): number | undefined {
    return this.session.codEmpresa;
  }

  static setNomeEmpresa(value: string): void {
    this.session.nomeEmpresa = value;
    void this.saveSession();
  }

  static getNomeEmpresa(): string {
    return this.session.nomeEmpresa;
  }

  static setCnpj(value: string): void {
    this.session.cnpj = value;
    void this.saveSession();
  }

  static getCnpj(): string {
    return this.session.cnpj;
  }

  static setUuidNavegador(value: string): void {
    this.session.uuidNavegador = value;
    safeSet(STORAGE_KEYS.uuid, value);
    void this.saveSession();
  }

  static getUuidNavegador(): string {
    return this.session.uuidNavegador;
  }

  static getGuidID(): string {
    return this.session.uuidNavegador;
  }

  static setIdSessaoUsuario(value?: number): void {
    this.session.idSessaoUsuario = value;
    void this.saveSession();
  }

  static getIdSessaoUsuario(): number | undefined {
    return this.session.idSessaoUsuario;
  }

  static setListaTransacaoUsuarioQSERPx(value: Array<Record<string, unknown>>): void {
    this.session.listaTransacaoUsuarioQSERPx = value || [];
    void this.saveSession();
  }

  static getListaTransacaoUsuarioQSERPx(): Array<Record<string, unknown>> {
    return this.session.listaTransacaoUsuarioQSERPx;
  }

  static setNivelUsuario(value?: number): void {
    this.session.nivelUsuario = value;
    void this.saveSession();
  }

  static getNivelUsuario(): number | undefined {
    return this.session.nivelUsuario;
  }

  static setTipoApontProd(value: string): void {
    this.session.tipoApontProd = value;
    void this.saveSession();
  }

  static getTipoApontProd(): string {
    return this.session.tipoApontProd;
  }

  static setTipoApontMaoObra(value: string): void {
    this.session.tipoApontMaoObra = value;
    void this.saveSession();
  }

  static getTipoApontMaoObra(): string {
    return this.session.tipoApontMaoObra;
  }

  static setPermitirApontamentoSemOperacao(value: boolean): void {
    this.session.permitirApontamentoSemOperacao = Boolean(value);
    void this.saveSession();
  }

  static getPermitirApontamentoSemOperacao(): boolean {
    return Boolean(this.session.permitirApontamentoSemOperacao);
  }
}
