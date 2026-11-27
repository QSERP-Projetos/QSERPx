import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './routes/AppRouter';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { GlobalConfig } from './services/globalConfig';
import apiManager from './services/apiManager';
import { LoadingScreen } from './components/LoadingScreen';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([GlobalConfig.loadBaseUrl(), GlobalConfig.loadSession()]);

      const baseUrl = GlobalConfig.getBaseUrl();
      const hasSavedContext = Boolean(GlobalConfig.getUsuario() && GlobalConfig.getCodEmpresa());
      if (baseUrl && hasSavedContext && !GlobalConfig.getJwToken()) {
        const refreshed = await apiManager.refreshAccessToken(baseUrl);
        if (!refreshed) {
          await GlobalConfig.clearConfig();
        }
      }

      setReady(true);
    };

    void bootstrap();
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          {ready ? (
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          ) : (
            <LoadingScreen />
          )}
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
