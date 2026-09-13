"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ACCENT_COLORS = [0xff8fc0, 0xb98af0, 0x8bb4ff];

/**
 * Clavier 3D procédural (Three.js, pas Spline) — même méthode que
 * AmphiScene : primitives simples construites en code, fond transparent
 * (pas de fond noir, pas de watermark "Built with Spline").
 */
export default function KeyboardScene({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 1;
    let height = container.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    camera.position.set(0, 3.4, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffd3f2, 0.9);
    key.position.set(3, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec9ff, 0.6);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const world = new THREE.Group();
    world.rotation.x = -0.35;
    scene.add(world);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.32, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x2c2140, roughness: 0.6 })
    );
    world.add(base);

    const rows = 3;
    const cols = 10;
    const keyW = 0.34;
    const gap = 0.09;
    const rowDepth = 0.36;
    const startX = -((cols - 1) * (keyW + gap)) / 2;
    const startZ = -((rows - 1) * (rowDepth + gap)) / 2;

    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAccent = n % 9 === 4;
        const keyMesh = new THREE.Mesh(
          new THREE.BoxGeometry(keyW, 0.16, rowDepth),
          new THREE.MeshStandardMaterial({
            color: isAccent ? ACCENT_COLORS[(n / 9) % ACCENT_COLORS.length] : 0xfbf7ee,
            roughness: 0.5,
          })
        );
        keyMesh.position.set(startX + c * (keyW + gap), 0.24, startZ + r * (rowDepth + gap));
        world.add(keyMesh);
        n++;
      }
    }

    function handleResize() {
      if (!container) return;
      width = container.clientWidth || 1;
      height = container.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", handleResize);

    let frameId: number;
    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();
      world.rotation.y = Math.sin(t * 0.6) * 0.1;
      world.position.y = Math.sin(t * 1.3) * 0.06;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
