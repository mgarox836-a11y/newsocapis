import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import Manifesto from './components/Manifesto.jsx'
import Platforms from './components/Platforms.jsx'

export default function App() {
  return (
    <div
      id="top"
      className="flex min-h-screen w-full flex-col overflow-x-hidden bg-void text-bone"
    >
      <Navbar />
      <main>
        <Hero />
        <Manifesto />
        <Platforms />
      </main>
    </div>
  )
}