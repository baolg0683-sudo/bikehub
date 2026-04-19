"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./post.module.css";

const bikeBrands = ["Giant","Trek","Specialized","Cannondale","Scott","Merida","Bianchi","Cervelo","Polygon","Other"];
const frameMaterials = ["Carbon","Nhôm","Thép","Titan","Hợp kim khác"];
const bikeTypes = ["Road","Mountain","Gravel","Hybrid","City","Touring","E-bike","BMX","Khác"];
const brakeTypes = ["Phanh dầu","Phanh cơ","Phanh đĩa","Phanh vành"];

function PostBikeForm() {
  const [form, setForm] = useState({
    title: "", brand: "Giant", model: "", type: "Road", year: "",
    frame_size: "", frame_material: "Carbon", wheel_size: "700c",
    brake_type: "Phanh dầu", color: "", groupset: "", serial_number: "",
    mileage: "", price: "", description: "", additionalSpecs: "",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [listingVerified, setListingVerified] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const listingId = searchParams.get("listingId");

  const isEditLocked = editMode && listingVerified;
  const isFieldDisabled = (field: string) =>
    isEditLocked && field !== "price" && field !== "description";

  const handleChange = (field: string, value: string) => {
    if (isFieldDisabled(field)) return;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const formatPrice = (price: string) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(price));

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxImages = 5;
    const readers: Promise<string>[] = files
      .slice(0, maxImages - imagePreviews.length)
      .map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
        reader.onerror = () => reject(new Error("Lỗi đọc ảnh"));
        reader.readAsDataURL(file);
      }));
    try {
      const newPreviews = await Promise.all(readers);
      setImagePreviews(prev => [...prev, ...newPreviews].slice(0, maxImages));
    } catch (err: unknown) {
      setStatus(`Lỗi tải ảnh: ${err instanceof Error ? err.message : err}`);
    }
  };

  const removeImage = (index: number) =>
    setImagePreviews(prev => prev.filter((_, i) => i !== index));

  const handleDragStart = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDrop = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const src = draggedImageIndex ?? Number(e.dataTransfer.getData("text/plain"));
    if (src === index || src < 0 || src >= imagePreviews.length) { setDraggedImageIndex(null); return; }
    setImagePreviews(prev => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setActiveImageIndex(cur => {
      if (cur === src) return index;
      if (src < cur && index >= cur) return cur - 1;
      if (src > cur && index <= cur) return cur + 1;
      return cur;
    });
    setDraggedImageIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("Đang gửi...");
    try {
      const token = typeof window !== "undefined"
        ? (sessionStorage.getItem("authToken") || sessionStorage.getItem("access_token") || "")
        : "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = {
        title: form.title, description: form.description, price: form.price,
        brand: form.brand, model: form.model, type: form.type,
        manufacture_year: form.year, frame_size: form.frame_size,
        frame_material: form.frame_material, wheel_size: form.wheel_size,
        brake_type: form.brake_type, color: form.color, groupset: form.groupset,
        serial_number: form.serial_number, mileage_km: form.mileage,
        additional_specs: form.additionalSpecs, images: imagePreviews,
      };

      const url = editMode && listingId ? `/api/listings/${listingId}` : "/api/listings";
      const resp = await fetch(url, { method: editMode && listingId ? "PUT" : "POST", headers, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error((await resp.text()) || resp.statusText);
      const data = await resp.json();
      if (editMode) { setStatus(`Tin đã cập nhật (ID: ${data.listing_id})`); router.push("/manage"); }
      else setStatus(`Tin đã gửi (ID: ${data.listing_id})`);
      setForm({ title:"",brand:"Giant",model:"",type:"Road",year:"",frame_size:"",frame_material:"Carbon",wheel_size:"700c",brake_type:"Phanh dầu",color:"",groupset:"",serial_number:"",mileage:"",price:"",description:"",additionalSpecs:"" });
      setImagePreviews([]);
    } catch (err: unknown) {
      setStatus(`Lỗi khi gửi: ${err instanceof Error ? err.message : err}`);
    }
  };

  useEffect(() => {
    if (!listingId) { setEditMode(false); return; }
    const token = typeof window !== "undefined" ? (sessionStorage.getItem("access_token") || "") : "";
    if (!token) { setStatus("Vui lòng đăng nhập để chỉnh sửa tin đăng."); return; }

    (async () => {
      setStatus("Đang tải tin đăng để chỉnh sửa...");
      try {
        const resp = await fetch("/api/users/me/listings", { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error((await resp.text()) || resp.statusText);
        const listings = await resp.json();
        const listing = listings.find((item: { listing_id: number }) => String(item.listing_id) === String(listingId));
        if (!listing) throw new Error("Không tìm thấy tin đăng để chỉnh sửa.");
        setForm(prev => ({
          ...prev,
          title: listing.title || "", brand: listing.bike_details?.brand || "Giant",
          model: listing.bike_details?.model || "", type: listing.bike_details?.type || "Road",
          year: listing.bike_details?.manufacture_year?.toString() || "",
          frame_size: listing.bike_details?.frame_size || "",
          frame_material: listing.bike_details?.frame_material || "Carbon",
          wheel_size: listing.bike_details?.wheel_size || "700c",
          brake_type: listing.bike_details?.brake_type || "Phanh dầu",
          color: listing.bike_details?.color || "", groupset: listing.bike_details?.groupset || "",
          serial_number: listing.bike_details?.serial_number || "",
          mileage: listing.bike_details?.mileage_km?.toString() || "",
          price: listing.price || "", description: listing.description || "",
          additionalSpecs: listing.additional_specs || "",
        }));
        setImagePreviews(listing.images || []);
        setListingVerified(Boolean(listing.is_verified || listing.inspection_status === "PASSED"));
        setEditMode(true);
        setStatus("");
      } catch (err: unknown) {
        setStatus(`Lỗi khi tải tin đăng: ${err instanceof Error ? err.message : err}`);
      }
    })();
  }, [listingId]);

  const previewImage = imagePreviews[activeImageIndex] || "/assets/bike.png";

  return (
    <section className={styles.postPage}>
      <form className={styles.postForm} onSubmit={handleSubmit}>
        <div className={styles.postContent}>
          <div className={styles.previewPanel}>
            {/* Header */}
            <div className={styles.previewHeader}>
              <h2>Xem trước danh sách</h2>
              <p>Nhập đầy đủ thông tin trực tiếp vào thẻ xem trước, click vào khung ảnh để chọn nhiều ảnh.</p>
              <p className={styles.imageRequiredNote}>
                Dấu <span className={styles.required}>(*)</span> là bắt buộc. Vui lòng cung cấp đầy đủ thông tin!
              </p>
              {isEditLocked && (
                <div className={styles.formStatus}>
                  Tin này đã được xác minh. Bạn chỉ có thể chỉnh sửa giá và mô tả.
                </div>
              )}
            </div>

            {/* Preview card */}
            <div className={styles.previewCard}>
              {/* Main image */}
              <div className={styles.previewImageWrapper} onClick={() => !isEditLocked && fileInputRef.current?.click()}>
                {previewImage
                  ? <img src={previewImage} alt="Ảnh xem trước" className={styles.previewImage} />
                  : <div className={styles.previewPlaceholder}>Ảnh xe sẽ hiển thị ở đây</div>}
                <button
                  type="button"
                  className={styles.previewZoomButton}
                  onClick={e => { e.stopPropagation(); if (imagePreviews.length) { setZoomIndex(activeImageIndex); setIsZoomOpen(true); } }}
                >🔍</button>
                <div className={styles.previewImageOverlay}>
                  {imagePreviews.length > 0 ? "Click để thay ảnh" : "Click để chọn ảnh (tối đa 5)"}
                  {!imagePreviews.length && <span className={styles.required}> *</span>}
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple className={styles.imageInput} onChange={handleImageChange} disabled={isEditLocked} />

              {/* Thumbnails */}
              {imagePreviews.length > 0 && (
                <div className={styles.previewThumbnailRow}>
                  {imagePreviews.map((src, index) => (
                    <div
                      key={`${src.slice(-8)}-${index}`}
                      className={`${styles.previewThumbnailButton} ${index === activeImageIndex ? styles.previewThumbnailActive : ""}`}
                      draggable
                      role="button"
                      tabIndex={0}
                      onDragStart={e => handleDragStart(index, e)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleDrop(index, e)}
                      onClick={() => setActiveImageIndex(index)}
                    >
                      <img src={src} alt={`Hình ${index + 1}`} className={styles.previewThumbnailImg} />
                      <button type="button" className={styles.previewThumbnailRemove}
                        onClick={e => { e.stopPropagation(); removeImage(index); }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Zoom modal */}
              {isZoomOpen && (
                <div className={styles.imageZoomModal} onClick={() => setIsZoomOpen(false)}>
                  <div className={styles.imageZoomContent} onClick={e => e.stopPropagation()}>
                    <button type="button" className={styles.imageZoomClose} onClick={() => setIsZoomOpen(false)}>×</button>
                    <img src={imagePreviews[zoomIndex]} alt={`Ảnh phóng to ${zoomIndex + 1}`} className={styles.imageZoomed} />
                    {imagePreviews.length > 1 && (
                      <div className={styles.imageZoomControls}>
                        <button type="button" className={styles.imageZoomControlButton}
                          onClick={() => setZoomIndex(i => (i - 1 + imagePreviews.length) % imagePreviews.length)}>‹</button>
                        <button type="button" className={styles.imageZoomControlButton}
                          onClick={() => setZoomIndex(i => (i + 1) % imagePreviews.length)}>›</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form fields */}
              <div className={styles.previewDetailPanel}>
                <div className={styles.previewTopRow}>
                  <span className={styles.previewStatusTag}>Chờ đăng</span>
                  <div className={styles.previewPriceField}>
                    <label>Giá bán <span className={styles.required}>*</span></label>
                    <input className={styles.previewPriceInput} type="text" value={form.price}
                      onChange={e => handleChange("price", e.target.value)} placeholder="Giá bán (VNĐ)" />
                  </div>
                </div>

                <div className={styles.previewField}>
                  <label>Tiêu đề <span className={styles.required}>*</span></label>
                  <input className={styles.previewInput} value={form.title}
                    onChange={e => handleChange("title", e.target.value)}
                    placeholder="Tiêu đề bài đăng" disabled={isFieldDisabled("title")} />
                </div>

                <div className={styles.previewMeta}>
                  <div className={styles.previewField}>
                    <label>Hãng <span className={styles.required}>*</span></label>
                    <select className={styles.previewSelect} value={form.brand}
                      onChange={e => handleChange("brand", e.target.value)} disabled={isFieldDisabled("brand")}>
                      {bikeBrands.map(b => <option key={b} value={b}>{b}</option>)}
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className={styles.previewField}>
                    <label>Model <span className={styles.required}>*</span></label>
                    <input className={styles.previewInput} value={form.model}
                      onChange={e => handleChange("model", e.target.value)}
                      placeholder="TCR, Defy, Madone..." disabled={isFieldDisabled("model")} />
                  </div>
                  <div className={styles.previewField}>
                    <label>Loại xe <span className={styles.required}>*</span></label>
                    <select className={styles.previewSelect} value={form.type}
                      onChange={e => handleChange("type", e.target.value)} disabled={isFieldDisabled("type")}>
                      {bikeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.previewGrid}>
                  {[
                    { label: "Năm sản xuất", field: "year", placeholder: "Ví dụ: 2022" },
                    { label: "Kích thước khung", field: "frame_size", placeholder: "Cm hoặc inch" },
                    { label: "Cỡ bánh", field: "wheel_size", placeholder: "700c / 27.5 / 29" },
                    { label: "Màu sắc", field: "color", placeholder: "Chờ nhập" },
                    { label: "Groupset", field: "groupset", placeholder: "Chờ nhập" },
                    { label: "Serial / Số khung", field: "serial_number", placeholder: "Chờ nhập" },
                    { label: "Quãng đường", field: "mileage", placeholder: "Km" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field} className={styles.previewField}>
                      <label>{label}{["year","frame_size","wheel_size","color"].includes(field) && <span className={styles.required}> *</span>}</label>
                      <input className={styles.previewInput} value={(form as Record<string, string>)[field]}
                        onChange={e => handleChange(field, e.target.value)}
                        placeholder={placeholder} disabled={isFieldDisabled(field)} />
                    </div>
                  ))}
                  <div className={styles.previewField}>
                    <label>Chất liệu khung <span className={styles.required}>*</span></label>
                    <select className={styles.previewSelect} value={form.frame_material}
                      onChange={e => handleChange("frame_material", e.target.value)} disabled={isFieldDisabled("frame_material")}>
                      {frameMaterials.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className={styles.previewField}>
                    <label>Loại phanh <span className={styles.required}>*</span></label>
                    <select className={styles.previewSelect} value={form.brake_type}
                      onChange={e => handleChange("brake_type", e.target.value)} disabled={isFieldDisabled("brake_type")}>
                      {brakeTypes.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.previewDescription}>
                  <h4>Mô tả</h4>
                  <textarea className={styles.previewTextarea} value={form.description}
                    onChange={e => handleChange("description", e.target.value)}
                    placeholder="Mô tả tình trạng xe, phụ kiện đi kèm, lý do bán..." rows={4} />
                </div>
              </div>
            </div>

            <button type="submit" className={styles.submitButton}>
              {editMode ? "Cập nhật tin đăng" : "Gửi tin đăng"}
            </button>
            {status && <div className={styles.formStatus}>{status}</div>}
          </div>
        </div>
      </form>
    </section>
  );
}

export default function PostBikePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Đang tải...</div>}>
      <PostBikeForm />
    </React.Suspense>
  );
}
