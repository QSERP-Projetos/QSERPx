import { FichaInspecaoPage } from './FichaInspecaoPage';

export function FichaInspecaoRecebimentoPage() {
  return (
    <FichaInspecaoPage
      tipoLaudo="Recebimento"
      titulo="Fichas de Inspeção de Recebimento"
      subtitulo="Consulta e apontamento de fichas de inspeção de recebimento."
      includePermission={{ acao: '20', transacao: '21' }}
      laudoPermission={{ acao: '21', transacao: '21' }}
    />
  );
}
