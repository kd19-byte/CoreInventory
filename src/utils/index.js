import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

// Tailwind class merger
export const cn = (...inputs) => twMerge(clsx(inputs))

// Date formatting
export const formatDate = (dateStr) =>
  dateStr ? format(parseISO(dateStr), 'dd/MM/yyyy') : '—'

export const formatDateTime = (dateStr) =>
  dateStr ? format(parseISO(dateStr), 'dd/MM/yyyy HH:mm') : '—'

// Status → badge class
export const statusClass = (status) => {
  const map = {
    draft:    'badge-draft',
    waiting:  'badge-waiting',
    ready:    'badge-ready',
    done:     'badge-done',
    canceled: 'badge-canceled',
  }
  return map[status?.toLowerCase()] ?? 'badge-draft'
}

// Status label
export const statusLabel = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'

// Currency
export const formatCurrency = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount ?? 0)

// Generate reference numbers
export const generateRef = (prefix = 'REF') =>
  `${prefix}/${String(Date.now()).slice(-6)}`

// Truncate text
export const truncate = (str, n = 30) =>
  str?.length > n ? str.slice(0, n) + '…' : str
