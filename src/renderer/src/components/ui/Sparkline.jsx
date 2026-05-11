export function Sparkline({ values, width = 64, height = 20, stroke }) {
  if (!values || values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const step = width / (values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  });
  return (
    <svg className="spark" width={width} height={height} style={stroke ? { color: stroke } : null}>
      <path d={d} />
    </svg>
  );
}
