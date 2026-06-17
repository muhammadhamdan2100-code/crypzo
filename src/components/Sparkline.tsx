export function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data?.length) return <div className="h-8 w-20" />;
  const w = 80, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(h - ((v - min) / span) * h).toFixed(2)}`)
    .join(" ");
  const color = up ? "var(--success)" : "var(--destructive)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spk-${up}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spk-${up})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
