import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'

const form = document.querySelector('#feedback-form')
const message = form.elements.message
const count = document.querySelector('#count')
const status = form.querySelector('.form-status')
const button = form.querySelector('button')

function showStatus(text, kind) {
  status.textContent = text
  status.className = `form-status ${kind}`
}

async function sendFeedback({ kind, name, message }) {
  // POST /rest/v1/feedback. Note there's no .select() after .insert(): selecting would ask
  // for the new row back, which needs SELECT rights, and this table has none on purpose.
  // Without it, supabase-js asks for no response body (Prefer: return=minimal).
  const { error } = await supabase.from('feedback').insert({ kind, name: name || null, message })
  if (error) throw error
}

message.addEventListener('input', () => {
  count.textContent = message.value.length
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = Object.fromEntries(new FormData(form))
  data.name = data.name.trim()
  data.message = data.message.trim()

  // Checked here for a friendly message, and again by the database, which is the real guard:
  // anyone can skip this page and call the API directly.
  if (data.message.length < 3) {
    showStatus('very short. much more words please (3+).', 'error')
    message.focus()
    return
  }

  button.disabled = true
  showStatus('sending… such wait', '')
  try {
    await sendFeedback(data)
    form.reset()
    count.textContent = '0'
    showStatus(
      data.kind === 'food request' ? 'wow! request sent. doge will consider. 🍱' : 'much thanks! doge will read. 🐕',
      'success',
    )
  } catch (error) {
    console.error(error)
    showStatus(`much error. very sad. (${error.message})`, 'error')
  } finally {
    button.disabled = false
  }
})

renderNav()
