import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { rfmService } from '../services/rfm.service';
import { Segment } from '../types';

export default function VisualizationPage() {
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
      setError(err.response?.data?.message || 'Ошибка при загрузке сегментов');
    } finally {
      setLoading(false);
    }
  };

  const chartData = segments
    .filter(s => s.clientCount > 0)
    .map(s => ({
      name: s.segmentName,
      clients: s.clientCount,
      avgMonetary: s.avgMonetary,
    }))
    .sort((a, b) => b.clients - a.clients)
    .slice(0, 10);

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
        Визуализация результатов
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Графическое представление данных RFM-анализа
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Распределение клиентов по сегментам
            </Typography>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="clients" fill="#1976d2" name="Количество клиентов" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert severity="info">
                Нет данных для отображения. Сначала выполните RFM-анализ.
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Средняя ценность по сегментам
            </Typography>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgMonetary" fill="#dc004e" name="Средняя ценность (руб.)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert severity="info">
                Нет данных для отображения. Сначала выполните RFM-анализ.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
