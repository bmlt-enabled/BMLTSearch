<script lang="ts" module>
  /**
   * Once per launch. Module state lives exactly as long as the JavaScript does,
   * which is one launch of the app (or one page load on the web), so returning
   * to the home screen later in the same session does not reopen it.
   */
  let shownThisLaunch = false;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { openNamnmListing } from '$lib/native';

  let open = $state(false);

  onMount(() => {
    if (shownThisLaunch) return;
    shownThisLaunch = true;
    open = true;
  });

  function close(): void {
    open = false;
  }

  function get(): void {
    close();
    void openNamnmListing();
  }
</script>

<!--
  Only ever mounted on the home screen — never over results or the map, so it
  does not stand between someone and a meeting. It opens on every launch.
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
