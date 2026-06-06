import React from 'react';
import {
  Space, Tag, Spin, Empty, Descriptions, Progress, Alert, Divider, Row, Col,
} from 'antd';
import {
  MedicineBoxOutlined, SafetyCertificateOutlined, ToolOutlined,
  BookOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const diffDays = d => (d ? dayjs(d).diff(dayjs(), 'day') : null);

const ExpiryTag = ({ date }) => {
  if (!date) return <Tag color="default">No date</Tag>;
  const d = diffDays(date);
  if (d < 0)    return <Tag color="red"    style={{ fontWeight: 700 }}>Expired {Math.abs(d)}d ago</Tag>;
  if (d <= 7)   return <Tag color="red"    style={{ fontWeight: 700 }}>{d}d left</Tag>;
  if (d <= 30)  return <Tag color="orange"                            >{d}d left</Tag>;
  return              <Tag color="green"                              >Valid — {dayjs(date).format('DD MMM YYYY')}</Tag>;
};

const SectionHeader = ({ icon, title, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 }}>
    <span style={{ color, fontSize: 16 }}>{icon}</span>
    <span style={{ fontWeight: 700, fontSize: 13, color: '#262626' }}>{title}</span>
  </div>
);

const StatusRow = ({ label, value, extra }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', borderRadius: 6, background: '#fafafa', marginBottom: 4,
  }}>
    <span style={{ fontSize: 12, color: '#595959' }}>{label}</span>
    <Space size={6}>
      {extra}
      {value}
    </Space>
  </div>
);

/**
 * Displayed in the Personnel detail drawer as the "MTD Compliance" tab.
 * Fetches all MTD records for a single employee by emp_id.
 */
const PersonnelMTDPanel = ({ empId }) => {
  const { data: medData,  isLoading: lMed }  = useQuery({
    queryKey: ['mtd-medical-emp', empId],
    queryFn:  () => apiService.get(`/api/mtd/medical/?emp_id=${empId}&person_type=0`),
    enabled:  !!empId,
  });
  const { data: certData, isLoading: lCert } = useQuery({
    queryKey: ['mtd-certs-emp', empId],
    queryFn:  () => apiService.get(`/api/mtd/certifications/?emp_id=${empId}&person_type=0`),
    enabled:  !!empId,
  });
  const { data: ppeData,  isLoading: lPPE }  = useQuery({
    queryKey: ['mtd-ppe-emp', empId],
    queryFn:  () => apiService.get(`/api/mtd/ppe-issues/?emp_id=${empId}&active=true`),
    enabled:  !!empId,
  });
  const { data: indData,  isLoading: lInd }  = useQuery({
    queryKey: ['mtd-ind-emp', empId],
    queryFn:  () => apiService.get(`/api/mtd/induction-records/?emp_id=${empId}&person_type=0`),
    enabled:  !!empId,
  });
  const { data: ncData } = useQuery({
    queryKey: ['mtd-non-compliant'],
    queryFn: () => apiService.get('/api/mtd/compliance/non-compliant/'),
    staleTime: 60000,
  });

  const isLoading = lMed || lCert || lPPE || lInd;

  const med    = medData?.data?.data  ?? medData?.data  ?? [];
  const certs  = certData?.data?.data ?? certData?.data ?? [];
  const ppe    = ppeData?.data?.data  ?? ppeData?.data  ?? [];
  const inds   = indData?.data?.data  ?? indData?.data  ?? [];

  const ncList    = Array.isArray(ncData?.data?.data) ? ncData.data.data
                  : Array.isArray(ncData?.data)       ? ncData.data : [];
  const myNC      = ncList.find(p => p.emp_id === empId);
  const missingItems = myNC?.missing_items ?? [];

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;

  const hasAnyData = med.length || certs.length || ppe.length || inds.length;

  const latestMed    = med[0];
  const FIT_MAP = { 0: { label: 'Fit', color: '#52c41a' }, 1: { label: 'Restricted', color: '#faad14' }, 2: { label: 'Unfit', color: '#ff4d4f' } };
  const fitCfg       = FIT_MAP[latestMed?.fit_status ?? 0];
  const validCerts   = certs.filter(c => (diffDays(c.expiry_date) ?? 1) > 0);
  const expiredCerts = certs.filter(c => (diffDays(c.expiry_date) ?? 1) <= 0);
  const activePPE    = ppe.filter(p => !p.return_date);
  const passedInds   = inds.filter(i => i.passed);

  const complianceScore = Math.round(
    (
      (latestMed ? (latestMed.fit_status === 2 ? 0 : 1) : 0) +
      (certs.length > 0 ? validCerts.length / certs.length : 0) +
      (inds.length > 0 ? passedInds.length / inds.length : 0)
    ) / 3 * 100
  );

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Non-compliant alert */}
      {missingItems.length > 0 && (
        <Alert
          type="error" showIcon
          message="Non-Compliant"
          description={
            <Space size={[4, 4]} wrap>
              {missingItems.map(m => <Tag key={m} color="error" style={{ fontSize: 11 }}>{m}</Tag>)}
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Overall score */}
      <Row gutter={16} style={{ marginBottom: 8 }}>
        <Col span={8} style={{ textAlign: 'center' }}>
          <Progress
            type="circle" size={70} percent={complianceScore}
            strokeColor={complianceScore >= 80 ? '#52c41a' : complianceScore >= 60 ? '#faad14' : '#ff4d4f'}
            format={p => <span style={{ fontSize: 14, fontWeight: 800 }}>{p}%</span>}
          />
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>MTD Score</div>
        </Col>
        <Col span={16}>
          <Row gutter={[8, 8]} style={{ marginTop: 4 }}>
            {[
              { label: 'Medical', val: latestMed ? (latestMed.fit_status === 2 ? 0 : 100) : null, icon: <MedicineBoxOutlined /> },
              { label: 'Certs',   val: certs.length > 0 ? Math.round(validCerts.length / certs.length * 100) : null, icon: <SafetyCertificateOutlined /> },
              { label: 'Induction', val: inds.length > 0 ? Math.round(passedInds.length / inds.length * 100) : null, icon: <BookOutlined /> },
            ].map(item => (
              <Col key={item.label} span={8} style={{ textAlign: 'center' }}>
                <div style={{
                  borderRadius: 8, padding: '6px 4px',
                  background: item.val === null ? '#fafafa' : item.val >= 80 ? '#f6ffed' : item.val >= 60 ? '#fffbe6' : '#fff1f0',
                }}>
                  <div style={{ color: item.val === null ? '#bfbfbf' : item.val >= 80 ? '#52c41a' : item.val >= 60 ? '#faad14' : '#ff4d4f', fontSize: 13, fontWeight: 800 }}>
                    {item.val === null ? '—' : `${item.val}%`}
                  </div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>{item.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      <Divider style={{ margin: '8px 0' }} />

      {/* Medical */}
      <SectionHeader icon={<MedicineBoxOutlined />} title="Medical Fitness" color="#1890ff" />
      {latestMed ? (
        <>
          <StatusRow
            label="Fit Status"
            value={<Tag color={fitCfg.color === '#52c41a' ? 'green' : fitCfg.color === '#faad14' ? 'orange' : 'red'} style={{ fontWeight: 700 }}>{fitCfg.label}</Tag>}
          />
          <StatusRow label="Last Checkup" value={<span style={{ fontSize: 12 }}>{latestMed.last_checkup ? dayjs(latestMed.last_checkup).format('DD MMM YYYY') : '—'}</span>} />
          <StatusRow label="Next Due" value={<ExpiryTag date={latestMed.next_due} />} />
          {latestMed.blood_group && <StatusRow label="Blood Group" value={<Tag color="red" style={{ fontWeight: 700 }}>{latestMed.blood_group}</Tag>} />}
          {latestMed.restrictions && <StatusRow label="Restrictions" value={<span style={{ fontSize: 11, color: '#d48806' }}>{latestMed.restrictions}</span>} />}
        </>
      ) : (
        <div style={{ padding: '8px 10px', background: '#fff1f0', borderRadius: 6, fontSize: 12, color: '#cf1322' }}>
          <CloseCircleOutlined /> No medical record — initial examination required
        </div>
      )}

      {/* Certifications */}
      <SectionHeader icon={<SafetyCertificateOutlined />} title={`Certifications (${certs.length})`} color="#722ed1" />
      {certs.length === 0 ? (
        <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#8c8c8c' }}>
          No certifications recorded
        </div>
      ) : (
        certs.map(c => (
          <StatusRow
            key={c.id}
            label={<Space size={4}>{c.is_critical && <Tag color="orange" style={{ fontSize: 10 }}>CRITICAL</Tag>}<span>{c.cert_type_name ?? `Cert #${c.cert_type_id}`}</span></Space>}
            value={<ExpiryTag date={c.expiry_date} />}
          />
        ))
      )}

      {/* PPE */}
      <SectionHeader icon={<ToolOutlined />} title={`PPE Issued (${activePPE.length} active)`} color="#fa8c16" />
      {activePPE.length === 0 ? (
        <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#8c8c8c' }}>
          No active PPE issues
        </div>
      ) : (
        activePPE.map(p => (
          <StatusRow
            key={p.id}
            label={<span>{p.ppe_type_name ?? `PPE #${p.ppe_type_id}`}{p.serial_no && <span style={{ color: '#8c8c8c', fontSize: 10 }}> #{p.serial_no}</span>}</span>}
            value={<ExpiryTag date={p.next_calib_date || p.expiry_date} />}
          />
        ))
      )}

      {/* Inductions */}
      <SectionHeader icon={<BookOutlined />} title={`Inductions (${inds.length})`} color="#08979c" />
      {inds.length === 0 ? (
        <div style={{ padding: '8px 10px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#8c8c8c' }}>
          No induction records
        </div>
      ) : (
        inds.map(i => (
          <StatusRow
            key={i.id}
            label={i.template_name ?? `Template #${i.template_id}`}
            value={
              i.passed
                ? <ExpiryTag date={i.expiry_date} />
                : <Tag color="red" style={{ fontWeight: 700 }}><CloseCircleOutlined /> Not Passed</Tag>
            }
            extra={i.passed && i.score != null && <Tag color="cyan" style={{ fontSize: 10 }}>{i.score}%</Tag>}
          />
        ))
      )}

      {!hasAnyData && (
        <Empty description="No MTD records found for this employee" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '24px 0' }} />
      )}
    </div>
  );
};

export default PersonnelMTDPanel;
