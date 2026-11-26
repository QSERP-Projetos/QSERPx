import { useState, type FocusEvent } from 'react';

export const formatDecimalBr = (
  val: number | null | undefined,
  decimals = 2,
  minDecimals = decimals,
): string => {
  const num = Number.isFinite(Number(val)) ? Number(val) : 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: Math.max(decimals, minDecimals),
  });
};

export const parseDecimalBr = (raw: string): number => {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

interface DecimalInputProps {
  value: number | null | undefined;
  onChange?: (value: number) => void;
  decimals?: number;
  minDecimals?: number;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  min?: number;
}

export function DecimalInput({
  value,
  onChange,
  decimals = 2,
  minDecimals,
  readOnly = false,
  disabled = false,
  className,
  ariaLabel,
  placeholder,
  id,
  name,
  min,
}: DecimalInputProps) {
  const minD = minDecimals ?? decimals;
  const maxD = Math.max(decimals, minD);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    const num = Number.isFinite(Number(value)) ? Number(value) : 0;
    const initial = num.toLocaleString('pt-BR', {
      useGrouping: false,
      minimumFractionDigits: minD,
      maximumFractionDigits: maxD,
    });
    setDraft(initial);
    setFocused(true);
    window.requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = () => {
    if (!focused) return;
    setFocused(false);
    let parsed = parseDecimalBr(draft);
    if (min !== undefined && parsed < min) parsed = min;
    const factor = 10 ** maxD;
    parsed = Math.round(parsed * factor) / factor;
    onChange?.(parsed);
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      disabled={disabled}
      value={focused ? draft : formatDecimalBr(value, maxD, minD)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(e) => {
        if (readOnly || disabled) return;
        const next = e.target.value;
        setDraft(next);
        let parsed = parseDecimalBr(next);
        if (min !== undefined && parsed < min) parsed = min;
        onChange?.(parsed);
      }}
    />
  );
}
