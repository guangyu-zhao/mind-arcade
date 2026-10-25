import { Text } from '../../i18n/runtime.js';
import { text } from '../../i18n/cloud.js';
import { element, svg } from '../dom.js';
import { labeled } from './elements.js';
export function createCharts(metric) {
  const chartInspectors = new WeakMap();
  const metricLabel = () => Text.t(metric.label) + (metric.unit ? ' (' + metric.unit + ')' : '');
  const formatCount = (value) => value.toLocaleString(Text.locale);
  function format(value, unit = true, decimals = 0) {
    if (!Number.isFinite(value)) return '—';
    const m = metric || { decimals: 0, unit: '' };
    return (
      value.toLocaleString(Text.locale, {
        maximumFractionDigits: Math.max(decimals, m.decimals),
        minimumFractionDigits: m.decimals,
      }) + (unit && m.unit ? ` ${m.unit}` : '')
    );
  }
  function chartLabels(chart, vertical, horizontal, points, sample, { marker, nearest } = {}) {
    const figure = element('figure', 'cloud-figure');
    figure.append(
      element('div', 'cloud-axis-label', vertical),
      chart,
      element('figcaption', 'cloud-axis-label cloud-axis-bottom', horizontal),
      element('p', 'cloud-sample-size', sample),
    );
    const detail = element('output', 'cloud-chart-detail');
    detail.hidden = true;
    figure.append(detail);
    const label = chart.getAttribute('aria-label');
    let selected = -1;
    chart.setAttribute('tabindex', '0');
    chart.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End Escape');
    function hide() {
      if (selected >= 0) points[selected].node?.classList.remove('is-inspected');
      marker?.setAttribute('hidden', '');
      selected = -1;
      detail.hidden = true;
      chart.setAttribute('aria-label', label);
      delete chart.dataset.point;
    }
    function show(index) {
      if (selected === index) return;
      if (selected >= 0) points[selected].node?.classList.remove('is-inspected');
      selected = index;
      chart.dataset.point = String(index);
      const point = points[index];
      point.node?.classList.add('is-inspected');
      if (marker) {
        marker.setAttribute('cx', point.x);
        marker.setAttribute('cy', point.y);
        marker.removeAttribute('hidden');
      }
      const description = typeof point.detail === 'function' ? point.detail() : point.detail;
      detail.textContent = description;
      detail.hidden = false;
      chart.setAttribute('aria-label', `${label}: ${description}`);
      const rect = chart.getBoundingClientRect(),
        parent = figure.getBoundingClientRect();
      const x = (point.x / chart.viewBox.baseVal.width) * rect.width + rect.left - parent.left;
      detail.style.left = `${Math.max(0, Math.min(x - detail.offsetWidth / 2, figure.clientWidth - detail.offsetWidth))}px`;
      detail.style.top = `${rect.top - parent.top + 8}px`;
    }
    function inspect(event) {
      const rect = chart.getBoundingClientRect(),
        view = chart.viewBox.baseVal;
      const x = ((event.clientX - rect.left) / rect.width) * view.width,
        y = ((event.clientY - rect.top) / rect.height) * view.height;
      if (nearest) {
        show(nearest(x));
        return;
      }
      let best = 0,
        distance = Infinity;
      points.forEach((point, index) => {
        const next = (point.x - x) ** 2 + (point.y === undefined ? 0 : (point.y - y) ** 2);
        if (next < distance) {
          distance = next;
          best = index;
        }
      });
      show(best);
    }
    chart.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'touch') inspect(event);
    });
    chart.addEventListener('pointerleave', () => {
      if (document.activeElement !== chart) hide();
    });
    chart.addEventListener('click', (event) => {
      chart.focus({ preventScroll: true });
      inspect(event);
    });
    chart.addEventListener('focus', () => show(selected < 0 ? points.length - 1 : selected));
    chart.addEventListener('blur', hide);
    chart.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Enter', ' '];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        hide();
        return;
      }
      const index = selected < 0 ? points.length - 1 : selected;
      show(
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? points.length - 1
            : Math.max(
                0,
                Math.min(
                  points.length - 1,
                  index + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0),
                ),
              ),
      );
    });
    chartInspectors.set(chart, (index) => show(Math.max(0, Math.min(points.length - 1, index))));
    return figure;
  }
  function chartFrame(container, label) {
    const width = Math.max(180, Math.round(container.clientWidth) || 500),
      height = 250;
    const chart = svg('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: 'cloud-chart',
      role: 'img',
      'aria-label': label,
    });
    return { chart, width, height, left: 58, right: width - 18, top: 30, bottom: 220 };
  }
  function histogram(
    bins,
    container,
    label,
    { count = 'runs', horizontal = metricLabel(), decimals = 1 } = {},
  ) {
    if (!bins?.length) return labeled('p', 'noScores', 'cloud-empty');
    const { chart, left, right, top, bottom } = chartFrame(container, label);
    const max = Math.max(...bins.map((b) => b.count), 1),
      width = (right - left) / bins.length;
    for (const tick of [...new Set([0, Math.ceil(max / 2), max])]) {
      const y = bottom - (tick / max) * (bottom - top);
      chart.append(
        svg('line', { x1: left, x2: right, y1: y, y2: y, class: 'grid' }),
        svg('text', { x: left - 9, y: y + 5, 'text-anchor': 'end' }, tick),
      );
    }
    const points = bins.map((b, i) => {
      const height = (b.count / max) * (bottom - top),
        bar = svg('rect', {
          x: left + i * width + 2,
          y: bottom - height,
          width: Math.max(1, width - 4),
          height,
          rx: 3,
          class: 'bar',
        });
      chart.append(bar);
      return {
        node: bar,
        x: left + (i + 0.5) * width,
        detail: `${format(b.low, false, decimals)}–${format(b.high, true, decimals)} · ${text(count)}: ${formatCount(b.count)}`,
      };
    });
    chart.append(
      svg('text', { x: left, y: 243 }, format(bins[0].low, false, decimals)),
      svg(
        'text',
        { x: right, y: 243, 'text-anchor': 'end' },
        format(bins.at(-1).high, false, decimals),
      ),
    );
    return chartLabels(
      chart,
      text(count),
      horizontal,
      points,
      Text.t(count === 'players' ? 'cloud.sample-players' : 'cloud.sample-runs', {
        n: formatCount(bins.reduce((sum, bin) => sum + bin.count, 0)),
      }),
    );
  }
  function trend(rows, container) {
    if (!rows.length) return labeled('p', 'noScores', 'cloud-empty');
    const { chart, width, left, right, top, bottom } = chartFrame(container, text('trend'));
    let min = Infinity,
      max = -Infinity;
    for (const row of rows) {
      min = Math.min(min, row.value);
      max = Math.max(max, row.value);
    }
    const span = Math.max(max - min, 1),
      first = Date.parse(rows[0].ended_at),
      last = Date.parse(rows.at(-1).ended_at);
    const x = (t) =>
      first === last ? (left + right) / 2 : left + ((t - first) / (last - first)) * (right - left);
    const y = (v) => bottom - ((v - min) / span) * (bottom - top);
    for (let i = 0; i <= 2; i++) {
      const v = min + (span * i) / 2;
      chart.append(
        svg('line', { x1: left, x2: right, y1: y(v), y2: y(v), class: 'grid' }),
        svg('text', { x: left - 9, y: y(v) + 5, 'text-anchor': 'end' }, format(v, false, 1)),
      );
    }
    const locale = Text.locale;
    const points = rows.map((row) => ({
      x: x(Date.parse(row.ended_at)),
      y: y(row.value),
      detail: () => `${new Date(row.ended_at).toLocaleString(locale)} · ${format(row.value)}`,
    }));
    const buckets = new Map();
    points.forEach((point, index) => {
      const column = Math.floor(point.x - left),
        bucket = buckets.get(column);
      if (!bucket) buckets.set(column, { first: index, last: index, min: index, max: index });
      else {
        bucket.last = index;
        if (point.y < points[bucket.min].y) bucket.min = index;
        if (point.y > points[bucket.max].y) bucket.max = index;
      }
    });
    // Preserve each screen column's endpoints and extrema; inspection still uses every record.
    const plotted = [...buckets.values()].flatMap((bucket) =>
      [...new Set(Object.values(bucket))].sort((a, b) => a - b).map((index) => points[index]),
    );
    chart.append(
      svg('polyline', {
        points: plotted.map((point) => `${point.x},${point.y}`).join(' '),
        class: 'trend',
      }),
    );
    if (points.length <= 200)
      for (const point of points)
        chart.append(svg('circle', { cx: point.x, cy: point.y, r: 3.5, class: 'point' }));
    const marker = svg('circle', { r: 4.5, class: 'point is-inspected', hidden: '' });
    chart.append(marker);
    function nearest(position) {
      let low = 0,
        high = points.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (points[middle].x < position) low = middle + 1;
        else high = middle;
      }
      return low > 0 && position - points[low - 1].x < points[low].x - position ? low - 1 : low;
    }
    const sameDay = new Date(first).toDateString() === new Date(last).toDateString();
    const date = (t) =>
      new Date(t).toLocaleString(
        locale,
        sameDay
          ? { hour: '2-digit', minute: '2-digit', ...(width < 340 ? {} : { second: '2-digit' }) }
          : width < 420
            ? { month: 'short', day: 'numeric' }
            : { year: 'numeric', month: 'numeric', day: 'numeric' },
      );
    if (first === last)
      chart.append(svg('text', { x: x(first), y: 243, 'text-anchor': 'middle' }, date(first)));
    else
      chart.append(
        svg('text', { x: left, y: 243 }, date(first)),
        svg('text', { x: right, y: 243, 'text-anchor': 'end' }, date(last)),
      );
    return chartLabels(
      chart,
      metricLabel(),
      text('time'),
      points,
      Text.t('cloud.sample-runs', { n: formatCount(rows.length) }),
      { marker, nearest },
    );
  }
  return {
    histogram,
    trend,
    restore(chart, index) {
      chartInspectors.get(chart)?.(index);
    },
  };
}
