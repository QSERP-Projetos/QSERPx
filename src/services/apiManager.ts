import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ROUTES } from '../constants/routes';
import { GlobalConfig } from './globalConfig';

export interface ApiCallParams {
  [key: string]: any;
}

export interface ApiCallHeaders {
  [key: string]: string;
}

export enum ApiCallType {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

export interface ApiCallResponse<T = any> {
  data: T;
  statusCode: number;
  succeeded: boolean;
  jsonBody: any;
  bodyText: string;
}

class ApiManager {
  private static instance: ApiManager;
  private axiosInstance: AxiosInstance;
  private disconnectHandled = false;

  private constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(): ApiManager {
    if (!ApiManager.instance) {
      ApiManager.instance = new ApiManager();
    }
    return ApiManager.instance;
  }

  public async makeApiCall<T = any>(
    apiUrl: string,
    callType: ApiCallType,
    headers: ApiCallHeaders = {},
    params: ApiCallParams = {},
    body: any = null,
  ): Promise<ApiCallResponse<T>> {
    try {
      const requestHeaders: Record<string, string> = {
        ...(headers || {}),
      };

      const shouldBypassGuards = this.shouldBypassGlobalGuards(apiUrl);
      const baseUrl = this.extractBaseUrl(apiUrl);

      if (!shouldBypassGuards && baseUrl) {
        const healthOk = await this.checkApiHealth(baseUrl);
        if (!healthOk) {
          this.handleDisconnected();
          return {
            data: null as T,
            statusCode: 503,
            succeeded: false,
            jsonBody: null,
            bodyText: 'Desconectado do servidor.',
          };
        }

        const freshToken = await this.fetchFreshToken(baseUrl);
        if (!freshToken) {
          this.handleDisconnected();
          return {
            data: null as T,
            statusCode: 401,
            succeeded: false,
            jsonBody: null,
            bodyText: 'Falha ao renovar token.',
          };
        }

        requestHeaders.Authorization = `Bearer ${freshToken}`;
      }

      const config: AxiosRequestConfig = {
        method: callType,
        url: apiUrl,
        headers: requestHeaders,
      };

      // Preserve query params for every method because some endpoints validate write
      // requests using query string values in addition to (or instead of) JSON body.
      if (params && Object.keys(params).length > 0) {
        config.params = params;
      }

      // Adicionar body para POST/PUT/PATCH
      if (body && (callType === ApiCallType.POST || callType === ApiCallType.PUT || callType === ApiCallType.PATCH)) {
        config.data = body;
      }

      const response: AxiosResponse<T> = await this.axiosInstance.request(config);

      return {
        data: response.data,
        statusCode: response.status,
        succeeded: response.status >= 200 && response.status < 300,
        jsonBody: response.data,
        bodyText: JSON.stringify(response.data),
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const responseBody = error?.response?.data;
      const responseBodyText =
        typeof responseBody === 'string'
          ? responseBody
          : responseBody != null
            ? JSON.stringify(responseBody)
            : '';
      if (status >= 500 || !status) {
        console.error('API Call Error:', error);
      } else {
        // intentionally silence client-side non-2xx responses (e.g. 404)
        // to avoid noisy console output for expected/missing optional endpoints.
      }

      return {
        data: null as T,
        statusCode: status || 500,
        succeeded: false,
        jsonBody: responseBody || null,
        bodyText: responseBodyText || error?.message || 'Unknown error',
      };
    }
  }

    private shouldBypassGlobalGuards(apiUrl: string): boolean {
      const normalized = String(apiUrl || '').toLowerCase();
      return normalized.includes('/api/v1/token') || normalized.includes('/api/v1/url') || normalized.includes('/api/v1/login');
    }

    private extractBaseUrl(apiUrl: string): string {
      const raw = String(apiUrl || '').trim();
      if (!raw) return '';
      const marker = '/api/v1/';
      const index = raw.toLowerCase().indexOf(marker);
      if (index < 0) return raw.replace(/\/$/, '');
      return raw.slice(0, index).replace(/\/$/, '');
    }

    private async checkApiHealth(baseUrl: string): Promise<boolean> {
      try {
        const response = await this.axiosInstance.request({
          method: ApiCallType.GET,
          url: `${baseUrl}/api/v1/url`,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        return response.status === 200;
      } catch {
        return false;
      }
    }

    private async fetchFreshToken(baseUrl: string): Promise<string | null> {
      const usuario = GlobalConfig.getUsuario();
      const nomeEmpresa = GlobalConfig.getNomeEmpresa();
      const codigoEmpresa = Number(GlobalConfig.getCodEmpresa() ?? 0);

      if (!usuario || !nomeEmpresa || !codigoEmpresa) {
        return null;
      }

      try {
        const response = await this.axiosInstance.request({
          method: ApiCallType.GET,
          url: `${baseUrl}/api/v1/token`,
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            Usuario: usuario,
            Codigo_Empresa: codigoEmpresa,
            Nome_Empresa: nomeEmpresa,
            Chave_Api: '',
            IdGuid: '',
            Tipo: 2,
            RetornarComoXml: false,
          },
        });

        const payload = response.data as any;
        const token = payload?.token || payload?.Token || payload?.data?.token;
        if (!token) return null;

        GlobalConfig.setJwToken(String(token));
        return String(token);
      } catch {
        return null;
      }
    }

    private handleDisconnected(): void {
      if (this.disconnectHandled) return;
      this.disconnectHandled = true;

      void GlobalConfig.clearConfig();

      try {
        window.dispatchEvent(
          new CustomEvent('qserpx:toast', {
            detail: {
              message: 'Desconectado do servidor. Faça login novamente.',
              type: 'error',
              duration: 2500,
            },
          }),
        );
      } catch {
        // ignore toast event failures
      }

      try {
        const currentPath = window.location.pathname;
        if (currentPath !== ROUTES.login) {
          window.setTimeout(() => {
            window.location.assign(ROUTES.login);
          }, 900);
        }
      } catch {
        // ignore navigation failures
      }
    }
}

export default ApiManager.getInstance();
