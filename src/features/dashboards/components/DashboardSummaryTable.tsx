import type { DashboardRow, DashboardTableColumn } from '../types';
import { formatCurrencyBRL, formatNumberBR } from '../utils/dashboardUtils';

type DashboardSummaryTableProps = {
  rows: DashboardRow[];
  columns: DashboardTableColumn[];
};

export function DashboardSummaryTable({ rows, columns }: DashboardSummaryTableProps) {
  const formatCell = (value: unknown, format?: 'currency' | 'number' | 'text') => {
    if (format === 'currency') return formatCurrencyBRL(Number(value ?? 0));
    if (format === 'number') return formatNumberBR(Number(value ?? 0));
    return String(value ?? '-');
  };

  return (
    <section className="card">
      <header className="dashboard-section-header">
        <h2>Grade resumo da agregação</h2>
        <p>Dados resumidos que alimentam a visualização selecionada.</p>
      </header>

      {rows.length === 0 ? (
        <p className="module-empty">Sem dados para exibir na grade resumo.</p>
      ) : (
        <div className="table-scroll module-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {columns.map((column) => (
                    <td key={`${row.key}-${column.key}`}>{formatCell(row[column.key], column.format)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
