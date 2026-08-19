export const STORAGE_KEY = 'guardcorreias_v1_data';
export const TOKEN_KEY = 'guardcorreias_token';
export const DEVICE_ID_KEY = 'guardcorreias_device_id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
