import { useEffect, useRef } from "react";

const CHARS = "10$<>[]{}|\\/~-+=*&^%$#@!⌘⌥⌃⇧φψωλπμρστυζ".split("");
const FERN  = ["🌿", "🌿", "☘️", "🍀", "🍃", "🌱"];
const FONT_SIZE = 14;

export default function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width  = (canvas.width  = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let cols   = Math.floor(width / FONT_SIZE);
    let drops  = Array.from({ length: cols }, () => Math.random() * -100);

    function draw() {
      ctx!.fillStyle = "rgba(0,0,0,0.05)";
      ctx!.fillRect(0, 0, width, height);
      ctx!.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char =
          Math.random() > 0.95
            ? FERN[Math.floor(Math.random() * FERN.length)]
            : CHARS[Math.floor(Math.random() * CHARS.length)];

        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        if (Math.random() > 0.98) {
          ctx!.fillStyle  = "#f0fdf4";
          ctx!.shadowBlur  = 10;
          ctx!.shadowColor = "#22C55E";
        } else {
          ctx!.fillStyle  = "#22C55E";
          ctx!.shadowBlur  = 0;
        }

        ctx!.fillText(char, x, y);

        if (y > height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }

    const interval = setInterval(draw, 33);

    function onResize() {
      width  = canvas!.width  = window.innerWidth;
      height = canvas!.height = window.innerHeight;
      cols   = Math.floor(width / FONT_SIZE);
      drops  = Array.from({ length: cols }, () => Math.random() * -100);
    }

    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 opacity-40 pointer-events-none"
    />
  );
}
