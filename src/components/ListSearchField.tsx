import { IoCloseCircleOutline, IoSearchOutline } from 'react-icons/io5';

type ListSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  mobileLabel?: string;
  className?: string;
};

export function ListSearchField({
  value,
  onChange,
  placeholder = 'Pesquisar',
  label = 'Pesquisar',
  mobileLabel,
  className,
}: ListSearchFieldProps) {
  const resolvedMobileLabel = mobileLabel ?? label;

  return (
    <label className={`list-layout-field list-layout-field--xl global-list-search${className ? ` ${className}` : ''}`}>
      {label ? <span className="global-list-search__label global-list-search__label--desktop">{label}</span> : null}
      {resolvedMobileLabel ? <span className="global-list-search__label global-list-search__label--mobile">{resolvedMobileLabel}</span> : null}
      <div className="global-list-search__input-wrap">
        <IoSearchOutline size={16} aria-hidden="true" />
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        {value.trim() ? (
          <button
            type="button"
            className="field-clear-button"
            aria-label="Limpar pesquisa"
            title="Limpar"
            onClick={() => onChange('')}
          >
            <IoCloseCircleOutline size={16} />
          </button>
        ) : null}
      </div>
    </label>
  );
}