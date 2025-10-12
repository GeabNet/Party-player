import { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';

/**
 * Main Next.js App component
 * Handles PWA service worker registration and global app setup
 */
function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    // Add iOS specific meta tags for better PWA experience
    const addIOSMeta = () => {
      // Add iOS status bar style
      let metaStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!metaStatusBar) {
        metaStatusBar = document.createElement('meta');
        metaStatusBar.name = 'apple-mobile-web-app-status-bar-style';
        metaStatusBar.content = 'black-translucent';
        document.head.appendChild(metaStatusBar);
      }

      // Add iOS app capable (using modern meta tag)
      let metaAppCapable = document.querySelector('meta[name="mobile-web-app-capable"]');
      if (!metaAppCapable) {
        metaAppCapable = document.createElement('meta');
        metaAppCapable.name = 'mobile-web-app-capable';
        metaAppCapable.content = 'yes';
        document.head.appendChild(metaAppCapable);
      }
    };

    addIOSMeta();
  }, []);

  return (
    <>
      <Head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />
      </Head>
      <AuthProvider>
        <SocketProvider>
          <Component {...pageProps} />
        </SocketProvider>
      </AuthProvider>
    </>
  );
}

export default MyApp;