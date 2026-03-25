import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BikeHub - Chợ Xe Đạp Cũ",
  description: "Nền tảng định giá và mua bán xe đạp thể thao cũ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-gray-50 text-gray-900 min-h-screen flex flex-col`}>
        {/* HEADER */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">BikeMarket</h1>
            <nav className="space-x-6">
              <a href="#" className="hover:text-blue-600">Mua xe</a>
              <a href="#" className="hover:text-blue-600">Định giá</a>
              <a href="#" className="hover:text-blue-600">Đăng nhập</a>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                Đăng tin
              </button>
            </nav>
          </div>
        </header>

        {/* NỘI DUNG CHÍNH (Các trang con sẽ render vào đây) */}
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>

        {/* FOOTER */}
        <footer className="bg-gray-800 text-white py-8 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p>&copy; 2026 Bike Market. Nền tảng mua bán xe đạp uy tín.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}