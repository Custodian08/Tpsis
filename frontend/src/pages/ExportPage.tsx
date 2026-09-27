import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { rfmService } from '../services/rfm.service';
import { Segment } from '../types';

export default function ExportPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const data = await rfmService.getSegments();
      setSegments(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Сегмент', 'RFM-паттерн', 'Количество клиентов', 'Средняя ценность', 'Описание'];
    const rows = segments
      .filter(s => s.clientCount > 0)
      .map(s => [
        s.segmentName,
        s.rfmPattern,
        s.clientCount,
        s.avgMonetary.toFixed(2),
        s.description || '',
      ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rfm_segments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const data = segments.filter(s => s.clientCount > 0);
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rfm_segments_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Экспорт данных
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Скачайте результаты RFM-анализа в различных форматах
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Экспорт в CSV
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Экспортируйте данные о сегментах в формате CSV для использования в Excel или других табличных редакторах.
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={exportToCSV}
              fullWidth
              size="large"
            >
              Скачать CSV
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Экспорт в JSON
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Экспортируйте данные в формате JSON для использования в программных системах и API интеграциях.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportToJSON}
              fullWidth
              size="large"
            >
              Скачать JSON
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Информация о доступных данных
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Количество сегментов с данными: {segments.filter(s => s.clientCount > 0).length}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Общее количество клиентов: {segments.reduce((sum, s) => sum + s.clientCount, 0)}
        </Typography>
      </Paper>
    </Box>
  );
}
