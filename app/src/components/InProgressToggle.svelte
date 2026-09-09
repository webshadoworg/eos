<script lang="ts">
  // Toggles a to-do between 'open' and 'in_progress'. Hidden for done/archived rows.
  let { id, status, endpoint = '/api/todos' } = $props<{ id: string; status: string; endpoint?: string }>();

  let override = $state<string | null>(null);
  let pending = $state(false);
  const current = $derived(override ?? status);
  const active = $derived(current === 'in_progress');
  const visible = $derived(current === 'open' || current === 'in_progress');

  async function toggle() {
    pending = true;
    const next = active ? 'open' : 'in_progress';
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    if (res.ok) override = next;
    pending = false;
  }
</script>

{#if visible}
  <button
    onclick={toggle}
    disabled={pending}
    type="button"
    class="text-[11px] font-medium px-2 py-0.5 rounded-full border transition shrink-0"
    class:bg-sky-50={active}
    class:border-sky-300={active}
    class:text-sky-700={active}
    class:hover:bg-sky-100={active}
    class:border-stone-200={!active}
    class:text-stone-400={!active}
    class:hover:text-stone-700={!active}
    class:hover:border-stone-400={!active}
    class:opacity-0={!active}
    class:group-hover:opacity-100={!active}
    title={active ? 'Back to open' : 'Mark in progress'}
    aria-label={active ? 'Mark open' : 'Mark in progress'}
  >
    {active ? '● In progress' : 'Start'}
  </button>
{/if}
