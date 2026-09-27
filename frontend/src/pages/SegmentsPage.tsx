import { useEffect, useMemo, useState } from 'react';
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
  TableSortLabel,
  Typography,
} from '@mui/material';
import { rfmService } from '../services/rfm.service';
import { Segment } from '../types';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

type SortField = 'segmentName' | 'clientCount' | 'avgMonetary';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('clientCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    rfmService.getSegments().then(data => {
      if (active) setSegments(data.filter(segment => segment.clientCount > 0));
    }).catch(err => {
      if (active) setError(getApiErrorMessage(err, 'Не удалось загрузить сегменты.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const sortedSegments = useMemo(() => [...segments].sort((left, right) => {
    const a = left[sortField];
    const b = right[sortField];
    const comparison = typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, 'ru')
      : Number(a) - Number(b);
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [segments, sortField, sortDirection]);
  const pageRows = sortedSegments.slice(page * 25, page * 25 + 25);

  const sortBy = (field: SortField) => {
    if (sortField === field) setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection(field === 'segmentName' ? 'asc' : 'desc'); }
    setPage(0);
  };

  const sortableHeader = (field: SortField, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell align={align} sortDirection={sortField === field ? sortDirection : false}>
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDirection : 'asc'}
        onClick={() => sortBy(field)}
      >{label}</TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Сегменты клиентов</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Сводка сегментов последнего анализа. Нажмите заголовок столбца, чтобы изменить сортировку.
      </Typography>

      {error && <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" onClick={() => setReload(value => value + 1)}>Повторить</Button>}>{error}</Alert>}

      <Paper sx={{ mt: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : segments.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>
            {error ? 'Не удалось получить сегменты.' : 'Сегменты появятся после первого RFM-анализа с клиентами.'}
          </Alert>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 650 }}>
              <Table stickyHeader size="small" aria-label="Сегменты последнего RFM-анализа">
                <TableHead>
                  <TableRow>
                    {sortableHeader('segmentName', 'Сегмент')}
                    <TableCell>RFM-паттерн</TableCell>
                    {sortableHeader('clientCount', 'Клиенты', 'right')}
                    {sortableHeader('avgMonetary', 'Среднее Monetary, BYN', 'right')}
                    <TableCell sx={{ minWidth: 260 }}>Описание</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map(segment => (
                    <TableRow key={segment.id} hover>
                      <TableCell sx={{ minWidth: 210, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{segment.segmentName}</TableCell>
                      <TableCell>{segment.rfmPattern}</TableCell>
                      <TableCell align="right">{segment.clientCount.toLocaleString('ru-RU')}</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(segment.avgMonetary)}</TableCell>
                      <TableCell sx={{ minWidth: 260, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{segment.description || 'Описание пока не сформировано'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={segments.length}
              page={page}
              rowsPerPage={25}
              rowsPerPageOptions={[25]}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
