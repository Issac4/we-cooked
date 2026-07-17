import CONFIG from '@/config';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('recipe_token');
  const isAdmin = localStorage.getItem('recipe_is_admin') === 'true';
  
  const headers = {
    ...options.headers,
  } as Record<string, string>;

  // Only set application/json if not sending FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (!isAdmin || isAuthEndpoint) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('recipe_token');
    // For mutations, we throw so the caller can save a draft
    if (options.method && options.method !== 'GET') {
      throw new SessionExpiredError();
    }
    // For regular fetches, redirecting to login is fine
    window.location.href = '/login';
  }

  return response;
};

export const updateProtein = (id: number, name: string) => 
  apiFetch(`/proteins/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export const createProtein = (name: string) => 
  apiFetch(`/proteins/`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const deleteProtein = (id: number) => 
  apiFetch(`/proteins/${id}`, {
    method: 'DELETE',
  });

export const updateMealType = (id: number, name: string) => 
  apiFetch(`/meal-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export const createMealType = (name: string) => 
  apiFetch(`/meal-types/`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const deleteMealType = (id: number) => 
  apiFetch(`/meal-types/${id}`, {
    method: 'DELETE',
  });

export const updateProfile = (data: { 
  username?: string; 
  email?: string; 
  current_password: string; 
  new_password?: string; 
}) => 
  apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const formatErrorDetail = (detail: any): string => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(err => {
      const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : '';
      return field ? `${field}: ${err.msg}` : err.msg;
    }).join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return '';
};

