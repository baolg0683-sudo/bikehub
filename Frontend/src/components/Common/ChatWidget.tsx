"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat, type ChatTarget } from "../../context/ChatContext";
import styles from "./ChatWidget.module.css";

interface ConversationSummary {
  peer_id: number;
  peer_name: string;
  listing_id: number;
  listing_title: string;
  last_message: string;
  last_at: string | null;
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
  const { open, currentTarget, openChat, closeConversation } = useChat();
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
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const conversationKey = useCallback((conversation: ConversationSummary) => `${conversation.listing_id}-${conversation.peer_id}`, []);

  const apiBaseUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL ?? ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? "http://localhost:9999/api" : "/api")
    : "/api";

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
    if (!files) {
      return;
    }
    setAttachmentFiles((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== index));
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

      const response = await fetch(`${apiBaseUrl}/uploads`, {
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
          unread = lastAt > lastSeen ? 1 : 0;
        } else if (initializedConversationsRef.current) {
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
    const timestamp = conversation.last_at || new Date().toISOString();
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

  const reportConversation = async (conversation: ConversationSummary) => {
    if (!loggedIn || !accessToken) {
      setStatus("Vui lòng đăng nhập để báo cáo.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/interactions/conversations/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listing_id: conversation.listing_id,
          peer_id: conversation.peer_id,
          reason: "Báo cáo cuộc trò chuyện",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Báo cáo thất bại.");
      }
      setStatus("Báo cáo đã gửi.");
      setActiveActionMenu(null);
    } catch (err) {
      setStatus((err as Error).message || "Lỗi khi báo cáo cuộc trò chuyện.");
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
          setMessages(payload.messages);
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

    const currentTargetChanged = currentTarget && (
      !currentTargetSelectionRef.current ||
      currentTargetSelectionRef.current.listingId !== currentTarget.listingId ||
      currentTargetSelectionRef.current.sellerId !== currentTarget.sellerId
    );

    if (currentTarget && (currentTargetChanged || !selectedConversation)) {
      if (currentTargetChanged) {
        currentTargetSelectionRef.current = currentTarget;
      }

      const matchingExisting = conversations.find(
        (conversation) =>
          conversation.listing_id === currentTarget.listingId &&
          conversation.peer_id === currentTarget.sellerId
      );

      if (matchingExisting) {
        setSelectedConversation(matchingExisting);
        return;
      }

      const targetSummary: ConversationSummary = {
        peer_id: currentTarget.sellerId,
        peer_name: currentTarget.sellerName,
        listing_id: currentTarget.listingId,
        listing_title: currentTarget.listingTitle,
        last_message: "",
        last_at: null,
      };

      setSelectedConversation(targetSummary);
      return;
    }

    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
      fetchMessages(conversations[0]);
    }
  }, [open, currentTarget, conversations, fetchMessages, selectedConversation]);

  const selectConversation = (conversation: ConversationSummary) => {
    const key = conversationKey(conversation);
    const alreadyRead = conversation.last_at && lastReadAt[key] && conversation.last_at <= lastReadAt[key];
    if (!alreadyRead) {
      // Highlight new messages when opening a conversation
      setActiveActionMenu(null);
    }
    setSelectedConversation(conversation);
    fetchMessages(conversation);
  };

  const closeCurrentConversation = () => {
    if (selectedConversation) {
      markConversationRead(selectedConversation);
    }
    setSelectedConversation(undefined);
    closeConversation();
  };

  const sendMessage = async () => {
    const conversation = selectedConversation ??
      (currentTarget
        ? {
            peer_id: currentTarget.sellerId,
            peer_name: currentTarget.sellerName,
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
        setMessages((prev) => [
          ...prev,
          {
            message_id: result.data.message_id,
            sender_id: result.data.sender_id,
            receiver_id: result.data.receiver_id,
            listing_id: result.data.listing_id,
            content: result.data.content,
            attachments: result.data.attachments || attachmentUrls,
            created_at: new Date().toISOString(),
          },
        ]);
        setDraft("");
        setAttachmentFiles([]);
        setStatus("Tin nhắn đã gửi.");
        fetchConversations();
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
  const partnerName = selectedConversation?.peer_name || currentTarget?.sellerName || "Người trò chuyện";

  return (
    <div className={`${styles.chatWidget} ${open ? styles.open : ""}`}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={open ? closeCurrentConversation : openChat}
        aria-label={open ? "Đóng hộp tin nhắn" : "Mở hộp tin nhắn"}
      >
        💬
        {badgeCount > 0 && <span className={styles.badge}>{badgeCount}</span>}
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
              ) : conversations.length === 0 ? (
                <p className={styles.listHint}>Chưa có cuộc trò chuyện nào. Vào một tin đăng và gửi tin nhắn để bắt đầu.</p>
              ) : (
                conversations.map((conv, conversationIndex) => {
                  const key = conversationKey(conv) || `conversation-${conversationIndex}`;
                  const isActive = selectedConversation?.listing_id === conv.listing_id && selectedConversation?.peer_id === conv.peer_id;
                  const isUnread = unreadCounts[key] > 0;
                  return (
                    <div
                      key={key}
                      className={`${styles.conversationItem} ${isActive ? styles.conversationActive : ""} ${isUnread ? styles.conversationUnread : ""}`}
                      onClick={() => selectConversation(conv)}
                    >
                      <div className={styles.conversationItemContent}>
                        <strong>{conv.listing_title}{inspectionLabel}</strong>
                        <p>{conv.peer_name}</p>
                        <p className={styles.conversationMeta}>{conv.last_message}</p>
                      </div>
                      <div className={styles.conversationItemActions}>
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
                                  <img src={attachment} alt={`attachment-${index}`} className={styles.messageAttachmentImage} />
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

              <div className={styles.inputRow}>
                <div className={styles.textareaWrapper}>
                  <textarea
                    className={styles.textarea}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Nhập tin nhắn..."
                    rows={2}
                  />
                  <button
                    type="button"
                    className={styles.sendButton}
                    onClick={sendMessage}
                    aria-label="Gửi tin nhắn"
                    disabled={uploadingAttachments}
                  >
                    ➤
                  </button>
                </div>
              </div>

              {attachmentFiles.length > 0 && (
                <div className={styles.attachmentPreviewContainer}>
                  <div className={styles.attachmentPreviewHeader}>
                    <span>{attachmentFiles.length} tệp đã chọn</span>
                  </div>
                  <div className={styles.attachmentPreviewRow}>
                    {attachmentFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className={styles.attachmentPreviewItem}>
                        {isImageUrl(file.name) ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className={styles.attachmentPreviewImage} />
                        ) : isVideoUrl(file.name) ? (
                          <video controls className={styles.attachmentPreviewVideo}>
                            <source src={URL.createObjectURL(file)} />
                          </video>
                        ) : (
                          <div className={styles.attachmentPreviewFile}>
                            <span>📄</span>
                          </div>
                        )}
                        <div className={styles.attachmentPreviewMeta}>
                          <p className={styles.attachmentPreviewName}>{file.name}</p>
                          <button type="button" className={styles.attachmentRemoveButton} onClick={() => removeAttachment(index)}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.attachmentRow}>
                <label htmlFor="chatAttachmentInput" className={styles.attachButton}>
                  <span className={styles.attachButtonIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7.5 14.5l7.5-7.5a3.5 3.5 0 0 1 5 5l-9 9a3.5 3.5 0 0 1-5-5l6.5-6.5" />
                      <path d="M12 7.5l3 3" />
                    </svg>
                  </span>
                  <span>Ảnh/Video</span>
                  <input
                    id="chatAttachmentInput"
                    type="file"
                    name="images"
                    accept="image/*,video/*"
                    multiple
                    className={styles.hiddenFileInput}
                    onChange={handleAttachmentChange}
                  />
                </label>
              </div>

              {status && <div className={styles.statusMessage}>{status}</div>}
              {!loggedIn && <div className={styles.loginNotice}>Vui lòng đăng nhập để sử dụng chức năng chat.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
