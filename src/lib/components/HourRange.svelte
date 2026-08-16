<script lang="ts">
  interface Props {
    /** Inclusive first hour, 0–23. */
    from: number;
    /** Inclusive last hour, 0–23. */
    to: number;
    fromLabel: string;
    toLabel: string;
    oncommit?: () => void;
  }

  let { from = $bindable(), to = $bindable(), fromLabel, toLabel, oncommit }: Props = $props();

  const MIN = 0;
  const MAX = 23;

  const fromPercent = $derived(((from - MIN) / (MAX - MIN)) * 100);
  const toPercent = $derived(((to - MIN) / (MAX - MIN)) * 100);

  // The knobs cannot cross. Each one pushes rather than swaps, so a reader
  // dragging the lower knob past the upper one gets a one-hour window sitting
  // where they left it, not an inverted range that silently matches nothing.
  function setFrom(value: number) {
    from = Math.min(value, to);
  }

  function setTo(value: number) {
    to = Math.max(value, from);
  }
</script>

<div class="relative h-6 w-full">
  <div class="bg-border absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full"></div>
  <div class="bg-bmlt absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style:left="{fromPercent}%" style:right="{100 - toPercent}%"></div>

  <input type="range" class="dual" min={MIN} max={MAX} step="1" value={from} aria-label={fromLabel} oninput={(event) => setFrom(Number(event.currentTarget.value))} onchange={() => oncommit?.()} />
  <input type="range" class="dual" min={MIN} max={MAX} step="1" value={to} aria-label={toLabel} oninput={(event) => setTo(Number(event.currentTarget.value))} onchange={() => oncommit?.()} />
</div>

<style>
  /* Two range inputs stacked over one painted track. The inputs themselves are
     transparent and ignore pointer events; only their thumbs accept them, so a
     tap always lands on the nearer knob rather than on whichever input happens
     to be on top. Keyboard focus still reaches both, which is what makes a
     two-handled control operable without a pointer at all. */
  .dual {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    pointer-events: none;
    -webkit-appearance: none;
    appearance: none;
  }
  .dual:focus-visible {
    outline: none;
  }

  .dual::-webkit-slider-runnable-track {
    background: transparent;
    height: 100%;
  }
  .dual::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    height: 1.5rem;
    width: 1.5rem;
    border-radius: 9999px;
    background: var(--color-bmlt);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    cursor: grab;
  }
  .dual:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-bmlt) 45%, transparent);
  }

  .dual::-moz-range-track {
    background: transparent;
    height: 100%;
  }
  .dual::-moz-range-thumb {
    pointer-events: auto;
    height: 1.5rem;
    width: 1.5rem;
    border-radius: 9999px;
    background: var(--color-bmlt);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    cursor: grab;
  }
  .dual:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-bmlt) 45%, transparent);
  }
</style>
