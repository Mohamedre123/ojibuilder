import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "oji builder — ابنِ موقعك بالذكاء الاصطناعي",
  description: "اكتب فكرتك بالعربي، واحصل على موقع أو تطبيق كامل في ثوانٍ. عدّل أي جزء بالأمر أو يدويًا.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
