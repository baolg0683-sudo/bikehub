"use client";

import React, { useEffect, useState } from "react";
import styles from "./profile.module.css";

interface ProfileData {
  user_id?: number;
  username?: string;
  role?: string;
  full_name?: string;
  phone?: string;
}

export default function ProfilePage() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "", password: "" });

  useEffect(() => {
    const storedToken = window.localStorage.getItem("authToken") ?? "";
    setToken(storedToken);
    if (storedToken) {
      fetchProfile(storedToken);
    }
  }, []);

  const fetchProfile = async (bearerToken: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:9999/api/auth/me", {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể tải thông tin hồ sơ");
      }
      setProfile(result.data);
      setForm({
        full_name: result.data.full_name ?? "",
        phone: result.data.phone ?? "",
        password: "",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveToken = () => {
    window.localStorage.setItem("authToken", token);
    setMessage("JWT token đã được lưu. Vui lòng tải lại trang hoặc nhấn Tải hồ sơ.");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (!token) {
      setError("Vui lòng nhập JWT token trước khi cập nhật hồ sơ.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:9999/api/auth/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Cập nhật hồ sơ thất bại");
      }
      setProfile(result.data);
      setMessage("Thông tin hồ sơ đã được cập nhật thành công.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.profilePage}>
      <h1 className={styles.profileTitle}>Hồ sơ cá nhân</h1>
      <p className={styles.profileIntro}>
        Cập nhật thông tin cá nhân của bạn. Nếu bạn đã có JWT token, hãy dán token vào rồi nhấn Lưu token.
      </p>

      <div className={styles.tokenSection}>
        <label className={styles.fieldLabel} htmlFor="token">JWT Token</label>
        <textarea
          id="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          rows={3}
          className={styles.tokenBox}
          placeholder="Dán token ở đây..."
        />
        <button type="button" className={styles.buttonSecondary} onClick={saveToken}>
          Lưu token
        </button>
      </div>

      <button type="button" className={styles.buttonSecondary} onClick={() => fetchProfile(token)}>
        Tải hồ sơ
      </button>

      {message && <div className={`${styles.feedbackMessage} ${styles.feedbackSuccess}`}>{message}</div>}
      {error && <div className={`${styles.feedbackMessage} ${styles.feedbackError}`}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.profileForm}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="username">
            Tên người dùng
          </label>
          <input
            id="username"
            value={profile.username ?? ""}
            disabled
            className={styles.fieldInputDisabled}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="full_name">
            Họ và tên
          </label>
          <input
            id="full_name"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            className={styles.fieldInput}
            placeholder="Nhập họ và tên"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="phone">
            Số điện thoại
          </label>
          <input
            id="phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className={styles.fieldInput}
            placeholder="Nhập số điện thoại"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="password">
            Đổi mật khẩu
          </label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className={styles.fieldInput}
            placeholder="Nhập mật khẩu mới"
          />
        </div>

        <button type="submit" disabled={loading} className={styles.buttonPrimary}>
          {loading ? "Đang cập nhật..." : "Cập nhật hồ sơ"}
        </button>
      </form>
    </section>
  );
}
