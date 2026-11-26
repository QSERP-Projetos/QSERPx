import { useCallback, useEffect, useId, useState } from 'react';
import {
  IoCloseCircleOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
  IoRefreshOutline,
  IoReturnUpBackOutline,
} from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import {
  cancelarItemFilaFaturamento,
  formatCurrencyBr,
  gerarNfRetornoTerceiros,
  obterDetalheFilaFaturamento,
  obterFilaFaturamento,
  toBrDateFromIso,
  type FaturamentoFilaResponseDto,
  type FilaDetalheDto,
  type FornecedorCnpjOptionDto,
} from '../../../services/faturamentoApi';

interface Props {
  open: boolean;
  onClose: () => void;
  onAbrirVendaOs: (numSeparacao: number) => void;
  onAbrirDiversa: (numSolicitacao: number) => void;
  refreshTrigger?: number;
}

export function FaturamentoFilaModal({
  open,
  onClose,
  onAbrirVendaOs,
  onAbrirDiversa,
  refreshTrigger = 0,
}: Props) {
  const { showToast } = useToast();
  const titleId = useId();
  const consultaTitleId = useId();

  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [fila, setFila] = useState<FaturamentoFilaResponseDto | null>(null);
  const [selOs, setSelOs] = useState<number[]>([]);
  const [selSolic, setSelSolic] = useState<number[]>([]);

  // Confirmação Cancelar Fila
  const [confirmCanc, setConfirmCanc] = useState(false);

  // Escolha de fornecedor / sem saldo ao gerar NF Retorno
  const [retornoPrompt, setRetornoPrompt] = useState<{
    mensagem: string;
    fornecedores: FornecedorCnpjOptionDto[];
    requerEscolhaFornecedor: boolean;
    requerConfirmacaoSemSaldo: boolean;
    fornecedorEscolhido?: number;
  } | null>(null);

  // Modal Consultar (cabeçalho + itens / serviços)
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaDetalhe, setConsultaDetalhe] = useState<FilaDetalheDto | null>(null);

  const carregarFila = useCallback(async () => {
    setLoading(true);
    try {
      const d = await obterFilaFaturamento();
      setFila(d);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar fila de faturamento.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!open) return;
    setSelOs([]);
    setSelSolic([]);
    setConfirmCanc(false);
    setRetornoPrompt(null);
    setConsultaOpen(false);
    setConsultaDetalhe(null);
    void carregarFila();
  }, [open, refreshTrigger, carregarFila]);

  if (!open) return null;

  const ordens = fila?.ordensSeparacao ?? [];
  const solicits = fila?.solicitacoesDiversas ?? [];

  const toggleOs = (num: number) => {
    setSelSolic([]);
    setSelOs((prev) => (prev.includes(num) ? [] : [num]));
  };

  const toggleSolic = (num: number) => {
    setSelOs([]);
    setSelSolic((prev) => (prev.includes(num) ? [] : [num]));
  };

  const emitirSelecionado = () => {
    const total = selOs.length + selSolic.length;
    if (total === 0) {
      showToast('Selecione uma Ordem de Separação ou Solicitação para emitir.', 'info');
      return;
    }
    if (total > 1) {
      showToast('Selecione apenas um registro para emissão da NF-e.', 'info');
      return;
    }
    if (selOs.length === 1) {
      onAbrirVendaOs(selOs[0]);
    } else if (selSolic.length === 1) {
      onAbrirDiversa(selSolic[0]);
    }
  };

  const abrirConsulta = async () => {
    if (selOs.length + selSolic.length !== 1) {
      showToast('Selecione apenas um registro para consultar.', 'info');
      return;
    }
    const tipo: 'OS' | 'SOLIC' = selOs.length === 1 ? 'OS' : 'SOLIC';
    const numero = selOs.length === 1 ? selOs[0] : selSolic[0];
    setConsultaOpen(true);
    setConsultaLoading(true);
    setConsultaDetalhe(null);
    try {
      const det = await obterDetalheFilaFaturamento(tipo, numero);
      setConsultaDetalhe(det);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao consultar itens do documento.', 'error');
      setConsultaOpen(false);
    } finally {
      setConsultaLoading(false);
    }
  };

  const executarCancelamentoFila = async () => {
    setProcessando(true);
    try {
      if (selOs.length > 0) {
        const msg = await cancelarItemFilaFaturamento('OS', selOs);
        showToast(msg, 'success');
      } else if (selSolic.length > 0) {
        const msg = await cancelarItemFilaFaturamento('SOLIC', selSolic);
        showToast(msg, 'success');
      }
      setConfirmCanc(false);
      setSelOs([]);
      setSelSolic([]);
      await carregarFila();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cancelar item na fila.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const iniciarRetorno = async (codFornec?: number, semSaldo = false) => {
    if (selOs.length === 0) {
      showToast('Selecione uma ou mais Ordens de Separação para gerar NF Retorno.', 'info');
      return;
    }
    setProcessando(true);
    try {
      const res = await gerarNfRetornoTerceiros(selOs, codFornec, semSaldo);
      if (res.requerEscolhaFornecedor || res.requerConfirmacaoSemSaldo) {
        setRetornoPrompt({
          mensagem: res.mensagem,
          fornecedores: res.fornecedores ?? [],
          requerEscolhaFornecedor: res.requerEscolhaFornecedor,
          requerConfirmacaoSemSaldo: res.requerConfirmacaoSemSaldo,
          fornecedorEscolhido: codFornec ?? res.fornecedores?.[0]?.codigoFornecedor,
        });
        return;
      }
      showToast(res.mensagem, 'success');
      setRetornoPrompt(null);
      await carregarFila();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar solicitação de retorno.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <article className="modal-card modal-card--wide">
          <header className="modal-card__header">
            <h2 id={titleId}>Faturamento — Documentos Pendentes de Emissão</h2>
            <ModalHeaderActions onClose={onClose} disabled={processando} />
          </header>

          <div className="fat-modal-body fat-stack">
            {/* Barra de ações da fila */}
            <div className="fat-fila-toolbar">
              <button
                type="button"
                className="primary-button"
                disabled={processando || loading || selOs.length + selSolic.length !== 1}
                onClick={emitirSelecionado}
              >
                <IoDocumentTextOutline size={16} />
                Emitir NF
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={processando || selOs.length + selSolic.length !== 1}
                onClick={() => void abrirConsulta()}
              >
                <IoEyeOutline size={16} />
                Consultar
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={processando || selOs.length === 0}
                onClick={() => void iniciarRetorno()}
              >
                <IoReturnUpBackOutline size={16} />
                Gerar NF Retorno
              </button>
              <button
                type="button"
                className="secondary-button secondary-button--danger"
                disabled={processando || selOs.length + selSolic.length === 0}
                onClick={() => setConfirmCanc(true)}
              >
                <IoCloseCircleOutline size={16} />
                Cancelar da Fila
              </button>
              <button
                type="button"
                className="icon-button module-action-button"
                disabled={loading}
                onClick={() => void carregarFila()}
                title="Atualizar fila"
                aria-label="Atualizar fila"
              >
                <IoRefreshOutline size={16} />
              </button>
            </div>

            {fila && fila.contingenciaAtual > 1 && (
              <p className="fat-warning-box">{`Atenção: Sistema operando em Modo de Contingência (${fila.contingenciaAtual}).`}</p>
            )}

            {loading ? (
              <p className="module-empty">Carregando fila de faturamento...</p>
            ) : (
              <div className="fat-stack">
                {/* Lista 1: Ordens de Separação */}
                <div className="fat-subpanel">
                  <strong>{`Ordens de Separação (${ordens.length})`}</strong>
                  {ordens.length === 0 ? (
                    <p className="fat-hint-text">Nenhuma Ordem de Separação aguardando faturamento.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Ordens de Separação na fila">
                      <table className="clientes-table fat-table-compact">
                        <thead>
                          <tr>
                            <th>Nº OS</th>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>CFO</th>
                            <th>Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordens.map((os) => {
                            const selected = selOs.includes(os.numSeparacao);
                            return (
                              <tr
                                key={os.numSeparacao}
                                tabIndex={0}
                                aria-selected={selected}
                                onClick={() => toggleOs(os.numSeparacao)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleOs(os.numSeparacao);
                                  }
                                }}
                                className={`fat-row-selectable${selected ? ' fat-row-selected' : ''}`}
                              >
                                <td>
                                  <strong>{String(os.numSeparacao).padStart(6, '0')}</strong>
                                </td>
                                <td>{toBrDateFromIso(os.dataSeparacao)}</td>
                                <td data-no-translate="">{`${os.codigoCliente} - ${os.nomeCliente}`}</td>
                                <td>{os.codigoCfo || '-'}</td>
                                <td>
                                  <StatusBadge label={os.situacaoDescricao} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Lista 2: Solicitações de NF Diversa (Entrada=1 / Saída=2 / Serviço=3) */}
                <div className="fat-subpanel">
                  <strong>{`Solicitações de NF Diversa (${solicits.length})`}</strong>
                  {solicits.length === 0 ? (
                    <p className="fat-hint-text">Nenhuma Solicitação de NF Diversa confirmada na fila.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Solicitações diversas na fila">
                      <table className="clientes-table fat-table-compact">
                        <thead>
                          <tr>
                            <th>Nº Solic.</th>
                            <th>Data</th>
                            <th>Operação</th>
                            <th>Destinatário</th>
                            <th>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {solicits.map((s) => {
                            const selected = selSolic.includes(s.numSolicitacao);
                            return (
                              <tr
                                key={s.numSolicitacao}
                                tabIndex={0}
                                aria-selected={selected}
                                onClick={() => toggleSolic(s.numSolicitacao)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleSolic(s.numSolicitacao);
                                  }
                                }}
                                className={`fat-row-selectable${selected ? ' fat-row-selected' : ''}`}
                              >
                                <td>
                                  <strong>{String(s.numSolicitacao).padStart(6, '0')}</strong>
                                </td>
                                <td>{toBrDateFromIso(s.dataSolicitacao)}</td>
                                <td>
                                  <StatusBadge label={s.entradaSaidaDescricao} />
                                </td>
                                <td data-no-translate="">{`${s.tipoDestinatario} ${s.codigoDestinatario} - ${s.nomeDestinatario}`}</td>
                                <td data-no-translate="">{s.motivoSolicitacao || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt Gerar NF Retorno (escolha fornecedor / sem saldo) */}
            {retornoPrompt && (
              <div className="fat-warning-box fat-stack">
                <p>{retornoPrompt.mensagem}</p>
                {retornoPrompt.fornecedores.length > 0 && (
                  <div className="form-grid-2">
                    <label className="form-grid-2__full">
                      <span>Selecione o Fornecedor para Retorno</span>
                      <select
                        value={retornoPrompt.fornecedorEscolhido ?? ''}
                        onChange={(e) =>
                          setRetornoPrompt((prev) =>
                            prev ? { ...prev, fornecedorEscolhido: Number(e.target.value) } : null,
                          )
                        }
                      >
                        {retornoPrompt.fornecedores.map((f) => (
                          <option key={f.codigoFornecedor} value={f.codigoFornecedor}>
                            {`${f.codigoFornecedor} - ${f.nomeFantasia} (${f.numCgc || ''})`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="fat-fila-toolbar">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={processando}
                    onClick={() =>
                      void iniciarRetorno(retornoPrompt.fornecedorEscolhido, retornoPrompt.requerConfirmacaoSemSaldo)
                    }
                  >
                    {processando ? 'Gerando...' : 'Sim, gerar solicitação de retorno'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setRetornoPrompt(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Confirmação Cancelar da Fila */}
            {confirmCanc && (
              <div className="fat-warning-box fat-stack">
                <p>
                  {selOs.length > 0
                    ? `Deseja cancelar a(s) Ordem(ns) de Separação selecionada(s) (${selOs.join(', ')})?`
                    : `Deseja cancelar a(s) Solicitação(ões) selecionada(s) (${selSolic.join(', ')})?`}
                </p>
                <div className="fat-fila-toolbar">
                  <button
                    type="button"
                    className="primary-button primary-button--danger"
                    disabled={processando}
                    onClick={() => void executarCancelamentoFila()}
                  >
                    {processando ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setConfirmCanc(false)}>
                    Não
                  </button>
                </div>
              </div>
            )}
          </div>

          <footer className="modal-card__footer">
            <button type="button" className="secondary-button modal-card__close" onClick={onClose} disabled={processando}>
              Fechar
            </button>
          </footer>
        </article>
      </section>

      {/* Modal Consultar Documento + Itens / Serviços */}
      {consultaOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={consultaTitleId}>
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2 id={consultaTitleId}>{consultaDetalhe?.titulo || 'Consulta do Documento'}</h2>
              <ModalHeaderActions onClose={() => setConsultaOpen(false)} />
            </header>

            <div className="fat-modal-body fat-stack">
              {consultaLoading ? (
                <p className="module-empty">Carregando itens e detalhes...</p>
              ) : !consultaDetalhe ? (
                <p className="module-empty">Documento não encontrado.</p>
              ) : (
                <>
                  <div className="form-grid-3 fat-subpanel">
                    {consultaDetalhe.campos.map((c) => (
                      <div key={c.value} className="fat-kv">
                        <small>{c.value}</small>
                        <span data-no-translate="">{c.label}</span>
                      </div>
                    ))}
                  </div>

                  {consultaDetalhe.itens.length > 0 && (
                    <div className="fat-subpanel">
                      <strong>{`Itens (${consultaDetalhe.itens.length})`}</strong>
                      <div className="table-scroll" tabIndex={0} role="region" aria-label="Itens do documento selecionado">
                        <table className="clientes-table fat-table-compact">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Material</th>
                              <th>Qtd</th>
                              <th>Unid</th>
                              <th>Unitário</th>
                              <th>Total</th>
                              <th>Lote / Ref.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consultaDetalhe.itens.map((it) => (
                              <tr key={it.numItem}>
                                <td>{it.numItem}</td>
                                <td data-no-translate="">
                                  <strong>{it.codigoMaterial}</strong>
                                  <div className="fat-cell-sub">{it.descricaoMaterial || '-'}</div>
                                </td>
                                <td>{it.qtd}</td>
                                <td>{it.unidMedida || '-'}</td>
                                <td>{formatCurrencyBr(it.valorUnitario)}</td>
                                <td>{formatCurrencyBr(it.valorTotal)}</td>
                                <td data-no-translate="">{it.codigoLote || it.observacao || it.codigoFiscal || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {consultaDetalhe.servicos.length > 0 && (
                    <div className="fat-subpanel">
                      <strong>{`Serviços (${consultaDetalhe.servicos.length})`}</strong>
                      <div className="table-scroll" tabIndex={0} role="region" aria-label="Serviços do documento">
                        <table className="clientes-table fat-table-compact">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Descrição do Serviço</th>
                              <th>Qtd</th>
                              <th>Unitário</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consultaDetalhe.servicos.map((s) => (
                              <tr key={s.numItem}>
                                <td>{s.numItem}</td>
                                <td data-no-translate="">{s.descricaoServico}</td>
                                <td>{s.qtdServico}</td>
                                <td>{formatCurrencyBr(s.valorUnitario)}</td>
                                <td>{formatCurrencyBr(s.valorTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="modal-card__footer">
              <button type="button" className="secondary-button modal-card__close" onClick={() => setConsultaOpen(false)}>
                Fechar
              </button>
            </footer>
          </article>
        </section>
      )}
    </>
  );
}
