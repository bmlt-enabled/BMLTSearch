<script lang="ts">
  import { Cloud, MapPin, Phone, Share2 } from '@lucide/svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { addressLines, hasCoordinates, tidyDelimiter } from '$lib/meetings/address';
  import { hasDirections, kindBadgeTone, kindLabelKey } from '$lib/meetings/kind';
  import { WEEKDAY_COLORS, WEEKDAY_KEYS, weekdayOf } from '$lib/meetings/list';
  import { sharePayload } from '$lib/meetings/share';
  import { canShare, dial, openDirections, openExternal, share } from '$lib/native';
  import type { Meeting } from '$lib/types';

  interface Props {
    meeting: Meeting;
  }

  let { meeting }: Props = $props();

  let shareable = $state(false);
  $effect(() => {
    void canShare().then((value) => (shareable = value));
  });

  const weekday = $derived(weekdayOf(meeting));
  const weekdayKey = $derived(WEEKDAY_KEYS[weekday - 1]);
  const weekdayColor = $derived(WEEKDAY_COLORS[weekday - 1]);
  /**
   * Location lines are shown for every kind of meeting, not just the ones you
   * can travel to. On an online meeting these fields are often the only human
   * description it has — the hosting region, a venue name kept from before the
   * group moved online — and suppressing them because the meeting is virtual
   * leaves a card with nothing but a name. What is gated on kind is the
   * Directions button, which is the part that could actually mislead someone.
   */
  const lines = $derived(addressLines(meeting));
  const badgeKey = $derived(kindLabelKey(meeting.kind));
  /**
   * Red is reserved for the closed states. Virtual and hybrid are information,
   * not a warning, so they take the app's own palette rather than the alarm
   * colour — see kindBadgeTone().
   */
  const BADGE_CLASS = {
    warning: 'bg-danger text-white',
    virtual: 'bg-bmlt text-bmlt-ink',
    hybrid: 'bg-success text-white'
  } as const;
  const badgeClass = $derived.by(() => {
    const tone = kindBadgeTone(meeting.kind);
    return tone ? BADGE_CLASS[tone] : '';
  });

  /**
   * Comments are prose, never a link. Virtual NA groups sometimes stashed a join
   * URL here and the Ionic build rendered it as a button unconditionally, so a
   * group using the field for actual prose got a "Virtual Link" that opened
   * nothing. That root is no longer queried; the aggregator has
   * `virtual_meeting_link` for the URL.
   */
  const commentsText = $derived(meeting.comments?.trim() ?? '');

  const timeRange = $derived([meeting.startsAtLabel, meeting.endsAtLabel].filter(Boolean).join(' - '));

  async function onShare() {
    try {
      await share(sharePayload(meeting, t(weekdayKey)));
    } catch {
      // A cancelled share sheet rejects. Nothing to report.
    }
  }
</script>

<article class="border-border bg-surface-raised overflow-hidden rounded-xl border shadow-sm">
  <header class="flex flex-wrap items-center gap-2 px-3 pt-3">
    <span class="{weekdayColor} rounded-md px-2.5 py-1 text-sm font-bold text-slate-900">
      {t(weekdayKey)}&nbsp;&nbsp;{timeRange}
    </span>
    {#if badgeKey}
      <span class="{badgeClass} rounded-md px-2.5 py-1 text-xs font-bold tracking-wide uppercase">
        {t(badgeKey)}
      </span>
    {/if}
  </header>

  <div class="selectable px-3 pt-2 pb-3">
    <h3 class="text-text text-lg leading-snug font-bold">{meeting.meeting_name}</h3>

    {#if lines.length > 0}
      <address class="text-text-muted mt-1.5 text-sm not-italic">
        <!--
          Keyed by position, not by the text. Address fields repeat themselves
          more often than you would expect — a Virtual NA group with both
          `location_text` and `location_municipality` set to "Virtual" is
          ordinary — and a duplicate key is a hard render error, which took the
          whole list down.
        -->
        {#each lines as line, index (index)}
          <div>{line}</div>
        {/each}
      </address>
    {/if}

    <!-- Transit lines only ever exist on records with a physical venue, so they
         need no kind check of their own. -->
    {#if meeting.train_lines}
      <p class="text-text-muted mt-1 text-sm"><span class="font-semibold">{t('TRAIN')}:</span> {tidyDelimiter(meeting.train_lines)}</p>
    {/if}
    {#if meeting.bus_lines}
      <p class="text-text-muted mt-1 text-sm"><span class="font-semibold">{t('BUS')}:</span> {tidyDelimiter(meeting.bus_lines)}</p>
    {/if}

    {#if commentsText}
      <p class="text-text-muted mt-1.5 text-sm">{commentsText}</p>
    {/if}
    {#if meeting.virtual_meeting_additional_info}
      <p class="text-text-muted mt-1.5 text-sm">{meeting.virtual_meeting_additional_info}</p>
    {/if}
    {#if meeting.contact_phone_1}
      <p class="text-text-muted mt-1 text-sm">{tidyDelimiter(meeting.contact_phone_1)}</p>
    {/if}
    {#if meeting.contact_email_1}
      <p class="text-text-muted mt-1 text-sm">{tidyDelimiter(meeting.contact_email_1)}</p>
    {/if}

    {#if meeting.formatsLabel}
      <p class="text-text-muted mt-2.5 text-sm">
        <span class="italic">{t('FORMATS')}:</span>
        {meeting.formatsLabel}
      </p>
    {/if}

    <div class="mt-3 flex flex-col gap-2">
      {#if hasDirections(meeting.kind) && hasCoordinates(meeting)}
        <button
          type="button"
          class="focusable bg-bmlt hover:bg-bmlt-shade flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          onclick={() => openDirections(meeting.latitude!, meeting.longitude!)}
        >
          <MapPin size={18} aria-hidden="true" />
          {t('MAP')}
        </button>
      {/if}

      {#if meeting.virtual_meeting_link}
        <button
          type="button"
          class="focusable bg-bmlt hover:bg-bmlt-shade flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          onclick={() => openExternal(meeting.virtual_meeting_link!)}
        >
          <Cloud size={18} aria-hidden="true" />
          {t('VIRTUAL_LINK')}
        </button>
      {/if}

      <!--
        Shown whenever a dial-in exists. The Ionic build nested this inside a
        check for `virtual_meeting_link`, so phone-only meetings — the whole
        reason the field exists — never offered their number.
      -->
      {#if meeting.phone_meeting_number}
        <button
          type="button"
          class="focusable border-bmlt text-bmlt hover:bg-bmlt/10 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
          onclick={() => dial(meeting.phone_meeting_number!)}
        >
          <Phone size={18} aria-hidden="true" />
          {t('PHONE_MEETING')}
        </button>
      {/if}

      {#if shareable}
        <button
          type="button"
          class="focusable border-border text-text-muted hover:bg-surface-sunken flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
          onclick={onShare}
        >
          <Share2 size={18} aria-hidden="true" />
          {t('SHARE')}
        </button>
      {/if}
    </div>
  </div>
</article>
