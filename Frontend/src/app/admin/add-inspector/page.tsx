'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import styles from './add-inspector.module.css';

export default function AddInspectorPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [checkingUniqueness, setCheckingUniqueness] = useState({ email: false, phone: false });
  const debounceTimers = useRef<{ email?: NodeJS.Timeout; phone?: NodeJS.Timeout }>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [serviceArea, setServiceArea] = useState('');

  const validateEmail = (value: string) => {
    if (!value) return 'Email là bắt buộc.';
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(value)) return 'Email không hợp lệ.';
    return '';
  };

  const validatePhone = (value: string) => {
    if (!value) return 'Số điện thoại là bắt buộc.';
    const cleaned = value.replace(/[^0-9+]/g, '');
    const digitsOnly = cleaned.replace(/[^0-9]/g, '');
    if (!digitsOnly.startsWith('0')) return 'Số điện thoại phải bắt đầu bằng 0.';
    if (digitsOnly.length < 10 || digitsOnly.length > 11) return 'Số điện thoại không hợp lệ (10-11 chữ số).';
    return '';
  };

  const validateDateOfBirth = (value: string) => {
    if (!value) return 'Ngày sinh là bắt buộc.';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Ngày sinh không hợp lệ.';
    const today = new Date();
    if (parsed > today) return 'Ngày sinh không thể lớn hơn ngày hiện tại.';
    const age = today.getFullYear() - parsed.getFullYear() - ((today.getMonth() < parsed.getMonth() || (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())) ? 1 : 0);
    if (age < 13) return 'Bạn phải từ 13 tuổi trở lên.';
    return '';
  };

  const validatePassword = (value: string) => {
    if (!value) return 'Mật khẩu là bắt buộc.';
    if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
    return '';
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const validation = validateEmail(value);
    setEmailError(validation);
    if (!validation && value) {
      debouncedCheckUniqueness('email', value);
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    const validation = validatePhone(value);
    setPhoneError(validation);
    if (!validation && value) {
      debouncedCheckUniqueness('phone', value);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const validation = validatePassword(value);
    setPasswordError(validation);
    setConfirmPasswordError(value && confirmPassword && value !== confirmPassword ? 'Mật khẩu xác nhận không khớp.' : '');
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmPasswordError(password && value !== password ? 'Mật khẩu xác nhận không khớp.' : '');
  };

  const checkUniqueness = async (field: 'email' | 'phone', value: string) => {
    setCheckingUniqueness(prev => ({ ...prev, [field]: true }));

    try {
      const response = await fetch('/api/users/check-uniqueness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const available = data.available[field];
        if (!available) {
          const message = field === 'email' ? 'Email đã tồn tại.' : 'Số điện thoại đã tồn tại.';
          field === 'email' ? setEmailError(message) : setPhoneError(message);
        } else {
          field === 'email' ? setEmailError('') : setPhoneError('');
        }
        return available;
      } else {
        const errorMessage = data.message || 'Lỗi kiểm tra thông tin';
        field === 'email' ? setEmailError(errorMessage) : setPhoneError(errorMessage);
      }
    } catch (error) {
      const errorMessage = 'Không thể kiểm tra thông tin hiện tại';
      field === 'email' ? setEmailError(errorMessage) : setPhoneError(errorMessage);
      return false;
    } finally {
      setCheckingUniqueness(prev => ({ ...prev, [field]: false }));
    }
  };

  const debouncedCheckUniqueness = (field: 'email' | 'phone', value: string) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }

    debounceTimers.current[field] = setTimeout(() => {
      checkUniqueness(field, value);
    }, 500);
  };

  const handleAvatarFileChange = (file: File | null) => {
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarDataUrl('');
      setAvatarError('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('Vui lòng chọn tệp hình ảnh hợp lệ.');
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarDataUrl('');
      return;
    }

    if (file.size > 5_000_000) {
      setMessage('Kích thước ảnh tối đa 5MB.');
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarDataUrl('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setAvatarPreview(result);
        setAvatarDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

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

    const emailValidate = validateEmail(email);
    const phoneValidate = validatePhone(phone);
    const dateOfBirthValidate = validateDateOfBirth(dateOfBirth);
    const passwordValidate = validatePassword(password);
    const confirmPasswordValidate = password !== confirmPassword ? 'Mật khẩu xác nhận không khớp.' : '';

    setEmailError(emailValidate);
    setPhoneError(phoneValidate);
    setDateOfBirthError(dateOfBirthValidate);
    setPasswordError(passwordValidate);
    setConfirmPasswordError(confirmPasswordValidate);
    setAvatarError(avatarDataUrl ? '' : 'Ảnh đại diện là bắt buộc.');

    if (
      emailValidate ||
      phoneValidate ||
      dateOfBirthValidate ||
      passwordValidate ||
      confirmPasswordValidate ||
      !fullName ||
      !avatarDataUrl
    ) {
      setMessage(
        emailValidate ||
          phoneValidate ||
          dateOfBirthValidate ||
          passwordValidate ||
          confirmPasswordValidate ||
          (!fullName ? 'Họ tên là bắt buộc.' : '') ||
          (!avatarDataUrl ? 'Ảnh đại diện là bắt buộc.' : '')
      );
      return;
    }

    if (checkingUniqueness.email || checkingUniqueness.phone) {
      setMessage('Đang kiểm tra email/số điện thoại, vui lòng chờ.');
      return;
    }

    const emailAvailable = await checkUniqueness('email', email);
    const phoneAvailable = await checkUniqueness('phone', phone);
    if (!emailAvailable || !phoneAvailable) {
      setMessage('Vui lòng sửa các lỗi email/số điện thoại trước khi tiếp tục.');
      return;
    }

    if (emailError || phoneError) {
      setMessage('Vui lòng sửa các lỗi email/số điện thoại trước khi tiếp tục.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users/create', {
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
          date_of_birth: dateOfBirth,
          avatar_url: avatarDataUrl,
          role: 'INSPECTOR',
          service_area: serviceArea,
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
      setDateOfBirth('');
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarDataUrl('');
      setPassword('');
      setConfirmPassword('');
      setEmailError('');
      setPhoneError('');
      setPasswordError('');
      setConfirmPasswordError('');
      setDateOfBirthError('');
      setAvatarError('');
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
          <div className={styles.formGrid}>
            <div className={styles.formFields}>
              <label className={styles.fieldLabel}>
                Email
                <input
                  className={styles.inputField}
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  aria-invalid={!!emailError}
                />
                {emailError && <p className={styles.fieldError}>{emailError}</p>}
              </label>
              <label className={styles.fieldLabel}>
                Số điện thoại
                <input
                  className={styles.inputField}
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  aria-invalid={!!phoneError}
                />
                {phoneError && <p className={styles.fieldError}>{phoneError}</p>}
              </label>
              <label className={styles.fieldLabel}>
                Họ tên
                <input className={styles.inputField} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className={styles.fieldLabel}>
                Ngày sinh
                <input
                  className={styles.inputField}
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDateOfBirth(value);
                    setDateOfBirthError(validateDateOfBirth(value));
                  }}
                  aria-invalid={!!dateOfBirthError}
                />
                {dateOfBirthError && <p className={styles.fieldError}>{dateOfBirthError}</p>}
              </label>
              <label className={styles.fieldLabel}>
                Khu vực hoạt động
                <select
                  className={styles.inputField}
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                >
                  <option value="">Chọn khu vực</option>
                  <option value="TPHCM">TPHCM</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Hà Nội">Hà Nội</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Mật khẩu
                <input
                  className={styles.inputField}
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  aria-invalid={!!passwordError}
                />
                {passwordError && <p className={styles.fieldError}>{passwordError}</p>}
              </label>
              <label className={styles.fieldLabel}>
                Xác nhận mật khẩu
                <input
                  className={styles.inputField}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  aria-invalid={!!confirmPasswordError}
                />
                {confirmPasswordError && <p className={styles.fieldError}>{confirmPasswordError}</p>}
              </label>
            </div>

            <div className={styles.uploadPanel}>
              <div className={styles.uploadCard}>
                <h2 className={styles.uploadTitle}>Ảnh đại diện</h2>
                <div className={styles.avatarPreviewWrapper}>
                  {avatarPreview ? (
                    <img className={styles.avatarPreview} src={avatarPreview} alt="Xem trước avatar" />
                  ) : (
                    <div className={styles.avatarPlaceholder}>Chưa có ảnh</div>
                  )}
                </div>
                <label htmlFor="avatar_file" className={styles.uploadButton}>
                  Chọn ảnh để tải lên
                </label>
                <input
                  id="avatar_file"
                  type="file"
                  accept="image/*"
                  className={styles.hiddenFileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    handleAvatarFileChange(file);
                  }}
                />
                <p className={styles.uploadHint}>Ảnh tối đa 5MB. Hỗ trợ JPG/PNG.</p>
                {avatarError && <p className={styles.fieldError}>{avatarError}</p>}
              </div>
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Đang tạo...' : 'Tạo người kiểm định'}
          </button>
          {message && <div className={styles.message}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
