import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import { acoesUsuariosCall } from '../../../services/apiCalls';

type ApontamentoOption = {
  value: string;
  label: string;
};

const apontamentoOptions: ApontamentoOption[] = [
  { value: 'Apontamento Padrão', label: 'Apontamento Padrão' },
  { value: 'Apontamento Cronômetro', label: 'Apontamento Cronômetro' },
];

const normalizeText = (value?: string) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const getValidOption = (value?: string) => {
  const normalized = normalizeText(value);

  if (normalized === 'apontamento padrao' || normalized === 'apontamento padrão') {
    return 'Apontamento Padrão';
  }

  if (normalized === 'apontamento por cronometro' || normalized === 'apontamento cronometro') {
    return 'Apontamento Cronômetro';
  }

  const found = apontamentoOptions.find((item) => item.value === value);
  return found?.value ?? apontamentoOptions[0].value;
};

export function TipoApontamentoPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [apontamentoProd, setApontamentoProd] = useState(apontamentoOptions[0].value);
  const [apontamentoMaoObra, setApontamentoMaoObra] = useState(apontamentoOptions[0].value);
  const [permitirApontSemOper, setPermitirApontSemOper] = useState(false);

  useEffect(() => {
    setApontamentoProd(getValidOption(GlobalConfig.getTipoApontProd()));
    setApontamentoMaoObra(getValidOption(GlobalConfig.getTipoApontMaoObra()));
    setPermitirApontSemOper(GlobalConfig.getPermitirApontamentoSemOperacao());
  }, []);

  const handleConfirmar = async () => {
    if (loading) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const usuario = GlobalConfig.getUsuario();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !usuario) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      await acoesUsuariosCall(baseUrl, token, {
        codigoEmpresa: codigoEmpresa ?? undefined,
        idSessao: idSessao ?? undefined,
        codigoUsuario: usuario,
      });

      GlobalConfig.setTipoApontProd(apontamentoProd);
      GlobalConfig.setTipoApontMaoObra(apontamentoMaoObra);
      GlobalConfig.setPermitirApontamentoSemOperacao(permitirApontSemOper);

      showToast('Tipo de apontamento alterado com sucesso.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Falha ao atualizar tipo de apontamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="module-screen">
      <section className="module-header">
        <div className="module-header__left">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Tipo de Apontamento</h1>
            <p>Configuração do modo padrão de apontamento para Produção e Mão de Obra.</p>
          </div>
        </div>
      </section>

      <section className="module-form">
        <div className="form-grid-3">
          <label className="form-grid-3__full">
            <span>Tipo apontamento produção</span>
            <SearchableSelect
              value={apontamentoProd}
              onChange={setApontamentoProd}
              options={apontamentoOptions}
              ariaLabel="Tipo apontamento produção"
              searchPlaceholder="Pesquisar tipo"
            />
          </label>

          <label className="form-grid-3__full">
            <span>Tipo apontamento mão de obra</span>
            <SearchableSelect
              value={apontamentoMaoObra}
              onChange={setApontamentoMaoObra}
              options={apontamentoOptions}
              ariaLabel="Tipo apontamento mão de obra"
              searchPlaceholder="Pesquisar tipo"
            />
          </label>

          <label className="form-grid-3__full checkbox-field">
            <span>Permitir apontamento sem operação</span>
            <input
              type="checkbox"
              checked={permitirApontSemOper}
              onChange={(event) => setPermitirApontSemOper(event.target.checked)}
            />
          </label>
        </div>

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={() => navigate(ROUTES.home)} disabled={loading}>
            Voltar
          </button>
          <button className="primary-button" type="button" onClick={() => void handleConfirmar()} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </section>
    </main>
  );
}
