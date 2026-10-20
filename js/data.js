const CATEGORIES = [
  '전체',
  '디지털기기',
  '가구/인테리어',
  '의류',
  '생활가전',
  '도서/티켓',
  '기타'
];

const CLIENT_ID_STORAGE_KEY = 'gamza_anonymous_client_id';
const AUTH_SESSION_STORAGE_KEY = 'gamza_auth_session';

function getOrCreateClientId() {
  try {
    let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!clientId) {
      clientId =
        crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : `gamza_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
    }
    return clientId;
  } catch (_err) {
    return 'gamza_guest_session';
  }
}

function buildAvatarUrl(nickname) {
  const seed = encodeURIComponent((nickname || '햇감자이웃').trim());
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=f3e8dc`;
}

function loadSavedSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.accessToken && parsed.user ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function saveSessionToStorage(session) {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_err) {}
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return '방금 전';
  const createdMs = new Date(dateInput).getTime();
  if (Number.isNaN(createdMs)) return String(dateInput);

  const diffMin = Math.floor((Date.now() - createdMs) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

function mapRowToProduct(row) {
  const cfg = window.GAMZA_CONFIG || {};
  const nickname = row.seller_nickname || '햇감자이웃';
  return {
    id: Number(row.id),
    title: row.title,
    category: row.category,
    price: Number(row.price) || 0,
    location: row.location,
    uploadTime: formatRelativeTime(row.created_at),
    status: row.status || '판매중',
    image: row.image_url || cfg.DEFAULT_IMAGE,
    description: row.description || '',
    sellerId: row.seller_id || null,
    seller: {
      id: row.seller_id || null,
      nickname,
      avatar: row.seller_avatar || buildAvatarUrl(nickname),
      region: row.seller_region || row.location,
      temp: Number(row.seller_temp) || 37.5
    }
  };
}

function buildRestHeaders(extraHeaders = {}, tokenOverride = null) {
  const cfg = window.GAMZA_CONFIG || {};
  const bearerToken = tokenOverride || window.GamzaStore?.accessToken || cfg.SUPABASE_ANON_KEY;
  return {
    apikey: cfg.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
    ...extraHeaders
  };
}

async function requestSupabase(path, options = {}) {
  const cfg = window.GAMZA_CONFIG || {};
  const response = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: buildRestHeaders(options.headers, options.token)
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`데이터베이스 요청 실패 (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function translateAuthError(rawMessage) {
  const msg = String(rawMessage || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return '이미 가입된 이메일 주소입니다.';
  }
  if (msg.includes('password should be at least')) {
    return '비밀번호는 최소 6자 이상 입력해 주세요.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return '올바른 이메일 형식을 입력해 주세요.';
  }
  return rawMessage || '인증 처리 중 오류가 발생했습니다.';
}

async function requestAuthApi(endpoint, options = {}) {
  const cfg = window.GAMZA_CONFIG || {};
  const response = await fetch(`${cfg.SUPABASE_URL}/auth/v1/${endpoint}`, {
    ...options,
    headers: buildRestHeaders(options.headers, options.token)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errText = data.msg || data.error_description || data.message || data.error;
    throw new Error(translateAuthError(errText));
  }
  return data;
}

const initialSession = loadSavedSession();

window.GamzaStore = {
  categories: CATEGORIES,
  products: [],
  wishedIds: new Set(),
  clientId: getOrCreateClientId(),
  user: initialSession ? initialSession.user : null,
  accessToken: initialSession ? initialSession.accessToken : null,
  isLoading: false,

  formatPrice(price) {
    const num = Number(price) || 0;
    return num === 0 ? '무료나눔' : `${num.toLocaleString('ko-KR')}원`;
  },

  getStatusClass(status) {
    const normalized = (status || '').replace(/\s+/g, '');
    if (normalized === '예약중') return 'status-reserve';
    if (normalized === '거래완료') return 'status-done';
    return 'status-sale';
  },

  getStatusLabel(status) {
    const normalized = (status || '').replace(/\s+/g, '');
    if (normalized === '거래완료') return '거래완료';
    if (normalized === '예약중') return '예약중';
    return '판매중';
  },

  setAuthSession(accessToken, userProfile) {
    this.accessToken = accessToken;
    this.user = userProfile;
    saveSessionToStorage(accessToken && userProfile ? { accessToken, user: userProfile } : null);
  },

  async fetchOrCreateProfile(authUser, fallbackNickname, token) {
    const userId = authUser.id;
    const rows = await requestSupabase(
      `profiles?select=*&id=eq.${encodeURIComponent(userId)}`,
      { token }
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return {
        id: row.id,
        email: row.email || authUser.email,
        nickname: row.nickname || fallbackNickname || '햇감자이웃',
        region: row.region || '서울 마포구 연남동',
        avatar: row.avatar_url || buildAvatarUrl(row.nickname)
      };
    }
    return this.upsertProfile(authUser, fallbackNickname, token);
  },

  async upsertProfile(authUser, nickname, token) {
    const cleanNick = (nickname || authUser.user_metadata?.nickname || '햇감자이웃').trim();
    const avatarUrl = buildAvatarUrl(cleanNick);
    const payload = {
      id: authUser.id,
      email: authUser.email,
      nickname: cleanNick,
      avatar_url: avatarUrl
    };
    await requestSupabase('profiles', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(payload),
      token
    });
    return {
      id: authUser.id,
      email: authUser.email,
      nickname: cleanNick,
      region: '서울 마포구 연남동',
      avatar: avatarUrl
    };
  },

  async signUp(email, password, nickname) {
    const cleanEmail = (email || '').trim();
    const cleanNick = (nickname || '').trim();
    if (!cleanEmail || !password || !cleanNick) {
      throw new Error('이메일, 비밀번호, 닉네임을 모두 입력해 주세요.');
    }

    const data = await requestAuthApi('signup', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        password,
        data: { nickname: cleanNick }
      })
    });

    const authUser = data.user || data;
    const token = data.access_token;
    if (!token || !authUser?.id) {
      return this.signIn(cleanEmail, password, cleanNick);
    }

    const profile = await this.upsertProfile(authUser, cleanNick, token);
    this.setAuthSession(token, profile);
    return profile;
  },

  async signIn(email, password, fallbackNickname = '') {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail || !password) {
      throw new Error('이메일과 비밀번호를 입력해 주세요.');
    }

    const data = await requestAuthApi('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const token = data.access_token;
    const authUser = data.user;
    const metaNick = fallbackNickname || authUser?.user_metadata?.nickname || '햇감자이웃';
    const profile = await this.fetchOrCreateProfile(authUser, metaNick, token);
    this.setAuthSession(token, profile);
    return profile;
  },

  async logout() {
    const token = this.accessToken;
    this.setAuthSession(null, null);
    if (!token) return;
    try {
      await requestAuthApi('logout', { method: 'POST', token });
    } catch (_err) {}
  },

  async verifySavedSession() {
    if (!this.accessToken) return null;
    try {
      const authUser = await requestAuthApi('user', {
        method: 'GET',
        token: this.accessToken
      });
      const metaNick = this.user?.nickname || authUser?.user_metadata?.nickname;
      const profile = await this.fetchOrCreateProfile(authUser, metaNick, this.accessToken);
      this.setAuthSession(this.accessToken, profile);
      return profile;
    } catch (_err) {
      this.setAuthSession(null, null);
      return null;
    }
  },

  async loadInitialData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.verifySavedSession(),
        this.fetchProducts(),
        this.fetchWishes()
      ]);
    } finally {
      this.isLoading = false;
    }
  },

  async fetchProducts() {
    const rows = await requestSupabase('products?select=*&order=created_at.desc,id.desc');
    this.products = Array.isArray(rows) ? rows.map(mapRowToProduct) : [];
    return this.products;
  },

  async fetchWishes() {
    const encodedClient = encodeURIComponent(this.clientId);
    const rows = await requestSupabase(`wishes?select=product_id&client_id=eq.${encodedClient}`);
    const ids = Array.isArray(rows) ? rows.map((r) => Number(r.product_id)) : [];
    this.wishedIds = new Set(ids);
    return this.wishedIds;
  },

  async addProduct(newItem) {
    if (!this.user) {
      throw new Error('로그인이 필요한 기능입니다.');
    }
    const cfg = window.GAMZA_CONFIG || {};
    const sellerName = this.user.nickname || '햇감자이웃';
    const sellerAvatar = this.user.avatar || buildAvatarUrl(sellerName);
    const payload = {
      title: newItem.title,
      category: newItem.category,
      price: Number(newItem.price) || 0,
      location: newItem.location,
      status: newItem.status || '판매중',
      image_url: newItem.image || cfg.DEFAULT_IMAGE,
      description: newItem.description,
      seller_id: this.user.id || null,
      seller_nickname: sellerName,
      seller_avatar: sellerAvatar,
      seller_region: newItem.location,
      seller_temp: 37.5
    };

    const rows = await requestSupabase('products', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    const created = mapRowToProduct(rows[0]);
    this.products.unshift(created);
    return created;
  },

  isMyProduct(product) {
    if (!this.user || !product) return false;
    if (product.sellerId && this.user.id) {
      return String(product.sellerId) === String(this.user.id);
    }
    return Boolean(this.user.nickname && product.seller?.nickname === this.user.nickname);
  },

  async updateProductStatus(productId, newStatus) {
    const numericId = Number(productId);
    const cleanStatus = this.getStatusLabel(newStatus);
    const rows = await requestSupabase(`products?id=eq.${numericId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: cleanStatus })
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('상태 변경 대상을 찾을 수 없습니다.');
    }

    const updated = mapRowToProduct(rows[0]);
    this.products = this.products.map((item) => (item.id === numericId ? updated : item));
    return updated;
  },

  async updateProduct(productId, updatedFields) {
    const numericId = Number(productId);
    const cfg = window.GAMZA_CONFIG || {};
    const payload = {
      title: updatedFields.title,
      category: updatedFields.category,
      price: Number(updatedFields.price) || 0,
      location: updatedFields.location,
      status: this.getStatusLabel(updatedFields.status),
      image_url: updatedFields.image || cfg.DEFAULT_IMAGE,
      description: updatedFields.description,
      seller_region: updatedFields.location
    };

    const rows = await requestSupabase(`products?id=eq.${numericId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('수정할 게시글을 찾을 수 없습니다.');
    }

    const updated = mapRowToProduct(rows[0]);
    this.products = this.products.map((item) => (item.id === numericId ? updated : item));
    return updated;
  },

  async deleteProduct(productId) {
    const numericId = Number(productId);
    await requestSupabase(`products?id=eq.${numericId}`, {
      method: 'DELETE'
    });
    this.products = this.products.filter((item) => item.id !== numericId);
    this.wishedIds.delete(numericId);
  },

  isWished(productId) {
    return this.wishedIds.has(Number(productId));
  },

  async toggleWish(productId) {
    const numericId = Number(productId);
    const encodedClient = encodeURIComponent(this.clientId);

    if (this.isWished(numericId)) {
      await requestSupabase(`wishes?product_id=eq.${numericId}&client_id=eq.${encodedClient}`, {
        method: 'DELETE'
      });
      this.wishedIds.delete(numericId);
      return false;
    }

    await requestSupabase('wishes', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify({ product_id: numericId, client_id: this.clientId })
    });
    this.wishedIds.add(numericId);
    return true;
  },

  async fetchMessages(productId) {
    const numericId = Number(productId);
    const rows = await requestSupabase(
      `messages?select=*&product_id=eq.${numericId}&order=created_at.asc,id.asc`
    );
    return Array.isArray(rows) ? rows : [];
  },

  async sendMessage(productId, content) {
    const payload = {
      product_id: Number(productId),
      sender_nickname: this.user?.nickname || '햇감자이웃',
      sender_client_id: this.clientId,
      content: content.trim()
    };
    const rows = await requestSupabase('messages', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return rows && rows[0] ? rows[0] : payload;
  }
};
