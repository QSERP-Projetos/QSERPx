import { useState } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import type { DashboardKpiCard } from '../types';
import { formatCurrencyBRL, formatNumberBR } from '../utils/dashboardUtils';

type DashboardKpiCardsProps = {
  cards: DashboardKpiCard[];
};

export function DashboardKpiCards({ cards }: DashboardKpiCardsProps) {
  const [hiddenValueKeys, setHiddenValueKeys] = useState<Record<string, boolean>>({});

  const formatValue = (item: DashboardKpiCard) => {
    if (item.format === 'currency') return formatCurrencyBRL(item.value);
    return formatNumberBR(item.value);
  };

  return (
    <section className="dashboard-kpi-grid" aria-label="Indicadores do dashboard">
      {cards.map((item) => (
        <article key={item.key} className="card dashboard-kpi-card">
          <div className="dashboard-card-header dashboard-card-header--compact">
            <p>{item.label}</p>
            {item.format === 'currency' ? (
              <button
                type="button"
                className="home-dashboard-card__collapse"
                onClick={() => setHiddenValueKeys((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                aria-label={hiddenValueKeys[item.key] ? `Exibir valor de ${item.label}` : `Ocultar valor de ${item.label}`}
                title={hiddenValueKeys[item.key] ? `Exibir valor de ${item.label}` : `Ocultar valor de ${item.label}`}
              >
                {hiddenValueKeys[item.key] ? <IoEyeOutline size={18} /> : <IoEyeOffOutline size={18} />}
              </button>
            ) : null}
          </div>

          <strong>{item.format === 'currency' && hiddenValueKeys[item.key] ? '••••••' : formatValue(item)}</strong>
        </article>
      ))}
    </section>
  );
}
