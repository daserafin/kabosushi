import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'

const infoEl = document.querySelector('#info')
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // the table starts on Monday

// --- data -------------------------------------------------------------------

async function loadInfo() {
  // Three independent requests, sent at the same time instead of one after another.
  const [store, hours, status] = await Promise.all([
    // .single(): we expect exactly one row and want an object back, not an array.
    supabase.from('store_info').select('*').single(),
    supabase.from('store_hours').select('*').order('day_of_week'),
    // RPC = calling a Postgres function: POST /rest/v1/rpc/store_status
    supabase.rpc('store_status').single(),
  ])
  for (const { error } of [store, hours, status]) if (error) throw error
  return { store: store.data, hours: hours.data, status: status.data }
}

// --- helpers ----------------------------------------------------------------

const hhmm = (time) => time.slice(0, 5) // Postgres time '11:30:00' → '11:30'

// store_local_time is a plain timestamp ('2026-11-01T19:14:00'): the shop's wall clock,
// with no time zone attached. Read it as text so the browser doesn't "helpfully" shift it.
function storeClock(localTime) {
  const weekday = new Date(`${localTime.slice(0, 10)}T12:00:00`).getDay()
  return { weekday, time: localTime.slice(11, 16) }
}

// --- rendering --------------------------------------------------------------

function statusBadge(status, store) {
  const clock = storeClock(status.store_local_time)
  const visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const visitorTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const sameZone = visitorZone === store.timezone

  return `
    <div class="open-badge ${status.is_open ? 'open' : 'closed'}">
      ${status.is_open ? 'such open! much hungry? 🍣' : 'closed. doge sleeps. 💤'}
    </div>
    <p class="clock">
      It's <strong>${DAYS[clock.weekday]} ${clock.time}</strong> in Sakura
      ${sameZone ? '' : `(your time: ${visitorTime}, ${visitorZone})`}.
      ${
        status.opens_at
          ? `Today: ${hhmm(status.opens_at)}–${hhmm(status.closes_at)}.`
          : 'Closed all day today.'
      }
    </p>`
}

function hoursTable(hours, todayIndex) {
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]))
  const rows = DISPLAY_ORDER.map((day) => {
    const h = byDay.get(day)
    const time = h?.opens_at ? `${hhmm(h.opens_at)} – ${hhmm(h.closes_at)}` : 'closed'
    return `
      <tr ${day === todayIndex ? 'class="today"' : ''}>
        <th scope="row">${DAYS[day]}</th>
        <td>${time}</td>
        <td class="note">${escapeHtml(h?.note)}</td>
      </tr>`
  }).join('')
  return `<table class="hours"><caption>opening hours (Sakura time)</caption>${rows}</table>`
}

function mapEmbed(store) {
  const lat = Number(store.latitude)
  const lon = Number(store.longitude)
  const bbox = [lon - 0.01, lat - 0.006, lon + 0.01, lat + 0.006].join(',')
  return `
    <iframe class="map" title="Map of kabosushi in Sakura, Chiba" loading="lazy"
      src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}">
    </iframe>
    <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}" target="_blank" rel="noopener">
      bigger map, much zoom
    </a>`
}

function render({ store, hours, status }) {
  infoEl.innerHTML = `
    <h1>hours & map</h1>
    <section class="status-box">${statusBadge(status, store)}</section>
    <div class="info-grid">
      <section>${hoursTable(hours, storeClock(status.store_local_time).weekday)}</section>
      <section class="where">
        <h2>where</h2>
        <p class="address">${escapeHtml(store.address)}</p>
        ${mapEmbed(store)}
      </section>
    </div>`
}

// --- start ------------------------------------------------------------------

renderNav()

try {
  render(await loadInfo())
} catch (error) {
  console.error(error)
  infoEl.innerHTML = `<h1>hours & map</h1><p class="status error">much error. very sad. (${escapeHtml(error.message)})</p>`
}
