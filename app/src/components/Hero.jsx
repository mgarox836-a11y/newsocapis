export default function Hero() {
  return (
    /* flex-1 (via <main className="flex flex-1 flex-col">) vertically centers
       the content in the space below the sticky navbar — no min-h stacking,
       no layout bugs on short viewports */
    <section className="flex flex-1 items-center justify-center px-6 py-24 md:py-28">
      <div className="mx-auto w-full max-w-4xl text-center">
        <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] font-medium leading-[1.1] tracking-[-0.02em]">
          {/* each line is its own block — no widow/orphan ever wraps to a new line */}
          <span className="block">No noise, no clutter.</span>
          <span className="block">Just your links,</span>
          <span className="block">working quietly.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1rem,2vw,1.25rem)] leading-normal text-fog">
          That is the whole point of Newsocapis.
        </p>
      </div>
    </section>
  )
}