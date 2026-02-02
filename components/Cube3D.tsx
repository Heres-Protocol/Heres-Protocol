'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

export function Cube3D() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const width = container.offsetWidth
    const height = Math.min(container.offsetHeight, 400)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2)
    const edges = new THREE.EdgesGeometry(geometry)
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.9,
      })
    )
    const material = new THREE.MeshPhongMaterial({
      color: 0x0a0f1a,
      transparent: true,
      opacity: 0.85,
      shininess: 80,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.15,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.add(line)
    scene.add(mesh)

    const light = new THREE.PointLight(0x22d3ee, 1.5, 20)
    light.position.set(2, 2, 5)
    scene.add(light)
    const light2 = new THREE.PointLight(0xa78bfa, 1, 15)
    light2.position.set(-2, -1, 3)
    scene.add(light2)

    gsap.to(mesh.rotation, {
      y: Math.PI * 2,
      x: 0.2,
      duration: 18,
      repeat: -1,
      ease: 'none',
    })

    let frameId: number
    function animate() {
      frameId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = Math.min(containerRef.current.offsetHeight, 400)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frameId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className="h-[320px] w-full min-h-[280px] sm:h-[380px]" />
}
