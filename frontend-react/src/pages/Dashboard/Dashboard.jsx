import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Tag, Avatar, Button, Alert, Skeleton, Progress } from 'antd';
import { Area, Line, Pie, Column } from '@ant-design/plots';
import { useNavigate } from 'react-router-dom';
import {
  UserOutlined, EnvironmentOutlined, HomeOutlined, ArrowUpOutlined,
  ReloadOutlined, DesktopOutlined, ThunderboltOutlined, ClockCircleOutlined,
  RightOutlined, WarningOutlined, SafetyOutlined, MedicineBoxOutlined,
  AuditOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';

// ─── inject global keyframes once ────────────────────────────────────────────

const CSS_ID = 'pob-dash-styles';
if (!document.getElementById(CSS_ID)) {
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    @keyframes pob-live-ring {
      0%   { box-shadow: 0 0 0 0   rgba(82,196,26,0.55); }
      70%  { box-shadow: 0 0 0 9px rgba(82,196,26,0);    }
      100% { box-shadow: 0 0 0 0   rgba(82,196,26,0);    }
    }
    .pob-live-dot { animation: pob-live-ring 1.8s ease-out infinite; }

    @keyframes pob-fade-up {
      from { opacity:0; transform:translateY(14px); }
      to   { opacity:1; transform:translateY(0);    }
    }
    .pob-fade-in { animation: pob-fade-up 0.35s ease both; }

    .pob-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.11) !important; }
    .pob-kpi { transition: transform 0.2s ease, box-shadow 0.2s ease; }

    .pob-row-in  td:first-child { border-left: 3px solid #52c41a !important; }
    .pob-row-out td:first-child { border-left: 3px solid #1677ff !important; }
    .pob-row-brk td:first-child { border-left: 3px solid #fa8c16 !important; }
    .pob-row-def td:first-child { border-left: 3px solid #d9d9d9 !important; }

    .pob-feed-row { transition: background 0.15s; }
    .pob-feed-row:hover { background: #fafafa; }

    .pob-scroll::-webkit-scrollbar { width: 4px; }
    .pob-scroll::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }

    .pob-tracker-ring { transition: stroke-dashoffset 1s ease; }
  `;
  document.head.appendChild(s);
}

// ─── count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef();
  const t0  = useRef();

  useEffect(() => {
    const n = Number(target) || 0;
    if (n === 0) { setVal(0); return; }
    t0.current = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(e * n));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}

function CountUp({ value, duration }) {
  return <>{useCountUp(value, duration)}</>;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const PUNCH_META = {
  0:   { label:'Check In',  color:'#52c41a', bg:'#f6ffed', border:'#b7eb8f', rowCls:'pob-row-in'  },
  1:   { label:'Check Out', color:'#1677ff', bg:'#e6f4ff', border:'#91caff', rowCls:'pob-row-out' },
  2:   { label:'Break Out', color:'#fa8c16', bg:'#fff7e6', border:'#ffd591', rowCls:'pob-row-brk' },
  3:   { label:'Break In',  color:'#722ed1', bg:'#f9f0ff', border:'#d3adf7', rowCls:'pob-row-brk' },
  255: { label:'Punch',     color:'#8c8c8c', bg:'#fafafa', border:'#d9d9d9', rowCls:'pob-row-def' },
};
const punchMeta = s => PUNCH_META[s] ?? PUNCH_META[255];

function relativeTime(iso) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)    return `${d}s ago`;
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function GradText({ children, gradient, style = {} }) {
  return (
    <span style={{
      background: gradient,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      display: 'inline-block', ...style,
    }}>{children}</span>
  );
}

function ViewAll({ path, navigate }) {
  if (!path) return null;
  return (
    <span onClick={() => navigate(path)}
      style={{ fontSize:11, color:'#667eea', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:2 }}>
      View All <RightOutlined style={{ fontSize:9 }} />
    </span>
  );
}

function CardHeader({ title, sub, viewPath, navigate }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
      <div>
        <div style={{ fontWeight:700, fontSize:13, color:'#1a1a2e' }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:'#8c8c8c', marginTop:1 }}>{sub}</div>}
      </div>
      <ViewAll path={viewPath} navigate={navigate} />
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, path, navigate, badge, badgeUp }) {
  const counted = useCountUp(value);
  return (
    <div
      className="pob-kpi"
      onClick={path ? () => navigate(path) : undefined}
      style={{
        background: '#fff', borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        borderLeft: `4px solid ${color}`,
        cursor: path ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: 16,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.1 }}>
          {counted}
        </div>
        {badge !== undefined && (
          <div style={{ fontSize: 10, color: badgeUp ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>
            {badgeUp ? '↑' : '↓'} {Math.abs(badge)} vs yesterday
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton placeholders ────────────────────────────────────────────────────

function ChartSkeleton({ height = 160 }) {
  return (
    <div style={{ height, display:'flex', alignItems:'flex-end', gap:4, padding:'0 4px' }}>
      {[55,80,40,95,65,50,85,60,70,45].map((h, i) => (
        <div key={i} style={{ flex:1 }}>
          <div style={{
            height: height * h / 100 * 0.72,
            background:'linear-gradient(180deg,#e8eaf0,#f5f6fa)',
            borderRadius:'3px 3px 0 0',
          }} />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 3 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f5f5f5' }}>
          <Skeleton.Avatar active size={28} />
          <div style={{ flex:1 }}>
            <Skeleton active paragraph={false} title={{ width:'60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SVG mini sparkline ───────────────────────────────────────────────────────

function Sparkline({ points, color, width = 70, height = 28 }) {
  if (!points || points.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...points, 1);
  const step = (width - 2) / (points.length - 1);
  const pts = points.map((v, i) => `${i * step + 1},${height - 2 - ((v / max) * (height - 4))}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow:'visible', display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// ─── Emergency Tracker ring (like WowDash Support Tracker) ───────────────────

function TrackerRing({ value, max, color, size = 100 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className="pob-tracker-ring" />
    </svg>
  );
}

// ─── Card style presets ───────────────────────────────────────────────────────

const S = {
  card:  { borderRadius: 14, border: 'none', boxShadow: '0 2px 14px rgba(0,0,0,0.07)' },
  body:  { padding: '14px 16px' },
  hfull: { height: '100%' },
};

// ─── Verify-method colour map ────────────────────────────────────────────────

const METHOD_COLORS = {
  Face:        '#667eea',
  Fingerprint: '#11998e',
  Card:        '#f5576c',
  Password:    '#fa8231',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const POLL = 30_000;

  // ── existing queries ──
  const { data: pobRaw,  isLoading: pobLoading, refetch: rPob } = useQuery({
    queryKey: ['dash-pob'],
    queryFn: () => apiService.get('/api/v1/pob-status/dashboard'),
    refetchInterval: POLL, refetchOnWindowFocus: false,
  });
  const { data: devRaw,  isLoading: devLoading, refetch: rDev } = useQuery({
    queryKey: ['dash-devices'],
    queryFn: () => apiService.get('/api/device/terminals/'),
    refetchInterval: POLL, refetchOnWindowFocus: false,
  });
  const { data: persRaw } = useQuery({
    queryKey: ['dash-personnel'],
    queryFn: () => apiService.get('/api/v1/personnel/?page_size=1'),
    refetchInterval: 60_000, refetchOnWindowFocus: false,
  });
  const { data: txRaw, isLoading: txLoading, refetch: rTx } = useQuery({
    queryKey: ['dash-tx'],
    queryFn: () => apiService.get('/api/device/transactions/live/?limit=100'),
    refetchInterval: 15_000, refetchOnWindowFocus: false,
  });

  // ── new queries ──
  const { data: trendRaw } = useQuery({
    queryKey: ['dash-trend'],
    queryFn: () => apiService.get('/api/v1/pob-status/attendance-trend?days=30'),
    refetchInterval: 5 * 60_000, refetchOnWindowFocus: false,
  });
  const { data: methodRaw } = useQuery({
    queryKey: ['dash-methods'],
    queryFn: () => apiService.get('/api/v1/pob-status/verify-methods'),
    refetchInterval: POLL, refetchOnWindowFocus: false,
  });
  const { data: emergencyRaw } = useQuery({
    queryKey: ['dash-emergency'],
    queryFn: () => apiService.get('/api/emergency/metrics'),
    refetchInterval: POLL, refetchOnWindowFocus: false,
  });
  const { data: mtdRaw, isLoading: mtdLoading } = useQuery({
    queryKey: ['dash-mtd'],
    queryFn: () => apiService.get('/api/mtd/dashboard/compliance/'),
    refetchInterval: 5 * 60_000, refetchOnWindowFocus: false,
  });

  const [alertDismissed, setAlertDismissed] = useState(false);

  // ── data transforms ──
  const pob     = pobRaw ?? {};
  const devices = Array.isArray(devRaw) ? devRaw : [];
  const tx      = txRaw?.data ?? [];
  const totalPersonnel = persRaw?.count ?? pob.total_personnel ?? 0;
  const byLocation     = pob.by_location ?? {};
  const online  = devices.filter(d => d.state === 1 || d.status === 'online');
  const offline = devices.filter(d => d.state !== 1 && d.status !== 'online');

  const todayStr = new Date().toDateString();
  const yestStr  = new Date(Date.now() - 86_400_000).toDateString();
  const todayTx  = tx.filter(t => new Date(t.punch_time).toDateString() === todayStr);
  const yestTx   = tx.filter(t => new Date(t.punch_time).toDateString() === yestStr);

  const todayIns  = todayTx.filter(t => t.punch_state !== 1).length;
  const todayOuts = todayTx.filter(t => t.punch_state === 1).length;
  const yestIns   = yestTx.filter(t => t.punch_state !== 1).length;
  const yestOuts  = yestTx.filter(t => t.punch_state === 1).length;
  const inTrend   = todayIns  - yestIns;
  const outTrend  = todayOuts - yestOuts;

  const areaData = useMemo(() => {
    const h = {};
    todayTx.forEach(t => {
      const k = `${String(new Date(t.punch_time).getHours()).padStart(2,'0')}:00`;
      if (!h[k]) h[k] = { in:0, out:0 };
      t.punch_state === 1 ? h[k].out++ : h[k].in++;
    });
    const r = [];
    Object.entries(h).sort().forEach(([time, { in: i, out: o }]) => {
      r.push({ time, value:i, type:'Check In' });
      r.push({ time, value:o, type:'Check Out' });
    });
    return r;
  }, [tx]);

  const sparkPoints = useMemo(() => {
    const c = {};
    todayTx.forEach(t => {
      const hr = new Date(t.punch_time).getHours();
      c[hr] = (c[hr] ?? 0) + 1;
    });
    const now = new Date().getHours();
    return Array.from({ length: Math.min(now + 1, 12) }, (_, i) => c[now - (11 - i)] ?? 0);
  }, [tx]);

  const offCount = pob.offshore_count ?? 0;
  const onCount  = pob.onshore_count  ?? 0;
  const trCount  = pob.transit_count  ?? 0;

  const pobPieData = [
    { type:'Offshore', value: offCount },
    { type:'Onshore',  value: onCount  },
    { type:'Transit',  value: trCount  },
  ].filter(d => d.value > 0);

  const devicePieData = [
    { type:'Online',  value: online.length  || 0 },
    { type:'Offline', value: offline.length || 0 },
  ].filter(d => d.value > 0);

  const pobLegend = [
    { label:'Offshore', value:offCount, color:'#11998e' },
    { label:'Onshore',  value:onCount,  color:'#f5576c' },
    { label:'Transit',  value:trCount,  color:'#fa8231' },
  ];

  // 30-day trend data
  const trendData = useMemo(() => {
    const raw = trendRaw?.trend ?? [];
    const r = [];
    raw.forEach(({ day, check_ins, check_outs }) => {
      const label = new Date(day).toLocaleDateString('en-US', { month:'short', day:'numeric' });
      r.push({ day: label, value: check_ins,  type: 'Check In'  });
      r.push({ day: label, value: check_outs, type: 'Check Out' });
    });
    return r;
  }, [trendRaw]);

  // Emergency data
  const em = emergencyRaw ?? {};
  const emTotal    = em.total_events    ?? 0;
  const emResolved = em.resolved_events ?? 0;
  const emActive   = em.active_events   ?? 0;
  const emRate     = em.resolution_rate ?? 0;

  // Verify-method data
  const methods = methodRaw?.methods ?? [];
  const methodPieData = methods.map(m => ({ type: m.type, value: m.count }));

  // MTD compliance data
  const mtdData = mtdRaw?.data ?? {};
  const mtdTotal     = mtdData.total_personnel    ?? 0;
  const mtdCompliant = mtdData.compliant_count     ?? 0;
  const mtdNonComp   = mtdData.non_compliant_count ?? 0;
  const mtdRate      = mtdData.compliance_rate     ?? 0;

  // MTD breakdown (derive category counts from non_compliant_list)
  const mtdCategories = useMemo(() => {
    const list = mtdData.non_compliant_list ?? [];
    const cats = { 'Medical Fitness': 0, 'Expired Certs': 0, 'Overdue PPE': 0 };
    list.forEach(p => {
      (p.missing_items ?? []).forEach(item => {
        if (item.includes('Medical'))   cats['Medical Fitness']++;
        else if (item.includes('Expired')) cats['Expired Certs']++;
        else if (item.includes('PPE'))   cats['Overdue PPE']++;
      });
    });
    return [
      { label: 'Compliant',      count: mtdCompliant, color: '#52c41a', icon: <AuditOutlined /> },
      { label: 'Medical Issues', count: cats['Medical Fitness'], color: '#ff4d4f', icon: <MedicineBoxOutlined /> },
      { label: 'Expired Certs',  count: cats['Expired Certs'],   color: '#fa8c16', icon: <SafetyOutlined /> },
      { label: 'Overdue PPE',    count: cats['Overdue PPE'],     color: '#722ed1', icon: <ToolOutlined /> },
    ];
  }, [mtdData]);

  const offlineNames = offline.map(d => (d.alias || d.sn || '').trim()).filter(Boolean).join(', ');
  const refresh = () => { rPob(); rDev(); rTx(); };

  return (
    <div style={{ background:'#f0f4f9', minHeight:'100vh', padding:'16px 20px' }}>

      {/* ─── offline banner ─── */}
      {!devLoading && offline.length > 0 && !alertDismissed && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} closable
          onClose={() => setAlertDismissed(true)}
          message={
            <span style={{ fontWeight:700, fontSize:13 }}>
              {offline.length} reader{offline.length > 1 ? 's' : ''} offline — {offlineNames}
            </span>
          }
          action={
            <span style={{ color:'#667eea', cursor:'pointer', fontWeight:700, fontSize:12 }}
              onClick={() => navigate('/devices')}>
              View →
            </span>
          }
          style={{ marginBottom:12, borderRadius:10, padding:'7px 14px', border:'1px solid #ffe58f' }}
        />
      )}

      {/* ─── page header ─── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:'#1a1a2e', letterSpacing:'-0.2px' }}>Analytics</h1>
          <div style={{ fontSize:11, color:'#bfbfbf' }}>Dashboard › Overview</div>
        </div>
        <Button icon={<ReloadOutlined />} size="small" shape="round" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {/* ══ ROW 1 — KPI strip ══ */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }} className="pob-fade-in">
        {[
          { label:'Total Personnel', value:totalPersonnel, icon:<UserOutlined />,        color:'#764ba2', path:'/personnel' },
          { label:'Offshore',        value:offCount,        icon:<EnvironmentOutlined />, color:'#11998e', path:'/personnel' },
          { label:'Onshore',         value:onCount,         icon:<HomeOutlined />,        color:'#f5576c', path:'/personnel' },
          { label:'In Transit',      value:trCount,         icon:<ArrowUpOutlined />,     color:'#fa8231', path:'/personnel' },
          {
            label:'Online Readers', value:online.length,  icon:<DesktopOutlined />,     color:'#52c41a', path:'/devices',
            badge: devices.length > 0 ? online.length - offline.length : undefined,
            badgeUp: online.length >= offline.length,
          },
        ].map(k => (
          <div key={k.label} style={{ flex:'1 1 160px', minWidth:150 }}>
            <KpiCard {...k} navigate={navigate} />
          </div>
        ))}
      </div>

      {/* ══ ROW 2 — original charts ══ */}
      <Row gutter={[10,10]} style={{ marginBottom:10 }}>

        {/* POB multi-segment donut */}
        <Col xs={24} md={7}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="POB Breakdown" sub="By assignment" viewPath="/personnel" navigate={navigate} />
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              {pobLoading ? (
                <Skeleton.Avatar active size={140} style={{ borderRadius:'50%' }} />
              ) : pobPieData.length > 0 ? (
                <Pie data={pobPieData} angleField="value" colorField="type"
                  innerRadius={0.68} height={148}
                  color={['#11998e','#f5576c','#fa8231']}
                  legend={false} label={false}
                  tooltip={{ items:[{ channel:'y', name:'count' }] }}
                />
              ) : (
                <div style={{ height:148, display:'flex', alignItems:'center', justifyContent:'center', color:'#d9d9d9' }}>
                  <UserOutlined style={{ fontSize:36 }} />
                </div>
              )}
              <div style={{ display:'flex', width:'100%', gap:6, marginTop:12 }}>
                {pobLegend.map(({ label, value, color }) => (
                  <div key={label} style={{
                    flex:1, textAlign:'center', background:`${color}0f`,
                    borderRadius:8, padding:'6px 4px', borderTop:`2px solid ${color}`,
                  }}>
                    <div style={{ fontSize:9, color:'#8c8c8c', fontWeight:700, textTransform:'uppercase' }}>{label}</div>
                    <div style={{ fontSize:18, fontWeight:900, color, lineHeight:1.1 }}>
                      <CountUp value={value} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10, fontSize:11, color:'#8c8c8c' }}>
                Total: <strong style={{ color:'#1a1a2e' }}>{totalPersonnel}</strong> personnel
              </div>
            </div>
          </Card>
        </Col>

        {/* Attendance area chart */}
        <Col xs={24} md={10}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#1a1a2e' }}>Attendance Overview</div>
                <div style={{ fontSize:11, color:'#8c8c8c' }}>Today's activity by hour</div>
              </div>
              <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                {[
                  { label:'In', value:todayIns, trend:inTrend, yest:yestIns, grad:'linear-gradient(135deg,#667eea,#764ba2)' },
                  { label:'Out', value:todayOuts, trend:outTrend, yest:yestOuts, grad:'linear-gradient(135deg,#f093fb,#f5576c)' },
                ].map(({ label, value, trend, yest, grad }) => (
                  <div key={label} style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#8c8c8c' }}>{label}</div>
                    <GradText gradient={grad} style={{ fontSize:22, fontWeight:800, lineHeight:1.1, display:'block' }}>
                      <CountUp value={value} />
                    </GradText>
                    {yest > 0 && (
                      <div style={{ fontSize:10, color:trend>=0?'#52c41a':'#ff4d4f', fontWeight:700 }}>
                        {trend>=0?'↑':'↓'}{Math.abs(trend)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {txLoading ? <ChartSkeleton height={160} /> :
            areaData.length > 0 ? (
              <Area data={areaData} xField="time" yField="value" colorField="type"
                height={160} smooth color={['#667eea','#f5576c']}
                style={{ fillOpacity:0.13 }}
                axis={{
                  x:{ labelFill:'#8c8c8c', labelFontSize:10 },
                  y:{ labelFill:'#8c8c8c', labelFontSize:10, gridLineDash:[4,4], gridLineStroke:'#f0f0f0' },
                }}
                legend={false}
              />
            ) : (
              <div style={{ height:160, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#d9d9d9' }}>
                <ThunderboltOutlined style={{ fontSize:30 }} />
                <div style={{ fontSize:12, marginTop:6 }}>No punch data for today yet</div>
              </div>
            )}
          </Card>
        </Col>

        {/* Readers panel */}
        <Col xs={24} md={7}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="Readers" sub="Biometric terminals" viewPath="/devices" navigate={navigate} />
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingBottom:12, borderBottom:'1px solid #f5f5f5' }}>
              <div style={{ width:72, flexShrink:0 }}>
                {devLoading ? (
                  <Skeleton.Avatar active size={72} style={{ borderRadius:'50%' }} />
                ) : devicePieData.length > 0 ? (
                  <Pie data={devicePieData} angleField="value" colorField="type"
                    innerRadius={0.70} height={72}
                    color={['#52c41a','#ff4d4f']}
                    legend={false} label={false}
                  />
                ) : <div style={{ height:72 }} />}
              </div>
              <div>
                <div style={{ fontSize:10, color:'#8c8c8c' }}>Online / Total</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#1a1a2e', lineHeight:1.1 }}>
                  <CountUp value={online.length} />
                  <span style={{ fontSize:13, fontWeight:400, color:'#8c8c8c' }}>/{devices.length}</span>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <span style={{ fontSize:10, color:'#52c41a', fontWeight:700 }}>● {online.length} on</span>
                  <span style={{ fontSize:10, color:'#ff4d4f', fontWeight:700 }}>● {offline.length} off</span>
                </div>
              </div>
            </div>
            <div className="pob-scroll" style={{ maxHeight:130, overflowY:'auto' }}>
              {devLoading ? <ListSkeleton rows={3} /> :
              devices.length === 0 ? (
                <div style={{ textAlign:'center', color:'#d9d9d9', padding:'20px 0', fontSize:12 }}>No devices</div>
              ) : [...online, ...offline].map((d, i) => {
                const isOn = d.state === 1 || d.status === 'online';
                return (
                  <div key={d.id ?? d.sn} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'6px 0',
                    borderBottom: i < devices.length-1 ? '1px solid #f9f9f9' : 'none',
                  }}>
                    <div className={isOn ? 'pob-live-dot' : ''} style={{ width:6, height:6, borderRadius:'50%', background:isOn?'#52c41a':'#ff4d4f', flexShrink:0 }} />
                    <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1a1a2e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {(d.alias || d.sn || '').trim()}
                    </div>
                    <div style={{ fontSize:10, color:'#bfbfbf', flexShrink:0 }}>{d.ip_address ?? ''}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ══ ROW 3 — 30-day Attendance Trend + Emergency Tracker ══ */}
      <Row gutter={[10,10]} style={{ marginBottom:10 }}>

        {/* 30-day Attendance Trend — like WowDash Revenue Statistic */}
        <Col xs={24} md={14}>
          <Card variant="borderless" style={S.card} styles={{ body:S.body }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#1a1a2e' }}>Attendance Trend</div>
                <div style={{ fontSize:11, color:'#8c8c8c' }}>Last 30 days — daily check-ins vs check-outs</div>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:3, borderRadius:99, background:'#667eea' }} />
                  <span style={{ fontSize:11, color:'#8c8c8c' }}>In</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:3, borderRadius:99, background:'#f5576c' }} />
                  <span style={{ fontSize:11, color:'#8c8c8c' }}>Out</span>
                </div>
              </div>
            </div>
            {trendData.length > 0 ? (
              <Line
                data={trendData}
                xField="day" yField="value" colorField="type"
                height={160} smooth
                color={['#667eea', '#f5576c']}
                point={{ size:2, shape:'circle' }}
                axis={{
                  x:{ labelFill:'#8c8c8c', labelFontSize:9, labelAutoRotate:true },
                  y:{ labelFill:'#8c8c8c', labelFontSize:10, gridLineDash:[4,4], gridLineStroke:'#f0f0f0' },
                }}
                legend={false}
              />
            ) : (
              <ChartSkeleton height={160} />
            )}
          </Card>
        </Col>

        {/* Emergency Incident Tracker — like WowDash Support Tracker */}
        <Col xs={24} md={10}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="Incident Tracker" sub="Last 30 days" viewPath="/emergency" navigate={navigate} />

            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              {/* triple ring stack */}
              <div style={{ position:'relative', width:100, height:100, flexShrink:0 }}>
                <div style={{ position:'absolute', inset:0 }}>
                  <TrackerRing value={emTotal}    max={Math.max(emTotal, 1)}    color="#667eea" size={100} />
                </div>
                <div style={{ position:'absolute', inset:10 }}>
                  <TrackerRing value={emResolved} max={Math.max(emTotal, 1)}    color="#52c41a" size={80} />
                </div>
                <div style={{ position:'absolute', inset:20 }}>
                  <TrackerRing value={emActive}   max={Math.max(emTotal, 1)}    color="#ff4d4f" size={60} />
                </div>
                <div style={{
                  position:'absolute', inset:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column',
                }}>
                  <div style={{ fontSize:16, fontWeight:900, color:'#1a1a2e', lineHeight:1 }}>{emTotal}</div>
                  <div style={{ fontSize:9, color:'#8c8c8c', fontWeight:600, textTransform:'uppercase' }}>Total</div>
                </div>
              </div>

              {/* stat rows */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Total Events',   value:emTotal,    color:'#667eea', icon:'●' },
                  { label:'Resolved',       value:emResolved, color:'#52c41a', icon:'●' },
                  { label:'Active',         value:emActive,   color:'#ff4d4f', icon:'●' },
                  { label:'Resolution Rate',value:`${Math.round(emRate)}%`, color:'#11998e', icon:'●', noCount:true },
                ].map(({ label, value, color, icon, noCount }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color, fontSize:8 }}>{icon}</span>
                      <span style={{ fontSize:12, color:'#595959' }}>{label}</span>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color }}>
                      {noCount ? value : <CountUp value={Number(value)} />}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ══ ROW 4 — By Location + MTD Compliance + Check-in Methods ══ */}
      <Row gutter={[10,10]} style={{ marginBottom:10 }}>

        {/* Personnel by location */}
        <Col xs={24} md={8}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="By Location" sub="Headcount distribution" viewPath="/personnel" navigate={navigate} />
            {pobLoading ? <ListSkeleton rows={3} /> :
            Object.keys(byLocation).length === 0 ? (
              <div style={{ textAlign:'center', color:'#d9d9d9', padding:'20px 0', fontSize:12 }}>No location data</div>
            ) : <>
              {Object.entries(byLocation).map(([loc, count], idx) => {
                const COLORS = ['#667eea','#11998e','#f5576c','#fa8231','#185a9d'];
                const color  = COLORS[idx % COLORS.length];
                const pct    = totalPersonnel > 0 ? Math.round((count / totalPersonnel) * 100) : 0;
                return (
                  <div key={loc} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#1a1a2e' }}>{loc}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Sparkline points={[count]} color={color} width={40} height={20} />
                        <span style={{ fontSize:11, color:'#8c8c8c' }}>{count} · {pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:5, background:'#f0f0f0', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width 0.8s ease', minWidth:count>0?5:0 }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid #f5f5f5', marginTop:4 }}>
                <span style={{ fontSize:11, color:'#8c8c8c' }}>Grand total</span>
                <GradText gradient="linear-gradient(135deg,#667eea,#764ba2)" style={{ fontSize:14, fontWeight:800 }}>
                  {totalPersonnel}
                </GradText>
              </div>
            </>}
          </Card>
        </Col>

        {/* MTD Compliance Summary — like WowDash Monthly Campaign State */}
        <Col xs={24} md={8}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="MTD Compliance" sub={`${mtdTotal} personnel assessed`} viewPath="/mtd" navigate={navigate} />

            {/* overall rate ring */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14, paddingBottom:12, borderBottom:'1px solid #f5f5f5' }}>
              <div style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                <TrackerRing value={mtdCompliant} max={Math.max(mtdTotal,1)} color="#52c41a" size={64} />
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                  <span style={{ fontSize:13, fontWeight:900, color:'#1a1a2e' }}>{Math.round(mtdRate)}%</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'#8c8c8c' }}>Compliance Rate</div>
                <div style={{ fontSize:20, fontWeight:900, color:'#52c41a', lineHeight:1.1 }}>
                  <CountUp value={mtdCompliant} /> <span style={{ fontSize:12, color:'#8c8c8c', fontWeight:400 }}>compliant</span>
                </div>
                <div style={{ fontSize:11, color:'#ff4d4f', fontWeight:600 }}>
                  {mtdNonComp} non-compliant
                </div>
              </div>
            </div>

            {/* category breakdown rows */}
            {mtdLoading ? <ListSkeleton rows={4} /> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {mtdCategories.map(({ label, count, color, icon }) => {
                  const pct = mtdTotal > 0 ? Math.round((count / mtdTotal) * 100) : 0;
                  return (
                    <div key={label}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ color, fontSize:12 }}>{icon}</span>
                          <span style={{ fontSize:12, color:'#595959' }}>{label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:12, fontWeight:700, color }}>{count}</span>
                          <span style={{ fontSize:10, color:'#8c8c8c' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height:4, background:'#f0f0f0', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Check-in Method Breakdown — like WowDash Source Visitors */}
        <Col xs={24} md={8}>
          <Card variant="borderless" style={{ ...S.card, ...S.hfull }} styles={{ body:{ ...S.body, ...S.hfull } }}>
            <CardHeader title="Check-in Methods" sub="Today's biometric breakdown" navigate={navigate} />

            {/* total count */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:22, fontWeight:900, color:'#1a1a2e', lineHeight:1.1 }}>
                <CountUp value={methodRaw?.total ?? 0} />
              </div>
              <div style={{ fontSize:11, color:'#8c8c8c' }}>Total today's punches</div>
            </div>

            {/* method blocks — mimic WowDash source-visitor tiles */}
            {methodPieData.length > 0 ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {methods.map(m => {
                  const color = METHOD_COLORS[m.type] ?? '#8c8c8c';
                  return (
                    <div key={m.type} style={{
                      background:`${color}10`, borderRadius:10, padding:'10px 12px',
                      borderBottom:`3px solid ${color}`,
                    }}>
                      <div style={{ fontSize:10, color:'#8c8c8c', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>{m.type}</div>
                      <div style={{ fontSize:20, fontWeight:900, color, lineHeight:1.1 }}>{m.pct}%</div>
                      <div style={{ fontSize:10, color:'#8c8c8c' }}>{m.count} punches</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {['Face', 'Fingerprint', 'Card', 'Password'].map(t => {
                  const color = METHOD_COLORS[t];
                  return (
                    <div key={t} style={{ background:`${color}10`, borderRadius:10, padding:'10px 12px', borderBottom:`3px solid ${color}` }}>
                      <div style={{ fontSize:10, color:'#8c8c8c', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>{t}</div>
                      <div style={{ fontSize:20, fontWeight:900, color, lineHeight:1.1 }}>—</div>
                      <div style={{ fontSize:10, color:'#8c8c8c' }}>no data</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* mini donut */}
            {methodPieData.length > 0 && (
              <div style={{ display:'flex', justifyContent:'center' }}>
                <Pie
                  data={methodPieData} angleField="value" colorField="type"
                  innerRadius={0.72} height={90}
                  color={methods.map(m => METHOD_COLORS[m.type] ?? '#8c8c8c')}
                  legend={false} label={false}
                  tooltip={{ items:[{ channel:'y', name:'punches' }] }}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ══ ROW 5 — Recent Activity feed ══ */}
      <Row gutter={[10,10]}>
        <Col xs={24}>
          <Card variant="borderless" style={S.card} styles={{ body:S.body }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#1a1a2e' }}>Recent Activity</div>
                <div style={{ fontSize:11, color:'#8c8c8c' }}>Latest punch transactions</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div className="pob-live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#52c41a' }} />
                  <span style={{ fontSize:11, color:'#52c41a', fontWeight:700 }}>Live</span>
                </div>
                <ViewAll path="/attendance" navigate={navigate} />
              </div>
            </div>

            {txLoading ? <ListSkeleton rows={7} /> :
            tx.length === 0 ? (
              <div style={{ textAlign:'center', color:'#d9d9d9', padding:'20px 0', fontSize:12 }}>
                <ClockCircleOutlined style={{ fontSize:28, display:'block', margin:'0 auto 6px' }} />
                No transactions yet
              </div>
            ) : (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 0 6px', borderBottom:'1px solid #f0f0f0', marginBottom:4 }}>
                  <div style={{ width:28 }} />
                  <div style={{ flex:1, fontSize:10, color:'#bfbfbf', fontWeight:700, textTransform:'uppercase' }}>Employee</div>
                  <div style={{ width:90, fontSize:10, color:'#bfbfbf', fontWeight:700, textTransform:'uppercase' }}>Reader</div>
                  <div style={{ width:72, fontSize:10, color:'#bfbfbf', fontWeight:700, textTransform:'uppercase', textAlign:'right' }}>Status</div>
                  <div style={{ width:52, fontSize:10, color:'#bfbfbf', fontWeight:700, textTransform:'uppercase', textAlign:'right' }}>Time</div>
                </div>
                {tx.slice(0, 10).map((r) => {
                  const m = punchMeta(r.punch_state);
                  const name = r.emp_name || r.emp_code || '?';
                  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  const label = r.punch_state_label && r.punch_state_label !== 'Unknown' ? r.punch_state_label : m.label;
                  return (
                    <div key={r.id ?? Math.random()} className="pob-feed-row"
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'7px 4px', borderBottom:'1px solid #f9f9f9',
                        borderLeft:`3px solid ${m.color}`,
                        marginLeft:-4, paddingLeft:6,
                      }}>
                      <Avatar size={26} style={{ background:'#667eea', fontSize:10, fontWeight:700, flexShrink:0 }}>
                        {initials}
                      </Avatar>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#1a1a2e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {name}
                        </div>
                        <div style={{ fontSize:10, color:'#8c8c8c' }}>{r.emp_code}</div>
                      </div>
                      <div style={{ width:90, fontSize:11, color:'#595959', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {(r.device_alias || r.terminal_sn || '').trim()}
                      </div>
                      <div style={{ width:72, textAlign:'right' }}>
                        <Tag style={{
                          background:m.bg, color:m.color, border:`1px solid ${m.border}`,
                          borderRadius:10, fontWeight:600, fontSize:10, padding:'1px 7px', margin:0,
                        }}>
                          {label}
                        </Tag>
                      </div>
                      <div style={{ width:52, textAlign:'right' }}>
                        <div style={{ fontSize:11, color:'#1a1a2e', fontWeight:500 }}>
                          {new Date(r.punch_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        </div>
                        <div style={{ fontSize:10, color:'#bfbfbf' }}>{relativeTime(r.punch_time)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <div style={{ textAlign:'center', marginTop:14, color:'#bfbfbf', fontSize:11, paddingBottom:6 }}>
        © {new Date().getFullYear()} POB System · Refreshes every 30s
      </div>
    </div>
  );
}
