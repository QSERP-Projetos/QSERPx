import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IoCalendarOutline, IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';

type CustomDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
};

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

const parseDateValue = (value: string): Date | null => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
};

const formatDateValue = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const applyDateMask = (rawValue: string) => {
  const digits = String(rawValue || '')
    .replace(/\D+/g, '')
    .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isSameDate = (a: Date, b: Date) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

export function CustomDatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  disabled = false,
  readOnly = false,
  className,
  id,
  name,
  required,
}: CustomDatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const monthLabel = useMemo(() => {
    return visibleMonth.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [visibleMonth]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;

    return Array.from({ length: 42 }, (_, index) => {
      return new Date(year, month, index - offset + 1);
    });
  }, [visibleMonth]);

  const updatePopoverPosition = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;

    const rect = control.getBoundingClientRect();
    const maxWidth = Math.min(360, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, 308), maxWidth);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

    const estimatedHeight = 332;
    let top = rect.bottom + 8;

    if (top + estimatedHeight > window.innerHeight - 12) {
      const canShowAbove = rect.top - estimatedHeight - 8 > 12;
      if (canShowAbove) {
        top = rect.top - estimatedHeight - 8;
      }
    }

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePopoverPosition();

    const handleWindowMove = () => {
      updatePopoverPosition();
    };

    window.addEventListener('resize', handleWindowMove);
    window.addEventListener('scroll', handleWindowMove, true);

    return () => {
      window.removeEventListener('resize', handleWindowMove);
      window.removeEventListener('scroll', handleWindowMove, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setOpen(false);
  };

  return (
    <div className={`date-picker${className ? ` ${className}` : ''}`} ref={rootRef}>
      <div className="date-picker__control" ref={controlRef}>
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(applyDateMask(event.target.value))}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />

        <button
          type="button"
          className="date-picker__trigger"
          onClick={() => {
            if (disabled || readOnly) return;
            if (open) {
              setOpen(false);
              return;
            }

            const baseDate = selectedDate ?? new Date();
            setVisibleMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
            setOpen(true);
          }}
          aria-label="Abrir calendario"
          tabIndex={-1}
          disabled={disabled || readOnly}
        >
          <IoCalendarOutline size={18} />
        </button>
      </div>

      {open && !disabled && !readOnly
        ? createPortal(
            <div className="date-picker__popover" ref={popoverRef} style={popoverStyle}>
              <div className="date-picker__header">
                <button
                  type="button"
                  className="date-picker__nav"
                  onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  aria-label="Mes anterior"
                >
                  <IoChevronBackOutline size={16} />
                </button>

                <div className="date-picker__month">{monthLabel}</div>

                <button
                  type="button"
                  className="date-picker__nav"
                  onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  aria-label="Proximo mes"
                >
                  <IoChevronForwardOutline size={16} />
                </button>
              </div>

              <div className="date-picker__weekdays">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="date-picker__weekday">
                    {day}
                  </div>
                ))}
              </div>

              <div className="date-picker__grid">
                {days.map((day) => {
                  const muted = day.getMonth() !== visibleMonth.getMonth();
                  const today = isSameDate(day, new Date());
                  const selected = selectedDate ? isSameDate(day, selectedDate) : false;

                  return (
                    <button
                      type="button"
                      key={day.toISOString()}
                      className={`date-picker__day${muted ? ' muted' : ''}${today ? ' today' : ''}${selected ? ' selected' : ''}`}
                      onClick={() => selectDate(day)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
