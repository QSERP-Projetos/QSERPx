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

export interface ApiCallRequestOptions {
  timeoutMs?: number;
  responseType?: 'json' | 'blob' | 'text';
  skipAuthRefresh?: boolean;
}

class ApiManager {
  private static instance: ApiManager;
  private axiosInstance: AxiosInstance;
  private disconnectHandled = false;
  private refreshPromise: Promise<string | null> | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      withCredentials: true,
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

  public resetDisconnectGuard(): void {
    this.disconnectHandled = false;
  }

  public async makeApiCall<T = any>(
    apiUrl: string,
    callType: ApiCallType,
    headers: ApiCallHeaders = {},
    params: ApiCallParams = {},
    body: any = null,
    requestOptions: ApiCallRequestOptions = {},
  ): Promise<ApiCallResponse<T>> {
    const isAuthPublic = this.isPublicAuthRoute(apiUrl);
    const hasCustomAuth = Boolean(headers?.Authorization || headers?.authorization);

    const requestHeaders: Record<string, string> = {
      ...(headers || {}),
    };

    if (!isAuthPublic && !hasCustomAuth) {
      const currentToken = GlobalConfig.getJwToken();
      if (currentToken) {
        requestHeaders.Authorization = `Bearer ${currentToken}`;
      }
    }

    const firstAttempt = await this.executeRequest<T>(apiUrl, callType, requestHeaders, params, body, requestOptions);

    if (
      firstAttempt.statusCode === 401 &&
      !isAuthPublic &&
      !requestOptions.skipAuthRefresh &&
      !hasCustomAuth
    ) {
      const baseUrl = this.extractBaseUrl(apiUrl) || GlobalConfig.getBaseUrl();
      if (baseUrl) {
        const refreshedToken = await this.refreshAccessToken(baseUrl);
        if (refreshedToken) {
          const retryHeaders = {
            ...requestHeaders,
            Authorization: `Bearer ${refreshedToken}`,
          };
          return this.executeRequest<T>(apiUrl, callType, retryHeaders, params, body, requestOptions);
        }

        this.handleDisconnected('Sessão expirada. Faça login novamente.');
      }
    }

    return firstAttempt;
  }

  public async authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const buildHeaders = (tokenOverride?: string): Headers => {
      const hdrs = new Headers(init.headers || {});
      const token = tokenOverride ?? GlobalConfig.getJwToken();
      if (token && !hdrs.has('Authorization')) {
        hdrs.set('Authorization', `Bearer ${token}`);
      } else if (tokenOverride) {
        hdrs.set('Authorization', `Bearer ${tokenOverride}`);
      }
      return hdrs;
    };

    const firstResp = await fetch(input, {
      ...init,
      credentials: init.credentials ?? 'include',
      headers: buildHeaders(),
    });

    if (firstResp.status === 401) {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!this.isPublicAuthRoute(urlStr)) {
        const baseUrl = this.extractBaseUrl(urlStr) || GlobalConfig.getBaseUrl();
        if (baseUrl) {
          const newToken = await this.refreshAccessToken(baseUrl);
          if (newToken) {
            return fetch(input, {
              ...init,
              credentials: init.credentials ?? 'include',
              headers: buildHeaders(newToken),
            });
          }
          this.handleDisconnected('Sessão expirada. Faça login novamente.');
        }
      }
    }

    return firstResp;
  }

  public async refreshAccessToken(baseUrlInput?: string): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const baseUrl = (baseUrlInput || GlobalConfig.getBaseUrl() || '').replace(/\/+$/, '');
    if (!baseUrl) return null;

    this.refreshPromise = (async () => {
      try {
        const fallbackRefresh = GlobalConfig.getRefreshTokenFallback();
        const response = await this.axiosInstance.request({
          method: ApiCallType.POST,
          url: `${baseUrl}/api/v1/auth/refresh`,
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
          data: fallbackRefresh ? { refreshToken: fallbackRefresh } : {},
        });

        const payload = response.data as any;
        const token = payload?.accessToken || payload?.token;
        if (!token) return null;

        GlobalConfig.setJwToken(String(token));
        if (payload?.refreshToken) {
          GlobalConfig.setRefreshTokenFallback(String(payload.refreshToken));
        }
        this.disconnectHandled = false;
        return String(token);
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async executeRequest<T>(
    apiUrl: string,
    callType: ApiCallType,
    requestHeaders: Record<string, string>,
    params: ApiCallParams,
    body: any,
    requestOptions: ApiCallRequestOptions,
  ): Promise<ApiCallResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        method: callType,
        url: apiUrl,
        headers: requestHeaders,
        withCredentials: true,
      };

      if (requestOptions.responseType) {
        config.responseType = requestOptions.responseType;
      }

      if (
        typeof requestOptions.timeoutMs === 'number' &&
        Number.isFinite(requestOptions.timeoutMs) &&
        requestOptions.timeoutMs > 0
      ) {
        config.timeout = requestOptions.timeoutMs;
      }

      if (params && Object.keys(params).length > 0) {
        config.params = params;
      }

      if (body !== null && body !== undefined && (callType === ApiCallType.POST || callType === ApiCallType.PUT || callType === ApiCallType.PATCH)) {
        config.data = body;
      }

      const response: AxiosResponse<T> = await this.axiosInstance.request(config);

      const responseBodyText = response.data instanceof Blob
        ? '[binary data]'
        : typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);

      return {
        data: response.data,
        statusCode: response.status,
        succeeded: response.status >= 200 && response.status < 300,
        jsonBody: response.data instanceof Blob ? null : response.data,
        bodyText: responseBodyText,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const responseBody = error?.response?.data;
      let responseBodyText = '';
      if (typeof responseBody === 'string') {
        responseBodyText = responseBody;
      } else if (responseBody instanceof Blob) {
        responseBodyText = await responseBody.text().catch(() => '');
      } else if (responseBody != null) {
        responseBodyText = JSON.stringify(responseBody);
      }
      if (status >= 500 || !status) {
        console.error('API Call Error:', error);
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

  private isPublicAuthRoute(apiUrl: string): boolean {
    const normalized = String(apiUrl || '').toLowerCase();
    return (
      normalized.includes('/api/v1/url') ||
      normalized.includes('/api/v1/auth/login') ||
      normalized.includes('/api/v1/auth/select-company') ||
      normalized.includes('/api/v1/auth/refresh') ||
      normalized.includes('/api/v1/auth/logout') ||
      normalized.includes('/api/v1/auth/service-token')
    );
  }

  private extractBaseUrl(apiUrl: string): string {
    const raw = String(apiUrl || '').trim();
    if (!raw) return '';
    const marker = '/api/v1/';
    const index = raw.toLowerCase().indexOf(marker);
    if (index < 0) return raw.replace(/\/$/, '');
    return raw.slice(0, index).replace(/\/$/, '');
  }

  private handleDisconnected(message = 'Desconectado do servidor. Faça login novamente.'): void {
    if (this.disconnectHandled) return;
    this.disconnectHandled = true;

    void GlobalConfig.clearConfig();

    try {
      window.dispatchEvent(
        new CustomEvent('qserpx:toast', {
          detail: {
            message,
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
