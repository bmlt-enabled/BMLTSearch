<script lang="ts">
  interface Props {
    /** Pixel size of the square the spinner occupies. */
    size?: number;
    label?: string;
  }

  let { size = 24, label = 'Loading' }: Props = $props();
</script>

<svg class="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label={label}>
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.22" stroke-width="3" />
  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>
