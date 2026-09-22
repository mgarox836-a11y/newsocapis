import { ArrowUpRight } from 'lucide-react'

const PLATFORM_LINKS = [
  { label: 'Instagram', sub: 'Daily stories, photos, and highlights.', href: 'https://www.instagram.com/apisaseli/' },
  { label: 'TikTok', sub: 'Short videos, trends, and gameplay clips.', href: 'https://www.tiktok.com/@apis999fps' },
  { label: 'Free Web Tools', sub: 'Free online tools for everyday quick tasks.', href: 'https://toolapis.vercel.app/' },
]

const ROW_CLASS =
  'group flex w-full items-center justify-between gap-6 border-b border-white/10 py-5 ' +
  'transition-[border-color] duration-[0.5s] ease-signature ' +
  'hover:border-neon-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-cyan'

export default function Platforms() {
  return (
    <section id="features" className="relative w-full overflow-hidden px-6 py-32 md:py-40">
      <div className="mx-auto w-full max-w-4xl text-left">
        <h2 className="max-w-3xl text-[clamp(2rem,5vw,4.5rem)] font-medium leading-[1.1] tracking-[-0.03em]">
          <span className="block">One place for</span>
          <span className="block text-neon">everything you share.</span>
        </h2>

        <ul className="mt-16 w-full">
          {PLATFORM_LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
                <span>
                  <span className="block text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-[-0.02em] text-bone transition-colors duration-[0.5s] ease-signature group-hover:text-neon-cyan">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-[clamp(0.9rem,1.5vw,1.05rem)] text-slate-mute">
                    {link.sub}
                  </span>
                </span>
                <ArrowUpRight
                  size={22}
                  strokeWidth={2}
                  className="shrink-0 text-slate-mute transition-[color,transform] duration-[0.5s] ease-signature group-hover:text-neon-cyan group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}