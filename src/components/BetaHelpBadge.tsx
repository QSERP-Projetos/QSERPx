import { useEffect, useId, useRef, useState } from 'react';
import { IoHelpCircleOutline } from 'react-icons/io5';

type ToggleLikeEvent = Event & { newState?: string };

export interface BetaHelpBadgeProps {
  title?: string;
  description?: string;
  note?: string;
}

const DEFAULT_TITLE = 'Rotina em fase de testes (Beta)';
const DEFAULT_DESCRIPTION =
  'Esta rotina está em fase de testes no QSERPx. Caso ocorra qualquer erro ou comportamento inesperado, utilize a rotina equivalente no sistema Q4 — falhas aqui não impedem o funcionamento normal no QSERP.';
const DEFAULT_NOTE = 'Caso encontre algum erro, abra um chamado para que possamos corrigi-lo.';

/**
 * Selo (BETA) e botão de ajuda (?) para rotinas em fase de testes no QSERPx.
 * Utiliza Popover API (`popover="hint"` com fallback para `"auto"`) e `interestfor`
 * com suporte a hover/foco/clique em navegadores sem `interestfor` nativo.
 */
export function BetaHelpBadge({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  note = DEFAULT_NOTE,
}: BetaHelpBadgeProps) {
  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const supportsInterest =
    typeof HTMLButtonElement !== 'undefined' && 'interestForElement' in HTMLButtonElement.prototype;

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const probe = document.createElement('div');
    probe.popover = 'hint';
    const supportsHint = probe.popover === 'hint';

    const handleBeforeToggle = (event: Event) => {
      const toggleEvent = event as ToggleLikeEvent;
      if (!supportsHint && toggleEvent.newState === 'open') {
        el.popover = 'auto';
      }
    };

    const handleToggle = (event: Event) => {
      const toggleEvent = event as ToggleLikeEvent;
      setOpen(toggleEvent.newState === 'open');
    };

    el.addEventListener('beforetoggle', handleBeforeToggle);
    el.addEventListener('toggle', handleToggle);
    return () => {
      el.removeEventListener('beforetoggle', handleBeforeToggle);
      el.removeEventListener('toggle', handleToggle);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const showPopoverFallback = () => {
    if (supportsInterest) return;
    clearCloseTimer();
    const el = popoverRef.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    if (!el) return;
    try {
      if (!el.matches(':popover-open')) {
        el.showPopover?.();
      }
    } catch {
      // Ignora caso navegador não suporte Popover API
    }
  };

  const scheduleHidePopoverFallback = () => {
    if (supportsInterest) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      const el = popoverRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
      if (!el) return;
      try {
        if (el.matches(':popover-open')) {
          el.hidePopover?.();
        }
      } catch {
        // Ignora caso já esteja fechado
      }
    }, 160);
  };

  const triggerAttrs = {
    interestfor: popoverId,
    popovertarget: popoverId,
    popovertargetaction: 'show',
  } as Record<string, string>;

  const popoverAttrs = {
    popover: 'hint',
  } as Record<string, string>;

  return (
    <span className="beta-help">
      <span className="status-pill status-pill--warning beta-help__pill">(BETA)</span>

      <button
        type="button"
        className="icon-button beta-help__trigger"
        aria-label="Informações sobre esta rotina em fase Beta"
        aria-expanded={open}
        onMouseEnter={showPopoverFallback}
        onMouseLeave={scheduleHidePopoverFallback}
        onFocus={showPopoverFallback}
        onBlur={scheduleHidePopoverFallback}
        {...triggerAttrs}
      >
        <IoHelpCircleOutline size={18} />
      </button>

      <div
        id={popoverId}
        ref={popoverRef}
        role="tooltip"
        className="beta-help__popover"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleHidePopoverFallback}
        {...popoverAttrs}
      >
        <strong className="beta-help__title">{title}</strong>
        <p>{description}</p>
        {note && <p>{note}</p>}
      </div>
    </span>
  );
}
