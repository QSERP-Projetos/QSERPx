import type { ReactNode } from 'react';
import { IoArrowDownOutline, IoArrowUpOutline, IoChevronForwardOutline } from 'react-icons/io5';

/*
 * Lista padrão do QSERPx (substitui as tabelas de listagem).
 * Mesmo estilo da lista de notificações da página inicial.
 *
 *   <DataListSortBar options={[{ field: 'codigo', label: 'Código' }]} active={sortField}
 *                    direction={sortDirection} onSort={handleSort} />
 *   <DataList ariaLabel="Clientes">
 *     {itens.map((item) => (
 *       <DataListItem key={item.id} code="#101" title="Nome" subtitle="Razão social"
 *                     details={[{ label: 'Cidade', value: 'Londrina / PR' }]}
 *                     status={<span className="...">Ativo</span>} aside="R$ 10,00"
 *                     actions={<button className="icon-button">…</button>}
 *                     onOpen={() => abrir(item)} />
 *     ))}
 *   </DataList>
 *
 * Estilos em src/styles/theme.css (seção "Registros em lista").
 */

export type DataListSortOption<T extends string = string> = {
  field: T;
  label: string;
};

type DataListSortBarProps<T extends string> = {
  options: Array<DataListSortOption<T>>;
  active: T | null | undefined;
  direction: 'asc' | 'desc';
  onSort: (field: T) => void;
  label?: string;
  /** Conteúdo extra à direita da barra (ex.: "Selecionar todas"). */
  children?: ReactNode;
};

export function DataListSortBar<T extends string>({
  options,
  active,
  direction,
  onSort,
  label = 'Ordenar por',
  children,
}: DataListSortBarProps<T>) {
  return (
    <div className="data-cards-toolbar" role="group" aria-label={label}>
      {options.length > 0 ? <span className="data-cards-toolbar__label">{label}</span> : null}
      {options.map((option) => {
        const isActive = active === option.field;
        return (
          <button
            key={option.field}
            type="button"
            className={`data-cards-sort${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onSort(option.field)}
          >
            {option.label}
            {isActive ? (
              direction === 'asc' ? (
                <IoArrowUpOutline size={13} aria-label="crescente" />
              ) : (
                <IoArrowDownOutline size={13} aria-label="decrescente" />
              )
            ) : null}
          </button>
        );
      })}
      {children ? <div className="data-cards-toolbar__extra">{children}</div> : null}
    </div>
  );
}

type DataListProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
};

export function DataList({ ariaLabel, children, className }: DataListProps) {
  return (
    <div className={`data-list-card${className ? ` ${className}` : ''}`}>
      <ul className="data-list" aria-label={ariaLabel}>
        {children}
      </ul>
    </div>
  );
}

export type DataListDetail = {
  label: string;
  value: ReactNode;
};

type DataListItemProps = {
  /** Coluna da esquerda (código, número). */
  code?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Informações secundárias exibidas em linha: "Rótulo valor · Rótulo valor". */
  details?: Array<DataListDetail | null | false | undefined>;
  /** Selo de situação/status. */
  status?: ReactNode;
  /** Valor em destaque à direita (ex.: data, valor). */
  aside?: ReactNode;
  /** Botões de ação da linha (não disparam onOpen). */
  actions?: ReactNode;
  /** Elemento antes do código (ex.: checkbox de seleção). */
  leading?: ReactNode;
  /** Abre o registro ao clicar na linha. */
  onOpen?: () => void;
  selected?: boolean;
  className?: string;
};

export function DataListItem({
  code,
  title,
  subtitle,
  details,
  status,
  aside,
  actions,
  leading,
  onOpen,
  selected = false,
  className,
}: DataListItemProps) {
  const visibleDetails = (details || []).filter(Boolean) as DataListDetail[];

  const content = (
    <>
      {code !== undefined ? <span className="data-list__code">{code}</span> : null}
      <span className="data-list__body">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {visibleDetails.length > 0 ? (
          <span className="data-list__details">
            {visibleDetails.map((detail, index) => (
              <span key={`${detail.label}-${index}`} className="data-list__detail">
                <em>{detail.label}</em> {detail.value}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {status ? <span className="data-list__status">{status}</span> : null}
      {aside !== undefined && aside !== null && aside !== '' ? <span className="data-list__aside">{aside}</span> : null}
      {onOpen ? <IoChevronForwardOutline className="data-list__chevron" size={15} aria-hidden="true" /> : null}
    </>
  );

  return (
    <li className={`data-list__row${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}>
      {leading ? <span className="data-list__leading">{leading}</span> : null}
      {onOpen ? (
        <button type="button" className="data-list__item" onClick={onOpen}>
          {content}
        </button>
      ) : (
        <div className="data-list__item data-list__item--static">{content}</div>
      )}
      {actions ? <span className="data-list__actions">{actions}</span> : null}
    </li>
  );
}
