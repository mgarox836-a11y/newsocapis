import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Overview', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'Clarity', href: '#clarity' },
]

const TOOLS_URL = 'https://toolapis.vercel.app/'

const LINK_CLASS =
  'relative text-[13px] font-medium uppercase tracking-[0.02em] text-bone ' +
  'after:absolute after:inset-x-0 after:-bottom-[3px] after:h-px ' +
  'after:origin-left after:scale-x-0 after:bg-neon-cyan after:content-[""] ' +
  'after:transition-transform after:duration-[0.5s] after:ease-signature ' +
  'transition-colors duration-[0.5s] ease-signature ' +
  'hover:text-neon-cyan hover:after:scale-x-100 focus-visible:text-neon-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="flex w-full items-center justify-between px-6 py-6 md:px-10 md:py-8">
        <a href="#top" className="text-[15px] font-semibold uppercase tracking-[0.02em] text-bone">
          Newsocapis<span className="text-neon-soft">.</span>
        </a>

        {/* Desktop — ghost nav links, hamburger is mobile-only */}
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </a>
          ))}
          <a
            href={TOOLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 border border-white/25 px-[15px] py-[9px] text-[13px] font-medium uppercase tracking-[0.02em] text-bone transition-[color,border-color,box-shadow,transform] duration-[0.5s] ease-signature hover:-translate-y-px hover:border-neon-cyan hover:text-neon-cyan hover:glow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan"
          >
            Open the tools
          </a>
        </nav>

        {/* Mobile — hamburger toggle, 44x44px hit area */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          className="grid h-11 w-11 place-items-center border-0 bg-transparent p-0 text-bone transition-colors duration-[0.5s] ease-signature hover:text-neon-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan lg:hidden"
        >
          {open ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="lg:hidden">
          <div className="flex flex-col gap-1 bg-panel/95 px-6 pb-6 backdrop-blur">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center text-[13px] font-medium uppercase tracking-[0.02em] text-bone transition-colors duration-[0.5s] ease-signature hover:text-neon-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan"
              >
                {link.label}
              </a>
            ))}
            <a
              href={TOOLS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 flex min-h-[44px] items-center border border-white/25 px-[15px] text-[13px] font-medium uppercase tracking-[0.02em] text-bone transition-colors duration-[0.5s] ease-signature hover:border-neon-cyan hover:text-neon-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan"
            >
              Open the tools
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}