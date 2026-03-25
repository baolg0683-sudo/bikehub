export default function Home() {
  return (
    <div className="flex gap-8">
      {/* SIDEBAR LỌC XE */}
      <aside className="w-1/4 bg-white p-4 rounded-lg shadow-sm h-fit">
        <h2 className="font-semibold text-lg border-b pb-2 mb-4">Bộ lọc tìm kiếm</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="brand-select" className="block text-sm font-medium mb-1">Hãng xe</label>
            <select id="brand-select" className="w-full border rounded p-2">
              <option>Tất cả</option>
              <option>Trek</option>
              <option>Giant</option>  
              <option>Specialized</option>
            </select>
          </div>
          <div>
            <label htmlFor="price-range" className="block text-sm font-medium mb-1">Khoảng giá</label>
            <input id="price-range" type="range" className="w-full" />
          </div>
        </div>
      </aside>

      {/* DANH SÁCH XE (GRID) */}
      <section className="w-3/4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Xe đạp đang bán mới nhất</h2>
          <span className="text-sm text-gray-500">Hiển thị 12 kết quả</span>
        </div>
        
        {/* Lưới sản phẩm (Grid) */}
        <div className="grid grid-cols-3 gap-6">
          {/* Card sản phẩm mẫu */}
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="bg-white rounded-lg shadow-sm overflow-hidden border hover:shadow-md transition">
              <div className="h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                [Ảnh xe đạp]
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">Trek Marlin 7 2023</h3>
                <p className="text-sm text-gray-500 mb-2">Tình trạng: Excellent</p>
                <p className="text-red-600 font-bold text-lg">12.500.000 đ</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}