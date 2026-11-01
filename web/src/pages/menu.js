import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'

const menuEl = document.querySelector('#menu')

const WOW_LABELS = { 'much wow': 'much wow', 'such delish': 'such delish', 'very ok': 'very ok' }
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// --- data -------------------------------------------------------------------

async function loadMenu() {
  // supabase-js turns this into an HTTP request to the auto-generated API:
  //   GET /rest/v1/menu_view?select=*&order=category_sort_order,wow_level.desc,price_cents
  // It runs as the anon role, so the grants + RLS policies from Phase 3 decide what comes back.
  const { data, error } = await supabase
    .from('menu_view')
    .select('*')
    .order('category_sort_order')
    .order('wow_level', { ascending: false }) // enum order: much wow → such delish → very ok
    .order('price_cents')

  if (error) throw error
  return data
}

// menu_view returns flat rows; group them into categories, keeping the query's order.
function groupByCategory(items) {
  const categories = new Map()
  for (const item of items) {
    if (!categories.has(item.category_slug)) {
      categories.set(item.category_slug, { name: item.category_name, items: [] })
    }
    categories.get(item.category_slug).items.push(item)
  }
  return [...categories.values()]
}

// Stored paths become public URLs. The bucket is public, so no login is needed to load them.
function photoUrl(path) {
  return supabase.storage.from('menu-photos').getPublicUrl(path).data.publicUrl
}

// --- rendering --------------------------------------------------------------

// Menu text comes from the database. Escape it before putting it into HTML, so a stray
// "<" in a description can never turn into markup or a script.
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function itemCard(item) {
  const classes = ['card', item.is_available ? '' : 'sold-out'].join(' ')
  return `
    <article class="${classes}">
      ${item.is_top_pick ? '<span class="sticker">top pick!</span>' : ''}
      <img src="${photoUrl(item.photo_path)}" alt="${escapeHtml(item.name)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="description">${escapeHtml(item.description)}</p>
        <div class="meta">
          <span class="wow wow-${item.wow_level.split(' ')[0]}">${WOW_LABELS[item.wow_level]}</span>
          <span class="spice" title="spice ${item.spice_level}/5">${'🌶️'.repeat(item.spice_level)}</span>
          <span class="price">${price.format(item.price_cents / 100)}</span>
        </div>
      </div>
      ${item.is_available ? '' : '<span class="sold-out-label">much sad. sold out.</span>'}
    </article>`
}

function renderMenu(categories) {
  menuEl.innerHTML = categories
    .map(
      (category) => `
      <section class="category">
        <h2>${escapeHtml(category.name)}</h2>
        <div class="grid">${category.items.map(itemCard).join('')}</div>
      </section>`,
    )
    .join('')

  // If a photo fails to load, fall back to the bun shipped with the site (web/public).
  for (const img of menuEl.querySelectorAll('.card img')) {
    img.addEventListener('error', () => (img.src = '/doge-bun.png'), { once: true })
  }
}

// The classic doge meme: little phrases scattered around in random colours.
function sprinkleDogeWords() {
  const words = ['wow', 'such fish', 'very rice', 'much roll', 'so wasabi', 'many nom', 'amaze']
  const colors = ['#ff2d95', '#00b3ff', '#2fd12f', '#ff8a00', '#a64dff']
  document.querySelector('.doge-words').innerHTML = words
    .map((word, i) => {
      const style = [
        `left:${5 + ((i * 13) % 85)}%`,
        `top:${10 + ((i * 37) % 70)}%`,
        `color:${colors[i % colors.length]}`,
        `transform:rotate(${(i % 2 ? 1 : -1) * (5 + i * 3)}deg)`,
      ].join(';')
      return `<span style="${style}">${word}</span>`
    })
    .join('')
}

// --- start ------------------------------------------------------------------

renderNav()
sprinkleDogeWords()

try {
  renderMenu(groupByCategory(await loadMenu()))
} catch (error) {
  console.error(error)
  menuEl.innerHTML = `<p class="status error">much error. very sad. (${escapeHtml(error.message)})</p>`
}
