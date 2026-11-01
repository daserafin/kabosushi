// Text from the database goes into HTML through template strings. Escape it first, so a
// stray "<" in a description or address can never turn into markup or a script.
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
