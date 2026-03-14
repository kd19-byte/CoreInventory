import { OperationList } from '@/components/shared/OperationList'

const EXTRA = [
  { key: 'customer', label: 'Customer' },
]

export default function DeliveryPage() {
  return (
    <OperationList
      table="delivery_orders"
      newRoute="/delivery/new"
      detailRoute="/delivery"
      title="Delivery"
      extraColumns={EXTRA}
    />
  )
}
