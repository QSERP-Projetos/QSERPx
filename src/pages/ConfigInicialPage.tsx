import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { ConfigScreen } from '../components/ConfigScreen';

export function ConfigInicialPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(ROUTES.login, { replace: true });
  };

  return <ConfigScreen showBackButton onBack={handleBack} />;
}
