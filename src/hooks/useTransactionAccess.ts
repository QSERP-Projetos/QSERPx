import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useToast } from '../contexts/ToastContext';
import {
  obterUsuariosTransacoesSistemaAcaoCall,
  obterUsuariosTransacoesSistemaCall,
} from '../services/apiCalls';
import { GlobalConfig } from '../services/globalConfig';

export type TransactionAccessStatus = 'verificando' | 'autorizado' | 'negado';

const extrairListaTransacoes = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.transacoes)) return raw.transacoes;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const encontrarIdTransacaoPorCodigo = (lista: any[], targetCode: string): number => {
  const encontrado = lista.find(
    (item: any) =>
      String(item?.codigo_Transacao ?? item?.Codigo_Transacao ?? item?.codigo_transacao ?? '')
        .trim()
        .toUpperCase() === targetCode,
  );
  if (!encontrado) return 0;
  return Number(encontrado?.id_Transacao ?? encontrado?.Id_Transacao ?? encontrado?.id_transacao ?? 0) || 0;
};

/**
 * Valida se o usuário logado possui determinada ação (Codigo_Acao) vinculada
 * a uma transação (ex.: DOC003 -> 34, DOC001 -> 35, PCP008 -> 36).
 */
export async function verificarAcaoTransacao(
  codigoTransacao: string,
  codigoAcao: number | string,
): Promise<{ permitido: boolean; mensagem?: string }> {
  const baseUrl = GlobalConfig.getBaseUrl();
  const token = GlobalConfig.getJwToken();
  const usuario = GlobalConfig.getUsuario();
  const targetCode = String(codigoTransacao || '').trim().toUpperCase();

  if (!baseUrl || !token || !usuario || !targetCode) {
    return { permitido: false, mensagem: 'Informações de sessão não encontradas.' };
  }

  let idTransacao = encontrarIdTransacaoPorCodigo(GlobalConfig.getListaTransacaoUsuarioQSERPx(), targetCode);

  if (!idTransacao) {
    const transResp = await obterUsuariosTransacoesSistemaCall(baseUrl, token, usuario, targetCode, false);
    if (transResp.succeeded) {
      const lista = extrairListaTransacoes(transResp.jsonBody ?? transResp.data);
      idTransacao = encontrarIdTransacaoPorCodigo(lista, targetCode);
    }
  }

  if (!idTransacao) {
    return { permitido: false };
  }

  const acaoResp = await obterUsuariosTransacoesSistemaAcaoCall(
    baseUrl,
    token,
    usuario,
    String(codigoAcao),
    String(idTransacao),
  );

  if (!acaoResp.succeeded) {
    return { permitido: false };
  }

  const listaAcoes = extrairListaTransacoes(acaoResp.jsonBody ?? acaoResp.data);
  return { permitido: listaAcoes.length > 0 };
}

/**
 * Validates whether the logged-in user holds a specific transaction code
 * (e.g., DOC001, PCP008, BAS003) and redirects to Home if unauthorized.
 */
export function useTransactionAccess(
  transactionCode: string,
  screenLabel: string,
  allowNivel9Bypass = false,
): TransactionAccessStatus {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<TransactionAccessStatus>('verificando');

  useEffect(() => {
    let cancelled = false;
    const targetCode = String(transactionCode || '').trim().toUpperCase();

    const verificarPermissao = async () => {
      if (allowNivel9Bypass && (GlobalConfig.getNivelUsuario() ?? 0) >= 9) {
        if (!cancelled) {
          setStatus('autorizado');
        }
        return;
      }

      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario();

      if (!baseUrl || !token || !usuario || !targetCode) {
        if (!cancelled) {
          setStatus('negado');
          navigate(ROUTES.home, { replace: true });
        }
        return;
      }

      try {
        const resp = await obterUsuariosTransacoesSistemaCall(baseUrl, token, usuario, targetCode, false);
        const raw = resp.jsonBody ?? resp.data;
        const lista = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.transacoes)
            ? raw.transacoes
            : Array.isArray(raw?.data)
              ? raw.data
              : [];

        const autorizado =
          resp.succeeded &&
          lista.some(
            (item: any) =>
              String(item?.codigo_Transacao ?? item?.Codigo_Transacao ?? item?.codigo_transacao ?? '')
                .trim()
                .toUpperCase() === targetCode,
          );

        if (cancelled) return;

        if (!autorizado) {
          setStatus('negado');
          showToast(`Você não possui permissão (${targetCode}) para acessar ${screenLabel}.`, 'error');
          navigate(ROUTES.home, { replace: true });
          return;
        }

        setStatus('autorizado');
      } catch {
        if (cancelled) return;
        setStatus('negado');
        showToast(`Não foi possível validar a permissão (${targetCode}) para acessar ${screenLabel}.`, 'error');
        navigate(ROUTES.home, { replace: true });
      }
    };

    void verificarPermissao();

    return () => {
      cancelled = true;
    };
  }, [allowNivel9Bypass, navigate, screenLabel, showToast, transactionCode]);

  return status;
}
