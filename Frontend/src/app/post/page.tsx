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

const bikeTypes = [
  "Road",
  "Mountain",
  "Gravel",
  "Hybrid",
  "City",
  "Touring",
  "E-bike",
  "BMX",
  "Khác",
];

const wheelSizes = [
  "700c",
  "29",
  "27.5",
  "26",
  "650b",
  "Khác",
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
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [listingVerified, setListingVerified] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const listingId = searchParams.get("listingId");
  const isEditLocked = editMode && listingVerified;
  const isOnlyPriceDescriptionEditable = isEditLocked;

  const isFieldDisabled = (field: string) =>
    isOnlyPriceDescriptionEditable && field !== "price" && field !== "description";

  const handleChange = (field: string, value: string) => {
    if (isFieldDisabled(field)) return;
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

<<<<<<< Updated upstream
=======
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
    if (editMode && listingVerified) return;
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

>>>>>>> Stashed changes
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
        setListingVerified(Boolean(listing.is_verified || listing.inspection_status === 'PASSED'));
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
<<<<<<< Updated upstream
      <form className={styles.postForm} onSubmit={handleSubmit}>
        <p className={styles.note}>
          Người dùng không cần nhập % tình trạng xe. Chuyên viên kiểm định sẽ đánh giá chất lượng và cập nhật trạng thái sau khi kiểm định.
        </p>
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
=======
      <div className={styles.postContent}>
        <form className={styles.postForm} onSubmit={handleSubmit}>
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <h2>Xem trước danh sách</h2>
              <p>Nhập đầy đủ thông tin trực tiếp vào thẻ xem trước, click vào khung ảnh để chọn nhiều ảnh.</p>
              <p className={styles.imageRequiredNote}>
                Dấu <span className={styles.required}>(*)</span> là bắt buộc. Vui lòng cung cấp đầy đủ thông tin!
              </p>
              {isEditLocked && (
                <div className={styles.formStatus}>
                  Tin này đã được xác minh. Nhưng bạn có thể chỉnh sửa giá và mô tả để tìm người mua dễ dàng hơn.
                </div>
              )}
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
                disabled={isEditLocked}
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
                    disabled={isFieldDisabled("title")}
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
                  disabled={isFieldDisabled("brand")}
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
                  disabled={isFieldDisabled("model")}
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
                  disabled={isFieldDisabled("type")}
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
                  disabled={isFieldDisabled("year")}
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
                  disabled={isFieldDisabled("frame_size")}
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
                  disabled={isFieldDisabled("frame_material")}
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
                  disabled={isFieldDisabled("brake_type")}
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
                  disabled={isFieldDisabled("wheel_size")}
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
                  disabled={isFieldDisabled("color")}
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
                  disabled={isFieldDisabled("groupset")}
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
                  disabled={isFieldDisabled("serial_number")}
                />
              </div>
              <div className={styles.previewField}>
                <label>Quãng đường</label>
                <input
                  className={styles.previewInput}
                  value={form.mileage}
                  onChange={(event) => handleChange("mileage", event.target.value)}
                  placeholder="Km"
                  disabled={isFieldDisabled("mileage")}
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
              {editMode ? (isEditLocked ? 'Cập nhật giá và mô tả' : 'Cập nhật tin đăng') : 'Gửi tin đăng'}
            </button>

            {status && <div className={styles.formStatus}>{status}</div>}
>>>>>>> Stashed changes
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
            <select
              id="type"
              value={form.type}
              onChange={(event) => handleChange("type", event.target.value)}
              required
            >
              {bikeTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
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
            <select
              id="wheel_size"
              value={form.wheel_size}
              onChange={(event) => handleChange("wheel_size", event.target.value)}
              required
            >
              {wheelSizes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
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

export default function PostBikePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>}>
      <PostBikeForm />
    </React.Suspense>
  );
}
