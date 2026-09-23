import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Sana Challenge Hub",
  description: "От бизнес-задачи к решению — HackAlem AI, трек «Образование»",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
