"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./post.module.css";

const bikeBrands = [
  "Trek",
  "Specialized",
  "Giant",
  "Cannondale",
  "Bianchi",
  "Scott",
  "Canyon",
  "Merida",
  "Colnago",
  "Pinarello",
  "BMC",
  "Orbea",
  "Santa Cruz",
  "Cube",
  "GT",
  "Felt",
  "Fuji",
  "Raleigh",
  "Mongoose",
  "Argon 18",
];

const frameMaterials = ["Carbon", "Nhôm", "Thép", "Titan", "Hợp kim"]; 

const bikeTypes = [
  "Road",
  "Mountain",
  "Gravel",
  "Hybrid",
  "City",
  "Touring",
  "E-bike",
  "Cross",
  "BMX",
];

const brakeTypes = ["Phanh dầu", "Phanh cơ", "Phanh đĩa", "Phanh vành"];

function PostBikeForm() {
  const [form, setForm] = useState({
    title: "",
    brand: "Giant",
    model: "",
    type: "Road",
    year: "",
    frame_size: "",
    frame_material: "Carbon",
    wheel_size: "",
    brake_type: "Phanh dầu",
    color: "",
    groupset: "",
    serial_number: "",
    mileage: "",
    price: "",
    description: "",
    additionalSpecs: "",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      if (uniquePreviews.length > 0) {
        setActiveImageIndex(0);
      }
    } catch (err: any) {
      setStatus(`Lỗi tải ảnh: ${err?.message || err}`);
    }
  };

  const formatPrice = (value: string) => {
    const number = Number(value.toString().replace(/[^0-9.-]+/g, ""));
    if (Number.isNaN(number) || number === 0) {
      return "Giá bán";
    }
    return number.toLocaleString("vi-VN") + " đ";
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) {
        setActiveImageIndex(0);
      } else if (index === activeImageIndex) {
        setActiveImageIndex(0);
      } else if (index < activeImageIndex) {
        setActiveImageIndex((current) => Math.max(current - 1, 0));
      }
      return next;
    });
  };

  const handleDragStart = (index: number, event: React.DragEvent<HTMLDivElement>) => {
    setDraggedImageIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (index: number, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceIndex = draggedImageIndex ?? Number(event.dataTransfer.getData("text/plain"));
    if (sourceIndex === index || sourceIndex < 0 || sourceIndex >= imagePreviews.length) {
      setDraggedImageIndex(null);
      return;
    }

    setImagePreviews((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });

    setActiveImageIndex((current) => {
      if (current === sourceIndex) {
        return index;
      }
      if (sourceIndex < current && index >= current) {
        return current - 1;
      }
      if (sourceIndex > current && index <= current) {
        return current + 1;
      }
      return current;
    });

    setDraggedImageIndex(null);
  };

  const openZoom = (index: number) => {
    if (!imagePreviews.length) {
      return;
    }
    setZoomIndex(index);
    setIsZoomOpen(true);
  };

  const closeZoom = () => {
    setIsZoomOpen(false);
  };

  const showPrevZoom = () => {
    setZoomIndex((current) => (current - 1 + imagePreviews.length) % imagePreviews.length);
  };

  const showNextZoom = () => {
    setZoomIndex((current) => (current + 1) % imagePreviews.length);
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const previewImage = imagePreviews[activeImageIndex] || "/assets/bike.png";
  const previewTitle = form.title || "Tiêu đề bài đăng của bạn sẽ hiển thị tại đây";
  const previewBrandText = form.brand ? `${form.brand}${form.model ? ` ${form.model}` : ""}` : "Chờ nhập thương hiệu và model";
  const previewType = form.type || "Chờ nhập loại xe";
  const previewMileage = form.mileage ? `${form.mileage} km` : "Chờ nhập";
  const previewYear = form.year || "Chờ nhập";
  const previewFrameSize = form.frame_size || "Chờ nhập";
  const previewFrameMaterial = form.frame_material || "Chờ nhập";
  const previewColor = form.color || "Chờ nhập";
  const previewGroupset = form.groupset || "Chờ nhập";
  const previewSerial = form.serial_number || "Chờ nhập";
  const previewDescription = form.description || "Mô tả chi tiết sản phẩm sẽ hiển thị ở đây.";
  const previewPrice = form.price ? formatPrice(form.price) : "Giá bán";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Đang gửi...");
    try {
      const storedToken = typeof window !== 'undefined' ? (window.sessionStorage.getItem('authToken') || window.sessionStorage.getItem('access_token') || '') : '';
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
        type: "Road",
        year: "",
        frame_size: "",
        frame_material: "Carbon",
        wheel_size: "700c",
        brake_type: "Phanh dầu",
        color: "",
        groupset: "",
        serial_number: "",
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

    const storedToken = typeof window !== 'undefined' ? (window.sessionStorage.getItem('access_token') || '') : '';
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
          type: listing.bike_details?.type || 'Road',
          year: listing.bike_details?.manufacture_year?.toString() || '',
          frame_size: listing.bike_details?.frame_size || '',
          frame_material: listing.bike_details?.frame_material || 'Carbon',
          wheel_size: listing.bike_details?.wheel_size || '700c',
          brake_type: listing.bike_details?.brake_type || 'Phanh dầu',
          color: listing.bike_details?.color || '',
          groupset: listing.bike_details?.groupset || '',
          serial_number: listing.bike_details?.serial_number || '',
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
      <div className={styles.postContent}>
        <form className={styles.postForm} onSubmit={handleSubmit}>
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <h2>Xem trước danh sách</h2>
              <p>Nhập đầy đủ thông tin trực tiếp vào thẻ xem trước, click vào khung ảnh để chọn nhiều ảnh.</p>
              <p className={styles.imageRequiredNote}>
                Dấu <span className={styles.required}>(*)</span> là bắt buộc. Vui lòng cung cấp đầy đủ thông tin!
              </p>
            </div>

            <div className={styles.previewCard}>
              <div className={styles.previewImageWrapper} onClick={triggerImageUpload}>
                {previewImage ? (
                  <img src={previewImage} alt="Ảnh xem trước" className={styles.previewImage} />
                ) : (
                  <div className={styles.previewPlaceholder}>Ảnh xe sẽ hiển thị ở đây</div>
                )}
                <button
                  type="button"
                  className={styles.previewZoomButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    openZoom(activeImageIndex);
                  }}
                >
                  🔍
                </button>
                <div className={styles.previewImageOverlay}>
                  {imagePreviews.length > 0 ? "Click để thay ảnh" : "Click để chọn ảnh (tối đa 5) "}
                  {!imagePreviews.length && <span className={styles.required}>*</span>}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.imageInput}
                onChange={handleImageChange}
              />

              {imagePreviews.length > 0 && (
                <>
                  <div className={styles.previewThumbnailRow}>
                    {imagePreviews.map((src, index) => (
                      <div
                        key={`${src}-${index}`}
                        className={`${styles.previewThumbnailButton} ${index === activeImageIndex ? styles.previewThumbnailActive : ""}`}
                        draggable
                        role="button"
                        tabIndex={0}
                        onDragStart={(event) => handleDragStart(index, event)}
                        onDragOver={handleDragOver}
                        onDrop={(event) => handleDrop(index, event)}
                        onClick={() => setActiveImageIndex(index)}
                      >
                        <img src={src} alt={`Hình ${index + 1}`} className={styles.previewThumbnailImg} />
                        <button
                          type="button"
                          className={styles.previewThumbnailRemove}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeImage(index);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {isZoomOpen && (
                    <div className={styles.imageZoomModal} onClick={closeZoom}>
                      <div className={styles.imageZoomContent} onClick={(event) => event.stopPropagation()}>
                        <button type="button" className={styles.imageZoomClose} onClick={closeZoom}>
                          ×
                        </button>
                        <img src={imagePreviews[zoomIndex]} alt={`Ảnh phóng to ${zoomIndex + 1}`} className={styles.imageZoomed} />
                        {imagePreviews.length > 1 && (
                          <div className={styles.imageZoomControls}>
                            <button type="button" onClick={showPrevZoom} className={styles.imageZoomControlButton}>
                              ‹
                            </button>
                            <button type="button" onClick={showNextZoom} className={styles.imageZoomControlButton}>
                              ›
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

                <div className={styles.previewDetailPanel}>
                <div className={styles.previewTopRow}>
                  <span className={styles.previewStatusTag}>Chờ đăng</span>
                  <div className={styles.previewPriceField}>
                    <label>
                      Giá bán <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.previewPriceInput}
                      type="text"
                      value={form.price}
                      onChange={(event) => handleChange("price", event.target.value)}
                      placeholder="Giá bán (VNĐ)"
                    />
                  </div>
                </div>
                <div className={styles.previewField}>
                  <label>
                    Tiêu đề <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.previewInput}
                    value={form.title}
                    onChange={(event) => handleChange("title", event.target.value)}
                    placeholder="Tiêu đề bài đăng của bạn sẽ hiển thị tại đây"
                  />
                </div>

                <div className={styles.previewMeta}>
              <div className={styles.previewField}>
                <label>
                  Hãng <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.previewSelect}
                  value={form.brand}
                  onChange={(event) => handleChange("brand", event.target.value)}
                >
                  {bikeBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div className={styles.previewField}>
                <label>
                  Model <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.previewInput}
                  value={form.model}
                  onChange={(event) => handleChange("model", event.target.value)}
                  placeholder="TCR, Defy, Madone..."
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Loại xe <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.previewSelect}
                  value={form.type}
                  onChange={(event) => handleChange("type", event.target.value)}
                >
                  {bikeTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.previewGrid}>
              <div className={styles.previewField}>
                <label>
                  Năm sản xuất <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.previewInput}
                  value={form.year}
                  onChange={(event) => handleChange("year", event.target.value)}
                  placeholder="Ví dụ: 2022"
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Kích thước khung <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.previewInput}
                  value={form.frame_size}
                  onChange={(event) => handleChange("frame_size", event.target.value)}
                  placeholder="Cm hoặc inch"
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Chất liệu khung <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.previewSelect}
                  value={form.frame_material}
                  onChange={(event) => handleChange("frame_material", event.target.value)}
                >
                  {frameMaterials.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.previewField}>
                <label>
                  Loại phanh <span className={styles.required}>*</span>
                </label>
                <select
                  className={styles.previewSelect}
                  value={form.brake_type}
                  onChange={(event) => handleChange("brake_type", event.target.value)}
                >
                  {brakeTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.previewField}>
                <label>
                  Cỡ bánh <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.previewInput}
                  value={form.wheel_size}
                  onChange={(event) => handleChange("wheel_size", event.target.value)}
                  placeholder="700c / 27.5 / 29"
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Màu sắc <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.previewInput}
                  value={form.color}
                  onChange={(event) => handleChange("color", event.target.value)}
                  placeholder="Chờ nhập"
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Groupset
                </label>
                <input
                  className={styles.previewInput}
                  value={form.groupset}
                  onChange={(event) => handleChange("groupset", event.target.value)}
                  placeholder="Chờ nhập"
                />
              </div>
              <div className={styles.previewField}>
                <label>
                  Serial / Số khung
                </label>
                <input
                  className={styles.previewInput}
                  value={form.serial_number}
                  onChange={(event) => handleChange("serial_number", event.target.value)}
                  placeholder="Chờ nhập"
                />
              </div>
              <div className={styles.previewField}>
                <label>Quãng đường</label>
                <input
                  className={styles.previewInput}
                  value={form.mileage}
                  onChange={(event) => handleChange("mileage", event.target.value)}
                  placeholder="Km"
                />
              </div>
            </div>

                <div className={styles.previewDescription}>
                  <h4>Mô tả</h4>
                  <textarea
                    className={styles.previewTextarea}
                    value={form.description}
                    onChange={(event) => handleChange("description", event.target.value)}
                    placeholder="Mô tả tình trạng xe, phụ kiện đi kèm, lý do bán..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className={styles.submitButton}>
              Gửi tin đăng
            </button>

            {status && <div className={styles.formStatus}>{status}</div>}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function PostBikePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>}>
      <PostBikeForm />
    </React.Suspense>
  );
}
