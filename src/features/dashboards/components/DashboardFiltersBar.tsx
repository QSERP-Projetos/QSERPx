import { IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import type { DashboardDateErrors } from '../types';

type DashboardFiltersBarProps = {
  codigoEmpresa: string;
  dataDe: string;
  dataAte: string;
  errors: DashboardDateErrors;
  loading: boolean;
  onCodigoEmpresaChange: (value: string) => void;
  onDataDeChange: (value: string) => void;
  onDataAteChange: (value: string) => void;
  onRefresh: () => void;
  onClear: () => void;
};

export function DashboardFiltersBar({
  codigoEmpresa,
  dataDe,
  dataAte,
  errors,
  loading,
  onCodigoEmpresaChange,
  onDataDeChange,
  onDataAteChange,
  onRefresh,
  onClear,
}: DashboardFiltersBarProps) {
  return (
    <section className="card dashboard-filters-card">
      <div className="dashboard-filters-grid">
        <label className="list-layout-field list-layout-field--sm dashboard-field">
          <span>Código da empresa</span>
          <input
            value={codigoEmpresa}
            onChange={(event) => onCodigoEmpresaChange(event.target.value)}
            placeholder="Ex.: 1"
            inputMode="numeric"
          />
          <small className={`module-field-error${errors.codigoEmpresa ? '' : ' dashboard-error-empty'}`}>
            {errors.codigoEmpresa || ' '}
          </small>
        </label>

        <label className="list-layout-field list-layout-field--date dashboard-field">
          <span>Data de</span>
          <CustomDatePicker value={dataDe} onChange={onDataDeChange} className={errors.dataDe ? 'pcp-date-error' : undefined} />
          <small className={`module-field-error${errors.dataDe ? '' : ' dashboard-error-empty'}`}>{errors.dataDe || ' '}</small>
        </label>

        <label className="list-layout-field list-layout-field--date dashboard-field">
          <span>Data até</span>
          <CustomDatePicker value={dataAte} onChange={onDataAteChange} className={errors.dataAte ? 'pcp-date-error' : undefined} />
          <small className={`module-field-error${errors.dataAte ? '' : ' dashboard-error-empty'}`}>{errors.dataAte || ' '}</small>
        </label>

        <div className="dashboard-filter-actions">
          <button
            className="icon-button module-action-button"
            type="button"
            onClick={onRefresh}
            title="Atualizar"
            aria-label="Atualizar"
            disabled={loading}
          >
            <IoRefreshOutline size={16} />
          </button>

          <button
            className="icon-button module-action-button"
            type="button"
            onClick={onClear}
            title="Limpar filtros"
            aria-label="Limpar filtros"
            disabled={loading}
          >
            <IoTrashOutline size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
