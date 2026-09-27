import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { OpenInNew as OpenIcon } from '@mui/icons-material';
import { AnalysisHistoryPage as HistoryPageData } from '../types';
import { rfmService } from '../services/rfm.service';

export default function AnalysisHistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryPageData | null>(null);
  const [page, setPage] = useState(0);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [appliedRange, setAppliedRange] = useState({ periodStart: '', periodEnd: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    rfmService.getAnalysisHistory({
      page: page + 1,
      pageSize: 20,
      periodStart: appliedRange.periodStart || undefined,
      periodEnd: appliedRange.periodEnd || undefined,
    }).then(result => {
      if (active) setData(result);
    }).catch(err => {
      if (active) setError(err.response?.data?.message || 'Не удалось загрузить историю анализов');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, appliedRange]);

  const applyFilters = () => {
    if (periodStart && periodEnd && periodStart > periodEnd) {
      setError('Дата начала периода не может быть позже даты окончания');
      return;
    }
    setPage(0);
    setAppliedRange({ periodStart, periodEnd });
  };

  const resetFilters = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setPage(0);
    setAppliedRange({ periodStart: '', periodEnd: '' });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>История анализов</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Сохранённые запуски RFM-анализа. Откройте запуск, чтобы повторно просмотреть сегменты и клиентов.
      </Typography>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Период анализа с"
            type="date"
            size="small"
            value={periodStart}
            onChange={event => setPeriodStart(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Период анализа по"
            type="date"
            size="small"
            value={periodEnd}
            onChange={event => setPeriodEnd(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={applyFilters}>Применить</Button>
          <Button variant="text" onClick={resetFilters}>Сбросить</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <Paper sx={{ mt: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : data?.items.length ? (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Запуск</TableCell>
                    <TableCell>Период анализа</TableCell>
                    <TableCell align="right">Квантили</TableCell>
                    <TableCell align="right">Клиенты</TableCell>
                    <TableCell>Состояние</TableCell>
                    <TableCell align="right">Результат</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map(item => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2">{new Date(item.createdAt).toLocaleString('ru-RU')}</Typography>
                        <Typography variant="caption" color="text.secondary">ID {item.id}</Typography>
                      </TableCell>
                      <TableCell>
                        {item.periodStart && item.periodEnd
                          ? `${item.periodStart} — ${item.periodEnd} (${item.analysisPeriod} дн.)`
                          : 'Период не сохранён в старом запуске'}
                      </TableCell>
                      <TableCell align="right">{item.quartilesCount}</TableCell>
                      <TableCell align="right">{item.clientsAnalyzed}</TableCell>
                      <TableCell>
                        {item.status === 'completed' ? 'Завершён' : 'Нет сохранённых оценок'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<OpenIcon />}
                          disabled={item.status !== 'completed'}
                          onClick={() => navigate(`/analyses/${item.id}`)}
                        >
                          Открыть
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data.total}
              page={page}
              rowsPerPage={20}
              rowsPerPageOptions={[20]}
              onPageChange={(_, nextPage) => setPage(nextPage)}
            />
          </>
        ) : (
          <Alert severity="info" sx={{ m: 2 }}>
            {appliedRange.periodStart || appliedRange.periodEnd
              ? 'За выбранный период запусков не найдено. Измените фильтры.'
              : 'История пока пуста. Выполните RFM-анализ, чтобы сохранить первый запуск.'}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
