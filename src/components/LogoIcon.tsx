type LogoIconProps = {
  size?: number;
  color?: string;
  mode?: 'light' | 'dark';
};

export function LogoIcon({ size = 64, mode }: LogoIconProps) {
  const currentTheme =
    mode || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'light');
  const src = currentTheme === 'dark' ? '/logo-white.png' : '/logo-dark.png';

  return <img className="logo-icon" src={src} alt="QSERPx" width={size * 3} height={size} />;
}
