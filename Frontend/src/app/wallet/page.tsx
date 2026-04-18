"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { resolveAccessToken } from "../../utils/accessToken";
import styles from "./wallet.module.css";

interface WalletInfo {
  user_id: number;
  role: string;
  balance: string;
  currency: string;
}

export default function WalletPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const token = resolveAccessToken(accessToken);
        if (!token) {
          throw new Error("Chưa đăng nhập hoặc phiên đã hết hạn");
        }
        const response = await fetch("http://localhost:9999/api/wallet/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch wallet info");
        }

        const data = await response.json();
        setWallet(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [accessToken]);

  const handleViewDetails = () => {
    router.push("/wallet/detail");
  };

  if (loading) {
    return <div className={styles.loading}>Đang tải...</div>;
  }

  if (error) {
    return <div className={styles.error}>Lỗi: {error}</div>;
  }

  return (
    <div className={styles.walletContainer}>
      <div className={styles.walletCard}>
        <div className={styles.walletHeader}>
          <h1>Ví của tôi</h1>
        </div>

        <div className={styles.balanceSection}>
          <div className={styles.balanceLabel}>Số dư hiện tại</div>
          <div className={styles.balanceAmount}>
            {wallet && (
              <>
                <span className={styles.amount}>
                  {Number(wallet.balance).toLocaleString("vi-VN")}
                </span>
                <span className={styles.currency}>{wallet.currency} BikeCoin</span>
              </>
            )}
          </div>
        </div>

        <button className={styles.detailButton} onClick={handleViewDetails}>
          Xem chi tiết & Quản lý
        </button>

        <div className={styles.walletInfo}>
          <p>
            Ví BikeCoin của bạn được sử dụng để nạp tiền, rút tiền và thanh toán các dịch vụ trên nền tảng.
          </p>
        </div>
      </div>
    </div>
  );
}
