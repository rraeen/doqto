import type {
  LabBooking as LabBookingDto,
  LabCatalogue,
  LabConsoleBooking,
  LabTest as LabTestDto,
} from '@doqto/shared';
import type {
  LabBookingDocument,
  LabCategoryDocument,
  LabDocument,
  LabTestDocument,
} from './lab.schema';

export function toLabTest(t: LabTestDocument, categoryName: string | null): LabTestDto {
  return {
    id: t._id.toHexString(),
    name: t.name,
    categoryId: t.categoryId?.toHexString() ?? null,
    categoryName,
    pricePaise: t.pricePaise,
    sampleType: t.sampleType ?? null,
    preparation: t.preparation ?? null,
    turnaroundHours: t.turnaroundHours ?? null,
    homeCollection: t.homeCollection,
    active: t.active,
  };
}

export function toCatalogue(
  categories: LabCategoryDocument[],
  tests: LabTestDocument[],
): LabCatalogue {
  const names = new Map(categories.map((c) => [c._id.toHexString(), c.name]));
  return {
    categories: categories
      .map((c) => ({ id: c._id.toHexString(), name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tests: tests
      .map((t) => toLabTest(t, t.categoryId ? (names.get(t.categoryId.toHexString()) ?? null) : null))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** The booking as the patient sees it. */
export function toLabBooking(
  b: LabBookingDocument,
  lab: Pick<LabDocument, '_id' | 'slug' | 'name' | 'cityLabel'>,
): LabBookingDto {
  return {
    id: b._id.toHexString(),
    code: b.code,
    status: b.status,
    lab: { id: lab._id.toHexString(), slug: lab.slug, name: lab.name, city: lab.cityLabel },
    patientName: b.patientName,
    items: b.items.map((i) => ({
      testId: i.testId.toHexString(),
      name: i.name,
      pricePaise: i.pricePaise,
    })),
    totalPaise: b.totalPaise,
    collection: { mode: b.mode, date: b.date, window: b.window, address: b.address ?? null },
    note: b.note ?? null,
    rejectReason: b.rejectReason ?? null,
    history: b.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
    reportReady: Boolean(b.reportKey) && (b.status === 'report_ready' || b.status === 'completed'),
    createdAt: (b as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

/** The booking as the lab sees it, with the patient's contact and who collects. */
export function toConsoleBooking(
  b: LabBookingDocument,
  assignee: { id: string; name: string } | null,
): LabConsoleBooking {
  const { lab: _lab, ...rest } = toLabBooking(b, {
    _id: b.labId,
    slug: '',
    name: '',
    cityLabel: '',
  });
  return {
    ...rest,
    patientPhone: b.patientPhone,
    assignedTo: assignee ? { accountId: assignee.id, name: assignee.name } : null,
    reportUploadedAt: b.reportUploadedAt?.toISOString() ?? null,
  };
}
