import type { Metadata } from "next";
import "./globals.css";
import HeaderWrapper from "../components/Layout/HeaderWrapper";
import Footer from "../components/Layout/Footer";
import { AuthProvider } from "../context/AuthContext";
import { ChatProvider } from "../context/ChatContext";
import { ChatWidget } from "../components/Common/ChatWidget";

export const metadata: Metadata = {
  title: "BikeMarket - Chợ Xe Đạp Cũ",
  description: "Nền tảng định giá và mua bán xe đạp thể thao cũ",
  icons: {
    icon: '/assets/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <ChatProvider>
            <HeaderWrapper />
            <main>
              {children}
            </main>
            <Footer />
            <ChatWidget />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}