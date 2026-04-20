import { SearchableSelect } from '../../../components/SearchableSelect';
import type { DashboardChartType, Option } from '../types';

type DashboardConfiguratorProps = {
  chartType: DashboardChartType;
  selectedData: string;
  groupBy: string;
  metric: string;
  chartTypeOptions: Option[];
  dataOptions: Option[];
  groupOptions: Option[];
  metricOptions: Option[];
  onChartTypeChange: (value: DashboardChartType) => void;
  onSelectedDataChange: (value: string) => void;
  onGroupByChange: (value: string) => void;
  onMetricChange: (value: string) => void;
};

export function DashboardConfigurator({
  chartType,
  selectedData,
  groupBy,
  metric,
  chartTypeOptions,
  dataOptions,
  groupOptions,
  metricOptions,
  onChartTypeChange,
  onSelectedDataChange,
  onGroupByChange,
  onMetricChange,
}: DashboardConfiguratorProps) {
  return (
    <section className="card dashboard-configurator-card">
      <header className="dashboard-section-header">
        <h2>Configuração da visualização</h2>
        <p>Troque rapidamente tipo de gráfico, dados exibidos, agrupamento e medida principal.</p>
      </header>

      <div className="dashboard-config-grid">
        <label className="list-layout-field list-layout-field--sm dashboard-field">
          <span>Tipo de gráfico</span>
          <SearchableSelect
            value={chartType}
            onChange={(value) => onChartTypeChange(value as DashboardChartType)}
            options={chartTypeOptions}
            searchPlaceholder="Pesquisar tipo"
            ariaLabel="Tipo de gráfico"
          />
        </label>

        <label className="list-layout-field list-layout-field--sm dashboard-field">
          <span>Dados a exibir</span>
          <SearchableSelect
            value={selectedData}
            onChange={onSelectedDataChange}
            options={dataOptions}
            searchPlaceholder="Pesquisar base"
            ariaLabel="Dados a exibir"
          />
        </label>

        <label className="list-layout-field list-layout-field--sm dashboard-field">
          <span>Agrupamento</span>
          <SearchableSelect
            value={groupBy}
            onChange={onGroupByChange}
            options={groupOptions}
            searchPlaceholder="Pesquisar agrupamento"
            ariaLabel="Agrupamento"
          />
        </label>

        <label className="list-layout-field list-layout-field--sm dashboard-field">
          <span>Medida principal</span>
          <SearchableSelect
            value={metric}
            onChange={onMetricChange}
            options={metricOptions}
            searchPlaceholder="Pesquisar medida"
            ariaLabel="Medida principal"
          />
        </label>
      </div>
    </section>
  );
}
