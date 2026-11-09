'use client';

import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import type { AppointmentCardData } from '@/lib/appointments-view';
import {
  downloadTextFile,
  prescriptionFileName,
  prescriptionText,
  type PrescriptionLabels,
} from '@/lib/prescription';
import { useDayLabel, useWhen } from './use-when';

/** The prescription of one visit as text, with download and share actions. */
export function usePrescriptionFile(a: AppointmentCardData) {
  const { t } = useI18n();
  const when = useWhen()(a.start);
  const followUpLabel = useDayLabel()(a.prescription?.followUp ?? null);
  const rx = a.prescription ?? null;

  const labels: PrescriptionLabels = {
    title: t('appointments.fileTitle'),
    doctor: t('appointments.fileDoctor'),
    date: t('appointments.fileDate'),
    rx: 'RX',
    medicines: t('appointments.medicines'),
    notes: t('appointments.fileNotes'),
    followUp: t('prescription.followUp'),
    timing: {
      after_food: t('prescription.afterFood'),
      before_food: t('prescription.beforeFood'),
      with_water: t('prescription.withWater'),
      anytime: t('prescription.anytime'),
    },
    slots: {
      morning: t('prescription.morning'),
      noon: t('prescription.noon'),
      night: t('prescription.night'),
    },
  };
  const text = () =>
    rx
      ? prescriptionText(
          rx,
          { doctorName: a.doctor.name, dateLabel: when?.date ?? '', followUpLabel },
          labels,
        )
      : '';

  return {
    rx,
    when,
    followUpLabel,
    download: () => {
      if (rx) downloadTextFile(prescriptionFileName(a.doctor.name, a.start), text());
    },
    /** Uses the phone's share sheet when there is one, otherwise copies the text. */
    share: async () => {
      if (!rx) return;
      const body = text();
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share({ title: labels.title, text: body });
        } else {
          await navigator.clipboard.writeText(body);
          toast.success(t('prescription.copied'));
        }
      } catch {
        // The person closed the share sheet; nothing to do.
      }
    },
  };
}
