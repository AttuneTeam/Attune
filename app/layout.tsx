import type { Metadata } from "next";
import { Google_Sans_Flex, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

// Runs before paint to apply the saved/system theme and avoid a flash.
// We paint the canvas color inline too, because the CSS bundle hasn't
// loaded yet at this point — without it the browser shows a white flash.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    var bg = theme === "dark" ? "#232b1b" : "#fcf9f2";
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    root.style.colorScheme = theme;
    root.style.backgroundColor = bg;
  } catch (e) {}
})();
`;

const inter = Google_Sans_Flex({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attune",
  description: "See the real org behind the chart",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
