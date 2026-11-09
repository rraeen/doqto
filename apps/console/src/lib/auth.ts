import { isApiError, isNetworkError } from '@doqto/api-client';
import {
  ChatMessageSchema,
  MyProfileSchema,
  ChatMessagesResponseSchema,
  ChatThreadsResponseSchema,
  CodeSentResponseSchema,
  ConsoleAccountSchema,
  ConsoleSessionSchema,
  ConfirmAppointmentResponseSchema,
  DaySheetItemSchema,
  DaySheetResponseSchema,
  DoctorStatusSchema,
  QueueActionResponseSchema,
  SendVisitOtpResponseSchema,
  ENDPOINTS,
  ScheduleSchema,
  WorkspaceDetailSchema,
  WorkspaceSchema,
  type ChatMessage,
  type MyProfile,
  type ChatMessagesResponse,
  type ChatThreadsResponse,
  type CodeSentResponse,
  type ConsoleAccount,
  type CheckInRequest,
  type ConfirmAppointmentResponse,
  type CreateClinicAppointmentRequest,
  type ConsoleSession,
  type DaySheetItem,
  type DaySheetResponse,
  type DoctorStatus,
  type QueueActionResponse,
  type SendVisitOtpResponse,
  type PutScheduleRequest,
  type Schedule,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceType,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './api';
import { adminPath, homeFor, servicesPath } from './app-config';

const NoContent = z.void();
const paths = ENDPOINTS.consoleAuth;

/**
 * What a person typed into "phone or email" as the API expects it: an email lower-cased, an Indian
 * mobile number (10 digits, with or without +91 / 0) as +91XXXXXXXXXX. Anything else is returned
 * trimmed and the form shows the validation message.
 */
export function normalizeIdentifier(raw: string): string {
  const v = raw.trim();
  if (v.includes('@')) return v.toLowerCase();
  const digits = v.replace(/[\s()-]/g, '');
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return m ? `+91${m[1]}` : v;
}

export const isValidIdentifier = (v: string) =>
  /^\+91[6-9]\d{9}$/.test(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Same rule as the API: 10+ characters with a letter and a number. */
export const isStrongPassword = (v: string) =>
  v.length >= 10 && v.length <= 128 && /[A-Za-z]/.test(v) && /\d/.test(v);

export const registerAccount = (input: {
  name: string;
  identifier: string;
  password: string;
  language: 'en' | 'hi';
}): Promise<CodeSentResponse> =>
  apiRequest(paths.register, {
    method: 'POST',
    body: input,
    schema: CodeSentResponseSchema,
    noRefresh: true,
  });

export const verifyAccount = (identifier: string, code: string): Promise<ConsoleSession> =>
  apiRequest(paths.verify, {
    method: 'POST',
    body: { identifier, code },
    schema: ConsoleSessionSchema,
    noRefresh: true,
  });

export const resendCode = (identifier: string): Promise<CodeSentResponse> =>
  apiRequest(paths.resend, {
    method: 'POST',
    body: { identifier },
    schema: CodeSentResponseSchema,
    noRefresh: true,
  });

export const login = (identifier: string, password: string): Promise<ConsoleSession> =>
  apiRequest(paths.login, {
    method: 'POST',
    body: { identifier, password },
    schema: ConsoleSessionSchema,
    noRefresh: true,
  });

export const forgotPassword = (identifier: string): Promise<CodeSentResponse> =>
  apiRequest(paths.forgotPassword, {
    method: 'POST',
    body: { identifier },
    schema: CodeSentResponseSchema,
    noRefresh: true,
  });

export const resetPassword = (input: {
  identifier: string;
  code: string;
  newPassword: string;
}): Promise<void> =>
  apiRequest(paths.resetPassword, {
    method: 'POST',
    body: input,
    schema: NoContent,
    noRefresh: true,
  });

export const logout = (): Promise<void> =>
  apiRequest(paths.logout, { method: 'POST', body: {}, schema: NoContent, noRefresh: true });

export const getMe = (): Promise<ConsoleAccount> =>
  apiRequest(paths.me, { schema: ConsoleAccountSchema });

export const meKey = ['console', 'me'] as const;
export const scheduleKey = (unitId: string) => ['console', 'schedule', unitId] as const;
export const waitingKey = (unitId: string) =>
  ['console', 'appointments', 'waiting', unitId] as const;
export const upcomingKey = (unitId: string) =>
  ['console', 'appointments', 'upcoming', unitId] as const;
export const dayKey = (unitId: string, date: string) =>
  ['console', 'appointments', 'day', unitId, date] as const;

export const profileKey = (unitId: string) => ['console', 'profile', unitId] as const;

/** What patients see of the doctor now, and the change waiting for approval. */
export const getMyProfile = (unitId: string): Promise<MyProfile> =>
  apiRequest(ENDPOINTS.consoleProfile(unitId), { schema: MyProfileSchema });

/** Keeps the edited profile as a pending change for Doqto to approve. */
export const saveMyProfile = (
  unitId: string,
  profile: Record<string, unknown>,
): Promise<MyProfile> =>
  apiRequest(ENDPOINTS.consoleProfile(unitId), {
    method: 'PUT',
    body: { profile },
    schema: MyProfileSchema,
  });

export const uploadProfilePhoto = (unitId: string, photo: Blob): Promise<MyProfile> => {
  const formData = new FormData();
  formData.append('file', photo, 'photo.jpg');
  return apiRequest(ENDPOINTS.consoleProfilePhoto(unitId), {
    method: 'PUT',
    formData,
    schema: MyProfileSchema,
  });
};

export const withdrawProfileChange = (unitId: string): Promise<MyProfile> =>
  apiRequest(ENDPOINTS.consoleProfile(unitId), { method: 'DELETE', schema: MyProfileSchema });

export const chatsKey = (unitId: string) => ['console', 'chats', unitId] as const;
export const chatKey = (unitId: string, appointmentId: string) =>
  ['console', 'chats', unitId, appointmentId] as const;

/** The doctor's conversations with patients, the latest message first. */
export const getChats = (unitId: string): Promise<ChatThreadsResponse> =>
  apiRequest(ENDPOINTS.consoleChats(unitId), { schema: ChatThreadsResponseSchema });

/** One conversation; reading it marks the patient's messages as read. */
export const getChat = (unitId: string, appointmentId: string): Promise<ChatMessagesResponse> =>
  apiRequest(ENDPOINTS.consoleChat(unitId, appointmentId), { schema: ChatMessagesResponseSchema });

export const sendChatMessage = (
  unitId: string,
  appointmentId: string,
  text: string,
): Promise<ChatMessage> =>
  apiRequest(ENDPOINTS.consoleChat(unitId, appointmentId), {
    method: 'POST',
    body: { text },
    schema: ChatMessageSchema,
  });

/** Paid bookings, on any date, that wait for the doctor to accept them. */
export const getWaiting = (unitId: string): Promise<DaySheetItem[]> =>
  apiRequest(ENDPOINTS.consoleAppointmentsWaiting(unitId), { schema: z.array(DaySheetItemSchema) });

/** Accepted bookings from today on, on any date. */
export const getUpcoming = (unitId: string): Promise<DaySheetItem[]> =>
  apiRequest(ENDPOINTS.consoleAppointmentsUpcoming(unitId), {
    schema: z.array(DaySheetItemSchema),
  });

/** One day of bookings (IST `YYYY-MM-DD`). */
export const getDay = (unitId: string, date: string): Promise<DaySheetResponse> =>
  apiRequest(ENDPOINTS.consoleAppointments(unitId), {
    query: { date },
    schema: DaySheetResponseSchema,
  });

// ---- the visit day (queue) ----

const post = <T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> =>
  apiRequest(path, { method: 'POST', body, schema });

/** The patient is at the clinic: check them in with their visit code or a code sent to their phone. */
export const checkInPatient = (
  unitId: string,
  body: Pick<CheckInRequest, 'appointmentId' | 'method' | 'code'>,
): Promise<QueueActionResponse> =>
  post(ENDPOINTS.consoleQueueCheckIn(unitId), body, QueueActionResponseSchema);

/** Finishes the patient with the doctor (if any) and calls the next one. */
export const callNext = (
  unitId: string,
  currentAppointmentId: string | null,
): Promise<QueueActionResponse> =>
  post(ENDPOINTS.consoleQueueNext(unitId), { currentAppointmentId }, QueueActionResponseSchema);

export const sendCheckInCode = (
  unitId: string,
  appointmentId: string,
): Promise<SendVisitOtpResponse> =>
  post(ENDPOINTS.consoleQueueSendOtp(unitId, appointmentId), {}, SendVisitOtpResponseSchema);

export const markNoShow = (unitId: string, appointmentId: string): Promise<QueueActionResponse> =>
  post(ENDPOINTS.consoleQueueNoShow(unitId, appointmentId), {}, QueueActionResponseSchema);

/** Puts a waiting patient right before another one. */
export const moveInQueue = (
  unitId: string,
  appointmentId: string,
  beforeAppointmentId: string,
): Promise<QueueActionResponse> =>
  post(
    ENDPOINTS.consoleQueueMove(unitId, appointmentId),
    { beforeAppointmentId },
    QueueActionResponseSchema,
  );

/** The doctor's live status that patients see. */
export const setLiveStatus = (
  unitId: string,
  body: { state: DoctorStatus['state']; delayMinutes?: number; message?: string | null },
): Promise<DoctorStatus> =>
  apiRequest(ENDPOINTS.consoleStatus(unitId), { method: 'PUT', body, schema: DoctorStatusSchema });

/** A walk-in, or a booking taken over the phone or WhatsApp (joins today's list, no online fee). */
export const addEntry = (
  unitId: string,
  body: Pick<CreateClinicAppointmentRequest, 'source' | 'patientName' | 'patientPhone'>,
): Promise<DaySheetItem> =>
  apiRequest(ENDPOINTS.consoleAppointments(unitId), {
    method: 'POST',
    body,
    schema: DaySheetItemSchema,
  });

export const confirmAppointment = (
  unitId: string,
  appointmentId: string,
): Promise<ConfirmAppointmentResponse> =>
  apiRequest(ENDPOINTS.consoleAppointmentConfirm(unitId, appointmentId), {
    method: 'POST',
    body: {},
    schema: ConfirmAppointmentResponseSchema,
  });

/** The weekly hours of an approved clinic or doctor service. */
export const getSchedule = (unitId: string): Promise<Schedule> =>
  apiRequest(ENDPOINTS.consoleSchedule(unitId), { schema: ScheduleSchema });

export const putSchedule = (unitId: string, body: PutScheduleRequest): Promise<Schedule> =>
  apiRequest(ENDPOINTS.consoleSchedule(unitId), { method: 'PUT', body, schema: ScheduleSchema });

/** Applies for one or more services, each with its form. Doqto reviews each one. */
export const applyForServices = (
  applications: { kind: WorkspaceType; profile: Record<string, unknown> }[],
): Promise<Workspace[]> =>
  apiRequest(ENDPOINTS.consoleApplications, {
    method: 'POST',
    body: { applications },
    schema: z.array(WorkspaceSchema),
  });

/** One service with the answers already given (to fix an application sent back for changes). */
export const getWorkspace = (id: string): Promise<WorkspaceDetail> =>
  apiRequest(ENDPOINTS.consoleWorkspace(id), { schema: WorkspaceDetailSchema });

/** Where to go after signing in: the admin area for the Doqto team, otherwise by services. */
export function landingForAccount(account: {
  platformRole: 'admin' | null;
  workspaces: readonly Workspace[];
}): string {
  return account.platformRole === 'admin' ? adminPath : landingFor(account.workspaces);
}

/**
 * Where to go after signing in with only the services to go by. Exactly one approved service goes straight to its dashboard;
 * anyone else (nothing approved yet, or several services) sees the panel.
 */
export function landingFor(workspaces: readonly Workspace[]): string {
  const approved = workspaces.filter((w) => w.status === 'verified');
  return approved.length === 1 ? homeFor(approved[0]!.kind) : servicesPath;
}

/** The translation key for an error from the auth routes. */
export function authErrorKey(
  err: unknown,
):
  | 'authError.invalidCredentials'
  | 'authError.notVerified'
  | 'authError.exists'
  | 'authError.locked'
  | 'authError.rate'
  | 'authError.otpInvalid'
  | 'authError.otpExpired'
  | 'authError.otpLocked'
  | 'authError.suspended'
  | 'authError.network'
  | 'authError.generic' {
  if (isNetworkError(err)) return 'authError.network';
  if (!isApiError(err)) return 'authError.generic';
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return 'authError.invalidCredentials';
    case 'CONTACT_NOT_VERIFIED':
      return 'authError.notVerified';
    case 'CONFLICT':
      return 'authError.exists';
    case 'RATE_LIMITED':
      return err.status === 429 &&
        typeof err.details.retryAfterSeconds === 'number' &&
        err.details.retryAfterSeconds > 120
        ? 'authError.locked'
        : 'authError.rate';
    case 'OTP_INVALID':
      return 'authError.otpInvalid';
    case 'OTP_EXPIRED':
      return 'authError.otpExpired';
    case 'OTP_LOCKED':
      return 'authError.otpLocked';
    case 'ACCOUNT_SUSPENDED':
      return 'authError.suspended';
    default:
      return 'authError.generic';
  }
}
