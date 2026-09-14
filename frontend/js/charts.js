/* Minimal SVG and CSS charts: no chart library, no decoration. */
(function () {
  const esc = (v) => window.ui.esc(v);

  function sparkline(data, toneClass) {
    if (!data.length) return "";
    const max = Math.max.apply(null, data);
    const min = Math.min.apply(null, data);
    const span = max - min || 1;
    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((v - min) / span) * 100;
        return x.toFixed(2) + "," + y.toFixed(2);
      })
      .join(" ");

    return (
      '<span class="chart ' +
      (toneClass || "text-info") +
      '" style="display:block;height:100%">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart" aria-hidden="true">' +
      '<polygon points="0,100 ' +
      points +
      ' 100,100" fill="currentColor" opacity="0.16" />' +
      '<polyline points="' +
      points +
      '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />' +
      "</svg></span>"
    );
  }

  function bars(data, labels, highlightIndex) {
    const max = Math.max.apply(null, data.concat([1]));
    let html = '<div class="bars">';
    data.forEach((value, i) => {
      const height = Math.max(2, (value / max) * 100);
      const label = labels && labels[i] ? labels[i] : String(i);
      html +=
        '<div class="bar-col">' +
        '<div class="bar' +
        (i === highlightIndex ? " peak" : "") +
        '" style="height:' +
        height +
        '%" title="' +
        esc(label + ": " + value) +
        '"></div>' +
        (labels && i % 4 === 0 ? '<span class="bar-label">' + esc(label) + "</span>" : "") +
        "</div>";
    });
    return html + "</div>";
  }

  function donut(segments, centerValue, centerLabel) {
    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    let circles = "";

    segments.forEach((s) => {
      const length = (s.value / total) * circumference;
      circles +=
        '<circle cx="60" cy="60" r="' +
        radius +
        '" fill="none" stroke="currentColor" class="' +
        s.tone +
        '" stroke-width="12" stroke-dasharray="' +
        length +
        " " +
        (circumference - length) +
        '" stroke-dashoffset="' +
        -offset +
        '" />';
      offset += length;
    });

    let legend = '<ul class="donut-legend"><li class="label-xs">' + esc(centerLabel) + "</li>";
    segments.forEach((s) => {
      legend +=
        '<li><span class="swatch ' +
        s.tone +
        '"></span><span class="muted">' +
        esc(s.label) +
        '</span><span class="num" style="margin-left:auto">' +
        s.value +
        "</span></li>";
    });
    legend += "</ul>";

    return (
      '<div class="donut-wrap">' +
      '<svg width="140" height="140" viewBox="0 0 120 120" style="flex-shrink:0;transform:rotate(-90deg)">' +
      '<circle cx="60" cy="60" r="' +
      radius +
      '" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" />' +
      circles +
      '<text x="60" y="58" text-anchor="middle" fill="#f5f6f7" font-size="20" font-weight="700" transform="rotate(90 60 60)">' +
      esc(centerValue) +
      "</text>" +
      "</svg>" +
      legend +
      "</div>"
    );
  }

  const METER_COLOR = {
    accent: "var(--accent)",
    ok: "var(--ok)",
    warn: "var(--warn)",
    info: "var(--info)",
  };

  function meter(value, tone) {
    const clamped = Math.min(100, Math.max(0, value));
    return (
      '<div class="meter"><span style="width:' +
      clamped +
      "%;background:" +
      (METER_COLOR[tone] || METER_COLOR.accent) +
      '"></span></div>'
    );
  }

  window.charts = { sparkline, bars, donut, meter };
})();
