import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { 
  Search, 
  Plus, 
  Edit, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Shield,
  Calendar,
  Upload,
  User,
  FileText,
  Users,
  Clock,
  Heart,
  AlertCircle as AlertTriangleIcon
} from 'lucide-react';

const VisitorMTD = () => {
  const [visitorRecords, setVisitorRecords] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState('medical');
  const [showMedicalDialog, setShowMedicalDialog] = useState(false);
  const [showInductionDialog, setShowInductionDialog] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [medicalFormData, setMedicalFormData] = useState({
    visitor_id: '',
    blood_group: '',
    allergies: '',
    medical_conditions: '',
    fit_status: 0,
    doctor_name: 'Visitor Registration'
  });
  const [inductionFormData, setInductionFormData] = useState({
    visitor_id: '',
    template_id: '',
    score: 0,
    signed_doc: null
  });

  useEffect(() => {
    fetchVisitorRecords();
    fetchVisitors();
    fetchTemplates();
  }, []);

  const fetchVisitorRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/mtd/induction-records/?person_type=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVisitorRecords(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching visitor records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/visitors/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVisitors(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/mtd/induction-templates/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleMedicalSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const submitData = {
        ...medicalFormData,
        visitor_id: parseInt(medicalFormData.visitor_id),
        fit_status: 0, // Always fit for visitors
        last_checkup: new Date().toISOString().split('T')[0]
      };

      const response = await fetch('/api/mtd/visitor/medical/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        setShowMedicalDialog(false);
        fetchVisitorRecords();
        resetMedicalForm();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error saving visitor medical record:', error);
      alert('Error saving visitor medical record');
    }
  };

  const handleInductionSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const submitData = new FormData();
      
      // Add form fields
      Object.keys(inductionFormData).forEach(key => {
        if (key !== 'signed_doc' && inductionFormData[key]) {
          submitData.append(key, inductionFormData[key]);
        }
      });
      
      // Add file if exists
      if (inductionFormData.signed_doc) {
        submitData.append('signed_doc', inductionFormData.signed_doc);
      }

      const response = await fetch('/api/mtd/visitor/induction/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });

      if (response.ok) {
        setShowInductionDialog(false);
        fetchVisitorRecords();
        resetInductionForm();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error saving visitor induction:', error);
      alert('Error saving visitor induction');
    }
  };

  const resetMedicalForm = () => {
    setMedicalFormData({
      visitor_id: '',
      blood_group: '',
      allergies: '',
      medical_conditions: '',
      fit_status: 0,
      doctor_name: 'Visitor Registration'
    });
  };

  const resetInductionForm = () => {
    setInductionFormData({
      visitor_id: '',
      template_id: '',
      score: 0,
      signed_doc: null
    });
  };

  const getStatusIcon = (passed) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (passed) => {
    return passed ? (
      <Badge className="bg-green-100 text-green-800">Completed</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Not Completed</Badge>
    );
  };

  const getVisitorName = (record) => {
    return record.visitor?.full_name || 'Unknown';
  };

  const getVisitorCompany = (record) => {
    return record.visitor?.company || 'Unknown';
  };

  const getDaysToExpiry = (validUntil) => {
    if (!validUntil) return null;
    const today = new Date();
    const expiry = new Date(validUntil);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days) => {
    if (days === null) return 'text-gray-500';
    if (days < 0) return 'text-red-600';
    if (days <= 30) return 'text-orange-600';
    if (days <= 90) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleOpenMedicalDialog = (visitor) => {
    setSelectedVisitor(visitor);
    setMedicalFormData({
      visitor_id: visitor.id.toString(),
      blood_group: '',
      allergies: '',
      medical_conditions: '',
      fit_status: 0,
      doctor_name: 'Visitor Registration'
    });
    setShowMedicalDialog(true);
  };

  const handleOpenInductionDialog = (visitor) => {
    setSelectedVisitor(visitor);
    setInductionFormData({
      visitor_id: visitor.id.toString(),
      template_id: '',
      score: 0,
      signed_doc: null
    });
    setShowInductionDialog(true);
  };

  const filteredRecords = visitorRecords.filter(record => {
    const matchesSearch = searchTerm === '' || 
      getVisitorName(record).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getVisitorCompany(record).toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.template?.template_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'completed' && record.passed) ||
      (filterStatus === 'pending' && !record.passed);
    
    const matchesType = filterType === 'all' || record.template_id === parseInt(filterType);
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <><div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visitor MTD</h2>
          <p className="text-gray-600">Manage visitor medical records and safety inductions</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowMedicalDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Medical Record
          </Button>
          <Button onClick={() => setShowInductionDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Induction
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="medical">Medical Records</TabsTrigger>
          <TabsTrigger value="induction">Safety Induction</TabsTrigger>
        </TabsList>

        <TabsContent value="medical">
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by visitor name or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="induction">
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by visitor name or induction type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      {/* Records Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecords.map((record) => (
          <Card key={record.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{getVisitorName(record)}</CardTitle>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(record.passed)}
                  {record.is_valid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">{getVisitorCompany(record)}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(record.passed)}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Induction:</span>
                  <span className="text-sm">{record.template?.template_name || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Score:</span>
                  <span className="text-sm">{record.score}%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Date Taken:</span>
                  <span className="text-sm">
                    {record.taken_date ? new Date(record.taken_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Valid Until:</span>
                  <span className={`text-sm font-medium ${getExpiryColor(record.days_to_expiry)}`}>
                    {record.valid_until ? new Date(record.valid_until).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                
                {record.days_to_expiry !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Days to Expiry:</span>
                    <span className={`text-sm font-medium ${getExpiryColor(record.days_to_expiry)}`}>
                      {record.days_to_expiry < 0 ? `${Math.abs(record.days_to_expiry)} days ago` : `${record.days_to_expiry} days`}
                    </span>
                  </div>
                )}
                
                {!record.is_valid && (
                  <Alert>
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>
                      Induction has expired
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex space-x-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Visitor MTD Records Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Get started by adding medical records or inductions for visitors'}
          </p>
          <div className="flex space-x-2 justify-center">
            <Button onClick={() => setShowMedicalDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Medical Record
            </Button>
            <Button onClick={() => setShowInductionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Induction
            </Button>
          </div>
        </div>
      )}
    </div>

    {/* Medical Record Dialog */}
    <Dialog open={showMedicalDialog} onOpenChange={setShowMedicalDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Visitor Medical Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleMedicalSubmit} className="space-y-4">
          <div>
            <Label htmlFor="visitor_id">Visitor</Label>
            <Select value={medicalFormData.visitor_id} onValueChange={(value) => setMedicalFormData({...medicalFormData, visitor_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select visitor" />
              </SelectTrigger>
              <SelectContent>
                {visitors.map(visitor => (
                  <SelectItem key={visitor.id} value={visitor.id.toString()}>
                    {visitor.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="blood_group">Blood Group</Label>
              <Select value={medicalFormData.blood_group} onValueChange={(value) => setMedicalFormData({...medicalFormData, blood_group: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={medicalFormData.allergies}
                onChange={(e) => setMedicalFormData({...medicalFormData, allergies: e.target.value})}
                placeholder="List any known allergies..."
              />
            </div>
            
            <div>
              <Label htmlFor="medical_conditions">Medical Conditions</Label>
              <Textarea
                id="medical_conditions"
                value={medicalFormData.medical_conditions}
                onChange={(e) => setMedicalFormData({...medicalFormData, medical_conditions: e.target.value})}
                placeholder="List any medical conditions..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowMedicalDialog(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Medical Record
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Induction Dialog */}
    <Dialog open={showInductionDialog} onOpenChange={setShowInductionDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Visitor Induction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleInductionSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="visitor_id">Visitor</Label>
              <Select value={inductionFormData.visitor_id} onValueChange={(value) => setInductionFormData({...inductionFormData, visitor_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visitor" />
                </SelectTrigger>
                <SelectContent>
                  {visitors.map(visitor => (
                    <SelectItem key={visitor.id} value={visitor.id.toString()}>
                      {visitor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
          </div>
            
            <div>
              <Label htmlFor="template_id">Induction Template</Label>
              <Select value={inductionFormData.template_id} onValueChange={(value) => setInductionFormData({...inductionFormData, template_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select induction template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.template_name} ({template.passing_score}% passing)
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
          </div>
          </div>

          <div>
            <Label htmlFor="score">Score (%)</Label>
            <Input
              id="score"
              type="number"
              min="0"
              max="100"
              value={inductionFormData.score}
              onChange={(e) => setInductionFormData({...inductionFormData, score: e.target.value})}
              placeholder="85"
            />
          </div>

          <div>
            <Label htmlFor="signed_doc">Signed Document</Label>
            <Input
              id="signed_doc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setInductionFormData({...inductionFormData, signed_doc: e.target.files[0]})}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setShowInductionDialog(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Record Induction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default VisitorMTD;
