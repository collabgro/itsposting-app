import '../styles/globals.css';
import { useEffect } from 'react';
import Head from 'next/head';
import { ThemeProvider, useTheme } from '../lib/theme';

function ThemeBody({ children }) {
  const { theme } = useTheme();
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);
  return children;
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <ThemeBody>
        <Head>
          <meta name="description" content="Social media automation for local businesses" />
          <link rel="icon" href="/fav-icon.png" />
        </Head>
        <Component {...pageProps} />
      </ThemeBody>
    </ThemeProvider>
  );
}
