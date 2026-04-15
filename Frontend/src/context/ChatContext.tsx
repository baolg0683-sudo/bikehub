"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface ChatTarget {
  sellerId: number;
  sellerName: string;
  listingId: number;
  listingTitle: string;
}

interface ChatContextValue {
  open: boolean;
  currentTarget?: ChatTarget;
  openChat: () => void;
  openConversation: (target: ChatTarget) => void;
  closeConversation: () => void;
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
  };

  const value = useMemo(
    () => ({ open, currentTarget, openChat, openConversation, closeConversation }),
    [open, currentTarget, openChat, openConversation, closeConversation]
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
