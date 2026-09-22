import { lazy, Suspense, useRef } from 'react'

const Cube3D = lazy(() => import('./Cube3D.jsx'))

const PATH_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/apisaseli/' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@apis999fps' },
  { label: 'Free web tools', href: 'https://toolapis.vercel.app/' },
]

const PATH_CLASS =
  'inline-flex min-h-[44px] items-center justify-center border border-white/20 px-5 text-[13px] font-medium uppercase tracking-[0.02em] text-bone ' +
  'transition-[color,border-color,box-shadow] duration-[0.5s] ease-signature ' +
  'hover:border-grape-soft hover:text-grape-soft hover:glow-purple ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape-soft'

export default function Hero() {
  const tiltRef = useRef({ x: 0, y: 0 })

  const handlePointerMove = (event) => {
    const x = (event.clientX / window.innerWidth) * 2 - 1
    const y = (event.clientY / window.innerHeight) * 2 - 1
    tiltRef.current = { x, y }
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 pt-28 pb-24"
    >
      {/* Interactive 3D cube background */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="h-full w-full bg-void" />}>
          <Cube3D tiltRef={tiltRef} />
        </Suspense>
      </div>
      {/* dark gradient overlay keeps the headline readable over the glowing cube */}
      <div
        className="absolute inset-0 z-[1] bg-gradient-to-b from-black/80 via-black/50 to-black/80"
        aria-hidden="true"
      />

      {/* Content above the cube */}
      <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
        <h1 className="text-[clamp(2.5rem,6vw,6.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          <span className="block">Calm surface.</span>
          <span className="block">Clear focus.</span>
          <span className="block text-neon">All your links.</span>
        </h1>
        <p className="mx-auto mt-6 w-full max-w-2xl text-[clamp(1rem,2vw,1.25rem)] leading-normal text-slate-mute">
          A quiet hub for your Instagram, TikTok, and free web tools.
        </p>

        <div className="mt-10 flex w-full flex-wrap justify-center gap-3 md:gap-6">
          {PATH_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={PATH_CLASS}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}