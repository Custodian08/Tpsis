import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ImportPage from './pages/ImportPage';
import RfmAnalysisPage from './pages/RfmAnalysisPage';
import VisualizationPage from './pages/VisualizationPage';
import SegmentsPage from './pages/SegmentsPage';
import ExportPage from './pages/ExportPage';
import AnalysisHistoryPage from './pages/AnalysisHistoryPage';
import AnalysisResultPage from './pages/AnalysisResultPage';
import { useAuthStore } from './store/authStore';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0f766e',
      light: '#ccfbf1',
      dark: '#115e59',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#52627a',
      light: '#e2e8f0',
      dark: '#334155',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f4f7fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#172b4d',
      secondary: '#64748b',
    },
    success: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.25rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e7edf3',
          boxShadow: '0 2px 8px rgba(23, 43, 77, 0.04)',
          borderRadius: 16,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': { boxShadow: '0 8px 24px rgba(23, 43, 77, 0.08)', borderColor: '#d7e2eb' },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '9px 18px',
          boxShadow: 'none',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': { boxShadow: '0 4px 10px rgba(15, 118, 110, 0.16)' },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&:hover': { transform: 'none' },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { head: { backgroundColor: '#f7f9fb', color: '#52627a', fontWeight: 700 } } },
  },
});

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" />} />
          <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="rfm-analysis" element={<RfmAnalysisPage />} />
            <Route path="analysis-history" element={<AnalysisHistoryPage />} />
            <Route path="analyses/:configId" element={<AnalysisResultPage />} />
            <Route path="visualization" element={<VisualizationPage />} />
            <Route path="segments" element={<SegmentsPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
