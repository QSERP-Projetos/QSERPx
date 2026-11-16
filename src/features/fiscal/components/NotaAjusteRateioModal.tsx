import { useEffect, useMemo, useState } from 'react';
import { IoCalculatorOutline, IoCloseOutline, IoInformationCircleOutline } from 'react-icons/io5';
import { SearchableSelect } from '../../../components/SearchableSelect';
import {
  aplicarRateioMultaJuros,
  formatCurrencyBr,
  formatDecimalBr,
  obterReducaoIbsCbs,
  round2,
  type NotaAjusteCombos,
  type NotaAjusteItemInput,
  type NotaAjusteSubtipoInfo,
} from '../../../services/notaAjusteApi';

interface NotaAjusteRateioModalProps {
  open: boolean;
  onClose: () => void;
  itens: NotaAjusteItemInput[];
  combos: NotaAjusteCombos | null;
  subtipo: NotaAjusteSubtipoInfo | null;
  onAplicar: (novosItens: NotaAjusteItemInput[], totalRateado: number) => void;
}

export function NotaAjusteRateioModal({
  open,
  onClose,
  itens,
  combos,
  subtipo,
  onAplicar,
}: NotaAjusteRateioModalProps) {
  const [modoValor, setModoValor] = useState<'valor' | 'percentual'>('valor');
  const [valorAcrescimo, setValorAcrescimo] = useState<string>('0');
  const [percentualAcrescimo, setPercentualAcrescimo] = useState<string>('2');
  const [sobrescreverTributos, setSobrescreverTributos] = useState(false);

  const [cstIbsCbs, setCstIbsCbs] = useState('000');
  const [classTribIbsCbs, setClassTribIbsCbs] = useState('000001');
  const [aliquotaIbsUf, setAliquotaIbsUf] = useState('0.1');
  const [aliquotaIbsMun, setAliquotaIbsMun] = useState('0');
  const [aliquotaCbs, setAliquotaCbs] = useState('0.9');
  const [reducaoAliqUf, setReducaoAliqUf] = useState('0');
  const [reducaoAliqMun, setReducaoAliqMun] = useState('0');
  const [reducaoCbs, setReducaoCbs] = useState('0');

  useEffect(() => {
    if (!open) return;
    const primeiro = itens[0];
    setModoValor('valor');
    setValorAcrescimo('0');
    setPercentualAcrescimo('2');
    setSobrescreverTributos(false);
    setCstIbsCbs(primeiro?.cstIbsCbs || subtipo?.cstPadrao || '000');
    setClassTribIbsCbs(primeiro?.classTribIbsCbs || subtipo?.classTribPadrao || '000001');
    setAliquotaIbsUf(String(primeiro?.aliquotaIbsUf ?? 0.1));
    setAliquotaIbsMun(String(primeiro?.aliquotaIbsMun ?? 0));
    setAliquotaCbs(String(primeiro?.aliquotaCbs ?? 0.9));
    setReducaoAliqUf(String(primeiro?.reducaoAliqUf ?? 0));
    setReducaoAliqMun(String(primeiro?.reducaoAliqMun ?? 0));
    setReducaoCbs(String(primeiro?.reducaoCbs ?? 0));
  }, [open, itens, subtipo]);

  useEffect(() => {
    if (!open || !sobrescreverTributos || !cstIbsCbs || !classTribIbsCbs) return;
    let active = true;
    void obterReducaoIbsCbs(cstIbsCbs, classTribIbsCbs)
      .then((red) => {
        if (!active) return;
        setReducaoAliqUf(String(red.reducaoIbsUf ?? 0));
        setReducaoAliqMun(String(red.reducaoIbsMun ?? 0));
        setReducaoCbs(String(red.reducaoCbs ?? 0));
      })
      .catch(() => {
        // Ignora caso classificação não possua redução cadastrada
      });
    return () => {
      active = false;
    };
  }, [open, sobrescreverTributos, cstIbsCbs, classTribIbsCbs]);

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

  const somaBaseOriginal = useMemo(
    () =>
      round2(
        itens.reduce(
          (acc, item) =>
            acc +
            (Number(item.valorTotalItem || 0) > 0
              ? Number(item.valorTotalItem)
              : Number(item.quantidade || 0) * Number(item.valorUnitario || 0)),
          0,
        ),
      ),
    [itens],
  );

  const previewItens = useMemo(() => {
    const valNum = Number(valorAcrescimo.replace(',', '.')) || 0;
    const pctNum = Number(percentualAcrescimo.replace(',', '.')) || 0;
    const target = modoValor === 'percentual' ? round2(somaBaseOriginal * (pctNum / 100)) : round2(valNum);
    if (target <= 0 || itens.length === 0) return itens;

    return aplicarRateioMultaJuros(
      itens,
      {
        modoValor,
        valorAcrescimo: valNum,
        percentualAcrescimo: pctNum,
        sobrescreverTributos,
        cstIbsCbs,
        classTribIbsCbs,
        aliquotaIbsUf: Number(aliquotaIbsUf.replace(',', '.')) || 0,
        aliquotaIbsMun: Number(aliquotaIbsMun.replace(',', '.')) || 0,
        aliquotaCbs: Number(aliquotaCbs.replace(',', '.')) || 0,
        reducaoAliqUf: Number(reducaoAliqUf.replace(',', '.')) || 0,
        reducaoAliqMun: Number(reducaoAliqMun.replace(',', '.')) || 0,
        reducaoCbs: Number(reducaoCbs.replace(',', '.')) || 0,
      },
      subtipo,
    );
  }, [
    itens,
    modoValor,
    valorAcrescimo,
    percentualAcrescimo,
    somaBaseOriginal,
    sobrescreverTributos,
    cstIbsCbs,
    classTribIbsCbs,
    aliquotaIbsUf,
    aliquotaIbsMun,
    aliquotaCbs,
    reducaoAliqUf,
    reducaoAliqMun,
    reducaoCbs,
    subtipo,
  ]);

  const totalPreview = useMemo(
    () => round2(previewItens.reduce((acc, it) => acc + Number(it.valorTotalItem || 0), 0)),
    [previewItens],
  );
  const totalIbsPreview = useMemo(
    () => round2(previewItens.reduce((acc, it) => acc + Number(it.valorIbsUf || 0) + Number(it.valorIbsMun || 0), 0)),
    [previewItens],
  );
  const totalCbsPreview = useMemo(
    () => round2(previewItens.reduce((acc, it) => acc + Number(it.valorCbs || 0), 0)),
    [previewItens],
  );

  const cstsOptions = useMemo(
    () => (combos?.cstsIbsCbs || []).map((c) => ({ value: c.codigo, label: `${c.codigo} - ${c.descricao}` })),
    [combos],
  );
  const classTribOptions = useMemo(() => {
    const all = combos?.classTribsIbsCbs || [];
    const filtered = cstIbsCbs ? all.filter((c) => c.codigo.startsWith(cstIbsCbs)) : all;
    const source = filtered.length > 0 ? filtered : all;
    return source.map((c) => ({ value: c.codigo, label: `${c.codigo} - ${c.descricao}` }));
  }, [combos, cstIbsCbs]);

  if (!open) return null;

  const valInformado =
    modoValor === 'percentual'
      ? round2(somaBaseOriginal * ((Number(percentualAcrescimo.replace(',', '.')) || 0) / 100))
      : round2(Number(valorAcrescimo.replace(',', '.')) || 0);

  return (
    <section
      className="modal-backdrop modal-backdrop--nested"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfa-rateio-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="modal-card nfa-modal nfa-modal--xl">
        <header className="modal-card__header">
          <h2 id="nfa-rateio-title">Rateio Automático de Multa e Juros ({subtipo?.codigo || 'ND-04 / NC-01'})</h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <div className="nfa-modal__body">
          <div className="nfa-banner nfa-banner--info">
            <IoInformationCircleOutline size={18} />
            <span>
              Distribui o valor de multa/juros proporcionalmente ao valor atual de cada item importado, preservando o{' '}
              <code>DFeReferenciado</code> (<code>chaveAcesso</code> + <code>nItem</code>) e recalculando automaticamente{' '}
              <code>vBC</code>, IBS UF, IBS Mun e CBS em todos os itens.
            </span>
          </div>

          <div className="nfa-rateio-controls">
            <div className="nfa-radio-pills">
              <button
                type="button"
                className={`nfa-pill ${modoValor === 'valor' ? 'is-active' : ''}`}
                onClick={() => setModoValor('valor')}
              >
                Informar Valor Total (R$)
              </button>
              <button
                type="button"
                className={`nfa-pill ${modoValor === 'percentual' ? 'is-active' : ''}`}
                onClick={() => setModoValor('percentual')}
              >
                Calcular % sobre a Base ({formatCurrencyBr(somaBaseOriginal)})
              </button>
            </div>

            <div className="nfa-grid nfa-grid--3">
              {modoValor === 'valor' ? (
                <label className="nfa-field">
                  <span>Valor Total de Multa / Juros (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorAcrescimo}
                    onChange={(e) => setValorAcrescimo(e.target.value)}
                  />
                </label>
              ) : (
                <label className="nfa-field">
                  <span>Percentual de Acréscimo (%)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={percentualAcrescimo}
                    onChange={(e) => setPercentualAcrescimo(e.target.value)}
                  />
                </label>
              )}

              <div className="nfa-metric-box">
                <span>Valor a distribuir</span>
                <strong>{formatCurrencyBr(valInformado)}</strong>
              </div>

              <div className="nfa-metric-box">
                <span>IBS + CBS estimado pós-rateio</span>
                <strong>
                  {formatCurrencyBr(totalIbsPreview)} / {formatCurrencyBr(totalCbsPreview)}
                </strong>
              </div>
            </div>

            <label className="nfa-checkbox">
              <input
                type="checkbox"
                checked={sobrescreverTributos}
                onChange={(e) => setSobrescreverTributos(e.target.checked)}
              />
              <span>Aplicar CST / cClassTrib / alíquotas uniformes sobre os itens rateados</span>
            </label>

            {sobrescreverTributos && (
              <div className="nfa-rateio-trib-box">
                <div className="nfa-grid nfa-grid--2">
                  <label className="nfa-field">
                    <span>CST IBS/CBS</span>
                    <SearchableSelect
                      options={cstsOptions}
                      value={cstIbsCbs}
                      onChange={setCstIbsCbs}
                      placeholder="Selecione CST..."
                    />
                  </label>
                  <label className="nfa-field">
                    <span>cClassTrib IBS/CBS</span>
                    <SearchableSelect
                      options={classTribOptions}
                      value={classTribIbsCbs}
                      onChange={setClassTribIbsCbs}
                      placeholder="Selecione cClassTrib..."
                    />
                  </label>
                </div>

                <div className="nfa-grid nfa-grid--6">
                  <label className="nfa-field">
                    <span>Alíq. IBS UF (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={aliquotaIbsUf}
                      onChange={(e) => setAliquotaIbsUf(e.target.value)}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>% Red. IBS UF</span>
                    <input
                      type="number"
                      step="0.01"
                      value={reducaoAliqUf}
                      onChange={(e) => setReducaoAliqUf(e.target.value)}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Alíq. IBS Mun (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={aliquotaIbsMun}
                      onChange={(e) => setAliquotaIbsMun(e.target.value)}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>% Red. IBS Mun</span>
                    <input
                      type="number"
                      step="0.01"
                      value={reducaoAliqMun}
                      onChange={(e) => setReducaoAliqMun(e.target.value)}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Alíq. CBS (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={aliquotaCbs}
                      onChange={(e) => setAliquotaCbs(e.target.value)}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>% Red. CBS</span>
                    <input
                      type="number"
                      step="0.01"
                      value={reducaoCbs}
                      onChange={(e) => setReducaoCbs(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="table-scroll nfa-table-wrap">
            <table className="nfa-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Material / Descrição</th>
                  <th>Ref nItem</th>
                  <th className="nfa-num">Valor Base Atual</th>
                  <th className="nfa-num">Novo Valor Rateado</th>
                  <th className="nfa-num">Base IBS/CBS</th>
                  <th className="nfa-num">IBS UF + Mun</th>
                  <th className="nfa-num">CBS</th>
                </tr>
              </thead>
              <tbody>
                {previewItens.map((item, idx) => {
                  const orig = itens[idx];
                  const origVal = Number(orig?.valorTotalItem ?? 0);
                  return (
                    <tr key={`${item.numItem}-${idx}`}>
                      <td className="nfa-mono">{item.numItem}</td>
                      <td>
                        <strong>{item.codigoMaterial}</strong>
                        <div className="nfa-subtext">{item.descricaoMaterial || '-'}</div>
                      </td>
                      <td className="nfa-mono">{item.numItemRefAjuste ?? '-'}</td>
                      <td className="nfa-num">{formatDecimalBr(origVal, 2)}</td>
                      <td className="nfa-num nfa-highlight-cell">{formatDecimalBr(item.valorTotalItem, 2)}</td>
                      <td className="nfa-num">{formatDecimalBr(item.valorBaseIbsCbs, 2)}</td>
                      <td className="nfa-num">{formatDecimalBr(Number(item.valorIbsUf) + Number(item.valorIbsMun), 2)}</td>
                      <td className="nfa-num">{formatDecimalBr(item.valorCbs, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="nfa-modal__footer">
          <div className="nfa-footer-summary">
            Total pós-rateio: <strong>{formatCurrencyBr(totalPreview)}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={valInformado <= 0 || itens.length === 0}
            onClick={() => onAplicar(previewItens, totalPreview)}
          >
            <IoCalculatorOutline size={16} />
            <span>Aplicar Rateio nos Itens</span>
          </button>
        </footer>
      </article>
    </section>
  );
}
