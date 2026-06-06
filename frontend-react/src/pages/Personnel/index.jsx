import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PersonnelList from './PersonnelList';
import DepartmentTree from './Department/DepartmentTree';
import PositionList from './Position/PositionList';
import ResignationList from './Resignation/ResignationList';
import CustomAttributes from './CustomAttributes/CustomAttributes';
import OnboardingManagement from './Onboarding/OnboardingManagement';
import VendorManagement from './Vendor/VendorManagement';
import PersonnelDetail from './PersonnelDetail';
import LeaveManagement from './LeaveManagement/LeaveManagement';
import TrainingManagement from './TrainingManagement/TrainingManagement';
import PerformanceManagement from './PerformanceManagement/PerformanceManagement';
import DisciplinaryManagement from './DisciplinaryManagement/DisciplinaryManagement';
import PromotionTransfer from './PromotionTransfer/PromotionTransfer';
import EmploymentContract from './EmploymentContract/EmploymentContract';
import BenefitsManagement from './BenefitsManagement/BenefitsManagement';

const Personnel = () => {
  return (
    <Routes>
      <Route index element={<PersonnelList />} />
      <Route path="leave-management" element={<LeaveManagement />} />
      <Route path="training-management" element={<TrainingManagement />} />
      <Route path="performance-management" element={<PerformanceManagement />} />
      <Route path="disciplinary-management" element={<DisciplinaryManagement />} />
      <Route path="promotion-transfer" element={<PromotionTransfer />} />
      <Route path="employment-contract" element={<EmploymentContract />} />
      <Route path="benefits-management" element={<BenefitsManagement />} />
      <Route path="departments" element={<DepartmentTree />} />
      <Route path="positions" element={<PositionList />} />
      <Route path="area" element={<Navigate to="/zones" replace />} />
      <Route path="resignation" element={<ResignationList />} />
      <Route path="custom-attributes" element={<CustomAttributes />} />
      <Route path="onboarding" element={<OnboardingManagement />} />
      <Route path="vendors" element={<VendorManagement />} />
      <Route path="employee/:id" element={<PersonnelDetail />} />
      <Route path="*" element={<Navigate to="/personnel" replace />} />
    </Routes>
  );
};

export default Personnel;
