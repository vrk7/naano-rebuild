import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

/*
 * Mono is for identifiers, not for numbers. Scores and prices stay in Geist Sans
 * with tabular figures — same texture as the labels beside them — while a
 * collaboration id or a raw code is monospaced because it is a string that gets
 * copied, compared character by character, and read aloud.
 */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const DESCRIPTION =
  "Score LinkedIn creators against the ICP you actually sell to, keep the brief honest, and trace every reaction back to a person, a company and a match.";

export const metadata: Metadata = {
  title: {
    default: "naano — point at a post, see who it brought in",
    template: "%s · naano",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "naano — point at a post, see who it brought in",
    description: DESCRIPTION,
    siteName: "naano",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistMono.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
