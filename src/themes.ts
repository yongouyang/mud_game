export interface Theme {
  name: string;
  bg: string;        // main background
  bgDark: string;    // header, input bar
  bgHover: string;   // button hover
  fg: string;        // main text
  fgDim: string;     // muted text
  accent: string;    // title, borders, highlights
  accentAlt: string; // secondary accent (box borders, etc.)
  prompt: string;    // > symbol
  success: string;   // connected dot
  error: string;     // disconnected dot
  border: string;    // dividers
  glow: string;      // text shadow glow
}

export const themes: Record<string, Theme> = {
  tokyo: {
    name: 'Tokyo Night',
    bg: '#1a1b26',
    bgDark: '#16161e',
    bgHover: '#3d59a1',
    fg: '#c0caf5',
    fgDim: '#565f89',
    accent: '#7dcfff',
    accentAlt: '#bb9af7',
    prompt: '#e0af68',
    success: '#9ece6a',
    error: '#f7768e',
    border: '#292e42',
    glow: '0 0 10px rgba(125, 207, 255, 0.3)',
  },

  catppuccin: {
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e',
    bgDark: '#181825',
    bgHover: '#89b4fa',
    fg: '#cdd6f4',
    fgDim: '#6c7086',
    accent: '#cba6f7',
    accentAlt: '#89b4fa',
    prompt: '#fab387',
    success: '#a6e3a1',
    error: '#f38ba8',
    border: '#313244',
    glow: '0 0 10px rgba(203, 166, 247, 0.25)',
  },

  amber: {
    name: '古卷琥珀',
    bg: '#1a1410',
    bgDark: '#120e0b',
    bgHover: '#8b5e3c',
    fg: '#c8c0b0',
    fgDim: '#6b5e53',
    accent: '#d4846a',
    accentAlt: '#c49a4a',
    prompt: '#e2b04a',
    success: '#8b9a6b',
    error: '#c45a4a',
    border: '#2e241b',
    glow: '0 0 12px rgba(212, 132, 106, 0.25)',
  },
};

export function getTheme(hash: string): Theme {
  return themes[hash] || themes['tokyo'];
}
