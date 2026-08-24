import { useEffect, useRef } from "react";
import "../css/particle-text.css";

const hexToRgb = (hex) => {
  const value = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
};
const mixRgb = (a, b, n) => ({ r: Math.round(a.r + (b.r - a.r) * n), g: Math.round(a.g + (b.g - a.g) * n), b: Math.round(a.b + (b.b - a.b) * n) });
const cssRgb = (rgb) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const easeOut = (n) => 1 - Math.pow(1 - n, 3);

export default function ParticleText({
  text = "React Bits", particleSize = 2, density = 4,
  color = "#0071e3", highlightColor = "#ff00f7", scatter = 180,
  gatherDuration = 1600, stagger = 420, pointerRepel = 40,
  repelRadius = 120, idleDrift = 0.7, trigger = "mount",
  fontSize = "clamp(3rem, 12vw, 8rem)", fontWeight = 800,
  fontFamily = "inherit", glow = true, className = "", style,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let particles = [];
    let frame = null;
    let resizeFrame = null;
    let width = 0;
    let height = 0;
    let gathering = false;
    let gatherStart = 0;
    let buildId = 0;
    let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const from = hexToRgb(color);
    const to = hexToRgb(highlightColor);
    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    const gather = (fromScatter = true) => {
      if (!particles.length) return;
      gatherStart = performance.now();
      particles.forEach((p) => {
        if (fromScatter) {
          const angle = p.seed * Math.PI * 2;
          const distance = scatter * (0.35 + p.depth * 0.75);
          p.x = p.targetX + Math.cos(angle) * distance + (p.depth - 0.5) * scatter * 0.55;
          p.y = p.targetY + Math.sin(angle) * distance + (p.seed - 0.5) * scatter * 0.55;
        }
        p.startX = p.x;
        p.startY = p.y;
        p.delay = reducedMotion ? 0 : p.seed * stagger;
      });
      gathering = true;
    };

    const sample = async () => {
      const current = ++buildId;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const computed = getComputedStyle(container);
      const family = fontFamily === "inherit" ? computed.fontFamily : fontFamily;
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;font:${fontWeight} ${fontSize} ${family}`;
      probe.textContent = "M";
      container.appendChild(probe);
      const size = parseFloat(getComputedStyle(probe).fontSize) || 72;
      probe.remove();

      const source = document.createElement("canvas");
      const sourceCtx = source.getContext("2d", { willReadFrequently: true });
      const font = `${fontWeight} ${size}px ${family}`;
      sourceCtx.font = font;
      const metrics = sourceCtx.measureText(String(text || " "));
      const padding = Math.max(12, size * 0.08);
      source.width = Math.ceil(metrics.width + padding * 2);
      source.height = Math.ceil(size * 1.25 + padding * 2);
      sourceCtx.font = font;
      sourceCtx.textAlign = "center";
      sourceCtx.textBaseline = "middle";
      sourceCtx.fillStyle = "white";
      sourceCtx.fillText(String(text || " "), source.width / 2, source.height / 2);
      const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
      const step = Math.max(2, Math.floor(density));
      const targets = [];
      for (let y = 0; y < source.height; y += step) {
        for (let x = 0; x < source.width; x += step) {
          const alpha = pixels[(y * source.width + x) * 4 + 3];
          if (alpha > 40) targets.push({ x: width / 2 - source.width / 2 + x, y: height / 2 - source.height / 2 + y, alpha: alpha / 255 });
        }
      }
      const max = Math.max(900, Math.min(5200, Math.floor(width * height / 90)));
      const stride = Math.max(1, Math.ceil(targets.length / max));
      particles = targets.filter((_, i) => i % stride === 0).map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = from && to ? clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
        const angle = seed * Math.PI * 2;
        const distance = (reducedMotion ? 0 : scatter) * (0.35 + depth * 0.75);
        const startX = target.x + Math.cos(angle) * distance + (seed - 0.5) * scatter * 0.45;
        const startY = target.y + Math.sin(angle) * distance + (depth - 0.9) * scatter * 0.45;
        return { x: reducedMotion ? target.x : startX, y: reducedMotion ? target.y : startY, startX, startY, targetX: target.x, targetY: target.y, seed, depth, alpha: target.alpha, color: from && to ? cssRgb(mixRgb(from, to, blend)) : color, size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)), delay: seed * stagger };
      });
      pointer.x = width / 2; pointer.y = height / 2; pointer.smoothX = pointer.x; pointer.smoothY = pointer.y;
      if (reducedMotion) { particles.forEach((p) => { p.x = p.targetX; p.y = p.targetY; }); gathering = false; } else gather(false);
      if (current !== buildId) return;
    };

    const render = (now) => {
      ctx.clearRect(0, 0, width, height);
      ctx.shadowBlur = glow && !reducedMotion ? particleSize * 3 : 0;
      ctx.shadowColor = highlightColor;
      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;
      let complete = true;
      particles.forEach((p) => {
        let baseX = p.targetX; let baseY = p.targetY; let progress = 1;
        if (gathering) {
          progress = clamp((now - gatherStart - p.delay) / Math.max(1, reducedMotion ? 1 : gatherDuration), 0, 1);
          const eased = easeOut(progress);
          baseX = p.startX + (p.targetX - p.startX) * eased;
          baseY = p.startY + (p.targetY - p.startY) * eased;
          if (progress < 1) complete = false;
        } else if (!reducedMotion && idleDrift > 0) {
          baseX += Math.sin(now * 0.0009 + p.seed * 10) * idleDrift * p.depth;
          baseY += Math.cos(now * 0.00075 + p.depth * 10) * idleDrift * p.depth;
        }
        if (pointer.active && !reducedMotion && pointerRepel > 0) {
          const dx = baseX - pointer.smoothX; const dy = baseY - pointer.smoothY; const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < repelRadius) { const force = Math.pow(1 - distance / repelRadius, 2) * pointerRepel; baseX += dx / distance * force; baseY += dy / distance * force; }
        }
        const follow = reducedMotion ? 1 : 0.22;
        p.x += (baseX - p.x) * follow; p.y += (baseY - p.y) * follow;
        ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1); ctx.fillStyle = p.color;
        if (p.size <= 2.1) ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (gathering && complete) gathering = false;
      frame = requestAnimationFrame(render);
    };

    const move = (event) => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = true; };
    const leave = () => { pointer.active = false; };
    const enter = (event) => { move(event); if (trigger === "hover") gather(true); };
    const click = () => { if (trigger === "click") gather(true); };
    const queue = () => { if (resizeFrame) cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(sample); };
    const observer = new ResizeObserver(queue);
    observer.observe(container);
    canvas.addEventListener("pointerenter", enter); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerleave", leave); canvas.addEventListener("click", click);
    sample(); frame = requestAnimationFrame(render);
    return () => { buildId += 1; observer.disconnect(); canvas.removeEventListener("pointerenter", enter); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave); canvas.removeEventListener("click", click); if (frame) cancelAnimationFrame(frame); if (resizeFrame) cancelAnimationFrame(resizeFrame); };
  }, [text, particleSize, density, color, highlightColor, scatter, gatherDuration, stagger, pointerRepel, repelRadius, idleDrift, trigger, fontSize, fontWeight, fontFamily, glow]);

  return <div ref={containerRef} className={`particle-text ${className}`} style={style} aria-label={text}><canvas ref={canvasRef} className="particle-text__canvas" aria-hidden="true" /><span className="particle-text__sr">{text}</span></div>;
}
