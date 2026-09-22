import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import Secondary from './components/Secondary.jsx'

export default function App() {
  return (
    <div
      id="top"
      className="flex min-h-screen flex-col overflow-x-hidden bg-obsidian text-bone"
    >
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Secondary />
      </main>
    </div>
  )
}