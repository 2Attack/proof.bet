import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./lib/providers";
import { AppProvider } from "./lib/app-context";
import { Backdrop } from "./components/Backdrop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "proof.bet — Every bet, with proof.",
  description:
    "A provably-fair casino where every outcome is re-derived from on-chain randomness in your own browser. Limbo + Plinko on Ethereum Sepolia.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <Providers>
          <AppProvider>
            <div className="hp-app">
              <Backdrop />
              {children}
              {modal}
            </div>
          </AppProvider>
        </Providers>
      </body>
    </html>
  );
}
