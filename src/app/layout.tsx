import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "KetikFokus - Typing Practice",
  description: "Platform latihan mengetik 10 jari yang minimalis dan estetik.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-300 font-mono transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
