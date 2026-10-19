// Imported first by one-off scripts, before AppModule validates the environment:
// a script must never start the jobs worker or crons.
process.env.JOBS_ENABLED = 'false';
