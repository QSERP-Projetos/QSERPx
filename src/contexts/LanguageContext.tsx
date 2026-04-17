import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';

type Language = 'pt' | 'en' | 'es' | 'ja';

type TranslationMap = Record<string, { pt: string; en: string; es: string; ja: string }>;

const translations: TranslationMap = {
  'menu.vendas': { pt: 'Vendas', en: 'Sales', es: 'Ventas', ja: '販売' },
  'menu.basico': { pt: 'Básico', en: 'Basic', es: 'Básico', ja: '基本' },
  'menu.compras': { pt: 'Compras', en: 'Purchases', es: 'Compras', ja: '購買' },
  'menu.financeiro': { pt: 'Financeiro', en: 'Financial', es: 'Financiero', ja: '財務' },
  'menu.pcp': { pt: 'PCP', en: 'PCP', es: 'PCP', ja: 'PCP' },
  'menu.configuracoes': { pt: 'Configurações', en: 'Settings', es: 'Configuraciones', ja: '設定' },

  'language.select': { pt: 'Selecionar Idioma', en: 'Select Language', es: 'Seleccionar Idioma', ja: '言語を選択' },
  'language.portuguese': { pt: 'Português', en: 'Portuguese', es: 'Portugués', ja: 'ポルトガル語' },
  'language.english': { pt: 'Inglês', en: 'English', es: 'Inglés', ja: '英語' },
  'language.spanish': { pt: 'Espanhol', en: 'Spanish', es: 'Español', ja: 'スペイン語' },
  'language.japanese': { pt: 'Japonês', en: 'Japanese', es: 'Japonés', ja: '日本語' },

  'login.user': { pt: 'Usuário', en: 'User', es: 'Usuario', ja: 'ユーザー' },
  'login.password': { pt: 'Senha', en: 'Password', es: 'Contraseña', ja: 'パスワード' },
  'login.userPlaceholder': {
    pt: 'Digite seu nome de usuário',
    en: 'Enter your username',
    es: 'Ingrese su nombre de usuario',
    ja: 'ユーザー名を入力',
  },
  'login.passwordPlaceholder': {
    pt: 'Digite sua senha',
    en: 'Enter your password',
    es: 'Ingrese su contraseña',
    ja: 'パスワードを入力',
  },
  'login.enter': { pt: 'Entrar', en: 'Login', es: 'Entrar', ja: 'ログイン' },
  'login.errorUser': { pt: 'Informe o usuário', en: 'Enter username', es: 'Ingrese el usuario', ja: 'ユーザー名を入力してください' },
  'login.errorPassword': { pt: 'Informe a senha', en: 'Enter password', es: 'Ingrese la contraseña', ja: 'パスワードを入力してください' },

  'config.title': { pt: 'Configuração de servidor', en: 'Server settings', es: 'Configuración del servidor', ja: 'サーバー設定' },
  'config.protocol': { pt: 'Conexão', en: 'Connection', es: 'Conexión', ja: '接続' },
  'config.url': { pt: 'URL', en: 'URL', es: 'URL', ja: 'URL' },
  'config.test': { pt: 'Testar e salvar', en: 'Test and save', es: 'Probar y guardar', ja: 'テストして保存' },
  'config.goLogin': { pt: 'Ir para login', en: 'Go to login', es: 'Ir a login', ja: 'ログインへ' },

  'home.welcome': { pt: 'Bem vindo ao QSERPx', en: 'Welcome to QSERPx', es: 'Bienvenido a QSERPx', ja: 'QSERPxへようこそ' },
  'home.user': { pt: 'Usuário', en: 'User', es: 'Usuario', ja: 'ユーザー' },
  'home.company': { pt: 'Empresa', en: 'Company', es: 'Empresa', ja: '会社' },
  'home.logout': { pt: 'Sair', en: 'Logout', es: 'Salir', ja: 'ログアウト' },
  'home.selectModule': {
    pt: 'Selecione um módulo para continuar',
    en: 'Select a module to continue',
    es: 'Seleccione un módulo para continuar',
    ja: '続行するモジュールを選択してください',
  },
};

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEYS.language);
    if (saved === 'pt' || saved === 'en' || saved === 'es' || saved === 'ja') {
      return saved;
    }
    return 'pt';
  });

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    window.localStorage.setItem(STORAGE_KEYS.language, value);
  };

  const translator = useMemo(
    () => (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[language] || key;
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translator }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
