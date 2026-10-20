/**
 * [화면 1] 상품 목록 및 수파베이스 Auth 로그인/회원가입 모듈 (js/list.js)
 */
(function () {
  const state = {
    selectedCategory: '전체',
    searchQuery: '',
    availableOnly: false,
    authMode: 'login',
    pendingWriteModal: false,
    toastTimer: null
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createHeaderTemplate() {
    return `
      <header class="site-header">
        <div class="header-inner">
          <div class="brand-logo" id="brand-reset-btn" role="button" tabindex="0" aria-label="감자 홈으로 초기화">
            <span class="brand-title">🥔 감자</span>
            <span class="brand-subtitle">포근한 우리 동네 중고거래</span>
          </div>
          <div class="search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              id="search-input"
              placeholder="상품명이나 동네 이름으로 검색해보세요"
              autocomplete="off"
            />
            <button type="button" id="search-clear-btn" class="search-clear-btn hidden" aria-label="검색어 지우기">✕</button>
          </div>
          <div class="header-actions">
            <button type="button" id="open-write-btn" class="btn btn-primary">+ 글쓰기</button>
            <button type="button" id="login-btn" class="btn btn-secondary">로그인</button>
            <span id="user-nickname-badge" class="user-nickname-badge hidden" aria-label="로그인한 닉네임"></span>
            <button type="button" id="logout-btn" class="btn btn-secondary hidden">로그아웃</button>
          </div>
        </div>
      </header>
    `;
  }

  function createLoginModalTemplate() {
    return `
      <div id="login-modal" class="modal-overlay" aria-hidden="true">
        <div class="login-modal-card" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
          <header class="login-modal-header">
            <h2 id="login-modal-title" class="login-modal-title">🥔 감자 시작하기</h2>
            <button type="button" id="login-close-btn" class="write-close-btn" aria-label="닫기">✕</button>
          </header>
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab-btn active" data-auth-mode="login" role="tab" aria-selected="true">로그인</button>
            <button type="button" class="auth-tab-btn" data-auth-mode="signup" role="tab" aria-selected="false">회원가입</button>
          </div>
          <form id="login-form" class="login-modal-body" novalidate>
            <p id="auth-guide-notice" class="login-notice">이메일과 비밀번호로 감자 이웃에 로그인해 보세요.</p>
            <div class="write-field">
              <label for="auth-email" class="write-label">이메일 <span class="write-required">*</span></label>
              <input type="email" id="auth-email" class="write-input" placeholder="example@gamza.kr" autocomplete="email" required />
            </div>
            <div class="write-field">
              <label for="auth-password" class="write-label">비밀번호 <span class="write-required">*</span></label>
              <input type="password" id="auth-password" class="write-input" minlength="6" placeholder="비밀번호 입력 (6자 이상)" autocomplete="current-password" required />
            </div>
            <div id="auth-nickname-field" class="write-field hidden">
              <label for="auth-nickname" class="write-label">닉네임 <span class="write-required">*</span></label>
              <input type="text" id="auth-nickname" class="write-input" maxlength="20" placeholder="예: 포근한햇감자" autocomplete="nickname" />
            </div>
            <div id="auth-error-msg" class="write-error-msg hidden" role="alert"></div>
            <button type="submit" id="auth-submit-btn" class="btn btn-primary auth-submit-btn">로그인</button>
          </form>
        </div>
      </div>
    `;
  }

  function createCategoryButtonsHtml() {
    const categories = (window.GamzaStore && window.GamzaStore.categories) || ['전체'];
    return categories
      .map((category) => {
        const activeClass = category === state.selectedCategory ? 'active' : '';
        return `
          <button
            type="button"
            class="category-btn ${activeClass}"
            data-category="${escapeHtml(category)}"
          >${escapeHtml(category)}</button>
        `;
      })
      .join('');
  }

  function createMainTemplate() {
    return `
      <main class="list-main">
        <section class="filter-section" aria-label="상품 필터">
          <div class="category-list" id="category-list">
            ${createCategoryButtonsHtml()}
          </div>
          <label
            for="available-only-checkbox"
            id="available-only-btn"
            class="available-toggle-btn"
          >
            <input
              type="checkbox"
              id="available-only-checkbox"
              class="available-checkbox"
            />
            <span>거래 가능만 보기</span>
          </label>
        </section>
        <div class="list-summary-bar">
          <span id="product-count-text">전체 상품 <strong>0</strong>개</span>
        </div>
        <section class="product-grid" id="product-grid" aria-live="polite"></section>
      </main>
      ${createLoginModalTemplate()}
      <div id="gamza-toast" class="gamza-toast" role="status" aria-live="polite"></div>
    `;
  }

  function matchesFilter(product) {
    const matchesCategory =
      state.selectedCategory === '전체' || product.category === state.selectedCategory;
    if (!matchesCategory) return false;

    const statusLabel = window.GamzaStore.getStatusLabel(product.status);
    if (state.availableOnly && statusLabel !== '판매중') return false;

    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return true;

    const title = (product.title || '').toLowerCase();
    const location = (product.location || '').toLowerCase();
    const sellerName = (product.seller?.nickname || '').toLowerCase();
    return title.includes(query) || location.includes(query) || sellerName.includes(query);
  }

  function createProductCardHtml(product) {
    const statusClass = window.GamzaStore.getStatusClass(product.status);
    const statusLabel = window.GamzaStore.getStatusLabel(product.status);
    const formattedPrice = window.GamzaStore.formatPrice(product.price);
    const isDone = statusLabel === '거래완료';
    const doneCardClass = isDone ? 'is-done' : '';
    const sellerNickname = product.seller?.nickname || '햇감자이웃';

    return `
      <article class="product-card ${doneCardClass}" data-product-id="${escapeHtml(product.id)}" data-status="${escapeHtml(statusLabel)}" tabindex="0">
        <div class="card-image-wrap">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" />
          ${isDone ? '<div class="card-done-overlay"><span>거래완료</span></div>' : ''}
        </div>
        <div class="card-body">
          <div class="card-header-row">
            <span class="card-category-tag">${escapeHtml(product.category)}</span>
            <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(product.title)}</h3>
          <div class="card-meta">
            <span class="card-location">${escapeHtml(product.location)}</span>
            <span class="card-meta-divider">·</span>
            <span class="card-time">${escapeHtml(product.uploadTime)}</span>
          </div>
          <div class="card-footer">
            <strong class="card-price">${escapeHtml(formattedPrice)}</strong>
            <span class="card-seller" title="작성자 닉네임">🥔 ${escapeHtml(sellerNickname)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function createEmptyStateHtml() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🥔</div>
        <p class="empty-title">조건에 맞는 감자 상품이 없어요</p>
        <p class="empty-desc">다른 검색어를 입력하거나 필터 조건을 초기화해 보세요.</p>
        <button type="button" id="reset-filter-btn" class="btn btn-outline">필터 전체 초기화</button>
      </div>
    `;
  }

  function updateAuthHeaderUI() {
    const user = window.GamzaStore?.user;
    const loginBtn = document.getElementById('login-btn');
    const nicknameBadge = document.getElementById('user-nickname-badge');
    const logoutBtn = document.getElementById('logout-btn');
    if (!loginBtn || !nicknameBadge || !logoutBtn) return;

    if (user && user.nickname) {
      loginBtn.classList.add('hidden');
      nicknameBadge.textContent = `🥔 ${user.nickname}`;
      nicknameBadge.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      return;
    }

    loginBtn.classList.remove('hidden');
    nicknameBadge.textContent = '';
    nicknameBadge.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }

  function updateFilterUI() {
    const categoryButtons = document.querySelectorAll('#category-list .category-btn');
    categoryButtons.forEach((btn) => {
      const isSelected = btn.dataset.category === state.selectedCategory;
      btn.classList.toggle('active', isSelected);
    });

    const availableBtn = document.getElementById('available-only-btn');
    const availableCheckbox = document.getElementById('available-only-checkbox');
    if (availableBtn) {
      availableBtn.classList.toggle('active', state.availableOnly);
    }
    if (availableCheckbox) {
      availableCheckbox.checked = state.availableOnly;
    }

    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', state.searchQuery.trim().length === 0);
    }

    updateAuthHeaderUI();
  }

  function renderProducts() {
    const gridEl = document.getElementById('product-grid');
    const countEl = document.getElementById('product-count-text');
    if (!gridEl || !window.GamzaStore) return;

    const filtered = window.GamzaStore.products.filter(matchesFilter);
    updateFilterUI();

    if (countEl) {
      const label = state.selectedCategory === '전체' ? '전체' : escapeHtml(state.selectedCategory);
      countEl.innerHTML = `${label} 상품 <strong>${filtered.length}</strong>개`;
    }

    if (window.GamzaStore.isLoading) {
      gridEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🥔</div>
          <p class="empty-title">우리 동네 감자 상품을 불러오는 중이에요...</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = createEmptyStateHtml();
      return;
    }

    gridEl.innerHTML = filtered.map(createProductCardHtml).join('');
  }

  function showToast(message) {
    const toastEl = document.getElementById('gamza-toast');
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function resetAllFilters() {
    state.selectedCategory = '전체';
    state.searchQuery = '';
    state.availableOnly = false;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderProducts();
  }

  function showAuthError(message) {
    const errorEl = document.getElementById('auth-error-msg');
    if (!errorEl) return;
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = `⚠️ ${message}`;
    errorEl.classList.remove('hidden');
  }

  function setAuthMode(mode, customNotice = '') {
    state.authMode = mode === 'signup' ? 'signup' : 'login';
    const isSignup = state.authMode === 'signup';
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    tabBtns.forEach((btn) => {
      const active = btn.dataset.authMode === state.authMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    const nickField = document.getElementById('auth-nickname-field');
    const nickInput = document.getElementById('auth-nickname');
    const submitBtn = document.getElementById('auth-submit-btn');
    const noticeEl = document.getElementById('auth-guide-notice');

    if (nickField) nickField.classList.toggle('hidden', !isSignup);
    if (nickInput) nickInput.required = isSignup;
    if (submitBtn) submitBtn.textContent = isSignup ? '회원가입 완료' : '로그인';
    if (noticeEl) {
      noticeEl.textContent =
        customNotice ||
        (isSignup
          ? '이메일, 비밀번호, 사용할 닉네임을 입력해 감자 회원이 되어보세요.'
          : '이메일과 비밀번호로 감자 이웃에 로그인해 보세요.');
    }
    showAuthError('');
  }

  function openLoginModal(defaultMode = 'login', customNotice = '') {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    setAuthMode(defaultMode, customNotice);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('auth-email')?.focus(), 50);
  }

  function closeLoginModal(clearPendingWrite = true) {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    showAuthError('');
    if (clearPendingWrite) {
      state.pendingWriteModal = false;
    }
  }

  function validateAuthInputs(email, password, nickname, isSignup) {
    if (!email) return '이메일을 입력해 주세요.';
    if (!email.includes('@')) return '올바른 이메일 형식을 입력해 주세요.';
    if (!password) return '비밀번호를 입력해 주세요.';
    if (password.length < 6) return '비밀번호는 6자 이상 입력해 주세요.';
    if (isSignup && !nickname) return '회원가입 시 닉네임은 필수 입력 항목입니다.';
    return '';
  }

  async function submitAuthForm(event) {
    event.preventDefault();
    const isSignup = state.authMode === 'signup';
    const email = document.getElementById('auth-email')?.value.trim() || '';
    const password = document.getElementById('auth-password')?.value || '';
    const nickname = document.getElementById('auth-nickname')?.value.trim() || '';

    const validationError = validateAuthInputs(email, password, nickname, isSignup);
    if (validationError) return showAuthError(validationError);

    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isSignup ? '가입 처리 중...' : '로그인 중...';
    }
    showAuthError('');

    try {
      const profile = isSignup
        ? await window.GamzaStore.signUp(email, password, nickname)
        : await window.GamzaStore.signIn(email, password);

      const shouldOpenWrite = state.pendingWriteModal;
      document.getElementById('login-form')?.reset();
      closeLoginModal(true);
      updateFilterUI();
      showToast(`반가워요, '${profile.nickname}'님!`);

      if (shouldOpenWrite && window.GamzaWrite?.open) {
        window.GamzaWrite.open();
      }
    } catch (error) {
      showAuthError(error.message || '로그인 처리에 실패했습니다.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = state.authMode === 'signup' ? '회원가입 완료' : '로그인';
      }
    }
  }

  function handleLoginEvents(container) {
    const loginBtn = container.querySelector('#login-btn');
    const logoutBtn = container.querySelector('#logout-btn');
    const loginModal = container.querySelector('#login-modal');
    const closeBtn = container.querySelector('#login-close-btn');
    const loginForm = container.querySelector('#login-form');

    loginBtn.addEventListener('click', () => {
      state.pendingWriteModal = false;
      openLoginModal('login');
    });

    logoutBtn.addEventListener('click', async () => {
      await window.GamzaStore.logout();
      updateFilterUI();
      showToast('로그아웃 되었습니다.');
    });

    closeBtn.addEventListener('click', () => closeLoginModal(true));
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLoginModal(true);
    });

    loginModal.querySelectorAll('.auth-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => setAuthMode(tabBtn.dataset.authMode));
    });

    loginForm.addEventListener('submit', submitAuthForm);
  }

  function handleSearchEvents(container) {
    const searchInput = container.querySelector('#search-input');
    const clearBtn = container.querySelector('#search-clear-btn');

    searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value;
      renderProducts();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        state.searchQuery = event.target.value;
        renderProducts();
      }
    });

    clearBtn.addEventListener('click', () => {
      state.searchQuery = '';
      searchInput.value = '';
      searchInput.focus();
      renderProducts();
    });
  }

  function handleWriteButtonClick() {
    if (!window.GamzaStore?.user) {
      state.pendingWriteModal = true;
      openLoginModal('login', '상품 글을 등록하려면 먼저 로그인해 주세요. 로그인 후 바로 글쓰기 창이 열립니다.');
      return;
    }
    if (window.GamzaWrite && typeof window.GamzaWrite.open === 'function') {
      window.GamzaWrite.open();
    }
  }

  function handleHeaderAndFilterEvents(container) {
    container.querySelector('#brand-reset-btn').addEventListener('click', resetAllFilters);
    container.querySelector('#open-write-btn').addEventListener('click', handleWriteButtonClick);

    container.querySelector('#category-list').addEventListener('click', (event) => {
      const btn = event.target.closest('.category-btn');
      if (!btn) return;
      state.selectedCategory = btn.dataset.category || '전체';
      renderProducts();
    });

    const availableCheckbox = container.querySelector('#available-only-checkbox');
    if (availableCheckbox) {
      availableCheckbox.addEventListener('change', (event) => {
        state.availableOnly = Boolean(event.target.checked);
        renderProducts();
      });
    }
  }

  function handleGridEvents(container) {
    const gridEl = container.querySelector('#product-grid');

    gridEl.addEventListener('click', (event) => {
      const resetBtn = event.target.closest('#reset-filter-btn');
      if (resetBtn) {
        resetAllFilters();
        return;
      }

      const card = event.target.closest('.product-card');
      if (!card) return;
      const productId = Number(card.dataset.productId);
      if (window.GamzaDetail && typeof window.GamzaDetail.open === 'function') {
        window.GamzaDetail.open(productId);
      }
    });
  }

  async function init() {
    const container = document.getElementById('list-screen');
    if (!container) return;

    container.innerHTML = createHeaderTemplate() + createMainTemplate();
    handleSearchEvents(container);
    handleHeaderAndFilterEvents(container);
    handleLoginEvents(container);
    handleGridEvents(container);
    renderProducts();

    try {
      await window.GamzaStore.loadInitialData();
      renderProducts();
    } catch (error) {
      console.error(error);
      renderProducts();
      showToast('데이터를 불러오지 못했습니다. 네트워크나 DB 연결을 확인해 주세요.');
    }
  }

  window.GamzaList = {
    init,
    renderProducts,
    showToast,
    openLoginModal,
    requireLoginForWrite: handleWriteButtonClick
  };
})();
