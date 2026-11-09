import {
  ChatMessageSchema,
  ChatMessagesResponseSchema,
  ChatThreadsResponseSchema,
  ENDPOINTS,
  type ChatMessage,
  type ChatMessagesResponse,
  type ChatThreadsResponse,
} from '@doqto/shared';
import { apiRequest } from './client';

/** My conversations, newest message first. */
export function listChats(signal?: AbortSignal): Promise<ChatThreadsResponse> {
  return apiRequest(ENDPOINTS.chats.list, { schema: ChatThreadsResponseSchema, signal });
}

/** One conversation. With `after` only the messages newer than that time come back. */
export function openChat(
  appointmentId: string,
  after?: string,
  signal?: AbortSignal,
): Promise<ChatMessagesResponse> {
  return apiRequest(ENDPOINTS.chats.thread(appointmentId), {
    query: after ? { after } : undefined,
    schema: ChatMessagesResponseSchema,
    signal,
  });
}

export function sendChat(appointmentId: string, text: string): Promise<ChatMessage> {
  return apiRequest(ENDPOINTS.chats.thread(appointmentId), {
    method: 'POST',
    body: { text },
    schema: ChatMessageSchema,
  });
}
