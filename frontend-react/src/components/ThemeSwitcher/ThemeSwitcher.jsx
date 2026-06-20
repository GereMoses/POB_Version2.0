import React, { useState } from 'react';
import { Popover, Tooltip, Typography } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';

const { Text } = Typography;

/**
 * Mini visual preview of a theme — shows sidebar + content + accent strip.
 *   ┌──────────────────────┐
 *   │ ▐▌ sidebar  topbar   │
 *   │ ▐▌ sidebar  content  │
 *   └──────────────────────┘
 */
const ThemeCard = ({ theme, isActive, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const [sidebar, accent, topbar, content] = theme.preview;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 10,
        overflow: 'hidden',
        border: isActive
          ? `2px solid ${accent}`
          : hovered
            ? `2px solid ${accent}80`
            : '2px solid transparent',
        boxShadow: isActive
          ? `0 0 0 3px ${accent}30`
          : hovered
            ? '0 4px 12px rgba(0,0,0,0.12)'
            : '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'all 0.18s ease',
        position: 'relative',
        background: '#fff',
        transform: hovered && !isActive ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Mini UI mockup */}
      <div style={{ display: 'flex', height: 52 }}>
        {/* Sidebar strip */}
        <div style={{
          width: 22,
          background: sidebar,
          display: 'flex',
          flexDirection: 'column',
          padding: '6px 4px',
          gap: 4,
          flexShrink: 0,
        }}>
          {/* Logo dot */}
          <div style={{ width: 14, height: 6, borderRadius: 3, background: accent, opacity: 0.9 }} />
          {/* Nav lines */}
          {[0.6, 1, 0.6, 0.6].map((op, i) => (
            <div key={i} style={{
              height: 3, borderRadius: 2,
              background: i === 1 ? accent : 'rgba(255,255,255,0.35)',
              opacity: op,
            }} />
          ))}
        </div>
        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Topbar */}
          <div style={{
            height: 14, background: topbar,
            borderBottom: `1px solid ${accent}22`,
            display: 'flex', alignItems: 'center',
            paddingLeft: 5, gap: 3,
          }}>
            <div style={{ width: 18, height: 4, borderRadius: 2, background: accent, opacity: 0.7 }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.6 }} />
          </div>
          {/* Content */}
          <div style={{ flex: 1, background: content, padding: '4px 5px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 4, borderRadius: 2, background: accent, opacity: 0.25, width: '60%' }} />
            <div style={{ height: 3, borderRadius: 2, background: '#00000018', width: '90%' }} />
            <div style={{ height: 3, borderRadius: 2, background: '#00000012', width: '75%' }} />
          </div>
        </div>
      </div>

      {/* Theme name */}
      <div style={{
        padding: '5px 7px',
        background: isActive ? `${accent}0f` : '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: `1px solid ${isActive ? accent + '25' : '#f0f0f0'}`,
      }}>
        <Text style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? accent : '#595959' }}>
          {theme.name}
        </Text>
        {isActive && (
          <CheckOutlined style={{ fontSize: 9, color: accent, fontWeight: 800 }} />
        )}
      </div>
    </div>
  );
};

/* ── Picker panel ─────────────────────────────────────────────────────────── */
const ThemePickerPanel = ({ onClose }) => {
  const { themeKey, themes, applyTheme } = useTheme();

  return (
    <div style={{ width: 248, padding: '14px 14px 10px' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 13 }}>Choose Theme</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{themes.length} themes</Text>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {themes.map(t => (
          <ThemeCard
            key={t.key}
            theme={t}
            isActive={t.key === themeKey}
            onSelect={() => { applyTheme(t.key); onClose?.(); }}
          />
        ))}
      </div>

      <div style={{
        marginTop: 12, padding: '8px 10px',
        background: '#f5f5f5', borderRadius: 8,
        fontSize: 11, color: '#8c8c8c', lineHeight: 1.5,
      }}>
        Your theme preference is saved and will persist across sessions.
      </div>
    </div>
  );
};

/* ── Topbar trigger button ────────────────────────────────────────────────── */
const ThemeSwitcher = ({ iconColor = '#6B7A8D' }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={<ThemePickerPanel onClose={() => setOpen(false)} />}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      styles={{ body: { padding: 0, borderRadius: 12, overflow: 'hidden' } }}
    >
      <Tooltip title="Change theme" open={open ? false : undefined}>
        <div style={{
          width: 34, height: 34, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: open ? '#1677ff' : iconColor,
          background: open ? '#e6f4ff' : 'transparent',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { if (!open) { e.currentTarget.style.background = '#f5f5f5'; } }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; } }}
        >
          <BgColorsOutlined style={{ fontSize: 17 }} />
        </div>
      </Tooltip>
    </Popover>
  );
};

export default ThemeSwitcher;
