import type { Metadata } from "next";
import "../styles/home.css";
import Header from "../components/Layout/Header";
import Footer from "../components/Layout/Footer";

export const metadata: Metadata = {
  title: "BikeMarket - Chợ Xe Đạp Cũ",
  description: "Nền tảng định giá và mua bán xe đạp thể thao cũ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <main>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}