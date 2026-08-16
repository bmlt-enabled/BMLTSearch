/**
 * Chrome state shared between the layout and the pages inside it.
 *
 * The drawer is owned by the layout but opened from each page's app bar, and a
 * one-field store beats threading a callback through every route.
 */
class Drawer {
  #open = $state(false);

  get open(): boolean {
    return this.#open;
  }

  toggle(): void {
    this.#open = !this.#open;
  }

  show(): void {
    this.#open = true;
  }

  close(): void {
    this.#open = false;
  }
}

export const drawer = new Drawer();
