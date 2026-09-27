import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { rfmService } from '../services/rfm.service';
import { AnalysisHistoryItem, AnalysisSegmentSummary, FilteredAnalysisResults } from '../types';

const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' });

function ScoreDistribution({
  dimension,
  segments,
  quartilesCount,
  onSelect,
}: {
  dimension: 'R' | 'F' | 'M';
  segments: AnalysisSegmentSummary[];
  quartilesCount: number;
  onSelect: (dimension: 'R' | 'F' | 'M', score: number) => void;
}) {
  const key = `${dimension.toLowerCase()}Score` as 'rScore' | 'fScore' | 'mScore';
  const distribution = Array.from({ length: quartilesCount }, (_, index) => {
    const score = index + 1;
    return {
      score,
      clients: segments.reduce((sum, segment) => sum + (segment[key] === score ? segment.clientCount : 0), 0),
    };
  });
  const meaning = dimension === 'R'
    ? '1 — давно не покупали, более высокий балл — покупка была недавно'
    : '1 — низкое значение, более высокий балл — высокое значение';
  const color = dimension === 'R' ? '#6366f1' : dimension === 'F' ? '#0ea5e9' : '#ec4899';

  return (
    <Paper sx={{ p: 2, height: 310 }}>
      <Typography variant="h6">Оценка {dimension}</Typography>
      <Typography variant="caption" color="text.secondary">{meaning}</Typography>
      <ResponsiveContainer width="100%" height="82%">
        <BarChart data={distribution} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="score" label={{ value: 'Балл', position: 'insideBottom', offset: -2 }} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={value => [`${value} клиентов`, 'Количество']} labelFormatter={score => `Оценка ${dimension}: ${score}`} />
          <Bar dataKey="clients" name="Клиенты" fill={color} cursor="pointer"
            onClick={entry => onSelect(dimension, entry.score)} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

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
      .catch(err => { if (active) setError(err.response?.data?.message || 'Не удалось загрузить историю анализов'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!analysisId) { setResults(null); return; }
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
  const topByClients = useMemo(
    () => [...(results?.segments || [])].sort((a, b) => b.clientCount - a.clientCount).slice(0, 10),
    [results?.segments],
  );
  const topByMonetary = useMemo(
    () => [...(results?.segments || [])].filter(segment => segment.monetaryShare !== null)
      .sort((a, b) => (b.monetaryShare || 0) - (a.monetaryShare || 0)).slice(0, 10),
    [results?.segments],
  );
  const matrix = useMemo(() => {
    const count = results?.analysisConfig.quartilesCount || 0;
    return Array.from({ length: count }, (_, rIndex) => Array.from({ length: count }, (_, fIndex) => {
      const rScore = count - rIndex;
      const fScore = fIndex + 1;
      const matching = results?.segments.filter(segment => segment.rScore === rScore && segment.fScore === fScore) || [];
      return { rScore, fScore, clientCount: matching.reduce((sum, segment) => sum + segment.clientCount, 0) };
    }));
  }, [results]);

  const openSegment = (pattern: string) => {
    if (analysisId) navigate(`/analyses/${analysisId}?segmentPattern=${encodeURIComponent(pattern)}`);
  };
  const openScore = (dimension: 'R' | 'F' | 'M', score: number) => {
    if (!analysisId) return;
    const key = dimension.toLowerCase();
    navigate(`/analyses/${analysisId}?min${key.toUpperCase()}=${score}&max${key.toUpperCase()}=${score}`);
  };
  const openCell = (rScore: number, fScore: number, clientCount: number) => {
    if (!analysisId || clientCount === 0) return;
    navigate(`/analyses/${analysisId}?minR=${rScore}&maxR=${rScore}&minF=${fScore}&maxF=${fScore}`);
  };

  const chartHeight = (count: number) => Math.max(320, count * 34 + 85);
  const chartLabel = (pattern: string) => results?.segments.find(segment => segment.rfmPattern === pattern)?.segmentName || pattern;

  if (loading && analyses.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Визуализация результатов</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Короткие подписи показывают RFM-код или балл. Наведите на диаграмму для пояснений, нажмите элемент для списка клиентов.
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
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}><Card><CardContent>
                  <Typography variant="body2" color="text.secondary">Клиентов в анализе</Typography>
                  <Typography variant="h5">{results.totalClients}</Typography>
                </CardContent></Card></Grid>
                <Grid item xs={12} sm={4}><Card><CardContent>
                  <Typography variant="body2" color="text.secondary">Monetary по клиентам</Typography>
                  <Typography variant="h5">{currency.format(results.totalMonetary)}</Typography>
                </CardContent></Card></Grid>
                <Grid item xs={12} sm={4}><Card><CardContent>
                  <Typography variant="body2" color="text.secondary">Непустых сегментов</Typography>
                  <Typography variant="h5">{results.segments.length}</Typography>
                </CardContent></Card></Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">Крупнейшие сегменты по числу клиентов</Typography>
                    <Typography variant="caption" color="text.secondary">Показаны 10 сегментов; по вертикали — RFM-код.</Typography>
                    <Box sx={{ height: chartHeight(topByClients.length), mt: 1 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topByClients} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="rfmPattern" width={52} tick={{ fontSize: 13 }} />
                          <Tooltip labelFormatter={pattern => `${pattern} · ${chartLabel(String(pattern))}`} formatter={(value, name) => [value, name === 'clientCount' ? 'Клиенты' : name]} />
                          <Bar dataKey="clientCount" name="Клиенты" fill="#6366f1" cursor="pointer" onClick={entry => openSegment(entry.rfmPattern)} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">Сегменты с наибольшим денежным вкладом</Typography>
                    <Typography variant="caption" color="text.secondary">Доля от Monetary всех клиентов анализа; наведите для расшифровки RFM-кода.</Typography>
                    <Box sx={{ height: chartHeight(topByMonetary.length), mt: 1 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topByMonetary} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" unit="%" />
                          <YAxis type="category" dataKey="rfmPattern" width={52} tick={{ fontSize: 13 }} />
                          <Tooltip labelFormatter={pattern => `${pattern} · ${chartLabel(String(pattern))}`} formatter={value => [`${value}%`, 'Денежный вклад']} />
                          <Bar dataKey="monetaryShare" name="Доля Monetary" fill="#ec4899" cursor="pointer" onClick={entry => openSegment(entry.rfmPattern)} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                </Grid>

                {(['R', 'F', 'M'] as const).map(dimension => (
                  <Grid item xs={12} md={6} xl={4} key={dimension}>
                    <ScoreDistribution dimension={dimension} segments={results.segments}
                      quartilesCount={results.analysisConfig.quartilesCount} onSelect={openScore} />
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">Матрица Recency × Frequency</Typography>
                    <Typography variant="caption" color="text.secondary">Число клиентов для каждой пары оценок; высокий R означает недавнюю покупку. M объединён внутри ячейки.</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: `70px repeat(${results.analysisConfig.quartilesCount}, minmax(42px, 1fr))`, gap: 0.75, mt: 2, maxWidth: 900 }}>
                      <Box />
                      {Array.from({ length: results.analysisConfig.quartilesCount }, (_, index) => (
                        <Typography key={`f-${index}`} variant="body2" align="center">F{index + 1}</Typography>
                      ))}
                      {matrix.map((row, rowIndex) => (
                        <Box key={`r-${rowIndex}`} sx={{ display: 'contents' }}>
                          <Typography variant="body2" sx={{ alignSelf: 'center' }}>R{row[0]?.rScore}</Typography>
                          {row.map(cell => (
                            <Button key={`${cell.rScore}-${cell.fScore}`} aria-label={`R ${cell.rScore}, F ${cell.fScore}: ${cell.clientCount} клиентов`}
                              disabled={cell.clientCount === 0} onClick={() => openCell(cell.rScore, cell.fScore, cell.clientCount)}
                              sx={{ minWidth: 0, minHeight: 44, color: cell.clientCount / maxCell > 0.55 ? 'white' : 'text.primary', bgcolor: `rgba(99, 102, 241, ${cell.clientCount ? 0.12 + 0.78 * cell.clientCount / maxCell : 0.035})`, '&:hover': { bgcolor: `rgba(99, 102, 241, ${cell.clientCount ? 0.2 + 0.78 * cell.clientCount / maxCell : 0.035})` } }}>
                              {cell.clientCount}
                            </Button>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
          <Button sx={{ mt: 2 }} onClick={() => navigate(`/analyses/${analysisId}`)}>Открыть таблицу клиентов</Button>
        </>
      )}
    </Box>
  );
}
