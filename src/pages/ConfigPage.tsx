import { Navigate } from 'react-router-dom';
import { GlobalConfig } from '../services/globalConfig';
import { ROUTES } from '../constants/routes';
import { ConfigScreen } from '../components/ConfigScreen';

export function ConfigPage() {
  const tokenAtual = GlobalConfig.getJwToken();
  const usuarioAtual = GlobalConfig.getUsuario();
  const empresaAtual = GlobalConfig.getCodEmpresa();
  const nivelUsuario = Number(GlobalConfig.getNivelUsuario() ?? 0);
  const usuarioLogado = Boolean(tokenAtual && usuarioAtual && empresaAtual);
  const bloqueadoPorNivel = usuarioLogado && nivelUsuario < 9;

  if (bloqueadoPorNivel) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <ConfigScreen />;
}
