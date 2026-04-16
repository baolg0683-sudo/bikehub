"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import styles from "./profile.module.css";

interface ProfileData {
  user_id?: number;
  role?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  date_of_birth?: string | null;
  age?: number | null;
  reputation_score?: number | null;
}

interface ReviewData {
  review_id: number;
  order_id: number;
  rating: number;
  comment: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  target_name?: string;
  order_status?: string;
  order_price?: string | null;
  created_at?: string;
}

export default function ProfilePage() {
  const auth = useAuth();
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<ProfileData>({});
  const [reviews, setReviews] = useState<{ received: ReviewData[]; given: ReviewData[] }>({ received: [], given: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    avatar_url: "",
    full_name: "",
    date_of_birth: "",
    current_password: "",
    new_password: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string>("");
  const [passwordMode, setPasswordMode] = useState(false);
  const [inlineEditField, setInlineEditField] = useState<"full_name" | "date_of_birth" | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [inlineError, setInlineError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = auth.accessToken ?? window.sessionStorage.getItem("access_token") ?? "";
    setToken(storedToken);
    if (storedToken) {
      fetchProfile(storedToken);
      fetchReviews(storedToken);
    }
  }, [auth.accessToken]);

  const fetchProfile = async (bearerToken: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      });
      const result = await parseResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể tải thông tin hồ sơ");
      }
      setProfile(result.data);
      setForm({
        avatar_url: result.data.avatar_url ?? "",
        full_name: result.data.full_name ?? "",
        date_of_birth: result.data.date_of_birth ?? "",
        current_password: "",
        new_password: "",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (bearerToken: string) => {
    try {
      const response = await fetch("/api/users/me/reviews", {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      });
      const result = await parseResponse(response);
      if (response.ok && result.success) {
        setReviews({
          received: result.data.received_reviews || [],
          given: result.data.given_reviews || [],
        });
      }
    } catch (err) {
      console.error("Unable to load reviews:", err);
    }
  };

  const validateDateOfBirth = (value: string) => {
    if (!value) return "Ngày sinh không được để trống.";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return "Ngày sinh không hợp lệ.";
    }
    const today = new Date();
    if (parsedDate > today) {
      return "Ngày sinh không thể lớn hơn ngày hiện tại.";
    }
    const age = today.getFullYear() - parsedDate.getFullYear() - (today.getMonth() < parsedDate.getMonth() || (today.getMonth() === parsedDate.getMonth() && today.getDate() < parsedDate.getDate()) ? 1 : 0);
    if (age < 10) {
      return "Ngày sinh phải lớn hơn 10 tuổi.";
    }
    return "";
  };

  const updateProfileData = async (updateData: Record<string, unknown>) => {
    if (!token) {
      throw new Error("Vui lòng đăng nhập trước khi cập nhật hồ sơ.");
    }
    const response = await fetch("/api/users/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });
    const result = await parseResponse(response);
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Cập nhật hồ sơ thất bại");
    }
    setProfile(result.data);
    auth.updateUser({
      full_name: result.data.full_name,
      email: result.data.email,
      avatar_url: result.data.avatar_url,
    });
    setMessage("Thông tin hồ sơ đã được cập nhật thành công.");
    await fetchProfile(token);
    return result.data;
  };

  const handleAvatarFileChange = async (file: File | null) => {
    if (!file) {
      setLocalAvatarPreview("");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setLocalAvatarPreview(result);
      setLoading(true);
      setMessage("");
      setError("");
      try {
        await updateProfileData({ avatar_url: result });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordConfirm = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    if (!form.current_password.trim() || !form.new_password.trim()) {
      setError("Cần nhập mật khẩu cũ và mật khẩu mới.");
      setLoading(false);
      return;
    }
    if (form.new_password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      setLoading(false);
      return;
    }
    try {
      await updateProfileData({
        password: form.new_password,
        current_password: form.current_password,
      });
      setForm((prev) => ({ ...prev, current_password: "", new_password: "" }));
      setPasswordMode(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineEditStart = (field: "full_name" | "date_of_birth") => {
    setInlineError("");
    setError("");
    setInlineEditField(field);
    setInlineEditValue("");
  };

  const handleInlineFieldSave = async (field: "full_name" | "date_of_birth") => {
    setInlineError("");
    if (!inlineEditValue.trim()) {
      setInlineError("Giá trị mới không được để trống.");
      return;
    }
    if (field === "full_name" && inlineEditValue.trim().length < 2) {
      setInlineError("Họ và tên phải có ít nhất 2 ký tự.");
      return;
    }
    if (field === "date_of_birth") {
      const dateError = validateDateOfBirth(inlineEditValue);
      if (dateError) {
        setInlineError(dateError);
        return;
      }
    }

    setLoading(true);
    setMessage("");
    setError("");
    try {
      await updateProfileData(
        field === "full_name"
          ? { full_name: inlineEditValue.trim() }
          : { date_of_birth: inlineEditValue }
      );
      setInlineEditField(null);
      setInlineEditValue("");
    } catch (err) {
      setInlineError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineCancel = () => {
    setInlineError("");
    setError("");
    setInlineEditField(null);
    setInlineEditValue("");
  };

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text || "Phản hồi không hợp lệ từ máy chủ" };
    }
  };

  const handleReload = () => {
    if (!token) {
      setError("Không có token để tải lại hồ sơ.");
      return;
    }
    setMessage("");
    setError("");
    fetchProfile(token);
    fetchReviews(token);
  };

  const previewSrc = localAvatarPreview || profile.avatar_url || "";
  const avatarImage = previewSrc ? (
    <img src={previewSrc} alt="Avatar" className={styles.profileAvatar} />
  ) : (
    <div className={styles.profileAvatarPlaceholder}>
      {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
    </div>
  );

  const renderReviewCard = (review: ReviewData, type: "received" | "given") => (
    <div key={review.review_id} className={styles.reviewCard}>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>Đơn hàng:</span>
        <span>#{review.order_id}</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>Trạng thái:</span>
        <span>{review.order_status || "Chưa rõ"}</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>Đánh giá:</span>
        <span>{review.rating}/5</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>{type === "received" ? "Người đánh giá" : "Người được đánh giá"}:</span>
        <span>{type === "received" ? review.reviewer_name || "Không rõ" : review.target_name || "Không rõ"}</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>Nội dung:</span>
        <span>{review.comment || "Không có bình luận"}</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>Giá trị đơn:</span>
        <span>{review.order_price ? `${review.order_price} VND` : "Chưa có"}</span>
      </div>
      <div className={styles.reviewRow}> 
        <span className={styles.reviewLabel}>Ngày:</span>
        <span>{review.created_at ? new Date(review.created_at).toLocaleDateString('vi-VN') : "Không rõ"}</span>
      </div>
    </div>
  );

  return (
    <section className={styles.profilePage}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.profileTitle}>Hồ sơ cá nhân</h1>
          <p className={styles.profileIntro}>
            Cập nhật avatar, tên, tuổi và mật khẩu. Xem đánh giá đã nhận và đã cho.
          </p>
        </div>
        <button type="button" onClick={handleReload} className={styles.buttonSecondary}>
          Tải lại hồ sơ
        </button>
      </div>

      {!token ? (
        <div className={styles.loginPrompt}>
          <p>Bạn cần đăng nhập để truy cập hồ sơ. Vui lòng đăng nhập trước khi tiếp tục.</p>
          <Link href="/login" className={styles.linkButton}>Đến trang đăng nhập</Link>
        </div>
      ) : (
        <>
          {message && <div className={`${styles.feedbackMessage} ${styles.feedbackSuccess}`}>{message}</div>}
          {error && <div className={`${styles.feedbackMessage} ${styles.feedbackError}`}>{error}</div>}

          <div className={styles.profileBody}>
            <aside className={styles.profilePanel}>
                <div className={styles.profilePanelTop}>
                <div className={styles.avatarWrapper}>
                  {avatarImage}
                </div>
                <div className={styles.profileName}>{profile.full_name || "Người dùng"}</div>
              </div>
            </aside>
            <main className={styles.profileContent}>
              <div className={styles.infoContainer}>
                <div className={styles.contentCard}>
                  <h2 className={styles.sectionTitle}>Thông tin đăng nhập</h2>
                  <div className={styles.infoRow}>
                    <span>Số điện thoại</span>
                    <span>{profile.phone || "Chưa có thông tin"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Email</span>
                    <span>{profile.email || "Chưa có thông tin"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Mật khẩu</span>
                    <span>********</span>
                  </div>
                </div>

                <div className={styles.contentCard}>
                  <h2 className={styles.sectionTitle}>Thông tin cá nhân</h2>
                  <div className={styles.infoRow}>
                    <span>Họ và tên</span>
                    <div className={styles.inlineRow}>
                      {inlineEditField === "full_name" ? (
                        <>
                          <input
                            type="text"
                            className={styles.inlineInput}
                            value={inlineEditValue}
                            onChange={(event) => setInlineEditValue(event.target.value)}
                            placeholder="Nhập tên mới"
                          />
                          <button type="button" className={styles.inlineButton} onClick={() => handleInlineFieldSave("full_name")}>
                            Xong
                          </button>
                          <button type="button" className={styles.inlineCancelButton} onClick={handleInlineCancel}>
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{profile.full_name || "Chưa có thông tin"}</span>
                          <button type="button" className={styles.inlineButton} onClick={() => handleInlineEditStart("full_name")}>Thay đổi</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Ngày sinh</span>
                    <div className={styles.inlineRow}>
                      {inlineEditField === "date_of_birth" ? (
                        <>
                          <input
                            type="date"
                            className={styles.inlineInput}
                            value={inlineEditValue}
                            onChange={(event) => setInlineEditValue(event.target.value)}
                          />
                          <button type="button" className={styles.inlineButton} onClick={() => handleInlineFieldSave("date_of_birth")}>Xong</button>
                          <button type="button" className={styles.inlineCancelButton} onClick={handleInlineCancel}>Hủy</button>
                        </>
                      ) : (
                        <>
                          <span>{profile.date_of_birth || "Chưa có thông tin"}</span>
                          <button type="button" className={styles.inlineButton} onClick={() => handleInlineEditStart("date_of_birth")}>Thay đổi</button>
                        </>
                      )}
                    </div>
                  </div>
                  {inlineError && <div className={styles.inlineError}>{inlineError}</div>}
                  <div className={styles.infoRow}>
                    <span>Tuổi</span>
                    <span>{profile.age ?? "Chưa có"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Điểm uy tín</span>
                    <span>{profile.reputation_score ?? "Chưa có"}</span>
                  </div>
                </div>
              </div>

              <div className={styles.editCard}>
                <div className={styles.editCardHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Cập nhật hồ sơ</h2>
                    <p className={styles.sectionDescription}>Chỉ đổi mật khẩu và avatar. Mọi thao tác sẽ tự xác nhận ngay khi hoàn tất.</p>
                  </div>
                </div>
                <div className={styles.profileForm}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Ảnh đại diện</label>
                    <div className={styles.avatarEditRow}>
                      {avatarImage}
                      <label className={styles.avatarUploadButton} htmlFor="avatar_file">
                        Chọn ảnh mới
                      </label>
                    </div>
                    <input
                      id="avatar_file"
                      type="file"
                      accept="image/*"
                      className={styles.avatarInput}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setAvatarFile(file);
                        handleAvatarFileChange(file);
                      }}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <button
                      type="button"
                      className={styles.passwordToggleButton}
                      onClick={() => {
                        setPasswordMode((prev) => !prev);
                        setError("");
                        setInlineError("");
                      }}
                    >
                      {passwordMode ? "Hủy đổi mật khẩu" : "Đổi mật khẩu"}
                    </button>
                  </div>

                  {passwordMode && (
                    <>
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="current_password">Mật khẩu cũ</label>
                        <input
                          id="current_password"
                          type="password"
                          value={form.current_password}
                          onChange={(event) => setForm({ ...form, current_password: event.target.value })}
                          className={styles.fieldInput}
                          placeholder="Nhập mật khẩu cũ"
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="new_password">Mật khẩu mới</label>
                        <input
                          id="new_password"
                          type="password"
                          value={form.new_password}
                          onChange={(event) => setForm({ ...form, new_password: event.target.value })}
                          className={styles.fieldInput}
                          placeholder="Nhập mật khẩu mới"
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <button type="button" className={styles.buttonPrimary} onClick={handlePasswordConfirm} disabled={loading}>
                          {loading ? "Đang cập nhật..." : "Xong"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.reviewSection}>
                <h2 className={styles.sectionTitle}>Đánh giá đã nhận</h2>
                {reviews.received.length ? (
                  reviews.received.map((review) => renderReviewCard(review, "received"))
                ) : (
                  <p className={styles.emptyState}>Chưa có đánh giá nào được nhận.</p>
                )}

                <h2 className={styles.sectionTitle}>Đánh giá đã cho</h2>
                {reviews.given.length ? (
                  reviews.given.map((review) => renderReviewCard(review, "given"))
                ) : (
                  <p className={styles.emptyState}>Bạn chưa đánh giá đơn hàng nào.</p>
                )}
              </div>
            </main>
          </div>
        </>
      )}
    </section>
  );
}
