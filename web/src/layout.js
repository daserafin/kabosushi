// The nav bar shared by every page. Each page's HTML has an empty <nav class="site-nav">,
// and its script calls renderNav() to fill it in.
// /author/ is deliberately not listed: it's a hidden page you only reach by typing the URL.
const LINKS = [
  { href: '/', label: '🍣 menu' },
  { href: '/info/', label: '🕒 hours & map' },
  { href: '/feedback/', label: '💌 feedback' },
]

export function renderNav() {
  const nav = document.querySelector('.site-nav')
  nav.innerHTML = `
    <a class="brand" href="/">kabosushi</a>
    <ul>
      ${LINKS.map(
        ({ href, label }) =>
          `<li><a href="${href}" ${href === location.pathname ? 'aria-current="page"' : ''}>${label}</a></li>`,
      ).join('')}
    </ul>`
}
