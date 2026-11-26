import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { IoCloseCircleOutline, IoSearchOutline } from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { useToast } from '../../../contexts/ToastContext';
import { obterTributacoesCall } from '../../../services/apiCalls';
import { GlobalConfig } from '../../../services/globalConfig';

export type TipoHelpTrib =
  | 'ClassificacaoFiscal'
  | 'ICMS'
  | 'CSOSN'
  | 'IPI'
  | 'PISCofins'
  | 'CBenef'
  | 'CBSIBS'
  | 'ClassTribIBSCBS'
  | 'IS'
  | 'ClassTribIS';

interface HelpItem {
  codigo: string;
  descricao: string;
}

interface Props {
  open: boolean;
  tipo: TipoHelpTrib | null;
  titulo: string;
  origemParam?: string;
  onSelect: (codigo: string, descricao: string) => void;
  onClose: () => void;
}

export function FaturamentoTribHelpModal({ open, tipo, titulo, origemParam, onSelect, onClose }: Props) {
  const { showToast } = useToast();
  const titleId = useId();
  const [filtro, setFiltro] = useState('');
  const [items, setItems] = useState<HelpItem[]>([]);
  const [loadedKey, setLoadedKey] = useState('');

  const reqKey = open && tipo ? `${tipo}|${origemParam ?? ''}` : '';
  const loading = Boolean(reqKey) && loadedKey !== reqKey;

  const carregar = useCallback(
    async (tp: string, orig?: string) => {
      const currentKey = `${tp}|${orig ?? ''}`;
      try {
        const baseUrl = GlobalConfig.getBaseUrl();
        const token = GlobalConfig.getJwToken();
        const resp = await obterTributacoesCall(baseUrl, token, tp, undefined, orig);
        if (resp.succeeded && Array.isArray(resp.data)) {
          setItems(
            resp.data.map((it: any) => ({
              codigo: String(it.codigo ?? it.Codigo ?? ''),
              descricao: String(it.descricao ?? it.Descricao ?? ''),
            })),
          );
        } else {
          setItems([]);
          if (!resp.succeeded && (resp.data as any)?.message) {
            showToast((resp.data as any).message, 'info');
          }
        }
      } catch (err: any) {
        setItems([]);
        showToast(err?.message || 'Falha ao buscar tributações.', 'error');
      } finally {
        setLoadedKey(currentKey);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!open || !tipo) return;
    void carregar(tipo, origemParam);
  }, [open, tipo, origemParam, carregar]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return items;
    return items.filter((it) => it.codigo.toLowerCase().includes(f) || it.descricao.toLowerCase().includes(f));
  }, [items, filtro]);

  if (!open || !tipo) return null;

  return (
    <section
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="modal-card tributacao-help-modal">
        <header className="modal-card__header">
          <h2 id={titleId}>{titulo}</h2>
          <ModalHeaderActions onClose={onClose} expandable={false} />
        </header>

        <div className="fat-modal-body fat-stack">
          <div className="global-list-search__input-wrap">
            <IoSearchOutline size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Filtrar por código ou descrição..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="tributacao-help-search-input"
              autoFocus
            />
            {filtro.trim() ? (
              <button
                type="button"
                className="field-clear-button"
                onClick={() => setFiltro('')}
                aria-label="Limpar filtro"
              >
                <IoCloseCircleOutline size={16} />
              </button>
            ) : null}
          </div>

          <div className="table-scroll" tabIndex={0} role="region" aria-label={titulo}>
            {loading ? (
              <p className="module-empty">Carregando opções...</p>
            ) : filtrados.length === 0 ? (
              <p className="module-empty">Nenhum registro encontrado.</p>
            ) : (
              <table className="tributacao-help-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((it) => (
                    <tr
                      key={`${it.codigo}-${it.descricao}`}
                      onClick={() => {
                        onSelect(it.codigo, it.descricao);
                        setFiltro('');
                        onClose();
                      }}
                    >
                      <td data-no-translate="">
                        <strong>{it.codigo}</strong>
                      </td>
                      <td data-no-translate="">{it.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="modal-card__footer">
          <button
            type="button"
            className="secondary-button modal-card__close"
            onClick={() => {
              setFiltro('');
              onClose();
            }}
          >
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}
