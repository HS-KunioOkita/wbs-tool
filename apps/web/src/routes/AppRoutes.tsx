import { Navigate, Route, Routes } from 'react-router-dom';
import { ProjectSelectPage } from '../features/projects/ProjectSelectPage.js';
import { WbsMainPage } from '../features/wbs/WbsMainPage.js';

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<ProjectSelectPage />} />
      <Route path="/projects/:projectId" element={<WbsMainPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
