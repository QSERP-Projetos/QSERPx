import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IoTimeOutline } from 'react-icons/io5';

type CustomTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  stepMinutes?: number;
};

const applyTimeMask = (rawValue: string) => {
  const digits = String(rawValue || '')
    .replace(/\D+/g, '')
    .slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const isValidTimeValue = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());

const clampStep = (value?: number) => {
  if (!Number.isFinite(value)) return 30;
  const safe = Math.max(1, Math.min(60, Number(value)));
  return safe;
};

const buildTimeOptions = (step: number) => {
  const list: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    list.push(`${hh}:${mm}`);
  }

  if (list[list.length - 1] !== '23:59') {
    list.push('23:59');
  }

  return list;
};

export function CustomTimePicker({
  value,
  onChange,
  placeholder = 'HH:MM',
  disabled = false,
  readOnly = false,
  className,
  id,
  name,
  required,
  stepMinutes,
}: CustomTimePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const safeStep = useMemo(() => clampStep(stepMinutes), [stepMinutes]);
  const options = useMemo(() => buildTimeOptions(safeStep), [safeStep]);

  const updatePopoverPosition = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;

    const rect = control.getBoundingClientRect();
    const maxWidth = Math.min(320, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, 230), maxWidth);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

    const estimatedHeight = 312;
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
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`time-picker${className ? ` ${className}` : ''}`} ref={rootRef}>
      <div className="time-picker__control" ref={controlRef}>
        <input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(applyTimeMask(event.target.value))}
          onBlur={(event) => {
            const normalized = String(event.target.value || '').trim();
            if (!normalized) return;
            if (!isValidTimeValue(normalized)) {
              onChange('');
            }
          }}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={5}
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />

        <button
          type="button"
          className="time-picker__trigger"
          onClick={() => {
            if (disabled || readOnly) return;
            setOpen((prev) => !prev);
          }}
          aria-label="Abrir lista de horas"
          tabIndex={-1}
          disabled={disabled || readOnly}
        >
          <IoTimeOutline size={18} />
        </button>
      </div>

      {open && !disabled && !readOnly
        ? createPortal(
            <div className="time-picker__popover" ref={popoverRef} style={popoverStyle}>
              <div className="time-picker__header">Selecione a hora</div>
              <div className="time-picker__list" role="listbox" aria-label="Lista de horas">
                {options.map((option) => {
                  const active = option === value;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`time-picker__option${active ? ' selected' : ''}`}
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                    >
                      {option}
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
