"use client";

import React, { useState } from "react";
import styles from "./post.module.css";

const carBrands = [
  "Giant",
  "Trek",
  "Specialized",
  "Cannondale",
  "Scott",
  "Merida",
  "Bianchi",
  "Cervelo",
  "Other",
];

const conditions = ["Mới", "Đã qua sử dụng", "Like new", "Tốt", "Trung bình"];

export default function PostCarPage() {
  const [form, setForm] = useState({
    title: "",
    brand: "Giant",
    year: "",
    mileage: "",
    condition: "Đã qua sử dụng",
    price: "",
    description: "",
    additionalSpecs: "",
  });
  const [status, setStatus] = useState("");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Đang gửi...");
    try {
      const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('authToken') : '';
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const resp = await fetch("http://127.0.0.1:9999/api/listings", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
      }
      const data = await resp.json();
      setStatus(`Tin đã gửi (ID: ${data.listing_id})`);
      setForm({
        title: "",
        brand: "Giant",
        year: "",
        mileage: "",
        condition: "Đã qua sử dụng",
        price: "",
        description: "",
        additionalSpecs: "",
      });
    } catch (err: any) {
      setStatus(`Lỗi khi gửi: ${err?.message || err}`);
    }
  };

  return (
    <section className={styles.postPage}>
      <header className={styles.pageHeader}>
        <h1>Đăng tin bán xe</h1>
        <p>Nhập đầy đủ thông tin về xe, thương hiệu, cấu hình và mô tả để người mua nhanh chóng tìm thấy.</p>
      </header>

      <form className={styles.postForm} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Tiêu đề tin đăng</label>
          <input
            id="title"
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="Ví dụ: Xe đạp đua Giant TCR 2020, like new"
          />
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="brand">Thương hiệu</label>
            <select
              id="brand"
              value={form.brand}
              onChange={(event) => handleChange("brand", event.target.value)}
            >
              {carBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="year">Năm sản xuất</label>
            <input
              id="year"
              value={form.year}
              onChange={(event) => handleChange("year", event.target.value)}
              placeholder="2020"
              type="number"
              min="1900"
              max="2026"
            />
          </div>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="mileage">Quãng đường đã đi (km)</label>
            <input
              id="mileage"
              value={form.mileage}
              onChange={(event) => handleChange("mileage", event.target.value)}
              placeholder="1200"
              type="number"
              min="0"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="condition">Tình trạng</label>
            <select
              id="condition"
              value={form.condition}
              onChange={(event) => handleChange("condition", event.target.value)}
            >
              {conditions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="price">Giá bán (VNĐ)</label>
          <input
            id="price"
            value={form.price}
            onChange={(event) => handleChange("price", event.target.value)}
            placeholder="12,000,000"
            type="text"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Mô tả chi tiết</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(event) => handleChange("description", event.target.value)}
            placeholder="Mô tả tình trạng xe, phụ kiện đi kèm, lý do bán..."
            rows={6}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="additionalSpecs">Cấu hình / Thông số thêm</label>
          <textarea
            id="additionalSpecs"
            value={form.additionalSpecs}
            onChange={(event) => handleChange("additionalSpecs", event.target.value)}
            placeholder="Khung, phuộc, bộ truyền động, phanh, lốp..."
            rows={4}
          />
        </div>

        <button type="submit" className={styles.submitButton}>
          Gửi tin đăng
        </button>

        {status && <div className={styles.formStatus}>{status}</div>}
      </form>
    </section>
  );
}
