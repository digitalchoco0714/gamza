/**
 * [화면 2] 상품 상세, 작성자 글 관리(상태변경/수정/삭제) 및 동네 채팅 모달 제어 모듈 (window.GamzaDetail)
 */
(function () {
  let currentProductId = null;
  let isInitialized = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getModalElement() {
    return document.getElementById('detail-modal');
  }

  function findProductById(productId) {
    if (!window.GamzaStore || !Array.isArray(window.GamzaStore.products)) {
      return null;
    }
    return (
      window.GamzaStore.products.find(
        (item) => String(item.id) === String(productId)
      ) || null
    );
  }

  function buildSellerMarkup(seller) {
    const safeSeller = seller || {};
    const nickname = escapeHtml(safeSeller.nickname || '햇감자이웃');
    const region = escapeHtml(safeSeller.region || '우리 동네');
    const temp = escapeHtml(safeSeller.temp ?? 37.5);
    const avatar = escapeHtml(
      safeSeller.avatar ||
        'https://api.dicebear.com/7.x/thumbs/svg?seed=GamzaSeller&backgroundColor=f3e8dc'
    );

    return `
      <div class="detail-seller-box">
        <div class="detail-seller-profile">
          <img class="detail-seller-avatar" src="${avatar}" alt="${nickname} 프로필" />
          <div class="detail-seller-info">
            <span class="detail-seller-nickname">${nickname}</span>
            <span class="detail-seller-region">${region}</span>
          </div>
        </div>
        <span class="detail-seller-badge">🥔 포슬온도 ${temp}°C</span>
      </div>
    `;
  }

  function buildOwnerControlsMarkup(product) {
    if (!window.GamzaStore?.isMyProduct?.(product)) return '';
    const currentStatus = window.GamzaStore.getStatusLabel(product.status);
    const statuses = ['판매중', '예약중', '거래완료'];

    const statusButtonsHtml = statuses
      .map((status) => {
        const isActive = currentStatus === status ? 'active' : '';
        const statusClass = window.GamzaStore.getStatusClass(status);
        return `
          <button
            type="button"
            class="owner-status-btn ${statusClass} ${isActive}"
            data-detail-action="change-status"
            data-status="${status}"
            aria-pressed="${currentStatus === status}"
          >${status}</button>
        `;
      })
      .join('');

    return `
      <div class="detail-owner-panel" aria-label="내 게시글 관리">
        <div class="owner-status-group">
          <span class="owner-panel-label">판매 상태 변경</span>
          <div class="owner-status-buttons">${statusButtonsHtml}</div>
        </div>
        <div class="owner-manage-actions">
          <button type="button" class="btn btn-secondary owner-action-btn" data-detail-action="edit">✏️ 수정</button>
          <button type="button" class="btn btn-secondary owner-action-btn owner-delete-btn" data-detail-action="delete">🗑️ 삭제</button>
        </div>
      </div>
    `;
  }

  function buildContentBodyMarkup(product) {
    const statusClass = window.GamzaStore.getStatusClass(product.status);
    const statusLabel = escapeHtml(window.GamzaStore.getStatusLabel(product.status));
    const category = escapeHtml(product.category || '기타');
    const title = escapeHtml(product.title);
    const location = escapeHtml(product.location || '지역 정보 없음');
    const uploadTime = escapeHtml(product.uploadTime || '방금 전');
    const formattedPrice = escapeHtml(window.GamzaStore.formatPrice(product.price));
    const description = escapeHtml(product.description || '상세 설명이 없습니다.');

    return `
      <div class="detail-content-body">
        <div class="detail-status-row">
          <span id="detail-status-badge" class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <span class="detail-category">${category}</span>
        <h2 class="detail-title" id="detail-modal-title">${title}</h2>
        <div class="detail-location">📍 ${location}</div>
        <div class="detail-time">🕒 ${uploadTime}</div>
        <div class="detail-price">${formattedPrice}</div>
        <p class="detail-description">${description}</p>
      </div>
    `;
  }

  function buildChatSectionMarkup(product) {
    const sellerName = escapeHtml(product?.seller?.nickname || '판매자');
    return `
      <section id="detail-chat-section" class="detail-chat-section hidden" aria-label="동네 이웃 채팅">
        <div class="detail-chat-header">
          <span>💬 '${sellerName}'님과의 동네 채팅</span>
          <span id="chat-my-nickname" class="chat-sender"></span>
        </div>
        <div id="detail-chat-messages" class="detail-chat-messages">
          <p class="chat-empty-msg">대화 내역을 불러오는 중...</p>
        </div>
        <form id="detail-chat-form" class="detail-chat-form">
          <input
            type="text"
            id="detail-chat-input"
            class="detail-chat-input"
            maxlength="300"
            placeholder="메시지를 입력해 보세요 (예: 직거래 가능할까요?)"
            autocomplete="off"
            required
          />
          <button type="submit" class="btn btn-primary">전송</button>
        </form>
      </section>
    `;
  }

  function buildModalMarkup(product) {
    const isWished = window.GamzaStore?.isWished?.(product.id) ?? false;
    const heartIcon = isWished ? '❤️' : '🤍';
    const wishClass = isWished ? 'is-wished' : '';
    const wishLabel = isWished ? '관심 상품 등록됨' : '관심 추가';
    const imageUrl = escapeHtml(product.image);
    const title = escapeHtml(product.title);

    return `
      <div class="detail-modal-card" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
        <button type="button" class="detail-close-btn" data-detail-action="close" aria-label="상세창 닫기">✕</button>
        <div class="detail-scroll-area" id="detail-scroll-area">
          <div class="detail-image-section">
            <img class="detail-product-image" src="${imageUrl}" alt="${title}" />
          </div>
          ${buildSellerMarkup(product.seller)}
          ${buildOwnerControlsMarkup(product)}
          ${buildContentBodyMarkup(product)}
          ${buildChatSectionMarkup(product)}
          <div id="detail-feedback-box" class="detail-feedback-toast hidden" role="status"></div>
        </div>
        <div class="detail-footer-actions">
          <button type="button" class="btn btn-secondary detail-wish-btn ${wishClass}" data-detail-action="wish">
            <span class="wish-icon">${heartIcon}</span>
            <span class="wish-text">${wishLabel}</span>
          </button>
          <button type="button" class="btn btn-primary detail-chat-btn" data-detail-action="chat">
            💬 채팅 시작하기
          </button>
        </div>
      </div>
    `;
  }

  function showFeedback(message) {
    const box = document.getElementById('detail-feedback-box');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function updateModalStatusUI(newStatus) {
    const cleanStatus = window.GamzaStore.getStatusLabel(newStatus);
    const statusClass = window.GamzaStore.getStatusClass(cleanStatus);
    const badgeEl = document.getElementById('detail-status-badge');
    if (badgeEl) {
      badgeEl.className = `status-badge ${statusClass}`;
      badgeEl.textContent = cleanStatus;
    }

    const statusBtns = document.querySelectorAll('.owner-status-btn');
    statusBtns.forEach((btn) => {
      const isSelected = btn.getAttribute('data-status') === cleanStatus;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
  }

  async function handleStatusChange(buttonEl) {
    if (currentProductId === null) return;
    const newStatus = buttonEl.getAttribute('data-status');
    if (!newStatus) return;

    buttonEl.disabled = true;
    try {
      const updated = await window.GamzaStore.updateProductStatus(currentProductId, newStatus);
      updateModalStatusUI(updated.status);
      if (window.GamzaList?.renderProducts) window.GamzaList.renderProducts();
      showFeedback(`판매 상태가 '${updated.status}'(으)로 변경되었습니다.`);
    } catch (error) {
      console.error(error);
      showFeedback('상태 변경 중 오류가 발생했습니다.');
    } finally {
      buttonEl.disabled = false;
    }
  }

  function handleEditProduct() {
    const product = findProductById(currentProductId);
    if (!product) return;
    window.GamzaDetail.close();
    if (window.GamzaWrite?.open) {
      window.GamzaWrite.open(product);
    }
  }

  async function handleDeleteProduct(buttonEl) {
    if (currentProductId === null) return;
    if (!window.confirm('이 게시글을 정말 삭제하시겠습니까?')) return;

    buttonEl.disabled = true;
    try {
      await window.GamzaStore.deleteProduct(currentProductId);
      window.GamzaDetail.close();
      if (window.GamzaList?.renderProducts) window.GamzaList.renderProducts();
      if (window.GamzaList?.showToast) window.GamzaList.showToast('게시글이 삭제되었습니다.');
    } catch (error) {
      console.error(error);
      showFeedback('게시글 삭제에 실패했습니다. 다시 시도해 주세요.');
      buttonEl.disabled = false;
    }
  }

  async function toggleWishState(buttonEl) {
    if (currentProductId === null) return;
    buttonEl.disabled = true;

    try {
      const isNowWished = await window.GamzaStore.toggleWish(currentProductId);
      buttonEl.classList.toggle('is-wished', isNowWished);
      buttonEl.querySelector('.wish-icon').textContent = isNowWished ? '❤️' : '🤍';
      buttonEl.querySelector('.wish-text').textContent = isNowWished
        ? '관심 상품 등록됨'
        : '관심 추가';
      showFeedback(
        isNowWished ? '관심 상품에 추가되었습니다.' : '관심 상품에서 해제되었습니다.'
      );
    } catch (error) {
      console.error(error);
      showFeedback('관심 상품 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      buttonEl.disabled = false;
    }
  }

  function renderChatMessages(messages) {
    const listEl = document.getElementById('detail-chat-messages');
    if (!listEl) return;

    if (!messages || messages.length === 0) {
      listEl.innerHTML = `<p class="chat-empty-msg">아직 대화가 없어요. 첫 메시지를 보내보세요!</p>`;
      return;
    }

    const myClientId = window.GamzaStore.clientId;
    listEl.innerHTML = messages
      .map((msg) => {
        const isMine = msg.sender_client_id === myClientId;
        const sideClass = isMine ? 'is-mine' : 'is-other';
        return `
          <div class="chat-item ${sideClass}">
            <span class="chat-sender">${escapeHtml(msg.sender_nickname)}</span>
            <div class="chat-bubble">${escapeHtml(msg.content)}</div>
          </div>
        `;
      })
      .join('');
    listEl.scrollTop = listEl.scrollHeight;
  }

  async function openChatPanel() {
    const chatSection = document.getElementById('detail-chat-section');
    const nickLabel = document.getElementById('chat-my-nickname');
    if (!chatSection || currentProductId === null) return;

    const myName = window.GamzaStore.user?.nickname || '햇감자이웃';
    if (nickLabel) nickLabel.textContent = `내 별명: ${myName}`;

    chatSection.classList.remove('hidden');
    chatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const messages = await window.GamzaStore.fetchMessages(currentProductId);
      renderChatMessages(messages);
      document.getElementById('detail-chat-input')?.focus();
    } catch (error) {
      console.error(error);
      showFeedback('채팅 내역을 불러오지 못했습니다.');
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const inputEl = document.getElementById('detail-chat-input');
    if (!inputEl || currentProductId === null) return;

    const content = inputEl.value.trim();
    if (!content) return;
    inputEl.disabled = true;

    try {
      await window.GamzaStore.sendMessage(currentProductId, content);
      inputEl.value = '';
      const messages = await window.GamzaStore.fetchMessages(currentProductId);
      renderChatMessages(messages);
    } catch (error) {
      console.error(error);
      showFeedback('메시지 전송에 실패했습니다.');
    } finally {
      inputEl.disabled = false;
      inputEl.focus();
    }
  }

  function handleModalClick(event) {
    const modal = getModalElement();
    if (!modal) return;

    if (event.target === modal) {
      window.GamzaDetail.close();
      return;
    }

    const actionBtn = event.target.closest('[data-detail-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-detail-action');
    if (action === 'close') window.GamzaDetail.close();
    if (action === 'wish') toggleWishState(actionBtn);
    if (action === 'chat') openChatPanel();
    if (action === 'change-status') handleStatusChange(actionBtn);
    if (action === 'edit') handleEditProduct();
    if (action === 'delete') handleDeleteProduct(actionBtn);
  }

  function handleKeyDown(event) {
    if (event.key !== 'Escape') return;
    const modal = getModalElement();
    if (modal && modal.classList.contains('active')) {
      window.GamzaDetail.close();
    }
  }

  window.GamzaDetail = {
    init() {
      if (isInitialized) return;
      const modal = getModalElement();
      if (modal) {
        modal.addEventListener('click', handleModalClick);
        modal.addEventListener('submit', (e) => {
          if (e.target.id === 'detail-chat-form') handleChatSubmit(e);
        });
      }
      document.addEventListener('keydown', handleKeyDown);
      isInitialized = true;
    },

    open(productId) {
      this.init();
      const modal = getModalElement();
      const product = findProductById(productId);
      if (!modal || !product) return;

      currentProductId = product.id;
      modal.innerHTML = buildModalMarkup(product);
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    },

    close() {
      const modal = getModalElement();
      if (!modal) return;

      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      currentProductId = null;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.GamzaDetail.init());
  } else {
    window.GamzaDetail.init();
  }
})();
