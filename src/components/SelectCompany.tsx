import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import type { SelectCompanyState } from '../types/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { LogoIcon } from '../components/LogoIcon';
import { loginUsuarioCall } from '../services/apiCalls';
import { completeCompanySession } from '../services/authFlow';

export function SelectCompany() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as SelectCompanyState | undefined;

  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [empresasList, setEmpresasList] = useState<any[]>(routeState?.empresas || []);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!routeState) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    const firstCode =
      routeState.empresas?.[0]?.empresa?.codigo_empresa?.toString() ||
      routeState.empresas?.[0]?.empresa?.codigo_Empresa?.toString() ||
      '';

    setSelectedCode(firstCode);
  }, [routeState, navigate]);

  useEffect(() => {
    const loadEmpresas = async () => {
      if (!routeState) return;
      if (empresasList.length > 0) return;

      setLoadingEmpresas(true);
      try {
        const response = await loginUsuarioCall(routeState.baseUrl, routeState.token, routeState.usuario);
        const data = (response.data as any) || [];
        if (response.succeeded && Array.isArray(data) && data.length > 0) {
          setEmpresasList(data);
          const firstCode = data[0]?.empresa?.codigo_empresa?.toString() || data[0]?.empresa?.codigo_Empresa?.toString() || '';
          setSelectedCode(firstCode);
        }
      } finally {
        setLoadingEmpresas(false);
      }
    };

    void loadEmpresas();
  }, [routeState, empresasList.length]);

  const companyOptions = useMemo(() => {
    return empresasList
      .map((item) => ({
        value: String(item?.empresa?.codigo_empresa ?? item?.empresa?.codigo_Empresa ?? ''),
        label: String(item?.empresa?.nome_Fantasia || item?.empresa?.nome_fantasia || 'Empresa'),
      }))
      .filter((item) => item.value && item.label);
  }, [empresasList]);

  const selectedEmpresa = useMemo(() => {
    return empresasList.find(
      (item) => `${item?.empresa?.codigo_empresa ?? item?.empresa?.codigo_Empresa}` === `${selectedCode}`,
    );
  }, [empresasList, selectedCode]);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return companyOptions;
    return companyOptions.filter((item) => item.label.toLowerCase().includes(term));
  }, [companyOptions, searchTerm]);

  const handleContinue = async () => {
    if (!routeState) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    if (!selectedEmpresa) {
      showToast('Escolha uma empresa para continuar.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await completeCompanySession({
        baseUrl: routeState.baseUrl,
        tokenTipo1: routeState.token,
        usuario: routeState.usuario,
        versao: routeState.versao,
        empresa: selectedEmpresa,
      });

      if (!result.success) {
        if (result.hdSemLicenca) {
          showToast(`Licença não encontrada. HD: ${result.hdSemLicenca}`, 'error', 5000);
        } else {
          showToast(result.message || 'Falha ao processar seleção.', 'error');
        }
        return;
      }

      navigate(ROUTES.home, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card auth-card--companies">
        <div className="brand-center">
          <LogoIcon size={44} color={colors.icon} mode={theme} />
          <h1>Selecionar empresa</h1>
          <p className="version">Escolha a empresa para continuar o acesso.</p>
        </div>

        <label className="field-label">Pesquisar empresa</label>
        <input
          className="text-field"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Digite para filtrar"
          disabled={loadingEmpresas}
        />

        <div className="companies-list">
          {loadingEmpresas ? (
            <p className="module-empty">Carregando empresas...</p>
          ) : filteredOptions.length === 0 ? (
            <p className="module-empty">Nenhuma empresa encontrada.</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`company-item${selectedCode === option.value ? ' company-item--selected' : ''}`}
                onClick={() => setSelectedCode(option.value)}
                disabled={loading}
              >
                <span className="company-item__label">{option.label}</span>
                {selectedCode === option.value && <span className="company-item__check">✓</span>}
              </button>
            ))
          )}
        </div>

        <button className="primary-button" type="button" onClick={handleContinue} disabled={loading || loadingEmpresas}>
          {loading ? 'Processando...' : 'Continuar'}
        </button>
      </section>
    </main>
  );
}
