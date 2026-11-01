import '../style.css'
import { renderNav } from '../layout.js'
import { supabase } from '../supabase.js'
import { displayName, onSessionChange } from '../auth.js'

const form = document.querySelector('#login-form')
const status = form.querySelector('.form-status')
const welcome = document.querySelector('#welcome')

async function logIn(email, password) {
  // POST /auth/v1/token?grant_type=password. Supabase Auth checks the password and returns
  // a session; supabase-js stores it, and onSessionChange below fires with it.
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function countMyOrders() {
  // No filter by user: RLS on orders only ever shows the caller's own rows.
  // { count: 'exact', head: true } asks for just the number (a HEAD request), not the rows.
  const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count
}

async function showWelcome(session) {
  const [name, orders] = await Promise.all([displayName(session.user), countMyOrders()])
  welcome.querySelector('.welcome-title').textContent = `wow. welcome back, ${name}! 🐕`
  welcome.querySelector('.welcome-orders').textContent =
    orders === 1 ? 'You have 1 order. Such loyal.' : `You have ${orders} orders. Such loyal.`
}

onSessionChange(async (session) => {
  form.hidden = Boolean(session)
  welcome.hidden = !session
  if (session) await showWelcome(session)
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = form.querySelector('button')
  button.disabled = true
  status.textContent = 'sniffing credentials… such wait'
  status.className = 'form-status'
  try {
    await logIn(form.elements.email.value.trim(), form.elements.password.value)
    form.reset()
    status.textContent = ''
  } catch (error) {
    console.error(error)
    status.className = 'form-status error'
    // Supabase deliberately says the same thing for "no such user" and "wrong password",
    // so nobody can use this form to find out which emails have accounts.
    status.textContent =
      error.code === 'invalid_credentials'
        ? 'much denied. wrong email or password. (are you a good doggo?)'
        : `much error. very sad. (${error.message})`
  } finally {
    button.disabled = false
  }
})

welcome.querySelector('.logout-big').addEventListener('click', () => supabase.auth.signOut())

renderNav()
