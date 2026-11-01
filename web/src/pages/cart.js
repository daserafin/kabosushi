import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { onSessionChange } from '../auth.js'
import { clearCart, getCart, onCartChange, setQuantity } from '../cart.js'

const cartEl = document.querySelector('#cart')
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const money = (cents) => price.format(cents / 100)

let session = null
let placedOrder = null // set after a successful checkout, to show the confirmation

// --- data -------------------------------------------------------------------

// The cart only stores ids and quantities. Names and current prices come from the menu.
async function loadCartItems(cart) {
  const ids = Object.keys(cart).map(Number)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('menu_view')
    .select('id, name, price_cents, is_available')
    .in('id', ids) // → ?id=in.(1,22)
  if (error) throw error
  return data.map((item) => ({ ...item, quantity: cart[item.id] }))
}

// Pre-fill the address from the customer's first saved address (RLS: only their own).
async function savedAddress() {
  const { data } = await supabase
    .from('addresses')
    .select('street, city, postal_code')
    .order('created_at')
    .limit(1)
    .maybeSingle() // like .single(), but "no row" is fine and gives null
  return data ? `${data.street}, ${data.city} ${data.postal_code}` : ''
}

async function placeOrder(lines, deliveryAddress) {
  // POST /rest/v1/rpc/place_order. Only ids and quantities are sent: the function reads
  // every price from the database, so editing this request can't make sushi cheaper.
  const { data, error } = await supabase.rpc('place_order', {
    items: lines.map(({ id, quantity }) => ({ menu_item_id: id, quantity })),
    delivery_address: deliveryAddress,
  })
  if (error) throw error
  return data // the new orders row: id, status, total_cents, …
}

// --- rendering --------------------------------------------------------------

function lineRow(item) {
  return `
    <li class="cart-line ${item.is_available ? '' : 'unavailable'}">
      <span class="line-name">${escapeHtml(item.name)}${item.is_available ? '' : ' <em>(sold out, please remove)</em>'}</span>
      <span class="qty">
        <button type="button" data-id="${item.id}" data-delta="-1" aria-label="one less">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-id="${item.id}" data-delta="1" aria-label="one more">+</button>
      </span>
      <span class="line-total">${money(item.price_cents * item.quantity)}</span>
      <button type="button" class="remove" data-id="${item.id}" aria-label="remove">✕</button>
    </li>`
}

function checkoutBox(items, address) {
  if (!session) {
    return `<p class="checkout-note">🔒 Checkout is for good doggos only. <a href="/login/">Log in</a> to order.</p>`
  }
  const blocked = items.some((item) => !item.is_available)
  return `
    <form id="checkout" class="doge-form">
      <label for="address">deliver to</label>
      <textarea id="address" name="address" rows="2" required minlength="5"
        placeholder="1 Shiba Street, Sakura City">${escapeHtml(address)}</textarea>
      <button type="submit" ${blocked ? 'disabled' : ''}>place order 🐕</button>
      <p class="form-status" role="status" aria-live="polite">${blocked ? 'remove sold-out items first.' : ''}</p>
    </form>`
}

async function render() {
  if (placedOrder) {
    cartEl.innerHTML = `
      <section class="doge-form order-done">
        <h2>wow. such order. 🎉</h2>
        <p>Order <strong>#${placedOrder.id}</strong> is <strong>${placedOrder.status}</strong>.
           Total charged by doge: <strong>${money(placedOrder.total_cents)}</strong>.</p>
        <p>Delivering to: ${escapeHtml(placedOrder.delivery_address)}</p>
        <p><a href="/orders/#order-${placedOrder.id}">track it live 🛵</a> · <a href="/">back to menu</a></p>
      </section>`
    return
  }

  const items = await loadCartItems(getCart())
  if (items.length === 0) {
    cartEl.innerHTML = `<p class="status">much empty. <a href="/">go find sushi</a> 🍣</p>`
    return
  }

  const estimate = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0)
  const address = session ? await savedAddress() : ''
  cartEl.innerHTML = `
    <ul class="cart-lines">${items.map(lineRow).join('')}</ul>
    <p class="cart-total">total: <strong>${money(estimate)}</strong>
      <span class="hint">(final price is checked by doge at checkout)</span></p>
    ${checkoutBox(items, address)}`

  cartEl.querySelector('#checkout')?.addEventListener('submit', (event) => submitOrder(event, items))
}

async function submitOrder(event, items) {
  event.preventDefault()
  const form = event.target
  const status = form.querySelector('.form-status')
  const button = form.querySelector('button')
  button.disabled = true
  status.className = 'form-status'
  status.textContent = 'doge is checking prices… such wait'
  try {
    placedOrder = await placeOrder(items, form.elements.address.value.trim())
    clearCart() // fires cart-change, which re-renders into the confirmation
  } catch (error) {
    console.error(error)
    status.className = 'form-status error'
    status.textContent = error.message // place_order's own goofy messages come through here
    button.disabled = false
  }
}

// --- start ------------------------------------------------------------------

// Quantity and remove buttons: one delegated listener for the whole cart.
cartEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]')
  if (!button) return
  const id = Number(button.dataset.id)
  const current = getCart()[id] ?? 0
  setQuantity(id, button.classList.contains('remove') ? 0 : current + Number(button.dataset.delta))
})

const safeRender = () =>
  render().catch((error) => {
    console.error(error)
    cartEl.innerHTML = `<p class="status error">much error. very sad. (${escapeHtml(error.message)})</p>`
  })

onCartChange(safeRender)
onSessionChange((newSession) => {
  session = newSession
  safeRender()
})
renderNav()
