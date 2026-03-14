import { OperationList } from '@/components/shared/OperationList'

const EXTRA = [
  { key: 'supplier', label: 'Supplier' },
]

export default function ReceiptsPage() {
  return (
    <OperationList
      table="receipts"
      newRoute="/receipts/new"
      detailRoute="/receipts"
      title="Receipt"
      extraColumns={EXTRA}
    />
  )
}
