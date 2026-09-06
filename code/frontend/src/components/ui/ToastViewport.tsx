import { useToast } from '@/hooks/useToast'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const VARIANT_ICON: Record<string, IconName> = {
  success: 'checkCircle',
  error: 'xCircle',
  warning: 'alert',
  info: 'info',
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast()

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast--${toast.variant}`} key={toast.id} role="status">
          <span className="toast__icon">
            <Icon name={VARIANT_ICON[toast.variant]} size={18} />
          </span>
          <span>{toast.message}</span>
          <button
            className="toast__close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
