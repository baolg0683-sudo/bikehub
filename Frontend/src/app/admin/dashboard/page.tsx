'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import styles from '../page.module.css';

type TrendData = Array<{ date: string; value: number }>;

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
    users: TrendData;
    inspectors: TrendData;
    topup_requests: TrendData;
    withdrawal_requests: TrendData;
    active_disputes: TrendData;
    bank_verifications: TrendData;
    total_revenue: TrendData;
    listings_active: TrendData;
    orders_completed: TrendData;
  };
};

type DateRange = 'day' | 'week' | 'month' | 'year';

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
  { value: 'year', label: 'Theo năm' },
];

interface MetricCardProps {
  title: string;
  value: string | number;
  trendData: TrendData;
  isCurrency?: boolean;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}

function MetricCard({ title, value, trendData, isCurrency = false, range, onRangeChange }: MetricCardProps) {
  const displayValue = isCurrency
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0)
    : new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

  return (
    <div className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as DateRange)}
          className={styles.cardRangeSelect}
        >
          {RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <p className={styles.metricValue}>{displayValue}</p>

      <div className={styles.trendChartContainer}>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="0" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v: unknown) => [new Intl.NumberFormat('vi-VN').format(Number(v) || 0), 'Giá trị']}
            />
            <Line type="monotone" dataKey="value" stroke="#ec4899" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type MetricKey =
  | 'users' | 'inspectors' | 'topup_requests' | 'withdrawal_requests'
  | 'active_disputes' | 'bank_verifications' | 'total_revenue'
  | 'listings_active' | 'orders_completed';

type RangeMap = Record<MetricKey, DateRange>;

const DEFAULT_RANGE: DateRange = 'month';

export default function AdminDashboardPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const token = resolveAccessToken(accessToken);

  // Each metric has its own range selector
  const [ranges, setRanges] = useState<RangeMap>({
    users: DEFAULT_RANGE,
    inspectors: DEFAULT_RANGE,
    topup_requests: DEFAULT_RANGE,
    withdrawal_requests: DEFAULT_RANGE,
    active_disputes: DEFAULT_RANGE,
    bank_verifications: DEFAULT_RANGE,
    total_revenue: DEFAULT_RANGE,
    listings_active: DEFAULT_RANGE,
    orders_completed: DEFAULT_RANGE,
  });

  // Cache metrics per range so we don't re-fetch unnecessarily
  const [cache, setCache] = useState<Partial<Record<DateRange, DashboardMetrics>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/'); }
  }, [initialized, loggedIn, user, router]);

  const fetchRange = useCallback(async (range: DateRange) => {
    if (!token || user?.role !== 'ADMIN') return;
    if (cache[range]) return; // already cached
    try {
      const res = await fetch(`http://localhost:9999/api/admin/dashboard?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Không lấy được dữ liệu dashboard');
      }
      const data: DashboardMetrics = await res.json();
      setCache(prev => ({ ...prev, [range]: data }));
    } catch (err) {
      setError((err as Error).message || 'Lỗi khi tải dữ liệu');
    }
  }, [token, user?.role, cache]);

  // Initial load
  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') return;
    setLoading(true);
    fetchRange(DEFAULT_RANGE).finally(() => setLoading(false));
  }, [token, user?.role]);

  const handleRangeChange = (key: MetricKey, range: DateRange) => {
    setRanges(prev => ({ ...prev, [key]: range }));
    fetchRange(range);
  };

  // Get value + trend for a metric from the appropriate cached range
  const getMetric = (key: MetricKey): { value: string | number; trend: TrendData } => {
    const range = ranges[key];
    const data = cache[range] || cache[DEFAULT_RANGE];
    if (!data) return { value: 0, trend: [] };

    const valueMap: Record<MetricKey, string | number> = {
      users: data.users_total,
      inspectors: data.inspectors_total,
      topup_requests: data.topup_requests,
      withdrawal_requests: data.withdrawal_requests,
      active_disputes: data.active_disputes,
      bank_verifications: data.bank_verifications,
      total_revenue: data.total_revenue,
      listings_active: data.listings_active,
      orders_completed: data.orders_completed,
    };

    const trendMap: Record<MetricKey, TrendData> = {
      users: data.trends.users,
      inspectors: data.trends.inspectors,
      topup_requests: data.trends.topup_requests,
      withdrawal_requests: data.trends.withdrawal_requests,
      active_disputes: data.trends.active_disputes,
      bank_verifications: data.trends.bank_verifications,
      total_revenue: data.trends.total_revenue,
      listings_active: data.trends.listings_active,
      orders_completed: data.trends.orders_completed,
    };

    return { value: valueMap[key], trend: trendMap[key] };
  };

  const metrics: Array<{ key: MetricKey; title: string; isCurrency?: boolean }> = [
    { key: 'users', title: 'Tổng người dùng' },
    { key: 'inspectors', title: 'Kiểm định viên' },
    { key: 'topup_requests', title: 'Yêu cầu nạp tiền' },
    { key: 'withdrawal_requests', title: 'Yêu cầu rút tiền' },
    { key: 'active_disputes', title: 'Tranh chấp xử lý' },
    { key: 'bank_verifications', title: 'Xác thực ngân hàng' },
    { key: 'total_revenue', title: 'Doanh thu', isCurrency: true },
    { key: 'listings_active', title: 'Xe đạp đang bán' },
    { key: 'orders_completed', title: 'Đơn đã hoàn tất' },
  ];

  return (
    <div className={styles.adminPage}>
      <AdminSidebar active="home" />
      <section className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.pageLabel}>Dashboard chính</p>
            <h1 className={styles.pageTitle}>Thống kê tổng quan</h1>
            <p className={styles.pageSubtitle}>Theo dõi các chỉ số quan trọng của hệ thống BikeHub</p>
          </div>
        </header>

        {loading ? (
          <div className={styles.loadingState}><p>Đang tải dữ liệu...</p></div>
        ) : error ? (
          <div className={styles.errorState}><p className={styles.errorText}>{error}</p></div>
        ) : (
          <div className={styles.dashboardGrid}>
            {metrics.map(({ key, title, isCurrency }) => {
              const { value, trend } = getMetric(key);
              return (
                <MetricCard
                  key={key}
                  title={title}
                  value={value}
                  trendData={trend}
                  isCurrency={isCurrency}
                  range={ranges[key]}
                  onRangeChange={(r) => handleRangeChange(key, r)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
