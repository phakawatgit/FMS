function output(order) {
  return { id: order.id, sequence: order.sequence, documentTitle: order.documentTitle,
    title: `การสั่งซื้อสินค้าครั้งที่ ${order.sequence}`, createdAt: order.createdAt,
    status: 'บันทึกคำสั่งซื้อแล้ว', items: order.items.map(item => ({ ...item.snapshot, code: item.code, quantity: item.quantity })) };
}
const include = { items: { orderBy: { position: 'asc' } } };
module.exports = { output, include };
