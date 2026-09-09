<script lang="ts">
  let {
    id,
    status,
    endpoint,
    doneValue = 'done',
    openValue = 'open',
    inProgressValue = null,
  } = $props<{
    id: string;
    status: string;
    endpoint: string;
    doneValue?: string;
    openValue?: string;
    inProgressValue?: string | null;
  }>();

  let override = $state<string | null>(null);
  let pending = $state(false);
  const current = $derived(override ?? status);
  const inProgress = $derived(inProgressValue !== null && current === inProgressValue);

  async function toggle() {
    pending = true;
    const next = current === doneValue ? openValue : doneValue;
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    if (res.ok) override = next;
    pending = false;
  }
</script>

<button
  onclick={toggle}
  disabled={pending}
  class="w-5 h-5 rounded border-2 grid place-items-center transition shrink-0"
  class:border-stone-300={current !== doneValue && !inProgress}
  class:hover:border-stone-400={current !== doneValue && !inProgress}
  class:border-sky-400={inProgress}
  class:hover:border-sky-500={inProgress}
  class:bg-emerald-500={current === doneValue}
  class:border-emerald-500={current === doneValue}
  aria-label={current === doneValue ? 'Mark open' : 'Mark done'}
>
  {#if current === doneValue}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
      <path d="M5 12l5 5L20 7" />
    </svg>
  {:else if inProgress}
    <span class="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
  {/if}
</button>
