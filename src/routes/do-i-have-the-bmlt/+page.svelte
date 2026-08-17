<script lang="ts">
  import { Users, Globe, Smile } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { singleNearestMeeting, aggregatorServiceBodies } from '$lib/api/bmlt';
  import AppBar from '$lib/components/AppBar.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { LocationError, resolveSearchOrigin } from '$lib/location';
  import { openExternal } from '$lib/native';
  import { serviceBodyNames } from '$lib/serviceBodies';
  import { loading } from '$lib/stores/loading.svelte';
  import { drawer } from '$lib/stores/ui.svelte';

  /**
   * "Is the BMLT used where I am?" answered by distance to the nearest listed
   * meeting: under 100 miles means the local service body publishes to the BMLT.
   */
  const COVERED_WITHIN_MILES = 100;

  type Verdict = 'checking' | 'covered' | 'not-covered';

  let verdict = $state<Verdict>('checking');
  let miles = $state(0);
  let kms = $state(0);
  let serviceBody = $state('');
  let error = $state('');

  onMount(() => void check());

  async function check() {
    error = '';
    verdict = 'checking';
    try {
      const origin = await loading.during(t('LOCATING'), () => resolveSearchOrigin(false));

      // Both requests at once — the service body names do not depend on the
      // meeting, and the Ionic build serialised them, doubling the wait.
      const [bodies, nearest] = await loading.during(t('FINDING_MTGS'), () => Promise.all([aggregatorServiceBodies(), singleNearestMeeting(origin.lat, origin.lng)]));

      const meeting = nearest[0];
      if (!meeting) {
        verdict = 'not-covered';
        return;
      }

      miles = Number.parseFloat(meeting.distance_in_miles ?? '0');
      kms = Number.parseFloat(meeting.distance_in_km ?? '0');
      serviceBody = serviceBodyNames(bodies).get(String(meeting.service_body_bigint ?? '')) ?? '';
      verdict = miles < COVERED_WITHIN_MILES ? 'covered' : 'not-covered';
    } catch (cause) {
      error = cause instanceof LocationError ? t('NO_LOCATION') : t('LOAD_ERROR');
    }
  }

  const distance = $derived(`${miles.toFixed(1)} ${t('MILES')} (${kms.toFixed(1)} ${t('KMS')}) ${t('AWAY')}`);
</script>

<svelte:head><title>{t('DOIHAVETHEBMLT')}</title></svelte:head>

<AppBar title={t('DOIHAVETHEBMLT')} onmenu={() => drawer.toggle()} />

<div class="space-y-3 p-4">
  <section class="border-border bg-surface-raised rounded-xl border p-5">
    <h2 class="text-text-muted mb-3 text-xs font-bold tracking-wide uppercase">{t('IS_BMLT')}</h2>

    {#if error}
      <ErrorState message={error} onretry={check} />
    {:else if verdict === 'checking'}
      <div class="text-bmlt flex items-center gap-3 py-4">
        <Spinner size={22} label={t('LOCATING')} />
        <span class="text-text-muted text-sm">{t('LOCATING')}</span>
      </div>
    {:else if verdict === 'covered'}
      <p class="text-success flex items-center gap-2 text-2xl font-bold">
        {t('YES')}
        <Smile size={26} aria-hidden="true" />
      </p>
      <p class="text-text mt-3 text-sm">{t('IS_BMLT_YES_1')} {distance}</p>
      {#if serviceBody}
        <p class="text-text mt-2 text-sm">{t('IS_BMLT_YES_2')} (<i>{serviceBody}</i>) {t('IS_BMLT_YES_3')}</p>
      {/if}
    {:else}
      <p class="text-text text-2xl font-bold">{t('NO')}</p>
      <p class="text-text mt-3 text-sm">{t('IS_BMLT_NO_1')} {distance}</p>
      <p class="text-text mt-2 text-sm">{t('IS_BMLT_NO_2')}</p>
    {/if}
  </section>

  <section class="border-border bg-surface-raised rounded-xl border p-4">
    <h2 class="text-text-muted mb-3 text-xs font-bold tracking-wide uppercase">{t('FIND_OUT_MORE')}</h2>
    <div class="space-y-2">
      <button
        type="button"
        class="focusable text-bmlt hover:bg-surface-sunken flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-semibold"
        onclick={() => openExternal('https://www.facebook.com/groups/149214049107349/')}
      >
        <Users size={20} aria-hidden="true" />
        {t('JOIN_FB_GROUP')}
      </button>
      <button
        type="button"
        class="focusable text-bmlt hover:bg-surface-sunken flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-semibold"
        onclick={() => openExternal('https://bmlt.app/')}
      >
        <Globe size={20} aria-hidden="true" />
        {t('VISIT_WEBSITE')}
      </button>
    </div>
  </section>
</div>
