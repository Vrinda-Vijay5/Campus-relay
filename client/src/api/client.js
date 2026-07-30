import axios from 'axios';

export const TOKEN_KEY = 'campus_relay_token';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login/register 401s ("wrong password", none for register) are form errors,
// not an expired session — they must not trigger a global logout/redirect.
const SESSION_EXEMPT_PATHS = ['/auth/login', '/auth/register'];

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : 0;
    const url = error.config?.url || '';
    const isSessionExempt = SESSION_EXEMPT_PATHS.some((path) => url.includes(path));

    if (status === 401 && !isSessionExempt) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject({
      status,
      message:
        error.response?.data?.message ||
        'Service unavailable, try again shortly.',
      details: error.response?.data?.details,
    });
  }
);

// ---------- Public ----------

export const getHealth = () => client.get('/health').then((r) => r.data);

export const getMeta = () => client.get('/meta').then((r) => r.data);

export const listCampuses = () => client.get('/campuses').then((r) => r.data);

export const listGates = (campusId) =>
  client.get(`/campuses/${campusId}/gates`).then((r) => r.data);

export const listHostels = (campusId) =>
  client.get(`/campuses/${campusId}/hostels`).then((r) => r.data);

export const trackByCode = (code) =>
  client.get(`/orders/track/${encodeURIComponent(code)}`).then((r) => r.data);

// ---------- Auth ----------

export const register = (payload) =>
  client.post('/auth/register', payload).then((r) => r.data);

export const login = (phone, password) =>
  client.post('/auth/login', { phone, password }).then((r) => r.data);

export const getMe = () => client.get('/auth/me').then((r) => r.data);

export const updateMe = (payload) =>
  client.patch('/auth/me', payload).then((r) => r.data);

export const changePassword = (payload) =>
  client.post('/auth/change-password', payload).then((r) => r.data);

// ---------- Orders (any authenticated role) ----------

export const listOrders = (params) =>
  client.get('/orders', { params }).then((r) => r.data);

export const getOrder = (id) => client.get(`/orders/${id}`).then((r) => r.data);

export const updateOrderStatus = (id, payload) =>
  client.patch(`/orders/${id}/status`, payload).then((r) => r.data);

// ---------- Orders (student) ----------

export const createOrder = (payload) =>
  client.post('/orders', payload).then((r) => r.data);

export const cancelOrder = (id, payload) =>
  client.post(`/orders/${id}/cancel`, payload).then((r) => r.data);

// ---------- Orders (partner) ----------

export const listAvailable = () =>
  client.get('/orders/available').then((r) => r.data);

export const acceptOrder = (id) =>
  client.post(`/orders/${id}/accept`).then((r) => r.data);

// ---------- Admin ----------

export const getAdminStats = () => client.get('/admin/stats').then((r) => r.data);

export const getActiveDeliveries = () =>
  client.get('/admin/active-deliveries').then((r) => r.data);

export const listAdminUsers = (params) =>
  client.get('/admin/users', { params }).then((r) => r.data);

export const createPartner = (payload) =>
  client.post('/admin/partners', payload).then((r) => r.data);

export const listPartners = (params) =>
  client.get('/admin/partners', { params }).then((r) => r.data);

export const setUserActive = (id, isActive) =>
  client.patch(`/admin/users/${id}/active`, { isActive }).then((r) => r.data);

export const assignOrder = (orderId, partnerId) =>
  client.post(`/admin/orders/${orderId}/assign`, { partnerId }).then((r) => r.data);

export const createCampus = (payload) =>
  client.post('/admin/campuses', payload).then((r) => r.data);

export const createGate = (payload) =>
  client.post('/admin/gates', payload).then((r) => r.data);

export const createHostel = (payload) =>
  client.post('/admin/hostels', payload).then((r) => r.data);

export const createBlock = (payload) =>
  client.post('/admin/blocks', payload).then((r) => r.data);

export const setConfigActive = (type, id, isActive) =>
  client.patch(`/admin/config/${type}/${id}/active`, { isActive }).then((r) => r.data);

// Same shape as the public campus/gate/hostel lists, but include deactivated
// rows so a deactivated record can be found again and reactivated.
export const listAllCampuses = () => client.get('/admin/campuses').then((r) => r.data);

export const listAllGates = (campusId) =>
  client.get(`/admin/campuses/${campusId}/gates`).then((r) => r.data);

export const listAllHostels = (campusId) =>
  client.get(`/admin/campuses/${campusId}/hostels`).then((r) => r.data);

export default client;
