import React, { useEffect, useRef } from 'react';

interface AICore3DProps {
  size?: number;
  className?: string;
  interactive?: boolean;
}

export const AICore3D: React.FC<AICore3DProps> = ({
  size = 420,
  className = '',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationX = 0;
    let rotationY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    // Generate 3D sphere nodes
    const NODE_COUNT = 60;
    const SPHERE_RADIUS = 130;
    const nodes: Array<{
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      size: number;
      color: string;
      label?: string;
    }> = [];

    const labels = ['BTC', 'ETH', 'SOL', 'AI RISK', 'NEURAL', 'BINANCE', 'ALPHA', 'MACD', 'QUANT', 'SENTIMENT'];
    const colors = ['#00E5FF', '#10B981', '#D4AF37', '#38BDF8', '#6366F1'];

    for (let i = 0; i < NODE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / NODE_COUNT);
      const theta = Math.sqrt(NODE_COUNT * Math.PI) * phi;

      const x = SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
      const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
      const z = SPHERE_RADIUS * Math.cos(phi);

      nodes.push({
        x,
        y,
        z,
        baseX: x,
        baseY: y,
        baseZ: z,
        size: Math.random() * 2.5 + 1.5,
        color: colors[i % colors.length],
        label: i < labels.length ? labels[i] : undefined,
      });
    }

    // Dynamic data packets moving along connections
    const packets: Array<{
      fromIdx: number;
      toIdx: number;
      progress: number;
      speed: number;
      color: string;
    }> = [];

    for (let p = 0; p < 8; p++) {
      const fromIdx = Math.floor(Math.random() * NODE_COUNT);
      let toIdx = Math.floor(Math.random() * NODE_COUNT);
      while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * NODE_COUNT);

      packets.push({
        fromIdx,
        toIdx,
        progress: Math.random(),
        speed: Math.random() * 0.015 + 0.008,
        color: Math.random() > 0.5 ? '#00E5FF' : '#10B981',
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas || !interactive) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetRotationY = ((e.clientX - cx) / rect.width) * 0.8;
      targetRotationX = -((e.clientY - cy) / rect.height) * 0.8;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      // Smooth inertia rotation
      rotationX += (targetRotationX - rotationX) * 0.05 + 0.002;
      rotationY += (targetRotationY - rotationY) * 0.05 + 0.005;

      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);

      // Radial background glow
      const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.45);
      bgGrad.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
      bgGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)');
      bgGrad.addColorStop(1, 'rgba(5, 7, 13, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Outer glowing ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, SPHERE_RADIUS * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.restore();

      // Transform nodes
      const projectedNodes = nodes.map((node) => {
        // Rotate around Y
        let x1 = node.baseX * cosY - node.baseZ * sinY;
        let z1 = node.baseZ * cosY + node.baseX * sinY;

        // Rotate around X
        let y2 = node.baseY * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.baseY * sinX;

        // Add subtle breathing motion
        const pulse = Math.sin(time * 2 + node.baseX) * 4;
        const scale = 280 / (280 - (z2 + pulse));

        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          z: z2,
          scale,
          color: node.color,
          size: node.size * scale,
          label: node.label,
        };
      });

      // Sort by Z for realistic depth layering
      projectedNodes.sort((a, b) => a.z - b.z);

      // Draw connection lines between close nodes
      ctx.lineWidth = 0.6;
      for (let i = 0; i < projectedNodes.length; i++) {
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const n1 = projectedNodes[i];
          const n2 = projectedNodes[j];
          const dist = Math.hypot(n1.px - n2.px, n1.py - n2.py);

          if (dist < 85) {
            const alpha = (1 - dist / 85) * 0.35 * Math.max(0, (n1.z + 150) / 300);
            ctx.beginPath();
            ctx.moveTo(n1.px, n1.py);
            ctx.lineTo(n2.px, n2.py);
            const getRgba = (hex: string, a: number) => {
              if (hex.startsWith('#')) {
                const r = parseInt(hex.slice(1, 3), 16) || 0;
                const g = parseInt(hex.slice(3, 5), 16) || 0;
                const b = parseInt(hex.slice(5, 7), 16) || 0;
                return `rgba(${r}, ${g}, ${b}, ${a})`;
              }
              return hex;
            };

            const lineGrad = ctx.createLinearGradient(n1.px, n1.py, n2.px, n2.py);
            lineGrad.addColorStop(0, getRgba(n1.color, Math.max(0, Math.min(1, alpha))));
            lineGrad.addColorStop(1, 'rgba(0, 229, 255, 0.05)');
            ctx.strokeStyle = lineGrad;
            ctx.stroke();
          }
        }
      }

      // Draw moving data packets
      packets.forEach((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.fromIdx = Math.floor(Math.random() * NODE_COUNT);
          p.toIdx = Math.floor(Math.random() * NODE_COUNT);
        }

        const n1 = projectedNodes[p.fromIdx % projectedNodes.length];
        const n2 = projectedNodes[p.toIdx % projectedNodes.length];

        if (n1 && n2) {
          const curX = n1.px + (n2.px - n1.px) * p.progress;
          const curY = n1.py + (n2.py - n1.py) * p.progress;

          ctx.beginPath();
          ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw Central Glowing AI Nucleus Core
      ctx.save();
      const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 35);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.3, '#00E5FF');
      coreGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.4)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(cx, cy, 35, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.restore();

      // Draw nodes
      projectedNodes.forEach((node) => {
        const opacity = Math.min(1, Math.max(0.15, (node.z + SPHERE_RADIUS) / (SPHERE_RADIUS * 2)));

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.px, node.py, node.size, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = opacity;

        if (opacity > 0.6) {
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 10;
        }
        ctx.fill();

        // Node labels
        if (node.label && opacity > 0.7) {
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(node.label, node.px + 8, node.py + 3);
        }
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [interactive]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full max-w-[480px] aspect-square drop-shadow-[0_0_35px_rgba(0,229,255,0.25)] pointer-events-auto cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
