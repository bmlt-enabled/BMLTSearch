/**
 * The app-wide busy indicator.
 *
 * Counted rather than boolean. The Ionic build tracked a single `loader` promise
 * per page and guarded it with `if (!this.loader)`, so a second overlapping
 * request — a radius nudge landing while the first search was still in flight —
 * would either fail to show the spinner or dismiss it while work was still
 * running. A counter makes overlap the normal case: the overlay is up while at
 * least one caller holds a token, and comes down when the last one releases.
 */
class Loading {
  #depth = $state(0);
  #message = $state('');

  get active(): boolean {
    return this.#depth > 0;
  }

  get message(): string {
    return this.#message;
  }

  /**
   * Claim the overlay. Returns the release function — call it in a `finally`,
   * or use `during()` and let it handle that.
   */
  begin(message = ''): () => void {
    this.#depth += 1;
    if (message) this.#message = message;

    let released = false;
    return () => {
      if (released) return; // double-release must not unbalance the count
      released = true;
      this.#depth = Math.max(0, this.#depth - 1);
      if (this.#depth === 0) this.#message = '';
    };
  }

  /** Run `work` with the overlay up, releasing it however `work` finishes. */
  async during<T>(message: string, work: () => Promise<T>): Promise<T> {
    const release = this.begin(message);
    try {
      return await work();
    } finally {
      release();
    }
  }
}

export const loading = new Loading();
