import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'

const GEM = '#8B5CF6'
const GEM_GLOW = '#7C3AED'
const EDGE = '#C084FC'

function Cube({ tiltRef, reduced }) {
  const meshRef = useRef(null)

  useFrame(() => {
    if (reduced || !meshRef.current) return
    const tilt = tiltRef?.current ?? { x: 0, y: 0 }

    meshRef.current.rotation.y += 0.005
    meshRef.current.rotation.x += (tilt.y * 0.5 - meshRef.current.rotation.x) * 0.05
    meshRef.current.rotation.z += (tilt.x * 0.25 - meshRef.current.rotation.z) * 0.05
  })

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[2.5, 2, 2.5]} intensity={40} color="#D8B4FE" />
      <pointLight position={[-2.5, -1.5, -2]} intensity={30} color="#8B5CF6" />
      <pointLight position={[0, 0, 3]} intensity={8} color="#C084FC" />

      <mesh ref={meshRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshPhysicalMaterial
          color={GEM}
          emissive={GEM_GLOW}
          emissiveIntensity={0.55}
          roughness={0.25}
          metalness={0.7}
          transparent
          opacity={0.95}
        />
        <Edges color={EDGE} />
      </mesh>
    </>
  )
}

export default function Cube3D({ tiltRef }) {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={reduced ? 'demand' : 'always'}
        camera={{ position: [0, 0, 3.2], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Cube tiltRef={tiltRef} reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  )
}