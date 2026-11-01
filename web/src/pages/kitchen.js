import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { onSessionChange } from '../auth.js'

const boardEl = document.querySelector('#board')
const liveEl = document.querySelector('.live')
const toastEl = document.querySelector('.toast')
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const money = (cents) => price.format(cents / 100)

// The board's columns, and the button that moves an order on from each one.
// This only picks which buttons to show: the database trigger decides which moves are allowed.
const COLUMNS = [
  { status: 'placed', title: '🧾 such new', next: 'cooking', action: 'start cooking 🔥' },
  { status: 'cooking', title: '🍣 very cooking', next: 'delivering', action: 'send it out 🛵' },
  { status: 'delivering', title: '🛵 much delivering', next: 'delivered', action: 'delivered 🏠' },
]
const CANCELLABLE = ['placed', 'cooking']

let channel = null // the Realtime subscription, while a staff doge is logged in
let clockTimer = null
const freshIds = new Set() // orders that just arrived, to wobble once

// --- data -------------------------------------------------------------------

async function loadActiveOrders() {
  // One request, four tables: PostgREST follows the foreign keys (orders → profiles,
  // order_items → orders, order_items → menu_items) and nests the results.
  // RLS applies to every embedded table too: the staff policies are what let this
  // return everyone's orders and names.
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, status, created_at, delivery_address, total_cents,
      profiles ( display_name ),
      order_items ( quantity, menu_items ( name ) )`)
    .in('status', COLUMNS.map((column) => column.status))
    .order('created_at')
  if (error) throw error
  return data
}

async function setStatus(orderId, status) {
  // PATCH /rest/v1/orders?id=eq.42 {"status":"cooking"}. Only the status column may be
  // updated (column grant), only by staff (RLS), only along the flow (trigger).
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select('id')
  if (error) throw error // e.g. the trigger's "such confuse…"
  // RLS doesn't raise errors: a forbidden update just matches 0 rows. Asking for the
  // updated rows back (.select) is how the page can tell.
  if (data.length === 0) throw new Error('much forbidden. doge could not update that order.')
}

// --- rendering --------------------------------------------------------------

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago, very hungry`
}

function ticket(order, column) {
  const lines = order.order_items
    .map((line) => `<li>${line.quantity} × ${escapeHtml(line.menu_items.name)}</li>`)
    .join('')
  // profiles is null when the customer deleted their account (orders.user_id → set null).
  const customer = order.profiles?.display_name ?? 'a mystery doge'
  return `
    <article class="ticket ${freshIds.has(order.id) ? 'fresh' : ''}" data-id="${order.id}">
      <header>
        <strong>#${order.id}</strong> ${escapeHtml(customer)}
        <time datetime="${order.created_at}">${timeAgo(order.created_at)}</time>
      </header>
      <ul>${lines}</ul>
      <p class="ticket-address">📍 ${escapeHtml(order.delivery_address)}</p>
      <p class="ticket-total">${money(order.total_cents)}</p>
      <div class="ticket-actions">
        <button type="button" data-status="${column.next}">${column.action}</button>
        ${CANCELLABLE.includes(order.status) ? '<button type="button" class="cancel" data-status="cancelled">cancel</button>' : ''}
      </div>
    </article>`
}

function renderBoard(orders) {
  boardEl.innerHTML = COLUMNS.map((column) => {
    const tickets = orders.filter((order) => order.status === column.status)
    return `
      <section class="column column-${column.status}">
        <h2>${column.title} <span class="count">${tickets.length}</span></h2>
        ${tickets.map((order) => ticket(order, column)).join('') || '<p class="empty">much empty</p>'}
      </section>`
  }).join('')
  freshIds.clear()
}

function showMessage(html) {
  boardEl.innerHTML = `<p class="checkout-note">${html}</p>`
}

function toast(text, isError = false) {
  toastEl.textContent = text
  toastEl.className = `toast ${isError ? 'error' : ''}`
  toastEl.hidden = false
  clearTimeout(toastEl.timer)
  toastEl.timer = setTimeout(() => (toastEl.hidden = true), 4000)
}

async function refresh() {
  try {
    renderBoard(await loadActiveOrders())
  } catch (error) {
    console.error(error)
    showMessage(`much error. very sad. (${escapeHtml(error.message)})`)
  }
}

// place_order() inserts an order and then updates its total, so one checkout arrives as
// two events. Wait a moment and reload once.
let refreshTimer = null
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 300)
}

// --- realtime ---------------------------------------------------------------

function listen() {
  // A WebSocket to Supabase Realtime: "tell me about every change to public.orders".
  // Before sending each change, Realtime checks it against our SELECT policies using our
  // login token, so the same code run by a customer would only hear about their own orders.
  // The payload only has the orders row, not the embedded items and names, so we reload.
  channel = supabase
    .channel('kitchen-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        freshIds.add(payload.new.id)
        toast(`bonk! 🔔 new order #${payload.new.id}`)
      }
      refreshSoon()
    })
    .subscribe((status) => {
      liveEl.textContent = status === 'SUBSCRIBED' ? '🟢 live: new orders appear by themselves' : `🔴 ${status.toLowerCase()}`
    })
}

function stopListening() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  clearInterval(clockTimer)
  liveEl.textContent = '⚪ not connected'
}

// --- start ------------------------------------------------------------------

// Status buttons: one delegated listener for the whole board.
boardEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-status]')
  if (!button) return
  const ticketEl = button.closest('.ticket')
  const id = Number(ticketEl.dataset.id)
  if (button.dataset.status === 'cancelled' && !confirm(`cancel order #${id}? much sad.`)) return

  const buttons = ticketEl.querySelectorAll('button')
  buttons.forEach((b) => (b.disabled = true))
  try {
    await setStatus(id, button.dataset.status)
    // Realtime will announce this change too; the debounce in refreshSoon merges the two.
    refreshSoon()
  } catch (error) {
    console.error(error)
    toast(error.message, true)
    buttons.forEach((b) => (b.disabled = false))
  }
})

onSessionChange(async (session) => {
  stopListening()
  if (!session) {
    showMessage('🔒 The kitchen is for staff doges only. <a href="/login/">Log in</a>.')
    return
  }
  // Hiding the board is just politeness: without the staff policies, the database
  // would return only this user's own orders anyway.
  const { data: isStaff, error } = await supabase.rpc('is_staff')
  if (error || !isStaff) {
    showMessage('🚫 much forbidden. this is the kitchen, you are a customer doge. <a href="/">the menu is this way</a>.')
    return
  }
  await refresh()
  listen()
  clockTimer = setInterval(refreshSoon, 60_000) // keep the "min ago" labels fresh
})

renderNav()
