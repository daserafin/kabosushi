import { supabase } from './supabase.js'
import { displayName, onSessionChange } from './auth.js'
import { itemCount, onCartChange } from './cart.js'
import { escapeHtml } from './html.js'

// The nav bar shared by every page. Each page's HTML has an empty <nav class="site-nav">,
// and its script calls renderNav() to fill it in.
// /author/ is deliberately not listed: it's a hidden page you only reach by typing the URL.
const LINKS = [
  { href: '/', label: '🍣 menu' },
  { href: '/info/', label: '🕒 hours & map' },
  { href: '/feedback/', label: '💌 feedback' },
]

const isCurrent = (href) => (href === location.pathname ? 'aria-current="page"' : '')

export function renderNav() {
  const nav = document.querySelector('.site-nav')
  nav.innerHTML = `
    <a class="brand" href="/">kabosushi</a>
    <ul>
      ${LINKS.map(({ href, label }) => `<li><a href="${href}" ${isCurrent(href)}>${label}</a></li>`).join('')}
    </ul>
    <div class="auth-area"></div>`

  // Cart link with a live item count, after the regular links.
  nav.querySelector('ul').insertAdjacentHTML(
    'beforeend',
    `<li><a href="/cart/" ${isCurrent('/cart/')}>🛒 cart <span class="cart-count"></span></a></li>`,
  )
  const cartCount = nav.querySelector('.cart-count')
  const updateCartCount = () => {
    const count = itemCount()
    cartCount.textContent = count ? `(${count})` : ''
  }
  updateCartCount()
  onCartChange(updateCartCount)

  const authArea = nav.querySelector('.auth-area')
  onSessionChange(async (session) => {
    if (!session) {
      authArea.innerHTML = `<a href="/login/" ${isCurrent('/login/')}>🔑 login</a>`
      return
    }
    const [name, { data: isStaff }] = await Promise.all([displayName(session.user), supabase.rpc('is_staff')])
    // Staff get a kitchen link. Customers could still type /kitchen/, but RLS shows them nothing.
    const kitchenLink = isStaff ? `<a href="/kitchen/" ${isCurrent('/kitchen/')}>👨‍🍳 kitchen</a>` : ''
    authArea.innerHTML = `
      ${kitchenLink}
      <a href="/login/" ${isCurrent('/login/')}>🐕 ${escapeHtml(name)}</a>
      <button type="button" class="logout">log out</button>`
    authArea.querySelector('.logout').addEventListener('click', () => supabase.auth.signOut())
  })
}
