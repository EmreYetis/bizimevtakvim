import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Tooltip,
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
  'Yamaç ev',
  'İskaroz',
  'İskorpit',
  'Lopa'
];

function CustomerView() {
  const theme = useTheme();
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return startOfMonth(today);
  });
  const [bookedDates, setBookedDates] = useState({});
  const [activeMonth, setActiveMonth] = useState(0);
  const [monthAvailability, setMonthAvailability] = useState({});
  const tableRef = useRef(null);

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

  // Ay durumlarını Firebase'den yükle
  useEffect(() => {
    const availabilityRef = collection(db, 'monthAvailability');
    const unsubscribe = onSnapshot(availabilityRef, (snapshot) => {
      const availability = {};
      snapshot.forEach(doc => {
        availability[doc.id] = doc.data();
      });
      setMonthAvailability(availability);
    }, (error) => {
      console.error('Ay durumu dinleyicisinde hata:', error);
    });

    return () => unsubscribe();
  }, []);

  // Tarihin geçmiş tarih olup olmadığını kontrol eden fonksiyon
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // Ayın açık olup olmadığını kontrol et
  const isMonthOpen = (date) => {
    const yearMonth = format(date, 'yyyy-MM');
    return monthAvailability[yearMonth]?.isOpen === true; // Sadece açık işaretlenen aylar
  };

  const getFirstFutureOpenMonth = () => {
    const todayMonth = startOfMonth(new Date());
    const openMonths = Object.keys(monthAvailability)
      .filter(key => monthAvailability[key]?.isOpen === true)
      .map(key => new Date(`${key}-01`))
      .filter(date => !isPastDate(endOfMonth(date)))
      .sort((a, b) => a - b);
    return openMonths[0] || null;
  };

  // Verilen tarihten sonraki/kendisi dahil ilk açık ayı bul
  const findNextOpenMonth = (date) => {
    let cursor = startOfMonth(date);
    for (let i = 0; i < 24; i++) { // 2 yıl ileriye kadar dene
      const yearMonth = cursor;
      if (!isPastDate(endOfMonth(yearMonth)) && isMonthOpen(yearMonth)) {
        return yearMonth;
      }
      cursor = addMonths(cursor, 1);
    }
    return null;
  };

  // Verilen tarihten önceki açık ayı bul
  const findPrevOpenMonth = (date) => {
    let cursor = startOfMonth(date);
    for (let i = 0; i < 24; i++) { // 2 yıl geriye kadar dene
      cursor = addMonths(cursor, -1);
      if (!isPastDate(endOfMonth(cursor)) && isMonthOpen(cursor)) {
        return cursor;
      }
    }
    return null;
  };

  // isDateBooked fonksiyonunu güncelle
  const getBookingEntry = (date, room) => {
    const dateStr = date.toISOString().split('T')[0];
    const entry = bookedDates[dateStr];
    if (!entry || !Array.isArray(entry.rooms)) return null;
    // Hem eski string listesi hem yeni obje listesi destekleniyor
    const found = entry.rooms.find(item => {
      if (typeof item === 'string') return item === room;
      if (typeof item === 'object' && item?.room === room) return true;
      return false;
    });
    if (!found) return null;
    if (typeof found === 'string') {
      return { room: found };
    }
    return found;
  };

  const isDateBooked = (date, room) => {
    // Önce tarihin geçmiş olup olmadığını kontrol et
    if (isPastDate(date)) {
      return true; // Geçmiş tarihler için true döndür
    }

    // Ayın kapalı olup olmadığını kontrol et
    if (!isMonthOpen(date)) {
      return true; // Kapalı aylar için true döndür (rezerve gibi görünsün)
    }

    return !!getBookingEntry(date, room);
  };

  // Hücre rengi için yeni bir fonksiyon
  const getCellColor = (date, room) => {
    if (isPastDate(date)) {
      return alpha(theme.palette.grey[500], 0.9);
    }
    if (!isMonthOpen(date)) {
      return alpha(theme.palette.warning.main, 0.8);
    }
    const booking = getBookingEntry(date, room);
    if (booking) {
      if (booking.guestName) {
        return alpha(theme.palette.success.main, 0.65); // Rezervasyon
      }
      return alpha(theme.palette.error.main, 0.9); // Boş blokaj
    }
    if (isWeekend(date)) {
      return alpha(theme.palette.primary.main, 0.05);
    }
    return 'transparent';
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: tr });
    } catch (error) {
      return dateStr;
    }
  };

  const renderBookingTooltip = (booking) => {
    if (!booking) return '';
    if (!booking.guestName) {
      return (
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Kapalı / Blokaj
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Bu tarih bilgilendirme amaçlı kapatılmıştır.
          </Typography>
        </Box>
      );
    }

    const stayLabel = booking.stayStart && booking.stayEnd
      ? `${formatDateLabel(booking.stayStart)} - ${formatDateLabel(booking.stayEnd)}${booking.stayLengthDays ? ` · ${booking.stayLengthDays} gece` : ''}`
      : null;

    return (
      <Box sx={{ p: 1.5, minWidth: 220 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {booking.guestName}
        </Typography>
        {(typeof booking.adultCount === 'number' || typeof booking.childCount === 'number') && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {booking.adultCount ? `${booking.adultCount} yetişkin` : ''}
            {booking.adultCount && booking.childCount ? ' · ' : ''}
            {booking.childCount ? `${booking.childCount} çocuk` : ''}
          </Typography>
        )}
        {booking.guestPhone && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Tel: {booking.guestPhone}
          </Typography>
        )}
        {stayLabel && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Konaklama: {stayLabel}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mb: 0.25 }}>
          Ödenecek: {booking.amountDue ? `${booking.amountDue} ₺` : '-'}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.25 }}>
          Ödenen: {booking.amountPaid ? `${booking.amountPaid} ₺` : '-'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ödeme Tarihi: {booking.paymentDate ? formatDateLabel(booking.paymentDate) : 'Belirtilmedi'}
        </Typography>
        {booking.note && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Not: {booking.note}
          </Typography>
        )}
      </Box>
    );
  };

  const handlePrevMonth = () => {
    const prevOpen = findPrevOpenMonth(startDate);
    if (prevOpen) {
      setStartDate(prevOpen);
    }
  };

  const handleNextMonth = () => {
    const nextOpen = findNextOpenMonth(addMonths(startDate, 1));
    if (nextOpen) {
      setStartDate(nextOpen);
    }
  };

  const isPrevMonthDisabled = () => {
    return !findPrevOpenMonth(startDate);
  };

  // Açık ayları (en fazla 2 ay) hesapla
  const visibleMonths = (() => {
    const firstOpen = isMonthOpen(startDate) && !isPastDate(endOfMonth(startDate))
      ? startDate
      : findNextOpenMonth(startDate) || getFirstFutureOpenMonth() || startDate;

    const months = [firstOpen];
    const next = findNextOpenMonth(addMonths(firstOpen, 1));
    if (next) months.push(next);
    return months;
  })();

  const dateRange = visibleMonths.flatMap(month =>
    eachDayOfInterval({
      start: startOfMonth(month),
      end: endOfMonth(month)
    })
  );

  // Tablo scroll olayını dinle
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollPosition = container.scrollLeft;
    const totalWidth = container.scrollWidth - container.clientWidth;
    
    // Scroll pozisyonuna göre aktif ayı belirle
    if (scrollPosition > totalWidth / 2) {
      setActiveMonth(1); // İkinci ay
    } else {
      setActiveMonth(0); // İlk ay
    }
  }, []);

  // Scroll event listener'ı ekle
  useEffect(() => {
    const tableContainer = tableRef.current;
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll);
      return () => tableContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // MonthIndicator bileşeni güncellendi
  const MonthIndicator = ({ date, isActive }) => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity: isActive ? 1 : 0.6,
      transition: 'opacity 0.3s ease'
    }}>
      <Typography
        variant="h6"
        sx={{
          fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.3rem' },
          fontWeight: 600,
          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
          textTransform: 'capitalize'
        }}
      >
        {format(date, 'MMMM', { locale: tr })}
      </Typography>
      <Typography
        variant="subtitle2"
        sx={{
          fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
          color: theme.palette.text.secondary
        }}
      >
        {format(date, 'yyyy')}
      </Typography>
    </Box>
  );

  // Ekran genişliğine göre tablo hücre genişliğini hesapla
  const calculateCellWidth = () => {
    // Masaüstü görünümde container genişliğini al (yaklaşık 1200px)
    const containerWidth = window.innerWidth > 1200 ? 1200 : window.innerWidth - 48; // 48px padding
    // Oda ismi sütunu için ayrılan genişlik
    const roomColumnWidth = 150;
    // Kalan genişlik
    const remainingWidth = containerWidth - roomColumnWidth;
    // Bir aydaki gün sayısı (31 gün)
    const daysInMonth = 31;
    // Her hücre için gereken genişlik
    return Math.floor(remainingWidth / daysInMonth);
  };

  const [cellWidth, setCellWidth] = useState(calculateCellWidth());

  // Ekran boyutu değiştiğinde hücre genişliğini güncelle
  useEffect(() => {
    const handleResize = () => {
      setCellWidth(calculateCellWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ay verisi yüklendiğinde başlangıç ayını açık aya ayarla
  useEffect(() => {
    if (isMonthOpen(startDate) && !isPastDate(endOfMonth(startDate))) return;

    const firstOpen = getFirstFutureOpenMonth();
    if (firstOpen) setStartDate(firstOpen);
  }, [monthAvailability]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
      <Box sx={{ 
        mt: { xs: 2, sm: 4 },
        mb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 3 }
      }}>
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          mb: { xs: 2, sm: 3 }
        }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' }
            }}
          >
            🏠 Bizim Ev Datça
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: theme.palette.text.secondary,
              mt: 1
            }}
          >
            Rezervasyon takvimi
          </Typography>
        </Box>

        {/* Calendar Navigation */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 1.5, sm: 2 },
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: 2
          }}
        >
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 2, sm: 4 },
            position: 'relative'
          }}>
            <IconButton 
              onClick={handlePrevMonth}
              disabled={isPrevMonthDisabled()}
              sx={{ 
                color: theme.palette.primary.main,
                '&.Mui-disabled': {
                  color: theme.palette.action.disabled
                },
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 2 }
            }}>
              <MonthIndicator 
                date={visibleMonths[0] || startDate} 
                isActive={activeMonth === 0}
              />
              
              <Typography sx={{ 
                color: theme.palette.text.secondary,
                fontSize: { xs: '1.2rem', sm: '1.5rem' },
                fontWeight: 'bold',
                mx: { xs: 0.5, sm: 1 }
              }}>
                -
              </Typography>
              
              <MonthIndicator 
                date={visibleMonths[1] || addMonths(visibleMonths[0] || startDate, 1)} 
                isActive={activeMonth === 1 && !!visibleMonths[1]}
              />
            </Box>

            <IconButton onClick={handleNextMonth}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Aktif Ay Göstergesi */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: { xs: 1, sm: 1.5 },
            gap: 1
          }}>
            <Box sx={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main
            }} />
            <Typography variant="caption" sx={{ 
              color: theme.palette.text.secondary,
              fontSize: { xs: '0.7rem', sm: '0.8rem' }
            }}>
              {activeMonth === 0 ? 
                format(startDate, 'MMMM', { locale: tr }) : 
                format(addMonths(startDate, 1), 'MMMM', { locale: tr })} 
                  -Ayı-Gösteriliyor!
            </Typography>
          </Box>
        </Paper>
        
        {/* Reservation Table */}
        <TableContainer 
          ref={tableRef}
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
            },
            maxWidth: '100%'
          }}
        >
          <Table size="small" sx={{ 
            tableLayout: 'fixed',
            '& .MuiTableCell-root': {
              padding: { 
                xs: '2px', 
                sm: '4px',
                md: '8px 4px' // Masaüstünde biraz daha fazla dikey padding
              }
            }
          }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    width: { xs: '80px', sm: '120px', md: '150px' },
                    position: 'sticky', 
                    left: 0, 
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    zIndex: 3
                  }}
                >
                  <Typography variant="subtitle2" sx={{ 
                    fontWeight: 700,
                    fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' }
                  }}>
                    Odalar
                  </Typography>
                </TableCell>
                {dateRange.map(date => (
                  <TableCell 
                    key={date.toISOString()} 
                    align="center"
                    sx={{ 
                      width: { 
                        xs: '35px', 
                        sm: '45px',
                        md: `${cellWidth}px` // Dinamik genişlik
                      },
                      backgroundColor: isWeekend(date) ? 
                        alpha(theme.palette.primary.main, 0.1) : 
                        theme.palette.background.paper,
                      height: { xs: '40px', sm: '50px', md: '60px' } // Hücre yüksekliği
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      gap: { xs: 0, md: 0.5 } // Masaüstünde tarih ve gün arası boşluk
                    }}>
                      <Typography sx={{ 
                        fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.9rem' },
                        fontWeight: 'bold'
                      }}>
                        {format(date, 'd')}
                      </Typography>
                      <Typography sx={{ 
                        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.8rem' },
                        display: { xs: 'none', sm: 'block' },
                        color: theme.palette.text.secondary
                      }}>
                        {format(date, 'EEE', { locale: tr })}
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
                    height: { xs: '30px', sm: '40px', md: '50px' }
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
                      fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                      whiteSpace: 'nowrap',
                      color: theme.palette.primary.main
                    }}
                  >
                    {room}
                  </TableCell>
                  {dateRange.map(date => {
                    const booking = getBookingEntry(date, room);
                    const innerContent = (
                      <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isPastDate(date) ? (
                          <Typography sx={{ 
                            fontSize: '0.7rem', 
                            color: 'white',
                            opacity: 0.7 
                          }}>
                            •
                          </Typography>
                        ) : booking ? (
                          <Typography sx={{ 
                            fontSize: '0.7rem', 
                            color: 'white' 
                          }}>
                            •
                          </Typography>
                        ) : null}
                      </Box>
                    );

                    return (
                      <TableCell 
                        key={date.toISOString()}
                        align="center"
                        sx={{
                          backgroundColor: getCellColor(date, room),
                          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                          width: { 
                            xs: '35px', 
                            sm: '45px',
                            md: `${cellWidth}px`
                          },
                          cursor: isPastDate(date) ? 'not-allowed' : 'pointer',
                          '&:hover': {
                            backgroundColor: isPastDate(date) 
                              ? alpha(theme.palette.grey[500], 0.8)
                              : isDateBooked(date, room)
                                ? alpha(theme.palette.error.main, 0.8)
                                : alpha(theme.palette.primary.main, 0.1)
                          },
                          position: 'relative'
                        }}
                      >
                        {booking ? (
                          <Tooltip 
                            title={renderBookingTooltip(booking)}
                            placement="top"
                            arrow
                            enterDelay={150}
                          >
                            <Box sx={{ width: '100%', height: '100%' }}>
                              {innerContent}
                            </Box>
                          </Tooltip>
                        ) : innerContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

                 {/* Legend */}
         <Box sx={{ 
           display: 'flex', 
           justifyContent: 'center',
           flexWrap: 'wrap',
           gap: { xs: 2, sm: 4 },
           mt: { xs: 1, sm: 2 }
         }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: { xs: 12, sm: 16 }, 
              height: { xs: 12, sm: 16 }, 
              backgroundColor: alpha(theme.palette.success.main, 0.7),
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Rezervasyon
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: { xs: 12, sm: 16 }, 
              height: { xs: 12, sm: 16 }, 
              backgroundColor: alpha(theme.palette.error.main, 0.9),
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Blokaj (Bilgi yok)
            </Typography>
          </Box>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Box sx={{ 
               width: { xs: 12, sm: 16 }, 
               height: { xs: 12, sm: 16 }, 
               backgroundColor: alpha(theme.palette.grey[500], 0.9),
               borderRadius: '50%' 
             }} />
             <Typography variant="body2" color="text.secondary">
               Geçmiş Tarih
             </Typography>
           </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: { xs: 12, sm: 16 }, 
              height: { xs: 12, sm: 16 }, 
              backgroundColor: alpha(theme.palette.warning.main, 0.8),
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Kapalı Ay
            </Typography>
          </Box>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Box sx={{ 
               width: { xs: 12, sm: 16 }, 
               height: { xs: 12, sm: 16 }, 
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