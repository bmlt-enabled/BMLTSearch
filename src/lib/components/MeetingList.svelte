<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { aggregatorFormatNames } from '$lib/api/formats';
  import { i18n, t } from '$lib/i18n/index.svelte';
  import { ALL_DAYS, decorateMeetings, filterMeetings, groupByDay, isToday, WEEKDAY_KEYS } from '$lib/meetings/list';
  import { format12Hour } from '$lib/meetings/time';
  import type { RawMeeting } from '$lib/types';
  import Disclosure from './Disclosure.svelte';
  import HourRange from './HourRange.svelte';
  import MeetingCard from './MeetingCard.svelte';
  import Select from './Select.svelte';

  interface Props {
    meetings: RawMeeting[];
    /** Skip the filter bar and open every day — used inside the map's detail sheet. */
    expandAll?: boolean;
  }

  let { meetings, expandAll = false }: Props = $props();

  let selectedDay = $state<number>(ALL_DAYS);
  let fromHour = $state(0);
  let toHour = $state(23);

  /**
   * Format names arrive on a second request, so they start empty and the list
   * renders immediately without them. The formats line fills in a moment later.
   * The Ionic build held the whole list back until this resolved.
   */
  let formatNames = $state<Map<string, string>>(new Map());

  $effect(() => {
    const raw = meetings;
    const language = i18n.locale;

    let cancelled = false;
    const load = aggregatorFormatNames(raw, language);
    void load
      .then((names) => {
        if (!cancelled) formatNames = names;
      })
      .catch(() => {
        // Names are a nicety. Without them the codes are simply not shown.
      });

    return () => {
      cancelled = true;
    };
  });

  const decorated = $derived(decorateMeetings(meetings, formatNames));
  const visible = $derived(filterMeetings(decorated, { weekday: selectedDay, fromHour, toHour }));
  const groups = $derived(groupByDay(visible));

  const dayOptions = $derived([{ value: ALL_DAYS, label: t('WEEKDAYS') }, ...WEEKDAY_KEYS.map((key, index) => ({ value: index + 1, label: t(key) }))]);

  const fromLabel = $derived(format12Hour(fromHour * 60));
  const toLabel = $derived(format12Hour(toHour * 60 + 59));

  /**
   * Which day sections are open.
   *
   * `expandAll` opens everything. Otherwise today opens on its own, falling back
   * to the first day that has meetings — a reader who has just run a search
   * should land on results, not on a stack of seven closed bars, which is what
   * the Ionic build gave them.
   *
   * Derived rather than driven by an effect. An effect that seeded the open set
   * on first populated render only fired when `groups` changed *after* mount, so
   * a list handed complete data up front — the whole Virtual NA list, which is
   * only rendered once loaded — opened nothing at all. Deriving the default
   * removes the ordering question: it is a function of the groups, whenever they
   * arrive. The two override sets record what the reader has actually tapped, so
   * an explicit choice always wins over the default.
   */
  const opened = new SvelteSet<number>();
  const closed = new SvelteSet<number>();

  const defaultOpen = $derived.by(() => {
    if (expandAll) return new Set(groups.map((group) => group.weekday));
    const today = groups.find((group) => isToday(group.weekday));
    const first = today?.weekday ?? groups[0]?.weekday;
    return first === undefined ? new Set<number>() : new Set([first]);
  });

  function isOpen(weekday: number): boolean {
    if (opened.has(weekday)) return true;
    if (closed.has(weekday)) return false;
    return defaultOpen.has(weekday);
  }

  function toggle(weekday: number, open: boolean) {
    if (open) {
      opened.add(weekday);
      closed.delete(weekday);
    } else {
      closed.add(weekday);
      opened.delete(weekday);
    }
  }
</script>

{#if !expandAll}
  <div class="border-border bg-surface-raised sticky top-0 z-10 border-b px-3 py-2.5">
    <p class="text-text-muted mb-2 text-xs font-medium">
      {selectedDay === ALL_DAYS ? t('WEEKDAYS') : t(WEEKDAY_KEYS[selectedDay - 1])} · {fromLabel} – {toLabel}
    </p>
    <div class="flex items-center gap-3">
      <Select bind:value={selectedDay} options={dayOptions} label={t('FILTERS')} hideLabel class="w-40 shrink-0" />
      <div class="min-w-0 flex-1">
        <HourRange bind:from={fromHour} bind:to={toHour} fromLabel="{t('FILTERS')} — {fromLabel}" toLabel="{t('FILTERS')} — {toLabel}" />
      </div>
    </div>
  </div>
{/if}

<div class="space-y-2 p-3">
  {#each groups as group (group.weekday)}
    <Disclosure open={isOpen(group.weekday)} onopenchange={(open: boolean) => toggle(group.weekday, open)} highlight={isToday(group.weekday)}>
      {#snippet summary()}
        {t(group.labelKey)} ({group.meetings.length})
      {/snippet}
      <div class="space-y-2 p-2">
        {#each group.meetings as meeting (meeting.id_bigint)}
          <MeetingCard {meeting} />
        {/each}
      </div>
    </Disclosure>
  {:else}
    <p class="text-text-muted py-10 text-center text-sm">
      {meetings.length === 0 ? t('NOTHING_FOUND') : t('NO_RESULTS')}
    </p>
  {/each}
</div>
