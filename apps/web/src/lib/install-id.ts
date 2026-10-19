const KEY = 'doqto_install_id';

/** A random id kept per browser install; labels refresh tokens (and feeds fraud signals later, INT-15). */
export function getInstallId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}
