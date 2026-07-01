import React, { useState } from 'react';
import { Tooltip } from 'antd';
import {
  DashboardOutlined, ClockCircleOutlined, SafetyOutlined, TeamOutlined,
  ApiOutlined, ThunderboltOutlined, StopOutlined, KeyOutlined,
  LockOutlined, LinkOutlined, AlertOutlined, FileTextOutlined,
  CompassOutlined, UserAddOutlined, ClusterOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import AccessControlDashboard from './AccessControlDashboard';
import TimeZoneManagement     from './TimeZoneManagement';
import AccessLevelManagement  from './AccessLevelManagement';
import UserLevelManagement    from './UserLevelManagement';
import DoorSettings           from './DoorSettings';
import TransactionLog         from './TransactionLog';
import AntiPassbackSettings   from './AntiPassbackSettings';
import FirstCardSettings      from './FirstCardSettings';
import MultiCardSettings      from './MultiCardSettings';
import InterlockManagement    from './InterlockManagement';
import LinkageManagement      from './LinkageManagement';
import EmergencyLockdown      from './EmergencyLockdown';
import AccessReports          from './AccessReports';
import GuardTour              from './GuardTour';
import VisitorAccess          from './VisitorAccess';
import Controllers            from './Controllers';

const NAV = [
  {
    label: null,
    items: [
      { key: 'dashboard',   label: 'Dashboard',      icon: DashboardOutlined,   component: AccessControlDashboard },
    ],
  },
  {
    label: 'CONFIGURATION',
    items: [
      { key: 'timezone',    label: 'Time Zones',     icon: ClockCircleOutlined, component: TimeZoneManagement    },
      { key: 'levels',      label: 'Access Levels',  icon: SafetyOutlined,      component: AccessLevelManagement },
      { key: 'user-levels', label: 'User Levels',    icon: TeamOutlined,        component: UserLevelManagement   },
      { key: 'doors',       label: 'Doors',          icon: ApiOutlined,         component: DoorSettings          },
      { key: 'controllers', label: 'Controllers',    icon: ClusterOutlined,     component: Controllers           },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { key: 'transaction', label: 'Transaction Log', icon: ThunderboltOutlined, component: TransactionLog },
      { key: 'guard-tour',  label: 'Guard Tour',      icon: CompassOutlined,     component: GuardTour      },
    ],
  },
  {
    label: 'ADVANCED RULES',
    items: [
      { key: 'antipassback', label: 'Anti-passback',   icon: StopOutlined,  component: AntiPassbackSettings },
      { key: 'firstcard',    label: 'First Card Open', icon: KeyOutlined,   component: FirstCardSettings    },
      { key: 'multicard',    label: 'Multi-Card Open', icon: LockOutlined,  component: MultiCardSettings    },
      { key: 'interlock',    label: 'Interlock',       icon: LinkOutlined,  component: InterlockManagement  },
      { key: 'linkage',      label: 'Linkage',         icon: LinkOutlined,  component: LinkageManagement    },
      { key: 'emergency',    label: 'Emergency',       icon: AlertOutlined, component: EmergencyLockdown    },
    ],
  },
  {
    label: 'EXTENDED',
    items: [
      { key: 'visitors', label: 'Visitor Access', icon: UserAddOutlined, component: VisitorAccess },
    ],
  },
  {
    label: 'REPORTING',
    items: [
      { key: 'reports', label: 'Reports', icon: FileTextOutlined, component: AccessReports },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap(g => g.items);

const AccessControl = () => {
  const [activeKey, setActiveKey] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const ActiveComp = ALL_ITEMS.find(i => i.key === activeKey)?.component || AccessControlDashboard;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: collapsed ? 60 : 220,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0c1929 0%, #0a1e30 60%, #060e18 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        maxHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.3)',
        zIndex: 100,
      }}>

        {/* Logo row */}
        <div style={{
          padding: collapsed ? '16px 12px' : '16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          flexShrink: 0,
          minHeight: 64,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(24,144,255,0.45)',
            }}>
              <LockOutlined style={{ color: 'white', fontSize: 15 }} />
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
                  Access Control
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, whiteSpace: 'nowrap' }}>
                  BioTime-compatible
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)',
              padding: '5px 7px', display: 'flex', alignItems: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed
              ? <MenuUnfoldOutlined style={{ fontSize: 12 }} />
              : <MenuFoldOutlined  style={{ fontSize: 12 }} />}
          </button>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, paddingBottom: 12 }}>
          {NAV.map((group, gi) => (
            <div key={gi}>
              {/* Group divider/label */}
              {group.label && !collapsed && (
                <div style={{
                  color: 'rgba(255,255,255,0.22)',
                  fontSize: 9.5, fontWeight: 800,
                  letterSpacing: '1.4px',
                  padding: '18px 16px 5px',
                  textTransform: 'uppercase',
                }}>
                  {group.label}
                </div>
              )}
              {group.label && collapsed && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  margin: '10px 10px 6px',
                }} />
              )}

              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeKey === item.key;
                return (
                  <Tooltip
                    key={item.key}
                    title={collapsed ? item.label : ''}
                    placement="right"
                    mouseEnterDelay={0.05}
                  >
                    <div
                      onClick={() => setActiveKey(item.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: collapsed ? '10px 0' : '9px 16px',
                        cursor: 'pointer',
                        position: 'relative',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: isActive
                          ? 'linear-gradient(90deg, rgba(24,144,255,0.2) 0%, rgba(24,144,255,0.04) 100%)'
                          : 'transparent',
                        transition: 'background 0.15s',
                        margin: collapsed ? '1px 8px' : 0,
                        borderRadius: collapsed ? 8 : 0,
                      }}
                    >
                      {/* Active left bar */}
                      {isActive && !collapsed && (
                        <div style={{
                          position: 'absolute', left: 0, top: 4, bottom: 4,
                          width: 3,
                          background: 'linear-gradient(180deg, #1890ff, #722ed1)',
                          borderRadius: '0 3px 3px 0',
                        }} />
                      )}
                      {/* Active dot for collapsed */}
                      {isActive && collapsed && (
                        <div style={{
                          position: 'absolute', right: -2, top: '50%', transform: 'translateY(-50%)',
                          width: 4, height: 4, borderRadius: '50%', background: '#1890ff',
                        }} />
                      )}
                      <Icon style={{
                        fontSize: 15, flexShrink: 0,
                        color: isActive ? '#40a9ff' : 'rgba(255,255,255,0.38)',
                        transition: 'color 0.15s',
                      }} />
                      {!collapsed && (
                        <span style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#e6f4ff' : 'rgba(255,255,255,0.52)',
                          transition: 'color 0.15s',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.label}
                        </span>
                      )}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {!collapsed && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.18)',
            fontSize: 10,
            flexShrink: 0,
          }}>
            POB v2.0 · Access Control
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <ActiveComp />
      </div>

      <style>{`
        .ac-stat-card { border-radius: 12px !important; border: none !important; }
        .ac-row-danger td { background: #fff8f7 !important; }
        .ac-row-danger:hover td { background: #ffe8e6 !important; }
        @keyframes ac-pulse {
          0% { box-shadow: 0 0 0 0 rgba(82,196,26,0.5); }
          70% { box-shadow: 0 0 0 6px rgba(82,196,26,0); }
          100% { box-shadow: 0 0 0 0 rgba(82,196,26,0); }
        }
        .ac-online-pulse { animation: ac-pulse 2s ease-out infinite; }
      `}</style>
    </div>
  );
};

export default AccessControl;
