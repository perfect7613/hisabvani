import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { ProductHeader } from "./components/product-header";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HisabVani",
    template: "%s · HisabVani",
  },
  description: "A multilingual voice and vision finance companion for Indian households.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable}`}>
      <body className="antialiased">
        <ProductHeader />
        {children}
      </body>
    </html>
  );
}
