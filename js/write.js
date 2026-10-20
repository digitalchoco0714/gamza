const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80'
];

const MAX_DESC_LENGTH = 500;

const GamzaWrite = {
  modalEl: null,
  currentImageData: '',
  sampleIdx: 0,
  editingProductId: null,

  init() {
    this.modalEl = document.getElementById('write-modal');
    if (!this.modalEl) return;
    this.renderModal();
    this.bindEvents();
  },

  getWritableCategories() {
    const all = (window.GamzaStore && window.GamzaStore.categories) || [];
    return all.filter((cat) => cat !== '전체');
  },

  createCategoryOptionsHtml() {
    return this.getWritableCategories()
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join('');
  },

  renderModal() {
    this.modalEl.innerHTML = `
      <div class="write-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="write-modal-title">
        <header class="write-modal-header">
          <h2 id="write-modal-title" class="write-modal-title">🥔 내 물건 팔기</h2>
          <button type="button" class="write-close-btn" id="write-close-btn" aria-label="닫기">✕</button>
        </header>
        <form id="write-form" class="write-form" novalidate>
          ${this.getFormFieldsHtml()}
          <div id="write-error" class="write-error-msg hidden" role="alert"></div>
        </form>
        <footer class="write-modal-footer">
          <button type="submit" form="write-form" class="btn btn-primary write-submit-btn">작성완료</button>
        </footer>
      </div>
    `;
  },

  getFormFieldsHtml() {
    return `
      <div class="write-field">
        <label class="write-label">상품 이미지 <span class="write-required">*</span></label>
        <div class="write-image-box">
          <div class="write-image-preview" id="write-img-preview" title="클릭하여 이미지 파일 선택">
            <div class="write-image-placeholder"><span>📷</span><span>사진 등록</span></div>
          </div>
          <div class="write-image-controls">
            <div class="write-image-actions">
              <input type="file" id="write-file-input" accept="image/*" class="hidden" />
              <button type="button" id="write-file-btn" class="btn btn-secondary write-btn-sm">📁 사진 파일 업로드</button>
              <button type="button" id="write-sample-btn" class="btn btn-outline write-btn-sm">🥔 샘플 이미지 넣기</button>
            </div>
            <input type="url" id="write-image-url" class="write-input" placeholder="또는 이미지 주소(URL)를 직접 입력해 주세요" />
          </div>
        </div>
      </div>
      <div class="write-field">
        <label for="write-title" class="write-label">상품명 <span class="write-required">*</span></label>
        <input type="text" id="write-title" class="write-input" placeholder="상품명을 입력해 주세요 (예: 아이패드 에어 5세대)" required />
      </div>
      ${this.getExtraFieldsHtml()}
    `;
  },

  getExtraFieldsHtml() {
    return `
      <div class="write-field-row">
        <div class="write-field">
          <label for="write-category" class="write-label">카테고리 <span class="write-required">*</span></label>
          <select id="write-category" class="write-select" required>${this.createCategoryOptionsHtml()}</select>
        </div>
        <div class="write-field">
          <label for="write-price" class="write-label">가격 <span class="write-required">*</span></label>
          <div class="write-price-wrap">
            <input type="number" id="write-price" class="write-input" min="0" step="100" placeholder="0 (무료나눔 가능)" required />
            <span class="write-price-unit">원</span>
          </div>
        </div>
      </div>
      <div class="write-field">
        <label for="write-location" class="write-label">거래 동네 <span class="write-required">*</span></label>
        <input type="text" id="write-location" class="write-input" placeholder="예: 서울 마포구 연남동" required />
      </div>
      <div class="write-field">
        <label class="write-label">판매 상태 <span class="write-required">*</span></label>
        <div class="write-status-group">${this.getStatusChipsHtml()}</div>
      </div>
      <div class="write-field">
        <div class="write-label-row">
          <label for="write-desc" class="write-label">자세한 설명 <span class="write-required">*</span></label>
          <span id="write-desc-count" class="write-char-count">0 / ${MAX_DESC_LENGTH}자</span>
        </div>
        <textarea id="write-desc" class="write-textarea" maxlength="${MAX_DESC_LENGTH}" placeholder="구매 시기, 브랜드, 사용감, 직거래 희망 장소 등 이웃이 궁금해할 내용을 자세히 적어주세요. (최대 ${MAX_DESC_LENGTH}자)" required></textarea>
      </div>
    `;
  },

  getStatusChipsHtml() {
    const statuses = [
      { value: '판매중', label: '판매중', checked: true },
      { value: '예약중', label: '예약중', checked: false },
      { value: '거래완료', label: '거래 완료', checked: false }
    ];
    return statuses.map((s) => `
      <label class="write-status-option">
        <input type="radio" name="write-status" value="${s.value}" ${s.checked ? 'checked' : ''} />
        <span class="write-status-chip"><span class="write-status-dot"></span>${s.label}</span>
      </label>
    `).join('');
  },

  bindEvents() {
    const closeBtn = document.getElementById('write-close-btn');
    const form = document.getElementById('write-form');
    const fileInput = document.getElementById('write-file-input');
    const fileBtn = document.getElementById('write-file-btn');
    const previewBox = document.getElementById('write-img-preview');
    const sampleBtn = document.getElementById('write-sample-btn');
    const urlInput = document.getElementById('write-image-url');
    const descInput = document.getElementById('write-desc');

    closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.classList.contains('active')) this.close();
    });

    fileBtn.addEventListener('click', () => fileInput.click());
    previewBox.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    sampleBtn.addEventListener('click', () => this.applySampleImage());
    urlInput.addEventListener('input', (e) => this.updatePreview(e.target.value.trim()));
    descInput.addEventListener('input', (e) => this.handleDescInput(e));
    form.addEventListener('submit', (e) => this.handleSubmit(e));
  },

  handleDescInput(event) {
    const textarea = event.target;
    if (textarea.value.length > MAX_DESC_LENGTH) {
      textarea.value = textarea.value.slice(0, MAX_DESC_LENGTH);
    }
    this.updateDescCount(textarea.value.length);
  },

  updateDescCount(currentLength = 0) {
    const countEl = document.getElementById('write-desc-count');
    if (!countEl) return;
    countEl.textContent = `${currentLength} / ${MAX_DESC_LENGTH}자`;
    countEl.classList.toggle('is-limit', currentLength >= MAX_DESC_LENGTH);
  },

  handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      document.getElementById('write-image-url').value = '';
      this.updatePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  },

  applySampleImage() {
    const sampleUrl = SAMPLE_IMAGES[this.sampleIdx % SAMPLE_IMAGES.length];
    this.sampleIdx += 1;
    document.getElementById('write-image-url').value = sampleUrl;
    this.updatePreview(sampleUrl);
  },

  updatePreview(src) {
    this.currentImageData = src || '';
    const previewBox = document.getElementById('write-img-preview');
    if (!previewBox) return;

    if (!this.currentImageData) {
      previewBox.innerHTML = `<div class="write-image-placeholder"><span>📷</span><span>사진 등록</span></div>`;
      return;
    }
    previewBox.innerHTML = `<img src="${this.currentImageData}" alt="상품 미리보기" />`;
  },

  collectFormData() {
    const statusEl = this.modalEl.querySelector('input[name="write-status"]:checked');
    const urlValue = document.getElementById('write-image-url').value.trim();
    return {
      image: this.currentImageData || urlValue,
      title: document.getElementById('write-title').value.trim(),
      category: document.getElementById('write-category').value,
      priceRaw: document.getElementById('write-price').value.trim(),
      location: document.getElementById('write-location').value.trim(),
      status: statusEl ? statusEl.value : '판매중',
      description: document.getElementById('write-desc').value.trim()
    };
  },

  validateFormData(data) {
    if (!data.image) return '상품 이미지를 업로드하거나 이미지 URL을 입력해 주세요.';
    if (!data.title) return '상품명을 입력해 주세요.';
    if (!data.category) return '카테고리를 선택해 주세요.';
    if (data.priceRaw === '' || Number(data.priceRaw) < 0) return '올바른 가격(0원 이상)을 입력해 주세요.';
    if (!data.location) return '거래할 동네 이름을 입력해 주세요.';
    if (!data.status) return '판매 상태를 선택해 주세요.';
    if (!data.description) return '상품에 대한 자세한 설명을 입력해 주세요.';
    if (data.description.length > MAX_DESC_LENGTH) {
      return `자세한 설명은 최대 ${MAX_DESC_LENGTH}자까지 입력할 수 있습니다.`;
    }
    return '';
  },

  showError(message) {
    const errorEl = document.getElementById('write-error');
    if (!errorEl) return;
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = `⚠️ ${message}`;
    errorEl.classList.remove('hidden');
  },

  setSubmittingState(isSubmitting) {
    const submitBtn = this.modalEl.querySelector('.write-submit-btn');
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      submitBtn.textContent = this.editingProductId ? '수정 중...' : '등록 중...';
      return;
    }
    submitBtn.textContent = this.editingProductId ? '수정완료' : '작성완료';
  },

  async handleSubmit(event) {
    event.preventDefault();
    const data = this.collectFormData();
    const errorMsg = this.validateFormData(data);
    if (errorMsg) return this.showError(errorMsg);

    this.setSubmittingState(true);
    try {
      const payload = { ...data, price: Number(data.priceRaw) };
      const isEditing = Boolean(this.editingProductId);

      if (isEditing) {
        await window.GamzaStore.updateProduct(this.editingProductId, payload);
      } else {
        await window.GamzaStore.addProduct(payload);
      }

      if (window.GamzaList?.renderProducts) window.GamzaList.renderProducts();
      if (window.GamzaList?.showToast) {
        window.GamzaList.showToast(
          isEditing ? '게시글이 수정되었습니다!' : '새 감자 상품이 등록되었습니다!'
        );
      }
      this.resetForm();
      this.close();
    } catch (error) {
      console.error(error);
      this.showError(error.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      this.setSubmittingState(false);
    }
  },

  resetForm() {
    const form = document.getElementById('write-form');
    if (form) form.reset();
    this.editingProductId = null;
    this.updatePreview('');
    this.updateDescCount(0);
    this.showError('');
  },

  populateFormForEdit(product) {
    this.editingProductId = product.id;
    const isDataUrl = String(product.image || '').startsWith('data:');
    document.getElementById('write-image-url').value = isDataUrl ? '' : product.image || '';
    this.updatePreview(product.image || '');
    document.getElementById('write-title').value = product.title || '';
    document.getElementById('write-category').value = product.category || '디지털기기';
    document.getElementById('write-price').value = Number(product.price) || 0;
    document.getElementById('write-location').value = product.location || '';

    const cleanStatus = window.GamzaStore.getStatusLabel(product.status);
    const radio = this.modalEl.querySelector(`input[name="write-status"][value="${cleanStatus}"]`);
    if (radio) radio.checked = true;

    const desc = product.description || '';
    document.getElementById('write-desc').value = desc;
    this.updateDescCount(desc.length);
  },

  open(productToEdit = null) {
    if (!window.GamzaStore?.user) {
      if (window.GamzaList?.requireLoginForWrite) {
        window.GamzaList.requireLoginForWrite();
      }
      return;
    }
    if (!this.modalEl) this.init();
    if (!this.modalEl) return;

    this.resetForm();
    const titleEl = document.getElementById('write-modal-title');
    const submitBtn = this.modalEl.querySelector('.write-submit-btn');

    if (productToEdit && productToEdit.id) {
      this.populateFormForEdit(productToEdit);
      if (titleEl) titleEl.textContent = '🥔 내 게시글 수정하기';
      if (submitBtn) submitBtn.textContent = '수정완료';
    } else {
      if (titleEl) titleEl.textContent = '🥔 내 물건 팔기';
      if (submitBtn) submitBtn.textContent = '작성완료';
      const locInput = document.getElementById('write-location');
      if (locInput && !locInput.value && window.GamzaStore?.user?.region) {
        locInput.value = window.GamzaStore.user.region;
      }
    }

    this.modalEl.classList.add('active');
    this.modalEl.setAttribute('aria-hidden', 'false');
    const titleInput = document.getElementById('write-title');
    if (titleInput) setTimeout(() => titleInput.focus(), 50);
  },

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('active');
    this.modalEl.setAttribute('aria-hidden', 'true');
    this.editingProductId = null;
  }
};

window.GamzaWrite = GamzaWrite;
