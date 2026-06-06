import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space } from 'antd';

const PersonnelDetail = () => {
  const { id } = useParams();

  return (
    <div>
      <Card title="Personnel Details">
        <Descriptions column={2}>
          <Descriptions.Item label="ID">{id}</Descriptions.Item>
          <Descriptions.Item label="Name">John Doe</Descriptions.Item>
          <Descriptions.Item label="Badge ID">EMP001</Descriptions.Item>
          <Descriptions.Item label="Department">Operations</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color="green">Active</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Location">Platform Alpha</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary">Edit</Button>
          <Button>Back</Button>
        </Space>
      </Card>
    </div>
  );
};

export default PersonnelDetail;
