import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { GlobalConfig } from '../services/globalConfig';

export function RequireAuth() {
  const location = useLocation();
  const token = GlobalConfig.getJwToken();
  const usuario = GlobalConfig.getUsuario();
  const empresa = GlobalConfig.getCodEmpresa();

  if (!token || !usuario || !empresa) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
