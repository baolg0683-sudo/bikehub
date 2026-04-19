"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat, type ChatTarget } from "../../context/ChatContext";
import styles from "./ChatWidget.module.css";

function chatPeerId(target: ChatTarget): number {
  return target.peerUserId ?? target.sellerId;
}

function chatPeerName(target: ChatTarget): string {
  return target.peerName ?? target.sellerName;
}

interface ConversationSummary {
  peer_id: number;
  peer_name: string;
  listing_id: number;
  listing_title: string;
  last_message: string;
  last_at: string | null;
  /** Đơn đang trong giai đoạn chat giao dịch (cọc đang giữ / bàn giao / tranh chấp). */
  trade_order_id?: number | null;
}

interface MessageItem {
  message_id: number;
  sender_id: number;
  receiver_id: number;
  listing_id: number;
  content: string;
  attachments?: string[];
  created_at?: string;
  from_me?: boolean;
}

export function ChatWidget() {
  const { loggedIn, accessToken, user } = useAuth();
  const { open, currentTarget, openChat, closeConversation, dismissConversationTarget } = useChat();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | undefined>(undefined);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<Record<string, string>>({});
  const initializedConversationsRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentTargetSelectionRef = useRef<ChatTarget | undefined>(undefined);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [badgeCount, setBadgeCount] = useState(0);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [reportTarget, setReportTarget] = useState<ConversationSummary | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportCustom, setReportCustom] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const conversationKey = useCallback((conversation: ConversationSummary) => `${conversation.listing_id}-${conversation.peer_id}`, []);

  const targetMatchesConversation = useCallback((target: ChatTarget, conversation: ConversationSummary) => {
    return conversation.listing_id === target.listingId && conversation.peer_id === chatPeerId(target);
  }, []);

  const apiBaseUrl = "/api";
  const uploadBaseUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9999/api")
    : "http://localhost:9999/api";

  const decodeJwtPayload = (token: string | null) => {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded;
    } catch {
      return null;
    }
  };

  const currentUserId = Number(
    user?.user_id ??
    decodeJwtPayload(accessToken)?.user_id ??
    decodeJwtPayload(accessToken)?.sub ??
    decodeJwtPayload(accessToken)?.id
  );
  const hasCurrentUserId = !Number.isNaN(currentUserId) && currentUserId > 0;

  const selectedConversationKey = selectedConversation ? conversationKey(selectedConversation) : undefined;
  const selectedConversationReadAt = selectedConversationKey ? lastReadAt[selectedConversationKey] : undefined;

  const isVideoUrl = (url: string) => /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
  const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

  const inspectionLabel = user?.role === 'INSPECTOR' ? ' [Kiểm định]' : '';

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setAttachmentFiles(prev => [...prev, ...newFiles]);
    setAttachmentPreviews(prev => [...prev, ...newPreviews]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    // Revoke URL để tránh memory leak
    URL.revokeObjectURL(attachmentPreviews[index]);
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (!attachmentFiles.length) {
      return [];
    }

    if (!loggedIn || !accessToken) {
      throw new Error("Vui lòng đăng nhập để tải tệp lên.");
    }

    console.debug("uploadAttachments starting", attachmentFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })));

    setUploadingAttachments(true);
    try {
      const formData = new FormData();
      attachmentFiles.forEach((file) => formData.append("images", file));

      const response = await fetch(`${uploadBaseUrl}/uploads`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        console.error("uploadAttachments failed", response.status, result);
        throw new Error(result?.message || (result?.errors || []).join(", ") || "Tải tệp thất bại.");
      }

      console.info("uploadAttachments succeeded", result.files);
      return result.files || [];
    } catch (error) {
      console.error("uploadAttachments caught error", error);
      throw error;
    } finally {
      setUploadingAttachments(false);
    }
  };

  const computeUnreadMarkers = (rows: ConversationSummary[], readMap: Record<string, string>) => {
    let total = 0;
    const counts: Record<string, number> = {};

    rows.forEach((row) => {
      const key = conversationKey(row);
      const lastSeen = readMap[key];
      const lastAt = row.last_at;
      let unread = 0;

      if (lastAt) {
        if (lastSeen) {
          // Có tin nhắn mới sau lần đọc cuối
          unread = lastAt > lastSeen ? 1 : 0;
        } else if (initializedConversationsRef.current) {
          // Chưa từng đọc conversation này
          unread = 1;
        }
      }

      counts[key] = unread;
      total += unread;
    });

    return { counts, total };
  };

  const markConversationRead = (conversation: ConversationSummary) => {
    const key = conversationKey(conversation);
    const timestamp = new Date().toISOString();
    setLastReadAt((prev) => ({ ...prev, [key]: timestamp }));
  };

  const toggleActionMenu = (conversation: ConversationSummary, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const key = conversationKey(conversation);
    setActiveActionMenu((current) => (current === key ? null : key));
  };

  const deleteConversation = async (conversation: ConversationSummary) => {
    if (!loggedIn || !accessToken) {
      setStatus("Vui lòng đăng nhập để xóa cuộc trò chuyện.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/interactions/conversations?listing_id=${conversation.listing_id}&peer_id=${conversation.peer_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Xóa cuộc trò chuyện thất bại.");
      }
      setStatus("Đã xóa cuộc trò chuyện.");
      setSelectedConversation(undefined);
      setMessages([]);
      setActiveActionMenu(null);
      await fetchConversations();
    } catch (err) {
      setStatus((err as Error).message || "Lỗi khi xóa cuộc trò chuyện.");
    }
  };

  const reportConversation = (conversation: ConversationSummary) => {
    setReportTarget(conversation);
    setReportReason("harassment");
    setReportCustom("");
    setReportMsg(null);
    setActiveActionMenu(null);
  };

  const submitReport = async () => {
    if (!reportTarget || !loggedIn || !accessToken) return;
    if (reportReason === "other" && !reportCustom.trim()) {
      setReportMsg("❌ Vui lòng nhập lý do báo cáo.");
      return;
    }
    setReportLoading(true);
    setReportMsg(null);
    const reason = reportReason === "other"
      ? (reportCustom.trim() || "Khác")
      : reportReason === "harassment"
        ? "Tin nhắn quấy rối"
        : "Người dùng có lời lẽ không phù hợp";
    try {
      const response = await fetch(`${apiBaseUrl}/interactions/conversations/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: reportTarget.listing_id,
          peer_id: reportTarget.peer_id,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Báo cáo thất bại.");
      setReportMsg("✅ Báo cáo đã được gửi. Cảm ơn bạn!");
      setTimeout(() => setReportTarget(null), 2000);
    } catch (err) {
      setReportMsg(`❌ ${(err as Error).message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!loggedIn || !accessToken) {
      setStatus("Vui lòng đăng nhập để xóa tin nhắn.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/interactions/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Xóa tin nhắn thất bại.");
      }
      setMessages((prev) => prev.filter((item) => item.message_id !== messageId));
      setStatus("Tin nhắn đã bị xóa.");
    } catch (err) {
      setStatus((err as Error).message || "Lỗi khi xóa tin nhắn.");
    }
  };

  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    setStatus(null);

    try {
      const response = await fetch(`${apiBaseUrl}/interactions/conversations`, {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Không thể tải danh sách cuộc trò chuyện.");
      }

      const result = await response.json();
      if (result?.success) {
        const rows: ConversationSummary[] = result.data || [];
        setConversations(rows);

        if (!initializedConversationsRef.current) {
          const initialReadTimes: Record<string, string> = {};
          rows.forEach((row) => {
            const key = conversationKey(row);
            if (row.last_at) {
              initialReadTimes[key] = row.last_at;
            }
          });
          setLastReadAt((prev) => ({ ...initialReadTimes, ...prev }));
          initializedConversationsRef.current = true;
        }
      } else {
        throw new Error(result?.message || "Không thể tải cuộc trò chuyện.");
      }
    } catch (err) {
      setStatus((err as Error).message || "Lỗi khi tải cuộc trò chuyện.");
    } finally {
      setLoadingConversations(false);
    }
  }, [accessToken, conversationKey]);

  const fetchMessages = useCallback(async (conversation: ConversationSummary) => {
    setLoadingMessages(true);
    setStatus(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/interactions/messages?listing_id=${conversation.listing_id}&peer_id=${conversation.peer_id}`,
        {
          headers: {
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error("Không thể tải tin nhắn.");
      }

      const result = await response.json();
      if (result?.success) {
        setMessages(result.data || []);
      } else {
        throw new Error(result?.message || "Không thể tải tin nhắn.");
      }
    } catch (err) {
      setMessages([]);
      setStatus((err as Error).message || "Lỗi khi tải tin nhắn.");
    } finally {
      setLoadingMessages(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!open || !accessToken) {
      return;
    }

    fetchConversations();
  }, [open, accessToken, fetchConversations]);

  useEffect(() => {
    if (!open || !accessToken || !selectedConversation) {
      return;
    }

    fetchMessages(selectedConversation);
  }, [open, accessToken, selectedConversation, fetchMessages]);

  useEffect(() => {
    if (!open || !accessToken) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const streamParams = new URLSearchParams({ token: accessToken });
    if (selectedConversation) {
      streamParams.set("listing_id", String(selectedConversation.listing_id));
      streamParams.set("peer_id", String(selectedConversation.peer_id));
    }

    const eventSource = new EventSource(`${apiBaseUrl}/interactions/stream?${streamParams.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload?.conversations) {
          setConversations(payload.conversations);
        }
        if (payload?.messages && selectedConversation) {
          // Merge: giữ from_me của tin nhắn đã có, thêm tin nhắn mới từ server
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.message_id));
            const incoming: MessageItem[] = payload.messages;
            // Tin nhắn mới từ server (chưa có trong local)
            const newMsgs = incoming.filter(m => !existingIds.has(m.message_id));
            if (newMsgs.length === 0) return prev; // không có gì mới, giữ nguyên
            return [...prev, ...newMsgs];
          });
        }
      } catch (err) {
        console.error("Failed to parse chat stream event", err);
      }
    });

    eventSource.addEventListener("error", () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSourceRef.current = null;
      }
    });

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [open, accessToken, selectedConversation?.listing_id, selectedConversation?.peer_id]);

  useEffect(() => {
    const { counts, total } = computeUnreadMarkers(conversations, lastReadAt);
    setUnreadCounts(counts);
    setBadgeCount(total);
  }, [conversations, lastReadAt]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const sameTarget = (a: ChatTarget | undefined, b: ChatTarget) =>
      !!a &&
      a.listingId === b.listingId &&
      chatPeerId(a) === chatPeerId(b) &&
      (a.orderId ?? 0) === (b.orderId ?? 0);

    const currentTargetChanged = currentTarget && !sameTarget(currentTargetSelectionRef.current, currentTarget);

    if (currentTarget && (currentTargetChanged || !selectedConversation)) {
      if (currentTargetChanged) {
        currentTargetSelectionRef.current = currentTarget;
      }

      const matchingExisting = conversations.find(
        (conversation) =>
          conversation.listing_id === currentTarget.listingId &&
          conversation.peer_id === chatPeerId(currentTarget)
      );

      if (matchingExisting) {
        setSelectedConversation(matchingExisting);
        return;
      }

      const targetSummary: ConversationSummary = {
        peer_id: chatPeerId(currentTarget),
        peer_name: chatPeerName(currentTarget),
        listing_id: currentTarget.listingId,
        listing_title: currentTarget.listingTitle,
        last_message: "",
        last_at: null,
        trade_order_id:
          currentTarget.chatKind === "order_trade" && currentTarget.orderId ? currentTarget.orderId : undefined,
      };

      setSelectedConversation(targetSummary);
      return;
    }

    if (!selectedConversation && conversations.length > 0 && currentTarget) {
      // Chỉ auto-select nếu có currentTarget (mở từ trang tin đăng), không tự chọn khi mở inbox
      const matchingExisting = conversations.find(
        (c) => c.listing_id === currentTarget.listingId && c.peer_id === chatPeerId(currentTarget)
      );
      if (matchingExisting) {
        setSelectedConversation(matchingExisting);
        fetchMessages(matchingExisting);
      }
    }
  }, [open, currentTarget, conversations, fetchMessages, selectedConversation]);

  useEffect(() => {
    const tradeOrderIdForPoll =
      selectedConversation?.trade_order_id ??
      (currentTarget?.chatKind === "order_trade" &&
      currentTarget.orderId &&
      selectedConversation &&
      targetMatchesConversation(currentTarget, selectedConversation)
        ? currentTarget.orderId
        : currentTarget?.chatKind === "order_trade" && currentTarget.orderId && !selectedConversation
          ? currentTarget.orderId
          : undefined);

    if (!open || !accessToken || !tradeOrderIdForPoll) {
      return;
    }
    const orderId = tradeOrderIdForPoll;
    const ended = new Set(["COMPLETED", "CANCELLED_BY_BUYER", "REJECTED_BY_BUYER"]);

    const check = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json().catch(() => ({} as { status?: string }));
        if (response.ok && data?.status && ended.has(String(data.status))) {
          closeConversation();
        }
      } catch {
        // ignore
      }
    };

    void check();
    const interval = setInterval(() => void check(), 4000);
    return () => clearInterval(interval);
  }, [
    open,
    accessToken,
    apiBaseUrl,
    closeConversation,
    selectedConversation?.trade_order_id,
    selectedConversation,
    currentTarget?.chatKind,
    currentTarget?.orderId,
    currentTarget,
    targetMatchesConversation,
  ]);

  const selectConversation = (conversation: ConversationSummary) => {
    if (currentTarget && !targetMatchesConversation(currentTarget, conversation)) {
      dismissConversationTarget();
    }
    // Mark as read ngay khi click vào
    markConversationRead(conversation);
    setActiveActionMenu(null);
    setSelectedConversation(conversation);
    fetchMessages(conversation);
  };

  const closeCurrentConversation = () => {
    if (selectedConversation) {
      markConversationRead(selectedConversation);
    }
    setSelectedConversation(undefined);
    setMessages([]);
    closeConversation();
  };

  const sendMessage = async () => {
    const conversation = selectedConversation ??
      (currentTarget
        ? {
            peer_id: chatPeerId(currentTarget),
            peer_name: chatPeerName(currentTarget),
            listing_id: currentTarget.listingId,
            listing_title: currentTarget.listingTitle,
            last_message: "",
            last_at: null,
          }
        : undefined);

    if (!conversation) {
      setStatus("Chọn cuộc trò chuyện hoặc sản phẩm để gửi tin nhắn.");
      return;
    }

    if (!draft.trim() && attachmentFiles.length === 0) {
      return;
    }

    if (!loggedIn || !accessToken) {
      setStatus("Vui lòng đăng nhập để gửi tin nhắn.");
      return;
    }

    let attachmentUrls: string[] = [];
    if (attachmentFiles.length > 0) {
      try {
        attachmentUrls = await uploadAttachments();
      } catch (err) {
        setStatus((err as Error).message || "Tải tệp thất bại.");
        return;
      }
    }

    const payload = {
      receiver_id: conversation.peer_id,
      listing_id: conversation.listing_id,
      content: draft.trim(),
      attachments: attachmentUrls,
    };

    try {
      const response = await fetch(`${apiBaseUrl}/interactions/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.message || "Gửi tin nhắn thất bại.");
      }
      const result = await response.json();
      if (result?.success) {
        // Thêm tin nhắn với from_me=true để hiển thị đúng phía ngay lập tức
        setMessages((prev) => [
          ...prev,
          {
            message_id: result.data.message_id,
            sender_id: result.data.sender_id,
            receiver_id: result.data.receiver_id,
            listing_id: result.data.listing_id,
            content: result.data.content,
            attachments: result.data.attachments || attachmentUrls,
            created_at: result.data.created_at || new Date().toISOString(),
            from_me: true,
          },
        ]);
        setDraft("");
        setAttachmentFiles([]);
        attachmentPreviews.forEach(url => URL.revokeObjectURL(url));
        setAttachmentPreviews([]);
        setStatus(null);
        // Cập nhật conversation list nhưng không reload messages (tránh nhảy)
        void fetchConversations();
      } else {
        throw new Error(result?.message || "Không thể gửi tin nhắn.");
      }
    } catch (err) {
      setStatus((err as Error).message || "Lỗi khi gửi tin nhắn.");
    }
  };

  const conversationTitle = selectedConversation?.listing_title || currentTarget?.listingTitle || "Chưa chọn cuộc trò chuyện";
  const listingId = selectedConversation?.listing_id || currentTarget?.listingId;
  const listingUrl = listingId ? `/listing/${listingId}` : "/";
  const partnerName =
    selectedConversation?.peer_name || (currentTarget ? chatPeerName(currentTarget) : "") || "Người trò chuyện";

  const tradeOrderLabelId =
    (currentTarget?.chatKind === "order_trade" && currentTarget.orderId ? currentTarget.orderId : undefined) ??
    selectedConversation?.trade_order_id ??
    undefined;

  // Sort conversations: mới nhất lên đầu
  const sortedConversations = [...conversations].sort((a, b) => {
    if (!a.last_at && !b.last_at) return 0;
    if (!a.last_at) return 1;
    if (!b.last_at) return -1;
    return b.last_at.localeCompare(a.last_at);
  });

  return (
    <div className={`${styles.chatWidget} ${open ? styles.open : ""}`}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={open ? closeCurrentConversation : openChat}
        aria-label={open ? "Đóng hộp tin nhắn" : "Mở hộp tin nhắn"}
      >
        💬
        {badgeCount > 0 && (
          <span className={styles.badge}>{badgeCount > 99 ? "99+" : badgeCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelTop}>
            <span className={styles.panelTitle}>Tin nhắn</span>
            <button type="button" className={styles.closeButton} onClick={closeCurrentConversation} aria-label="Thu nhỏ hộp tin nhắn">
              —
            </button>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.conversationList}>
              <div className={styles.sectionHeader}>
                <h3>Hộp tin nhắn</h3>
                <span>{conversations.length} cuộc trò chuyện</span>
              </div>
              {loadingConversations ? (
                <p className={styles.listHint}>Đang tải...</p>
              ) : sortedConversations.length === 0 ? (
                <p className={styles.listHint}>Chưa có cuộc trò chuyện nào.</p>
              ) : (
                sortedConversations.map((conv, conversationIndex) => {
                  const key = conversationKey(conv) || `conversation-${conversationIndex}`;
                  const isActive = selectedConversation?.listing_id === conv.listing_id && selectedConversation?.peer_id === conv.peer_id;
                  const unreadCount = unreadCounts[key] ?? 0;
                  const isUnread = unreadCount > 0;
                  return (
                    <div
                      key={key}
                      className={`${styles.conversationItem} ${isActive ? styles.conversationActive : ""} ${isUnread ? styles.conversationUnread : ""}`}
                      onClick={() => selectConversation(conv)}
                    >
                      <div className={styles.conversationItemContent}>
                        <strong>
                          {conv.listing_title}
                          {inspectionLabel}
                          {conv.trade_order_id ? (
                            <span className={styles.tradeChatBadge}> Giao dịch · #{conv.trade_order_id}</span>
                          ) : null}
                        </strong>
                        <p>{conv.peer_name}</p>
                        <p className={`${styles.conversationMeta} ${isUnread ? styles.conversationMetaUnread : ""}`}>
                          {conv.last_message}
                        </p>
                      </div>
                      <div className={styles.conversationItemActions}>
                        {isUnread && (
                          <span className={styles.unreadDot} />
                        )}
                        <button
                          type="button"
                          className={styles.actionMenuToggle}
                          onClick={(event) => toggleActionMenu(conv, event)}
                          aria-label="Thao tác cuộc trò chuyện"
                        >
                          ...
                        </button>
                        {activeActionMenu === key && (
                          <div className={styles.actionMenu}>
                            <button type="button" className={styles.actionMenuItem} onClick={() => reportConversation(conv)}>
                              Báo cáo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.conversationDetail}>
              {!selectedConversation && !currentTarget ? (
                <div className={styles.noConvPlaceholder}>
                  <span className={styles.noConvIcon}>💬</span>
                  <p>Chọn một cuộc hội thoại để bắt đầu</p>
                </div>
              ) : (
              <>
              <div className={styles.detailHeader}>
                <div>
                  {selectedConversation?.listing_id || currentTarget?.listingId ? (
                    <Link href={listingUrl} className={styles.productLink} onClick={closeCurrentConversation}>
                      <span className={styles.detailTitle}>{conversationTitle}</span>
                    </Link>
                  ) : (
                    <span className={styles.detailTitle}>{conversationTitle}</span>
                  )}
                  <p className={styles.detailSubtitle}>Đang trò chuyện với: {partnerName}{inspectionLabel}</p>
                  {tradeOrderLabelId ? (
                    <span className={styles.tradeChatBadge}>Chat giao dịch · Đơn #{tradeOrderLabelId}</span>
                  ) : null}
                </div>
              </div>

              <div className={styles.messageList}>
                {loadingMessages ? (
                  <p className={styles.messageHint}>Đang tải tin nhắn...</p>
                ) : !selectedConversation && !currentTarget ? (
                  <p className={styles.messageHint}>Chọn một cuộc trò chuyện bên trái để xem nội dung chat.</p>
                ) : messages.length === 0 ? (
                  <p className={styles.messageHint}>Chưa có tin nhắn. Gửi một tin nhắn để bắt đầu.</p>
                ) : (
                  messages.map((message, messageIndex) => {
                    const fromMe = typeof message.from_me === "boolean"
                      ? message.from_me
                      : hasCurrentUserId && message.sender_id === currentUserId;
                    const isUnreadMessage = !fromMe && selectedConversationReadAt && message.created_at && message.created_at > selectedConversationReadAt;
                    const messageKey = message.message_id ?? `message-${messageIndex}`;
                    return (
                      <div
                        key={messageKey}
                        className={`${styles.messageItem} ${fromMe ? styles.messageFromMe : styles.messageFromSeller} ${isUnreadMessage ? styles.messageUnread : ""}`}
                      >
                        <div className={styles.messageRow}>
                          <p className={styles.messageText}>{message.content}</p>
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className={styles.messageAttachments}>
                            {message.attachments.map((attachment, index) => (
                              <div key={`${messageKey}-attachment-${index}`} className={styles.messageAttachmentItem}>
                                {isImageUrl(attachment) ? (
                                  <div className={styles.messageAttachmentImageWrap}>
                                    <img
                                      src={attachment}
                                      alt={`attachment-${index}`}
                                      className={styles.messageAttachmentImage}
                                    />
                                    <button
                                      className={styles.zoomBtn}
                                      onClick={() => setZoomImage(attachment)}
                                      title="Phóng to"
                                    >🔍</button>
                                  </div>
                                ) : isVideoUrl(attachment) ? (
                                  <video controls className={styles.messageAttachmentVideo}>
                                    <source src={attachment} />
                                  </video>
                                ) : (
                                  <a href={attachment} target="_blank" rel="noreferrer" className={styles.messageAttachmentLink}>
                                    Mở tệp đính kèm
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className={styles.messageMeta}>
                          {fromMe ? "Bạn" : partnerName}{inspectionLabel}
                          {message.created_at ? ` • ${new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Attachment preview nằm trên textarea ── */}
              {attachmentFiles.length > 0 && (
                <div className={styles.attachPreviewArea}>
                  {attachmentFiles.map((file, index) => {
                    const previewUrl = attachmentPreviews[index];
                    const isImg = file.type.startsWith("image/");
                    const isVid = file.type.startsWith("video/");
                    return (
                      <div key={`${file.name}-${index}`} className={styles.attachPreviewItem}>
                        {isImg ? (
                          <div className={styles.attachPreviewImgWrap}>
                            <img src={previewUrl} alt={file.name} className={styles.attachPreviewMedia} />
                            <button
                              type="button"
                              className={styles.attachPreviewZoom}
                              onClick={() => setZoomImage(previewUrl)}
                              title="Phóng to"
                            >🔍</button>
                          </div>
                        ) : isVid ? (
                          <video src={previewUrl} className={styles.attachPreviewMedia} muted />
                        ) : (
                          <div className={styles.attachPreviewFile}>📄 <span>{file.name}</span></div>
                        )}
                        <button
                          type="button"
                          className={styles.attachPreviewRemove}
                          onClick={() => removeAttachment(index)}
                          title="Xóa"
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.inputRow}>
                <div className={styles.textareaWrapper}>
                  <textarea
                    className={styles.textarea}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
                    }}
                    placeholder="Nhập tin nhắn... (Enter gửi)"
                    rows={2}
                  />
                  <button
                    type="button"
                    className={styles.sendButton}
                    onClick={() => void sendMessage()}
                    aria-label="Gửi tin nhắn"
                    disabled={uploadingAttachments}
                  >
                    {uploadingAttachments ? "⏳" : "➤"}
                  </button>
                </div>
              </div>

              <div className={styles.attachmentRow}>
                <label className={styles.attachButton} title="Gửi ảnh/video">
                  <span>📎</span>
                  <span>Ảnh/Video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className={styles.hiddenFileInput}
                    onChange={handleAttachmentChange}
                  />
                </label>
              </div>

              {status && <div className={styles.statusMessage}>{status}</div>}
              {!loggedIn && <div className={styles.loginNotice}>Vui lòng đăng nhập để sử dụng chức năng chat.</div>}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox zoom ảnh */}
      {zoomImage && (
        <div className={styles.lightboxOverlay} onClick={() => setZoomImage(null)}>
          <button className={styles.lightboxClose} onClick={() => setZoomImage(null)}>✕</button>
          <img src={zoomImage} alt="zoom" className={styles.lightboxImage} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
        <div className={styles.lightboxOverlay} onClick={() => setReportTarget(null)}>
          <div className={styles.reportModal} onClick={e => e.stopPropagation()}>
            <div className={styles.reportHeader}>
              <h3>Báo cáo cuộc trò chuyện</h3>
              <button className={styles.lightboxClose} style={{ position: 'static' }} onClick={() => setReportTarget(null)}>✕</button>
            </div>
            <p className={styles.reportSub}>Cuộc trò chuyện với <strong>{reportTarget.peer_name}</strong></p>

            <div className={styles.reportOptions}>
              {[
                { value: "harassment", label: "Tin nhắn quấy rối" },
                { value: "inappropriate", label: "Người dùng có lời lẽ không phù hợp" },
                { value: "other", label: "Khác" },
              ].map(opt => (
                <label key={opt.value} className={styles.reportOption}>
                  <input
                    type="radio"
                    name="reportReason"
                    value={opt.value}
                    checked={reportReason === opt.value}
                    onChange={() => setReportReason(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            {reportReason === "other" && (
              <textarea
                className={styles.reportTextarea}
                placeholder="Nhập lý do báo cáo..."
                value={reportCustom}
                onChange={e => setReportCustom(e.target.value)}
                rows={3}
              />
            )}

            {reportMsg && (
              <p className={styles.reportMsg}>{reportMsg}</p>
            )}

            <div className={styles.reportActions}>
              <button className={styles.reportCancelBtn} onClick={() => setReportTarget(null)} disabled={reportLoading}>
                Hủy
              </button>
              <button className={styles.reportSubmitBtn} onClick={() => void submitReport()} disabled={reportLoading}>
                {reportLoading ? "Đang gửi..." : "Gửi báo cáo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
