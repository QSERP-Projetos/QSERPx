import { useState } from 'react';
import {
  IoCardOutline,
  IoCloudDownloadOutline,
  IoDocumentTextOutline,
  IoReceiptOutline,
  IoTrendingUpOutline,
} from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../contexts/ToastContext';
import {
  solicitarApuracao,
  type ResumoApuracaoCbsDto,
  type SolicitacaoApuracaoDto,
  type TipoApuracaoCbs,
} from '../../../services/apuracaoReformaApi';

type ApuracaoNovaSolicitacaoModalProps = {
  open: boolean;
  configurado: boolean;
  resumo: ResumoApuracaoCbsDto | null;
  onClose: () => void;
  onOpenCredenciais: () => void;
  onSolicitado: (solicitacao: SolicitacaoApuracaoDto) => void;
};

type ApiCatalogItem = {
  tipo: TipoApuracaoCbs;
  titulo: string;
  descricao: string;
  Icon: typeof IoDocumentTextOutline;
};

const API_CATALOG: ApiCatalogItem[] = [
  {
    tipo: 'DEBITOS',
    titulo: 'Débitos de CBS',
    descricao:
      'Operações com débito apurado, devido, exigível e acompanhado desde a última consulta (janela de até 8 dias).',
    Icon: IoDocumentTextOutline,
  },
  {
    tipo: 'CREDITOS',
    titulo: 'Créditos de CBS',
    descricao:
      'Créditos apropriáveis, apropriados, utilizados (PCONT/RAD/incondicionado) e saldos remanescentes.',
    Icon: IoTrendingUpOutline,
  },
  {
    tipo: 'PAGAMENTOS',
    titulo: 'Pagamentos (PCONT e RAD)',
    descricao:
      'Pagamentos próprios e recolhimentos de adquirentes que extinguem os débitos de CBS do contribuinte.',
    Icon: IoCardOutline,
  },
  {
    tipo: 'RECOLHIMENTOS',
    titulo: 'Recolhimentos como Adquirente (RAD)',
    descricao:
      'Recolhimentos efetuados como adquirente que extinguem débitos de fornecedores e geram créditos.',
    Icon: IoReceiptOutline,
  },
];

export function ApuracaoNovaSolicitacaoModal({
  open,
  configurado,
  resumo,
  onClose,
  onOpenCredenciais,
  onSolicitado,
}: ApuracaoNovaSolicitacaoModalProps) {
  const { showToast } = useToast();
  const [loadingTipo, setLoadingTipo] = useState<TipoApuracaoCbs | null>(null);

  if (!open) return null;

  const limiteDiario = resumo?.limiteDiarioPorApi ?? 4;

  const handleSolicitar = async (tipo: TipoApuracaoCbs) => {
    setLoadingTipo(tipo);
    try {
      const { data, message } = await solicitarApuracao(tipo);
      showToast(message || `Solicitação de ${tipo} aberta com sucesso.`, 'success');
      onSolicitado(data);
      onClose();
    } catch (err: any) {
      showToast(err?.message || `Erro ao abrir solicitação de ${tipo}.`, 'error');
    } finally {
      setLoadingTipo(null);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <article
        className="modal-card apuracao-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apuracao-nova-solicitacao-title"
      >
        <header className="modal-card__header">
          <div>
            <h2 id="apuracao-nova-solicitacao-title">Nova Solicitação à Receita Federal (v2)</h2>
            <p className="apuracao-modal-subtitle">
              Abertura assíncrona sem webhook — gera o tíquete e acompanha automaticamente a cada 5 minutos.
            </p>
          </div>
          <ModalHeaderActions onClose={onClose} disabled={loadingTipo !== null} />
        </header>

        <div className="modal-body apuracao-modal-stack">
          {!configurado ? (
            <div className="apuracao-alert apuracao-alert--warning">
              <p>
                As credenciais da Receita Federal (Client ID / Client Secret) ainda não estão configuradas para
                esta empresa.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  onClose();
                  onOpenCredenciais();
                }}
              >
                Configurar credenciais
              </button>
            </div>
          ) : null}

          <div className="apuracao-quota-grid">
            {API_CATALOG.map(({ tipo, titulo, descricao, Icon }) => {
              const usadas = Number(resumo?.chamadasHojePorTipo?.[tipo] ?? 0);
              const esgotado = usadas >= limiteDiario;
              const isLoading = loadingTipo === tipo;

              return (
                <div key={tipo} className="apuracao-quota-card">
                  <div className="apuracao-quota-card__top">
                    <div className="apuracao-quota-card__title">
                      <Icon size={18} />
                      <strong>{titulo}</strong>
                    </div>
                    <StatusBadge
                      tone={esgotado ? 'danger' : usadas > 0 ? 'warning' : 'success'}
                      label={`${usadas} / ${limiteDiario} hoje`}
                    />
                  </div>
                  <p className="apuracao-quota-card__desc">{descricao}</p>
                  <div className="apuracao-quota-card__actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!configurado || esgotado || loadingTipo !== null}
                      onClick={() => void handleSolicitar(tipo)}
                    >
                      <IoCloudDownloadOutline size={16} />
                      {isLoading ? 'Solicitando...' : esgotado ? 'Limite diário atingido' : 'Solicitar agora'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="apuracao-helper">
            A Receita Federal permite até 4 aberturas por dia por API. A consulta de situação do tíquete não
            consome esse limite diário, e os arquivos concluídos permanecem salvos no banco do ERP após a
            validade de 48h na RFB.
          </p>
        </div>

        <footer className="modal-card__footer">
          <button
            type="button"
            className="secondary-button modal-card__close"
            onClick={onClose}
            disabled={loadingTipo !== null}
          >
            Fechar
          </button>
        </footer>
      </article>
    </div>
  );
}
