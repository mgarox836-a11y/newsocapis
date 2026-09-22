export default function Manifesto() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-32 md:py-40">
      <div className="mx-auto w-full max-w-4xl text-center">
        <div
          className="hairline-neon mx-auto mb-12 h-px w-24 md:mb-16"
          aria-hidden="true"
        />
        <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[1.1] tracking-[-0.03em]">
          <span className="block">No noise, no clutter.</span>
          <span className="block">Just your links,</span>
          <span className="block text-neon">working quietly.</span>
        </h2>
        <p className="mx-auto mt-8 w-full max-w-xl text-[clamp(1rem,2vw,1.25rem)] leading-normal text-slate-mute">
          That is the whole point of Newsocapis.
        </p>
      </div>
    </section>
  )
}