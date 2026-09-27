import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
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
import { rfmService } from '../services/rfm.service';
import { AnalysisHistoryItem, FilteredAnalysisResults } from '../types';

export default function VisualizationPage() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([]);
  const [analysisId, setAnalysisId] = useState('');
  const [results, setResults] = useState<FilteredAnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    rfmService.getAnalysisHistory({ page: 1, pageSize: 100 })
      .then(history => {
        if (!active) return;
        const completed = history.items.filter(item => item.status === 'completed');
        setAnalyses(completed);
        setAnalysisId(current => current || String(completed[0]?.id || ''));
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'Не удалось загрузить историю анализов');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!analysisId) {
      setResults(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    rfmService.getAnalysisClients(Number(analysisId), {
      search: '', segmentPattern: '', minR: null, maxR: null, minF: null, maxF: null, minM: null, maxM: null,
    }, 1, 25)
      .then(data => { if (active) setResults(data); })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Не удалось загрузить результат анализа'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analysisId]);

  const maxCell = useMemo(
    () => Math.max(1, ...(results?.segments.map(segment => segment.clientCount) || [1])),
    [results?.segments],
  );

  const matrix = useMemo(() => {
    const count = results?.analysisConfig.quartilesCount || 0;
    return Array.from({ length: count }, (_, rIndex) => Array.from({ length: count }, (_, fIndex) => {
      const rScore = count - rIndex;
      const fScore = fIndex + 1;
      const segments = results?.segments.filter(segment => segment.rScore === rScore && segment.fScore === fScore) || [];
      return { rScore, fScore, clientCount: segments.reduce((sum, segment) => sum + segment.clientCount, 0) };
    }));
  }, [results]);

  const openCell = (rScore: number, fScore: number, clientCount: number) => {
    if (!analysisId || clientCount === 0) return;
    const params = new URLSearchParams({ minR: String(rScore), maxR: String(rScore), minF: String(fScore), maxF: String(fScore) });
    navigate(`/analyses/${analysisId}?${params.toString()}`);
  };

  if (loading && analyses.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Интерактивная визуализация</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Выберите сохранённый запуск. Нажмите сегмент на диаграмме или ячейку R×F, чтобы открыть отфильтрованный список клиентов.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {analyses.length > 0 && (
        <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
          <InputLabel id="visual-analysis-label">Запуск анализа</InputLabel>
          <Select labelId="visual-analysis-label" label="Запуск анализа" value={analysisId} onChange={event => setAnalysisId(event.target.value)}>
            {analyses.map(item => (
              <MenuItem value={String(item.id)} key={item.id}>
                {new Date(item.createdAt).toLocaleString('ru-RU')} · {item.periodStart || 'старый запуск'} — {item.periodEnd || '—'} · {item.clientsAnalyzed} клиентов
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {!loading && analyses.length === 0 && !error && (
        <Alert severity="info">Пока нет сохранённых запусков с результатами. Сначала выполните RFM-анализ.</Alert>
      )}
      {loading && results && <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={28} /></Box>}

      {results && !loading && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1">{results.analysisConfig.configName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Период: {results.analysisConfig.periodStart || '—'} — {results.analysisConfig.periodEnd || '—'} · дата отсчёта: {results.analysisConfig.referenceDate || '—'} · квантилей: {results.analysisConfig.quartilesCount}
            </Typography>
          </Paper>

          {results.segments.length === 0 ? (
            <Alert severity="info">В этом запуске нет результатов для визуализации.</Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, height: 390 }}>
                  <Typography variant="h6" gutterBottom>Клиенты по сегментам — нажмите столбец для детализации</Typography>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={results.segments} margin={{ bottom: 54, left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segmentName" angle={-28} textAnchor="end" interval={0} height={70} />
                      <YAxis />
                      <Tooltip formatter={(value: number, name: string) => name === 'Доля клиентов' ? `${value}%` : value} />
                      <Legend />
                      <Bar dataKey="clientShare" name="Доля клиентов" fill="#6366f1" cursor="pointer"
                        onClick={entry => {
                          const item = results.segments.find(segment => segment.rfmPattern === entry.rfmPattern);
                          if (item) navigate(`/analyses/${analysisId}?segmentPattern=${encodeURIComponent(item.rfmPattern)}`);
                        }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={7}>
                <Paper sx={{ p: 2, height: 390 }}>
                  <Typography variant="h6" gutterBottom>Доля денежного вклада по сегментам</Typography>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={results.segments} margin={{ bottom: 54, left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segmentName" angle={-28} textAnchor="end" interval={0} height={70} />
                      <YAxis />
                      <Tooltip formatter={value => value === null || value === undefined ? 'Нет денежного вклада' : `${value}%`} />
                      <Legend />
                      <Bar dataKey="monetaryShare" name="Доля Monetary" fill="#ec4899" cursor="pointer"
                        onClick={entry => navigate(`/analyses/${analysisId}?segmentPattern=${encodeURIComponent(entry.rfmPattern)}`)} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={5}>
                <Paper sx={{ p: 2, height: 390, overflow: 'auto' }}>
                  <Typography variant="h6" gutterBottom>Карта R×F</Typography>
                  <Typography variant="caption" color="text.secondary">Клиенты по оценкам; клик открывает список. M учитывается в сумме ячейки.</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: `56px repeat(${results.analysisConfig.quartilesCount}, minmax(30px, 1fr))`, gap: 0.5, mt: 2, minWidth: 300 }}>
                    <Box />
                    {Array.from({ length: results.analysisConfig.quartilesCount }, (_, index) => (
                      <Typography key={`f-${index}`} variant="caption" align="center">F{index + 1}</Typography>
                    ))}
                    {matrix.map((row, rowIndex) => (
                      <Box key={`r-${rowIndex}`} sx={{ display: 'contents' }}>
                        <Typography variant="caption" sx={{ alignSelf: 'center' }}>R{row[0]?.rScore}</Typography>
                        {row.map(cell => (
                          <Button key={`${cell.rScore}-${cell.fScore}`} aria-label={`R ${cell.rScore}, F ${cell.fScore}: ${cell.clientCount} клиентов`}
                            disabled={cell.clientCount === 0} onClick={() => openCell(cell.rScore, cell.fScore, cell.clientCount)}
                            sx={{ minWidth: 0, p: 0.5, color: cell.clientCount / maxCell > 0.55 ? 'white' : 'text.primary', bgcolor: `rgba(99, 102, 241, ${cell.clientCount ? 0.12 + 0.78 * cell.clientCount / maxCell : 0.035})`, '&:hover': { bgcolor: `rgba(99, 102, 241, ${cell.clientCount ? 0.2 + 0.78 * cell.clientCount / maxCell : 0.035})` } }}>
                            {cell.clientCount}
                          </Button>
                        ))}
                      </Box>
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Столбцы — оценка Frequency, строки — Recency (вверху более высокая оценка).</Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
          <Button sx={{ mt: 2 }} onClick={() => navigate(`/analyses/${analysisId}`)}>Открыть таблицу клиентов</Button>
        </>
      )}
    </Box>
  );
}
