import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, DatePicker, Spin } from 'antd';
import { UserOutlined, ClockCircleOutlined, CalendarOutlined, DollarOutlined } from '@ant-design/icons';
import axios from 'axios';
import './SelfService.css';

const { RangePicker } = DatePicker;

const SelfServiceDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    fetchDashboardSummary();
    fetchLeaveRequests();
  }, []);

  const fetchDashboardSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get('/api/v1/self-service/dashboard-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (dates) => {
    if (!dates || dates.length !== 2) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const [start, end] = dates;
      const response = await axios.get('/api/v1/self-service/my-attendance', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          start_date: start.format('YYYY-MM-DD'),
          end_date: end.format('YYYY-MM-DD')
        }
      });
      setAttendance(response.data.data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get('/api/v1/self-service/my-leave-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaveRequests(response.data.data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const attendanceColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Check In',
      dataIndex: 'check_in_time',
      key: 'check_in_time',
      render: (time) => time ? new Date(time).toLocaleTimeString() : '-',
    },
    {
      title: 'Check Out',
      dataIndex: 'check_out_time',
      key: 'check_out_time',
      render: (time) => time ? new Date(time).toLocaleTimeString() : '-',
    },
    {
      title: 'Work Hours',
      dataIndex: 'work_hours',
      key: 'work_hours',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
  ];

  const leaveColumns = [
    {
      title: 'Leave Type',
      dataIndex: 'leave_type',
      key: 'leave_type',
    },
    {
      title: 'Start Date',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'End Date',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Days',
      dataIndex: 'days_count',
      key: 'days_count',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = { 0: 'Pending', 1: 'Approved', 2: 'Rejected' };
        return statusMap[status] || 'Unknown';
      },
    },
  ];

  return (
    <div className="self-service-dashboard">
      <h1>Employee Self-Service Portal</h1>
      
      {loading && !summary ? (
        <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />
      ) : (
        <>
          {summary && (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Working Days"
                    value={summary.attendance.total_days}
                    prefix={<CalendarOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Days Present"
                    value={summary.attendance.present_days}
                    prefix={<UserOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Avg Work Hours"
                    value={summary.attendance.avg_work_hours}
                    precision={2}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Pending Requests"
                    value={summary.pending_leaves + summary.pending_overtime}
                    prefix={<DollarOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card title="My Attendance" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <RangePicker onChange={fetchAttendance} />
              <Button 
                type="primary" 
                onClick={() => fetchAttendance(dateRange)}
                style={{ marginLeft: 8 }}
              >
                Filter
              </Button>
            </div>
            <Table
              columns={attendanceColumns}
              dataSource={attendance}
              rowKey="date"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>

          <Card title="My Leave Requests">
            <Table
              columns={leaveColumns}
              dataSource={leaveRequests}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default SelfServiceDashboard;
