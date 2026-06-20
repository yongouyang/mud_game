import { useEffect, useState } from 'react';
import { Terminal } from './components/Terminal';
import { Theme, getTheme } from './themes';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getTheme(window.location.hash.slice(1)));

  useEffect(() => {
    const onHashChange = () => setTheme(getTheme(window.location.hash.slice(1)));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return <Terminal theme={theme} />;
}
