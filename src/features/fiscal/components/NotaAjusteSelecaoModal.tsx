import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoCloseOutline, IoSearchOutline } from 'react-icons/io5';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import {
  formatCurrencyBr,
  listarAdiantamentosAjuste,
  listarNotasReferenciaAjuste,
  listarRecebimentosAjuste,
  toBrDateFromIso,
  type AdiantamentoDisponivel,
  type NotaOriginalResumo,
  type RecebimentoResumo,
} from '../../../services/notaAjusteApi';
import { useToast } from '../../../contexts/ToastContext';
import {
  compareSortNumber,
  compareSortText,
  getAriaSort,
  getSortIndicator,
  nextSortState,
  parseSortTimestamp,
  sortByComparator,
  type SortDirection,
} from '../../../utils/tableSort';

export type ModoSelecaoOrigem = 'nf-original' | 'recebimento' | 'adiantamento';

interface NotaAjusteSelecaoModalProps {
  open: boolean;
  modo: ModoSelecaoOrigem;
  codigoClienteFiltro?: number | null;
  onClose: () => void;
  onSelectNotaOriginal: (nf: NotaOriginalResumo) => void;
  onSelectRecebimento: (rec: RecebimentoResumo) => void;
  onSelectAdiantamento: (adiant: AdiantamentoDisponivel) => void;
}

const TITULOS: Record<ModoSelecaoOrigem, string> = {
  'nf-original': 'Selecionar NF-e Original para Referência / Importação',
  recebimento: 'Selecionar Recebimento de Mercadoria (Perda / Estoque)',
  adiantamento: 'Vincular Adiantamento Financeiro (Contas a Receber)',
};

export function NotaAjusteSelecaoModal({
  open,
  modo,
  codigoClienteFiltro,
  onClose,
  onSelectNotaOriginal,
  onSelectRecebimento,
  onSelectAdiantamento,
}: NotaAjusteSelecaoModalProps) {
  const { showToast } = useToast();
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);

  const [notas, setNotas] = useState<NotaOriginalResumo[]>([]);
  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [adiantamentos, setAdiantamentos] = useState<AdiantamentoDisponivel[]>([]);
  const [sortField, setSortField] = useState<string>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    setSortField(modo === 'adiantamento' ? 'emissao' : 'data');
    setSortDirection('desc');
  }, [modo]);

  const handleSort = (field: string) => {
    const next = nextSortState(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
  };

  const renderSortTh = (label: string, field: string, className?: string) => (
    <th scope="col" className={className} aria-sort={getAriaSort(sortField, sortDirection, field)}>
      <button type="button" className="module-table__sort" onClick={() => handleSort(field)}>
        {label} <span aria-hidden="true">{getSortIndicator(sortField, sortDirection, field)}</span>
      </button>
    </th>
  );

  const notasOrdenadas = useMemo(() => {
    return sortByComparator(notas, sortDirection, (a, b) => {
      switch (sortField) {
        case 'nota':
          return (
            compareSortNumber(a.numNotaFiscal, b.numNotaFiscal) ||
            compareSortText(a.serNotaFiscal, b.serNotaFiscal)
          );
        case 'cfop':
          return compareSortText(a.codigoCfo, b.codigoCfo);
        case 'destinatario':
          return compareSortText(a.nomeDestinatario, b.nomeDestinatario);
        case 'total':
          return compareSortNumber(a.valorTotalNota, b.valorTotalNota);
        case 'ibs':
          return compareSortNumber(a.valorTotalIbs, b.valorTotalIbs);
        case 'cbs':
          return compareSortNumber(a.valorTotalCbs, b.valorTotalCbs);
        case 'data':
        default:
          return parseSortTimestamp(a.dataEmissao) - parseSortTimestamp(b.dataEmissao);
      }
    });
  }, [notas, sortField, sortDirection]);

  const recebimentosOrdenados = useMemo(() => {
    return sortByComparator(recebimentos, sortDirection, (a, b) => {
      switch (sortField) {
        case 'doc':
          return compareSortNumber(a.numeroDocto, b.numeroDocto) || compareSortText(a.serie, b.serie);
        case 'fornecedor':
          return compareSortText(a.nomeFornecedor, b.nomeFornecedor);
        case 'total':
          return compareSortNumber(a.valorTotal, b.valorTotal);
        case 'data':
        default:
          return (
            parseSortTimestamp(a.dataRecebimento || a.dataDocumento) -
            parseSortTimestamp(b.dataRecebimento || b.dataDocumento)
          );
      }
    });
  }, [recebimentos, sortField, sortDirection]);

  const adiantamentosOrdenados = useMemo(() => {
    return sortByComparator(adiantamentos, sortDirection, (a, b) => {
      switch (sortField) {
        case 'lanc':
          return compareSortNumber(a.numLanc, b.numLanc);
        case 'doc':
          return compareSortText(a.numDocumento, b.numDocumento);
        case 'cliente':
          return compareSortText(a.nomeCedente, b.nomeCedente);
        case 'vencimento':
          return parseSortTimestamp(a.dataVencimento) - parseSortTimestamp(b.dataVencimento);
        case 'saldo':
          return compareSortNumber(a.valorSaldo, b.valorSaldo);
        case 'emissao':
        default:
          return parseSortTimestamp(a.dataEmissao) - parseSortTimestamp(b.dataEmissao);
      }
    });
  }, [adiantamentos, sortField, sortDirection]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (modo === 'nf-original') {
        const res = await listarNotasReferenciaAjuste({ busca, dataInicio, dataFim });
        setNotas(res);
      } else if (modo === 'recebimento') {
        const res = await listarRecebimentosAjuste({ busca, dataInicio, dataFim });
        setRecebimentos(res);
      } else {
        const res = await listarAdiantamentosAjuste({
          codigoCliente: codigoClienteFiltro ?? undefined,
          busca,
        });
        setAdiantamentos(res);
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao carregar registros para importação.', 'error');
    } finally {
      setLoading(false);
    }
  }, [modo, busca, dataInicio, dataFim, codigoClienteFiltro, showToast]);

  useEffect(() => {
    if (!open) return;
    setBusca('');
    void carregar();
  }, [open, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <section
      className="modal-backdrop modal-backdrop--nested"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfa-selecao-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="modal-card nfa-modal nfa-modal--xl">
        <header className="modal-card__header">
          <h2 id="nfa-selecao-title">{TITULOS[modo]}</h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <div className="nfa-modal__body">
          <form
            className="nfa-selecao-filters"
            onSubmit={(e) => {
              e.preventDefault();
              void carregar();
            }}
          >
            <label className="nfa-field nfa-field--grow">
              <span>Pesquisar (número, chave de acesso, cliente/fornecedor)</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite número, chave ou razão social..."
              />
            </label>

            {modo !== 'adiantamento' && (
              <>
                <label className="nfa-field nfa-field--date">
                  <span>Data início</span>
                  <CustomDatePicker value={dataInicio} onChange={setDataInicio} />
                </label>
                <label className="nfa-field nfa-field--date">
                  <span>Data fim</span>
                  <CustomDatePicker value={dataFim} onChange={setDataFim} />
                </label>
              </>
            )}

            <button type="submit" className="primary-button nfa-btn-inline" disabled={loading}>
              <IoSearchOutline size={16} />
              <span>{loading ? 'Buscando...' : 'Buscar'}</span>
            </button>
          </form>

          <div className="table-scroll nfa-table-wrap">
            {loading ? (
              <p className="module-empty">Carregando registros...</p>
            ) : modo === 'nf-original' ? (
              notas.length === 0 ? (
                <p className="module-empty">Nenhuma NF-e autorizada encontrada para referência.</p>
              ) : (
                <table className="nfa-table">
                  <thead>
                    <tr>
                      {renderSortTh('NF / Série', 'nota')}
                      {renderSortTh('Emissão', 'data')}
                      {renderSortTh('CFOP', 'cfop')}
                      {renderSortTh('Destinatário', 'destinatario')}
                      {renderSortTh('Total NF', 'total', 'nfa-num')}
                      {renderSortTh('IBS', 'ibs', 'nfa-num')}
                      {renderSortTh('CBS', 'cbs', 'nfa-num')}
                      <th scope="col">Chave Acesso</th>
                      <th scope="col">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasOrdenadas.map((nf) => (
                      <tr
                        key={`${nf.numNotaFiscal}-${nf.serNotaFiscal}`}
                        onClick={() => onSelectNotaOriginal(nf)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="nfa-mono">
                          {nf.numNotaFiscal}/{nf.serNotaFiscal}
                        </td>
                        <td>{toBrDateFromIso(nf.dataEmissao) || '-'}</td>
                        <td className="nfa-mono">{nf.codigoCfo}</td>
                        <td>{nf.nomeDestinatario}</td>
                        <td className="nfa-num">{formatCurrencyBr(nf.valorTotalNota)}</td>
                        <td className="nfa-num">{formatCurrencyBr(nf.valorTotalIbs)}</td>
                        <td className="nfa-num">{formatCurrencyBr(nf.valorTotalCbs)}</td>
                        <td className="nfa-mono nfa-chave-cell" title={nf.chaveAcessoNfe || ''}>
                          {nf.chaveAcessoNfe ? `${nf.chaveAcessoNfe.slice(0, 14)}...${nf.chaveAcessoNfe.slice(-6)}` : '-'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button nfa-btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNotaOriginal(nf);
                            }}
                          >
                            Importar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : modo === 'recebimento' ? (
              recebimentos.length === 0 ? (
                <p className="module-empty">Nenhum recebimento encontrado.</p>
              ) : (
                <table className="nfa-table">
                  <thead>
                    <tr>
                      {renderSortTh('Documento / Série', 'doc')}
                      {renderSortTh('Recebimento', 'data')}
                      {renderSortTh('Fornecedor', 'fornecedor')}
                      {renderSortTh('Valor Total', 'total', 'nfa-num')}
                      <th scope="col">Chave NF-e Origem</th>
                      <th scope="col">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recebimentosOrdenados.map((rec) => (
                      <tr
                        key={`${rec.numeroDocto}-${rec.serie}-${rec.codigoFornecedor}`}
                        onClick={() => onSelectRecebimento(rec)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="nfa-mono">
                          {rec.numeroDocto}/{rec.serie}
                        </td>
                        <td>{toBrDateFromIso(rec.dataRecebimento || rec.dataDocumento) || '-'}</td>
                        <td>{rec.nomeFornecedor}</td>
                        <td className="nfa-num">{formatCurrencyBr(rec.valorTotal)}</td>
                        <td className="nfa-mono nfa-chave-cell" title={rec.chaveAcessoNfe || ''}>
                          {rec.chaveAcessoNfe ? `${rec.chaveAcessoNfe.slice(0, 14)}...${rec.chaveAcessoNfe.slice(-6)}` : '-'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button nfa-btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectRecebimento(rec);
                            }}
                          >
                            Importar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : adiantamentos.length === 0 ? (
              <p className="module-empty">Nenhum adiantamento em aberto encontrado no Contas a Receber.</p>
            ) : (
              <table className="nfa-table">
                <thead>
                  <tr>
                    {renderSortTh('Lançamento', 'lanc')}
                    {renderSortTh('Documento', 'doc')}
                    {renderSortTh('Cliente', 'cliente')}
                    {renderSortTh('Emissão', 'emissao')}
                    {renderSortTh('Vencimento', 'vencimento')}
                    {renderSortTh('Saldo Adiant.', 'saldo', 'nfa-num')}
                    <th scope="col">Obs.</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {adiantamentosOrdenados.map((ad) => (
                    <tr
                      key={ad.numLanc}
                      onClick={() => onSelectAdiantamento(ad)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="nfa-mono">{ad.numLanc}</td>
                      <td className="nfa-mono">{ad.numDocumento}</td>
                      <td>
                        {ad.codigoCedente} - {ad.nomeCedente}
                      </td>
                      <td>{toBrDateFromIso(ad.dataEmissao) || '-'}</td>
                      <td>{toBrDateFromIso(ad.dataVencimento) || '-'}</td>
                      <td className="nfa-num">{formatCurrencyBr(ad.valorSaldo)}</td>
                      <td>{ad.observacao || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button nfa-btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAdiantamento(ad);
                          }}
                        >
                          Vincular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="nfa-modal__footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}
