'use client';

import type { ChatMessage, ChatMessagesResponse } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chatsApi } from './api/lazy';

export const chatsKey = ['chats'] as const;
const POLL_MS = 6_000;

/** The list of conversations, refreshed gently so a new reply shows up without a reload. */
export function useChats(signedIn: boolean) {
  return useQuery({
    queryKey: chatsKey,
    queryFn: ({ signal }) => chatsApi.listChats(signal),
    enabled: signedIn,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/**
 * One conversation. The first call loads the latest messages; after that only newer ones are asked
 * for every few seconds and added, so the screen stays current while it is open. Reading the thread
 * marks the doctor's messages as read on the server.
 */
export function useChatThread(appointmentId: string, signedIn: boolean) {
  const qc = useQueryClient();
  const [thread, setThread] = useState<ChatMessagesResponse['thread']>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const last = useRef<string | undefined>(undefined);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
    last.current = incoming[incoming.length - 1]!.at;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (first: boolean) => {
      try {
        const res = await chatsApi.openChat(appointmentId, first ? undefined : last.current);
        if (stopped) return;
        setThread(res.thread);
        merge(res.messages);
        setState('ready');
        if (first || res.messages.length > 0) void qc.invalidateQueries({ queryKey: chatsKey });
      } catch (e) {
        if (stopped) return;
        const status = (e as { status?: number }).status;
        if (status === 404) {
          setState('missing');
          return;
        }
        // A failed poll while the thread is on screen is just tried again.
        if (first) setState('error');
      }
      if (!stopped) timer = setTimeout(() => void tick(false), POLL_MS);
    };
    void tick(true);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [appointmentId, signedIn, merge, qc]);

  const send = useMutation({
    mutationFn: (text: string) => chatsApi.sendChat(appointmentId, text),
    onSuccess: (m) => {
      merge([m]);
      void qc.invalidateQueries({ queryKey: chatsKey });
    },
  });

  return { thread, messages, state, send };
}
