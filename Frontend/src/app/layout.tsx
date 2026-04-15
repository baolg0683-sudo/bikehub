import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Layout/Header";
import Footer from "../components/Layout/Footer";
import { DebugAuth } from "../components/Layout/DebugAuth";
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
            <Header />
            <main>
              {children}
            </main>
            <Footer />
            <ChatWidget />
            <DebugAuth />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}