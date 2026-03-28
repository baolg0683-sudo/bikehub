"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setLoading(true);
    // TODO: Gọi API auth-service
    setTimeout(() => {
      setLoading(false);
      alert("Đăng nhập thành công! (chưa kết nối backend)");
    }, 1000);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img src="/assets/favicon.ico" width={40} height={40} alt="BikeMarket logo" />
          <h1 className="auth-brand">BikeMarket</h1>
        </div>

        <h2 className="auth-title">Đăng nhập</h2>
        <p className="auth-subtitle">Chào mừng bạn trở lại!</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Mật khẩu</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-options">
            <label className="form-check">
              <input type="checkbox" /> Ghi nhớ đăng nhập
            </label>
            <a href="#" className="form-link">Quên mật khẩu?</a>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="auth-switch">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="form-link">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
