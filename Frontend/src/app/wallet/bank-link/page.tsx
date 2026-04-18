"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { resolveAccessToken } from "../../../utils/accessToken";
import styles from "./bank-link.module.css";

interface BankInfo {
  bank_info_id?: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status?: string;
  admin_note?: string;
  created_at?: string;
  verified_at?: string;
}

export default function BankLinkPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bank_name: "",
    account_number: "",
    account_holder: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [existingBank, setExistingBank] = useState<BankInfo | null>(null);

  useEffect(() => {
    fetchBankInfo();
  }, [accessToken]);

  const fetchBankInfo = async () => {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) return;
      const response = await fetch("http://localhost:9999/api/bank/info", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExistingBank(data);
        setBankInfo({
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_holder: data.account_holder,
        });
      }
    } catch (err: any) {
      console.log("No existing bank info");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setBankInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankInfo.bank_name || !bankInfo.account_number || !bankInfo.account_holder) {
      setStatus("Vui lòng điền tất cả các trường");
      return;
    }

    if (bankInfo.account_number.length < 8 || bankInfo.account_number.length > 20) {
      setStatus("Số tài khoản phải từ 8-20 ký tự");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        setStatus("Vui lòng đăng nhập lại");
        return;
      }
      const response = await fetch("http://localhost:9999/api/bank/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bankInfo),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("✓ Thông tin ngân hàng đã được gửi. Đợi admin xác nhận...");
        setExistingBank({
          ...bankInfo,
          status: "PENDING",
        });
        setTimeout(() => {
          router.push("/wallet/detail");
        }, 2000);
      } else {
        setStatus(`Lỗi: ${data.message}`);
      }
    } catch (err: any) {
      setStatus(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Đang tải...</div>;
  }

  return (
    <div className={styles.bankLinkContainer}>
      <div className={styles.bankLinkCard}>
        <h1>Liên kết tài khoản ngân hàng</h1>
        <p className={styles.description}>
          Để sử dụng tính năng nạp tiền hoặc rút tiền, bạn cần liên kết một tài khoản ngân hàng hợp lệ.
          Admin sẽ kiểm tra và xác nhận thông tin của bạn.
        </p>

        {existingBank && (
          <div className={`${styles.statusBox} ${styles[`status-${existingBank.status?.toLowerCase()}`]}`}>
            <strong>Trạng thái hiện tại:</strong> {getStatusLabel(existingBank.status)}
            {existingBank.status === "REJECTED" && existingBank.admin_note && (
              <p>Lý do từ chối: {existingBank.admin_note}</p>
            )}
            {existingBank.status === "VERIFIED" && (
              <p>✓ Tài khoản của bạn đã được xác nhận. Bạn có thể nạp hoặc rút tiền.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Tên ngân hàng *</label>
            <input
              type="text"
              value={bankInfo.bank_name}
              onChange={(e) => handleChange("bank_name", e.target.value)}
              placeholder="VD: Vietcombank, BIDV, Techcombank..."
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Số tài khoản *</label>
            <input
              type="text"
              value={bankInfo.account_number}
              onChange={(e) => handleChange("account_number", e.target.value)}
              placeholder="VD: 1234567890"
              pattern="[0-9]+"
              required
            />
            <small>8-20 chữ số</small>
          </div>

          <div className={styles.formGroup}>
            <label>Chủ tài khoản *</label>
            <input
              type="text"
              value={bankInfo.account_holder}
              onChange={(e) => handleChange("account_holder", e.target.value)}
              placeholder="Nhập tên chủ tài khoản"
              required
            />
          </div>

          <div className={styles.warning}>
            <strong>⚠️ Lưu ý:</strong>
            <ul>
              <li>Thông tin ngân hàng phải chính xác 100%</li>
              <li>Admin sẽ kiểm tra thông tin trong vòng 1-2 ngày làm việc</li>
              <li>Chỉ khi được xác nhận, bạn mới có thể nạp/rút tiền</li>
              <li>Bạn có thể cập nhật thông tin bằng cách gửi lại biểu mẫu này</li>
            </ul>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={saving || (existingBank?.status === "VERIFIED")}
          >
            {saving ? "Đang gửi..." : "Gửi thông tin ngân hàng"}
          </button>

          {status && (
            <div className={`${styles.statusMessage} ${status.includes("✓") ? styles.success : styles.error}`}>
              {status}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function getStatusLabel(status?: string): string {
  const labels: { [key: string]: string } = {
    pending: "⏳ Chờ xác nhận",
    verified: "✓ Đã xác nhận",
    rejected: "✗ Bị từ chối",
  };
  return labels[status?.toLowerCase() || ""] || "Không xác định";
}
