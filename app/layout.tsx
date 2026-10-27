import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Atkinson_Hyperlegible_Mono } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "700"] });
const atkinson = Atkinson_Hyperlegible_Mono({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: { default: "Destroyed by Moths FanFest", template: "%s FanFest" },
  description: "Earn XP, climb the leaderboard, unlock rewards.",
};

export const viewport: Viewport = { themeColor: "#8d3d34", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${atkinson.variable} h-full`}>
      <head>
        {/* Icon fonts used in the Figma: Font Awesome 7 Free (solid + brands) and Material Icons Round / Sharp */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.1.0/css/all.min.css" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Icons+Round&family=Material+Icons+Sharp&display=block" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
