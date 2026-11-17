import { useCallback, useState } from 'react';

/**
 * Padrão de campos obrigatórios do QSERPx.
 *
 * - Ao abrir o formulário nada aparece em vermelho.
 * - Ao confirmar (validate), os campos obrigatórios vazios ficam com borda vermelha
 *   e mostram "Campo obrigatório" logo abaixo.
 * - Conforme o usuário preenche, o erro do campo some.
 *
 * Uso:
 *   const obrig = useRequiredFields();
 *   // ao abrir/limpar o formulário:  obrig.reset();
 *   // ao confirmar:
 *   if (!obrig.validate([descricao, quantidade])) {
 *     showToast(REQUIRED_FIELDS_MESSAGE, 'error');
 *     return;
 *   }
 *   // no campo:
 *   <input className={obrig.inputClass(descricao)} ... />
 *   {obrig.error(descricao)}
 */
export const REQUIRED_FIELDS_MESSAGE = 'Preencha os campos obrigatórios destacados.';

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

export function useRequiredFields() {
  const [submitted, setSubmitted] = useState(false);

  const isInvalid = useCallback((value: unknown) => submitted && isEmptyValue(value), [submitted]);

  const validate = useCallback((values: unknown[]) => {
    setSubmitted(true);
    return values.every((value) => !isEmptyValue(value));
  }, []);

  const reset = useCallback(() => setSubmitted(false), []);

  const inputClass = useCallback(
    (value: unknown, base = '') => `${base}${isInvalid(value) ? `${base ? ' ' : ''}module-input-error` : ''}`.trim() || undefined,
    [isInvalid],
  );

  /** Para componentes compostos (CustomDatePicker, SearchableSelect): adiciona "is-error". */
  const wrapperClass = useCallback(
    (value: unknown, base = '') => `${base}${isInvalid(value) ? `${base ? ' ' : ''}is-error` : ''}`.trim() || undefined,
    [isInvalid],
  );

  const error = useCallback(
    (value: unknown, message = 'Campo obrigatório') =>
      isInvalid(value) ? <small className="module-field-error">{message}</small> : null,
    [isInvalid],
  );

  return { submitted, isInvalid, validate, reset, inputClass, wrapperClass, error };
}
