import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import {
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { dataService } from '../services/data.service';
import { useAuthStore } from '../store/authStore';

interface Stats {
  totalClients: number;
  totalTransactions: number;
  totalRevenue: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalTransactions: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await dataService.getStats();
      setStats({
        ...data,
        totalRevenue: typeof data.totalRevenue === 'string' ? parseFloat(data.totalRevenue) : (data.totalRevenue || 0),
      });
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    description 
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    color: string; 
    description: string; 
  }) => (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
        color: 'white',
        transition: 'transform 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-8px)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              width: 56,
              height: 56,
            }}
          >
            {icon}
          </Avatar>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {loading ? '...' : value}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          Добро пожаловать, {user?.fullName?.split(' ')[0]}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Обзор системы и ключевые показатели
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Всего клиентов"
            value={stats.totalClients}
            icon={<PeopleIcon sx={{ fontSize: 32 }} />}
            color="#6366f1"
            description="Количество клиентов в базе данных"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Всего транзакций"
            value={stats.totalTransactions}
            icon={<ShoppingCartIcon sx={{ fontSize: 32 }} />}
            color="#ec4899"
            description="Количество транзакций в системе"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Общая выручка"
            value={`${stats.totalRevenue.toFixed(2)} руб.`}
            icon={<AttachMoneyIcon sx={{ fontSize: 32 }} />}
            color="#10b981"
            description="Сумма всех транзакций"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Средний чек"
            value={`${stats.totalTransactions > 0 ? (stats.totalRevenue / stats.totalTransactions).toFixed(2) : '0'} руб.`}
            icon={<TrendingUpIcon sx={{ fontSize: 32 }} />}
            color="#f59e0b"
            description="Средняя сумма покупки"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                <AssessmentIcon />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Быстрые действия
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: 8 }}>•</span>
                Импортируйте данные о клиентах и транзакциях для начала работы
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: 8 }}>•</span>
                Выполните RFM-анализ для сегментации клиентов
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: 8 }}>•</span>
                Визуализируйте результаты анализа для принятия решений
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: 8 }}>•</span>
                Экспортируйте данные для использования в других системах
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
              Статус системы
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  База данных
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: '#10b981',
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>
                    Активна
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  API сервер
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: '#10b981',
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>
                    Работает
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Последний анализ
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Не выполнен
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}