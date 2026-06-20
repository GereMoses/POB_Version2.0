import React from 'react';
import {
  Card, Button, Space, App, Form,
  Input, Select, InputNumber, Row, Col, Divider,
  Switch, Tooltip, Spin, Alert, Typography, TimePicker,
} from 'antd';
import {
  SettingOutlined, SaveOutlined, ReloadOutlined,
  LoginOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

const OT_METHOD_OPTIONS = [
  { value:'daily',   label:'Daily — OT calculated per day'         },
  { value:'weekly',  label:'Weekly — OT after weekly threshold'    },
  { value:'shift',   label:'Shift-based — OT relative to shift'    },
];

const RulesTab = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['att-rules'],
    queryFn: () => apiService.get('/api/v1/attendance/rules'),
    onSuccess: (res) => {
      const r = res?.data;
      if (r) form.setFieldsValue(r);
    },
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['att-shifts-list'],
    queryFn: () => apiService.get('/api/v1/attendance/shifts'),
    staleTime: 60_000,
  });
  const shifts = shiftsData?.data ?? shiftsData ?? [];

  const rules = data?.data;

  React.useEffect(() => {
    if (!rules) return;
    const toTime = (v) => (v ? dayjs(v, 'HH:mm') : null);
    form.setFieldsValue({
      ...rules,
      auto_in_start:  toTime(rules.auto_in_start),
      auto_in_end:    toTime(rules.auto_in_end),
      auto_out_start: toTime(rules.auto_out_start),
      auto_out_end:   toTime(rules.auto_out_end),
    });
  }, [rules, form]);

  const saveM = useMutation({
    mutationFn: (d) => apiService.put('/api/v1/attendance/rules', d),
    onSuccess: () => { message.success('Attendance rules saved'); qc.invalidateQueries(['att-rules']); },
    onError:   (e) => message.error(e?.response?.data?.detail || 'Save failed'),
  });

  const submit = () => form.validateFields().then((v) => {
    const payload = { ...v };
    ['auto_in_start','auto_in_end','auto_out_start','auto_out_end'].forEach(k => {
      payload[k] = v[k] ? dayjs(v[k]).format('HH:mm') : null;
    });
    saveM.mutate(payload);
  }).catch(() => {});

  if (isLoading) return <div style={{ padding:48, textAlign:'center' }}><Spin size="large" tip="Loading rules..." /></div>;
  if (isError)   return <div style={{ padding:24 }}><Alert type="error" message="Failed to load attendance rules." showIcon /></div>;

  return (
    <div style={{ padding:24 }}>
      <Card styles={{ body:{ padding:'12px 16px' } }} style={{ marginBottom:16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <SettingOutlined style={{ color:'#722ed1', fontSize:16 }} />
              <span style={{ fontWeight:600, fontSize:15 }}>Global Attendance Rules</span>
              <span style={{ fontSize:12, color:'#8c8c8c' }}>— configure system-wide thresholds and calculation behaviour</span>
            </Space>
          </Col>
          <Col><Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Reload</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={submit} loading={saveM.isPending}>Save Rules</Button>
          </Space></Col>
        </Row>
      </Card>

      <Form form={form} layout="vertical" size="small">

        {/* --- Timing thresholds --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Timing Thresholds</Space>
          </Divider>
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="grace_period_minutes" label="Grace Period (minutes)"
                tooltip="Arrivals within this window after shift start are not marked Late">
                <Space.Compact style={{ width:'100%' }}><InputNumber min={0} max={60} size="middle" placeholder="5" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="absent_after_minutes" label="Mark Absent After (minutes)"
                tooltip="If no punch is recorded after this many minutes past shift start, mark employee absent">
                <InputNumber min={30} max={480} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="120" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="early_departure_threshold" label="Early Departure Threshold (min)"
                tooltip="Leaving this many minutes before shift end triggers an exception">
                <InputNumber min={0} max={120} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="15" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* --- Overtime --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Overtime Calculation</Space>
          </Divider>
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="ot_calculation_method" label="OT Calculation Method">
                <Select size="middle">
                  {OT_METHOD_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="max_daily_hours" label="Max Billable Daily Hours"
                tooltip="Hours above this are capped (does not affect actual worked time)">
                <InputNumber min={1} max={24} style={{ width:'100%' }} size="middle"
                  addonAfter="h" placeholder="12" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="max_weekly_hours" label="Max Billable Weekly Hours">
                <InputNumber min={1} max={168} style={{ width:'100%' }} size="middle"
                  addonAfter="h" placeholder="60" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="weekend_ot_rate" label="Weekend OT Rate Multiplier">
                <InputNumber min={1} max={5} step={0.25} style={{ width:'100%' }} size="middle"
                  addonAfter="×" placeholder="1.5" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="holiday_ot_rate" label="Holiday OT Rate Multiplier">
                <InputNumber min={1} max={5} step={0.25} style={{ width:'100%' }} size="middle"
                  addonAfter="×" placeholder="2.0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="night_shift_start" label="Night Shift Start (hour, 24h)"
                tooltip="e.g., 22 = 10 PM">
                <InputNumber min={0} max={23} style={{ width:'100%' }} size="middle"
                  addonAfter=":00" placeholder="22" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="night_shift_rate" label="Night Shift Rate Multiplier">
                <InputNumber min={1} max={5} step={0.25} style={{ width:'100%' }} size="middle"
                  addonAfter="×" placeholder="1.25" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* --- Break deductions --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Break &amp; Deductions</Space>
          </Divider>
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="break_deduction_minutes" label="Auto Break Deduction (min)"
                tooltip="Automatically deduct this from daily work time (set 0 to disable)">
                <InputNumber min={0} max={120} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="30" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="break_deduction_after" label="Deduct Break After (hours worked)"
                tooltip="Only deduct break if employee worked at least this many hours">
                <InputNumber min={0} max={12} step={0.5} style={{ width:'100%' }} size="middle"
                  addonAfter="h" placeholder="6" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* --- Rounding --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Rounding &amp; Flags</Space>
          </Divider>
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="round_punch_minutes" label="Round Punches to (minutes)"
                tooltip="0 = no rounding">
                <InputNumber min={0} max={30} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="allow_multiple_checkins" label="Allow Multiple Check-ins" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="weekend_ot_auto_approve" label="Auto-approve Weekend OT" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="holiday_ot_auto_approve" label="Auto-approve Holiday OT" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* --- Default shift assignment --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Default Shift Assignment</Space>
          </Divider>
          <Alert
            type="info" showIcon style={{ marginBottom:16 }}
            message={
              <span>
                When an employee has <strong>no shift directly assigned</strong> in their schedule,
                the system first checks their department's default shift, then falls back to the
                global default shift configured here.
              </span>
            }
          />
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="default_shift_id"
                label="Global Default Shift"
                tooltip="Applied when an employee has no schedule entry and their department has no default shift set">
                <Select
                  placeholder="— none —"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width:'100%' }}
                  size="middle">
                  {(Array.isArray(shifts) ? shifts : []).map(s => (
                    <Option key={s.id} value={s.id}>{s.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Text type="secondary" style={{ fontSize:12 }}>
                To set a per-department default shift, go to <strong>Personnel → Departments</strong>, edit the department, and select a shift under the Attendance section.
              </Text>
            </Col>
          </Row>
        </Card>

        {/* --- Absolute punch direction windows --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Facility-Wide Punch Direction Windows</Space>
          </Divider>
          <Alert
            type="info" showIcon style={{ marginBottom:16 }}
            message={
              <span>
                Define fixed time windows for the whole facility. Any <strong>state-255 (Auto-detect)</strong> punch
                that falls inside the Check-in window is classified as <strong>Check-in ↑</strong>;
                inside the Check-out window as <strong>Check-out ↓</strong>.
                Leave blank to rely on shift-relative windows only.
              </span>
            }
          />
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="auto_in_start" label={<Space size={4}><LoginOutlined style={{ color:'#52c41a' }} />Check-in window opens</Space>}>
                <TimePicker format="HH:mm" style={{ width:'100%' }} size="middle" placeholder="e.g. 05:00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="auto_in_end" label={<Space size={4}><LoginOutlined style={{ color:'#52c41a' }} />Check-in window closes</Space>}>
                <TimePicker format="HH:mm" style={{ width:'100%' }} size="middle" placeholder="e.g. 10:00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="auto_out_start" label={<Space size={4}><LogoutOutlined style={{ color:'#f5222d' }} />Check-out window opens</Space>}>
                <TimePicker format="HH:mm" style={{ width:'100%' }} size="middle" placeholder="e.g. 14:00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="auto_out_end" label={<Space size={4}><LogoutOutlined style={{ color:'#f5222d' }} />Check-out window closes</Space>}>
                <TimePicker format="HH:mm" style={{ width:'100%' }} size="middle" placeholder="e.g. 20:00" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* --- Punch detection (clock-in / clock-out windows) --- */}
        <Card styles={{ body:{ padding:'16px 20px' } }} style={{ marginBottom:16 }}>
          <Divider orientation="left" style={{ marginTop:0 }}>
            <Space><SettingOutlined />Shift-Relative Clock-in / Clock-out Windows</Space>
          </Divider>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom:16 }}
            message="These windows control how punches with unknown direction (state 255 / Auto-detect) are classified. A punch within the clock-in window (shift start ± the configured minutes) is treated as clock-in; once the minimum work gap has elapsed the next punch is treated as clock-out."
          />
          <Row gutter={[16,0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="checkin_window_minutes_before"
                label="Clock-in window: minutes before shift start"
                tooltip="Punches this many minutes before shift start are accepted as clock-in (e.g. 120 = up to 2 h early)">
                <InputNumber min={0} max={480} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="120" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="checkin_window_minutes_after"
                label="Clock-in window: minutes after shift start"
                tooltip="Punches within this window after shift start are still treated as clock-in (e.g. 240 = up to 4 h late)">
                <InputNumber min={0} max={720} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="240" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="checkout_window_minutes_before"
                label="Clock-out window: minutes before shift end"
                tooltip="Punches this many minutes before shift end are treated as clock-out (e.g. 240 = up to 4 h early departure)">
                <InputNumber min={0} max={720} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="240" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="checkout_window_minutes_after"
                label="Clock-out window: minutes after shift end"
                tooltip="Punches this many minutes after shift end are accepted as clock-out (e.g. 120 = up to 2 h overtime)">
                <InputNumber min={0} max={480} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="120" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="min_work_minutes_for_checkout"
                label="Grace period: minimum minutes before clock-out"
                tooltip="After an employee clocks in, any punch within this window is treated as a duplicate clock-in (ignored). The first punch AFTER this window is treated as a clock-out. Also suppresses double-tap accidents on the reader.">
                <InputNumber min={5} max={480} style={{ width:'100%' }} size="middle"
                  addonAfter="min" placeholder="30" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ textAlign:'right' }}>
          <Button type="primary" size="middle" icon={<SaveOutlined />} onClick={submit} loading={saveM.isPending}>
            Save All Rules
          </Button>
        </div>
      </Form>
    </div>
  );
};
export default RulesTab;
