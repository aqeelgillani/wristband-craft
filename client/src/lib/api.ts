const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const msg = data?.message;
    const asText = Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : null);
    throw new Error(asText || data?.error || response.statusText || 'API request failed');
  }

  return data;
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export interface OrderTracking {
  orderId: string;
  status: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  courier?: string | null;
  estimatedDelivery?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export function getOrderTracking(orderId: string) {
  return apiFetch(`/orders/${orderId}/tracking`) as Promise<OrderTracking>;
}

export interface OrderTimelineItem {
  id: string;
  orderId: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  updatedByUserId?: string | null;
  createdAt: string;
}

export function getOrderTimeline(orderId: string) {
  return apiFetch(`/orders/${orderId}/timeline`) as Promise<OrderTimelineItem[]>;
}
