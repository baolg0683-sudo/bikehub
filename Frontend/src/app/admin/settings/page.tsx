'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import styles from '../page.module.css';

export default function AdminSettingsPage() {
  const { loggedIn, initialized, user, accessToken, updateUser } = useAuth();
  const router = useRouter();
  const token = resolveAccessToken(accessToken);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pwData, setPwData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/'); }
  }, [initialized, loggedIn, user, router]);

  // Load admin profile from API (fresh data)
  useEffect(() => {
    if (!token || !loggedIn) return;
    fetch('http://localhost:9999/api/admin/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.user_id) {
          setFormData({
            full_name: data.full_name || '',
            email: data.email || '',
            phone: data.phone || '',
          });
          setAvatarPreview(data.avatar_url || null);
        }
      })
      .catch(() => {
        // fallback to context
        if (user) {
          setFormData({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '' });
          setAvatarPreview(user.avatar_url || null);
        }
      });
  }, [token, loggedIn]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !token || !user) return;
    setAvatarLoading(true);
    setProfileMsg(null);
    try {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      const res = await fetch('http://localhost:9999/api/admin/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Không thể upload avatar');
      const data = await res.json();
      setAvatarPreview(data.avatar_url);
      setAvatarFile(null);
      updateUser({ ...user, avatar_url: data.avatar_url });
      setProfileMsg({ type: 'success', text: 'Avatar đã được cập nhật' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      const res = await fetch('http://localhost:9999/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể cập nhật thông tin');
      updateUser({ ...user, ...formData });
      setProfileMsg({ type: 'success', text: 'Thông tin đã được cập nhật' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (pwData.new_password !== pwData.confirm_password) {
      setPwMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch('http://localhost:9999/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: pwData.current_password,
          new_password: pwData.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi đổi mật khẩu');
      setPwMsg({ type: 'success', text: data.message || 'Đổi mật khẩu thành công' });
      setPwData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className={styles.adminPage}>
      <AdminSidebar active="settings" />
      <section className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.pageLabel}>Cài đặt</p>
            <h1 className={styles.pageTitle}>Thông tin cá nhân</h1>
            <p className={styles.pageSubtitle}>Quản lý thông tin và bảo mật tài khoản admin</p>
          </div>
        </header>

        {/* Profile card */}
        <div className={styles.settingsCard}>
          <h2 className={styles.settingsSectionTitle}>Thông tin cá nhân</h2>

          {profileMsg && (
            <div className={`${styles.message} ${styles[profileMsg.type]}`}>{profileMsg.text}</div>
          )}

          <div className={styles.avatarSection}>
            <div className={styles.avatarPreview}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {formData.full_name?.charAt(0) || 'A'}
                </div>
              )}
            </div>
            <div className={styles.avatarControls}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className={styles.avatarBtn}>
                Chọn ảnh
              </button>
              {avatarFile && (
                <button type="button" onClick={handleAvatarUpload} disabled={avatarLoading} className={styles.uploadBtn}>
                  {avatarLoading ? 'Đang upload...' : 'Upload ảnh'}
                </button>
              )}
              <p className={styles.avatarHint}>JPG, PNG tối đa 5MB</p>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className={styles.profileForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="full_name">Họ tên</label>
                <input type="text" id="full_name" name="full_name" value={formData.full_name} onChange={handleInputChange} required />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="phone">Số điện thoại</label>
                <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required />
            </div>
            <button type="submit" disabled={profileLoading} className={styles.saveBtn}>
              {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>

        {/* Password card */}
        <div className={styles.settingsCard}>
          <h2 className={styles.settingsSectionTitle}>Đổi mật khẩu</h2>

          {pwMsg && (
            <div className={`${styles.message} ${styles[pwMsg.type]}`}>{pwMsg.text}</div>
          )}

          <form onSubmit={handlePasswordChange} className={styles.profileForm}>
            <div className={styles.formGroup}>
              <label htmlFor="current_password">Mật khẩu hiện tại</label>
              <input
                type="password"
                id="current_password"
                value={pwData.current_password}
                onChange={e => setPwData(p => ({ ...p, current_password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="new_password">Mật khẩu mới</label>
                <input
                  type="password"
                  id="new_password"
                  value={pwData.new_password}
                  onChange={e => setPwData(p => ({ ...p, new_password: e.target.value }))}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="confirm_password">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  id="confirm_password"
                  value={pwData.confirm_password}
                  onChange={e => setPwData(p => ({ ...p, confirm_password: e.target.value }))}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button type="submit" disabled={pwLoading} className={styles.saveBtn}>
              {pwLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
