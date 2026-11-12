// Standalone test for src/utils/fetchAll.js. Run with: node --test tests/fetchAll.test.mjs
// Lives outside src/ so it is never part of the Vite bundle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAll, PAGE_SIZE } from '../src/utils/fetchAll.js'

// Fake Supabase query builder: makeQuery() returns a fresh builder whose
// .range(from, to) resolves to the inclusive slice of `rows`, like PostgREST.
// `failOnCall` makes the Nth range call (1-based) resolve with an error.
function fakeSource(rows, { failOnCall } = {}) {
  const calls = []
  const makeQuery = () => ({
    range(from, to) {
      calls.push([from, to])
      if (calls.length === failOnCall) {
        return Promise.resolve({ data: null, error: { message: 'boom' } })
      }
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  })
  return { makeQuery, calls }
}

const makeRows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))

test('PAGE_SIZE is 500', () => {
  assert.equal(PAGE_SIZE, 500)
})

test('0 rows: one request, empty result', async () => {
  const { makeQuery, calls } = fakeSource([])
  const { data, error } = await fetchAll(makeQuery)
  assert.equal(error, null)
  assert.deepEqual(data, [])
  assert.deepEqual(calls, [[0, 499]])
})

test('fewer than one page: one request, all rows', async () => {
  const rows = makeRows(123)
  const { makeQuery, calls } = fakeSource(rows)
  const { data, error } = await fetchAll(makeQuery)
  assert.equal(error, null)
  assert.deepEqual(data, rows)
  assert.deepEqual(calls, [[0, 499]])
})

test('exactly one page: second request comes back empty and stops', async () => {
  const rows = makeRows(500)
  const { makeQuery, calls } = fakeSource(rows)
  const { data, error } = await fetchAll(makeQuery)
  assert.equal(error, null)
  assert.deepEqual(data, rows)
  assert.deepEqual(calls, [[0, 499], [500, 999]])
})

test('several pages: every row once, in order, no gaps', async () => {
  const rows = makeRows(1234)
  const { makeQuery, calls } = fakeSource(rows)
  const { data, error } = await fetchAll(makeQuery)
  assert.equal(error, null)
  assert.equal(data.length, 1234)
  assert.deepEqual(data, rows)
  assert.equal(new Set(data.map(r => r.id)).size, 1234)
  assert.deepEqual(calls, [[0, 499], [500, 999], [1000, 1499]])
})

test('error on the second page: returns the error, no partial data, stops', async () => {
  const rows = makeRows(1234)
  const { makeQuery, calls } = fakeSource(rows, { failOnCall: 2 })
  const { data, error } = await fetchAll(makeQuery)
  assert.equal(data, null)
  assert.deepEqual(error, { message: 'boom' })
  assert.deepEqual(calls, [[0, 499], [500, 999]])
})
