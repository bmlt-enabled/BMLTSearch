<script lang="ts" generics="T extends string | number">
  import { ChevronDown } from '@lucide/svelte';

  interface Option {
    value: T;
    label: string;
  }

  interface Props {
    value: T;
    options: Option[];
    label: string;
    /** Hide the visible label but keep it for screen readers. */
    hideLabel?: boolean;
    onchange?: (value: T) => void;
    class?: string;
  }

  let { value = $bindable(), options, label, hideLabel = false, onchange, class: className = '' }: Props = $props();

  const id = $props.id();

  function handle(event: Event & { currentTarget: HTMLSelectElement }) {
    // Options are keyed by their string form; map back to the original value so
    // numeric options stay numbers.
    const picked = options.find((option) => String(option.value) === event.currentTarget.value);
    if (picked === undefined) return;
    value = picked.value;
    onchange?.(picked.value);
  }
</script>

<!--
  A styled native <select> rather than a custom listbox. On a phone this opens
  the platform picker — the wheel on iOS, the sheet on Android — which is faster
  to operate one-handed than any popover, and it inherits every accessibility
  and keyboard behaviour for free.
-->
<div class={className}>
  <label for={id} class={hideLabel ? 'sr-only' : 'text-text-muted mb-1 block text-xs font-semibold tracking-wide uppercase'}>
    {label}
  </label>
  <div class="relative">
    <select {id} value={String(value)} onchange={handle} class="focusable border-border bg-surface-raised text-text w-full appearance-none rounded-lg border py-2.5 pr-10 pl-3 text-sm font-medium">
      {#each options as option (option.value)}
        <option value={String(option.value)}>{option.label}</option>
      {/each}
    </select>
    <ChevronDown size={18} class="text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true" />
  </div>
</div>
