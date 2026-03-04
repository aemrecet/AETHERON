import React, { useRef, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
}

interface Ring {
  cx: number;
  cy: number;
  radius: number;
  dotCount: number;
  rotation: number;
  speed: number;
  color: string;
  dotSize: number;
  offset: number;
}

interface Polygon {
  points: { x: number; y: number; z: number }[];
  rotation: number;
  speed: number;
  cx: number;
  cy: number;
}

const COLORS = {
  navy: 'rgba(10, 10, 35, 0.4)',
  navyLight: 'rgba(10, 10, 35, 0.15)',
  blue: 'rgba(26, 107, 219, 0.35)',
  blueLight: 'rgba(26, 107, 219, 0.12)',
  gray: 'rgba(139, 145, 160, 0.2)',
};

export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const points: Point[] = [];
    const pointCount = 35;
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: Math.random() * 2000 - 500,
        y: Math.random() * 2000 - 500,
        z: Math.random() * 600 - 300,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 4 + 1.5,
        color: Math.random() > 0.8 ? COLORS.blue : COLORS.navy,
      });
    }

    const rings: Ring[] = [];
    const ringCenters = [
      { cx: 0.4, cy: 0.45, count: 8 },
      { cx: 0.7, cy: 0.4, count: 5 },
      { cx: 0.25, cy: 0.65, count: 3 },
    ];
    ringCenters.forEach(({ cx, cy, count }) => {
      for (let i = 0; i < count; i++) {
        const isBlue = Math.random() > 0.6;
        rings.push({
          cx,
          cy,
          radius: 40 + i * (30 + Math.random() * 25),
          dotCount: 30 + Math.floor(Math.random() * 40),
          rotation: Math.random() * Math.PI * 2,
          speed: (Math.random() - 0.5) * 0.003,
          color: isBlue ? COLORS.blueLight : COLORS.navyLight,
          dotSize: 1 + Math.random() * 1.2,
          offset: Math.random() * Math.PI * 2,
        });
      }
    });

    const concentricRings: { cx: number; cy: number; radius: number; speed: number }[] = [];
    for (let i = 0; i < 12; i++) {
      concentricRings.push({
        cx: 0.4,
        cy: 0.45,
        radius: 60 + i * 18,
        speed: 0.001 + Math.random() * 0.002,
      });
    }

    const polygons: Polygon[] = [];
    for (let i = 0; i < 4; i++) {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const sides = 3 + Math.floor(Math.random() * 3);
      const polyPoints = [];
      const size = 30 + Math.random() * 60;
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        polyPoints.push({
          x: Math.cos(angle) * size,
          y: Math.sin(angle) * size,
          z: (Math.random() - 0.5) * 100,
        });
      }
      polygons.push({
        points: polyPoints,
        rotation: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.005,
        cx,
        cy,
      });
    }

    const project = (x: number, y: number, z: number): { px: number; py: number; scale: number } => {
      const fov = 800;
      const scale = fov / (fov + z);
      return {
        px: x * scale,
        py: y * scale,
        scale,
      };
    };

    let time = 0;
    const lineTrails: { x1: number; y1: number; x2: number; y2: number; angle: number; length: number; speed: number }[] = [];
    for (let i = 0; i < 6; i++) {
      lineTrails.push({
        x1: Math.random() * 1.2 - 0.1,
        y1: Math.random() * 1.2 - 0.1,
        x2: Math.random() * 1.2 - 0.1,
        y2: Math.random() * 1.2 - 0.1,
        angle: Math.random() * Math.PI * 2,
        length: 80 + Math.random() * 200,
        speed: 0.002 + Math.random() * 0.003,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      time += 1;

      const cx1 = width * 0.4;
      const cy1 = height * 0.45;
      concentricRings.forEach((ring, i) => {
        const breathe = Math.sin(time * 0.008 + i * 0.3) * 8;
        const r = ring.radius + breathe;
        ctx.beginPath();
        ctx.arc(cx1, cy1, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 3 === 0 ? COLORS.blueLight : COLORS.navyLight;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });

      rings.forEach((ring) => {
        ring.rotation += ring.speed;
        const rcx = ring.cx * width;
        const rcy = ring.cy * height;
        const breathe = Math.sin(time * 0.006 + ring.offset) * 5;
        const r = ring.radius + breathe;

        for (let i = 0; i < ring.dotCount; i++) {
          const angle = ring.rotation + (i / ring.dotCount) * Math.PI * 2;
          const wobble = Math.sin(time * 0.01 + i * 0.5) * 3;
          const dx = Math.cos(angle) * (r + wobble);
          const dy = Math.sin(angle) * (r + wobble) * 0.85;
          const dz = Math.sin(angle * 2 + time * 0.005) * 30;

          const { px, py, scale } = project(dx, dy, dz);
          ctx.beginPath();
          ctx.arc(rcx + px, rcy + py, ring.dotSize * scale, 0, Math.PI * 2);
          ctx.fillStyle = ring.color;
          ctx.fill();
        }
      });

      lineTrails.forEach((trail) => {
        trail.angle += trail.speed;
        const sx = trail.x1 * width;
        const sy = trail.y1 * height;
        const ex = sx + Math.cos(trail.angle) * trail.length;
        const ey = sy + Math.sin(trail.angle) * trail.length;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = COLORS.navyLight;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      points.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (p.x < -500 || p.x > width + 500) p.vx *= -1;
        if (p.y < -500 || p.y > height + 500) p.vy *= -1;
        if (p.z < -300 || p.z > 300) p.vz *= -1;

        const { px, py, scale } = project(p.x, p.y, p.z);
        ctx.beginPath();
        ctx.arc(px, py, p.radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      const connectionDist = 180;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.15;
            const p1 = project(points[i].x, points[i].y, points[i].z);
            const p2 = project(points[j].x, points[j].y, points[j].z);
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = `rgba(10, 10, 35, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      polygons.forEach((poly) => {
        poly.rotation += poly.speed;
        const cos = Math.cos(poly.rotation);
        const sin = Math.sin(poly.rotation);

        const projected = poly.points.map((pt) => {
          const rx = pt.x * cos - pt.z * sin;
          const rz = pt.x * sin + pt.z * cos;
          const { px, py, scale } = project(rx, pt.y, rz);
          return { x: poly.cx + px, y: poly.cy + py, scale };
        });

        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < projected.length; i++) {
          ctx.lineTo(projected[i].x, projected[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = COLORS.navyLight;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        ctx.fillStyle = 'rgba(10, 10, 35, 0.02)';
        ctx.fill();

        projected.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 * pt.scale, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.navy;
          ctx.fill();
        });

        for (let i = 0; i < projected.length; i++) {
          for (let j = i + 2; j < projected.length; j++) {
            if (i === 0 && j === projected.length - 1) continue;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = COLORS.gray;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      });

      for (let i = 0; i < 3; i++) {
        const angle = time * 0.003 + i * (Math.PI * 2 / 3);
        const radius = 120 + Math.sin(time * 0.005 + i) * 30;
        const dottedLen = 40 + i * 20;
        const startX = cx1 + Math.cos(angle) * radius;
        const startY = cy1 + Math.sin(angle) * radius * 0.85;
        const endX = startX + Math.cos(angle + 0.3) * dottedLen;
        const endY = startY + Math.sin(angle + 0.3) * dottedLen;

        const steps = 15;
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const px = startX + (endX - startX) * t;
          const py = startY + (endY - startY) * t;
          ctx.beginPath();
          ctx.arc(px, py, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.navyLight;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
