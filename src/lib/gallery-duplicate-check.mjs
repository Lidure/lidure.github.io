export function rankDuplicateMatches(matches) {
  return [...(Array.isArray(matches) ? matches : [])].sort((left, right) => (
    Number(Boolean(right?.exact)) - Number(Boolean(left?.exact))
    || (Number(right?.similarity) || 0) - (Number(left?.similarity) || 0)
    || String(left?.path || '').localeCompare(String(right?.path || ''))
  ));
}

export function duplicateDecision(matches) {
  const ranked = rankDuplicateMatches(matches);
  if (!ranked.length) return { kind: 'clear', matches: [] };
  if (ranked.some(match => match?.exact === true)) {
    return { kind: 'exact-block', matches: ranked.filter(match => match?.exact === true) };
  }
  return { kind: 'confirm-similar', matches: ranked };
}

function matchNumber(match) {
  if (Number.isFinite(Number(match?.number)) && Number(match.number) > 0) return Number(match.number);
  const filename = String(match?.path || '').split('/').pop() || '';
  const stem = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;
  return /^\d+$/.test(stem) ? Number(stem) : 0;
}

export function buildDuplicateComparison({ pending, matches, imageUrlForPath }) {
  return {
    pending: {
      name: pending?.name || pending?.file?.name || '待上传图片',
      imageUrl: pending?.previewUrl || '',
    },
    matches: rankDuplicateMatches(matches).map(match => {
      const number = matchNumber(match);
      const similarity = Number(match?.similarity);
      const meta = [
        number ? `#${number}` : '',
        Number.isFinite(similarity) ? `相似度 ${(similarity * 100).toFixed(1)}%` : '',
        match?.path || '',
      ].filter(Boolean).join(' · ');
      return {
        ...match,
        number,
        imageUrl: typeof imageUrlForPath === 'function' ? imageUrlForPath(match.path) : '',
        meta,
      };
    }),
  };
}
