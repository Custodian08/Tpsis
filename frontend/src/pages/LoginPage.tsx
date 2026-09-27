import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Container, Paper, TextField, Typography } from '@mui/material';
import { ArrowForward, AutoGraph, Insights, QueryStats, ShieldOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Не удалось выполнить вход.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 0.9fr) 1.1fr' }, bgcolor: 'white' }}>
      <Box sx={{ position: 'relative', overflow: 'hidden', display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: { md: 5, lg: 8 }, color: 'white', background: 'linear-gradient(145deg, #14243a 0%, #1a3850 58%, #0f766e 150%)' }}>
        <Box sx={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)', top: '23%', left: '50%', boxShadow: '0 0 0 55px rgba(255,255,255,0.025), 0 0 0 110px rgba(255,255,255,0.02)' }} />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: '#14b8a6' }}><AutoGraph /></Box>
          <Box><Typography fontWeight={750} letterSpacing="-.02em">RFM Studio</Typography><Typography variant="caption" sx={{ color: '#b5c6d2' }}>АНАЛИТИКА КЛИЕНТОВ</Typography></Box>
        </Box>
        <Box sx={{ position: 'relative', maxWidth: 560, py: 5 }}>
          <Chip icon={<Insights sx={{ color: '#5eead4 !important' }} />} label="Платформа клиентской аналитики" sx={{ mb: 3, bgcolor: 'rgba(255,255,255,.09)', color: '#d9f7f3', border: '1px solid rgba(255,255,255,.1)' }} />
          <Typography variant="h2" sx={{ maxWidth: 520, color: 'white', lineHeight: 1.12, mb: 2.5 }}>Понимайте клиентов. Действуйте точнее.</Typography>
          <Typography sx={{ color: '#c1cfdb', lineHeight: 1.8, maxWidth: 500 }}>Сегментируйте клиентскую базу, находите точки роста и оценивайте результаты на основе RFM-анализа.</Typography>
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', mt: 4 }}>
            {['Импорт данных', 'RFM-сегментация', 'Интерактивные отчёты'].map(item => <Chip key={item} label={item} variant="outlined" sx={{ color: '#d5e2ea', borderColor: 'rgba(255,255,255,.22)' }} />)}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ position: 'relative', color: '#9eb0c1' }}>Аналитика, которая помогает принимать решения</Typography>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, sm: 4 }, py: 5, bgcolor: '#f7f9fb' }}>
        <Container maxWidth="sm" sx={{ display: { xs: 'block', md: 'none' }, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}><Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'white' }}><AutoGraph /></Box><Typography fontWeight={750}>RFM Studio</Typography></Box>
        </Container>
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4.5 }, border: '1px solid #e7edf3', boxShadow: '0 18px 55px rgba(23,43,77,.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', mb: 2 }}><ShieldOutlined fontSize="small" /><Typography variant="overline" fontWeight={700} letterSpacing=".1em">ЛИЧНЫЙ КАБИНЕТ</Typography></Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 750, mb: 1 }}>С возвращением</Typography>
          <Typography color="text.secondary" sx={{ mb: 3.5 }}>Войдите, чтобы продолжить работу с аналитикой.</Typography>
          {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField margin="normal" required fullWidth id="email" label="Электронная почта" name="email" type="email" autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} />
            <TextField margin="normal" required fullWidth name="password" label="Пароль" type="password" id="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            <Button type="submit" fullWidth variant="contained" endIcon={<ArrowForward />} sx={{ mt: 3, py: 1.35 }} disabled={loading}>{loading ? 'Выполняется вход…' : 'Войти в систему'}</Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .5, mt: 3, pt: 2.5, borderTop: '1px solid #edf1f5' }}>
            <Typography variant="body2" color="text.secondary">Впервые здесь?</Typography>
            <Button variant="text" size="small" onClick={() => navigate('/register')}>Создать аккаунт</Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .75, mt: 2, color: 'text.secondary' }}><QueryStats sx={{ fontSize: 16 }} /><Typography variant="caption">Анализируйте клиентскую базу уверенно</Typography></Box>
        </Paper>
      </Box>
    </Box>
  );
}
