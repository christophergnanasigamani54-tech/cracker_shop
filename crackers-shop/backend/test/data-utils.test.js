'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isWithinExportDates, orderCategories, calculateStockAdjustment } = require('../utils/data-utils');

test('date filters include complete local dates in India Standard Time', () => {
  const filters = {
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    startOffset: -330,
    endOffset: -330,
  };
  assert.equal(isWithinExportDates({ createdAt: '2026-11-01T18:30:00.000Z' }, filters), true);
  assert.equal(isWithinExportDates({ createdAt: '2026-11-02T18:29:59.999Z' }, filters), true);
  assert.equal(isWithinExportDates({ createdAt: '2026-11-02T18:30:00.000Z' }, filters), false);
});

test('date filters reject invalid timestamps and support open-ended ranges', () => {
  assert.equal(isWithinExportDates({ createdAt: 'not-a-date' }, {}), false);
  assert.equal(isWithinExportDates({ createdAt: '2026-11-02T00:00:00.000Z' }, {}), true);
  assert.equal(isWithinExportDates({ createdAt: '2026-11-02T00:00:00.000Z' }, {
    startDate: '2026-11-03',
    startOffset: 0,
    endOffset: 0,
  }), false);
});

test('category ordering is stable and keeps unknown categories at the end', () => {
  const categories = [{ id: 'rocket' }, { id: 'custom' }, { id: 'sparkler' }];
  assert.deepEqual(orderCategories(categories, ['sparkler', 'rocket']).map((item) => item.id),
    ['sparkler', 'rocket', 'custom']);
});

test('stock adjustments calculate relative changes and absolute stock targets', () => {
  assert.deepEqual(calculateStockAdjustment(4, 'add', 6, 'restock'), { change: 6, stockAfter: 10 });
  assert.deepEqual(calculateStockAdjustment(4, 'remove', 2, 'damaged'), { change: -2, stockAfter: 2 });
  assert.deepEqual(calculateStockAdjustment(4, 'set', 2, 'correction'), { change: -2, stockAfter: 2 });
});

test('stock adjustments reject invalid quantities, reasons, directions, and balances', () => {
  assert.throws(() => calculateStockAdjustment(2, 'remove', 3, 'other'), RangeError);
  assert.throws(() => calculateStockAdjustment(2, 'add', 1, 'damaged'), RangeError);
  assert.throws(() => calculateStockAdjustment(2, 'remove', 1, 'restock'), RangeError);
  assert.throws(() => calculateStockAdjustment(2, 'add', 0, 'restock'), RangeError);
  assert.throws(() => calculateStockAdjustment(10_000_000, 'add', 1, 'restock'), RangeError);
});
