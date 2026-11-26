import { useEffect, useState } from 'react';
import { IoEyeOffOutline, IoEyeOutline, IoShieldCheckmarkOutline } from 'react-icons/io5';
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';
import {
  salvarCredenciaisApuracao,
  testarAutenticacaoApuracao,
  type CredenciaisApuracaoDto,
} from '../../../services/apuracaoReformaApi';

type ApuracaoCredenciaisModalProps = {
  open: boolean;
  credenciais: CredenciaisApuracaoDto | null;
  onClose: () => void;
  onSaved: (atualizadas: CredenciaisApuracaoDto) => void;
};

const AMBIENTE_OPTIONS = [
  { value: '-1', label: 'Homologação (SERPRO)' },
  { value: '1', label: 'Produção Restrita (RFB)' },
  { value: '0', label: 'Produção (RFB)' },
];

export function ApuracaoCredenciaisModal({
  open,
  credenciais,
  onClose,
  onSaved,
}: ApuracaoCredenciaisModalProps) {
  const { showToast } = useToast();
  const obrig = useRequiredFields();
  const { reset: resetObrig } = obrig;

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [ambiente, setAmbiente] = useState('-1');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(credenciais?.clientId ?? '');
    setClientSecret('');
    setShowSecret(false);
    setAmbiente(String(credenciais?.ambienteHomologacao ?? -1));
    resetObrig();
  }, [open, credenciais, resetObrig]);

  if (!open) return null;

  const secretObrigatorio = !credenciais?.possuiClientSecret;

  const persistirCredenciais = async (): Promise<CredenciaisApuracaoDto | null> => {
    const camposObrigatorios = secretObrigatorio ? [clientId, clientSecret] : [clientId];
    if (!obrig.validate(camposObrigatorios)) {
      showToast(REQUIRED_FIELDS_MESSAGE, 'error');
      return null;
    }

    const atualizadas = await salvarCredenciaisApuracao({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim() || undefined,
      ambienteHomologacao: Number(ambiente),
    });
    onSaved(atualizadas);
    return atualizadas;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await persistirCredenciais();
      if (!ok) return;
      showToast('Credenciais da Receita Federal salvas com sucesso.', 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar credenciais RFB.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestar = async () => {
    setTesting(true);
    try {
      const ok = await persistirCredenciais();
      if (!ok) return;
      const msg = await testarAutenticacaoApuracao();
      showToast(msg, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao testar autenticação na RFB.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const busy = saving || testing;

  return (
    <div className="modal-backdrop" role="presentation">
      <article
        className="modal-card apuracao-modal-medium"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apuracao-credenciais-title"
      >
        <header className="modal-card__header">
          <div>
            <h2 id="apuracao-credenciais-title">Credenciais Receita Federal (CBS v2)</h2>
            <p className="apuracao-modal-subtitle">
              {credenciais?.razaoSocial || 'Empresa selecionada'}
              {credenciais?.cnpjBase ? ` • CNPJ base: ${credenciais.cnpjBase}` : ''}
            </p>
          </div>
          <ModalHeaderActions onClose={onClose} disabled={busy} />
        </header>

        <form className="module-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
          <div className="modal-body apuracao-modal-stack">
            <div className="form-grid-2">
              <label>
                <span>Ambiente RFB *</span>
                <SearchableSelect
                  ariaLabel="Ambiente RFB"
                  value={ambiente}
                  onChange={setAmbiente}
                  options={AMBIENTE_OPTIONS}
                  placeholder="Selecione o ambiente"
                />
              </label>

              <label>
                <span>CNPJ Base (8 dígitos)</span>
                <input
                  type="text"
                  value={credenciais?.cnpjBase || credenciais?.cnpjEmpresa || 'Não informado'}
                  readOnly
                  disabled
                />
              </label>

              <label className="form-grid-2__full">
                <span>Client ID *</span>
                <input
                  type="text"
                  name="rfb_client_id"
                  autoComplete="off"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Informe o Client ID gerado no portal da RFB"
                  className={obrig.inputClass(clientId)}
                  disabled={busy}
                />
                {obrig.error(clientId)}
              </label>

              <label className="form-grid-2__full">
                <span>{secretObrigatorio ? 'Client Secret *' : 'Novo Client Secret (opcional)'}</span>
                <div className="apuracao-secret-input">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    name="rfb_client_secret"
                    autoComplete="new-password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={
                      credenciais?.possuiClientSecret
                        ? `Atual cadastrado (${credenciais.clientSecretMascarado || '****'}) — deixe em branco para manter`
                        : 'Informe o Client Secret gerado no portal da RFB'
                    }
                    className={secretObrigatorio ? obrig.inputClass(clientSecret) : undefined}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowSecret((prev) => !prev)}
                    title={showSecret ? 'Ocultar segredo' : 'Visualizar segredo'}
                    aria-label={showSecret ? 'Ocultar segredo' : 'Visualizar segredo'}
                    disabled={busy}
                  >
                    {showSecret ? <IoEyeOffOutline size={16} /> : <IoEyeOutline size={16} />}
                  </button>
                </div>
                {secretObrigatorio ? obrig.error(clientSecret) : null}
              </label>
            </div>

            <p className="apuracao-helper">
              Modo assíncrono sem webhook: as solicitações enviam retorno vazio para a Receita Federal e a
              QSApi acompanha o tíquete automaticamente a cada 5 minutos. O token OAuth2 válido fica em cache por
              até 1 hora; evite testar ou salvar repetidamente para não atingir o limite temporário (HTTP 429) da RFB.
            </p>
          </div>

          <footer className="modal-card__footer">
            <button type="submit" className="primary-button" disabled={busy}>
              {saving ? 'Salvando...' : 'Salvar credenciais'}
            </button>
            <button type="button" className="secondary-button" onClick={() => void handleTestar()} disabled={busy}>
              <IoShieldCheckmarkOutline size={16} />
              {testing ? 'Testando...' : 'Testar autenticação'}
            </button>
            <button
              type="button"
              className="secondary-button modal-card__close"
              onClick={onClose}
              disabled={busy}
            >
              Fechar
            </button>
          </footer>
        </form>
      </article>
    </div>
  );
}
