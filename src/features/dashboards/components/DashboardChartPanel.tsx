import type { DashboardChartType, DashboardRow, DashboardSeries } from '../types';
import { chartPalette, formatCurrencyBRL, formatNumberBR } from '../utils/dashboardUtils';

type DashboardChartProps = {
  chartType: DashboardChartType;
  rows: DashboardRow[];
  series: DashboardSeries[];
  xKey?: string;
};

const valueFormatter = (value: number, format?: 'currency' | 'number' | 'text') => {
  if (format === 'currency') return formatCurrencyBRL(Number(value || 0));
  if (format === 'number') return formatNumberBR(Number(value || 0));
  return String(value ?? '');
};

const getPrimaryValue = (row: DashboardRow, key: string) => Number(row[key] ?? 0);

const formatTooltipText = (value: number, seriesItem: DashboardSeries) => {
  return `${seriesItem.label}: ${valueFormatter(value, seriesItem.format)}`;
};

function Bars({ rows, series, horizontal = false }: { rows: DashboardRow[]; series: DashboardSeries[]; horizontal?: boolean }) {
  const primary = series[0];
  const max = Math.max(1, ...rows.map((row) => Math.abs(getPrimaryValue(row, primary.key))));

  return (
    <div className={`dashboard-native-bars ${horizontal ? 'is-horizontal' : ''}`}>
      {rows.map((row) => {
        const value = getPrimaryValue(row, primary.key);
        const sizePercent = Math.max(2, (Math.abs(value) / max) * 100);

        return (
          <div key={row.key} className="dashboard-native-row" title={formatTooltipText(value, primary)}>
            <div className="dashboard-native-row-label">{row.label}</div>
            <div className="dashboard-native-track">
              <div
                className="dashboard-native-fill"
                style={horizontal ? { width: `${sizePercent}%`, backgroundColor: primary.color } : { height: `${sizePercent}%`, backgroundColor: primary.color }}
              />
            </div>
            <div className="dashboard-native-row-value">{valueFormatter(value, primary.format)}</div>
          </div>
        );
      })}
    </div>
  );
}

function SimplePie({ rows, series, donut = false }: { rows: DashboardRow[]; series: DashboardSeries[]; donut?: boolean }) {
  const primary = series[0];
  const total = Math.max(1, rows.reduce((acc, row) => acc + Math.max(0, getPrimaryValue(row, primary.key)), 0));
  let offset = 0;

  const circleRadius = 44;
  const circleLength = 2 * Math.PI * circleRadius;

  return (
    <div className="dashboard-native-pie-wrap">
      <svg viewBox="0 0 120 120" className="dashboard-native-pie" aria-label="Gráfico de pizza">
        {rows.map((row, index) => {
          const value = Math.max(0, getPrimaryValue(row, primary.key));
          const slice = (value / total) * circleLength;
          const dashArray = `${slice} ${circleLength - slice}`;
          const dashOffset = -offset;
          offset += slice;

          return (
            <circle
              key={row.key}
              cx="60"
              cy="60"
              r={circleRadius}
              fill="none"
              stroke={chartPalette[index % chartPalette.length]}
              strokeWidth={donut ? 18 : 32}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>

      <div className="dashboard-native-legend">
        {rows.map((row, index) => {
          const value = getPrimaryValue(row, primary.key);
          return (
            <div key={row.key} className="dashboard-native-legend-item" title={formatTooltipText(value, primary)}>
              <span style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
              <strong>{row.label}</strong>
              <small>{valueFormatter(value, primary.format)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SvgLineLike({ rows, series, area = false }: { rows: DashboardRow[]; series: DashboardSeries[]; area?: boolean }) {
  const primary = series[0];
  const values = rows.map((row) => getPrimaryValue(row, primary.key));
  const max = Math.max(1, ...values);
  const width = 900;
  const height = 320;
  const padX = 30;
  const padY = 20;

  const stepX = rows.length > 1 ? (width - padX * 2) / (rows.length - 1) : 0;

  const points = rows
    .map((row, index) => {
      const value = getPrimaryValue(row, primary.key);
      const x = padX + index * stepX;
      const y = height - padY - (Math.max(0, value) / max) * (height - padY * 2);
      return { x, y, value, label: row.label, key: row.key };
    })
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = `${padX},${height - padY} ${linePoints} ${padX + (points.length - 1) * stepX},${height - padY}`;

  return (
    <div className="dashboard-native-svg-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="dashboard-native-svg">
        <polyline fill="none" stroke={primary.color} strokeWidth="3" points={linePoints} />
        {area ? <polygon fill={primary.color} fillOpacity="0.18" points={areaPoints} /> : null}
        {points.map((point) => (
          <circle key={point.key} cx={point.x} cy={point.y} r="4" fill={primary.color}>
            <title>{`${point.label}: ${valueFormatter(point.value, primary.format)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="dashboard-native-xlabels">
        {rows.map((row) => (
          <span key={row.key}>{row.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DashboardChart({ chartType, rows, series, xKey = 'label' }: DashboardChartProps) {
  if (!rows.length || !series.length) {
    return <p className="module-empty">Sem dados para renderizar o gráfico.</p>;
  }

  if (chartType === 'cards') {
    const firstSeries = series[0];
    return (
      <div className="dashboard-mini-cards-grid">
        {rows.map((row) => (
          <article key={row.key} className="dashboard-mini-card">
            <span>{String(row[xKey] ?? row.label)}</span>
            <strong>{valueFormatter(Number(row[firstSeries.key] ?? 0), firstSeries.format)}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (chartType === 'table') {
    return <p className="module-empty">Use a grade resumo abaixo para analisar este formato tabular.</p>;
  }

  if (chartType === 'pie') {
    return <SimplePie rows={rows} series={series} />;
  }

  if (chartType === 'donut') {
    return <SimplePie rows={rows} series={series} donut />;
  }

  if (chartType === 'line') {
    return <SvgLineLike rows={rows} series={series} />;
  }

  if (chartType === 'area') {
    return <SvgLineLike rows={rows} series={series} area />;
  }

  if (chartType === 'bar-horizontal') {
    return <Bars rows={rows} series={series} horizontal />;
  }

  return <Bars rows={rows} series={series} />;
}
