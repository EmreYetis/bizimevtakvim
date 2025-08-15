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
    return monthAvailability[yearMonth]?.isOpen !== false; // Varsayılan olarak açık
  };

  // isDateBooked fonksiyonunu güncelle
  const isDateBooked = (date, room) => {
    // Önce tarihin geçmiş olup olmadığını kontrol et
    if (isPastDate(date)) {
      return true; // Geçmiş tarihler için true döndür
    }

    // Ayın kapalı olup olmadığını kontrol et
    if (!isMonthOpen(date)) {
      return true; // Kapalı aylar için true döndür (rezerve gibi görünsün)
    }

    // Normal rezervasyon kontrolü
    const dateStr = date.toISOString().split('T')[0];
    return bookedDates[dateStr]?.rooms?.includes(room);
  };

  // Hücre rengi için yeni bir fonksiyon
  const getCellColor = (date, room) => {
    if (isPastDate(date)) {
      // Geçmiş tarihler için farklı bir renk
      return alpha(theme.palette.grey[500], 0.9);
    }
    if (!isMonthOpen(date)) {
      // Kapalı aylar için farklı bir renk
      return alpha(theme.palette.warning.main, 0.8);
    }
    if (isDateBooked(date, room)) {
      // Normal rezervasyonlar için kırmızı
      return alpha(theme.palette.error.main, 0.9);
    }
    if (isWeekend(date)) {
      // Hafta sonları için mevcut renk
      return alpha(theme.palette.primary.main, 0.05);
    }
    return 'transparent';
  };

  const handlePrevMonth = () => {
    setStartDate(date => {
      const newDate = addMonths(date, -1);
      if (isPastDate(endOfMonth(newDate))) {
        return date;
      }
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setStartDate(date => addMonths(date, 1));
  };

  const isPrevMonthDisabled = () => {
    const prevMonth = addMonths(startDate, -1);
    return isPastDate(endOfMonth(prevMonth));
  };

  const dateRange = eachDayOfInterval({
    start: startDate,
    end: endOfMonth(addMonths(startDate, 1))
  });

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
          mb: { xs: 1, sm: 2 }
        }}>
                     <Typography 
             variant="h3" 
             sx={{ 
               fontWeight: 700,
               color: theme.palette.primary.main,
               mb: 1,
               fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' }
             }}
           >
             🏠 Bizim Ev Datça
           </Typography>

          <Divider sx={{ width: '100%', mb: { xs: 2, sm: 3 } }} />
        </Box>

        {/* Drone Image and Pricing Section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' },
          gap: { xs: 2, sm: 3 },
          mb: { xs: 2, sm: 3 },
          px: { xs: 1, sm: 2 }
        }}>
                     {/* Drone Image */}
           <Box sx={{
             flex: { lg: '1 1 65%' },
             display: 'flex',
             justifyContent: 'center'
           }}>
                         <Box sx={{
               position: 'relative',
               width: '100%',
               maxWidth: { xs: '100%', sm: '700px', md: '800px' },
               height: { xs: '400px', sm: '500px', md: '600px' },
               borderRadius: 4,
               overflow: 'hidden',
               boxShadow: theme.shadows[4],
               backgroundColor: '#f5f5f5',
               transition: 'all 0.3s ease-in-out',
               '&:hover': {
                 transform: 'scale(1.02)',
                 boxShadow: theme.shadows[8],
               }
             }}>
                               <img 
                  src="/images/drone-view.jpeg" 
                  alt="Bizim Ev Datça Drone Görüntüsü"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    backgroundColor: '#f5f5f5'
                  }}
                />
              {/* Overlay with gradient for better text readability */}
              <Box sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.3))',
                height: '30%',
                pointerEvents: 'none'
              }} />
            </Box>
          </Box>

                     {/* Pricing Table */}
           <Box sx={{
             flex: { lg: '1 1 35%' },
             display: 'flex',
             justifyContent: 'center',
             alignItems: 'flex-start'
           }}>
                         <Paper sx={{
               p: { xs: 2, sm: 3 },
               borderRadius: 3,
               boxShadow: theme.shadows[6],
               backgroundColor: alpha(theme.palette.primary.main, 0.05),
               border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
               width: '100%',
               maxWidth: { xs: '100%', sm: '500px', md: '550px' }
             }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700,
                  color: theme.palette.primary.main,
                  mb: 2,
                  textAlign: 'center',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' }
                }}
              >
                💰 Fiyat Bilgileri
              </Typography>

              {/* Ağustos Fiyatları */}
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 1,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  🌞 Ağustos Ayı
                </Typography>
                <Box sx={{ 
                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                  borderRadius: 2,
                  p: 2,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                }}>
                  <Typography sx={{ 
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    fontWeight: 600,
                    color: theme.palette.success.main,
                    mb: 1
                  }}>
                    Tüm Odalar: 23.000 ₺
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.text.secondary,
                    mb: 1
                  }}>
                    • 2 kişi + Kahvaltı 
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.text.secondary,
                    mb: 1
                  }}>
                    • 12 yaş ve üstü: +5.000 ₺/kişi
                  </Typography>
                                     <Typography sx={{ 
                     fontSize: { xs: '0.8rem', sm: '0.9rem' },
                     color: theme.palette.text.secondary,
                     mb: 1
                   }}>
                     • 12 yaş altı: Ücretsiz
                   </Typography>
                   <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.warning.main,
                    fontWeight: 600
                  }}>
                                         ⚠️ Maksimum 2 kişi (1,2,3,10 ve 11 Numaralı Odalar)
                                         </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.warning.main,
                    fontWeight: 600
                  }}>
                                      
                                         ⚠️ Maksimum 4 kişi (4,5,6,7,8 ve 9 Numaralı Odalar)
                  </Typography>
                </Box>
              </Box>

              {/* Eylül-Ekim Fiyatları */}
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 1,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  🍂 Eylül - Ekim Ayı
                </Typography>
                <Box sx={{ 
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  borderRadius: 2,
                  p: 2,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                }}>
                  <Typography sx={{ 
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    fontWeight: 600,
                    color: theme.palette.info.main,
                    mb: 1
                  }}>
                    Tüm Odalar: 18.000 ₺
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.text.secondary,
                    mb: 1
                  }}>
                    • 2 kişi + Kahvaltı 
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.text.secondary,
                    mb: 1
                  }}>
                    • 12 yaş üstü: +2.000 ₺/kişi
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.text.secondary,
                    mb: 1
                  }}>
                    • 12 yaş altı: Ücretsiz
                  </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.warning.main,
                    fontWeight: 600
                  }}>
                                         ⚠️ Maksimum 2 kişi (1,2,3,10 ve 11 Numaralı Odalar)
                                         </Typography>
                  <Typography sx={{ 
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    color: theme.palette.warning.main,
                    fontWeight: 600
                  }}>
                                      
                                         ⚠️ Maksimum 4 kişi (4,5,6,7,8 ve 9 Numaralı Odalar)
                  </Typography>
                </Box>
              </Box>

                             {/* Önemli Notlar */}
               <Box sx={{ 
                 mt: 2,
                 p: 2,
                 backgroundColor: alpha(theme.palette.warning.main, 0.1),
                 borderRadius: 2,
                 border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
               }}>
                 <Typography sx={{ 
                   fontSize: { xs: '0.8rem', sm: '0.9rem' },
                   color: theme.palette.warning.main,
                   fontWeight: 600,
                   mb: 1
                 }}>
                   📋 Önemli Bilgiler
                 </Typography>
                 <Typography sx={{ 
                   fontSize: { xs: '0.75rem', sm: '0.8rem' },
                   color: theme.palette.text.secondary,
                   mb: 0.5
                 }}>
                   • 12 yaş üstü kişiler yetişkin kabul edilir
                 </Typography>
                 <Typography sx={{ 
                   fontSize: { xs: '0.75rem', sm: '0.8rem' },
                   color: theme.palette.text.secondary,
                   mb: 0.5
                 }}>
                   • 4 Kişi Kapasiteli Odalar: 2 Yetişkin + 2 Çocuk Kapasitelidir
                 </Typography>

               </Box>
            </Paper>
          </Box>
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
                date={startDate} 
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
                date={addMonths(startDate, 1)} 
                isActive={activeMonth === 1}
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
                  {dateRange.map(date => (
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
                            ? alpha(theme.palette.grey[500], 0.8)  // Geçmiş tarihler için hover rengi
                            : isDateBooked(date, room)
                              ? alpha(theme.palette.error.main, 0.8)  // Rezerve günler için hover rengi
                              : alpha(theme.palette.primary.main, 0.1)  // Boş günler için hover rengi
                        },
                        position: 'relative'
                      }}
                    >
                      {/* Hücre içeriği */}
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
                        ) : isDateBooked(date, room) ? (
                          <Typography sx={{ 
                            fontSize: '0.7rem', 
                            color: 'white' 
                          }}>
                            •
                          </Typography>
                        ) : null}
                      </Box>
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
           flexWrap: 'wrap',
           gap: { xs: 2, sm: 4 },
           mt: { xs: 1, sm: 2 }
         }}>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Box sx={{ 
               width: { xs: 12, sm: 16 }, 
               height: { xs: 12, sm: 16 }, 
               backgroundColor: alpha(theme.palette.error.main, 0.9),
               borderRadius: '50%' 
             }} />
             <Typography variant="body2" color="text.secondary">
               Rezerve
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