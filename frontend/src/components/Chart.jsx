// One renderer for every chart in the workspace.
//
// Mark sizes, gridlines, gaps and label rules are fixed here rather than set per
// chart, so a chart you build by hand matches the ones on the topic pages.
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ALL_PAIRS_LIMIT, BRAND, CHART_INK, SERIES, seriesColor, wash } from '../lib/palette.js';
import { axisFormatter, compact, full, titleLabel, truncate, unitSuffix } from '../lib/format.js';

const AXIS_TICK = { fill: CHART_INK.tick, fontSize: 11.5 };
const AXIS_LINE = { stroke: CHART_INK.axis };
const GRID = { stroke: CHART_INK.grid, strokeDasharray: '0' };
const BAR_SIZE = 26;

function Tip({ active, payload, label, unit = '', nameMap }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && label !== '' && <p className="chart-tip-label">{label}</p>}
      {payload.map((entry) => (
        <p className="chart-tip-row" key={entry.dataKey ?? entry.name}>
          <span className="chart-tip-dot" style={{ background: entry.color || entry.payload?.fill || BRAND }} />
          <span className="chart-tip-name">{nameMap?.[entry.dataKey] ?? titleLabel(entry.name ?? entry.dataKey)}</span>
          <b>
            {full(entry.value)}
            {unit}
          </b>
        </p>
      ))}
    </div>
  );
}

function Legend({ keys }) {
  if (!keys || keys.length < 2) return null;
  return (
    <ul className="chart-legend">
      {keys.map((key, index) => (
        <li key={key}>
          <span className="chart-legend-dot" style={{ background: seriesColor(index) }} />
          {titleLabel(key)}
        </li>
      ))}
    </ul>
  );
}

// Only the extremes carry a number; the axis and the tooltip carry the rest.
function extremeLabel({ x, y, width, height, value, index, extremes, unit, horizontal }) {
  if (!extremes.has(index)) return null;
  const text = `${compact(value)}${unit}`;
  if (horizontal) {
    return (
      <text x={x + width + 8} y={y + height / 2 + 4} fill={CHART_INK.label} fontSize={11.5} fontWeight={600}>
        {text}
      </text>
    );
  }
  return (
    <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={CHART_INK.label} fontSize={11.5} fontWeight={600}>
      {text}
    </text>
  );
}

// The biggest number an axis must show, so every tick can share one unit.
function axisPeak(data, keys = ['value'], stacked = false) {
  if (!data?.length) return 0;
  if (stacked) {
    return Math.max(...data.map((row) => keys.reduce((sum, key) => sum + Math.abs(Number(row[key]) || 0), 0)));
  }
  return Math.max(...data.flatMap((row) => keys.map((key) => Math.abs(Number(row[key]) || 0))), 0);
}

function extremeIndexes(data, key = 'value') {
  if (!data?.length) return new Set();
  let maxIndex = 0;
  let minIndex = 0;
  data.forEach((row, index) => {
    if (row[key] > data[maxIndex][key]) maxIndex = index;
    if (row[key] < data[minIndex][key]) minIndex = index;
  });
  return new Set(data.length > 1 ? [maxIndex, minIndex] : [maxIndex]);
}

export default function Chart({ shape, data, keys = ['value'], spec = {}, height }) {
  if (!data?.length) {
    return <div className="chart-empty">No values to draw with the columns and filters selected.</div>;
  }

  const unit = unitSuffix(spec.y || spec.measures?.[0] || '');
  const nameMap = Object.fromEntries((keys || []).map((key) => [key, titleLabel(key)]));
  const tickFormat = axisFormatter(axisPeak(data, keys, shape === 'stacked'));

  /* Horizontal ranked bars — the default for comparing places. */
  if (shape === 'hbar') {
    const extremes = extremeIndexes(data);
    const plotHeight = height || Math.max(230, data.length * 31 + 48);
    return (
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={plotHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 58, bottom: 22, left: 4 }}>
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={tickFormat}>
              <Label value={titleLabel(spec.y)} position="insideBottom" offset={-14} fill={CHART_INK.tick} fontSize={11} />
            </XAxis>
            <YAxis
              type="category"
              dataKey="name"
              width={168}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => truncate(value, 23)}
              interval={0}
            />
            <Tooltip cursor={{ fill: 'rgba(15,155,131,0.06)' }} content={<Tip unit={unit} nameMap={nameMap} />} />
            {spec.reference && (
              <ReferenceLine x={spec.reference.value} stroke={CHART_INK.axis} strokeWidth={1.5}>
                <Label value={spec.reference.label} position="top" fill={CHART_INK.tick} fontSize={10.5} />
              </ReferenceLine>
            )}
            <Bar dataKey="value" name={spec.y} fill={BRAND} radius={[0, 4, 4, 0]} maxBarSize={BAR_SIZE}>
              <LabelList
                dataKey="value"
                content={(props) => extremeLabel({ ...props, extremes, unit, horizontal: true })}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* Ranked dots — for rates and ratios, which sit in a band far from zero and
     would read as ten identical bars. A dot plot makes no claim about zero, so
     the axis can show only the range the values actually occupy. */
  if (shape === 'dot') {
    const values = data.map((row) => row.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const anchor = spec.reference?.value;
    const floor = anchor === undefined ? low : Math.min(low, anchor);
    const ceiling = anchor === undefined ? high : Math.max(high, anchor);
    const pad = (ceiling - floor || Math.abs(ceiling) || 1) * 0.12;
    const plotHeight = height || Math.max(240, data.length * 31 + 64);
    const dotExtremes = extremeIndexes(data);
    return (
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={plotHeight}>
          <LineChart data={data} layout="vertical" margin={{ top: 20, right: 54, bottom: 24, left: 4 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              type="number"
              domain={[floor - pad, ceiling + pad]}
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={tickFormat}
            >
              <Label value={titleLabel(spec.y)} position="insideBottom" offset={-14} fill={CHART_INK.tick} fontSize={11} />
            </XAxis>
            <YAxis
              type="category"
              dataKey="name"
              width={168}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => truncate(value, 23)}
              interval={0}
            />
            <Tooltip cursor={{ stroke: CHART_INK.axis }} content={<Tip unit={unit} nameMap={nameMap} />} />
            {spec.reference && (
              <ReferenceLine x={spec.reference.value} stroke={CHART_INK.axis} strokeWidth={1.5}>
                <Label value={spec.reference.label} position="top" fill={CHART_INK.tick} fontSize={10.5} />
              </ReferenceLine>
            )}
            <Line
              dataKey="value"
              name={spec.y}
              stroke="none"
              isAnimationActive={false}
              dot={{ r: 5, fill: BRAND, stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: BRAND, stroke: '#ffffff', strokeWidth: 2 }}
            >
              <LabelList
                dataKey="value"
                content={(props) =>
                  dotExtremes.has(props.index) ? (
                    <text x={props.x + 12} y={props.y + 4} fill={CHART_INK.label} fontSize={11.5} fontWeight={600}>
                      {`${compact(props.value)}${unit}`}
                    </text>
                  ) : null
                }
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* Vertical bars — for a small number of groups. */
  if (shape === 'bar' || shape === 'histogram') {
    const extremes = shape === 'bar' ? extremeIndexes(data) : new Set();
    const axisTitle = shape === 'histogram' ? `${titleLabel(spec.y || spec.x)} band` : titleLabel(spec.x);
    return (
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={height || (data.length > 5 ? 330 : 300)}>
          <BarChart data={data} margin={{ top: 22, right: 12, bottom: 44, left: 8 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...AXIS_TICK, fontSize: data.length > 8 ? 10.5 : 11.5 }}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval={0}
              angle={data.length > 5 ? -35 : 0}
              textAnchor={data.length > 5 ? 'end' : 'middle'}
              height={data.length > 5 ? 80 : 30}
              tickFormatter={(value) => truncate(value, data.length > 5 ? 18 : 24)}
            >
              <Label value={axisTitle} position="insideBottom" offset={-6} fill={CHART_INK.tick} fontSize={11} />
            </XAxis>
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFormat} width={56} />
            <Tooltip cursor={{ fill: 'rgba(15,155,131,0.06)' }} content={<Tip unit={shape === 'histogram' ? '' : unit} nameMap={nameMap} />} />
            <Bar
              dataKey="value"
              name={shape === 'histogram' ? 'Records' : spec.y}
              fill={BRAND}
              radius={[4, 4, 0, 0]}
              maxBarSize={BAR_SIZE}
            >
              {shape === 'bar' && (
                <LabelList dataKey="value" content={(props) => extremeLabel({ ...props, extremes, unit })} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* Several measures at once: stacked for a total, grouped for a comparison. */
  if (shape === 'stacked' || shape === 'grouped') {
    const stacked = shape === 'stacked';
    return (
      <div className="chart-frame">
        <Legend keys={keys} />
        <ResponsiveContainer width="100%" height={height || 350}>
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 52, left: 8 }} barCategoryGap={stacked ? '18%' : '20%'}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...AXIS_TICK, fontSize: 10.5 }}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={84}
              tickFormatter={(value) => truncate(value, 18)}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFormat} width={56} />
            <Tooltip cursor={{ fill: 'rgba(15,155,131,0.06)' }} content={<Tip unit={unit} nameMap={nameMap} />} />
            {keys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                stackId={stacked ? 'total' : undefined}
                fill={seriesColor(index)}
                maxBarSize={stacked ? 34 : BAR_SIZE}
                radius={stacked ? (index === keys.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                // A 2px surface-coloured edge is what separates touching segments.
                stroke={stacked ? '#ffffff' : undefined}
                strokeWidth={stacked ? 2 : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* Part to whole. Capped at the slots that stay distinguishable side by side. */
  if (shape === 'composition') {
    const slices = data.slice(0, 6);
    const donut = spec.chartType !== 'pie';
    return (
      <div className="chart-frame chart-frame-pie">
        <ResponsiveContainer width="100%" height={height || 300}>
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={donut ? 62 : 0}
              outerRadius={104}
              paddingAngle={1.5}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.name} fill={seriesColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<Tip unit={unit} />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="pie-key">
          {slices.map((slice, index) => {
            const total = slices.reduce((sum, item) => sum + item.value, 0) || 1;
            return (
              <li key={slice.name}>
                <span className="chart-legend-dot" style={{ background: seriesColor(index) }} />
                <span className="pie-key-name">{slice.name}</span>
                <b>{full((slice.value / total) * 100, 1)}%</b>
                <small>{full(slice.value)}</small>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* Relationship between two measures. */
  if (shape === 'scatter') {
    return (
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={height || 320}>
          <ScatterChart margin={{ top: 12, right: 18, bottom: 44, left: 6 }}>
            <CartesianGrid {...GRID} />
            {/* Scaled to the cloud rather than to zero, so the pattern fills the plot. */}
            <XAxis
              type="number"
              dataKey="x"
              domain={['dataMin', 'dataMax']}
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={axisFormatter(axisPeak(data, ['x']))}
            >
              <Label value={titleLabel(spec.x)} position="insideBottom" offset={-16} fill={CHART_INK.tick} fontSize={11} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={['dataMin', 'dataMax']}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={axisFormatter(axisPeak(data, ['y']))}
              width={60}
            >
              <Label value={titleLabel(spec.y)} angle={-90} position="insideLeft" fill={CHART_INK.tick} fontSize={11} style={{ textAnchor: 'middle' }} />
            </YAxis>
            <ZAxis range={[46, 46]} />
            <Tooltip
              cursor={{ strokeDasharray: '0', stroke: CHART_INK.axis }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="chart-tip">
                    <p className="chart-tip-row">
                      <span className="chart-tip-name">{titleLabel(spec.x)}</span>
                      <b>{full(payload[0].payload.x)}</b>
                    </p>
                    <p className="chart-tip-row">
                      <span className="chart-tip-name">{titleLabel(spec.y)}</span>
                      <b>{full(payload[0].payload.y)}</b>
                    </p>
                  </div>
                ) : null
              }
            />
            <Scatter data={data} fill={BRAND} fillOpacity={0.55} stroke="#ffffff" strokeWidth={1} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* A measure followed along an ordered axis. */
  const AxisChart = shape === 'area' ? AreaChart : LineChart;
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={height || 300}>
        <AxisChart data={data} margin={{ top: 14, right: 20, bottom: 44, left: 2 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ ...AXIS_TICK, fontSize: 10.5 }}
            axisLine={AXIS_LINE}
            tickLine={false}
            angle={data.length > 8 ? -22 : 0}
            textAnchor={data.length > 8 ? 'end' : 'middle'}
            height={data.length > 8 ? 58 : 32}
            tickFormatter={(value) => truncate(value, 16)}
          >
            <Label value={titleLabel(spec.x)} position="insideBottom" offset={-6} fill={CHART_INK.tick} fontSize={11} />
          </XAxis>
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFormat} width={58} />
          <Tooltip cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }} content={<Tip unit={unit} nameMap={nameMap} />} />
          {shape === 'area' ? (
            <Area
              type="monotone"
              dataKey="value"
              name={spec.y}
              stroke={BRAND}
              strokeWidth={2}
              fill={wash(BRAND, 0.12)}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              name={spec.y}
              stroke={BRAND}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
            />
          )}
        </AxisChart>
      </ResponsiveContainer>
    </div>
  );
}

export { SERIES, ALL_PAIRS_LIMIT };
