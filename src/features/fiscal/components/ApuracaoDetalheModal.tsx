import { useEffect, useState } from 'react';
import {
  IoCloudDownloadOutline,
  IoCopyOutline,
  IoRefreshOutline,
  IoSyncOutline,
} from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { useToast } from '../../../contexts/ToastContext';
import {
  baixarSolicitacao,
  consultarSituacaoSolicitacao,
  formatDateTimeBr,
  obterJsonSolicitacao,
  reprocessarSolicitacao,
  type ApuracaoCreditoItemDto,
  type ApuracaoDebitoItemDto,
  type ApuracaoPagamentoItemDto,
  type ApuracaoRecolhimentoItemDto,
  type SolicitacaoApuracaoDto,
} from '../../../services/apuracaoReformaApi';
import { formatCurrencyBr, formatDecimal, toBrDateFromIso } from '../../../services/faturamentoApi';

export type DetalheModalState =
  | { tipo: 'SOLICITACAO'; item: SolicitacaoApuracaoDto }
  | { tipo: 'DEBITO'; item: ApuracaoDebitoItemDto }
  | { tipo: 'CREDITO'; item: ApuracaoCreditoItemDto }
  | { tipo: 'PAGAMENTO'; item: ApuracaoPagamentoItemDto }
  | { tipo: 'RECOLHIMENTO'; item: ApuracaoRecolhimentoItemDto }
  | null;

type ApuracaoDetalheModalProps = {
  detalhe: DetalheModalState;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

const formatarJson = (raw?: string | null): string => {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

export function ApuracaoDetalheModal({ detalhe, onClose, onRefresh }: ApuracaoDetalheModalProps) {
  const { showToast } = useToast();
  const [jsonTexto, setJsonTexto] = useState('');
  const [loadingJson, setLoadingJson] = useState(false);
  const [executando, setExecutando] = useState(false);

  useEffect(() => {
    if (!detalhe) {
      setJsonTexto('');
      return;
    }

    if (detalhe.tipo === 'SOLICITACAO') {
      if (!detalhe.item.temJson) {
        setJsonTexto('');
        return;
      }
      setLoadingJson(true);
      void obterJsonSolicitacao(detalhe.item.id)
        .then((raw) => setJsonTexto(formatarJson(raw)))
        .catch(() => setJsonTexto(''))
        .finally(() => setLoadingJson(false));
      return;
    }

    setJsonTexto(formatarJson(detalhe.item.payloadJson));
  }, [detalhe]);

  if (!detalhe) return null;

  const handleCopiarJson = async () => {
    if (!jsonTexto) return;
    try {
      await navigator.clipboard.writeText(jsonTexto);
      showToast('JSON copiado para a área de transferência.', 'success');
    } catch {
      showToast('Não foi possível copiar o JSON automaticamente.', 'error');
    }
  };

  const handleAcaoSolicitacao = async (acao: 'consultar' | 'baixar' | 'reprocessar') => {
    if (detalhe.tipo !== 'SOLICITACAO') return;
    setExecutando(true);
    try {
      const resp =
        acao === 'consultar'
          ? await consultarSituacaoSolicitacao(detalhe.item.id, true)
          : acao === 'baixar'
            ? await baixarSolicitacao(detalhe.item.id)
            : await reprocessarSolicitacao(detalhe.item.id);
      showToast(resp.message, 'success');
      await onRefresh();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao executar ação na solicitação.', 'error');
    } finally {
      setExecutando(false);
    }
  };

  const renderCampos = () => {
    switch (detalhe.tipo) {
      case 'SOLICITACAO': {
        const s = detalhe.item;
        return (
          <div className="form-grid-3">
            <div className="fat-kv">
              <small>Solicitação</small>
              <strong>#{s.id} • {s.tipoApuracao}</strong>
            </div>
            <div className="fat-kv">
              <small>Situação RFB</small>
              <strong>{s.situacao}</strong>
            </div>
            <div className="fat-kv">
              <small>Tíquete</small>
              <strong>{s.tiqueteSolicitacao || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Solicitado em</small>
              <strong>{formatDateTimeBr(s.dataSolicitacao)}</strong>
            </div>
            <div className="fat-kv">
              <small>Última consulta</small>
              <strong>{formatDateTimeBr(s.dataUltimaConsulta)}</strong>
            </div>
            <div className="fat-kv">
              <small>Download / Registros</small>
              <strong>{s.downloadRealizado ? `${s.qtdRegistros} registro(s)` : 'Pendente'}</strong>
            </div>
            <div className="fat-kv">
              <small>Período apurado</small>
              <strong>
                {s.periodoIni || s.periodoFim
                  ? `${toBrDateFromIso(s.periodoIni)} a ${toBrDateFromIso(s.periodoFim)}`
                  : '-'}
              </strong>
            </div>
            <div className="fat-kv">
              <small>Expiração 48h RFB</small>
              <strong>{formatDateTimeBr(s.urlAssinadaExpiraEm)}</strong>
            </div>
            <div className="fat-kv">
              <small>Solicitante</small>
              <strong>{s.usuarioSolicitante || '-'}</strong>
            </div>
          </div>
        );
      }
      case 'DEBITO': {
        const d = detalhe.item;
        return (
          <div className="form-grid-3">
            <div className="fat-kv">
              <small>Chave Eletrônica</small>
              <strong>{d.chEletr || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>CST / Operação</small>
              <strong>{d.cst || '-'} • {d.tpOper || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Emissão / Registro</small>
              <strong>{toBrDateFromIso(d.dataEmissao) || '-'} / {toBrDateFromIso(d.dataRegistro) || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Base de Cálculo (vBC)</small>
              <strong>{formatCurrencyBr(d.valorBc)}</strong>
            </div>
            <div className="fat-kv">
              <small>Alíquota (pCBS)</small>
              <strong>{formatDecimal(d.aliqCbs, 4)}%</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Apurada</small>
              <strong>{formatCurrencyBr(d.valorCbsApurado)}</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Devida</small>
              <strong>{formatCurrencyBr(d.valorCbsDevido)}</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Exigível</small>
              <strong>{formatCurrencyBr(d.valorCbsExigivel)}</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Acompanhamento</small>
              <strong>{formatCurrencyBr(d.valorCbsAcompa)}</strong>
            </div>
          </div>
        );
      }
      case 'CREDITO': {
        const c = detalhe.item;
        return (
          <div className="form-grid-3">
            <div className="fat-kv">
              <small>Chave Eletrônica</small>
              <strong>{c.chEletr || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>CST / Operação</small>
              <strong>{c.cst || '-'} • {c.tpOper || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Emissão / Apropriação</small>
              <strong>{toBrDateFromIso(c.dataEmissao) || '-'} / {toBrDateFromIso(c.dataApropriacao) || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Valor Operação / vBC</small>
              <strong>{formatCurrencyBr(c.valorOper)} / {formatCurrencyBr(c.valorBc)}</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Apropriável / Apropriada</small>
              <strong>{formatCurrencyBr(c.valorCbsApropriavel)} / {formatCurrencyBr(c.valorCbsApropriada)}</strong>
            </div>
            <div className="fat-kv">
              <small>Aproveitada / Não Aprov.</small>
              <strong>{formatCurrencyBr(c.valorCbsAprov)} / {formatCurrencyBr(c.valorCbsNaoAprov)}</strong>
            </div>
            <div className="fat-kv">
              <small>CBS Utilizada (Total)</small>
              <strong>{formatCurrencyBr(c.valorCbsUtilizada)}</strong>
            </div>
            <div className="fat-kv">
              <small>Utilizada Anterior / Incond.</small>
              <strong>{formatCurrencyBr(c.valorCbsUtilizadaAnt)} / {formatCurrencyBr(c.valorCbsUtilizadaIncond)}</strong>
            </div>
            <div className="fat-kv">
              <small>Não Utilizada / Anterior</small>
              <strong>{formatCurrencyBr(c.valorCbsNaoUtilizada)} / {formatCurrencyBr(c.valorCbsNaoUtilizadaAnt)}</strong>
            </div>
          </div>
        );
      }
      case 'PAGAMENTO': {
        const p = detalhe.item;
        return (
          <div className="form-grid-3">
            <div className="fat-kv">
              <small>Nº Pagamento / Desmemb.</small>
              <strong>{p.numeroPagamento || '-'} {p.numeroDesmembramento ? `/ ${p.numeroDesmembramento}` : ''}</strong>
            </div>
            <div className="fat-kv">
              <small>Modalidade / Chave</small>
              <strong>{p.tipoPagamento || '-'} • {p.chEletr || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Data Arrecadação</small>
              <strong>{toBrDateFromIso(p.dataArrecadacao) || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Principal</small>
              <strong>{formatCurrencyBr(p.valorPrincipal)}</strong>
            </div>
            <div className="fat-kv">
              <small>Multa / Juros</small>
              <strong>{formatCurrencyBr(p.valorMulta)} / {formatCurrencyBr(p.valorJuros)}</strong>
            </div>
            <div className="fat-kv">
              <small>Total / Utilizado / Saldo</small>
              <strong>
                {formatCurrencyBr(p.valorTotal)} / {formatCurrencyBr(p.valorUtilizado)} / {formatCurrencyBr(p.valorSaldo)}
              </strong>
            </div>
          </div>
        );
      }
      case 'RECOLHIMENTO': {
        const r = detalhe.item;
        return (
          <div className="form-grid-3">
            <div className="fat-kv">
              <small>Nº Pagamento / Desmemb.</small>
              <strong>{r.numeroPagamento || '-'} {r.numeroDesmembramento ? `/ ${r.numeroDesmembramento}` : ''}</strong>
            </div>
            <div className="fat-kv">
              <small>Fornecedor / Chave</small>
              <strong>{r.niFornecedor || '-'} • {r.chEletr || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Data Arrecadação</small>
              <strong>{toBrDateFromIso(r.dataArrecadacao) || '-'}</strong>
            </div>
            <div className="fat-kv">
              <small>Principal</small>
              <strong>{formatCurrencyBr(r.valorPrincipal)}</strong>
            </div>
            <div className="fat-kv">
              <small>Multa / Juros</small>
              <strong>{formatCurrencyBr(r.valorMulta)} / {formatCurrencyBr(r.valorJuros)}</strong>
            </div>
            <div className="fat-kv">
              <small>Total Recolhido / Créd. Aprop.</small>
              <strong>{formatCurrencyBr(r.valorTotal)} / {formatCurrencyBr(r.valorCreditoApropriado)}</strong>
            </div>
          </div>
        );
      }
    }
  };

  const tituloModal =
    detalhe.tipo === 'SOLICITACAO'
      ? `Solicitação #${detalhe.item.id} (${detalhe.item.tipoApuracao})`
      : detalhe.tipo === 'DEBITO'
        ? `Detalhe do Débito #${detalhe.item.id}`
        : detalhe.tipo === 'CREDITO'
          ? `Detalhe do Crédito #${detalhe.item.id}`
          : detalhe.tipo === 'PAGAMENTO'
            ? `Detalhe do Pagamento #${detalhe.item.id}`
            : `Detalhe do Recolhimento RAD #${detalhe.item.id}`;

  return (
    <div className="modal-backdrop" role="presentation">
      <article
        className="modal-card apuracao-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apuracao-detalhe-title"
      >
        <header className="modal-card__header">
          <h2 id="apuracao-detalhe-title">{tituloModal}</h2>
          <ModalHeaderActions onClose={onClose} disabled={executando}>
            {jsonTexto ? (
              <button
                type="button"
                className="icon-button modal-card__header-button"
                onClick={() => void handleCopiarJson()}
                title="Copiar JSON"
                aria-label="Copiar JSON"
              >
                <IoCopyOutline size={18} />
              </button>
            ) : null}
          </ModalHeaderActions>
        </header>

        <div className="modal-body apuracao-modal-stack">
          {renderCampos()}

          {detalhe.tipo === 'SOLICITACAO' && detalhe.item.mensagemErro ? (
            <div className="apuracao-alert apuracao-alert--danger">
              <strong>
                {detalhe.item.codigoErro ? `Erro ${detalhe.item.codigoErro}: ` : 'Mensagem RFB: '}
              </strong>
              <span>{detalhe.item.mensagemErro}</span>
            </div>
          ) : null}

          <div className="apuracao-json-section">
            <span className="field-label">Retorno JSON oficial (RFB)</span>
            {loadingJson ? (
              <p className="module-empty">Carregando JSON salvo...</p>
            ) : jsonTexto ? (
              <pre className="fat-xml-preview">{jsonTexto}</pre>
            ) : (
              <p className="module-empty">Nenhum conteúdo JSON baixado para este registro ainda.</p>
            )}
          </div>
        </div>

        <footer className="modal-card__footer">
          {detalhe.tipo === 'SOLICITACAO' ? (
            <>
              {!detalhe.item.downloadRealizado ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={executando}
                  onClick={() => void handleAcaoSolicitacao('consultar')}
                >
                  <IoSyncOutline size={16} />
                  Consultar situação RFB
                </button>
              ) : null}
              {detalhe.item.situacao === 'CONCLUIDA' && !detalhe.item.downloadRealizado ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={executando}
                  onClick={() => void handleAcaoSolicitacao('baixar')}
                >
                  <IoCloudDownloadOutline size={16} />
                  Baixar e consolidar agora
                </button>
              ) : null}
              {detalhe.item.temJson ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={executando}
                  onClick={() => void handleAcaoSolicitacao('reprocessar')}
                >
                  <IoRefreshOutline size={16} />
                  Reprocessar JSON
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className="secondary-button modal-card__close"
            onClick={onClose}
            disabled={executando}
          >
            Fechar
          </button>
        </footer>
      </article>
    </div>
  );
}
