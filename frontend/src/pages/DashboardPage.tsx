import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import {
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/data.service';
import { rfmService } from '../services/rfm.service';
import { useAuthStore } from '../store/authStore';
import { AnalysisHistoryItem } from '../types';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

interface Stats {
  totalClients: number;
  totalTransactions: number;
  totalRevenue: number;
}

const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' });

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisHistoryItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [statsRetry, setStatsRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    setStatsError('');
    dataService.getStats().then(data => {
      if (!active) return;
      setStats({
        totalClients: Number(data.totalClients) || 0,
        totalTransactions: Number(data.totalTransactions) || 0,
        totalRevenue: Number(data.totalRevenue) || 0,
      });
    }).catch(error => {
      if (active) setStatsError(getApiErrorMessage(error, 'Не удалось получить статистику базы.'));
    }).finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [statsRetry]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    rfmService.getAnalysisHistory({ page: 1, pageSize: 1 }).then(history => {
      if (active) setLatestAnalysis(history.items[0] || null);
    }).catch(error => {
      if (active) setHistoryError(getApiErrorMessage(error, 'Не удалось загрузить историю анализов.'));
    }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [historyRetry]);

  const statCards = [
    { title: 'Клиенты', value: stats?.totalClients.toLocaleString('ru-RU') ?? '—', icon: <PeopleIcon />, color: '#6366f1', description: 'Записей в базе данных' },
    { title: 'Транзакции', value: stats?.totalTransactions.toLocaleString('ru-RU') ?? '—', icon: <ShoppingCartIcon />, color: '#ec4899', description: 'Покупок в базе данных' },
    { title: 'Сумма покупок', value: stats ? currency.format(stats.totalRevenue) : '—', icon: <AttachMoneyIcon />, color: '#10b981', description: 'Итог по импортированным транзакциям' },
    { title: 'Средний чек', value: stats ? currency.format(stats.totalTransactions ? stats.totalRevenue / stats.totalTransactions : 0) : '—', icon: <TrendingUpIcon />, color: '#f59e0b', description: 'Средняя сумма транзакции' },
  ];

  return (
    <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: { xs: 'flex-start', sm: 'flex-end' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '.12em' }}>ОБЗОР РАБОЧЕГО ПРОСТРАНСТВА</Typography>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 750, color: 'text.primary', letterSpacing: '-.035em' }}>
            Добро пожаловать, {user?.fullName?.split(' ')[0] || 'аналитик'}
          </Typography>
          <Typography variant="body2" color="text.secondary">Ключевые показатели и последние результаты анализа клиентской базы</Typography>
        </Box>
        <Chip icon={<AssessmentIcon />} label="RFM-аналитика" sx={{ bgcolor: '#e8f5f3', color: 'primary.dark', fontWeight: 650 }} />
      </Box>

      {statsError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setStatsRetry(value => value + 1)}>Повторить</Button>}>{statsError}</Alert>}
      {historyError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setHistoryRetry(value => value + 1)}>Повторить</Button>}>{historyError}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(card => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <Card sx={{ height: '100%', borderTop: `3px solid ${card.color}` }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Avatar sx={{ bgcolor: `${card.color}18`, color: card.color, width: 44, height: 44 }}>{card.icon}</Avatar>
                  {statsLoading ? <CircularProgress size={22} /> : <Typography variant="h5" sx={{ fontWeight: 750, textAlign: 'right', overflowWrap: 'anywhere', letterSpacing: '-.03em' }}>{card.value}</Typography>}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{card.title}</Typography>
                <Typography variant="caption" color="text.secondary">{card.description}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2.5, sm: 3 }, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}><AssessmentIcon /></Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Следующие шаги</Typography>
            </Box>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}><Button fullWidth variant="outlined" onClick={() => navigate('/import')}>Загрузить данные</Button></Grid>
              <Grid item xs={12} sm={6}><Button fullWidth variant="outlined" onClick={() => navigate('/rfm-analysis')}>Выполнить анализ</Button></Grid>
              <Grid item xs={12} sm={6}><Button fullWidth variant="outlined" onClick={() => navigate('/analysis-history')}>История анализов</Button></Grid>
              <Grid item xs={12} sm={6}><Button fullWidth variant="outlined" onClick={() => navigate('/export')}>Экспорт результата</Button></Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: { xs: 2.5, sm: 3 }, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Состояние системы</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Статус обновляется по ответу сервера статистики и базы данных.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
              <Typography>Backend и база данных</Typography>
              {statsLoading ? <CircularProgress size={20} /> : (
                <Typography color={statsError ? 'error.main' : 'success.main'} fontWeight={600}>
                  {statsError ? 'Нет ответа' : 'Подключено'}
                </Typography>
              )}
            </Box>
            <Typography variant="subtitle2">Последний анализ</Typography>
            {historyLoading ? <CircularProgress size={20} sx={{ mt: 1 }} /> : latestAnalysis ? (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2">{new Date(latestAnalysis.createdAt).toLocaleString('ru-RU')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {latestAnalysis.periodStart || 'Старый запуск'} — {latestAnalysis.periodEnd || '—'} · {latestAnalysis.clientsAnalyzed} клиентов · {latestAnalysis.status === 'completed' ? 'завершён' : 'без оценок'}
                </Typography>
                <Button size="small" sx={{ mt: 1, px: 0 }} disabled={latestAnalysis.status !== 'completed'} onClick={() => navigate(`/analyses/${latestAnalysis.id}`)}>
                  Открыть результат
                </Button>
              </Box>
            ) : historyError ? <Typography variant="body2" color="error.main">Не удалось проверить историю</Typography> : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Анализы ещё не выполнялись</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
