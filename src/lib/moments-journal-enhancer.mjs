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

export function getTodayDateKey(now = new Date()) {
  return getMomentDateKey(now);
}

function formatChapterVisible(dateKey) {
  const [year = '----', month = '--', day = '--'] = dateKey.split('-');
  return `${year} / ${month} / ${day}`;
}

function formatChapterAccessible(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? dateKey : parsed.toLocaleDateString('zh-CN');
}

function formatMomentTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function datetimeForCard(card) {
  return card.querySelector('.card-date')?.getAttribute('datetime') || '';
}

function classifyMomentCard(card) {
  const mediaCount = card.querySelectorAll('.card-images img, .card-images video').length;
  card.classList.remove('is-text-only', 'is-single-media', 'is-multi-media');
  card.classList.add(
    mediaCount === 0 ? 'is-text-only' : mediaCount === 1 ? 'is-single-media' : 'is-multi-media',
  );
  card.dataset.mediaCount = String(mediaCount);

  card.querySelectorAll('.card-images').forEach((group) => {
    group.dataset.count = String(group.querySelectorAll('img, video').length);
  });

  const time = card.querySelector('.card-date');
  const datetime = time?.getAttribute('datetime') || '';
  const timeLabel = formatMomentTime(datetime);
  if (time && timeLabel) time.textContent = timeLabel;
}

function createDateChapter(dateKey) {
  const section = document.createElement('section');
  section.className = 'moment-date-chapter';
  section.dataset.date = dateKey;
  section.classList.toggle('is-today', dateKey === getTodayDateKey());

  const heading = document.createElement('header');
  heading.className = 'moment-date-heading';

  const time = document.createElement('time');
  time.dateTime = dateKey;
  time.textContent = formatChapterVisible(dateKey);
  time.setAttribute('aria-label', formatChapterAccessible(dateKey));

  const dot = document.createElement('span');
  dot.className = 'moment-today-dot';
  dot.setAttribute('aria-hidden', 'true');

  const stack = document.createElement('div');
  stack.className = 'moment-date-chapter-list';

  heading.append(time, dot);
  section.append(heading, stack);
  return { section, stack };
}

function createStat(label, id, className = '') {
  const badge = document.createElement('span');
  badge.className = `stat-badge ${className}`.trim();
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  strong.id = id;
  strong.textContent = '—';
  badge.append(small, strong);
  return badge;
}

function ensureJournalHeader(shell) {
  const hero = shell.querySelector('.moments-hero');
  if (!hero) return;
  hero.classList.add('moments-journal-header');

  let copy = hero.querySelector('.moments-journal-copy');
  if (!copy) {
    copy = document.createElement('div');
    copy.className = 'moments-journal-copy';
    const nodes = Array.from(hero.children).filter((node) => node.matches?.('.kicker, h1, p'));
    if (nodes.length > 0) {
      hero.insertBefore(copy, nodes[0]);
      nodes.forEach((node) => copy.appendChild(node));
    }
  }

  const kicker = copy?.querySelector('.kicker');
  if (kicker) kicker.textContent = 'Moments · Journal';
  const description = copy?.querySelector('p');
  if (description) description.textContent = '随手记下的碎片，游戏 · 音乐 · 生活 · 吐槽。';

  const stats = hero.querySelector('#hero-stats');
  if (stats && !stats.classList.contains('moments-journal-stats')) {
    stats.classList.add('moments-journal-stats');
    stats.replaceChildren(
      createStat('全部', 'stat-total'),
      createStat('本月', 'stat-month'),
      createStat('最近更新', 'stat-latest', 'stat-latest'),
    );
  }
}

function ensureFilmStrip(shell) {
  const controls = shell.querySelector('.controls-bar');
  if (!controls) return null;
  controls.classList.add('moments-film-strip');

  const pills = controls.querySelector('.cat-pills');
  if (pills) {
    pills.setAttribute('role', 'group');
    pills.setAttribute('aria-label', '筛选碎碎念分类');
  }

  controls.querySelectorAll('.pill[data-category]').forEach((button) => {
    const category = button.dataset.category || 'all';
    if (category === 'all' || button.querySelector('.moments-category-label')) return;
    const icon = document.createElement('span');
    icon.className = 'moments-category-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = button.textContent?.trim() || '';
    const label = document.createElement('span');
    label.className = 'moments-category-label';
    label.textContent = category;
    button.replaceChildren(icon, label);
  });

  const publish = controls.querySelector('#publish-toggle');
  if (publish && !publish.querySelector('.moments-publish-label')) {
    const label = document.createElement('span');
    label.className = 'moments-publish-label';
    label.textContent = '写一条';
    publish.appendChild(label);
  }

  return controls;
}

function updateJournalStats(listRoot) {
  const cards = Array.from(listRoot.querySelectorAll('.moment-card'));
  const now = new Date();
  let monthCount = 0;

  cards.forEach((card) => {
    const value = datetimeForCard(card);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === now.getFullYear()
      && parsed.getMonth() === now.getMonth()) {
      monthCount += 1;
    }
  });

  const totalEl = document.getElementById('stat-total');
  const monthEl = document.getElementById('stat-month');
  const latestEl = document.getElementById('stat-latest');
  const latestValue = cards[0] ? datetimeForCard(cards[0]) : '';
  const latestDate = latestValue ? new Date(latestValue) : null;

  if (totalEl) totalEl.textContent = String(cards.length);
  if (monthEl) monthEl.textContent = String(monthCount);
  if (latestEl) {
    latestEl.textContent = latestDate && !Number.isNaN(latestDate.getTime())
      ? latestDate.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : '—';
  }
}

function syncChapterVisibility(listRoot) {
  listRoot.querySelectorAll('.moment-date-chapter').forEach((chapter) => {
    const cards = Array.from(chapter.querySelectorAll('.moment-card'));
    chapter.hidden = cards.length > 0 && cards.every((card) => card.classList.contains('hidden'));
  });
}

function regroupIfNeeded(listRoot) {
  const cards = Array.from(listRoot.querySelectorAll('.moment-card'));
  if (cards.length === 0) return false;

  cards.forEach(classifyMomentCard);

  const hasDirectCard = Array.from(listRoot.children).some((child) => child.matches('.moment-card'));
  const hasChapter = Boolean(listRoot.querySelector(':scope > .moment-date-chapter'));
  if (!hasDirectCard && hasChapter) {
    syncChapterVisibility(listRoot);
    updateJournalStats(listRoot);
    return false;
  }

  const fragment = document.createDocumentFragment();
  let currentDateKey = '';
  let currentStack = null;

  cards.forEach((card) => {
    const dateKey = getMomentDateKey(datetimeForCard(card));
    if (dateKey !== currentDateKey || !currentStack) {
      currentDateKey = dateKey;
      const chapter = createDateChapter(dateKey);
      currentStack = chapter.stack;
      fragment.appendChild(chapter.section);
    }
    currentStack.appendChild(card);
  });

  listRoot.replaceChildren(fragment);
  syncChapterVisibility(listRoot);
  updateJournalStats(listRoot);
  return true;
}

export function installMomentsJournalEnhancer(listRoot, signal) {
  const shell = listRoot.closest('.moments-shell');
  if (!shell) return () => {};

  let queued = false;
  let disposed = false;

  const sync = () => {
    if (disposed) return;
    ensureJournalHeader(shell);
    ensureFilmStrip(shell);
    regroupIfNeeded(listRoot);
    syncChapterVisibility(listRoot);
    updateJournalStats(listRoot);
  };

  const queueSync = () => {
    if (queued || disposed) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList' && record.target === listRoot)) queueSync();
  });
  observer.observe(listRoot, { childList: true });

  const controls = ensureFilmStrip(shell);
  controls?.addEventListener('click', (event) => {
    const button = event.target.closest?.('.pill[data-category]');
    if (!button) return;
    requestAnimationFrame(() => syncChapterVisibility(listRoot));
  }, { signal });

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
  };

  signal?.addEventListener('abort', cleanup, { once: true });
  sync();
  return cleanup;
}
