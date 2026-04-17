import { useEffect, useState } from 'react';
import type { MenuItem } from '../types/menu';
import { obterUsuariosTransacoesSistemaCall } from '../services/apiCalls';
import { GlobalConfig } from '../services/globalConfig';

const menuConfigs = [
  { id: 'dashboards', title: 'Dashboards', icon: 'stats-chart-outline', code: 'DSB' },
  { id: 'ativo-fixo', title: 'Ativo Fixo', icon: 'albums-outline', code: 'ATV' },
  { id: 'basico', title: 'Básico', icon: 'list-outline', code: 'BAS' },
  { id: 'compras', title: 'Compras', icon: 'bag-handle-outline', code: 'COM' },
  { id: 'contabilidade', title: 'Contabilidade', icon: 'calculator-outline', code: 'CTB' },
  { id: 'custo', title: 'Custo', icon: 'cash-outline', code: 'CST' },
  { id: 'engenharia', title: 'Engenharia', icon: 'construct-outline', code: 'ENG' },
  { id: 'financeiro', title: 'Financeiro', icon: 'wallet-outline', code: 'FIN' },
  { id: 'fiscal', title: 'Fiscal', icon: 'document-text-outline', code: 'FIS' },
  { id: 'manutencao', title: 'Manutenção', icon: 'build-outline', code: 'MAN' },
  { id: 'pcp', title: 'PCP', icon: 'business-outline', code: 'PCP' },
  { id: 'qualidade', title: 'Qualidade', icon: 'checkmark-done-outline', code: 'QLD' },
  { id: 'servico', title: 'Serviço', icon: 'briefcase-outline', code: 'SER' },
  { id: 'vendas', title: 'Vendas', icon: 'cart-outline', code: 'VEN' },
  { id: 'seguranca', title: 'Segurança', icon: 'shield-checkmark-outline', code: 'SEG' },
];

export const useDynamicMenu = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const baseUrl = GlobalConfig.getBaseUrl();
        const token = GlobalConfig.getJwToken();
        const usuario = GlobalConfig.getUsuario();

        if (!baseUrl || !token || !usuario) return;

        const loaded: MenuItem[] = [];

        for (const cfg of menuConfigs) {
          try {
            const resp = await obterUsuariosTransacoesSistemaCall(baseUrl, token, usuario, cfg.code, true);
            if (resp.succeeded && Array.isArray(resp.jsonBody)) {
              const subitems = resp.jsonBody.map((it: any) => {
                const transactionCode = String(
                  it?.codigo_Transacao ?? it?.Codigo_Transacao ?? it?.codigo_transacao ?? '',
                ).trim();
                const rawTitle = String(
                  it?.nome_Formulario ?? it?.Nome_Formulario ?? it?.nome_formulario ?? transactionCode,
                ).trim();
                const normalizedTitle = rawTitle.toLowerCase();
                const title =
                  transactionCode.toUpperCase() === 'CFG008' ||
                  normalizedTitle === 'sessoes qserpx' ||
                  normalizedTitle === 'sessões qserpx'
                    ? 'Sessões'
                    : rawTitle;

                return { title, transactionCode };
              });

              if (subitems.length > 0) {
                loaded.push({
                  id: cfg.id,
                  title: cfg.title,
                  icon: cfg.icon,
                  transactionCode: cfg.code,
                  subitems,
                });
              }
            }
          } catch {
            // manter fluxo robusto, mesmo se um módulo falhar
          }
        }

        if (!mounted) return;

        const nivel = GlobalConfig.getNivelUsuario() ?? 0;
        if (nivel >= 9) {
          const securityMenu: MenuItem = {
            id: 'seguranca',
            title: 'Segurança',
            icon: 'shield-checkmark-outline',
            transactionCode: 'SEG',
            subitems: [
              { title: 'Usuários', transactionCode: 'SEG001' },
              { title: 'Sessões', transactionCode: 'CFG008' },
            ],
          };

          const existingIndex = loaded.findIndex((item) => item.id === 'seguranca' || item.title === 'Segurança');
          if (existingIndex >= 0) {
            const existing = loaded[existingIndex];
            const merged = [...existing.subitems];
            for (const manual of securityMenu.subitems) {
              const hasManual = merged.some((current) => current.transactionCode === manual.transactionCode);
              if (!hasManual) merged.push(manual);
            }
            loaded[existingIndex] = { ...existing, subitems: merged };
          } else {
            loaded.push(securityMenu);
          }
        }

        const filteredByNivel =
          nivel >= 9
            ? loaded
            : loaded
                .map((item) => {
                  const isSecurity = item.transactionCode === 'SEG' || item.title === 'Segurança';
                  if (!isSecurity) return item;

                  const subitems = item.subitems.filter((sub) => {
                    const code = String(sub.transactionCode || '').toUpperCase();
                    const title = String(sub.title || '').toLowerCase();
                    if (code === 'SEG001' || code === 'CFG008') return false;
                    if (title.includes('usuario') || title.includes('sessao') || title.includes('sessoes')) return false;
                    return true;
                  });

                  return { ...item, subitems };
                })
                .filter((item) => item.subitems.length > 0);

        setMenus(filteredByNivel);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { menus, loading };
};
