/** Thrown by a live adapter whose story has not landed or whose keys are missing. */
export class ProviderNotConfiguredError extends Error {
  constructor(
    readonly provider: string,
    readonly story?: string,
  ) {
    super(`${provider} is not configured${story ? ` (live adapter arrives in ${story})` : ''}`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** Thrown when a webhook or payment signature does not verify. Callers answer 400/401 and stop. */
export class SignatureVerificationError extends Error {
  constructor(readonly source: string) {
    super(`${source} signature verification failed`);
    this.name = 'SignatureVerificationError';
  }
}

/** Thrown for input a provider refuses before any side effect (bad phone, bad key, bad amount). */
export class ProviderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderInputError';
  }
}
