"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Scène 3D procédurale (Three.js, pas Spline) d'un amphi : un prof
 * reconnaissable devant un tableau, et des élèves assis en rangs, vus de
 * dos. Tout est construit à partir de primitives simples — pas d'assets
 * externes — pour garder un contrôle total sur la composition et pouvoir
 * la faire vivre (mouvement continu en boucle).
 */
export default function AmphiScene({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 6.4, 15.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffd3f2, 1);
    key.position.set(4, 7, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec9ff, 0.7);
    rim.position.set(-6, 5, -4);
    scene.add(rim);

    const world = new THREE.Group();
    scene.add(world);

    // --- Tableau ---
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 3, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1f2a3d, roughness: 0.7 })
    );
    board.position.set(0, 3.4, -3.4);
    world.add(board);

    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 3.2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xe4d9c8, roughness: 0.8 })
    );
    boardFrame.position.set(0, 3.4, -3.46);
    world.add(boardFrame);

    for (let i = 0; i < 2; i++) {
      const chalkLine = new THREE.Mesh(
        new THREE.BoxGeometry(2.6 - i * 0.7, 0.07, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      chalkLine.position.set(-0.7 + i * 0.3, 3.8 - i * 0.55, -3.32);
      world.add(chalkLine);
    }

    // --- Prof ---
    const teacher = new THREE.Group();
    const blazerColor = 0x6d28d9;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.55, 1.4, 4, 12),
      new THREE.MeshStandardMaterial({ color: blazerColor, roughness: 0.55 })
    );
    body.position.y = 1.2;
    teacher.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffd7b0, roughness: 0.6 })
    );
    head.position.y = 2.2;
    teacher.add(head);

    // Moustache — positionnée bien à l'extérieur de la sphère de la tête
    // (sinon elle se retrouve enterrée dans la géométrie et devient
    // invisible). Placée juste au-dessus du "menton", face à la caméra.
    const mustache = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.06, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x2b1a12 })
    );
    mustache.rotation.set(Math.PI / 2, 0, Math.PI);
    mustache.position.set(0, 2.14, 0.46);
    teacher.add(mustache);

    const armPivot = new THREE.Group();
    armPivot.position.set(0.5, 1.75, 0.1);
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.65, 4, 8),
      new THREE.MeshStandardMaterial({ color: blazerColor })
    );
    arm.position.set(0, -0.32, 0);
    arm.rotation.z = -0.95;
    armPivot.add(arm);
    const ruler = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.07, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xffe08a })
    );
    ruler.position.set(-0.55, -0.62, 0.1);
    ruler.rotation.z = -0.95;
    armPivot.add(ruler);
    teacher.add(armPivot);

    teacher.position.set(-0.4, 0, -1.6);
    world.add(teacher);

    // --- Texture "Zzz" pour les élèves qui somnolent ---
    function createZzzSprite(): THREE.Sprite {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.fillStyle = "#6d28d9";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(18, 66);
      ctx.rotate(-0.2);
      ctx.fillText("Z", 0, 0);
      ctx.restore();
      ctx.save();
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.translate(56, 40);
      ctx.rotate(-0.2);
      ctx.fillText("z", 0, 0);
      ctx.restore();
      ctx.save();
      ctx.font = "bold 17px system-ui, sans-serif";
      ctx.translate(84, 22);
      ctx.rotate(-0.2);
      ctx.fillText("z", 0, 0);
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.7, 0.53, 1);
      return sprite;
    }

    // --- Élèves (assis, vus de dos, en rangs, colorés par rangée) ---
    const rowColors = [0xff8fc0, 0xb98af0, 0x8bb4ff];
    const rows = 3;
    const cols = 6;
    const students: { group: THREE.Group; seed: number; baseY: number }[] = [];
    const sleepyZzz: { sprite: THREE.Sprite; seed: number; baseY: number }[] = [];

    let studentIndex = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = new THREE.Group();

        // Banc / siège
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.16, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.9 })
        );
        seat.position.y = 0.08;
        s.add(seat);

        // Torse compact = position assise (pas un long capsule debout)
        const torso = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.29, 0.28, 4, 10),
          new THREE.MeshStandardMaterial({ color: rowColors[r % rowColors.length], roughness: 0.5 })
        );
        torso.position.y = 0.48;
        s.add(torso);

        const h = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 14, 14),
          new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.7 })
        );
        h.position.y = 0.9;
        s.add(h);

        const x = (c - (cols - 1) / 2) * 1.05 + (r % 2 === 0 ? 0.25 : -0.25);
        const z = 1.4 + r * 1.7;
        const y = r * 0.35;
        s.position.set(x, y, z);
        world.add(s);
        students.push({ group: s, seed: Math.random() * Math.PI * 2, baseY: y });

        // Un élève sur cinq somnole, un petit "Zzz" flotte au-dessus de sa tête
        if (studentIndex % 5 === 2) {
          const zzz = createZzzSprite();
          zzz.position.set(x, y + 1.35, z);
          world.add(zzz);
          sleepyZzz.push({ sprite: zzz, seed: Math.random() * Math.PI * 2, baseY: y + 1.35 });
        }
        studentIndex++;
      }
    }

    camera.lookAt(0, 2.3, -1.5);

    function handleResize() {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", handleResize);

    let frameId: number;
    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();

      teacher.rotation.y = Math.sin(t * 0.5) * 0.12;
      armPivot.rotation.z = Math.sin(t * 1.1) * 0.15;

      for (const { group, seed, baseY } of students) {
        group.rotation.y = Math.sin(t * 0.8 + seed) * 0.06;
        group.position.y = baseY + Math.sin(t * 1.4 + seed) * 0.025;
      }

      for (const { sprite, seed, baseY } of sleepyZzz) {
        sprite.position.y = baseY + Math.sin(t * 0.9 + seed) * 0.12 + 0.05;
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = 0.55 + Math.sin(t * 0.9 + seed) * 0.35;
      }

      camera.position.x = Math.sin(t * 0.15) * 0.5;
      camera.lookAt(0, 2.3, -1.5);

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
        } else if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
