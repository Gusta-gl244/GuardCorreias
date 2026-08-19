/**
 * GuardCorreias API Client — cliente REST usado pelas telas administrativas
 * (cadastros, backups). O fluxo do dia a dia (técnico/supervisor) passa pelo
 * motor de sincronização em src/sync/engine.ts, não por este cliente.
 */
import { TOKEN_KEY } from '@/app/data/constants';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const authAPI = {
  async login(email, password) {
    return fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
};

export const usersAPI = {
  async getAll() { return fetchAPI('/users'); },
  async getById(id) { return fetchAPI(`/users/${id}`); },
  async create(userData) { return fetchAPI('/users', { method: 'POST', body: JSON.stringify(userData) }); },
  async update(id, userData) { return fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }); },
  async delete(id) { return fetchAPI(`/users/${id}`, { method: 'DELETE' }); },
};

export const beltsAPI = {
  async getAll() { return fetchAPI('/belts'); },
  async getById(id) { return fetchAPI(`/belts/${id}`); },
  async create(beltData) { return fetchAPI('/belts', { method: 'POST', body: JSON.stringify(beltData) }); },
  async update(id, beltData) { return fetchAPI(`/belts/${id}`, { method: 'PUT', body: JSON.stringify(beltData) }); },
  async delete(id) { return fetchAPI(`/belts/${id}`, { method: 'DELETE' }); },
};

export const stationsAPI = {
  async getAll(beltId) { return fetchAPI(beltId ? `/stations?beltId=${beltId}` : '/stations'); },
  async getById(id) { return fetchAPI(`/stations/${id}`); },
  async create(stationData) { return fetchAPI('/stations', { method: 'POST', body: JSON.stringify(stationData) }); },
  async update(id, stationData) { return fetchAPI(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(stationData) }); },
  async delete(id) { return fetchAPI(`/stations/${id}`, { method: 'DELETE' }); },
};

export const checklistTemplatesAPI = {
  async getAll() { return fetchAPI('/checklist-templates'); },
  async getById(id) { return fetchAPI(`/checklist-templates/${id}`); },
  async create(data) { return fetchAPI('/checklist-templates', { method: 'POST', body: JSON.stringify(data) }); },
  async update(id, data) { return fetchAPI(`/checklist-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async delete(id) { return fetchAPI(`/checklist-templates/${id}`, { method: 'DELETE' }); },
};

export const inspectionOrdersAPI = {
  async getAll() { return fetchAPI('/inspection-orders'); },
  async getById(id) { return fetchAPI(`/inspection-orders/${id}`); },
  async create(orderData) { return fetchAPI('/inspection-orders', { method: 'POST', body: JSON.stringify(orderData) }); },
  async update(id, orderData) { return fetchAPI(`/inspection-orders/${id}`, { method: 'PUT', body: JSON.stringify(orderData) }); },
  async delete(id) { return fetchAPI(`/inspection-orders/${id}`, { method: 'DELETE' }); },
};

export const inspectionsAPI = {
  async getAll() { return fetchAPI('/inspections'); },
  async getById(id) { return fetchAPI(`/inspections/${id}`); },
  async create(inspectionData) { return fetchAPI('/inspections', { method: 'POST', body: JSON.stringify(inspectionData) }); },
  async update(id, inspectionData) { return fetchAPI(`/inspections/${id}`, { method: 'PUT', body: JSON.stringify(inspectionData) }); },
  async getMedia(id) { return fetchAPI(`/inspections/${id}/media`); },
  // Download exige o cabeçalho Authorization (JWT), que um <a href> puro não
  // consegue enviar — busca como blob e devolve pronto para salvar.
  async exportZip(id) {
    const res = await fetch(`${API_URL}/inspections/${id}/export`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Falha ao exportar inspeção');
    return res.blob();
  },
};

export const mediaAPI = {
  async getById(id) { return fetchAPI(`/media/${id}`); },
  async create(mediaData) { return fetchAPI('/media', { method: 'POST', body: JSON.stringify(mediaData) }); },
  async delete(id) { return fetchAPI(`/media/${id}`, { method: 'DELETE' }); },
};

export const backupsAPI = {
  async run() { return fetchAPI('/backups/run', { method: 'POST' }); },
  async list() { return fetchAPI('/backups'); },
  async download(id) {
    const res = await fetch(`${API_URL}/backups/${id}/download`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Falha ao baixar backup');
    return res.blob();
  },
  async remove(id) { return fetchAPI(`/backups/${id}`, { method: 'DELETE' }); },
  async getSchedule() { return fetchAPI('/backups/schedule/config'); },
  async setSchedule(config) { return fetchAPI('/backups/schedule/config', { method: 'PUT', body: JSON.stringify(config) }); },
};

export const diagnosticsAPI = {
  async get() { return fetchAPI('/diagnostics'); },
};

export const severitiesAPI = {
  async getAll() { return fetchAPI('/severities'); },
};

export const syncAPI = {
  async checkConnection() {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};

export default {
  authAPI,
  usersAPI,
  beltsAPI,
  stationsAPI,
  checklistTemplatesAPI,
  inspectionOrdersAPI,
  inspectionsAPI,
  mediaAPI,
  backupsAPI,
  diagnosticsAPI,
  severitiesAPI,
  syncAPI,
};
