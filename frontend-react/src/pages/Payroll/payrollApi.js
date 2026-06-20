/**
 * Payroll module shared API utilities
 */

export const fmt = (value) =>
  `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const apiCall = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI returns validation errors as detail: [{loc, msg, type}]
    if (Array.isArray(body.detail)) {
      const msg = body.detail
        .map(e => `${e.loc?.slice(1).join(' → ')}: ${e.msg}`)
        .join(' | ');
      throw new Error(msg || `Validation error (${res.status})`);
    }
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

export const downloadBlob = async (path, filename) => {
  const token = localStorage.getItem('token');
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const STATUS_COLORS = {
  open: 'blue',
  calculating: 'orange',
  closed: 'green',
  cancelled: 'red',
  calculated: 'green',
  pending: 'orange',
  failed: 'red',
  active: 'green',
  completed: 'blue',
  draft: 'default',
};
