import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { ArrowBack as BackIcon } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalysisClientDetail, AnalysisClientFilters, FilteredAnalysisResults } from '../types';
import { rfmService } from '../services/rfm.service';

const initialFilters = (): AnalysisClientFilters => ({
  search: '',
  segmentPattern: '',
  minR: null,
  maxR: null,
  minF: null,
  maxF: null,
  minM: null,
  maxM: null,
});

const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' });

export default function AnalysisResultPage() {
  const { configId: configIdParam } = useParams();
  const navigate = useNavigate();
  const configId = Number(configIdParam);
  const [data, setData] = useState<FilteredAnalysisResults | null>(null);
  const [filters, setFilters] = useState<AnalysisClientFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnalysisClientFilters>(initialFilters);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientDetail, setClientDetail] = useState<AnalysisClientDetail | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(configId) || configId <= 0) {
      setError('Некорректный номер анализа');
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    rfmService.getAnalysisClients(configId, appliedFilters, page + 1, 25)
      .then(result => { if (active) setData(result); })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'Не удалось загрузить результат анализа');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [configId, appliedFilters, page]);

  useEffect(() => {
    let active = true;
    if (selectedClientId === null) {
      setClientDetail(null);
      return () => { active = false; };
    }
    setClientLoading(true);
    setClientError('');
    rfmService.getAnalysisClient(configId, selectedClientId)
      .then(detail => { if (active) setClientDetail(detail); })
      .catch(err => {
        if (active) setClientError(err.response?.data?.message || 'Не удалось загрузить карточку клиента');
      })
      .finally(() => { if (active) setClientLoading(false); });
    return () => { active = false; };
  }, [configId, selectedClientId]);

  const levels = useMemo(
    () => Array.from({ length: data?.analysisConfig.quartilesCount || 5 }, (_, index) => index + 1),
    [data?.analysisConfig.quartilesCount],
  );

  const setScoreFilter = (field: keyof AnalysisClientFilters, value: string) => {
    setFilters(current => ({ ...current, [field]: value === '' ? null : Number(value) }));
  };

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    const cleared = initialFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(0);
  };

  const chooseSegment = (pattern: string) => {
    const next = { ...appliedFilters, segmentPattern: pattern };
    setFilters(next);
    setAppliedFilters(next);
    setPage(0);
  };

  const filterSelect = (label: string, minField: keyof AnalysisClientFilters, maxField: keyof AnalysisClientFilters) => (
    <Grid item xs={12} sm={4}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel>От</InputLabel>
          <Select
            label="От"
            value={filters[minField] ?? ''}
            onChange={event => setScoreFilter(minField, String(event.target.value))}
          >
            <MenuItem value="">Любая</MenuItem>
            {levels.map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>До</InputLabel>
          <Select
            label="До"
            value={filters[maxField] ?? ''}
            onChange={event => setScoreFilter(maxField, String(event.target.value))}
          >
            <MenuItem value="">Любая</MenuItem>
            {levels.map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
    </Grid>
  );

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/analysis-history')} sx={{ mb: 1 }}>
        К истории анализов
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : data ? (
        <>
          <Typography variant="h4" gutterBottom>{data.analysisConfig.configName}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Период: {data.analysisConfig.periodStart || '—'} — {data.analysisConfig.periodEnd || '—'} ·{' '}
            дата отсчёта Recency: {data.analysisConfig.referenceDate || '—'} ·{' '}
            квантилей: {data.analysisConfig.quartilesCount} · метод: {data.analysisConfig.scoringMethodVersion}
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card><CardContent>
                <Typography color="text.secondary" variant="body2">Клиентов по фильтру</Typography>
                <Typography variant="h5">{data.totalClients}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card><CardContent>
                <Typography color="text.secondary" variant="body2">Сумма Monetary по фильтру</Typography>
                <Typography variant="h5">{currency.format(data.totalMonetary)}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card><CardContent>
                <Typography color="text.secondary" variant="body2">Сегментов в выборке</Typography>
                <Typography variant="h5">{data.segments.length}</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Фильтры клиентов</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Поиск по имени, ID или email"
                  value={filters.search}
                  onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
                  onKeyDown={event => { if (event.key === 'Enter') applyFilters(); }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Сегмент</InputLabel>
                  <Select
                    label="Сегмент"
                    value={filters.segmentPattern}
                    onChange={event => setFilters(current => ({ ...current, segmentPattern: event.target.value }))}
                  >
                    <MenuItem value="">Все сегменты</MenuItem>
                    {data.segments.map(segment => (
                      <MenuItem key={segment.rfmPattern} value={segment.rfmPattern}>
                        {segment.segmentName} ({segment.rfmPattern})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {filterSelect('Recency', 'minR', 'maxR')}
              {filterSelect('Frequency', 'minF', 'maxF')}
              {filterSelect('Monetary', 'minM', 'maxM')}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" onClick={applyFilters}>Применить фильтры</Button>
                  <Button variant="text" onClick={resetFilters}>Сбросить</Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {data.segments.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 2, height: 360 }}>
                  <Typography variant="h6" gutterBottom>Доля клиентов по сегментам</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={data.segments} margin={{ bottom: 50, left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segmentName" angle={-30} textAnchor="end" interval={0} height={75} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Bar dataKey="clientShare" name="Клиенты" fill="#6366f1" cursor="pointer"
                        onClick={entry => chooseSegment(entry.rfmPattern)} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 2, height: 360 }}>
                  <Typography variant="h6" gutterBottom>Денежный вклад по сегментам</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={data.segments} margin={{ bottom: 50, left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segmentName" angle={-30} textAnchor="end" interval={0} height={75} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => currency.format(value)} />
                      <Legend />
                      <Bar dataKey="monetaryTotal" name="Monetary" fill="#ec4899" cursor="pointer"
                        onClick={entry => chooseSegment(entry.rfmPattern)} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          <Paper>
            <Box sx={{ p: 2, pb: 0 }}>
              <Typography variant="h6">Клиенты анализа</Typography>
              <Typography variant="body2" color="text.secondary">
                Нажмите на строку, чтобы увидеть профиль и покупки в периоде.
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={28} /></Box>
            ) : data.scores.length ? (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Клиент</TableCell>
                        <TableCell>Сегмент</TableCell>
                        <TableCell align="right">R</TableCell>
                        <TableCell align="right">F</TableCell>
                        <TableCell align="right">M</TableCell>
                        <TableCell align="right">Давность, дн.</TableCell>
                        <TableCell align="right">Транзакции</TableCell>
                        <TableCell align="right">Monetary</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.scores.map(score => (
                        <TableRow
                          key={score.id}
                          hover
                          onClick={() => setSelectedClientId(score.clientId)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            {score.fullName || score.clientExternalId}
                            {score.fullName && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{score.clientExternalId}</Typography>}
                          </TableCell>
                          <TableCell>{score.rfmSegment}</TableCell>
                          <TableCell align="right">{score.rScore}</TableCell>
                          <TableCell align="right">{score.fScore}</TableCell>
                          <TableCell align="right">{score.mScore}</TableCell>
                          <TableCell align="right">{score.recencyDays}</TableCell>
                          <TableCell align="right">{score.frequencyCount}</TableCell>
                          <TableCell align="right">{currency.format(score.monetaryValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={data.totalClients}
                  page={page}
                  rowsPerPage={25}
                  rowsPerPageOptions={[25]}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                />
              </>
            ) : (
              <Alert severity="info" sx={{ m: 2 }}>
                {appliedFilters.search || appliedFilters.segmentPattern || appliedFilters.minR !== null ||
                appliedFilters.maxR !== null || appliedFilters.minF !== null || appliedFilters.maxF !== null ||
                appliedFilters.minM !== null || appliedFilters.maxM !== null
                  ? 'По заданным фильтрам клиенты не найдены. Измените условия или сбросьте фильтры.'
                  : 'В этом запуске нет сохранённых результатов клиентов.'}
              </Alert>
            )}
          </Paper>
        </>
      ) : null}

      <Dialog open={selectedClientId !== null} onClose={() => setSelectedClientId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Карточка клиента</DialogTitle>
        <DialogContent>
          {clientLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : clientError ? (
            <Alert severity="error">{clientError}</Alert>
          ) : clientDetail ? (
            <>
              <Typography variant="h6">{clientDetail.client.fullName || clientDetail.client.clientExternalId}</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                ID: {clientDetail.client.clientExternalId} · {clientDetail.client.email || 'email не указан'} ·{' '}
                {clientDetail.client.phone || 'телефон не указан'}
              </Typography>
              <Grid container spacing={1} sx={{ my: 1 }}>
                <Grid item xs={6} md={3}><Typography variant="body2">Сегмент: {clientDetail.rfm.segmentName}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="body2">R/F/M: {clientDetail.rfm.rScore}/{clientDetail.rfm.fScore}/{clientDetail.rfm.mScore}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="body2">Транзакций: {clientDetail.rfm.frequencyCount}</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="body2">Monetary: {currency.format(clientDetail.rfm.monetaryValue)}</Typography></Grid>
              </Grid>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>Покупки в периоде анализа</Typography>
              {!clientDetail.analysisConfig.periodStart || !clientDetail.analysisConfig.periodEnd ? (
                <Alert severity="info" sx={{ mt: 1 }}>У старого запуска не сохранены границы периода.</Alert>
              ) : clientDetail.transactions.length ? (
                <>
                  {clientDetail.transactionsTruncated && (
                    <Alert severity="info" sx={{ my: 1 }}>
                      Показаны последние 100 из {clientDetail.transactionsTotal} транзакций.
                    </Alert>
                  )}
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>Дата</TableCell><TableCell align="right">Сумма</TableCell>
                        <TableCell align="right">Товаров</TableCell><TableCell>Оплата</TableCell>
                      </TableRow></TableHead>
                      <TableBody>{clientDetail.transactions.map(transaction => (
                        <TableRow key={transaction.id}>
                          <TableCell>{transaction.transactionDate}</TableCell>
                          <TableCell align="right">{currency.format(transaction.amount)}</TableCell>
                          <TableCell align="right">{transaction.itemsCount}</TableCell>
                          <TableCell>{transaction.paymentMethod || '—'}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>Покупки за сохранённый период не найдены.</Alert>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
