'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import styles from './page.module.css';

type TopUpRequest = {
  transaction_id: number;
  user_id: number;
  fiat_amount: string;
  currency: string;
  type: string;
  status: string;
  transfer_note: string;
  bank_info: Record<string, any> | null;
  evidence_url: string | null;
  created_at: string | null;
};

export default function AdminTopupRequestsPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadRequests();
  }, [initialized, loggedIn, user, router]);

  const loadRequests = async () => {
    setLoading(true);
    setMessage(null);
    const token = accessToken ?? (typeof window !== 'undefined' ? window.sessionStorage.getItem('access_token') : null);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/wallet/topup-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Không tải được yêu cầu nạp.');
      }
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (transactionId: number, action: 'approve' | 'reject') => {
    setActionLoading(transactionId);
    setMessage(null);

    const token = accessToken ?? (typeof window !== 'undefined' ? window.sessionStorage.getItem('access_token') : null);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setActionLoading(null);
      return;
    }

    try {
      const response = await fetch(`/api/wallet/topup-requests/${transactionId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_note: action === 'reject' ? 'Từ chối yêu cầu nạp' : 'Duyệt yêu cầu nạp' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Đã có lỗi xảy ra.');
      }
      setMessage({ type: 'success', text: data.message || 'Cập nhật thành công.' });
      loadRequests();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Lỗi khi thực hiện hành động.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <div>
          <p className={styles.pageLabel}>Yêu cầu nạp</p>
          <h1 className={styles.pageTitle}>Quản lý yêu cầu nạp ví</h1>
          <p className={styles.pageSubtitle}>
            Xem danh sách yêu cầu nạp tiền đang chờ duyệt và phê duyệt hoặc từ chối.
          </p>
        </div>
        <div className={styles.statsCard}>
          <p className={styles.statsLabel}>Đang chờ xử lý</p>
          <strong className={styles.statsValue}>{requests.length}</strong>
        </div>
      </div>

      {message && (
        <div className={`${styles.message} ${message.type === 'success' ? styles.success : styles.error}`}>
          {message.text}
        </div>
      )}

      <div className={styles.panel}>
        {loading ? (
          <p>Đang tải yêu cầu...</p>
        ) : requests.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Hiện không có yêu cầu nạp nào đang chờ duyệt.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Người dùng</th>
                  <th>Số tiền</th>
                  <th>Ghi chú</th>
                  <th>Thông tin ngân hàng</th>
                  <th>Thời gian</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.transaction_id}>
                    <td>{request.transaction_id}</td>
                    <td>{request.user_id}</td>
                    <td>{request.fiat_amount} {request.currency}</td>
                    <td>{request.transfer_note || '-'}</td>
                    <td>
                      {request.bank_info ? (
                        <div className={styles.bankInfo}>
                          {Object.entries(request.bank_info).map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {value}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{request.created_at ? new Date(request.created_at).toLocaleString('vi-VN') : '-'}</td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        disabled={actionLoading === request.transaction_id}
                        className={styles.approveButton}
                        onClick={() => handleAction(request.transaction_id, 'approve')}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === request.transaction_id}
                        className={styles.rejectButton}
                        onClick={() => handleAction(request.transaction_id, 'reject')}
                      >
                        Từ chối
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
