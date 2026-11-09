import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EduMídia", template: "%s · EduMídia" },
  description: "Distribuição segura e auditável de mídias educacionais.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
