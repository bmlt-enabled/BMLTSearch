<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { openNamnmListing } from '$lib/native';
  import { readPromoState, recordDismissal, shouldShowPopup } from '$lib/promo';

  // Decided on mount, not during SSR/prerender: the answer lives in localStorage.
  let open = $state(false);

  onMount(() => {
    open = shouldShowPopup(readPromoState('popup'), Date.now());
  });

  /** Closing it, tapping outside it, and tapping through all snooze it alike. */
  function close(): void {
    recordDismissal('popup');
    open = false;
  }

  function get(): void {
    close();
    void openNamnmListing();
  }
</script>

<!--
  Only ever mounted on the home screen — never over results or the map, so it
  does not stand between someone and a meeting. It returns every few days
  (see $lib/promo.ts).
-->
<Modal {open} title={t('NAMNM_TITLE')} onclose={close}>
  <div class="flex flex-col items-center gap-4 px-6 pt-6 pb-8 text-center">
    <img src="./namnm-icon.png" alt="" class="size-20 rounded-2xl shadow-md" />
    <p class="text-text text-base">{t('NAMNM_MESSAGE')}</p>
    <button type="button" class="focusable bg-bmlt hover:bg-bmlt-shade w-full max-w-xs rounded-lg px-5 py-3 text-base font-semibold text-white transition-colors" onclick={get}>
      {t('NAMNM_GET')}
    </button>
    <button type="button" class="focusable text-text-muted rounded-lg px-4 py-2 text-sm font-medium hover:underline" onclick={close}>
      {t('NAMNM_NOT_NOW')}
    </button>
  </div>
</Modal>
