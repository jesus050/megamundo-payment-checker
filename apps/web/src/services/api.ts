const API_URL = '';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('megamundo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginApi(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Error al iniciar sesión');
  }
  return data;
}

export async function getMeApi() {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Sesión expirada');
  return await res.json();
}

export async function getPaymentsApi(params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const url = `${API_URL}/api/payments${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Error al cargar pagos');
  }
  return await res.json();
}

export async function getPaymentByIdApi(id: string) {
  const res = await fetch(`${API_URL}/api/payments/${id}`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Pago no encontrado');
  return await res.json();
}

export async function associatePaymentToSaleApi(paymentId: string, saleNumber: string) {
  const res = await fetch(`${API_URL}/api/payments/${paymentId}/associate-sale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ saleNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al asociar venta');
  return data;
}

export async function simulatePaymentApi(payload: {
  amount: number;
  reference: string;
  accountLastDigits?: string;
  status: string;
  externalEventId?: string;
  saleNumber?: string;
  simulateInvalidSignature?: boolean;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
  };

  if (payload.simulateInvalidSignature) {
    headers['x-mock-simulate-invalid-signature'] = 'true';
  }

  const res = await fetch(`${API_URL}/api/dev/simulate-payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error en simulación');
  return data;
}

export async function getHealthApi() {
  const res = await fetch(`${API_URL}/api/health`);
  return await res.json();
}

export async function getAuditLogsApi() {
  const res = await fetch(`${API_URL}/api/audit-logs`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('No autorizado para ver auditoría');
  return await res.json();
}
