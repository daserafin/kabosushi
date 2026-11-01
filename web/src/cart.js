// The cart lives only in this browser (localStorage), as { menuItemId: quantity }.
// It holds no prices on purpose: prices are always read fresh from the database, and at
// checkout place_order() looks them up again itself. Nothing here can change what you pay.

const KEY = 'kabosushi-cart'
const MAX_QUANTITY = 99 // matches the check on order_items.quantity

// localStorage can be unavailable (private windows, blocked storage); never crash on it.
export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart))
  } catch {
    // Storage blocked: the cart just won't survive a reload.
  }
  // Tell the rest of this page (e.g. the nav badge). Other tabs get a 'storage' event.
  window.dispatchEvent(new CustomEvent('cart-change'))
}

export function setQuantity(menuItemId, quantity) {
  const cart = getCart()
  const clamped = Math.min(Math.max(Math.trunc(quantity) || 0, 0), MAX_QUANTITY)
  if (clamped === 0) delete cart[menuItemId]
  else cart[menuItemId] = clamped
  saveCart(cart)
}

export function addToCart(menuItemId) {
  setQuantity(menuItemId, (getCart()[menuItemId] ?? 0) + 1)
}

export function clearCart() {
  saveCart({})
}

export function itemCount(cart = getCart()) {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
}

// Runs `callback` whenever the cart changes, in this tab or another one.
export function onCartChange(callback) {
  window.addEventListener('cart-change', callback)
  window.addEventListener('storage', (event) => event.key === KEY && callback())
}
