'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { resolveAccessToken } from '../../utils/accessToken';
import { AdminSidebar } from './AdminSidebar';
import styles from './page.module.css';

type TrendPoint = { date: string; value: number };

type DashboardSummary = {
  users_total: number;
  inspectors_total: number;
  pending_topup: number;
  pending_withdrawal: number;
  pending_bank: number;
  pending_disputes: number;
  total_revenue: string;
};

type DashboardMetrics = {
  users_total: number;
  inspectors_total: number;
  topup_requests: number;
  withdrawal_requests: number;
  active_disputes: number;
  bank_verifications: number;
  total_revenue: string;
  listings_active: number;
  orders_completed: number;
  trends: {
    users: TrendPoint[];
    inspectors: TrendPoint[];
    topup_requests: TrendPoint[];
    withdrawal_requests: TrendPoint[];
    active_disputes: TrendPoint[];
    bank_verifications: TrendPoint[];
    total_revenue: TrendPoint[];
    listings_active: TrendPoint[];
    orders_completed: TrendPoint[];
  };
};

type Range = 'day' | 'week' | 'month' | 'year';
type MetricKey =
  | 'users' | 'inspectors' | 'topup_requests' | 'withdrawal_requests'
  | 'active_disputes' | 'bank_verifications' | 'total_revenue'
  | 'listings_active' | 'orders_completed';

const RANGES: { value: Range; label: string }[] = [
  { value: 'day',   label: 'Ngày'  },
  { value: 'week',  label: 'Tuần'  },
  { value: 'month', label: 'Tháng' },
  { value: 'year',  label: 'Năm'   },
];

const METRIC_DEFS: { key: MetricKey; title: string; isCurrency?: boolean }[] = [
  { key: 'users',               title: 'Người dùng mới' },
  { key: 'inspectors',          title: 'Kiểm định viên mới' },
  { key: 'topup_requests',      title: 'Nạp tiền đã xử lý' },
  { key: 'withdrawal_requests', title: 'Rút tiền đã xử lý' },
  { key: 'active_disputes',     title: 'Tranh chấp đã xử lý' },
  { key: 'bank_verifications',  title: 'Xác thực ngân hàng đã xử lý' },
  { key: 'total_revenue',       title: 'Doanh thu', isCurrency: true },
  { key: 'listings_active',     title: 'Xe đạp đang bán (AVAILABLE)' },
  { key: 'orders_completed',    title: 'Đơn đã hoàn tất' },
];

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
}
function fmtNum(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v);
}

// ── Fixed summary card ────────────────────────────────────────────────────────
function SummaryCard({ title, value, color, sub }: { title: string; value: string; color: string; sub?: string }) {
  return (
    <div className={styles.summaryCard} style={{ borderTop: `4px solid ${color}` }}>
      <p className={styles.summaryTitle}>{title}</p>
      <p className={styles.summaryValue}>{value}</p>
      {sub && <p className={styles.summarySub}>{sub}</p>}
    </div>
  );
}

// ── Metric card with range filter + trend chart ───────────────────────────────
function MetricCard({ title, value, trend, isCurrency, range, onRange }: {
  title: string; value: string | number; trend: TrendPoint[];
  isCurrency?: boolean; range: Range; onRange: (r: Range) => void;
}) {
  const display = isCurrency ? fmtCurrency(Number(value) || 0) : fmtNum(Number(value) || 0);
  return (
    <div className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <select value={range} onChange={e => onRange(e.target.value as Range)} className={styles.cardRangeSelect}>
          {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <p className={styles.metricValue}>{display}</p>
      <div className={styles.trendChartContainer}>
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={trend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
              formatter={(v: unknown) => [fmtNum(Number(v) || 0), 'Giá trị']}
            />
            <Line type="monotone" dataKey="value" stroke="#ec4899" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const token = resolveAccessToken(accessToken);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cache, setCache] = useState<Partial<Record<Range, DashboardMetrics>>>({});
  const [ranges, setRanges] = useState<Record<MetricKey, Range>>({
    users: 'month', inspectors: 'month', topup_requests: 'month',
    withdrawal_requests: 'month', active_disputes: 'month',
    bank_verifications: 'month', total_revenue: 'month',
    listings_active: 'month', orders_completed: 'month',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/'); }
  }, [initialized, loggedIn, user, router]);

  const fetchRange = useCallback(async (range: Range) => {
    if (!token || user?.role !== 'ADMIN' || cache[range]) return;
    try {
      const res = await fetch(`http://localhost:9999/api/admin/dashboard?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DashboardMetrics = await res.json();
      setCache(prev => ({ ...prev, [range]: data }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, user?.role, cache]);

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') return;
    setLoading(true);
    Promise.all([
      fetch('http://localhost:9999/api/admin/summary', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then((d: DashboardSummary) => setSummary(d)).catch(() => {}),
      fetchRange('month'),
    ]).finally(() => setLoading(false));
  }, [token, user?.role]);

  const handleRange = (key: MetricKey, r: Range) => {
    setRanges(prev => ({ ...prev, [key]: r }));
    fetchRange(r);
  };

  const getMetric = (key: MetricKey): { value: string | number; trend: TrendPoint[] } => {
    const r = ranges[key];
    const data = cache[r] ?? cache['month'];
    if (!data) return { value: 0, trend: [] };
    return {
      value: {
        users: data.users_total, inspectors: data.inspectors_total,
        topup_requests: data.topup_requests, withdrawal_requests: data.withdrawal_requests,
        active_disputes: data.active_disputes, bank_verifications: data.bank_verifications,
        total_revenue: data.total_revenue, listings_active: data.listings_active,
        orders_completed: data.orders_completed,
      }[key],
      trend: {
        users: data.trends.users, inspectors: data.trends.inspectors,
        topup_requests: data.trends.topup_requests, withdrawal_requests: data.trends.withdrawal_requests,
        active_disputes: data.trends.active_disputes, bank_verifications: data.trends.bank_verifications,
        total_revenue: data.trends.total_revenue, listings_active: data.trends.listings_active,
        orders_completed: data.trends.orders_completed,
      }[key],
    };
  };

  return (
    <div className={styles.adminPage}>
      <AdminSidebar active="home" />
      <section className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.pageLabel}>Dashboard</p>
            <h1 className={styles.pageTitle}>Thống kê tổng quan</h1>
            <p className={styles.pageSubtitle}>Theo dõi các chỉ số quan trọng của hệ thống BikeHub</p>
          </div>
        </header>

        {loading ? (
          <div className={styles.loadingState}><p>Đang tải dữ liệu...</p></div>
        ) : error ? (
          <div className={styles.errorState}><p className={styles.errorText}>{error}</p></div>
        ) : (
          <>
            {/* ── Row 1: Tổng quan cố định ── */}
            <div className={styles.summaryGrid}>
              <SummaryCard title="Tổng người dùng"        value={fmtNum(summary?.users_total ?? 0)}      color="#3b82f6" />
              <SummaryCard title="Kiểm định viên"         value={fmtNum(summary?.inspectors_total ?? 0)} color="#10b981" />
              <SummaryCard
                title="Tất cả yêu cầu chưa xử lý"
                value={fmtNum((summary?.pending_topup ?? 0) + (summary?.pending_withdrawal ?? 0) + (summary?.pending_bank ?? 0) + (summary?.pending_disputes ?? 0))}
                color="#f59e0b"
              />
              <SummaryCard title="Tổng doanh thu (phí KĐ)" value={fmtCurrency(Number(summary?.total_revenue ?? 0))} color="#ec4899" />
            </div>

            {/* ── Row 2: Pending chi tiết ── */}
            <div className={styles.pendingGrid}>
              <SummaryCard title="Nạp tiền đang chờ"         value={fmtNum(summary?.pending_topup ?? 0)}      color="#6366f1" />
              <SummaryCard title="Rút tiền đang chờ"         value={fmtNum(summary?.pending_withdrawal ?? 0)} color="#8b5cf6" />
              <SummaryCard title="Xác thực ngân hàng đang chờ" value={fmtNum(summary?.pending_bank ?? 0)}    color="#0ea5e9" />
              <SummaryCard title="Tranh chấp đang chờ xử lý" value={fmtNum(summary?.pending_disputes ?? 0)}  color="#ef4444" />
            </div>

            {/* ── Row 3: Metric cards với filter ── */}
            <div className={styles.dashboardGrid}>
              {METRIC_DEFS.map(({ key, title, isCurrency }) => {
                const { value, trend } = getMetric(key);
                return (
                  <MetricCard
                    key={key} title={title} value={value} trend={trend}
                    isCurrency={isCurrency} range={ranges[key]}
                    onRange={r => handleRange(key, r)}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
