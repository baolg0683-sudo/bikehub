'use client';

import { FormEvent, useEffect, useState } from "react";
import styles from "./login.module.css";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const handleProtectedClick = () => {
    setNotice("Bạn cần đăng nhập trước khi sử dụng chức năng này.");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(
      mode === "login"
        ? "Đang thử đăng nhập..."
        : "Đang thử tạo tài khoản..."
    );
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
                Đăng bán xe nhanh chóng khi đã có tài khoản.
              </div>
            </div>
            <div className={styles.panelItem}>
              <div className={styles.panelItemTitle}>Tin nhắn</div>
              <div className={styles.panelItemText}>
                Nhận thông báo khi có người hỏi mua.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.authSection}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <button
              className={`${styles.authTab} ${mode === "login" ? styles.active : ""}`}
              onClick={() => setMode("login")}
            >
              Đăng nhập
            </button>
            <button
              className={`${styles.authTab} ${mode === "register" ? styles.active : ""}`}
              onClick={() => setMode("register")}
            >
              Đăng ký
            </button>
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
                <p>Tạo tài khoản mới chỉ với vài bước đơn giản.</p>
                <p className={styles.authNote}>
                  Nhập đầy đủ họ tên, ngày sinh, số điện thoại, email và mật khẩu.
                </p>
              </>
            )}
          </div>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <input type="text" placeholder="Họ và tên" required />
                <input type="date" placeholder="Ngày sinh" required />
                <input type="tel" placeholder="Số điện thoại" required />
                <input type="email" placeholder="Email" required />
                <input type="password" placeholder="Mật khẩu" required />
              </>
            )}

            {mode === "login" && (
              <>
                <input
                  type="text"
                  placeholder="Email hoặc số điện thoại"
                  required
                />
                <input type="password" placeholder="Mật khẩu" required />
              </>
            )}

            <button type="submit" className={styles.authSubmit}>
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
