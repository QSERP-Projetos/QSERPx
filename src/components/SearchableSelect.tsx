import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  name?: string;
  ariaLabel?: string;
  className?: string;
  dropUp?: boolean;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione',
  searchPlaceholder = 'Pesquisar...',
  emptyText = 'Nenhuma opcao encontrada.',
  disabled = false,
  name,
  ariaLabel,
  className,
  dropUp = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number; maxHeight: number; renderUp: boolean } | null>(null);

  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const normalizedLabel = normalizeText(option.label);
      const normalizedValue = normalizeText(option.value);
      return normalizedLabel.includes(normalizedQuery) || normalizedValue.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
      setQuery('');
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePopoverPosition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const horizontalPadding = 12;

      const width = Math.min(rect.width, viewportWidth - horizontalPadding * 2);
      const left = Math.max(horizontalPadding, Math.min(rect.left, viewportWidth - width - horizontalPadding));

      const spaceBelow = Math.max(160, viewportHeight - rect.bottom - 14);
      const spaceAbove = Math.max(160, rect.top - 14);
      const shouldDropUp = dropUp || spaceBelow < 220;

      const maxHeight = Math.max(160, shouldDropUp ? spaceAbove : spaceBelow);
      const top = shouldDropUp ? rect.top - 6 : rect.bottom + 6;

      setPopoverStyle({ top, left, width, maxHeight, renderUp: shouldDropUp });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [dropUp, isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const handleControlKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen((prev) => !prev);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  };

  const handleSelectValue = (nextValue: string) => {
    onChange(nextValue);
    close();
  };

  const wrapperClassName = className ? `searchable-select ${className}` : 'searchable-select';
  const controlClassName = `searchable-select__control${isOpen ? ' is-open' : ''}`;
  const popoverClassName = `searchable-select__popover searchable-select__popover--portal${dropUp ? ' searchable-select__popover--drop-up' : ''}`;

  const shouldRenderPortal = isOpen && typeof document !== 'undefined';

  const popoverNode = (
    <div
      ref={popoverRef}
      className={popoverClassName}
      style={
        popoverStyle
          ? {
              position: 'fixed',
              left: `${popoverStyle.left}px`,
              width: `${popoverStyle.width}px`,
              top: popoverStyle.renderUp ? undefined : `${popoverStyle.top}px`,
              bottom: popoverStyle.renderUp ? `${Math.max(12, window.innerHeight - popoverStyle.top)}px` : undefined,
            }
          : undefined
      }
    >
      <input
        ref={searchInputRef}
        className="search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />

      <ul
        className="searchable-select__list"
        role="listbox"
        id={listboxId}
        aria-label={ariaLabel || 'Opcoes'}
        style={popoverStyle ? { maxHeight: `${Math.max(120, popoverStyle.maxHeight - 70)}px` } : undefined}
      >
        {filteredOptions.length === 0 ? (
          <li className="searchable-select__empty">{emptyText}</li>
        ) : (
          filteredOptions.map((option) => {
            const isActive = option.value === value;

            return (
              <li key={`${option.value}-${option.label}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`searchable-select__option${isActive ? ' active' : ''}`}
                  onClick={() => handleSelectValue(option.value)}
                >
                  {option.label}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div className={wrapperClassName} ref={rootRef}>
      <select
        className="searchable-select__native"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        name={name}
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={controlClassName}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleControlKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`searchable-select__value${selectedOption ? '' : ' searchable-select__placeholder'}`}>
          {selectedOption?.label ?? placeholder}
        </span>

        <span className="searchable-select__chevron" aria-hidden="true">
          {isOpen ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
        </span>
      </button>

      {shouldRenderPortal ? createPortal(popoverNode, document.body) : null}
    </div>
  );
}
