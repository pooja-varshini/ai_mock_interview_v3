import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  Treemap,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#38BDF8', '#F97316', '#F43F5E', '#22D3EE'];

const formatNumber = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : value);

const defaultTooltipStyle = {
  backgroundColor: 'rgba(15, 13, 28, 0.95)',
  border: '1px solid rgba(120, 97, 196, 0.4)',
  borderRadius: 8,
  color: '#F7F4FF',
  fontSize: '0.8rem',
  padding: '0.6rem 0.75rem',
};

const defaultTooltipLabelStyle = {
  color: '#F7F4FF',
};

const defaultTooltipItemStyle = {
  color: '#F7F4FF',
};

export const ChartPlaceholder = ({ message = 'Not enough data yet.' }) => (
  <div className="admin-panel__placeholder admin-panel__placeholder--chart">{message}</div>
);

export const EngagementAreaChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#EC4899" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#EC4899" stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" vertical={false} />
      <XAxis dataKey="label" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => formatNumber(value)}
      />
      <Legend wrapperStyle={{ color: '#D6D0F0', fontSize: '0.8rem' }} />
      <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#EC4899" fill="url(#sessionsGradient)" strokeWidth={2} />
      <Area type="monotone" dataKey="completed" name="Completed" stroke="#8B5CF6" fill="url(#completedGradient)" strokeWidth={2} />
    </AreaChart>
  </ResponsiveContainer>
);

export const ProgressRadialBars = ({ data }) => (
  <div className="admin-radial-grid">
    {data.map((item, index) => (
      <div key={item.label} className="admin-radial-card">
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={[item]}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <RadialBackground percentage={item.percent} color={COLORS[index % COLORS.length]} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="admin-radial-card__meta">
          <h3>{item.label}</h3>
          <p className="admin-metric admin-metric--large">{item.displayValue}</p>
          {item.subtitle ? <span className="admin-card__hint">{item.subtitle}</span> : null}
        </div>
      </div>
    ))}
  </div>
);

const RadialBackground = ({ percentage, color }) => {
  const strokeDasharray = `${Math.max(Math.min(percentage, 100), 0)} 100`;
  return (
    <svg viewBox="0 0 120 120">
      <circle className="admin-radial-track" cx="60" cy="60" r="52" />
      <circle
        className="admin-radial-progress"
        cx="60"
        cy="60"
        r="52"
        stroke={color}
        strokeDasharray={strokeDasharray}
        transform="rotate(-90 60 60)"
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="admin-radial-text">
        {`${Math.round(percentage)}%`}
      </text>
    </svg>
  );
};

const wrapLabel = (value, maxChars = 22) => {
  if (typeof value !== 'string') return [value];
  const words = value.split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const testLine = current ? `${current} ${word}` : word;
    if (testLine.length <= maxChars) {
      current = testLine;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
};

const ProgramNameTick = ({ x, y, payload }) => {
  const lines = wrapLabel(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={`${payload.value}-${index}`}
          dy={12 + index * 12}
          textAnchor="middle"
          fill="#A7A3C2"
          fontSize={11}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

export const ProgramComposedChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" vertical={false} />
      <XAxis
        dataKey="program_name"
        axisLine={false}
        tickLine={false}
        tick={<ProgramNameTick />}
        height={70}
        interval={0}
      />
      <YAxis yAxisId="left" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 5]} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value, name) => (name.includes('Score') ? value?.toFixed?.(2) : formatNumber(value))}
      />
      <Legend wrapperStyle={{ color: '#D6D0F0', fontSize: '0.8rem' }} />
      <Bar yAxisId="left" dataKey="completed_sessions" name="Completed Sessions" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
      <Line yAxisId="right" dataKey="avg_overall" name="Avg Score" type="monotone" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} connectNulls />
    </ComposedChart>
  </ResponsiveContainer>
);

export const ProgramPieChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <PieChart>
      <Pie data={data} dataKey="student_count" nameKey="program_name" innerRadius={60} outerRadius={90} paddingAngle={2}>
        {data.map((entry, index) => (
          <Cell key={entry.program_name} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => formatNumber(value)}
      />
      <Legend wrapperStyle={{ color: '#D6D0F0', fontSize: '0.8rem' }} />
    </PieChart>
  </ResponsiveContainer>
);

export const ExperienceHorizontalBar = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <ComposedChart
      data={data}
      layout="vertical"
      margin={{ top: 16, right: 24, bottom: 16, left: 80 }}
    >
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" />
      <XAxis type="number" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey="work_experience" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
      />
      <Legend wrapperStyle={{ color: '#D6D0F0', fontSize: '0.8rem' }} />
      <Bar dataKey="sessions" name="Sessions" fill="#38BDF8" barSize={18} radius={[9, 9, 9, 9]} />
      <Scatter dataKey="avg_overall" name="Avg Score" fill="#F97316" shape="circle" />
    </ComposedChart>
  </ResponsiveContainer>
);

export const IndustryScatter = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <ScatterChart margin={{ top: 24, right: 30, bottom: 16, left: 90 }}>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" />
      <XAxis type="category" dataKey="industry" name="Industry" tick={{ fill: '#A7A3C2', fontSize: 11 }} />
      <YAxis type="category" dataKey="company" name="Company" tick={{ fill: '#A7A3C2', fontSize: 11 }} width={120} />
      <ZAxis type="number" dataKey="total_sessions" range={[60, 300]} name="Sessions" />
      <Tooltip
        cursor={{ strokeDasharray: '3 3' }}
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => formatNumber(value)}
      />
      <Scatter data={data} fill="#8B5CF6" fillOpacity={0.75} />
    </ScatterChart>
  </ResponsiveContainer>
);

export const IndustryVolumeBar = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" vertical={false} />
      <XAxis dataKey="industry" tick={{ fill: '#A7A3C2', fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => formatNumber(value)}
      />
      <Bar dataKey="total_sessions" name="Sessions" radius={[9, 9, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={entry.industry} fill={COLORS[index % COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const CompanyTreemap = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <Treemap
      data={data}
      dataKey="size"
      aspectRatio={4 / 3}
      stroke="rgba(15, 13, 28, 0.6)"
      content={<CustomTreemapContent />}
    />
  </ResponsiveContainer>
);

const CustomTreemapContent = ({ depth, name, size, x, y, width, height, index }) => {
  const color = COLORS[index % COLORS.length];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: color, stroke: 'rgba(15, 13, 28, 0.85)', strokeWidth: depth === 1 ? 2 : 1, opacity: depth ? 0.9 : 1 }}
      />
      {width > 60 && height > 24 ? (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#0F0B1E" fontSize={12} fontWeight="600">
          {name}
        </text>
      ) : null}
      {width > 60 && height > 42 ? (
        <text x={x + width / 2} y={y + height / 2 + 16} textAnchor="middle" fill="#120C23" fontSize={11}>
          {size} sessions
        </text>
      ) : null}
    </g>
  );
};

export const TrendingRolesBar = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 16, right: 24, bottom: 16, left: 80 }}
    >
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" />
      <XAxis type="number" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey="job_role" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => formatNumber(value)}
      />
      <Legend wrapperStyle={{ color: '#D6D0F0', fontSize: '0.8rem' }} />
      <Bar dataKey="total_sessions" name="Completed Sessions" fill="#F97316" barSize={20} radius={[10, 10, 10, 10]} />
    </BarChart>
  </ResponsiveContainer>
);

export const CompletionRateBar = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <BarChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 121, 200, 0.2)" vertical={false} />
      <XAxis dataKey="program_name" tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} angle={-10} textAnchor="end" interval={0} />
      <YAxis tickFormatter={(value) => `${value}%`} tick={{ fill: '#A7A3C2', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
      <Tooltip
        contentStyle={defaultTooltipStyle}
        labelStyle={defaultTooltipLabelStyle}
        itemStyle={defaultTooltipItemStyle}
        formatter={(value) => `${value}%`}
      />
      <Bar dataKey="completion_rate" name="Completion Rate" radius={[10, 10, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={entry.program_name} fill={COLORS[index % COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
