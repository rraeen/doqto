/**
 * Messages between a patient and the doctor they booked. One thread per booking: it opens when the
 * doctor accepts the booking and stays open for a few days after the visit, then it can be read
 * but not written to. Text only. Contract v6.14.0.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, IstDateSchema, ObjectIdSchema } from './common';
import { AppointmentStatusSchema } from './enums';
import { SpecialtyKeySchema } from './specialties';

export const CHAT_TEXT_MAX = 1000;
/** How long after the visit both sides can still write. */
export const CHAT_OPEN_DAYS_AFTER_VISIT = 7;

export const ChatSenderSchema = z.enum(['patient', 'doctor']);
export type ChatSender = z.infer<typeof ChatSenderSchema>;

export const ChatMessageSchema = z.object({
  id: ObjectIdSchema,
  appointmentId: ObjectIdSchema,
  from: ChatSenderSchema,
  text: z.string(),
  at: IsoDateTimeSchema,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const SendChatMessageRequestSchema = z.object({
  text: z.string().trim().min(1).max(CHAT_TEXT_MAX),
});
export type SendChatMessageRequest = z.infer<typeof SendChatMessageRequestSchema>;

/** One conversation, as the list and the top of the screen show it. */
export const ChatThreadSchema = z.object({
  /** The thread is the booking's id. */
  appointmentId: ObjectIdSchema,
  /** The doctor for a patient; the patient for the doctor. */
  withName: z.string(),
  /** Only set for the patient's view. */
  specialty: SpecialtyKeySchema.nullable(),
  /** Only set for the patient's view: the public page of the doctor. */
  doctorSlug: z.string().nullable(),
  /** Only set for the patient's view: the doctor's approved profile photo. */
  photoUrl: z.string().nullable().optional(),
  appointmentDate: IstDateSchema,
  appointmentStatus: AppointmentStatusSchema,
  /** False once the window after the visit has passed (or the booking was cancelled). */
  open: z.boolean(),
  /** Messages from the other side that this side has not read yet. */
  unread: z.number().int().nonnegative(),
  lastMessage: ChatMessageSchema.nullable(),
});
export type ChatThread = z.infer<typeof ChatThreadSchema>;

export const ChatThreadsResponseSchema = z.object({ items: z.array(ChatThreadSchema) });
export type ChatThreadsResponse = z.infer<typeof ChatThreadsResponseSchema>;

/** `GET .../chats/:appointmentId?after=<iso>`: the thread and its messages (those after `after`). */
export const ChatMessagesResponseSchema = z.object({
  thread: ChatThreadSchema,
  messages: z.array(ChatMessageSchema),
});
export type ChatMessagesResponse = z.infer<typeof ChatMessagesResponseSchema>;
