import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { rfmService } from '../services/rfm.service';
import { Segment } from '../types';

export default function SegmentsPage() {
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
        Сегменты клиентов
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Подробная информация о всех сегментах и рекомендации по работе с ними
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mt: 3, p: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Сегмент</TableCell>
                <TableCell>RFM-паттерн</TableCell>
                <TableCell align="right">Количество клиентов</TableCell>
                <TableCell align="right">Средняя ценность</TableCell>
                <TableCell>Рекомендация</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {segments
                .filter(s => s.clientCount > 0)
                .sort((a, b) => b.clientCount - a.clientCount)
                .map((segment) => (
                  <TableRow key={segment.id}>
                    <TableCell>{segment.segmentName}</TableCell>
                    <TableCell>{segment.rfmPattern}</TableCell>
                    <TableCell align="right">{segment.clientCount}</TableCell>
                    <TableCell align="right">{segment.avgMonetary.toFixed(2)} руб.</TableCell>
                    <TableCell>{segment.description || 'Описание пока не сформировано'}</TableCell>
                  </TableRow>
                ))}
              {segments.filter(s => s.clientCount > 0).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {error ? 'Не удалось загрузить сегменты.' : 'Сегменты появятся после первого анализа с клиентами.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
