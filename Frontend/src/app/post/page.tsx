"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./post.module.css";

const bikeBrands = [
  "Giant",
  "Trek",
  "Specialized",
  "Cannondale",
  "Scott",
  "Merida",
  "Bianchi",
  "Cervelo",
  "Polygon",
  "Other",
];

const frameMaterials = ["Carbon", "Nhôm", "Thép", "Titan", "Hợp kim khác"];

const brakeTypes = ["Phanh dầu", "Phanh cơ", "Phanh đĩa", "Phanh vành"];

export default function PostBikePage() {
  const [form, setForm] = useState({
    title: "",
    brand: "Giant",
    model: "",
    type: "",
    year: "",
    frame_size: "",
    frame_material: "Carbon",
    wheel_size: "",
    brake_type: "Phanh dầu",
    color: "",
    groupset: "",
    serial_number: "",
    condition_percent: "",
    mileage: "",
    price: "",
    description: "",
    additionalSpecs: "",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [editMode, setEditMode] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const listingId = searchParams.get("listingId");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const combined = [...imagePreviews];
    const fileReaders: Promise<string>[] = [];
    const maxImages = 5;

    for (const file of files) {
      if (combined.length >= maxImages) break;
      fileReaders.push(
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Không thể đọc ảnh"));
            }
          };
          reader.onerror = () => reject(new Error("Lỗi đọc ảnh"));
          reader.readAsDataURL(file);
        })
      );
    }

    try {
      const newPreviews = await Promise.all(fileReaders);
      const uniquePreviews = [...combined, ...newPreviews].slice(0, maxImages);
      setImagePreviews(uniquePreviews);
    } catch (err: any) {
      setStatus(`Lỗi tải ảnh: ${err?.message || err}`);
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Đang gửi...");
    try {
      const storedToken = typeof window !== 'undefined' ? (window.localStorage.getItem('authToken') || window.localStorage.getItem('access_token') || '') : '';
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;

      const payload = {
        title: form.title,
        description: form.description,
        price: form.price,
        brand: form.brand,
        model: form.model,
        type: form.type,
        manufacture_year: form.year,
        frame_size: form.frame_size,
        frame_material: form.frame_material,
        wheel_size: form.wheel_size,
        brake_type: form.brake_type,
        color: form.color,
        groupset: form.groupset,
        serial_number: form.serial_number,
        condition_percent: form.condition_percent,
        mileage_km: form.mileage,
        additional_specs: form.additionalSpecs,
        images: imagePreviews,
      };

      const url = editMode && listingId ? `/api/listings/${listingId}` : "/api/listings";
      const resp = await fetch(url, {
        method: editMode && listingId ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
      }
      const data = await resp.json();
      if (editMode) {
        setStatus(`Tin đã cập nhật (ID: ${data.listing_id})`);
        router.push('/manage');
      } else {
        setStatus(`Tin đã gửi (ID: ${data.listing_id})`);
      }
      setForm({
        title: "",
        brand: "Giant",
        model: "",
        type: "",
        year: "",
        frame_size: "",
        frame_material: "Carbon",
        wheel_size: "",
        brake_type: "Phanh dầu",
        color: "",
        groupset: "",
        serial_number: "",
        condition_percent: "",
        mileage: "",
        price: "",
        description: "",
        additionalSpecs: "",
      });
      setImagePreviews([]);
    } catch (err: any) {
      setStatus(`Lỗi khi gửi: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    if (!listingId) {
      setEditMode(false);
      return;
    }

    const storedToken = typeof window !== 'undefined' ? (window.localStorage.getItem('access_token') || '') : '';
    if (!storedToken) {
      setStatus('Vui lòng đăng nhập để chỉnh sửa tin đăng.');
      return;
    }

    const fetchListing = async () => {
      setStatus('Đang tải tin đăng để chỉnh sửa...');
      try {
        const resp = await fetch('/api/users/me/listings', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || resp.statusText);
        }
        const listings = await resp.json();
        const listing = listings.find((item: any) => String(item.listing_id) === String(listingId));
        if (!listing) {
          throw new Error('Không tìm thấy tin đăng để chỉnh sửa.');
        }

        setForm((prev) => ({
          ...prev,
          title: listing.title || '',
          brand: listing.bike_details?.brand || 'Giant',
          model: listing.bike_details?.model || '',
          type: listing.bike_details?.type || '',
          year: listing.bike_details?.manufacture_year?.toString() || '',
          frame_size: listing.bike_details?.frame_size || '',
          frame_material: listing.bike_details?.frame_material || 'Carbon',
          wheel_size: listing.bike_details?.wheel_size || '',
          brake_type: listing.bike_details?.brake_type || 'Phanh dầu',
          color: listing.bike_details?.color || '',
          groupset: listing.bike_details?.groupset || '',
          serial_number: listing.bike_details?.serial_number || '',
          condition_percent: listing.bike_details?.condition_percent?.toString() || '',
          mileage: listing.bike_details?.mileage_km?.toString() || '',
          price: listing.price || '',
          description: listing.description || '',
          additionalSpecs: listing.additional_specs || '',
        }));
        setImagePreviews(listing.images || []);
        setEditMode(true);
        setStatus('');
      } catch (err: any) {
        setStatus(`Lỗi khi tải tin đăng: ${err?.message || err}`);
      }
    };

    fetchListing();
  }, [listingId]);

  return (
    <section className={styles.postPage}>
      <form className={styles.postForm} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="title">
            Tiêu đề tin đăng <span className={styles.required}>*</span>
          </label>
          <input
            id="title"
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="Ví dụ: Xe đạp đua Giant TCR 2020, like new"
            required
          />
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="brand">
              Thương hiệu <span className={styles.required}>*</span>
            </label>
            <select
              id="brand"
              value={form.brand}
              onChange={(event) => handleChange("brand", event.target.value)}
              required
            >
              {bikeBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="model">
              Model / Dòng xe <span className={styles.required}>*</span>
            </label>
            <input
              id="model"
              value={form.model}
              onChange={(event) => handleChange("model", event.target.value)}
              placeholder="TCR, Defy, Madone..."
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="type">
              Loại xe <span className={styles.required}>*</span>
            </label>
            <input
              id="type"
              value={form.type}
              onChange={(event) => handleChange("type", event.target.value)}
              placeholder="Road, MTB, Touring..."
              required
            />
          </div>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="year">
              Năm sản xuất <span className={styles.required}>*</span>
            </label>
            <input
              id="year"
              value={form.year}
              onChange={(event) => handleChange("year", event.target.value)}
              placeholder="2020"
              type="number"
              min="1900"
              max="2026"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="frame_size">
              Kích thước khung <span className={styles.required}>*</span>
            </label>
            <input
              id="frame_size"
              value={form.frame_size}
              onChange={(event) => handleChange("frame_size", event.target.value)}
              placeholder="54cm / M"
              required
            />
          </div>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="frame_material">
              Chất liệu khung <span className={styles.required}>*</span>
            </label>
            <select
              id="frame_material"
              value={form.frame_material}
              onChange={(event) => handleChange("frame_material", event.target.value)}
              required
            >
              {frameMaterials.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="wheel_size">
              Cỡ bánh <span className={styles.required}>*</span>
            </label>
            <input
              id="wheel_size"
              value={form.wheel_size}
              onChange={(event) => handleChange("wheel_size", event.target.value)}
              placeholder="700c / 29"
              required
            />
          </div>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="brake_type">
              Loại phanh <span className={styles.required}>*</span>
            </label>
            <select
              id="brake_type"
              value={form.brake_type}
              onChange={(event) => handleChange("brake_type", event.target.value)}
              required
            >
              {brakeTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="color">
              Màu sắc <span className={styles.required}>*</span>
            </label>
            <input
              id="color"
              value={form.color}
              onChange={(event) => handleChange("color", event.target.value)}
              placeholder="Đen, đỏ, xanh..."
              required
            />
          </div>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.formGroup}>
            <label htmlFor="groupset">Groupset / Bộ truyền động</label>
            <input
              id="groupset"
              value={form.groupset}
              onChange={(event) => handleChange("groupset", event.target.value)}
              placeholder="Shimano 105, SRAM Rival..."
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="serial_number">Số khung / Serial</label>
            <input
              id="serial_number"
              value={form.serial_number}
              onChange={(event) => handleChange("serial_number", event.target.value)}
              placeholder="ABC123456"
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
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="condition_percent">
              Tình trạng (%) <span className={styles.required}>*</span>
            </label>
            <input
              id="condition_percent"
              value={form.condition_percent}
              onChange={(event) => handleChange("condition_percent", event.target.value)}
              placeholder="85"
              type="number"
              min="0"
              max="100"
              required
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="image_uploads">
            Hình ảnh xe (tối đa 5 ảnh) <span className={styles.required}>*</span>
          </label>
          <input
            id="image_uploads"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            required
          />
          <div className={styles.imagePreviewGrid}>
            {imagePreviews.map((src, index) => (
              <div key={src + index} className={styles.imagePreviewItem}>
                <img src={src} alt={`Ảnh xe ${index + 1}`} className={styles.imagePreviewImg} />
                <button type="button" className={styles.imageRemoveButton} onClick={() => removeImage(index)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="price">
            Giá bán (VNĐ) <span className={styles.required}>*</span>
          </label>
          <input
            id="price"
            value={form.price}
            onChange={(event) => handleChange("price", event.target.value)}
            placeholder="12,000,000"
            type="text"
            required
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
