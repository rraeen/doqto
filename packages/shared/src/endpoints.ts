/**
 * Paths of every endpoint in the contract, relative to the `/api/v1` prefix.
 * The web app's API client and the MSW mocks use these instead of string literals.
 */
export const API_PREFIX = '/api/v1';

export const ENDPOINTS = {
  health: '/health',
  auth: {
    otpRequest: '/auth/otp/request',
    otpVerify: '/auth/otp/verify',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    /** `POST`, signed in: ends the session on every device. */
    logoutAll: '/auth/logout-all',
  },
  /** Sign-in for doctors, clinics, labs and pharmacies (the console app). */
  consoleAuth: {
    register: '/console/auth/register',
    verify: '/console/auth/verify',
    resend: '/console/auth/resend',
    login: '/console/auth/login',
    refresh: '/console/auth/refresh',
    logout: '/console/auth/logout',
    forgotPassword: '/console/auth/forgot-password',
    resetPassword: '/console/auth/reset-password',
    me: '/console/auth/me',
  },
  /** The Doqto team's review of provider applications (needs the admin role). */
  platform: {
    applications: '/platform/applications',
    application: (id: string) => `/platform/applications/${id}`,
    decision: (id: string) => `/platform/applications/${id}/decision`,
    /** Changes doctors made to their profile, waiting for approval. */
    profileChanges: '/platform/profile-changes',
    profileChange: (id: string) => `/platform/profile-changes/${id}`,
    profileChangeDecision: (id: string) => `/platform/profile-changes/${id}/decision`,
  },
  /** The services (clinic, lab, pharmacy) an account applied for, with their approval status. */
  consoleWorkspaces: '/console/workspaces',
  /** `POST`: apply for one or more services with their forms. */
  consoleApplications: '/console/applications',
  consoleWorkspace: (id: string) => `/console/workspaces/${id}`,
  /** `GET` / `PUT`: the weekly hours of an approved clinic or doctor service. */
  consoleSchedule: (id: string) => `/console/workspaces/${id}/schedule`,
  /** `GET`: one day of an approved clinic's bookings (`?date=`, today by default). */
  consoleAppointments: (id: string) => `/console/workspaces/${id}/appointments`,
  /** `GET`: paid bookings on any date waiting for the doctor to accept. */
  consoleAppointmentsWaiting: (id: string) => `/console/workspaces/${id}/appointments/waiting`,
  /** `GET`: accepted bookings from today on, any date. */
  consoleAppointmentsUpcoming: (id: string) => `/console/workspaces/${id}/appointments/upcoming`,
  /** `POST`: check a patient in (visit code or OTP). */
  consoleQueueCheckIn: (id: string) => `/console/workspaces/${id}/queue/check-in`,
  /** `POST`: finish the patient in consult and call the next one. */
  consoleQueueNext: (id: string) => `/console/workspaces/${id}/queue/next`,
  /** `POST`: send a walk-in patient a check-in code. */
  consoleQueueSendOtp: (id: string, appointmentId: string) =>
    `/console/workspaces/${id}/queue/${appointmentId}/send-otp`,
  consoleQueueNoShow: (id: string, appointmentId: string) =>
    `/console/workspaces/${id}/queue/${appointmentId}/no-show`,
  consoleQueueMove: (id: string, appointmentId: string) =>
    `/console/workspaces/${id}/queue/${appointmentId}/move`,
  /** `PUT`: the doctor's live status that patients see. */
  consoleStatus: (id: string) => `/console/workspaces/${id}/status`,
  /** `POST`: the doctor accepts a paid booking. */
  consoleAppointmentConfirm: (id: string, appointmentId: string) =>
    `/console/workspaces/${id}/appointments/${appointmentId}/confirm`,
  /** `GET` / `PUT` / `DELETE`: the doctor's own profile; the change waits for approval. */
  consoleProfile: (id: string) => `/console/workspaces/${id}/profile`,
  /** `PUT` (multipart `file`): a new profile photo, which also waits for approval. */
  consoleProfilePhoto: (id: string) => `/console/workspaces/${id}/profile/photo`,
  /** Messages between a patient and the doctor of a booking. */
  chats: {
    /** `GET`: my conversations. */
    list: '/chats',
    /** `GET` (`?after=`) the messages; `POST` a new one. */
    thread: (appointmentId: string) => `/chats/${appointmentId}`,
  },
  /** `GET`: the doctor's conversations. */
  consoleChats: (id: string) => `/console/workspaces/${id}/chats`,
  /** `GET` (`?after=`) the messages; `POST` a reply. */
  consoleChat: (id: string, appointmentId: string) =>
    `/console/workspaces/${id}/chats/${appointmentId}`,
  me: '/me',
  myData: '/me/export',
  myPushSubscriptions: '/me/push-subscriptions',
  myPushSubscription: (id: string) => `/me/push-subscriptions/${id}`,
  transparency: '/transparency',
  /** The patient's own uploaded records (`POST` is multipart). */
  myRecords: '/me/records',
  myRecord: (id: string) => `/me/records/${id}`,
  myRecordFile: (id: string) => `/me/records/${id}/file`,
  myNotifications: '/me/notifications',
  /** `POST`: marks every notification read. */
  myNotificationsRead: '/me/notifications/read',
  myNotificationsUnread: '/me/notifications/unread-count',
  doctors: {
    search: '/doctors',
    /** `slug` may also be the doctor's 24-character id; the API checks for an id first. */
    bySlug: (slug: string) => `/doctors/${encodeURIComponent(slug)}`,
    status: (id: string) => `/doctors/${id}/status`,
    slots: (id: string) => `/doctors/${id}/slots`,
    reviews: (id: string) => `/doctors/${id}/reviews`,
  },
  appointments: {
    create: '/appointments',
    mine: '/appointments/mine',
    byId: (id: string) => `/appointments/${id}`,
    cancel: (id: string) => `/appointments/${id}/cancel`,
    reschedule: (id: string) => `/appointments/${id}/reschedule`,
    position: (id: string) => `/appointments/${id}/position`,
  },
  reviews: {
    eligibility: '/reviews/eligibility',
    create: '/reviews',
    byId: (id: string) => `/reviews/${id}`,
    /** The signed-in patient's own review of a visit, to show or edit it. 404 if none. */
    mine: (appointmentId: string) => `/reviews/mine/${appointmentId}`,
    report: (id: string) => `/reviews/${id}/report`,
  },
  payments: {
    verify: '/payments/verify',
    demoPay: '/payments/demo-pay',
  },
  clinic: {
    appointments: '/clinic/appointments',
    confirmAppointment: (id: string) => `/clinic/appointments/${id}/confirm`,
    status: '/clinic/status',
    checkIn: '/clinic/queue/check-in',
    sendOtp: (appointmentId: string) => `/clinic/queue/${appointmentId}/send-otp`,
    next: '/clinic/queue/next',
    noShow: (appointmentId: string) => `/clinic/queue/${appointmentId}/no-show`,
    move: (appointmentId: string) => `/clinic/queue/${appointmentId}/move`,
  },
  doctor: {
    onboarding: '/doctor/onboarding',
    profile: '/doctor/profile',
    registrationDocument: '/doctor/registration-document',
    photo: '/doctor/photo',
    schedule: (clinicId: string) => `/doctor/schedules/${clinicId}`,
  },
  clinics: {
    create: '/clinics',
    mine: '/clinics/mine',
    byId: (id: string) => `/clinics/${id}`,
    photos: (id: string) => `/clinics/${id}/photos`,
    photo: (id: string, index: number) => `/clinics/${id}/photos/${index}`,
    staff: (id: string) => `/clinics/${id}/staff`,
    staffMember: (id: string, userId: string) => `/clinics/${id}/staff/${userId}`,
  },
  geo: { geocode: '/geo/geocode' },
  admin: {
    doctors: '/admin/doctors',
    doctor: (id: string) => `/admin/doctors/${id}`,
    verifyDoctor: (id: string) => `/admin/doctors/${id}/verify`,
    notifications: '/admin/notifications',
  },
} as const;
