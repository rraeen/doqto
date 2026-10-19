// Imported before the app in jobs-runner.e2e-spec.ts: that file boots the real worker and crons.
process.env.JOBS_ENABLED = 'true';
process.env.JOB_POLL_MS = '200';
