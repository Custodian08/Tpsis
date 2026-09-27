import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  Analytics as AnalyticsIcon,
  BarChart as BarChartIcon,
  Category as CategoryIcon,
  Download as DownloadIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const drawerWidth = 260;

const menuItems = [
  { text: 'Дашборд', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Импорт данных', icon: <UploadIcon />, path: '/import' },
  { text: 'RFM-анализ', icon: <AnalyticsIcon />, path: '/rfm-analysis' },
  { text: 'История анализов', icon: <HistoryIcon />, path: '/analysis-history' },
  { text: 'Визуализация', icon: <BarChartIcon />, path: '/visualization' },
  { text: 'Сегменты', icon: <CategoryIcon />, path: '/segments' },
  { text: 'Экспорт', icon: <DownloadIcon />, path: '/export' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isMenuItemSelected = (path: string) =>
    location.pathname === path || (path === '/analysis-history' && location.pathname.startsWith('/analyses/'));
  const pageTitle = menuItems.find(item => isMenuItemSelected(item.path))?.text || 'RFM Analysis';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', minHeight: '100%' }}>
      <Toolbar sx={{ minHeight: '104px !important', px: 2.5, py: 1.5, alignItems: 'flex-start', justifyContent: 'center', flexDirection: 'column', gap: 1, bgcolor: '#14243a', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1.25 }}>
          <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: '#0f766e', color: 'white' }}>
            <TrendingUpIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" noWrap component="div" sx={{ fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.15 }}>RFM Studio</Typography>
            <Typography variant="caption" sx={{ color: '#a8b6c8', letterSpacing: '0.04em' }}>АНАЛИТИКА КЛИЕНТОВ</Typography>
          </Box>
        </Box>
        <Typography variant="overline" sx={{ color: '#8292a8', fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1 }}>РАБОЧЕЕ ПРОСТРАНСТВО</Typography>
      </Toolbar>
      <Box sx={{ height: 1, bgcolor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ px: 1.5, pt: 0.5 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isMenuItemSelected(item.path)}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2.5,
                py: 1.15,
                px: 2,
                color: '#bdc9d8',
                transition: 'background-color 0.18s ease, color 0.18s ease',
                '&.Mui-selected': {
                  background: 'rgba(45, 212, 191, 0.14)',
                  color: 'white',
                  boxShadow: 'inset 3px 0 0 #2dd4bf',
                  '&:hover': {
                    background: 'rgba(45, 212, 191, 0.19)',
                  },
                },
                '&:hover': {
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 38,
                  color: isMenuItemSelected(item.path) ? '#5eead4' : '#91a1b6',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  fontWeight: isMenuItemSelected(item.path) ? 600 : 400,
                  color: 'inherit',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e7edf3',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Открыть меню"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' }, color: 'primary.main' }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap component="div" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {pageTitle}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
              {user?.fullName}
            </Typography>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuClick}
              sx={{
                background: '#e8f5f3',
                color: 'primary.dark',
                '&:hover': {
                  background: '#d4efeb',
                },
              }}
            >
              <AccountCircleIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                elevation: 3,
                sx: {
                  mt: 1.5,
                  borderRadius: 2,
                  minWidth: 180,
                },
              }}
            >
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Выйти</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="Основная навигация"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              backgroundColor: '#14243a',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              backgroundColor: '#14243a',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          bgcolor: 'background.default',
          backgroundImage: 'radial-gradient(ellipse at 80% 0%, rgba(20, 184, 166, 0.045), transparent 38%)',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
