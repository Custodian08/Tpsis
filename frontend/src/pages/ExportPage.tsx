import { useEffect, useMemo, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { rfmService } from '../services/rfm.service';
import { AnalysisClientFilters, AnalysisClientScore, AnalysisHistoryItem, FilteredAnalysisResults } from '../types';

const emptyFilters = (): AnalysisClientFilters => ({
  search: '', segmentPattern: '', minR: null, maxR: null, minF: null, maxF: null, minM: null, maxM: null,
});
const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' });

function downloadFile(content: string, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number, protectSpreadsheetFormula = false): string {
  let text = String(value ?? '');
  if (protectSpreadsheetFormula && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default function ExportPage() {
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([]);
  const [analysisId, setAnalysisId] = useState('');
  const [filters, setFilters] = useState<AnalysisClientFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnalysisClientFilters>(emptyFilters);
  const [preview, setPreview] = useState<FilteredAnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
      .catch(err => { if (active) setError(err.response?.data?.message || 'Не удалось загрузить сохранённые анализы'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!analysisId) { setPreview(null); return; }
    let active = true;
    setLoading(true);
    rfmService.getAnalysisClients(Number(analysisId), appliedFilters, 1, 25)
      .then(data => { if (active) { setPreview(data); setError(''); } })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Не удалось загрузить результат анализа'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analysisId, appliedFilters]);

  const selectedAnalysis = analyses.find(item => String(item.id) === analysisId);
  const scoreOptions = useMemo(
    () => Array.from({ length: preview?.analysisConfig.quartilesCount || selectedAnalysis?.quartilesCount || 5 }, (_, index) => index + 1),
    [preview?.analysisConfig.quartilesCount, selectedAnalysis?.quartilesCount],
  );

  const updateFilter = (key: keyof AnalysisClientFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: key === 'search' || key === 'segmentPattern' ? value : value === '' ? null : Number(value) }));
  };

  const applyFilters = () => {
    for (const dimension of ['R', 'F', 'M'] as const) {
      const minimum = filters[`min${dimension}`];
      const maximum = filters[`max${dimension}`];
      if (minimum !== null && maximum !== null && minimum > maximum) {
        setError(`Минимальная оценка ${dimension} не может быть больше максимальной.`);
        return;
      }
    }
    setError('');
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setError('');
  };

  const loadAllScores = async (): Promise<{ summary: FilteredAnalysisResults; scores: AnalysisClientScore[] }> => {
    const id = Number(analysisId);
    const summary = await rfmService.getAnalysisClients(id, appliedFilters, 1, 100);
    const scores = [...summary.scores];
    for (let page = 2; page <= summary.totalPages; page += 1) {
      const next = await rfmService.getAnalysisClients(id, appliedFilters, page, 100);
      scores.push(...next.scores);
    }
    return { summary, scores };
  };

  const exportResults = async (format: 'csv' | 'json') => {
    if (!selectedAnalysis || !preview || preview.totalClients === 0) return;
    setExporting(true);
    setError('');
    try {
      const { summary, scores } = await loadAllScores();
      const exportedAt = new Date().toISOString();
      const baseName = `rfm_analysis_${selectedAnalysis.id}_${selectedAnalysis.periodStart || 'legacy'}_${selectedAnalysis.periodEnd || 'legacy'}`;
      if (format === 'csv') {
        const metadata = [
          ['Анализ', selectedAnalysis.configName],
          ['ID анализа', selectedAnalysis.id],
          ['Дата запуска', selectedAnalysis.createdAt],
          ['Период', `${selectedAnalysis.periodStart || '—'} — ${selectedAnalysis.periodEnd || '—'}`],
          ['Дата отсчёта Recency', selectedAnalysis.referenceDate || '—'],
          ['Количество квантилей', selectedAnalysis.quartilesCount],
          ['Версия расчёта', selectedAnalysis.scoringMethodVersion],
          ['Дата экспорта', exportedAt],
          ['Применённые фильтры', JSON.stringify(summary.filters)],
          [],
        ];
        const headers = ['ID клиента', 'Имя клиента', 'Recency (дней)', 'Frequency (транзакций)', 'Monetary (BYN)', 'Оценка R', 'Оценка F', 'Оценка M', 'RFM-паттерн'];
        const rows = scores.map(score => [
          csvCell(score.clientExternalId, true), csvCell(score.fullName, true), csvCell(score.recencyDays),
          csvCell(score.frequencyCount), csvCell(score.monetaryValue), csvCell(score.rScore), csvCell(score.fScore),
          csvCell(score.mScore), csvCell(score.rfmSegment, true),
        ].join(';'));
        const content = `\uFEFF${metadata.map(row => row.map(cell => csvCell(cell, typeof cell === 'string')).join(';')).join('\r\n')}\r\n${headers.map(header => csvCell(header, true)).join(';')}\r\n${rows.join('\r\n')}`;
        downloadFile(content, 'text/csv;charset=utf-8', `${baseName}.csv`);
      } else {
        downloadFile(JSON.stringify({
          exportedAt,
          analysis: selectedAnalysis,
          filters: summary.filters,
          totalClients: summary.totalClients,
          totalMonetary: summary.totalMonetary,
          units: { monetary: 'BYN', recency: 'days', frequency: 'transactions' },
          clients: scores,
        }, null, 2), 'application/json;charset=utf-8', `${baseName}.json`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось сформировать экспорт. Повторите попытку.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && analyses.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Экспорт результатов</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Выберите запуск и фильтры. CSV и JSON содержат детальные оценки клиентов, параметры анализа и применённые условия.
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {analyses.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>Нет сохранённых результатов для экспорта. Сначала выполните RFM-анализ.</Alert>
      ) : (
        <>
          <Paper sx={{ mt: 3, p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="export-analysis-label">Запуск анализа</InputLabel>
                  <Select labelId="export-analysis-label" label="Запуск анализа" value={analysisId} onChange={event => { setAnalysisId(event.target.value); resetFilters(); }}>
                    {analyses.map(item => <MenuItem value={String(item.id)} key={item.id}>
                      {new Date(item.createdAt).toLocaleString('ru-RU')} · {item.periodStart || 'старый запуск'} — {item.periodEnd || '—'} · {item.clientsAnalyzed} клиентов
                    </MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Поиск по имени, ID или email" value={filters.search}
                  onChange={event => updateFilter('search', event.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="export-segment-label">Сегмент</InputLabel>
                  <Select labelId="export-segment-label" label="Сегмент" value={filters.segmentPattern} onChange={event => updateFilter('segmentPattern', event.target.value)}>
                    <MenuItem value="">Все сегменты</MenuItem>
                    {preview?.segments.map(segment => <MenuItem key={segment.rfmPattern} value={segment.rfmPattern}>{segment.segmentName} ({segment.rfmPattern})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {(['R', 'F', 'M'] as const).map(dimension => (
                <Grid item xs={12} sm={4} key={dimension}>
                  <Typography variant="caption" color="text.secondary">Оценка {dimension}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {(['min', 'max'] as const).map(bound => {
                      const key = `${bound}${dimension}` as keyof AnalysisClientFilters;
                      return <FormControl fullWidth key={bound}>
                        <InputLabel>{bound === 'min' ? 'От' : 'До'}</InputLabel>
                        <Select label={bound === 'min' ? 'От' : 'До'} value={filters[key] ?? ''} onChange={event => updateFilter(key, String(event.target.value))}>
                          <MenuItem value="">Любая</MenuItem>
                          {scoreOptions.map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}
                        </Select>
                      </FormControl>;
                    })}
                  </Box>
                </Grid>
              ))}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" onClick={applyFilters}>Применить фильтры</Button>
                  <Button onClick={resetFilters}>Сбросить</Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={28} /></Box> : preview && (
            <Paper sx={{ mt: 2, p: 3 }}>
              <Typography variant="h6">К экспорту: {preview.totalClients} клиентов · {currency.format(preview.totalMonetary)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Выгружается полный результат для заданных фильтров, не только текущая страница таблицы.
              </Typography>
              {preview.totalClients === 0 && <Alert severity="info" sx={{ mb: 2 }}>По этим фильтрам нет данных для выгрузки.</Alert>}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button variant="contained" startIcon={<DownloadIcon />} fullWidth size="large"
                    disabled={exporting || preview.totalClients === 0} onClick={() => exportResults('csv')}>
                    {exporting ? 'Формирование…' : 'Скачать CSV для таблиц'}
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button variant="outlined" startIcon={<DownloadIcon />} fullWidth size="large"
                    disabled={exporting || preview.totalClients === 0} onClick={() => exportResults('json')}>
                    {exporting ? 'Формирование…' : 'Скачать JSON'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
