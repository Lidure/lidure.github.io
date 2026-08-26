export function estimateReadingMinutes(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ');

  const hanCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWordCount = (text.match(/[A-Za-z0-9]+(?:['’_-][A-Za-z0-9]+)*/g) ?? []).length;
  const weightedUnits = hanCount + latinWordCount * 1.7;

  return Math.max(1, Math.ceil(weightedUnits / 450));
}
