import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "校园科技讲座 AI 海报生成工具",
  description: "填写讲座信息，生成蓝色科技风竖版讲座海报。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
