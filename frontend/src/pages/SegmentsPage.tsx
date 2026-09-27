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

  const getSegmentRecommendation = (rfmPattern: string): string => {
    const r = parseInt(rfmPattern[0]);
    const f = parseInt(rfmPattern[1]);
    const m = parseInt(rfmPattern[2]);

    if (r >= 4 && f >= 4 && m >= 4) {
      return 'Лояльные клиенты - предложить премиум-продукты, программу лояльности';
    }
    if (r <= 2 && f >= 4 && m >= 4) {
      return 'В зоне риска - срочно вернуть, предложить скидки, персональные предложения';
    }
    if (r >= 4 && f <= 2 && m >= 4) {
      return 'Новые ценные - вовлечь в программу лояльности, рекомендовать сопутствующие товары';
    }
    if (r <= 2 && f <= 2 && m <= 2) {
      return 'Потерянные - рассылка с промо-акциями для возобновления активности';
    }
    if (r >= 4 && f >= 4 && m <= 2) {
      return 'Частые, но мало тратят - предложить более дорогие товары, кросс-селл';
    }
    if (r <= 2 && f <= 2 && m >= 4) {
      return 'Потерянные, но ценные - персональное предложение, скидки';
    }
    return 'Стандартная стратегия работы';
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
                    <TableCell>{getSegmentRecommendation(segment.rfmPattern)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
