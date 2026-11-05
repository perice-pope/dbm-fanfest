import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Atkinson_Hyperlegible_Mono } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "material-icons/iconfont/round.css";
import "material-icons/iconfont/sharp.css";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "700"] });
const atkinson = Atkinson_Hyperlegible_Mono({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: "Destroyed by Moths",
  description: "The official Destroyed by Moths site: news, shows, merch and the fan community on FanFest.",
};

export const viewport: Viewport = { themeColor: "#8d3d34", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${atkinson.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
