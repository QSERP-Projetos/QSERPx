import { useEffect, type ReactNode } from 'react';
import { IoCloseOutline } from 'react-icons/io5';

type AdvancedFiltersPanelProps = {
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  applyDisabled?: boolean;
  cancelLabel?: string;
  applyLabel?: string;
  title?: string;
  children: ReactNode;
};

export function AdvancedFiltersPanel({
  open,
  onClose,
  onApply,
  applyDisabled = false,
  cancelLabel = 'Cancelar',
  applyLabel = 'Filtrar',
  title = 'Filtros avançados',
  children,
}: AdvancedFiltersPanelProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <section
      className="modal-backdrop filters-panel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-filters-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article className="modal-card filters-panel">
        <header className="modal-card__header">
          <h2 id="advanced-filters-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Fechar filtros" onClick={onClose}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <div className="filters-panel__content">
          {children}

          {onApply ? (
            <div className="filters-panel__actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" className="primary-button" onClick={onApply} disabled={applyDisabled}>
                {applyLabel}
              </button>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}