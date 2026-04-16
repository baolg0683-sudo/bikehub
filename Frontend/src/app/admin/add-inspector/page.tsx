'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import styles from './add-inspector.module.css';

export default function AddInspectorPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!loggedIn) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [initialized, loggedIn, user, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!email || !password || !fullName || !phone) {
      setMessage('Vui lòng điền đủ thông tin.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email,
          password,
          phone,
          full_name: fullName,
          role: 'INSPECTOR',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Không thể thêm người kiểm định.');
      }

      setMessage('Thêm người kiểm định thành công.');
      setEmail('');
      setFullName('');
      setPhone('');
      setPassword('');
    } catch (err: any) {
      setMessage(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Thêm người kiểm định</h1>
        <p className={styles.description}>
          Điền thông tin và tạo tài khoản kiểm định mới cho hệ thống.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.fieldLabel}>
            Email
            <input className={styles.inputField} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.fieldLabel}>
            Họ tên
            <input className={styles.inputField} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className={styles.fieldLabel}>
            Số điện thoại
            <input className={styles.inputField} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className={styles.fieldLabel}>
            Mật khẩu
            <input className={styles.inputField} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Đang tạo...' : 'Tạo người kiểm định'}
          </button>
          {message && <div className={styles.message}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
