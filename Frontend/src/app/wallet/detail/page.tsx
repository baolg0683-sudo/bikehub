"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { resolveAccessToken } from "../../../utils/accessToken";
import styles from "./detail.module.css";

interface BankInfo {
  bank_name: string;
  account_number: string;
  account_holder: string;
}

interface Transaction {
  transaction_id: number;
  user_id: number;
  amount: string;
  fiat_amount: string;
  currency: string;
  type: string;
  status: string;
  transfer_note: string;
  admin_note: string;
  processed_by: string;
  created_at: string;
  processed_at: string;
}

interface WalletDetail {
  user_id: number;
  role: string;
  balance: string;
  currency: string;
}

interface BankInfoResponse {
  bank_info_id?: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status?: string;
  admin_note?: string;
  created_at?: string;
  verified_at?: string;
}

type TabType = "bank-info" | "topup" | "withdrawal" | "history";

/** Nạp tiền: bội số VNĐ tối thiểu (lệnh nạp); quy đổi khi duyệt 1 VNĐ = 1 BikeCoin */
const TOPUP_VND_ROUND_STEP = 100000;
/** Rút tiền: 1 BikeCoin = 1 VNĐ; số BikeCoin rút phải chia hết cho bước này */
const WITHDRAWAL_ROUND_STEP = 100000;

const getTransactionTypeLabel = (type: string): string => {
  const labels: { [key: string]: string } = {
    TOPUP_REQUEST: "🔝 Yêu cầu nạp tiền",
    TOPUP: "🔝 Nạp tiền",
    WITHDRAWAL_REQUEST: "🔻 Yêu cầu rút tiền",
    WITHDRAWAL: "🔻 Rút tiền",
    INSPECTION: "🔍 Kiểm định xe",
    LISTING_BOOST: "📝 Đẩy tin đăng",
  };
  return labels[type] || type;
};

const getTransactionStatusLabel = (status: string): string => {
  const labels: { [key: string]: string } = {
    PENDING: "Chờ xử lý",
    SUCCESS: "Thành công",
    REJECTED: "Bị từ chối",
    FAILED: "Thất bại",
  };
  return labels[status] || status;
};

const getAmountDisplay = (tx: Transaction): string => {
  if (tx.amount) {
    return `${tx.amount} ${tx.currency}`;
  }
  if (tx.fiat_amount) {
    return `${Number(tx.fiat_amount).toLocaleString("vi-VN")} VNĐ`;
  }
  return "";
};

export default function WalletDetailPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("bank-info");
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfoResponse | null>(null);
  const [bankStatus, setBankStatus] = useState<string>("NOT_LINKED");
  const [bankSubmitStatus, setBankSubmitStatus] = useState("");
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [topupAmount, setTopupAmount] = useState("");
  const [topupBikecoin, setTopupBikecoin] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [topupStatus, setTopupStatus] = useState("");

  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState("");

  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
  });
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);

  const VIETNAMESE_BANKS = [
    'Vietcombank',
    'VietinBank',
    'BIDV',
    'Agribank',
    'Techcombank',
    'ACB',
    'Sacombank',
    'MB Bank',
    'VPBank',
    'SHB',
    'OCB',
    'HDBank',
    'VIB',
    'MSB',
    'Eximbank',
    'TPBank',
    'SeABank',
    'ABBank',
    'PVcomBank',
    'LienVietPostBank',
    'Bac A Bank',
    'Nam A Bank',
    'SCB',
    'KienlongBank',
    'OceanBank',
    'Saigonbank',
    'Public Bank Vietnam',
    'Standard Chartered Vietnam',
    'ANZ Vietnam',
  ];

  const fetchWalletData = useCallback(async () => {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) return;

      // Fetch wallet info
      const walletRes = await fetch("http://localhost:9999/api/wallet/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (walletRes.ok) {
        const data = await walletRes.json();
        setWallet(data);
      }

      // Fetch bank info
      const bankRes = await fetch("http://localhost:9999/api/bank/info", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankInfo(data);
        setBankStatus(data.status);
      } else {
        setBankStatus("NOT_LINKED");
      }

      // Fetch transactions
      const txRes = await fetch("http://localhost:9999/api/wallet/transactions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchWalletData();

    const handleWalletUpdate = () => {
      fetchWalletData();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("walletUpdated", handleWalletUpdate);
      return () => window.removeEventListener("walletUpdated", handleWalletUpdate);
    }
  }, [fetchWalletData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isBankDropdownOpen && !(event.target as Element).closest('.customSelect')) {
        setIsBankDropdownOpen(false);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBankDropdownOpen]);

  const generateTransferNote = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedNote(randomCode);
  };

  const handleTopupSubmit = async () => {
    if (bankStatus !== "VERIFIED") {
      setTopupStatus("❌ Bạn phải liên kết và xác nhận ngân hàng trước khi nạp tiền");
      return;
    }

    if (!topupAmount || !generatedNote) {
      setTopupStatus("Vui lòng nhập số tiền và tạo mã nội dung");
      return;
    }

    const topupNum = Number(topupAmount);
    if (
      !Number.isFinite(topupNum) ||
      topupNum < TOPUP_VND_ROUND_STEP ||
      topupNum % TOPUP_VND_ROUND_STEP !== 0
    ) {
      setTopupStatus(
        `Số tiền nạp phải là bội số của ${TOPUP_VND_ROUND_STEP.toLocaleString("vi-VN")} VNĐ`
      );
      return;
    }

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        setTopupStatus("Vui lòng đăng nhập lại");
        return;
      }
      const response = await fetch("http://localhost:9999/api/wallet/topup-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fiat_amount: topupAmount,
          transfer_note: generatedNote,
          bank_info: bankInfo,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setTopupStatus("✓ Lệnh nạp đã được tạo. Admin sẽ kiểm tra và duyệt.");
        setTopupAmount("");
        setGeneratedNote("");
        
        // Dispatch event to update header wallet balance
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('walletUpdated'));
        }
        
        // Refresh transactions
        const txRes = await fetch("http://localhost:9999/api/wallet/transactions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (txRes.ok) {
          setTransactions(await txRes.json());
        }
      } else {
        setTopupStatus(`Lỗi: ${data.message}`);
      }
    } catch (err: any) {
      setTopupStatus(`Lỗi: ${err.message}`);
    }
  };

  const handleWithdrawalSubmit = async () => {
    if (bankStatus !== "VERIFIED") {
      setWithdrawalStatus("❌ Bạn phải liên kết và xác nhận ngân hàng trước khi rút tiền");
      return;
    }

    const amount = Number(withdrawalAmount);
    const balance = wallet ? Number(wallet.balance) : 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawalStatus("Nhập số BikeCoin rút lớn hơn 0");
      return;
    }

    if (amount > balance) {
      setWithdrawalStatus("Số rút vượt quá số dư ví");
      return;
    }

    if (amount % WITHDRAWAL_ROUND_STEP !== 0) {
      setWithdrawalStatus(
        "Số BikeCoin rút phải chia hết cho 100.000 (ví dụ: 100.000, 200.000, 1.500.000…). 1 BikeCoin = 1 VNĐ."
      );
      return;
    }

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        setWithdrawalStatus("Vui lòng đăng nhập lại");
        return;
      }
      const response = await fetch("http://localhost:9999/api/wallet/withdrawal-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: String(amount) }),
      });

      const data = await response.json();
      if (response.ok) {
        setWithdrawalStatus("✓ Lệnh rút đã được tạo. Sẽ được xử lý trong 1-2 ngày làm việc.");
        setWithdrawalAmount("");
        
        // Dispatch event to update header wallet balance
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('walletUpdated'));
        }
        
        // Refresh transactions
        const txRes = await fetch("http://localhost:9999/api/wallet/transactions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (txRes.ok) {
          setTransactions(await txRes.json());
        }
      } else {
        setWithdrawalStatus(`Lỗi: ${data.message}`);
      }
    } catch (err: any) {
      setWithdrawalStatus(`Lỗi: ${err.message}`);
    }
  };

  const handleBankSubmit = async () => {
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder) {
      setBankSubmitStatus("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        setBankSubmitStatus("Vui lòng đăng nhập lại");
        return;
      }
      const response = await fetch("http://localhost:9999/api/bank/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bankForm),
      });

      const data = await response.json();
      if (response.ok) {
        setBankSubmitStatus("✓ Thông tin ngân hàng đã được gửi. Đang chờ admin duyệt.");
        setBankStatus("PENDING");
        setIsEditingBank(false);
        // Refresh bank info
        const bankRes = await fetch("http://localhost:9999/api/bank/info", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (bankRes.ok) {
          setBankInfo(await bankRes.json());
        }
      } else {
        setBankSubmitStatus(`Lỗi: ${data.message}`);
      }
    } catch (err: any) {
      setBankSubmitStatus(`Lỗi: ${err.message}`);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Đang tải...</div>;
  }

  const bikecoinsFromAmount = topupAmount
    ? Math.floor(Number(topupAmount))
    : 0;

  return (
    <div className={styles.detailContainer}>
      <div className={styles.detailHeader}>
        <h1>Chi tiết ví</h1>
        <div className={styles.balanceDisplay}>
          Số dư: <span className={styles.balance}>{wallet && Number(wallet.balance).toLocaleString("vi-VN")} {wallet?.currency}</span>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "bank-info" ? styles.active : ""}`}
            onClick={() => setActiveTab("bank-info")}
          >
            Thông tin ngân hàng
          </button>
          <button
            className={`${styles.tab} ${activeTab === "topup" ? styles.active : ""}`}
            onClick={() => setActiveTab("topup")}
          >
            Nạp tiền
          </button>
          <button
            className={`${styles.tab} ${activeTab === "withdrawal" ? styles.active : ""}`}
            onClick={() => setActiveTab("withdrawal")}
          >
            Rút tiền
          </button>
          <button
            className={`${styles.tab} ${activeTab === "history" ? styles.active : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Lịch sử giao dịch
          </button>
        </div>
      </div>

      <div className={styles.tabContent}>
        {/* Bank Info Tab */}
        {activeTab === "bank-info" && (
          <div className={styles.tabPane}>
            <h2>Thông tin ngân hàng</h2>
            {bankStatus === "NOT_LINKED" || isEditingBank ? (
              <div className={styles.bankForm}>
                <div className={styles.formGroup}>
                  <label>Tên ngân hàng</label>
                  <div className={`${styles.customSelect} customSelect`} onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}>
                    <div className={styles.selectDisplay}>
                      {bankForm.bank_name ? (
                        <span>{bankForm.bank_name}</span>
                      ) : (
                        <span>Chọn ngân hàng</span>
                      )}
                      <span className={styles.dropdownArrow}>▼</span>
                    </div>
                    {isBankDropdownOpen && (
                      <div className={styles.dropdownOptions}>
                        {VIETNAMESE_BANKS.map((bank) => (
                          <div
                            key={bank}
                            className={styles.dropdownOption}
                            onClick={(e) => {
                              e.stopPropagation();
                              setBankForm({...bankForm, bank_name: bank});
                              setIsBankDropdownOpen(false);
                            }}
                          >
                            <span>{bank}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Số tài khoản</label>
                  <input
                    type="text"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})}
                    placeholder="Nhập số tài khoản"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Chủ tài khoản</label>
                  <input
                    type="text"
                    value={bankForm.account_holder}
                    onChange={(e) => setBankForm({...bankForm, account_holder: e.target.value})}
                    placeholder="Tên chủ tài khoản"
                  />
                </div>
                <button
                  className={styles.submitButton}
                  onClick={handleBankSubmit}
                >
                  Gửi thông tin ngân hàng
                </button>
                {bankSubmitStatus && (
                  <div className={styles.statusMessage}>{bankSubmitStatus}</div>
                )}
              </div>
            ) : bankInfo ? (
              <>
                <div className={`${styles.bankStatusBox} ${styles[`status-${bankStatus?.toLowerCase()}`]}`}>
                  {bankStatus === "PENDING" && (
                    <>⏳ <strong>Chờ xác nhận</strong> - Admin đang kiểm tra thông tin của bạn</>
                  )}
                  {bankStatus === "VERIFIED" && (
                    <>✓ <strong>Đã xác nhận</strong> - Bạn có thể sử dụng các dịch vụ ví</>
                  )}
                  {bankStatus === "REJECTED" && (
                    <>✗ <strong>Bị từ chối</strong> - {bankInfo.admin_note || "Liên hệ admin để biết thêm chi tiết"}</>
                  )}
                </div>
                <div className={styles.bankInfoCard}>
                  <div className={styles.infoRow}>
                    <label>Tên ngân hàng:</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span>{bankInfo.bank_name}</span>
                    </div>
                  </div>
                  <div className={styles.infoRow}>
                    <label>Số tài khoản:</label>
                    <span className={styles.accountNumber}>{bankInfo.account_number}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <label>Chủ tài khoản:</label>
                    <span>{bankInfo.account_holder}</span>
                  </div>
                </div>
                {bankStatus === "VERIFIED" && (
                  <button
                    className={styles.changeButton}
                    onClick={() => {
                      setIsEditingBank(true);
                      setBankForm({
                        bank_name: bankInfo.bank_name,
                        account_number: bankInfo.account_number,
                        account_holder: bankInfo.account_holder,
                      });
                      setIsBankDropdownOpen(false);
                    }}
                  >
                    Thay đổi thông tin
                  </button>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Topup Tab */}
        {activeTab === "topup" && (
          <div className={styles.tabPane}>
            <h2>Nạp tiền vào ví</h2>
            <div className={styles.formGroup}>
              <label>Số tiền nạp (VNĐ)</label>
              <input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Ví dụ: 500000"
                min={TOPUP_VND_ROUND_STEP}
                step={TOPUP_VND_ROUND_STEP}
              />
              <small>
                Tối thiểu {TOPUP_VND_ROUND_STEP.toLocaleString("vi-VN")} VNĐ, bội số{' '}
                {TOPUP_VND_ROUND_STEP.toLocaleString("vi-VN")} VNĐ.
              </small>
            </div>

            {topupAmount && (
              <div className={styles.exchangeInfo}>
                <p>
                  <strong>{Number(topupAmount).toLocaleString("vi-VN")} VNĐ</strong>
                  {' → '}
                  <strong>{bikecoinsFromAmount.toLocaleString("vi-VN")} BikeCoin</strong>
                </p>
                <p className={styles.exchangeInfoSub}></p>
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Mã nội dung chuyển khoản</label>
              {!generatedNote ? (
                <button
                  type="button"
                  className={styles.generateButton}
                  onClick={generateTransferNote}
                >
                  Tạo mã
                </button>
              ) : (
                <div className={styles.generatedNote}>
                  <strong>Mã của bạn:</strong> <span>{generatedNote}</span>
                  <p>Sử dụng mã này khi chuyển khoản</p>
                </div>
              )}
            </div>

            <div className={styles.warning}>
              <strong>⚠️ Lưu ý quan trọng:</strong>
              <ul>
                <li>Chuyển khoản phải ghi đúng nội dung: <strong>{generatedNote}</strong></li>
                <li>Kiểm tra lại thông tin ngân hàng chủ tài khoản trước khi chuyển</li>
                <li>Nạp đúng số tiền: <strong>{Number(topupAmount).toLocaleString("vi-VN")} VNĐ</strong> — khi duyệt, <strong>1 VNĐ = 1 BikeCoin</strong></li>
              </ul>
            </div>

            <div className={styles.systemBankInfo}>
              <h3>Thông tin chuyển khoản</h3>
              <div className={styles.bankInfoCard}>
                <div className={styles.infoRow}>
                  <label>Tên ngân hàng:</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)</span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <label>Số tài khoản:</label>
                  <span className={styles.accountNumber}>1234567890</span>
                </div>
                <div className={styles.infoRow}>
                  <label>Chủ tài khoản:</label>
                  <span>CÔNG TY TNHH BIKEHUB</span>
                </div>
                <div className={styles.infoRow}>
                  <label>Nội dung chuyển khoản:</label>
                  <span className={styles.transferNote}>{generatedNote}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={styles.submitButton}
              onClick={handleTopupSubmit}
              disabled={!generatedNote}
            >
              Tạo lệnh nạp tiền
            </button>

            {topupStatus && (
              <div className={styles.statusMessage}>{topupStatus}</div>
            )}
          </div>
        )}

        {/* Withdrawal Tab */}
        {activeTab === "withdrawal" && (
          <div className={styles.tabPane}>
            <h2>Rút tiền từ ví</h2>
            <div className={styles.formGroup}>
              <label>Số tiền rút (BikeCoin)</label>
              <input
                type="number"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="VD: 500000, 1200000…"
                min={1}
                step={1}
              />
              <small>
      
              </small>
            </div>

            {withdrawalAmount && Number(withdrawalAmount) > 0 && (
              <div className={styles.exchangeInfo}>
                <p>
                  <strong>{Number(withdrawalAmount).toLocaleString("vi-VN")} BikeCoin</strong>
                  {' '}→{' '}
                  <strong>{Number(withdrawalAmount).toLocaleString("vi-VN")} VNĐ</strong>
                </p>
              </div>
            )}

            <div className={styles.warning}>
              <strong>⚠️ Lưu ý:</strong>
              <ul>
                <li>Số tiền rút phải chia hết cho 100.000 BikeCoin</li>
                <li>Khi bấm tạo lệnh, số BikeCoin rút được tạm giữ ngay trên ví</li>
                <li>Tiền sẽ được chuyển vào tài khoản ngân hàng đã đăng ký sau khi admin xử lý</li>
              </ul>
            </div>

            <button
              type="button"
              className={styles.submitButton}
              onClick={handleWithdrawalSubmit}
              disabled={!withdrawalAmount}
            >
              Tạo lệnh rút
            </button>

            {withdrawalStatus && (
              <div className={styles.statusMessage}>{withdrawalStatus}</div>
            )}
          </div>
        )}

        {/* Transaction History Tab */}
        {activeTab === "history" && (
          <div className={styles.tabPane}>
            <h2>Lịch sử giao dịch</h2>
            {transactions.length > 0 ? (
              <div className={styles.transactionList}>
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className={styles.transactionItem}>
                    <div className={styles.txHeader}>
                      <div className={styles.txType}>
                        <span className={styles.txTypeLabel}>{getTransactionTypeLabel(tx.type)}</span>
                        <span className={`${styles.txStatus} ${styles['status-' + tx.status.toLowerCase()]}`}>
                          {getTransactionStatusLabel(tx.status)}
                        </span>
                      </div>
                      <div className={styles.txAmount}>
                        {getAmountDisplay(tx)}
                      </div>
                    </div>
                    <div className={styles.txDetails}>
                      <span className={styles.txDate}>
                        {new Date(tx.created_at).toLocaleString("vi-VN")}
                      </span>
                      {tx.transfer_note && (
                        <span className={styles.txNote}>Nội dung: {tx.transfer_note}</span>
                      )}
                      {tx.admin_note && (
                        <span className={styles.txAdminNote}>Ghi chú: {tx.admin_note}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noTransactions}>Chưa có giao dịch nào</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
