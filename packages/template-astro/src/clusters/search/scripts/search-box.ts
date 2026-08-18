/**
 * Search box — the input + submit/clear/tag-trigger wiring. Light (~3 KB),
 * lazy-loaded by `search-bootstrap.ts`.
 *
 * Ported verbatim from SearchBox.astro's inline <script>, which was never
 * type-checked; @ts-nocheck preserves that behavior.
 */
// @ts-nocheck

export interface SearchBoxConfig {
  instanceId: string;
  initialTitle: string;
  searchOnEnter: boolean;
  searchBtnAsButton: boolean;
  showTagTrigger: boolean;
}

const __sbInitCache = new WeakSet<Element>();

export function initSearchBox(config: SearchBoxConfig) {
  const { instanceId, initialTitle, searchOnEnter, searchBtnAsButton, showTagTrigger } = config;

  // Re-query DOM on each init (handles view-transition swaps)
  const root = document.querySelector(`[data-searchbox-id="${instanceId}"]`);
  if (!root || __sbInitCache.has(root)) return;
  __sbInitCache.add(root);

  const input = root.querySelector('#search-input');
  const searchBtn = root.querySelector('#search-btn');
  const clearBtn = root.querySelector('#clear-btn');
  const tagTrigger = root.querySelector('#tag-trigger');

  let selectedTagsCount = 0;

  const submitEventName = 'searchbox:submit';
  const toggleTagCloudEventName = 'searchbox:toggle-tag-cloud';

  function emit(name, detail) {
    (root || document).dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail,
    }));
  }

  function updateState() {
    if (!input || !searchBtn || !clearBtn) return;
    const hasContent = input.value.trim().length > 0;
    const isActive = hasContent || selectedTagsCount > 0;
    searchBtn.classList.toggle('active', isActive);
    if ('disabled' in searchBtn) {
      searchBtn.disabled = !isActive;
    }
    clearBtn.classList.toggle('active', isActive);
    clearBtn.style.display = isActive ? 'flex' : 'none';
  }

  function submitSearch(source) {
    const hasContent = input ? input.value.trim().length > 0 : false;
    const isActive = hasContent || selectedTagsCount > 0;
    if (!isActive) return;
    emit(submitEventName, {
      query: input ? input.value.trim() : '',
      source,
    });
  }

  if (input) {
    input.value = initialTitle || input.value || '';
    updateState();

    input.addEventListener('input', updateState);
    if (searchOnEnter) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const hasContent = input.value.trim().length > 0;
          const isActive = hasContent || selectedTagsCount > 0;
          if (!isActive) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          submitSearch('enter');
        }
      });
    }
  }

  if (searchBtnAsButton && searchBtn) {
    searchBtn.addEventListener('click', () => submitSearch('button'));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) {
        input.value = '';
      }
      updateState();
      emit('searchbox:clear', {});
      input?.focus();
    });
  }

  if (showTagTrigger && tagTrigger) {
    tagTrigger.addEventListener('click', () => {
      emit(toggleTagCloudEventName, {});
    });
  }

  root.addEventListener('searchbox:selection-change', (event) => {
    const detail = event.detail || {};
    selectedTagsCount = Number(detail.selectedTagsCount || 0);
    updateState();
  });
}
