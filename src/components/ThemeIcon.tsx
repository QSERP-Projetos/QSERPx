import { IoMoon, IoSunny } from 'react-icons/io5';

type ThemeIconProps = {
  mode: 'light' | 'dark';
  color?: string;
  size?: number;
};

export function ThemeIcon({ mode, color = '#666', size = 24 }: ThemeIconProps) {
  if (mode === 'light') {
    return <IoMoon color={color} size={size} />;
  }

  return <IoSunny color={color} size={size} />;
}
