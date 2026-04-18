"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import styles from "./page.module.css";

interface OrderRow {
  order_id: number;
  listing_id: number;
  listing_title?: string | null;
  buyer_id: number;
  seller_id: number;
  status: string;
  final_price: string;
  deposit_percent?: string | null;
  deposit_amount: string;
  remaining_amount: string;
  buyer_reject_reason?: string | null;
  listing_was_verified?: boolean;
  meeting_confirmed_at?: string | null;
  created_at?: string | null;
  seller_contact?: { name?: string; phone?: string; email?: string };
  buyer_contact?: { name?: string; phone?: string; email?: string };
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_DEPOSIT: "Chờ thanh toán cọc",
  DEPOSIT_HELD: "Đã cọc — chờ giao dịch",
  SELLER_CONFIRMED_HANDOVER: "Đã nhận xe",
  COMPLETED: "Hoàn tất",
  CANCELLED_BY_BUYER: "Đã hủy cọc",
  REJECTED_BY_BUYER: "Từ chối nhận xe",
  DISPUTE_OPEN: "Tranh chấp / đang xử lý",
};

function statusLabelForOrder(o: OrderRow): string {
  if (o.status === "DEPOSIT_HELD" && !o.meeting_confirmed_at) {
    return "Đã cọc — chờ người bán xác nhận lịch hẹn";
  }
  return STATUS_LABEL[o.status] || o.status;
}

function formatMoney(s: string) {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("vi-VN") + " BikeCoin";
}

export default function OrdersPage() {
  const router = useRouter();
  const { loggedIn, accessToken, user } = useAuth();
  const { openConversation } = useChat();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);

  const [rejectOpen, setRejectOpen] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState<number | null>(null);
  const [disputeText, setDisputeText] = useState("");
  const [confirmReceive, setConfirmReceive] = useState<number | null>(null);
  const [orderTab, setOrderTab] = useState<"buy" | "sell">("buy");

  const authHeaders = useCallback((): Record<string, string> => {
    const token = accessToken ?? (typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null);
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders/me", { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { message?: string })?.message || "Không tải được đơn hàng.");
      }
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!loggedIn) {
      router.replace("/login");
      return;
    }
    void load();
  }, [loggedIn, router, load]);

  const uid = user?.user_id ?? null;

  const buyOrders = useMemo(() => orders.filter((o) => uid !== null && o.buyer_id === uid), [orders, uid]);
  const sellOrders = useMemo(() => orders.filter((o) => uid !== null && o.seller_id === uid), [orders, uid]);
  const displayedOrders = orderTab === "buy" ? buyOrders : sellOrders;

  const postAction = async (path: string, body?: object) => {
    const headers: Record<string, string> = { ...authHeaders() };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    } else {
      delete headers["Content-Type"];
    }
    const res = await fetch(path, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message || "Thao tác thất bại.");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("walletUpdated"));
    }
    await load();
    return data;
  };

  const onPayDeposit = async (orderId: number) => {
    setActionId(orderId);
    try {
      await postAction(`/api/orders/${orderId}/pay-deposit`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const onCancel = async (orderId: number) => {
    if (!window.confirm("Hủy cọc và nhận hoàn BikeCoin về ví? Tin sẽ được đăng bán lại.")) return;
    setActionId(orderId);
    try {
      await postAction(`/api/orders/${orderId}/cancel`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const onBuyerConfirm = async (orderId: number) => {
    setActionId(orderId);
    try {
      await postAction(`/api/orders/${orderId}/buyer-confirm-received`);
      setConfirmReceive(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const onSellerConfirmMeeting = async (orderId: number) => {
    setActionId(orderId);
    try {
      await postAction(`/api/orders/${orderId}/confirm-meeting-schedule`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const submitReject = async () => {
    if (rejectOpen === null) return;
    setActionId(rejectOpen);
    try {
      await postAction(`/api/orders/${rejectOpen}/reject`, { reason: rejectReason });
      setRejectOpen(null);
      setRejectReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const submitDispute = async () => {
    if (disputeOpen === null) return;
    setActionId(disputeOpen);
    try {
      await postAction(`/api/orders/${disputeOpen}/dispute`, { description: disputeText });
      setDisputeOpen(null);
      setDisputeText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  };

  if (!loggedIn || !uid) {
    return null;
  }

  const canOpenTradeChat = (o: OrderRow) =>
    ["DEPOSIT_HELD", "SELLER_CONFIRMED_HANDOVER", "DISPUTE_OPEN"].includes(o.status);

  const openTradeChat = (o: OrderRow) => {
    const isBuyerView = o.buyer_id === uid;
    if (isBuyerView) {
      const name = o.seller_contact?.name || `Người bán #${o.seller_id}`;
      openConversation({
        sellerId: o.seller_id,
        sellerName: name,
        listingId: o.listing_id,
        listingTitle: o.listing_title || `Tin #${o.listing_id}`,
        chatKind: "order_trade",
        orderId: o.order_id,
      });
      return;
    }
    const name = o.buyer_contact?.name || `Người mua #${o.buyer_id}`;
    openConversation({
      sellerId: o.buyer_id,
      sellerName: name,
      listingId: o.listing_id,
      listingTitle: o.listing_title || `Tin #${o.listing_id}`,
      peerUserId: o.buyer_id,
      peerName: name,
      chatKind: "order_trade",
      orderId: o.order_id,
    });
  };

  const buyerCanHandoverActions = (o: OrderRow) =>
    o.status !== "DEPOSIT_HELD" || Boolean(o.meeting_confirmed_at);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Quản lý đơn hàng</h1>
      <p className={styles.sub}>
        Đơn đặt cọc và giao dịch của bạn (giá và cọc tính bằng BikeCoin). Liên hệ đối tác hiển thị khi đã đặt cọc
        thành công.
      </p>

      <div className={styles.tabRow} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={orderTab === "buy"}
          className={`${styles.tab} ${orderTab === "buy" ? styles.tabActive : ""}`}
          onClick={() => setOrderTab("buy")}
        >
          Đơn mua ({buyOrders.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={orderTab === "sell"}
          className={`${styles.tab} ${orderTab === "sell" ? styles.tabActive : ""}`}
          onClick={() => setOrderTab("sell")}
        >
          Đơn bán ({sellOrders.length})
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p>Đang tải...</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>Chưa có đơn hàng nào.</p>
      ) : displayedOrders.length === 0 ? (
        <p className={styles.empty}>
          {orderTab === "buy" ? "Chưa có đơn mua nào." : "Chưa có đơn bán nào."}
        </p>
      ) : (
        <div className={styles.list}>
          {displayedOrders.map((o) => {
            const isBuyer = o.buyer_id === uid;
            const isSeller = o.seller_id === uid;
            const label = statusLabelForOrder(o);

            return (
              <article key={o.order_id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>
                    <Link href={`/listing/${o.listing_id}`}>{o.listing_title || `Tin #${o.listing_id}`}</Link>
                  </h2>
                  <span className={styles.status}>{label}</span>
                </div>
                <div className={styles.meta}>
                  <span>
                    Giá: <strong>{formatMoney(o.final_price)}</strong>
                  </span>
                  {o.deposit_percent ? (
                    <span>
                      Cọc {o.deposit_percent}%: <strong>{formatMoney(o.deposit_amount)}</strong>
                    </span>
                  ) : null}
                  <span>
                    Còn lại: <strong>{formatMoney(o.remaining_amount)}</strong>
                  </span>
                  <span>Kiểm định sàn: {o.listing_was_verified ? "Có" : "Không"}</span>
                </div>

                {isBuyer && o.seller_contact ? (
                  <div className={styles.contactBox}>
                    <strong>Người bán</strong>
                    <div>{o.seller_contact.name}</div>
                    <div>Điện thoại: {o.seller_contact.phone}</div>
                    <div>Email: {o.seller_contact.email}</div>
                  </div>
                ) : null}

                {isSeller && o.buyer_contact ? (
                  <div className={styles.contactBox}>
                    <strong>Người mua</strong>
                    <div>{o.buyer_contact.name}</div>
                    <div>Điện thoại: {o.buyer_contact.phone}</div>
                    <div>Email: {o.buyer_contact.email}</div>
                  </div>
                ) : null}

                {o.buyer_reject_reason ? (
                  <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                    Lý do từ chối: {o.buyer_reject_reason}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  {canOpenTradeChat(o) ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline}`}
                      onClick={() => openTradeChat(o)}
                    >
                      Chat giao dịch
                    </button>
                  ) : null}

                  {isBuyer && o.status === "AWAITING_DEPOSIT" ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={actionId === o.order_id}
                      onClick={() => void onPayDeposit(o.order_id)}
                    >
                      Thanh toán cọc
                    </button>
                  ) : null}

                  {isSeller && o.status === "DEPOSIT_HELD" && !o.meeting_confirmed_at ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={actionId === o.order_id}
                      onClick={() => void onSellerConfirmMeeting(o.order_id)}
                    >
                      Xác nhận đã hẹn lịch giao dịch
                    </button>
                  ) : null}

                  {isBuyer && o.status === "DEPOSIT_HELD" ? (
                    <>
                      {buyerCanHandoverActions(o) ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            disabled={actionId === o.order_id}
                            onClick={() => setConfirmReceive(o.order_id)}
                          >
                            Đã nhận xe
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={actionId === o.order_id}
                            onClick={() => {
                              setRejectReason("");
                              setRejectOpen(o.order_id);
                            }}
                          >
                            Từ chối nhận xe
                          </button>
                          {o.listing_was_verified ? (
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnOutline}`}
                              disabled={actionId === o.order_id}
                              onClick={() => {
                                setDisputeText("");
                                setDisputeOpen(o.order_id);
                              }}
                            >
                              Báo cáo tranh chấp
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.85rem", color: "#64748b", alignSelf: "center" }}>
                              Xe không kiểm định sàn — không mở tranh chấp qua hệ thống.
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "#64748b", alignSelf: "center" }}>
                          Chờ người bán xác nhận đã hẹn lịch giao dịch để dùng &quot;Đã nhận xe&quot;, &quot;Từ chối nhận
                          xe&quot; và báo cáo tranh chấp.
                        </span>
                      )}
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost}`}
                        disabled={actionId === o.order_id}
                        onClick={() => void onCancel(o.order_id)}
                      >
                        Hủy cọc (hoàn BikeCoin)
                      </button>
                    </>
                  ) : null}

                  {isSeller &&
                  o.listing_was_verified &&
                  ((o.status === "DEPOSIT_HELD" && Boolean(o.meeting_confirmed_at)) ||
                    o.status === "SELLER_CONFIRMED_HANDOVER") ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline}`}
                      disabled={actionId === o.order_id}
                      onClick={() => {
                        setDisputeText("");
                        setDisputeOpen(o.order_id);
                      }}
                    >
                      Báo cáo tranh chấp
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmReceive !== null ? (
        <div className={styles.modalOverlay} onClick={() => setConfirmReceive(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận đã nhận xe</h3>
            <p style={{ color: "#475569", fontSize: "0.95rem" }}>
              Bạn xác nhận đã nhận xe đúng như đã thỏa thuận? Hệ thống sẽ chốt đơn đã bán thành công.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConfirmReceive(null)}>
                Quay lại
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={actionId === confirmReceive}
                onClick={() => void onBuyerConfirm(confirmReceive)}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectOpen !== null ? (
        <div className={styles.modalOverlay} onClick={() => !actionId && setRejectOpen(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Từ chối nhận xe</h3>
            <p style={{ color: "#475569", fontSize: "0.9rem" }}>
              Mô tả ngắn gọn lý do (tối thiểu 5 ký tự). BikeCoin cọc sẽ được hoàn về ví.
            </p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ví dụ: Không khớp mô tả / kiểm định..." />
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setRejectOpen(null)} disabled={!!actionId}>
                Hủy
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={!!actionId}
                onClick={() => void submitReject()}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {disputeOpen !== null ? (
        <div className={styles.modalOverlay} onClick={() => !actionId && setDisputeOpen(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Báo cáo tranh chấp</h3>
            <p style={{ color: "#475569", fontSize: "0.9rem" }}>
              Chỉ áp dụng khi xe đã qua kiểm định sàn. Mô tả ít nhất 10 ký tự.
            </p>
            <textarea value={disputeText} onChange={(e) => setDisputeText(e.target.value)} placeholder="Mô tả tranh chấp..." />
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setDisputeOpen(null)} disabled={!!actionId}>
                Đóng
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!!actionId}
                onClick={() => void submitDispute()}
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
