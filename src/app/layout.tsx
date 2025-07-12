import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-100 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
