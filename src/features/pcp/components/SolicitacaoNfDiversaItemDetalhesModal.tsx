import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoAddOutline,
  IoBarcodeOutline,
  IoCheckmarkDoneOutline,
  IoCubeOutline,
  IoLockClosedOutline,
  IoRefreshOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import {
  adicionarBloqueioItemSolicitacaoNfDiversa,
  excluirBloqueioItemSolicitacaoNfDiversa,
  excluirDetalheItemSolicitacaoNfDiversa,
  formatNumberBr,
  incluirSeriaisItemSolicitacaoNfDiversa,
  listarSeriaisDisponiveisItemSolicitacaoNfDiversa,
  obterBloqueiosItemSolicitacaoNfDiversa,
  obterDetalhesItemSolicitacaoNfDiversa,
  parseDecimalInput,
  toBrDateFromIso,
  type SolicitacaoNfDiversaBloqueiosResponse,
  type SolicitacaoNfDiversaDetalhe,
  type SolicitacaoNfDiversaItem,
  type SolicitacaoNfDiversaItemDetalhe,
  type SolicitacaoNfDiversaSerialDisponivel,
} from '../../../services/solicitacaoNfDiversaApi';

type SolicitacaoNfDiversaItemDetalhesModalProps = {
  open: boolean;
  numSolicitacao: number;
  item: SolicitacaoNfDiversaItem | null;
  somenteLeitura: boolean;
  onClose: () => void;
  onDetalheAtualizado: (detalhe: SolicitacaoNfDiversaDetalhe) => void;
};

export function SolicitacaoNfDiversaItemDetalhesModal({
  open,
  numSolicitacao,
  item,
  somenteLeitura,
  onClose,
  onDetalheAtualizado,
}: SolicitacaoNfDiversaItemDetalhesModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Detalhes (embalagens e seriais vinculados ao item)
  const [detalhes, setDetalhes] = useState<SolicitacaoNfDiversaItemDetalhe[]>([]);

  // Seriais: scan e seleção em lote
  const [scanSerial, setScanSerial] = useState('');
  const [mostrarSeletorSeriais, setMostrarSeletorSeriais] = useState(false);
  const [seriaisDisponiveis, setSeriaisDisponiveis] = useState<SolicitacaoNfDiversaSerialDisponivel[]>([]);
  const [buscaSerial, setBuscaSerial] = useState('');
  const [seriaisMarcados, setSeriaisMarcados] = useState<string[]>([]);

  // Bloqueios (Situação)
  const [bloqueiosResp, setBloqueiosResp] = useState<SolicitacaoNfDiversaBloqueiosResponse | null>(null);
  const [qtdPorBloqueio, setQtdPorBloqueio] = useState<Record<number, string>>({});

  // Confirmação de estorno de embalagem compartilhada
  const [confirmEstorno, setConfirmEstorno] = useState<{
    numDetalhe: number;
    mensagem: string;
  } | null>(null);

  const tipoDetalhe = item?.tipoDetalhe ?? 'nenhum';

  const carregarDados = useCallback(async () => {
    if (!open || !item) return;
    setLoading(true);
    try {
      if (tipoDetalhe === 'situacao') {
        const resp = await obterBloqueiosItemSolicitacaoNfDiversa(numSolicitacao, item.numItem);
        setBloqueiosResp(resp);
        const iniciais: Record<number, string> = {};
        for (const b of resp.disponiveis) {
          if (b.saldoRestanteItem > 0) {
            iniciais[b.numSituacao] = String(b.saldoRestanteItem).replace('.', ',');
          }
        }
        setQtdPorBloqueio(iniciais);
      } else {
        const dets = await obterDetalhesItemSolicitacaoNfDiversa(numSolicitacao, item.numItem);
        setDetalhes(dets);
        if (tipoDetalhe === 'serial' && !somenteLeitura) {
          const disp = await listarSeriaisDisponiveisItemSolicitacaoNfDiversa(numSolicitacao, item.numItem);
          setSeriaisDisponiveis(disp);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar detalhes do item.', 'error');
    } finally {
      setLoading(false);
    }
  }, [open, item, tipoDetalhe, numSolicitacao, somenteLeitura, showToast]);

  useEffect(() => {
    if (!open) return;
    setScanSerial('');
    setBuscaSerial('');
    setSeriaisMarcados([]);
    setMostrarSeletorSeriais(false);
    setConfirmEstorno(null);
    void carregarDados();
  }, [open, carregarDados]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processando) {
        if (confirmEstorno) {
          setConfirmEstorno(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, processando, confirmEstorno, onClose]);

  const seriaisDisponiveisFiltrados = useMemo(() => {
    const termo = buscaSerial.trim().toLowerCase();
    return seriaisDisponiveis.filter((s) => {
      if (s.jaSelecionado) return false;
      if (!termo) return true;
      return (
        s.numSerial.toLowerCase().includes(termo) ||
        (s.enderecoLocal || '').toLowerCase().includes(termo)
      );
    });
  }, [seriaisDisponiveis, buscaSerial]);

  if (!open || !item) return null;

  const tituloModal =
    tipoDetalhe === 'situacao'
      ? 'Selecionar bloqueios do item'
      : tipoDetalhe === 'serial'
        ? 'Seriais do item'
        : 'Embalagens do item';

  const handleIncluirScanSerial = async () => {
    const codigo = scanSerial.trim();
    if (!codigo) {
      showToast('Informe ou leia o código do serial.', 'error');
      return;
    }
    setProcessando(true);
    try {
      const res = await incluirSeriaisItemSolicitacaoNfDiversa(numSolicitacao, item.numItem, {
        scanCodigo: codigo,
      });
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível incluir o serial.', 'error');
        return;
      }
      showToast(res.mensagem || 'Serial incluído com sucesso.', 'success');
      setScanSerial('');
      if (res.detalhe) onDetalheAtualizado(res.detalhe);
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao incluir serial.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handleIncluirSeriaisSelecionados = async () => {
    if (seriaisMarcados.length === 0) {
      showToast('Selecione ao menos um serial disponível.', 'error');
      return;
    }
    setProcessando(true);
    try {
      const res = await incluirSeriaisItemSolicitacaoNfDiversa(numSolicitacao, item.numItem, {
        seriais: seriaisMarcados,
      });
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível incluir os seriais selecionados.', 'error');
        return;
      }
      showToast(res.mensagem || 'Seriais incluídos com sucesso.', 'success');
      setSeriaisMarcados([]);
      setMostrarSeletorSeriais(false);
      if (res.detalhe) onDetalheAtualizado(res.detalhe);
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao incluir seriais.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handleExcluirDetalhe = async (numDetalhe: number, confirmarEstorno = false) => {
    setProcessando(true);
    try {
      const res = await excluirDetalheItemSolicitacaoNfDiversa(
        numSolicitacao,
        item.numItem,
        numDetalhe,
        confirmarEstorno,
      );
      if (!res.sucesso && res.codigoConfirmacao === 'CONFIRMAR_ESTORNO_EMBALAGEM') {
        setConfirmEstorno({ numDetalhe, mensagem: res.mensagem });
        return;
      }
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível remover o detalhe.', 'error');
        return;
      }
      setConfirmEstorno(null);
      showToast(res.mensagem || 'Detalhe removido com sucesso.', 'success');
      if (res.detalhe) onDetalheAtualizado(res.detalhe);
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao remover detalhe.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handleAdicionarBloqueio = async (numSituacao: number) => {
    const raw = qtdPorBloqueio[numSituacao] ?? '';
    const qtd = parseDecimalInput(raw);
    if (qtd === null || qtd <= 0) {
      showToast('Informe uma quantidade válida para o bloqueio.', 'error');
      return;
    }
    setProcessando(true);
    try {
      const res = await adicionarBloqueioItemSolicitacaoNfDiversa(numSolicitacao, item.numItem, numSituacao, qtd);
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível adicionar o bloqueio.', 'error');
        return;
      }
      showToast(res.mensagem || 'Bloqueio adicionado.', 'success');
      if (res.detalhe) onDetalheAtualizado(res.detalhe);
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao adicionar bloqueio.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const handleExcluirBloqueio = async (numSituacao: number) => {
    setProcessando(true);
    try {
      const res = await excluirBloqueioItemSolicitacaoNfDiversa(numSolicitacao, item.numItem, numSituacao);
      if (!res.sucesso) {
        showToast(res.mensagem || 'Não foi possível remover o bloqueio.', 'error');
        return;
      }
      showToast(res.mensagem || 'Bloqueio removido.', 'success');
      if (res.detalhe) onDetalheAtualizado(res.detalhe);
      await carregarDados();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao remover bloqueio.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const toggleSerialMarcado = (numSerial: string) => {
    setSeriaisMarcados((prev) =>
      prev.includes(numSerial) ? prev.filter((s) => s !== numSerial) : [...prev, numSerial],
    );
  };

  const handleFecharComAvisoBloqueio = () => {
    if (tipoDetalhe === 'situacao' && bloqueiosResp) {
      if (bloqueiosResp.totalSelecionado > bloqueiosResp.qtdItem) {
        showToast('O total selecionado é superior a quantidade da solicitação!', 'error');
        return;
      }
      if (bloqueiosResp.totalSelecionado < bloqueiosResp.qtdItem && !somenteLeitura) {
        showToast('Atenção: o total de bloqueios selecionado ainda é menor que a quantidade do item.', 'info');
      }
    }
    onClose();
  };

  return (
    <section
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snfd-detalhe-item-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processando) {
          handleFecharComAvisoBloqueio();
        }
      }}
    >
      <article className="modal-card modal-card--wide">
        <header className="modal-card__header">
          <div>
            <h2 id="snfd-detalhe-item-title">{tituloModal}</h2>
            <p className="snfd-modal-subtitle">
              {`Item ${item.numItem} — ${item.codigoMaterial} (${item.descricaoExibida || item.descricaoMaterial}) · Lote: ${item.codigoLote || '-'} · Qtd.: ${formatNumberBr(item.qtdMaterial)} ${item.unidMedida || ''}`}
            </p>
          </div>
          <ModalHeaderActions onClose={handleFecharComAvisoBloqueio} disabled={processando} />
        </header>

        <div className="snfd-modal-content">
          {loading ? (
            <p className="module-empty">Carregando informações do item...</p>
          ) : tipoDetalhe === 'situacao' && bloqueiosResp ? (
            <div className="snfd-detalhe-stack">
              <div className="snfd-resumo-strip">
                <span>
                  <strong>Quantidade do item:</strong> {formatNumberBr(bloqueiosResp.qtdItem)}{' '}
                  {bloqueiosResp.unidMedidaItem || ''}
                </span>
                <span>
                  <strong>Total selecionado:</strong> {formatNumberBr(bloqueiosResp.totalSelecionado)}{' '}
                  {bloqueiosResp.unidMedidaItem || ''}
                </span>
                <span>
                  <strong>Fator conversão:</strong> {formatNumberBr(bloqueiosResp.fatorConversao, 4)} (
                  {bloqueiosResp.unidMedEstq || '-'} → {bloqueiosResp.unidMedidaItem || '-'})
                </span>
                <StatusBadge
                  label={
                    bloqueiosResp.totalSelecionado === bloqueiosResp.qtdItem
                      ? 'Completo'
                      : bloqueiosResp.totalSelecionado > bloqueiosResp.qtdItem
                        ? 'Excedido'
                        : 'Parcial'
                  }
                />
              </div>

              {!somenteLeitura ? (
                <div>
                  <h3 className="snfd-section-title">
                    <IoLockClosedOutline size={16} aria-hidden="true" /> Bloqueios disponíveis no estoque
                  </h3>
                  {bloqueiosResp.disponiveis.length === 0 ? (
                    <p className="module-empty">Nenhum registro de estoque bloqueado encontrado para este material e lote.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Bloqueios disponíveis">
                      <table className="clientes-table">
                        <thead>
                          <tr>
                            <th>Situação</th>
                            <th>Data</th>
                            <th>Local</th>
                            <th>Motivo</th>
                            <th>{`Saldo (${bloqueiosResp.unidMedidaItem || ''})`}</th>
                            <th>Restante</th>
                            <th>Quantidade</th>
                            <th>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bloqueiosResp.disponiveis.map((b) => (
                            <tr key={b.numSituacao}>
                              <td>#{b.numSituacao}</td>
                              <td>{toBrDateFromIso(b.dataSituacao)}</td>
                              <td>{b.enderecoLocal || b.codigoLocal}</td>
                              <td>{b.descricaoMotivo || '-'}</td>
                              <td>{formatNumberBr(b.saldoUnidadeItem)}</td>
                              <td>{formatNumberBr(b.saldoRestanteItem)}</td>
                              <td>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  aria-label={`Quantidade do bloqueio ${b.numSituacao}`}
                                  value={qtdPorBloqueio[b.numSituacao] ?? ''}
                                  onChange={(e) =>
                                    setQtdPorBloqueio((prev) => ({ ...prev, [b.numSituacao]: e.target.value }))
                                  }
                                  disabled={processando || b.saldoRestanteItem <= 0}
                                  className="snfd-table-input"
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => void handleAdicionarBloqueio(b.numSituacao)}
                                  disabled={processando || b.saldoRestanteItem <= 0}
                                  title="Adicionar bloqueio"
                                  aria-label="Adicionar bloqueio"
                                >
                                  <IoAddOutline size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <h3 className="snfd-section-title">Bloqueios selecionados neste item</h3>
                {bloqueiosResp.selecionados.length === 0 ? (
                  <p className="module-empty">Nenhum bloqueio selecionado até o momento.</p>
                ) : (
                  <div className="table-scroll" tabIndex={0} role="region" aria-label="Bloqueios selecionados">
                    <table className="clientes-table">
                      <thead>
                        <tr>
                          <th>Situação</th>
                          <th>Data</th>
                          <th>Local</th>
                          <th>Motivo</th>
                          <th>{`Quantidade (${bloqueiosResp.unidMedidaItem || ''})`}</th>
                          {!somenteLeitura ? <th>Ação</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {bloqueiosResp.selecionados.map((s) => (
                          <tr key={s.numSituacao}>
                            <td>#{s.numSituacao}</td>
                            <td>{toBrDateFromIso(s.dataSituacao)}</td>
                            <td>{s.enderecoLocal || s.codigoLocal}</td>
                            <td>{s.descricaoMotivo || '-'}</td>
                            <td>{formatNumberBr(s.qtdSituacao)}</td>
                            {!somenteLeitura ? (
                              <td>
                                <button
                                  type="button"
                                  className="icon-button icon-button--danger"
                                  onClick={() => void handleExcluirBloqueio(s.numSituacao)}
                                  disabled={processando}
                                  title="Remover bloqueio"
                                  aria-label="Remover bloqueio"
                                >
                                  <IoTrashOutline size={16} />
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : tipoDetalhe === 'serial' ? (
            <div className="snfd-detalhe-stack">
              {!somenteLeitura ? (
                <div className="snfd-scan-bar">
                  <div className="snfd-scan-bar__field">
                    <label htmlFor="snfd-scan-serial">Ler ou digitar serial</label>
                    <input
                      id="snfd-scan-serial"
                      type="text"
                      value={scanSerial}
                      onChange={(e) => setScanSerial(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void handleIncluirScanSerial();
                        }
                      }}
                      placeholder="Bipe a etiqueta ou informe o número do serial..."
                      disabled={processando}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="snfd-scan-bar__actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleIncluirScanSerial()}
                      disabled={processando}
                    >
                      <IoBarcodeOutline size={16} /> Incluir serial
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setMostrarSeletorSeriais((prev) => !prev)}
                      disabled={processando}
                    >
                      <IoCheckmarkDoneOutline size={16} />{' '}
                      {mostrarSeletorSeriais ? 'Ocultar lista do estoque' : 'Selecionar do estoque'}
                    </button>
                  </div>
                </div>
              ) : null}

              {mostrarSeletorSeriais && !somenteLeitura ? (
                <div className="snfd-subbox">
                  <div className="snfd-subbox__head">
                    <strong>{`Seriais disponíveis no estoque (${seriaisDisponiveisFiltrados.length})`}</strong>
                    <div className="snfd-subbox__controls">
                      <input
                        type="search"
                        value={buscaSerial}
                        onChange={(e) => setBuscaSerial(e.target.value)}
                        placeholder="Filtrar serial ou local..."
                        aria-label="Filtrar seriais disponíveis"
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleIncluirSeriaisSelecionados()}
                        disabled={processando || seriaisMarcados.length === 0}
                      >
                        {`Adicionar selecionados (${seriaisMarcados.length})`}
                      </button>
                    </div>
                  </div>
                  {seriaisDisponiveisFiltrados.length === 0 ? (
                    <p className="module-empty">Nenhum serial disponível fora de embalagens para este lote.</p>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Seriais disponíveis no estoque">
                      <table className="clientes-table">
                        <thead>
                          <tr>
                            <th>Sel.</th>
                            <th>Serial</th>
                            <th>Lote</th>
                            <th>Local</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seriaisDisponiveisFiltrados.map((s) => (
                            <tr key={s.numSerial}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={seriaisMarcados.includes(s.numSerial)}
                                  onChange={() => toggleSerialMarcado(s.numSerial)}
                                  aria-label={`Selecionar serial ${s.numSerial}`}
                                />
                              </td>
                              <td>{s.numSerial}</td>
                              <td>{s.codigoLote}</td>
                              <td>{s.enderecoLocal || s.codigoLocal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <h3 className="snfd-section-title">{`Seriais vinculados ao item (${detalhes.length})`}</h3>
                {detalhes.length === 0 ? (
                  <p className="module-empty">Nenhum serial vinculado a este item.</p>
                ) : (
                  <div className="table-scroll" tabIndex={0} role="region" aria-label="Seriais vinculados">
                    <table className="clientes-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Serial</th>
                          <th>Origem</th>
                          <th>Embalagem / Pallet</th>
                          {!somenteLeitura ? <th>Ação</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {detalhes.map((d) => (
                          <tr key={d.numDetalhe}>
                            <td>{d.numDetalhe}</td>
                            <td>{d.numSerial || '-'}</td>
                            <td>{d.tipoEmbalagemDescricao || 'Serial avulso'}</td>
                            <td>
                              {d.serialEmbalagem
                                ? `${d.serialEmbalagem}${d.serialPallet ? ` (Pallet ${d.serialPallet})` : ''}`
                                : '-'}
                            </td>
                            {!somenteLeitura ? (
                              <td>
                                <button
                                  type="button"
                                  className="icon-button icon-button--danger"
                                  onClick={() => void handleExcluirDetalhe(d.numDetalhe)}
                                  disabled={processando}
                                  title="Remover serial"
                                  aria-label="Remover serial"
                                >
                                  <IoTrashOutline size={16} />
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="snfd-detalhe-stack">
              <h3 className="snfd-section-title">
                <IoCubeOutline size={16} aria-hidden="true" /> {`Embalagens vinculadas (${detalhes.length})`}
              </h3>
              {detalhes.length === 0 ? (
                <p className="module-empty">
                  Nenhuma embalagem vinculada a este item. Utilize a barra de inclusão de Pallet/Caixa na aba Itens.
                </p>
              ) : (
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Embalagens vinculadas">
                  <table className="clientes-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tipo</th>
                        <th>Embalagem</th>
                        <th>Pallet</th>
                        <th>Qtd.</th>
                        <th>Unid.</th>
                        <th>Serial</th>
                        {!somenteLeitura ? <th>Ação</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detalhes.map((d) => (
                        <tr key={d.numDetalhe}>
                          <td>{d.numDetalhe}</td>
                          <td>{d.tipoEmbalagemDescricao || '-'}</td>
                          <td>{d.serialEmbalagem || d.numEmbalagem || '-'}</td>
                          <td>{d.serialPallet || '-'}</td>
                          <td>{d.qtdProduto != null ? formatNumberBr(d.qtdProduto) : '-'}</td>
                          <td>{d.unidMedida || '-'}</td>
                          <td>{d.numSerial || '-'}</td>
                          {!somenteLeitura ? (
                            <td>
                              <button
                                type="button"
                                className="icon-button icon-button--danger"
                                onClick={() => void handleExcluirDetalhe(d.numDetalhe)}
                                disabled={processando}
                                title="Remover embalagem"
                                aria-label={`Remover embalagem ${d.serialEmbalagem || d.numDetalhe}`}
                              >
                                <IoTrashOutline size={16} />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {confirmEstorno ? (
            <div className="snfd-confirm-inline" role="alert">
              <p>{confirmEstorno.mensagem}</p>
              <div className="snfd-confirm-inline__actions">
                <button
                  type="button"
                  className="primary-button primary-button--danger"
                  onClick={() => void handleExcluirDetalhe(confirmEstorno.numDetalhe, true)}
                  disabled={processando}
                >
                  Sim, estornar
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setConfirmEstorno(null)}
                  disabled={processando}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="modal-card__footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void carregarDados()}
            disabled={loading || processando}
          >
            <IoRefreshOutline size={16} /> Atualizar
          </button>
          <button
            type="button"
            className="secondary-button modal-card__close"
            onClick={handleFecharComAvisoBloqueio}
            disabled={processando}
          >
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}
