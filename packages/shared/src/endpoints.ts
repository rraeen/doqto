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
  },
  me: '/me',
  myNotifications: '/me/notifications',
  doctors: {
    search: '/doctors',
    bySlug: (slug: string) => `/doctors/${encodeURIComponent(slug)}`,
    status: (id: string) => `/doctors/${id}/status`,
  },
  appointments: {
    position: (id: string) => `/appointments/${id}/position`,
  },
  clinic: {
    appointments: '/clinic/appointments',
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
