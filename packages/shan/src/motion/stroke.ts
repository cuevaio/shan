export type StrokePoint = {
  x: number;
  y: number;
  t: number;
};

export function strokePolyline(points: StrokePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function strokeSpan(points: StrokePoint[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    width: points.length === 0 ? 0 : maxX - minX,
    height: points.length === 0 ? 0 : maxY - minY,
  };
}

export function strokeVector(points: StrokePoint[]) {
  if (points.length < 2) return { dx: 0, dy: 0 };
  const first = points[0];
  const last = points[points.length - 1];
  return { dx: last.x - first.x, dy: last.y - first.y };
}

export function strokeIsUsable(points: StrokePoint[]) {
  if (points.length < 2) return false;
  const duration = points[points.length - 1].t - points[0].t;
  const span = strokeSpan(points);
  return duration >= 120 && (span.width > 0.03 || span.height > 0.03 || duration >= 400);
}

function isPause(from: StrokePoint, to: StrokePoint) {
  return to.t - from.t >= 160 && Math.hypot(to.x - from.x, to.y - from.y) < 0.03;
}

function simplify(points: StrokePoint[]) {
  if (points.length < 3) return points.slice();
  const kept: StrokePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = kept[kept.length - 1];
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= 0.012 || point.t - previous.t >= 160) kept.push(point);
  }

  kept.push(points[points.length - 1]);
  return kept;
}

export function cleanStroke(points: StrokePoint[]) {
  const simplified = simplify(points);
  if (simplified.length < 3) return simplified;

  return simplified.map((point, index) => {
    const previous = simplified[Math.max(0, index - 1)];
    const next = simplified[Math.min(simplified.length - 1, index + 1)];
    if (isPause(previous, point) || isPause(point, next)) return point;

    return {
      x: (previous.x + point.x + next.x) / 3,
      y: (previous.y + point.y + next.y) / 3,
      t: point.t,
    };
  });
}

function roundPoint(point: StrokePoint): StrokePoint {
  return {
    x: Math.round(point.x * 1000) / 1000,
    y: Math.round(point.y * 1000) / 1000,
    t: Math.round(point.t),
  };
}

export function sampleForModel(points: StrokePoint[], max = 64): StrokePoint[] {
  if (points.length === 0) return [];
  const kept = simplify(points);
  if (kept.length <= max) return kept.map(roundPoint);

  const chosen = new Set<number>([0, kept.length - 1]);
  for (let index = 1; index < kept.length; index += 1) {
    if (isPause(kept[index - 1], kept[index])) {
      chosen.add(index - 1);
      chosen.add(index);
    }
  }

  const candidates = kept.map((_, index) => index).filter((index) => !chosen.has(index));
  const room = Math.max(0, max - chosen.size);
  if (room > 0 && candidates.length > 0) {
    const step = Math.max(1, Math.floor(candidates.length / room));
    for (let index = 0; index < candidates.length && chosen.size < max; index += step) {
      chosen.add(candidates[index]);
    }
  }

  let indexes = [...chosen].sort((left, right) => left - right);
  if (indexes.length > max) {
    const middle = indexes.filter((index) => index !== 0 && index !== kept.length - 1);
    indexes = [0, ...middle.slice(0, max - 2), kept.length - 1];
  }

  return indexes.map((index) => roundPoint(kept[index]));
}
