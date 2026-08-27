export function getMomentDateKey(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value ?? '').slice(0, 10) || 'unknown';
}

export function getMomentDayParts(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  const key = getMomentDateKey(value);
  if (Number.isNaN(parsed.getTime())) {
    return { key, dateLabel: key, weekdayLabel: '', machineDate: key };
  }
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const weekdayLabel = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsed.getDay()];
  return { key, dateLabel: `${month} / ${day}`, weekdayLabel, machineDate: key };
}

export function getMomentDaypart(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours();
  if (hour >= 5 && hour < 11) return { key: 'morning', label: '清晨', mark: '☼' };
  if (hour >= 11 && hour < 17) return { key: 'day', label: '白昼', mark: '·' };
  if (hour >= 17 && hour < 20) return { key: 'evening', label: '黄昏', mark: '◐' };
  return { key: 'night', label: '深夜', mark: '☾' };
}

export function classifyMomentLayout({ text = '', imageCount = 0, videoCount = 0 } = {}) {
  if (videoCount > 0) return 'video';
  if (imageCount >= 4) return 'gallery';
  if (imageCount === 3) return 'photo-three';
  if (imageCount === 2) return 'photo-two';
  if (imageCount === 1) return 'photo-one';

  const textLength = Array.from(String(text).trim()).length;
  if (textLength <= 32) return 'whisper';
  if (textLength <= 72) return 'compact';
  return 'text';
}
