import { toast } from 'sonner';

/**
 * Structured API error response
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Handle API errors and show appropriate toast
 */
export function handleApiError(error: unknown, context?: string): void {
  const apiError = parseApiError(error);

  const title = context || 'Error';
  const description = apiError.message;

  switch (apiError.code) {
    case 'VALIDATION_ERROR':
      toast.error(title, { description });
      break;
    case 'UNAUTHORIZED':
      toast.error('Session expired', {
        description: 'Please log in again',
      });
      break;
    case 'FORBIDDEN':
      toast.error('Access denied', { description });
      break;
    case 'NOT_FOUND':
      toast.error('Not found', { description });
      break;
    default:
      toast.error(title, { description });
  }
}

/**
 * Parse error response from API
 */
export function parseApiError(error: unknown): ApiErrorResponse {
  if (error instanceof Error) {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(error.message) as {
        error?: ApiErrorResponse;
      };
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // Not JSON
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error
  ) {
    const apiError = (error as { error: ApiErrorResponse }).error;
    return apiError;
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * Show success toast
 */
export function showSuccess(message: string, description?: string): void {
  toast.success(message, { description });
}

/**
 * Show error toast
 */
export function showError(message: string, description?: string): void {
  toast.error(message, { description });
}

/**
 * Show warning toast
 */
export function showWarning(message: string, description?: string): void {
  toast.warning(message, { description });
}

/**
 * Show info toast
 */
export function showInfo(message: string, description?: string): void {
  toast.info(message, { description });
}
