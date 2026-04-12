<script lang="ts">
  let {
    measurableId,
    date,
    initial,
    frequency,
    valueType = 'number',
    goal = null,
    threshold = 'minimum',
  } = $props<{
    measurableId: string;
    date: string;
    initial: number | null;
    frequency: 'weekly' | 'monthly';
    valueType?: string;
    goal?: number | null;
    threshold?: string;
  }>();

  let value = $state<number | null>(initial);
  let editing = $state(false);
  let draft = $state('');
  let pending = $state(false);
  let inputEl: HTMLInputElement | null = $state(null);

  const displayed = $derived.by(() => {
    if (value == null) return '–';
    if (valueType === 'currency') return '$' + Math.round(value).toLocaleString();
    return Math.round(value * 100) / 100 + '';
  });

  const color = $derived.by(() => {
    if (value == null || goal == null) return '';
    const ok = threshold === 'minimum' ? value >= goal : value <= goal;
    return ok ? 'text-emerald-600' : 'text-rose-600';
  });

  const bgColor = $derived.by(() => {
    if (value == null || goal == null) return '';
    const ok = threshold === 'minimum' ? value >= goal : value <= goal;
    return ok ? 'bg-emerald-50' : 'bg-rose-50';
  });

  function startEdit() {
    draft = value == null ? '' : String(value);
    editing = true;
    queueMicrotask(() => inputEl?.focus());
  }

  async function save() {
    if (!editing) return;
    const raw = draft.trim();
    const next = raw === '' ? null : Number(raw.replace(/[$,]/g, ''));
    if (next !== null && Number.isNaN(next)) { editing = false; return; }
    pending = true;
    const res = await fetch('/api/scorecard', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ measurable_id: measurableId, date, value: next, frequency }),
    });
    if (res.ok) value = next;
    pending = false;
    editing = false;
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') save();
    else if (e.key === 'Escape') editing = false;
  }
</script>

<!--
  Both the button and the input use the exact same box model so that
  toggling between them never shifts the column width or row height:
  - same width (w-full)
  - same padding (px-1 py-1)
  - same font size/weight/leading (text-sm font-medium leading-5)
  - same 1px border (transparent in display mode, violet in edit mode)
-->
<div class="relative {bgColor} rounded">
  {#if editing}
    <input
      bind:this={inputEl}
      type="text"
      bind:value={draft}
      onblur={save}
      onkeydown={handleKey}
      disabled={pending}
      class="w-full text-center text-sm font-medium leading-5 px-1 py-1 bg-white border border-violet-400 rounded focus:outline-none"
    />
  {:else}
    <button
      type="button"
      onclick={startEdit}
      class="block w-full text-center text-sm font-medium leading-5 px-1 py-1 border border-transparent rounded cursor-text hover:border-stone-300 {color}"
    >
      {displayed}
    </button>
  {/if}
</div>
