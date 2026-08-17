<script lang="ts">
  import { MapPin, Monitor } from '@lucide/svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { MEETING_MODES, MODE_LABEL_KEYS, type MeetingMode } from '$lib/meetings/venue';

  interface Props {
    /** Currently selected modes. Both selected means "no filter". */
    modes: MeetingMode[];
    onchange: (modes: MeetingMode[]) => void;
    class?: string;
  }

  let { modes, onchange, class: className = '' }: Props = $props();

  const ICONS = { 'in-person': MapPin, online: Monitor } as const;

  /**
   * Toggling the only selected mode off would leave nothing selected, which
   * `venueTypesParam` reads as "no filter" and answers with everything. Turning
   * a filter off and getting *more* results is a jarring thing to watch, so the
   * last one on instead flips to selecting both — the same result set, arrived
   * at in a way the buttons can explain.
   */
  function toggle(mode: MeetingMode) {
    const next = modes.includes(mode) ? modes.filter((m) => m !== mode) : [...modes, mode];
    onchange(next.length === 0 ? [...MEETING_MODES] : next);
  }
</script>

<div class="flex items-center gap-2 {className}" role="group" aria-label={t('FILTERS')}>
  {#each MEETING_MODES as mode (mode)}
    {@const active = modes.includes(mode)}
    {@const Icon = ICONS[mode]}
    <button
      type="button"
      aria-pressed={active}
      class="focusable flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors {active
        ? 'border-bmlt bg-bmlt text-white'
        : 'border-border bg-surface-raised text-text-muted'}"
      onclick={() => toggle(mode)}
    >
      <Icon size={15} aria-hidden="true" />
      {t(MODE_LABEL_KEYS[mode])}
    </button>
  {/each}
</div>
