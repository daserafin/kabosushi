import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { onSessionChange } from '../auth.js'

const ordersEl = document.querySelector('#orders')
const liveEl = document.querySelector('.live')
const toastEl = document.querySelector('.toast')
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const money = (cents) => price.format(cents / 100)
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// The happy path, in order. 'cancelled' can happen after placed or cooking.
const STEPS = [
  { status: 'placed', icon: '🧾', label: 'such placed' },
  { status: 'cooking', icon: '🍣', label: 'very cooking' },
  { status: 'delivering', icon: '🛵', label: 'much delivering' },
  { status: 'delivered', icon: '🏠', label: 'wow arrived' },
]
const LABELS = { ...Object.fromEntries(STEPS.map((s) => [s.status, `${s.label} ${s.icon}`])), cancelled: 'cancelled 😿' }

let channel = null
let currentUserId // who the page is currently set up for (undefined = nobody yet)
const shownStatus = new Map() // order id → status on screen, to spot real status changes

// --- data -------------------------------------------------------------------

async function loadMyOrders(userId) {
  // The .eq('user_id') looks redundant, since RLS only shows customers their own orders.
  // But policies are OR-ed: for a staff doge, "own orders OR staff" means every order.
  // "My orders" has to say what it means instead of relying on RLS to narrow it down.
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, status, created_at, delivery_address, total_cents,
      order_items ( quantity, menu_items ( name ) ),
      order_status_history ( status, changed_at )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return data
}

// --- rendering --------------------------------------------------------------

function progress(order) {
  const reached = Object.fromEntries(order.order_status_history.map((h) => [h.status, h.changed_at]))
  return `
    <ol class="progress">
      ${STEPS.map((step) => {
        const state = order.status === step.status ? 'current' : reached[step.status] ? 'done' : ''
        return `
          <li class="${state}">
            <span class="step-icon">${step.icon}</span>
            <span>${step.label}</span>
            <time>${reached[step.status] ? clock(reached[step.status]) : ''}</time>
          </li>`
      }).join('')}
    </ol>`
}

function orderCard(order) {
  const lines = order.order_items
    .map((line) => `<li>${line.quantity} × ${escapeHtml(line.menu_items.name)}</li>`)
    .join('')
  const cancelledAt = order.order_status_history.find((h) => h.status === 'cancelled')?.changed_at
  return `
    <article class="order-card ${order.status}" id="order-${order.id}">
      <header>
        <h2>order #${order.id}</h2>
        <span class="order-meta">${clock(order.created_at)} · ${money(order.total_cents)}</span>
      </header>
      ${cancelledAt ? `<p class="cancelled-note">much sad. the kitchen cancelled this at ${clock(cancelledAt)}.</p>` : progress(order)}
      <details>
        <summary>what's inside</summary>
        <ul>${lines}</ul>
        <p>📍 ${escapeHtml(order.delivery_address)}</p>
      </details>
    </article>`
}

function render(orders) {
  shownStatus.clear()
  for (const order of orders) shownStatus.set(order.id, order.status)
  ordersEl.innerHTML = orders.length
    ? orders.map(orderCard).join('')
    : '<p class="status">much empty. no orders yet. <a href="/">go find sushi</a> 🍣</p>'
  // Coming from checkout (/orders/#order-7): highlight that order.
  if (location.hash) document.querySelector(location.hash)?.classList.add('highlight')
}

function toast(text) {
  toastEl.textContent = text
  toastEl.hidden = false
  clearTimeout(toastEl.timer)
  toastEl.timer = setTimeout(() => (toastEl.hidden = true), 4000)
}

async function refresh() {
  try {
    render(await loadMyOrders(currentUserId))
  } catch (error) {
    console.error(error)
    ordersEl.innerHTML = `<p class="status error">much error. very sad. (${escapeHtml(error.message)})</p>`
  }
}

let refreshTimer = null
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 300)
}

// --- realtime ---------------------------------------------------------------

function listen(userId) {
  // Same subscription as the kitchen, plus a filter. RLS already keeps other people's
  // orders away from customers; the filter makes Realtime skip them before even checking
  // RLS, and keeps a staff doge's tracker to their own orders.
  channel = supabase
    .channel(`my-orders-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
      (payload) => {
        // UPDATE events also fire when place_order() fills in the total, so only announce
        // a change when the status differs from what's on screen.
        const { id, status } = payload.new
        if (payload.eventType === 'UPDATE' && shownStatus.has(id) && shownStatus.get(id) !== status) {
          toast(`wow. order #${id} is now ${LABELS[status]}`)
        }
        refreshSoon()
      },
    )
    .subscribe((status) => {
      liveEl.textContent = status === 'SUBSCRIBED' ? '🟢 live: this page updates by itself' : `🔴 ${status.toLowerCase()}`
    })
}

async function stopListening() {
  if (channel) await supabase.removeChannel(channel)
  channel = null
  liveEl.textContent = '⚪ not connected'
}

// --- start ------------------------------------------------------------------

onSessionChange(async (session) => {
  // Fires several times (page load, login, logout, token refreshes): only start over
  // when the person changes. Same reasoning as the kitchen page.
  const userId = session?.user.id ?? null
  if (userId === currentUserId) return
  currentUserId = userId

  await stopListening()
  if (!session) {
    ordersEl.innerHTML = '<p class="checkout-note">🔒 Log in to see your orders. <a href="/login/">Log in</a></p>'
    return
  }
  await refresh()
  if (userId !== currentUserId) return // someone else logged in meanwhile
  listen(userId)
})

renderNav()
