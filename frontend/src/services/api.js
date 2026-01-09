import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me')
};

export const users = {
  getAll: () => api.get('/users'),
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.patch(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`)
};

export const bots = {
  getAll: () => api.get('/bots'),
  getOne: (id) => api.get(`/bots/${id}`),
  create: (botData) => api.post('/bots', botData),
  deploy: (id) => api.post(`/bots/${id}/deploy`),
  start: (id) => api.post(`/bots/${id}/start`),
  stop: (id) => api.post(`/bots/${id}/stop`),
  restart: (id) => api.post(`/bots/${id}/restart`),
  getLogs: (id, tail = 100) => api.get(`/bots/${id}/logs?tail=${tail}`),
  getStats: (id) => api.get(`/bots/${id}/stats`),
  delete: (id) => api.delete(`/bots/${id}`)
};

export default api;
