<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    /** Fires once the reader lets go, not on every pixel of the drag. */
    oncommit?: (value: number) => void;
    class?: string;
  }

  let { value = $bindable(), min, max, step = 1, label, oncommit, class: className = '' }: Props = $props();

  const id = $props.id();

  // Every commit is a network round trip, so it waits for the gesture to end.
  // `change` fires on pointer release and on each arrow-key press, which is
  // exactly the granularity wanted — a keyboard user gets a result per step, a
  // dragging finger gets one when they stop.
  function commit(event: Event & { currentTarget: HTMLInputElement }) {
    oncommit?.(Number(event.currentTarget.value));
  }
</script>

<div class={className}>
  <label for={id} class="sr-only">{label}</label>
  <input
    {id}
    type="range"
    {min}
    {max}
    {step}
    bind:value
    onchange={commit}
    aria-label={label}
    aria-valuetext={String(value)}
    class="accent-bmlt focusable bg-surface-sunken h-6 w-full cursor-pointer appearance-none rounded-full"
  />
</div>

<style>
  /* Track and thumb need per-engine selectors; `accent-color` alone does not
     give a large enough touch target on the thumb. */
  input[type='range']::-webkit-slider-runnable-track {
    height: 0.375rem;
    border-radius: 9999px;
    background: var(--color-border);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 1.5rem;
    width: 1.5rem;
    margin-top: -0.5625rem;
    border-radius: 9999px;
    background: var(--color-bmlt);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }
  input[type='range']::-moz-range-track {
    height: 0.375rem;
    border-radius: 9999px;
    background: var(--color-border);
  }
  input[type='range']::-moz-range-thumb {
    height: 1.5rem;
    width: 1.5rem;
    border-radius: 9999px;
    background: var(--color-bmlt);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }
</style>
