import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';
import { ListSearchField } from '../../../components/ListSearchField';
import type { DashboardRow, DashboardTableColumn } from '../types';
import { formatCurrencyBRL, formatNumberBR, normalizeText } from '../utils/dashboardUtils';

type DashboardSummaryTableProps = {
  rows: DashboardRow[];
  columns: DashboardTableColumn[];
  headerAction?: ReactNode;
  searchEnabled?: boolean;
  searchPlaceholder?: string;
  initialSortColumnKey?: string;
  initialSortDirection?: 'asc' | 'desc';
  rowSearchText?: (row: DashboardRow) => string;
  renderRowDetails?: (row: DashboardRow) => ReactNode;
  rowDetailsTitle?: string;
};

export function DashboardSummaryTable({
  rows,
  columns,
  headerAction,
  searchEnabled = false,
  searchPlaceholder = 'Pesquisar na grade resumo',
  initialSortColumnKey,
  initialSortDirection = 'desc',
  rowSearchText,
  renderRowDetails,
  rowDetailsTitle = 'Detalhes',
}: DashboardSummaryTableProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumnKey, setSortColumnKey] = useState(initialSortColumnKey ?? columns[0]?.key ?? '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const collator = useMemo(() => new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }), []);

  const formatCell = (value: unknown, format?: 'currency' | 'number' | 'text') => {
    if (format === 'currency') return formatCurrencyBRL(Number(value ?? 0));
    if (format === 'number') return formatNumberBR(Number(value ?? 0));
    return String(value ?? '-');
  };

  const filteredRows = useMemo(() => {
    if (!searchEnabled) return rows;

    const term = normalizeText(searchTerm);
    if (!term) return rows;

    return rows.filter((row) => {
      const rowText = columns.map((column) => String(row[column.key] ?? '')).join(' ');
      const extraText = rowSearchText ? rowSearchText(row) : '';
      const normalized = normalizeText(`${rowText} ${extraText}`);
      return normalized.includes(term);
    });
  }, [columns, rowSearchText, rows, searchEnabled, searchTerm]);

  const sortedRows = useMemo(() => {
    const sortColumn = columns.find((column) => column.key === sortColumnKey) ?? columns[0];
    if (!sortColumn) return filteredRows;

    const list = [...filteredRows];
    list.sort((a, b) => {
      const aValue = a[sortColumn.key];
      const bValue = b[sortColumn.key];

      if (sortColumn.format === 'currency' || sortColumn.format === 'number') {
        const result = Number(aValue ?? 0) - Number(bValue ?? 0);
        return sortDirection === 'asc' ? result : result * -1;
      }

      const result = collator.compare(String(aValue ?? ''), String(bValue ?? ''));
      return sortDirection === 'asc' ? result : result * -1;
    });

    return list;
  }, [collator, columns, filteredRows, sortColumnKey, sortDirection]);


  const handleSort = (columnKey: string) => {
    if (sortColumnKey === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumnKey(columnKey);
    setSortDirection('asc');
  };

  const getSortIndicator = (columnKey: string) => {
    if (sortColumnKey !== columnKey) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const toggleExpandedRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
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
        <div className="dashboard-summary-table-body">
          {searchEnabled ? (
            <div className="dashboard-summary-table-toolbar">
              <ListSearchField
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={searchPlaceholder}
                label="Pesquisar"
                mobileLabel="Pesquisar"
                className="dashboard-summary-table-search"
              />
            </div>
          ) : null}

          <div className="table-scroll module-table module-table-wrap dashboard-summary-table-wrap">
            <table className="dashboard-summary-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>
                      <button className="module-table__sort" type="button" onClick={() => handleSort(column.key)}>
                        {column.label} <span>{getSortIndicator(column.key)}</span>
                      </button>
                    </th>
                  ))}
                  <th className="dashboard-summary-table__expand-header" aria-label={rowDetailsTitle} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="dashboard-summary-table__empty-cell">
                      Nenhum registro encontrado para a pesquisa.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => {
                    const rowDetails = renderRowDetails ? renderRowDetails(row) : null;
                    const canExpand = Boolean(rowDetails);
                    const isExpanded = expandedRows.has(row.key);

                    return (
                      <Fragment key={row.key}>
                        <tr>
                          {columns.map((column) => (
                            <td key={`${row.key}-${column.key}`}>
                              {formatCell(row[column.key], column.format)}
                            </td>
                          ))}
                          <td className="dashboard-summary-table__expand-cell">
                            {canExpand ? (
                              <button
                                type="button"
                                className="dashboard-summary-table__expand-button"
                                onClick={() => toggleExpandedRow(row.key)}
                                aria-label={isExpanded ? `Ocultar ${rowDetailsTitle.toLowerCase()}` : `Mostrar ${rowDetailsTitle.toLowerCase()}`}
                                title={isExpanded ? `Ocultar ${rowDetailsTitle.toLowerCase()}` : `Mostrar ${rowDetailsTitle.toLowerCase()}`}
                              >
                                {isExpanded ? <IoChevronUpOutline size={14} /> : <IoChevronDownOutline size={14} />}
                              </button>
                            ) : null}
                          </td>
                        </tr>

                        {canExpand && isExpanded ? (
                          <tr className="dashboard-summary-table__details-row">
                            <td colSpan={columns.length + 1}>
                              <div className="dashboard-summary-table__details-content">
                                <strong>{rowDetailsTitle}</strong>
                                {rowDetails}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
