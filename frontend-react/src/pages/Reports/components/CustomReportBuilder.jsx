import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Row,
    Col,
    Button,
    Select,
    Input,
    Table,
    Space,
    Modal,
    Form,
    Tree,
    InputNumber,
    DatePicker,
    Switch,
    Tabs,
    Divider,
    Tag,
    Tooltip,
    Popconfirm,
    Alert,
    App,
} from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    EyeOutlined,
    SaveOutlined,
    ReloadOutlined,
    DragOutlined,
    TableOutlined,
    FilterOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Draggable item component
const DraggableItem = ({ item, type, onDrop }) => {
    const [{ isDragging }, drag] = useDrag({
        type: type,
        item: { ...item, itemType: type },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    return (
        <div
            ref={drag}
            style={{
                opacity: isDragging ? 0.5 : 1,
                cursor: 'move',
                padding: '8px 12px',
                margin: '4px 0',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: '#fafafa'
            }}
        >
            <DragOutlined style={{ marginRight: 8 }} />
            {item.display_name || item.name}
        </div>
    );
};

// Drop zone component
const DropZone = ({ onDrop, children, title, acceptedTypes }) => {
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: acceptedTypes,
        drop: (item) => onDrop(item),
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    return (
        <div
            ref={drop}
            style={{
                minHeight: '100px',
                border: `2px dashed ${isOver ? '#1890ff' : '#d9d9d9'}`,
                borderRadius: '4px',
                padding: '16px',
                backgroundColor: isOver ? '#f0f8ff' : '#fafafa',
                transition: 'all 0.3s'
            }}
        >
            <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
                {title}
            </div>
            {children}
        </div>
    );
};

const CustomReportBuilder = () => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [tables, setTables] = useState([]);
    const [relationships, setRelationships] = useState([]);
    const [selectedTables, setSelectedTables] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [filters, setFilters] = useState([]);
    const [groupBy, setGroupBy] = useState([]);
    const [orderBy, setOrderBy] = useState([]);
    const [previewData, setPreviewData] = useState([]);
    const [previewColumns, setPreviewColumns] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedReports, setSavedReports] = useState([]);
    const [reportName, setReportName] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [aggregateFunctions] = useState([
        { name: 'COUNT', description: 'Count records' },
        { name: 'SUM', description: 'Sum values' },
        { name: 'AVG', description: 'Average values' },
        { name: 'MIN', description: 'Minimum value' },
        { name: 'MAX', description: 'Maximum value' }
    ]);
    const [filterOperators] = useState([
        { name: 'equals', description: 'Equals' },
        { name: 'not_equals', description: 'Not equals' },
        { name: 'greater_than', description: 'Greater than' },
        { name: 'less_than', description: 'Less than' },
        { name: 'like', description: 'Contains' },
        { name: 'in', description: 'In list' },
        { name: 'between', description: 'Between' }
    ]);

    useEffect(() => {
        loadAvailableTables();
        loadSavedReports();
    }, []);

    const authHeaders = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    });

    const loadAvailableTables = async () => {
        try {
            const response = await axios.get('/api/v1/report/custom-builder/tables', authHeaders());
            setTables(response.data.tables || []);
            setRelationships(response.data.relationships || []);
        } catch (error) {
            if (error?.response?.status !== 401) {
                message.error('Failed to load tables');
            }
        }
    };

    const loadSavedReports = async () => {
        try {
            const response = await axios.get('/api/v1/report/custom-builder/saved', authHeaders());
            setSavedReports(response.data.reports || []);
        } catch (error) {
            if (error?.response?.status !== 401) {
                message.error('Failed to load saved reports');
            }
        }
    };

    const handleTableDrop = (item) => {
        if (item.itemType === 'table' && !selectedTables.find(t => t.name === item.name)) {
            setSelectedTables([...selectedTables, item]);
        }
    };

    const handleColumnDrop = (item) => {
        if (item.itemType === 'column' && !selectedColumns.find(c => c.name === item.name && c.table === item.table)) {
            setSelectedColumns([...selectedColumns, item]);
        }
    };

    const removeTable = (tableName) => {
        setSelectedTables(selectedTables.filter(t => t.name !== tableName));
        setSelectedColumns(selectedColumns.filter(c => c.table !== tableName));
    };

    const removeColumn = (index) => {
        setSelectedColumns(selectedColumns.filter((_, i) => i !== index));
    };

    const addFilter = () => {
        setFilters([...filters, {
            id: Date.now(),
            column: '',
            operator: 'equals',
            value: '',
            table: ''
        }]);
    };

    const updateFilter = (id, field, value) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const removeFilter = (id) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const addGroupBy = () => {
        setGroupBy([...groupBy, { id: Date.now(), column: '', table: '' }]);
    };

    const updateGroupBy = (id, field, value) => {
        setGroupBy(groupBy.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const removeGroupBy = (id) => {
        setGroupBy(groupBy.filter(g => g.id !== id));
    };

    const addOrderBy = () => {
        setOrderBy([...orderBy, { id: Date.now(), column: '', table: '', direction: 'ASC' }]);
    };

    const updateOrderBy = (id, field, value) => {
        setOrderBy(orderBy.map(o => o.id === id ? { ...o, [field]: value } : o));
    };

    const removeOrderBy = (id) => {
        setOrderBy(orderBy.filter(o => o.id !== id));
    };

    const updateColumnAggregate = (index, aggregate) => {
        const updatedColumns = [...selectedColumns];
        updatedColumns[index] = { ...updatedColumns[index], aggregate };
        setSelectedColumns(updatedColumns);
    };

    const updateColumnAlias = (index, alias) => {
        const updatedColumns = [...selectedColumns];
        updatedColumns[index] = { ...updatedColumns[index], alias };
        setSelectedColumns(updatedColumns);
    };

    const generatePreview = async () => {
        if (selectedTables.length === 0 || selectedColumns.length === 0) {
            message.warning('Please select at least one table and one column');
            return;
        }

        setLoading(true);
        try {
            const reportConfig = {
                tables: selectedTables,
                columns: selectedColumns,
                filters: filters.map(f => ({
                    column: `${f.table}.${f.column}`,
                    operator: f.operator,
                    value: f.value
                })),
                group_by: groupBy.map(g => ({
                    table: g.table,
                    name: g.column
                })),
                order_by: orderBy.map(o => ({
                    table: o.table,
                    name: o.column,
                    direction: o.direction
                })),
                limit: 20
            };

            const response = await axios.post('/api/v1/report/custom-builder/preview', reportConfig);
            
            if (response.data.success) {
                setPreviewData(response.data.data);
                setPreviewColumns(response.data.columns);
                setShowPreview(true);
            } else {
                message.error(response.data.error || 'Failed to generate preview');
            }
        } catch (error) {
            message.error('Failed to generate preview');
        } finally {
            setLoading(false);
        }
    };

    const saveReport = async () => {
        if (!reportName.trim()) {
            message.warning('Please enter a report name');
            return;
        }

        setLoading(true);
        try {
            const reportConfig = {
                tables: selectedTables,
                columns: selectedColumns,
                filters: filters,
                group_by: groupBy,
                order_by: orderBy
            };

            const response = await axios.post('/api/v1/report/custom-builder/save', {
                name: reportName,
                description: reportDescription,
                config: reportConfig
            });

            if (response.data.success) {
                message.success('Report saved successfully');
                setShowSaveModal(false);
                setReportName('');
                setReportDescription('');
                loadSavedReports();
            } else {
                message.error(response.data.error || 'Failed to save report');
            }
        } catch (error) {
            message.error('Failed to save report');
        } finally {
            setLoading(false);
        }
    };

    const loadReport = async (templateId) => {
        try {
            const response = await axios.get(`/api/v1/report/custom-builder/load/${templateId}`);
            
            if (response.data.success) {
                const config = response.data.template.config;
                setSelectedTables(config.tables || []);
                setSelectedColumns(config.columns || []);
                setFilters(config.filters || []);
                setGroupBy(config.group_by || []);
                setOrderBy(config.order_by || []);
                message.success('Report loaded successfully');
            }
        } catch (error) {
            message.error('Failed to load report');
        }
    };

    const clearAll = () => {
        setSelectedTables([]);
        setSelectedColumns([]);
        setFilters([]);
        setGroupBy([]);
        setOrderBy([]);
        setPreviewData([]);
        setPreviewColumns([]);
        setShowPreview(false);
    };

    const buildTableTreeData = () => {
        const groupedTables = {};
        tables.forEach(table => {
            if (!groupedTables[table.category]) {
                groupedTables[table.category] = [];
            }
            groupedTables[table.category].push(table);
        });

        return Object.entries(groupedTables).map(([category, categoryTables]) => ({
            title: category,
            key: category,
            selectable: false,
            children: categoryTables.map(table => ({
                title: (
                    <DraggableItem item={table} type="table" onDrop={handleTableDrop} />
                ),
                key: table.name,
                isLeaf: true,
            })),
        }));
    };

    const renderColumnsForTable = (tableName) => {
        const table = tables.find(t => t.name === tableName);
        if (!table) return null;

        return table.columns.map(column => (
            <DraggableItem
                key={`${tableName}.${column.name}`}
                item={{
                    ...column,
                    table: tableName,
                    display_name: column.display_name
                }}
                type="column"
                onDrop={handleColumnDrop}
            />
        ));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div style={{ padding: '24px' }}>
                <Row gutter={[16, 16]}>
                    {/* Left Panel - Tables and Columns */}
                    <Col span={6}>
                        <Card title="Available Tables" size="small">
                            <Tree
                                showLine
                                defaultExpandAll
                                treeData={buildTableTreeData()}
                            />
                        </Card>

                        {selectedTables.length > 0 && (
                            <Card title="Table Columns" size="small" style={{ marginTop: 16 }}>
                                {selectedTables.map(table => (
                                    <div key={table.name} style={{ marginBottom: 16 }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                                            {table.display_name}
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => removeTable(table.name)}
                                                style={{ float: 'right' }}
                                            />
                                        </div>
                                        {renderColumnsForTable(table.name)}
                                    </div>
                                ))}
                            </Card>
                        )}
                    </Col>

                    {/* Center Panel - Report Builder */}
                    <Col span={12}>
                        <Card title="Report Builder" extra={
                            <Space>
                                <Button icon={<EyeOutlined />} onClick={generatePreview} loading={loading}>
                                    Preview
                                </Button>
                                <Button icon={<SaveOutlined />} onClick={() => setShowSaveModal(true)}>
                                    Save
                                </Button>
                                <Button icon={<ReloadOutlined />} onClick={clearAll}>
                                    Clear
                                </Button>
                            </Space>
                        }>
                            <Tabs
                                defaultActiveKey="columns"
                                items={[
                                    {
                                        key: 'columns',
                                        label: <span><TableOutlined />Columns</span>,
                                        children: (
                                            <DropZone title="Selected Columns (Drag columns here)" acceptedTypes={['column']} onDrop={handleColumnDrop}>
                                                {selectedColumns.length === 0 ? (
                                                    <div style={{ textAlign: 'center', color: '#999' }}>Drag columns here to select them for the report</div>
                                                ) : (
                                                    selectedColumns.map((column, index) => (
                                                        <div key={index} style={{ padding: '8px', margin: '4px 0', border: '1px solid #d9d9d9', borderRadius: '4px', backgroundColor: '#fff' }}>
                                                            <Row gutter={8} align="middle">
                                                                <Col span={8}><strong>{column.display_name}</strong><br /><small>{column.table}.{column.name}</small></Col>
                                                                <Col span={6}><Select size="small" placeholder="Aggregate" style={{ width: '100%' }} value={column.aggregate} onChange={(value) => updateColumnAggregate(index, value)} allowClear>{aggregateFunctions.map(func => (<Option key={func.name} value={func.name}>{func.name}</Option>))}</Select></Col>
                                                                <Col span={6}><Input size="small" placeholder="Alias" value={column.alias} onChange={(e) => updateColumnAlias(index, e.target.value)} /></Col>
                                                                <Col span={4}><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeColumn(index)} /></Col>
                                                            </Row>
                                                        </div>
                                                    ))
                                                )}
                                            </DropZone>
                                        )
                                    },
                                    {
                                        key: 'filters',
                                        label: <span><FilterOutlined />Filters</span>,
                                        children: (
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                {filters.map(filter => (
                                                    <Row key={filter.id} gutter={8} align="middle">
                                                        <Col span={6}><Select placeholder="Table" value={filter.table} onChange={(value) => updateFilter(filter.id, 'table', value)} style={{ width: '100%' }}>{selectedTables.map(table => (<Option key={table.name} value={table.name}>{table.display_name}</Option>))}</Select></Col>
                                                        <Col span={6}><Select placeholder="Column" value={filter.column} onChange={(value) => updateFilter(filter.id, 'column', value)} style={{ width: '100%' }}>{filter.table && tables.find(t => t.name === filter.table)?.columns.map(col => (<Option key={col.name} value={col.name}>{col.display_name}</Option>))}</Select></Col>
                                                        <Col span={4}><Select placeholder="Operator" value={filter.operator} onChange={(value) => updateFilter(filter.id, 'operator', value)} style={{ width: '100%' }}>{filterOperators.map(op => (<Option key={op.name} value={op.name}>{op.description}</Option>))}</Select></Col>
                                                        <Col span={6}><Input placeholder="Value" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} /></Col>
                                                        <Col span={2}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeFilter(filter.id)} /></Col>
                                                    </Row>
                                                ))}
                                                <Button type="dashed" icon={<PlusOutlined />} onClick={addFilter} block>Add Filter</Button>
                                            </Space>
                                        )
                                    },
                                    {
                                        key: 'grouporder',
                                        label: <span><SettingOutlined />Group & Order</span>,
                                        children: (
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <div>
                                                    <h4>Group By</h4>
                                                    {groupBy.map(group => (
                                                        <Row key={group.id} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                                                            <Col span={10}><Select placeholder="Table" value={group.table} onChange={(value) => updateGroupBy(group.id, 'table', value)} style={{ width: '100%' }}>{selectedTables.map(table => (<Option key={table.name} value={table.name}>{table.display_name}</Option>))}</Select></Col>
                                                            <Col span={10}><Select placeholder="Column" value={group.column} onChange={(value) => updateGroupBy(group.id, 'column', value)} style={{ width: '100%' }}>{group.table && tables.find(t => t.name === group.table)?.columns.map(col => (<Option key={col.name} value={col.name}>{col.display_name}</Option>))}</Select></Col>
                                                            <Col span={4}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeGroupBy(group.id)} /></Col>
                                                        </Row>
                                                    ))}
                                                    <Button type="dashed" icon={<PlusOutlined />} onClick={addGroupBy} block>Add Group By</Button>
                                                </div>
                                                <Divider />
                                                <div>
                                                    <h4>Order By</h4>
                                                    {orderBy.map(order => (
                                                        <Row key={order.id} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                                                            <Col span={8}><Select placeholder="Table" value={order.table} onChange={(value) => updateOrderBy(order.id, 'table', value)} style={{ width: '100%' }}>{selectedTables.map(table => (<Option key={table.name} value={table.name}>{table.display_name}</Option>))}</Select></Col>
                                                            <Col span={8}><Select placeholder="Column" value={order.column} onChange={(value) => updateOrderBy(order.id, 'column', value)} style={{ width: '100%' }}>{order.table && tables.find(t => t.name === order.table)?.columns.map(col => (<Option key={col.name} value={col.name}>{col.display_name}</Option>))}</Select></Col>
                                                            <Col span={6}><Select value={order.direction} onChange={(value) => updateOrderBy(order.id, 'direction', value)} style={{ width: '100%' }}><Option value="ASC">Ascending</Option><Option value="DESC">Descending</Option></Select></Col>
                                                            <Col span={2}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeOrderBy(order.id)} /></Col>
                                                        </Row>
                                                    ))}
                                                    <Button type="dashed" icon={<PlusOutlined />} onClick={addOrderBy} block>Add Order By</Button>
                                                </div>
                                            </Space>
                                        )
                                    },
                                ]}
                            />
                        </Card>
                    </Col>

                    {/* Right Panel - Saved Reports */}
                    <Col span={6}>
                        <Card title="Saved Reports" size="small">
                            {savedReports.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#999' }}>
                                    No saved reports yet
                                </div>
                            ) : (
                                savedReports.map(report => (
                                    <div
                                        key={report.id}
                                        style={{
                                            padding: '8px',
                                            margin: '4px 0',
                                            border: '1px solid #d9d9d9',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => loadReport(report.id)}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{report.name}</div>
                                        {report.description && (
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                {report.description}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Preview Modal */}
                <Modal
                    title="Report Preview"
                    open={showPreview}
                    onCancel={() => setShowPreview(false)}
                    footer={[
                        <Button key="close" onClick={() => setShowPreview(false)}>
                            Close
                        </Button>
                    ]}
                    width={1000}
                >
                    <Table
                        columns={previewColumns.map(col => ({
                            title: col.display_name,
                            dataIndex: col.name,
                            key: col.name,
                            ellipsis: true
                        }))}
                        dataSource={previewData}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 'max-content' }}
                        size="small"
                    />
                </Modal>

                {/* Save Modal */}
                <Modal
                    title="Save Report"
                    open={showSaveModal}
                    onOk={saveReport}
                    onCancel={() => setShowSaveModal(false)}
                    confirmLoading={loading}
                >
                    <Form layout="vertical">
                        <Form.Item label="Report Name" required>
                            <Input
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                placeholder="Enter report name"
                            />
                        </Form.Item>
                        <Form.Item label="Description">
                            <Input.TextArea
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                                placeholder="Enter report description (optional)"
                                rows={3}
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </DndProvider>
    );
};

export default CustomReportBuilder;
