import React, { useState } from 'react';
import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import { ArrowForward, AutoGraph, Insights, QueryStats } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError('Пароли не совпадают');
    if (password.length < 8) return setError('Пароль должен содержать минимум 8 символов');
    if (new TextEncoder().encode(password).length > 72) return setError('Пароль слишком длинный: максимум 72 байта в UTF-8');
    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Не удалось создать учётную запись.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 0.9fr) 1.1fr' }, bgcolor: 'white' }}>
      <Box sx={{ position: 'relative', overflow: 'hidden', display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: { md: 5, lg: 8 }, color: 'white', background: 'linear-gradient(145deg, #14243a 0%, #1a3850 58%, #0f766e 150%)' }}>
        <Box sx={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)', top: '23%', left: '50%', boxShadow: '0 0 0 55px rgba(255,255,255,0.025), 0 0 0 110px rgba(255,255,255,0.02)' }} />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.25 }}><Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: '#14b8a6' }}><AutoGraph /></Box><Box><Typography fontWeight={750} letterSpacing="-.02em">RFM Studio</Typography><Typography variant="caption" sx={{ color: '#b5c6d2' }}>АНАЛИТИКА КЛИЕНТОВ</Typography></Box></Box>
        <Box sx={{ position: 'relative', maxWidth: 560, py: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#5eead4', mb: 2 }}><Insights /><Typography variant="overline" fontWeight={700} letterSpacing=".1em">ВАША АНАЛИТИКА НАЧИНАЕТСЯ ЗДЕСЬ</Typography></Box>
          <Typography variant="h2" sx={{ maxWidth: 520, color: 'white', lineHeight: 1.12, mb: 2.5 }}>Превратите данные в ясные решения.</Typography>
          <Typography sx={{ color: '#c1cfdb', lineHeight: 1.8, maxWidth: 500 }}>Единое пространство для импорта клиентских данных, RFM-сегментации и интерактивного изучения результатов.</Typography>
        </Box>
        <Typography variant="caption" sx={{ position: 'relative', color: '#9eb0c1' }}>RFM Studio · клиентская аналитика</Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, sm: 4 }, py: 4, bgcolor: '#f7f9fb' }}>
        <Container maxWidth="sm" sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}><Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: 'primary.main', color: 'white' }}><AutoGraph /></Box><Typography fontWeight={750}>RFM Studio</Typography></Box></Container>
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 4 }, border: '1px solid #e7edf3', boxShadow: '0 18px 55px rgba(23,43,77,.07)' }}>
          <Typography variant="overline" fontWeight={700} letterSpacing=".1em" color="primary.main">НОВАЯ УЧЁТНАЯ ЗАПИСЬ</Typography>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 750, mt: .5 }}>Создать аккаунт</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>Заполните данные, чтобы начать работу.</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField margin="dense" required fullWidth id="fullName" label="Имя и фамилия" name="fullName" autoComplete="name" autoFocus value={fullName} onChange={e => setFullName(e.target.value)} />
            <TextField margin="dense" required fullWidth id="email" label="Электронная почта" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            <TextField margin="dense" required fullWidth name="password" label="Пароль" type="password" helperText="Минимум 8 символов; максимум 72 байта UTF-8" id="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
            <TextField margin="dense" required fullWidth name="confirmPassword" label="Повторите пароль" type="password" id="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <Button type="submit" fullWidth variant="contained" endIcon={<ArrowForward />} sx={{ mt: 2.5, py: 1.35 }} disabled={loading}>{loading ? 'Создание аккаунта…' : 'Зарегистрироваться'}</Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .5, mt: 2.5, pt: 2, borderTop: '1px solid #edf1f5' }}>
            <Typography variant="body2" color="text.secondary">Уже есть аккаунт?</Typography>
            <Button variant="text" size="small" onClick={() => navigate('/login')}>Войти</Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .75, mt: 1.5, color: 'text.secondary' }}><QueryStats sx={{ fontSize: 16 }} /><Typography variant="caption">Ваши данные защищены</Typography></Box>
        </Paper>
      </Box>
    </Box>
  );
}
