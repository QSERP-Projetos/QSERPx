import { useState, type ReactNode } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';
import type { DashboardRow, DashboardTableColumn } from '../types';
import { formatCurrencyBRL, formatNumberBR } from '../utils/dashboardUtils';

type DashboardSummaryTableProps = {
  rows: DashboardRow[];
  columns: DashboardTableColumn[];
  headerAction?: ReactNode;
};

export function DashboardSummaryTable({ rows, columns, headerAction }: DashboardSummaryTableProps) {
  const [collapsed, setCollapsed] = useState(true);

  const formatCell = (value: unknown, format?: 'currency' | 'number' | 'text') => {
    if (format === 'currency') return formatCurrencyBRL(Number(value ?? 0));
    if (format === 'number') return formatNumberBR(Number(value ?? 0));
    return String(value ?? '-');
  };

  return (
    <section className="card">
      <header className="dashboard-section-header dashboard-section-header--collapsible">
        <div>
          <h2>Grade resumo da agregação</h2>
          <p>Dados resumidos que alimentam a visualização selecionada.</p>
        </div>
        <div className="dashboard-summary-table__header-actions">
          {headerAction}
          <button
            type="button"
            className="home-dashboard-card__collapse"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expandir grade resumo' : 'Encolher grade resumo'}
            title={collapsed ? 'Expandir grade resumo' : 'Encolher grade resumo'}
          >
            {collapsed ? <IoChevronDownOutline size={18} /> : <IoChevronUpOutline size={18} />}
          </button>
        </div>
      </header>

      {collapsed ? null : rows.length === 0 ? (
        <p className="module-empty">Sem dados para exibir na grade resumo.</p>
      ) : (
        <div className="table-scroll module-table module-table-wrap dashboard-summary-table-wrap">
          <table className="dashboard-summary-table">
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
