export function samplesSessionWritesEnabled(): boolean {
  return process.env.SAMPLES_SESSION_WRITES === 'true'
}
