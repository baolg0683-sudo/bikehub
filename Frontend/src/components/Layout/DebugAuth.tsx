'use client';

import { useAuth } from '../../context/AuthContext';
import styles from './DebugAuth.module.css';
import { useEffect, useState } from 'react';

export function DebugAuth() {
  const { loggedIn, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleClearAuth = () => {
    if (confirm('Xóa toàn bộ auth data?')) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user_data');
      window.location.reload();
    }
  };

  const accessToken = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
  const userData = typeof window !== 'undefined' ? sessionStorage.getItem('user_data') : null;

  return (
    <div className={styles.debugPanel}>
      <details>
        <summary>🔍 Debug Auth</summary>
        <div className={styles.debugContent}>
          <div className={styles.debugRow}>
            <strong>loggedIn:</strong>
            <span className={loggedIn ? styles.true : styles.false}>{String(loggedIn)}</span>
          </div>
          <div className={styles.debugRow}>
            <strong>user:</strong>
            <code>{JSON.stringify(user, null, 2)}</code>
          </div>
          <div className={styles.debugRow}>
            <strong>localStorage:</strong>
            <ul>
              <li>access_token: {accessToken ? '✓' : '✗'}</li>
              <li>user_data: {userData ? '✓' : '✗'}</li>
            </ul>
          </div>
          <button onClick={handleClearAuth} className={styles.clearBtn}>
            🗑️ Xóa Auth Data
          </button>
        </div>
      </details>
    </div>
  );
}
