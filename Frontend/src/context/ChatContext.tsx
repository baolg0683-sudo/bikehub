"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface ChatTarget {
  /** Đối tác nhận tin nhắn (thường là sellerId khi mở từ trang tin). */
  sellerId: number;
  sellerName: string;
  listingId: number;
  listingTitle: string;
  /** Ghi đè người nhận (vd. chat đơn hàng: người mua ↔ người bán). */
  peerUserId?: number;
  peerName?: string;
  chatKind?: "listing" | "order_trade";
  orderId?: number;
}

interface ChatContextValue {
  open: boolean;
  currentTarget?: ChatTarget;
  openChat: () => void;
  openConversation: (target: ChatTarget) => void;
  /** Đóng panel + xóa target (đơn đã kết thúc, hoặc người dùng đóng). */
  closeConversation: () => void;
  /** Giữ panel mở nhưng bỏ target mở từ đơn hàng (đổi thread trong danh sách). */
  dismissConversationTarget: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState<ChatTarget | undefined>(undefined);

  const openChat = () => {
    setOpen(true);
  };

  const openConversation = (target: ChatTarget) => {
    setCurrentTarget(target);
    setOpen(true);
  };

  const closeConversation = () => {
    setOpen(false);
    setCurrentTarget(undefined);
  };

  const dismissConversationTarget = () => {
    setCurrentTarget(undefined);
  };

  const value = useMemo(
    () => ({
      open,
      currentTarget,
      openChat,
      openConversation,
      closeConversation,
      dismissConversationTarget,
    }),
    [open, currentTarget, openChat, openConversation, closeConversation, dismissConversationTarget]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
