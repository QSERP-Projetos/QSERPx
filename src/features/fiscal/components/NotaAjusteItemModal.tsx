import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCloseOutline, IoInformationCircleOutline, IoSyncOutline } from 'react-icons/io5';
import { SearchableSelect } from '../../../components/SearchableSelect';
import {
  buscarMateriaisAjuste,
  calcularAliquotaEfetiva,
  formatCurrencyBr,
  formatDecimalBr,
  getCurrentCompetencia,
  obterReducaoIbsCbs,
  recalcularTributosItem,
  round2,
  type MaterialBusca,
  type ModoTributacao,
  type NotaAjusteCombos,
  type NotaAjusteItemInput,
  type NotaAjusteSubtipoInfo,
} from '../../../services/notaAjusteApi';
import { useToast } from '../../../contexts/ToastContext';

interface NotaAjusteItemModalProps {
  open: boolean;
  onClose: () => void;
  item: NotaAjusteItemInput | null;
  subtipo: NotaAjusteSubtipoInfo | null;
  combos: NotaAjusteCombos | null;
  onSave: (saved: NotaAjusteItemInput) => void;
}

const TP_CRED_ZFM_OPTIONS = [
  { value: '1', label: '1 - Bens finais comercializados na ZFM' },
  { value: '2', label: '2 - Insumos e bens intermediários ZFM' },
  { value: '3', label: '3 - Serviços vinculados na ZFM' },
  { value: '4', label: '4 - Outras hipóteses previstas em lei (ZFM)' },
];

export function NotaAjusteItemModal({
  open,
  onClose,
  item,
  subtipo,
  combos,
  onSave,
}: NotaAjusteItemModalProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<NotaAjusteItemInput | null>(null);
  const [syncBaseComTotal, setSyncBaseComTotal] = useState(true);
  const [modoEscritural, setModoEscritural] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [materiais, setMateriais] = useState<MaterialBusca[]>([]);
  const [buscandoMateriais, setBuscandoMateriais] = useState(false);
  const matTimerRef = useRef<number | null>(null);

  const carregarMateriais = useCallback(async (termo: string) => {
    setBuscandoMateriais(true);
    try {
      const lista = await buscarMateriaisAjuste(termo);
      setMateriais(lista);
    } catch {
      setMateriais([]);
    } finally {
      setBuscandoMateriais(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !item) return;
    const cloned = recalcularTributosItem({ ...item }, subtipo, true);
    setDraft(cloned);
    setSyncBaseComTotal(
      Math.abs((cloned.valorBaseIbsCbs || 0) - (cloned.valorTotalItem || 0)) < 0.02 || (cloned.valorTotalItem || 0) === 0,
    );
    setModoEscritural(Boolean(subtipo?.permiteNcmGenerico00 && (!cloned.ncm || cloned.ncm === '00')));
    setSubmitted(false);
    void carregarMateriais(cloned.codigoMaterial || '');
  }, [open, item, subtipo, carregarMateriais]);

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

  const handleMaterialSearch = useCallback(
    (q: string) => {
      if (matTimerRef.current != null) window.clearTimeout(matTimerRef.current);
      matTimerRef.current = window.setTimeout(() => {
        void carregarMateriais(q);
      }, 260);
    },
    [carregarMateriais],
  );

  const updateAndRecalc = useCallback(
    (patch: Partial<NotaAjusteItemInput>, syncBaseOverride?: boolean) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, ...patch };
        return recalcularTributosItem(merged, subtipo, syncBaseOverride ?? syncBaseComTotal);
      });
    },
    [subtipo, syncBaseComTotal],
  );

  const aplicarReducaoAutomatica = useCallback(
    async (cst: string, classTrib: string) => {
      if (!cst || !classTrib) return;
      try {
        const red = await obterReducaoIbsCbs(cst, classTrib);
        updateAndRecalc({
          reducaoAliqUf: red.reducaoIbsUf ?? 0,
          reducaoAliqMun: red.reducaoIbsMun ?? 0,
          reducaoCbs: red.reducaoCbs ?? 0,
        });
      } catch {
        // Caso não exista parametrização no backend, mantém alíquota integral
      }
    },
    [updateAndRecalc],
  );

  const handleSelectMaterial = (codigoMaterial: string) => {
    const found = materiais.find((m) => m.codigoMaterial === codigoMaterial);
    if (!found || !draft) {
      updateAndRecalc({ codigoMaterial });
      return;
    }

    const patch: Partial<NotaAjusteItemInput> = {
      codigoMaterial: found.codigoMaterial,
      descricaoMaterial: found.descricao,
      unidMedida: found.unidMedida || draft.unidMedida || 'UN',
      ncm: found.ncm || (subtipo?.permiteNcmGenerico00 ? '00' : ''),
      cest: found.cest || '',
      valorUnitario: Number(draft.valorUnitario) > 0 ? draft.valorUnitario : Number(found.precoVenda ?? 0),
    };

    if (subtipo?.modoTributacao === 'gIBSCBS' && found.cstIbsCbs) {
      patch.cstIbsCbs = found.cstIbsCbs;
      if (found.classTribIbsCbs) patch.classTribIbsCbs = found.classTribIbsCbs;
      if (found.aliquotaIbsUf != null) patch.aliquotaIbsUf = found.aliquotaIbsUf;
      if (found.aliquotaIbsMun != null) patch.aliquotaIbsMun = found.aliquotaIbsMun;
      if (found.aliquotaCbs != null) patch.aliquotaCbs = found.aliquotaCbs;
    }

    updateAndRecalc(patch);
    if (subtipo?.modoTributacao === 'gIBSCBS' && patch.cstIbsCbs && patch.classTribIbsCbs) {
      void aplicarReducaoAutomatica(patch.cstIbsCbs, patch.classTribIbsCbs);
    }
  };

  const materialOptions = useMemo(() => {
    const opts = materiais.map((m) => ({
      value: m.codigoMaterial,
      label: `${m.codigoMaterial} - ${m.descricao}${m.ncm ? ` | NCM ${m.ncm}` : ''}`,
    }));
    if (draft?.codigoMaterial && !opts.some((o) => o.value === draft.codigoMaterial)) {
      opts.unshift({
        value: draft.codigoMaterial,
        label: `${draft.codigoMaterial} - ${draft.descricaoMaterial || 'Item atual'}`,
      });
    }
    return opts;
  }, [materiais, draft?.codigoMaterial, draft?.descricaoMaterial]);

  const cfopOptions = useMemo(
    () =>
      (combos?.cfops || []).map((c) => ({
        value: c.codigoCfo,
        label: `${c.codigoCfo} - ${c.descricaoCfo}`,
      })),
    [combos],
  );

  const unidOptions = useMemo(() => {
    const list = combos?.unidadesMedida || ['UN', 'PC', 'KG'];
    const opts = list.map((u) => ({ value: u, label: u }));
    if (draft?.unidMedida && !opts.some((o) => o.value === draft.unidMedida)) {
      opts.unshift({ value: draft.unidMedida, label: draft.unidMedida });
    }
    return opts;
  }, [combos, draft?.unidMedida]);

  const cstOptions = useMemo(
    () => (combos?.cstsIbsCbs || []).map((c) => ({ value: c.codigo, label: `${c.codigo} - ${c.descricao}` })),
    [combos],
  );

  const classTribOptions = useMemo(() => {
    const all = combos?.classTribsIbsCbs || [];
    const cst = draft?.cstIbsCbs || '';
    const filtered = cst ? all.filter((c) => c.codigo.startsWith(cst)) : all;
    const base = filtered.length > 0 ? filtered : all;
    return base.map((c) => ({ value: c.codigo, label: `${c.codigo} - ${c.descricao}` }));
  }, [combos, draft?.cstIbsCbs]);

  if (!open || !draft) return null;

  const modo = (subtipo?.modoTributacao || 'gIBSCBS') as ModoTributacao;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!draft.codigoMaterial.trim()) {
      showToast('Informe ou selecione o código do material/item.', 'info');
      return;
    }
    if (!draft.cfop.trim()) {
      showToast('Selecione o CFOP do item.', 'info');
      return;
    }
    if (!modoEscritural && !subtipo?.permiteNcmGenerico00 && (!draft.ncm || draft.ncm.trim() === '00')) {
      showToast('Para este subtipo, informe um NCM válido de 8 dígitos para o produto.', 'info');
      return;
    }
    if (subtipo?.exigeDFeRefItem && (!draft.chaveDfeRef || draft.chaveDfeRef.replace(/\D+/g, '').length !== 44)) {
      showToast(`O subtipo ${subtipo.codigo} exige Chave de Acesso referenciada (44 dígitos) no item.`, 'info');
      return;
    }
    if (
      subtipo?.exigeDFeRefItem &&
      subtipo?.permiteNItemDFeRef &&
      (!draft.numItemRefAjuste || draft.numItemRefAjuste <= 0)
    ) {
      showToast(`O subtipo ${subtipo.codigo} exige Nº do Item original referenciado (nItem >= 1).`, 'info');
      return;
    }

    onSave({
      ...draft,
      ncm: modoEscritural ? '00' : draft.ncm || (subtipo?.permiteNcmGenerico00 ? '00' : ''),
      chaveDfeRef: draft.chaveDfeRef ? draft.chaveDfeRef.replace(/\D+/g, '') : '',
      numItemRefAjuste: subtipo?.permiteNItemDFeRef === false && subtipo?.codigo === 'ND-03' ? null : draft.numItemRefAjuste,
    });
  };

  const toNum = (v: string) => Number(String(v).replace(',', '.')) || 0;

  return (
    <section
      className="modal-backdrop modal-backdrop--nested"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfa-item-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="modal-card nfa-modal nfa-modal--xl">
        <header className="modal-card__header">
          <h2 id="nfa-item-modal-title">
            Item #{draft.numItem} — Tributação IBS/CBS ({subtipo?.codigo || 'Ajuste'})
          </h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <form onSubmit={handleConfirm} className="nfa-item-form">
          <div className="nfa-modal__body">
            {subtipo?.permiteNcmGenerico00 && (
              <label className="nfa-checkbox">
                <input
                  type="checkbox"
                  checked={modoEscritural}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModoEscritural(checked);
                    updateAndRecalc({
                      ncm: checked ? '00' : '',
                      codigoMaterial: checked && !draft.codigoMaterial ? `AJUSTE${String(draft.numItem).padStart(2, '0')}` : draft.codigoMaterial,
                    });
                  }}
                />
                <span>Item Financeiro / Escritural (usa NCM genérico "00" conforme NT 2025.002-RTC)</span>
              </label>
            )}

            <div className="nfa-grid nfa-grid--2">
              {modoEscritural ? (
                <>
                  <label className="nfa-field">
                    <span>Código do Item / Lançamento *</span>
                    <input
                      className={submitted && !draft.codigoMaterial.trim() ? 'nfa-input-error' : ''}
                      value={draft.codigoMaterial}
                      onChange={(e) => updateAndRecalc({ codigoMaterial: e.target.value })}
                      placeholder="Ex: AJUSTE01, JUROS01"
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Descrição do Item no XML (xProd) *</span>
                    <input
                      value={draft.descricaoMaterial || ''}
                      onChange={(e) => updateAndRecalc({ descricaoMaterial: e.target.value })}
                      placeholder="Ex: Multa e juros sobre NF..."
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="nfa-field">
                    <span>Material (Cadastro Q4/QSERPx) *</span>
                    <SearchableSelect
                      options={materialOptions}
                      value={draft.codigoMaterial}
                      onChange={handleSelectMaterial}
                      onSearchInputChange={handleMaterialSearch}
                      placeholder={buscandoMateriais ? 'Buscando materiais...' : 'Digite código ou descrição...'}
                      emptyText="Nenhum material encontrado."
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Descrição do Produto no XML (xProd)</span>
                    <input
                      value={draft.descricaoMaterial || ''}
                      onChange={(e) => updateAndRecalc({ descricaoMaterial: e.target.value })}
                    />
                  </label>
                </>
              )}
            </div>

            {!modoEscritural && (
              <div className="nfa-item-picker-helper">
                <button
                  type="button"
                  className="secondary-button nfa-btn-xs"
                  onClick={() => handleSelectMaterial(draft.codigoMaterial)}
                  disabled={!draft.codigoMaterial}
                >
                  <IoSyncOutline size={14} />
                  <span>Recarregar dados fiscais do material</span>
                </button>
              </div>
            )}

            <div className="nfa-grid nfa-grid--6">
              <label className="nfa-field">
                <span>NCM</span>
                <input
                  value={draft.ncm || ''}
                  onChange={(e) => updateAndRecalc({ ncm: e.target.value })}
                  maxLength={8}
                  placeholder={modoEscritural ? '00' : '8 dígitos'}
                />
              </label>

              <label className="nfa-field">
                <span>CEST</span>
                <input
                  value={draft.cest || ''}
                  onChange={(e) => updateAndRecalc({ cest: e.target.value })}
                  maxLength={9}
                />
              </label>

              <label className="nfa-field">
                <span>Unid.</span>
                <SearchableSelect
                  options={unidOptions}
                  value={draft.unidMedida}
                  onChange={(val) => updateAndRecalc({ unidMedida: val })}
                  placeholder="UN"
                />
              </label>

              <label className="nfa-field nfa-field--span2">
                <span>CFOP *</span>
                <SearchableSelect
                  options={cfopOptions}
                  value={draft.cfop}
                  onChange={(val) => updateAndRecalc({ cfop: val })}
                  placeholder="Selecione CFOP..."
                />
              </label>

              <label className="nfa-field">
                <span>Quantidade</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={draft.quantidade}
                  onChange={(e) => updateAndRecalc({ quantidade: toNum(e.target.value) })}
                />
              </label>
            </div>

            <div className="nfa-grid nfa-grid--3">
              <label className="nfa-field">
                <span>Valor Unitário (R$)</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={draft.valorUnitario}
                  onChange={(e) => updateAndRecalc({ valorUnitario: toNum(e.target.value) })}
                />
              </label>

              <div className="nfa-metric-box">
                <span>Valor Total Item (vProd)</span>
                <strong>{formatCurrencyBr(draft.valorTotalItem)}</strong>
              </div>

              <div className="nfa-metric-box">
                <span>Compõe Total da NF (indTot)</span>
                <strong>{subtipo?.compoeTotal === false ? '0 - Não compõe vNF (Escritural)' : '1 - Compõe vNF'}</strong>
              </div>
            </div>

            {/* Bloco Tributação IBS/CBS */}
            <fieldset className="nfa-fieldset">
              <legend>Tributação Reforma Tributária — Modo: {modo}</legend>

              <div className="nfa-grid nfa-grid--2">
                <label className="nfa-field">
                  <span>CST IBS/CBS *</span>
                  <SearchableSelect
                    options={cstOptions}
                    value={draft.cstIbsCbs}
                    onChange={(cst) => {
                      const cand = (combos?.classTribsIbsCbs || []).find((c) => c.codigo.startsWith(cst))?.codigo;
                      const nextClass = cand || draft.classTribIbsCbs;
                      updateAndRecalc({ cstIbsCbs: cst, classTribIbsCbs: nextClass });
                      void aplicarReducaoAutomatica(cst, nextClass);
                    }}
                    placeholder="Selecione CST..."
                  />
                </label>

                <label className="nfa-field">
                  <span>Classificação Tributária (cClassTrib) *</span>
                  <SearchableSelect
                    options={classTribOptions}
                    value={draft.classTribIbsCbs}
                    onChange={(ct) => {
                      updateAndRecalc({ classTribIbsCbs: ct });
                      void aplicarReducaoAutomatica(draft.cstIbsCbs, ct);
                    }}
                    placeholder="Selecione cClassTrib..."
                  />
                </label>
              </div>

              {modo === 'gIBSCBS' && (
                <>
                  <div className="nfa-trib-base-row">
                    <label className="nfa-field">
                      <span>Base de Cálculo IBS/CBS (vBC)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.valorBaseIbsCbs}
                        disabled={syncBaseComTotal}
                        onChange={(e) => updateAndRecalc({ valorBaseIbsCbs: round2(toNum(e.target.value)) }, false)}
                      />
                    </label>
                    <label className="nfa-checkbox nfa-checkbox--inline">
                      <input
                        type="checkbox"
                        checked={syncBaseComTotal}
                        onChange={(e) => {
                          const s = e.target.checked;
                          setSyncBaseComTotal(s);
                          if (s) updateAndRecalc({ valorBaseIbsCbs: draft.valorTotalItem }, true);
                        }}
                      />
                      <span>Sincronizar vBC com Valor Total do Item</span>
                    </label>
                  </div>

                  <div className="nfa-trib-cards">
                    <div className="nfa-trib-card">
                      <h4>IBS Estadual (gIBSUF)</h4>
                      <div className="nfa-grid nfa-grid--3">
                        <label className="nfa-field">
                          <span>Alíq. (%)</span>
                          <input
                            type="number"
                            step="0.0001"
                            value={draft.aliquotaIbsUf}
                            onChange={(e) => updateAndRecalc({ aliquotaIbsUf: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Red.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.reducaoAliqUf}
                            onChange={(e) => updateAndRecalc({ reducaoAliqUf: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Efetiva</span>
                          <input
                            readOnly
                            value={formatDecimalBr(
                              calcularAliquotaEfetiva(draft.aliquotaIbsUf, draft.reducaoAliqUf),
                              4,
                            )}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Diferim.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.difUf}
                            onChange={(e) => updateAndRecalc({ difUf: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>vDevTrib</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.devTribUf}
                            onChange={(e) => updateAndRecalc({ devTribUf: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>Vlr IBS UF</span>
                          <input readOnly className="nfa-input-highlight" value={formatDecimalBr(draft.valorIbsUf, 2)} />
                        </label>
                      </div>
                    </div>

                    <div className="nfa-trib-card">
                      <h4>IBS Municipal (gIBSMun)</h4>
                      <div className="nfa-grid nfa-grid--3">
                        <label className="nfa-field">
                          <span>Alíq. (%)</span>
                          <input
                            type="number"
                            step="0.0001"
                            value={draft.aliquotaIbsMun}
                            onChange={(e) => updateAndRecalc({ aliquotaIbsMun: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Red.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.reducaoAliqMun}
                            onChange={(e) => updateAndRecalc({ reducaoAliqMun: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Efetiva</span>
                          <input
                            readOnly
                            value={formatDecimalBr(
                              calcularAliquotaEfetiva(draft.aliquotaIbsMun, draft.reducaoAliqMun),
                              4,
                            )}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Diferim.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.difMun}
                            onChange={(e) => updateAndRecalc({ difMun: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>vDevTrib</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.devTribMun}
                            onChange={(e) => updateAndRecalc({ devTribMun: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>Vlr IBS Mun</span>
                          <input readOnly className="nfa-input-highlight" value={formatDecimalBr(draft.valorIbsMun, 2)} />
                        </label>
                      </div>
                    </div>

                    <div className="nfa-trib-card">
                      <h4>CBS Federal (gCBS)</h4>
                      <div className="nfa-grid nfa-grid--3">
                        <label className="nfa-field">
                          <span>Alíq. (%)</span>
                          <input
                            type="number"
                            step="0.0001"
                            value={draft.aliquotaCbs}
                            onChange={(e) => updateAndRecalc({ aliquotaCbs: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Red.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.reducaoCbs}
                            onChange={(e) => updateAndRecalc({ reducaoCbs: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Efetiva</span>
                          <input
                            readOnly
                            value={formatDecimalBr(
                              calcularAliquotaEfetiva(draft.aliquotaCbs, draft.reducaoCbs),
                              4,
                            )}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>% Diferim.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.difCbs}
                            onChange={(e) => updateAndRecalc({ difCbs: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>vDevTrib</span>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.devTribCbs}
                            onChange={(e) => updateAndRecalc({ devTribCbs: toNum(e.target.value) })}
                          />
                        </label>
                        <label className="nfa-field">
                          <span>Vlr CBS</span>
                          <input readOnly className="nfa-input-highlight" value={formatDecimalBr(draft.valorCbs, 2)} />
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modo === 'gTransfCred' && (
                <div className="nfa-grid nfa-grid--2">
                  <label className="nfa-field">
                    <span>Valor IBS a Transferir (vIBS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorIbsTransfCred ?? 0}
                      onChange={(e) => updateAndRecalc({ valorIbsTransfCred: round2(toNum(e.target.value)) })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Valor CBS a Transferir (vCBS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorCbsTransfCred ?? 0}
                      onChange={(e) => updateAndRecalc({ valorCbsTransfCred: round2(toNum(e.target.value)) })}
                    />
                  </label>
                </div>
              )}

              {modo === 'gAjusteCompet' && (
                <div className="nfa-grid nfa-grid--3">
                  <label className="nfa-field">
                    <span>Competência (AAAA-MM) *</span>
                    <input
                      value={draft.anoBaseAjusteCompNf || getCurrentCompetencia()}
                      maxLength={7}
                      placeholder="AAAA-MM (ex: 2026-12)"
                      onChange={(e) => updateAndRecalc({ anoBaseAjusteCompNf: e.target.value })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Valor IBS Compet. (vIBS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorIbsAjusteCompNf ?? 0}
                      onChange={(e) => updateAndRecalc({ valorIbsAjusteCompNf: round2(toNum(e.target.value)) })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Valor CBS Compet. (vCBS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorCbsAjusteCompNf ?? 0}
                      onChange={(e) => updateAndRecalc({ valorCbsAjusteCompNf: round2(toNum(e.target.value)) })}
                    />
                  </label>
                </div>
              )}

              {modo === 'gEstornoCred' && (
                <div className="nfa-grid nfa-grid--2">
                  <label className="nfa-field">
                    <span>Valor IBS Estorno (vIBSEstCred) *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorIbsEstCred ?? 0}
                      onChange={(e) => updateAndRecalc({ valorIbsEstCred: round2(toNum(e.target.value)) })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Valor CBS Estorno (vCBSEstCred) *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorCbsEstCred ?? 0}
                      onChange={(e) => updateAndRecalc({ valorCbsEstCred: round2(toNum(e.target.value)) })}
                    />
                  </label>
                </div>
              )}

              {modo === 'gCredPresIBSZFM' && (
                <div className="nfa-grid nfa-grid--3">
                  <label className="nfa-field">
                    <span>Competência ZFM (AAAA-MM) *</span>
                    <input
                      value={draft.competApurZfm || getCurrentCompetencia()}
                      maxLength={7}
                      placeholder="AAAA-MM"
                      onChange={(e) => updateAndRecalc({ competApurZfm: e.target.value })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Tipo Crédito ZFM (tpCredPres) *</span>
                    <SearchableSelect
                      options={TP_CRED_ZFM_OPTIONS}
                      value={String(draft.tpCredPresIbsZfm ?? 1)}
                      onChange={(v) => updateAndRecalc({ tpCredPresIbsZfm: Number(v) || 1 })}
                    />
                  </label>
                  <label className="nfa-field">
                    <span>Valor Crédito ZFM (vCredPres) *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.valorCredPresIbsZfm ?? 0}
                      onChange={(e) => updateAndRecalc({ valorCredPresIbsZfm: round2(toNum(e.target.value)) })}
                    />
                  </label>
                </div>
              )}
            </fieldset>

            {/* Documento Referenciado por Item (DFeReferenciado) */}
            {(subtipo?.exigeDFeRefItem || draft.chaveDfeRef) && (
              <fieldset className="nfa-fieldset">
                <legend>Documento Referenciado no Item (DFeReferenciado)</legend>

                {subtipo?.codigo === 'ND-03' && (
                  <div className="nfa-banner nfa-banner--info">
                    <IoInformationCircleOutline size={16} />
                    <span>
                      Para <strong>ND-03</strong> (Débitos não processados na apuração), a NT 2025.002-RTC proíbe a
                      tag <code>&lt;nItem&gt;</code> dentro de <code>&lt;DFeReferenciado&gt;</code> (Rejeição 1039).
                      Informe apenas a chave de acesso de 44 dígitos.
                    </span>
                  </div>
                )}

                <div className="nfa-grid nfa-grid--3">
                  <label className="nfa-field nfa-field--span2">
                    <span>Chave de Acesso Referenciada (44 dígitos) {subtipo?.exigeDFeRefItem ? '*' : ''}</span>
                    <input
                      className={`nfa-mono ${
                        submitted && subtipo?.exigeDFeRefItem && (draft.chaveDfeRef || '').replace(/\D+/g, '').length !== 44
                          ? 'nfa-input-error'
                          : ''
                      }`}
                      value={draft.chaveDfeRef || ''}
                      maxLength={44}
                      placeholder="44 dígitos da NF-e original..."
                      onChange={(e) => updateAndRecalc({ chaveDfeRef: e.target.value.replace(/\D+/g, '') })}
                    />
                  </label>

                  {subtipo?.permiteNItemDFeRef !== false && (
                    <label className="nfa-field">
                      <span>Nº do Item na NF-e Origem (nItem) *</span>
                      <input
                        type="number"
                        min="1"
                        max="990"
                        value={draft.numItemRefAjuste ?? ''}
                        onChange={(e) =>
                          updateAndRecalc({
                            numItemRefAjuste: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </fieldset>
            )}
          </div>

          <footer className="nfa-modal__footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Salvar Item
            </button>
          </footer>
        </form>
      </article>
    </section>
  );
}
