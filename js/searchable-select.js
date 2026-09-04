// ==========================================================================
// SEARCHABLE SELECT COMPONENT (CHUẨN LISTIVO-SELECT-V2 MOITHUE.COM 100%)
// ==========================================================================

class SearchableSelect {
  constructor(options) {
    this.container = typeof options.container === 'string' 
      ? document.getElementById(options.container) 
      : options.container;
    
    if (!this.container) {
      console.error('SearchableSelect: container not found', options.container);
      return;
    }

    this.placeholder = options.placeholder || 'Chọn...';
    this.iconHtml = options.iconHtml || '';
    this.items = options.items || [];
    this.value = options.value || 'all';
    this.onChange = options.onChange || (() => {});
    this.isOpen = false;
    this.searchKeyword = '';

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    const selectedItem = this.items.find(i => i.id === this.value);
    const hasValue = this.value && this.value !== 'all';
    const displayText = hasValue ? (selectedItem ? selectedItem.name : this.value) : this.placeholder;

    this.container.innerHTML = `
      <div tabindex="0" class="listivo-select-v2 listivo-select-v2--with-icon ${hasValue ? 'listivo-select-v2--active' : ''}">
        <div class="listivo-select-v2__icon listivo-icon-v2">
          ${this.iconHtml}
        </div>
        <div class="listivo-select-v2__placeholder ${!hasValue ? 'is-placeholder' : ''}">
          ${displayText}
        </div>
        <div class="listivo-select-v2__clear" title="Xóa chọn" style="display: ${hasValue ? 'flex' : 'none'};">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M7.70711 6.29289C8.09763 6.68342 8.09763 7.31658 7.70711 7.70711C7.31658 8.09763 6.68342 8.09763 6.29289 7.70711L4 5.41421L1.70711 7.70711C1.31658 8.09763 0.683417 8.09763 0.292893 7.70711C-0.0976311 7.31658 -0.0976311 6.68342 0.292893 6.29289L2.58579 4L0.292893 1.70711C-0.0976311 1.31658 -0.0976311 0.683417 0.292893 0.292893C0.683417 -0.0976311 1.31658 -0.0976311 1.70711 0.292893L4 2.58579L6.29289 0.292893C6.68342 -0.0976311 7.31658 -0.0976311 7.70711 0.292893C8.09763 0.683417 8.09763 1.31658 7.70711 1.70711L5.41421 4L7.70711 6.29289Z" fill="#2A3946"></path></svg>
        </div>
        <div class="listivo-select-v2__arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="7" height="5" viewBox="0 0 7 5" fill="none"><path d="M3.5 2.56768L5.87477 0.192917C6.13207 -0.0643854 6.54972 -0.0643854 6.80702 0.192917C7.06433 0.45022 7.06433 0.86787 6.80702 1.12517L3.9394 3.99279C3.6964 4.2358 3.30298 4.2358 3.0606 3.99279L0.192977 1.12517C-0.0643257 0.86787 -0.0643257 0.45022 0.192977 0.192917C0.45028 -0.0643854 0.86793 -0.0643854 1.12523 0.192917L3.5 2.56768Z" fill="#2A3946"></path></svg>
        </div>

        <div class="listivo-select-v2__dropdown listivo-select-v2__dropdown--auto-width" style="z-index: 9999999 !important; position: absolute !important;">
          <div class="listivo-select-v2__searchable">
            <div class="listivo-searchable-input-wrapper">
              <i class="fas fa-search"></i>
              <input type="text" class="listivo-select-v2__input" placeholder="Tìm kiếm...">
            </div>
          </div>
          <div class="listivo-select-v2__options">
            ${this.renderOptions()}
          </div>
        </div>
      </div>
    `;

    this.rootEl = this.container.querySelector('.listivo-select-v2');
    this.dropdownEl = this.container.querySelector('.listivo-select-v2__dropdown');
    this.inputEl = this.container.querySelector('.listivo-select-v2__input');
    this.optionsContainer = this.container.querySelector('.listivo-select-v2__options');
    this.clearBtn = this.container.querySelector('.listivo-select-v2__clear');
    this.placeholderEl = this.container.querySelector('.listivo-select-v2__placeholder');
  }

  renderOptions() {
    const kw = this.searchKeyword.trim().toLowerCase();
    const filtered = this.items.filter(item => {
      if (!kw) return true;
      return (item.name || '').toLowerCase().includes(kw);
    });

    if (filtered.length === 0) {
      return `<div class="listivo-select-v2__no-options"><i class="fas fa-info-circle"></i> Không tìm thấy kết quả</div>`;
    }

    return filtered.map(item => {
      const isSelected = item.id === this.value;
      const countBadge = item.count !== undefined ? `<span class="listivo-select-v2__count">(${item.count})</span>` : '';
      return `
        <div class="listivo-select-v2__option ${isSelected ? 'is-selected' : ''}" data-id="${item.id}">
          <span>${item.name}</span>
          ${countBadge}
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    // Toggle dropdown
    this.rootEl.addEventListener('click', (e) => {
      if (e.target.closest('.listivo-select-v2__clear')) return;
      if (e.target.closest('.listivo-select-v2__dropdown')) return;
      this.toggle();
    });

    // Clear value
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setValue('all', true);
        this.close();
      });
    }

    // Search input typing
    this.inputEl.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      this.optionsContainer.innerHTML = this.renderOptions();
    });

    // Prevent closing dropdown when clicking inside search input
    this.inputEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Option selection
    this.optionsContainer.addEventListener('click', (e) => {
      const optionEl = e.target.closest('.listivo-select-v2__option');
      if (optionEl) {
        const id = optionEl.getAttribute('data-id');
        this.setValue(id, true);
        this.close();
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.rootEl.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard ESC to close
    document.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    // Close other selects on page first
    document.querySelectorAll('.listivo-select-v2--open').forEach(el => {
      if (el !== this.rootEl) el.classList.remove('listivo-select-v2--open');
    });

    this.isOpen = true;
    this.rootEl.classList.add('listivo-select-v2--open');
    this.searchKeyword = '';
    this.inputEl.value = '';
    this.optionsContainer.innerHTML = this.renderOptions();
    setTimeout(() => this.inputEl.focus(), 60);
  }

  close() {
    this.isOpen = false;
    this.rootEl.classList.remove('listivo-select-v2--open');
  }

  setValue(newVal, triggerChange = true) {
    this.value = newVal;
    const selectedItem = this.items.find(i => i.id === this.value);
    const hasValue = this.value && this.value !== 'all';
    
    if (hasValue) {
      this.rootEl.classList.add('listivo-select-v2--active');
      this.placeholderEl.classList.remove('is-placeholder');
      this.placeholderEl.innerText = selectedItem ? selectedItem.name : this.value;
      if (this.clearBtn) this.clearBtn.style.display = 'flex';
    } else {
      this.rootEl.classList.remove('listivo-select-v2--active');
      this.placeholderEl.classList.add('is-placeholder');
      this.placeholderEl.innerText = this.placeholder;
      if (this.clearBtn) this.clearBtn.style.display = 'none';
    }

    this.optionsContainer.innerHTML = this.renderOptions();

    if (triggerChange) {
      this.onChange(this.value, selectedItem);
    }
  }

  getValue() {
    return this.value;
  }

  setItems(newItems) {
    this.items = newItems;
    this.optionsContainer.innerHTML = this.renderOptions();
  }
}
