import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="bg-surface-1 text-ink-0">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
