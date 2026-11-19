import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IoCloseOutline, IoContractOutline, IoExpandOutline } from 'react-icons/io5';

type ModalHeaderActionsProps = {
  /** Fecha o popup (mesma ação do botão "Fechar" do rodapé). */
  onClose: () => void;
  /** Desabilita os botões (ex.: enquanto salva). */
  disabled?: boolean;
  /** Mostra o botão de expandir/restaurar. Desligado em confirmações simples. */
  expandable?: boolean;
  /** Ações extras do cabeçalho, exibidas antes de Expandir e Fechar. */
  children?: ReactNode;
};

/**
 * Ações padrão do cabeçalho de todo popup do QSERPx (modelo: Ordem de Separação).
 *
 * Uso:
 *   <article className="modal-card">
 *     <header className="modal-card__header">
 *       <h2>Título</h2>
 *       <ModalHeaderActions onClose={fechar} />
 *     </header>
 *     ...conteúdo...
 *     <footer className="modal-card__footer">
 *       <button className="primary-button">Salvar</button>
 *       <button className="secondary-button modal-card__close" onClick={fechar}>Fechar</button>
 *     </footer>
 *   </article>
 *
 * O botão Expandir marca o `.modal-card` com `data-expanded="true"`; o tamanho
 * expandido é definido em src/styles/theme.css (seção Popups).
 */
export function ModalHeaderActions({ onClose, disabled = false, expandable = true, children }: ModalHeaderActionsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const card = ref.current?.closest('.modal-card');
    if (!card) return;
    if (expanded) {
      card.setAttribute('data-expanded', 'true');
    } else {
      card.removeAttribute('data-expanded');
    }
  }, [expanded]);

  return (
    <div className="modal-card__header-actions" ref={ref}>
      {children}
      {expandable ? (
        <button
          type="button"
          className="icon-button modal-card__header-button"
          aria-label={expanded ? 'Restaurar tamanho' : 'Expandir'}
          title={expanded ? 'Restaurar tamanho' : 'Expandir'}
          aria-pressed={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <IoContractOutline size={17} /> : <IoExpandOutline size={17} />}
        </button>
      ) : null}
      <button
        type="button"
        className="icon-button modal-card__header-button"
        aria-label="Fechar"
        title="Fechar"
        onClick={() => onClose()}
        disabled={disabled}
      >
        <IoCloseOutline size={18} />
      </button>
    </div>
  );
}
