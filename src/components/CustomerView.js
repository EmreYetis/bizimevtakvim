import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { tr } from 'date-fns/locale';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const rooms = [
  'İnceburun',
  'Gökliman',
  'Armutlusu',
  'Çetisuyu',
  'İncirliin',
  'Hurmalıbük',
  'Kızılbük',
  'Değirmenbükü',
  'İskaroz',
  'İskorpit',
  'Lopa'
];

function CustomerView() {
  const theme = useTheme();
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [bookedDates, setBookedDates] = useState({});

  useEffect(() => {
    const bookingsRef = collection(db, 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const bookings = {};
      snapshot.forEach(doc => {
        bookings[doc.id] = doc.data();
      });
      setBookedDates(bookings);
    }, (error) => {
      console.error('Rezervasyon dinleyicisinde hata:', error);
    });

    return () => unsubscribe();
  }, []);

  const isDateBooked = (date, room) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookedDates[dateStr]?.rooms?.includes(room);
  };

  const handlePrevMonth = () => {
    setStartDate(date => addMonths(date, -1));
  };

  const handleNextMonth = () => {
    setStartDate(date => addMonths(date, 1));
  };

  const dateRange = eachDayOfInterval({
    start: startDate,
    end: endOfMonth(addMonths(startDate, 1))
  });

  return (
    <Container maxWidth="xl">
      <Box sx={{ 
        mt: 4, 
        mb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}>
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          mb: 2 
        }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              mb: 1
            }}
          >
            Bizim Ev Datça
          </Typography>

          <Divider sx={{ width: '100%', mb: 3 }} />
        </Box>

        {/* Calendar Navigation */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2
          }}
        >
          <IconButton 
            onClick={handlePrevMonth}
            sx={{ 
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography 
            variant="h5" 
            component="span" 
            sx={{ 
              fontWeight: 600,
              color: theme.palette.primary.main,
              minWidth: '300px',
              textAlign: 'center'
            }}
          >
            {format(startDate, 'MMMM yyyy', { locale: tr })} - {format(addMonths(startDate, 1), 'MMMM yyyy', { locale: tr })}
          </Typography>
          <IconButton 
            onClick={handleNextMonth}
            sx={{ 
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Paper>
        
        {/* Reservation Table */}
        <TableContainer 
          component={Paper} 
          sx={{ 
            overflowX: 'auto',
            borderRadius: 2,
            boxShadow: theme.shadows[5],
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.5),
              },
            },
          }}
        >
          <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    width: '120px',
                    position: 'sticky', 
                    left: 0, 
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    zIndex: 3,
                    borderRight: `1px solid ${alpha(theme.palette.common.white, 0.2)}`
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Odalar
                  </Typography>
                </TableCell>
                {dateRange.map(date => (
                  <TableCell 
                    key={date.toISOString()} 
                    align="center"
                    sx={{ 
                      width: '45px',
                      backgroundColor: isWeekend(date) ? 
                        alpha(theme.palette.primary.main, 0.1) : 
                        theme.palette.background.paper,
                      fontWeight: 'bold',
                      p: '4px 2px',
                      fontSize: '0.75rem',
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.primary.main}`
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {format(date, 'd')}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.65rem',
                          color: theme.palette.text.secondary,
                          mt: -0.5
                        }}
                      >
                        ({format(date, 'EEEEEE', { locale: tr })})
                      </Typography>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map(room => (
                <TableRow 
                  key={room} 
                  hover
                  sx={{
                    '&:nth-of-type(odd)': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.02),
                    },
                  }}
                >
                  <TableCell 
                    component="th" 
                    scope="row"
                    sx={{ 
                      position: 'sticky', 
                      left: 0, 
                      backgroundColor: theme.palette.background.paper,
                      fontWeight: 600,
                      borderRight: `1px solid ${theme.palette.divider}`,
                      zIndex: 2,
                      fontSize: '0.8rem',
                      p: '4px 8px',
                      whiteSpace: 'nowrap',
                      color: theme.palette.primary.main
                    }}
                  >
                    {room}
                  </TableCell>
                  {dateRange.map(date => (
                    <TableCell 
                      key={date.toISOString()}
                      align="center"
                      sx={{
                        backgroundColor: isDateBooked(date, room) 
                          ? alpha(theme.palette.error.main, 0.9)
                          : isWeekend(date)
                            ? alpha(theme.palette.primary.main, 0.05)
                            : 'transparent',
                        borderLeft: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        p: '4px 2px',
                        width: '45px',
                        height: '28px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isDateBooked(date, room)
                            ? alpha(theme.palette.error.main, 0.8)
                            : alpha(theme.palette.primary.main, 0.1)
                        }
                      }}
                    >
                      {isDateBooked(date, room) ? '•' : ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Legend */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          gap: 4,
          mt: 2 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              backgroundColor: alpha(theme.palette.error.main, 0.9),
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Rezerve
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Hafta Sonu
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default CustomerView; 