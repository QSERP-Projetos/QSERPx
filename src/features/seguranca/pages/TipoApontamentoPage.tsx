import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { ROUTES } from '../../../constants/routes';
import { GlobalConfig } from '../../../services/globalConfig';

interface TipoApontamentoPageProps {
  embedded?: boolean;
  onRequestClose?: () => void;
}

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

export function TipoApontamentoPage({ embedded = false, onRequestClose }: TipoApontamentoPageProps) {
  const navigate = useNavigate();
  const [apontamentoProd, setApontamentoProd] = useState(apontamentoOptions[0].value);
  const [apontamentoMaoObra, setApontamentoMaoObra] = useState(apontamentoOptions[0].value);
  const [permitirApontSemOper, setPermitirApontSemOper] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setApontamentoProd(getValidOption(GlobalConfig.getTipoApontProd()));
    setApontamentoMaoObra(getValidOption(GlobalConfig.getTipoApontMaoObra()));
    setPermitirApontSemOper(GlobalConfig.getPermitirApontamentoSemOperacao());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;

    GlobalConfig.setTipoApontProd(apontamentoProd);
    GlobalConfig.setTipoApontMaoObra(apontamentoMaoObra);
    GlobalConfig.setPermitirApontamentoSemOperacao(permitirApontSemOper);
  }, [initialized, apontamentoProd, apontamentoMaoObra, permitirApontSemOper]);

  const handleClose = () => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(ROUTES.home, { replace: true });
  };

  const content = (
    <section className="auth-card tipo-apontamento-card" onClick={(event) => event.stopPropagation()}>
        <div className="brand-center">
          <h1>Tipo de Apontamento</h1>
          <p className="tipo-apontamento-card__subtitle">
            Configuração do modo padrão de apontamento para Produção e Mão de Obra.
          </p>
        </div>

        <label className="tipo-apontamento-card__field">
          <span className="field-label">Tipo apontamento produção</span>
          <SearchableSelect
            value={apontamentoProd}
            onChange={setApontamentoProd}
            options={apontamentoOptions}
            ariaLabel="Tipo apontamento produção"
            searchPlaceholder="Pesquisar tipo"
          />
        </label>

        <label className="tipo-apontamento-card__field">
          <span className="field-label">Tipo apontamento mão de obra</span>
          <SearchableSelect
            value={apontamentoMaoObra}
            onChange={setApontamentoMaoObra}
            options={apontamentoOptions}
            ariaLabel="Tipo apontamento mão de obra"
            searchPlaceholder="Pesquisar tipo"
          />
        </label>

        <label className="tipo-apontamento-card__checkbox">
          <span className="field-label">Permitir apontamento sem operação</span>
          <input
            type="checkbox"
            checked={permitirApontSemOper}
            onChange={(event) => setPermitirApontSemOper(event.target.checked)}
          />
        </label>
      </section>
  );

  if (embedded) {
    return content;
  }

  return (
    <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Tipo de apontamento" onClick={handleClose}>
      {content}
    </section>
  );
}
