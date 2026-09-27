import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Slider,
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import { rfmService } from '../services/rfm.service';
import { AnalysisResult } from '../types';

export default function RfmAnalysisPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quartilesCount, setQuartilesCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!startDate || !endDate) {
      setError('Выберите период анализа');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await rfmService.analyze({
        startDate,
        endDate,
        quartilesCount,
      });
      setResult(data);
      navigate(`/analyses/${data.analysisConfigId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при выполнении анализа');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultPeriod = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6); // 6 месяцев назад

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        RFM-анализ
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Выполните сегментацию клиентов на основе их поведения
      </Typography>

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Параметры анализа
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Дата начала"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Дата окончания"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <Button
              variant="outlined"
              onClick={setDefaultPeriod}
              fullWidth
              sx={{ height: '56px' }}
            >
              Последние 6 месяцев
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Typography gutterBottom>
              Количество квантилей: {quartilesCount}
            </Typography>
            <Slider
              value={quartilesCount}
              onChange={(_, value) => setQuartilesCount(value as number)}
              min={3}
              max={10}
              marks
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<AnalyticsIcon />}
              onClick={handleAnalyze}
              disabled={loading}
              fullWidth
              size="large"
            >
              {loading ? 'Анализ...' : 'Выполнить анализ'}
            </Button>
          </Grid>
        </Grid>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {result && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Результаты анализа
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            Анализ завершен успешно! Проанализировано клиентов: {result.clientsAnalyzed}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Период: {result.analysisConfig.periodStart} — {result.analysisConfig.periodEnd} ·{' '}
            дней: {result.analysisConfig.analysisPeriod} · квантилей: {result.analysisConfig.quartilesCount} ·{' '}
            дата отсчёта Recency: {result.analysisConfig.referenceDate} ·{' '}
            метод: {result.analysisConfig.scoringMethodVersion}
          </Typography>

          {result.interpretation && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Интеллектуальная интерпретация
              </Typography>
              <Alert
                severity={result.interpretation.status === 'available' ? 'info' : 'warning'}
                sx={{ mb: 2 }}
              >
                {result.interpretation.summary}
              </Alert>
              {result.interpretation.insights.length > 0 && (
                <>
                  <Typography variant="subtitle2">Наблюдения</Typography>
                  <Box component="ul" sx={{ mt: 1, mb: 2, pl: 3 }}>
                    {result.interpretation.insights.map((insight, index) => (
                      <Typography component="li" variant="body2" key={index} sx={{ mb: 0.5 }}>
                        {insight}
                      </Typography>
                    ))}
                  </Box>
                </>
              )}
              {result.interpretation.recommendations.length > 0 && (
                <>
                  <Typography variant="subtitle2">Что проверить аналитику</Typography>
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 3 }}>
                    {result.interpretation.recommendations.map((recommendation, index) => (
                      <Typography component="li" variant="body2" key={index} sx={{ mb: 0.5 }}>
                        {recommendation}
                      </Typography>
                    ))}
                  </Box>
                </>
              )}
            </Paper>
          )}

          <Typography variant="subtitle1" gutterBottom>
            Сегменты (топ-10 по количеству клиентов)
          </Typography>
          {result.segments.slice(0, 10).map((segment) => (
            <Box key={segment.segmentName} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2">
                {segment.segmentName} ({segment.rfmPattern})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Клиентов: {segment.clientCount} | Средняя ценность: {segment.avgMonetary.toFixed(2)} руб.
              </Typography>
            </Box>
          ))}
        </Paper>
      )}

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          О RFM-анализе
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          RFM-анализ - это метод сегментации клиентов по трем критериям:
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Recency (R)</strong> - Давность последней покупки. Чем меньше дней прошло с последней покупки, тем выше оценка.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Frequency (F)</strong> - Число транзакций клиента в выбранном периоде. Чем больше транзакций, тем выше оценка.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Monetary (M)</strong> - Денежная ценность. Чем больше денег потратил клиент, тем выше оценка.
        </Typography>
      </Paper>
    </Box>
  );
}
