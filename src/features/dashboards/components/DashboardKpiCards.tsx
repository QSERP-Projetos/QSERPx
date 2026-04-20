import type { DashboardKpiCard } from '../types';
import { formatCurrencyBRL, formatNumberBR } from '../utils/dashboardUtils';

type DashboardKpiCardsProps = {
  cards: DashboardKpiCard[];
};

export function DashboardKpiCards({ cards }: DashboardKpiCardsProps) {
  const formatValue = (item: DashboardKpiCard) => {
    if (item.format === 'currency') return formatCurrencyBRL(item.value);
    return formatNumberBR(item.value);
  };

  return (
    <section className="dashboard-kpi-grid" aria-label="Indicadores do dashboard">
      {cards.map((item) => (
        <article key={item.key} className="card dashboard-kpi-card">
          <p>{item.label}</p>
          <strong>{formatValue(item)}</strong>
        </article>
      ))}
    </section>
  );
}
