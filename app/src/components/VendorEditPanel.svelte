<script lang="ts">
  import { X, Trash2 } from 'lucide-svelte';
  import { onMount } from 'svelte';

  type Vendor = {
    vendor_id: number;
    name: string;
    person_employee_id: string | null;
    description: string | null;
    frequency: string | null;
    status: string | null;
    group_name: string | null;
    latest_update: string | null;
    to_do: string | null;
    review_again: string | null;
    tags: string[] | null;
    aliases: string[] | null;
    report_matches: string[] | null;
  };
  type Employee = { id: string; full_name: string };

  let open = $state(false);
  let loading = $state(false);
  let saving = $state(false);
  let vendor = $state<Vendor | null>(null);
  let employees = $state<Employee[]>([]);
  let err = $state<string | null>(null);

  async function load(id: number) {
    loading = true;
    err = null;
    vendor = null;
    const res = await fetch(`/api/expenses-vendors?id=${id}`);
    if (res.ok) {
      const json = await res.json();
      vendor = json.vendor;
      employees = json.employees;
    } else {
      err = await res.text() || 'Failed to load vendor.';
    }
    loading = false;
  }

  function close() {
    open = false;
    vendor = null;
    err = null;
  }

  function onOpen(e: Event) {
    const detail = (e as CustomEvent).detail as { vendor_id: number };
    if (!detail?.vendor_id) return;
    open = true;
    load(detail.vendor_id);
  }

  onMount(() => {
    window.addEventListener('open-vendor-edit', onOpen);
    return () => window.removeEventListener('open-vendor-edit', onOpen);
  });

  function arrToLines(arr: string[] | null | undefined): string {
    return (arr ?? []).join('\n');
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!vendor) return;
    saving = true;
    err = null;
    const form = new FormData(e.currentTarget as HTMLFormElement);
    form.set('_action', 'update');
    form.set('vendor_id', String(vendor.vendor_id));
    form.set('ajax', '1');
    const res = await fetch('/api/expenses-vendors', { method: 'POST', body: form });
    if (res.ok) {
      close();
      // Reload the page so vendor-driven rollups/tooltips pick up the edits.
      location.reload();
    } else {
      err = await res.text() || 'Save failed.';
    }
    saving = false;
  }

  async function del() {
    if (!vendor) return;
    if (!confirm(`Delete vendor "${vendor.name}"?`)) return;
    const form = new FormData();
    form.set('_action', 'delete');
    form.set('vendor_id', String(vendor.vendor_id));
    form.set('ajax', '1');
    const res = await fetch('/api/expenses-vendors', { method: 'POST', body: form });
    if (res.ok) {
      close();
      location.reload();
    } else {
      err = await res.text() || 'Delete failed.';
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40" onkeydown={onKey} role="presentation">
    <div class="absolute inset-0 bg-black/30" onclick={close} role="presentation"></div>
    <aside
      class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Edit vendor"
    >
      <div class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-stone-900">
            {vendor ? `Edit ${vendor.name}` : 'Loading…'}
          </h2>
          <button type="button" onclick={close} class="p-1 text-stone-400 hover:text-stone-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {#if err}
          <div class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>
        {/if}

        {#if loading}
          <div class="text-sm text-stone-400">Loading…</div>
        {:else if vendor}
          <form onsubmit={save} class="space-y-4">
            <div>
              <label class="text-sm font-medium text-stone-700" for="v-name">Name</label>
              <input id="v-name" type="text" name="name" required value={vendor.name}
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-group">Group</label>
                <input id="v-group" type="text" name="group_name" value={vendor.group_name ?? ''}
                  placeholder="e.g. Software, Hosting"
                  class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-person">Person</label>
                <select id="v-person" name="person_employee_id" class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                  <option value="">— none —</option>
                  {#each employees as e}
                    <option value={e.id} selected={e.id === vendor.person_employee_id}>{e.full_name}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-freq">Frequency</label>
                <input id="v-freq" type="text" name="frequency" value={vendor.frequency ?? ''}
                  placeholder="monthly, annual, one-off"
                  class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-status">Status</label>
                <input id="v-status" type="text" name="status" value={vendor.status ?? ''}
                  placeholder="Active, Cancelled, ..."
                  class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>

            <div>
              <label class="text-sm font-medium text-stone-700" for="v-desc">Description</label>
              <textarea id="v-desc" name="description" rows="2"
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              >{vendor.description ?? ''}</textarea>
            </div>

            <div>
              <label class="text-sm font-medium text-stone-700" for="v-latest">Latest update</label>
              <textarea id="v-latest" name="latest_update" rows="2"
                placeholder="What's the current state / last change"
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              >{vendor.latest_update ?? ''}</textarea>
            </div>

            <div class="grid grid-cols-[1fr_160px] gap-3">
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-todo">To-do</label>
                <textarea id="v-todo" name="to_do" rows="2"
                  placeholder="What needs to happen next"
                  class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                >{vendor.to_do ?? ''}</textarea>
              </div>
              <div>
                <label class="text-sm font-medium text-stone-700" for="v-review">Review again</label>
                <input id="v-review" type="date" name="review_again" value={vendor.review_again ?? ''}
                  class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label class="text-sm font-medium text-stone-700" for="v-reports">Report matches <span class="text-xs text-stone-400">(one per line)</span></label>
              <textarea id="v-reports" name="report_matches" rows="3"
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
              >{arrToLines(vendor.report_matches)}</textarea>
            </div>

            <div>
              <label class="text-sm font-medium text-stone-700" for="v-aliases">Aliases <span class="text-xs text-stone-400">(one per line)</span></label>
              <textarea id="v-aliases" name="aliases" rows="2"
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
              >{arrToLines(vendor.aliases)}</textarea>
            </div>

            <div>
              <label class="text-sm font-medium text-stone-700" for="v-tags">Tags <span class="text-xs text-stone-400">(one per line)</span></label>
              <textarea id="v-tags" name="tags" rows="2"
                class="mt-1 w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
              >{arrToLines(vendor.tags)}</textarea>
            </div>

            <button type="submit" disabled={saving}
              class="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          <button
            type="button"
            onclick={del}
            class="w-full border border-rose-300 text-rose-700 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-rose-50"
          >
            <Trash2 size={14} /> Delete vendor
          </button>
        {/if}
      </div>
    </aside>
  </div>
{/if}
