export type Option = { value: string; label: string };

export type DashboardChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'bar-horizontal' | 'cards' | 'table';

export type DashboardSeries = {
  key: string;
  label: string;
  color: string;
  format?: 'currency' | 'number' | 'text';
};

export type DashboardRow = {
  key: string;
  label: string;
  order?: number;
  [k: string]: string | number | undefined;
};

export type DashboardTableColumn = {
  key: string;
  label: string;
  format?: 'currency' | 'number' | 'text';
};

export type DashboardKpiCard = {
  key: string;
  label: string;
  value: number;
  format?: 'currency' | 'number';
};

export type DashboardDateErrors = {
  codigoEmpresa?: string;
  dataDe?: string;
  dataAte?: string;
};
