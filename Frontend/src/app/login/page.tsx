'use client';

import { FormEvent, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

type AuthMode = "login" | "register";

interface FormData {
  email: string;
  password: string;
  phone: string;
  fullName: string;
  dateOfBirth: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  phone?: string;
  fullName?: string;
  dateOfBirth?: string;
}

interface ValidationSuccess {
  email?: string;
  phone?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState<string>("");
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    phone: "",
    fullName: "",
    dateOfBirth: ""
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [success, setSuccess] = useState<ValidationSuccess>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [checkingUniqueness, setCheckingUniqueness] = useState<{email: boolean, phone: boolean}>({
    email: false,
    phone: false
  });

  // Debounce timers for uniqueness checks
  const debounceTimers = useRef<{email?: NodeJS.Timeout, phone?: NodeJS.Timeout}>({});

  // Check uniqueness function
  const checkUniqueness = async (field: 'email' | 'phone', value: string) => {
    if (!value) return;

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

      if (data.success) {
        const isAvailable = data.available[field];
        setSuccess(prev => ({
          ...prev,
          [field]: isAvailable ? `${field === 'email' ? 'Email' : 'Số điện thoại'} hợp lệ` : undefined
        }));
        setErrors(prev => ({
          ...prev,
          [field]: isAvailable ? undefined : `${field === 'email' ? 'Email' : 'Số điện thoại'} đã tồn tại`
        }));
      }
    } catch (error) {
      console.error('Error checking uniqueness:', error);
    } finally {
      setCheckingUniqueness(prev => ({ ...prev, [field]: false }));
    }
  };

  // Debounced uniqueness check
  const debouncedCheckUniqueness = (field: 'email' | 'phone', value: string) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }

    debounceTimers.current[field] = setTimeout(() => {
      checkUniqueness(field, value);
    }, 500); // 500ms debounce
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Validation functions
  const validateEmail = (email: string): string | undefined => {
    if (!email) return "Email là bắt buộc";
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) return "Email không hợp lệ";
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone) return "Số điện thoại là bắt buộc";
    const cleaned = phone.replace(/[^0-9+]/g, '');
    const digitsOnly = cleaned.replace(/[^0-9]/g, '');
    
    // Check if starts with 0
    if (!digitsOnly.startsWith('0')) return "Số điện thoại phải bắt đầu bằng 0";
    
    // Check length (10-11 digits for Vietnam)
    if (digitsOnly.length < 10 || digitsOnly.length > 11) return "Số điện thoại không hợp lệ (10-11 chữ số)";
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return "Mật khẩu là bắt buộc";
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự";
    return undefined;
  };

  const validateFullName = (fullName: string): string | undefined => {
    if (!fullName) return "Họ tên là bắt buộc";
    if (fullName.length < 2) return "Họ tên không hợp lệ";
    return undefined;
  };

  const validateDateOfBirth = (dateOfBirth: string): string | undefined => {
    if (!dateOfBirth) return undefined; // Optional field
    const date = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear() - (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate()) ? 1 : 0);
    if (age < 13) return "Bạn phải từ 13 tuổi trở lên";
    if (age > 120) return "Ngày sinh không hợp lệ";
    return undefined;
  };

  // Update validation on form data change
  useEffect(() => {
    const newErrors: ValidationErrors = {};
    const newSuccess: ValidationSuccess = {};

    if (mode === "register") {
      // Validate full name
      newErrors.fullName = validateFullName(formData.fullName);

      // Validate date of birth
      newErrors.dateOfBirth = validateDateOfBirth(formData.dateOfBirth);

      // Validate email format first
      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
        newSuccess.email = undefined;
      } else if (formData.email) {
        // Format is valid, check uniqueness if not already checking
        if (!checkingUniqueness.email) {
          debouncedCheckUniqueness('email', formData.email);
        }
      }

      // Validate phone format first
      const phoneError = validatePhone(formData.phone);
      if (phoneError) {
        newErrors.phone = phoneError;
        newSuccess.phone = undefined;
      } else if (formData.phone) {
        // Format is valid, check uniqueness if not already checking
        if (!checkingUniqueness.phone) {
          debouncedCheckUniqueness('phone', formData.phone);
        }
      }

      // Validate password
      newErrors.password = validatePassword(formData.password);
    } else {
      // For login, only validate identifier and password
      const identifier = formData.email || formData.phone;
      if (!identifier) {
        newErrors.email = "Email hoặc số điện thoại là bắt buộc";
      } else {
        // Check if it's email or phone
        if (identifier.includes('@')) {
          newErrors.email = validateEmail(identifier);
        } else {
          newErrors.phone = validatePhone(identifier);
        }
      }
      newErrors.password = validatePassword(formData.password);
    }

    setErrors(newErrors);
    setSuccess(newSuccess);
    setIsFormValid(Object.values(newErrors).every(error => !error));
  }, [formData, mode]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProtectedClick = () => {
    setNotice("Bạn cần đăng nhập trước khi sử dụng chức năng này.");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid) {
      setNotice("Vui lòng sửa các lỗi trước khi tiếp tục.");
      return;
    }

    setNotice(
      mode === "login"
        ? "Đang đăng nhập..."
        : "Đang tạo tài khoản..."
    );

    try {
      if (mode === "register") {
        // Register
        const response = await fetch('/api/users/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            full_name: formData.fullName,
            date_of_birth: formData.dateOfBirth || null,
            role: 'USER',
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setNotice("Đăng ký thành công! Vui lòng đăng nhập.");
          setFormData({
            email: "",
            password: "",
            phone: "",
            fullName: "",
            dateOfBirth: ""
          });
          setMode("login");
        } else {
          setNotice(data.message || "Đăng ký thất bại. Vui lòng thử lại.");
        }
      } else {
        // Login
        const identifier = formData.email || formData.phone;
        const response = await fetch('/api/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: identifier,
            password: formData.password,
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setNotice("Đăng nhập thành công!");
          // Store tokens if needed
          localStorage.setItem('access_token', data.data.access_token);
          localStorage.setItem('refresh_token', data.data.refresh_token);
          // Redirect to home after 1 second to show success message
          setTimeout(() => {
            router.push('/');
          }, 1000);
        } else {
          setNotice(data.message || "Đăng nhập thất bại. Vui lòng thử lại.");
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setNotice("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  return (
    <div className={styles.loginPage}>
      <section className={styles.loginHero}>
        <div className={styles.loginHeroCopy}>
          <span className={styles.eyebrow}>BikeMarket</span>
          <h1>Đăng nhập hoặc tạo tài khoản để sử dụng đầy đủ tính năng</h1>

          <div className={styles.heroActions}>
            <button
              className={`${styles.heroAction} ${mode === "login" ? styles.active : ""}`}
              onClick={() => setMode("login")}
            >
              Đăng nhập
            </button>
            <button
              className={`${styles.heroAction} ${mode === "register" ? styles.active : ""}`}
              onClick={() => setMode("register")}
            >
              Đăng ký
            </button>
          </div>
        </div>

        <div className={styles.loginHeroPanel}>
          <div className={styles.panelHeadline}>Tính năng cho người dùng</div>
          <div className={styles.panelList}>
            <div className={styles.panelItem}>
              <div className={styles.panelItemTitle}>Xem tin đăng</div>
              <div className={styles.panelItemText}>
                Duyệt xe, xem chi tiết và lưu lại tin bạn quan tâm.
              </div>
            </div>
            <div className={styles.panelItem}>
              <div className={styles.panelItemTitle}>Đăng tin</div>
              <div className={styles.panelItemText}>
                Đăng bán hoặc mua xe nhanh chóng khi đã có tài khoản.
              </div>
            </div>
            <div className={styles.panelItem}>
              <div className={styles.panelItemTitle}>Tin nhắn</div>
              <div className={styles.panelItemText}>
                Nhận thông báo khi có người hỏi mua hoặc bán xe.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.authSection}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
          </div>

          <div className={styles.authCopy}>
            {mode === "login" ? (
              <>
                <p>Đăng nhập bằng email hoặc số điện thoại.</p>
                <p className={styles.authNote}>
                  Nếu bạn chưa có tài khoản, chọn Đăng ký ngay phía trên.
                </p>
              </>
            ) : (
              <>
                <p>Tạo tài khoản mới với thông tin chính xác.</p>
                <p className={styles.authNote}>
                  Nhập họ tên, ngày sinh (tùy chọn), số điện thoại, email và mật khẩu hợp lệ.
                </p>
              </>
            )}
          </div>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    placeholder="Họ và tên"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className={errors.fullName ? styles.inputError : ''}
                    required
                  />
                  {errors.fullName && <span className={styles.errorText}>{errors.fullName}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <input
                    type="date"
                    placeholder="Ngày sinh (tùy chọn)"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className={errors.dateOfBirth ? styles.inputError : ''}
                  />
                  {errors.dateOfBirth && <span className={styles.errorText}>{errors.dateOfBirth}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <input
                    type="tel"
                    placeholder="Số điện thoại"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={errors.phone ? styles.inputError : success.phone ? styles.inputSuccess : ''}
                    required
                  />
                  {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                  {success.phone && !errors.phone && <span className={styles.successText}>{success.phone}</span>}
                  {checkingUniqueness.phone && <span className={styles.checkingText}>Đang kiểm tra...</span>}
                </div>

                <div className={styles.inputGroup}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? styles.inputError : success.email ? styles.inputSuccess : ''}
                    required
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                  {success.email && !errors.email && <span className={styles.successText}>{success.email}</span>}
                  {checkingUniqueness.email && <span className={styles.checkingText}>Đang kiểm tra...</span>}
                </div>

                <div className={styles.inputGroup}>
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={errors.password ? styles.inputError : ''}
                    required
                  />
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>
              </>
            )}

            {mode === "login" && (
              <>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    placeholder="Email hoặc số điện thoại"
                    value={formData.email || formData.phone}
                    onChange={(e) => {
                      // Clear both fields first, then set the appropriate one
                      const value = e.target.value;
                      if (value.includes('@')) {
                        setFormData(prev => ({ ...prev, email: value, phone: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, email: '', phone: value }));
                      }
                    }}
                    className={(errors.email || errors.phone) ? styles.inputError : ''}
                    required
                  />
                  {(errors.email || errors.phone) && (
                    <span className={styles.errorText}>
                      {errors.email || errors.phone}
                    </span>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={errors.password ? styles.inputError : ''}
                    required
                  />
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>
              </>
            )}

            <button
              type="submit"
              className={styles.authSubmit}
              disabled={!isFormValid}
            >
              {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <div className={styles.authFooter}>
            {mode === "login" ? (
              <>
                <span>
                  Chưa có tài khoản?{' '}
                  <button className={styles.linkButton} onClick={() => setMode("register")}>Đăng ký</button>
                </span>
                <button className={styles.linkButton}>Quên mật khẩu?</button>
              </>
            ) : (
              <span>
                Đã có tài khoản?{' '}
                <button className={styles.linkButton} onClick={() => setMode("login")}>Đăng nhập</button>
              </span>
            )}
          </div>
        </div>
      </section>

      {notice && <div className={styles.loginNotice}>{notice}</div>}
    </div>
  );
}
