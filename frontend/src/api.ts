const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {})
      },
      ...options
    });
  } catch {
    throw new Error('Нет соединения с сервером. Проверьте интернет или локальный Docker.');
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: form
    });
  } catch {
    throw new Error('Нет соединения с сервером. Файл не загружен.');
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function downloadFile(path: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  } catch {
    throw new Error('Нет соединения с сервером. Файл не скачан.');
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const filename = match ? decodeURIComponent(match[1]) : 'download';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
