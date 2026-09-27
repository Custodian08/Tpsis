import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Link,
  Avatar,
  Grid,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';

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
      setError(err.response?.data?.message || 'Ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ pr: { md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: 'primary.main',
                    mr: 2,
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  RFM Analysis
                </Typography>
              </Box>
              
              <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                Анализируйте клиентов профессионально
              </Typography>
              
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.8 }}>
                Современная система для сегментации клиентской базы на основе RFM-анализа. 
                Получайте глубокие инсайты о поведении клиентов и принимайте обоснованные маркетинговые решения.
              </Typography>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
                  Возможности системы:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  <Typography component="li" variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    • Импорт данных из CSV и Excel файлов
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    • Автоматический RFM-анализ с настраиваемыми параметрами
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    • Интерактивная визуализация результатов
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
                    • Экспорт данных в различных форматах
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
              <Typography component="h1" variant="h4" align="center" gutterBottom sx={{ fontWeight: 600 }}>
                Добро пожаловать
              </Typography>
              <Typography variant="body1" align="center" sx={{ mb: 4, opacity: 0.9 }}>
                Войдите в систему для доступа к аналитике
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.9)', color: 'error.main' }}>
                  {error}
                </Alert>
              )}
              
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'white',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255,255,255,0.7)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'white',
                    },
                    '& .MuiInputBase-input': {
                      color: 'white',
                    },
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Пароль"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'white',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255,255,255,0.7)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: 'white',
                    },
                    '& .MuiInputBase-input': {
                      color: 'white',
                    },
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    bgcolor: 'white',
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.9)',
                    },
                  }}
                  disabled={loading}
                >
                  {loading ? 'Вход...' : 'Войти'}
                </Button>
                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.3)' }} />
                <Box textAlign="center">
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => navigate('/register')}
                    sx={{ color: 'white', opacity: 0.9, textDecoration: 'none', '&:hover': { opacity: 1 } }}
                  >
                    Нет аккаунта? Зарегистрироваться
                  </Link>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}