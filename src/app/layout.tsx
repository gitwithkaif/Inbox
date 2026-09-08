import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inbox — Dead-simple file requests",
  description: "Personal file-request tool. Send and receive files seamlessly.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-navy antialiased">
        {children}
      </body>
    </html>
  );
}
