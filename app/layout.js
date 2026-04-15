import "./globals.css";

export const metadata = {
  title: "Turbo — Production Dashboard",
  description: "Дашборд заказов производства одежды",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{var t=localStorage.getItem('turbo-theme');
            if(t==='light')document.documentElement.setAttribute('data-theme','light');
            }catch(e){}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
