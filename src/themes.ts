export interface Theme {
  name: string;
  bg: string;
  bgDark: string;
  bgHover: string;
  fg: string;
  fgDim: string;
  accent: string;
  accentAlt: string;
  accentWarm: string;
  prompt: string;
  success: string;
  error: string;
  border: string;
  glow: string;
}

// Refined amber palette: ancient scroll ink + cinnabar + gold leaf
const amber: Theme = {
  name: '古卷琥珀',
  bg: '#18120c',
  bgDark: '#100c08',
  bgHover: '#7a4e2e',
  fg: '#d4c4a8',
  fgDim: '#6e5d4a',
  accent: '#c97e5a',
  accentAlt: '#b8934a',
  accentWarm: '#e8c44a',
  prompt: '#e0b040',
  success: '#7a8e5a',
  error: '#b84a40',
  border: '#2a1e14',
  glow: '0 0 14px rgba(201, 126, 90, 0.25)',
};

const tokyo: Theme = {
  name: 'Tokyo Night',
  bg: '#1a1b26',
  bgDark: '#16161e',
  bgHover: '#3d59a1',
  fg: '#c0caf5',
  fgDim: '#565f89',
  accent: '#7dcfff',
  accentAlt: '#bb9af7',
  accentWarm: '#e0af68',
  prompt: '#e0af68',
  success: '#9ece6a',
  error: '#f7768e',
  border: '#292e42',
  glow: '0 0 10px rgba(125, 207, 255, 0.3)',
};

const catppuccin: Theme = {
  name: 'Catppuccin Mocha',
  bg: '#1e1e2e',
  bgDark: '#181825',
  bgHover: '#89b4fa',
  fg: '#cdd6f4',
  fgDim: '#6c7086',
  accent: '#cba6f7',
  accentAlt: '#89b4fa',
  accentWarm: '#fab387',
  prompt: '#fab387',
  success: '#a6e3a1',
  error: '#f38ba8',
  border: '#313244',
  glow: '0 0 10px rgba(203, 166, 247, 0.25)',
};

export const themes: Record<string, Theme> = { amber, tokyo, catppuccin };

export function getTheme(hash: string): Theme {
  return themes[hash] || amber;
}
