"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import styles from "./InspectorProfile.module.css";

interface ProfileData {
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  role?: string;
}

export default function InspectorProfilePage() {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
      return;
    }
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải thông tin hồ sơ.');
      }
      setProfile(result.data);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setError("");
    setMessage("");
    if (!currentPassword.trim() || !newPassword.trim()) {
      setError('Vui lòng nhập mật khẩu cũ và mật khẩu mới.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể cập nhật mật khẩu.');
      }
      setMessage('Mật khẩu đã được cập nhật.');
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMode(false);
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const avatarDisplay = profile.avatar_url ? (
    <img src={profile.avatar_url} alt="Avatar" className={styles.avatarImage} />
  ) : (
    <div className={styles.avatarFallback}>{profile.full_name?.charAt(0).toUpperCase() || 'I'}</div>
  );

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1>Hồ sơ kiểm định viên</h1>
          <p>Chỉ được xem hồ sơ và đổi mật khẩu. Các thông tin khác không thể chỉnh sửa.</p>
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.secondaryButton} onClick={() => router.push('/inspector')}>
            Quay lại Dashboard
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </div>

      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.profileCard}>
        <div className={styles.profileSidebar}>
          <div className={styles.avatarWrapper}>{avatarDisplay}</div>
          <div className={styles.profileName}>{profile.full_name || 'Kiểm định viên'}</div>
          <div className={styles.profileRole}>{profile.role || 'INSPECTOR'}</div>
        </div>
        <div className={styles.profileContent}>
          <div className={styles.profileRow}>
            <span>Email</span>
            <strong>{profile.email || 'Chưa có'}</strong>
          </div>
          <div className={styles.profileRow}>
            <span>Số điện thoại</span>
            <strong>{profile.phone || 'Chưa có'}</strong>
          </div>
          <div className={styles.profileRow}>
            <span>Chức vụ</span>
            <strong>{profile.role || 'INSPECTOR'}</strong>
          </div>

          <div className={styles.passwordSection}>
            <div className={styles.passwordHeader}>
              <h2>Đổi mật khẩu</h2>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => {
                  setPasswordMode((prev) => !prev);
                  setError('');
                  setMessage('');
                }}
              >
                {passwordMode ? 'Hủy' : 'Mở'}
              </button>
            </div>
            {passwordMode ? (
              <div className={styles.passwordForm}>
                <label>
                  Mật khẩu cũ
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className={styles.inputField}
                  />
                </label>
                <label>
                  Mật khẩu mới
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={styles.inputField}
                  />
                </label>
                <button type="button" className={styles.primaryButton} onClick={handlePasswordChange} disabled={submitting}>
                  {submitting ? 'Đang cập nhật...' : 'Xác nhận'}
                </button>
              </div>
            ) : (
              <p className={styles.passwordHint}>Chỉ đổi mật khẩu. Không thể sửa các thông tin hồ sơ khác từ đây.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
