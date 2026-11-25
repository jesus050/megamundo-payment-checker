/**
 * Utilidades de tiempo relativo y formateo amigable para el operador de caja
 */

export function formatRelativeTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return 'Hace un momento';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) {
    return 'Hace un momento';
  }
  if (diffInSeconds < 60) {
    return `Hace ${diffInSeconds} segundos`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return 'Hace 1 minuto';
  }
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} minutos`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) {
    return 'Hace 1 hora';
  }
  if (diffInHours < 24) {
    return `Hace ${diffInHours} horas`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'Ayer';
  }
  return `Hace ${diffInDays} días`;
}

export function formatTimeCompact(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '--:--';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
