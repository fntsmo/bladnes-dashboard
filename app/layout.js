import "./globals.css";

export const metadata = {
  title: "Bladnes × Turbo — Production Dashboard",
  description: "Дашборд заказов производства одежды",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
