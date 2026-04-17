import { FichaInspecaoPage } from './FichaInspecaoPage';

export function FichaInspecaoProcessoPage() {
  return (
    <FichaInspecaoPage
      tipoLaudo="Processo"
      titulo="Fichas de Inspeção de Processo"
      subtitulo="Consulta e apontamento de fichas de inspeção de processo."
      includePermission={{ acao: '18', transacao: '20' }}
      laudoPermission={{ acao: '19', transacao: '20' }}
    />
  );
}
