import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useToast } from '../contexts/ToastContext';
import { obterUsuariosTransacoesSistemaCall } from '../services/apiCalls';
import { GlobalConfig } from '../services/globalConfig';

export type TransactionAccessStatus = 'verificando' | 'autorizado' | 'negado';

/**
 * Validates whether the logged-in user holds a specific transaction code
 * (e.g., DOC001, PCP008, BAS003) and redirects to Home if unauthorized.
 */
export function useTransactionAccess(transactionCode: string, screenLabel: string): TransactionAccessStatus {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<TransactionAccessStatus>('verificando');

  useEffect(() => {
    let cancelled = false;
    const targetCode = String(transactionCode || '').trim().toUpperCase();

    const verificarPermissao = async () => {
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
  }, [navigate, screenLabel, showToast, transactionCode]);

  return status;
}
