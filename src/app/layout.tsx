import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
