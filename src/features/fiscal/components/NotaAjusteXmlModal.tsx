import { useEffect, useState } from 'react';
import {
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoCopyOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoPrintOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { useToast } from '../../../contexts/ToastContext';
import { abrirBlobPdf, gerarDanfeNotaAjustePdf } from '../../../services/notaAjusteApi';

interface NotaAjusteXmlModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  xml: string;
  sucesso?: boolean;
  mensagem?: string;
  avisos?: string[];
  fileName?: string;
  simulacao?: boolean;
  podeImprimirDanfe?: boolean;
  numNotaFiscal?: string;
  serNotaFiscal?: string;
  codigoEmpresa?: number;
}

const formatXml = (rawXml: string): string => {
  const xml = String(rawXml ?? '').trim();
  if (!xml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return xml;

    let formatted = '';
    const reg = /(>)(<)(\/*)/g;
    const normalized = xml.replace(/>\s+</g, '><').replace(reg, '$1\n$2$3');
    let pad = 0;
    for (const node of normalized.split('\n')) {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
        indent = 1;
      }
      formatted += `${'  '.repeat(pad)}${node}\n`;
      pad += indent;
    }
    return formatted.trim();
  } catch {
    return xml;
  }
};

export function NotaAjusteXmlModal({
  open,
  onClose,
  title,
  xml,
  sucesso = true,
  mensagem,
  avisos = [],
  fileName = 'nota-ajuste.xml',
  simulacao = false,
  podeImprimirDanfe,
  numNotaFiscal,
  serNotaFiscal,
  codigoEmpresa,
}: NotaAjusteXmlModalProps) {
  const { showToast } = useToast();
  const [tipoDanfe, setTipoDanfe] = useState<5 | 6>(5);
  const [printingDanfe, setPrintingDanfe] = useState(false);

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

  const formattedXml = formatXml(xml);
  const hasXml = Boolean(String(xml || '').trim());
  const ehPreviaOuNaoAutorizada = Boolean(simulacao || !podeImprimirDanfe);
  const danfePermitida = hasXml;
  const danfeHint = !hasXml
    ? 'Gere ou carregue o XML antes de imprimir a DANFE.'
    : ehPreviaOuNaoAutorizada
      ? 'Imprimir prévia da DANFE (Layout Reforma Tributária — disponível mesmo sem autorização SEFAZ)'
      : 'Imprimir DANFE oficial (Layout Reforma Tributária)';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedXml || xml);
      showToast('XML copiado para a área de transferência.', 'success');
    } catch {
      showToast('Não foi possível copiar automaticamente. Selecione o texto manualmente.', 'info');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([xml || formattedXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleImprimirDanfe = async () => {
    if (!danfePermitida || printingDanfe) return;
    setPrintingDanfe(true);
    try {
      const pdfBlob = await gerarDanfeNotaAjustePdf(
        numNotaFiscal || '000000',
        serNotaFiscal || '1',
        tipoDanfe,
        codigoEmpresa,
        { simulacao: ehPreviaOuNaoAutorizada, xml },
      );
      abrirBlobPdf(pdfBlob);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar PDF da DANFE.', 'error');
    } finally {
      setPrintingDanfe(false);
    }
  };

  return (
    <section
      className="modal-backdrop modal-backdrop--nested"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfa-xml-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="modal-card nfa-modal nfa-modal--xl">
        <header className="modal-card__header">
          <h2 id="nfa-xml-modal-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <IoCloseOutline size={18} />
          </button>
        </header>

        <div className="nfa-modal__body">
          {mensagem && (
            <div className={`nfa-banner ${sucesso ? 'nfa-banner--success' : 'nfa-banner--danger'}`}>
              {sucesso ? <IoCheckmarkCircleOutline size={18} /> : <IoWarningOutline size={18} />}
              <span>{mensagem}</span>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="nfa-banner nfa-banner--warning">
              <IoWarningOutline size={18} />
              <div>
                <strong>Observações de validação fiscal:</strong>
                <ul className="nfa-aviso-list">
                  {avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <pre className="nfa-xml-viewer" tabIndex={0}>
            {formattedXml || 'XML vazio.'}
          </pre>
        </div>

        <footer className="nfa-modal__footer">
          <div className="nfa-footer-summary nfa-radio-pills" title="Orientação da DANFE (Reforma Tributária)">
            <button
              type="button"
              className={`nfa-pill ${tipoDanfe === 5 ? 'is-active' : ''}`}
              onClick={() => setTipoDanfe(5)}
              disabled={printingDanfe}
            >
              <IoDocumentTextOutline size={15} /> Retrato
            </button>
            <button
              type="button"
              className={`nfa-pill ${tipoDanfe === 6 ? 'is-active' : ''}`}
              onClick={() => setTipoDanfe(6)}
              disabled={printingDanfe}
            >
              <IoDocumentTextOutline size={15} /> Paisagem
            </button>
          </div>
          <button type="button" className="secondary-button" onClick={() => void handleCopy()} disabled={!hasXml}>
            <IoCopyOutline size={16} />
            <span>Copiar XML</span>
          </button>
          <button type="button" className="secondary-button" onClick={handleDownload} disabled={!hasXml}>
            <IoDownloadOutline size={16} />
            <span>Baixar XML</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleImprimirDanfe()}
            disabled={!danfePermitida || printingDanfe}
            title={danfeHint}
          >
            <IoPrintOutline size={16} />
            <span>
              {printingDanfe ? 'Gerando DANFE...' : ehPreviaOuNaoAutorizada ? 'Imprimir DANFE (Prévia)' : 'Imprimir DANFE'}
            </span>
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </article>
    </section>
  );
}
