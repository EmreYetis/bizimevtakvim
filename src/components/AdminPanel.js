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
  Button,
  useTheme,
  alpha
} from '@mui/material';
import { collection, setDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
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

function AdminPanel() {
  const theme = useTheme();
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [bookedDates, setBookedDates] = useState({});
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState(null);
  const [dragOperation, setDragOperation] = useState(null); // 'add' veya 'delete'
  const navigate = useNavigate();

  useEffect(() => {
    // Real-time listener oluşturuyoruz
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

    // Cleanup function
    return () => unsubscribe();
  }, []); // startDate dependency'sini kaldırdık

  // Mouse olaylarını izlemek için effect
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartCell(null);
      setDragOperation(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handlePrevMonth = () => {
    setStartDate(date => addMonths(date, -1));
  };

  const handleNextMonth = () => {
    setStartDate(date => addMonths(date, 1));
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isDateBooked = (date, room) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookedDates[dateStr]?.rooms?.includes(room);
  };

  const toggleCell = (date, room) => {
    const key = `${date.toISOString()}_${room}`;
    const dateStr = date.toISOString().split('T')[0];
    const isCurrentlyBooked = bookedDates[dateStr]?.rooms?.includes(room);
    
    const newSelectedCells = new Set(selectedCells);
    if (newSelectedCells.has(key)) {
      newSelectedCells.delete(key);
    } else {
      // Eğer tarih zaten rezerve edilmişse, silme işlemi için seç
      if (isCurrentlyBooked) {
        newSelectedCells.add(`DELETE_${key}`);
      } else {
        newSelectedCells.add(key);
      }
    }
    setSelectedCells(newSelectedCells);
  };


  const handleSaveBookings = async () => {
    try {
      // Seçili hücreleri tarih bazında grupla
      const changes = {};
      
      selectedCells.forEach(key => {
        const isDelete = key.startsWith('DELETE_');
        const actualKey = isDelete ? key.substring(7) : key;
        const [dateStr, room] = actualKey.split('_');
        const date = new Date(dateStr).toISOString().split('T')[0];
        
        if (!changes[date]) {
          changes[date] = {
            toAdd: new Set(),
            toRemove: new Set()
          };
        }
        
        if (isDelete) {
          changes[date].toRemove.add(room);
        } else {
          changes[date].toAdd.add(room);
        }
      });

      console.log('Yapılacak değişiklikler:', changes);

      // Her tarih için değişiklikleri uygula
      for (const [date, { toAdd, toRemove }] of Object.entries(changes)) {
        console.log(`${date} tarihi için işlem yapılıyor:`);
        console.log('Mevcut rezervasyonlar:', bookedDates[date]?.rooms || []);
        
        const currentRooms = new Set(bookedDates[date]?.rooms || []);
        console.log('Silinecek odalar:', Array.from(toRemove));
        console.log('Eklenecek odalar:', Array.from(toAdd));
        
        // Silinecek odaları çıkar
        toRemove.forEach(room => currentRooms.delete(room));
        
        // Eklenecek odaları ekle
        toAdd.forEach(room => currentRooms.add(room));

        console.log('Son durum:', Array.from(currentRooms));

        const bookingRef = doc(db, 'bookings', date);
        
        if (currentRooms.size === 0) {
          // Eğer o tarihte hiç rezervasyon kalmadıysa, dökümanı sil
          console.log(`${date} tarihi için tüm rezervasyonlar siliniyor`);
          await deleteDoc(bookingRef);
        } else {
          // Yeni rezervasyon listesini kaydet
          console.log(`${date} tarihi için yeni rezervasyonlar kaydediliyor:`, Array.from(currentRooms));
          await setDoc(bookingRef, {
            rooms: Array.from(currentRooms)
          });
        }
      }

      console.log('Rezervasyonlar başarıyla güncellendi');
      setSelectedCells(new Set()); // Seçimleri temizle
      
    } catch (error) {
      console.error('Rezervasyon güncellenirken hata:', error);
    }
  };

  const handleClearSelection = () => {
    setSelectedCells(new Set());
  };

  // Tek aylık tarih aralığını oluştur
  const dateRange = eachDayOfInterval({
    start: startDate,
    end: endOfMonth(addMonths(startDate, 1))
  });

  const handleMouseDown = (date, room) => {
    const dateStr = date.toISOString().split('T')[0];
    const isCurrentlyBooked = bookedDates[dateStr]?.rooms?.includes(room);
    
    setIsDragging(true);
    setDragStartCell({ date, room });
    
    // Drag işleminin türünü belirle (ekleme veya silme)
    setDragOperation(isCurrentlyBooked ? 'delete' : 'add');
    
    // İlk hücreyi seç
    toggleCell(date, room);
  };

  const handleMouseEnter = (date, room) => {
    if (!isDragging || !dragStartCell) return;

    const key = `${date.toISOString()}_${room}`;
    const dateStr = date.toISOString().split('T')[0];
    const isCurrentlyBooked = bookedDates[dateStr]?.rooms?.includes(room);

    const newSelectedCells = new Set(selectedCells);

    // Eğer silme işlemi yapılıyorsa ve hücre doluysa
    if (dragOperation === 'delete' && isCurrentlyBooked) {
      newSelectedCells.add(`DELETE_${key}`);
    }
    // Eğer ekleme işlemi yapılıyorsa ve hücre boşsa
    else if (dragOperation === 'add' && !isCurrentlyBooked) {
      newSelectedCells.add(key);
    }

    setSelectedCells(newSelectedCells);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderRadius: 2,
          p: 2
        }}>
          <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
            Admin Paneli
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
              variant="h6" 
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
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleLogout}
              sx={{ ml: 2 }}
            >
              Çıkış Yap
            </Button>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveBookings}
            disabled={selectedCells.size === 0}
            sx={{ mr: 1 }}
          >
            Seçili Tarihleri Kaydet
          </Button>
          <Button 
            variant="outlined" 
            onClick={handleClearSelection}
            disabled={selectedCells.size === 0}
          >
            Seçimi Temizle
          </Button>
        </Box>
        
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
                      onMouseDown={(e) => { e.preventDefault(); handleMouseDown(date, room); }}
                      onMouseEnter={(e) => { e.preventDefault(); handleMouseEnter(date, room); }}
                      sx={{
                        backgroundColor: (() => {
                          const key = `${date.toISOString()}_${room}`;
                          if (selectedCells.has(`DELETE_${key}`)) {
                            return '#ffcdd2'; // Silinecek hücreler için açık kırmızı
                          } else if (selectedCells.has(key)) {
                            return '#81c784'; // Yeni eklenecek hücreler için yeşil
                          } else if (isDateBooked(date, room)) {
                            return alpha(theme.palette.error.main, 0.9); // Mevcut rezervasyonlar için kırmızı
                          }
                          return isWeekend(date) ? 
                            alpha(theme.palette.primary.main, 0.05) : 
                            'transparent';
                        })(),
                        borderLeft: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        p: '4px 2px',
                        width: '45px',
                        height: '28px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          filter: 'brightness(0.95)'
                        }
                      }}
                    >
                      {(() => {
                        const key = `${date.toISOString()}_${room}`;
                        if (selectedCells.has(`DELETE_${key}`)) {
                          return '×';
                        } else if (selectedCells.has(key)) {
                          return '✓';
                        } else if (isDateBooked(date, room)) {
                          return '•';
                        }
                        return '';
                      })()}
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
              backgroundColor: '#81c784',
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Eklenecek
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              backgroundColor: '#ffcdd2',
              borderRadius: '50%' 
            }} />
            <Typography variant="body2" color="text.secondary">
              Silinecek
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

export default AdminPanel; 