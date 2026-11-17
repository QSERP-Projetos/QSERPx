import type { ReactNode } from 'react';

/**
 * Selo de situação padrão do QSERPx ("Ativo", "Em aberto", "Cancelada"…).
 * Todas as telas usam o mesmo visual (src/styles/theme.css, seção "Selos de status").
 *
 *   <StatusBadge label="Em aberto" />            // cor escolhida pelo texto
 *   <StatusBadge tone="success">Ativo</StatusBadge>
 */
export type StatusTone = 'success' | 'warning' | 'orange' | 'danger' | 'info' | 'accent' | 'teal' | 'neutral';

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Escolhe a cor do selo pelo texto da situação. */
export function toneFromLabel(label: string | null | undefined): StatusTone {
  const text = normalize(label ?? '');
  if (!text || text === '-') return 'neutral';
  if (/inativ|desativ|suspens/.test(text)) return 'neutral';
  if (/cancel|reprov|bloque|recus|erro|rejeit|negad|vencid|excluid/.test(text)) return 'danger';
  if (/elabora|devolv|parcial/.test(text)) return 'orange';
  if (/enviad|transmit/.test(text)) return 'accent';
  if (/pend|aguard|digita|gerad|anali|rascunho|espera/.test(text)) return 'warning';
  if (/conclu|encerr|finaliz|liberad|aprov|ativ|autoriz|faturad|emitid|entregue|pago|baixad|configurad|separad|^ok$/.test(text)) return 'success';
  if (/abert|andamento|execu|impress|process|em uso/.test(text)) return 'info';
  return 'neutral';
}

type StatusBadgeProps = {
  label?: string | null;
  tone?: StatusTone;
  children?: ReactNode;
  title?: string;
};

export function StatusBadge({ label, tone, children, title }: StatusBadgeProps) {
  const content = children ?? label ?? '-';
  const resolvedTone = tone ?? toneFromLabel(typeof content === 'string' ? content : label);
  return (
    <span className={`status-pill status-pill--${resolvedTone}`} title={title}>
      {content}
    </span>
  );
}
