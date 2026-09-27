import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import { dataService } from '../services/data.service';
import { ImportResult } from '../types';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

function getImportErrorMessage(error: unknown, fallback: string) {
  const data = (error as any).response?.data;
  const message = getApiErrorMessage(error, fallback);
  const rowErrors = Array.isArray(data?.errors) ? data.errors.join('\n') : '';
  return rowErrors ? `${message}\n${rowErrors}` : message;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_IMPORT_SIZE_BYTES) {
        setFile(null);
        setError('Размер файла не должен превышать 10 МБ.');
        e.currentTarget.value = '';
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleImportCSV = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const data = await dataService.importCSV(file);
      setResult(data);
    } catch (err: any) {
      setError(getImportErrorMessage(err, 'Ошибка при импорте CSV'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const data = await dataService.importExcel(file);
      setResult(data);
    } catch (err: any) {
      setError(getImportErrorMessage(err, 'Ошибка при импорте Excel'));
    } finally {
      setLoading(false);
    }
  };

  const retryImport = () => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.csv')) void handleImportCSV();
    else if (/\.(xlsx|xls)$/i.test(file.name)) void handleImportExcel();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Импорт данных
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Загрузите данные о клиентах и транзакциях для анализа
      </Typography>

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Загрузка файла
        </Typography>

        <TextField
          type="file"
          fullWidth
          label="Файл с данными"
          onChange={handleFileChange}
          InputLabelProps={{ shrink: true }}
          inputProps={{ accept: '.csv,.xlsx,.xls', 'aria-label': 'Выберите файл CSV или Excel' }}
          sx={{ mb: 2 }}
        />

        {file && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={handleImportCSV}
            disabled={!file || !file.name.toLowerCase().endsWith('.csv') || loading}
            aria-busy={loading}
          >
            Импортировать CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleImportExcel}
            disabled={!file || !/\.(xlsx|xls)$/i.test(file.name) || loading}
            aria-busy={loading}
          >
            Импортировать Excel
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} action={file ? <Button color="inherit" size="small" disabled={loading} onClick={retryImport}>Повторить</Button> : undefined}>
            <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
          </Alert>
        )}

        {result && (
          <Alert severity={result.errors > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
            Импорт завершён: клиентов — {result.clientsImported}, транзакций — {result.transactionsImported}, ошибок — {result.errors}.
          </Alert>
        )}
      </Paper>

      {result && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Результаты импорта
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Показатель</TableCell>
                  <TableCell align="right">Значение</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Импортировано клиентов</TableCell>
                  <TableCell align="right">{result.clientsImported}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Импортировано транзакций</TableCell>
                  <TableCell align="right">{result.transactionsImported}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Ошибок</TableCell>
                  <TableCell align="right">{result.errors}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Формат файла
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Файл должен содержать следующие столбцы:
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Поле</TableCell>
                <TableCell>Описание</TableCell>
                <TableCell>Обязательно</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>client_id</TableCell>
                <TableCell>Уникальный идентификатор клиента</TableCell>
                <TableCell>Да</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>full_name</TableCell>
                <TableCell>Полное имя клиента</TableCell>
                <TableCell>Нет</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>email</TableCell>
                <TableCell>Email клиента</TableCell>
                <TableCell>Нет</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>phone</TableCell>
                <TableCell>Телефон клиента</TableCell>
                <TableCell>Нет</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>transaction_date</TableCell>
                <TableCell>Дата транзакции</TableCell>
                <TableCell>Да</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>amount</TableCell>
                <TableCell>Сумма покупки</TableCell>
                <TableCell>Да</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
