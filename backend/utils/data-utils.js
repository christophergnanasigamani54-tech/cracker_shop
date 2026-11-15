'use strict';

function isWithinExportDates(record, filters) {
  const timestamp = Date.parse(record.createdAt);
  if (!Number.isFinite(timestamp)) return false;
  const start = filters.startDate
    ? Date.parse(filters.startDate + 'T00:00:00Z') + filters.startOffset * 60_000
    : -Infinity;
  const end = filters.endDate
    ? Date.parse(filters.endDate + 'T00:00:00Z') + 86_400_000 + filters.endOffset * 60_000
    : Infinity;
  return timestamp >= start && timestamp < end;
}

function orderCategories(categories, order) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return categories.slice().sort((a, b) =>
    (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id));
}

function calculateStockAdjustment(currentStock, mode, quantity, reason) {
  const maxStock = 10_000_000;
  const amount = Number(quantity);
  if (!Number.isSafeInteger(currentStock) || currentStock < 0 || currentStock > maxStock) throw new RangeError('Invalid current stock');
  if (!['add', 'remove', 'set'].includes(mode) || !Number.isSafeInteger(amount) || amount < 0 ||
    (mode !== 'set' && amount === 0)) throw new RangeError('Invalid stock adjustment');
  if (!['restock', 'damaged', 'correction', 'return', 'other'].includes(reason)) throw new RangeError('Invalid stock reason');

  const change = mode === 'add' ? amount : mode === 'remove' ? -amount : amount - currentStock;
  const stockAfter = currentStock + change;
  const wrongDirection = ((reason === 'restock' || reason === 'return') && change < 0) ||
    (reason === 'damaged' && change > 0);
  if (!Number.isSafeInteger(stockAfter) || stockAfter < 0 || stockAfter > maxStock || change === 0 || wrongDirection) {
    throw new RangeError('Stock adjustment is out of range');
  }
  return { change, stockAfter };
}

module.exports = { isWithinExportDates, orderCategories, calculateStockAdjustment };
